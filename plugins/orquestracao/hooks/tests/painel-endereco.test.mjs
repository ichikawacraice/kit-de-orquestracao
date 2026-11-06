// F448 (ADR 0030, fatia 9): a pergunta grava, no nascimento, o endereço de entrega da resposta. No Orca é o `--to` que o
// `orca orchestration send` aceita (`endereco.orca`: `orca_session_id:`, `dispatch:` ou `run:`); a rota da aba usa só ele,
// nunca o título da sessão nem "a orquestradora ativa". O painel preenche o endereço pelo `sessaoId` do Orca, aceita o
// explícito e recusa o malformado e a pergunta nascida no Orca sem endereço. Nunca toca o painel real.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'skills', 'orquestradora', 'scripts');
const WORKER = 'orca_session_id:880dae07-91e8-4aae-9a46-0e857a656849';
const OUTRO_WORKER = 'orca_session_id:11111111-2222-4333-8444-555555555555';
const COORD = 'orca_session_id:claude_3c8ec4cb_1849_49ba_be37_f9215e9742a6';
const LOCAL = 'local_00000000-0000-4000-8000-0000000000a1';
const SEM_SINAIS = { CLAUDE_CODE_SESSION_ID: '', CLAUDE_CODE_HOST_SESSION_ID: '', ORCA_AGENT_SESSION_ID: '', ORCA_STRUCTURED_SESSION: '', KIT_ANFITRIAO: '' };
const NO_ORCA = { ORCA_AGENT_SESSION_ID: WORKER.slice('orca_session_id:'.length), ORCA_STRUCTURED_SESSION: '1' };
const NO_APP = { CLAUDE_CODE_HOST_SESSION_ID: LOCAL };

let base;
beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'painel-endereco-'));
  for (const d of ['painel', 'home', 'orq', 'app', 'proj/.git']) mkdirSync(join(base, d), { recursive: true });
  writeFileSync(join(base, 'painel', 'temas.json'), JSON.stringify([{ id: 'editor', rotulo: 'Editor' }]));
});
afterEach(() => rmSync(base, { recursive: true, force: true }));

function painel(env, ...args) {
  const r = spawnSync('node', [join(SCRIPTS, 'painel.mjs'), ...args], {
    encoding: 'utf8', timeout: 15000, killSignal: 'SIGKILL', cwd: join(base, 'proj'),
    env: { ...process.env, ...SEM_SINAIS, ...env, PAINEL_DIR: join(base, 'painel'), HOME: join(base, 'home'), HOOKS_CREWAI_BASE: join(base, 'orq'), POOL_APP_SESSOES_DIR: join(base, 'app') },
  });
  if (r.error) throw r.error;
  return { exit: r.status, out: r.stdout, err: r.stderr };
}
const passa = (r, msg) => assert.equal(r.exit, 0, `${msg}: ${r.err}`);
const recusa = (r, trecho, msg) => { assert.equal(r.exit, 1, `${msg}: deveria recusar (${r.out})`); assert.ok(r.err.includes(trecho), `${msg}: stderr sem "${trecho}": ${r.err}`); };
const pergunta = (Q) => JSON.parse(readFileSync(join(base, 'painel', 'perguntas', `${Q}.json`), 'utf8')).data;
const set = (env, Q, data) => painel(env, 'set', 'perguntas', Q, JSON.stringify(data));

test('a pergunta aberta ou assumida com sessaoId do Orca nasce com o endereço de entrega dela (worker e coordenadora)', () => {
  passa(set(NO_ORCA, 'Q1', { estado: 'aberta', titulo: 'do worker', sessaoId: WORKER }), 'aberta do worker');
  passa(set(NO_ORCA, 'Q2', { estado: 'assumida', titulo: 'da coordenadora', sessaoId: COORD }), 'assumida da coordenadora');
  assert.deepEqual(pergunta('Q1').endereco, { orca: WORKER });
  assert.deepEqual(pergunta('Q2').endereco, { orca: COORD });
});

test('a pergunta do app não ganha endereço do Orca (o preenchimento é só do id do Orca)', () => {
  passa(set(NO_APP, 'Q1', { estado: 'aberta', titulo: 'do app', sessaoId: LOCAL }), 'aberta do app');
  assert.equal(pergunta('Q1').endereco, undefined);
});

