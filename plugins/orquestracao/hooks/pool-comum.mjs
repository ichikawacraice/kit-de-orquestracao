// Comum das travas do pool (F5, 24/10): quem é a sessão (registro do app), se é membro do pool ou
// orquestradora, início do turno e "este repositório tem orquestradora ativa".
// Fonte das regras: ~/.claude/orquestracao/pool/protocolo.md. Log e BASE: hooks-crewai-comum.mjs.
import { existsSync, readFileSync, writeFileSync, renameSync, readdirSync, statSync, openSync, readSync, closeSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join, basename, dirname } from 'node:path';
import { BASE, tituloRapido, semPrefixoDoPlugin } from './hooks-crewai-comum.mjs';

export { BASE };
const H = homedir();
const SESSOES_DIR = () => process.env.POOL_APP_SESSOES_DIR || join(H, 'Library', 'Application Support', 'Claude', 'claude-code-sessions');

function* arquivosLocal(dir) {
  let entradas;
  try { entradas = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entradas) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* arquivosLocal(p);
    else if (e.isFile() && e.name.startsWith('local_') && e.name.endsWith('.json')) yield p;
  }
}

// Registro do app da sessão: casa por `sessionId` (local_…), `cliSessionId` ou `priorCliSessionIds`.
// Lê como texto e só faz JSON.parse do arquivo que contém o id. → { localId, titulo, arquivada } ou null.
// A varredura lê dezenas de MB; o hook roda em todo Edit. Acerto fica em cache por 2 min em
// <BASE>/pool-registro-cache.json (título troca raramente; acerto e ausência). Efeito: troca de título ou sessão nova
// só é vista em até 2 min.
const CACHE_TTL_MS = 120_000;
const cacheArq = () => join(BASE, 'pool-registro-cache.json');
function lerCache() { try { return JSON.parse(readFileSync(cacheArq(), 'utf8')); } catch { return {}; } }
function guardarCache(id, reg) {
  try {
    const c = lerCache();
    for (const [k, v] of Object.entries(c)) if (Date.now() - v.em > CACHE_TTL_MS) delete c[k];
    c[id] = { em: Date.now(), reg };
    const tmp = `${cacheArq()}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(c));
    renameSync(tmp, cacheArq());
  } catch { /* sem cache, segue */ }
}

// fresco: ignora o cache (o título muda e a decisão depende dele — arquivar membro livre).
export function registroDaSessao(id, { fresco = false } = {}) {
  if (!id) return null;
  const hit = fresco ? null : lerCache()[id];
  // Cache de antes do `cwd`/`originCwd` (reg sem a chave `cwd`) é descartado: não vale como "sem projeto".
  if (hit && Date.now() - hit.em <= CACHE_TTL_MS && (hit.reg === null || 'cwd' in hit.reg)) return hit.reg;
  const reg = varrerRegistro(id);
  guardarCache(id, reg); // também a ausência (reg null): sessão fora do registro não varre a cada Edit
  return reg;
}

function varrerRegistro(id) {
  for (const f of arquivosLocal(SESSOES_DIR())) {
    let texto;
    try { texto = readFileSync(f, 'utf8'); } catch { continue; }
    if (!texto.includes(id)) continue;
    try {
      const r = JSON.parse(texto);
      if (r.sessionId === id || r.cliSessionId === id || (Array.isArray(r.priorCliSessionIds) && r.priorCliSessionIds.includes(id))) {
        return { localId: r.sessionId || null, titulo: r.title || '', arquivada: Boolean(r.isArchived), cwd: r.cwd || null, originCwd: r.originCwd || null };
      }
    } catch { /* registro ilegível */ }
  }
  return null;
}

// Só o prefixo `<P|D|E|V><n> · ` do título vale: sem ele, não é membro (outro projeto, sessão avulsa).
export function membroDoPool(titulo) {
  const m = /^(P|D|E|V)(\d+) · /.exec(titulo || '');
  return m ? { papel: m[1], id: `${m[1]}${m[2]}` } : null;
}

// Projeto da sessão (D1, 24/10): git common dir do `originCwd` (cai para `cwd`). `repo` é o common dir absoluto
// (comparação nas travas: worktrees do mesmo repositório dão o mesmo); `nome` é o basename da pasta que contém o
// `.git`, minúsculo (painel e mod). Sem pasta ou fora de git → null.
export function projetoDaSessao(reg) {
  const repo = gitCommonDir(reg?.originCwd || reg?.cwd);
  if (!repo) return null;
  const raiz = basename(repo) === '.git' ? dirname(repo) : repo;
  return { repo, nome: basename(raiz).replace(/\.git$/, '').toLowerCase() };
}

export function ehOrquestradora(sessionId, titulo) {
  return Boolean(sessionId && existsSync(join(BASE, 'ativas', sessionId))) || (titulo || '').startsWith('🎛 orquestradora');
}

// Início do turno (ms): última entrada `user` que abre turno (mesmo critério do fila-do-item.mjs).
// A origem do turno atual ('human', 'peer', 'task-notification'…), pela última mensagem de usuário com origem.
export function origemDoTurno(transcriptPath) {
  const linhas = readFileSync(transcriptPath, 'utf8').split('\n');
  for (let i = linhas.length - 1; i >= 0; i--) {
    if (!linhas[i]) continue;
    let e;
    try { e = JSON.parse(linhas[i]); } catch { continue; }
    const c = e.message?.content;
    const ehResultado = Array.isArray(c) && c.some((b) => b?.type === 'tool_result');
    if (e.type === 'user' && !e.isMeta && !ehResultado && (e.origin?.kind || e.turnOrigin)) return String(e.origin?.kind || e.turnOrigin);
  }
  return null;
}

export function inicioDoTurno(transcriptPath) {
  const linhas = readFileSync(transcriptPath, 'utf8').split('\n');
  for (let i = linhas.length - 1; i >= 0; i--) {
    if (!linhas[i]) continue;
    let e;
    try { e = JSON.parse(linhas[i]); } catch { continue; }
    const c = e.message?.content;
    const ehResultado = Array.isArray(c) && c.some((b) => b?.type === 'tool_result');
    if (e.type === 'user' && !e.isMeta && !ehResultado && (e.origin?.kind || e.turnOrigin)) {
      const t = Date.parse(e.timestamp);
      return Number.isNaN(t) ? null : t;
    }
  }
  return null;
}

// --- Repositório com orquestradora ativa: mesma regra de painel-das-sessoes.mjs; mude nos dois. ---
const VALIDADE_MS = 7 * 24 * 3600 * 1000;

export function gitCommonDir(cwd) {
  if (!cwd || !existsSync(cwd)) return null;
  try {
    return execFileSync('git', ['-C', cwd, 'rev-parse', '--path-format=absolute', '--git-common-dir'], {
      encoding: 'utf8', timeout: 3000, killSignal: 'SIGKILL', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || null;
  } catch { return null; }
}

function transcriptDe(sessionId) {
  const proj = join(H, '.claude', 'projects');
  for (const d of readdirSync(proj)) {
    const f = join(proj, d, `${sessionId}.jsonl`);
    if (existsSync(f)) return f;
  }
  return null;
}

function cwdDoTranscript(f) {
  const fd = openSync(f, 'r');
  try {
    const buf = Buffer.alloc(256 * 1024);
    const n = readSync(fd, buf, 0, buf.length, 0);
    const m = buf.subarray(0, n).toString('utf8').match(/"cwd":"([^"]+)"/);
    return m ? m[1] : null;
  } finally { closeSync(fd); }
}

const semBarra = (r) => String(r ?? '').replace(/\/+$/, '');

// O repo que o marcador de `ativas/<id>` guarda: vazio (formato antigo) e o texto `null` valem "sem repo"; barra final sai.
// Os três leitores do marcador (aqui, orquestradora-nao-edita e painel-das-sessoes) passam por esta função.
export function repoDoMarcador(texto) {
  const r = semBarra(String(texto ?? '').trim());
  return r === 'null' ? '' : r;
}

// Sessões do registro do app com título de orquestradora, não arquivadas e sem marcador (limpar o contexto troca o id e
// órfã o marcador): a orquestradora que só o título denuncia. Só lê arquivo que contém o texto do título.
function orquestradorasSoPorTitulo(meuId, comMarcador) {
  const achadas = [];
  for (const f of arquivosLocal(SESSOES_DIR())) {
    let texto;
    try { texto = readFileSync(f, 'utf8'); } catch { continue; }
    if (!texto.includes('🎛 orquestradora')) continue;
    try {
      const r = JSON.parse(texto);
      if (!String(r.title || '').startsWith('🎛 orquestradora') || r.isArchived) continue;
      const ids = [r.sessionId, r.cliSessionId, ...(Array.isArray(r.priorCliSessionIds) ? r.priorCliSessionIds : [])];
      if (ids.includes(meuId) || ids.some((x) => comMarcador.has(x))) continue;
      achadas.push({ cwd: r.originCwd || r.cwd || null });
    } catch { /* registro ilegível */ }
  }
  return achadas;
}

// O repositório `meuRepo` tem orquestradora ativa de OUTRA sessão? Três estados: `true` (há, medido), `false` (não há,
// medido) e `null` (não consegui medir: marcador cujo repo não resolve, transcript velho ou ausente do próprio repo,
// `~/.claude/projects` ilegível, orquestradora só por título sem repo). "Não sei" nunca vira "não há"; quem decide
// o que fazer com `null` é o chamador (T2 nega; o painel-das-sessoes trata como "não").
export function projetoTemOrquestradora(meuId, meuRepo) {
  const meu = semBarra(meuRepo);
  const ativas = join(BASE, 'ativas');
  let indeterminado = false;
  const comMarcador = new Set();
  let ids = [];
  try { ids = existsSync(ativas) ? readdirSync(ativas) : []; } catch { indeterminado = true; }
  for (const id of ids) {
    if (id === meuId) continue;
    comMarcador.add(id);
    try {
      let repo = repoDoMarcador(readFileSync(join(ativas, id), 'utf8'));
      const t = transcriptDe(id);
      if (!repo && t) repo = semBarra(gitCommonDir(cwdDoTranscript(t)));
      if (!repo) { indeterminado = true; continue; } // não sei de qual repo é
      if (repo !== meu) continue; // de outro repo: não conta, e é medido
      // É deste repo: só vale se o transcript existe e andou nos últimos 7 dias.
      if (!t || Date.now() - statSync(t).mtimeMs > VALIDADE_MS) { indeterminado = true; continue; }
      return true;
    } catch { indeterminado = true; }
  }
  try {
    for (const o of orquestradorasSoPorTitulo(meuId, comMarcador)) {
      const repo = semBarra(gitCommonDir(o.cwd));
      if (!repo) indeterminado = true;
      else if (repo === meu) return true;
    }
  } catch { indeterminado = true; }
  return indeterminado ? null : false;
}

// Sessão executora (fio principal): subagente `executor` (agent_type), título `exec ·` no transcript
// ou `E<n> · …` no registro do app. Mesmo teste do executor-criterio; o Stop de subagente não passa por aqui.
export function ehExecutora(e, transcript) {
  return semPrefixoDoPlugin(e.agent_type) === 'executor' || // `orquestracao:executor` vale `executor`
    /^exec\s*·/.test(tituloRapido(transcript))
    || membroDoPool(registroDaSessao(e.session_id)?.titulo)?.papel === 'E';
}
