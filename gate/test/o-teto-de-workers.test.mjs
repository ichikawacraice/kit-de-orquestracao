import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { tetoDeWorkers } from "../o-teto-de-workers.mjs";

/**
 * **O `tetoDeWorkers` do `vitest.config` toma as fichas do teto da máquina** (ADR 0005, operador, 26/10).
 *
 * A pasta é um `mkdtempSync` (`opcoes.pasta`); a de verdade nunca é tocada. O caso que toma ficha grava
 * `KIT_FICHAS_TOMADAS` no `process.env` (é o que os filhos herdam) — por isso cada caso o limpa.
 */
let dir;
let pasta;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "kit-workers-"));
  pasta = join(dir, "nucleos");
  mkdirSync(pasta);
  assert.deepEqual(readdirSync(pasta), []); // todo caso parte sem ficha
  delete process.env.KIT_FICHAS_TOMADAS;
});

afterEach(() => {
  delete process.env.KIT_FICHAS_TOMADAS;
  rmSync(dir, { recursive: true, force: true });
});

describe("tetoDeWorkers com o teto da máquina", () => {
  it("no CI devolve {} e não toma ficha", () => {
    assert.deepEqual(tetoDeWorkers({ CI: "1" }, 15, 0.25, { pasta, teto: 2 }), {});
    assert.deepEqual(readdirSync(pasta), []);
  });

  it("com KIT_FICHAS_TOMADAS no env, usa o número e não toma nada", () => {
    assert.deepEqual(tetoDeWorkers({ KIT_FICHAS_TOMADAS: "5" }, 15, 0.25, { pasta, teto: 2 }), { maxWorkers: 5, minWorkers: 1 });
    assert.deepEqual(readdirSync(pasta), []);
  });

  it("com KIT_FICHAS_TOMADAS e KIT_TESTE_WORKERS menor (o gate de workspace reparte), vale o menor", () => {
    assert.deepEqual(tetoDeWorkers({ KIT_FICHAS_TOMADAS: "6", KIT_TESTE_WORKERS: "3" }, 15, 0.25, { pasta, teto: 2 }), { maxWorkers: 3, minWorkers: 1 });
    assert.deepEqual(tetoDeWorkers({ KIT_FICHAS_TOMADAS: "2", KIT_TESTE_WORKERS: "9" }, 15, 0.25, { pasta, teto: 2 }), { maxWorkers: 2, minWorkers: 1 });
  });

  it("dentro de um worker do vitest (VITEST_WORKER_ID ou VITEST_POOL_ID) o comportamento é o de hoje, sem tomar", () => {
    for (const marca of ["VITEST_WORKER_ID", "VITEST_POOL_ID"]) {
      assert.deepEqual(tetoDeWorkers({ [marca]: "1" }, 15, 0.25, { pasta, teto: 2 }), { maxWorkers: 3, minWorkers: 1 }, marca);
      assert.deepEqual(tetoDeWorkers({ [marca]: "1", KIT_TESTE_WORKERS: "4" }, 15, 0.25, { pasta, teto: 2 }), { maxWorkers: 4, minWorkers: 1 }, marca);
    }
    assert.deepEqual(readdirSync(pasta), []);
    assert.equal(process.env.KIT_FICHAS_TOMADAS, undefined);
  });

  it("no processo principal: pede o de hoje, leva o que o teto dá, grava KIT_FICHAS_TOMADAS e devolve o que levou", () => {
    // teto 2, pede 3 (15 núcleos × 0,25 arredondado)
    const r = tetoDeWorkers({}, 15, 0.25, { pasta, teto: 2, avisar: () => {} });
    assert.deepEqual(r, { maxWorkers: 2, minWorkers: 1 });
    assert.deepEqual(readdirSync(pasta).sort(), ["1", "2"]);
    assert.equal(process.env.KIT_FICHAS_TOMADAS, "2");
  });

  it("a segunda chamada no mesmo processo (config lido de novo) não toma de novo", () => {
    tetoDeWorkers({}, 15, 0.25, { pasta, teto: 4, avisar: () => {} });
    const antes = readdirSync(pasta).sort();
    assert.equal(antes.length, 3);
    // só a variável que a primeira chamada gravou: o ambiente de quem roda o teste (KIT_TESTE_WORKERS etc.) não entra
    const r = tetoDeWorkers({ KIT_FICHAS_TOMADAS: process.env.KIT_FICHAS_TOMADAS }, 15, 0.25, { pasta, teto: 4, avisar: () => {} });
    assert.deepEqual(r, { maxWorkers: 3, minWorkers: 1 });
    assert.deepEqual(readdirSync(pasta).sort(), antes);
  });

  it("com a vez do gate tomada por outro dono, não leva ficha da faixa do gate (≤ G) e fica na normal (ADR 0008)", () => {
    writeFileSync(join(pasta, "gate"), JSON.stringify({ pid: process.pid, token: "gate", worktree: "/wt/gate", projeto: "kit", desde: "2026-10-26T10:00:00.000Z" }));
    // teto 10 → faixas 7/3; pede 3 (15 × 0,25 = 3): leva 10, 9, 8
    const r = tetoDeWorkers({}, 15, 0.25, { pasta, teto: 10, avisar: () => {} });
    assert.deepEqual(r, { maxWorkers: 3, minWorkers: 1 });
    assert.deepEqual(readdirSync(pasta).sort(), ["10", "8", "9", "gate"]);
  });

  it("com a vez do gate tomada e a faixa normal CHEIA, espera em vez de emprestar (5..7 ficam livres)", () => {
    writeFileSync(join(pasta, "gate"), JSON.stringify({ pid: process.pid, token: "gate", worktree: "/wt/gate", projeto: "kit", desde: "2026-10-26T10:00:00.000Z" }));
    for (const k of [10, 9, 8]) writeFileSync(join(pasta, String(k)), JSON.stringify({ pid: process.pid, token: "x", worktree: "/wt/x", projeto: "kit", desde: "2026-10-26T10:00:00.000Z" }));
    let esperou = 0;
    assert.throws(
      () => tetoDeWorkers({}, 15, 0.25, { pasta, teto: 10, avisar: () => {}, dormir: () => { esperou += 1; throw new Error("ESPEROU"); } }),
      /ESPEROU/,
      "devia esperar uma ficha normal; se levou da faixa do gate, emprestou com o gate rodando",
    );
    assert.equal(esperou, 1);
    assert.deepEqual(readdirSync(pasta).filter((n) => Number(n) <= 7), [], "nenhuma ficha de 1 a 7");
  });

  it("sem gate rodando e com a faixa normal esgotada, empresta da faixa do gate, sem passar do pedido", () => {
    for (const k of [10, 9, 8]) writeFileSync(join(pasta, String(k)), JSON.stringify({ pid: process.pid, token: "x", worktree: "/wt/x", projeto: "kit", desde: "2026-10-26T10:00:00.000Z" }));
    const r = tetoDeWorkers({}, 15, 0.25, { pasta, teto: 10, avisar: () => {} });
    assert.deepEqual(r, { maxWorkers: 3, minWorkers: 1 });
    assert.deepEqual(readdirSync(pasta).filter((n) => Number(n) <= 7).sort(), ["5", "6", "7"]);
  });

  it("o valor de KIT_TESTE_WORKERS inválido continua recusado alto", () => {
    assert.throws(() => tetoDeWorkers({ KIT_TESTE_WORKERS: "0" }, 15, 0.25, { pasta, teto: 2 }), /KIT_TESTE_WORKERS/);
    assert.deepEqual(readdirSync(pasta), []);
  });

  it("prova de que a medida enxerga ficha: a pasta de verdade não é criada por quem não toma", () => {
    const outra = join(dir, "nao-criar");
    tetoDeWorkers({ CI: "1" }, 15, 0.25, { pasta: outra, teto: 2 });
    assert.equal(existsSync(outra), false);
  });
});
