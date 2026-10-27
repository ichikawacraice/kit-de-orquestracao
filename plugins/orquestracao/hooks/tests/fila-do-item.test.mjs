#!/usr/bin/env node
// Testes do Stop hook fila-do-item (a dona grava o item no turno que mudou algo): transcript sintético, registro de
// sessões do app sintético, fila e log em pasta temporária (FILA_DIR, FILA_APP_SESSOES_DIR, FILA_LOG).
// Rodar: node gate/com-fichas.mjs -- node plugins/orquestracao/hooks/tests/fila-do-item.test.mjs   (HOOKS_DIR troca a pasta dos hooks)
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
  const reg = { sessionId: local, cliSessionId: cli, priorCliSessionIds: prior, title: 'F12 · uma dona', remoteMcpServersConfig: [{ name: 'x', tools: [] }] };
  writeFileSync(join(base, 'sessoes', 'conta', 'projeto', `${local}.json`), JSON.stringify(reg));
}
function transcript(entradas) {
  const f = join(base, 't.jsonl');
  writeFileSync(f, `${entradas.map((e) => JSON.stringify(e)).join('\n')}\n`);
  return f;
}
const usaNoTurno = (name, input, timestamp = '2026-10-24T12:00:10.000Z') => ({ type: 'assistant', uuid: `a-${name}-${timestamp}`, timestamp, message: { role: 'assistant', content: [{ type: 'tool_use', id: `t-${name}`, name, input }] } });
const EDITA = () => usaNoTurno('Edit', { file_path: '/r/a.mjs', old_string: 'a', new_string: 'b' });
// O turno de sempre: um turno antigo, o turno atual aberto por outra sessão e uma edição nele (o turno MUDOU algo).
const turno = (...usos) => [
  { type: 'user', uuid: 'u0', timestamp: '2026-10-24T10:00:00.000Z', origin: { kind: 'human' }, message: { role: 'user', content: 'turno antigo' } },
  { type: 'assistant', uuid: 'a0', timestamp: '2026-10-24T10:00:05.000Z', message: { role: 'assistant', content: [{ type: 'text', text: 'ok' }] } },
  { type: 'user', uuid: 'u1', timestamp: INICIO, origin: { kind: 'peer' }, message: { role: 'user', content: 'siga com o F12' } },
  { type: 'assistant', uuid: 'a1', timestamp: '2026-10-24T12:00:05.000Z', message: { role: 'assistant', content: [{ type: 'text', text: 'feito' }] } },
  ...(usos.length ? usos : [EDITA()]),
];
const vivo = (extra = {}) => ({ etapa: 'execucao', donoLocalId: LOCAL, donoApelido: 'dona', ...extra });
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

