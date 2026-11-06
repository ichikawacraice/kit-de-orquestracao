// F439 (ADR 0030, fatia 2): a sessão do Orca no painel. O início da sessão no Orca grava `<BASE>/orca-sessoes/<id>.json`
// (o id do CLI, a pasta, a hora e o endereço do `send --to`); o registro da sessão (pool-comum) lê esse arquivo para o id
// `orca_session_id:<id>` e para o id do CLI, antes do registro do app. Nada toca ~/.claude: HOME, HOOKS_CREWAI_BASE,
// PAINEL_DIR e POOL_APP_SESSOES_DIR apontam para pasta temporária, e os sinais do anfitrião de quem roda o teste são apagados.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOKS = join(dirname(fileURLToPath(import.meta.url)), '..');
const base = mkdtempSync(join(tmpdir(), 'orca-sessoes-'));
for (const d of ['orq', 'app', 'home', 'painel/perguntas', 'proj/.git']) mkdirSync(join(base, d), { recursive: true });
process.env.HOME = join(base, 'home');
process.env.HOOKS_CREWAI_BASE = join(base, 'orq');
process.env.POOL_APP_SESSOES_DIR = join(base, 'app');
process.env.PAINEL_DIR = join(base, 'painel');
const SEM_SINAIS = { CLAUDE_CODE_HOST_SESSION_ID: '', ORCA_AGENT_SESSION_ID: '', ORCA_STRUCTURED_SESSION: '', ORCA_TERMINAL_HANDLE: '', KIT_ANFITRIAO: '' };
const PROJ = join(base, 'proj');
const WORKER = '880dae07-91e8-4aae-9a46-0e857a656849';
const COORD = 'claude_3c8ec4cb_1849_49ba_be37_f9215e9742a6';

const { gravarSessaoDoOrca, lerSessaoDoOrca, sessaoDoOrcaPeloCli, pastaDasSessoesDoOrca } = await import('../orca-sessoes.mjs');
const { registroDaSessao } = await import('../pool-comum.mjs');

const pasta = () => join(base, 'orq', 'orca-sessoes');
const noOrca = (id, extra = {}) => ({ ...SEM_SINAIS, ORCA_AGENT_SESSION_ID: id, ORCA_TERMINAL_HANDLE: `structworker_${id}`, ...extra });

test('a pasta das sessões do Orca mora no BASE do kit', () => {
  assert.equal(pastaDasSessoesDoOrca(), pasta());
});

test('o worker (id com hífens) grava o arquivo com o id do CLI, a pasta, a hora e o endereço do send', () => {
  const r = gravarSessaoDoOrca({ env: noOrca(WORKER), cliId: 'cli-w1', cwd: PROJ, agora: Date.parse('2026-11-06T12:00:00.000Z') });
  assert.ok(r, 'deveria devolver o registro gravado');
  const f = join(pasta(), `${WORKER}.json`);
  assert.ok(existsSync(f), `não gravou ${f}`);
  const d = JSON.parse(readFileSync(f, 'utf8'));
  assert.equal(d.orcaId, `orca_session_id:${WORKER}`);
  assert.equal(d.cliAtual, 'cli-w1');
  assert.deepEqual(d.cliIds, ['cli-w1']);
  assert.equal(d.cwd, PROJ);
  assert.equal(d.em, '2026-11-06T12:00:00.000Z');
  assert.equal(d.enderecoDoSend, `orca_session_id:${WORKER}`);
  assert.equal(d.terminal, `structworker_${WORKER}`);
  assert.deepEqual(lerSessaoDoOrca(`orca_session_id:${WORKER}`), d);
});

test('a coordenadora (claude_<uuid> com sublinhados) também grava', () => {
  gravarSessaoDoOrca({ env: noOrca(COORD, { ORCA_TERMINAL_HANDLE: '' }), cliId: 'cli-c1', cwd: PROJ });
  const d = lerSessaoDoOrca(`orca_session_id:${COORD}`);
  assert.ok(d, 'a coordenadora não ficou registrada');
  assert.equal(d.cliAtual, 'cli-c1');
  assert.equal(d.terminal, null);
});

test('a limpeza de contexto (id do CLI novo) regrava o arquivo e guarda os ids anteriores; o mesmo id não repete', () => {
  const id = 'aaaa1111-2222-4333-8444-555566667777';
  gravarSessaoDoOrca({ env: noOrca(id), cliId: 'cli-1', cwd: PROJ });
  gravarSessaoDoOrca({ env: noOrca(id), cliId: 'cli-2', cwd: PROJ });
  gravarSessaoDoOrca({ env: noOrca(id), cliId: 'cli-2', cwd: PROJ });
  const d = lerSessaoDoOrca(`orca_session_id:${id}`);
  assert.equal(d.cliAtual, 'cli-2');
  assert.deepEqual(d.cliIds, ['cli-2', 'cli-1']);
  assert.equal(sessaoDoOrcaPeloCli('cli-1')?.orcaId, `orca_session_id:${id}`);
  assert.equal(sessaoDoOrcaPeloCli('cli-2')?.orcaId, `orca_session_id:${id}`);
  assert.equal(sessaoDoOrcaPeloCli('cli-nenhum'), null);
});

