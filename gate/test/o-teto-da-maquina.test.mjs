import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { processoVivo as processoVivoDoGate } from "../a-vez-do-gate.mjs";
import {
  estadoDoTeto,
  pastaDoTeto,
  processoVivo,
  soltarFichas,
  tentarTomarFichas,
  tetoDaMaquina,
  tomarFichas,
  tomarFichasSync,
} from "../o-teto-da-maquina.mjs";

/**
 * **O teto de núcleos da máquina** (ADR 0005, operador, 26/10).
 *
 * As fichas moram numa pasta temporária (`mkdtempSync`): **a pasta de verdade,
 * `~/.claude/orquestracao/nucleos-de-teste`, nunca é tocada aqui** — um teste
 * que tomasse as fichas dela faria o teste de outra sessão esperar.
 */
const AQUI = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(AQUI, "..", "o-teto-da-maquina.mjs");

let dir;
let pasta;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "kit-teto-"));
  pasta = join(dir, "nucleos");
  mkdirSync(pasta);
  // Teste que mede uma AUSÊNCIA declara essa ausência: todo caso parte sem ficha.
  assert.deepEqual(readdirSync(pasta), []);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** Um PID que acabou de morrer: um filho que nasce e sai, com prazo. */
function pidMorto() {
  const r = spawnSync(process.execPath, ["-e", ""], { timeout: 10_000, killSignal: "SIGKILL" });
  assert.ok(r.pid > 0, "o filho de prova nem nasceu");
  assert.equal(processoVivo(r.pid), false, `o PID ${r.pid} ainda está vivo — a prova de PID morto não vale`);
  return r.pid;
}

const EU = { pid: process.pid, token: "eu", worktree: "/wt/eu", projeto: "kit", desde: "2026-10-26T10:00:00.000Z" };
const OUTRO = { pid: process.pid, token: "outro", worktree: "/wt/outro", projeto: "izanagi", desde: "2026-10-26T10:00:00.000Z" };

const fichas = () => readdirSync(pasta).sort();
const ficha = (k, conteudo) => writeFileSync(join(pasta, String(k)), typeof conteudo === "string" ? conteudo : JSON.stringify(conteudo));

describe("onde moram as fichas", () => {
  it("`KIT_NUCLEOS_DIR` manda; sem ela, a pasta da máquina em ~/.claude", () => {
    assert.equal(pastaDoTeto({ KIT_NUCLEOS_DIR: dir }), dir);
    const padrao = join(homedir(), ".claude", "orquestracao", "nucleos-de-teste");
    assert.ok(padrao.length > 0);
    assert.equal(pastaDoTeto({}), padrao);
  });

  it("o `processoVivo` do gate é o mesmo deste módulo (reexportado)", () => {
    assert.equal(processoVivoDoGate, processoVivo);
  });
});

describe("o valor do teto", () => {
  it("`KIT_NUCLEOS_DE_TESTE` vence; depois o legado do Izanagi; depois o teto.json; depois metade dos núcleos", () => {
    assert.equal(tetoDaMaquina({ KIT_NUCLEOS_DE_TESTE: "5" }, 15, pasta), 5);
    assert.equal(tetoDaMaquina({ IZANAGI_NUCLEOS_DE_TESTE: "4" }, 15, pasta), 4);
    assert.equal(tetoDaMaquina({ KIT_NUCLEOS_DE_TESTE: "5", IZANAGI_NUCLEOS_DE_TESTE: "4" }, 15, pasta), 5);
    writeFileSync(join(pasta, "teto.json"), JSON.stringify({ nucleos: 3 }));
    assert.equal(tetoDaMaquina({}, 15, pasta), 3);
    assert.equal(tetoDaMaquina({ KIT_NUCLEOS_DE_TESTE: "6" }, 15, pasta), 6, "a env vence o arquivo");
    rmSync(join(pasta, "teto.json"));
    assert.equal(tetoDaMaquina({}, 15, pasta), 7);
    assert.equal(tetoDaMaquina({}, 1, pasta), 1);
  });

  it("valor inválido é recusado alto, citando a variável ou o arquivo", () => {
    assert.throws(() => tetoDaMaquina({ KIT_NUCLEOS_DE_TESTE: "0" }, 15, pasta), /KIT_NUCLEOS_DE_TESTE/);
    assert.throws(() => tetoDaMaquina({ KIT_NUCLEOS_DE_TESTE: "abc" }, 15, pasta), /KIT_NUCLEOS_DE_TESTE/);
    writeFileSync(join(pasta, "teto.json"), JSON.stringify({ nucleos: "x" }));
    assert.throws(() => tetoDaMaquina({}, 15, pasta), /teto\.json/);
    writeFileSync(join(pasta, "teto.json"), "{ não é json");
    assert.throws(() => tetoDaMaquina({}, 15, pasta), /teto\.json/);
  });

  it("no CI não há teto", () => {
    assert.equal(tetoDaMaquina({ CI: "1" }, 15, pasta), null);
  });
});

