// Testes de `painel pode-reiniciar` (F152, parte A). Nunca tocam o painel real: HOME, PAINEL_DIR, HOOKS_CREWAI_BASE,
// POOL_APP_SESSOES_DIR e KIT_NUCLEOS_DIR são pastas temporárias; o `ps` é um arquivo (PODE_REINICIAR_PS).
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const SCRIPTS = process.env.SCRIPTS_DIR || join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'skills', 'orquestradora', 'scripts');
const PAINEL = join(SCRIPTS, 'painel.mjs');
const MIN = 60_000;
const lid = (n) => `local_00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const iso = (ms) => new Date(ms).toISOString();

let base; let repo; let T;
const arquivoDoReinicio = () => join(base, 'orq', 'batida', 'pode-reiniciar.json');

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'painel-pode-reiniciar-'));
  for (const d of ['painel/fila', 'home', 'orq/batida', 'appsess', 'nuc']) mkdirSync(join(base, d), { recursive: true });
  repo = join(base, 'repos', 'kit');
  mkdirSync(repo, { recursive: true });
  const r = spawnSync('git', ['init', '-q', repo], { encoding: 'utf8', timeout: 20000, killSignal: 'SIGKILL' });
  assert.equal(r.status, 0, `git init: ${r.stderr}`);
  T = Date.now();
});
afterEach(() => { rmSync(base, { recursive: true, force: true }); });

const ambiente = (extra = {}) => ({
  ...process.env, PAINEL_DIR: join(base, 'painel'), CLAUDE_CODE_SESSION_ID: '', CLAUDE_CODE_HOST_SESSION_ID: '', HOME: join(base, 'home'),
  HOOKS_CREWAI_BASE: join(base, 'orq'), POOL_APP_SESSOES_DIR: join(base, 'appsess'), KIT_NUCLEOS_DIR: join(base, 'nuc'),
  PODE_REINICIAR_PS: psCom([]), ...extra,
});
function painel(args, env = {}) {
  const r = spawnSync('node', [PAINEL, ...args], { encoding: 'utf8', timeout: 60000, killSignal: 'SIGKILL', cwd: repo, env: ambiente(env) });
  if (r.error) throw r.error;
  return { exit: r.status, out: r.stdout, err: r.stderr, json: () => JSON.parse(r.stdout) };
}
// `ps -axo pid=,ppid=,command=` falso: uma linha "pid ppid comando" por processo
function psCom(linhas) {
  const f = join(base ?? tmpdir(), `ps-${Math.random().toString(36).slice(2)}.txt`);
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, `${linhas.join('\n')}\n`);
  return f;
}
function sessao(n, titulo, extra = {}) {
  return { sessionId: lid(n), title: titulo, cwd: repo, isArchived: false, isRunning: false, lastActivityAt: iso(T - 5 * MIN), ...extra };
}
function sessoes(...linhas) {
  const f = join(base, 'sessoes.json');
  writeFileSync(f, JSON.stringify(linhas));
  return f;
}
const ficha = (k, dono) => writeFileSync(join(base, 'nuc', String(k)), JSON.stringify({ worktree: '/x/wt/alfa-a', projeto: 'alfa', desde: iso(T), ...dono }));
const lerArquivo = () => JSON.parse(readFileSync(arquivoDoReinicio(), 'utf8'));
const pidMorto = () => { const r = spawnSync('node', ['-e', 'process.stdout.write(String(process.pid))'], { encoding: 'utf8', timeout: 20000, killSignal: 'SIGKILL' }); return Number(r.stdout); };

test('nada rodando: pode', () => {
  const r = painel(['pode-reiniciar', '--sessoes', sessoes(sessao(1, 'E1 · livre')), '--json']);
  assert.equal(r.exit, 0, r.err);
  assert.equal(r.json().pode, true);
  assert.deepEqual(r.json().motivos, []);
  assert.equal(r.json().sessoesDe, 'lista');
  assert.ok(r.json().em);
  assert.match(painel(['pode-reiniciar', '--sessoes', sessoes(sessao(1, 'E1 · livre'))]).out, /^Pode reiniciar\.\n$/);
});

test('uma sessão isRunning: não pode, com o título e o localId; arquivada não conta', () => {
  const arq = sessoes(sessao(1, 'E1 · tela do painel', { isRunning: true }), sessao(2, 'E2 · velha', { isRunning: true, isArchived: true }), sessao(3, 'E3 · livre'));
  const j = painel(['pode-reiniciar', '--sessoes', arq, '--json']).json();
  assert.equal(j.pode, false);
  assert.equal(j.motivos.length, 1, JSON.stringify(j.motivos));
  assert.deepEqual({ tipo: j.motivos[0].tipo, texto: j.motivos[0].texto, localId: j.motivos[0].localId }, { tipo: 'sessao', texto: 'E1 · tela do painel trabalhando', localId: lid(1) });
  const t = painel(['pode-reiniciar', '--sessoes', arq]);
  assert.equal(t.exit, 0, 'é resposta, não erro');
  assert.equal(t.out, 'Não reinicie agora:\nE1 · tela do painel trabalhando\n');
});

test('a própria sessão rodando não conta na saída, mas o arquivo a guarda com localId (C1)', () => {
  writeFileSync(join(base, 'appsess', `${lid(9)}.json`), JSON.stringify({ sessionId: lid(9), cliSessionId: 'cli-9', title: '🎛 orquestradora — kit', cwd: repo, isArchived: false }));
  const arq = sessoes(sessao(9, '🎛 orquestradora — kit', { isRunning: true }), sessao(2, 'E2 · livre'));
  const r = painel(['pode-reiniciar', '--sessoes', arq, '--json'], { CLAUDE_CODE_SESSION_ID: 'cli-9' });
  assert.equal(r.exit, 0, r.err);
  assert.equal(r.json().pode, true);
  assert.deepEqual(r.json().motivos, []);
  const f = lerArquivo();
  assert.equal(f.pode, false, 'no arquivo a sessão que rodou conta');
  assert.deepEqual(f.motivos.map((m) => [m.tipo, m.localId]), [['sessao', lid(9)]]);
});

test('ficha com pid vivo é teste; ficha com pid morto não conta; fichas do mesmo pid viram uma linha', () => {
  ficha(1, { pid: process.pid }); ficha(2, { pid: process.pid });
  ficha(3, { pid: pidMorto() });
  const j = painel(['pode-reiniciar', '--sessoes', sessoes(), '--json']).json();
  assert.equal(j.pode, false);
  assert.deepEqual(j.motivos.map((m) => [m.tipo, m.texto]), [['teste', 'teste de alfa em alfa-a (2 fichas)']]);
});

test('só ficha de pid morto: pode', () => {
  ficha(1, { pid: pidMorto() });
  assert.equal(painel(['pode-reiniciar', '--sessoes', sessoes(), '--json']).json().pode, true);
});

test('vitest no ps sem ficha: teste fora do teto; filho de pid com ficha não conta em dobro', () => {
  ficha(1, { pid: process.pid });
  const ps = psCom([
    `${process.pid} 1 node /x/gate/com-fichas.mjs -- node --test`,
    '70001 70000 node /x/node_modules/.bin/vitest run apps/web',
    `70002 ${process.pid} node --test tests/a.test.mjs`,
    '70003 1 /usr/bin/vim notas.md',
  ]);
  const j = painel(['pode-reiniciar', '--sessoes', sessoes(), '--json'], { PODE_REINICIAR_PS: ps }).json();
  const fora = j.motivos.filter((m) => m.tipo === 'teste' && /fora do teto/.test(m.texto));
  assert.equal(fora.length, 1, JSON.stringify(j.motivos));
  assert.match(fora[0].texto, /^teste fora do teto: .*vitest run apps\/web/);
  assert.equal(j.motivos.filter((m) => m.tipo === 'teste').length, 2, 'a ficha e o vitest solto');
});

test('M3: o zsh -c pai do dono da ficha não conta; o vitest solto de verdade conta (prova que a detecção funciona)', () => {
  ficha(1, { pid: process.pid });
  const ps = psCom([
    '80001 1 zsh -c source /Users/x/.claude/shell-snapshots/s.sh && eval node gate/com-fichas.mjs -- node --test test/a.test.mjs',
    `${process.pid} 80001 node /x/gate/com-fichas.mjs -- node --test test/a.test.mjs`,
    `80002 ${process.pid} node --test test/a.test.mjs`,
    '80003 1 node /x/node_modules/.bin/vitest run apps/web',
  ]);
  const j = painel(['pode-reiniciar', '--sessoes', sessoes(), '--json'], { PODE_REINICIAR_PS: ps }).json();
  const testes = j.motivos.filter((m) => m.tipo === 'teste');
  assert.equal(testes.length, 2, JSON.stringify(j.motivos));
  assert.ok(testes.some((m) => /^teste fora do teto: .*vitest run apps\/web/.test(m.texto)), 'o vitest solto conta');
  assert.ok(!testes.some((m) => /zsh|shell-snapshots/.test(m.texto)), 'o zsh pai não conta');
});

test('M3: com-fichas.mjs sem ficha é "teste na fila do teto", uma vez só, sem contar o zsh pai nem o npm', () => {
  const ps = psCom([
    '81001 1 zsh -c source /Users/x/.claude/shell-snapshots/s.sh && eval node gate/com-fichas.mjs --quero 4 -- node --test test/b.test.mjs',
    '81002 81001 npm test',
    '81003 81002 node gate/com-fichas.mjs --quero 4 -- node --test --test-concurrency=4',
  ]);
  const j = painel(['pode-reiniciar', '--sessoes', sessoes(), '--json'], { PODE_REINICIAR_PS: ps }).json();
  const testes = j.motivos.filter((m) => m.tipo === 'teste');
  assert.equal(testes.length, 1, JSON.stringify(j.motivos));
  assert.match(testes[0].texto, /^teste na fila do teto: node gate\/com-fichas\.mjs/);
  assert.doesNotMatch(testes[0].texto, /fora do teto/);
});

test('M3: grep/rg por vitest ou jest (puro ou dentro de zsh -c) não é teste', () => {
  const ps = psCom([
    '82001 1 grep -r vitest packages/',
    '82002 1 rg --files-with-matches jest apps',
    '82003 1 zsh -c cd /x && grep -rn "node --test" docs | head',
    '82004 1 zsh -c cd /x && vitest run apps/web',
  ]);
  const j = painel(['pode-reiniciar', '--sessoes', sessoes(), '--json'], { PODE_REINICIAR_PS: ps }).json();
  const testes = j.motivos.filter((m) => m.tipo === 'teste');
  assert.equal(testes.length, 1, JSON.stringify(j.motivos));
  assert.match(testes[0].texto, /vitest run apps\/web/, 'o zsh -c com vitest de verdade conta (prova)');
});

test('gh pr merge, git rebase, git merge e git cherry-pick no ps são merge no meio; git merge-tree e vim não', () => {
  const ps = psCom([
    '80001 1 gh pr merge 63 --squash --match-head-commit abc',
    '80002 1 git -C /x/repo rebase origin/main',
    '80003 1 git merge --no-ff feature',
    '80004 1 git cherry-pick abc',
    '80005 1 git merge-tree --write-tree a b',
    '80006 1 vim git-rebase-todo',
    '80007 1 git status',
  ]);
  const j = painel(['pode-reiniciar', '--sessoes', sessoes(), '--json'], { PODE_REINICIAR_PS: ps }).json();
  assert.equal(j.pode, false);
  const merges = j.motivos.filter((m) => m.tipo === 'merge');
  assert.equal(merges.length, 4, JSON.stringify(j.motivos));
  assert.ok(merges.every((m) => /^merge\/rebase no meio: /.test(m.texto)));
  assert.equal(j.motivos.length, 4);
});

test('sem --sessoes usa batida/sessoes.json e diz a idade', () => {
  const f = join(base, 'orq', 'batida', 'sessoes.json');
  writeFileSync(f, JSON.stringify([sessao(1, 'E1 · tela', { isRunning: true })]));
  utimesSync(f, new Date(T - 7 * MIN), new Date(T - 7 * MIN));
  const r = painel(['pode-reiniciar', '--json']);
  assert.equal(r.exit, 0, r.err);
  assert.equal(r.json().sessoesDe, 'batida');
  assert.equal(r.json().idadeMin, 7);
  assert.equal(r.json().pode, false);
  assert.match(painel(['pode-reiniciar']).out, /lista de há 7 min/);
});

test('sem --sessoes e sem batida/sessoes.json: erro de leitura (exit 1)', () => {
  const r = painel(['pode-reiniciar']);
  assert.equal(r.exit, 1);
  assert.match(r.err, /sessoes\.json/);
});

test('grava pode-reiniciar.json com em e listaEm igual ao instante da lista (C2)', () => {
  const lista = iso(T - 90_000);
  const r = painel(['pode-reiniciar', '--sessoes', sessoes(sessao(1, 'E1 · tela', { isRunning: true })), '--lista-em', lista, '--json']);
  assert.equal(r.exit, 0, r.err);
  assert.ok(existsSync(arquivoDoReinicio()));
  const f = lerArquivo();
  assert.equal(f.listaEm, lista);
  assert.ok(Math.abs(Date.parse(f.em) - Date.now()) < 60_000, 'em recente');
  assert.equal(f.pode, false);
  assert.equal(f.motivos[0].localId, lid(1));
  assert.equal(f.sessoesDe, 'lista');
});

test('sem --lista-em, listaEm é o mtime do arquivo da lista', () => {
  const arq = sessoes(sessao(1, 'E1 · livre'));
  utimesSync(arq, new Date(T - 3 * MIN), new Date(T - 3 * MIN));
  painel(['pode-reiniciar', '--sessoes', arq, '--json']);
  assert.ok(Math.abs(Date.parse(lerArquivo().listaEm) - (T - 3 * MIN)) < 2000);
});

test('a batida grava o mesmo arquivo, com a lista que já tem', () => {
  const arq = sessoes(sessao(1, 'E1 · tela', { isRunning: true }));
  const r = painel(['batida', '--sessoes', arq, '--agora', iso(T)]);
  assert.equal(r.exit, 0, r.err);
  const f = lerArquivo();
  assert.equal(f.pode, false);
  assert.deepEqual(f.motivos.map((m) => m.localId), [lid(1)]);
  assert.ok(f.listaEm && f.em);
});

test('a batida --seco não grava pode-reiniciar.json', () => {
  painel(['batida', '--sessoes', sessoes(sessao(1, 'E1 · tela', { isRunning: true })), '--seco', '--agora', iso(T)]);
  assert.equal(existsSync(arquivoDoReinicio()), false);
});

test('o plugin lê as fichas como o gate: mesmo conjunto de pids vivos', async () => {
  ficha(1, { pid: process.pid }); ficha(2, { pid: pidMorto() }); ficha(5, { pid: process.pid });
  const { estadoDoTeto } = await import(join(RAIZ, 'gate', 'o-teto-da-maquina.mjs'));
  const doGate = estadoDoTeto(join(base, 'nuc'), 8).tomadas.map((t) => t.k).sort((a, b) => a - b);
  assert.deepEqual(doGate, [1, 5], 'o gate vê as duas fichas vivas (insumo não vazio)');
  const { lerFichas } = await import(join(SCRIPTS, 'pode-reiniciar.mjs'));
  assert.deepEqual(lerFichas(join(base, 'nuc')).map((f) => f.k).sort((a, b) => a - b), doGate);
});
