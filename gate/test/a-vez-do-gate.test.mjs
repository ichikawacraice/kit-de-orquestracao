import { afterEach, beforeEach, describe, it } from "node:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { availableParallelism, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { carregarConfig } from "../config.mjs";
import {
  ambienteDoFilho,
  argumentosDaSuite,
  caminhoDaTrava,
  caminhoDaVaga,
  comandoDaSuite,
  esperarAVez,
  fichasDaSuite,
  main,
  lerTrava,
  filaDoArgv,
  motivoParaRetomar,
  pacotesDoGate,
  PRAZO_DA_VEZ_MS,
  processoVivo,
  quemSouEu,
  soltar,
  tentarTomar,
  tentarTomarUmaVaga,
  tomarAsFichasDoGate,
  vagas,
} from "../a-vez-do-gate.mjs";
import { workersPorPacote } from "../o-teto-de-workers.mjs";
import { expect } from "./expect.mjs";

/**
 * **Um gate por vez na máquina.**
 *
 * Em 2026-10-11 a máquina do operador travou com várias sessões rodando o
 * gate juntas. `gate/a-vez-do-gate.mjs` põe uma trava em arquivo comum a
 * todos os worktrees: quem chega espera e diz por quem. Estes casos medem a
 * trava num arquivo de um diretório temporário próprio — **a trava de verdade,
 * a do diretório comum do git, nunca é tocada aqui**: um teste que a tomasse
 * faria o gate de outra sessão esperar por um caso de teste.
 */
const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "..", "..");

/** O perfil do Izanagi, com os quatro pacotes escritos — o que `gate.pacotes: "auto"` leria do workspace. */
const PNPM = carregarConfig(RAIZ, {
  gate: { perfil: "pnpm-workspace", pacotes: ["shared", "adapters", "runner", "web"], filtroDePacote: "@izanagi/{pacote}" },
});

let dir;
let trava;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "kit-vez-"));
  trava = join(dir, "gate.trava");
  // Teste que mede uma AUSÊNCIA declara essa ausência: todo caso parte sem trava.
  expect(existsSync(trava)).toBe(false);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** Um PID que acabou de morrer: um filho que nasce e sai, com prazo (ADR 0199). */
function pidMorto() {
  const r = spawnSync(process.execPath, ["-e", ""], { timeout: 10_000, killSignal: "SIGKILL" });
  expect(r.pid, "o filho de prova nem nasceu").toBeGreaterThan(0);
  expect(processoVivo(r.pid), `o PID ${r.pid} ainda está vivo — a prova de PID morto não vale`).toBe(false);
  return r.pid;
}

const outroDono = (sobre = {}) => ({
  ...quemSouEu(RAIZ),
  token: "outro-gate",
  worktree: "/x/worktrees/vizinho",
  branch: "claude/vizinho",
  sha: "abc1234",
  ...sobre,
});

