// F439 (ADR 0030, fatia 2): o painel aceita o endereço da sessão do Orca (`orca_session_id:<id>`) onde aceitava o `local_…`
// do app: `com`, `sessoes`, `donoLocalId` e `sessaoId`. O worker tem id com hífens; a coordenadora, `claude_<uuid>` com
// sublinhados. Nunca toca o painel real: PAINEL_DIR, HOME, HOOKS_CREWAI_BASE e POOL_APP_SESSOES_DIR são temporários.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'skills', 'orquestradora', 'scripts');
const WORKER = 'orca_session_id:880dae07-91e8-4aae-9a46-0e857a656849';
const COORD = 'orca_session_id:claude_3c8ec4cb_1849_49ba_be37_f9215e9742a6';
const LOCAL = 'local_00000000-0000-4000-8000-0000000000a1';
const SEM_SINAIS = { CLAUDE_CODE_SESSION_ID: '', CLAUDE_CODE_HOST_SESSION_ID: '', ORCA_AGENT_SESSION_ID: '', ORCA_STRUCTURED_SESSION: '', KIT_ANFITRIAO: '' };

let base;
beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'painel-orca-'));
  for (const d of ['painel', 'home', 'orq', 'app', 'proj/.git']) mkdirSync(join(base, d), { recursive: true });
  writeFileSync(join(base, 'painel', 'temas.json'), JSON.stringify([{ id: 'editor', rotulo: 'Editor' }]));
});
afterEach(() => rmSync(base, { recursive: true, force: true }));

function painel(...args) {
  const r = spawnSync('node', [join(SCRIPTS, 'painel.mjs'), ...args], {
    encoding: 'utf8', timeout: 15000, killSignal: 'SIGKILL', cwd: join(base, 'proj'),
    env: { ...process.env, ...SEM_SINAIS, PAINEL_DIR: join(base, 'painel'), HOME: join(base, 'home'), HOOKS_CREWAI_BASE: join(base, 'orq'), POOL_APP_SESSOES_DIR: join(base, 'app') },
  });
  if (r.error) throw r.error;
  return { exit: r.status, out: r.stdout, err: r.stderr };
}
const passa = (r, msg) => assert.equal(r.exit, 0, `${msg}: ${r.err}`);
const recusa = (r, trecho, msg) => { assert.equal(r.exit, 1, `${msg}: deveria recusar (${r.out})`); assert.ok(r.err.includes(trecho), `${msg}: stderr sem "${trecho}": ${r.err}`); };
const item = (F) => JSON.parse(readFileSync(join(base, 'painel', 'fila', `${F}.json`), 'utf8')).data;
const novoItem = (F) => passa(painel('set', 'fila', F, JSON.stringify({ titulo: 'T', etapa: 'execucao', tema: 'editor' })), `set fila ${F}`);

test('com add e com del aceitam o worker e a coordenadora do Orca, ao lado do local_ do app', () => {
  novoItem('F1');
  passa(painel('com', 'add', 'F1', WORKER, 'dona', 'faz a fatia'), 'com add worker');
  passa(painel('com', 'add', 'F1', COORD, 'coordenadora', 'acompanha'), 'com add coordenadora');
  passa(painel('com', 'add', 'F1', LOCAL, 'app', 'revisa'), 'com add local_');
  assert.deepEqual(item('F1').com.map((c) => c.localId), [WORKER, COORD, LOCAL]);
  passa(painel('com', 'del', 'F1', WORKER), 'com del pelo id do Orca');
  passa(painel('com', 'del', 'F1', 'coordenadora'), 'com del pelo apelido');
  assert.deepEqual(item('F1').com.map((c) => c.localId), [LOCAL]);
});

test('donoLocalId e sessoes aceitam o id do Orca', () => {
  novoItem('F1');
  passa(painel('update', 'fila', 'F1', JSON.stringify({ donoLocalId: WORKER, donoApelido: 'dona' })), 'donoLocalId worker');
  assert.equal(item('F1').donoLocalId, WORKER);
  passa(painel('update', 'fila', 'F1', JSON.stringify({ donoLocalId: COORD, donoApelido: 'coord' })), 'donoLocalId coordenadora');
  passa(painel('update', 'fila', 'F1', JSON.stringify({ sessoes: [WORKER, COORD, LOCAL] })), 'sessoes');
  assert.deepEqual(item('F1').sessoes, [WORKER, COORD, LOCAL]);
});

test('o id que não é de sessão continua recusado, com a mensagem que cita os dois formatos', () => {
  novoItem('F1');
  for (const ruim of ['orca_session_id:', 'orca_session_id:a b', '880dae07-91e8-4aae-9a46-0e857a656849', 'local_x']) {
    recusa(painel('com', 'add', 'F1', ruim, 'dona', 'faz'), 'não é local_<uuid> nem orca_session_id:<id>', `com add ${ruim}`);
    recusa(painel('update', 'fila', 'F1', JSON.stringify({ donoLocalId: ruim, donoApelido: 'd' })), 'não é local_<uuid> nem orca_session_id:<id>', `donoLocalId ${ruim}`);
    recusa(painel('update', 'fila', 'F1', JSON.stringify({ sessoes: [ruim] })), 'sessoes é uma lista de local_<uuid> ou orca_session_id:<id>', `sessoes ${ruim}`);
  }
  assert.deepEqual(item('F1').com ?? [], []);
});

test('a pergunta aberta com o id do Orca volta no list perguntas --sessao do mesmo id (worker e coordenadora)', () => {
  passa(painel('set', 'perguntas', 'Q901', JSON.stringify({ estado: 'aberta', titulo: 'do worker', sessaoId: WORKER })), 'pergunta do worker');
  passa(painel('set', 'perguntas', 'Q902', JSON.stringify({ estado: 'aberta', titulo: 'da coordenadora', sessaoId: COORD })), 'pergunta da coordenadora');
  const ids = (r) => { passa(r, 'list'); return JSON.parse(r.out).map((d) => d.id); };
  assert.deepEqual(ids(painel('list', 'perguntas', '--sessao', WORKER)), ['Q901']);
  assert.deepEqual(ids(painel('list', 'perguntas', '--sessao', COORD)), ['Q902']);
});

test('sessoesDoItem (o custo do item) conta as sessões do Orca ao lado das do app', async () => {
  const { sessoesDoItem } = await import('../../skills/orquestradora/scripts/custo-do-item.mjs');
  const d = { sessoes: [LOCAL, 'lixo'], com: [{ localId: COORD }], donoLocalId: WORKER };
  assert.deepEqual(sessoesDoItem(d), [LOCAL, COORD, WORKER]);
});
