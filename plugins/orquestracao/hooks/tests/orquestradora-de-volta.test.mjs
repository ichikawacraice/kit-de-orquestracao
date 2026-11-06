// F208: a orquestradora volta ao papel no início de sessão (inclusive depois de limpar o contexto, que chega como `startup`
// ou `clear`): o sessao-inicio recria o marcador `ativas/<session_id>`, apaga o das ids anteriores dela e injeta a ordem de
// carregar a skill. HOME, HOOKS_CREWAI_BASE, POOL_APP_SESSOES_DIR e PAINEL_DIR são pastas temporárias.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, realpathSync, utimesSync } from 'node:fs';
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
  assert.doesNotMatch(t, /nunca gravou gate/, 'com gate conhecido, sem o alerta');
  // F396: a fila só anotada de um projeto que nunca gravou gate: o aviso diz que falta o --gate, em vez de um comando que
  // parece pronto e roda `npm test`
  writeFileSync(fila, JSON.stringify({ config: { cwd: '/x' }, ocupada: null, pendentes: [{ pr: 67, sha: 'aaaaaaa' }] }));
  const sem = inicio('cli-novo');
  assert.ok(sem.includes('painel fila-de-merge 67:aaaaaaa'), sem.slice(0, 1500));
  assert.match(sem, /nunca gravou gate: acrescente `--gate/);
});

// F351: o estado do projeto gira antes do "Ao assumir": as seções datadas antigas vão ao arquivo morto, a mais nova fica.
test('orquestradora que volta: o arquivo de estado do projeto gira e o aviso diz onde está o morto; a outra sessão não gira', () => {
  const estado = join(base, 'orq', 'Kit.md');
  const texto = '# Kit\n\n## PRs abertos\n- #1\n\n## Retomar daqui (01/11)\nvelho\n\n## Retomar daqui (02/11)\nnovo\n';
  writeFileSync(estado, texto);
  registro(LOCAL, { title: 'qualquer título', cliSessionId: 'cli-novo' });
  const fora = inicio('cli-novo');
  assert.ok(!fora.includes(ORDEM), 'precondição: não é a orquestradora');
  assert.equal(readFileSync(estado, 'utf8'), texto, 'sessão que não é a orquestradora não mexe no estado');
  registro(LOCAL, { title: '🎛 orquestradora — kit', cliSessionId: 'cli-novo' });
  const t = inicio('cli-novo');
  assert.ok(t.includes(ORDEM));
  const vivo = readFileSync(estado, 'utf8');
  assert.ok(vivo.includes('## PRs abertos') && vivo.includes('novo'), vivo);
  assert.ok(!vivo.includes('velho'), vivo);
  assert.match(t, /Kit\.md` girou/);
  assert.match(t, /arquivo-morto\/Kit\/\d{4}-\d{2}\.md/);
  const segunda = inicio('cli-novo');
  assert.doesNotMatch(segunda, /girou/, 'sem nada a mover, sem aviso');
});

// F447: no Orca o título não se troca; a orquestradora se declara por `painel orquestradora assumir`, que grava o id do Orca
// na 2ª linha do marcador. Depois de limpar o contexto (id do CLI novo, o mesmo id do Orca), ela volta pelo marcador.
function inicioNoOrca(sessionId, orcaCru = 'orq-do-orca', { source = 'clear' } = {}) {
  const r = spawnSync('node', [join(HOOKS, 'sessao-inicio.mjs')], {
    input: JSON.stringify({ session_id: sessionId, hook_event_name: 'SessionStart', source, cwd: repo }),
    encoding: 'utf8', timeout: 15000, killSignal: 'SIGKILL',
    env: { ...process.env, HOME: join(base, 'home'), HOOKS_CREWAI_BASE: join(base, 'orq'), POOL_APP_SESSOES_DIR: join(base, 'app'), PAINEL_DIR: join(base, 'painel'),
      CLAUDE_CODE_HOST_SESSION_ID: '', KIT_ANFITRIAO: 'orca', ORCA_AGENT_SESSION_ID: orcaCru, ORCA_TERMINAL_HANDLE: '', CLAUDE_CONFIG_DIR: join(base, 'cfg') },
  });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout ? JSON.parse(r.stdout).hookSpecificOutput.additionalContext : '';
}
function registroDoOrcaVelho(orcaCru, cli) {
  mkdirSync(join(base, 'orq', 'orca-sessoes'), { recursive: true });
  writeFileSync(join(base, 'orq', 'orca-sessoes', `${orcaCru}.json`), JSON.stringify({ orcaId: `orca_session_id:${orcaCru}`, cliAtual: cli, cliIds: [cli], terminal: null, enderecoDoSend: `orca_session_id:${orcaCru}`, cwd: repo, em: new Date().toISOString() }));
}

