import { after, describe, it } from "node:test";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { carregarConfig } from "../config.mjs";
import { REGRAS, avaliar, avaliarFirmes, migracoesForaDoTronco, segmentos } from "../guarda-de-operacao.mjs";
import { cada, expect } from "./expect.mjs";

/**
 * O hook que pede confirmação antes dos comandos que já custaram caro
 * (`gate/guarda-de-operacao.mjs`).
 *
 * **A árvore e o dev server são injetados, nunca lidos desta máquina.** Se o
 * teste perguntasse ao `pgrep` de verdade, o verde de "não pergunta" quereria
 * dizer "não havia `next dev` no ar aqui" — o teste mediria a máquina, não o
 * código. Por isso `raizDe` e `devNoAr` são dublês, e cada caso declara em qual
 * dos três estados do dev server (no ar / fora / não sei) ele mede. A lista de
 * migrations fora do tronco também é dublê (a função real tem o seu `describe`).
 */
const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "..", "guarda-de-operacao.mjs");
const RAIZ = "/repo";
const ctx = (devNoAr, cwd = RAIZ, fora = { fora: [] }, extra = {}) => ({
  cwd,
  raizDe: (d) => (d === RAIZ || d.startsWith(`${RAIZ}/`) ? RAIZ : null),
  devNoAr: () => devNoAr,
  migracoesForaDoTronco: () => fora,
  ...extra,
});
const pergunta = (comando, c = ctx(true)) => avaliar(comando, c).length > 0;

describe("o parser acha o comando (o vazio não atravessa)", () => {
  it("separa por operador e tira prefixo de ambiente", () => {
    expect(segmentos("FOO=1 git status && cd x; pnpm build | tail")).toEqual([
      ["git", "status"],
      ["cd", "x"],
      ["pnpm", "build"],
      ["tail"],
    ]);
  });

  it("continuação de linha não parte o comando", () => {
    expect(segmentos("git reset \\\n  --hard")).toEqual([["git", "reset", "--hard"]]);
  });

  it("operador dentro de aspas não parte o comando", () => {
    expect(segmentos('git commit -m "a && git reset --hard"')).toEqual([
      ["git", "commit", "-m", "a && git reset --hard"],
    ]);
    expect(pergunta('git commit -m "a && git reset --hard"')).toBe(false);
  });

  it("comando vazio não produz decisão nenhuma", () => {
    expect(segmentos("")).toEqual([]);
    expect(avaliar("", ctx(true))).toEqual([]);
  });
});

describe("pnpm build que toca o front", () => {
  it("pergunta na raiz com o next dev no ar, e o motivo diz o que fazer", () => {
    const buildFiltrado = "pnpm --filter @alfa/shared --filter @alfa/adapters build";
    const motivos = avaliar("pnpm build", ctx(true, RAIZ, { fora: [] }, { buildFiltrado }));
    expect(motivos).toHaveLength(1);
    expect(motivos[0]).toMatch(/--filter @alfa\/shared/);
    // Sem `guarda.buildFiltrado` o motivo ainda diz o que fazer, sem inventar comando.
    expect(avaliar("pnpm build", ctx(true))[0]).toMatch(/build filtrado dos pacotes/);
  });

  it("não pergunta com o next dev FORA do ar", () => {
    expect(pergunta("pnpm build", ctx(false))).toBe(false);
  });

  it("pergunta quando não conseguiu conferir o dev server", () => {
    const motivos = avaliar("pnpm build", ctx(null));
    expect(motivos).toHaveLength(1);
    expect(motivos[0]).toMatch(/não consegui conferir/);
  });

  cada([
    "pnpm -r build",
    "pnpm run build",
    "cd /repo && pnpm build",
    "pnpm --filter @alfa/web build",
    "pnpm --filter=@alfa/web build",
  ], "pergunta em `%s`", (comando) => {
    expect(pergunta(comando, ctx(true))).toBe(true);
  });

  it("pergunta dentro de apps/web, inclusive numa subpasta", () => {
    expect(pergunta("pnpm build", ctx(true, "/repo/apps/web"))).toBe(true);
    expect(pergunta("pnpm build", ctx(true, "/repo/apps/web/src"))).toBe(true);
  });

  // Achados da revisão do diff de 2026-09-22: seletores do pnpm que incluem o
  // front sem escrever `web`, e o cwd efetivo mudado por `-C`/`--dir`/`-w`.
  cada([
    'pnpm --filter "@alfa/*" build',
    'pnpm --filter "...@alfa/shared" build',
    'pnpm --filter "@alfa/shared..." build',
    "pnpm --filter ./apps/* build",
  ], "pergunta no seletor que alcança o front: `%s`", (comando) => {
    expect(pergunta(comando)).toBe(true);
  });

  it("segue o cwd efetivo de `-C`/`--dir` e de `-w`", () => {
    expect(pergunta("pnpm -C apps/web build")).toBe(true);
    expect(pergunta("pnpm --dir apps/web build")).toBe(true);
    expect(pergunta("pnpm -w build", ctx(true, "/repo/packages/runner"))).toBe(true);
    expect(pergunta("pnpm -C packages/runner build")).toBe(false);
  });

  it("`-r` de dentro do monorepo sem filtro pergunta; build de um pacote só, não", () => {
    expect(pergunta("pnpm -r build", ctx(true, "/repo/packages"))).toBe(true);
    expect(pergunta("pnpm build", ctx(true, "/repo/packages/runner"))).toBe(false);
  });

  it("o motivo do 'não consegui conferir' carrega a causa", () => {
    const c = { ...ctx(null), devNoAr: () => ({ noAr: null, causa: "spawn lsof ENOENT" }) };
    const motivos = avaliar("pnpm build", c);
    expect(motivos).toHaveLength(1);
    expect(motivos[0]).toMatch(/spawn lsof ENOENT/);
  });

  cada([
    "pnpm --filter @alfa/shared --filter @alfa/adapters --filter @alfa/runner build",
    "pnpm test",
    "pnpm typecheck",
  ], "não pergunta em `%s`", (comando) => {
    expect(pergunta(comando)).toBe(false);
  });

  it("fora do monorepo (repo de loja) não pergunta", () => {
    expect(pergunta("pnpm build", ctx(true, "/lojas/aramis"))).toBe(false);
  });
});

