#!/usr/bin/env node
// Testes do Stop hook fila-do-item (a dona grava a entrega no turno que mudou algo com o PR que fecha o item na fila; desde o
// F424 o `agora` não se cobra): transcript sintético, registro de sessões do app sintético, fila, projeção da batida e log em
// pasta temporária (FILA_DIR, FILA_APP_SESSOES_DIR, FILA_LOG, FILA_DEDUZIDO).
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
const deduzidoArq = () => join(base, 'deduzido.json');
function deduzido(itens, em = DEPOIS) { writeFileSync(deduzidoArq(), JSON.stringify({ em, itens })); }

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
    env: { ...process.env, FILA_DIR: filaDir(), FILA_APP_SESSOES_DIR: sessoes, FILA_LOG: logArq(), FILA_DEDUZIDO: deduzidoArq() },
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

// O item cuja entrega a trava cobra: o PR que fecha o item está na fila (merge, com PR, sem maisFatias) e sem entrega.
const emMerge = (extra = {}) => vivo({ etapa: 'merge', prs: [77], atualizadoEm: DEPOIS, ...extra });

caso('F424 item vivo da dona, sem o agora gravado no turno que editou: passa (a etapa e o parado são da batida)', () => {
  item('F12', vivo({ atualizadoEm: ANTES }));
  registroLocal(LOCAL, SID);
  const f = transcript(turno());
  // Guardas contra insumo vazio: há item na fila e o transcript TEM a entrada de início do turno e a edição.
  ok(readdirSync(filaDir()).filter((n) => n.endsWith('.json')).length >= 1, 'precondição: a fila está vazia');
  const linhas = readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  ok(linhas.filter((e) => e.type === 'user' && e.origin?.kind).pop()?.timestamp === INICIO, 'precondição: o transcript não tem a entrada de início do turno');
  ok(linhas.some((e) => e.message?.content?.[0]?.name === 'Edit'), 'precondição: o turno não editou');
  igual(rodar(stop()), null, 'saída');
  igual(desfechos().join(','), 'passou', 'log');
  // Sem atualizadoEm nenhum, também passa.
  item('F12', vivo());
  igual(rodar(stop()), null, 'sem atualizadoEm');
  // Prova de presença: o mesmo turno, com o PR que fecha o item na fila sem entrega, bloqueia.
  item('F12', emMerge({ atualizadoEm: ANTES }));
  const r = rodar(stop());
  igual(r?.decision, 'block', 'prova: sem entrega bloqueia');
  ok(!r.reason.includes('"agora"') && !r.reason.includes('mudou algo neste turno e não o gravou'), `o motivo ainda cobra o agora: ${r.reason}`);
});
caso('1b dois itens sem entrega: o motivo lista os dois', () => {
  item('F12', emMerge());
  item('F13', emMerge({ prs: [78] }));
  registroLocal(LOCAL, SID);
  transcript(turno());
  const r = rodar(stop());
  ok(r?.decision === 'block' && r.reason.includes('F12') && r.reason.includes('F13'), `motivo: ${r?.reason}`);
});
caso('1c commit, push, PR e sed -i também mudam', () => {
  for (const cmd of ['git commit -m x', 'git push -u origin b', 'gh pr create --title x', 'git -C /r/wt commit -m x', 'sed -i s/a/b/ /r/a.mjs']) {
    item('F40', emMerge());
    registroLocal(LOCAL, SID);
    transcript(turno(usaNoTurno('Bash', { command: cmd })));
    igual(rodar(stop())?.decision, 'block', cmd);
  }
});
caso('2b turno que só leu ou esperou: passa (com edição, o mesmo item bloquearia)', () => {
  item('F12', emMerge());
  registroLocal(LOCAL, SID);
  transcript(turno(usaNoTurno('Bash', { command: 'git status' }), usaNoTurno('Read', { file_path: '/r/a.mjs' })));
  igual(rodar(stop()), null, 'só leu');
  igual(desfechos().join(','), 'passou-sem-mudar', 'log');
  transcript(turno(usaNoTurno('Write', { file_path: '/r/b.md', content: 'x' })));
  igual(rodar(stop())?.decision, 'block', 'prova: com escrita bloqueia');
});
caso('2c a edição de um turno ANTERIOR não conta', () => {
  item('F12', emMerge());
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
caso('4 item de OUTRA dona, sem entrega: passa', () => {
  item('F12', emMerge({ donoLocalId: OUTRO }));
  registroLocal(LOCAL, SID);
  transcript(turno());
  igual(rodar(stop()), null, 'saída');
});
caso('5 item da dona em feito, descartado ou sem etapa: passa (a presença é detectada em merge)', () => {
  for (const extra of [{ etapa: 'feito' }, { etapa: 'descartado' }, { etapa: undefined, estado: 'em-andamento' }]) {
    item('F12', emMerge(extra));
    registroLocal(LOCAL, SID);
    transcript(turno());
    igual(rodar(stop()), null, `${JSON.stringify(extra)} devia passar`);
  }
  item('F12', emMerge());
  igual(rodar(stop())?.decision, 'block', 'prova: em merge bloqueia');
});
caso('6 session_id só em priorCliSessionIds (sessão limpa): resolve e bloqueia', () => {
  item('F12', emMerge());
  registroLocal(LOCAL, 'cccccccc-atual', [SID_ANTIGO, SID]);
  transcript(turno());
  igual(rodar(stop())?.decision, 'block', 'decisão');
});
caso('7 local_… não encontrado: passa e o log tem sem-local-id', () => {
  item('F12', emMerge());
  registroLocal(LOCAL, 'dddddddd-de-outra-sessao');
  transcript(turno());
  igual(rodar(stop()), null, 'saída');
  igual(desfechos().join(','), 'sem-local-id', 'log');
});
caso('8 stop_hook_active: passa e registra repetido', () => {
  item('F12', emMerge());
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
  item('F12', emMerge());
  registroLocal(LOCAL, SID);
  transcript([{ type: 'assistant', uuid: 'a1', timestamp: INICIO, message: { role: 'assistant', content: [] } }]);
  igual(rodar(stop()), null, 'saída');
  igual(desfechos().join(','), 'sem-inicio', 'log');
});
caso('8d entrada quebrada: sai 0, sem saída, erro no log', () => {
  igual(rodar('{nao json'), null, 'saída');
  igual(desfechos().join(','), 'erro', 'log');
});
caso('9a turno aberto por turnOrigin "sdk" (sem origin) que editou: bloqueia', () => {
  item('F12', emMerge());
  registroLocal(LOCAL, SID);
  const f = transcript([
    { type: 'user', uuid: 'u1', timestamp: INICIO, turnOrigin: 'sdk', message: { role: 'user', content: 'siga com o F12' } },
    EDITA(),
  ]);
  const linhas = readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  ok(linhas.some((e) => e.turnOrigin === 'sdk' && !e.origin), 'precondição: sem a entrada sdk sem origin');
  igual(rodar(stop())?.decision, 'block', 'decisão');
});
caso('9b turno sdk que só leu, depois de um turno humano antigo que editou: passa (não cai no turno antigo)', () => {
  item('F12', emMerge());
  registroLocal(LOCAL, SID);
  transcript([
    { type: 'user', uuid: 'u0', timestamp: '2026-10-24T10:00:00.000Z', origin: { kind: 'human' }, message: { role: 'user', content: 'antigo' } },
    usaNoTurno('Edit', { file_path: '/r/a.mjs' }, '2026-10-24T10:00:05.000Z'),
    { type: 'user', uuid: 'u1', timestamp: INICIO, turnOrigin: 'sdk', message: { role: 'user', content: 'siga com o F12' } },
    { type: 'user', uuid: 'u2', timestamp: '2026-10-24T12:00:03.000Z', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'x', content: 'ok' }] } },
    usaNoTurno('Read', { file_path: '/r/a.mjs' }),
  ]);
  // Com o início no turno antigo (10:00), a edição dele contaria e o item bloquearia.
  igual(rodar(stop()), null, 'saída');
  igual(desfechos().join(','), 'passou-sem-mudar', 'log');
});
caso('9d edição ENTRE o turno real (T1) e uma entrada isMeta SEM origem (T3): bloqueia; se ela virasse início (T3) passaria', () => {
  item('F12', emMerge());
  registroLocal(LOCAL, SID);
  transcript([
    { type: 'user', uuid: 'u1', timestamp: '2026-10-24T12:20:00.000Z', turnOrigin: 'sdk', message: { role: 'user', content: 'siga com o F12' } },
    usaNoTurno('Edit', { file_path: '/r/a.mjs' }, '2026-10-24T12:21:00.000Z'),
    { type: 'user', uuid: 'u2', isMeta: true, timestamp: '2026-10-24T12:30:00.000Z', message: { role: 'user', content: 'lembrete' } },
  ]);
  igual(rodar(stop())?.decision, 'block', 'decisão');
  igual(desfechos().join(','), 'bloqueou-entrega', 'log');
});
// R1: o início do turno é o do turno aberto por outra sessão (meta com origem), não o do turno humano anterior.
caso('R1: edição só ANTES de um turno aberto por peer (meta com origem), depois de um humano → passa (o turno atual não mudou nada)', () => {
  item('F12', emMerge());
  registroLocal(LOCAL, SID);
  transcript([
    { type: 'user', uuid: 'u1', timestamp: '2026-10-24T12:10:00.000Z', origin: { kind: 'human' }, message: { role: 'user', content: 'siga com o F12' } },
    usaNoTurno('Edit', { file_path: '/r/a.mjs' }, '2026-10-24T12:20:00.000Z'),
    { type: 'user', uuid: 'u2', isMeta: true, timestamp: '2026-10-24T12:30:00.000Z', origin: { kind: 'peer' }, message: { role: 'user', content: '<cross-session-message>conserte</cross-session-message>' } },
    usaNoTurno('Read', { file_path: '/r/a.mjs' }, '2026-10-24T12:31:00.000Z'),
  ]);
  igual(rodar(stop()), null, 'saída');
});
caso('R1: edição DEPOIS do turno aberto por peer → bloqueia citando o item', () => {
  item('F12', emMerge());
  registroLocal(LOCAL, SID);
  transcript([
    { type: 'user', uuid: 'u1', timestamp: '2026-10-24T12:10:00.000Z', origin: { kind: 'human' }, message: { role: 'user', content: 'siga com o F12' } },
    { type: 'user', uuid: 'u2', isMeta: true, timestamp: '2026-10-24T12:30:00.000Z', origin: { kind: 'peer' }, message: { role: 'user', content: 'conserte' } },
    usaNoTurno('Edit', { file_path: '/r/a.mjs' }, '2026-10-24T12:31:00.000Z'),
  ]);
  const r = rodar(stop());
  ok(r?.decision === 'block' && /F12/.test(r.reason), `esperava block citando F12, veio ${JSON.stringify(r)}`);
});