describe("a trava do gate", () => {
  it("toma quando está livre, escreve quem é o dono, e solta", () => {
    const eu = quemSouEu(RAIZ);
    expect(tentarTomar(trava, eu)).toEqual({ tomou: true });
    const escrito = JSON.parse(readFileSync(trava, "utf-8"));
    expect(escrito).toMatchObject({ pid: process.pid, token: eu.token, worktree: RAIZ });
    expect(typeof escrito.sha).toBe("string");
    expect(escrito.sha.length).toBeGreaterThan(0);
    expect(Date.parse(escrito.venceEm) - Date.parse(escrito.desde)).toBe(PRAZO_DA_VEZ_MS);

    expect(soltar(trava, eu)).toBe(true);
    expect(existsSync(trava)).toBe(false);
  });

  it("com o dono VIVO e dentro do prazo, não toma — e devolve quem é o dono", () => {
    // O dono é este mesmo processo com outro token: vivo por construção.
    writeFileSync(trava, JSON.stringify(outroDono()));
    const r = tentarTomar(trava, quemSouEu(RAIZ));
    expect(r.tomou).toBe(false);
    expect(r.dono).toMatchObject({ token: "outro-gate", branch: "claude/vizinho", pid: process.pid });
  });

  it("retoma a trava de PID morto", () => {
    const morto = pidMorto();
    writeFileSync(trava, JSON.stringify(outroDono({ pid: morto })));
    const lida = { texto: readFileSync(trava, "utf-8"), dono: JSON.parse(readFileSync(trava, "utf-8")) };
    // O RAMO, não só o desfecho: o mesmo `tomou: true` sairia de uma trava vencida.
    expect(motivoParaRetomar(trava, lida)).toBe(`o PID ${morto} não está vivo`);

    const eu = quemSouEu(RAIZ);
    expect(tentarTomar(trava, eu)).toEqual({ tomou: true });
    expect(JSON.parse(readFileSync(trava, "utf-8")).token).toBe(eu.token);
  });

  it("retoma a trava VENCIDA mesmo com o dono vivo", () => {
    const agora = Date.now();
    writeFileSync(trava, JSON.stringify(outroDono({ venceEm: new Date(agora - 1_000).toISOString() })));
    const lida = { texto: readFileSync(trava, "utf-8"), dono: JSON.parse(readFileSync(trava, "utf-8")) };
    expect(processoVivo(lida.dono.pid)).toBe(true);
    expect(motivoParaRetomar(trava, lida, agora)).toMatch(/^venceu às /);
    expect(tentarTomar(trava, quemSouEu(RAIZ), agora)).toEqual({ tomou: true });
  });

  it("trava ilegível recente é de alguém no meio da escrita: espera; velha, retoma", () => {
    writeFileSync(trava, "{ meio escrito");
    expect(tentarTomar(trava, quemSouEu(RAIZ))).toEqual({ tomou: false, dono: null });

    const ha60s = (Date.now() - 60_000) / 1000;
    utimesSync(trava, ha60s, ha60s);
    expect(tentarTomar(trava, quemSouEu(RAIZ))).toEqual({ tomou: true });
  });

  it("o prazo da trava ilegível vem da configuração (`gate.prazos.ilegivelSeg`)", async () => {
    writeFileSync(trava, "{ meio escrito");
    const ha60s = (Date.now() - 60_000) / 1000;
    utimesSync(trava, ha60s, ha60s);
    // Precondição: com o prazo padrão (30 s) essa trava de 60 s seria retomada.
    expect(motivoParaRetomar(trava, lerTrava(trava), Date.now())).toMatch(/ilegível há mais de 30 s/);
    expect(tentarTomar(trava, quemSouEu(RAIZ), Date.now(), 120_000)).toEqual({ tomou: false, dono: null });
    const fila = `${trava}.fila`;
    writeFileSync(fila, "{ meio escrito");
    utimesSync(fila, ha60s, ha60s);
    expect(tentarTomarUmaVaga(fila, 1, quemSouEu(RAIZ), Date.now(), [], 120_000).tomou).toBe(false);

    // E o `esperarAVez` repassa o prazo: com 10 s a mesma trava é retomada.
    const vaga = await esperarAVez(trava, 1, quemSouEu(RAIZ), { ilegivelMs: 10_000, avisar: () => {}, dormir: async () => {} });
    expect(vaga).toBe(1);
  });

  it("soltar não apaga a trava de outro dono", () => {
    writeFileSync(trava, JSON.stringify(outroDono()));
    expect(soltar(trava, quemSouEu(RAIZ))).toBe(false);
    expect(existsSync(trava)).toBe(true);
  });

  it("quem espera diz POR QUEM espera, e toma quando o dono solta", async () => {
    writeFileSync(trava, JSON.stringify(outroDono()));
    const avisos = [];
    let sonos = 0;
    await esperarAVez(trava, 1, quemSouEu(RAIZ), {
      avisar: (m) => avisos.push(m),
      // Sem relógio real: o "sono" é onde o vizinho termina.
      dormir: async () => {
        sonos += 1;
        if (sonos === 2) rmSync(trava);
      },
    });
    expect(sonos).toBe(2);
    expect(avisos.length).toBeGreaterThan(0);
    expect(avisos[0]).toMatch(/esperando a vez/);
    expect(avisos[0]).toContain("/x/worktrees/vizinho");
    expect(avisos[0]).toContain("claude/vizinho @ abc1234");
    expect(avisos[0]).toContain(`PID ${process.pid}`);
    expect(avisos.at(-1)).toMatch(/a vez chegou/);
  });
});

