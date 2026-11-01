#!/usr/bin/env node
/**
 * **Pede confirmação antes dos comandos que já custaram caro.**
 *
 * Hook `PreToolUse` do Claude Code, só para a ferramenta Bash. Ele NÃO bloqueia:
 * devolve `permissionDecision: "ask"` e o operador decide na hora — FORA do modo
 * bypass. Em bypass ("ignorar permissões") só avisa (`systemMessage`) e o comando
 * segue: quem escolhe esse modo deixa a sessão rodando sozinha por horas, e uma
 * pergunta ali é a sessão PARADA esperando ninguém. As regras de operação do
 * CLAUDE.md dependiam de quem está no teclado lembrar delas — esta é a trava
 * mecânica que faltava.
 *
 * **Regras ligáveis** (`guarda.regras` do `.claude/kit.json`; padrão: todas):
 *
 *   - `build-com-dev-no-ar`: `pnpm build` que toca o front (`guarda.frontend`,
 *     padrão `apps/web`: na raiz sem filtro, dentro dele, com `-r` sem filtro, ou
 *     com seletor que pode incluí-lo — glob, `...`, nome com o do front;
 *     `-C`/`--dir`/`-w` mudam onde roda) COM o `next dev` desta árvore no ar —
 *     sobrescreve o `.next` do dev server;
 *   - `psql-f`: `psql -f` — migration aplicada assim não entra em `schema_migrations`;
 *   - `migration-fora-do-tronco`: `supabase migration up` (sem `--linked`),
 *     `supabase db push --local` e `supabase db reset` quando o worktree tem
 *     arquivo em `guarda.migrations` (padrão `supabase/migrations`) que não está
 *     no `guarda.tronco` (padrão `${tronco}`) — o banco local é um só para
 *     todos os worktrees;
 *   - `merge-commit`: `git merge` sem `--ff-only` e `git pull` sem
 *     `--rebase`/`--ff-only` — o tronco é rebase sobre a base (o merge que o
 *     `sync_with_base_branch` do app faz roda no host, fora do Bash, e não passa aqui);
 *   - `stash-sem-u`: `git stash` sem `-u` e `-m`, `stash pop`, `stash apply` sem
 *     sha, `stash drop|clear` — o stash é COMPARTILHADO entre worktrees;
 *   - `staging-amplo`: `git add -A|--all|-u|.|:/|*` e `git commit -a` — varrem
 *     arquivo que outra sessão deixou na pasta;
 *   - `kill-por-nome`: `pkill` e `killall` — alcançam processo de outra sessão;
 *   - `teste-fora-do-teto` (ADR 0005): `vitest`, `node --test` e `jest` chamados direto fora do CI, sem `com-fichas` nem
 *     `KIT_FICHAS_TOMADAS=` na frente. Esta é a única regra que **recusa** (`deny`), também em bypass: o teste solto é o que
 *     trava a máquina, e a recusa diz o comando certo (`com-fichas` ou o gate);
 *   - `destrutivos`: `git reset --hard`, `git push --force` (sem lease),
 *     `git clean -f`, `git branch -D`, `git checkout/restore .`,
 *     `git worktree remove --force` (fora de pasta temporária), `rm -rf` fora de
 *     pasta descartável e SQL de `drop`/`truncate`.
 *
 * É lombada, não sandbox: o parser entende `&&`, `||`, `;`, `|`, aspas,
 * continuação de linha (`\` + quebra) e `cd <dir>`, mas não expande variável nem
 * entra em `bash -c "…"`. O corpo de heredoc é lido como comandos — pode
 * perguntar à toa num `cat > x <<EOF`, mas não deixa passar um `bash <<EOF`, que o
 * EXECUTA. Na dúvida ele PERGUNTA — o custo de um falso positivo é um clique; o de
 * um falso negativo já foi medido.
 *
 * Contrato do hook: lê o JSON do evento no stdin; se algo casar, escreve no
 * stdout o JSON de decisão; senão, não escreve nada e sai 0. Evento ilegível ou
 * `kit.json` ilegível nunca travam o trabalho: sai 0 sem decisão (o `kit.json`
 * ilegível cai nas regras padrão), e a mensagem vai para o stderr. Os únicos
 * "não sei" que PERGUNTAM são o do dev server (`pgrep`/`lsof` que falham) e o da
 * lista de migrations (`git ls-tree` que falha), e o motivo carrega a causa.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, isAbsolute, resolve } from "node:path";
import { carregarConfig, raizDoProjeto } from "./config.mjs";
import { rodarSePrincipal } from "./o-script-principal.mjs";

/** Todas as regras que `guarda.regras` pode ligar. */
export const REGRAS = [
  "build-com-dev-no-ar",
  "psql-f",
  "migration-fora-do-tronco",
  "merge-commit",
  "stash-sem-u",
  "staging-amplo",
  "kill-por-nome",
  "destrutivos",
  "teste-fora-do-teto",
];

