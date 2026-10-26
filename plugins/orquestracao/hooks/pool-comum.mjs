// Comum das travas do pool (F5, 24/10): quem é a sessão (registro do app), se é membro do pool ou
// orquestradora, início do turno e "este repositório tem orquestradora ativa".
// Fonte das regras: ~/.claude/orquestracao/pool/protocolo.md. Log e BASE: hooks-crewai-comum.mjs.
import { existsSync, readFileSync, writeFileSync, renameSync, readdirSync, statSync, openSync, readSync, closeSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join, basename, dirname } from 'node:path';
import { BASE, tituloRapido, semPrefixoDoPlugin, INICIO_DE_COMANDO, INVOCACAO_DO_PAINEL } from './hooks-crewai-comum.mjs';

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

// fresco: ignora o cache (o título muda e a decisão depende dele — arquivar membro do pool, só por comando do operador).
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

// Itens vivos da fila em que a sessão aparece (F30): `com` = trabalhando agora; `fez` = executou parte e o item ainda espera
// validação, conserto ou merge. Pasta: FILA_DIR, ou <PAINEL_DIR>/fila. Erro de leitura = lista vazia (o hook deixa passar).
const ETAPAS_DO_FEZ = ['execucao', 'validacao', 'merge'];
const filaDir = () => process.env.FILA_DIR || join(process.env.PAINEL_DIR || process.env.IZANAGI_PAINEL_DIR || join(H, '.claude', 'orquestracao', 'painel'), 'fila');
export function itensDaSessao(localId) {
  const saida = { com: [], fez: [] };
  if (!localId) return saida;
  let nomes; try { nomes = readdirSync(filaDir()); } catch { return saida; }
  for (const nome of nomes) {
    if (!nome.endsWith('.json')) continue;
    try {
      const doc = JSON.parse(readFileSync(join(filaDir(), nome), 'utf8'));
      const d = doc?.data; const id = doc?.id ?? nome.replace(/\.json$/, '');
      if (!d || d.etapa === 'feito' || d.etapa === 'descartado') continue;
      if (Array.isArray(d.com) && d.com.some((c) => c?.localId === localId)) saida.com.push(id);
      if (ETAPAS_DO_FEZ.includes(d.etapa) && Array.isArray(d.fez) && d.fez.some((c) => c?.localId === localId)) saida.fez.push(id);
    } catch { /* arquivo parcial: ignora este item */ }
  }
  return saida;
}