caso('1 item vivo da dona, gravado ANTES do início de um turno que editou: bloqueia, cita o ID e manda gravar agora', () => {
  item('F12', vivo({ atualizadoEm: ANTES }));
  registroLocal(LOCAL, SID);
  const f = transcript(turno());
  // Guardas contra insumo vazio: há item na fila e o transcript TEM a entrada de início do turno.
  ok(readdirSync(filaDir()).filter((n) => n.endsWith('.json')).length >= 1, 'precondição: a fila está vazia');
  const inicio = readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
    .filter((e) => e.type === 'user' && e.origin?.kind).pop();
  ok(inicio && inicio.timestamp === INICIO, 'precondição: o transcript não tem a entrada de início do turno');
  const r = rodar(stop());
  igual(r?.decision, 'block', 'decisão');
  ok(r.reason.includes('F12') && r.reason.includes('"agora"') && r.reason.includes('protocolo.md#painel-em-dia'), `motivo: ${r.reason}`);
  igual(desfechos().join(','), 'bloqueou', 'log');
});
caso('1b dois itens pendentes: o motivo lista os dois', () => {
  item('F12', vivo({ atualizadoEm: ANTES }));
  item('F13', vivo({ etapa: 'planejamento', atualizadoEm: ANTES }));
  registroLocal(LOCAL, SID);
  transcript(turno());
  const r = rodar(stop());
  ok(r?.decision === 'block' && r.reason.includes('F12') && r.reason.includes('F13'), `motivo: ${r?.reason}`);
});
caso('1c commit, push, PR e sed -i também mudam; em qualquer etapa viva, inclusive merge', () => {
  for (const [etapa, cmd] of [['planejamento', 'git commit -m x'], ['validacao', 'git push -u origin b'], ['merge', 'gh pr create --title x'], ['execucao', 'git -C /r/wt commit -m x'], ['design', 'sed -i s/a/b/ /r/a.mjs']]) {
    rmSync(join(filaDir(), 'F40.json'), { force: true });
    item('F40', vivo({ etapa, atualizadoEm: ANTES }));
    registroLocal(LOCAL, SID);
    transcript(turno(usaNoTurno('Bash', { command: cmd })));
    igual(rodar(stop())?.decision, 'block', `${etapa}: ${cmd}`);
  }
});
caso('2 o mesmo item gravado DEPOIS do início: passa', () => {
  item('F12', vivo({ atualizadoEm: DEPOIS }));
  registroLocal(LOCAL, SID);
  transcript(turno());
  igual(rodar(stop()), null, 'saída');
  igual(desfechos().join(','), 'passou', 'log');
});
caso('2b turno que só leu ou esperou: passa (com edição, o mesmo item bloquearia)', () => {
  item('F12', vivo({ etapa: 'merge', atualizadoEm: ANTES }));
  registroLocal(LOCAL, SID);
  transcript(turno(usaNoTurno('Bash', { command: 'git status' }), usaNoTurno('Read', { file_path: '/r/a.mjs' })));
  igual(rodar(stop()), null, 'só leu');
  igual(desfechos().join(','), 'passou-sem-mudar', 'log');
  transcript(turno(usaNoTurno('Write', { file_path: '/r/b.md', content: 'x' })));
  igual(rodar(stop())?.decision, 'block', 'prova: com escrita bloqueia');
});
caso('2c a edição de um turno ANTERIOR não conta', () => {
  item('F12', vivo({ atualizadoEm: ANTES }));
  registroLocal(LOCAL, SID);
  const t = turno(usaNoTurno('Read', { file_path: '/r/a.mjs' }));
  t.splice(1, 0, usaNoTurno('Edit', { file_path: '/r/a.mjs' }, '2026-10-24T10:00:03.000Z'));
  transcript(t);
  igual(rodar(stop()), null, 'passa');
});
caso('3 sessão sem item: passa e não registra nada', () => {
  registroLocal(LOCAL, SID);
  transcript(turno());
  igual(rodar(stop()), null, 'saída');
  igual(desfechos().length, 0, 'log');
});
caso('4 item de OUTRA dona, desatualizado: passa', () => {
  item('F12', vivo({ donoLocalId: OUTRO, atualizadoEm: ANTES }));
  registroLocal(LOCAL, SID);
  transcript(turno());
  igual(rodar(stop()), null, 'saída');
});
caso('5 item da dona em feito, descartado ou sem etapa: passa (a presença é detectada em execucao)', () => {
  for (const extra of [{ etapa: 'feito' }, { etapa: 'descartado' }, { etapa: undefined, estado: 'em-andamento' }]) {
    item('F12', vivo({ ...extra, atualizadoEm: ANTES }));
    registroLocal(LOCAL, SID);
    transcript(turno());
    igual(rodar(stop()), null, `${JSON.stringify(extra)} devia passar`);
  }
  item('F12', vivo({ atualizadoEm: ANTES }));
  igual(rodar(stop())?.decision, 'block', 'prova: em execucao bloqueia');
});
caso('6 session_id só em priorCliSessionIds (sessão limpa): resolve e bloqueia', () => {
  item('F12', vivo({ atualizadoEm: ANTES }));
  registroLocal(LOCAL, 'cccccccc-atual', [SID_ANTIGO, SID]);
  transcript(turno());
  igual(rodar(stop())?.decision, 'block', 'decisão');
});
caso('7 local_… não encontrado: passa e o log tem sem-local-id', () => {
  item('F12', vivo({ atualizadoEm: ANTES }));
  registroLocal(LOCAL, 'dddddddd-de-outra-sessao');
  transcript(turno());
  igual(rodar(stop()), null, 'saída');
  igual(desfechos().join(','), 'sem-local-id', 'log');
});
caso('8 stop_hook_active: passa e registra repetido', () => {
  item('F12', vivo({ atualizadoEm: ANTES }));
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
  item('F12', vivo({ atualizadoEm: ANTES }));
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
  item('F12', vivo({ atualizadoEm: ANTES }));
  registroLocal(LOCAL, SID);
  const f = transcript([
    { type: 'user', uuid: 'u1', timestamp: INICIO, turnOrigin: 'sdk', message: { role: 'user', content: 'siga com o F12' } },
    EDITA(),
  ]);
  const linhas = readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  ok(linhas.some((e) => e.turnOrigin === 'sdk' && !e.origin), 'precondição: sem a entrada sdk sem origin');
  igual(rodar(stop())?.decision, 'block', 'decisão');
});
caso('9b turno sdk depois de um turno humano antigo: bloqueia (não cai no turno antigo)', () => {
  item('F12', vivo({ atualizadoEm: '2026-10-24T11:00:00.000Z' }));
  registroLocal(LOCAL, SID);
  transcript([
    { type: 'user', uuid: 'u0', timestamp: '2026-10-24T10:00:00.000Z', origin: { kind: 'human' }, message: { role: 'user', content: 'antigo' } },
    { type: 'assistant', uuid: 'a0', timestamp: '2026-10-24T10:00:05.000Z', message: { role: 'assistant', content: [] } },
    { type: 'user', uuid: 'u1', timestamp: INICIO, turnOrigin: 'sdk', message: { role: 'user', content: 'siga com o F12' } },
    { type: 'user', uuid: 'u2', timestamp: '2026-10-24T12:00:03.000Z', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'x', content: 'ok' }] } },
    EDITA(),
  ]);
  // Com o critério antigo o início seria 10:00 e o item (11:00) "passaria" calado.
  igual(rodar(stop())?.decision, 'block', 'decisão');
});
caso('9c item vivo da dona SEM atualizadoEm: bloqueia', () => {
  item('F12', vivo());
  registroLocal(LOCAL, SID);
  transcript(turno());
  igual(rodar(stop())?.decision, 'block', 'decisão');
});
caso('9d item gravado ENTRE o turno real (T1) e uma entrada isMeta SEM origem (T3): passa; se ela virasse início (T3) bloquearia', () => {
  item('F12', vivo({ atualizadoEm: '2026-10-24T12:25:00.000Z' }));
  registroLocal(LOCAL, SID);
  transcript([
    { type: 'user', uuid: 'u1', timestamp: '2026-10-24T12:20:00.000Z', turnOrigin: 'sdk', message: { role: 'user', content: 'siga com o F12' } },
    usaNoTurno('Edit', { file_path: '/r/a.mjs' }, '2026-10-24T12:21:00.000Z'),
    { type: 'user', uuid: 'u2', isMeta: true, timestamp: '2026-10-24T12:30:00.000Z', message: { role: 'user', content: 'lembrete' } },
  ]);
  igual(rodar(stop()), null, 'saída');
  igual(desfechos().join(','), 'passou', 'log');
});
// R1: o início do turno é o do turno aberto por outra sessão (meta com origem), não o do turno humano anterior.
caso('R1: item gravado ANTES de um turno aberto por peer (meta com origem), depois de um humano → bloqueia (o turno atual não o gravou)', () => {
  item('F12', vivo({ atualizadoEm: '2026-10-24T12:20:00.000Z' }));
  registroLocal(LOCAL, SID);
  transcript([
    { type: 'user', uuid: 'u1', timestamp: '2026-10-24T12:10:00.000Z', origin: { kind: 'human' }, message: { role: 'user', content: 'siga com o F12' } },
    { type: 'user', uuid: 'u2', isMeta: true, timestamp: '2026-10-24T12:30:00.000Z', origin: { kind: 'peer' }, message: { role: 'user', content: '<cross-session-message>conserte</cross-session-message>' } },
    usaNoTurno('Edit', { file_path: '/r/a.mjs' }, '2026-10-24T12:31:00.000Z'),
  ]);
  const r = rodar(stop());
  ok(r?.decision === 'block' && /F12/.test(r.reason), `esperava block citando F12, veio ${JSON.stringify(r)}`);
});
caso('R1: o mesmo item gravado DEPOIS do turno aberto por peer → passa', () => {
  item('F12', vivo({ atualizadoEm: '2026-10-24T12:40:00.000Z' }));
  registroLocal(LOCAL, SID);
  transcript([
    { type: 'user', uuid: 'u1', timestamp: '2026-10-24T12:10:00.000Z', origin: { kind: 'human' }, message: { role: 'user', content: 'siga com o F12' } },
    { type: 'user', uuid: 'u2', isMeta: true, timestamp: '2026-10-24T12:30:00.000Z', origin: { kind: 'peer' }, message: { role: 'user', content: 'conserte' } },
    usaNoTurno('Edit', { file_path: '/r/a.mjs' }, '2026-10-24T12:31:00.000Z'),
  ]);
  igual(rodar(stop()), null, 'saída');
});

console.log(falhas ? `\n${falhas} FALHA(S)` : '\ntodos verdes');
process.exitCode = falhas ? 1 : 0;
