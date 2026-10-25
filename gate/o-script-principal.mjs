/**
 * **Este módulo é o programa principal?** — a única régua dos scripts de
 * `scripts/` para decidir se rodam o `main`.
 *
 * A comparação ingênua, `` import.meta.url === `file://${process.argv[1]}` ``,
 * falha calada em dois casos medidos em 2026-10-11:
 *
 *   - **link simbólico** — o Node resolve o link no `import.meta.url` e não no
 *     `argv[1]` (no macOS o `tmpdir` é `/var` → `/private/var`; as skills
 *     moram atrás de `~/.claude/skills`);
 *   - **pasta com espaço ou acento** — a URL codifica `%20`, o caminho não.
 *
 * Nos dois, o `main` não rodava e o processo saía **0**: o gate verde sem gate
 * (#892), o hook da guarda de operação deixando passar sem perguntar. A
 * variante `fileURLToPath(import.meta.url) === process.argv[1]` conserta o
 * espaço e continua cega ao link. Aqui os dois lados viram caminho REAL
 * (`fileURLToPath` + `realpathSync`) antes de comparar.
 *
 * Este arquivo não importa nada além do Node.
 */
import { realpathSync } from "node:fs";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * `"principal"`, `"importado"` ou `"suspeito"`. `"suspeito"` é o `argv[1]` com
 * o MESMO nome de arquivo e outro caminho real: quem chamou queria rodar este
 * script, e não rodá-lo em silêncio é o defeito que esta função fecha.
 */
export function papelDoScript(urlDoModulo, argv1 = process.argv[1]) {
  if (!argv1) return "importado";
  const real = (caminho) => {
    try {
      return realpathSync(caminho);
    } catch {
      return null;
    }
  };
  const doModulo = real(fileURLToPath(urlDoModulo));
  const doArgv = real(argv1);
  if (doModulo !== null && doModulo === doArgv) return "principal";
  return basename(argv1) === basename(fileURLToPath(urlDoModulo)) ? "suspeito" : "importado";
}

/**
 * Roda `main` se este módulo é o programa principal; no `"suspeito"`, diz e
 * sai com 1. `main` devolve o código de saída, ou uma promessa dele — o
 * síncrono continua síncrono. `exitCode`, nunca `process.exit()`:
 * o processo sai sozinho quando o laço esvazia, e escrita pendente em pipe
 * não é truncada. Exceção do `main` vira mensagem com o prefixo e código 1.
 */
export function rodarSePrincipal(urlDoModulo, main, prefixo = `[${basename(fileURLToPath(urlDoModulo), ".mjs")}]`) {
  const papel = papelDoScript(urlDoModulo);
  if (papel === "importado") return;
  if (papel === "suspeito") {
    console.error(
      `${prefixo} não reconheci este processo como o script ${fileURLToPath(urlDoModulo)} ` +
        `(argv[1] = ${process.argv[1]}): os caminhos reais não batem, e sair 0 sem rodar esconderia que nada rodou`,
    );
    process.exitCode = 1;
    return;
  }
  const falhou = (e) => {
    console.error(`${prefixo} ${e?.stack ?? e}`);
    process.exitCode = 1;
  };
  let resultado;
  try {
    resultado = main();
  } catch (e) {
    falhou(e);
    return;
  }
  if (resultado && typeof resultado.then === "function") {
    resultado.then((codigo) => {
      process.exitCode = codigo;
    }, falhou);
  } else {
    process.exitCode = resultado;
  }
}
