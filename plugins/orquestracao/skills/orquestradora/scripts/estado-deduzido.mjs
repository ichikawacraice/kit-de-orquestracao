// F423: o estado do item deduzido, em vez de declarado. A etapa, os PRs, a dona viva, o "parado" e o merge saem do git (a branch
// do worktree da dona), do `gh` (os PRs do repositório) e da lista de sessões do app; o item guarda só o que o modelo decide
// (título, plano, risco, entrega, perguntas). `deduzir` é puro; `coletar` faz o I/O (GH_BIN e GIT_BIN trocam os executáveis,
// para teste). Sem o dado (gh fora do ar, worktree apagado), a dedução cai no que o item declara: o item antigo segue legível.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const ms = (v) => { const t = typeof v === 'number' ? v : Date.parse(v); return Number.isFinite(t) ? t : null; };
const texto = (v) => typeof v === 'string' && v.trim() !== '';
const inteiros = (l) => (Array.isArray(l) ? l.filter((n) => Number.isInteger(n) && n > 0) : []);
// a branch que não é de item: o PR aberto dela não se liga a item nenhum
const BRANCH_DE_BASE = /^(main|master|develop|HEAD)$/;

// A última reabertura do item (a entrada do histórico que sai de `feito`/`descartado`), em ms, ou null.
const FINAIS = new Set(['feito', 'descartado']);
export function reabertoEm(d) {
  const h = Array.isArray(d?.historico) ? d.historico : [];
  let em = null;
  for (let i = 1; i < h.length; i++) if (FINAIS.has(h[i - 1]?.etapa) && !FINAIS.has(h[i]?.etapa)) em = ms(h[i]?.em) ?? em;
  return em;
}

// Os PRs ligados ao item: os que ele lista em `prs` (o item antigo, e a fila que já os ligou) e os que saem da branch da dona
// (a `branch` do item, ou a do worktree dela). O PR da branch só conta se foi criado depois do item nascer: o worktree
// reaproveitado não herda o PR do item anterior. O PR mergeado antes do item nascer não conta (o número de `prs` que é de outro
// repositório e colide com um PR antigo deste), nem o mergeado antes da última reabertura (o item reaberto não refecha pelo
// merge que já o tinha fechado). `ambiguos`: os números que a branch liga a mais de um item vivo (não ligam
// nenhum). → [{number, state, mergedAt, updatedAt, headRefName, fonte}]
export function prsDoItem(d, { prs = null, branchDaDona = null, ambiguos = null } = {}) {
  const porNumero = new Map((prs ?? []).filter((p) => Number.isInteger(p?.number)).map((p) => [p.number, p]));
  const nasceu = ms(d?.historico?.[0]?.em);
  const reaberto = reabertoEm(d);
  // mergeado antes do item nascer (o número que colide com um PR de outro repositório) ou antes da última reabertura: não é dele
  const corte = Math.max(nasceu ?? -Infinity, reaberto ?? -Infinity);
  const jaFechou = (p) => ms(p?.mergedAt) !== null && ms(p.mergedAt) < corte;
  const ligados = new Map();
  for (const n of inteiros(d?.prs)) {
    const p = porNumero.get(n);
    if (jaFechou(p)) continue;
    ligados.set(n, { number: n, ...(p ?? { state: null }), fonte: 'item' });
  }
  const branches = branchesDoItem(d, branchDaDona);
  for (const p of porNumero.values()) {
    if (ligados.has(p.number) || inteiros(d?.prs).includes(p.number) || !branches.includes(p.headRefName)) continue;
    if (ambiguos?.has(p.number) || jaFechou(p)) continue;
    const criado = ms(p.createdAt) ?? ms(p.mergedAt);
    if (nasceu !== null && criado !== null && criado < nasceu) continue;
    ligados.set(p.number, { ...p, fonte: 'branch' });
  }
  return [...ligados.values()].sort((a, b) => a.number - b.number);
}
const branchesDoItem = (d, branchDaDona) => [...new Set([d?.branch, branchDaDona].filter((b) => texto(b) && !BRANCH_DE_BASE.test(b)))];

// A branch da dona: a do worktree (o git) vale sobre a da lista do app, que é a branch com que o app criou a sessão.
const branchDe = ({ linha, git }) => (texto(git?.branch) ? git.branch : linha?.branch ?? null);