/** A regra de cada subcomando do `git` (o que não está aqui é `destrutivos`). */
const REGRA_DO_SUBCOMANDO = { merge: "merge-commit", pull: "merge-commit", stash: "stash-sem-u", add: "staging-amplo", commit: "staging-amplo" };

/** A regra está ligada? Sem `ctx.regras` (um contexto de teste simples), todas. */
const ativa = (ctx, regra) => !ctx.regras || ctx.regras.has(regra);
const FRONT_PADRAO = "apps/web";
const TRONCO_PADRAO = "origin/main";
const MIGRATIONS_PADRAO = "supabase/migrations";

const OPERADORES = new Set(["&&", "||", ";", "|", "&", "\n"]);

/** Quebra a linha de comando em tokens, respeitando aspas; operadores viram tokens próprios. */
export function tokenizar(comando) {
  const tokens = [];
  let atual = "";
  let temAtual = false;
  let aspas = null;
  for (let i = 0; i < comando.length; i++) {
    const c = comando[i];
    // `\` + quebra de linha é continuação: no bash o comando segue inteiro.
    if (c === "\\" && comando[i + 1] === "\n" && aspas !== "'") {
      i++;
      continue;
    }
    if (aspas) {
      if (c === aspas) aspas = null;
      else if (c === "\\" && aspas === '"' && i + 1 < comando.length) atual += comando[++i];
      else atual += c;
      continue;
    }
    if (c === "'" || c === '"') {
      aspas = c;
      temAtual = true;
      continue;
    }
    if (c === "\\" && i + 1 < comando.length) {
      atual += comando[++i];
      temAtual = true;
      continue;
    }
    const dois = comando.slice(i, i + 2);
    if (dois === "&&" || dois === "||") {
      if (temAtual) tokens.push(atual);
      tokens.push(dois);
      atual = "";
      temAtual = false;
      i++;
      continue;
    }
    if (c === ";" || c === "|" || c === "&" || c === "\n") {
      if (temAtual) tokens.push(atual);
      tokens.push(c);
      atual = "";
      temAtual = false;
      continue;
    }
    if (c === " " || c === "\t") {
      if (temAtual) tokens.push(atual);
      atual = "";
      temAtual = false;
      continue;
    }
    atual += c;
    temAtual = true;
  }
  if (temAtual) tokens.push(atual);
  return tokens;
}

/** Separa os tokens em segmentos (um comando simples cada), já sem `VAR=x`, `sudo`, `time`… */
export function segmentos(comando) {
  const saida = [];
  let seg = [];
  for (const t of tokenizar(comando)) {
    if (OPERADORES.has(t)) {
      if (seg.length) saida.push(seg);
      seg = [];
    } else seg.push(t);
  }
  if (seg.length) saida.push(seg);
  return saida.map(limparPrefixo).filter((s) => s.length > 0);
}

function limparPrefixo(seg) {
  let i = 0;
  while (i < seg.length) {
    const t = seg[i];
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(t)) i++;
    else if (["sudo", "time", "command", "exec", "nohup", "env"].includes(t)) i++;
    else break;
  }
  return seg.slice(i);
}

/** Tira as opções globais do git (`-C dir`, `-c k=v`, `--no-pager`…) e devolve `[subcomando, ...args]`. */
function argsDoGit(seg) {
  const resto = seg.slice(1);
  let i = 0;
  while (i < resto.length && resto[i].startsWith("-")) {
    if (resto[i] === "-C" || resto[i] === "-c") i += 2;
    else i++;
  }
  return resto.slice(i);
}

/** Valores de uma opção que aparece como `--filter x` ou `--filter=x`. */
function valoresDe(args, ...opcoes) {
  const valores = [];
  args.forEach((a, i) => {
    if (opcoes.includes(a) && i + 1 < args.length) valores.push(args[i + 1]);
    for (const o of opcoes) if (a.startsWith(`${o}=`)) valores.push(a.slice(o.length + 1));
  });
  return valores;
}

