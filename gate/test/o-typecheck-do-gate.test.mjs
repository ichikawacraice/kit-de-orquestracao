import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * **O typecheck do gate espera as fichas do teto da máquina** (ADR 0005, operador, 26/10).
 *
 * Roda o script de verdade num repositório temporário, com `KIT_NUCLEOS_DIR` temporário: o teto de verdade nunca é tocado.
 * O typecheck espera dormindo (síncrono), então o teste o roda como processo filho e segura a ficha com outro.
 */
const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "..", "o-typecheck-do-gate.mjs");

let raiz;
let base;
let pasta;

const git = (args) => execFileSync("git", args, { cwd: raiz, encoding: "utf-8", timeout: 10_000, killSignal: "SIGKILL" });

beforeEach(() => {
  raiz = realpathSync(mkdtempSync(join(tmpdir(), "kit-tc-")));
  base = realpathSync(mkdtempSync(join(tmpdir(), "kit-tc-base-")));
  pasta = join(base, "nucleos");
  mkdirSync(pasta);
  assert.deepEqual(readdirSync(pasta), []);
  git(["init", "-q"]);
  git(["config", "user.email", "t@kit.local"]);
  git(["config", "user.name", "t"]);
  // O "typecheck" anota a hora em que começou e quantas fichas havia na pasta (a dele incluída).
  writeFileSync(
    join(raiz, "tc.mjs"),
    `import { appendFileSync, readdirSync } from "node:fs";
     const n = readdirSync(process.env.KIT_NUCLEOS_DIR).filter((x) => /^[0-9]+$/.test(x)).length;
     appendFileSync(process.env.MARCA, JSON.stringify({ quando: Date.now(), naPasta: n, env: process.env.KIT_FICHAS_TOMADAS }) + "\\n");`,
  );
  mkdirSync(join(raiz, ".claude"));
  writeFileSync(join(raiz, ".claude", "kit.json"), JSON.stringify({ gate: { comandoCompleto: "node -e 0", typecheck: "node tc.mjs", nucleosTypecheck: 2 } }));
  git(["add", "-A"]);
  git(["commit", "-qm", "base"]);
});

afterEach(() => {
  rmSync(raiz, { recursive: true, force: true });
  rmSync(base, { recursive: true, force: true });
});

const envDe = (extra = {}) => ({
  PATH: process.env.PATH,
  HOME: base,
  KIT_NUCLEOS_DIR: pasta,
  KIT_GATE_VERDE_DIR: join(base, "verde"),
  KIT_GATE_TRAVA: join(base, "g.trava"),
  MARCA: join(base, "marca.jsonl"),
  ...extra,
});

/** Roda o typecheck do gate; devolve `{ status, stderr }` quando ele sai. Prazo próprio: o `setTimeout` mata o filho se pendurar. */
const rodar = (env) =>
  new Promise((resolve) => {
    const f = spawn(process.execPath, [SCRIPT], { cwd: raiz, env, stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    f.stderr.on("data", (d) => (stderr += d));
    const prazo = setTimeout(() => f.kill("SIGKILL"), 40_000);
    f.on("close", (status) => {
      clearTimeout(prazo);
      resolve({ status, stderr });
    });
  });

const vistos = () => readFileSync(join(base, "marca.jsonl"), "utf-8").trim().split("\n").map((l) => JSON.parse(l));

describe("o typecheck do gate e o teto da máquina", () => {
  it("toma nucleosTypecheck fichas, roda, e solta (a pasta fica vazia)", async () => {
    const r = await rodar(envDe({ KIT_NUCLEOS_DE_TESTE: "7" }));
    assert.equal(r.status, 0, r.stderr);
    const [v] = vistos();
    assert.equal(v.naPasta, 2);
    assert.equal(v.env, "2");
    assert.deepEqual(readdirSync(pasta), []);
  });

  it("com KIT_FICHAS_TOMADAS no env, não toma", async () => {
    const r = await rodar(envDe({ KIT_NUCLEOS_DE_TESTE: "7", KIT_FICHAS_TOMADAS: "3" }));
    assert.equal(r.status, 0, r.stderr);
    assert.equal(vistos()[0].naPasta, 0);
  });

  it("typecheck vermelho também solta as fichas", async () => {
    writeFileSync(join(raiz, "tc.mjs"), "process.exitCode = 5;");
    git(["add", "-A"]);
    git(["commit", "-qm", "vermelho"]);
    const r = await rodar(envDe({ KIT_NUCLEOS_DE_TESTE: "7" }));
    assert.equal(r.status, 5);
    assert.deepEqual(readdirSync(pasta), []);
  });

  it("com o teto cheio por ficha de outro PID vivo, o typecheck só começa depois que a ficha é solta", async () => {
    // Um dono vivo por ~1,5 s: a ficha é dele, e o PID dele morre ao sair (aí a ficha volta ao teto).
    const dono = spawn(process.execPath, ["-e", "setTimeout(() => {}, 1500)"], { stdio: "ignore" });
    const saiu = new Promise((resolve) => dono.on("close", () => resolve(Date.now())));
    writeFileSync(join(pasta, "1"), JSON.stringify({ pid: dono.pid, token: "dono", worktree: "/wt/outro", projeto: "outro", desde: new Date().toISOString() }));
    assert.ok(existsSync(join(pasta, "1")));
    const inicio = Date.now();
    const r = await rodar(envDe({ KIT_NUCLEOS_DE_TESTE: "1" }));
    const fimDoDono = await saiu;
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /\/wt\/outro/, "diz por quem espera");
    const [v] = vistos();
    assert.ok(v.quando >= fimDoDono - 50, `o typecheck começou ${fimDoDono - v.quando} ms antes de o dono sair (${inicio})`);
    assert.equal(v.naPasta, 1, "levou a única ficha do teto");
  });

  it("no CI não toma ficha", async () => {
    const r = await rodar(envDe({ CI: "1" }));
    assert.equal(r.status, 0, r.stderr);
    assert.equal(vistos()[0].naPasta, 0);
  });
});