describe("onde mora a trava", () => {
  it("`KIT_GATE_TRAVA` manda — é o ponto de injeção destes casos", () => {
    expect(caminhoDaTrava({ KIT_GATE_TRAVA: trava }, RAIZ)).toEqual({ caminho: trava, aviso: null });
  });

  it("sem a variável, no diretório comum do git — o mesmo para todo worktree", () => {
    const comum = spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
      cwd: RAIZ,
      encoding: "utf-8",
      timeout: 10_000,
      killSignal: "SIGKILL",
    });
    expect(comum.status, comum.stderr).toBe(0);
    const esperado = comum.stdout.trim();
    expect(esperado.length).toBeGreaterThan(0);
    const { caminho, aviso } = caminhoDaTrava({}, RAIZ);
    expect(aviso).toBeNull();
    expect(caminho).toBe(join(esperado, "kit-gate.trava"));
  });
});

describe("quantos pacotes rodam juntos", () => {
  it("fora do CI, dois; no CI, o default do pnpm — e nunca o build da raiz", () => {
    expect(argumentosDaSuite({}, [], RAIZ, PNPM)).toEqual(["-r", "--workspace-concurrency=2", "test"]);
    expect(argumentosDaSuite({ CI: "true" }, [], RAIZ, PNPM)).toEqual(["-r", "test"]);
    expect(argumentosDaSuite({ KIT_GATE_PACOTES: "1" }, [], RAIZ, PNPM)).toEqual(["-r", "--workspace-concurrency=1", "test"]);
    expect(argumentosDaSuite({}, [], RAIZ, PNPM)).not.toContain("build");
  });

  it("valor que não é inteiro positivo é recusado alto", () => {
    expect(() => argumentosDaSuite({ KIT_GATE_PACOTES: "0" }, [], RAIZ, PNPM)).toThrow(/inteiro ≥ 1/);
    expect(() => argumentosDaSuite({ KIT_GATE_PACOTES: "dois" }, [], RAIZ, PNPM)).toThrow(/inteiro ≥ 1/);
  });
});

describe("um pacote só — o conserto pela mesma fila", () => {
  it("o pacote pedido vira um --filter, e o resto vai para o vitest", () => {
    expect(argumentosDaSuite({}, ["runner"], RAIZ, PNPM)).toEqual(["--filter", "@izanagi/runner", "test"]);
    expect(argumentosDaSuite({}, ["--", "web", "src/x.test.ts"], RAIZ, PNPM)).toEqual(["--filter", "@izanagi/web", "test", "src/x.test.ts"]);
    expect(argumentosDaSuite({ CI: "true" }, ["shared", "-t", "trava"], RAIZ, PNPM)).toEqual(["--filter", "@izanagi/shared", "test", "-t", "trava"]);
  });

  it("pacote desconhecido é recusado alto, com a lista", () => {
    expect(() => argumentosDaSuite({}, ["nada"], RAIZ, PNPM)).toThrow(/shared, adapters, runner, web/);
  });

  it("sem argumento, a suíte inteira de sempre", () => {
    expect(argumentosDaSuite({}, [], RAIZ, PNPM)).toEqual(["-r", "--workspace-concurrency=2", "test"]);
    expect(argumentosDaSuite({}, ["--"], RAIZ, PNPM)).toEqual(["-r", "--workspace-concurrency=2", "test"]);
  });
});

