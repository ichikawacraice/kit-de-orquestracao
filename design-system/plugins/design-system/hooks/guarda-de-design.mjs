#!/usr/bin/env node
/**
 * **A demanda de design passa pelo designer e pelo crítico — e quem esquece é cobrado ao abrir o PR.**
 *
 * Hook do plugin `design-system`, registrado em `hooks/hooks.json`. É a trava do processo da base
 * (`base/CONVENCOES.md`, CONV-19 e CONV-20). O `hook_event_name` do JSON no stdin decide o que roda; o papel vem do
 * `agent_type` do payload (agent de plugin não carrega `hooks` no frontmatter), ou de `--papel` quando a linha de
 * comando o passa.
 *
 *   - `UserPromptSubmit` — se o pedido fala de design, injeta o lembrete de chamar o `designer`. Não roda o git.
 *   - `PostToolUse` (`Agent|Task`) — quando o subagente `critico-de-ui` é
 *     chamado, guarda a foto DAQUELE momento: a crítica vale para o trabalho que
 *     ela viu, neste turno e nos seguintes. A skill `critica-de-ui` no mesmo contexto NÃO conta: quem desenhou
 *     já acredita no desenho.
 *   - `PreToolUse` (`Bash` com `gh pr create`) — a crítica é exigida no fim do item (F420): se o trabalho
 *     visual da branch não é vazio e não há crítica da foto atual, **nega a abertura do PR uma vez por foto**.
 *     A segunda tentativa com a mesma foto passa: lembrete com peso, não prisão (`cobradoFoto`). O `Stop` da
 *     sessão não cobra mais: cobrar a cada turno que mexe no visual era turno extra sem correção.
 *   - `PreToolUse` do `designer` — especifica e não implementa: `Edit`/`Write`
 *     em código de tela (`negadoAoDesigner`) é negado com o motivo.
 *   - `SubagentStop` do `critico-de-ui` — a crítica tem forma: no máximo cinco
 *     problemas, cada um com `Onde` e `Correção`. Fora disso, devolve uma vez.
 *
 * **Configuração: `design/design-system.json` do projeto** (`config.mjs`; o `.claude/kit.json`, seção `design`, vale como
 * compatibilidade). `visual` (globs do que é visual; prefixo `!` exclui; sem ele, o padrão sai de `pasta`: telas por
 * extensão), `negadoAoDesigner` (globs; padrão = `visual` sem as exclusões) e `tronco` (de onde a branch sai; padrão
 * `origin/main`). Sem `visual` nem `pasta` o hook sai 0 sem decisão: projeto sem front não é cobrado.
 *
 * **A foto é o CONTEÚDO do trabalho próprio, não um diff contra um HEAD.** O diff
 * dos arquivos visuais entre o `merge-base` e a árvore de trabalho, reduzido às
 * linhas que entram e saem (sem `index`, `@@` nem contexto), mais o conteúdo dos
 * arquivos visuais não rastreados. Rebase, pull, merge do tronco e commitar o que
 * já estava sujo não mudam a foto; edição de subagente, commit no meio do turno
 * e `--amend` mudam. Foto vazia ao abrir o PR (tudo descartado) não cobra.
 *
 * **Onde mora o estado.** No diretório comum do git (um só para todos os
 * worktrees), pasta `design-system`. `DESIGN_SYSTEM_ESTADO` aponta outro lugar — é o ponto de injeção do teste.
 *
 * **Erro nunca prende o turno.** Evento ilegível, git que falha, estado que não
 * se lê: sai 0 sem decisão e a mensagem vai para o stderr.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { booleanoDaOpcao, cedeAoAntigo, configDoProjeto, opcao, pluginLigado } from "./config.mjs";

export const AGENTE_CRITICO = "critico-de-ui";
export const PAPEL_DESIGNER = "designer";

/** As extensões que o padrão derivado de `design.pasta` conta como tela. */
const EXTENSOES_DE_TELA = ["tsx", "jsx", "vue", "svelte", "css", "scss", "html"];

