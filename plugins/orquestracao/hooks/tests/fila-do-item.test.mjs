#!/usr/bin/env node
// Testes do Stop hook da fila do pool (hooks/fila-do-item.mjs): transcript sintético, registro de
// sessões do app sintético, fila e log em pasta temporária (FILA_DIR, FILA_APP_SESSOES_DIR, FILA_LOG).
// Rodar: node ~/.claude/hooks/tests/fila-do-item.test.mjs   (HOOKS_DIR troca a pasta dos hooks)
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOKS = process.env.HOOKS_DIR || join(dirname(fileURLToPath(import.meta.url)), '..');
const SID = '11111111-2222-3333-4444-555555555555';
const SID_ANTIGO = '99999999-8888-7777-6666-000000000000';
const LOCAL = 'local_aaaaaaaa-0000-0000-0000-000000000001';
const OUTRO = 'local_bbbbbbbb-0000-0000-0000-000000000002';
const INICIO = '2026-10-24T12:00:00.000Z';
const ANTES = '2026-10-24T11:00:00.000Z';
const DEPOIS = '2026-10-24T12:30:00.000Z';

let base;
let falhas = 0;

function novoBase() {
  base = mkdtempSync(join(tmpdir(), 'fila-hook-'));
  mkdirSync(join(base, 'fila'));
  mkdirSync(join(base, 'sessoes', 'conta', 'projeto'), { recursive: true });
}
const filaDir = () => join(base, 'fila');
const logArq = () => join(base, 'fila-hook.log');

function item(id, data) {
  writeFileSync(join(filaDir(), `${id}.json`), `${JSON.stringify({ id, version: 1, data })}\n`);
}
function registroLocal(local, cli, prior = []) {
  const reg = { sessionId: local, cliSessionId: cli, priorCliSessionIds: prior, title: 'E1 · exec · F12', remoteMcpServersConfig: [{ name: 'x', tools: [] }] };
  writeFileSync(join(base, 'sessoes', 'conta', 'projeto', `${local}.json`), JSON.stringify(reg));
}
function transcript(entradas) {
  const f = join(base, 't.jsonl');
  writeFileSync(f, `${entradas.map((e) => JSON.stringify(e)).join('\n')}\n`);
  return f;
}
const turno = () => [
  { type: 'user', uuid: 'u0', timestamp: '2026-10-24T10:00:00.000Z', origin: { kind: 'human' }, message: { role: 'user', content: 'turno antigo' } },
  { type: 'assistant', uuid: 'a0', timestamp: '2026-10-24T10:00:05.000Z', message: { role: 'assistant', content: [{ type: 'text', text: 'ok' }] } },
  { type: 'user', uuid: 'u1', timestamp: INICIO, origin: { kind: 'peer' }, message: { role: 'user', content: 'F12 para você: painel fila/F12' } },
  { type: 'assistant', uuid: 'a1', timestamp: '2026-10-24T12:00:05.000Z', message: { role: 'assistant', content: [{ type: 'text', text: 'feito' }] } },
];
function rodar(evento, sessoes = join(base, 'sessoes'), hooksDir = HOOKS) {
  const entrada = typeof evento === 'string' ? evento : JSON.stringify(evento);
  const out = execFileSync('node', [join(hooksDir, 'fila-do-item.mjs')], {
    input: entrada, encoding: 'utf8', timeout: 10000, killSignal: 'SIGKILL',
    env: { ...process.env, FILA_DIR: filaDir(), FILA_APP_SESSOES_DIR: sessoes, FILA_LOG: logArq() },
  });
  return out ? JSON.parse(out) : null;
}
const stop = (extra = {}) => ({ session_id: SID, transcript_path: join(base, 't.jsonl'), cwd: '/r', hook_event_name: 'Stop', stop_hook_active: false, ...extra });
const desfechos = () => (existsSync(logArq()) ? readFileSync(logArq(), 'utf8').trim().split('\n').map((l) => l.split('\t')[3]) : []);

function caso(nome, fn) {
  novoBase();
  try { fn(); console.log(`ok   ${nome}`); } catch (e) { falhas++; console.log(`FAIL ${nome}\n     ${e.message}`); }
  rmSync(base, { recursive: true, force: true });
}
function igual(a, b, msg) { if (a !== b) throw new Error(`${msg}: esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`); }
function ok(cond, msg) { if (!cond) throw new Error(msg); }

