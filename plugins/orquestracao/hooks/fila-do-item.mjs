#!/usr/bin/env node
// Stop hook: a sessão que é DONA de um item vivo da fila (coleção `fila` do painel: `donoLocalId` e etapa fora de
// feito/descartado), com o PR que fecha o item na fila e sem a `entrega`, não termina o turno que MUDOU algo (editou arquivo,
// commitou, empurrou, abriu ou editou PR) sem gravá-la. O turno que só leu ou esperou passa.
//
// F424 (ADR 0027): a trava não cobra mais o `agora` a cada passo. A etapa, os PRs, a dona viva e o "parado" a batida deduz do git,
// do gh e da lista de sessões (`estado-deduzido.mjs`); o que só a dona sabe é a entrega (ADR 0024), e é só ela que se cobra aqui.
//
// "Dona" = o `local_…` da sessão (registro do app, achado pelo cliSessionId ou pelos priorCliSessionIds) é o `donoLocalId` do item.
// "O PR que fecha o item": a etapa e os PRs deduzidos pela batida (`batida/deduzido.json`) quando há, senão os declarados no item;
// etapa `merge`, com PR, sem `maisFatias: true` e sem `entrega.resultado` não vazio.
// Protocolo: pool/protocolo.md#painel-em-dia
//
// Erro do próprio hook vai para o log e DEIXA PASSAR. Variáveis para teste: FILA_DIR, FILA_APP_SESSOES_DIR, FILA_LOG, FILA_DEDUZIDO.
import { readFileSync, existsSync, appendFileSync, readdirSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';

// O aviso de injeção é opcional: se a varredura faltar ou falhar ao carregar, o hook segue sem ele.
// Hoje ele não protege nada (a razão do bloqueio só cita ids de item); prepara o caso de o texto do painel entrar aqui.
let avisoDeInjecao = () => '';
try { ({ avisoDeInjecao } = await import('./varredura-entre-sessoes.mjs')); } catch { /* sem aviso */ }

const FILA_DIR = process.env.FILA_DIR || join(homedir(), '.claude', 'orquestracao', 'painel', 'fila');
const SESSOES_DIR = process.env.FILA_APP_SESSOES_DIR || join(homedir(), 'Library', 'Application Support', 'Claude', 'claude-code-sessions');
const LOG = process.env.FILA_LOG || join(homedir(), '.claude', 'orquestracao', 'fila-hook.log');
const DEDUZIDO = process.env.FILA_DEDUZIDO || join(homedir(), '.claude', 'orquestracao', 'batida', 'deduzido.json');

function registrar(sessionId, localId, desfecho, detalhe = '') {
  try {
    mkdirSync(dirname(LOG), { recursive: true });
    const limpo = String(detalhe).replace(/[\t\r\n]+/g, ' ');
    appendFileSync(LOG, `${new Date().toISOString()}\t${sessionId ?? ''}\t${localId ?? ''}\t${desfecho}\t${limpo}\n`);
  } catch { /* sem log */ }
}

const ETAPAS = ['planejamento', 'design', 'execucao', 'validacao', 'merge', 'feito', 'descartado'];
const ETAPAS_FINAIS = ['feito', 'descartado'];

// A projeção da batida (ADR 0027): { em, itens: { F: { etapa, prs, … } } }. Sem o arquivo, ou ilegível, vale o declarado.
function deduzidos() {
  try {
    const p = JSON.parse(readFileSync(DEDUZIDO, 'utf8'));
    const itens = p?.itens && typeof p.itens === 'object' ? p.itens : {};
    return { em: Date.parse(p?.em ?? ''), itens };
  } catch { return { em: NaN, itens: {} }; }
}

// A projeção só vale para o item se não é mais velha que a última gravação dele: a batida roda de
// 10 em 10 min (ou está desligada, com o arquivo parado), e o `--anotar` que acabou de gravar
// `etapa:"merge"` e o PR não pode perder para a dedução de antes do PR existir.
function deducaoValida(em, d) {
  if (!Number.isFinite(em)) return false;
  const gravado = Date.parse(d?.atualizadoEm ?? '');
  return !Number.isFinite(gravado) || em >= gravado;
}

// Itens da fila que têm dono e estão vivos: [{ id, dono, semEntrega }].
function itensComDono() {
  if (!existsSync(FILA_DIR)) return [];
  const { em, itens: dd } = deduzidos();
  const itens = [];
  for (const nome of readdirSync(FILA_DIR)) {
    if (!nome.endsWith('.json')) continue;
    try {
      const doc = JSON.parse(readFileSync(join(FILA_DIR, nome), 'utf8'));
      const d = doc?.data;
      if (ETAPAS.includes(d?.etapa) && !ETAPAS_FINAIS.includes(d.etapa) && d?.donoLocalId) {
        const id = doc.id ?? nome.replace(/\.json$/, '');
        const ded = deducaoValida(em, d) ? dd[id] : undefined;
        const etapa = ETAPAS.includes(ded?.etapa) ? ded.etapa : d.etapa;
        const prs = Array.isArray(ded?.prs) ? ded.prs : Array.isArray(d.prs) ? d.prs : [];
        const semEntrega = etapa === 'merge' && prs.length > 0 && d.maisFatias !== true
          && !(typeof d.entrega?.resultado === 'string' && d.entrega.resultado.trim());
        itens.push({ id, dono: d.donoLocalId, semEntrega });
      }
    } catch { /* arquivo parcial ou ilegível: ignora este item */ }
  }
  return itens;
}

function* arquivosLocal(dir) {
  let entradas;
  try { entradas = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entradas) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* arquivosLocal(p);
    else if (e.isFile() && e.name.startsWith('local_') && e.name.endsWith('.json')) yield p;
  }
}