describe("tomar e soltar fichas", () => {
  it("leva o que houver livre e escreve quem é o dono; a terceira chamada, com tudo tomado, leva nada e devolve os donos", () => {
    const a = tentarTomarFichas(pasta, 3, 2, EU);
    assert.deepEqual(a.levou, [1, 2]);
    assert.deepEqual(fichas(), ["1", "2"]);
    const lida = JSON.parse(readFileSync(join(pasta, "1"), "utf-8"));
    assert.deepEqual(Object.keys(lida).sort(), ["desde", "pid", "projeto", "token", "worktree"]);
    assert.equal(lida.pid, EU.pid);
    assert.equal(lida.token, EU.token);

    const b = tentarTomarFichas(pasta, 3, 2, OUTRO);
    assert.deepEqual(b.levou, [3], "leva o que houver");

    const c = tentarTomarFichas(pasta, 3, 2, OUTRO);
    assert.deepEqual(c.levou, []);
    assert.equal(c.donos.length, 3);
    assert.deepEqual(
      c.donos.map((d) => d.token).sort(),
      ["eu", "eu", "outro"],
    );
  });

  it("ficha de PID morto é retomada; ilegível velha (31 s) também; ilegível recente, não", () => {
    ficha(1, { ...OUTRO, pid: pidMorto() });
    const morta = tentarTomarFichas(pasta, 1, 1, EU, { avisar: () => {} });
    assert.deepEqual(morta.levou, [1], "PID morto volta ao teto");
    soltarFichas(pasta, [1], EU);

    ficha(1, "{ metade");
    const agora = Date.now();
    const recente = tentarTomarFichas(pasta, 1, 1, EU, { agora, avisar: () => {} });
    assert.deepEqual(recente.levou, [], "ilegível recente é alguém no meio da escrita");
    utimesSync(join(pasta, "1"), new Date(agora - 31_000), new Date(agora - 31_000));
    const velha = tentarTomarFichas(pasta, 1, 1, EU, { agora, avisar: () => {} });
    assert.deepEqual(velha.levou, [1]);
  });

  it("ficha no formato do Izanagi (sem token) com PID vivo é respeitada; a mesma com PID morto é retomada", () => {
    const formatos = [
      { pid: process.pid, worktree: "/wt/izanagi", projeto: "izanagi", desde: "2026-10-26T10:00:00.000Z" },
      { pid: process.pid, cwd: "/wt/izanagi", desde: "2026-10-26T10:00:00.000Z" },
    ];
    for (const f of formatos) {
      const morto = { ...f, pid: pidMorto() };
      ficha(1, morto);
      assert.deepEqual(tentarTomarFichas(pasta, 1, 1, EU, { avisar: () => {} }).levou, [1], "prova: com PID morto a ficha é retomada");
      soltarFichas(pasta, [1], EU);
      assert.deepEqual(fichas(), []);

      ficha(1, f);
      const r = tentarTomarFichas(pasta, 1, 1, EU, { avisar: () => {} });
      assert.deepEqual(r.levou, [], "com PID vivo é respeitada");
      assert.equal(r.donos.length, 1);
      rmSync(join(pasta, "1"));
    }
  });

  it("soltar apaga só as fichas cujo pid e token são os de quem pede", () => {
    tentarTomarFichas(pasta, 3, 2, EU);
    tentarTomarFichas(pasta, 3, 1, OUTRO);
    assert.deepEqual(fichas(), ["1", "2", "3"]);
    soltarFichas(pasta, [1, 2, 3], EU);
    assert.deepEqual(fichas(), ["3"], "a ficha do outro dono fica");
    soltarFichas(pasta, [3], EU);
    assert.deepEqual(fichas(), ["3"]);
    soltarFichas(pasta, [3], OUTRO);
    assert.deepEqual(fichas(), []);
  });

  it("o estado conta só ficha viva", () => {
    tentarTomarFichas(pasta, 4, 2, EU);
    ficha(3, { ...OUTRO, pid: pidMorto() });
    const e = estadoDoTeto(pasta, 4);
    assert.equal(e.teto, 4);
    assert.deepEqual(e.tomadas.map((t) => t.k), [1, 2]);
    assert.equal(e.tomadas[0].dono.token, "eu");
    assert.equal(e.livres, 2);
  });
});