caso('1 item em-andamento do dono, atualizado ANTES do início do turno: bloqueia e cita o ID', () => {
  item('F12', { estado: 'em-andamento', donoLocalId: LOCAL, atualizadoEm: ANTES });
  registroLocal(LOCAL, SID);
  const f = transcript(turno());
  // Guardas contra insumo vazio: há item na fila e o transcript TEM a entrada de início do turno.
  ok(readdirSync(filaDir()).filter((n) => n.endsWith('.json')).length >= 1, 'precondição: a fila está vazia');
  const inicio = readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
    .filter((e) => e.type === 'user' && e.origin?.kind).pop();
  ok(inicio && inicio.timestamp === INICIO, 'precondição: o transcript não tem a entrada de início do turno');
  const r = rodar(stop());
  igual(r?.decision, 'block', 'decisão');
  ok(r.reason.includes('F12'), `o motivo não cita o ID: ${r.reason}`);
  igual(desfechos().join(','), 'bloqueou', 'log');
});
caso('1b dois itens pendentes: o motivo lista os dois', () => {
  item('F12', { estado: 'em-andamento', donoLocalId: LOCAL, atualizadoEm: ANTES });
  item('F13', { estado: 'em-andamento', donoLocalId: LOCAL, atualizadoEm: ANTES });
  registroLocal(LOCAL, SID);
  transcript(turno());
  const r = rodar(stop());
  ok(r?.decision === 'block' && r.reason.includes('F12') && r.reason.includes('F13'), `motivo: ${r?.reason}`);
});
caso('2 o mesmo item atualizado DEPOIS do início: passa (saída vazia)', () => {
  item('F12', { estado: 'em-andamento', donoLocalId: LOCAL, atualizadoEm: DEPOIS });
  registroLocal(LOCAL, SID);
  transcript(turno());
  igual(rodar(stop()), null, 'saída');
  igual(desfechos().join(','), 'passou', 'log');
});
caso('3 sessão sem item: passa e não registra nada', () => {
  registroLocal(LOCAL, SID);
  transcript(turno());
  igual(rodar(stop()), null, 'saída');
  igual(desfechos().length, 0, 'log');
});
caso('4 item de OUTRO dono, desatualizado: passa', () => {
  item('F12', { estado: 'em-andamento', donoLocalId: OUTRO, atualizadoEm: ANTES });
  registroLocal(LOCAL, SID);
  transcript(turno());
  igual(rodar(stop()), null, 'saída');
});
caso('5 item do dono em estado bloqueado ou aberto: passa', () => {
  item('F12', { estado: 'bloqueado', donoLocalId: LOCAL, atualizadoEm: ANTES });
  item('F13', { estado: 'aberto', donoLocalId: LOCAL, atualizadoEm: ANTES });
  registroLocal(LOCAL, SID);
  transcript(turno());
  igual(rodar(stop()), null, 'saída');
});
caso('6 session_id só em priorCliSessionIds (sessão limpa): resolve e bloqueia', () => {
  item('F12', { estado: 'em-andamento', donoLocalId: LOCAL, atualizadoEm: ANTES });
  registroLocal(LOCAL, 'cccccccc-atual', [SID_ANTIGO, SID]);
  transcript(turno());
  igual(rodar(stop())?.decision, 'block', 'decisão');
});
caso('7 local_… não encontrado: passa e o log tem sem-local-id', () => {
  item('F12', { estado: 'em-andamento', donoLocalId: LOCAL, atualizadoEm: ANTES });
  registroLocal(LOCAL, 'dddddddd-de-outra-sessao');
  transcript(turno());
  igual(rodar(stop()), null, 'saída');
  igual(desfechos().join(','), 'sem-local-id', 'log');
});
caso('8 stop_hook_active: passa e registra repetido', () => {
  item('F12', { estado: 'em-andamento', donoLocalId: LOCAL, atualizadoEm: ANTES });
  registroLocal(LOCAL, SID);
  transcript(turno());
  igual(rodar(stop({ stop_hook_active: true })), null, 'saída');
  igual(desfechos().join(','), 'repetido', 'log');
});
caso('8b sem session_id ou sem transcript_path: passa e registra sem-entrada', () => {
  igual(rodar({ transcript_path: '/x.jsonl', stop_hook_active: false }), null, 'sem session_id');
  igual(rodar({ session_id: SID, stop_hook_active: false }), null, 'sem transcript');
  igual(desfechos().join(','), 'sem-entrada,sem-entrada', 'log');
});
caso('8c transcript sem entrada de início de turno: passa e registra sem-inicio', () => {
  item('F12', { estado: 'em-andamento', donoLocalId: LOCAL, atualizadoEm: ANTES });
  registroLocal(LOCAL, SID);
  transcript([{ type: 'assistant', uuid: 'a1', timestamp: INICIO, message: { role: 'assistant', content: [] } }]);
  igual(rodar(stop()), null, 'saída');
  igual(desfechos().join(','), 'sem-inicio', 'log');
});
caso('8d entrada quebrada: sai 0, sem saída, erro no log', () => {
  igual(rodar('{nao json'), null, 'saída');
  igual(desfechos().join(','), 'erro', 'log');
});

