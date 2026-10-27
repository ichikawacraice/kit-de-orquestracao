import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { processoVivo as processoVivoDoGate } from "../a-vez-do-gate.mjs";
import {
  donoDoGate,
  esperarAVezDoGate,
  estadoDoTeto,
  faixas,
  pastaDoTeto,
  processoVivo,
  soltarAVezDoGate,
  soltarFichas,
  tentarAVezDoGate,
  tentarTomarFichas,
  tentarTomarFichasNormais,
  tetoDaMaquina,
  tomarFichas,
  tomarFichasDoGate,
  tomarFichasNormais,
  tomarFichasNormaisSync,
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
const OUTRO = { pid: process.pid, token: "outro", worktree: "/wt/outro", projeto: "alfa", desde: "2026-10-26T10:00:00.000Z" };

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
  it("`KIT_NUCLEOS_DE_TESTE` vence; depois o teto.json; depois 2/3 dos núcleos", () => {
    assert.equal(tetoDaMaquina({ KIT_NUCLEOS_DE_TESTE: "5" }, 15, pasta), 5);
    writeFileSync(join(pasta, "teto.json"), JSON.stringify({ nucleos: 3 }));
    assert.equal(tetoDaMaquina({}, 15, pasta), 3);
    assert.equal(tetoDaMaquina({ KIT_NUCLEOS_DE_TESTE: "6" }, 15, pasta), 6, "a env vence o arquivo");
    rmSync(join(pasta, "teto.json"));
    assert.equal(tetoDaMaquina({}, 15, pasta), 10);
    assert.equal(tetoDaMaquina({}, 4, pasta), 2);
    assert.equal(tetoDaMaquina({}, 1, pasta), 1);
  });

  it("a fração (ADR 0008): `KIT_FRACAO_DE_TESTE` e `teto.json {fracao}`; o número absoluto vence a fração", () => {
    assert.equal(tetoDaMaquina({ KIT_FRACAO_DE_TESTE: "0.5" }, 15, pasta), 7);
    writeFileSync(join(pasta, "teto.json"), JSON.stringify({ fracao: 0.4 }));
    assert.equal(tetoDaMaquina({}, 15, pasta), 6);
    assert.equal(tetoDaMaquina({ KIT_FRACAO_DE_TESTE: "0.5" }, 15, pasta), 7, "a env vence o arquivo");
    assert.equal(tetoDaMaquina({ KIT_NUCLEOS_DE_TESTE: "3", KIT_FRACAO_DE_TESTE: "0.5" }, 15, pasta), 3, "o absoluto vence a fração");
    writeFileSync(join(pasta, "teto.json"), JSON.stringify({ nucleos: 4, fracao: 0.4 }));
    assert.equal(tetoDaMaquina({}, 15, pasta), 4, "no arquivo, `nucleos` vence `fracao`");
    writeFileSync(join(pasta, "teto.json"), JSON.stringify({ fracao: 1 }));
    assert.equal(tetoDaMaquina({}, 15, pasta), 15, "fração 1 vale");
  });

  it("fração fora de (0, 1] ou não numérica é recusada alto, citando a fonte", () => {
    for (const ruim of ["0", "1.5", "abc", "-1"]) {
      assert.throws(() => tetoDaMaquina({ KIT_FRACAO_DE_TESTE: ruim }, 15, pasta), /KIT_FRACAO_DE_TESTE/, ruim);
    }
    writeFileSync(join(pasta, "teto.json"), JSON.stringify({ fracao: 2 }));
    assert.throws(() => tetoDaMaquina({}, 15, pasta), /teto\.json.*fracao/);
    writeFileSync(join(pasta, "teto.json"), JSON.stringify({ fracao: "x" }));
    assert.throws(() => tetoDaMaquina({}, 15, pasta), /teto\.json.*fracao/);
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

  it("ficha no formato do Alfa (sem token) com PID vivo é respeitada; a mesma com PID morto é retomada", () => {
    const formatos = [
      { pid: process.pid, worktree: "/wt/alfa", projeto: "alfa", desde: "2026-10-26T10:00:00.000Z" },
      { pid: process.pid, cwd: "/wt/alfa", desde: "2026-10-26T10:00:00.000Z" },
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
    assert.equal(r.stdout.trim().split("\n").length, 5, "teto, faixas, vez do gate e uma linha por ficha");
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


describe("as faixas do teto (ADR 0008)", () => {
  it("o gate leva floor(T × 0,7) e o teste normal o resto, com ao menos 1 de cada", () => {
    const casos = [
      [10, 7, 3],
      [7, 4, 3],
      [3, 2, 1],
      [2, 1, 1],
    ];
    for (const [t, gate, normal] of casos) {
      const f = faixas(t, {});
      assert.equal(f.gate, gate, `teto ${t}: gate`);
      assert.equal(f.normal, normal, `teto ${t}: normal`);
      assert.equal(f.compartilhada, false, `teto ${t}`);
      assert.equal(f.gate + f.normal, t, `teto ${t}: as faixas somam o teto`);
    }
  });

  it("teto 1: as duas faixas são a mesma ficha, e diz isso", () => {
    assert.deepEqual(faixas(1, {}), { gate: 1, normal: 1, compartilhada: true });
  });

  it("`KIT_FRACAO_DO_GATE` muda a divisão; fora de (0, 1) é recusada alto", () => {
    assert.equal(faixas(10, { KIT_FRACAO_DO_GATE: "0.5" }).gate, 5);
    assert.equal(faixas(10, { KIT_FRACAO_DO_GATE: "0.99" }).normal, 1, "a faixa normal nunca some");
    assert.equal(faixas(10, { KIT_FRACAO_DO_GATE: "0.01" }).gate, 1, "a faixa do gate nunca some");
    for (const ruim of ["0", "1", "abc"]) assert.throws(() => faixas(10, { KIT_FRACAO_DO_GATE: ruim }), /KIT_FRACAO_DO_GATE/, ruim);
  });
});

describe("a ordem de tentativa das fichas", () => {
  it("com `ordem` [10, 9, 8] leva as fichas 10 e 9 (quero 2); sem `ordem`, de 1 para cima como antes", () => {
    const a = tentarTomarFichas(pasta, 10, 2, EU, { ordem: [10, 9, 8] });
    assert.deepEqual(a.levou, [10, 9]);
    assert.deepEqual(fichas(), ["10", "9"]);
    soltarFichas(pasta, [10, 9], EU);
    assert.deepEqual(tentarTomarFichas(pasta, 10, 2, EU).levou, [1, 2]);
  });

  it("`emprestadas` marca a ficha no JSON; as outras não levam a marca", () => {
    tentarTomarFichas(pasta, 10, 2, EU, { ordem: [10, 5], emprestadas: new Set([5]) });
    assert.equal(JSON.parse(readFileSync(join(pasta, "5"), "utf-8")).emprestada, true);
    assert.equal(JSON.parse(readFileSync(join(pasta, "10"), "utf-8")).emprestada, undefined);
  });
});

describe("a vez do gate da máquina", () => {
  it("o primeiro toma; o segundo não toma e recebe o dono; só o dono solta", () => {
    assert.equal(tentarAVezDoGate(pasta, EU).tomou, true);
    assert.deepEqual(fichas(), ["gate"]);
    const lida = JSON.parse(readFileSync(join(pasta, "gate"), "utf-8"));
    assert.equal(lida.token, "eu");
    const segundo = tentarAVezDoGate(pasta, OUTRO);
    assert.equal(segundo.tomou, false);
    assert.equal(segundo.dono.token, "eu");
    assert.equal(soltarAVezDoGate(pasta, OUTRO), false, "outro dono não apaga");
    assert.deepEqual(fichas(), ["gate"]);
    assert.equal(soltarAVezDoGate(pasta, EU), true);
    assert.deepEqual(fichas(), []);
  });

  it("a vez de PID morto é retomada (e a de PID vivo, prova, não)", () => {
    ficha("gate", { ...OUTRO });
    assert.equal(tentarAVezDoGate(pasta, EU, { avisar: () => {} }).tomou, false, "prova: com PID vivo a vez vale");
    rmSync(join(pasta, "gate"));
    ficha("gate", { ...OUTRO, pid: pidMorto() });
    assert.equal(tentarAVezDoGate(pasta, EU, { avisar: () => {} }).tomou, true);
    assert.equal(JSON.parse(readFileSync(join(pasta, "gate"), "utf-8")).token, "eu");
  });

  it("a pasta é a da máquina: `gate` não conta como ficha nem no estado", () => {
    tentarAVezDoGate(pasta, EU);
    tentarTomarFichas(pasta, 3, 1, EU);
    const e = estadoDoTeto(pasta, 3);
    assert.deepEqual(e.tomadas.map((t) => t.k), [1], "prova: a ficha 1 conta");
    assert.equal(e.livres, 2);
    assert.equal(e.gateRodando.token, "eu");
  });

  it("`donoDoGate` devolve o dono vivo, ou null sem a vez ou com PID morto", () => {
    assert.equal(donoDoGate(pasta), null);
    ficha("gate", { ...OUTRO, pid: pidMorto() });
    assert.equal(donoDoGate(pasta), null);
    rmSync(join(pasta, "gate"));
    tentarAVezDoGate(pasta, OUTRO);
    assert.equal(donoDoGate(pasta).token, "outro");
  });

  it("espera, diz por quem a cada minuto, e toma quando soltam", async () => {
    tentarAVezDoGate(pasta, OUTRO);
    const avisos = [];
    let t = 0;
    let giros = 0;
    const dormir = async (ms) => {
      t += ms;
      giros += 1;
      if (giros === 4) soltarAVezDoGate(pasta, OUTRO);
    };
    await esperarAVezDoGate({ pasta, eu: EU, dormir, agora: () => t, avisar: (m) => avisos.push(m), intervaloMs: 30_000 });
    assert.equal(donoDoGate(pasta).token, "eu");
    assert.ok(avisos.length >= 2, JSON.stringify(avisos));
    assert.match(avisos[0], /\/wt\/outro/);
    assert.match(avisos[0], /gate/);
  });
});

describe("o teste normal: faixa normal primeiro, empréstimo só sem gate", () => {
  const tomar = (quero, eu = EU, teto = 10, extra = {}) => tentarTomarFichasNormais(pasta, teto, quero, eu, { avisar: () => {}, ...extra });

  it("teto 10 (7/3), quero 3, sem gate → leva [10, 9, 8]; o segundo de 3 empresta da faixa do gate [7, 6, 5], marcada", () => {
    assert.deepEqual(tomar(3).levou, [10, 9, 8]);
    assert.deepEqual(tomar(3, OUTRO).levou, [7, 6, 5]);
    for (const k of [7, 6, 5]) assert.equal(JSON.parse(readFileSync(join(pasta, String(k)), "utf-8")).emprestada, true, `ficha ${k}`);
    assert.equal(JSON.parse(readFileSync(join(pasta, "10"), "utf-8")).emprestada, undefined);
  });

  it("o empréstimo nunca passa do pedido: quero 3 leva 3 mesmo com 7 livres emprestáveis", () => {
    tomar(3); // esgota a faixa normal
    const r = tomar(3, OUTRO);
    assert.equal(r.levou.length, 3);
  });

  it("com a vez do gate de um dono vivo, o normal leva só a faixa normal; com ela cheia, leva nada", () => {
    tentarAVezDoGate(pasta, { ...OUTRO, token: "gate" });
    assert.deepEqual(tomar(2).levou, [10, 9]);
    assert.deepEqual(tomar(2).levou, [8], "só o que sobrou da faixa normal");
    const cheio = tomar(2);
    assert.deepEqual(cheio.levou, [], "prova de que a faixa do gate está livre e mesmo assim não é emprestada");
    assert.ok(cheio.donos.length >= 1);
    assert.deepEqual(fichas().filter((n) => Number(n) <= 7), [], "nenhuma ficha de 1 a 7");
  });

  it("a ordem se recalcula a cada tentativa: o que esperava com o gate rodando empresta quando ele solta a vez", async () => {
    tentarAVezDoGate(pasta, { ...OUTRO, token: "gate" });
    tomar(3); // faixa normal cheia
    let giros = 0;
    const dormir = async () => {
      giros += 1;
      if (giros === 2) soltarAVezDoGate(pasta, { ...OUTRO, token: "gate" });
    };
    const levou = await tomarFichasNormais({ quero: 2, pasta, teto: 10, eu: EU, dormir, avisar: () => {} });
    assert.deepEqual(levou, [7, 6]);
    assert.ok(giros >= 2, "esperou antes de a vez ser solta");
  });

  it("teto 1: o normal e o gate disputam a mesma ficha", () => {
    assert.deepEqual(tomar(1, EU, 1).levou, [1]);
    assert.deepEqual(tomar(1, OUTRO, 1).levou, []);
  });

  it("a versão síncrona tem o mesmo contrato", () => {
    tentarAVezDoGate(pasta, { ...OUTRO, token: "gate" });
    const levou = tomarFichasNormaisSync({ quero: 2, pasta, teto: 10, eu: EU, avisar: () => {}, limiteMs: 0 });
    assert.deepEqual(levou, [10, 9]);
  });
});

describe("as fichas do gate: a faixa dele, a devolução e o prazo", () => {
  const GATE = { ...EU, token: "gate", worktree: "/wt/gate" };
  const base = { pasta: undefined, teto: 10, eu: GATE, quero: 6, intervaloMs: 1_000, avisoMs: 60_000, prazoMs: 5_000 };
  const tomarDoGate = (extra = {}, dormir = async () => {}) => {
    const t = { v: 0 };
    return tomarFichasDoGate({ ...base, pasta, agora: () => t.v, dormir: async (ms) => { t.v += ms; await dormir(ms, t); }, avisar: () => {}, ...extra });
  };

  it("leva de 1 para cima, só da faixa dele (1..7), e as 6 pedidas", async () => {
    const levou = await tomarDoGate();
    assert.deepEqual(levou, [1, 2, 3, 4, 5, 6]);
    assert.deepEqual(fichas(), ["1", "2", "3", "4", "5", "6"]);
  });

  it("ficha emprestada a um dono vivo: espera a devolução e começa com as 6 pedidas", async () => {
    tentarTomarFichas(pasta, 10, 2, OUTRO, { ordem: [2, 1], emprestadas: new Set([1, 2]) });
    let levou;
    const avisos = [];
    levou = await tomarDoGate({ avisar: (m) => avisos.push(m) }, async (ms, t) => {
      if (t.v === 2_000) soltarFichas(pasta, [1, 2], OUTRO);
    });
    assert.equal(levou.length, 6);
    assert.ok(avisos.some((m) => /\/wt\/outro/.test(m)), `esperava o aviso por quem; veio ${JSON.stringify(avisos)}`);
  });

  it("prazo vencido: começa com o que tem se for ≥ metade do pedido (5 de 6 e 3 de 6), e não começa com 2 de 6", async () => {
    // um dono vivo que nunca devolve segura `7 - n` fichas da faixa do gate (de cima para baixo); ficam `n` livres, de 1 para cima
    const segura = (n) => {
      rmSync(pasta, { recursive: true, force: true });
      mkdirSync(pasta);
      const seguradas = [7, 6, 5, 4, 3, 2, 1].slice(0, 7 - n);
      assert.equal(tentarTomarFichas(pasta, 10, seguradas.length, OUTRO, { ordem: seguradas }).levou.length, seguradas.length);
    };
    for (const [livres, esperado] of [[5, 5], [3, 3]]) {
      segura(livres);
      const levou = await tomarDoGate({ prazoMs: 1_000 });
      assert.equal(levou.length, esperado, `${livres} livres`);
      assert.ok(levou.length < 6, "prova: não levou as 6 pedidas, só começou com o que tinha");
      soltarFichas(pasta, levou, GATE);
    }
    segura(2);
    const avisos = [];
    let t = 0;
    const tentativa = tomarFichasDoGate({
      ...base, pasta, prazoMs: 1_000, agora: () => t, avisar: (m) => avisos.push(m),
      dormir: async (ms) => { t += ms; if (t > 600_000) throw new Error("PARADO: 2 de 6 não começa (esperou 10 min simulados)"); },
    });
    await assert.rejects(tentativa, /PARADO/);
    assert.ok(avisos.length >= 5, "avisa por quem a cada minuto");
  });
});

describe("o `--fracao` e o aviso do `--teto` na linha de comando", () => {
  const rodar = (args, extra = {}) =>
    spawnSync(process.execPath, [SCRIPT, ...args], {
      encoding: "utf-8",
      timeout: 15_000,
      killSignal: "SIGKILL",
      env: { PATH: process.env.PATH, HOME: dir, KIT_NUCLEOS_DIR: pasta, ...extra },
    });

  it("`--fracao f` grava {fracao}; fração inválida sai 2; o estado mostra as duas faixas e quem tem a vez do gate", () => {
    assert.equal(rodar(["--fracao", "0.5"]).status, 0);
    assert.deepEqual(JSON.parse(readFileSync(join(pasta, "teto.json"), "utf-8")), { fracao: 0.5 });
    const ruim = rodar(["--fracao", "2"]);
    assert.equal(ruim.status, 2);
    assert.match(ruim.stderr, /fra[cç][aã]o/i);
    tentarAVezDoGate(pasta, EU);
    const r = rodar([], { KIT_NUCLEOS_DE_TESTE: "10" });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /faixa do gate 7/);
    assert.match(r.stdout, /faixa normal 3/);
    assert.match(r.stdout, /vez do gate: .*\/wt\/eu/);
  });

  it("`--teto N` grava e avisa que número fixo não acompanha a máquina", () => {
    const r = rodar(["--teto", "5"]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout + r.stderr, /não acompanha a máquina/);
  });
});
