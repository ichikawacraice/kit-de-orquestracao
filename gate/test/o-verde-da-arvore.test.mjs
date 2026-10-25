import { afterEach, beforeEach, describe, it } from "node:test";
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { carregarConfig } from "../config.mjs";
import {
  FORMATO,
  PRAZO_DO_VERDE_MS,
  RETENCAO_MS,
  arvoreDoWorktree,
  chaveDe,
  consultar,
  dirDoVerde,
  gravarVerde,
  guardarSeAArvoreNaoMudou,
  impressaoDeArquivosGerados,
  impressaoDoBanco,
  impressaoDoDiretorioExecutavel,
  impressaoDoExtra,
  insumosDaChave,
  insumosQueDiferem,
  recusaDoCache,
  verdesDaMesmaArvore,
  linhaDoPulo,
  nomesDoEnv,
  procurarVerde,
} from "../o-verde-da-arvore.mjs";
import { expect } from "./expect.mjs";

/** Os três extras do Izanagi, como o `kit.json` dele os declara. */
const BANCO = {
  nome: "banco",
  tipo: "banco-postgres",
  urlEnv: "IZANAGI_BANCO_LOCAL_URL",
  urlPadrao: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
};
const TAILWIND = { nome: "tailwind", tipo: "diretorio-executavel", dirEnv: "IZANAGI_TAILWIND_DIR", dirPadrao: "izanagi-tailwind", binario: "node_modules/.bin/tailwindcss" };
const TIPOS_DO_NEXT = { nome: "tiposDoNext", tipo: "arquivos-gerados", base: "apps/web", padraoDir: "^\\.next[^/]*$", sub: "types" };
const CFG = carregarConfig("/x", {
  gate: { verdeDir: "izanagi-gate-verde" },
  arvore: { prefixosEnv: ["IZANAGI_", "NEXT_PUBLIC_", "SUPABASE_"], extras: [BANCO, TAILWIND, TIPOS_DO_NEXT] },
});

/**
 * **O verde do gate, guardado pela árvore exata.**
 *
 * O gate passa a pular a árvore que já passou. O pulo só é honesto se a chave
 * enxerga tudo o que decide o desfecho, se o registro não guarda segredo e se
 * só o verde da MESMA chave, dentro do prazo, vale. Estes casos medem isso
 * num repositório git e num diretório de verde temporários, próprios de cada
 * caso — **o verde de verdade, o do diretório comum do git, nunca é tocado
 * aqui**: um teste que o gravasse faria o gate de outra sessão pular.
 */

/** `git` com prazo e SIGKILL (ADR 0199). */
function git(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 10_000,
    killSignal: "SIGKILL",
  }).trim();
}

let base;
let repo;
let verde;

beforeEach(() => {
  base = realpathSync(mkdtempSync(join(tmpdir(), "kit-verde-teste-")));
  repo = join(base, "repo");
  verde = join(base, "verde");
  mkdirSync(repo);
  git(["init", "-q"], repo);
  git(["config", "user.email", "teste@izanagi.local"], repo);
  git(["config", "user.name", "teste"], repo);
  writeFileSync(join(repo, ".gitignore"), "ignorado.txt\n");
  writeFileSync(join(repo, "a.txt"), "a\n");
  git(["add", "-A"], repo);
  git(["commit", "-q", "-m", "inicial"], repo);
  // Teste que mede uma ausência declara a ausência: o verde parte vazio.
  expect(existsSync(verde)).toBe(false);
});

afterEach(() => {
  rmSync(base, { recursive: true, force: true });
});

/** Um env que só tem o que o caso põe — nada exportado no shell de quem roda entra na chave. */
const envLimpo = (extra = {}) => ({
  IZANAGI_BANCO_LOCAL_URL: "postgresql://x@10.0.0.1:5432/db",
  IZANAGI_TAILWIND_DIR: join(base, "sem-tailwind"),
  ...extra,
});

