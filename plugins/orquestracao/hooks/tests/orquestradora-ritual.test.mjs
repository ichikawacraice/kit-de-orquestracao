// F59: o Stop da orquestradora cobra o resumo do modo ausente quando há período desligado sem entrega.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { beforeEach, afterEach } from 'node:test';
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';

const HOOK = join(dirname(fileURLToPath(import.meta.url)), '..', 'orquestradora-ritual.mjs');
const haH = (h) => new Date(Date.now() - h * 3600_000).toISOString();

function cenario({ bandeira, entregue = false, cwdGit = true } = {}) {
  const raiz = mkdtempSync(join(tmpdir(), 'ritual-'));
  const home = join(raiz, 'home'); const base = join(raiz, 'orq');
  const sid = 'sess-orq';
  mkdirSync(join(home, '.claude', 'orquestracao', 'ativas'), { recursive: true });
  writeFileSync(join(home, '.claude', 'orquestracao', 'ativas', sid), '');
  mkdirSync(base, { recursive: true });
  const repo = join(raiz, 'meuprojeto'); mkdirSync(repo);
  if (cwdGit) execFileSync('git', ['init', '-q', repo], { timeout: 15000, killSignal: 'SIGKILL' });
  if (bandeira) writeFileSync(join(base, 'operador-ausente.json'), JSON.stringify(bandeira));
  if (entregue) {
    mkdirSync(join(base, 'ausencias'), { recursive: true });
    writeFileSync(join(base, 'ausencias', `${bandeira.desde.replaceAll(':', '-')}--meuprojeto.json`), '{}');
  }
  // transcript que já cumpre os dois requisitos de hoje (list_sessions + gravação no painel)
  const linhas = [
    { type: 'user', origin: { kind: 'human' }, message: { content: 'oi' } },
    { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'mcp__ccd_session_mgmt__list_sessions', input: {} }, { type: 'tool_use', name: 'Bash', input: { command: 'node painel.mjs update sessoes x {}' } }] } },
  ];
  const tr = join(raiz, 't.jsonl'); writeFileSync(tr, linhas.map((l) => JSON.stringify(l)).join('\n'));
  const rodar = (extra = {}) => execFileSync('node', [HOOK], {
    input: JSON.stringify({ session_id: sid, transcript_path: tr, cwd: cwdGit ? repo : join(raiz, 'fora'), ...extra }),
    encoding: 'utf8', timeout: 15000, killSignal: 'SIGKILL', env: { ...process.env, HOME: home, HOOKS_CREWAI_BASE: base },
  });
  return { rodar };
}
const off = () => ({ ligado: false, desde: haH(12), desligadoEm: haH(2), por: 'painel' });

test('período desligado sem entrega: o Stop recusa e cita ausencia.mjs resumo e a seção da skill', () => {
  const out = cenario({ bandeira: off() }).rodar();
  assert.notEqual(out, '', 'precondição: a cobrança tem de aparecer');
  const r = JSON.parse(out);
  assert.equal(r.decision, 'block');
  assert.match(r.reason, /ausencia\.mjs"? resumo/);
  assert.match(r.reason, /resumo-da-ausencia/);
  assert.match(r.reason, /entregue/);
});
test('com a entrega registrada, sem bandeira ou com a bandeira ligada, não cobra', () => {
  const b = off();
  assert.equal(cenario({ bandeira: b, entregue: true }).rodar(), '');
  assert.equal(cenario({}).rodar(), '');
  assert.equal(cenario({ bandeira: { desde: haH(1), por: 'comando' } }).rodar(), '');
});
test('projeto que não resolve não cobra; stop_hook_active não prende em laço', () => {
  assert.equal(cenario({ bandeira: off(), cwdGit: false }).rodar(), '');
  assert.equal(cenario({ bandeira: off() }).rodar({ stop_hook_active: true }), '');
});

// F58: o ritual também cobra o item esperando papel (D3), junto das outras razões.
{
const SID = 'cli-orq';
let base; let repoA; let repoB;
const minAtras = (n) => new Date(Date.now() - n * 60_000).toISOString();

function git(dir) {
  mkdirSync(dir, { recursive: true });
  const r = spawnSync('git', ['init', '-q', dir], { timeout: 15000, killSignal: 'SIGKILL' });
  assert.equal(r.status, 0);
}
const registro = (nome, o) => writeFileSync(join(base, 'app', `${nome}.json`), JSON.stringify({ sessionId: nome, isArchived: false, ...o }));
function item(F, extra = {}, projeto = 'proj-a') {
  const data = { titulo: `item ${F}`, etapa: 'execucao', projeto, donoApelido: 'P1', com: [{ apelido: 'P1' }], perguntas: [],
    historico: [{ em: minAtras(10), etapa: 'execucao', dono: 'P1' }], atualizadoEm: minAtras(1), ...extra };
  writeFileSync(join(base, 'painel', 'fila', `${F}.json`), JSON.stringify({ id: F, version: 1, data }));
}

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'ritual-'));
  for (const d of ['orq', 'home/.claude/orquestracao/ativas', 'app', 'painel/fila']) mkdirSync(join(base, d), { recursive: true });
  writeFileSync(join(base, 'home', '.claude', 'orquestracao', 'ativas', SID), '');
  repoA = join(base, 'proj-a'); repoB = join(base, 'proj-b');
  git(repoA); git(repoB);
  registro('local_ORQ', { cliSessionId: SID, title: '🎛 orquestradora — proj-a', cwd: repoA });
});
afterEach(() => rmSync(base, { recursive: true, force: true }));

