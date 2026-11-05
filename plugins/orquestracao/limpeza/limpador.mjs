#!/usr/bin/env node
// Limpador de disco do kit (F428; nasceu como o limpador de worktrees do F15). Plano: docs/planos/2026-11-05-limpeza-de-disco.md.
// Três passos, todos em modo relatório por padrão; só apaga com --aplicar. Na dúvida, fica.
// - worktrees: remove a worktree que passa em TODOS os critérios, em todo repositório que o app conhece (ou nos --repo dados).
// - builds: na worktree parada há mais de N dias, apaga as pastas regeneráveis ignoradas (node_modules, .next, dist, .turbo); a worktree fica.
// - logs: o *.log / *.jsonl da pasta do kit acima do teto fica só com o fim (metade do teto), cortado em fim de linha.
// Falhou uma medição global (sessões, lsof, registro do app, protegidos, trava): nada se apaga na rodada (saída 2). Falhou uma
// medição de um repositório (git worktree list, origin ilegível, gh): só aquele repositório fica de fora do passo worktrees (saída 2).
// Repositório sem origin ou fora do GitHub fica de fora do passo worktrees como aviso (foraDoPasso), sem saída 2.
// Uso: node limpador.mjs [--aplicar [--se-ligado]] [--repo <caminho>]… [--passos worktrees,builds,logs] [--horas <n>]
//      [--dias-builds <n>] [--teto-log-mb <n>] [--json | --resumo] | --plist
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
  readFileSync, writeFileSync, appendFileSync, readdirSync, statSync, lstatSync, existsSync, realpathSync, mkdirSync, rmdirSync,
  rmSync, renameSync, chmodSync, openSync, readSync, closeSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname, resolve, sep } from 'node:path';

const HOME = homedir();
const E = process.env;
const BASE_KIT = E.LIMPADOR_BASE || E.HOOKS_CREWAI_BASE || join(HOME, '.claude', 'orquestracao');
const SAIDA = E.LIMPADOR_SAIDA_DIR || join(BASE_KIT, 'limpador');
const SESSOES_DIR = E.LIMPADOR_SESSOES_DIR || join(HOME, 'Library', 'Application Support', 'Claude', 'claude-code-sessions');
const APP_WORKTREES = E.LIMPADOR_APP_WORKTREES || join(HOME, 'Library', 'Application Support', 'Claude', 'git-worktrees.json');
const PROJETOS_DIR = E.LIMPADOR_PROJETOS_DIR || join(HOME, '.claude', 'projects');
const LSOF = E.LIMPADOR_LSOF || 'lsof';
const GH = E.LIMPADOR_GH || 'gh';
const GIT = E.LIMPADOR_GIT || 'git';
const agora = () => (E.LIMPADOR_AGORA ? Number(E.LIMPADOR_AGORA) : Date.now());
const H = 3600_000;
const DIA = 24 * H;
const PRAZO = 60_000;
const PASSOS = ['worktrees', 'builds', 'logs'];

class FalhaFechada extends Error {}
// Repositório que não está no GitHub (sem origin, ou origin em outro servidor): é o estado dele, não uma medição
// que falhou. Fica fora do passo worktrees como aviso, sem saída 2 (senão toda rodada agendada sairia 2).
class ForaDoGitHub extends FalhaFechada {}

// ---------- subprocessos (todos com prazo e SIGKILL; nunca engolem a mensagem) ----------
function rodarCmd(cmd, args, { cwd, input, prazo = PRAZO } = {}) {
  const r = spawnSync(cmd, args, {
    cwd, input, encoding: 'utf8', timeout: prazo, killSignal: 'SIGKILL', maxBuffer: 256 * 1024 * 1024,
  });
  const erro = r.error ? String(r.error.message || r.error) : '';
  const stderr = (r.stderr || '').trim();
  return { status: r.status, stdout: r.stdout || '', stderr, erro, ok: r.status === 0 && !r.error, motivo: stderr || erro || `saída ${r.status}${r.signal ? ` (sinal ${r.signal})` : ''}` };
}
const git = (cwd, args, opts = {}) => rodarCmd(GIT, ['--no-optional-locks', ...args], { cwd, ...opts });

// ---------- argumentos ----------
function lerArgs(argv) {
  const a = { aplicar: false, seLigado: false, repos: [], passos: [...PASSOS], horas: 2, diasBuilds: 7, tetoLogMb: 1, json: false, resumo: false, plist: false };
  const num = (v, nome) => { const n = Number(v); if (!Number.isFinite(n) || n < 0) throw new Error(`${nome} inválido: ${v}`); return n; };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === '--aplicar') a.aplicar = true;
    else if (v === '--se-ligado') a.seLigado = true;
    else if (v === '--json') a.json = true;
    else if (v === '--resumo') a.resumo = true;
    else if (v === '--plist') a.plist = true;
    else if (v === '--repo') { const r = argv[++i]; if (!r) throw new Error('--repo sem caminho'); a.repos.push(r); }
    else if (v === '--horas') a.horas = num(argv[++i], '--horas');
    else if (v === '--dias-builds') a.diasBuilds = num(argv[++i], '--dias-builds');
    else if (v === '--teto-log-mb') { a.tetoLogMb = num(argv[++i], '--teto-log-mb'); if (a.tetoLogMb === 0) throw new Error('--teto-log-mb precisa ser maior que zero'); }
    else if (v === '--passos') {
      a.passos = String(argv[++i] || '').split(',').map((x) => x.trim()).filter(Boolean);
      const ruim = a.passos.filter((p) => !PASSOS.includes(p));
      if (ruim.length || a.passos.length === 0) throw new Error(`--passos aceita ${PASSOS.join(',')}; recebi ${ruim.join(',') || 'nada'}`);
    } else throw new Error(`argumento desconhecido: ${v}`);
  }
  return a;
}

// ---------- caminhos ----------
function real(p) {
  try { return realpathSync(p); } catch { return resolve(p); }
}
const dentro = (cwd, caminho) => cwd === caminho || cwd.startsWith(caminho + sep);