/** Posicionais do pnpm, pulando o VALOR de `--filter`/`-F`/`--dir`/`-C`. */
function posicionaisDoPnpm(args) {
  const pos = [];
  for (let i = 0; i < args.length; i++) {
    if (["--filter", "-F", "--dir", "-C"].includes(args[i])) i++;
    else if (!args[i].startsWith("-")) pos.push(args[i]);
  }
  return pos;
}

/** O diretório em que o pnpm vai de fato rodar: `-w` vai à raiz; `-C`/`--dir` mudam o cwd. */
function cwdDoPnpm(args, ctx) {
  if (tem(args, "-w", "--workspace-root")) return ctx.raizDe(ctx.cwd) ?? ctx.cwd;
  const [dir] = valoresDe(args, "-C", "--dir");
  return dir ? resolve(ctx.cwd, dir) : ctx.cwd;
}

/**
 * Filtro que com certeza NÃO alcança o front: um nome ou caminho literal, sem o
 * nome do front, sem glob e sem `...` (que puxa dependentes/dependências — um
 * pacote que o front consome). Qualquer outro seletor: na dúvida, pergunta.
 */
const filtroSeguro = (f, front) => !f.includes(basename(front)) && !f.includes("...") && /^@?[A-Za-z0-9_./-]+$/.test(f) && !f.includes("*");

/** O build alcança o `.next`? Da raiz sem filtro, de dentro do `apps/web`, com `-r` sem filtro, ou com seletor que pode incluir o front. */
function tocaOFront(args, ctx) {
  const cwd = cwdDoPnpm(args, ctx);
  const raiz = ctx.raizDe(cwd);
  if (raiz === null) return false;
  const front = resolve(raiz, ctx.frontend ?? FRONT_PADRAO);
  if (cwd === front || cwd.startsWith(`${front}/`)) return true;
  const filtros = valoresDe(args, "--filter", "-F");
  if (filtros.length > 0) return !filtros.every((f) => filtroSeguro(f, ctx.frontend ?? FRONT_PADRAO));
  return cwd === raiz || tem(args, "-r", "--recursive");
}

const tem = (args, ...opcoes) => args.some((a) => opcoes.includes(a));
/** Flag curta combinada: `-fd`, `-xdf` contêm `f`. */
const temCurta = (args, letra) => args.some((a) => /^-[A-Za-z]+$/.test(a) && a.includes(letra));

const DESCARTAVEIS = new Set(["dist", ".next", "node_modules", "coverage", ".turbo", ".vitest"]);

/**
 * O alvo está numa pasta temporária do sistema? Variável, glob e `~` não se
 * expandem aqui — na dúvida, não é temporário, e a guarda pergunta.
 */
function emPastaTemporaria(alvo, cwd) {
  if (alvo.includes("$") || alvo.includes("*") || alvo.includes("~")) return false;
  const abs = isAbsolute(alvo) ? alvo : resolve(cwd, alvo);
  return /^\/(private\/)?tmp\//.test(abs) || /^\/private\/var\/folders\//.test(abs);
}

function alvoDescartavel(alvo, cwd, descartaveis = DESCARTAVEIS) {
  if (emPastaTemporaria(alvo, cwd)) return true;
  if (alvo.includes("$") || alvo.includes("*") || alvo.includes("~")) return false;
  return descartaveis.has(basename(isAbsolute(alvo) ? alvo : resolve(cwd, alvo)));
}

/**
 * Avalia UM comando simples. Devolve o motivo (texto para o operador) ou `null`.
 * `ctx.raizDe(dir)` acha a raiz do monorepo com front (ou `null`) e vale só para o build;
 * `ctx.raizDoGit(dir)` acha o toplevel do git, para a lista de migrations; `ctx.devNoAr(raiz)` diz
 * se há `next dev` desta árvore no ar: `true`, `false` ou `null` (não conferi).
 * `ctx.migracoesForaDaDevelop(raiz)` devolve `{ fora: string[] | null, causa? }`.
 */
