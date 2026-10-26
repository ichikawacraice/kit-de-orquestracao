import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { pastaDoTeto, tetoDaMaquina } from "../o-teto-da-maquina.mjs";

/**
 * **As duas leituras do teto concordam** (ADR 0005, operador, 26/10): o gate (`gate/o-teto-da-maquina.mjs`) e o plugin
 * (`pool-comum.mjs`, que não importa `gate/`) leem a mesma pasta, o mesmo valor e a mesma ordem. Quando um muda sem o outro,
 * o gate toma fichas num teto e a orquestradora segura a V noutro.
 */
const base = mkdtempSync(join(tmpdir(), "kit-teto-concorda-"));
process.env.HOOKS_CREWAI_BASE = join(base, "orq"); // o pool-comum nunca escreve na BASE de verdade
const { maquinaCheia, pastaDoTeto: pastaDoPlugin } = await import(pathToFileURL(join(import.meta.dirname, "..", "..", "plugins", "orquestracao", "hooks", "pool-comum.mjs")).href);

const NUCLEOS = 15;
const lido = (env, pasta) => ({ gate: tetoDaMaquina(env, NUCLEOS, pasta), plugin: maquinaCheia({ env, nucleos: NUCLEOS, carga: 0 }).teto });

describe("o teto do gate e o do plugin", () => {
  it("quatro combinações: env KIT, env IZANAGI, arquivo, nada — o mesmo número e a mesma pasta", () => {
    const pasta = join(base, "nucleos");
    mkdirSync(pasta);
    const combinacoes = [
      ["env KIT", { KIT_NUCLEOS_DIR: pasta, KIT_NUCLEOS_DE_TESTE: "5" }, 5, null],
      ["env IZANAGI", { KIT_NUCLEOS_DIR: pasta, IZANAGI_NUCLEOS_DE_TESTE: "4" }, 4, null],
      ["arquivo", { KIT_NUCLEOS_DIR: pasta }, 3, { nucleos: 3 }],
      ["nada", { KIT_NUCLEOS_DIR: pasta }, 7, null],
    ];
    for (const [nome, env, esperado, arquivo] of combinacoes) {
      if (arquivo) writeFileSync(join(pasta, "teto.json"), JSON.stringify(arquivo));
      else rmSync(join(pasta, "teto.json"), { force: true });
      const { gate, plugin } = lido(env, pasta);
      assert.equal(gate, esperado, `${nome}: o gate`);
      assert.equal(plugin, esperado, `${nome}: o plugin`);
      assert.equal(pastaDoTeto(env), pastaDoPlugin(env), `${nome}: a pasta`);
      assert.equal(maquinaCheia({ env, nucleos: NUCLEOS, carga: 0 }).pasta, pasta, `${nome}: a pasta que o plugin lê`);
    }
  });

  it("a pasta padrão é a mesma (HOME real, só comparada; nada é lido ou escrito nela)", () => {
    const padrao = join(homedir(), ".claude", "orquestracao", "nucleos-de-teste");
    assert.ok(padrao.length > 0);
    assert.equal(pastaDoTeto({}), padrao);
    assert.equal(pastaDoPlugin({}), padrao);
  });

  it("prova de que a comparação enxerga diferença: um teto de arquivo que só um lado lesse daria números distintos", () => {
    const pasta = join(base, "outra");
    mkdirSync(pasta);
    writeFileSync(join(pasta, "teto.json"), JSON.stringify({ nucleos: 2 }));
    assert.notEqual(tetoDaMaquina({}, NUCLEOS, join(base, "nucleos-vazia")), 2);
    assert.equal(lido({ KIT_NUCLEOS_DIR: pasta }, pasta).plugin, 2);
  });
});

process.on("exit", () => rmSync(base, { recursive: true, force: true }));