describe("regras de operação e destrutivos", () => {
  cada([
    "psql postgres://localhost -f supabase/migrations/001.sql",
    "psql --file=x.sql",
    'psql -c "DROP TABLE jobs"',
    "git merge develop",
    "git pull",
    "git pull origin develop",
    "git reset --hard HEAD~1",
    "git push --force",
    "git push -f origin x",
    "git push origin +x",
    "git stash drop stash@{0}",
    "git stash clear",
    "git clean -fd",
    "git clean -xdf",
    "git branch -D velha",
    "git checkout -- .",
    "git restore .",
    "git worktree remove --force .claude/worktrees/x",
    "git -C /repo reset --hard",
    "supabase db reset",
    "rm -rf src",
    "rm -rf $DIR",
    "sudo rm -fr /repo/docs",
    "git pull --rebase=false",
    "git pull --no-rebase",
    // continuação de linha: no bash o comando segue inteiro
    "git reset \\\n  --hard",
    "git \\\n reset --hard",
    "psql -d x \\\n -f a.sql",
    "git push origin x \\\n --force",
    // corpo de heredoc é lido como comando: `bash <<EOF` o EXECUTA
    "bash <<'EOF'\ngit reset --hard\nEOF",
  ], "pergunta em `%s`", (comando) => {
    expect(pergunta(comando)).toBe(true);
  });

  cada([
    "git merge --ff-only origin/develop",
    "git merge --abort",
    "git pull --rebase",
    "git pull --rebase=merges",
    "git pull --ff-only",
    "git push --force-with-lease",
    "git push origin claude/x",
    "git reset HEAD arquivo",
    "git stash list",
    "git clean -n",
    "git branch -d mergeada",
    "git checkout develop",
    "git restore --staged arquivo.ts",
    "git worktree remove .claude/worktrees/x",
    "supabase migration up --local",
    "psql -c 'select 1'",
    "rm -rf dist",
    "rm -rf apps/web/.next node_modules",
    "rm -rf /private/tmp/claude-501/x",
    "rm arquivo.txt",
  ], "não pergunta em `%s`", (comando) => {
    expect(pergunta(comando)).toBe(false);
  });

  it("junta os motivos de cada segmento", () => {
    expect(avaliar("git reset --hard && git clean -fd", ctx(true))).toHaveLength(2);
  });
});