export function avaliarSegmento(seg, ctx) {
  const [cmd] = seg;
  const args = seg.slice(1);

  if (cmd === "pnpm" && ativa(ctx, "build-com-dev-no-ar")) {
    const posicionais = posicionaisDoPnpm(args);
    const ehBuild = posicionais[0] === "build" || (posicionais[0] === "run" && posicionais[1] === "build");
    if (!ehBuild || !tocaOFront(args, ctx)) return null;
    const r = ctx.devNoAr(ctx.raizDe(cwdDoPnpm(args, ctx)));
    const noAr = r !== null && typeof r === "object" ? r.noAr : r;
    if (noAr === false) return null;
    if (noAr) {
      return `Este \`pnpm build\` toca o front, e com o \`next dev\` desta árvore no ar ele sobrescreve o \`.next\` do dev server. Use o build filtrado dos pacotes que o front consome${ctx.buildFiltrado ? ` (\`${ctx.buildFiltrado}\`)` : ""}.`;
    }
    const causa = r !== null && typeof r === "object" && r.causa ? ` (${r.causa})` : "";
    return `Este \`pnpm build\` toca o front, e não consegui conferir se há \`next dev\` desta árvore no ar${causa}. Se houver, ele perde o \`.next\`. Prefira o build filtrado dos pacotes.`;
  }

  if (cmd === "psql") {
    if (ativa(ctx, "psql-f") && (tem(args, "-f") || args.some((a) => a.startsWith("--file") || /^-f.+/.test(a)))) {
      return "`psql -f` aplica a migration sem registrar em `schema_migrations`, e o histórico fica para trás em silêncio. Use `supabase migration up --local`.";
    }
    if (ativa(ctx, "destrutivos") && /\b(drop\s+(table|schema|database)|truncate)\b/i.test(args.join(" "))) {
      return "SQL destrutivo (`drop`/`truncate`) — confirme o banco-alvo antes.";
    }
    return null;
  }

  if (cmd === "supabase" && ativa(ctx, "migration-fora-do-tronco")) {
    // Posicionais do supabase, pulando o VALOR de `--workdir`/`--profile`/`--db-url`.
    const pos = [];
    for (let i = 0; i < args.length; i++) {
      if (["--workdir", "--profile", "--db-url"].includes(args[i])) i++;
      else if (!args[i].startsWith("-")) pos.push(args[i]);
    }
    const aplicaNoLocal =
      (pos[0] === "migration" && pos[1] === "up" && !tem(args, "--linked")) ||
      (pos[0] === "db" && pos[1] === "push" && tem(args, "--local"));
    const reset = pos[0] === "db" && pos[1] === "reset";
    if (!aplicaNoLocal && !reset) return null;
    const [workdir] = valoresDe(args, "--workdir");
    // A raiz é o toplevel do git, não a do front: o banco local existe em projeto sem monorepo. Sem git é `cwd`, e a lista vira "não sei".
    const raiz = (ctx.raizDoGit ?? ctx.raizDe)(workdir ? resolve(ctx.cwd, workdir) : ctx.cwd);
    // `db reset --linked` pergunta pelo apagar; a lista de fora da develop é só do banco local.
    const tronco = ctx.tronco ?? TRONCO_PADRAO;
    const [remoto, ...ramo] = tronco.split("/");
    const buscar = `git fetch ${remoto} ${ramo.join("/")}`;
    const medir = ctx.migracoesForaDoTronco ?? ctx.migracoesForaDaDevelop;
    const r = raiz === null || tem(args, "--linked") ? { fora: [] } : medir(raiz);
    const COMPARTILHADO = "O banco local é um só para todos os worktrees: aplicadas aqui, passam a valer para as outras branches, que não têm o arquivo, e os testes de banco delas pulam ou falham.";
    // O `db reset` reaplica TODA migration do disco: o mesmo dano, além de apagar o banco.
    if (reset) {
      const apaga = "`supabase db reset` apaga o banco local inteiro (o seed de demo não volta sozinho).";
      if (r.fora === null) return `${apaga} E não consegui conferir quais migrations deste worktree já estão na \`${tronco}\` (${r.causa}).`;
      if (r.fora.length > 0) return `${apaga} E ele reaplica estas migrations, que não estão na \`${tronco}\`: ${r.fora.join(", ")}. ${COMPARTILHADO}`;
      return apaga;
    }
    if (r.fora === null) {
      return `Não consegui conferir quais migrations deste worktree já estão na \`${tronco}\` (${r.causa}). O banco local é um só para todos os worktrees: migration de PR aberto aplicada nele cega os testes de banco das outras branches. Rode \`${buscar}\` e confira antes de aplicar.`;
    }
    if (r.fora.length > 0) {
      return `Estas migrations não estão na \`${tronco}\`: ${r.fora.join(", ")}. ${COMPARTILHADO} Aplique só o que já está no tronco; se ele andou, rode \`${buscar}\` antes.`;
    }
    return null;
  }

  if (cmd === "rm" && ativa(ctx, "destrutivos")) {
    const recursivo = tem(args, "--recursive") || temCurta(args, "r") || temCurta(args, "R");
    const forcado = tem(args, "--force") || temCurta(args, "f");
    if (!recursivo || !forcado) return null;
    const alvos = args.filter((a) => !a.startsWith("-"));
    if (alvos.length > 0 && alvos.every((a) => alvoDescartavel(a, ctx.cwd, ctx.descartaveis))) return null;
    return `\`rm -rf ${alvos.join(" ")}\` fora de pasta descartável — confirme o que será apagado.`;
  }

  if ((cmd === "pkill" || cmd === "killall") && ativa(ctx, "kill-por-nome")) {
    return "`pkill`/`killall` matam pelo NOME e alcançam os processos das outras sessões (o gate delas, o worker). Mate pelo PID que você iniciou (`kill <pid>`).";
  }

  if (cmd === "git") {
    const [sub, ...g] = argsDoGit(seg);
    if (!ativa(ctx, REGRA_DO_SUBCOMANDO[sub] ?? "destrutivos")) return null;
    switch (sub) {
      case "merge":
        if (tem(g, "--ff-only", "--abort", "--continue", "--quit")) return null;
        return "`git merge` sem `--ff-only` cria merge commit; o tronco é rebase sobre a base. Na devolução por conflito da fila, traga a base pelo `sync_with_base_branch` do app (sessão em worktree do app) ou por `git rebase`.";
      case "pull":
        // `--rebase=false` e `--no-rebase` pedem o MERGE — só os valores de rebase liberam.
        if (tem(g, "--rebase", "-r", "--ff-only") || g.some((a) => /^--rebase=(true|merges|interactive|i|m)$/.test(a))) return null;
        return "`git pull` sem `--rebase` pode criar merge commit; use `git pull --rebase` (ou `--ff-only`).";
      case "reset":
        return tem(g, "--hard") ? "`git reset --hard` descarta alterações sem volta — confirme que não há trabalho de outra sessão na árvore." : null;
      case "push": {
        const lease = g.some((a) => a.startsWith("--force-with-lease") || a === "--force-if-includes");
        const forca = tem(g, "--force") || temCurta(g, "f") || g.some((a) => /^\+/.test(a));
        return forca && !lease ? "`git push --force` sem `--force-with-lease` sobrescreve o remoto às cegas." : null;
      }
      case "stash": {
        if (tem(g, "drop", "clear")) return "`git stash drop/clear` — o stash é COMPARTILHADO entre worktrees e pode ser de outra sessão.";
        const sub2 = g[0] === undefined || g[0].startsWith("-") ? "push" : g[0];
        if (sub2 === "pop" || (sub2 === "apply" && !g.slice(1).some((a) => /^[0-9a-f]{7,40}$/.test(a)))) {
          return "`git stash pop` e `git stash apply` sem sha usam o stash COMPARTILHADO entre worktrees, cujo topo pode ser de outra sessão. Ache a sua entrada pelo tag (`git stash list --format='%H %gs'`) e use `git stash apply <sha>`.";
        }
        if (sub2 === "push" || sub2 === "save") {
          const arquivoNovo = tem(g, "--include-untracked", "--all") || temCurta(g, "u") || temCurta(g, "a");
          const mensagem = g.some((a) => a === "--message" || a.startsWith("--message=")) || temCurta(g, "m");
          if (arquivoNovo && mensagem) return null;
          return "`git stash` sem `-u` não leva arquivo novo, e o stash é COMPARTILHADO entre worktrees. Prefira um commit WIP, ou `git stash push -u -m <tag-único>` e depois `git stash apply <sha>`.";
        }
        return null;
      }
      case "add": {
        const pos = g.filter((a) => !a.startsWith("-"));
        const amplo = tem(g, "--all", "--update") || temCurta(g, "A") || temCurta(g, "u") || pos.some((a) => [".", "./", ":/", "*", ":(top)"].includes(a));
        return amplo ? "`git add` amplo (`-A`, `-u`, `.`, `:/`, `*`) varre arquivo que outra sessão deixou na mesma pasta. Adicione por caminho (`git add <arquivos>`)." : null;
      }
      case "commit":
        return tem(g, "--all") || temCurta(g, "a")
          ? "`git commit -a` faz staging amplo e leva arquivo que outra sessão alterou na mesma pasta. Adicione por caminho (`git add <arquivos>`)."
          : null;
      case "clean":
        if (tem(g, "-n", "--dry-run")) return null;
        return tem(g, "--force") || temCurta(g, "f") ? "`git clean -f` apaga arquivo não versionado sem volta." : null;
      case "branch":
        return tem(g, "-D") || (tem(g, "--delete", "-d") && tem(g, "--force", "-f")) ? "`git branch -D` apaga a branch mesmo sem merge." : null;
      case "checkout":
      case "restore": {
        const pos = g.filter((a) => !a.startsWith("-"));
        return pos.includes(".") ? `\`git ${sub} .\` descarta todas as alterações da árvore.` : null;
      }
      case "worktree": {
        if (g[0] !== "remove" || !(tem(g, "--force") || temCurta(g, "f"))) return null;
        // Worktree de VERIFICAÇÃO numa pasta temporária sai sem
        // pergunta — é a mesma exceção de pasta que o `rm -rf` já tem. Só a
        // pasta temporária: o nome descartável (`dist`, `.next`) não vale aqui.
        const alvos = g.slice(1).filter((a) => !a.startsWith("-"));
        if (alvos.length === 1 && emPastaTemporaria(alvos[0], ctx.cwd)) return null;
        return "`git worktree remove --force` apaga o worktree mesmo com alterações.";
      }
      default:
        return null;
    }
  }
  return null;
}

/** Os segmentos como vieram, sem tirar `VAR=x` nem `sudo`/`env` do começo — a regra do teto precisa ver o `KIT_FICHAS_TOMADAS=`. */
function segmentosBrutos(comando) {
  const saida = [];
  let seg = [];
  for (const t of tokenizar(comando)) {
    if (OPERADORES.has(t)) {
      if (seg.length) saida.push(seg);
      seg = [];
    } else seg.push(t);
  }
  if (seg.length) saida.push(seg);
  return saida;
}

const RUNNERS_DE_TESTE = new Set(["vitest", "jest"]);
const ehRunner = (t) => t !== undefined && RUNNERS_DE_TESTE.has(basename(t));

const OPCOES_DO_NODE_COM_VALOR = new Set(["--import", "-r", "--require", "--loader", "--experimental-loader"]);

/** `true` se o segmento sobe um runner de teste direto (`vitest`, `jest`, `node --test`) sem as fichas do teto. */
function testeSolto(bruto) {
  let i = 0;
  let comFichas = false;
  while (i < bruto.length) {
    const t = bruto[i];
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(t)) {
      if (t.startsWith("KIT_FICHAS_TOMADAS=")) comFichas = true;
      i++;
    } else if (["sudo", "time", "command", "exec", "nohup", "env"].includes(t)) i++;
    else break;
  }
  if (comFichas) return false;
  const [cmd, ...args] = bruto.slice(i);
  if (cmd === undefined) return false;
  const base = basename(cmd);
  if (ehRunner(base)) return true;
  if (["npx", "pnpx", "bunx"].includes(base)) return ehRunner(args.find((a) => !a.startsWith("-")));
  if (["pnpm", "npm", "yarn"].includes(base)) {
    const pos = posicionaisDoPnpm(args.filter((a) => a !== "--"));
    return ehRunner(pos[0]) || (["exec", "dlx", "x"].includes(pos[0]) && ehRunner(pos[1]));
  }
  if (base === "node") {
    // só as opções do node antes do script contam: `node script.mjs --test` passa `--test` ao script
    // `--import tsx`, `-r X` e afins levam o valor no argumento seguinte: ele não é o script
    for (let k = 0; k < args.length; k++) {
      const a = args[k];
      if (!a.startsWith("-")) break;
      if (a === "--test" || a.startsWith("--test-")) return true;
      if (OPCOES_DO_NODE_COM_VALOR.has(a)) k++;
    }
  }
  return false;
}