describe("esperar as fichas", () => {
  it("com o teto cheio espera, avisa por quem, e leva quando uma é solta", async () => {
    tentarTomarFichas(pasta, 2, 2, OUTRO);
    const avisos = [];
    let t = 0;
    let giros = 0;
    const dormir = async (ms) => {
      t += ms;
      giros += 1;
      if (giros === 3) soltarFichas(pasta, [1], OUTRO);
    };
    const levou = await tomarFichas({ quero: 2, pasta, teto: 2, eu: EU, dormir, agora: () => t, avisar: (m) => avisos.push(m), intervaloMs: 30_000 });
    assert.deepEqual(levou, [1], "leva o que houver");
    assert.ok(avisos.length >= 2, `esperava o aviso do começo e o de 1 min; veio ${JSON.stringify(avisos)}`);
    assert.match(avisos[0], /\/wt\/outro/);
    assert.match(avisos[0], new RegExp(`PID ${process.pid}`));
  });

  it("a versão síncrona tem o mesmo contrato, dormindo com Atomics.wait", () => {
    tentarTomarFichas(pasta, 2, 2, OUTRO);
    const avisos = [];
    let giros = 0;
    const dormir = () => {
      giros += 1;
      if (giros === 2) soltarFichas(pasta, [2], OUTRO);
    };
    const levou = tomarFichasSync({ quero: 2, pasta, teto: 2, eu: EU, dormir, avisar: (m) => avisos.push(m) });
    assert.deepEqual(levou, [2]);
    assert.ok(avisos.length >= 1);
  });

  it("o `dormir` padrão da versão síncrona de fato espera (sem ocupar a CPU)", () => {
    tentarTomarFichas(pasta, 1, 1, OUTRO);
    const filho = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `import { tomarFichasSync } from ${JSON.stringify(new URL("../o-teto-da-maquina.mjs", import.meta.url).href)};
         const t0 = Date.now();
         const levou = tomarFichasSync({ quero: 1, pasta: ${JSON.stringify(pasta)}, teto: 1, eu: { pid: process.pid, token: "f", worktree: "w", projeto: "p", desde: "d" }, intervaloMs: 100, avisar: () => {}, limiteMs: 350 });
         console.log(JSON.stringify({ levou, ms: Date.now() - t0 }));`,
      ],
      { encoding: "utf-8", timeout: 10_000, killSignal: "SIGKILL" },
    );
    // O teto está cheio de propósito: o limite do teste (350 ms) faz a espera acabar sem ficha.
    assert.equal(filho.status, 0, filho.stderr);
    const r = JSON.parse(filho.stdout);
    assert.deepEqual(r.levou, []);
    assert.ok(r.ms >= 300, `esperava ≥ 300 ms de espera, veio ${r.ms}`);
  });
});

describe("a ponta de linha de comando", () => {
  const rodar = (args, extra = {}) =>
    spawnSync(process.execPath, [SCRIPT, ...args], {
      encoding: "utf-8",
      timeout: 15_000,
      killSignal: "SIGKILL",
      env: { PATH: process.env.PATH, HOME: dir, KIT_NUCLEOS_DIR: pasta, ...extra },
    });

  it("sem argumento imprime o estado e uma linha por ficha", () => {
    tentarTomarFichas(pasta, 3, 2, EU);
    const r = rodar([], { KIT_NUCLEOS_DE_TESTE: "3" });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /teto 3 · tomadas 2 · livres 1/);
    assert.match(r.stdout, /\/wt\/eu/);
    assert.match(r.stdout, /kit/);
    assert.equal(r.stdout.trim().split("\n").length, 3);
  });

  it("`--teto N` grava o teto.json; `--teto padrao` apaga", () => {
    const arquivo = join(pasta, "teto.json");
    assert.equal(existsSync(arquivo), false);
    assert.equal(rodar(["--teto", "5"]).status, 0);
    assert.deepEqual(JSON.parse(readFileSync(arquivo, "utf-8")), { nucleos: 5 });
    assert.match(rodar([]).stdout, /teto 5 /);
    assert.equal(rodar(["--teto", "padrao"]).status, 0);
    assert.equal(existsSync(arquivo), false);
  });

  it("`--teto` inválido sai 2 com o motivo", () => {
    const r = rodar(["--teto", "zero"]);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /inteiro/);
  });

  it("a pasta ainda não existe: `--teto N` a cria", () => {
    const outra = join(dir, "ainda-nao-existe");
    assert.equal(existsSync(outra), false);
    const r = spawnSync(process.execPath, [SCRIPT, "--teto", "2"], {
      encoding: "utf-8",
      timeout: 15_000,
      killSignal: "SIGKILL",
      env: { PATH: process.env.PATH, HOME: dir, KIT_NUCLEOS_DIR: outra },
    });
    assert.equal(r.status, 0, r.stderr);
    assert.ok(existsSync(join(outra, "teto.json")));
  });
});