test('sem id legível do Orca, ou sem o id do CLI, nada se grava', () => {
  const antes = existsSync(pasta()) ? readdirSync(pasta()).sort() : [];
  assert.equal(gravarSessaoDoOrca({ env: { ...SEM_SINAIS, ORCA_STRUCTURED_SESSION: '1' }, cliId: 'cli-x', cwd: PROJ }), null);
  assert.equal(gravarSessaoDoOrca({ env: noOrca('../fora'), cliId: 'cli-x', cwd: PROJ }), null);
  assert.equal(gravarSessaoDoOrca({ env: noOrca('com espaco'), cliId: 'cli-x', cwd: PROJ }), null);
  assert.equal(gravarSessaoDoOrca({ env: noOrca('bbbb-1'), cliId: '', cwd: PROJ }), null);
  assert.deepEqual(existsSync(pasta()) ? readdirSync(pasta()).sort() : [], antes);
  assert.ok(!existsSync(join(base, 'orq', 'fora.json')));
  assert.equal(lerSessaoDoOrca('orca_session_id:../fora'), null);
  assert.equal(lerSessaoDoOrca('local_qualquer'), null);
});

test('registroDaSessao: o id do Orca e o id do CLI dão o registro da sessão do Orca, com o formato de sempre', () => {
  const id = 'cccc1111-2222-4333-8444-555566667777';
  gravarSessaoDoOrca({ env: noOrca(id), cliId: 'cli-r1', cwd: PROJ });
  gravarSessaoDoOrca({ env: noOrca(id), cliId: 'cli-r2', cwd: PROJ });
  const esperado = { localId: `orca_session_id:${id}`, titulo: '', arquivada: false, cwd: PROJ, originCwd: PROJ, cliIds: ['cli-r2', 'cli-r1'], cliAtual: 'cli-r2' };
  assert.deepEqual(registroDaSessao(`orca_session_id:${id}`), { ...esperado, anterior: false });
  assert.deepEqual(registroDaSessao('cli-r2'), { ...esperado, anterior: false });
  assert.deepEqual(registroDaSessao('cli-r1'), { ...esperado, anterior: true });
  assert.equal(registroDaSessao('orca_session_id:dddd-nao-existe'), null);
});

test('registroDaSessao: o id do CLI que o cache guardou como "fora do registro" acha a sessão do Orca gravada depois', () => {
  assert.equal(registroDaSessao('cli-tarde'), null); // fica no cache como ausente
  const id = 'eeee1111-2222-4333-8444-555566667777';
  gravarSessaoDoOrca({ env: noOrca(id), cliId: 'cli-tarde', cwd: PROJ });
  assert.equal(registroDaSessao('cli-tarde')?.localId, `orca_session_id:${id}`);
});

test('registroDaSessao: a sessão do app segue pelo registro do app', () => {
  const local = 'local_00000000-0000-4000-8000-000000000001';
  writeFileSync(join(base, 'app', `${local}.json`), JSON.stringify({ sessionId: local, cliSessionId: 'cli-app', title: 'F1 · x', cwd: PROJ }));
  assert.equal(registroDaSessao('cli-app', { fresco: true })?.localId, local);
  assert.equal(registroDaSessao(local, { fresco: true })?.titulo, 'F1 · x');
});

// ---- o início da sessão ----
function inicio(sinais, sessionId) {
  const out = execFileSync(process.execPath, [join(HOOKS, 'sessao-inicio.mjs')], {
    input: JSON.stringify({ session_id: sessionId, hook_event_name: 'SessionStart', source: 'startup', cwd: PROJ }), encoding: 'utf8', timeout: 15000, killSignal: 'SIGKILL',
    env: { ...process.env, ...SEM_SINAIS, ...sinais },
  });
  return out ? JSON.parse(out).hookSpecificOutput.additionalContext : '';
}

test('o início da sessão no Orca grava o arquivo e o regrava na limpeza de contexto', () => {
  const id = 'ffff1111-2222-4333-8444-555566667777';
  inicio(noOrca(id), 'cli-i1');
  const d = lerSessaoDoOrca(`orca_session_id:${id}`);
  assert.ok(d, 'o início não gravou a sessão do Orca');
  assert.equal(d.cliAtual, 'cli-i1');
  assert.equal(d.cwd, PROJ);
  inicio(noOrca(id), 'cli-i2');
  assert.deepEqual(lerSessaoDoOrca(`orca_session_id:${id}`).cliIds, ['cli-i2', 'cli-i1']);
});

test('o início no app e no terminal não grava sessão do Orca', () => {
  const antes = existsSync(pasta()) ? readdirSync(pasta()).sort() : [];
  inicio({ CLAUDE_CODE_HOST_SESSION_ID: 'local_00000000-0000-4000-8000-000000000009', ORCA_AGENT_SESSION_ID: '9999-app' }, 'cli-app-1');
  inicio({}, 'cli-term-1');
  assert.deepEqual(existsSync(pasta()) ? readdirSync(pasta()).sort() : [], antes);
});

test('o início da sessão no Orca traz as perguntas que ela abriu com o id do Orca', () => {
  const id = '12341111-2222-4333-8444-555566667777';
  writeFileSync(join(base, 'painel', 'perguntas', 'Q901.json'), JSON.stringify({ id: 'Q901', version: 1, data: { estado: 'aberta', titulo: 'pergunta do worker do Orca', sessaoId: `orca_session_id:${id}`, criadaEm: new Date().toISOString() } }));
  const ctx = inicio(noOrca(id), 'cli-q1');
  assert.match(ctx, /Q901/);
  assert.match(ctx, /pergunta do worker do Orca/);
});

test.after(() => rmSync(base, { recursive: true, force: true }));
