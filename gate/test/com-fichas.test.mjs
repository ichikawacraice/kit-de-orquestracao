import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { availableParallelism, tmpdir } from "node:os";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * **O teste isolado pelo teto da máquina** (ADR 0005, operador, 26/10).
 *
 * A pasta das fichas é temporária (`KIT_NUCLEOS_DIR`) e `HOME` também: nada aqui toca `~/.claude` real.
 */
const AQUI = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(AQUI, "..", "com-fichas.mjs");

let dir;
let pasta;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "kit-comfichas-"));
  pasta = join(dir, "nucleos");
  mkdirSync(pasta);
  assert.deepEqual(readdirSync(pasta), []); // todo caso parte sem ficha
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** O env do filho: sem o que muda o teto ou o caminho (`KIT_FICHAS_TOMADAS`, `KIT_NUCLEOS_DE_TESTE`, `IZANAGI_NUCLEOS_DE_TESTE`, `CI`). */
const envDe = (extra = {}) => ({ PATH: process.env.PATH, HOME: dir, KIT_NUCLEOS_DIR: pasta, ...extra });

const rodar = (args, extra = {}) =>
  spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf-8", timeout: 20_000, killSignal: "SIGKILL", env: envDe(extra) });

const NUMEROS = `require('fs').readdirSync(process.env.KIT_NUCLEOS_DIR).filter((n) => /^[0-9]+$/.test(n)).length`;