/** O motivo da recusa da regra `teste-fora-do-teto`. */
const MOTIVO_DO_TETO = "Teste fora do teto da máquina (ADR 0005): rode por `node scripts/kit/com-fichas.mjs -- <o comando>` ou pelo gate (`npm test [pacote]`).";

/**
 * As **recusas** da linha inteira (a regra `teste-fora-do-teto`): lista de motivos, vazia se nada a recusar. Fora do CI
 * (`ctx.ci`) e com a regra ligada (`guarda.regras`). Diferente de {@link avaliar}, que pergunta.
 */
export function avaliarFirmes(comando, ctx) {
  if (ctx.ci || !ativa(ctx, "teste-fora-do-teto")) return [];
  return segmentosBrutos(comando).some(testeSolto) ? [MOTIVO_DO_TETO] : [];
}

/** Avalia a linha inteira, seguindo os `cd`. Devolve a lista de motivos (vazia = nada a perguntar). */
export function avaliar(comando, ctx) {
  let cwd = ctx.cwd;
  const motivos = [];
  for (const seg of segmentos(comando)) {
    if (seg[0] === "cd") {
      const destino = seg[1];
      if (destino && !destino.includes("$") && !destino.startsWith("~") && destino !== "-") cwd = resolve(cwd, destino);
      continue;
    }
    const motivo = avaliarSegmento(seg, { ...ctx, cwd });
    if (motivo) motivos.push(motivo);
  }
  return motivos;
}

