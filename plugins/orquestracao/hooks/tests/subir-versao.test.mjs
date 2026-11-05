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

function subir(args = [], cwd = repo, env = {}) {
  const r = spawnSync('node', [SCRIPT, ...args], { cwd, encoding: 'utf8', timeout: 60000, killSignal: 'SIGKILL', env: { ...process.env, HOME: join(base, 'home'), ...env } });
  if (r.error) throw r.error;
  let json = null; try { json = JSON.parse(r.stdout); } catch { /* sem JSON */ }
  return { exit: r.status, out: r.stdout, err: r.stderr, json };
}

test('entrada de origem remota (git-subdir) não é subida nem vira pulado: a versão dela mora no outro repositório', () => {
  escrever('.claude-plugin/marketplace.json', JSON.stringify({ name: 'm', plugins: [{ name: 'a', source: './plugins/a' }, { name: 'ds', source: { source: 'git-subdir', url: 'acme/ds', path: 'plugins/ds', sha: 'a'.repeat(40) } }] }));
  escrever('plugins/a/x.mjs', 'dois\n'); commitar('feat: muda a e lista o ds');
  const r = subir();
  assert.equal(r.exit, 0, r.err + r.out);
  assert.deepEqual(r.json.subiu.map((s) => s.nome), ['a'], 'precondição: o local sobe');
  assert.equal(r.json.pulados, undefined, JSON.stringify(r.json.pulados));
});

test('plugin que chegou por merge de subárvore (F357): não sobe na chegada e sobe quando muda depois', () => {
  const outro = join(base, 'outro'); mkdirSync(join(outro, 'plugins', 'ds', '.claude-plugin'), { recursive: true });
  git(['init', '-q', '-b', 'main'], outro); git(['config', 'user.name', 'T'], outro); git(['config', 'user.email', 't@t'], outro);
  writeFileSync(join(outro, 'plugins', 'ds', '.claude-plugin', 'plugin.json'), pluginJson('ds', '0.2.13'));
  writeFileSync(join(outro, 'plugins', 'ds', 'z.mjs'), 'um\n');
  git(['add', '-A'], outro); git(['commit', '-q', '-m', 'ds'], outro);
  git(['fetch', '-q', outro, 'main']);
  git(['merge', '-q', '-s', 'ours', '--no-commit', '--allow-unrelated-histories', 'FETCH_HEAD']);
  git(['read-tree', '--prefix=vendor/', '-u', 'FETCH_HEAD']);
  git(['commit', '-q', '-m', 'traz o ds']);
  escrever('.claude-plugin/marketplace.json', JSON.stringify({ name: 'm', plugins: [{ name: 'a', source: './plugins/a' }, { name: 'ds', source: './vendor/plugins/ds' }] }));
  commitar('lista o ds');
  assert.equal(git(['log', '-1', '--format=%H', '-G"version"', '--', 'vendor/plugins/ds/.claude-plugin/plugin.json']), '', 'precondição: o -G sozinho não lê o diff do merge');
  const r = subir();
  assert.equal(r.exit, 0, r.err + r.out);
  assert.deepEqual(r.json.subiu, [], JSON.stringify(r.json));
  assert.equal(r.json.pulados, undefined, JSON.stringify(r.json.pulados));
  // o primeiro PR depois da chegada muda o código e o plugin.json fora da versão, no mesmo commit: sobe
  escrever('vendor/plugins/ds/z.mjs', 'dois\n');
  escrever('vendor/plugins/ds/.claude-plugin/plugin.json', pluginJson('ds', '0.2.13').replace('plugin ds', 'plugin ds, novo'));
  commitar('feat(ds): muda');
  const r2 = subir();
  assert.equal(r2.exit, 0, r2.err + r2.out);
  assert.deepEqual(r2.json.subiu, [{ nome: 'ds', antes: '0.2.13', depois: '0.2.14', arquivos: ['vendor/plugins/ds/.claude-plugin/plugin.json', 'vendor/plugins/ds/z.mjs'] }]);
});