describe("a árvore do worktree", () => {
  it("limpa, é o HEAD^{tree}; o não rastreado muda; o ignorado não; o índice real fica intocado", () => {
    const head = git(["rev-parse", "HEAD^{tree}"], repo);
    expect(head).toMatch(/^[0-9a-f]{40}$/);
    expect(arvoreDoWorktree(repo)).toEqual({ arvore: head });

    writeFileSync(join(repo, "ignorado.txt"), "não entra\n");
    expect(arvoreDoWorktree(repo)).toEqual({ arvore: head });

    const statusAntes = git(["status", "--porcelain"], repo);
    writeFileSync(join(repo, "novo.txt"), "entra\n");
    const statusComNovo = git(["status", "--porcelain"], repo);
    expect(statusComNovo).toContain("?? novo.txt");
    const comNovo = arvoreDoWorktree(repo);
    expect(comNovo.arvore).toMatch(/^[0-9a-f]{40}$/);
    expect(comNovo).not.toEqual({ arvore: head });
    // O índice real não ganhou o arquivo: ele continua não rastreado.
    expect(git(["status", "--porcelain"], repo)).toBe(statusComNovo);
    expect(statusAntes).toBe("");
  });

  it("a edição não commitada de um rastreado também muda a árvore", () => {
    const head = git(["rev-parse", "HEAD^{tree}"], repo);
    writeFileSync(join(repo, "a.txt"), "editado\n");
    expect(arvoreDoWorktree(repo)).not.toEqual({ arvore: head });
  });

  it("arquivo com assume-unchanged ou skip-worktree torna a árvore ilegível — a edição dele não mudaria o hash", () => {
    git(["update-index", "--assume-unchanged", "a.txt"], repo);
    expect(git(["ls-files", "-v"], repo)).toMatch(/^h a\.txt$/m);
    const r = arvoreDoWorktree(repo);
    expect("arvore" in r).toBe(false);
    expect(r.erro).toMatch(/assume-unchanged ou skip-worktree.*a\.txt/);
  });

  it("skip-worktree também", () => {
    git(["update-index", "--skip-worktree", "a.txt"], repo);
    expect(git(["ls-files", "-v"], repo)).toMatch(/^S a\.txt$/m);
    expect("arvore" in arvoreDoWorktree(repo)).toBe(false);
  });

  it("o índice normal não é confundido com marca", () => {
    expect(git(["ls-files", "-v"], repo)).toMatch(/^H a\.txt$/m);
    expect("arvore" in arvoreDoWorktree(repo)).toBe(true);
  });
});

describe("árvore ilegível não guarda nem acha verde", () => {
  it("um arquivo sem permissão de leitura: a chave seria constante, e a consulta e a gravação recusam", () => {
    const travado = join(repo, "travado.txt");
    writeFileSync(travado, "x\n");
    chmodSync(travado, 0o000);
    try {
      // A precondição: sem permissão, ilegível MESMO — como root ele seria lido, e o caso não mediria nada.
      expect(() => readFileSync(travado), "precondição: o arquivo travado é ilegível (rodando como root?)").toThrow();
      const env = envLimpo({ IZANAGI_GATE_VERDE_DIR: verde });
      const insumos = insumosDaChave(repo, env, CFG);
      // A precondição: a árvore não foi lida — e a mensagem é estável, então a chave
      // seria a mesma para qualquer conteúdo.
      expect(insumos.arvore).toMatch(/^ilegível: /);
      expect(insumos.arvore).not.toContain("undefined");
      writeFileSync(join(repo, "a.txt"), "outro conteúdo\n");
      expect(chaveDe(insumosDaChave(repo, env, CFG))).toBe(chaveDe(insumos));

      expect(recusaDoCache(insumos)).toMatch(/a árvore não foi lida/);
      const consulta = consultar("test", repo, env, () => {}, CFG);
      expect(consulta.recusa).toMatch(/a árvore não foi lida/);

      // A gravação recusa: o diretório do verde continua vazio.
      const avisos = [];
      expect(guardarSeAArvoreNaoMudou("test", consulta, Date.now(), repo, env, (m) => avisos.push(m), CFG)).toBe(false);
      expect(avisos.join("\n")).toMatch(/NÃO foi guardado: a árvore não foi lida/);
      expect(existsSync(verde) ? readdirSync(verde) : []).toEqual([]);

      // A consulta recusa MESMO com um verde na chave constante: plantado e
      // achado antes — sem isso, o `null` viria do diretório vazio, não da recusa.
      gravarVerde(verde, { etapa: "test", chave: consulta.chave, arvore: insumos.arvore, quando: new Date().toISOString(), insumos });
      expect(procurarVerde(verde, "test", consulta.chave) !== null).toBe(true);
      expect(consultar("test", repo, env, () => {}, CFG).registro).toBeNull();
    } finally {
      chmodSync(travado, 0o644);
    }
  });

  it("a árvore lida não tem recusa", () => {
    expect(recusaDoCache(insumosDaChave(repo, envLimpo(), CFG))).toBeNull();
  });
});

