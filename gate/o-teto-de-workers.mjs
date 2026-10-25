import { availableParallelism } from "node:os";
import { envKit } from "./config.mjs";

/**
 * **O teto de workers do vitest fora do CI, num lugar só** — para o
 * `vitest.config.*` do projeto importar (`...tetoDeWorkers()`).
 *
 * **O caso.** Várias sessões rodando a suíte ao mesmo tempo travaram a máquina.
 * O default do vitest em `run` é `núcleos − 1` workers por pacote; num workspace
 * que roda pacotes juntos, é um múltiplo disso, e dois gates dobram. A sobrecarga
 * ainda gera falso vermelho em teste de relógio real.
 *
 * **A armadilha do vitest 2.x.** `maxWorkers` sozinho MORRE: o `minWorkers` que
 * ele não recebe cai no default de `núcleos − 1`, e o tinypool recusa `min > max`
 * com `RangeError: options.minThreads and options.maxThreads must not conflict`.
 * O desfecho é "no tests" e exit 1 — um vermelho que se lê como "não havia
 * teste", não como "o config está errado". Por isso os dois vão juntos.
 *
 * **No CI nada muda** (`process.env.CI`): devolve `{}` e o vitest fica no default.
 *
 * `KIT_TESTE_WORKERS` (ou o legado `IZANAGI_TESTE_WORKERS`) sobrescreve o teto
 * (inteiro ≥ 1). Valor que não é inteiro positivo é recusado alto: um `NaN`
 * chegaria ao tinypool como `Invalid array length`, o mesmo "no tests".
 *
 * `workersPorNucleo` (`teto.workersPorNucleo` do `kit.json`, padrão 0,25): um
 * QUARTO da máquina por pacote — 3 em 15 núcleos.
 */
export function tetoDeWorkers(env = process.env, nucleos = availableParallelism(), workersPorNucleo = 0.25) {
  if (env["CI"]) return {};
  const pedido = envKit(env, "TESTE_WORKERS");
  if (pedido !== undefined) {
    const n = Number(pedido);
    if (!Number.isInteger(n) || n < 1) {
      throw new Error(`KIT_TESTE_WORKERS precisa ser inteiro ≥ 1, e veio ${JSON.stringify(pedido)}`);
    }
    return { maxWorkers: n, minWorkers: 1 };
  }
  return { maxWorkers: workersPorPacote(nucleos, workersPorNucleo), minWorkers: 1 };
}

/** O teto derivado dos núcleos: `floor(núcleos × fração)`, no mínimo 1. */
export const workersPorPacote = (nucleos, workersPorNucleo = 0.25) => Math.max(1, Math.floor(nucleos * workersPorNucleo));