/** As opções do plugin (`userConfig` do plugin.json); o teste confere que as duas listas concordam. */
export const OPCOES_DO_PLUGIN = ["guarda", "cobrar_critica", "pasta_do_front", "largura"];

/** Exclusões do padrão derivado de `design.pasta`: teste não é tela. */
const TESTES_FORA = ["*.test.*", "*.spec.*", "__tests__/**"];

const BASES_PADRAO = ["origin/main"];

/** Muda quando a forma do estado muda: o estado de outra versão não vale como crítica. */
const VERSAO_DO_ESTADO = 2;

/** O comando que abre o PR: é nele que a crítica do item é exigida. */
const ABRE_PR = /(?:^|[;&|(\s])gh\s+(?:(?:-R|--repo)(?:\s+|=)\S+\s+)?pr\s+create\b/;

/**
 * As fotos já criticadas valem para o repositório: a sessão que limpa o contexto volta com outro
 * id, e a crítica feita antes da limpeza continua julgando a mesma foto. Guardadas num estado
 * à parte, com teto, ao lado do estado de cada sessão.
 */
const FOTOS_CRITICADAS = "_fotos-criticadas";
const TETO_DE_FOTOS = 50;

/** A crítica foi chamada, mas a foto daquele momento falhou: conta como crítica (erro nunca prende). */
const CRITICA_SEM_FOTO = "sem-foto";

/** Pedido que fala de design. Largo de propósito: o custo de um lembrete a mais é uma linha. */
const PEDIDO_DE_DESIGN =
  /\b(design|ui|ux|layout|visual|tela|telas|interface|componente|componentes|anima[çc][ãa]o|transi[çc][ãa]o|hierarquia|densidade|painel|bot[ãa]o|cores?|tipografia|espa[çc]amento|redesenh\w*|desenh\w*)\b/i;

/** Prazo de CADA chamada ao git; o leitor é memoizado e cada evento faz poucas. */
const PRAZO_DO_GIT_MS = 1_500;

/**
 * O lembrete do pedido de design. A base do plugin só é a fonte padrão no projeto que entrou no sistema (tem o arquivo
 * de configuração, num dos dois nomes); fora dele, o processo vale com as fontes do próprio projeto.
 */
export const textoDoLembrete = (temArquivo) =>
  "Demanda de design no front: antes de desenhar, o agente `designer` faz a revisão de arquitetura " +
  "(skill `revisao-de-arquitetura-de-ui`: tarefa, inventário, hierarquia, onde mora cada mensagem, componentes do kit); " +
  "depois de mexer no visual, o `critico-de-ui` julga em contexto separado (no máximo 5 problemas). " +
  "Só o texto da tela (botão, erro, confirmação, vazio): skill `textos-de-interface`. Acessibilidade (contraste, teclado, leitor de tela): skill `acessibilidade`. " +
  (temArquivo
    ? "Fontes: as de `fontes` do arquivo do projeto (`design/design-system.json`, ou `design/wicomm.json` no projeto que só tem esse; leia e grave nele); sem elas, a base do plugin (DESIGN, ANATOMIA, CONVENCOES)."
    : "Fontes: as do próprio projeto (o `CLAUDE.md`, os documentos de design dele, o código de hoje). Este projeto não tem `design/design-system.json`: a base do plugin não é a norma dele até ele entrar no sistema (`/design-system:novo` ou `/design-system:auditar`).");

function git(cwd, args) {
  return execFileSync("git", ["-C", cwd, ...args], {
    encoding: "utf-8",
    timeout: PRAZO_DO_GIT_MS,
    killSignal: "SIGKILL",
    stdio: ["ignore", "pipe", "pipe"],
    // Idioma fixo: a guarda lê a mensagem de erro do git ("not a git repository"), que o locale traduz.
    env: { ...process.env, LC_ALL: "C" },
    maxBuffer: 64 * 1024 * 1024,
  });
}

/** `nome` ou `plugin:nome` → `nome`. */
export function nomeCurto(nome) {
  return typeof nome === "string" ? nome.split(":").pop() : nome;
}

const lista = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.length > 0) : []);