describe("stash, staging amplo e kill por nome", () => {
  const casos = [
    ["git stash", "git stash push -u -m"],
    ["git stash push", "git stash push -u -m"],
    ["git stash save wip", "git stash push -u -m"],
    ["git stash -u", "git stash push -u -m"],
    ["git stash push -m wip", "git stash push -u -m"],
    ["git stash pop", "git stash apply <sha>"],
    ["git stash apply", "git stash apply <sha>"],
    ["git stash apply stash@{0}", "git stash apply <sha>"],
    ["git add -A", "git add <arquivos>"],
    ["git add .", "git add <arquivos>"],
    ["git add --all", "git add <arquivos>"],
    ["git add -u", "git add <arquivos>"],
    ["git add :/", "git add <arquivos>"],
    ["git add -Av", "git add <arquivos>"],
    ["git add -fA", "git add <arquivos>"],
    ["git add -vu", "git add <arquivos>"],
    ["git add ./", "git add <arquivos>"],
    ["git add '*'", "git add <arquivos>"],
    ["git -C x add -A", "git add <arquivos>"],
    ['git commit -am "x"', "git add <arquivos>"],
    ['git commit -a -m "x"', "git add <arquivos>"],
    ['git commit --all -m "x"', "git add <arquivos>"],
    ['pkill -f "pnpm test"', "kill <pid>"],
    ["pkill node", "kill <pid>"],
    ["killall node", "kill <pid>"],
  ];
  cada(casos, "pergunta: %s", (comando, conserto) => {
    const motivos = avaliar(comando, ctx(false));
    expect(motivos.length, `a guarda não perguntou por \`${comando}\``).toBeGreaterThan(0);
    expect(motivos.join(" ")).toContain(conserto);
  });

  cada([
    "git stash push -u -m wip-f10",
    "git stash push --include-untracked --message=wip-f10",
    "git stash -um wip",
    "git stash apply 1a2b3c4d",
    "git stash list",
    "git stash show -p",
    "git stash branch nova",
    "git add packages/a.ts docs/b.md",
    "git add -p",
    'git commit -m "x"',
    "git commit --amend --no-edit",
    "kill 12345",
    "pgrep -f next",
  ], "passa: %s", (comando) => {
    expect(avaliar(comando, ctx(false))).toEqual([]);
  });

  it("o motivo do stash lembra que ele é compartilhado", () => {
    expect(avaliar("git stash pop", ctx(false)).join(" ")).toContain("COMPARTILHADO");
  });

  const rodar = (permission_mode) =>
    spawnSync("node", [SCRIPT], {
      input: JSON.stringify({ tool_name: "Bash", tool_input: { command: "git add -A" }, cwd: "/tmp", permission_mode }),
      encoding: "utf-8",
      timeout: 15_000,
      killSignal: "SIGKILL",
    });

  it("ponta a ponta: git add -A vira ask", () => {
    const r = rodar("default");
    expect(r.stdout.length, "o hook não escreveu nada").toBeGreaterThan(0);
    expect(JSON.parse(r.stdout).hookSpecificOutput.permissionDecision).toBe("ask");
  });

  it("em bypass: só o aviso, sem decisão", () => {
    const r = rodar("bypassPermissions");
    expect(r.stdout.length, "o hook não escreveu nada").toBeGreaterThan(0);
    const saida = JSON.parse(r.stdout);
    expect(saida.hookSpecificOutput).toBeUndefined();
    expect(saida.systemMessage).toContain("git add");
  });
});

describe("o contrato do hook, de ponta a ponta", () => {
  const rodar = (evento) =>
    spawnSync("node", [SCRIPT], {
      input: typeof evento === "string" ? evento : JSON.stringify(evento),
      encoding: "utf-8",
      timeout: 15_000,
      killSignal: "SIGKILL",
    });

  it("comando que casa devolve permissionDecision ask com o motivo", () => {
    const r = rodar({ tool_name: "Bash", tool_input: { command: "git reset --hard" }, cwd: "/tmp" });
    expect(r.status).toBe(0);
    expect(r.stdout.length, "o hook não escreveu nada — o resto deste caso seria vácuo").toBeGreaterThan(0);
    const saida = JSON.parse(r.stdout);
    expect(saida.hookSpecificOutput.hookEventName).toBe("PreToolUse");
    expect(saida.hookSpecificOutput.permissionDecision).toBe("ask");
    expect(saida.hookSpecificOutput.permissionDecisionReason).toMatch(/reset --hard/);
  });

  it("comando inofensivo não escreve nada e sai 0", () => {
    const r = rodar({ tool_name: "Bash", tool_input: { command: "git status" }, cwd: "/tmp" });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe("");
  });

  it("evento ilegível nunca trava o trabalho", () => {
    const r = rodar("isto não é json");
    expect(r.status).toBe(0);
    expect(r.stdout).toBe("");
    expect(r.stderr).toMatch(/evento ilegível/);
  });
});

describe("worktree em pasta temporária sai sem pergunta", () => {
  // A limpeza de worktree de VERIFICAÇÃO — criado em /tmp para conferir uma
  // branch e jogado fora — pedia confirmação a cada vez, inclusive em bypass.
  // A exceção é a mesma pasta temporária que o `rm -rf` já aceita; o worktree
  // de trabalho, em `.claude/worktrees/`, continua perguntando.
  cada([
    "git worktree remove --force /tmp/verificacao-389",
    "git worktree remove -f /private/tmp/claude-501/x/wt",
    "git worktree remove --force /private/var/folders/ab/T/wt",
    "cd /private/tmp && git worktree remove --force verificacao",
    "git -C /repo worktree remove --force /tmp/x",
  ], "não pergunta em `%s`", (comando) => {
    expect(pergunta(comando)).toBe(false);
  });

  cada([
    "git worktree remove --force .claude/worktrees/x",
    "git worktree remove --force /repo/.claude/worktrees/y",
    "git worktree remove -f $WT",
    "git worktree remove --force",
    // A exceção é a PASTA TEMPORÁRIA, não o nome descartável do `rm -rf`.
    "git worktree remove --force dist",
  ], "continua perguntando em `%s`", (comando) => {
    expect(pergunta(comando)).toBe(true);
  });
});