describe("com-fichas", () => {
  it("toma 2 fichas, repassa KIT_FICHAS_TOMADAS e KIT_TESTE_WORKERS, sai 0 e solta tudo", () => {
    const r = rodar(["--quero", "2", "--", process.execPath, "-e", `console.log(process.env.KIT_FICHAS_TOMADAS, process.env.KIT_TESTE_WORKERS, ${NUMEROS})`], { KIT_NUCLEOS_DE_TESTE: "7" });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout.trim(), "2 2 2");
    assert.deepEqual(readdirSync(pasta), []);
  });

  it("`{fichas}` em qualquer argumento vira o número levado", () => {
    const r = rodar(["--quero", "2", "--", process.execPath, "-e", "console.log('{fichas}')"], { KIT_NUCLEOS_DE_TESTE: "7" });
    assert.equal(r.stdout.trim(), "2");
    const so = rodar(["--quero", "3", "--", process.execPath, "-e", "console.log('a{fichas}b')"], { KIT_NUCLEOS_DE_TESTE: "2" });
    assert.equal(so.stdout.trim(), "a2b", "leva o que houver: teto 2, pediu 3");
  });

  it("o código de saída é o do comando, e as fichas são soltas mesmo assim", () => {
    const r = rodar(["--quero", "1", "--", process.execPath, "-e", "process.exitCode = 3"], { KIT_NUCLEOS_DE_TESTE: "7" });
    assert.equal(r.status, 3);
    assert.deepEqual(readdirSync(pasta), []);
  });

  it("com KIT_FICHAS_TOMADAS no env, não toma ficha e repassa o número", () => {
    const r = rodar(["--quero", "2", "--", process.execPath, "-e", `console.log(process.env.KIT_FICHAS_TOMADAS, process.env.KIT_TESTE_WORKERS, ${NUMEROS}, '{fichas}')`], {
      KIT_FICHAS_TOMADAS: "4",
      KIT_NUCLEOS_DE_TESTE: "7",
    });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout.trim(), "4 4 0 4");
  });

  it("sem `--quero` pede 2; sem `--` ou sem comando sai 2 com o uso", () => {
    const r = rodar(["--", process.execPath, "-e", "console.log('{fichas}')"], { KIT_NUCLEOS_DE_TESTE: "7" });
    assert.equal(r.stdout.trim(), "2");
    for (const args of [[], ["--quero", "2"], ["--quero", "2", "--"], ["--quero", "0", "--", "true"], ["--quero", "x", "--", "true"]]) {
      const s = rodar(args, { KIT_NUCLEOS_DE_TESTE: "7" });
      assert.equal(s.status, 2, `args ${JSON.stringify(args)}`);
      assert.match(s.stderr, /uso: com-fichas/);
    }
  });

  it("no CI roda sem tomar ficha e troca `{fichas}` pelos núcleos da máquina", () => {
    const r = rodar(["--quero", "2", "--", process.execPath, "-e", `console.log('{fichas}', ${NUMEROS})`], { CI: "1" });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout.trim(), `${availableParallelism()} 0`);
  });

  it("comando que não existe sai com código ≠ 0 e solta as fichas", () => {
    const r = rodar(["--quero", "1", "--", "isto-nao-existe-kit-xyz"], { KIT_NUCLEOS_DE_TESTE: "7" });
    assert.notEqual(r.status, 0);
    assert.deepEqual(readdirSync(pasta), []);
  });

  it("CONCORRÊNCIA: teto 3, três com-fichas pedindo 2 juntos — nunca passa de 3 fichas e os três terminam 0", async () => {
    const medida = join(dir, "medida.txt");
    // Cada comando conta as fichas da pasta a cada 50 ms por 1,5 s e grava o maior número visto.
    const contador = `const fs=require('fs');const p=process.env.KIT_NUCLEOS_DIR;let max=0;const t=setInterval(()=>{const n=fs.readdirSync(p).filter((x)=>/^[0-9]+$/.test(x)).length;if(n>max)max=n;},50);setTimeout(()=>{clearInterval(t);fs.appendFileSync(${JSON.stringify(medida)},max+'\\n');},1500);`;
    const codigos = await Promise.all(
      [1, 2, 3].map(
        () =>
          new Promise((resolve) => {
            // `spawn` com prazo próprio (o único caso assíncrono, como pede o plano): o `setTimeout` mata o filho se pendurar.
            const f = spawn(process.execPath, [SCRIPT, "--quero", "2", "--", process.execPath, "-e", contador], {
              env: envDe({ KIT_NUCLEOS_DE_TESTE: "3" }),
              stdio: "ignore",
            });
            const prazo = setTimeout(() => f.kill("SIGKILL"), 30_000);
            f.on("close", (c) => {
              clearTimeout(prazo);
              resolve(c);
            });
          }),
      ),
    );
    assert.deepEqual(codigos, [0, 0, 0]);
    assert.ok(existsSync(medida), "ninguém mediu");
    const maximos = readFileSync(medida, "utf-8").trim().split("\n").map(Number);
    assert.equal(maximos.length, 3);
    assert.ok(Math.max(...maximos) >= 1, `prova de que a medida enxerga ficha: ${maximos}`);
    assert.ok(Math.max(...maximos) <= 3, `passou do teto: ${maximos}`);
    assert.deepEqual(readdirSync(pasta), []);
  });

  it("CONCORRÊNCIA com um gate rodando (ADR 0008): teto 10, cinco com-fichas pedindo 3 — nenhum toca 1..7 enquanto a vez do gate existe, e o máximo somado é ≤ 10", async () => {
    // O "gate" do teste é este processo: toma a vez e as fichas 1..7 (a faixa do gate com teto 10) e as segura até o fim.
    const { quemSouEuNasFichas, tentarAVezDoGate, tentarTomarFichas } = await import("../o-teto-da-maquina.mjs");
    const gate = { ...quemSouEuNasFichas(), token: "gate-de-teste" };
    assert.equal(tentarAVezDoGate(pasta, gate).tomou, true);
    assert.deepEqual(tentarTomarFichas(pasta, 10, 7, gate).levou, [1, 2, 3, 4, 5, 6, 7]);
    const medida = join(dir, "medida.jsonl");
    // Cada comando amostra a pasta a cada 50 ms por 0,5 s: quantas fichas há, e quantas de 1..7 deixaram de ser as do gate.
    const amostra = `const fs=require('fs');const p=process.env.KIT_NUCLEOS_DIR;let max=0,violacoes=0;const t=setInterval(()=>{const ks=fs.readdirSync(p).filter((x)=>/^[0-9]+$/.test(x));if(ks.length>max)max=ks.length;for(let k=1;k<=7;k++){try{if(JSON.parse(fs.readFileSync(p+'/'+k,'utf8')).token!=='gate-de-teste')violacoes++;}catch{violacoes++;}}},50);setTimeout(()=>{clearInterval(t);fs.appendFileSync(${JSON.stringify(medida)},JSON.stringify({max,violacoes,fichas:process.env.KIT_FICHAS_TOMADAS})+'\\n');},500);`;
    const codigos = await Promise.all(
      [1, 2, 3, 4, 5].map(
        () =>
          new Promise((resolve) => {
            // `spawn` com prazo próprio (o único caso assíncrono): o `setTimeout` mata o filho se pendurar.
            const f = spawn(process.execPath, [SCRIPT, "--quero", "3", "--", process.execPath, "-e", amostra], {
              env: envDe({ KIT_NUCLEOS_DE_TESTE: "10" }),
              stdio: "ignore",
            });
            const prazo = setTimeout(() => f.kill("SIGKILL"), 60_000);
            f.on("close", (c) => {
              clearTimeout(prazo);
              resolve(c);
            });
          }),
      ),
    );
    assert.deepEqual(codigos, [0, 0, 0, 0, 0]);
    assert.ok(existsSync(medida), "ninguém mediu");
    const vistos = readFileSync(medida, "utf-8").trim().split("\n").map((l) => JSON.parse(l));
    assert.equal(vistos.length, 5);
    assert.ok(Math.max(...vistos.map((v) => v.max)) >= 8, `prova de que a medida enxerga ficha: o gate tem 7 e algum normal tem ≥ 1 — ${JSON.stringify(vistos)}`);
    assert.ok(Math.max(...vistos.map((v) => v.max)) <= 10, `passou do teto: ${JSON.stringify(vistos)}`);
    assert.deepEqual(vistos.map((v) => v.violacoes), [0, 0, 0, 0, 0], "ninguém tocou 1..7");
    // leva o que houver livre: com a faixa normal (3) dividida entre os cinco, cada um leva de 1 a 3 — nunca da faixa do gate
    assert.ok(vistos.every((v) => Number(v.fichas) >= 1 && Number(v.fichas) <= 3), `cada um leva de 1 a 3 fichas: ${JSON.stringify(vistos)}`);
    assert.deepEqual(readdirSync(pasta).sort((a, b) => a.localeCompare(b)), ["1", "2", "3", "4", "5", "6", "7", "gate"]);
  });
});