/**
 * A configuração da guarda, lida de `design/design-system.json` (e, por compatibilidade, do `.claude/kit.json`) e das opções do
 * plugin: o arquivo do projeto com a chave vence a opção; plugin desligado em `enabledPlugins` não roda. `null` quando
 * a guarda fica inerte: plugin desligado, `guarda` desligada, ou sem `visual` nem pasta do front (`pasta`, senão a
 * opção `pasta_do_front`). JSON ilegível é erro. `ambiente`: `{ home, env }`, trocáveis nos testes.
 */
export function lerConfig(raiz, ambiente = {}) {
  const amb = { home: ambiente.home ?? homedir(), env: ambiente.env ?? process.env };
  if (pluginLigado(raiz, amb.home, amb.env) === false) return null;
  if (cedeAoAntigo(raiz, amb.home, amb.env)) return null;
  const projeto = configDoProjeto(raiz);
  const guarda = typeof projeto.guarda === "boolean" ? projeto.guarda : booleanoDaOpcao(opcao("guarda", amb));
  if (!guarda) return null;
  let visual = lista(projeto.visual);
  if (visual.length === 0) {
    // Sem `visual`, o padrão sai da pasta do front: as telas por extensão, sem os testes.
    const doProjeto = typeof projeto.pasta === "string" ? projeto.pasta : "";
    const daOpcao = typeof opcao("pasta_do_front", amb) === "string" ? opcao("pasta_do_front", amb) : "";
    const pasta = (doProjeto || daOpcao).replace(/^(?:\.\/)+(?=.)/, "").replace(/\/+$/, "") || ".";
    if (!doProjeto && !daOpcao) return null;
    visual = pasta === "."
      ? [...EXTENSOES_DE_TELA.map((e) => `**/*.${e}`), ...TESTES_FORA.map((g) => `!**/${g}`)]
      : [...EXTENSOES_DE_TELA.map((e) => `${pasta}/**/*.${e}`), ...TESTES_FORA.map((g) => `!${pasta}/**/${g}`)];
  }
  const negado = lista(projeto.negadoAoDesigner);
  const tronco = typeof projeto.tronco === "string" && projeto.tronco ? projeto.tronco : null;
  return {
    visual,
    negadoAoDesigner: negado.length > 0 ? negado : visual.filter((g) => !g.startsWith("!")),
    bases: tronco ? [tronco, ...BASES_PADRAO.filter((b) => b !== tronco)] : BASES_PADRAO,
    cobrarCritica: typeof projeto.cobrarCritica === "boolean" ? projeto.cobrarCritica : booleanoDaOpcao(opcao("cobrar_critica", amb)),
    // O lembrete só põe a base do plugin como fonte padrão no projeto que tem o arquivo de configuração.
    temArquivo: projeto.temArquivo,
  };
}

/** Globs da configuração → pathspecs do git (`!glob` exclui). */
export function pathspecs(globs) {
  return globs.map((g) => (g.startsWith("!") ? `:(exclude,glob)${g.slice(1)}` : `:(glob)${g}`));
}