describe("a chave", () => {
  it("muda com cada insumo que decide o desfecho", () => {
    const base_ = insumosDaChave(repo, envLimpo(), CFG);
    expect(base_.arvore).toMatch(/^[0-9a-f]{40}$/);
    const chave = chaveDe(base_);
    expect(chave).toMatch(/^[0-9a-f]{64}$/);

    expect(chaveDe({ ...base_, arvore: "outra" }), "arvore").not.toBe(chave);
    expect(chaveDe(insumosDaChave(repo, envLimpo({ IZANAGI_SUITE: "leve" }), CFG)), "env").not.toBe(chave);
    expect(chaveDe({ ...base_, banco: "outro" }), "banco").not.toBe(chave);
    expect(chaveDe({ ...base_, dotenv: "outro" }), "dotenv").not.toBe(chave);
    expect(chaveDe({ ...base_, tailwind: "outro" }), "tailwind").not.toBe(chave);
    expect(chaveDe({ ...base_, tiposDoNext: "outro" }), "tiposDoNext").not.toBe(chave);
    expect(chaveDe({ ...base_, runtime: { ...base_.runtime, node: "v0.0.0" } }), "runtime").not.toBe(chave);
  });

  it("o .env da raiz entra pelo conteúdo", () => {
    const sem = insumosDaChave(repo, envLimpo(), CFG);
    expect(sem.dotenv).toBe("ausente");
    writeFileSync(join(repo, ".env"), "X=1\n");
    const com = insumosDaChave(repo, envLimpo(), CFG);
    expect(com.dotenv).toMatch(/^[0-9a-f]{64}$/);
    expect(chaveDe(com)).not.toBe(chaveDe(sem));
  });

  it("o Tailwind entra pelo binário de cada instalação EXECUTAR, no layout real", () => {
    const raiz = join(base, "sem-tailwind");
    const env = { IZANAGI_TAILWIND_DIR: raiz };
    expect(impressaoDoDiretorioExecutavel(env, TAILWIND)).toBe("ausente");
    // O layout de `binDaInstalacao`: <raiz>/<major>-<versão>/node_modules/.bin/tailwindcss.
    const bin = join(raiz, "v3-3.4.19", "node_modules", ".bin", "tailwindcss");
    mkdirSync(join(bin, ".."), { recursive: true });
    writeFileSync(bin, "#!/bin/sh\n");
    chmodSync(bin, 0o644);
    const semExecutar = impressaoDoDiretorioExecutavel(env, TAILWIND);
    expect(semExecutar).toMatch(/^[0-9a-f]{64}$/);
    chmodSync(bin, 0o755);
    const executando = impressaoDoDiretorioExecutavel(env, TAILWIND);
    expect(executando).toMatch(/^[0-9a-f]{64}$/);
    expect(executando).not.toBe(semExecutar);
  });

  it("os tipos gerados pelo Next, que o git ignora, entram pelo conteúdo", () => {
    expect(impressaoDeArquivosGerados(repo, TIPOS_DO_NEXT)).toBe("ausente");
    const tipos = join(repo, "apps", "web", ".next-3001", "types", "app");
    mkdirSync(tipos, { recursive: true });
    writeFileSync(join(tipos, "page.ts"), "export type A = 1;\n");
    const um = impressaoDeArquivosGerados(repo, TIPOS_DO_NEXT);
    expect(um).toMatch(/^[0-9a-f]{64}$/);
    writeFileSync(join(tipos, "page.ts"), "export type A = 2;\n");
    const outro = impressaoDeArquivosGerados(repo, TIPOS_DO_NEXT);
    expect(outro).toMatch(/^[0-9a-f]{64}$/);
    expect(outro).not.toBe(um);
  });

  it("o next-env.d.ts, que o Next reescreve a cada build, fica de fora", () => {
    const tipos = join(repo, "apps", "web", ".next", "types");
    mkdirSync(tipos, { recursive: true });
    writeFileSync(join(tipos, "routes.d.ts"), "export {};\n");
    const antes = impressaoDeArquivosGerados(repo, TIPOS_DO_NEXT);
    expect(antes).toMatch(/^[0-9a-f]{64}$/);
    writeFileSync(join(repo, "apps", "web", "next-env.d.ts"), '/// <reference path="./.next-outro/types/routes.d.ts" />\n');
    expect(impressaoDeArquivosGerados(repo, TIPOS_DO_NEXT)).toBe(antes);
  });

  it("tipo ilegível vira valor próprio, nunca exceção", () => {
    const tipos = join(repo, "apps", "web", ".next", "types");
    mkdirSync(tipos, { recursive: true });
    const arquivo = join(tipos, "routes.d.ts");
    writeFileSync(arquivo, "export {};\n");
    chmodSync(arquivo, 0o000);
    try {
      expect(() => readFileSync(arquivo), "precondição: o arquivo travado é ilegível (rodando como root?)").toThrow();
      expect(impressaoDeArquivosGerados(repo, TIPOS_DO_NEXT)).toMatch(/^ilegível: .*(EACCES|permission)/i);
    } finally {
      chmodSync(arquivo, 0o644);
    }
  });

  it("as variáveis do próprio gate não mudam a chave", () => {
    const chave = chaveDe(insumosDaChave(repo, envLimpo(), CFG));
    expect(chaveDe(insumosDaChave(repo, envLimpo({ KIT_GATE_SEM_CACHE: "1", IZANAGI_GATE_SEM_CACHE: "1", KIT_GATE_VERDE_DIR: verde, KIT_GATE_TRAVA: "x", IZANAGI_GATE_VERDE_DIR: verde }), CFG))).toBe(chave);
  });

  it("o valor de uma variável nunca sai do hash — só o nome", () => {
    const insumos = insumosDaChave(repo, envLimpo({ SUPABASE_SECRET_KEY: "segredo-de-prova" }), CFG);
    expect(insumos.envNomes).toContain("SUPABASE_SECRET_KEY");
    expect(JSON.stringify(insumos)).not.toContain("segredo-de-prova");
  });
});