describe("em bypass a guarda avisa e não pergunta", () => {
  // Decisão do operador: quem escolhe "ignorar permissões" deixa a sessão rodar
  // sozinha por horas, e uma pergunta ali é a sessão PARADA esperando ninguém.
  // Em bypass o motivo vira aviso no transcript (`systemMessage`) e o comando
  // segue; fora dele, a pergunta continua.
  const rodar = (permission_mode) =>
    spawnSync("node", [SCRIPT], {
      input: JSON.stringify({ tool_name: "Bash", tool_input: { command: "git reset --hard" }, cwd: "/tmp", permission_mode }),
      encoding: "utf-8",
      timeout: 15_000,
      killSignal: "SIGKILL",
    });

  it("bypassPermissions: sem decisão de permissão, com o motivo como aviso", () => {
    const r = rodar("bypassPermissions");
    expect(r.status).toBe(0);
    expect(r.stdout.length, "o hook não escreveu nada — nem aviso").toBeGreaterThan(0);
    const saida = JSON.parse(r.stdout);
    expect(saida.hookSpecificOutput, "em bypass a guarda não pode decidir permissão").toBeUndefined();
    expect(saida.systemMessage).toMatch(/reset --hard/);
  });

  cada(["default", "acceptEdits", "plan", "auto"], "%s: continua perguntando", (modo) => {
    const saida = JSON.parse(rodar(modo).stdout);
    expect(saida.hookSpecificOutput?.permissionDecision).toBe("ask");
  });

  it("evento sem permission_mode (Claude Code antigo): continua perguntando", () => {
    const r = spawnSync("node", [SCRIPT], {
      input: JSON.stringify({ tool_name: "Bash", tool_input: { command: "git reset --hard" }, cwd: "/tmp" }),
      encoding: "utf-8",
      timeout: 15_000,
      killSignal: "SIGKILL",
    });
    expect(JSON.parse(r.stdout).hookSpecificOutput?.permissionDecision).toBe("ask");
  });
});

describe("migration de fora da main no banco local", () => {
  // Dublê ESPIÃO: conta as chamadas e guarda a raiz, para provar que o ramo MEDIU
  // (e que os comandos que não são do banco local nem chegaram a medir).
  const espiao = (fora, cwd = RAIZ) => {
    const chamadas = [];
    const c = {
      ...ctx(false, cwd),
      migracoesForaDoTronco: (raiz) => {
        chamadas.push(raiz);
        return fora;
      },
    };
    return { c, chamadas };
  };
  const FORA = { fora: ["20261022130000_x.sql"] };

  it("pergunta com a migration de fora, e o motivo diz qual, contra o quê e por quê", () => {
    const { c, chamadas } = espiao(FORA);
    const motivos = avaliar("supabase migration up --local", c);
    expect(motivos).toHaveLength(1);
    expect(motivos[0]).toMatch(/20261022130000_x\.sql/);
    expect(motivos[0]).toMatch(/origin\/main/);
    expect(motivos[0]).toMatch(/um só para todos os worktrees/);
    expect(chamadas).toEqual(["/repo"]);
  });

  it("não pergunta com a lista vazia — e o ramo mediu (o espião foi chamado)", () => {
    const { c, chamadas } = espiao({ fora: [] });
    expect(avaliar("supabase migration up --local", c)).toEqual([]);
    expect(chamadas).toHaveLength(1);
  });

  it("git que falha pergunta, com a causa e o conserto", () => {
    const { c } = espiao({ fora: null, causa: "fatal: Not a valid object name origin/main" });
    const motivos = avaliar("supabase migration up --local", c);
    expect(motivos).toHaveLength(1);
    expect(motivos[0]).toMatch(/Not a valid object name/);
    expect(motivos[0]).toMatch(/git fetch origin main/);
  });

  cada([
    "supabase migration up",
    "cd /repo && supabase migration up --local",
    "supabase --workdir /repo migration up",
    "supabase db push --local",
  ], "pergunta em `%s`", (comando) => {
    const { c, chamadas } = espiao(FORA);
    expect(avaliar(comando, c)).toHaveLength(1);
    expect(chamadas).toHaveLength(1);
  });

  it("`db reset` pergunta sempre, e lista as de fora porque as reaplica", () => {
    const { c, chamadas } = espiao(FORA);
    const motivos = avaliar("supabase --workdir /repo db reset", c);
    expect(motivos).toHaveLength(1);
    expect(motivos[0]).toMatch(/apaga o banco local inteiro/);
    expect(motivos[0]).toMatch(/20261022130000_x\.sql/);
    expect(chamadas).toEqual(["/repo"]);
  });

  it("`db reset --linked` continua perguntando, sem medir a lista do banco local", () => {
    const { c, chamadas } = espiao(FORA);
    const motivos = avaliar("supabase db reset --linked", c);
    expect(motivos).toHaveLength(1);
    expect(motivos[0]).not.toMatch(/20261022130000/);
    expect(chamadas).toEqual([]);
  });

  cada([
    ["supabase migration up --linked", RAIZ],
    ["supabase db push", RAIZ],
    ["supabase migration list --local", RAIZ],
    ["supabase migration up --local", "/lojas/aramis"],
  ], "não pergunta e nem mede em `%s` (cwd %s)", (comando, cwd) => {
    const { c, chamadas } = espiao(FORA, cwd);
    expect(avaliar(comando, c)).toEqual([]);
    expect(chamadas).toEqual([]);
  });
});

