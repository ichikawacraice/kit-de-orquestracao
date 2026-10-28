// F208: a orquestradora volta ao papel no início de sessão (inclusive depois de limpar o contexto, que chega como `startup`
// ou `clear`): o sessao-inicio recria o marcador `ativas/<session_id>`, apaga o das ids anteriores dela e injeta a ordem de
// carregar a skill. HOME, HOOKS_CREWAI_BASE, POOL_APP_SESSOES_DIR e PAINEL_DIR são pastas temporárias.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOKS = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOCAL = 'local_00000000-0000-4000-8000-000000000001';
const ORDEM = 'Você é a orquestradora';

let base; let repo;
const ativas = () => join(base, 'orq', 'ativas');
const marcador = (id) => join(ativas(), id);

beforeEach(() => {
  base = realpathSync(mkdtempSync(join(tmpdir(), 'orq-de-volta-')));
  for (const d of ['home', 'orq/ativas', 'orq/batida', 'app', 'painel/perguntas']) mkdirSync(join(base, d), { recursive: true });
  repo = join(base, 'repos', 'kit');
  mkdirSync(repo, { recursive: true });
  const r = spawnSync('git', ['init', '-q', repo], { encoding: 'utf8', timeout: 20000, killSignal: 'SIGKILL' });
  assert.equal(r.status, 0, `git init: ${r.stderr}`);
});
afterEach(() => { rmSync(base, { recursive: true, force: true }); });

function registro(localId, extra) {
  writeFileSync(join(base, 'app', `${localId}.json`), JSON.stringify({ sessionId: localId, cwd: repo, originCwd: repo, isArchived: false, ...extra }));
}
function inicio(sessionId, { source = 'clear', host = LOCAL } = {}) {
  const r = spawnSync('node', [join(HOOKS, 'sessao-inicio.mjs')], {
    input: JSON.stringify({ session_id: sessionId, hook_event_name: 'SessionStart', source, cwd: repo }),
    encoding: 'utf8', timeout: 15000, killSignal: 'SIGKILL',
    env: { ...process.env, HOME: join(base, 'home'), HOOKS_CREWAI_BASE: join(base, 'orq'), POOL_APP_SESSOES_DIR: join(base, 'app'), PAINEL_DIR: join(base, 'painel'), CLAUDE_CODE_HOST_SESSION_ID: host },
  });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout ? JSON.parse(r.stdout).hookSpecificOutput.additionalContext : '';
}

for (const source of ['clear', 'startup', 'compact']) {
  test(`orquestradora pelo título (${source}): recria o marcador, apaga o das ids anteriores e manda carregar a skill`, () => {
    registro(LOCAL, { title: '🎛 orquestradora — kit', cliSessionId: 'cli-novo', priorCliSessionIds: ['cli-velho', 'cli-mais-velho'] });
    writeFileSync(marcador('cli-velho'), `${join(repo, '.git')}\n`);
    writeFileSync(marcador('cli-mais-velho'), '');
    assert.ok(existsSync(marcador('cli-velho')), 'precondição: o marcador órfão existe');
    const t = inicio('cli-novo', { source });
    assert.ok(existsSync(marcador('cli-novo')), 'o marcador da id nova foi criado');
    assert.equal(readFileSync(marcador('cli-novo'), 'utf8').trim(), join(repo, '.git'), 'o marcador guarda o git common dir');
    assert.ok(!existsSync(marcador('cli-velho')) && !existsSync(marcador('cli-mais-velho')), 'os marcadores das ids anteriores saíram');
    assert.ok(t.includes(ORDEM), `falta a ordem: ${t.slice(0, 300)}`);
    assert.ok(t.includes('orquestracao:orquestradora'), 'cita a skill pelo nome que o Skill aceita');
    assert.ok(t.indexOf(ORDEM) < t.indexOf('Regras do kit'), 'a ordem vem antes do resumo das regras');
  });
}

test('orquestradora pelo nome na batida do projeto, mesmo sem o título', () => {
  registro(LOCAL, { title: 'qualquer título', cliSessionId: 'cli-novo' });
  writeFileSync(join(base, 'orq', 'batida', 'kit.json'), JSON.stringify({ orquestradora: LOCAL, merge: [], vagas: [] }));
  const t = inicio('cli-novo');
  assert.ok(existsSync(marcador('cli-novo')));
  assert.ok(t.includes(ORDEM));
});