// ---------- medições globais (uma vez por rodada) ----------
function* arquivosLocal(dir, visitadas = new Set([real(dir)])) {
  let entradas;
  try { entradas = readdirSync(dir, { withFileTypes: true }); } catch (e) { throw new FalhaFechada(`não consegui ler o registro de sessões (${dir}): ${e.message}`); }
  for (const e of entradas) {
    const p = join(dir, e.name);
    // `statSync` segue o symlink (o `Dirent` não): pasta de conta ligada por elo também é lida
    let st;
    try { st = statSync(p); } catch (err) { throw new FalhaFechada(`não consegui ler ${p} no registro de sessões: ${err.message}`); }
    if (st.isDirectory()) {
      const rp = real(p);
      if (visitadas.has(rp)) continue;
      visitadas.add(rp);
      yield* arquivosLocal(p, visitadas);
    } else if (st.isFile() && e.name.startsWith('local_') && e.name.endsWith('.json')) yield p;
  }
}

// `vivas`: as pastas das sessões não arquivadas (critério 2). `pastas`: as de TODAS as sessões, vivas ou não, para descobrir repositórios.
function lerSessoes() {
  const vivas = [];
  const pastasTodas = new Set();
  let lidas = 0;
  for (const f of arquivosLocal(SESSOES_DIR)) {
    let r;
    try { r = JSON.parse(readFileSync(f, 'utf8')); } catch (e) { throw new FalhaFechada(`registro de sessões ilegível: ${f} (${e.message})`); }
    lidas++;
    for (const c of [r.cwd, r.originCwd, r.worktreePath]) if (typeof c === 'string' && c) pastasTodas.add(c);
    if (r.isArchived !== true) {
      // o worktree vale para a sessão pelo cwd, pela origem, pelo worktree dela e pelas pastas que ela adicionou
      // (o registro as guarda em `sessionPermissionUpdates[]`, entradas `type: "addDirectories"`, campo `directories`)
      const adicionadas = (Array.isArray(r.sessionPermissionUpdates) ? r.sessionPermissionUpdates : [])
        .filter((u) => u && u.type === 'addDirectories' && Array.isArray(u.directories)).flatMap((u) => u.directories);
      const pastas = [r.cwd, r.originCwd, r.worktreePath, ...adicionadas];
      for (const c of pastas) if (typeof c === 'string' && c) vivas.push({ id: r.sessionId || f, cwd: real(c), titulo: r.title || '' });
    }
  }
  if (lidas === 0) throw new FalhaFechada(`registro de sessões vazio: nenhum local_*.json lido em ${SESSOES_DIR}, então não sei quais sessões estão vivas`);
  return { vivas, pastas: [...pastasTodas], lidas };
}

function lerLsof() {
  const r = rodarCmd(LSOF, ['-d', 'cwd', '-Fn']);
  if (!r.ok) throw new FalhaFechada(`lsof falhou: ${r.motivo}`);
  const cwds = r.stdout.split('\n').filter((l) => l.startsWith('n')).map((l) => real(l.slice(1)));
  if (cwds.length === 0) throw new FalhaFechada('lsof saiu sem nenhuma linha de diretório de trabalho (a própria rodada tem um): não consegui medir');
  return cwds;
}

function lerPRs(repo) {
  let url = E.LIMPADOR_GH_REPO;
  if (!url) {
    const o = git(repo, ['config', '--get', 'remote.origin.url']);
    if (o.status === 1 && !o.stderr && !o.erro) throw new ForaDoGitHub('o repositório não tem origin');
    if (!o.ok) throw new FalhaFechada(`não li a origin do repositório: ${o.motivo}`);
    const m = /github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?\s*$/.exec(o.stdout.trim());
    if (!m) throw new ForaDoGitHub(`a origin não parece um repositório do GitHub: ${o.stdout.trim()}`);
    url = m[1];
  }
  const r = rodarCmd(GH, ['pr', 'list', '--repo', url, '--state', 'all', '--limit', '1000', '--json', 'number,state,headRefName,headRefOid'], { prazo: 120_000 });
  if (!r.ok) throw new FalhaFechada(`gh falhou: ${r.motivo}`);
  let prs;
  try { prs = JSON.parse(r.stdout); } catch (e) { throw new FalhaFechada(`gh devolveu algo que não é JSON (${e.message})`); }
  if (!Array.isArray(prs)) throw new FalhaFechada('gh devolveu JSON que não é uma lista de PRs');
  return prs;
}

function lerReservas() {
  let j;
  try { j = JSON.parse(readFileSync(APP_WORKTREES, 'utf8')); } catch (e) { throw new FalhaFechada(`não consegui ler o registro de worktrees do app (${APP_WORKTREES}): ${e.message}`); }
  if (!j || typeof j.worktrees !== 'object' || j.worktrees === null) throw new FalhaFechada('o registro de worktrees do app não tem o formato esperado');
  return Object.values(j.worktrees).filter((w) => w && typeof w.path === 'string')
    .map((w) => ({ path: real(w.path), leasedBy: w.leasedBy ?? null, nome: w.name, baseRepo: typeof w.baseRepo === 'string' ? w.baseRepo : null }));
}

