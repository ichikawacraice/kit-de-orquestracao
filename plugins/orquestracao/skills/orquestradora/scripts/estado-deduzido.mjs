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
// merge que já o tinha fechado). `ambiguos`: os números que a branch liga a mais de um item vivo, ou a outro item (não ligam
// nenhum). F446: com o `id` (F303), liga também o PR ABERTO cujo primeiro id de item na branch é o dele (`feat/f303-x`, não
// `f450-conserta-o-f303`): a dona que roda no checkout principal e abre o PR num worktree ao lado não tem a branch dele no git
// da sessão. Só o aberto: o id segura o fechamento, nunca fecha o item. → [{number, state, mergedAt, updatedAt, headRefName, fonte}]
export function prsDoItem(d, { prs = null, branchDaDona = null, ambiguos = null, id = null } = {}) {
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
  const doId = texto(id) && /^F\d+$/i.test(id.trim()) ? id.trim().toUpperCase() : null;
  for (const p of porNumero.values()) {
    if (ligados.has(p.number) || inteiros(d?.prs).includes(p.number)) continue;
    const pelaBranch = branches.includes(p.headRefName);
    const peloId = !pelaBranch && doId !== null && p.state === 'OPEN' && texto(p.headRefName) && !BRANCH_DE_BASE.test(p.headRefName) && primeiroId(p.headRefName) === doId;
    if (!pelaBranch && !peloId) continue;
    if (ambiguos?.has(p.number) || jaFechou(p)) continue;
    const criado = ms(p.createdAt) ?? ms(p.mergedAt);
    if (nasceu !== null && criado !== null && criado < nasceu) continue;
    ligados.set(p.number, { ...p, fonte: pelaBranch ? 'branch' : 'id' });
  }
  return [...ligados.values()].sort((a, b) => a.number - b.number);
}
// o primeiro id de item da branch, como palavra e sem diferenciar maiúsculas: `feat/f30-x` → F30; `ref30`, `f30x` → nenhum
export const primeiroId = (branch) => { const m = /(?:^|[^a-z0-9])(f\d+)(?![a-z0-9])/i.exec(String(branch)); return m ? m[1].toUpperCase() : null; };
const branchesDoItem = (d, branchDaDona) => [...new Set([d?.branch, branchDaDona].filter((b) => texto(b) && !BRANCH_DE_BASE.test(b)))];

// A branch da dona: a do worktree (o git) vale sobre a da lista do app, que é a branch com que o app criou a sessão.
const branchDe = ({ linha, git }) => (texto(git?.branch) ? git.branch : linha?.branch ?? null);
// F444 (ADR 0030, item 6): a dona do Orca não tem linha na lista do app; a vida dela vem da lista de workers do Orca
const ehDoOrca = (id) => typeof id === 'string' && id.startsWith('orca_session_id:');