describe("a lista real de migrations lê o disco e a origin/main", () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "guarda-mig-")));
  after(() => rmSync(dir, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", "-c", "commit.gpgsign=false", ...args], {
      cwd: dir,
      timeout: 10_000,
      killSignal: "SIGKILL",
      stdio: "pipe",
      encoding: "utf-8",
    });
  const mig = (nome) => writeFileSync(join(dir, "supabase/migrations", nome), "select 1;\n");

  it("compara o disco (commitado ou não) com a origin/main, só `.sql`", () => {
    git("init", "-q");
    mkdirSync(join(dir, "supabase/migrations"), { recursive: true });
    mig("a.sql");
    mig("b.sql");
    git("add", "supabase");
    git("commit", "-q", "-m", "base");
    git("update-ref", "refs/remotes/origin/main", "HEAD");
    mig("d.sql");
    git("add", "supabase");
    git("commit", "-q", "-m", "so na branch");
    mig("c.sql");
    writeFileSync(join(dir, "supabase/migrations/notas.txt"), "x");

    // Precondição: sem a origin/main a medida seria `null`, não a lista.
    expect(git("rev-parse", "origin/main").trim()).toMatch(/^[0-9a-f]{40}$/);
    expect(migracoesForaDoTronco(dir)).toEqual({ fora: ["c.sql", "d.sql"] });
  });

  it("nome com acento na main não sai como fora", () => {
    git("checkout", "-q", "--detach", "origin/main");
    mig("ação 1.sql");
    git("add", "supabase/migrations/ação 1.sql");
    git("commit", "-q", "-m", "acento");
    git("update-ref", "refs/remotes/origin/main", "HEAD");
    expect(migracoesForaDoTronco(dir).fora).not.toContain("ação 1.sql");
  });

  it("sem origin/main o resultado é `null`, com a causa", () => {
    git("update-ref", "-d", "refs/remotes/origin/main");
    const r = migracoesForaDoTronco(dir);
    expect(r.fora).toBeNull();
    // A causa é a do GIT, não só o prefixo fixo que a função escreve.
    expect(r.causa).toMatch(/^git ls-tree origin\/main: fatal: /);
  });

  it("pasta sem supabase/migrations não tem o que conferir", () => {
    const vazio = mkdtempSync(join(tmpdir(), "guarda-mig-vazio-"));
    try {
      expect(migracoesForaDoTronco(vazio)).toEqual({ fora: [] });
    } finally {
      rmSync(vazio, { recursive: true, force: true });
    }
  });
});