function lerWorktrees(repo) {
  const r = git(repo, ['worktree', 'list', '--porcelain']);
  if (!r.ok) throw new FalhaFechada(`git worktree list falhou: ${r.motivo}`);
  const lista = [];
  let atual = null;
  for (const linha of r.stdout.split('\n')) {
    if (linha.startsWith('worktree ')) { atual = { caminho: linha.slice(9), branch: null, head: '', travado: false, travadoMotivo: '', prunable: false, destacado: false }; lista.push(atual); }
    else if (!atual) continue;
    else if (linha.startsWith('HEAD ')) atual.head = linha.slice(5);
    else if (linha.startsWith('branch ')) atual.branch = linha.slice(7).replace(/^refs\/heads\//, '');
    else if (linha === 'detached') atual.destacado = true;
    else if (linha.startsWith('locked')) { atual.travado = true; atual.travadoMotivo = linha.slice(6).trim(); }
    else if (linha.startsWith('prunable')) atual.prunable = true;
  }
  if (lista.length === 0) throw new FalhaFechada('git worktree list não devolveu nenhum worktree');
  return lista;
}

function protegidos() {
  // ausente vale lista vazia (máquina nova, kit recém-instalado); existir e não abrir é falha fechada:
  // aí a lista existe e não sei o que ela protege
  const arq = join(SAIDA, 'protegidos.txt');
  if (!existsSync(arq)) return [];
  let txt;
  try { txt = readFileSync(arq, 'utf8'); } catch (e) { throw new FalhaFechada(`não consegui ler a lista de protegidos (${arq}): ${e.message}`); }
  return txt.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map(real);
}

// Os repositórios da rodada: os --repo dados, ou todo repositório que o app conhece (o `baseRepo` do registro de worktrees
// e as pastas de todas as sessões), um por diretório git comum. Pasta que não existe ou não é git fica de fora em silêncio:
// ela não tem worktree para limpar.
function descobrirRepos(reservas, pastas) {
  const candidatos = new Set();
  for (const p of [...reservas.map((r) => r.baseRepo), ...pastas]) {
    if (typeof p !== 'string' || !p) continue;
    const m = /^(.*?)\/\.claude\/worktrees\/[^/]+/.exec(p); // a worktree do app leva ao mesmo repo que a mãe: poupa um git
    candidatos.add(m ? m[1] : p);
  }
  const porComum = new Map();
  for (const c of [...candidatos].sort()) {
    if (!existsSync(c)) continue;
    const r = git(c, ['rev-parse', '--path-format=absolute', '--git-common-dir']);
    if (!r.ok || !r.stdout.trim()) continue;
    const comum = real(r.stdout.trim());
    if (!porComum.has(comum)) porComum.set(comum, c);
  }
  return [...porComum.values()];
}

// ---------- critérios por worktree ----------
const REGENERAVEIS_DIR = new Set(['node_modules', 'dist', '.next', '.turbo']);
// `aberta`: o caminho é um arquivo achado DENTRO de uma pasta ignorada que o git reportou inteira e que não é
// regenerável (`.estudos/`). Aí só vale o nome do arquivo: um `dist/` no meio do caminho não torna o trabalho
// de dentro de `.estudos/` regenerável. A pasta que o git reporta já é decidida pelo caminho dela.
function regeneravel(caminho, { aberta = false } = {}) {
  const p = caminho.replace(/\/$/, '');
  const segs = p.split('/');
  const nome = segs[segs.length - 1];
  if (!aberta && segs.some((s) => REGENERAVEIS_DIR.has(s) || /^\.next-\d+$/.test(s))) return true;
  if (nome.endsWith('.tsbuildinfo') || nome === 'next-env.d.ts' || nome === '.DS_Store') return true;
  if (!aberta && /(^|\/)supabase\/\.temp(\/|$)/.test(p)) return true;
  return p === '.impeccable/hook.cache.json' || p === '.impeccable/hook.pending.json' || p === '.claude/settings.local.json'
    || p.endsWith('/.impeccable/hook.cache.json') || p.endsWith('/.impeccable/hook.pending.json') || p.endsWith('/.claude/settings.local.json');
}

function statusZ(wt, extra) {
  const r = git(wt, ['status', '--porcelain=v1', '-z', '--untracked-files=all', ...extra]);
  if (!r.ok) return { erro: r.motivo };
  const campos = r.stdout.split('\0').filter((x) => x !== '');
  const itens = [];
  for (let i = 0; i < campos.length; i++) {
    const c = campos[i];
    const xy = c.slice(0, 2);
    itens.push({ xy, caminho: c.slice(3) });
    if (xy[0] === 'R' || xy[0] === 'C' || xy[1] === 'R' || xy[1] === 'C') i++; // o campo seguinte é o caminho de origem
  }
  return { itens };
}

const OPERACOES = ['MERGE_HEAD', 'REBASE_HEAD', 'rebase-merge', 'rebase-apply', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'BISECT_LOG', 'sequencer'];

function c4(wt) {
  // `git status` confia no índice: skip-worktree e assume-unchanged escondem mudança. `ls-files -v` marca os
  // dois (minúscula = assume-unchanged, `S` = skip-worktree); qualquer um deles conta como sujo.
  const lv = git(wt, ['ls-files', '-v', '-z']);
  if (!lv.ok) return `não consegui medir as marcas do índice: ${lv.motivo}`;
  const marcados = lv.stdout.split('\0').filter((x) => /^[a-zS] /.test(x)).map((x) => x.slice(2));
  if (marcados.length) return `arquivo(s) com marca skip-worktree ou assume-unchanged, que escondem mudança do git status: ${marcados.slice(0, 5).join(', ')}${marcados.length > 5 ? ', …' : ''}`;
  const s = statusZ(wt, []);
  if (s.erro) return `não consegui medir a árvore: ${s.erro}`;
  const sujos = s.itens.filter((i) => i.xy !== '!!');
  if (sujos.length === 0) return null;
  const exemplo = sujos.slice(0, 5).map((i) => i.caminho).join(', ');
  return `árvore suja: ${sujos.length} arquivo(s) modificados ou não rastreados (${exemplo}${sujos.length > 5 ? ', …' : ''})`;
}
// Um caminho ignorado só é regenerável se TODAS valem: (a) o NOME casa a lista (`regeneravel`); (b) a pasta-mãe da pasta
// regenerável tem `package.json` RASTREADO (é um pacote que gera build, não uma pasta de trabalho com um `.gitkeep`);
// (c) uma SONDA com o mesmo formato do caminho, cada segmento regenerável trocado por um nome aleatório, NÃO é ignorada:
// se é, outra regra cobre aquele lugar (`rascunhos/*/`, `lib/*/`, `rascunhos/*` com negações) e o trabalho de dentro fica.
// Erro de medição em qualquer uma: não é regenerável.
const DIR_REGENERAVEL = (seg) => REGENERAVEIS_DIR.has(seg) || /^\.next-\d+$/.test(seg);
function maeTemPackageJson(wt, caminho, cache) {
  const segs = caminho.replace(/\/$/, '').split('/');
  const i = segs.findIndex(DIR_REGENERAVEL);
  if (i < 0) return { ok: true }; // sem pasta regenerável no caminho (regra de arquivo por nome)
  const arq = [...segs.slice(0, i), 'package.json'].join('/'); // na raiz é o `package.json` da raiz
  if (!cache.has(arq)) {
    const r = git(wt, ['ls-files', '--error-unmatch', '--', arq]);
    cache.set(arq, r.status === 0 ? true : r.status === 1 ? false : { erro: r.motivo });
  }
  const v = cache.get(arq);
  return typeof v === 'object' ? { erro: v.erro } : { ok: v };
}
function sondaNaoIgnorada(wt, caminho) {
  const dir = caminho.endsWith('/');
  const segs = caminho.replace(/\/$/, '').split('/');
  if (!segs.some(DIR_REGENERAVEL)) return true;
  const sorteio = () => `zq${randomBytes(4).toString('hex')}`; // sem ponto e sem hífen, sorteado a cada medição
  const sonda = segs.map((x) => (DIR_REGENERAVEL(x) ? sorteio() : x));
  if (dir) sonda.push('limpador-sonda');
  return git(wt, ['check-ignore', '-q', '--no-index', '--', sonda.join('/')]).status === 1; // 0 ignorada, outro: erro
}

function c6(wt) {
  const s = statusZ(wt, ['--ignored=matching']);
  if (s.erro) return `não consegui medir os ignorados: ${s.erro}`;
  const cache = new Map();
  const regeneravelAqui = (caminho, opts) => {
    if (!regeneravel(caminho, opts)) return false;
    if (opts?.aberta) return true;
    const m = maeTemPackageJson(wt, caminho, cache);
    if (m.ok !== true) return false; // erro de medição: não é regenerável
    return sondaNaoIgnorada(wt, caminho);
  };
  // `--ignored=matching` recolhe a pasta toda numa linha (`.claude/` quando só há settings.local.json dentro):
  // a pasta que não é regenerável por nome é aberta, arquivo a arquivo, antes de decidir
  const fora = [];
  for (const i of s.itens.filter((x) => x.xy === '!!' && !regeneravelAqui(x.caminho))) {
    if (!i.caminho.endsWith('/')) { fora.push(i); continue; }
    const l = git(wt, ['ls-files', '--others', '--ignored', '--exclude-standard', '-z', '--', i.caminho]);
    if (!l.ok) return `não consegui abrir a pasta ignorada ${i.caminho}: ${l.motivo}`;
    const arqs = l.stdout.split('\0').filter(Boolean);
    if (arqs.length === 0) fora.push(i); // pasta ignorada que não consegui abrir: conta como fora da lista
    for (const a of arqs) if (!regeneravel(a, { aberta: true })) fora.push({ xy: '!!', caminho: a });
  }
  if (fora.length === 0) return null;
  return `ignorado fora da lista de regeneráveis: ${fora.slice(0, 8).map((i) => i.caminho).join(', ')}${fora.length > 8 ? ', …' : ''}`;
}
function gitdirDe(wt) {
  const r = git(wt, ['rev-parse', '--absolute-git-dir']);
  return r.ok ? r.stdout.trim() : null;
}
function c7(wt) {
  const gd = gitdirDe(wt);
  if (!gd) return 'não consegui achar o diretório git do worktree';
  const achadas = OPERACOES.filter((o) => existsSync(join(gd, o)));
  return achadas.length ? `operação pausada no git (${achadas.join(', ')})` : null;
}

function mtime(p) {
  try { return statSync(p).mtimeMs; } catch { return 0; }
}
function transcriptDoSubagente(nome) {
  const m = /^agent-(.+)$/.exec(nome);
  if (!m) return 0;
  let melhor = 0;
  try {
    for (const proj of readdirSync(PROJETOS_DIR)) {
      const pdir = join(PROJETOS_DIR, proj);
      let sess;
      try { sess = readdirSync(pdir); } catch { continue; }
      for (const s of sess) melhor = Math.max(melhor, mtime(join(pdir, s, 'subagents', `agent-${m[1]}.jsonl`)));
    }
  } catch { /* sem pasta de projetos: sem transcript */ }
  return melhor;
}
// O Claude Code guarda o transcript da sessão em `~/.claude/projects/<cwd com todo caractere não alfanumérico trocado por ->/`.
function transcriptDaSessao(caminhos) {
  let melhor = 0;
  for (const c of caminhos) {
    const d = join(PROJETOS_DIR, c.replace(/[^a-zA-Z0-9]/g, '-'));
    let arqs;
    try { arqs = readdirSync(d); } catch { continue; }
    for (const a of arqs) if (a.endsWith('.jsonl')) melhor = Math.max(melhor, mtime(join(d, a)));
  }
  return melhor;
}
// A hora da última ENTRADA do reflog, lida do conteúdo. O mtime do `logs/HEAD` não serve: o `git gc --auto` roda
// `reflog expire --all`, que regrava o reflog de todas as worktrees sem entrada nova (medido em 05/11: 57 de uma vez).
// Formato da linha: `<antigo> <novo> <nome> <<email>> <segundos> <fuso>\t<mensagem>`.
function ultimaEntradaDoReflog(arq) {
  let txt;
  try { txt = readFileSync(arq, 'utf8'); } catch { return 0; }
  const linhas = txt.split('\n').filter(Boolean);
  for (let i = linhas.length - 1; i >= 0; i--) {
    const m = /> (\d+) [+-]\d{4}(?:\t|$)/.exec(linhas[i]);
    if (m) return Number(m[1]) * 1000;
  }
  return 0;
}

// A última atividade do worktree: a maior entre o último commit, a última entrada do reflog, o mtime do índice e os
// transcripts (o do subagente dono da worktree e o da sessão cujo cwd é ela). O relógio é lido ANTES de qualquer git
// que possa tocar o índice.
function atividade(w) {
  const wt = w.caminho;
  const gd = gitdirDe(wt);
  const fontes = {
    'índice': gd ? mtime(join(gd, 'index')) : 0,
    reflog: gd ? ultimaEntradaDoReflog(join(gd, 'logs', 'HEAD')) : 0,
    'transcript do subagente': transcriptDoSubagente(wt.split(sep).pop()),
    'transcript da sessão': transcriptDaSessao([...new Set([wt, w.caminhoListado].filter(Boolean))]),
  };
  const ct = git(wt, ['log', '-1', '--format=%ct']);
  const commitMs = ct.ok && ct.stdout.trim() ? Number(ct.stdout.trim()) * 1000 : NaN;
  if (Number.isNaN(commitMs)) return { erro: `não consegui ler a hora do último commit: ${ct.motivo}` };
  fontes.commit = commitMs;
  let fonte = 'commit';
  for (const [k, v] of Object.entries(fontes)) if (v > fontes[fonte]) fonte = k;
  return { ms: fontes[fonte], fonte };
}

function commitsSemPush(wt, oids) {
  // oid de PR que não existe localmente derruba o rev-list: filtra pelos que existem
  let existentes = oids;
  if (oids.length) {
    const ck = git(wt, ['cat-file', '--batch-check'], { input: `${oids.join('\n')}\n` });
    if (!ck.ok) return { erro: ck.motivo };
    const lin = ck.stdout.split('\n');
    existentes = oids.filter((_, i) => lin[i] && !/missing/.test(lin[i]));
  }
  const r = git(wt, ['rev-list', 'HEAD', ...(existentes.length ? ['--stdin'] : []), '--not', '--remotes'], { input: existentes.length ? `${existentes.map((o) => `^${o}`).join('\n')}\n` : undefined });
  if (!r.ok) return { erro: r.motivo };
  return { commits: r.stdout.split('\n').filter(Boolean) };
}

// Mede os critérios de um worktree. `ctx`: sessoes, cwds, prs, reservas, protegidos, minHoras. Devolve a lista de motivos.
function avaliar(w, ctx, { so } = {}) {
  const motivos = [];
  const add = (criterio, texto) => motivos.push({ criterio, texto });
  const wt = w.caminho;
  const quer = (n) => !so || so.includes(n);

  if (quer(1)) {
    if (w.principal) add(1, 'checkout principal do repositório');
    if (ctx.protegidos.includes(wt)) add(1, 'protegido (listado em protegidos.txt)');
    if (w.travado) add(1, `travado (locked)${w.travadoMotivo ? `: ${w.travadoMotivo}` : ''}`);
  }
  if (motivos.length && !so) return motivos; // principal/protegido/travado: não mede o resto
  if (quer(2)) {
    const vivas = ctx.sessoes.filter((s) => dentro(s.cwd, wt));
    if (vivas.length) add(2, `sessão não arquivada com diretório de trabalho aqui (${vivas.slice(0, 3).map((s) => s.titulo || s.id).join('; ')})`);
  }
  if (quer(3)) {
    const procs = ctx.cwds.filter((c) => dentro(c, wt));
    if (procs.length) add(3, `${procs.length} processo(s) com diretório de trabalho dentro`);
  }
  if (quer(9)) {
    const a = atividade(w);
    if (a.erro) add(9, a.erro);
    else {
      const horas = (agora() - a.ms) / H;
      if (horas < ctx.minHoras) add(9, `parado há menos de ${ctx.minHoras} h (última atividade há ${horas.toFixed(1)} h, pelo ${a.fonte})`);
    }
  }
  if (quer(4)) { const m = c4(wt); if (m) add(4, m); }
  if (quer(5)) {
    const oids = (w.branch ? ctx.prs.filter((p) => p.headRefName === w.branch) : ctx.prs).map((p) => p.headRefOid).filter(Boolean);
    const r = commitsSemPush(wt, oids);
    if (r.erro) add(5, `não consegui medir os commits sem push: ${r.erro}`);
    else if (r.commits.length) add(5, `${r.commits.length} commit(s) sem push${w.branch ? '' : ' (HEAD destacado)'}: ${r.commits.slice(0, 5).map((c) => c.slice(0, 7)).join(' ')}`);
  }
  if (quer(6)) { const m = c6(wt); if (m) add(6, m); }
  if (quer(7)) { const m = c7(wt); if (m) add(7, m); }
  if (quer(8) && w.branch) {
    const abertos = ctx.prs.filter((p) => p.state === 'OPEN' && p.headRefName === w.branch);
    if (abertos.length) add(8, `PR aberto da branch (#${abertos.map((p) => p.number).join(', #')})`);
  }
  if (quer(10)) {
    const res = ctx.reservas.find((r) => r.path === wt && !r.leasedBy);
    if (res) add(10, 'reservado pelo app para a próxima sessão');
  }
  return motivos;
}

// ---------- passo builds ----------
// As pastas que o passo apagaria: a pasta ignorada que o git reporta inteira, cujo ÚLTIMO segmento é regenerável
// (`node_modules/`, `apps/web/.next/`), com a mesma prova do critério 6 (package.json rastreado na mãe, sonda não
// ignorada). Elo simbólico e pasta cujo caminho real sai da worktree ficam.
function alvosDeBuild(wt) {
  const s = statusZ(wt, ['--ignored=matching']);
  if (s.erro) return { erro: `não consegui medir os ignorados: ${s.erro}` };
  const cache = new Map();
  const alvos = [];
  for (const i of s.itens) {
    if (i.xy !== '!!' || !i.caminho.endsWith('/')) continue;
    const segs = i.caminho.replace(/\/$/, '').split('/');
    if (!DIR_REGENERAVEL(segs[segs.length - 1]) || segs.slice(0, -1).some(DIR_REGENERAVEL)) continue;
    if (maeTemPackageJson(wt, i.caminho, cache).ok !== true) continue;
    if (!sondaNaoIgnorada(wt, i.caminho)) continue;
    const abs = join(wt, i.caminho);
    let st;
    try { st = lstatSync(abs); } catch { continue; }
    if (st.isSymbolicLink() || !st.isDirectory()) continue;
    const rp = real(abs);
    if (rp === wt || !dentro(rp, wt)) continue;
    const du = rodarCmd('du', ['-sk', abs], { prazo: 300_000 });
    const kb = du.ok ? Number.parseInt(du.stdout, 10) : NaN;
    alvos.push({ caminho: i.caminho.replace(/\/$/, ''), abs, kb: Number.isFinite(kb) ? kb : null });
  }
  return { alvos };
}

function passoBuilds(repoRel, lista, ctx, args, aplicar, rel, jaSaem) {
  for (const w of lista) {
    if (w.principal || w.travado || w.prunable || jaSaem.has(w.caminho) || !existsSync(w.caminho)) continue;
    if (ctx.protegidos.includes(w.caminho)) continue;
    if (ctx.reservas.some((r) => r.path === w.caminho && !r.leasedBy)) continue; // pronta para a próxima sessão: fica inteira
    if (ctx.sessoes.some((s) => dentro(s.cwd, w.caminho))) continue;
    if (ctx.cwds.some((c) => dentro(c, w.caminho))) continue;
    const a = atividade(w);
    if (a.erro) continue;
    const dias = (agora() - a.ms) / DIA;
    if (dias < args.diasBuilds) continue;
    const r = alvosDeBuild(w.caminho);
    if (r.erro) { rel.erros.push({ caminho: w.caminho, mensagem: `builds: ${r.erro}` }); continue; }
    if (r.alvos.length === 0) continue;
    const item = { repo: repoRel, caminho: w.caminho, branch: w.branch || '(HEAD destacado)', diasParado: Number(dias.toFixed(1)), pastas: r.alvos.map(({ caminho, kb }) => ({ caminho, kb })), kb: r.alvos.reduce((s, x) => s + (x.kb || 0), 0) };
    if (!aplicar) { rel.builds.seriamLiberados.push(item); continue; }
    // reconfere o processo dentro logo antes de apagar: um `npm run dev` aberto agora usa o node_modules
    let cwds;
    try { cwds = lerLsof(); } catch (e) { rel.erros.push({ caminho: w.caminho, mensagem: `builds: reconferência antes de apagar falhou: ${e.message}` }); continue; }
    if (cwds.some((c) => dentro(c, w.caminho))) continue;
    const feitos = [];
    for (const alvo of r.alvos) {
      try { rmSync(alvo.abs, { recursive: true }); feitos.push({ caminho: alvo.caminho, kb: alvo.kb }); } catch (e) { rel.erros.push({ caminho: alvo.abs, mensagem: `builds: não consegui apagar: ${e.message}` }); }
    }
    if (feitos.length) rel.builds.liberados.push({ ...item, pastas: feitos, kb: feitos.reduce((s, x) => s + (x.kb || 0), 0) });
  }
}

// ---------- passo logs ----------
const PASTAS_FORA_DOS_LOGS = new Set(['backups', 'arquivo-morto', 'node_modules', '.git', 'limpador.trava']);
function* logsDoKit(dir) {
  let entradas;
  try { entradas = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entradas) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (!PASTAS_FORA_DOS_LOGS.has(e.name)) yield* logsDoKit(p); }
    else if (e.isFile() && (e.name.endsWith('.log') || e.name.endsWith('.jsonl'))) yield p;
  }
}