const PRAZO = { timeout: 3000, killSignal: "SIGKILL", encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] };

/** A causa de um subprocesso que falhou. `||`, não `??`: o stderr de um ENOENT é a string VAZIA. */
const causaDe = (e) => String((e && (e.stderr || e.message)) || e).trim().split("\n")[0];

/** A raiz do monorepo que contém `dir` (quem tem `pnpm-workspace.yaml` e o `frontend`), ou `null`. */
export const criarRaizDe = (frontend = FRONT_PADRAO) =>
  function raizDe(dir) {
    for (let d = dir; ; d = dirname(d)) {
      if (existsSync(resolve(d, "pnpm-workspace.yaml")) && existsSync(resolve(d, frontend, "package.json"))) return d;
      if (dirname(d) === d) return null;
    }
  };
const raizDe = criarRaizDe();

/**
 * Há `next dev` rodando com o cwd dentro desta árvore? `{ noAr: true | false | null, causa? }` —
 * `null` é "não deu para conferir", e a causa vai no motivo mostrado ao operador.
 */
function devNoAr(raiz, raizDeFront = raizDe) {
  let pids;
  try {
    pids = execFileSync("pgrep", ["-f", "next dev|next-server"], PRAZO).split("\n").filter(Boolean);
  } catch (e) {
    // `pgrep` sai 1 quando não acha nada — é "não há", não "não sei".
    if (e.status === 1) return { noAr: false };
    return { noAr: null, causa: `pgrep: ${causaDe(e)}` };
  }
  let incerto = null;
  for (const pid of pids) {
    try {
      const saida = execFileSync("lsof", ["-a", "-p", pid, "-d", "cwd", "-Fn"], PRAZO);
      const cwd = saida.split("\n").find((l) => l.startsWith("n"))?.slice(1);
      // Compara a RAIZ do processo, não o prefixo do caminho: os worktrees moram
      // dentro de `.claude/worktrees/` da árvore principal, e o `next dev` de um
      // deles não toca o `.next` dela.
      if (cwd && raizDeFront(cwd) === raiz) return { noAr: true };
    } catch (e) {
      // Só o processo que MORREU entre o pgrep e o lsof não conta. Qualquer outra
      // falha (prazo, lsof ausente, permissão) é "não sei", e "não sei" pergunta —
      // antes ela virava "não há", o lado calado.
      if (!processoSumiu(pid)) incerto = `lsof: ${causaDe(e)}`;
    }
  }
  return incerto ? { noAr: null, causa: incerto } : { noAr: false };
}

