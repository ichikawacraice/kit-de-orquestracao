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
  const app = join(raiz, 'app'); mkdirSync(app);
  mkdirSync(join(base, 'batida'), { recursive: true });
  writeFileSync(join(base, 'batida', 'meuprojeto.json'), JSON.stringify({ em: new Date().toISOString(), merge: [], vagas: [] }));
  const tr = join(raiz, 't.jsonl'); writeFileSync(tr, linhas.map((l) => JSON.stringify(l)).join('\n'));
  const rodar = (extra = {}) => execFileSync('node', [HOOK], {
    input: JSON.stringify({ session_id: sid, transcript_path: tr, cwd: cwdGit ? repo : join(raiz, 'fora'), ...extra }),
    encoding: 'utf8', timeout: 15000, killSignal: 'SIGKILL', env: { ...process.env, HOME: home, HOOKS_CREWAI_BASE: base, POOL_APP_SESSOES_DIR: app, KIT_ANFITRIAO: 'claude-desktop' },
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

// O ritual cobra abrir a sessão dona do item sem dona, até o teto de donas trabalhando, junto das outras razões.
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
  const data = { titulo: `item ${F}`, etapa: 'planejamento', projeto, donoLocalId: null, donoApelido: null, com: [], perguntas: [],
    historico: [{ em: minAtras(10), etapa: 'planejamento', dono: null }], atualizadoEm: minAtras(1), ...extra };
  writeFileSync(join(base, 'painel', 'fila', `${F}.json`), JSON.stringify({ id: F, version: 1, data }));
}
const semDona = (F, extra = {}, projeto) => item(F, extra, projeto);
const comDona = (F, extra = {}) => item(F, { etapa: 'execucao', donoLocalId: `local_${F}`, donoApelido: 'dona', com: [{ localId: `local_${F}`, apelido: 'dona' }], ...extra });

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
  writeFileSync(join(base, 'orq', 'batida', `${projeto}.json`), JSON.stringify({ em: new Date(Date.now() - minutos * 60_000).toISOString(), merge: [], vagas: [] }));
};
afterEach(() => rmSync(base, { recursive: true, force: true }));

const LIST = ['mcp__ccd_session_mgmt__list_sessions', { linked: true }];
const GRAVA = ['Bash', { command: `painel batch '[{"op":"update","colecao":"sessoes","id":"local_ORQ","data":{"agora":"x"}}]'` }];
const START = ['mcp__ccd_session__start_session', { title: 'F7 · item F7' }];
const DONO = (F) => ['Bash', { command: `painel update fila ${F} '{"donoLocalId":"local_x","donoApelido":"dona"}'` }];
const MSG = (F) => ['SendMessage', { to: 'local_x', message: `${F}: abro a dona no próximo turno do operador` }];

// `orca`: o turno como o Orca o grava (`turnOrigin`, sem `origin`) e o anfitrião fixado em orca. Sem ele, o anfitrião fica fixo
// no app: o ambiente de quem roda o teste (um worker do Orca, por exemplo) não muda o caso.
function rodar(ferramentas, { extra = {}, env = {}, orca = false } = {}) {
  const t0 = Date.now() - 60_000;
  const abertura = orca ? { turnOrigin: 'sdk' } : { origin: { kind: 'human' } };
  const L = [{ type: 'user', ...abertura, timestamp: new Date(t0).toISOString(), message: { content: 'turno' } }];
  ferramentas.forEach(([name, input], k) => L.push({ type: 'assistant', timestamp: new Date(t0 + 1000 + k).toISOString(), message: { content: [{ type: 'tool_use', name, input }] } }));
  const f = join(base, 't.jsonl');
  writeFileSync(f, L.map((x) => JSON.stringify(x)).join('\n') + '\n');
  const r = spawnSync('node', [HOOK], {
    input: JSON.stringify({ session_id: SID, transcript_path: f, cwd: repoA, hook_event_name: 'Stop', ...extra }),
    encoding: 'utf8', timeout: 20000, killSignal: 'SIGKILL',
    env: { ...process.env, HOME: join(base, 'home'), HOOKS_CREWAI_BASE: join(base, 'orq'), POOL_APP_SESSOES_DIR: join(base, 'app'),
      PAINEL_DIR: join(base, 'painel'), FILA_DIR: '', ESPERA_MIN: '', KIT_TETO_DE_DONAS: '',
      // a máquina do teste nunca está cheia por acaso: sem fichas e com carga zero, a menos que o caso diga o contrário
      KIT_NUCLEOS_DIR: join(base, 'nucleos-vazia'), KIT_NUCLEOS_DE_TESTE: '', CI: '', KIT_CARGA_1MIN: '0',
      KIT_ANFITRIAO: orca ? 'orca' : 'claude-desktop', ORCA_AGENT_SESSION_ID: orca ? 'orq-do-orca' : '', CLAUDE_CODE_HOST_SESSION_ID: '', ...env },
  });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout ? JSON.parse(r.stdout) : null;
}

