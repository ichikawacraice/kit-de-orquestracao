// Testes de `subir-versao` (F173): sobe o patch dos plugins que mudaram desde a última subida, num commit só.
// Nunca toca o repositório real nem o ~/.claude: HOME e o repositório são pastas temporárias.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'skills', 'orquestradora', 'scripts', 'subir-versao.mjs');
let base; let repo;

function git(args, cwd = repo) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 20000, killSignal: 'SIGKILL' });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
}
const escrever = (rel, texto) => { mkdirSync(dirname(join(repo, rel)), { recursive: true }); writeFileSync(join(repo, rel), texto); };
const pluginJson = (nome, versao) => `{\n  "name": "${nome}",\n  "version": "${versao}",\n  "description": "plugin ${nome}"\n}\n`;
const commitar = (msg) => { git(['add', '-A']); git(['commit', '-q', '-m', msg]); };
const contagem = () => Number(git(['rev-list', '--count', 'HEAD']));

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'subir-versao-'));
  mkdirSync(join(base, 'home'));
  repo = join(base, 'repo');
  mkdirSync(repo);
  git(['init', '-q', '-b', 'main']);
  git(['config', 'user.name', 'T']); git(['config', 'user.email', 't@t']);
  escrever('.claude-plugin/marketplace.json', JSON.stringify({ name: 'm', plugins: [{ name: 'a', source: './plugins/a' }, { name: 'b', source: './plugins/b' }] }));
  escrever('plugins/a/.claude-plugin/plugin.json', pluginJson('a', '0.1.5'));
  escrever('plugins/a/x.mjs', 'um\n');
  escrever('plugins/b/.claude-plugin/plugin.json', pluginJson('b', '0.2.0'));
  escrever('plugins/b/y.mjs', 'um\n');
  commitar('chore: inicial');
});
afterEach(() => { rmSync(base, { recursive: true, force: true }); });

function subir(args = [], cwd = repo) {
  const r = spawnSync('node', [SCRIPT, ...args], { cwd, encoding: 'utf8', timeout: 60000, killSignal: 'SIGKILL', env: { ...process.env, HOME: join(base, 'home') } });
  if (r.error) throw r.error;
  let json = null; try { json = JSON.parse(r.stdout); } catch { /* sem JSON */ }
  return { exit: r.status, out: r.stdout, err: r.stderr, json };
}

test('nada mudou desde a última subida → subiu vazio e nenhum commit novo', () => {
  const antes = contagem();
  const r = subir();
  assert.equal(r.exit, 0, r.err + r.out);
  assert.deepEqual(r.json.subiu, []);
  assert.equal(contagem(), antes);
});

test('commit em plugins/a → sobe só o a, num commit só, e o resto do plugin.json fica byte a byte', () => {
  escrever('plugins/a/x.mjs', 'dois\n'); commitar('feat(a): muda');
  const antes = contagem();
  const original = readFileSync(join(repo, 'plugins/a/.claude-plugin/plugin.json'), 'utf8');
  const r = subir();
  assert.equal(r.exit, 0, r.err + r.out);
  assert.deepEqual(r.json.subiu, [{ nome: 'a', antes: '0.1.5', depois: '0.1.6', arquivos: ['plugins/a/x.mjs'] }]);
  assert.equal(contagem(), antes + 1);
  assert.equal(git(['log', '-1', '--format=%s']), 'chore(versao): sobe os plugins do lote — a 0.1.6');
  assert.equal(readFileSync(join(repo, 'plugins/a/.claude-plugin/plugin.json'), 'utf8'), original.replace('"0.1.5"', '"0.1.6"'));
  assert.match(readFileSync(join(repo, 'plugins/b/.claude-plugin/plugin.json'), 'utf8'), /"0\.2\.0"/, 'b intocado');
});