/**
 * Os `.sql` de `supabase/migrations/` desta árvore que não estão na `${tronco}`. Lê o DISCO
 * (o CLI aplica arquivo não commitado também) e compara pelo nome. `{ fora: string[] }` ou
 * `{ fora: null, causa }` — git que falha é "não sei", e "não sei" pergunta.
 */
export function migracoesForaDoTronco(raiz, { migrations = MIGRATIONS_PADRAO, tronco = TRONCO_PADRAO } = {}) {
  const pasta = resolve(raiz, migrations);
  if (!existsSync(pasta)) return { fora: [] };
  let locais;
  try {
    locais = readdirSync(pasta).filter((n) => n.endsWith(".sql"));
  } catch (e) {
    return { fora: null, causa: `ler ${pasta}: ${causaDe(e)}` };
  }
  let naDevelop;
  try {
    const saida = execFileSync("git", ["-C", raiz, "ls-tree", "-z", "--name-only", tronco, "--", `${migrations}/`], PRAZO);
    // `-z`: sem ele o git devolve nome com acento entre aspas e escapado, e a comparação falha.
    naDevelop = new Set(saida.split("\0").filter(Boolean).map((p) => basename(p)));
  } catch (e) {
    return { fora: null, causa: `git ls-tree ${tronco}: ${causaDe(e)}` };
  }
  return { fora: locais.filter((n) => !naDevelop.has(n)).sort() };
}