test('PR por merge commit que recebeu a main com a versão subida: a referência é a subida da main, e o código do PR sobe', () => {
  // datas crescentes: no mesmo segundo o git log desempata pela ordem e esconde o defeito
  const quando = (k) => { process.env.GIT_COMMITTER_DATE = process.env.GIT_AUTHOR_DATE = `2026-11-0${k}T12:00:00Z`; };
  git(['switch', '-q', '-c', 'pr']);
  escrever('plugins/a/.claude-plugin/plugin.json', pluginJson('a', '0.1.5').replace('plugin a', 'plugin a, novo')); quando(1); commitar('pr: descrição');
  escrever('plugins/a/x.mjs', 'dois\n'); quando(2); commitar('pr: código');
  git(['switch', '-q', 'main']);
  escrever('plugins/a/.claude-plugin/plugin.json', pluginJson('a', '0.1.6')); quando(3); commitar('chore(versao): a 0.1.6');
  git(['switch', '-q', 'pr']);
  // as duas mexeram no plugin.json em linhas vizinhas: o conflito se resolve com a versão da main e a descrição do PR
  spawnSync('git', ['merge', '-q', '--no-edit', 'main'], { cwd: repo, encoding: 'utf8', timeout: 60000, killSignal: 'SIGKILL' });
  escrever('plugins/a/.claude-plugin/plugin.json', pluginJson('a', '0.1.6').replace('plugin a', 'plugin a, novo'));
  quando(4); git(['add', '-A']); git(['commit', '-q', '--no-edit']);
  git(['switch', '-q', 'main']);
  quando(5); git(['merge', '-q', '--no-ff', '--no-edit', 'pr']);
  delete process.env.GIT_COMMITTER_DATE; delete process.env.GIT_AUTHOR_DATE;
  const r = subir();
  assert.equal(r.exit, 0, r.err + r.out);
  assert.deepEqual(r.json.subiu.map((s) => [s.nome, s.depois, s.arquivos.includes('plugins/a/x.mjs')]), [['a', '0.1.7', true]], JSON.stringify(r.json));
});

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

// F373 (fatia 3): a fila sem turno sobe a versão num worktree temporário destacado em origin/<base> (a main do checkout principal
// não pode ser posta em dois worktrees); `--destacado` aceita o HEAD destacado em dia com a base e empurra para ela.
test('--destacado: HEAD destacado em dia com origin/main sobe e empurra; sem a flag, recusa; atrás da base, recusa', () => {
  const origem = join(base, 'origem.git');
  git(['clone', '-q', '--bare', repo, origem], base);
  git(['remote', 'add', 'origin', origem]);
  escrever('plugins/a/x.mjs', 'dois\n'); commitar('feat: muda a');
  git(['push', '-q', 'origin', 'HEAD:main']);
  git(['checkout', '-q', '--detach']);
  const sem = subir(['--empurrar']);
  assert.equal(sem.exit, 1, sem.out);
  assert.match(sem.json?.recusado ? sem.json.motivo : '', /fora da main/);
  const r = subir(['--empurrar', '--destacado']);
  assert.equal(r.exit, 0, r.err + r.out);
  assert.deepEqual(r.json.subiu.map((s) => `${s.nome} ${s.depois}`), ['a 0.1.6']);
  assert.equal(r.json.empurrou, true);
  assert.match(git(['log', '-1', '--format=%s', 'main'], origem), /^chore\(versao\): sobe os plugins do lote — a 0\.1\.6$/);
  // atrás da base: outro empurrou depois
  git(['checkout', '-q', '--detach', 'HEAD~1']);
  const atras = subir(['--empurrar', '--destacado']);
  assert.equal(atras.exit, 1, atras.out);
  assert.match(atras.json.motivo, /atrás de origin\/main/);
});

// F373 (fatia 3): a subida automática roda sem turno; `design-system/packages/**` dispara o publicar-pacotes no npm, e publicar
// é do operador. O commit de versão nunca toca ali, mesmo com uma entrada do marketplace apontando para lá.
test('entrada em design-system/packages/ é pulada: o commit de versão não toca o caminho que publica no npm', () => {
  escrever('.claude-plugin/marketplace.json', JSON.stringify({ name: 'm', plugins: [{ name: 'a', source: './plugins/a' }, { name: 'pk', source: './design-system/packages/pk' }] }));
  escrever('design-system/packages/pk/.claude-plugin/plugin.json', pluginJson('pk', '1.0.0'));
  commitar('chore: pk entra');
  escrever('plugins/a/x.mjs', 'dois\n'); escrever('design-system/packages/pk/z.mjs', 'um\n'); commitar('feat: muda a e pk');
  const r = subir();
  assert.equal(r.exit, 0, r.err + r.out);
  assert.deepEqual(r.json.subiu.map((s) => s.nome), ['a'], 'precondição: o a sobe (a subida aconteceu)');
  assert.ok(r.json.pulados?.some((p) => p.nome === 'pk' && /npm/.test(p.motivo)), JSON.stringify(r.json.pulados));
  const tocados = git(['show', '--name-only', '--format=', 'HEAD']).split('\n').filter(Boolean);
  assert.ok(tocados.length > 0, 'o commit de versão existe e tocou algo');
  assert.deepEqual(tocados.filter((f) => f.startsWith('design-system/packages/')), []);
});