// F404 (ADR 0024): o PR que fecha o item leva a entrega; a trava cobra.
caso('F404: item meu em merge com PR, sem maisFatias e sem entrega: bloqueia com o comando da entrega', () => {
  item('F12', emMerge());
  registroLocal(LOCAL, SID);
  transcript(turno(usaNoTurno('Bash', { command: 'gh pr create --title x' })));
  const r = rodar(stop());
  igual(r?.decision, 'block', 'decisão');
  ok(r.reason.includes('F12') && r.reason.includes('"entrega"') && r.reason.includes('"resultado"') && r.reason.includes('dona.md'), `motivo: ${r.reason}`);
  igual(desfechos().join(','), 'bloqueou-entrega', 'log');
});
caso('F404: com entrega.resultado passa; maisFatias true passa; fora de merge passa; merge sem PR passa', () => {
  registroLocal(LOCAL, SID);
  transcript(turno());
  for (const [rotulo, dado] of [
    ['com entrega', emMerge({ entrega: { resultado: 'a home caiu de 984 ms para 270 ms' } })],
    ['maisFatias', emMerge({ maisFatias: true })],
    ['execucao', emMerge({ etapa: 'execucao' })],
    ['merge sem PR', emMerge({ prs: [] })],
  ]) {
    item('F12', dado);
    igual(rodar(stop()), null, rotulo);
  }
  item('F12', emMerge());
  igual(rodar(stop())?.decision, 'block', 'prova: sem entrega bloqueia');
});
caso('F404: entrega com resultado vazio ou só espaço não conta', () => {
  registroLocal(LOCAL, SID);
  transcript(turno());
  item('F12', emMerge({ entrega: { resultado: '  ' } }));
  igual(rodar(stop())?.decision, 'block', 'resultado vazio');
});
caso('F404: turno que só leu não é cobrado pela entrega', () => {
  registroLocal(LOCAL, SID);
  item('F12', emMerge());
  transcript(turno(usaNoTurno('Read', { file_path: '/r/a.mjs' })));
  igual(rodar(stop()), null, 'só leu');
});
caso('F424: item sem o agora gravado E sem entrega: o bloqueio cobra só a entrega', () => {
  registroLocal(LOCAL, SID);
  item('F12', emMerge({ atualizadoEm: ANTES }));
  transcript(turno());
  const r = rodar(stop());
  ok(r?.decision === 'block' && r.reason.includes('"entrega"') && !r.reason.includes('"agora"'), `motivo: ${r?.reason}`);
  igual(desfechos().join(','), 'bloqueou-entrega', 'log');
});

