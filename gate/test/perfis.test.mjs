import { describe, it } from "node:test";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { carregarConfig, envKit, lerKitJson } from "../config.mjs";
import { comandoDaSuite, main, pacoteDoArgv, pacotesDoGate, vagas } from "../a-vez-do-gate.mjs";
import { pacotesConsumidosCompilados } from "../o-dist-que-o-gate-le.mjs";
import { tetoDeWorkers } from "../o-teto-de-workers.mjs";
import { expect } from "./expect.mjs";

/**
 * **Os perfis do gate**: o projeto `npm` simples (só `kit.json` mínimo), o
 * workspace `pnpm` do Izanagi lido do disco, e a configuração em si. Cada caso
 * monta o seu repositório num diretório temporário — a trava e o verde de
 * verdade (do diretório comum do git) nunca são tocados.
 */
const git = (args, cwd) =>
  execFileSync("git", args, { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"], timeout: 10_000, killSignal: "SIGKILL" }).trim();

function repo(arquivos) {
  const raiz = realpathSync(mkdtempSync(join(tmpdir(), "kit-perfil-")));
  git(["init", "-q"], raiz);
  git(["config", "user.email", "teste@kit.local"], raiz);
  git(["config", "user.name", "teste"], raiz);
  for (const [caminho, conteudo] of Object.entries(arquivos)) {
    mkdirSync(join(raiz, caminho, ".."), { recursive: true });
    writeFileSync(join(raiz, caminho), typeof conteudo === "string" ? conteudo : JSON.stringify(conteudo, null, 2));
  }
  git(["add", "-A"], raiz);
  git(["commit", "-qm", "base"], raiz);
  return raiz;
}

describe("(a) projeto npm simples, só com kit.json mínimo", () => {
  // O "teste" do projeto anota se a trava existia enquanto ele rodava: prova a fila sem relógio.
  const scriptDoTeste = `node -e "require('fs').appendFileSync(process.env.MARCA, require('fs').existsSync(process.env.KIT_GATE_TRAVA) ? 'T' : '-')"`;

  function ambiente(base) {
    return {
      ...process.env,
      CI: "",
      KIT_GATE_TRAVA: join(base, "gate.trava"),
      KIT_CONSERTO_TRAVA: join(base, "conserto.trava"),
      KIT_GATE_VERDE_DIR: join(base, "verde"),
      KIT_NUCLEOS_DIR: join(base, "nucleos"), // o teto da máquina de verdade nunca é tocado
      MARCA: join(base, "marca.txt"),
    };
  }

  it("roda o comando uma vez com a trava tomada, solta a trava, e o verde da mesma árvore pula a segunda", async () => {
    const raiz = repo({
      "package.json": { name: "simples", version: "1.0.0", scripts: { suite: scriptDoTeste } },
      ".claude/kit.json": { gate: { comandoCompleto: "npm run suite" } },
    });
    const base = mkdtempSync(join(tmpdir(), "kit-perfil-base-"));
    const env = ambiente(base);
    try {
      expect(await main(env, [], raiz)).toBe(0);
      expect(readFileSync(env.MARCA, "utf-8")).toBe("T"); // rodou, e com a trava na mão
      expect(existsSync(env.KIT_GATE_TRAVA)).toBe(false); // soltou
      expect(existsSync(join(base, "verde"))).toBe(true); // guardou o verde

      expect(await main(env, [], raiz)).toBe(0);
      expect(readFileSync(env.MARCA, "utf-8")).toBe("T"); // pulou: não rodou de novo

      // Árvore nova, verde novo: roda de novo.
      writeFileSync(join(raiz, "mudou.txt"), "x");
      expect(await main(env, [], raiz)).toBe(0);
      expect(readFileSync(env.MARCA, "utf-8")).toBe("TT");

      // KIT_GATE_SEM_CACHE=1 mede de novo mesmo com o verde.
      expect(await main({ ...env, KIT_GATE_SEM_CACHE: "1" }, [], raiz)).toBe(0);
      expect(readFileSync(env.MARCA, "utf-8")).toBe("TTT");
    } finally {
      rmSync(raiz, { recursive: true, force: true });
      rmSync(base, { recursive: true, force: true });
    }
  });

  it("comando vermelho devolve o código dele, não guarda verde e solta a trava", async () => {
    const raiz = repo({
      "package.json": { name: "vermelho", version: "1.0.0", scripts: { suite: 'node -e "process.exit(3)"' } },
      ".claude/kit.json": { gate: { comandoCompleto: "npm run suite" } },
    });
    const base = mkdtempSync(join(tmpdir(), "kit-perfil-base-"));
    const env = ambiente(base);
    try {
      expect(await main(env, [], raiz)).toBe(3); // o npm repassa o código do script
      expect(existsSync(env.KIT_GATE_TRAVA)).toBe(false);
      expect(existsSync(join(base, "verde"))).toBe(false);
    } finally {
      rmSync(raiz, { recursive: true, force: true });
      rmSync(base, { recursive: true, force: true });
    }
  });

  it("sem comando declarado, o gate recusa alto — não adivinha", () => {
    const raiz = repo({ "package.json": { name: "sem-comando" } });
    try {
      expect(() => comandoDaSuite({}, [], raiz)).toThrow(/gate\.comandoCompleto/);
    } finally {
      rmSync(raiz, { recursive: true, force: true });
    }
  });

  it("pacote só com comandoPorPacote declarado; sem ele, recusa alto", () => {
    const comPorPacote = carregarConfig("/x", { gate: { comandoCompleto: "node --test", pacotes: ["a", "b"], comandoPorPacote: "npm test --workspace {pacote}" } });
    expect(comandoDaSuite({}, ["b", "-t", "x"], "/x", comPorPacote)).toEqual({ cmd: "npm", args: ["test", "--workspace", "b", "-t", "x"] });
    const semPorPacote = carregarConfig("/x", { gate: { comandoCompleto: "node --test", pacotes: ["a"] } });
    expect(() => comandoDaSuite({}, ["a"], "/x", semPorPacote)).toThrow(/comandoPorPacote/);
  });
});

describe("(b) perfil pnpm-workspace reproduz a lista de pacotes do Izanagi", () => {
  const pacote = (nome, extra = {}) => ({ name: nome, version: "0.0.0", ...extra });
  const montar = () =>
    repo({
      "pnpm-workspace.yaml": 'packages:\n  - "packages/*"\n  - "apps/*"\n',
      "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
      "packages/shared/package.json": pacote("@izanagi/shared", { main: "dist/index.js", types: "dist/index.d.ts" }),
      "packages/adapters/package.json": pacote("@izanagi/adapters", { main: "./dist/index.js" }),
      "packages/runner/package.json": pacote("@izanagi/runner", { exports: { ".": { types: "./dist/index.d.ts" } } }),
      "apps/web/package.json": pacote("@izanagi/web"),
      ".claude/kit.json": { gate: { perfil: "pnpm-workspace" } },
    });

  it("`pacotes: auto` lê os quatro `@izanagi/*` do workspace e os filtros certos saem", () => {
    const raiz = montar();
    try {
      const cfg = carregarConfig(raiz);
      expect(cfg.gate.pacotes).toBe("auto");
      const achados = pacotesDoGate(raiz, cfg);
      expect(achados.map((p) => p.curto).sort()).toEqual(["adapters", "runner", "shared", "web"]);
      expect(achados.map((p) => p.filtro).sort()).toEqual(["@izanagi/adapters", "@izanagi/runner", "@izanagi/shared", "@izanagi/web"]);
      expect(pacoteDoArgv(["web"], raiz, cfg).filtro).toBe("@izanagi/web");
      expect(comandoDaSuite({}, ["runner", "x.test.ts"], raiz, cfg)).toEqual({ cmd: "pnpm", args: ["--filter", "@izanagi/runner", "test", "x.test.ts"] });
      expect(comandoDaSuite({}, [], raiz, cfg)).toEqual({ cmd: "pnpm", args: ["-r", "--workspace-concurrency=2", "test"] });
      expect(comandoDaSuite({ CI: "1" }, [], raiz, cfg)).toEqual({ cmd: "pnpm", args: ["-r", "test"] });
      expect(() => pacoteDoArgv(["nada"], raiz, cfg)).toThrow(/adapters, runner, shared, web|shared/);
      // O que o gate constrói: só quem tem porta de entrada em dist/ (web nunca entra).
      expect(pacotesConsumidosCompilados(raiz)).toEqual(["@izanagi/adapters", "@izanagi/runner", "@izanagi/shared"]);
    } finally {
      rmSync(raiz, { recursive: true, force: true });
    }
  });
});

describe("a configuração", () => {
  it("kit.json ilegível é erro alto; perfil desconhecido também; ausente vale padrão", () => {
    const raiz = repo({ "a.txt": "x" });
    try {
      expect(lerKitJson(raiz)).toEqual({});
      writeFileSync(join(raiz, ".claude-kit-teste"), "");
      mkdirSync(join(raiz, ".claude"), { recursive: true });
      writeFileSync(join(raiz, ".claude", "kit.json"), "{ meio");
      expect(() => lerKitJson(raiz)).toThrow(/ilegível/);
      expect(() => carregarConfig(raiz, { gate: { perfil: "gradle" } })).toThrow(/perfil "gradle" desconhecido/);
    } finally {
      rmSync(raiz, { recursive: true, force: true });
    }
  });

  it("KIT_* vence IZANAGI_*, e o nome antigo ainda vale quando é o único", () => {
    expect(envKit({ KIT_GATE_VAGAS: "2", IZANAGI_GATE_VAGAS: "5" }, "GATE_VAGAS")).toBe("2");
    expect(envKit({ IZANAGI_GATE_VAGAS: "5" }, "GATE_VAGAS")).toBe("5");
    expect(vagas({ IZANAGI_GATE_VAGAS: "3" })).toBe(3);
    expect(envKit({ KIT_GATE_VAGAS: "" }, "GATE_VAGAS")).toBeUndefined();
  });

  it("o teto de workers: CI sem teto, quarto da máquina, KIT_/IZANAGI_TESTE_WORKERS manda, inválido recusado", () => {
    expect(tetoDeWorkers({ CI: "1" }, 15)).toEqual({});
    expect(tetoDeWorkers({}, 15)).toEqual({ maxWorkers: 3, minWorkers: 1 });
    expect(tetoDeWorkers({}, 2)).toEqual({ maxWorkers: 1, minWorkers: 1 });
    expect(tetoDeWorkers({}, 16, 0.5)).toEqual({ maxWorkers: 8, minWorkers: 1 });
    expect(tetoDeWorkers({ KIT_TESTE_WORKERS: "5" }, 15)).toEqual({ maxWorkers: 5, minWorkers: 1 });
    expect(tetoDeWorkers({ IZANAGI_TESTE_WORKERS: "4" }, 15)).toEqual({ maxWorkers: 4, minWorkers: 1 });
    expect(() => tetoDeWorkers({ KIT_TESTE_WORKERS: "0" }, 15)).toThrow(/inteiro ≥ 1/);
    expect(() => tetoDeWorkers({ KIT_TESTE_WORKERS: "dois" }, 15)).toThrow(/inteiro ≥ 1/);
  });
});

describe("a configuração recusa o que desligaria algo calado", () => {
  const RAIZ_QUALQUER = "/nao-importa";

  it("guarda.regras: typo, string e item que não é texto são erro alto com o item nomeado", () => {
    expect(carregarConfig(RAIZ_QUALQUER, { guarda: { regras: ["destrutivos"] } }).guarda.regras).toEqual(["destrutivos"]);
    expect(() => carregarConfig(RAIZ_QUALQUER, { guarda: { regras: ["destrutivo", "merge-commit"] } })).toThrow(/"destrutivo"/);
    expect(() => carregarConfig(RAIZ_QUALQUER, { guarda: { regras: "destrutivos" } })).toThrow(/lista/);
    expect(() => carregarConfig(RAIZ_QUALQUER, { guarda: { regras: [7] } })).toThrow(/7/);
  });

  it("arvore.extras: nome obrigatório, único e fora dos campos reservados da chave", () => {
    const com = (...extras) => () => carregarConfig(RAIZ_QUALQUER, { arvore: { extras } });
    expect(com({ tipo: "arquivos-gerados", nome: "gerados" })).not.toThrow();
    expect(com({ tipo: "arquivos-gerados" })).toThrow(/nome/);
    expect(com({ tipo: "arquivos-gerados", nome: "" })).toThrow(/nome/);
    for (const reservado of ["arvore", "runtime", "env", "envNomes", "dotenv"]) {
      expect(com({ tipo: "arquivos-gerados", nome: reservado }), reservado).toThrow(/reservado/);
    }
    expect(com({ tipo: "arquivos-gerados", nome: "x" }, { tipo: "banco-postgres", nome: "x" })).toThrow(/repetido/);
  });
});

describe("gate.prazos.ilegivelSeg chega ao `main` (a ligação, não só a função)", () => {
  const GATE = join(dirname(fileURLToPath(import.meta.url)), "..", "a-vez-do-gate.mjs");

  /** Roda o gate de verdade num repo temporário com uma trava ilegível de 3 s no caminho da fila. */
  function rodar(ilegivelSeg, prazoMs) {
    const raiz = repo({ ".claude/kit.json": { gate: { comandoCompleto: "node -e 0", prazos: { ilegivelSeg } } } });
    const base = realpathSync(mkdtempSync(join(tmpdir(), "kit-ilegivel-")));
    const trava = join(base, "gate.trava");
    writeFileSync(trava, "{ meio escrito");
    const ha3s = (Date.now() - 3000) / 1000;
    utimesSync(trava, ha3s, ha3s);
    const r = spawnSync("node", [GATE], {
      cwd: raiz, encoding: "utf-8", timeout: prazoMs, killSignal: "SIGKILL",
      env: { ...process.env, CI: "", KIT_GATE_VAGAS: "1", KIT_GATE_TRAVA: trava, KIT_CONSERTO_TRAVA: join(base, "conserto.trava"), KIT_GATE_VERDE_DIR: join(base, "verde"), KIT_NUCLEOS_DIR: join(base, "nucleos") },
    });
    rmSync(raiz, { recursive: true, force: true });
    rmSync(base, { recursive: true, force: true });
    return r;
  }

  it("ilegivelSeg 1 retoma a trava ilegível de 3 s; com 120 a mesma trava segura a fila (prova que o teste mede a ligação)", () => {
    const retomou = rodar(1, 25_000);
    expect(retomou.status).toBe(0);
    expect(retomou.stderr).toMatch(/a vez é minha/);
    // Ausência provada: com o prazo longo o gate fica esperando, e é o `timeout` que o mata (status null).
    const esperando = rodar(120, 4_000);
    expect(esperando.status).toBe(null);
    expect(esperando.stderr).not.toMatch(/a vez é minha/);
  });
});