describe("as vagas", () => {
  const vaga2 = () => caminhoDaVaga(trava, 2);

  it("o padrão é uma vaga — o gate de hoje; N só pela variável; inválido recusado alto; CI sem trava", () => {
    expect(vagas({})).toBe(1);
    expect(vagas({ KIT_GATE_VAGAS: "" })).toBe(1);
    expect(vagas({ KIT_GATE_VAGAS: "2" })).toBe(2);
    expect(vagas({ CI: "true" })).toBeNull();
    for (const ruim of ["0", "dois", "-1", "1.5"]) {
      expect(() => vagas({ KIT_GATE_VAGAS: ruim }), ruim).toThrow(/inteiro ≥ 1/);
    }
  });

  it("a vaga 1 é o caminho de sempre; a vaga k ≥ 2 leva o sufixo", () => {
    expect(caminhoDaVaga(trava, 1)).toBe(trava);
    expect(caminhoDaVaga(trava, 2)).toBe(`${trava}.2`);
    expect(caminhoDaVaga(trava, 3)).toBe(`${trava}.3`);
    const { caminho } = caminhoDaTrava({}, RAIZ);
    expect(caminhoDaVaga(caminho, 1).endsWith("kit-gate.trava")).toBe(true);
    expect(caminhoDaVaga(caminho, 2).endsWith("kit-gate.trava.2")).toBe(true);
  });

  it("com uma vaga (o padrão) e a vaga 1 ocupada, não toma nenhuma — o comportamento de hoje", () => {
    writeFileSync(trava, JSON.stringify(outroDono()));
    const r = tentarTomarUmaVaga(trava, 1, quemSouEu(RAIZ));
    expect(r.tomou).toBe(false);
    expect(r.donos).toHaveLength(1);
    expect(existsSync(vaga2())).toBe(false);
  });

  it("com duas vagas, a 1 ocupada por dono vivo e a 2 livre, toma a 2", () => {
    writeFileSync(trava, JSON.stringify(outroDono()));
    const eu = quemSouEu(RAIZ);
    expect(tentarTomarUmaVaga(trava, 2, eu)).toEqual({ tomou: true, vaga: 2 });
    expect(JSON.parse(readFileSync(vaga2(), "utf-8")).token).toBe(eu.token);
  });

  it("com as duas ocupadas, não toma e devolve os DOIS donos", () => {
    writeFileSync(trava, JSON.stringify(outroDono({ token: "a", worktree: "/x/a" })));
    writeFileSync(vaga2(), JSON.stringify(outroDono({ token: "b", worktree: "/x/b" })));
    const r = tentarTomarUmaVaga(trava, 2, quemSouEu(RAIZ));
    expect(r.tomou).toBe(false);
    expect(r.donos.map((d) => d.token)).toEqual(["a", "b"]);
  });

  it("o MESMO worktree não roda dois gates juntos, mesmo com vaga livre — e a mensagem diz isso", () => {
    writeFileSync(trava, JSON.stringify(outroDono({ token: "meu-irmao", worktree: RAIZ })));
    const r = tentarTomarUmaVaga(trava, 2, quemSouEu(RAIZ));
    expect(r.tomou).toBe(false);
    expect(r.mesmoWorktree).toMatchObject({ token: "meu-irmao" });
    expect(existsSync(vaga2())).toBe(false);

    const avisos = [];
    let sonos = 0;
    return esperarAVez(trava, 2, quemSouEu(RAIZ), {
      avisar: (m) => avisos.push(m),
      dormir: async () => {
        sonos += 1;
        if (sonos === 1) rmSync(trava);
      },
    }).then(() => {
      expect(avisos[0]).toMatch(/mesmo worktree/);
      expect(avisos[0]).toMatch(/dist/);
    });
  });

  it("a vaga de PID morto do mesmo worktree não segura ninguém", () => {
    writeFileSync(trava, JSON.stringify(outroDono({ token: "morto", worktree: RAIZ, pid: pidMorto() })));
    expect(tentarTomarUmaVaga(trava, 2, quemSouEu(RAIZ))).toEqual({ tomou: true, vaga: 1 });
  });

  it("esperar com as duas ocupadas nomeia os dois donos, e toma quando um solta", async () => {
    writeFileSync(trava, JSON.stringify(outroDono({ token: "a", worktree: "/x/wt-a" })));
    writeFileSync(vaga2(), JSON.stringify(outroDono({ token: "b", worktree: "/x/wt-b" })));
    const avisos = [];
    let sonos = 0;
    await esperarAVez(trava, 2, quemSouEu(RAIZ), {
      avisar: (m) => avisos.push(m),
      dormir: async () => {
        sonos += 1;
        if (sonos === 2) rmSync(vaga2());
      },
    });
    expect(avisos[0]).toContain("/x/wt-a");
    expect(avisos[0]).toContain("/x/wt-b");
    expect(avisos.at(-1)).toMatch(/a vez chegou/);
  });

  it("soltar solta só a vaga que é sua", () => {
    writeFileSync(trava, JSON.stringify(outroDono()));
    const eu = quemSouEu(RAIZ);
    const r = tentarTomarUmaVaga(trava, 2, eu);
    expect(r).toEqual({ tomou: true, vaga: 2 });
    expect(soltar(trava, eu)).toBe(false);
    expect(existsSync(trava)).toBe(true);
    expect(soltar(vaga2(), eu)).toBe(true);
    expect(existsSync(vaga2())).toBe(false);
  });
});

