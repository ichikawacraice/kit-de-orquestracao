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
import { rmSync, existsSync, readFileSync } from 'node:fs';
import { gitCommonDir, chaveDoPiso } from '../pool-comum.mjs';

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
  // uma E livre do projeto, para o piso do pool (ADR 0004) não entrar nestes casos
  const app = join(raiz, 'app'); mkdirSync(app);
  writeFileSync(join(app, 'local_E1.json'), JSON.stringify({ sessionId: 'local_E1', isArchived: false, title: 'E1 · livre', cwd: repo }));
  mkdirSync(join(base, 'batida'), { recursive: true });
  writeFileSync(join(base, 'batida', 'meuprojeto.json'), JSON.stringify({ em: new Date().toISOString(), merge: [], vagas: [], excedentes: [] }));
  const tr = join(raiz, 't.jsonl'); writeFileSync(tr, linhas.map((l) => JSON.stringify(l)).join('\n'));
  const rodar = (extra = {}) => execFileSync('node', [HOOK], {
    input: JSON.stringify({ session_id: sid, transcript_path: tr, cwd: cwdGit ? repo : join(raiz, 'fora'), ...extra }),
    encoding: 'utf8', timeout: 15000, killSignal: 'SIGKILL', env: { ...process.env, HOME: home, HOOKS_CREWAI_BASE: base, POOL_APP_SESSOES_DIR: app },
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
  batidaRodou('proj-a', 1);
});
const batidaRodou = (projeto, minutos) => {
  mkdirSync(join(base, 'orq', 'batida'), { recursive: true });
  writeFileSync(join(base, 'orq', 'batida', `${projeto}.json`), JSON.stringify({ em: new Date(Date.now() - minutos * 60_000).toISOString(), merge: [], vagas: [], excedentes: [] }));
};
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
      PAINEL_DIR: join(base, 'painel'), FILA_DIR: '', ESPERA_MIN: '',
      // a máquina do teste nunca está cheia por acaso: sem fichas e com carga zero, a menos que o caso diga o contrário (ADR 0005)
      KIT_NUCLEOS_DIR: join(base, 'nucleos-vazia'), KIT_NUCLEOS_DE_TESTE: '', IZANAGI_NUCLEOS_DE_TESTE: '', CI: '', KIT_CARGA_1MIN: '0', ...env },
  });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout ? JSON.parse(r.stdout) : null;
}
const livre = (nome, titulo, extra = {}) => registro(nome, { cliSessionId: `cli-${nome}`, title: titulo, cwd: repoA, ...extra });