test('a e b mudaram → um commit só com os dois na mensagem', () => {
  escrever('plugins/a/x.mjs', 'dois\n'); escrever('plugins/b/y.mjs', 'dois\n'); commitar('feat: muda os dois');
  const antes = contagem();
  const r = subir();
  assert.equal(r.exit, 0, r.err + r.out);
  assert.deepEqual(r.json.subiu.map((s) => `${s.nome} ${s.depois}`), ['a 0.1.6', 'b 0.2.1']);
  assert.equal(contagem(), antes + 1);
  assert.equal(git(['log', '-1', '--format=%s']), 'chore(versao): sobe os plugins do lote — a 0.1.6, b 0.2.1');
});

test('depois da subida, rodar de novo não sobe nada', () => {
  escrever('plugins/a/x.mjs', 'dois\n'); commitar('feat(a): muda');
  assert.equal(subir().json.subiu.length, 1, 'a primeira rodada precisa subir (senão a segunda não prova nada)');
  const antes = contagem();
  const r = subir();
  assert.equal(r.exit, 0, r.err + r.out);
  assert.deepEqual(r.json.subiu, []);
  assert.equal(contagem(), antes);
});

test('mudança só no plugin.json fora da versão conta como mudança', () => {
  escrever('plugins/a/.claude-plugin/plugin.json', pluginJson('a', '0.1.5').replace('plugin a', 'outra descrição')); commitar('docs(a): descrição');
  const r = subir();
  assert.equal(r.exit, 0, r.err + r.out);
  assert.deepEqual(r.json.subiu.map((s) => s.nome), ['a']);
});

test('--seco lista o mesmo e não escreve nem commita', () => {
  escrever('plugins/a/x.mjs', 'dois\n'); commitar('feat(a): muda');
  const antes = contagem();
  const r = subir(['--seco']);
  assert.equal(r.exit, 0, r.err + r.out);
  assert.deepEqual(r.json.subiu.map((s) => `${s.nome} ${s.antes} ${s.depois}`), ['a 0.1.5 0.1.6']);
  assert.equal(contagem(), antes);
  assert.equal(git(['status', '--porcelain']), '');
});

test('árvore suja é recusada', () => {
  escrever('plugins/a/x.mjs', 'dois\n'); commitar('feat(a): muda');
  escrever('plugins/b/y.mjs', 'sujo\n');
  const r = subir();
  assert.equal(r.exit, 1);
  assert.deepEqual(r.json, { recusado: true, motivo: 'árvore com mudança não commitada' });
});

test('fora da main é recusado e o motivo cita a main', () => {
  git(['switch', '-q', '-c', 'x']);
  const r = subir();
  assert.equal(r.exit, 1);
  assert.equal(r.json.recusado, true);
  assert.match(r.json.motivo, /main/);
});

test('main atrás de origin/main é recusada', () => {
  const bare = join(base, 'bare.git');
  git(['init', '-q', '--bare', '-b', 'main', bare], base);
  git(['remote', 'add', 'origin', bare]);
  git(['push', '-q', 'origin', 'main']);
  escrever('plugins/a/x.mjs', 'dois\n'); commitar('feat(a): muda');
  git(['push', '-q', 'origin', 'main']);
  git(['reset', '-q', '--hard', 'HEAD~1']);
  const r = subir();
  assert.equal(r.exit, 1);
  assert.deepEqual(r.json, { recusado: true, motivo: 'main atrás de origin/main; puxe antes' });
});

test('--empurrar manda o commit da subida ao origin', () => {
  const bare = join(base, 'bare.git');
  git(['init', '-q', '--bare', '-b', 'main', bare], base);
  git(['remote', 'add', 'origin', bare]);
  git(['push', '-q', 'origin', 'main']);
  escrever('plugins/a/x.mjs', 'dois\n'); commitar('feat(a): muda');
  const r = subir(['--empurrar']);
  assert.equal(r.exit, 0, r.err + r.out);
  assert.equal(r.json.empurrou, true);
  assert.equal(git(['log', '-1', '--format=%s'], bare), 'chore(versao): sobe os plugins do lote — a 0.1.6');
});