// → { etapa, prs, prsAbertos, mergeado, fatiaMergeada, donaViva, rodando, ultimaAtividade, parado, minParado, fontes }
// `linha`: a sessão da dona na lista do app (ou undefined); `git`: { aFrente, sujo, ultimoCommitMs } da branch dela, ou null;
// `prs`: os PRs do repositório que o `gh` leu (null: o gh não leu, vale o declarado).
export function deduzir({ item: d, linha = null, prs = null, git = null, agoraMs, prazoMin, ambiguos = null }) {
  const ligados = prsDoItem(d, { prs, branchDaDona: branchDe({ linha, git }), ambiguos });
  const lidos = ligados.filter((p) => p.state); // os que o gh leu
  const abertos = lidos.filter((p) => p.state === 'OPEN');
  const valendo = lidos.filter((p) => p.state !== 'CLOSED'); // o PR fechado sem merge não conta
  const todosMergeados = valendo.length > 0 && valendo.every((p) => p.state === 'MERGED')
    && ligados.every((p) => p.state); // um PR que o gh não leu segura o fechamento
  const fatia = d?.maisFatias === true;
  const fontes = { prs: prs ? 'gh' : 'item', etapa: 'item', dona: linha ? 'sessoes' : 'item' };

  let etapa = d?.etapa ?? null;
  if (todosMergeados && !fatia) { etapa = 'feito'; fontes.etapa = 'gh'; }
  else if (abertos.length) { etapa = 'merge'; fontes.etapa = 'gh'; }
  else if (todosMergeados && fatia) { etapa = 'execucao'; fontes.etapa = 'gh'; }
  // em merge, o gh leu todos os PRs ligados e nenhum está aberto: o PR foi fechado sem merge (sem PR ligado, ou com um que o gh não leu, vale o declarado)
  else if (etapa === 'merge' && prs && ligados.length && ligados.every((p) => p.state)) { etapa = 'execucao'; fontes.etapa = 'gh'; }
  // o git só promove a `execucao` o item que ainda não começou: não rebaixa `merge` (o gh caído, o PR que o gh não achou)
  else if (git && (git.aFrente > 0 || git.sujo)) { if (!['design', 'execucao', 'validacao', 'merge'].includes(etapa)) etapa = 'execucao'; fontes.etapa = 'git'; }

  const temDona = texto(d?.donoLocalId);
  const donaViva = temDona ? Boolean(linha && linha.isArchived !== true) : null;
  const rodando = Boolean(donaViva && linha?.isRunning === true);
  const marcas = [ms(d?.atualizadoEm), donaViva ? ms(linha?.lastActivityAt) : null, git?.ultimoCommitMs ?? null, ...ligados.map((p) => ms(p.updatedAt))].filter((t) => t !== null);
  const ultimaAtividade = marcas.length ? Math.min(Math.max(...marcas), agoraMs) : null;
  const parado = !rodando && !d?.espera && !d?.trava && (ultimaAtividade === null || agoraMs - ultimaAtividade >= prazoMin * 60_000);
  return {
    // o PR que o gh não leu conta como aberto (o declarado): a cobrança do `--anotar` não some porque o gh caiu
    etapa, prs: ligados.map((p) => p.number), prsAbertos: ligados.filter((p) => !p.state || p.state === 'OPEN').map((p) => p.number),
    mergeado: todosMergeados && !fatia, fatiaMergeada: todosMergeados && fatia,
    donaViva, rodando, ultimaAtividade: ultimaAtividade === null ? null : new Date(ultimaAtividade).toISOString(), parado,
    minParado: ultimaAtividade === null ? null : Math.floor((agoraMs - ultimaAtividade) / 60_000), fontes,
  };
}

