#!/usr/bin/env node
// Stop hook da fila do pool (estudo de 24/10, passo 3): a sessão que é DONA de um item `em-andamento`
// da fila (coleção `fila` do painel) não termina o turno sem ter gravado algo nele neste turno.
//
// "Dona" = o `local_…` da sessão (registro do app, achado pelo cliSessionId ou pelos priorCliSessionIds)
// é o `donoLocalId` do item. "Gravou neste turno" = `atualizadoEm` do item não é anterior ao início do
// turno (a última entrada `user` com `origin.kind` do transcript, o mesmo critério do painel-das-sessoes).
// Protocolo: ~/.claude/orquestracao/pool/protocolo.md#fila-do-pool
//
// Erro do próprio hook vai para o log e DEIXA PASSAR. Variáveis para teste: FILA_DIR, FILA_APP_SESSOES_DIR, FILA_LOG.
import { readFileSync, existsSync, appendFileSync, readdirSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';

const FILA_DIR = process.env.FILA_DIR || join(homedir(), '.claude', 'orquestracao', 'painel', 'fila');
const SESSOES_DIR = process.env.FILA_APP_SESSOES_DIR || join(homedir(), 'Library', 'Application Support', 'Claude', 'claude-code-sessions');
const LOG = process.env.FILA_LOG || join(homedir(), '.claude', 'orquestracao', 'fila-hook.log');
const PROTOCOLO = '~/.claude/orquestracao/pool/protocolo.md#fila-do-pool';

function registrar(sessionId, localId, desfecho, detalhe = '') {
  try {
    mkdirSync(dirname(LOG), { recursive: true });
    const limpo = String(detalhe).replace(/[\t\r\n]+/g, ' ');
    appendFileSync(LOG, `${new Date().toISOString()}\t${sessionId ?? ''}\t${localId ?? ''}\t${desfecho}\t${limpo}\n`);
  } catch { /* sem log */ }
}

// Itens da fila que estão em andamento e têm dono: [{ id, dono, atualizadoEm }].
function itensEmAndamento() {
  if (!existsSync(FILA_DIR)) return [];
  const itens = [];
  for (const nome of readdirSync(FILA_DIR)) {
    if (!nome.endsWith('.json')) continue;
    try {
      const doc = JSON.parse(readFileSync(join(FILA_DIR, nome), 'utf8'));
      const d = doc?.data;
      if (d?.estado === 'em-andamento' && d?.donoLocalId) {
        itens.push({ id: doc.id ?? nome.replace(/\.json$/, ''), dono: d.donoLocalId, atualizadoEm: d.atualizadoEm });
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

// O `local_…` desta sessão. Lê como texto e só faz JSON.parse do que contém o session_id.
function resolverLocalId(sessionId) {
  for (const f of arquivosLocal(SESSOES_DIR)) {
    let texto;
    try { texto = readFileSync(f, 'utf8'); } catch { continue; }
    if (!texto.includes(sessionId)) continue;
    try {
      const r = JSON.parse(texto);
      if (r.cliSessionId === sessionId || (Array.isArray(r.priorCliSessionIds) && r.priorCliSessionIds.includes(sessionId))) {
        return r.sessionId || null;
      }
    } catch { /* registro ilegível */ }
  }
  return null;
}

// Timestamp (ms) do início do turno: última entrada `user` que abre turno — não `isMeta` e com
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
    if (e.type === 'user' && !e.isMeta && !ehResultado && (e.origin?.kind || e.turnOrigin)) {
      const t = Date.parse(e.timestamp);
      return Number.isNaN(t) ? null : t;
    }
  }
  return null;
}

let sessaoAtual = '';

function main() {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const { session_id: sid, transcript_path: tp, stop_hook_active: ativo } = input;
  sessaoAtual = sid ?? '';
  if (ativo) return registrar(sid, '', 'repetido');
  if (!sid || !tp) return registrar(sid, '', 'sem-entrada');

  // Sem item em andamento com dono em lugar nenhum da fila: nada a conferir (e nada a registrar).
  const itens = itensEmAndamento();
  if (itens.length === 0) return;

  const local = resolverLocalId(sid);
  if (!local) return registrar(sid, '', 'sem-local-id');

  const meus = itens.filter((i) => i.dono === local);
  if (meus.length === 0) return;

  if (!existsSync(tp)) return registrar(sid, local, 'sem-inicio', 'transcript inexistente');
  const inicio = inicioDoTurno(tp);
  if (inicio === null) return registrar(sid, local, 'sem-inicio');

  const pendentes = meus.filter((i) => {
    const t = Date.parse(i.atualizadoEm);
    return Number.isNaN(t) || t < inicio;
  });
  if (pendentes.length === 0) return registrar(sid, local, 'passou', meus.map((i) => i.id).join(','));

  const ids = pendentes.map((i) => i.id);
  const lista = ids.length === 1 ? `do item ${ids[0]} (em andamento)` : `dos itens ${ids.join(', ')} (em andamento)`;
  const cmds = ids.map((id) => `\`painel update fila ${id} '{"nota":"…"}'\``).join(' · ');
  process.stdout.write(JSON.stringify({
    decision: 'block',
    reason:
      `Você é dona ${lista} e não o atualizou neste turno. Grave o estado antes de terminar: ${cmds}, ` +
      `ou solte o item (protocolo em ${PROTOCOLO}).`,
  }));
  registrar(sid, local, 'bloqueou', ids.join(','));
}

try {
  main();
} catch (err) {
  registrar(sessaoAtual, '', 'erro', err?.stack || err);
}
process.exitCode = 0;