describe("(c) regra desligada não pergunta", () => {
  const SO = (...regras) => ctx(true, RAIZ, { fora: ["x.sql"] }, { regras: new Set(regras) });
  // Um comando por regra que PERGUNTA: com SÓ a regra dele ligada pergunta; com as outras, não. A `teste-fora-do-teto` recusa
  // (`avaliarFirmes`) e tem o seu `describe` abaixo.
  const UM_POR_REGRA = {
    "build-com-dev-no-ar": "pnpm build",
    "psql-f": "psql -f a.sql",
    "migration-fora-do-tronco": "supabase migration up --local",
    "merge-commit": "git merge develop",
    "stash-sem-u": "git stash pop",
    "staging-amplo": "git add -A",
    "kill-por-nome": "pkill node",
    destrutivos: "git reset --hard",
  };

  const QUE_PERGUNTAM = REGRAS.filter((r) => r !== "teste-fora-do-teto");

  it("cada uma das oito regras que perguntam tem o seu comando de prova", () => {
    expect(Object.keys(UM_POR_REGRA).sort()).toEqual([...QUE_PERGUNTAM].sort());
    expect(QUE_PERGUNTAM).toHaveLength(8);
  });

  for (const regra of QUE_PERGUNTAM) {
    it(`${regra}: ligada pergunta; desligada (as outras ligadas) não`, () => {
      const comando = UM_POR_REGRA[regra];
      expect(avaliar(comando, SO(regra)).length, `ligada: \`${comando}\``).toBeGreaterThan(0);
      const outras = REGRAS.filter((r) => r !== regra);
      expect(avaliar(comando, SO(...outras)), `desligada: \`${comando}\``).toEqual([]);
    });
  }

  it("`destrutivos` desligada também solta o SQL de drop e o `rm -rf`, mas não o `psql -f`", () => {
    const sem = SO(...REGRAS.filter((r) => r !== "destrutivos"));
    expect(avaliar('psql -c "DROP TABLE x"', sem)).toEqual([]);
    expect(avaliar("rm -rf src", sem)).toEqual([]);
    expect(avaliar("psql -f a.sql", sem)).toHaveLength(1);
  });

  it("`guarda.regras` do kit.json de verdade: ponta a ponta, com a regra desligada o hook não escreve nada", () => {
    const raiz = realpathSync(mkdtempSync(join(tmpdir(), "guarda-kit-")));
    try {
      execFileSync("git", ["init", "-q"], { cwd: raiz, timeout: 10_000, killSignal: "SIGKILL" });
      mkdirSync(join(raiz, ".claude"));
      writeFileSync(join(raiz, ".claude", "kit.json"), JSON.stringify({ guarda: { regras: ["destrutivos"] } }));
      const rodar = (command) =>
        spawnSync("node", [SCRIPT], {
          input: JSON.stringify({ tool_name: "Bash", tool_input: { command }, cwd: raiz }),
          encoding: "utf-8",
          timeout: 15_000,
          killSignal: "SIGKILL",
        });
      const ligada = rodar("git reset --hard");
      expect(JSON.parse(ligada.stdout).hookSpecificOutput.permissionDecision).toBe("ask");
      const desligada = rodar("git add -A");
      expect(desligada.status).toBe(0);
      expect(desligada.stdout).toBe(""); // staging-amplo está fora de `regras`: não pergunta

      // kit.json ilegível não trava o trabalho: cai nas regras padrão e diz no stderr.
      writeFileSync(join(raiz, ".claude", "kit.json"), "{ meio");
      const quebrado = rodar("git add -A");
      expect(quebrado.status).toBe(0);
      expect(quebrado.stderr).toMatch(/ilegível/);
      expect(JSON.parse(quebrado.stdout).hookSpecificOutput.permissionDecision).toBe("ask");
    } finally {
      rmSync(raiz, { recursive: true, force: true });
    }
  });

  it("o tronco e o front vêm da configuração: `guarda.tronco` na mensagem, `guarda.frontend` no seletor", () => {
    const tronco = ctx(false, RAIZ, { fora: ["x.sql"] }, { tronco: "origin/main" });
    const motivo = avaliar("supabase migration up --local", tronco)[0];
    expect(motivo).toMatch(/origin\/main/);
    expect(motivo).toMatch(/git fetch origin main/);
    expect(motivo).not.toMatch(/develop/);
    const outroFront = { frontend: "apps/site", raizDe: (d) => (d.startsWith("/repo") ? "/repo" : null) };
    expect(pergunta("pnpm --filter @x/site build", ctx(true, RAIZ, { fora: [] }, outroFront))).toBe(true);
    expect(pergunta("pnpm --filter @x/web build", ctx(true, RAIZ, { fora: [] }, outroFront))).toBe(false);
  });
});