function cortarLog(arq, st, manter) {
  const fd = openSync(arq, 'r');
  const buf = Buffer.alloc(manter);
  let lidos;
  try { lidos = readSync(fd, buf, 0, manter, st.size - manter); } finally { closeSync(fd); }
  const pedaco = buf.subarray(0, lidos);
  const nl = pedaco.indexOf(10);
  if (nl < 0 || nl === pedaco.length - 1) throw new Error('o fim do arquivo não tem quebra de linha onde cortar');
  const resto = pedaco.subarray(nl + 1);
  const modo = st.mode & 0o7777;
  const tmp = `${arq}.corte-${process.pid}`;
  writeFileSync(tmp, resto, { mode: modo });
  chmodSync(tmp, modo);
  renameSync(tmp, arq);
  return resto.length;
}

function passoLogs(args, aplicar, rel) {
  const teto = Math.floor(args.tetoLogMb * 1024 * 1024);
  const manter = Math.max(1, Math.floor(teto / 2));
  for (const arq of logsDoKit(BASE_KIT)) {
    let st;
    try { st = lstatSync(arq); } catch { continue; }
    if (!st.isFile() || st.size <= teto) continue;
    const item = { caminho: arq, kbAntes: Math.round(st.size / 1024) };
    if (!aplicar) { rel.logs.seriamCortados.push({ ...item, kbDepois: Math.round(manter / 1024) }); continue; }
    try { rel.logs.cortados.push({ ...item, kbDepois: Math.round(cortarLog(arq, st, manter) / 1024) }); } catch (e) { rel.erros.push({ caminho: arq, mensagem: `logs: não consegui cortar: ${e.message}` }); }
  }
}