const LIST = ['mcp__ccd_session_mgmt__list_sessions', { linked: true }];
const GRAVA = ['Bash', { command: `painel batch '[{"op":"update","colecao":"sessoes","id":"local_ORQ","data":{"agora":"x"}}]'` }];
const COM_ADD = (F, quem = 'E1') => ['Bash', { command: `painel com add ${F} local_E1 ${quem} "executa"` }];
const START = ['mcp__ccd_session__start_session', { title: 'E2 · livre' }];

function rodar(ferramentas, { extra = {}, env = {} } = {}) {
  const t0 = Date.now() - 60_000;
  const L = [{ type: 'user', origin: { kind: 'human' }, timestamp: new Date(t0).toISOString(), message: { content: 'turno' } }];
  ferramentas.forEach(([name, input], k) => L.push({ type: 'assistant', timestamp: new Date(t0 + 1000 + k).toISOString(), message: { content: [{ type: 'tool_use', name, input }] } }));
  const f = join(base, 't.jsonl');
  writeFileSync(f, L.map((x) => JSON.stringify(x)).join('\n') + '\n');
  const r = spawnSync('node', [HOOK], {
    input: JSON.stringify({ session_id: SID, transcript_path: f, cwd: repoA, hook_event_name: 'Stop', ...extra }),
    encoding: 'utf8', timeout: 20000, killSignal: 'SIGKILL',
    env: { ...process.env, HOME: join(base, 'home'), HOOKS_CREWAI_BASE: join(base, 'orq'), POOL_APP_SESSOES_DIR: join(base, 'app'),
      PAINEL_DIR: join(base, 'painel'), FILA_DIR: '', ESPERA_MIN: '', ...env },
  });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout ? JSON.parse(r.stdout) : null;
}
const livre = (nome, titulo, extra = {}) => registro(nome, { cliSessionId: `cli-${nome}`, title: titulo, cwd: repoA, ...extra });

test('(i) item esperando E há 10 min + E1 livre, sem despacho → bloqueia citando F, minutos e E1', () => {
  item('F7'); livre('local_E1', 'E1 · livre');
  const r = rodar([LIST, GRAVA]);
  assert.equal(r?.decision, 'block');
  assert.match(r.reason, /F7/); assert.match(r.reason, /esperando E há 10 min/); assert.match(r.reason, /E1/);
});

test('(ii) o mesmo turno com painel com add F7 → passa', () => {
  item('F7'); livre('local_E1', 'E1 · livre');
  assert.equal(rodar([LIST, GRAVA, COM_ADD('F7')]), null);
});

test('(iii) sem E livre, ausente desligado, sem start_session → bloqueia pedindo a vaga', () => {
  item('F7');
  const r = rodar([LIST, GRAVA]);
  assert.equal(r?.decision, 'block');
  assert.match(r.reason, /F7/); assert.match(r.reason, /sem E livre/); assert.match(r.reason, /start_session/);
});

test('(iv) sem E livre, com start_session no turno → passa', () => {
  item('F7');
  assert.equal(rodar([LIST, GRAVA, START]), null);
});

test('(v) sem E livre e modo ausente ligado → não bloqueia por isso', () => {
  item('F7');
  writeFileSync(join(base, 'orq', 'operador-ausente.json'), JSON.stringify({ ligado: true, desde: minAtras(30) }));
  assert.equal(rodar([LIST, GRAVA]), null);
});

test('(vi) espera de 2 min não bloqueia', () => {
  item('F7', { historico: [{ em: minAtras(2), etapa: 'execucao', dono: 'P1' }] }); livre('local_E1', 'E1 · livre');
  assert.equal(rodar([LIST, GRAVA]), null);
});

test('(vii) item de outro projeto não bloqueia', () => {
  item('F7', {}, 'proj-b');
  assert.equal(rodar([LIST, GRAVA]), null);
});

test('(viii) E1 livre arquivado ou de outro projeto não conta como livre', () => {
  item('F7');
  livre('local_E1', 'E1 · livre', { isArchived: true });
  livre('local_E2', 'E2 · livre', { cwd: repoB });
  const r = rodar([LIST, GRAVA]);
  assert.equal(r?.decision, 'block');
  assert.match(r.reason, /sem E livre/);
  assert.doesNotMatch(r.reason, /livres: E/);
});

