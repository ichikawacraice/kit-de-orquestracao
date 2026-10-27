#!/usr/bin/env node
/**
 * **O typecheck do gate, pelo mesmo verde guardado.** Roda `gate.typecheck` do
 * `kit.json` (no perfil `pnpm-workspace`, `pnpm -r typecheck`), depois de
 * construir o que o gate lê. Fora do CI consulta o verde da etapa `typecheck`
 * antes (mesma chave da suíte) e grava depois, se a árvore não mudou. Sem
 * `gate.typecheck` declarado, recusa alto: não adivinha o comando.
 */
import { spawnSync } from "node:child_process";
import { availableParallelism } from "node:os";
import { carregarConfig, partirComando } from "./config.mjs";
import { RAIZ, conferirInstalacao, constroi } from "./o-dist-que-o-gate-le.mjs";
import { consultar, guardarSeAArvoreNaoMudou, linhaDoPulo } from "./o-verde-da-arvore.mjs";
import { rodarSePrincipal } from "./o-script-principal.mjs";
import { pastaDoTeto, quemSouEuNasFichas, soltarFichas, tetoDaMaquina, tomarFichasNormaisSync } from "./o-teto-da-maquina.mjs";

/** Roda `gate.typecheck` com prazo (`gate.prazos.typecheckMin`) e SIGKILL: um `tsc` pendurado não pode segurar a sessão. Devolve o código de saída. */
function rodarOTypecheck(raiz, cfg, env = process.env) {
  if (!cfg.gate.typecheck) {
    console.error('[typecheck] falta "gate.typecheck" no .claude/kit.json — não adivinho o comando');
    return 1;
  }
  const prazoMs = cfg.gate.prazos.typecheckMin * 60_000;
  const [cmd, ...args] = partirComando(cfg.gate.typecheck);
  // As fichas do teto da máquina (ADR 0005 e 0008; como teste normal, fora da vez do gate): `gate.nucleosTypecheck`, a não ser que quem chamou já as tenha (`KIT_FICHAS_TOMADAS`) ou seja o CI.
  const jaTem = env["KIT_FICHAS_TOMADAS"] !== undefined && env["KIT_FICHAS_TOMADAS"] !== "";
  const pasta = pastaDoTeto(env);
  const teto = env["CI"] || jaTem ? null : tetoDaMaquina(env, availableParallelism(), pasta);
  const eu = teto === null ? null : quemSouEuNasFichas(raiz);
  const levou = eu === null ? [] : tomarFichasNormaisSync({ quero: cfg.gate.nucleosTypecheck, pasta, teto, eu });
  const soltar = () => (eu === null ? [] : soltarFichas(pasta, levou, eu));
  process.on("exit", soltar);
  try {
    const filho = eu === null ? env : { ...env, KIT_FICHAS_TOMADAS: String(levou.length) };
    const { status, signal, error } = spawnSync(cmd, args, {
      cwd: raiz,
      env: filho,
      stdio: "inherit",
      shell: process.platform === "win32",
      timeout: prazoMs,
      killSignal: "SIGKILL",
    });
    if (error) console.error(`[typecheck] não rodou: ${error.message}`);
    if (signal) console.error(`[typecheck] terminou pelo sinal ${signal} (prazo de ${prazoMs / 60_000} min)`);
    return status ?? 1;
  } finally {
    soltar();
    process.off("exit", soltar);
  }
}

/** O typecheck do gate. Devolve o código de saída. */
export async function main(env = process.env, raiz = RAIZ, cfg = carregarConfig(raiz)) {
  if (env["CI"]) {
    const codigo = constroi(raiz, env, cfg);
    if (codigo !== 0) return codigo;
    return rodarOTypecheck(raiz, cfg, env);
  }

  const instalacao = conferirInstalacao(raiz, env, undefined, cfg);
  if (instalacao !== 0) return instalacao;

  const verde = consultar("typecheck", raiz, env, undefined, cfg);
  if (verde.registro) {
    console.error(linhaDoPulo(verde.registro));
    return 0;
  }
  console.error(
    verde.recusa !== null
      ? `[gate] sem typecheck verde guardado possível: ${verde.recusa} — medindo, sem guardar`
      : `[gate] a árvore ${verde.insumos.arvore} não tem typecheck verde guardado — medindo`,
  );

  const inicio = Date.now();
  const codigo = constroi(raiz, env, cfg);
  if (codigo !== 0) return codigo;
  const resultado = rodarOTypecheck(raiz, cfg, env);
  if (resultado === 0) guardarSeAArvoreNaoMudou("typecheck", verde, inicio, raiz, env, undefined, cfg);
  return resultado;
}

// Pelo caminho REAL dos dois lados; `exitCode`, nunca `process.exit()`.
rodarSePrincipal(import.meta.url, () => main(), "[typecheck]");