// Itens vivos de que a sessão é DONA (`donoLocalId`): os que o `livre-se-limpa` solta quando ela se declara livre.
export function itensDonosDaSessao(localId) {
  const saida = [];
  if (!localId) return saida;
  let nomes; try { nomes = readdirSync(filaDir()); } catch { return saida; }
  for (const nome of nomes) {
    if (!nome.endsWith('.json')) continue;
    try {
      const doc = JSON.parse(readFileSync(join(filaDir(), nome), 'utf8'));
      const d = doc?.data;
      if (!d || d.etapa === 'feito' || d.etapa === 'descartado') continue;
      if (d.donoLocalId === localId) saida.push(doc?.id ?? nome.replace(/\.json$/, ''));
    } catch { /* arquivo parcial: ignora este item */ }
  }
  return saida;
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

// A origem do turno atual ('human', 'peer', 'task-notification'…), pela última mensagem de usuário com origem.
export function origemDoTurno(transcriptPath) {
  const linhas = readFileSync(transcriptPath, 'utf8').split('\n');
  for (let i = linhas.length - 1; i >= 0; i--) {
    if (!linhas[i]) continue;
    let e;
    try { e = JSON.parse(linhas[i]); } catch { continue; }
    const c = e.message?.content;
    const ehResultado = Array.isArray(c) && c.some((b) => b?.type === 'tool_result');
    // A meta que TEM origem abre o turno (B1, V3 de 25/10). Medido em 25/10 nos transcripts deste projeto: 2.082 linhas
    // `isMeta`, 1.579 com origem (1.538 `peer`, 41 `system`); a meta sem origem não tem o que devolver e cai fora aqui.
    if (e.type === 'user' && !ehResultado && (e.origin?.kind || e.turnOrigin)) return String(e.origin?.kind || e.turnOrigin);
  }
  return null;
}

// Início do turno (ms): a mesma entrada que a origem acima (e a cópia local do fila-do-item.mjs, que um teste compara).
export function inicioDoTurno(transcriptPath) {
  const linhas = readFileSync(transcriptPath, 'utf8').split('\n');
  for (let i = linhas.length - 1; i >= 0; i--) {
    if (!linhas[i]) continue;
    let e;
    try { e = JSON.parse(linhas[i]); } catch { continue; }
    const c = e.message?.content;
    const ehResultado = Array.isArray(c) && c.some((b) => b?.type === 'tool_result');
    if (e.type === 'user' && !ehResultado && (e.origin?.kind || e.turnOrigin)) {
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

// --- Declarar-se livre no turno (F32): a detecção mora aqui para o `livre-se-limpa` (que solta) e o `fila-do-item` (que deixa de cobrar) ---
// Só vale a INVOCAÇÃO de `node …/painel.mjs` na mesma linha: `set|update sessoes <id> '…livre…'` ou `batch '…sessoes…livre…'`.
// Casar o comando inteiro cobrava heredoc que apenas citava essas palavras (falso positivo medido em 24/10 e de novo em 25/10),
// então o comando é normalizado antes: o corpo dos heredocs sai, e os separadores (`; & | ( `` \n`) DENTRO de aspas viram `_`
// (o tamanho não muda; `$(` e crase dentro de aspas duplas executam de verdade e ficam). A regex acha a invocação no normalizado.
// Início de comando e invocação do painel (`node …/painel.mjs` ou o `painel` do bin/ do plugin): hooks-crewai-comum.mjs.
// Limite declarado: caminho montado por variável (`node "$P" …`); JSON multilinha fora de aspas; atribuição com valor entre aspas e
// espaço (`FOO="a b" node …`); outros prefixos (`sudo`, `xargs`, `bash -c "…"`); heredoc dentro de string.
export function semHeredoc(c) {
  const linhas = String(c).split('\n'); const saida = []; const fila = []; // delimitadores pendentes, em ordem: `cat <<A; cat <<B`
  for (const l of linhas) {
    if (fila.length) { if (l.trim() === fila[0]) fila.shift(); continue; }
    saida.push(l);
    for (const m of l.matchAll(/(?<!<)<<(?!<)-?\s*(['"]?)(\w+)\1/g)) fila.push(m[2]);
  }
  return saida.join('\n');
}
export function separadoresDeAspasNeutros(c) {
  let aspa = null; let o = '';
  for (let k = 0; k < c.length; k++) {
    const ch = c[k];
    if (aspa === null) {
      if (ch === '\\') { o += ch + (c[k + 1] ?? ''); k++; continue; }
      if (ch === "'" || ch === '"') aspa = ch;
      o += ch; continue;
    }
    if (ch === aspa) { aspa = null; o += ch; continue; }
    if (aspa === '"' && ch === '\\') { o += ch + (c[k + 1] ?? ''); k++; continue; }
    const executa = aspa === '"' && (ch === '`' || (ch === '(' && c[k - 1] === '$'));
    o += !executa && /[;&|(\n`]/.test(ch) ? '_' : ch;
  }
  return o;
}
const INVOCACAO = new RegExp(INICIO_DE_COMANDO + INVOCACAO_DO_PAINEL + String.raw`\s+(?:(?:set|update)\s+sessoes\s+\S+|batch)\s[^\n]*\blivre\b`);
export const painelLivre = (c) => {
  const n = separadoresDeAspasNeutros(semHeredoc(c));
  return INVOCACAO.test(n) && (!/painel(?:\.mjs)?["']?\s+batch\b/.test(n) || /painel(?:\.mjs)?["']?\s+batch\s[^\n]*sessoes/.test(n));
};
// Declaração sobre a PRÓPRIA linha de `sessoes` (F32): o `local_` ou o id do CLI da sessão, com `etapa` começando em "livre".
// Gravar a linha de outra sessão, ou a palavra "livre" noutro campo, não conta (soltar o item é ação, não cobrança).
const escapa = (x) => String(x).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const painelLivrePropria = (c, ids) => {
  const proprios = ids.filter(Boolean).map(escapa).join('|');
  if (!proprios) return false;
  const n = separadoresDeAspasNeutros(semHeredoc(c));
  const unico = new RegExp(INICIO_DE_COMANDO + INVOCACAO_DO_PAINEL + String.raw`\s+(?:set|update)\s+sessoes\s+["']?(?:${proprios})["']?\s[^\n]*"etapa"\s*:\s*"livre\b`);
  const lote = new RegExp(INICIO_DE_COMANDO + INVOCACAO_DO_PAINEL + String.raw`\s+batch\s[^\n]*"colecao"\s*:\s*"sessoes"[^\n]*"id"\s*:\s*"(?:${proprios})"[^\n]*"etapa"\s*:\s*"livre\b`);
  return unico.test(n) || lote.test(n);
};



const ehSelf = (id) => id === undefined || id === null || id === 'self';
export const tituloLivre = (t) => /· livre\s*$/.test(String(t || ''));
// F49: título de quem entregou e guarda a conversa para o conserto (a sessão não está livre: tem a conversa cheia).
export const tituloAguardando = (t) => /· aguardando validação\s*$/.test(String(t || ''));
// Quem se declarou livre no turno que começou em `inicio` (ms): `{ como, tituloNovo, propria, aguardando }` ou null. `como` é 'título livre'
// (set_session_title "self" com título terminando em "· livre"; vence), 'título aguardando' (F49: terminando em "· aguardando validação",
// `aguardando: true`) ou 'painel livre' (painel gravando em `sessoes` com "livre").
// `propria`: alguma dessas declarações é sobre a própria sessão (`ids` = local_ e id do CLI): o título "self" ou a linha dela.
export function declarouLivre(transcriptPath, inicio, ids = []) {
  let como = null; let tituloNovo = null; let propria = false; let aguardando = false;
  for (const l of readFileSync(transcriptPath, 'utf8').split('\n')) {
    if (!l) continue;
    let e; try { e = JSON.parse(l); } catch { continue; }
    if (e.type !== 'assistant' || Date.parse(e.timestamp) < inicio) continue;
    const c = e.message?.content;
    if (!Array.isArray(c)) continue;
    for (const b of c) {
      if (b?.type !== 'tool_use') continue;
      const n = String(b.name || ''); const i = b.input || {};
      if (n.endsWith('set_session_title') && ehSelf(i.session_id) && tituloLivre(i.title)) { como = 'título livre'; tituloNovo = i.title; propria = true; aguardando = false; }
      else if (n.endsWith('set_session_title') && ehSelf(i.session_id) && tituloAguardando(i.title)) { como = 'título aguardando'; tituloNovo = i.title; propria = true; aguardando = true; }
      else if (n === 'Bash' && painelLivre(String(i.command || ''))) { como ||= 'painel livre'; if (painelLivrePropria(String(i.command || ''), ids)) propria = true; }
    }
  }
  return como ? { como, tituloNovo, propria, aguardando } : null;
}
// O hook de Stop vai soltar a sessão (`livre-se-limpa`)? Membro do pool, `local_` resolvido e declaração sobre si. UMA função, para
// o `livre-se-limpa` agir e o `fila-do-item` deixar de cobrar exatamente nos mesmos casos. → a declaração, ou null.
export function vaiSoltar(transcriptPath, inicio, { sessionId, localId, titulo }) {
  if (!localId) return null;
  const d = declarouLivre(transcriptPath, inicio, [localId, sessionId]);
  if (!d?.propria) return null;
  return membroDoPool(d.tituloNovo) || membroDoPool(titulo) ? d : null;
}

// Contexto da sessão (F35): a ÚLTIMA entrada `assistant` com `usage` que não seja de subagente (`isSidechain`). Entrada de subagente
// carrega o contexto dele, e depois de compactar a última já vem menor, por isso vale só a última leitura (nada se soma).
// → `{ tokens, em }` (`em` = timestamp da entrada), ou null se não há nenhum `usage`. Transcript ilegível LANÇA: quem chama registra `erro`.
export function contextoDoTranscript(caminho) {
  const linhas = readFileSync(caminho, 'utf8').split('\n');
  for (let i = linhas.length - 1; i >= 0; i--) {
    if (!linhas[i]) continue;
    let e; try { e = JSON.parse(linhas[i]); } catch { continue; }
    const u = e?.message?.usage;
    // Entrada sintética (`<synthetic>`, ex.: "No response requested.") traz `usage` zerado e não é leitura do contexto (O2 do F35).
    if (e?.type !== 'assistant' || e?.isSidechain === true || e?.message?.model === '<synthetic>' || !u) continue;
    const tokens = [u.input_tokens, u.cache_creation_input_tokens, u.cache_read_input_tokens].reduce((s, x) => s + (Number.isFinite(x) ? x : 0), 0);
    return { tokens, em: e.timestamp ?? null };
  }
  return null;
}