describe("o kit.json de um repositório real chega até a decisão do hook", () => {
  const dirs = [];
  after(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));
  const git = (cwd, ...args) =>
    execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", "-c", "commit.gpgsign=false", ...args], {
      cwd,
      timeout: 10_000,
      killSignal: "SIGKILL",
      stdio: "pipe",
      encoding: "utf-8",
    });
  /** Repo npm simples (sem `pnpm-workspace.yaml`, sem front) com `a.sql` no tronco e `b.sql` só no disco. */
  const repoNpm = ({ kit, tronco = "origin/main" }) => {
    const raiz = realpathSync(mkdtempSync(join(tmpdir(), "guarda-real-")));
    dirs.push(raiz);
    git(raiz, "init", "-q");
    mkdirSync(join(raiz, "supabase/migrations"), { recursive: true });
    mkdirSync(join(raiz, ".claude"));
    writeFileSync(join(raiz, "package.json"), "{}");
    writeFileSync(join(raiz, "supabase/migrations/a.sql"), "select 1;\n");
    git(raiz, "add", "-A");
    git(raiz, "commit", "-q", "-m", "base");
    git(raiz, "update-ref", `refs/remotes/${tronco}`, "HEAD");
    writeFileSync(join(raiz, "supabase/migrations/b.sql"), "select 2;\n");
    if (kit) writeFileSync(join(raiz, ".claude", "kit.json"), JSON.stringify(kit));
    return raiz;
  };
  const rodar = (raiz, command) =>
    spawnSync("node", [SCRIPT], {
      input: JSON.stringify({ tool_name: "Bash", tool_input: { command }, cwd: raiz }),
      encoding: "utf-8",
      timeout: 15_000,
      killSignal: "SIGKILL",
    });
  const decisao = (r) => (r.stdout ? JSON.parse(r.stdout).hookSpecificOutput : null);

  it("(A2) migration fora do tronco pergunta também num repo npm, sem workspace nem front", () => {
    const raiz = repoNpm({});
    expect(existsSync(join(raiz, "pnpm-workspace.yaml"))).toBe(false); // precondição: o repo não tem a forma do Alfa
    const r = rodar(raiz, "supabase migration up --local");
    expect(decisao(r)?.permissionDecision).toBe("ask");
    expect(decisao(r).permissionDecisionReason).toMatch(/b\.sql/);
  });

  it("(A2) fora de um repositório git, não conferir é perguntar", () => {
    const solto = realpathSync(mkdtempSync(join(tmpdir(), "guarda-sem-git-")));
    dirs.push(solto);
    mkdirSync(join(solto, "supabase/migrations"), { recursive: true });
    writeFileSync(join(solto, "supabase/migrations/x.sql"), "select 1;\n");
    const r = rodar(solto, "supabase migration up --local");
    expect(decisao(r)?.permissionDecision).toBe("ask");
    expect(decisao(r).permissionDecisionReason).toMatch(/Não consegui conferir/);
  });

  it("(A5) `guarda.tronco` declarado é o que entra no ls-tree e na mensagem", () => {
    const raiz = repoNpm({ kit: { guarda: { tronco: "origin/main" } }, tronco: "origin/main" });
    expect(() => git(raiz, "rev-parse", "origin/develop")).toThrow(); // precondição: a develop não existe, só o tronco declarado
    const motivo = decisao(rodar(raiz, "supabase migration up --local"))?.permissionDecisionReason;
    expect(motivo).toMatch(/origin\/main/);
    expect(motivo).toMatch(/b\.sql/);
    expect(motivo).not.toMatch(/develop/);
  });

  it("(A5) `guarda.descartaveis` declarado vale no lugar do padrão", () => {
    const raiz = repoNpm({ kit: { guarda: { descartaveis: ["saida-gerada"] } } });
    const padrao = repoNpm({});
    // Caminho absoluto fora de /tmp: o repo de teste mora em pasta temporária, onde tudo é descartável.
    expect(decisao(rodar(padrao, "rm -rf /opt/x/dist"))).toBeNull(); // precondição: `dist` é descartável no padrão
    expect(decisao(rodar(raiz, "rm -rf /opt/x/saida-gerada"))).toBeNull();
    expect(decisao(rodar(raiz, "rm -rf /opt/x/dist"))?.permissionDecision).toBe("ask");
  });

  it("(A1) `guarda.regras` com typo ou string cai no padrão, avisa e continua perguntando", () => {
    for (const regras of [["destrutivo"], "destrutivos"]) {
      const raiz = repoNpm({ kit: { guarda: { regras } } });
      const r = rodar(raiz, "git reset --hard");
      expect(r.stderr, JSON.stringify(regras)).toMatch(/guarda\.regras/);
      expect(decisao(r)?.permissionDecision, JSON.stringify(regras)).toBe("ask");
    }
  });
});

