import { availableParallelism } from "node:os";
import { envKit } from "./config.mjs";
import { pastaDoTeto, quemSouEuNasFichas, soltarFichas, tetoDaMaquina, tomarFichasNormaisSync } from "./o-teto-da-maquina.mjs";

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
 *
 * **O teto da máquina** (ADR 0005 e 0008, operador, 26/10; teste normal: faixa normal, mais a do gate emprestada sem gate rodando): o processo principal do vitest pede esse número em fichas
 * (`o-teto-da-maquina.mjs`), leva o que houver livre (no mínimo 1) e devolve `maxWorkers` = o que levou. Com
 * `KIT_FICHAS_TOMADAS` no env (o gate, o `com-fichas`, ou uma leitura anterior deste processo) não toma de novo; um
 * worker do vitest (`VITEST_WORKER_ID`/`VITEST_POOL_ID`) também não. `opcoes` (`pasta`, `teto`, `avisar`, `dormir`)
 * existem para o teste.
 */
export function tetoDeWorkers(env = process.env, nucleos = availableParallelism(), workersPorNucleo = 0.25, opcoes = {}) {
  if (env["CI"]) return {};
  const pedido = envKit(env, "TESTE_WORKERS");
  if (pedido !== undefined) {
    const n = Number(pedido);
    if (!Number.isInteger(n) || n < 1) {
      throw new Error(`KIT_TESTE_WORKERS precisa ser inteiro ≥ 1, e veio ${JSON.stringify(pedido)}`);
    }
  }
  const hoje = pedido !== undefined ? Number(pedido) : workersPorPacote(nucleos, workersPorNucleo);

  // Quem já tem fichas (o gate, o `com-fichas`, ou este mesmo processo numa leitura anterior do config) não toma de novo.
  // Se o gate repartiu as fichas entre pacotes juntos, `KIT_TESTE_WORKERS` é a parte deste pacote: vale o menor.
  const tomadas = env["KIT_FICHAS_TOMADAS"];
  if (tomadas !== undefined && tomadas !== "") {
    const n = Number(tomadas);
    if (!Number.isInteger(n) || n < 1) throw new Error(`KIT_FICHAS_TOMADAS precisa ser inteiro ≥ 1, e veio ${JSON.stringify(tomadas)}`);
    return { maxWorkers: pedido !== undefined ? Math.min(hoje, n) : n, minWorkers: 1 };
  }
  // Um worker do vitest não toma ficha: quem a tomou foi o processo principal, e os workers só leem o config.
  if (env["VITEST_WORKER_ID"] !== undefined || env["VITEST_POOL_ID"] !== undefined) return { maxWorkers: hoje, minWorkers: 1 };

  const pasta = opcoes.pasta ?? pastaDoTeto(env);
  const teto = opcoes.teto ?? tetoDaMaquina(env, nucleos, pasta);
  if (teto === null) return { maxWorkers: hoje, minWorkers: 1 };
  const eu = quemSouEuNasFichas();
  const levou = tomarFichasNormaisSync({ quero: hoje, pasta, teto, eu, ...(opcoes.avisar ? { avisar: opcoes.avisar } : {}), ...(opcoes.dormir ? { dormir: opcoes.dormir } : {}) });
  // Os filhos herdam a env e não tomam de novo; as fichas saem com o processo (o vitest em watch as segura até fechar, de propósito).
  process.env["KIT_FICHAS_TOMADAS"] = String(levou.length);
  process.once("exit", () => soltarFichas(pasta, levou, eu));
  return { maxWorkers: levou.length, minWorkers: 1 };
}

/** O teto derivado dos núcleos: `floor(núcleos × fração)`, no mínimo 1. */
export const workersPorPacote = (nucleos, workersPorNucleo = 0.25) => Math.max(1, Math.floor(nucleos * workersPorNucleo));