test('o endereço explícito fica como veio (dispatch: e run:), e o malformado é recusado sem gravar', () => {
  passa(set(NO_ORCA, 'Q1', { estado: 'aberta', titulo: 'a', sessaoId: WORKER, endereco: { orca: 'dispatch:ctx_6eb257172494' } }), 'dispatch:');
  passa(set(NO_ORCA, 'Q2', { estado: 'aberta', titulo: 'b', sessaoId: WORKER, endereco: { orca: 'run:run_a' } }), 'run:');
  assert.deepEqual(pergunta('Q1').endereco, { orca: 'dispatch:ctx_6eb257172494' });
  assert.deepEqual(pergunta('Q2').endereco, { orca: 'run:run_a' });
  for (const [Q, ruim] of [['Q3', { orca: "run:x'; rm -rf ~" }], ['Q4', { orca: 'term_ab12' }], ['Q5', { orca: 3 }], ['Q6', 'dispatch:ctx_1'], ['Q7', { app: LOCAL }], ['Q8', { orca: 'dispatch:ctx_1', app: LOCAL }]]) {
    recusa(set(NO_ORCA, Q, { estado: 'aberta', titulo: 'c', sessaoId: WORKER, endereco: ruim }), 'endereco', `endereco ${JSON.stringify(ruim)}`);
  }
  recusa(painel(NO_ORCA, 'update', 'perguntas', 'Q1', JSON.stringify({ endereco: { orca: 'dispatch:a b' } })), 'endereco', 'update com endereço ruim');
  assert.deepEqual(pergunta('Q1').endereco, { orca: 'dispatch:ctx_6eb257172494' }, 'o update recusado não gravou');
});

test('no Orca, a pergunta que nasce sem endereço de entrega é recusada; no app, a mesma passa', () => {
  // Prova de presença: no app a pergunta com sessaoId do app nasce normalmente.
  passa(set(NO_APP, 'Q1', { estado: 'aberta', titulo: 'do app', sessaoId: LOCAL }), 'no app');
  recusa(set(NO_ORCA, 'Q2', { estado: 'aberta', titulo: 'no orca com local_', sessaoId: LOCAL }), 'endereço de entrega', 'aberta no Orca sem endereço');
  recusa(set(NO_ORCA, 'Q3', { estado: 'assumida', titulo: 'no orca com local_', sessaoId: LOCAL }), 'endereço de entrega', 'assumida no Orca sem endereço');
  // Com o endereço explícito, a sessão do Orca pode registrar a pergunta de outra (o operador decide onde a resposta chega).
  passa(set(NO_ORCA, 'Q4', { estado: 'aberta', titulo: 'explícito', sessaoId: LOCAL, endereco: { orca: 'run:run_a' } }), 'com endereço explícito');
  // A pergunta respondida (ou cancelada) não espera entrega: nasce sem endereço também no Orca.
  passa(set(NO_ORCA, 'Q5', { estado: 'respondida', titulo: 'já resolvida', sessaoId: LOCAL, resposta: 'sim' }), 'respondida');
});

test('no Orca, mexer numa pergunta do app que já existe não exige endereço (só o nascimento e a troca de sessaoId exigem)', () => {
  passa(set(NO_APP, 'Q1', { estado: 'aberta', titulo: 'do app', sessaoId: LOCAL }), 'nasce no app');
  passa(painel(NO_ORCA, 'update', 'perguntas', 'Q1', JSON.stringify({ nota: 'visto pela coordenadora do Orca' })), 'nota pelo Orca');
  assert.equal(pergunta('Q1').endereco, undefined);
});

test('o endereço derivado acompanha a troca de sessaoId; o explícito não muda com ela', () => {
  passa(set(NO_ORCA, 'Q1', { estado: 'aberta', titulo: 'a', sessaoId: WORKER }), 'derivado');
  passa(painel(NO_ORCA, 'update', 'perguntas', 'Q1', JSON.stringify({ sessaoId: OUTRO_WORKER })), 'troca sessaoId');
  assert.deepEqual(pergunta('Q1').endereco, { orca: OUTRO_WORKER });
  passa(set(NO_ORCA, 'Q2', { estado: 'aberta', titulo: 'b', sessaoId: WORKER, endereco: { orca: 'dispatch:ctx_1' } }), 'explícito');
  passa(painel(NO_ORCA, 'update', 'perguntas', 'Q2', JSON.stringify({ sessaoId: OUTRO_WORKER })), 'troca sessaoId do explícito');
  assert.deepEqual(pergunta('Q2').endereco, { orca: 'dispatch:ctx_1' });
});

test('o endereço não muda com o título da sessão nem com a orquestradora ativa', () => {
  // A orquestradora ativa do projeto (marcador ativas/) e um título de orquestradora na pergunta não desviam o endereço.
  mkdirSync(join(base, 'orq', 'ativas'), { recursive: true });
  writeFileSync(join(base, 'orq', 'ativas', 'cli-orq'), `${join(base, 'proj', '.git')}\n${COORD}\n`);
  passa(set(NO_ORCA, 'Q1', { estado: 'aberta', titulo: 'da dona', sessao: '🎛 orquestradora — proj', sessaoId: WORKER }), 'pergunta da dona');
  assert.deepEqual(pergunta('Q1').endereco, { orca: WORKER });
});