caso('9a turno aberto por turnOrigin "sdk" (sem origin), item antes do início: bloqueia', () => {
  item('F12', { estado: 'em-andamento', donoLocalId: LOCAL, atualizadoEm: ANTES });
  registroLocal(LOCAL, SID);
  const f = transcript([
    { type: 'user', uuid: 'u1', timestamp: INICIO, turnOrigin: 'sdk', message: { role: 'user', content: 'F12 para você' } },
    { type: 'assistant', uuid: 'a1', timestamp: '2026-10-24T12:00:05.000Z', message: { role: 'assistant', content: [] } },
  ]);
  const linhas = readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  ok(linhas.some((e) => e.turnOrigin === 'sdk' && !e.origin), 'precondição: sem a entrada sdk sem origin');
  igual(rodar(stop())?.decision, 'block', 'decisão');
});
caso('9b turno sdk depois de um turno humano antigo: bloqueia (não cai no turno antigo)', () => {
  item('F12', { estado: 'em-andamento', donoLocalId: LOCAL, atualizadoEm: '2026-10-24T11:00:00.000Z' });
  registroLocal(LOCAL, SID);
  transcript([
    { type: 'user', uuid: 'u0', timestamp: '2026-10-24T10:00:00.000Z', origin: { kind: 'human' }, message: { role: 'user', content: 'antigo' } },
    { type: 'assistant', uuid: 'a0', timestamp: '2026-10-24T10:00:05.000Z', message: { role: 'assistant', content: [] } },
    { type: 'user', uuid: 'u1', timestamp: INICIO, turnOrigin: 'sdk', message: { role: 'user', content: 'F12 para você' } },
    { type: 'user', uuid: 'u2', timestamp: '2026-10-24T12:00:03.000Z', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'x', content: 'ok' }] } },
  ]);
  // Com o critério antigo o início seria 10:00 e o item (11:00) "passaria" calado.
  igual(rodar(stop())?.decision, 'block', 'decisão');
});
caso('9c item em-andamento do dono SEM atualizadoEm: bloqueia', () => {
  item('F12', { estado: 'em-andamento', donoLocalId: LOCAL });
  registroLocal(LOCAL, SID);
  transcript(turno());
  igual(rodar(stop())?.decision, 'block', 'decisão');
});

caso('9d item atualizado ENTRE o turno real (T1) e uma entrada isMeta SEM origem (T3): passa; se ela virasse início (T3) bloquearia', () => {
  // O briefing da F7 esperava "bloqueia" aqui, mas com início T1 e item em T2 ≥ T1 o hook PASSA; é o isMeta contado
  // como início (T3 > T2) que bloquearia. O caso discrimina pela direção que o código realmente toma.
  item('F12', { estado: 'em-andamento', donoLocalId: LOCAL, atualizadoEm: '2026-10-24T12:25:00.000Z' });
  registroLocal(LOCAL, SID);
  transcript([
    { type: 'user', uuid: 'u1', timestamp: '2026-10-24T12:20:00.000Z', turnOrigin: 'sdk', message: { role: 'user', content: 'F12 para você' } },
    { type: 'user', uuid: 'u2', isMeta: true, timestamp: '2026-10-24T12:30:00.000Z', message: { role: 'user', content: 'lembrete' } },
  ]);
  igual(rodar(stop()), null, 'saída');
  igual(desfechos().join(','), 'passou', 'log');
});