test('(ix) sem list_sessions: o bloqueio antigo continua e as duas faltas saem na mesma razão', () => {
  item('F7'); livre('local_E1', 'E1 · livre');
  const r = rodar([GRAVA]);
  assert.equal(r?.decision, 'block');
  assert.match(r.reason, /Falta: list_sessions/);
  assert.match(r.reason, /F7/); assert.match(r.reason, /esperando E há 10 min/);
  // e sem item esperando, só o bloqueio antigo
  rmSync(join(base, 'painel', 'fila', 'F7.json'));
  const r2 = rodar([GRAVA]);
  assert.match(r2.reason, /Falta: list_sessions/); assert.doesNotMatch(r2.reason, /esperando/);
});

test('(x) stop_hook_active → passa', () => {
  item('F7'); livre('local_E1', 'E1 · livre');
  assert.equal(rodar([LIST, GRAVA], { extra: { stop_hook_active: true } }), null);
});

test('ESPERA_MIN troca o limite', () => {
  item('F7', { historico: [{ em: minAtras(2), etapa: 'execucao', dono: 'P1' }] });
  assert.equal(rodar([LIST, GRAVA], { env: { ESPERA_MIN: '1' } })?.decision, 'block');
});

const MSG = (F) => ['SendMessage', { to: 'local_P1', message: `${F} pronto: avance a etapa` }];

test('(xi) item entregue pela E: não pede despacho nem vaga; cobra a dona avançar a etapa, e a mensagem citando o F satisfaz', () => {
  item('F7', { fez: [{ apelido: 'E5', localId: 'local_E5', oQue: 'x', em: minAtras(15) }], historico: [{ em: minAtras(40), etapa: 'execucao', dono: 'P1' }] });
  livre('local_E1', 'E1 · livre');
  const r = rodar([LIST, GRAVA]);
  assert.equal(r?.decision, 'block');
  assert.match(r.reason, /F7 entregue pela E5 há 15 min: cobre a dona \(P1\) para avançar a etapa/);
  assert.doesNotMatch(r.reason, /despache|peça a vaga/);
  assert.equal(rodar([LIST, GRAVA, COM_ADD('F7')])?.decision, 'block', 'com add não satisfaz o entregue');
  assert.equal(rodar([LIST, GRAVA, MSG('F7')]), null);
  assert.equal(rodar([LIST, GRAVA, MSG('F8')])?.decision, 'block', 'mensagem que não cita o F');
});

test('(xii) validacao sem V e sem entregue: pede confirmar com a dona; com V livre satisfaz com com add OU mensagem', () => {
  item('F7', { etapa: 'validacao', historico: [{ em: minAtras(20), etapa: 'validacao', dono: 'P1' }] });
  livre('local_V1', 'V1 · livre');
  const r = rodar([LIST, GRAVA]);
  assert.equal(r?.decision, 'block');
  assert.match(r.reason, /F7 sem V no item há 20 min: confirme com a dona \(P1\) se a validação já voltou antes de despachar/);
  assert.equal(rodar([LIST, GRAVA, ['Bash', { command: 'painel com add F7 local_V1 V1 "valida"' }]]), null);
  assert.equal(rodar([LIST, GRAVA, MSG('F7')]), null);
});

test('(xiii) só item parado (ritual feito, sem período) → o bloqueio existe e traz só a razão do item', () => {
  item('F7');
  const r = rodar([LIST, GRAVA]);
  assert.equal(r?.decision, 'block');
  assert.match(r.reason, /F7/);
  assert.doesNotMatch(r.reason, /Ritual da orquestradora não feito|modo ausente/);
});

test('(xiv) resumo do ausente pendente + item esperando, ritual feito → as duas razões no mesmo block', () => {
  item('F7');
  writeFileSync(join(base, 'orq', 'operador-ausente.json'), JSON.stringify({ ligado: false, desde: minAtras(12 * 60), desligadoEm: minAtras(120), por: 'painel' }));
  const r = rodar([LIST, GRAVA]);
  assert.equal(r?.decision, 'block');
  assert.match(r.reason, /resumo/); assert.match(r.reason, /F7 esperando E há 10 min/);
  assert.doesNotMatch(r.reason, /Ritual da orquestradora não feito/);
});

test('(xv) as três: resumo + ritual não feito + item esperando na mesma razão', () => {
  item('F7');
  writeFileSync(join(base, 'orq', 'operador-ausente.json'), JSON.stringify({ ligado: false, desde: minAtras(12 * 60), desligadoEm: minAtras(120), por: 'painel' }));
  const r = rodar([GRAVA]);
  assert.match(r.reason, /resumo/); assert.match(r.reason, /Falta: list_sessions/); assert.match(r.reason, /F7 esperando E/);
});

test('sem item esperando e ritual feito → passa', () => {
  item('F7', { com: [{ apelido: 'P1' }, { apelido: 'E1' }] });
  assert.equal(rodar([LIST, GRAVA]), null);
});
}