// F424 (ADR 0027): a etapa e os PRs deduzidos pela batida valem sobre os declarados.
caso('F424: o PR deduzido pela batida conta, mesmo sem a dona ter declarado etapa nem PR', () => {
  registroLocal(LOCAL, SID);
  transcript(turno());
  item('F12', vivo());
  igual(rodar(stop()), null, 'sem a projeção, o declarado (execucao, sem PR) passa');
  deduzido({ F12: { etapa: 'merge', prs: [77], prsAbertos: [77] } });
  ok(existsSync(deduzidoArq()), 'precondição: a projeção não foi gravada');
  const r = rodar(stop());
  ok(r?.decision === 'block' && r.reason.includes('F12') && r.reason.includes('"entrega"'), `esperava block da entrega, veio ${JSON.stringify(r)}`);
});
caso('F424: a etapa deduzida fora de merge (PR fechado sem merge) solta o item declarado em merge', () => {
  registroLocal(LOCAL, SID);
  transcript(turno());
  item('F12', emMerge());
  deduzido({ F12: { etapa: 'execucao', prs: [77], prsAbertos: [] } });
  igual(rodar(stop()), null, 'deduzido em execucao passa');
  deduzido({ F13: { etapa: 'execucao', prs: [] } });
  igual(rodar(stop())?.decision, 'block', 'prova: projeção de outro item não mexe no F12');
});
caso('F424: projeção mais velha que a gravação do item (o --anotar depois da batida) não vale', () => {
  registroLocal(LOCAL, SID);
  transcript(turno());
  item('F12', emMerge());
  deduzido({ F12: { etapa: 'execucao', prs: [], prsAbertos: [] } }, ANTES);
  igual(rodar(stop())?.decision, 'block', 'a batida de antes do PR não esconde o PR que o --anotar gravou');
  deduzido({ F12: { etapa: 'execucao', prs: [], prsAbertos: [] } }, DEPOIS);
  igual(rodar(stop()), null, 'prova: a mesma projeção, posterior à gravação, solta o item');
});
caso('F424: projeção ilegível vale como ausente (o declarado decide)', () => {
  registroLocal(LOCAL, SID);
  transcript(turno());
  item('F12', emMerge());
  writeFileSync(deduzidoArq(), '{quebrado');
  igual(rodar(stop())?.decision, 'block', 'declarado em merge sem entrega bloqueia');
  igual(desfechos().join(','), 'bloqueou-entrega', 'log sem erro');
});

console.log(falhas ? `\n${falhas} FALHA(S)` : '\ntodos verdes');
process.exitCode = falhas ? 1 : 0;