test('(i) item esperando E há 10 min com E1 livre: não bloqueia (a batida avisa o livre); sem o livre, bloqueia pedindo a vaga', () => {
  item('F7');
  assert.equal(rodar([LIST, GRAVA])?.decision, 'block', 'prova: sem livre a cobrança existe');
  livre('local_E1', 'E1 · livre');
  assert.equal(rodar([LIST, GRAVA]), null);
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

const planejando = (F) => item(F, { etapa: 'planejamento', donoApelido: null, com: [], historico: [{ em: minAtras(10), etapa: 'planejamento', dono: null }] });
test('(iii-P) item em planejamento sem P + P2 livre → não bloqueia (a batida avisa a P2)', () => {
  planejando('F9'); livre('local_P2', 'P2 · livre');
  livre('local_E1', 'E1 · livre');
  assert.equal(rodar([LIST, GRAVA]), null);
});
test('(iii-P2) item em planejamento sem P e sem P livre → pede a vaga de P', () => {
  planejando('F9');
  const r = rodar([LIST, GRAVA]);
  assert.equal(r?.decision, 'block');
  assert.match(r.reason, /F9/); assert.match(r.reason, /sem P livre/); assert.match(r.reason, /start_session/);
});
test('(iii-P3) item em planejamento com P dona não é cobrado', () => {
  livre('local_E1', 'E1 · livre');
  item('F9', { etapa: 'planejamento', donoApelido: 'P3', com: [{ apelido: 'P3' }], historico: [{ em: minAtras(10), etapa: 'planejamento', dono: 'P3' }] });
  assert.equal(rodar([LIST, GRAVA]), null);
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
  livre('local_E1', 'E1 · livre');
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

test('(ix) o ritual não cobra mais list_sessions nem gravação no painel (o estado mecânico é do pane e a batida solta o parado)', () => {
  livre('local_E1', 'E1 · livre');
  assert.equal(rodar([]), null, 'turno sem list_sessions e sem gravar passa');
  livre('local_E1', 'E1 · livre', { isArchived: true });
  item('F7');
  const r = rodar([]);
  assert.equal(r?.decision, 'block', 'prova: a cobrança que resta (vaga) segue detectada');
  assert.doesNotMatch(r.reason, /list_sessions|Ritual da orquestradora/);
});
test('(ix-b) batida parada: sem o relatório do projeto, ou com mais de 30 min, o ritual avisa; recente, não', () => {
  livre('local_E1', 'E1 · livre');
  assert.equal(rodar([]), null, 'precondição: com a batida de 1 min atrás não cobra');
  batidaRodou('proj-a', 45);
  const velha = rodar([]);
  assert.equal(velha?.decision, 'block');
  assert.match(velha.reason, /A batida não roda há 45 min: confira se o mod painel-sessoes está ligado/);
  assert.equal(rodar([], { extra: { stop_hook_active: true } }), null, 'só uma vez por turno');
  rmSync(join(base, 'orq', 'batida', 'proj-a.json'));
  assert.match(rodar([]).reason, /nunca escreveu o relatório de proj-a/);
});

test('(x) stop_hook_active → passa', () => {
  item('F7');
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

test('(xii) validacao sem V e sem entregue: com V livre a batida avisa; sem V livre pede confirmar com a dona antes da vaga', () => {
  livre('local_E1', 'E1 · livre');
  item('F7', { etapa: 'validacao', historico: [{ em: minAtras(20), etapa: 'validacao', dono: 'P1' }] });
  const r = rodar([LIST, GRAVA]);
  assert.equal(r?.decision, 'block');
  assert.match(r.reason, /F7 sem V no item há 20 min: confirme com a dona \(P1\) se a validação já voltou antes de despachar/);
  assert.equal(rodar([LIST, GRAVA, MSG('F7')]), null, 'a mensagem à dona satisfaz');
  livre('local_V1', 'V1 · livre');
  assert.equal(rodar([LIST, GRAVA]), null, 'com V livre: a batida avisa');
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

test('(xv) resumo + item esperando + batida parada na mesma razão', () => {
  item('F7');
  writeFileSync(join(base, 'orq', 'operador-ausente.json'), JSON.stringify({ ligado: false, desde: minAtras(12 * 60), desligadoEm: minAtras(120), por: 'painel' }));
  batidaRodou('proj-a', 90);
  const r = rodar([GRAVA]);
  assert.match(r.reason, /A batida não roda/); assert.match(r.reason, /resumo/); assert.doesNotMatch(r.reason, /Falta: list_sessions/); assert.match(r.reason, /F7 esperando E/);
});

// ADR 0004: piso de uma E livre por projeto fora do modo ausente.
test('(piso-1) sem E livre, sem item, ausente desligado, sem start_session → cobra a vaga', () => {
  const r = rodar([LIST, GRAVA]);
  assert.equal(r?.decision, 'block', 'precondição: a cobrança tem de ser detectada');
  assert.match(r.reason, /sem E livre/); assert.match(r.reason, /peça a vaga/); assert.match(r.reason, /ADR 0004/);
});
test('(piso-2) com E2 livre do projeto → não cobra o piso', () => {
  livre('local_E2', 'E2 · livre');
  assert.equal(rodar([LIST, GRAVA]), null);
});
test('(piso-3) com start_session no turno → não cobra o piso', () => {
  assert.equal(rodar([LIST, GRAVA, START]), null);
});
test('(piso-4) modo ausente ligado → não cobra o piso', () => {
  writeFileSync(join(base, 'orq', 'operador-ausente.json'), JSON.stringify({ ligado: true, desde: minAtras(30) }));
  assert.equal(rodar([LIST, GRAVA]), null);
});
test('(piso-5) E livre de outro projeto não conta; livre de outro papel (P) também não', () => {
  livre('local_E9', 'E9 · livre', { cwd: repoB });
  livre('local_P2', 'P2 · livre');
  const r = rodar([LIST, GRAVA]);
  assert.equal(r?.decision, 'block'); assert.match(r.reason, /sem E livre/);
});
test('(piso-6) repo que não resolve → não cobra o piso', () => {
  assert.equal(rodar([LIST, GRAVA], { extra: { cwd: join(base, 'fora') } }), null);
});

// Marca de vaga de E já pedida: vale por PISO_VAGA_MIN minutos ou até aparecer E livre; só o hook do ritual a grava.
const pisoDir = () => join(base, 'orq', 'piso');
const marcaArq = (repo) => join(pisoDir(), `${chaveDoPiso(gitCommonDir(repo))}.json`);
function marca(repo, minutos, conteudo) {
  mkdirSync(pisoDir(), { recursive: true });
  writeFileSync(marcaArq(repo), conteudo ?? JSON.stringify({ repo: gitCommonDir(repo), em: minAtras(minutos), sessao: 'x' }));
}
const PRECOND = () => { const r = rodar([LIST, GRAVA]); assert.equal(r?.decision, 'block', 'precondição: sem marca a cobrança aparece'); assert.match(r.reason, /sem E livre/); };
test('(piso-7) start_session de E sem E livre → passa e grava a marca do projeto', () => {
  assert.equal(rodar([LIST, GRAVA, START]), null);
  assert.ok(existsSync(marcaArq(repoA)), 'a marca tem de existir');
  const m = JSON.parse(readFileSync(marcaArq(repoA), 'utf8'));
  assert.ok(m.repo && m.repo === gitCommonDir(repoA), 'repo gravado');
  assert.ok(Number.isFinite(Date.parse(m.em)), 'em parseável');
});
test('(piso-8) marca recente → turno seguinte sem start_session não cobra', () => {
  PRECOND();
  marca(repoA, 30);
  assert.equal(rodar([LIST, GRAVA]), null);
});
test('(piso-9) marca vencida (61 min, prazo 60) → cobra de novo', () => {
  marca(repoA, 61);
  const r = rodar([LIST, GRAVA], { env: { PISO_VAGA_MIN: '60' } });
  assert.equal(r?.decision, 'block'); assert.match(r.reason, /sem E livre/);
  marca(repoA, 59);
  assert.equal(rodar([LIST, GRAVA], { env: { PISO_VAGA_MIN: '60' } }), null, 'dentro do prazo passa');
});
test('(piso-10) aparece E livre → a marca some; sem a E, cobra de novo', () => {
  marca(repoA, 30);
  assert.ok(existsSync(marcaArq(repoA)), 'precondição: marca existe');
  livre('local_E2', 'E2 · livre');
  assert.equal(rodar([LIST, GRAVA]), null);
  assert.ok(!existsSync(marcaArq(repoA)), 'a marca tem de sumir');
  rmSync(join(base, 'app', 'local_E2.json'));
  const r = rodar([LIST, GRAVA]);
  assert.equal(r?.decision, 'block'); assert.match(r.reason, /sem E livre/);
});
test('(piso-11) marca de outro projeto não vale', () => {
  marca(repoB, 30);
  assert.ok(existsSync(marcaArq(repoB)), 'precondição: marca de B existe');
  const r = rodar([LIST, GRAVA]);
  assert.equal(r?.decision, 'block'); assert.match(r.reason, /sem E livre/);
});
test('(piso-12) start_session que não é de E passa no turno mas não grava marca', () => {
  assert.equal(rodar([LIST, GRAVA, ['mcp__ccd_session__start_session', { title: 'P3 · livre' }]]), null);
  assert.ok(!existsSync(marcaArq(repoA)), 'nenhuma marca');
  const r = rodar([LIST, GRAVA]);
  assert.equal(r?.decision, 'block'); assert.match(r.reason, /sem E livre/);
});
test('(piso-13) marca ilegível conta como ausente e o hook sai com status 0', () => {
  marca(repoA, 0, '{não é json');
  assert.ok(existsSync(marcaArq(repoA)), 'precondição: arquivo ruim existe');
  const r = rodar([LIST, GRAVA]); // rodar() já afirma status 0
  assert.equal(r?.decision, 'block'); assert.match(r.reason, /sem E livre/);
});

test('sem item esperando e ritual feito → passa', () => {
  livre('local_E1', 'E1 · livre');
  item('F7', { com: [{ apelido: 'P1' }, { apelido: 'E1' }] });
  assert.equal(rodar([LIST, GRAVA]), null);
});
// ADR 0005 (26/10): com a máquina cheia, o ritual não cobra despacho de V nem pedido de vaga de E ou V; cobra a espera `gate` no item.
const validando = (F, extra = {}) => item(F, { etapa: 'validacao', donoApelido: null, com: [], historico: [{ em: minAtras(10), etapa: 'validacao', dono: null }], ...extra });
const maquinaDoTeste = (fichas, teto, carga = '0') => {
  const pasta = join(base, 'nucleos'); rmSync(pasta, { recursive: true, force: true }); mkdirSync(pasta, { recursive: true }); // cada chamada refaz a pasta
  for (let k = 1; k <= fichas; k++) writeFileSync(join(pasta, String(k)), JSON.stringify({ pid: process.pid, token: 't', worktree: '/w', projeto: 'p', desde: new Date().toISOString() }));
  return { KIT_NUCLEOS_DIR: pasta, KIT_NUCLEOS_DE_TESTE: String(teto), KIT_CARGA_1MIN: carga };
};
const GRAVA_ESPERA = (F) => ['Bash', { command: `painel update fila ${F} '{"espera":{"motivo":"gate","texto":"máquina cheia"}}' --se-versao 1` }];
test('(gate-1) V esperando com a máquina cheia: não cobra despacho nem confirmação; cobra gravar a espera gate, com as fichas', () => {
  validando('F7'); livre('local_V1', 'V1 · livre'); livre('local_E1', 'E1 · livre');
  const r = rodar([LIST, GRAVA], { env: maquinaDoTeste(2, 2) });
  assert.equal(r?.decision, 'block', 'precondição: a cobrança tem de ser detectada');
  assert.match(r.reason, /F7 esperando V com a máquina cheia \(2 de 2 fichas\)/);
  assert.match(r.reason, /grave espera \{"motivo":"gate","texto":"máquina cheia"\} no item/);
  assert.doesNotMatch(r.reason, /despache|confirme com a dona|peça a vaga/);
});
test('(gate-2) com a máquina livre a cobrança é a de sempre (o contraste do caso anterior)', () => {
  validando('F7'); livre('local_E1', 'E1 · livre');
  const r = rodar([LIST, GRAVA], { env: maquinaDoTeste(1, 2) });
  assert.equal(r?.decision, 'block');
  assert.match(r.reason, /sem V no item há 10 min: confirme com a dona/);
  assert.doesNotMatch(r.reason, /máquina cheia/);
});
test('(gate-3) item com a espera gate gravada não é cobrado; gravá-la no turno satisfaz', () => {
  livre('local_E1', 'E1 · livre');
  validando('F7', { espera: { motivo: 'gate', texto: 'máquina cheia' } });
  assert.equal(rodar([LIST, GRAVA], { env: maquinaDoTeste(2, 2) }), null);
  rmSync(join(base, 'painel', 'fila', 'F7.json'));
  validando('F7');
  assert.equal(rodar([LIST, GRAVA], { env: maquinaDoTeste(2, 2) })?.decision, 'block', 'prova: sem a espera, cobra');
  assert.equal(rodar([LIST, GRAVA, GRAVA_ESPERA('F7')], { env: maquinaDoTeste(2, 2) }), null);
});
test('(gate-4) cheia por carga também; o texto diz a carga', () => {
  validando('F7'); livre('local_E1', 'E1 · livre');
  const r = rodar([LIST, GRAVA], { env: maquinaDoTeste(0, 7, '99') });
  assert.equal(r?.decision, 'block');
  assert.match(r.reason, /máquina cheia \(0 de 7 fichas, carga 99\.0\)/);
});
test('(gate-5) máquina cheia: sem E livre não cobra o pedido de vaga de E nem o piso; com E livre, a batida avisa', () => {
  item('F7');
  assert.equal(rodar([LIST, GRAVA], { env: maquinaDoTeste(2, 2) }), null, 'sem E livre: nada de vaga');
  assert.equal(rodar([LIST, GRAVA], { env: maquinaDoTeste(1, 2) })?.decision, 'block', 'prova: máquina livre pede a vaga');
  livre('local_E1', 'E1 · livre');
  assert.equal(rodar([LIST, GRAVA], { env: maquinaDoTeste(2, 2) }), null, 'com E livre a batida avisa: nada a cobrar');
});
test('(gate-6) modo ausente ligado: a mesma cobrança, sem exceção', () => {
  validando('F7'); livre('local_E1', 'E1 · livre');
  writeFileSync(join(base, 'orq', 'operador-ausente.json'), JSON.stringify({ ligado: true, desde: minAtras(30) }));
  const r = rodar([LIST, GRAVA], { env: maquinaDoTeste(2, 2) });
  assert.equal(r?.decision, 'block');
  assert.match(r.reason, /esperando V com a máquina cheia/);
});
// F114, conserto da V2: a espera `gate` sai por cobrança do ritual quando a máquina volta; P e D seguem pedindo vaga com ela cheia.
const APAGA_ESPERA = (F) => ['Bash', { command: `painel update fila ${F} '{"espera":null}'` }];
test('(gate-7) espera gate com a máquina livre: cobra apagar a espera e despachar; com a máquina cheia não cobra', () => {
  validando('F7', { espera: { motivo: 'gate', texto: 'máquina cheia' } }); livre('local_V1', 'V1 · livre'); livre('local_E1', 'E1 · livre');
  const r = rodar([LIST, GRAVA], { env: maquinaDoTeste(1, 2) });
  assert.equal(r?.decision, 'block', 'precondição: a cobrança tem de ser detectada');
  assert.match(r.reason, /F7 com espera "máquina cheia" e a máquina livre: apague a espera \(painel update fila F7 '\{"espera":null\}'\) e despache/);
  assert.equal(rodar([LIST, GRAVA], { env: maquinaDoTeste(2, 2) }), null, 'cheia: segue sem cobrar');
});
test('(gate-8) apagar a espera no turno satisfaz a cobrança; espera de outro motivo não é cobrada', () => {
  livre('local_E1', 'E1 · livre');
  validando('F7', { espera: { motivo: 'gate', texto: 'máquina cheia' } });
  assert.equal(rodar([LIST, GRAVA, APAGA_ESPERA('F7')], { env: maquinaDoTeste(1, 2) }), null);
  rmSync(join(base, 'painel', 'fila', 'F7.json'));
  validando('F7', { espera: { motivo: 'operador', texto: 'aguarda' } });
  assert.equal(rodar([LIST, GRAVA], { env: maquinaDoTeste(1, 2) }), null, 'outro motivo: fora');
});
test('(gate-9) máquina cheia suspende o pedido de vaga só de E e V; P e D continuam cobrados', () => {
  livre('local_E1', 'E1 · livre');
  for (const [etapa, papel] of [['planejamento', 'P'], ['design', 'D']]) {
    item('F7', { etapa, donoApelido: null, com: [], historico: [{ em: minAtras(10), etapa, dono: null }] });
    const r = rodar([LIST, GRAVA], { env: maquinaDoTeste(2, 2) });
    assert.equal(r?.decision, 'block', `${papel}: segue cobrado com a máquina cheia`);
    assert.match(r.reason, new RegExp(`sem ${papel} livre: peça a vaga`));
    rmSync(join(base, 'painel', 'fila', 'F7.json'));
  }
});
}