// → { etapa, prs, prsAbertos, prsMergeados, prsDescartados, mergeado, fatiaMergeada, donaViva, rodando, ultimaAtividade, parado, minParado, fontes }
// `linha`: a sessão da dona na lista do app (ou undefined); `git`: { aFrente, sujo, ultimoCommitMs } da branch dela, ou null;
// `prs`: os PRs do repositório que o `gh` leu (null: o gh não leu, vale o declarado).
// F444: `orca`: { viva } da dona do Orca (true, false, ou null = fora da vista: nunca morta); ela não tem `linha` nem turno visível.
// F460: `semListaDoApp`: a batida de leitura do Orca não tem a lista do app; a dona `local_` sem linha fica fora da vista (null).
// F430: `prsMergeados` são os ligados que o gh leu mergeados (o pane mostra `#N mergeado` com o número certo); `prsDescartados`,
// os gravados em `prs` que a batida tirou da conta (o merge de antes do item nascer ou da reabertura): o pane trata como novo o
// PR gravado que não está em nenhum dos dois, sem adivinhar pelo número.
export function deduzir({ id = null, item: d, linha = null, prs = null, git = null, agoraMs, prazoMin, ambiguos = null, orca = null, semListaDoApp = false }) {
  const ligados = prsDoItem(d, { prs, branchDaDona: branchDe({ linha, git }), ambiguos, id });
  const lidos = ligados.filter((p) => p.state); // os que o gh leu
  const abertos = lidos.filter((p) => p.state === 'OPEN');
  const valendo = lidos.filter((p) => p.state !== 'CLOSED'); // o PR fechado sem merge não conta
  const todosMergeados = valendo.length > 0 && valendo.every((p) => p.state === 'MERGED')
    && ligados.every((p) => p.state); // um PR que o gh não leu segura o fechamento
  const fatia = d?.maisFatias === true;
  const fontes = { prs: prs ? 'gh' : 'item', etapa: 'item', dona: linha ? 'sessoes' : orca ? 'orca' : 'item' };

  let etapa = d?.etapa ?? null;
  if (todosMergeados && !fatia) { etapa = 'feito'; fontes.etapa = 'gh'; }
  else if (abertos.length) { etapa = 'merge'; fontes.etapa = 'gh'; }
  else if (todosMergeados && fatia) { etapa = 'execucao'; fontes.etapa = 'gh'; }
  // em merge, o gh leu todos os PRs ligados e nenhum está aberto: o PR foi fechado sem merge (sem PR ligado, ou com um que o gh não leu, vale o declarado)
  else if (etapa === 'merge' && prs && ligados.length && ligados.every((p) => p.state)) { etapa = 'execucao'; fontes.etapa = 'gh'; }
  // o git só promove a `execucao` o item que ainda não começou: não rebaixa `merge` (o gh caído, o PR que o gh não achou)
  else if (git && (git.aFrente > 0 || git.sujo)) { if (!['design', 'execucao', 'validacao', 'merge'].includes(etapa)) etapa = 'execucao'; fontes.etapa = 'git'; }

  const temDona = texto(d?.donoLocalId);
  const donaViva = !temDona ? null : orca && !linha ? (typeof orca.viva === 'boolean' ? orca.viva : null)
    : !linha && semListaDoApp ? null : Boolean(linha && linha.isArchived !== true);
  // F470: a dona do Orca não tem `isRunning` na lista do app; o agente dela no Orca (`orca.rodando`) diz se trabalha agora
  const rodando = Boolean(donaViva && (linha ? linha.isRunning === true : orca?.rodando === true));
  const marcas = [ms(d?.atualizadoEm), donaViva ? ms(linha?.lastActivityAt) : null, git?.ultimoCommitMs ?? null, ...ligados.map((p) => ms(p.updatedAt))].filter((t) => t !== null);
  const ultimaAtividade = marcas.length ? Math.min(Math.max(...marcas), agoraMs) : null;
  const parado = !rodando && !d?.espera && !d?.trava && (ultimaAtividade === null || agoraMs - ultimaAtividade >= prazoMin * 60_000);
  return {
    // o PR que o gh não leu conta como aberto (o declarado): a cobrança do `--anotar` não some porque o gh caiu
    etapa, prs: ligados.map((p) => p.number), prsAbertos: ligados.filter((p) => !p.state || p.state === 'OPEN').map((p) => p.number),
    prsMergeados: ligados.filter((p) => p.state === 'MERGED').map((p) => p.number),
    prsDescartados: [...new Set(inteiros(d?.prs))].filter((n) => !ligados.some((p) => p.number === n)).sort((a, b) => a - b),
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
// F444: `donaDoOrca(id)` → { viva, rodando (F470), cwd } da dona do Orca (o registro de orca-sessoes e a lista de workers); o git dela sai do cwd
// registrado enquanto ela não está provada morta. F460: `semListaDoApp` (a batida de leitura do Orca): `linhas` são só as pastas dos
// workers do Orca, para achar o repositório; a dona `local_` sai fora da vista (donaViva null), nunca morta.
export function coletar({ itens, linhas, projetoDe, slug = (p) => String(p ?? '').toLowerCase(), agoraMs, prazoMin, ler = { prsDoRepositorio, gitDoWorktree }, donaDoOrca = () => null, semListaDoApp = false }) {
  prazoFinal = Date.now() + ORCAMENTO_MS();
  try {
    const porId = new Map(linhas.map((r) => [r.sessionId, r]));
    const viva = (r) => Boolean(r && r.isArchived !== true && texto(r.cwd));
    const orcaDe = (id) => { let o = null; try { o = donaDoOrca(id); } catch { /* fora da vista */ } return { viva: typeof o?.viva === 'boolean' ? o.viva : null, rodando: typeof o?.rodando === 'boolean' ? o.rodando : null, cwd: o?.cwd ?? null }; };
    const doProjeto = (r, p) => { try { return projetoDe(r) === p; } catch { return false; } };
    const repoDe = new Map(); // projeto → cwd
    for (const [, d] of itens) {
      const p = slug(d?.projeto);
      if (!p || repoDe.has(p)) continue;
      const dona = porId.get(d?.donoLocalId);
      const r = (viva(dona) && doProjeto(dona, p) ? dona : null) ?? linhas.find((x) => viva(x) && doProjeto(x, p));
      const o = !r && ehDoOrca(d?.donoLocalId) ? orcaDe(d.donoLocalId) : null;
      repoDe.set(p, r ? r.cwd : o && o.viva !== false && texto(o.cwd) ? o.cwd : null);
    }
    const prsPorProjeto = new Map();
    for (const [p, cwd] of repoDe) {
      const extras = [...itens.values()].filter((d) => slug(d?.projeto) === p).flatMap((d) => inteiros(d?.prs));
      prsPorProjeto.set(p, cwd ? ler.prsDoRepositorio(cwd, [...new Set(extras)]) : null);
    }
    // 1ª passada: o git de cada dona e os PRs que a branch liga (para achar o PR que a branch liga a mais de um item vivo)
    const base = new Map();
    const porBranch = new Map(); // `projeto#número` → os itens que a branch liga a ele
    for (const [F, d] of itens) {
      const linha = porId.get(d?.donoLocalId) ?? null;
      const orca = !linha && ehDoOrca(d?.donoLocalId) ? orcaDe(d.donoLocalId) : null;
      const git = viva(linha) ? ler.gitDoWorktree(linha.cwd) : orca && orca.viva !== false && texto(orca.cwd) ? ler.gitDoWorktree(orca.cwd) : null;
      const prs = prsPorProjeto.get(slug(d?.projeto)) ?? null;
      base.set(F, { linha, git, prs, orca });
      for (const pr of prsDoItem(d, { prs, branchDaDona: branchDe({ linha, git }), id: F })) {
        if (pr.fonte === 'branch') { const k = `${slug(d?.projeto)}#${pr.number}`; porBranch.set(k, new Set([...(porBranch.get(k) ?? []), F])); }
      }
    }
    const saida = new Map();
    for (const [F, d] of itens) {
      const { linha, git, prs, orca } = base.get(F);
      // fora da branch: o PR que a branch liga a outro item (a mais de um, ou a outro que não este: o id não o tira dele, F446),
      // e o que outro item do projeto já lista em `prs` (é dele)
      const ambiguos = new Set([...porBranch].filter(([k, quem]) => k.startsWith(`${slug(d?.projeto)}#`) && [...quem].some((G) => G !== F)).map(([k]) => Number(k.split('#').pop())));
      for (const [G, e] of itens) if (G !== F && slug(e?.projeto) === slug(d?.projeto)) for (const n of inteiros(e?.prs)) ambiguos.add(n);
      saida.set(F, deduzir({ id: F, item: d, linha, prs, git, agoraMs, prazoMin, ambiguos, orca, semListaDoApp }));
    }
    return saida;
  } finally { prazoFinal = Infinity; }
}