// ---- F27 fatia 3: a trava cobra o ITEM (donoLocalId + etapa), não o estado antigo ----
const bloqueia = (data, msg) => { item('F27', data); registroLocal(LOCAL, SID); transcript(turno()); return rodar(stop()); };
caso('F27-3a: item com dono e etapa "execucao", sem gravação no turno: bloqueia e manda gravar `agora`', () => {
  const r = bloqueia({ etapa: 'execucao', tema: 'editor', donoLocalId: LOCAL, atualizadoEm: ANTES });
  igual(r?.decision, 'block', 'decisão'); ok(r.reason.includes('F27'), `cita o ID: ${r.reason}`);
  ok(r.reason.includes('"agora"') && !r.reason.includes('"nota"'), `a mensagem manda gravar agora, não nota: ${r.reason}`);
});
caso('F27-3b: etapa "feito" ou "descartado" com dono: passa', () => {
  for (const etapa of ['feito', 'descartado']) {
    const r = bloqueia({ etapa, donoLocalId: LOCAL, atualizadoEm: ANTES });
    igual(r, null, `etapa ${etapa} devia passar`);
  }
});
caso('F27-3c: documento antigo (estado em-andamento, sem etapa): bloqueia — compatibilidade', () => {
  const r = bloqueia({ estado: 'em-andamento', donoLocalId: LOCAL, atualizadoEm: ANTES });
  igual(r?.decision, 'block', 'decisão');
});
caso('F27-3d: estado "em-execucao" sem etapa: PASSA (o limite que existiu e que a migração elimina)', () => {
  igual(bloqueia({ estado: 'em-execucao', donoLocalId: LOCAL, atualizadoEm: ANTES }), null, 'passa');
});
caso('F27-3e: com etapa nova, o estado antigo que sobrou não decide (etapa feito + estado em-andamento passa; etapa execucao + estado feito bloqueia)', () => {
  igual(bloqueia({ etapa: 'feito', estado: 'em-andamento', donoLocalId: LOCAL, atualizadoEm: ANTES }), null, 'feito vence');
  rmSync(join(filaDir(), 'F27.json'));
  igual(bloqueia({ etapa: 'execucao', estado: 'feito', donoLocalId: LOCAL, atualizadoEm: ANTES })?.decision, 'block', 'execucao vence');
});
caso('F27-3f: item com dono e etapa, gravado DEPOIS do início do turno: passa', () => {
  igual(bloqueia({ etapa: 'validacao', donoLocalId: LOCAL, atualizadoEm: DEPOIS }), null, 'passa');
});

const livreNoTurno = () => [...turno(), { type: 'assistant', uuid: 'a2', timestamp: '2026-10-24T12:01:00.000Z', message: { role: 'assistant', content: [{ type: 'tool_use', name: 'mcp__ccd_session_mgmt__set_session_title', input: { session_id: 'self', title: 'P1 · livre' } }] } }];
caso('F32: a dona que se declarou livre no turno passa (livre-no-turno): o livre-se-limpa a solta', () => {
  item('F12', { etapa: 'planejamento', donoLocalId: LOCAL, atualizadoEm: ANTES });
  registroLocal(LOCAL, SID);
  transcript(livreNoTurno());
  igual(rodar(stop()), null, 'saída');
  igual(desfechos().join(','), 'livre-no-turno', 'log');
});
caso('F32: a dona que NÃO se declarou livre continua bloqueada, com o mesmo item e o mesmo transcript sem o título livre', () => {
  item('F12', { etapa: 'planejamento', donoLocalId: LOCAL, atualizadoEm: ANTES });
  registroLocal(LOCAL, SID);
  transcript(turno());
  igual(rodar(stop())?.decision, 'block', 'decisão');
  igual(desfechos().join(','), 'bloqueou', 'log');
});

const linhaDeOutra = (alvo) => [...turno(), { type: 'assistant', uuid: 'a3', timestamp: '2026-10-24T12:01:00.000Z', message: { role: 'assistant', content: [{ type: 'tool_use', name: 'Bash', input: { command: `node ~/.claude/skills/orquestradora/scripts/painel.mjs update sessoes ${alvo} '{"estado":"parada","etapa":"livre"}'` } }] } }];
caso('F32 A1: a dona que grava a linha de OUTRA sessão como livre continua cobrada', () => {
  item('F12', { etapa: 'planejamento', donoLocalId: LOCAL, atualizadoEm: ANTES });
  registroLocal(LOCAL, SID);
  transcript(linhaDeOutra(OUTRO));
  igual(rodar(stop())?.decision, 'block', 'decisão');
  igual(desfechos().join(','), 'bloqueou', 'log');
});
caso('F32 M4: a dona fora do pool (orquestradora) que se declara livre continua cobrada: ninguém a solta', () => {
  item('F12', { etapa: 'merge', donoLocalId: LOCAL, atualizadoEm: ANTES });
  writeFileSync(join(base, 'sessoes', 'conta', 'projeto', `${LOCAL}.json`), JSON.stringify({ sessionId: LOCAL, cliSessionId: SID, priorCliSessionIds: [], title: '🎛 orquestradora — x' }));
  transcript(linhaDeOutra(LOCAL));
  igual(rodar(stop())?.decision, 'block', 'decisão');
  igual(desfechos().join(','), 'bloqueou', 'log');
});
caso('F32: a dona de título de pool que grava a PRÓPRIA linha como livre passa (a mesma decisão do livre-se-limpa)', () => {
  item('F12', { etapa: 'planejamento', donoLocalId: LOCAL, atualizadoEm: ANTES });
  registroLocal(LOCAL, SID);
  transcript(linhaDeOutra(LOCAL));
  igual(rodar(stop()), null, 'saída');
  igual(desfechos().join(','), 'livre-no-turno', 'log');
});

