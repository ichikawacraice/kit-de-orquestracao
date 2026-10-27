import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { faixas, pastaDoTeto, tetoDaMaquina } from "../o-teto-da-maquina.mjs";

/**
 * **As duas leituras do teto concordam** (ADR 0005, operador, 26/10): o gate (`gate/o-teto-da-maquina.mjs`) e o plugin
 * (`pool-comum.mjs`, que não importa `gate/`) leem a mesma pasta, o mesmo valor e a mesma ordem. Quando um muda sem o outro,
 * o gate toma fichas num teto e a orquestradora segura a V noutro.
 */
const base = mkdtempSync(join(tmpdir(), "kit-teto-concorda-"));
process.env.HOOKS_CREWAI_BASE = join(base, "orq"); // o pool-comum nunca escreve na BASE de verdade
process.env.HOME = join(base, "home"); // nem o HOME real entra: a pasta padrão e o teto.json nunca são os da máquina
mkdirSync(process.env.HOME, { recursive: true });
const { maquinaCheia, pastaDoTeto: pastaDoPlugin } = await import(pathToFileURL(join(import.meta.dirname, "..", "..", "plugins", "orquestracao", "hooks", "pool-comum.mjs")).href);

const NUCLEOS = 15;
const lido = (env, pasta) => ({ gate: tetoDaMaquina(env, NUCLEOS, pasta), plugin: maquinaCheia({ env, nucleos: NUCLEOS, carga: 0 }).teto });

describe("o teto do gate e o do plugin", () => {
  it("as combinações: env KIT, arquivo, nada, e as frações (env e arquivo) — o mesmo número e a mesma pasta", () => {
    const pasta = join(base, "nucleos");
    mkdirSync(pasta);
    const combinacoes = [
      ["env KIT", { KIT_NUCLEOS_DIR: pasta, KIT_NUCLEOS_DE_TESTE: "5" }, 5, null],
      ["arquivo", { KIT_NUCLEOS_DIR: pasta }, 3, { nucleos: 3 }],
      ["nada", { KIT_NUCLEOS_DIR: pasta }, 10, null],
      ["env fração", { KIT_NUCLEOS_DIR: pasta, KIT_FRACAO_DE_TESTE: "0.5" }, 7, null],
      ["arquivo fração", { KIT_NUCLEOS_DIR: pasta }, 6, { fracao: 0.4 }],
      ["env fração × arquivo fração", { KIT_NUCLEOS_DIR: pasta, KIT_FRACAO_DE_TESTE: "0.5" }, 7, { fracao: 0.4 }],
      ["arquivo nucleos × fracao", { KIT_NUCLEOS_DIR: pasta }, 4, { nucleos: 4, fracao: 0.4 }],
      ["env absoluto × env fração", { KIT_NUCLEOS_DIR: pasta, KIT_NUCLEOS_DE_TESTE: "3", KIT_FRACAO_DE_TESTE: "0.5" }, 3, null],
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

  it("as faixas do gate e do plugin concordam: padrão, fração do gate por env, e os tetos 1 a 15", () => {
    const pasta = join(base, "faixas");
    mkdirSync(pasta);
    for (const extra of [{}, { KIT_FRACAO_DO_GATE: "0.5" }, { KIT_FRACAO_DO_GATE: "0.9" }]) {
      for (let teto = 1; teto <= 15; teto++) {
        const env = { KIT_NUCLEOS_DIR: pasta, KIT_NUCLEOS_DE_TESTE: String(teto), ...extra };
        const doGate = faixas(teto, env);
        const doPlugin = maquinaCheia({ env, nucleos: NUCLEOS, carga: 0 }).faixas;
        assert.equal(doPlugin.gate, doGate.gate, `teto ${teto} ${JSON.stringify(extra)}: faixa do gate`);
        assert.equal(doPlugin.normal, doGate.normal, `teto ${teto} ${JSON.stringify(extra)}: faixa normal`);
        assert.equal(doPlugin.compartilhada, doGate.compartilhada, `teto ${teto}: compartilhada`);
      }
    }
    assert.equal(faixas(10, {}).gate, 7, "prova: o padrão dá 7 de 10 (a comparação não é vazia)");
    assert.equal(faixas(10, { KIT_FRACAO_DO_GATE: "0.5" }).gate, 5, "prova: a fração do gate muda o número");
  });

  it("a ordem: o env vence o teto.json, e KIT vence ALFA — nos dois lados", () => {
    const pasta = join(base, "ordem");
    mkdirSync(pasta);
    writeFileSync(join(pasta, "teto.json"), JSON.stringify({ nucleos: 3 }));
    const env = (extra) => ({ KIT_NUCLEOS_DIR: pasta, ...extra });
    const casos = [
      ["env × teto.json", env({ KIT_NUCLEOS_DE_TESTE: "6" }), 6],
    ];
    for (const [nome, e, esperado] of casos) {
      const { gate, plugin } = lido(e, pasta);
      assert.equal(gate, esperado, `${nome}: o gate`);
      assert.equal(plugin, esperado, `${nome}: o plugin`);
    }
    assert.equal(lido(env({}), pasta).gate, 3, "prova: sem env o teto.json vale, então o env acima mudou o número");
  });

  it("a pasta padrão é a mesma (HOME temporário, só comparada; nada é lido ou escrito nela)", () => {
    const padrao = join(process.env.HOME, ".claude", "orquestracao", "nucleos-de-teste");
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
