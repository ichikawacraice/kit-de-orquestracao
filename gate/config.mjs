/**
 * **A configuração do gate: `.claude/kit.json` do projeto, com padrões.**
 *
 * Tudo o que no Izanagi era fixo (lista de pacotes, comandos, nomes de trava,
 * prazos, variáveis de ambiente da chave) vem daqui. Sem `kit.json` o gate
 * roda o `gate.comandoCompleto` que o projeto declarar — e recusa alto se não
 * houver nenhum, em vez de adivinhar o comando.
 *
 * Perfis: `comando` (um comando único, o padrão) e `pnpm-workspace` (pacotes
 * lidos do `pnpm-workspace.yaml`, `pnpm -r test`, build dos pacotes consumidos
 * compilados, instalação conferida contra o `pnpm-lock.yaml`).
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const PADRAO = {
  gate: {
    perfil: "comando",
    comandoCompleto: null,
    comandoPorPacote: null,
    pacotes: [],
    filtroDePacote: "{pacote}",
    typecheck: null,
    trava: "kit-gate.trava",
    travaConserto: "kit-conserto.trava",
    verdeDir: "kit-gate-verde",
    pacotesJuntos: 2,
    workersConserto: 2,
    prazos: { vezMin: 60, verdeHoras: 24, retencaoDias: 7, typecheckMin: 15, buildMin: 10, ilegivelSeg: 30 },
  },
  arvore: {
    prefixosEnv: ["KIT_"],
    avulsas: ["CI", "TZ", "NODE_OPTIONS"],
    foraDaChave: ["GATE_SEM_CACHE", "GATE_TRAVA", "GATE_VERDE_DIR"],
    extras: [],
  },
  guarda: {
    regras: ["build-com-dev-no-ar", "psql-f", "migration-fora-do-tronco", "merge-commit", "stash-sem-u", "staging-amplo", "kill-por-nome", "destrutivos"],
    tronco: "origin/develop",
    frontend: "apps/web",
    migrations: "supabase/migrations",
    buildFiltrado: null,
    descartaveis: ["dist", ".next", "node_modules", "coverage", ".turbo", ".vitest"],
  },
};

const PERFIL_PNPM = {
  gate: {
    perfil: "pnpm-workspace",
    pacotes: "auto",
    filtroDePacote: "{escopo}/{pacote}",
    typecheck: "pnpm -r typecheck",
    // true: exige o formato do Izanagi (registro da instalação em `node_modules/.pnpm/lock.yaml` e ao menos um pacote com `main` em `dist`).
    exigeDist: false,
  },
};

const objeto = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** Mescla em profundidade; array e escalar do `b` substituem o do `a`. */
export function mesclar(a, b) {
  if (!objeto(a) || !objeto(b)) return b === undefined ? a : b;
  const saida = { ...a };
  for (const [k, v] of Object.entries(b)) saida[k] = k in a ? mesclar(a[k], v) : v;
  return saida;
}

/** A raiz do projeto: o toplevel do git, senão o `cwd`. */
export function raizDoProjeto(cwd = process.cwd()) {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 10_000,
      killSignal: "SIGKILL",
    }).trim();
  } catch {
    return cwd;
  }
}

/** Lê `<raiz>/.claude/kit.json`. JSON inválido é erro alto; arquivo ausente, `{}`. */
export function lerKitJson(raiz) {
  const caminho = join(raiz, ".claude", "kit.json");
  if (!existsSync(caminho)) return {};
  try {
    const lido = JSON.parse(readFileSync(caminho, "utf-8").replace(/^\uFEFF/, ""));
    if (!objeto(lido)) throw new Error("o conteúdo não é um objeto");
    return lido;
  } catch (e) {
    throw new Error(`${caminho} ilegível: ${e.message}`);
  }
}