// ---- coleta (I/O) ----
// Cada chamada tem o seu limite (KIT_GH_TIMEOUT_MS, 10 s) e a coleta inteira um orçamento (KIT_DEDUCAO_ORCAMENTO_MS, 25 s): a
// batida roda com 60 s de limite no mod, e o gh travado não pode levá-la junto. Estourado o orçamento, o resto fica sem dado
// (o declarado vale).
const LIMITE_MS = () => Number(process.env.KIT_GH_TIMEOUT_MS) || 10_000;
const ORCAMENTO_MS = () => Number(process.env.KIT_DEDUCAO_ORCAMENTO_MS) || 25_000;
let prazoFinal = Infinity;
function rodar(bin, args, cwd) {
  const resta = prazoFinal - Date.now();
  if (resta <= 0) return null;
  try {
    return execFileSync(bin, args, { cwd, encoding: 'utf8', timeout: Math.max(1, Math.min(LIMITE_MS(), resta)), killSignal: 'SIGKILL', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch { return null; }
}
const CAMPOS_DO_PR = 'number,state,headRefName,mergedAt,createdAt,updatedAt';

// Os PRs de um repositório: uma chamada por projeto (`gh pr list --state all`), mais um `gh pr view` por PR listado no item que
// a lista não trouxe (o PR antigo). → [pr] ou null (o gh não leu: a dedução fica no declarado).
export function prsDoRepositorio(cwd, extras = []) {
  const gh = process.env.GH_BIN || 'gh';
  const saida = rodar(gh, ['pr', 'list', '--state', 'all', '--limit', '200', '--json', CAMPOS_DO_PR], cwd);
  let lista;
  try { lista = JSON.parse(saida); } catch { return null; }
  if (!Array.isArray(lista)) return null;
  const tem = new Set(lista.map((p) => p?.number));
  for (const n of extras) {
    if (tem.has(n)) continue;
    try { const v = JSON.parse(rodar(gh, ['pr', 'view', String(n), '--json', CAMPOS_DO_PR], cwd)); if (Number.isInteger(v?.number)) { lista.push(v); tem.add(n); } } catch { /* fica sem: segura o fechamento */ }
  }
  return lista;
}

// A branch do worktree: o nome dela, os commits à frente da base remota, mudança sem commit e a hora do último commit. → objeto ou null.
export function gitDoWorktree(cwd) {
  if (!texto(cwd) || !existsSync(cwd)) return null;
  const git = process.env.GIT_BIN || 'git';
  const ult = rodar(git, ['-C', cwd, 'log', '-1', '--format=%ct'], cwd);
  if (ult === null) return null;
  const nome = String(rodar(git, ['-C', cwd, 'rev-parse', '--abbrev-ref', 'HEAD'], cwd) ?? '').trim();
  let aFrente = 0;
  for (const base of ['origin/HEAD', 'origin/main', 'origin/master']) {
    const n = rodar(git, ['-C', cwd, 'rev-list', '--count', `${base}..HEAD`], cwd);
    if (n !== null && /^\d+\s*$/.test(n)) { aFrente = Number(n); break; }
  }
  const st = rodar(git, ['-C', cwd, 'status', '--porcelain', '--untracked-files=no'], cwd);
  const seg = Number(String(ult).trim());
  return { branch: nome && nome !== 'HEAD' ? nome : null, aFrente, sujo: Boolean(st && st.trim()), ultimoCommitMs: Number.isFinite(seg) && seg > 0 ? seg * 1000 : null };
}

// Coleta e deduz cada item vivo. `itens`: Map F → data; `linhas`: list_sessions; `projetoDe(linha)` → slug.
// O repositório do projeto é o cwd de uma sessão viva DELE (a da dona primeiro, se for do projeto). → Map F → deduzido
export function coletar({ itens, linhas, projetoDe, slug = (p) => String(p ?? '').toLowerCase(), agoraMs, prazoMin, ler = { prsDoRepositorio, gitDoWorktree } }) {
  prazoFinal = Date.now() + ORCAMENTO_MS();
  try {
    const porId = new Map(linhas.map((r) => [r.sessionId, r]));
    const viva = (r) => Boolean(r && r.isArchived !== true && texto(r.cwd));
    const doProjeto = (r, p) => { try { return projetoDe(r) === p; } catch { return false; } };
    const repoDe = new Map(); // projeto → cwd
    for (const [, d] of itens) {
      const p = slug(d?.projeto);
      if (!p || repoDe.has(p)) continue;
      const dona = porId.get(d?.donoLocalId);
      const r = (viva(dona) && doProjeto(dona, p) ? dona : null) ?? linhas.find((x) => viva(x) && doProjeto(x, p));
      repoDe.set(p, r ? r.cwd : null);
    }
    const prsPorProjeto = new Map();
    for (const [p, cwd] of repoDe) {
      const extras = [...itens.values()].filter((d) => slug(d?.projeto) === p).flatMap((d) => inteiros(d?.prs));
      prsPorProjeto.set(p, cwd ? ler.prsDoRepositorio(cwd, [...new Set(extras)]) : null);
    }
    // 1ª passada: o git de cada dona e os PRs que a branch liga (para achar o PR que a branch liga a mais de um item vivo)
    const base = new Map();
    const vezes = new Map(); // `projeto#número` → quantos itens a branch liga
    for (const [F, d] of itens) {
      const linha = porId.get(d?.donoLocalId) ?? null;
      const git = viva(linha) ? ler.gitDoWorktree(linha.cwd) : null;
      const prs = prsPorProjeto.get(slug(d?.projeto)) ?? null;
      base.set(F, { linha, git, prs });
      for (const pr of prsDoItem(d, { prs, branchDaDona: branchDe({ linha, git }) })) {
        if (pr.fonte === 'branch') { const k = `${slug(d?.projeto)}#${pr.number}`; vezes.set(k, (vezes.get(k) ?? 0) + 1); }
      }
    }
    const saida = new Map();
    for (const [F, d] of itens) {
      const { linha, git, prs } = base.get(F);
      // fora da branch: o PR que ela liga a mais de um item, e o que outro item do projeto já lista em `prs` (é dele)
      const ambiguos = new Set([...vezes].filter(([k, n]) => n > 1 && k.startsWith(`${slug(d?.projeto)}#`)).map(([k]) => Number(k.split('#').pop())));
      for (const [G, e] of itens) if (G !== F && slug(e?.projeto) === slug(d?.projeto)) for (const n of inteiros(e?.prs)) ambiguos.add(n);
      saida.set(F, deduzir({ item: d, linha, prs, git, agoraMs, prazoMin, ambiguos }));
    }
    return saida;
  } finally { prazoFinal = Infinity; }
}