// F426: o pós-merge sobe a versão no máximo uma vez por dia de São Paulo (`--por-dia`), com relógio injetado em KIT_AGORA.
function subidaDeManha() { // a última subida: 05/11 10:00 (SP); depois, a mudança de um PR
  escrever('plugins/a/x.mjs', 'dois\n'); commitar('feat: PR 1');
  const r = subir();
  assert.equal(r.json.subiu.length, 1, `precondição: a primeira subida acontece ${r.out}${r.err}`);
  const iso = '2026-11-05T10:00:00-03:00';
  const e = spawnSync('git', ['commit', '-q', '--amend', '--no-edit', '--reset-author'], { cwd: repo, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_DATE: iso, GIT_COMMITTER_DATE: iso } });
  assert.equal(e.status, 0, e.stderr);
  assert.match(git(['log', '-1', '--format=%s']), /^chore\(versao\)/);
  assert.equal(git(['log', '-1', '--format=%cI']), iso, 'precondição: o commit de versão está datado de manhã');
  escrever('plugins/a/x.mjs', 'tres\n'); commitar('feat: PR 2');
}

test('--por-dia: segundo lote no mesmo dia de São Paulo não sobe a versão e diz por quê', () => {
  subidaDeManha();
  const antes = contagem();
  const r = subir(['--por-dia'], repo, { KIT_AGORA: '2026-11-05T22:00:00-03:00' });
  assert.equal(r.exit, 0, r.err + r.out);
  assert.deepEqual(r.json.subiu, []);
  assert.match(r.json.adiado, /2026-11-05/);
  assert.equal(contagem(), antes, 'nenhum commit novo');
  assert.match(readFileSync(join(repo, 'plugins/a/.claude-plugin/plugin.json'), 'utf8'), /"0\.1\.6"/, 'a versão ficou');
});

test('--por-dia: o dia é o de São Paulo, não o do UTC (23:00 SP de 05/11 já é 06/11 em UTC)', () => {
  subidaDeManha();
  const r = subir(['--por-dia'], repo, { KIT_AGORA: '2026-11-06T02:00:00Z' });
  assert.deepEqual(r.json.subiu, []);
  assert.ok(r.json.adiado, JSON.stringify(r.json));
});

test('--por-dia: primeiro lote do dia seguinte (depois das 00:00 de SP) sobe', () => {
  subidaDeManha();
  const r = subir(['--por-dia'], repo, { KIT_AGORA: '2026-11-06T00:10:00-03:00' });
  assert.equal(r.exit, 0, r.err + r.out);
  assert.deepEqual(r.json.subiu.map((s) => s.depois), ['0.1.7']);
  assert.equal(r.json.adiado, undefined);
});

test('--por-dia --forcar: sobe no mesmo dia', () => {
  subidaDeManha();
  const r = subir(['--por-dia', '--forcar'], repo, { KIT_AGORA: '2026-11-05T22:00:00-03:00' });
  assert.deepEqual(r.json.subiu.map((s) => s.depois), ['0.1.7'], r.out + r.err);
});

test('--por-dia sem nenhuma subida anterior (sem commit chore(versao)): sobe', () => {
  escrever('plugins/a/x.mjs', 'dois\n'); commitar('feat: PR 1');
  const r = subir(['--por-dia'], repo, { KIT_AGORA: '2026-11-05T22:00:00-03:00' });
  assert.equal(r.json.subiu.length, 1, r.out + r.err);
});

test('sem --por-dia (uso manual): sobe sempre, como antes', () => {
  subidaDeManha();
  const r = subir([], repo, { KIT_AGORA: '2026-11-05T22:00:00-03:00' });
  assert.equal(r.json.subiu.length, 1, r.out + r.err);
});
