import { describe, it } from "node:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { carregarConfig } from "../config.mjs";
import { conferirInstalacao, constroi } from "../o-dist-que-o-gate-le.mjs";
import { expect } from "./expect.mjs";

/**
 * **M2 (laudo V1 sobre a K6)**: o gate `pnpm-workspace` não exige o formato do
 * Alfa. Sem `node_modules/.pnpm/lock.yaml` mas com `node_modules` segue;
 * sem pacote com `main` em `dist` pula o build com aviso. O perfil que exige
 * (`gate.exigeDist: true`) continua recusando nos dois casos.
 */
function workspace({ registro = false, dist = false, kit = {} } = {}) {
  const raiz = realpathSync(mkdtempSync(join(tmpdir(), "kit-m2-")));
  execFileSync("git", ["init", "-q"], { cwd: raiz, timeout: 10_000, killSignal: "SIGKILL" });
  const w = (c, t) => {
    mkdirSync(join(raiz, c, ".."), { recursive: true });
    writeFileSync(join(raiz, c), t);
  };
  w("pnpm-workspace.yaml", 'packages:\n  - "packages/*"\n');
  w("pnpm-lock.yaml", "lockfileVersion: '9.0'\n");
  w("packages/a/package.json", JSON.stringify({ name: "a", version: "0.0.0", ...(dist ? { main: "dist/index.js" } : { main: "src/index.js" }) }));
  w("node_modules/.keep", "");
  if (registro) w("node_modules/.pnpm/lock.yaml", "lockfileVersion: '9.0'\n");
  w(".claude/kit.json", JSON.stringify({ gate: { perfil: "pnpm-workspace", ...kit } }));
  return raiz;
}
const mudo = () => {
  const linhas = [];
  return { avisar: (m) => linhas.push(m), linhas };
};

describe("M2 — o gate pnpm-workspace sem o formato do Alfa", () => {
  it("sem node_modules/.pnpm/lock.yaml, com node_modules: a conferência segue", () => {
    const raiz = workspace();
    try {
      const m = mudo();
      expect(conferirInstalacao(raiz, {}, m.avisar)).toBe(0);
      expect(m.linhas).toEqual([]);
    } finally {
      rmSync(raiz, { recursive: true, force: true });
    }
  });

  it("exigeDist: true devolve a exigência (prova que o caso anterior mede algo)", () => {
    const raiz = workspace({ kit: { exigeDist: true } });
    try {
      expect(carregarConfig(raiz).gate.exigeDist).toBe(true);
      const m = mudo();
      expect(conferirInstalacao(raiz, {}, m.avisar)).toBe(1);
      expect(m.linhas.join("\n")).toMatch(/node_modules\/\.pnpm\/lock\.yaml/);
    } finally {
      rmSync(raiz, { recursive: true, force: true });
    }
  });

  it("nenhum pacote com main em dist: pula o build com uma linha de aviso (exit 0)", () => {
    const raiz = workspace({ registro: true });
    try {
      const antes = console.error;
      const linhas = [];
      console.error = (m) => linhas.push(String(m));
      let codigo;
      try {
        codigo = constroi(raiz, {});
      } finally {
        console.error = antes;
      }
      expect(codigo).toBe(0);
      expect(linhas.length).toBe(1);
      expect(linhas[0]).toMatch(/pulando o build/);
    } finally {
      rmSync(raiz, { recursive: true, force: true });
    }
  });

  it("com exigeDist: true, nenhum pacote em dist continua recusando", () => {
    const raiz = workspace({ registro: true, kit: { exigeDist: true } });
    try {
      const antes = console.error;
      console.error = () => {};
      let codigo;
      try {
        codigo = constroi(raiz, {});
      } finally {
        console.error = antes;
      }
      expect(codigo).toBe(1);
    } finally {
      rmSync(raiz, { recursive: true, force: true });
    }
  });
});

describe("baixo — repositório sem commit", () => {
  it("o registro do verde diz 'repositório sem commit', não '(ilegível: …)'", async () => {
    const { registroDe } = await import("../o-verde-da-arvore.mjs");
    const raiz = realpathSync(mkdtempSync(join(tmpdir(), "kit-semcommit-")));
    try {
      execFileSync("git", ["init", "-q"], { cwd: raiz, timeout: 10_000, killSignal: "SIGKILL" });
      const r = registroDe("test", { arvore: "abc" }, 1, raiz);
      expect(r.head).toBe("repositório sem commit");
      // prova que o caso mede algo: fora de qualquer repositório o texto é outro
      const fora = realpathSync(mkdtempSync(join(tmpdir(), "kit-forarepo-")));
      try {
        expect(registroDe("test", { arvore: "abc" }, 1, fora).head).toMatch(/ilegível/);
      } finally {
        rmSync(fora, { recursive: true, force: true });
      }
    } finally {
      rmSync(raiz, { recursive: true, force: true });
    }
  });
});
