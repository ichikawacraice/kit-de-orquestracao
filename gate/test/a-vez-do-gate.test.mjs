import { afterEach, beforeEach, describe, it } from "node:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { carregarConfig } from "../config.mjs";
import {
  ambienteDoFilho,
  minimoParaComecar,
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

  it("a config traz os padrões (4, 2 e 300 s de devolução) e as variáveis do teto ficam fora da chave do verde", async () => {
    const cfg = carregarConfig(RAIZ, {});
    expect(cfg.gate.nucleos).toBe(4);
    expect(cfg.gate.nucleosTypecheck).toBe(2);
    expect(cfg.gate.prazos.devolucaoSeg).toBe(300);
    for (const n of ["NUCLEOS_DIR", "NUCLEOS_DE_TESTE", "FICHAS_TOMADAS", "FRACAO_DE_TESTE", "FRACAO_DO_GATE", "PRAZO_DA_DEVOLUCAO_SEG"]) expect(cfg.arvore.foraDaChave).toContain(n);
    const { nomesDoEnv } = await import("../o-verde-da-arvore.mjs");
    const nomes = nomesDoEnv({ KIT_NUCLEOS_DIR: "x", KIT_NUCLEOS_DE_TESTE: "3", KIT_FICHAS_TOMADAS: "2", IZANAGI_NUCLEOS_DE_TESTE: "3", KIT_FRACAO_DE_TESTE: "0.5", KIT_FRACAO_DO_GATE: "0.5", KIT_PRAZO_DA_DEVOLUCAO_SEG: "1", KIT_OUTRA: "1" }, cfg.arvore);
    expect(nomes).toEqual(["KIT_OUTRA"]);
  });

  it("quanto a suíte pede (ADR 0008, teto 10 → faixa do gate 7): pnpm = pacotes juntos × floor(G / juntos); conserto = workers do conserto; comando = min(gate.nucleos, G)", () => {
    const T10 = { KIT_NUCLEOS_DE_TESTE: "10" };
    expect(fichasDaSuite({ ...T10 }, [], RAIZ, PNPM)).toBe(6); // 2 pacotes × floor(7 / 2): a sobra (1) fica emprestável
    expect(fichasDaSuite({ ...T10, KIT_TESTE_WORKERS: "3" }, [], RAIZ, PNPM)).toBe(6); // 2 pacotes × 3, cabe em 7
    expect(fichasDaSuite({ ...T10, KIT_TESTE_WORKERS: "3", KIT_GATE_PACOTES: "3" }, [], RAIZ, PNPM)).toBe(7); // 9 passa da faixa: vale G
    expect(fichasDaSuite({ KIT_NUCLEOS_DE_TESTE: "100", KIT_TESTE_WORKERS: "3", KIT_GATE_PACOTES: "3" }, [], RAIZ, PNPM)).toBe(9); // faixa 70: cabe
    expect(fichasDaSuite({ KIT_NUCLEOS_DE_TESTE: "3" }, [], RAIZ, PNPM)).toBe(2); // faixa 2, 2 pacotes: 1 cada
    expect(fichasDaSuite({ KIT_NUCLEOS_DE_TESTE: "1" }, [], RAIZ, PNPM)).toBe(1); // teto 1: nunca pede mais que a faixa
    expect(fichasDaSuite({ ...T10 }, ["web"], RAIZ, PNPM)).toBe(2); // gate.workersConserto
    expect(fichasDaSuite({ ...T10, KIT_CONSERTO_WORKERS: "5" }, ["web"], RAIZ, PNPM)).toBe(5);
    const COMANDO = carregarConfig(RAIZ, { gate: { comandoCompleto: "node --test" } });
    expect(fichasDaSuite({ ...T10 }, [], RAIZ, COMANDO)).toBe(4);
    expect(fichasDaSuite({ KIT_NUCLEOS_DE_TESTE: "3" }, [], RAIZ, COMANDO)).toBe(2); // min(4, G=2)
    expect(fichasDaSuite({ ...T10 }, [], RAIZ, carregarConfig(RAIZ, { gate: { comandoCompleto: "node --test", nucleos: 6 } }))).toBe(6);
    expect(fichasDaSuite({ ...T10 }, [], RAIZ, carregarConfig(RAIZ, { gate: { comandoCompleto: "node --test", nucleos: 9 } }))).toBe(7);
  });

  it("o mínimo para começar depois do prazo: metade do pedido; no pnpm-workspace, nunca menos de 2 workers por pacote", () => {
    const COMANDO = carregarConfig(RAIZ, { gate: { comandoCompleto: "node --test" } });
    expect(minimoParaComecar(4, {}, COMANDO)).toBe(2);
    expect(minimoParaComecar(5, {}, COMANDO)).toBe(3);
    expect(minimoParaComecar(6, {}, PNPM)).toBe(4); // metade seria 3 = 1 worker por pacote
    expect(minimoParaComecar(6, { KIT_GATE_PACOTES: "1" }, PNPM)).toBe(3); // 1 pacote: metade já dá 3 workers
    expect(minimoParaComecar(2, {}, PNPM)).toBe(2); // nunca mais que o pedido
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

    it("com o teto menor que o pedido, leva a faixa do gate (teto 2 → 1 de 1)", async () => {
      const p = montar();
      try {
        expect(await main({ ...p.env, KIT_NUCLEOS_DE_TESTE: "2" }, [], p.raiz)).toBe(0);
        expect(vistos(p)).toEqual([{ env: "1", arg: "1", naPasta: 1 }]);
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

/**
 * **O gate é um por vez na máquina e leva só a faixa dele** (ADR 0008, operador, 26/10).
 *
 * Mesmo molde do bloco acima: pasta temporária (`KIT_NUCLEOS_DIR`), trava do repositório temporária, e o comando da suíte grava
 * o que viu. A "outra sessão" é este processo (PID vivo) escrevendo os arquivos da pasta à mão.
 */
describe("o gate e a vez da máquina (ADR 0008)", () => {
  const LIMPO = { KIT_FICHAS_TOMADAS: undefined, KIT_NUCLEOS_DE_TESTE: undefined, IZANAGI_NUCLEOS_DE_TESTE: undefined, KIT_FRACAO_DE_TESTE: undefined, KIT_FRACAO_DO_GATE: undefined, KIT_TESTE_WORKERS: undefined, IZANAGI_TESTE_WORKERS: undefined, KIT_GATE_PACOTES: undefined, IZANAGI_GATE_PACOTES: undefined, KIT_GATE_VAGAS: undefined, IZANAGI_GATE_VAGAS: undefined, CI: "" };
  const limpo = (extra = {}) => {
    const env = { ...process.env, ...LIMPO, ...extra };
    for (const [k, v] of Object.entries(env)) if (v === undefined) delete env[k];
    return env;
  };
  const dono = (sobre = {}) => ({ pid: process.pid, token: "outro", worktree: "/wt/outro", projeto: "outro", desde: new Date().toISOString(), ...sobre });
  const PNPM_PAC = carregarConfig(RAIZ, { gate: { perfil: "pnpm-workspace", pacotes: ["a", "b"], filtroDePacote: "@x/{pacote}" } });

  /** Um repositório com o gate de comando `node suite.mjs {fichas}`; a suíte anota quais fichas existiam e se a vez da máquina estava tomada. */
  function montar(kit = {}) {
    const raiz = realpathSync(mkdtempSync(join(tmpdir(), "kit-vez-maquina-")));
    const g = (args) => spawnSync("git", args, { cwd: raiz, encoding: "utf-8", timeout: 10_000, killSignal: "SIGKILL" });
    g(["init", "-q"]);
    g(["config", "user.email", "t@kit.local"]);
    g(["config", "user.name", "t"]);
    writeFileSync(
      join(raiz, "suite.mjs"),
      `import { appendFileSync, existsSync, readdirSync } from "node:fs";
       const ks = readdirSync(process.env.KIT_NUCLEOS_DIR).filter((x) => /^[0-9]+$/.test(x)).map(Number).sort((a, b) => a - b);
       appendFileSync(process.env.MARCA, JSON.stringify({ fichas: process.env.KIT_FICHAS_TOMADAS, ks, vez: existsSync(process.env.KIT_NUCLEOS_DIR + "/gate") }) + "\\n");`,
    );
    mkdirSync(join(raiz, ".claude"));
    writeFileSync(join(raiz, ".claude", "kit.json"), JSON.stringify({ gate: { comandoCompleto: "node suite.mjs {fichas}", ...kit } }));
    g(["add", "-A"]);
    g(["commit", "-qm", "base"]);
    const base = realpathSync(mkdtempSync(join(tmpdir(), "kit-vez-maquina-base-")));
    mkdirSync(join(base, "nucleos"));
    const env = limpo({
      KIT_GATE_TRAVA: join(base, "g.trava"),
      KIT_CONSERTO_TRAVA: join(base, "c.trava"),
      KIT_GATE_VERDE_DIR: join(base, "verde"),
      KIT_NUCLEOS_DIR: join(base, "nucleos"),
      KIT_NUCLEOS_DE_TESTE: "10",
      KIT_PRAZO_DA_DEVOLUCAO_SEG: "1",
      MARCA: join(base, "marca.jsonl"),
    });
    return { raiz, base, env, pasta: join(base, "nucleos") };
  }
  const limparTudo = (p) => {
    rmSync(p.raiz, { recursive: true, force: true });
    rmSync(p.base, { recursive: true, force: true });
  };
  const vistos = (p) => readFileSync(p.env.MARCA, "utf-8").trim().split("\n").map((l) => JSON.parse(l));
  const numeradas = (pasta) => readdirSync(pasta).filter((x) => /^[0-9]+$/.test(x)).sort((a, b) => a - b);

  it("o gate sozinho leva as fichas da faixa dele (1..4 com gate.nucleos 4), toma a vez da máquina, e solta tudo na saída", async () => {
    const p = montar();
    try {
      expect(await main(p.env, [], p.raiz)).toBe(0);
      expect(vistos(p)).toEqual([{ fichas: "4", ks: [1, 2, 3, 4], vez: true }]);
      expect(readdirSync(p.pasta)).toEqual([]);
    } finally {
      limparTudo(p);
    }
  });

  it("a saída solta as fichas, depois a vez da máquina, depois a vez do repositório (nesta ordem)", async () => {
    const p = montar();
    try {
      // a suíte lê a pasta e a trava do repositório; um observador no `finally` de fora só vê o fim. A ordem se prova pelo que a
      // suíte vê ainda tomado e pelo que `soltar` encontra depois: aqui, a suíte confere os três arquivos no momento em que roda.
      writeFileSync(
        join(p.raiz, "suite.mjs"),
        `import { appendFileSync, existsSync, readdirSync } from "node:fs";
         const nume = readdirSync(process.env.KIT_NUCLEOS_DIR).filter((x) => /^[0-9]+$/.test(x)).length;
         appendFileSync(process.env.MARCA, JSON.stringify({ nume, vezMaquina: existsSync(process.env.KIT_NUCLEOS_DIR + "/gate"), vezRepo: existsSync(process.env.KIT_GATE_TRAVA) }) + "\\n");`,
      );
      spawnSync("git", ["commit", "-qam", "suite"], { cwd: p.raiz, timeout: 10_000, killSignal: "SIGKILL" });
      expect(await main(p.env, [], p.raiz)).toBe(0);
      expect(vistos(p)).toEqual([{ nume: 4, vezMaquina: true, vezRepo: true }]);
      expect(readdirSync(p.pasta)).toEqual([]);
      expect(existsSync(p.env.KIT_GATE_TRAVA)).toBe(false);
    } finally {
      limparTudo(p);
    }
  });

  it("dois gates de repositórios diferentes: o segundo espera a vez da máquina e diz o worktree do primeiro", async () => {
    const a = montar();
    const b = montar();
    try {
      // `b` usa a MESMA pasta de fichas que `a`; as travas dos repositórios são distintas (o que antes deixava os dois rodarem juntos)
      b.env["KIT_NUCLEOS_DIR"] = a.pasta;
      expect(a.env.KIT_GATE_TRAVA).not.toBe(b.env.KIT_GATE_TRAVA);
      writeFileSync(join(a.pasta, "gate"), JSON.stringify(dono({ worktree: a.raiz, projeto: "primeiro" })));
      const avisos = [];
      const antes = console.error;
      console.error = (...m) => avisos.push(m.join(" "));
      let codigo;
      try {
        const rodando = main(b.env, [], b.raiz);
        // o segundo gate está esperando: a suíte dele nem começou enquanto a vez for do primeiro
        await new Promise((r) => setTimeout(r, 400));
        expect(existsSync(b.env.MARCA), "o segundo gate rodou com a vez da máquina tomada").toBe(false);
        rmSync(join(a.pasta, "gate"));
        codigo = await rodando;
      } finally {
        console.error = antes;
      }
      expect(codigo).toBe(0);
      expect(avisos.join("\n")).toContain(a.raiz);
      expect(vistos(b)[0].fichas).toBe("4");
    } finally {
      limparTudo(a);
      limparTudo(b);
    }
  });

  it("com 2 fichas emprestadas a um dono vivo: o gate espera; soltas, começa com as pedidas", async () => {
    const p = montar({ perfil: "pnpm-workspace", pacotes: ["a", "b"], filtroDePacote: "@x/{pacote}", comandoCompleto: "node suite.mjs {fichas}" });
    // `fichasDaSuite` no pnpm-workspace pede 2 × floor(7/2) = 6; o comando do gate é o `pnpm`, então aqui medimos `tomarAsFichasDoGate`
    try {
      writeFileSync(join(p.pasta, "1"), JSON.stringify({ ...dono(), emprestada: true }));
      writeFileSync(join(p.pasta, "2"), JSON.stringify({ ...dono(), emprestada: true }));
      let sonos = 0;
      const avisos = [];
      const r = await tomarAsFichasDoGate({ ...p.env, KIT_PRAZO_DA_DEVOLUCAO_SEG: "3600" }, [], p.raiz, PNPM_PAC, {
        avisar: (m) => avisos.push(m),
        dormir: async () => {
          sonos += 1;
          if (sonos === 3) {
            rmSync(join(p.pasta, "1"));
            rmSync(join(p.pasta, "2"));
          }
        },
      });
      expect(sonos).toBeGreaterThan(2);
      expect(r.quantas).toBe(6);
      expect(r.levou).toEqual([1, 2, 3, 4, 5, 6, 7].filter((k) => r.levou.includes(k)));
      expect(r.levou.every((k) => k >= 1 && k <= 7), "só da faixa do gate").toBe(true);
      expect(r.levou).toHaveLength(6);
      expect(avisos.join("\n")).toMatch(/\/wt\/outro/);
      expect(existsSync(join(p.pasta, "gate"))).toBe(true);
    } finally {
      limparTudo(p);
    }
  });

  it("prazo da devolução vencido: começa com 5 de 6 e com 4 de 6 (2 workers por pacote); com 3 de 6 (1 por pacote) e com 2 de 6 não começa", async () => {
    const casos = [
      [5, 5],
      [4, 4],
    ];
    for (const [livres, esperado] of casos) {
      const p = montar({ perfil: "pnpm-workspace", pacotes: ["a", "b"], filtroDePacote: "@x/{pacote}", comandoCompleto: "x" });
      try {
        // um dono vivo segura `7 - livres` fichas da faixa do gate, de cima para baixo
        for (let k = 7; k > livres; k--) writeFileSync(join(p.pasta, String(k)), JSON.stringify({ ...dono(), emprestada: true }));
        let t = 0;
        const r = await tomarAsFichasDoGate({ ...p.env, KIT_PRAZO_DA_DEVOLUCAO_SEG: "1" }, [], p.raiz, PNPM_PAC, { agora: () => t, dormir: async (ms) => { t += ms; }, avisar: () => {} });
        expect(r.quantas, `${livres} livres`).toBe(esperado);
        expect(r.quantas).toBeLessThan(6);
      } finally {
        limparTudo(p);
      }
    }
    for (const livres of [3, 2]) {
      const p = montar({ perfil: "pnpm-workspace", pacotes: ["a", "b"], filtroDePacote: "@x/{pacote}", comandoCompleto: "x" });
      try {
        for (let k = 7; k > livres; k--) writeFileSync(join(p.pasta, String(k)), JSON.stringify({ ...dono(), emprestada: true }));
        let t = 0;
        const avisos = [];
        const erro = await tomarAsFichasDoGate({ ...p.env, KIT_PRAZO_DA_DEVOLUCAO_SEG: "1" }, [], p.raiz, PNPM_PAC, {
          agora: () => t,
          dormir: async (ms) => {
            t += ms;
            if (t > 600_000) throw new Error(`PARADO: ${livres} de 6 não começa`);
          },
          avisar: (m) => avisos.push(m),
        }).then(() => null, (e) => e);
        expect(erro, `o gate com ${livres} de 6 começou`).toMatch(/PARADO/);
        // a vez da máquina não fica presa por quem desistiu
        expect(avisos.length).toBeGreaterThan(3);
        expect(existsSync(join(p.pasta, "gate"))).toBe(false);
      } finally {
        limparTudo(p);
      }
    }
  });

  it("o conserto (um pacote) toma como teste normal: não pega a vez da máquina e não espera o gate de outro dono", async () => {
    const p = montar({ perfil: "pnpm-workspace", pacotes: ["a", "b"], filtroDePacote: "@x/{pacote}", comandoCompleto: "x" });
    try {
      writeFileSync(join(p.pasta, "gate"), JSON.stringify(dono({ token: "gate-outro" })));
      const r = await tomarAsFichasDoGate(p.env, ["a"], p.raiz, PNPM_PAC, { avisar: () => {} });
      expect(r.quantas).toBe(2); // gate.workersConserto
      expect(r.levou).toEqual([10, 9]);
      expect(JSON.parse(readFileSync(join(p.pasta, "gate"), "utf-8")).token, "a vez do outro gate segue dele").toBe("gate-outro");
    } finally {
      limparTudo(p);
    }
  });
});