// ---------- rodada ----------
function novoRelatorio(args) {
  return {
    quando: new Date(agora()).toISOString(), modo: args.aplicar ? 'aplicar' : 'relatório', passos: args.passos,
    horas: args.horas, diasBuilds: args.diasBuilds, tetoLogMb: args.tetoLogMb,
    falhaFechada: null, avisos: [], repos: [],
    removidos: [], seriamRemovidos: [], mantidos: [], pastasSoltas: [], erros: [],
    builds: { liberados: [], seriamLiberados: [] }, logs: { cortados: [], seriamCortados: [] },
  };
}

function rodada(args) {
  const rel = novoRelatorio(args);
  const quer = (p) => args.passos.includes(p);
  let trava = null;
  try {
    trava = pegarTrava(rel);
    let aplicar = args.aplicar;
    if (aplicar && args.seLigado && !existsSync(join(SAIDA, 'aplicar-ligado'))) {
      aplicar = false;
      rel.avisos.push(`Remoção desligada: não existe o arquivo aplicar-ligado em ${SAIDA}, então esta rodada só relata.`);
    }
    rel.modo = aplicar ? 'aplicar' : 'relatório';

    if (quer('worktrees') || quer('builds')) {
      const sess = lerSessoes();
      const reservas = lerReservas();
      const ctx = { sessoes: sess.vivas, cwds: lerLsof(), reservas, protegidos: protegidos(), minHoras: args.horas, prs: [] };
      const repos = args.repos.length ? args.repos : descobrirRepos(reservas, sess.pastas);
      if (!args.repos.length) rel.avisos.push(`Repositórios descobertos pelo registro do app e pelas sessões: ${repos.length}.`);
      for (const r of repos) rodadaDoRepo(r, ctx, args, aplicar, rel, quer);
    }
    if (quer('logs')) passoLogs(args, aplicar, rel);
  } catch (e) {
    if (e instanceof FalhaFechada) rel.falhaFechada = e.message;
    else rel.falhaFechada = `erro inesperado: ${e.stack || e.message}`;
  } finally {
    if (trava) try { rmdirSync(trava); } catch { /* já liberada */ }
  }
  return rel;
}