test('(dona-1) item sem dona há 10 min: pede abrir a dona com a conta do teto; start_session, gravar o dono ou citar o item satisfaz', () => {
  semDona('F7');
  const r = rodar([LIST, GRAVA]);
  assert.equal(r?.decision, 'block');
  assert.match(r.reason, /F7 sem dona há 10 min \(0 de 4 donas trabalhando\): abra a sessão dona/);
  assert.match(r.reason, /protocolo\.md#sem-dona/);
  assert.equal(rodar([LIST, GRAVA, START]), null);
  assert.equal(rodar([LIST, GRAVA, DONO('F7')]), null);
  assert.equal(rodar([LIST, GRAVA, MSG('F7')]), null);
  assert.equal(rodar([LIST, GRAVA, DONO('F8')])?.decision, 'block', 'gravar o dono de outro item não satisfaz');
});
test('(dona-2) teto: com 4 donas trabalhando o item sem dona espera calado; com 3, cobra; a máquina cheia baixa o teto a 3', () => {
  for (const F of ['F1', 'F2', 'F3']) comDona(F);
  semDona('F9');
  assert.match(rodar([LIST, GRAVA])?.reason ?? '', /3 de 4 donas/, 'prova: abaixo do teto cobra');
  comDona('F4');
  assert.equal(rodar([LIST, GRAVA]), null);
  assert.equal(rodar([LIST, GRAVA], { env: { KIT_TETO_DE_DONAS: '5' } })?.decision, 'block', 'prova: teto 5 cobra');
  assert.equal(rodar([LIST, GRAVA], { env: { KIT_TETO_DE_DONAS: '5', KIT_CARGA_1MIN: '999' } }), null, 'cheia: teto 3');
});
test('(dona-3) item em merge não conta para o teto; a cobrança respeita a vaga que sobra', () => {
  for (const F of ['F1', 'F2', 'F3']) comDona(F);
  comDona('F4', { etapa: 'merge' });
  semDona('F8'); semDona('F9');
  const r = rodar([LIST, GRAVA]);
  assert.match(r?.reason ?? '', /3 de 4 donas/);
  assert.equal((r.reason.match(/sem dona há/g) ?? []).length, 1, 'uma vaga, uma cobrança');
});
test('(dona-4) não cobra: menos de ESPERA_MIN, outro projeto, espera ou trava, modo ausente ligado', () => {
  semDona('F7', { historico: [{ em: minAtras(2), etapa: 'planejamento', dono: null }] });
  assert.equal(rodar([LIST, GRAVA]), null, 'dois minutos');
  assert.equal(rodar([LIST, GRAVA], { env: { ESPERA_MIN: '1' } })?.decision, 'block', 'ESPERA_MIN troca o limite');
  rmSync(join(base, 'painel', 'fila', 'F7.json'));
  semDona('F7', {}, 'proj-b');
  assert.equal(rodar([LIST, GRAVA]), null, 'outro projeto');
  semDona('F7', { espera: { motivo: 'operador', texto: 'decide' } });
  assert.equal(rodar([LIST, GRAVA]), null, 'espera');
  semDona('F7', { trava: { motivo: 'conflito', texto: 'x' } });
  assert.equal(rodar([LIST, GRAVA]), null, 'trava');
  semDona('F7');
  assert.equal(rodar([LIST, GRAVA])?.decision, 'block', 'prova: sem espera nem trava cobra');
  writeFileSync(join(base, 'orq', 'operador-ausente.json'), JSON.stringify({ desde: minAtras(30), por: 'comando' }));
  assert.equal(rodar([LIST, GRAVA]), null, 'modo ausente');
});
test('(ix) o ritual não cobra list_sessions nem gravação no painel (o estado mecânico é do pane e a batida solta o parado)', () => {
  assert.equal(rodar([]), null, 'turno sem list_sessions e sem gravar passa');
  semDona('F7');
  const r = rodar([]);
  assert.equal(r?.decision, 'block', 'prova: a cobrança que resta (dona) segue detectada');
  assert.doesNotMatch(r.reason, /list_sessions|Ritual da orquestradora/);
});
test('(ix-b) batida parada: sem o relatório do projeto, ou com mais de 30 min, o ritual avisa; recente, não', () => {
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
  semDona('F7');
  assert.equal(rodar([LIST, GRAVA], { extra: { stop_hook_active: true } }), null);
});
test('(xv) resumo do ausente pendente + item sem dona + batida parada na mesma razão', () => {
  semDona('F7');
  writeFileSync(join(base, 'orq', 'operador-ausente.json'), JSON.stringify({ ligado: false, desde: minAtras(12 * 60), desligadoEm: minAtras(120), por: 'painel' }));
  batidaRodou('proj-a', 90);
  const r = rodar([GRAVA]);
  assert.match(r.reason, /A batida não roda/); assert.match(r.reason, /resumo/); assert.match(r.reason, /F7 sem dona/);
});
test('(dona-5) F218: com cartão de sessão dona esperando o clique, não cobra outra dona', () => {
  semDona('F7');
  assert.equal(rodar([LIST, GRAVA])?.decision, 'block', 'prova: sem cartão, cobra');
  const cartao = (F, min) => {
    mkdirSync(join(base, 'painel', 'cartoes'), { recursive: true });
    writeFileSync(join(base, 'painel', 'cartoes', 'task_x.json'), JSON.stringify({ id: 'task_x', version: 1, data: { projeto: 'proj-a', apelido: 'dona', papel: 'dona', itens: [F], orquestradoraId: 'local_ORQ', propostoEm: minAtras(min) } }));
  };
  cartao('F7', 5);
  assert.equal(rodar([LIST, GRAVA]), null, 'cartão do F7 de 5 min (o item está sem dona há 10): o pedido já saiu');
  cartao('F7', 32);
  assert.equal(rodar([LIST, GRAVA])?.decision, 'block', 'cartão de antes de o item ficar sem dona é de outra rodada');
  cartao('F8', 5);
  assert.equal(rodar([LIST, GRAVA])?.decision, 'block', 'cartão de outro item não vale');
  cartao('F7', 13 * 60);
  assert.equal(rodar([LIST, GRAVA])?.decision, 'block', 'cartão de 13 h venceu');
});
test('(dona-6) F218: o item com cartão esperando o clique ocupa a vaga dele no teto de donas', () => {
  for (const F of ['F1', 'F2', 'F3']) comDona(F);
  semDona('F7'); semDona('F8');
  mkdirSync(join(base, 'painel', 'cartoes'), { recursive: true });
  writeFileSync(join(base, 'painel', 'cartoes', 'task_x.json'), JSON.stringify({ id: 'task_x', version: 1, data: { projeto: 'proj-a', apelido: 'dona', papel: 'dona', itens: ['F7'], orquestradoraId: 'local_ORQ', propostoEm: minAtras(5) } }));
  assert.equal(rodar([LIST, GRAVA]), null, '3 trabalhando + 1 a caminho = teto 4: o F8 espera');
  const r = rodar([LIST, GRAVA], { env: { KIT_TETO_DE_DONAS: '5' } });
  assert.match(r?.reason ?? '', /F8 sem dona há 10 min \(3 de 5 donas trabalhando, 1 a caminho\)/, 'prova: com vaga, cobra o F8 e conta o F7 a caminho');
  assert.doesNotMatch(r.reason, /F7 sem dona/);
});

// F447 (ADR 0030, item 7): a orquestradora no Orca. O turno começa no `turnOrigin` (o Orca não grava `origin`), a dona abre por
// `orca orchestration worker-start` e não há mod nem batida para conferir.
const WSTART = (F) => ['Bash', { command: `orca orchestration worker-start --agent claude --model claude-sonnet-5-5 --effort medium --worktree new-child --display-name "${F} · item ${F}" --spec-file /tmp/spec-${F}.md` }];
const SEND = (F) => ['Bash', { command: `orca orchestration send --from orca_session_id:orq --to orca_session_id:outra --subject "fila" --body "${F}: abro a dona quando vagar"` }];
test('(orca-1) no Orca o turno sem `origin` é lido: o item sem dona é cobrado com o comando do Orca, sem start_session nem cartão', () => {
  semDona('F7');
  const r = rodar([], { orca: true });
  assert.equal(r?.decision, 'block', 'o turno do Orca (turnOrigin) conta como turno');
  assert.match(r.reason, /F7 sem dona há 10 min \(0 de 4 donas trabalhando\)/);
  assert.match(r.reason, /orca orchestration worker-start/);
  assert.match(r.reason, /anfitriao-orca\.md/);
  assert.doesNotMatch(r.reason, /start_session|cartão/);
  const app = rodar([]);
  assert.match(app?.reason ?? '', /start_session; fora do turno do operador, cartão/, 'no app a cobrança segue a mesma');
});
test('(orca-2) o worker-start que abre a dona satisfaz; o send que cita o item também; o de outro item e o `orca` dentro de string não', () => {
  semDona('F7');
  assert.equal(rodar([WSTART('F7')], { orca: true }), null);
  assert.equal(rodar([SEND('F7')], { orca: true }), null);
  assert.equal(rodar([SEND('F8')], { orca: true })?.decision, 'block', 'mensagem de outro item não satisfaz');
  const naString = ['Bash', { command: `echo "orca orchestration worker-start --display-name 'F7 · item' --spec-file /tmp/x.md"` }];
  assert.equal(rodar([naString], { orca: true })?.decision, 'block', 'orca dentro de string não é comando');
  const devolucao = ['Bash', { command: 'orca orchestration worker-start --terminal term_ab12 --worktree path:/tmp/w --spec "F7: gate vermelho"' }];
  assert.equal(rodar([devolucao], { orca: true })?.decision, 'block', 'a devolução no mesmo terminal não abre dona nova');
});
test('(orca-3) no Orca a batida parada não é cobrada (não há mod do app); no app segue cobrada', () => {
  batidaRodou('proj-a', 45);
  assert.match(rodar([])?.reason ?? '', /A batida não roda há 45 min/, 'prova: no app a batida velha é cobrada');
  assert.equal(rodar([], { orca: true }), null);
  rmSync(join(base, 'orq', 'batida', 'proj-a.json'));
  assert.equal(rodar([], { orca: true }), null, 'nem o relatório que nunca existiu');
});
test('(orca-4) no Orca o resumo do ausente segue cobrado', () => {
  writeFileSync(join(base, 'orq', 'operador-ausente.json'), JSON.stringify({ ligado: false, desde: minAtras(12 * 60), desligadoEm: minAtras(120), por: 'painel' }));
  assert.match(rodar([], { orca: true })?.reason ?? '', /resumo/);
});
}