test('registro ainda na id antiga, ou um `claude` lançado pela própria orquestradora: o marcador da id atual fica', () => {
  // as duas situações chegam iguais ao hook (id nova fora do registro); apagar a atual derrubaria as travas da orquestradora viva
  registro(LOCAL, { title: '🎛 orquestradora — kit', cliSessionId: 'cli-atual', priorCliSessionIds: ['cli-velho'] });
  writeFileSync(marcador('cli-atual'), '');
  writeFileSync(marcador('cli-velho'), '');
  inicio('cli-filho');
  assert.ok(existsSync(marcador('cli-filho')));
  assert.ok(!existsSync(marcador('cli-velho')), 'precondição: a limpeza das anteriores rodou');
  assert.ok(existsSync(marcador('cli-atual')), 'o marcador da id atual do registro não sai');
});

test('marcador de outra orquestradora fica', () => {
  registro(LOCAL, { title: '🎛 orquestradora — kit', cliSessionId: 'cli-novo', priorCliSessionIds: ['cli-velho'] });
  registro('local_00000000-0000-4000-8000-000000000002', { title: '🎛 orquestradora — outro', cliSessionId: 'cli-outra' });
  writeFileSync(marcador('cli-velho'), '');
  writeFileSync(marcador('cli-outra'), '');
  inicio('cli-novo');
  assert.ok(!existsSync(marcador('cli-velho')), 'precondição: a limpeza rodou');
  assert.ok(existsSync(marcador('cli-outra')));
});

test('sessão dona comum: nem marcador nem ordem', () => {
  registro(LOCAL, { title: '🎛 orquestradora — kit', cliSessionId: 'cli-a' });
  assert.ok(inicio('cli-a').includes(ORDEM), 'precondição: com o título de orquestradora a ordem aparece');
  registro(LOCAL, { title: 'F1 · um item', cliSessionId: 'cli-b' });
  const t = inicio('cli-b');
  assert.ok(t.length > 200, 'as regras seguem');
  assert.ok(!t.includes(ORDEM));
  assert.ok(!existsSync(marcador('cli-b')));
});

test('orquestradora arquivada: nada', () => {
  registro(LOCAL, { title: '🎛 orquestradora — kit', cliSessionId: 'cli-novo', isArchived: true });
  assert.ok(!inicio('cli-novo').includes(ORDEM));
  assert.ok(!existsSync(marcador('cli-novo')));
});

test('sem a sessão do app: só as regras, sem falhar', () => {
  registro(LOCAL, { title: '🎛 orquestradora — kit', cliSessionId: 'cli-novo' });
  const t = inicio('cli-novo', { host: '' });
  assert.ok(t.length > 200);
  assert.ok(!t.includes(ORDEM));
  assert.ok(!existsSync(marcador('cli-novo')));
});

test('session_id com barra não vira caminho fora de ativas/', () => {
  registro(LOCAL, { title: '🎛 orquestradora — kit', cliSessionId: '../fora' });
  inicio('../fora');
  assert.ok(!existsSync(join(base, 'orq', 'fora')));
});

// F220: a limpeza de contexto mata a fila de merge que rodava em background; quem volta precisa saber o que ficou anotado.
test('orquestradora que volta com a fila do projeto órfã recebe o aviso e o comando de relance; com a fila vazia, nada', () => {
  registro(LOCAL, { title: '🎛 orquestradora — kit', cliSessionId: 'cli-novo' });
  const fila = join(base, 'fila-de-merge', 'kit.json');
  mkdirSync(dirname(fila), { recursive: true });
  writeFileSync(fila, JSON.stringify({ ocupada: null, pendentes: [], emVoo: [] }));
  const vazia = inicio('cli-novo');
  assert.ok(vazia.includes(ORDEM), 'precondição: é a orquestradora');
  assert.doesNotMatch(vazia, /fila de merge deste projeto está sem processo/, 'fila vazia: sem aviso');
  const morto = spawnSync('true', { timeout: 5000, killSignal: 'SIGKILL' }).pid;
  writeFileSync(fila, JSON.stringify({ ocupada: { pid: morto, desde: '2026-10-28T13:03:03.261Z', gate: 'pnpm test' }, emVoo: [{ pr: 1307, sha: 'a9f034d309a1546d29c807ea54ce3dc87cf919b2' }], pendentes: [{ pr: 1308 }] }));
  const t = inicio('cli-novo');
  assert.ok(t.includes(ORDEM));
  assert.match(t, /fila de merge deste projeto está sem processo/);
  assert.ok(t.includes("painel fila-de-merge 1307:a9f034d309a1546d29c807ea54ce3dc87cf919b2 1308 --gate 'pnpm test'"), t.slice(0, 1500));
});