function rodadaDoRepo(repoArg, ctx, args, aplicar, rel, quer) {
  const info = { repo: real(repoArg), worktrees: 0, falhaFechada: null, foraDoPasso: null };
  rel.repos.push(info);
  let lista;
  try {
    lista = lerWorktrees(info.repo).map((w, i) => ({ ...w, caminhoListado: w.caminho, caminho: real(w.caminho), principal: i === 0 }));
  } catch (e) {
    if (!(e instanceof FalhaFechada)) throw e;
    info.falhaFechada = e.message;
    return;
  }
  const principal = lista[0].caminho;
  info.repo = principal;
  info.worktrees = lista.length;
  const jaSaem = new Set();
  if (quer('worktrees')) {
    let prs = null;
    try { prs = lerPRs(principal); } catch (e) {
      if (!(e instanceof FalhaFechada)) throw e;
      if (e instanceof ForaDoGitHub) info.foraDoPasso = e.message;
      else info.falhaFechada = e.message;
    }
    if (prs) {
      const ctxRepo = { ...ctx, prs };
      const candidatos = [];
      for (const w of lista) {
        const base = { repo: principal, caminho: w.caminho, branch: w.branch || '(HEAD destacado)', head: w.head.slice(0, 7) };
        if (w.prunable || !existsSync(w.caminho)) {
          rel.mantidos.push({ ...base, motivos: [{ criterio: 0, texto: 'a pasta não existe mais (registro velho); não mexo' }] });
          continue;
        }
        const motivos = avaliar(w, ctxRepo);
        if (motivos.length) rel.mantidos.push({ ...base, motivos });
        else candidatos.push({ w, base });
      }
      for (const { w, base } of candidatos) {
        jaSaem.add(w.caminho);
        if (!aplicar) { rel.seriamRemovidos.push(base); continue; }
        removerUm(principal, w, base, rel);
      }
      const conhecidos = new Set(lista.map((w) => w.caminho));
      const dirSoltas = join(principal, '.claude', 'worktrees');
      try {
        for (const e of readdirSync(dirSoltas, { withFileTypes: true })) {
          const p = real(join(dirSoltas, e.name));
          if (e.isDirectory() && !conhecidos.has(p)) rel.pastasSoltas.push({ repo: principal, caminho: join(dirSoltas, e.name) });
        }
      } catch { /* sem .claude/worktrees */ }
    }
  }
  // a worktree que sai (ou sairia) inteira não entra no passo builds; a que o git recusou remover entra
  for (const m of rel.mantidos) if (m.repo === principal) jaSaem.delete(m.caminho);
  if (quer('builds')) passoBuilds(principal, lista, ctx, args, aplicar, rel, jaSaem);
}

