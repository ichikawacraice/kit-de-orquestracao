#!/usr/bin/env node
/**
 * **Roda um comando de teste pelo teto de núcleos da máquina** (ADR 0005, operador, 26/10).
 *
 *   node gate/com-fichas.mjs [--quero N] -- <comando…>
 *
 * Toma até N fichas (padrão 2; leva o que houver livre, no mínimo 1, e espera se não há nenhuma), troca `{fichas}`
 * em qualquer argumento pelo número levado, roda o comando num grupo de processos próprio com
 * `KIT_FICHAS_TOMADAS` e `KIT_TESTE_WORKERS` = o número levado, e solta as fichas ao sair. O código de saída é o do comando.
 *
 * Com `KIT_FICHAS_TOMADAS` já no env (quem chama já tem fichas) não toma de novo e repassa o número. No CI não há teto:
 * roda o comando e troca `{fichas}` pelos núcleos da máquina.
 */
import { spawn } from "node:child_process";
import { availableParallelism } from "node:os";
import { pastaDoTeto, quemSouEuNasFichas, soltarFichas, tetoDaMaquina, tomarFichas } from "./o-teto-da-maquina.mjs";
import { rodarSePrincipal } from "./o-script-principal.mjs";

const USO = "uso: com-fichas [--quero N] -- <comando…>   (N inteiro ≥ 1, padrão 2; `{fichas}` nos argumentos vira o número levado)";

/** Os argumentos: `{ quero, comando }`, ou `null` se o uso está errado. */
export function lerArgumentos(argv) {
  const corte = argv.indexOf("--");
  if (corte === -1) return null;
  const antes = argv.slice(0, corte);
  const comando = argv.slice(corte + 1);
  if (comando.length === 0) return null;
  let quero = 2;
  if (antes.length > 0) {
    if (antes.length !== 2 || antes[0] !== "--quero") return null;
    quero = Number(antes[1]);
    if (!Number.isInteger(quero) || quero < 1) return null;
  }
  return { quero, comando };
}

/** Roda o comando num grupo próprio, repassando SIGINT/SIGTERM/SIGHUP ao grupo inteiro. Devolve o código de saída. */
function rodar(comando, env) {
  return new Promise((resolve) => {
    const [cmd, ...args] = comando;
    const filho = spawn(cmd, args, { env, stdio: "inherit", detached: process.platform !== "win32", shell: process.platform === "win32" });
    const matarGrupo = (sinal) => {
      try {
        if (process.platform === "win32") filho.kill(sinal);
        else process.kill(-filho.pid, sinal);
      } catch {
        /* o grupo já saiu */
      }
    };
    const sinais = ["SIGINT", "SIGTERM", "SIGHUP"].map((s) => [s, () => matarGrupo(s)]);
    for (const [s, h] of sinais) process.on(s, h);
    filho.on("error", (e) => {
      console.error(`[com-fichas] não consegui rodar ${cmd}: ${e.message}`);
      for (const [s, h] of sinais) process.off(s, h);
      resolve(127);
    });
    filho.on("close", (codigo, sinal) => {
      for (const [s, h] of sinais) process.off(s, h);
      if (sinal) console.error(`[com-fichas] o comando terminou pelo sinal ${sinal}`);
      resolve(codigo ?? 1);
    });
  });
}

/** O com-fichas inteiro. Devolve o código de saída. */
export async function main(env = process.env, argv = process.argv.slice(2)) {
  const lidos = lerArgumentos(argv);
  if (lidos === null) {
    console.error(USO);
    return 2;
  }
  const { quero, comando } = lidos;
  const com = (n) => comando.map((a) => a.replaceAll("{fichas}", String(n)));
  const filho = (n) => ({ ...env, KIT_FICHAS_TOMADAS: String(n), KIT_TESTE_WORKERS: String(n) });

  if (env["CI"]) return rodar(com(availableParallelism()), env);

  const ja = env["KIT_FICHAS_TOMADAS"];
  if (ja !== undefined && ja !== "") {
    const n = Number(ja);
    if (!Number.isInteger(n) || n < 1) {
      console.error(`[com-fichas] KIT_FICHAS_TOMADAS precisa ser inteiro ≥ 1, e veio ${JSON.stringify(ja)}`);
      return 2;
    }
    return rodar(com(n), filho(n));
  }

  const pasta = pastaDoTeto(env);
  const teto = tetoDaMaquina(env, availableParallelism(), pasta);
  const eu = quemSouEuNasFichas();
  const levou = await tomarFichas({ quero, pasta, teto, eu });
  const soltar = () => soltarFichas(pasta, levou, eu);
  process.on("exit", soltar);
  try {
    return await rodar(com(levou.length), filho(levou.length));
  } finally {
    soltar();
    process.off("exit", soltar);
  }
}

// Pelo caminho REAL dos dois lados; `exitCode`, nunca `process.exit()`.
rodarSePrincipal(import.meta.url, () => main(), "[com-fichas]");
