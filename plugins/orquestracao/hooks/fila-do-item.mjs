#!/usr/bin/env node
// Stop hook da fila do pool (estudo de 24/10, passo 3): a sessão que é DONA de um item vivo da fila
// (coleção `fila` do painel: `donoLocalId` e `etapa` fora de feito/descartado) não termina o turno sem ter
// gravado algo nele neste turno — só em planejamento e design, onde ela trabalha (F153: das 389 cobranças medidas em
// 27/10, 216 eram em execução/validação/merge, com a dona só esperando; a cobrança de despacho segue em todas as etapas).
// Item ainda sem `etapa` (documento não migrado) vale pelo critério antigo,
// `estado === 'em-andamento'`; `estado: 'em-execucao'` sem `etapa` NÃO é visto (o limite que a migração eliminou).
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

// O aviso de injeção é opcional: se a varredura faltar ou falhar ao carregar, o hook segue sem ele.
// Hoje ele não protege nada (a razão do bloqueio só cita ids de item); prepara o caso de o texto do painel entrar aqui.
// Idem o pool-comum: sem ele não há como saber quem vai se soltar, e o hook cobra como sempre.
let vaiSoltar = () => false;
try {
  // Versão velha do pool-comum no cache pode carregar sem a função (B11): só adota o que é função.
  const m = await import('./pool-comum.mjs');
  if (typeof m.vaiSoltar === 'function') vaiSoltar = m.vaiSoltar;
} catch { /* sem a soltura */ }

// A regra "esperando papel" é de um módulo puro; se faltar no cache, o hook segue sem a cobrança nova.
let esperandoPapel = () => null;
try { ({ esperandoPapel } = await import('./esperando-papel.mjs')); } catch { /* sem a cobrança de espera */ }

let avisoDeInjecao = () => '';
try { ({ avisoDeInjecao } = await import('./varredura-entre-sessoes.mjs')); } catch { /* sem aviso */ }

const FILA_DIR = process.env.FILA_DIR || join(homedir(), '.claude', 'orquestracao', 'painel', 'fila');
const SESSOES_DIR = process.env.FILA_APP_SESSOES_DIR || join(homedir(), 'Library', 'Application Support', 'Claude', 'claude-code-sessions');
const LOG = process.env.FILA_LOG || join(homedir(), '.claude', 'orquestracao', 'fila-hook.log');
const PROTOCOLO = '~/.claude/orquestracao/pool/protocolo.md#fila-do-pool';
const PROTOCOLO_ESPERA = '~/.claude/orquestracao/pool/protocolo.md#esperando-papel';
const NOME_DA_ETAPA = { P: 'planejamento', D: 'design', E: 'execução', V: 'validação' };
const PROXIMA_ETAPA = { P: 'design ou execucao', D: 'execucao', E: 'validacao com uma V no com', V: 'merge' };

function registrar(sessionId, localId, desfecho, detalhe = '') {
  try {
    mkdirSync(dirname(LOG), { recursive: true });
    const limpo = String(detalhe).replace(/[\t\r\n]+/g, ' ');
    appendFileSync(LOG, `${new Date().toISOString()}\t${sessionId ?? ''}\t${localId ?? ''}\t${desfecho}\t${limpo}\n`);
  } catch { /* sem log */ }
}

const ETAPAS = ['planejamento', 'design', 'execucao', 'validacao', 'merge', 'feito', 'descartado'];
const ETAPAS_FINAIS = ['feito', 'descartado'];
const ETAPAS_DA_DONA = ['planejamento', 'design'];