function pegarTrava(rel) {
  const trava = join(SAIDA, 'limpador.trava');
  mkdirSync(SAIDA, { recursive: true });
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    try { mkdirSync(trava); return trava; } catch (e) {
      if (e.code !== 'EEXIST') throw new FalhaFechada(`não consegui criar a trava: ${e.message}`);
      const idadeH = (Date.now() - mtime(trava)) / H;
      if (idadeH <= 1) throw new FalhaFechada(`outra rodada em curso (a trava ${trava} tem ${idadeH.toFixed(1)} h)`);
      rel.avisos.push(`Trava abandonada: ${trava} tinha ${idadeH.toFixed(1)} h; foi dada como abandonada e removida.`);
      try { rmdirSync(trava); } catch (e2) { throw new FalhaFechada(`não consegui remover a trava abandonada: ${e2.message}`); }
    }
  }
  throw new FalhaFechada('não consegui pegar a trava');
}

function removerUm(repo, w, base, rel) {
  // a primeira passada pode ter minutos de idade: refaz 3 (nova chamada de lsof), 4, 6 e 7 para este worktree
  let cwds;
  try { cwds = lerLsof(); } catch (e) { rel.mantidos.push({ ...base, motivos: [{ criterio: 3, texto: `reconferência antes de remover falhou: ${e.message}` }] }); return; }
  const motivos = avaliar(w, { cwds, sessoes: [], prs: [], reservas: [], protegidos: [], minHoras: 0 }, { so: [3, 4, 6, 7] });
  if (motivos.length) { rel.mantidos.push({ ...base, motivos: motivos.map((m) => ({ ...m, texto: `na reconferência antes de remover: ${m.texto}` })) }); return; }
  const r = git(repo, ['worktree', 'remove', w.caminho]);
  if (!r.ok) {
    rel.erros.push({ caminho: w.caminho, mensagem: `git worktree remove recusou: ${[r.stdout.trim(), r.stderr, r.erro].filter(Boolean).join(' | ') || r.motivo}` });
    rel.mantidos.push({ ...base, motivos: [{ criterio: 0, texto: 'o git recusou remover (veja os erros)' }] });
    return;
  }
  if (w.branch) {
    const b = git(repo, ['rev-parse', '--verify', `refs/heads/${w.branch}`]);
    if (!b.ok) rel.erros.push({ caminho: w.caminho, mensagem: `a branch ${w.branch} não existe mais depois da remoção: ${b.motivo}` });
  }
  if (existsSync(w.caminho)) rel.erros.push({ caminho: w.caminho, mensagem: 'a pasta ainda existe depois do git worktree remove' });
  rel.removidos.push(base);
}

// ---------- relatório ----------
const gb = (kb) => `${(kb / 1024 / 1024).toFixed(2)} GB`;
const somaKb = (lista) => lista.reduce((s, x) => s + (x.kb || 0), 0);
const falhasDosRepos = (rel) => rel.repos.filter((r) => r.falhaFechada);