describe("a fila do conserto", () => {
  const gate = () => join(dir, "gate.trava");
  const conserto = () => join(dir, "conserto.trava");

  it("sem argumento é a fila do gate; com pacote, a do conserto", () => {
    expect(filaDoArgv([], RAIZ, PNPM)).toBe("gate");
    expect(filaDoArgv(["--"], RAIZ, PNPM)).toBe("gate");
    expect(filaDoArgv(["web", "x.test.ts"], RAIZ, PNPM)).toBe("conserto");
    expect(filaDoArgv(["--", "shared"], RAIZ, PNPM)).toBe("conserto");
  });

  it("cada fila tem a sua trava e o seu ponto de injeção; a vaga 1 do conserto é kit-conserto.trava", () => {
    expect(caminhoDaTrava({ KIT_CONSERTO_TRAVA: conserto() }, RAIZ, "conserto")).toEqual({ caminho: conserto(), aviso: null });
    expect(caminhoDaTrava({ KIT_GATE_TRAVA: gate() }, RAIZ, "gate")).toEqual({ caminho: gate(), aviso: null });
    const { caminho } = caminhoDaTrava({}, RAIZ, "conserto");
    expect(caminho.endsWith("kit-conserto.trava")).toBe(true);
    expect(caminhoDaVaga(caminho, 1)).toBe(caminho);
  });

  it("as vagas do conserto vêm de KIT_CONSERTO_VAGAS, padrão 1, e o gate não as vê", () => {
    expect(vagas({}, "conserto")).toBe(1);
    expect(vagas({ KIT_CONSERTO_VAGAS: "3" }, "conserto")).toBe(3);
    expect(vagas({ KIT_CONSERTO_VAGAS: "3" }, "gate")).toBe(1);
    expect(() => vagas({ KIT_CONSERTO_VAGAS: "0" }, "conserto")).toThrow(/KIT_CONSERTO_VAGAS.*inteiro ≥ 1/);
  });

  it("com a fila do gate ocupada por OUTRO worktree, o conserto toma a vaga dele — sem esperar", () => {
    writeFileSync(gate(), JSON.stringify(outroDono()));
    const eu = quemSouEu(RAIZ);
    expect(tentarTomarUmaVaga(conserto(), 1, eu, Date.now(), [{ base: gate(), n: 1 }])).toEqual({ tomou: true, vaga: 1 });
    expect(existsSync(conserto())).toBe(true);
  });

  it("com a fila do gate ocupada pelo MESMO worktree, o conserto espera, e a mensagem diz isso", async () => {
    writeFileSync(gate(), JSON.stringify(outroDono({ token: "meu-gate", worktree: RAIZ })));
    const eu = quemSouEu(RAIZ);
    const r = tentarTomarUmaVaga(conserto(), 1, eu, Date.now(), [{ base: gate(), n: 1 }]);
    expect(r.tomou).toBe(false);
    expect(r.mesmoWorktree).toMatchObject({ token: "meu-gate" });
    expect(existsSync(conserto())).toBe(false);

    const avisos = [];
    let sonos = 0;
    await esperarAVez(conserto(), 1, eu, {
      outras: [{ base: gate(), n: 1 }],
      fila: "conserto",
      avisar: (m) => avisos.push(m),
      dormir: async () => {
        sonos += 1;
        if (sonos === 1) rmSync(gate());
      },
    });
    expect(avisos[0]).toMatch(/mesmo worktree/);
    expect(avisos[0]).toMatch(/conserto/);
  });

  it("o gate também espera o conserto do mesmo worktree", () => {
    writeFileSync(conserto(), JSON.stringify(outroDono({ token: "meu-conserto", worktree: RAIZ })));
    const r = tentarTomarUmaVaga(gate(), 1, quemSouEu(RAIZ), Date.now(), [{ base: conserto(), n: 1 }]);
    expect(r.tomou).toBe(false);
    expect(r.mesmoWorktree).toMatchObject({ token: "meu-conserto" });
  });

  it("o conserto roda com 2 workers quando ninguém definiu; respeita o valor presente; o gate não leva teto", () => {
    expect(ambienteDoFilho({}, ["web", "x.test.ts"], RAIZ, PNPM)["KIT_TESTE_WORKERS"]).toBe("2");
    expect(ambienteDoFilho({ KIT_TESTE_WORKERS: "5" }, ["web"], RAIZ, PNPM)["KIT_TESTE_WORKERS"]).toBe("5");
    expect(ambienteDoFilho({ KIT_CONSERTO_WORKERS: "4" }, ["web"], RAIZ, PNPM)["KIT_TESTE_WORKERS"]).toBe("4");
    expect(ambienteDoFilho({}, [], RAIZ, PNPM)["KIT_TESTE_WORKERS"]).toBeUndefined();
  });

  it("KIT_CONSERTO_WORKERS inválido é recusado alto", () => {
    expect(() => ambienteDoFilho({ KIT_CONSERTO_WORKERS: "0" }, ["web"], RAIZ, PNPM)).toThrow(/KIT_CONSERTO_WORKERS.*inteiro ≥ 1/);
    expect(() => ambienteDoFilho({ KIT_CONSERTO_WORKERS: "dois" }, ["web"], RAIZ, PNPM)).toThrow(/inteiro ≥ 1/);
  });
});