// B11: o `vaiSoltar` do pool-comum pode faltar (versão velha no cache) ou lançar; nos dois o hook segue e cobra como antes.
function hooksComPool(corpo) {
  const d = join(base, 'hooks-b11'); mkdirSync(d);
  writeFileSync(join(d, 'fila-do-item.mjs'), readFileSync(join(HOOKS, 'fila-do-item.mjs'), 'utf8'));
  writeFileSync(join(d, 'pool-comum.mjs'), corpo);
  return d;
}
caso('B11a: pool-comum carregado SEM a função vaiSoltar → o hook não derruba e cobra como antes', () => {
  const d = hooksComPool('export const outraCoisa = 1;\n');
  item('F12', { estado: 'em-andamento', donoLocalId: LOCAL, atualizadoEm: ANTES });
  registroLocal(LOCAL, SID); transcript(turno());
  const r = rodar(stop(), join(base, 'sessoes'), d);
  ok(r?.decision === 'block' && /F12/.test(r.reason), `esperava block citando F12, veio ${JSON.stringify(r)}`);
  igual(desfechos().includes('erro') || desfechos().includes('erro-interno'), false, 'o hook não deve registrar erro');
});
caso('B11b: vaiSoltar que LANÇA → o hook não derruba e cobra como antes', () => {
  const d = hooksComPool("export function vaiSoltar() { throw new Error('quebrou'); }\n");
  item('F12', { estado: 'em-andamento', donoLocalId: LOCAL, atualizadoEm: ANTES });
  registroLocal(LOCAL, SID); transcript(turno());
  const r = rodar(stop(), join(base, 'sessoes'), d);
  ok(r?.decision === 'block' && /F12/.test(r.reason), `esperava block citando F12, veio ${JSON.stringify(r)}`);
});
caso('B11c: precondição — com o vaiSoltar verdadeiro o hook solta (não é só um "sempre cobra")', () => {
  const d = hooksComPool('export function vaiSoltar() { return true; }\n');
  item('F12', { estado: 'em-andamento', donoLocalId: LOCAL, atualizadoEm: ANTES });
  registroLocal(LOCAL, SID); transcript(turno());
  igual(rodar(stop(), join(base, 'sessoes'), d), null, 'saída');
  igual(desfechos().join(','), 'livre-no-turno', 'log');
});

// R1: o início do turno é o do turno aberto por outra sessão (meta com origem), não o do turno humano anterior.
caso('R1: item gravado ANTES de um turno aberto por peer (meta com origem), depois de um humano → bloqueia (o turno atual não o gravou)', () => {
  item('F12', { estado: 'em-andamento', donoLocalId: LOCAL, atualizadoEm: '2026-10-24T12:20:00.000Z' });
  registroLocal(LOCAL, SID);
  transcript([
    { type: 'user', uuid: 'u1', timestamp: '2026-10-24T12:10:00.000Z', origin: { kind: 'human' }, message: { role: 'user', content: 'F12 para você' } },
    { type: 'user', uuid: 'u2', isMeta: true, timestamp: '2026-10-24T12:30:00.000Z', origin: { kind: 'peer' }, message: { role: 'user', content: '<cross-session-message>valide</cross-session-message>' } },
  ]);
  const r = rodar(stop());
  ok(r?.decision === 'block' && /F12/.test(r.reason), `esperava block citando F12, veio ${JSON.stringify(r)}`);
});
caso('R1: o mesmo item gravado DEPOIS do turno aberto por peer → passa', () => {
  item('F12', { estado: 'em-andamento', donoLocalId: LOCAL, atualizadoEm: '2026-10-24T12:40:00.000Z' });
  registroLocal(LOCAL, SID);
  transcript([
    { type: 'user', uuid: 'u1', timestamp: '2026-10-24T12:10:00.000Z', origin: { kind: 'human' }, message: { role: 'user', content: 'F12 para você' } },
    { type: 'user', uuid: 'u2', isMeta: true, timestamp: '2026-10-24T12:30:00.000Z', origin: { kind: 'peer' }, message: { role: 'user', content: 'valide' } },
  ]);
  igual(rodar(stop()), null, 'saída');
});

console.log(falhas ? `\n${falhas} FALHA(S)` : '\ntodos verdes');
process.exitCode = falhas ? 1 : 0;