function paraMarkdown(rel) {
  const L = [];
  L.push(`# Limpador de disco — ${rel.quando}`);
  L.push('', `Modo: **${rel.modo}** · passos: ${rel.passos.join(', ')} · worktree parada há mais de ${rel.horas} h · builds de worktree parada há mais de ${rel.diasBuilds} dias · teto de log ${rel.tetoLogMb} MB`);
  for (const a of rel.avisos) L.push('', `> ${a}`);
  if (rel.falhaFechada) {
    L.push('', '## Rodada interrompida: nada foi removido', '', `Não consegui medir uma coisa de que a decisão depende: ${rel.falhaFechada}`);
    return `${L.join('\n')}\n`;
  }
  if (rel.repos.length) {
    L.push('', `## Repositórios (${rel.repos.length})`);
    for (const r of rel.repos) L.push(`- ${r.repo} — ${r.falhaFechada ? `fora do passo worktrees (falha): ${r.falhaFechada}` : r.foraDoPasso ? `fora do passo worktrees: ${r.foraDoPasso}` : `${r.worktrees} worktree(s)`}`);
  }
  if (rel.passos.includes('worktrees')) {
    L.push('', `## Removidos (${rel.removidos.length})`);
    for (const r of rel.removidos) L.push(`- ${r.caminho} — branch ${r.branch}, HEAD ${r.head}`);
    if (rel.seriamRemovidos.length || rel.modo !== 'aplicar') {
      L.push('', `## Seriam removidos com --aplicar (${rel.seriamRemovidos.length})`);
      for (const r of rel.seriamRemovidos) L.push(`- ${r.caminho} — branch ${r.branch}, HEAD ${r.head}`);
    }
    L.push('', `## Mantidos (${rel.mantidos.length})`);
    for (const m of rel.mantidos) {
      L.push(`- ${m.caminho} — branch ${m.branch}`);
      for (const x of m.motivos) L.push(`  - ${x.texto}`);
    }
    L.push('', `## Pastas soltas (${rel.pastasSoltas.length})`);
    for (const p of rel.pastasSoltas) L.push(`- ${p.caminho} — pasta solta, não é worktree do git; não mexo`);
  }
  if (rel.passos.includes('builds')) {
    const lib = rel.builds.liberados;
    const ser = rel.builds.seriamLiberados;
    L.push('', `## Builds liberados (${lib.length} worktree(s), ${gb(somaKb(lib))})`);
    for (const b of lib) L.push(`- ${b.caminho} — parada há ${b.diasParado} dias, ${gb(b.kb)}: ${b.pastas.map((p) => p.caminho).join(', ')}`);
    if (ser.length || rel.modo !== 'aplicar') {
      L.push('', `## Builds que seriam liberados com --aplicar (${ser.length} worktree(s), ${gb(somaKb(ser))}; a worktree fica)`);
      for (const b of ser) L.push(`- ${b.caminho} — parada há ${b.diasParado} dias, ${gb(b.kb)}: ${b.pastas.map((p) => p.caminho).join(', ')}`);
    }
  }
  if (rel.passos.includes('logs')) {
    L.push('', `## Logs cortados (${rel.logs.cortados.length})`);
    for (const l of rel.logs.cortados) L.push(`- ${l.caminho} — ${l.kbAntes} KB → ${l.kbDepois} KB`);
    if (rel.logs.seriamCortados.length || rel.modo !== 'aplicar') {
      L.push('', `## Logs que seriam cortados com --aplicar (${rel.logs.seriamCortados.length})`);
      for (const l of rel.logs.seriamCortados) L.push(`- ${l.caminho} — ${l.kbAntes} KB → ${l.kbDepois} KB`);
    }
  }
  if (rel.erros.length) {
    L.push('', `## Erros (${rel.erros.length})`);
    for (const e of rel.erros) L.push(`- ${e.caminho}: ${e.mensagem}`);
  }
  return `${L.join('\n')}\n`;
}

function linhaDeResumo(rel) {
  const falha = rel.falhaFechada ? rel.falhaFechada.split('\n')[0] : falhasDosRepos(rel).map((r) => `${r.repo}: ${r.falhaFechada.split('\n')[0]}`).join('; ');
  const erro = falha || (rel.erros.length ? `${rel.erros.length} erro(s)` : '');
  return `${rel.quando} modo=${rel.modo} repos=${rel.repos.length} fora-do-github=${rel.repos.filter((r) => r.foraDoPasso).length} removidos=${rel.removidos.length} seriam=${rel.seriamRemovidos.length} mantidos=${rel.mantidos.length}`
    + ` builds=${gb(somaKb(rel.builds.liberados))} builds-seriam=${gb(somaKb(rel.builds.seriamLiberados))}`
    + ` logs=${rel.logs.cortados.length} logs-seriam=${rel.logs.seriamCortados.length} erro=${erro || '-'}`;
}

// O plist do launchd: a cada 6 h roda o `limpar-disco` da versão mais nova do plugin no cache (o caminho muda a cada
// versão, por isso a escolha é na hora). Instalar é do operador: `limpar-disco --plist > ~/Library/LaunchAgents/<rótulo>.plist`.
function plist() {
  const rotulo = 'com.ichikawa-kit.limpar-disco';
  const xml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const cache = join(HOME, '.claude', 'plugins', 'cache');
  const script = `d=$(ls -d "${cache}"/ichikawa-kit/orquestracao/*/bin/limpar-disco 2>/dev/null | sort -V | tail -1); `
    + '[ -n "$d" ] || { echo "limpar-disco: plugin orquestracao não achado no cache" >&2; exit 2; }; '
    + 'exec "$d" --aplicar --se-ligado --resumo';
  const path = [dirname(process.execPath), '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin'];
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${rotulo}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/sh</string>
    <string>-c</string>
    <string>${xml(script)}</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>${xml([...new Set(path)].join(':'))}</string>
  </dict>
  <key>StartInterval</key><integer>21600</integer>
  <key>RunAtLoad</key><false/>
  <key>StandardOutPath</key><string>${xml(join(SAIDA, 'launchd.log'))}</string>
  <key>StandardErrorPath</key><string>${xml(join(SAIDA, 'launchd.log'))}</string>
</dict>
</plist>
`;
}

function main(argv) {
  let args;
  try { args = lerArgs(argv); } catch (e) { process.stderr.write(`${e.message}\n`); return 1; }
  if (args.plist) { process.stdout.write(plist()); return 0; }
  const rel = rodada(args);
  const md = paraMarkdown(rel);
  const resumo = linhaDeResumo(rel);
  try {
    mkdirSync(SAIDA, { recursive: true });
    writeFileSync(join(SAIDA, 'ultimo-relatorio.md'), md);
    writeFileSync(join(SAIDA, 'ultimo-relatorio.json'), JSON.stringify(rel, null, 2));
    appendFileSync(join(SAIDA, 'historico.log'), `${resumo}\n`);
  } catch (e) {
    process.stderr.write(`não consegui gravar o relatório: ${e.message}\n`);
  }
  process.stdout.write(args.json ? `${JSON.stringify(rel, null, 2)}\n` : args.resumo ? `${resumo}\n` : md);
  if (rel.falhaFechada || falhasDosRepos(rel).length) return 2;
  return rel.erros.length ? 1 : 0;
}

process.exitCode = main(process.argv.slice(2));