// Itens da fila que têm dono e estão vivos: [{ id, dono, atualizadoEm, etapa, data }].
function itensComDono() {
  if (!existsSync(FILA_DIR)) return [];
  const itens = [];
  for (const nome of readdirSync(FILA_DIR)) {
    if (!nome.endsWith('.json')) continue;
    try {
      const doc = JSON.parse(readFileSync(join(FILA_DIR, nome), 'utf8'));
      const d = doc?.data;
      const vivo = ETAPAS.includes(d?.etapa) ? !ETAPAS_FINAIS.includes(d.etapa) : d?.estado === 'em-andamento';
      if (vivo && d?.donoLocalId) {
        itens.push({ id: doc.id ?? nome.replace(/\.json$/, ''), dono: d.donoLocalId, atualizadoEm: d.atualizadoEm, etapa: ETAPAS.includes(d.etapa) ? d.etapa : null, data: d });
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

// F58 (D4): a dona de item esperando o papel da etapa não termina o turno sem ter, DEPOIS do `desde` da espera, rodado
// `painel com add <F>` ou mandado mensagem (SendMessage / send_message) que cite o `F<n>`. Procura no transcript inteiro.
function despachos(transcriptPath) {
  const achados = [];
  for (const l of readFileSync(transcriptPath, 'utf8').split('\n')) {
    if (!l) continue;
    let e;
    try { e = JSON.parse(l); } catch { continue; }
    const c = e.type === 'assistant' && Array.isArray(e.message?.content) ? e.message.content : [];
    const t = Date.parse(e.timestamp);
    if (Number.isNaN(t)) continue;
    for (const b of c) {
      if (b?.type !== 'tool_use') continue;
      if (b.name === 'Bash') achados.push({ t, tipo: 'com', texto: String(b.input?.command ?? '') });
      else if (/(^|__)(SendMessage|send_message)$/.test(b.name)) achados.push({ t, tipo: 'msg', texto: JSON.stringify(b.input ?? {}) });
    }
  }
  return achados;
}
function semDespacho(meus, transcriptPath) {
  const esperando = meus.map((i) => ({ i, e: esperandoPapel(i.data, Date.now()) })).filter((x) => x.e);
  if (esperando.length === 0) return [];
  const feitos = despachos(transcriptPath);
  return esperando.filter(({ i, e }) => {
    const desde = Date.parse(e.desde);
    const cita = new RegExp(`\\b${i.id}\\b`);
    return !feitos.some((f) => f.t > desde && cita.test(f.texto) && (f.tipo === 'msg' || new RegExp(`\\bcom\\s+add\\s+${i.id}\\b`).test(f.texto)));
  }).map(({ i, e }) => ({ id: i.id, papel: e.papel, entregue: e.entregue }));
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

  // F32: quem se declarou livre SOBRE SI neste turno e é membro do pool é solta pelo `livre-se-limpa` (mesmo fim de turno, mesma função `vaiSoltar`): aqui não se cobra.
  let solta = false;
  try { solta = Boolean(vaiSoltar(tp, inicio, { sessionId: sid, localId: local, titulo: reg.titulo })); } catch { /* segue cobrando */ }
  if (solta) return registrar(sid, local, 'livre-no-turno', meus.map((i) => i.id).join(','));

  // F153: a gravação por turno só é cobrada onde a dona trabalha (planejamento, design e o legado sem etapa); em
  // execução, validação e merge quem trabalha é a E/V do `com`, e o item parado é da batida.
  const pendentes = meus.filter((i) => {
    if (i.etapa !== null && !ETAPAS_DA_DONA.includes(i.etapa)) return false;
    const t = Date.parse(i.atualizadoEm);
    return Number.isNaN(t) || t < inicio;
  });
  const parados = semDespacho(meus, tp);
  if (pendentes.length === 0 && parados.length === 0) return registrar(sid, local, 'passou', meus.map((i) => i.id).join(','));

  const ids = pendentes.map((i) => i.id);
  const lista = ids.length === 1 ? `do item ${ids[0]} (em andamento)` : `dos itens ${ids.join(', ')} (em andamento)`;
  const cmds = ids.map((id) => `\`painel update fila ${id} '{"agora":"…"}'\``).join(' · ');
  // O texto do painel (ids dos itens) é dado de outra sessão: com padrão de injeção, o aviso vai antes.
  const aviso = avisoDeInjecao([...ids, ...parados.map((p) => p.id)].join('\n'));
  const partes = [];
  if (pendentes.length > 0) {
    partes.push(`Você é dona ${lista} e não o atualizou neste turno. Grave o estado antes de terminar: ${cmds}, ou solte o item (protocolo em ${PROTOCOLO}).`);
  }
  for (const p of parados) {
    const ref = `(protocolo em ${PROTOCOLO_ESPERA})`;
    if (p.entregue) {
      partes.push(`${p.id}: a ${p.papel} entregou; avance a etapa (${PROXIMA_ETAPA[p.papel]}) ou mande uma linha à orquestradora citando ${p.id} ${ref}.`);
    } else if (p.papel === 'V') {
      partes.push(`${p.id} sem V no item: se o laudo já voltou, avance a etapa (merge) ou mande o conserto; senão, despache uma V (\`painel com add ${p.id} <local_> <apelido> "<oQue>"\` e mensagem a ela) ou mande uma linha à orquestradora citando ${p.id} ${ref}.`);
    } else {
      partes.push(`${p.id} está em ${NOME_DA_ETAPA[p.papel]} sem nenhuma ${p.papel} no item. Antes de terminar: despache (título da sessão livre, \`painel com add ${p.id} <local_> <apelido> "<oQue>"\` e mensagem a ela) ou mande mensagem (SendMessage) que cite ${p.id} à orquestradora pedindo a vaga ${ref}.`);
    }
  }
  process.stdout.write(JSON.stringify({
    decision: 'block',
    reason: (aviso ? `${aviso}\n` : '') + partes.join('\n'),
  }));
  registrar(sid, local, 'bloqueou', [...ids, ...parados.map((p) => p.id)].join(','));
}

try {
  main();
} catch (err) {
  registrar(sessaoAtual, '', 'erro', err?.stack || err);
}
process.exitCode = 0;