test('(F447) orquestradora do Orca pelo marcador: depois de limpar, recria o marcador com o id do Orca e apaga o da id velha', () => {
  registroDoOrcaVelho('orq-do-orca', 'cli-velho');
  writeFileSync(marcador('cli-velho'), `${join(repo, '.git')}\norca_session_id:orq-do-orca\n`);
  const t = inicioNoOrca('cli-novo');
  assert.ok(t.includes(ORDEM), `falta a ordem: ${t.slice(0, 300)}`);
  assert.equal(readFileSync(marcador('cli-novo'), 'utf8'), `${join(repo, '.git')}\norca_session_id:orq-do-orca\n`, 'o marcador novo guarda o repo e o id do Orca');
  assert.ok(!existsSync(marcador('cli-velho')), 'o marcador da id velha saiu');
});

test('(F447) marcador de outra sessão do Orca não faz desta a orquestradora', () => {
  registroDoOrcaVelho('orq-do-orca', 'cli-velho');
  writeFileSync(marcador('cli-outra'), `${join(repo, '.git')}\norca_session_id:outra-sessao\n`);
  const t = inicioNoOrca('cli-novo');
  assert.ok(!t.includes(ORDEM), 'não recebe a ordem');
  assert.ok(!existsSync(marcador('cli-novo')), 'nenhum marcador novo');
  assert.ok(existsSync(marcador('cli-outra')), 'o marcador da outra fica');
});

// O transcript do id do CLI em CLAUDE_CONFIG_DIR/projects/<pasta>/<id>.jsonl, escrito há `minutos`.
function transcript(cli, minutos) {
  const d = join(base, 'cfg', 'projects', '-repos-kit'); mkdirSync(d, { recursive: true });
  const f = join(d, `${cli}.jsonl`); writeFileSync(f, '{}\n');
  const t = new Date(Date.now() - minutos * 60_000); utimesSync(f, t, t);
}

test('(F447) `claude` lançado do Bash da orquestradora do Orca (startup, ela escrevendo agora): o marcador dela fica', () => {
  registroDoOrcaVelho('orq-do-orca', 'cli-orq');
  writeFileSync(marcador('cli-orq'), `${join(repo, '.git')}\norca_session_id:orq-do-orca\n`);
  transcript('cli-orq', 1);
  const t = inicioNoOrca('cli-filho', 'orq-do-orca', { source: 'startup' });
  assert.ok(t.includes(ORDEM), 'precondição: o filho herda o id do Orca e é reconhecido');
  assert.ok(existsSync(marcador('cli-orq')), 'o marcador da orquestradora viva fica');
});
test('(F447) a orquestradora do Orca que volta por startup: o marcador da id parada há mais de 30 min sai; sem transcript, fica', () => {
  registroDoOrcaVelho('orq-do-orca', 'cli-velho');
  writeFileSync(marcador('cli-velho'), `${join(repo, '.git')}\norca_session_id:orq-do-orca\n`);
  transcript('cli-velho', 120);
  inicioNoOrca('cli-novo', 'orq-do-orca', { source: 'startup' });
  assert.ok(!existsSync(marcador('cli-velho')), 'a id parada saiu');
  writeFileSync(marcador('cli-sem'), `${join(repo, '.git')}\norca_session_id:orq-do-orca\n`);
  registroDoOrcaVelho('orq-do-orca', 'cli-sem');
  inicioNoOrca('cli-outro', 'orq-do-orca', { source: 'startup' });
  assert.ok(existsSync(marcador('cli-sem')), 'sem o transcript não dá para saber: fica para a batida');
});