describe("o banco local na chave", () => {
  it("endereço que não é local é ausente", () => {
    expect(impressaoDoBanco({ IZANAGI_BANCO_LOCAL_URL: "postgresql://x@10.0.0.1:5432/db" }, BANCO)).toBe("ausente");
  });

  it("porta fechada é ausente, sem pendurar", () => {
    const inicio = Date.now();
    expect(impressaoDoBanco({ IZANAGI_BANCO_LOCAL_URL: "postgresql://postgres:postgres@127.0.0.1:1/postgres" }, BANCO)).toBe("ausente");
    expect(Date.now() - inicio).toBeLessThan(10_000);
  });
});

describe("o registro", () => {
  const registro = (sobre = {}) => ({
    etapa: "test",
    chave: "c".repeat(64),
    arvore: "a".repeat(40),
    head: "abc1234",
    branch: "claude/prova",
    worktree: "/x/worktrees/prova",
    quando: new Date("2026-10-24T03:00:00Z").toISOString(),
    duracaoMs: 240_000,
    insumos: {},
    ...sobre,
  });
  const quando = Date.parse("2026-10-24T03:00:00Z");

  it("acha só a mesma etapa e chave, do mesmo formato, dentro do prazo", () => {
    gravarVerde(verde, registro(), quando);
    const achado = procurarVerde(verde, "test", "c".repeat(64), quando + 1000);
    expect(achado?.formato).toBe(FORMATO);
    expect(achado?.arvore).toBe("a".repeat(40));
    expect(procurarVerde(verde, "test", "d".repeat(64), quando)).toBeNull();
    expect(procurarVerde(verde, "typecheck", "c".repeat(64), quando)).toBeNull();
    expect(procurarVerde(verde, "test", "c".repeat(64), quando + PRAZO_DO_VERDE_MS) !== null).toBe(true);
    expect(procurarVerde(verde, "test", "c".repeat(64), quando + PRAZO_DO_VERDE_MS + 1)).toBeNull();
  });

  it("formato diferente e lixo não valem", () => {
    gravarVerde(verde, registro(), quando);
    const arquivo = join(verde, `test-${"c".repeat(64)}.json`);
    const lido = JSON.parse(readFileSync(arquivo, "utf-8"));
    writeFileSync(arquivo, JSON.stringify({ ...lido, formato: FORMATO + 1 }));
    expect(procurarVerde(verde, "test", "c".repeat(64), quando)).toBeNull();
    writeFileSync(arquivo, "{ lixo");
    expect(procurarVerde(verde, "test", "c".repeat(64), quando)).toBeNull();
  });

  it("a gravação apaga o que passou da retenção — rascunho órfão inclusive — e mantém o resto", () => {
    mkdirSync(verde, { recursive: true });
    const rascunho = join(verde, "test-orfao.json.123.tmp");
    writeFileSync(rascunho, "{");
    const velho = join(verde, "test-velho.json");
    const recente = join(verde, "test-recente.json");
    writeFileSync(velho, "{}");
    writeFileSync(recente, "{}");
    const agora = Date.now();
    const oitoDias = (agora - RETENCAO_MS - 24 * 60 * 60 * 1000) / 1000;
    const umDia = (agora - 24 * 60 * 60 * 1000) / 1000;
    utimesSync(velho, oitoDias, oitoDias);
    utimesSync(rascunho, oitoDias, oitoDias);
    utimesSync(recente, umDia, umDia);
    gravarVerde(verde, registro(), agora);
    const ficou = readdirSync(verde).sort();
    expect(ficou).toContain("test-recente.json");
    expect(ficou).not.toContain("test-velho.json");
    expect(ficou).not.toContain("test-orfao.json.123.tmp");
    expect(ficou).toContain(`test-${"c".repeat(64)}.json`);
  });

  it("o diretório do verde é o do ponto de injeção, ou o comum do git", () => {
    expect(dirDoVerde({ IZANAGI_GATE_VERDE_DIR: verde }, repo, CFG)).toEqual({ dir: verde, aviso: null });
    const comum = git(["rev-parse", "--path-format=absolute", "--git-common-dir"], repo);
    expect(comum.length).toBeGreaterThan(0);
    expect(dirDoVerde({}, repo, CFG)).toEqual({ dir: join(comum, "izanagi-gate-verde"), aviso: null });
  });
});