/** Glob (`**`, `*`, `?`) → RegExp sobre caminho com `/`. */
export function globParaRegex(glob) {
  let r = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        i++;
        if (glob[i + 1] === "/") {
          i++;
          r += "(?:.*/)?";
        } else r += ".*";
      } else r += "[^/]*";
    } else if (c === "?") r += "[^/]";
    else r += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${r}$`);
}

/**
 * Código de tela: o que o designer não escreve. Doc, revisão e rascunho passam.
 * Casa em qualquer ponto do caminho (sufixo depois de `/`), para pegar também o
 * caminho absoluto de OUTRO worktree.
 */
export function eCodigoDeTela(caminho, globs) {
  if (typeof caminho !== "string" || caminho.length === 0) return false;
  const norm = caminho.split("\\").join("/");
  const partes = norm.split("/");
  const incluidos = globs.filter((g) => !g.startsWith("!")).map(globParaRegex);
  const excluidos = globs.filter((g) => g.startsWith("!")).map((g) => globParaRegex(g.slice(1)));
  for (let i = 0; i < partes.length; i++) {
    const sufixo = partes.slice(i).join("/");
    if (incluidos.some((r) => r.test(sufixo)) && !excluidos.some((r) => r.test(sufixo))) return true;
  }
  return false;
}

/** Só o que o trabalho é: o arquivo e as linhas que entram e saem. */
export function normalizarDiff(diff) {
  return diff
    .split("\n")
    .filter((linha) => /^(diff --git |\+|-)/.test(linha) && !/^(\+\+\+|---) /.test(linha))
    .join("\n");
}

/** O ponto em que o trabalho próprio começa: o `merge-base` com a primeira base que existir, ou o HEAD. */
function pontoDePartida(raiz, bases, ler) {
  for (const base of bases) {
    try {
      return ler(raiz, ["merge-base", "HEAD", base]).trim();
    } catch (e) {
      // O git que estourou o prazo não diz nada sobre a base: trocar de régua calado
      // faria o começo e o fim do turno medirem coisas diferentes.
      if (e?.code === "ETIMEDOUT" || e?.signal) throw e;
    }
  }
  return "HEAD";
}

/**
 * A foto do trabalho visual: o hash do diff normalizado dos arquivos visuais, do
 * ponto de partida da branch até a árvore de trabalho, mais o conteúdo dos não
 * rastreados. `vazia` diz que não há trabalho visual nenhum.
 */
export function fotoDoVisual(cwd, config, ler = git) {
  const raiz = ler(cwd, ["rev-parse", "--show-toplevel"]).trim();
  const partida = pontoDePartida(raiz, config.bases, ler);
  const spec = pathspecs(config.visual);
  const trabalho = normalizarDiff(ler(raiz, ["diff", "--no-color", "--no-ext-diff", "-U0", partida, "--", ...spec]));
  const hash = createHash("sha256");
  hash.update(trabalho);
  const novos = ler(raiz, ["ls-files", "--others", "--exclude-standard", "--", ...spec])
    .split("\n")
    .filter(Boolean)
    .sort();
  for (const arquivo of novos) {
    hash.update(`\0${arquivo}\0`);
    try {
      hash.update(readFileSync(join(raiz, arquivo)));
    } catch {
      hash.update("<ilegível>");
    }
  }
  return { hash: hash.digest("hex"), vazia: trabalho.length === 0 && novos.length === 0 };
}

function pastaDoEstado(cwd, ler) {
  if (process.env.DESIGN_SYSTEM_ESTADO) return process.env.DESIGN_SYSTEM_ESTADO;
  try {
    const comum = ler(cwd, ["rev-parse", "--path-format=absolute", "--git-common-dir"]).trim();
    return join(comum, "design-system");
  } catch (e) {
    if (e?.code === "ETIMEDOUT" || e?.signal) throw e;
    return join(tmpdir(), "design-system");
  }
}

function arquivoDoEstado(cwd, sessao, ler) {
  return join(pastaDoEstado(cwd, ler), `${String(sessao).replace(/[^\w.-]/g, "_")}.json`);
}

/** Um leitor do git que não repete a mesma chamada dentro de uma execução do hook. */
export function gitMemoizado(ler = git) {
  const visto = new Map();
  return (cwd, args) => {
    const chave = JSON.stringify([cwd, args]);
    if (!visto.has(chave)) visto.set(chave, ler(cwd, args));
    return visto.get(chave);
  };
}

/** O `ctx` de `decidir` sobre um leitor do git; `main` passa o memoizado. */
export function criarContexto(ler) {
  return {
    cwd: process.cwd(),
    raiz: (cwd) => ler(cwd, ["rev-parse", "--show-toplevel"]).trim(),
    config: (cwd) => {
      let raiz;
      try {
        raiz = ler(cwd, ["rev-parse", "--show-toplevel"]).trim();
      } catch (e) {
        // Fora de repositório não há projeto a guardar: calado. Outro erro (prazo, git ausente) segue para o stderr.
        if (/not a git repository/i.test(String(e?.stderr ?? e?.message ?? ""))) return null;
        throw e;
      }
      return lerConfig(raiz);
    },
    foto: (cwd, config) => fotoDoVisual(cwd, config, ler),
    ler: (cwd, sessao) => {
      const arquivo = arquivoDoEstado(cwd, sessao, ler);
      return existsSync(arquivo) ? JSON.parse(readFileSync(arquivo, "utf-8")) : null;
    },
    gravar: (cwd, sessao, estado) => {
      mkdirSync(pastaDoEstado(cwd, ler), { recursive: true });
      writeFileSync(arquivoDoEstado(cwd, sessao, ler), JSON.stringify(estado));
    },
    avisar: (texto) => console.error(`[guarda-de-design] ${texto}`),
  };
}

/** O crítico foi chamado? Só o subagente `critico-de-ui`, em primeiro ou segundo plano. */
export function eCritica(evento) {
  if (evento?.tool_name !== "Agent" && evento?.tool_name !== "Task") return false;
  return nomeCurto(evento?.tool_input?.subagent_type) === AGENTE_CRITICO;
}

/** Conta os problemas de uma crítica e confere que cada um tem `Onde` e `Correção`. */
export function formaDaCritica(texto) {
  const corpo = String(texto ?? "");
  const blocos = corpo.split(/^###\s+P\d+\b/m).slice(1);
  const faltando = blocos
    .map((b, i) => ({ n: i + 1, onde: /\*\*Onde:?\*\*/.test(b), correcao: /\*\*Corre[çc][ãa]o:?\*\*/.test(b) }))
    .filter((b) => !b.onde || !b.correcao)
    .map((b) => `P${b.n}`);
  return { problemas: blocos.length, faltando };
}

/**
 * A decisão de cada evento, sem efeito colateral fora do `ctx`. Devolve o objeto
 * que vai ao stdout, ou `null` para "siga". `papelArg` é o `--papel` da linha de
 * comando; sem ele vale o `agent_type` do payload.
 */
/** O estado desta versão da guarda, ou o inicial: o de outra versão não vale como crítica. */
function estadoValido(estado) {
  return estado?.versao === VERSAO_DO_ESTADO ? estado : { versao: VERSAO_DO_ESTADO, criticada: null, cobradoFoto: null };
}

export function decidir(evento, papelArg, ctx) {
  const nome = evento?.hook_event_name;
  const sessao = evento?.session_id;
  const cwd = evento?.cwd || ctx.cwd;
  const papel = nomeCurto(papelArg ?? evento?.agent_type) ?? null;

  const config = ctx.config(cwd);
  if (!config) return null;

  if (papel === PAPEL_DESIGNER && nome === "PreToolUse") {
    const caminho = evento?.tool_input?.file_path ?? evento?.tool_input?.notebook_path;
    if (!eCodigoDeTela(caminho, config.negadoAoDesigner)) return null;
    return {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason:
          "O designer especifica e não implementa: a revisão vai para a pasta de revisões de design (ou o rascunho), " +
          "e quem escreve o código de tela é a sessão que pediu a revisão, a partir da revisão aprovada pelo crítico.",
      },
    };
  }

  if (papel === AGENTE_CRITICO && (nome === "SubagentStop" || nome === "Stop")) {
    if (evento?.stop_hook_active) return null;
    const { problemas, faltando } = formaDaCritica(evento?.last_assistant_message);
    const defeitos = [];
    if (problemas === 0) defeitos.push("nenhum problema no formato `### P1 · <eixo> · <título>` (se não há problema, diga com um P1 que explique por que a tela passa)");
    if (problemas > 5) defeitos.push(`${problemas} problemas — o teto é 5; fique com os de maior impacto e diga quantos ficaram de fora`);
    if (faltando.length > 0) defeitos.push(`${faltando.join(", ")} sem **Onde:** ou sem **Correção:**`);
    if (defeitos.length === 0) return null;
    return { decision: "block", reason: `A crítica não tem a forma combinada: ${defeitos.join("; ")}.` };
  }

  // O PR aberto por um subagente também é o fim do item: a cobrança vem antes do corte dos subagentes.
  if (nome === "PreToolUse") {
    if (config.cobrarCritica === false || evento?.tool_name !== "Bash" || !sessao) return null;
    if (!ABRE_PR.test(String(evento?.tool_input?.command ?? ""))) return null;
    const estado = estadoValido(ctx.ler(cwd, sessao));
    if (estado.criticada === CRITICA_SEM_FOTO) {
      // A crítica cuja foto falhou livra este PR, e só ele: o visual mudado depois volta a ser cobrado.
      ctx.gravar(cwd, sessao, { ...estado, criticada: null });
      return null;
    }
    const agora = ctx.foto(cwd, config);
    if (agora.vazia || agora.hash === estado.criticada || agora.hash === estado.cobradoFoto) return null;
    const fotos = ctx.ler(cwd, FOTOS_CRITICADAS)?.fotos ?? [];
    if (fotos.includes(agora.hash)) return null;
    ctx.gravar(cwd, sessao, { ...estado, cobradoFoto: agora.hash });
    const oQue = estado.criticada
      ? "O visual do front mudou depois da crítica: ela julgou o trabalho de antes."
      : "O visual do front mudou nesta branch e o crítico não rodou.";
    return {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason:
          `${oQue} Antes de abrir o PR, chame o subagente ` +
          "`critico-de-ui` sobre o que mudou (ou diga em uma linha por que esta mudança não pede crítica — " +
          "ex.: só renomeou um identificador — e tente de novo: a segunda tentativa com o mesmo visual passa).",
      },
    };
  }

  // Os eventos da sessão do turno: quem tem `agent_id` é subagente. O `agent_type` sozinho
  // também aparece na sessão aberta com `--agent`, que é sessão e é cobrada.
  if (!sessao || evento?.agent_id) return null;

  if (nome === "UserPromptSubmit") {
    const lembrete = PEDIDO_DE_DESIGN.test(String(evento?.prompt ?? ""))
      ? { hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: textoDoLembrete(config.temArquivo === true) } }
      : null;
    return lembrete;
  }

  if (nome === "PostToolUse") {
    if (config.cobrarCritica === false || !eCritica(evento)) return null;
    const estado = estadoValido(ctx.ler(cwd, sessao));
    let criticada = CRITICA_SEM_FOTO;
    try {
      criticada = ctx.foto(cwd, config).hash;
    } catch (e) {
      ctx.avisar?.(`foto da crítica: ${e?.message ?? e}`);
    }
    ctx.gravar(cwd, sessao, { ...estado, criticada });
    if (criticada !== CRITICA_SEM_FOTO) {
      const fotos = (ctx.ler(cwd, FOTOS_CRITICADAS)?.fotos ?? []).filter((f) => f !== criticada);
      ctx.gravar(cwd, FOTOS_CRITICADAS, { versao: VERSAO_DO_ESTADO, fotos: [...fotos, criticada].slice(-TETO_DE_FOTOS) });
    }
    return null;
  }

  return null;
}

export function main(entrada, argv = process.argv.slice(2)) {
  let evento;
  try {
    evento = JSON.parse(entrada);
  } catch (e) {
    console.error(`[guarda-de-design] evento ilegível: ${e.message}`);
    return 0;
  }
  const i = argv.indexOf("--papel");
  const papel = i >= 0 ? argv[i + 1] : null;
  const ctx = criarContexto(gitMemoizado());
  let decisao;
  try {
    decisao = decidir(evento, papel, ctx);
  } catch (e) {
    console.error(`[guarda-de-design] ${e?.message ?? e}`);
    return 0;
  }
  if (decisao) process.stdout.write(JSON.stringify(decisao));
  return 0;
}

const real = (c) => {
  try {
    return realpathSync(c);
  } catch {
    return null;
  }
};
if (process.argv[1] && real(process.argv[1]) === real(fileURLToPath(import.meta.url))) {
  process.exitCode = main(readFileSync(0, "utf-8"));
} else if (process.argv[1] && basename(process.argv[1]) === basename(fileURLToPath(import.meta.url))) {
  console.error("[guarda-de-design] caminho do processo não reconhecido");
  process.exitCode = 1;
}
