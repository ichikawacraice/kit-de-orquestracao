#!/usr/bin/env node
/**
 * **O typecheck do gate, pelo mesmo verde guardado.** Roda `gate.typecheck` do
 * `kit.json` (no perfil `pnpm-workspace`, `pnpm -r typecheck`), depois de
 * construir o que o gate lê. Fora do CI consulta o verde da etapa `typecheck`
 * antes (mesma chave da suíte) e grava depois, se a árvore não mudou. Sem
 * `gate.typecheck` declarado, recusa alto: não adivinha o comando.
 */
import { spawnSync } from "node:child_process";
import { carregarConfig, partirComando } from "./config.mjs";
import { RAIZ, conferirInstalacao, constroi } from "./o-dist-que-o-gate-le.mjs";
import { consultar, guardarSeAArvoreNaoMudou, linhaDoPulo } from "./o-verde-da-arvore.mjs";
import { rodarSePrincipal } from "./o-script-principal.mjs";

/** Roda `gate.typecheck` com prazo (`gate.prazos.typecheckMin`) e SIGKILL: um `tsc` pendurado não pode segurar a sessão. Devolve o código de saída. */
function rodarOTypecheck(raiz, cfg) {
  if (!cfg.gate.typecheck) {
    console.error('[typecheck] falta "gate.typecheck" no .claude/kit.json — não adivinho o comando');
    return 1;
  }
  const prazoMs = cfg.gate.prazos.typecheckMin * 60_000;
  const [cmd, ...args] = partirComando(cfg.gate.typecheck);
  const { status, signal, error } = spawnSync(cmd, args, {
    cwd: raiz,
    stdio: "inherit",
    shell: process.platform === "win32",
    timeout: prazoMs,
    killSignal: "SIGKILL",
  });
  if (error) console.error(`[typecheck] não rodou: ${error.message}`);
  if (signal) console.error(`[typecheck] terminou pelo sinal ${signal} (prazo de ${prazoMs / 60_000} min)`);
  return status ?? 1;
}

/** O typecheck do gate. Devolve o código de saída. */
export async function main(env = process.env, raiz = RAIZ, cfg = carregarConfig(raiz)) {
  if (env["CI"]) {
    const codigo = constroi(raiz, env, cfg);
    if (codigo !== 0) return codigo;
    return rodarOTypecheck(raiz, cfg);
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
  const resultado = rodarOTypecheck(raiz, cfg);
  if (resultado === 0) guardarSeAArvoreNaoMudou("typecheck", verde, inicio, raiz, env, undefined, cfg);
  return resultado;
}

// Pelo caminho REAL dos dois lados; `exitCode`, nunca `process.exit()`.
rodarSePrincipal(import.meta.url, () => main(), "[typecheck]");