describe("o que difere, quando a mesma árvore passou com outra chave", () => {
  it("nomeia o insumo — e da variável, só o nome", () => {
    const antes = insumosDaChave(repo, envLimpo({ IZANAGI_PROVA: "valor-secreto" }), CFG);
    const agora = insumosDaChave(repo, envLimpo(), CFG);
    expect(antes.arvore).toBe(agora.arvore);
    const difere = insumosQueDiferem(antes, agora);
    expect(difere).toEqual(["env (só no verde: IZANAGI_PROVA)"]);
    expect(difere.join()).not.toContain("valor-secreto");
    expect(insumosQueDiferem(agora, { ...agora, banco: "outro" })).toEqual(["banco"]);
  });

  it("todo insumo de insumosDaChave é nomeado quando muda — a lista sai dos próprios insumos", () => {
    const insumos = insumosDaChave(repo, envLimpo(), CFG);
    const campos = Object.keys(insumos).filter((n) => n !== "envNomes" && n !== "runtime");
    expect(campos.length).toBeGreaterThan(0);
    for (const nome of campos) {
      expect(insumosQueDiferem(insumos, { ...insumos, [nome]: "outro" }), nome).toEqual([nome === "env" ? "env (mesmos nomes, outro valor)" : nome]);
    }
    for (const campo of Object.keys(insumos.runtime)) {
      expect(insumosQueDiferem(insumos, { ...insumos, runtime: { ...insumos.runtime, [campo]: "outro" } })).toEqual([`runtime.${campo}`]);
    }
  });

  it("registro corrompido não derruba a comparação", () => {
    const agora = insumosDaChave(repo, envLimpo(), CFG);
    // A lista ilegível vale como vazia: não lança, e o env ainda é nomeado.
    expect(insumosQueDiferem({ ...agora, envNomes: "lixo", env: "x" }, agora)).toHaveLength(1);
    expect(insumosQueDiferem({ ...agora, envNomes: "lixo", env: "x" }, agora, CFG)[0]).toMatch(/^env \(/);
  });

  it("acha os verdes da mesma árvore com qualquer chave, e só eles", () => {
    const quando = new Date().toISOString();
    gravarVerde(verde, { etapa: "test", chave: "c".repeat(64), arvore: "a".repeat(40), quando, insumos: {} });
    gravarVerde(verde, { etapa: "test", chave: "d".repeat(64), arvore: "b".repeat(40), quando, insumos: {} });
    gravarVerde(verde, { etapa: "typecheck", chave: "e".repeat(64), arvore: "a".repeat(40), quando, insumos: {} });
    const achados = verdesDaMesmaArvore(verde, "test", "a".repeat(40));
    expect(achados.map((r) => r.chave)).toEqual(["c".repeat(64)]);
  });
});

describe("a linha do pulo", () => {
  it("nunca diz só verde: diz a árvore, a etapa, quando, onde e como medir de novo", () => {
    const linha = linhaDoPulo({
      arvore: "a".repeat(40),
      etapa: "typecheck",
      quando: "2026-10-24T03:00:00.000Z",
      worktree: "/x/worktrees/prova",
      branch: "claude/prova",
      head: "abc1234",
      duracaoMs: 61_000,
    });
    for (const parte of ["a".repeat(40), "`typecheck`", "2026-10-24T03:00:00.000Z", "/x/worktrees/prova", "abc1234", "61 s", "KIT_GATE_SEM_CACHE=1"]) {
      expect(linha).toContain(parte);
    }
  });
});

describe("os extras da chave vêm do kit.json", () => {
  it("sem `arvore.extras`, a chave não tem insumo de banco, Tailwind nem tipos", () => {
    const semExtras = carregarConfig("/x", {});
    const insumos = insumosDaChave(repo, envLimpo(), semExtras);
    expect(Object.keys(insumos).sort()).toEqual(["arvore", "dotenv", "env", "envNomes", "runtime"]);
  });

  it("um extra novo entra na chave e é nomeado quando muda", () => {
    const comExtra = carregarConfig("/x", { arvore: { extras: [{ nome: "gerados", tipo: "arquivos-gerados", base: "gen", padraoDir: "^out$", ext: ".txt" }] } });
    expect(insumosDaChave(repo, {}, comExtra).gerados).toBe("ausente");
    mkdirSync(join(repo, "gen", "out"), { recursive: true });
    writeFileSync(join(repo, "gen", "out", "a.txt"), "1");
    const um = insumosDaChave(repo, {}, comExtra);
    writeFileSync(join(repo, "gen", "out", "a.txt"), "2");
    const dois = insumosDaChave(repo, {}, comExtra);
    expect(um.gerados).toMatch(/^[0-9a-f]{64}$/);
    expect(chaveDe(um)).not.toBe(chaveDe(dois));
    expect(insumosQueDiferem(um, dois)).toContain("gerados");
  });

  it("tipo de extra desconhecido é erro alto, não silêncio", () => {
    expect(() => impressaoDoExtra({ nome: "x", tipo: "magia" }, repo, {})).toThrow(/tipo "magia" desconhecido/);
  });

  it("o prazo do verde e a retenção vêm do kit.json", () => {
    const curto = carregarConfig("/x", { gate: { prazos: { verdeHoras: 1 } } });
    expect(curto.gate.prazos.verdeHoras).toBe(1);
    expect(curto.gate.prazos.retencaoDias).toBe(7); // o resto continua no padrão
    const quando = Date.parse("2026-10-24T03:00:00Z");
    gravarVerde(verde, { etapa: "test", chave: "c".repeat(64), arvore: "a".repeat(40), head: "h", branch: "b", worktree: "/w", quando: new Date(quando).toISOString(), duracaoMs: 1, insumos: {} }, quando);
    expect(procurarVerde(verde, "test", "c".repeat(64), quando + 30 * 60_000, 3_600_000) !== null).toBe(true);
    expect(procurarVerde(verde, "test", "c".repeat(64), quando + 61 * 60_000, 3_600_000)).toBeNull();
  });
});

describe("as variáveis do próprio kit entram sempre na chave", () => {
  it("`arvore.prefixosEnv` sem `KIT_` não tira `KIT_*` nem `IZANAGI_*` da chave", () => {
    const arvore = { prefixosEnv: ["NEXT_PUBLIC_"], avulsas: [], foraDaChave: ["GATE_SEM_CACHE"] };
    const env = { KIT_TESTE_WORKERS: "3", IZANAGI_TESTE_WORKERS: "3", NEXT_PUBLIC_X: "1", KIT_GATE_SEM_CACHE: "1", OUTRA: "x" };
    expect(nomesDoEnv(env, arvore)).toEqual(["IZANAGI_TESTE_WORKERS", "KIT_TESTE_WORKERS", "NEXT_PUBLIC_X"]);
  });
});