/**
 * **O gate toma as fichas do teto da máquina** (ADR 0005, operador, 26/10).
 *
 * A pasta das fichas é sempre a de um `mkdtempSync` (`KIT_NUCLEOS_DIR`); `KIT_FICHAS_TOMADAS` e o resto do ambiente
 * que muda o teto saem do env dos casos, que assim medem o gate e não o `com-fichas` que roda o `npm test`.
 */
describe("o gate toma as fichas do teto", () => {
  const SEM_TETO = { KIT_FICHAS_TOMADAS: undefined, KIT_NUCLEOS_DE_TESTE: undefined, IZANAGI_NUCLEOS_DE_TESTE: undefined, CI: "" };
  const limpo = (extra = {}) => {
    const env = { ...process.env, ...SEM_TETO, ...extra };
    for (const [k, v] of Object.entries(env)) if (v === undefined) delete env[k];
    return env;
  };

  it("a config traz os padrões (4 e 2) e as variáveis do teto ficam fora da chave do verde", async () => {
    const cfg = carregarConfig(RAIZ, {});
    expect(cfg.gate.nucleos).toBe(4);
    expect(cfg.gate.nucleosTypecheck).toBe(2);
    for (const n of ["NUCLEOS_DIR", "NUCLEOS_DE_TESTE", "FICHAS_TOMADAS"]) expect(cfg.arvore.foraDaChave).toContain(n);
    const { nomesDoEnv } = await import("../o-verde-da-arvore.mjs");
    const nomes = nomesDoEnv({ KIT_NUCLEOS_DIR: "x", KIT_NUCLEOS_DE_TESTE: "3", KIT_FICHAS_TOMADAS: "2", IZANAGI_NUCLEOS_DE_TESTE: "3", KIT_OUTRA: "1" }, cfg.arvore);
    expect(nomes).toEqual(["KIT_OUTRA"]);
  });

  it("quanto a suíte pede: pnpm = pacotes juntos × workers; conserto = workers do conserto; comando = gate.nucleos", () => {
    expect(fichasDaSuite({ KIT_TESTE_WORKERS: "3" }, [], RAIZ, PNPM)).toBe(6); // 2 pacotes × 3
    expect(fichasDaSuite({}, [], RAIZ, PNPM)).toBe(2 * workersPorPacote(availableParallelism()));
    expect(fichasDaSuite({ KIT_TESTE_WORKERS: "3", KIT_GATE_PACOTES: "3" }, [], RAIZ, PNPM)).toBe(9);
    expect(fichasDaSuite({}, ["web"], RAIZ, PNPM)).toBe(2); // gate.workersConserto
    expect(fichasDaSuite({ KIT_CONSERTO_WORKERS: "5" }, ["web"], RAIZ, PNPM)).toBe(5);
    const COMANDO = carregarConfig(RAIZ, { gate: { comandoCompleto: "node --test" } });
    expect(fichasDaSuite({}, [], RAIZ, COMANDO)).toBe(4);
    expect(fichasDaSuite({}, [], RAIZ, carregarConfig(RAIZ, { gate: { comandoCompleto: "node --test", nucleos: 6 } }))).toBe(6);
  });

  it("o `{fichas}` do comando vira o número levado; sem o número, fica como está", () => {
    const cfg = carregarConfig(RAIZ, { gate: { comandoCompleto: "node --test --test-concurrency={fichas}", pacotes: ["a"], comandoPorPacote: "node --test {pacote} --c={fichas}" } });
    expect(comandoDaSuite({}, [], RAIZ, cfg, 3)).toEqual({ cmd: "node", args: ["--test", "--test-concurrency=3"] });
    expect(comandoDaSuite({}, ["a"], RAIZ, cfg, 3)).toEqual({ cmd: "node", args: ["--test", "a", "--c=3"] });
    expect(comandoDaSuite({}, [], RAIZ, cfg).args).toEqual(["--test", "--test-concurrency={fichas}"]);
  });

  it("com o teto cheio por ficha de OUTRO dono, o gate espera, diz por quem, e leva quando soltam", async () => {
    const pasta = join(dir, "nucleos");
    mkdirSync(pasta);
    writeFileSync(join(pasta, "1"), JSON.stringify({ pid: process.pid, token: "x", worktree: "/wt/outro", projeto: "outro", desde: new Date().toISOString() }));
    const avisos = [];
    let sonos = 0;
    const COMANDO = carregarConfig(RAIZ, { gate: { comandoCompleto: "node --test", nucleos: 2 } });
    const r = await tomarAsFichasDoGate(limpo({ KIT_NUCLEOS_DIR: pasta, KIT_NUCLEOS_DE_TESTE: "1" }), [], RAIZ, COMANDO, {
      avisar: (m) => avisos.push(m),
      dormir: async () => {
        sonos += 1;
        if (sonos === 2) rmSync(join(pasta, "1"));
      },
    });
    expect(avisos[0]).toMatch(/\/wt\/outro/);
    expect(r.levou).toEqual([1]);
    expect(r.teto).toBe(1);
    rmSync(join(pasta, "1"));
  });

  it("com KIT_FICHAS_TOMADAS no env, não toma de novo", async () => {
    const pasta = join(dir, "nucleos");
    const COMANDO = carregarConfig(RAIZ, { gate: { comandoCompleto: "node --test" } });
    const r = await tomarAsFichasDoGate(limpo({ KIT_NUCLEOS_DIR: pasta, KIT_FICHAS_TOMADAS: "3" }), [], RAIZ, COMANDO);
    expect(r.levou).toEqual([]);
    expect(r.quantas).toBe(3);
    expect(existsSync(pasta)).toBe(false);
  });

  describe("o `main` de ponta a ponta", () => {
    /** O comando da suíte grava o que viu: `KIT_FICHAS_TOMADAS`, o argumento `{fichas}` e quantas fichas havia na pasta. */
    function montar(kit = {}) {
      const raiz = realpathSync(mkdtempSync(join(tmpdir(), "kit-fichas-gate-")));
      const g = (args) => spawnSync("git", args, { cwd: raiz, encoding: "utf-8", timeout: 10_000, killSignal: "SIGKILL" });
      g(["init", "-q"]);
      g(["config", "user.email", "t@kit.local"]);
      g(["config", "user.name", "t"]);
      writeFileSync(
        join(raiz, "suite.mjs"),
        `import { appendFileSync, readdirSync } from "node:fs";
         let n = 0; // pasta ausente = nenhuma ficha (quem não toma não cria a pasta)
         try { n = readdirSync(process.env.KIT_NUCLEOS_DIR).filter((x) => /^[0-9]+$/.test(x)).length; } catch {}
         appendFileSync(process.env.MARCA, JSON.stringify({ env: process.env.KIT_FICHAS_TOMADAS, arg: process.argv[2], naPasta: n }) + "\\n");`,
      );
      mkdirSync(join(raiz, ".claude"));
      writeFileSync(join(raiz, ".claude", "kit.json"), JSON.stringify({ gate: { comandoCompleto: "node suite.mjs {fichas}", ...kit } }));
      g(["add", "-A"]);
      g(["commit", "-qm", "base"]);
      const base = realpathSync(mkdtempSync(join(tmpdir(), "kit-fichas-base-")));
      const env = limpo({
        KIT_GATE_TRAVA: join(base, "g.trava"),
        KIT_CONSERTO_TRAVA: join(base, "c.trava"),
        KIT_GATE_VERDE_DIR: join(base, "verde"),
        KIT_NUCLEOS_DIR: join(base, "nucleos"),
        MARCA: join(base, "marca.jsonl"),
      });
      return { raiz, base, env };
    }
    const vistos = (p) => readFileSync(p.env.MARCA, "utf-8").trim().split("\n").map((l) => JSON.parse(l));

    it("leva gate.nucleos fichas (teto 7), o filho as vê, e no fim a pasta está vazia", async () => {
      const p = montar();
      try {
        expect(await main({ ...p.env, KIT_NUCLEOS_DE_TESTE: "7" }, [], p.raiz)).toBe(0);
        expect(vistos(p)).toEqual([{ env: "4", arg: "4", naPasta: 4 }]);
        expect(readdirSync(join(p.base, "nucleos"))).toEqual([]);
        expect(existsSync(p.env.KIT_GATE_TRAVA)).toBe(false);
      } finally {
        rmSync(p.raiz, { recursive: true, force: true });
        rmSync(p.base, { recursive: true, force: true });
      }
    });

    it("com o teto menor que o pedido, leva o que o teto dá (2 de 2)", async () => {
      const p = montar();
      try {
        expect(await main({ ...p.env, KIT_NUCLEOS_DE_TESTE: "2" }, [], p.raiz)).toBe(0);
        expect(vistos(p)).toEqual([{ env: "2", arg: "2", naPasta: 2 }]);
      } finally {
        rmSync(p.raiz, { recursive: true, force: true });
        rmSync(p.base, { recursive: true, force: true });
      }
    });

    it("quem já tem fichas (KIT_FICHAS_TOMADAS) não toma de novo: a pasta fica vazia e o número é repassado", async () => {
      const p = montar();
      try {
        expect(await main({ ...p.env, KIT_NUCLEOS_DE_TESTE: "7", KIT_FICHAS_TOMADAS: "3" }, [], p.raiz)).toBe(0);
        expect(vistos(p)).toEqual([{ env: "3", arg: "3", naPasta: 0 }]);
      } finally {
        rmSync(p.raiz, { recursive: true, force: true });
        rmSync(p.base, { recursive: true, force: true });
      }
    });

    it("suíte vermelha também solta as fichas", async () => {
      const p = montar({ comandoCompleto: "node -e process.exit(3)" });
      try {
        expect(await main({ ...p.env, KIT_NUCLEOS_DE_TESTE: "7" }, [], p.raiz)).toBe(3);
        expect(readdirSync(join(p.base, "nucleos"))).toEqual([]);
      } finally {
        rmSync(p.raiz, { recursive: true, force: true });
        rmSync(p.base, { recursive: true, force: true });
      }
    });

    it("no CI não há fichas: a pasta nem é criada", async () => {
      const p = montar();
      try {
        expect(await main({ ...p.env, CI: "1" }, [], p.raiz)).toBe(0);
        expect(existsSync(join(p.base, "nucleos"))).toBe(false);
      } finally {
        rmSync(p.raiz, { recursive: true, force: true });
        rmSync(p.base, { recursive: true, force: true });
      }
    });
  });
});