// O `local_…` e o título desta sessão. Lê como texto e só faz JSON.parse do que contém o session_id.
function resolverLocalId(sessionId) {
  for (const f of arquivosLocal(SESSOES_DIR)) {
    let texto;
    try { texto = readFileSync(f, 'utf8'); } catch { continue; }
    if (!texto.includes(sessionId)) continue;
    try {
      const r = JSON.parse(texto);
      if (r.cliSessionId === sessionId || (Array.isArray(r.priorCliSessionIds) && r.priorCliSessionIds.includes(sessionId))) {
        return { localId: r.sessionId || null, titulo: r.title || '' };
      }
    } catch { /* registro ilegível */ }
  }
  return null;
}

// Timestamp (ms) do início do turno: última entrada `user` que abre turno — com `tool_result` fora, e meta ou não (R1: a
// mensagem entre sessões é gravada com `isMeta: true` E origem; a meta SEM origem não tem como abrir turno) — e com
// `origin.kind` (mensagem humana/peer) OU `turnOrigin` (human, peer, system, task_notification e `sdk`,
// o dos turnos abertos por mensagem entre sessões e pelo prompt inicial, que não têm `origin`).
// Medido: linhas `user` com tool_result não carregam `turnOrigin`; o filtro de tool_result é só reforço.
function inicioDoTurno(transcriptPath) {
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

// O turno da dona que MUDOU algo — editou arquivo, commitou, empurrou ou abriu/editou PR —
// a partir do início do turno. É nesse turno que ela grava a entrega; o turno que só leu ou esperou não é cobrado.
const EDITA = new Set(['Edit', 'Write', 'NotebookEdit', 'MultiEdit']);
const BASH_MUDA = /\bgit\s+(?:-C\s+\S+\s+)?(commit|push)\b|\b(sed|perl)\s+(-[a-zA-Z]*\s+)*-[a-zA-Z]*i\b|\bgh\s+pr\s+(create|edit|ready)\b/;
function mudouNoTurno(transcriptPath, inicio) {
  for (const l of readFileSync(transcriptPath, 'utf8').split('\n')) {
    if (!l) continue;
    let e;
    try { e = JSON.parse(l); } catch { continue; }
    if (e.type !== 'assistant' || !Array.isArray(e.message?.content) || !(Date.parse(e.timestamp) >= inicio)) continue;
    for (const b of e.message.content) {
      if (b?.type !== 'tool_use') continue;
      if (EDITA.has(b.name) || (b.name === 'Bash' && BASH_MUDA.test(String(b.input?.command ?? '')))) return true;
    }
  }
  return false;
}

let sessaoAtual = '';

function main() {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const { session_id: sid, transcript_path: tp, stop_hook_active: ativo } = input;
  sessaoAtual = sid ?? '';
  if (ativo) return registrar(sid, '', 'repetido');
  if (!sid || !tp) return registrar(sid, '', 'sem-entrada');

  // Sem item vivo com dono em lugar nenhum da fila: nada a conferir (e nada a registrar).
  const itens = itensComDono();
  if (itens.length === 0) return;

  const reg = resolverLocalId(sid);
  const local = reg?.localId;
  if (!local) return registrar(sid, '', 'sem-local-id');

  const meus = itens.filter((i) => i.dono === local);
  if (meus.length === 0) return;

  if (!existsSync(tp)) return registrar(sid, local, 'sem-inicio', 'transcript inexistente');
  const inicio = inicioDoTurno(tp);
  if (inicio === null) return registrar(sid, local, 'sem-inicio');

  if (!mudouNoTurno(tp, inicio)) return registrar(sid, local, 'passou-sem-mudar', meus.map((i) => i.id).join(','));
  const semEntrega = meus.filter((i) => i.semEntrega);
  if (semEntrega.length === 0) return registrar(sid, local, 'passou', meus.map((i) => i.id).join(','));

  const ids = semEntrega.map((i) => i.id);
  const cmds = ids.map((id) => `\`painel update fila ${id} '{"entrega":{"resultado":"…","medido":"…","naoMedido":"…","proximos":["…"]}}'\``).join(' · ');
  // O texto do painel (ids dos itens) é dado de outra sessão: com padrão de injeção, o aviso vai antes.
  const aviso = avisoDeInjecao(ids.join('\n'));
  process.stdout.write(JSON.stringify({
    decision: 'block',
    reason: `${aviso ? `${aviso}\n` : ''}O PR que fecha ${ids.length === 1 ? `o item ${ids[0]}` : `os itens ${ids.join(', ')}`} está na fila sem a entrega, que é o que o operador vê do que saiu. Grave-a: ${cmds} — resultado obrigatório, o resto quando houver (passo 6 do pool/dona.md).`,
  }));
  registrar(sid, local, 'bloqueou-entrega', ids.join(','));
}

try {
  main();
} catch (err) {
  registrar(sessaoAtual, '', 'erro', err?.stack || err);
}
process.exitCode = 0;