describe("a regra `teste-fora-do-teto` (ADR 0005, operador, 26/10)", () => {
  // Diferente das outras regras, esta RECUSA (`deny`), também em bypass: o teste solto é o que trava a máquina.
  const firmes = (comando, c = ctx(false)) => avaliarFirmes(comando, c);

  it("está em REGRAS e ligada por padrão no kit.json", () => {
    expect(REGRAS).toContain("teste-fora-do-teto");
    expect(carregarConfig("/", {}).guarda.regras).toContain("teste-fora-do-teto");
  });

  cada(
    [
      "vitest run x",
      "npx vitest run x",
      "pnpm vitest",
      "pnpm exec vitest run",
      "pnpm --filter web exec vitest run",
      "npm exec vitest",
      "npm exec -- vitest run",
      "pnpm dlx vitest",
      "yarn vitest",
      "./node_modules/.bin/vitest run",
      "node --test",
      "node --test gate/test/x.test.mjs",
      "node --test --test-concurrency=2 gate",
      "node --experimental-test-coverage --test x",
      "node --import tsx --test x.ts",
      "node --import=tsx --test x.ts",
      "node -r ts-node/register --test x",
      "node --require ts-node/register --test x",
      "node --loader ts-node/esm --test x",
      "node --experimental-loader=ts-node/esm --test x",
      "jest",
      "npx jest --ci",
      "cd gate && node --test x.test.mjs",
      "git status && npx vitest run x | tail",
      "sudo vitest",
    ],
    "recusa %s",
    (comando) => {
      const motivos = firmes(comando);
      expect(motivos, comando).toHaveLength(1);
      expect(motivos[0]).toMatch(/Teste fora do teto da máquina \(ADR 0005\)/);
      expect(motivos[0]).toMatch(/node scripts\/kit\/com-fichas\.mjs -- <o comando>/);
      expect(motivos[0]).toMatch(/npm test \[pacote\]/);
    },
  );

  cada(
    [
      "npm test",
      "npm test -- gate",
      "pnpm test",
      "pnpm --filter web test",
      "node scripts/kit/a-vez-do-gate.mjs web",
      "node scripts/kit/com-fichas.mjs -- npx vitest run x",
      "node gate/com-fichas.mjs --quero 2 -- node --test x",
      "KIT_FICHAS_TOMADAS=2 npx vitest run x",
      "env KIT_FICHAS_TOMADAS=3 node --test x",
      "grep vitest arquivo",
      'cat package.json | grep "node --test"',
      'echo "node --test"',
      "node script.mjs --test",
      "node --import tsx script.mjs --test",
      "node -e \"console.log('vitest')\"",
      "git commit -m 'npx vitest run'",
      "ls vitest.config.ts",
    ],
    "deixa passar %s",
    (comando) => {
      expect(firmes(comando), comando).toEqual([]);
    },
  );

  it("o teste mede: o detector enxerga o comando solto (prova antes da ausência) e a regra desligada não recusa", () => {
    expect(firmes("npx vitest run")).toHaveLength(1);
    expect(firmes("npx vitest run", ctx(false, RAIZ, { fora: [] }, { regras: new Set(["destrutivos"]) }))).toEqual([]);
    expect(firmes("npx vitest run", ctx(false, RAIZ, { fora: [] }, { regras: new Set(["teste-fora-do-teto"]) }))).toHaveLength(1);
  });

  it("no CI não recusa", () => {
    expect(firmes("npx vitest run", ctx(false, RAIZ, { fora: [] }, { ci: true }))).toEqual([]);
  });

  it("não aparece entre as perguntas (`avaliar`): é recusa, não pergunta", () => {
    expect(avaliar("npx vitest run", ctx(false))).toEqual([]);
  });

  describe("ponta a ponta", () => {
    const rodar = (command, permission_mode, env = {}) =>
      spawnSync("node", [SCRIPT], {
        input: JSON.stringify({ tool_name: "Bash", tool_input: { command }, cwd: "/tmp", permission_mode }),
        encoding: "utf-8",
        timeout: 15_000,
        killSignal: "SIGKILL",
        env: { PATH: process.env.PATH, HOME: process.env.HOME, ...env },
      });

    cada(["default", "acceptEdits", "plan", "bypassPermissions"], "%s: deny", (modo) => {
      const r = rodar("npx vitest run x", modo);
      expect(r.status).toBe(0);
      expect(r.stdout.length, "o hook não escreveu nada — o resto deste caso seria vácuo").toBeGreaterThan(0);
      const saida = JSON.parse(r.stdout);
      expect(saida.hookSpecificOutput.hookEventName).toBe("PreToolUse");
      expect(saida.hookSpecificOutput.permissionDecision).toBe("deny");
      expect(saida.hookSpecificOutput.permissionDecisionReason).toMatch(/com-fichas/);
    });

    it("`npm test` em bypass não sai nada; e o mesmo comando recusado antes sai deny (a prova de que a saída vazia é de verdade)", () => {
      expect(JSON.parse(rodar("node --test x", "bypassPermissions").stdout).hookSpecificOutput.permissionDecision).toBe("deny");
      const r = rodar("npm test", "bypassPermissions");
      expect(r.status).toBe(0);
      expect(r.stdout).toBe("");
    });

    it("no CI (env CI=1 do hook) não recusa", () => {
      const r = rodar("npx vitest run x", "default", { CI: "1" });
      expect(r.status).toBe(0);
      expect(r.stdout).toBe("");
    });

    it("a recusa vem junto com as perguntas que o mesmo comando também dispara", () => {
      const saida = JSON.parse(rodar("git reset --hard && npx vitest run x", "default").stdout);
      expect(saida.hookSpecificOutput.permissionDecision).toBe("deny");
      expect(saida.hookSpecificOutput.permissionDecisionReason).toMatch(/Teste fora do teto/);
      expect(saida.hookSpecificOutput.permissionDecisionReason).toMatch(/reset --hard/);
    });
  });
});