/** O nome de antes (lia a `origin/develop` fixa) continua exportado. */
export const migracoesForaDaDevelop = (raiz) => migracoesForaDoTronco(raiz);

/** O processo não existe mais? `kill(pid, 0)` não mata: só pergunta, e ESRCH é "sumiu". */
function processoSumiu(pid) {
  try {
    process.kill(Number(pid), 0);
    return false;
  } catch (e) {
    return e.code === "ESRCH";
  }
}

/**
 * O contexto da avaliação para um `cwd`: as regras ligadas e os caminhos vêm do
 * `kit.json` do projeto (padrões se não houver); `kit.json` ilegível cai nos
 * padrões e DIZ, no stderr, em vez de travar o trabalho.
 */
export function contextoDe(cwd) {
  let guarda;
  try {
    guarda = carregarConfig(raizDoProjeto(cwd)).guarda;
  } catch (e) {
    console.error(`[guarda] ${e.message} — seguindo com as regras padrão`);
    guarda = carregarConfig("/", {}).guarda;
  }
  const frontend = guarda.frontend;
  const raizDoFront = criarRaizDe(frontend);
  return {
    cwd,
    regras: new Set(guarda.regras),
    ci: Boolean(process.env["CI"]),
    frontend,
    tronco: guarda.tronco,
    buildFiltrado: guarda.buildFiltrado,
    descartaveis: new Set(guarda.descartaveis),
    raizDe: raizDoFront,
    raizDoGit: raizDoProjeto,
    devNoAr: (raiz) => devNoAr(raiz, raizDoFront),
    migracoesForaDoTronco: (raiz) => migracoesForaDoTronco(raiz, { migrations: guarda.migrations, tronco: guarda.tronco }),
  };
}

export function main(entrada) {
  let evento;
  try {
    evento = JSON.parse(entrada);
  } catch (e) {
    console.error(`[guarda] evento ilegível: ${e.message}`);
    return 0;
  }
  const comando = evento?.tool_input?.command;
  if (evento?.tool_name !== "Bash" || typeof comando !== "string" || comando.length === 0) return 0;
  const cwd = evento.cwd || process.cwd();
  const ctx = contextoDe(cwd);
  const motivos = avaliar(comando, ctx);
  // A recusa vale em qualquer modo, bypass incluído (ADR 0005, decisão 4): o teste solto é o que trava a máquina.
  const firmes = avaliarFirmes(comando, ctx);
  if (firmes.length > 0) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: [...firmes, ...motivos].join(" · ") },
      }),
    );
    return 0;
  }
  if (motivos.length === 0) return 0;
  // Em bypass ("ignorar permissões") a guarda NÃO pergunta. Quem
  // escolhe esse modo deixa a sessão rodando sozinha por horas, e uma pergunta
  // ali não protege nada — só deixa a sessão parada esperando ninguém. O motivo
  // vira aviso no transcript, para quem voltar ver o que passou.
  if (evento.permission_mode === "bypassPermissions") {
    process.stdout.write(JSON.stringify({ systemMessage: `Guarda de operação (modo bypass, seguiu sem perguntar): ${motivos.join(" · ")}` }));
    return 0;
  }
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "ask",
        permissionDecisionReason: motivos.join(" · "),
      },
    }),
  );
  return 0;
}

// Pelo caminho REAL dos dois lados — link e espaço no caminho não podem virar saída 0 sem rodar
// (`o-script-principal.mjs`); `exitCode`, nunca `process.exit()`.
rodarSePrincipal(import.meta.url, () => main(readFileSync(0, "utf-8")), "[guarda]");