/** A configuração efetiva (gate, árvore e guarda) para a raiz: padrão ← perfil ← kit.json. */
export function carregarConfig(raiz, kit = lerKitJson(raiz)) {
  const perfil = kit?.gate?.perfil ?? PADRAO.gate.perfil;
  if (perfil !== "comando" && perfil !== "pnpm-workspace") {
    throw new Error(`gate.perfil "${perfil}" desconhecido — use "comando" ou "pnpm-workspace"`);
  }
  validarGuarda(kit.guarda);
  validarExtras(kit.arvore?.extras);
  const base = perfil === "pnpm-workspace" ? mesclar(PADRAO, PERFIL_PNPM) : PADRAO;
  return mesclar(base, { gate: kit.gate ?? {}, arvore: kit.arvore ?? {}, guarda: kit.guarda ?? {} });
}

/**
 * Aviso (não recusa) do `kit doutor`: o `comandoCompleto` parece chamar o `test` do projeto, que é o próprio gate.
 * A defesa de verdade é o gate detectar o laço pelo comportamento (`KIT_GATE_DENTRO`); o texto só avisa cedo e pode errar.
 */
const CHAMA_O_TEST = /(^|[\s;&|(])(npm|pnpm|yarn)\s+(run\s+)?test(?![\w:-])/;
export function avisoDeLaco(comando) {
  if (typeof comando === "string" && CHAMA_O_TEST.test(comando)) {
    return `gate.comandoCompleto ${JSON.stringify(comando)} parece chamar o \`test\` do projeto, que é o próprio gate (laço) — o gate recusa se for; aponte para o script da suíte, ex.: "npm run test:suite"`;
  }
  return null;
}

/** `guarda.regras`: lista de regras conhecidas. Um typo desligaria a regra calado, e uma string viraria um conjunto de letras. */
function validarGuarda(guarda) {
  if (guarda?.regras === undefined) return;
  if (!Array.isArray(guarda.regras)) throw new Error(`guarda.regras precisa ser uma lista, e veio ${JSON.stringify(guarda.regras)}`);
  for (const regra of guarda.regras) {
    if (!PADRAO.guarda.regras.includes(regra)) {
      throw new Error(`guarda.regras: ${JSON.stringify(regra)} não é uma regra — as conhecidas são ${PADRAO.guarda.regras.join(", ")}`);
    }
  }
}

/** Campos da chave que um extra não pode sobrescrever. */
const CAMPOS_RESERVADOS = ["arvore", "runtime", "env", "envNomes", "dotenv"];

/** `arvore.extras`: `nome` obrigatório, único e fora dos campos reservados da chave. */
function validarExtras(extras) {
  if (extras === undefined) return;
  if (!Array.isArray(extras)) throw new Error(`arvore.extras precisa ser uma lista, e veio ${JSON.stringify(extras)}`);
  const vistos = new Set();
  for (const extra of extras) {
    const nome = extra?.nome;
    if (typeof nome !== "string" || nome === "") throw new Error(`arvore.extras: falta o "nome" em ${JSON.stringify(extra)}`);
    if (CAMPOS_RESERVADOS.includes(nome)) throw new Error(`arvore.extras: o nome "${nome}" é reservado da chave (${CAMPOS_RESERVADOS.join(", ")})`);
    if (vistos.has(nome)) throw new Error(`arvore.extras: o nome "${nome}" está repetido`);
    vistos.add(nome);
  }
}

/** `KIT_<sufixo>`, e o legado `IZANAGI_<sufixo>` como reserva. */
export function envKit(env, sufixo) {
  for (const prefixo of ["KIT_", "IZANAGI_"]) {
    const v = env[prefixo + sufixo];
    if (v !== undefined && v !== "") return v;
  }
  return undefined;
}

/** Inteiro ≥ 1 vindo do env (ou o padrão); inválido é erro alto com o nome da variável. */
export function inteiroDoEnv(env, sufixo, padrao) {
  const pedido = envKit(env, sufixo);
  if (pedido === undefined) return padrao;
  const n = Number(pedido);
  if (!Number.isInteger(n) || n < 1) throw new Error(`KIT_${sufixo} precisa ser inteiro ≥ 1, e veio ${JSON.stringify(pedido)}`);
  return n;
}

/** Parte um comando em `[cmd, ...args]` por espaço — sem aspas, sem shell. */
export function partirComando(texto) {
  const partes = String(texto).trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) throw new Error("comando vazio no kit.json");
  return partes;
}
