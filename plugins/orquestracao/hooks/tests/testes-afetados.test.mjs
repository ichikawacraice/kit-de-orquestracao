// F184: os testes afetados pegam o efeito indireto (gatilhos globais, seleção vazia, base não achada, dependentes em cadeia)
// e medem o próprio acerto (o teste que a fila viu falhar estava na seleção da dona?). Nunca toca o HOME real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  afetados, casaGlob, GATILHOS_PADRAO, regrasDoProjeto, testesQueFalharam, registrarAcerto, resumoDoAcerto,
} from '../../skills/orquestradora/scripts/testes-afetados.mjs';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'skills', 'orquestradora', 'scripts', 'testes-afetados.mjs');
const ENV_GIT = { GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
const rodar = (cmd, args, cwd, env = {}) => spawnSync(cmd, args, { cwd, encoding: 'utf8', timeout: 30000, killSignal: 'SIGKILL', env: { ...process.env, ...ENV_GIT, KIT_BASE: '', ...env } });
function git(cwd, ...args) {
  const r = rodar('git', args, cwd);
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
}
function gravar(raiz, arquivos) {
  for (const [f, t] of Object.entries(arquivos)) { mkdirSync(dirname(join(raiz, f)), { recursive: true }); writeFileSync(join(raiz, f), t); }
}

// src/a ← src/b ← src/c ← t/c.test; t/a.test cita a; t/x.test não cita nada do src.
const ARQ = ['src/a.mjs', 'src/b.mjs', 'src/c.mjs', 'src/solto.mjs', 'docs/x.md', 'package.json', 't/a.test.mjs', 't/c.test.mjs', 't/x.test.mjs'];
const TEXTO = {
  'src/b.mjs': "import { a } from './a.mjs';",
  'src/c.mjs': "import { b } from './b.mjs';",
  't/a.test.mjs': "import '../src/a.mjs';",
  't/c.test.mjs': "import '../src/c.mjs';",
  't/x.test.mjs': "import 'node:test';",
};
const conteudo = (f) => TEXTO[f] ?? '';

test('glob: `**` cruza pastas, `*` não; padrão sem barra casa o nome em qualquer pasta', () => {
  assert.ok(casaGlob('gate/x/y.mjs', 'gate/**'));
  assert.ok(casaGlob('package.json', 'package.json'));
  assert.ok(casaGlob('pkg/a/package.json', 'package.json'), 'sem barra: o nome em qualquer pasta');
  assert.ok(casaGlob('plugins/a/.claude-plugin/plugin.json', 'plugins/*/.claude-plugin/plugin.json'));
  assert.ok(!casaGlob('plugins/a/b/.claude-plugin/plugin.json', 'plugins/*/.claude-plugin/plugin.json'), '`*` não cruza pasta');
  assert.ok(!casaGlob('src/gate/x.mjs', 'gate/**'), 'com barra: ancorado na raiz');
  assert.ok(casaGlob('a/fixtures/b/c.json', '**/fixtures/**'));
  assert.ok(GATILHOS_PADRAO.includes('package.json') && GATILHOS_PADRAO.includes('.claude/kit.json'));
});

test('gatilho global tocado: todos os testes, com o motivo; sem gatilho, a seleção normal', () => {
  const r = afetados({ arquivos: ARQ, conteudo, mudados: ['package.json', 'src/a.mjs'] });
  assert.match(String(r.todos), /package\.json/);
  assert.deepEqual(r.testes, ['t/a.test.mjs', 't/c.test.mjs', 't/x.test.mjs']);
  // a presença é detectável: sem o gatilho, o x.test fica de fora
  const s = afetados({ arquivos: ARQ, conteudo, mudados: ['src/a.mjs'] });
  assert.equal(s.todos, false);
  assert.ok(!s.testes.includes('t/x.test.mjs'));
  // gatilho do projeto soma aos padrões
  const p = afetados({ arquivos: ARQ, conteudo, mudados: ['src/solto.mjs'], gatilhos: ['src/solto.mjs'] });
  assert.match(String(p.todos), /solto/);
});

test('dependentes em cadeia: mudar a.mjs traz o teste de c.mjs (a ← b ← c)', () => {
  const r = afetados({ arquivos: ARQ, conteudo, mudados: ['src/a.mjs'] });
  assert.deepEqual(r.dependentes, ['src/b.mjs', 'src/c.mjs']);
  assert.deepEqual(r.testes, ['t/a.test.mjs', 't/c.test.mjs']);
  assert.equal(r.todos, false);
});

test('seleção vazia com diff não vazio: todos; o que só toca `semTeste` (docs/**) ou nada fica vazio', () => {
  const r = afetados({ arquivos: ARQ, conteudo, mudados: ['src/solto.mjs'] });
  assert.match(String(r.todos), /nenhum teste/);
  assert.equal(r.testes.length, 3);
  const d = afetados({ arquivos: ARQ, conteudo, mudados: ['docs/x.md'] });
  assert.deepEqual([d.testes, d.todos], [[], false]);
  const n = afetados({ arquivos: ARQ, conteudo, mudados: [] });
  assert.deepEqual([n.testes, n.todos], [[], false]);
  // docs junto com código sem teste: o código manda
  assert.match(String(afetados({ arquivos: ARQ, conteudo, mudados: ['docs/x.md', 'src/solto.mjs'] }).todos), /nenhum teste/);
});

test('regras do projeto: `testesAfetados` do .claude/kit.json soma gatilhos e semTeste aos padrões; kit.json ruim vale o padrão', () => {
  const raiz = mkdtempSync(join(tmpdir(), 'afetados-kit-'));
  try {
    assert.deepEqual(regrasDoProjeto(raiz).gatilhos, GATILHOS_PADRAO);
    gravar(raiz, { '.claude/kit.json': JSON.stringify({ testesAfetados: { gatilhos: ['conf/**'], semTeste: ['notas/**'] } }) });
    const r = regrasDoProjeto(raiz);
    assert.ok(r.gatilhos.includes('conf/**') && r.gatilhos.includes('package.json'));
    assert.ok(r.semTeste.includes('notas/**') && r.semTeste.includes('docs/**'));
    writeFileSync(join(raiz, '.claude', 'kit.json'), '{ruim');
    assert.deepEqual(regrasDoProjeto(raiz).gatilhos, GATILHOS_PADRAO);
  } finally { rmSync(raiz, { recursive: true, force: true }); }
});

// Repo git real: main com src/a, src/b e os testes; a branch `pr` muda src/a.
function repo() {
  const raiz = mkdtempSync(join(tmpdir(), 'afetados-repo-'));
  const r = join(raiz, 'r');
  mkdirSync(r);
  git(r, 'init', '-q', '-b', 'main');
  gravar(r, { 'src/a.mjs': 'export const a = 1;\n', 'src/b.mjs': 'export const b = 2;\n', 't/a.test.mjs': "import '../src/a.mjs';\n", 't/b.test.mjs': "import '../src/b.mjs';\n" });
  git(r, 'add', '.'); git(r, 'commit', '-qm', 'base');
  git(r, 'checkout', '-q', '-b', 'pr');
  writeFileSync(join(r, 'src/a.mjs'), 'export const a = 3;\n');
  git(r, 'commit', '-qam', 'pr');
  const sha = git(r, 'rev-parse', 'HEAD');
  git(r, 'checkout', '-q', 'main');
  return { raiz, r, sha };
}

test('CLI: --sha lê a seleção do commit, sem checkout; base não achada devolve todos', () => {
  const c = repo();
  try {
    const s = rodar('node', [SCRIPT, '--json', '--base', 'main', '--sha', c.sha], c.r);
    assert.equal(s.status, 0, s.stderr);
    const j = JSON.parse(s.stdout);
    assert.deepEqual(j.tocados, ['src/a.mjs'], 'a árvore de trabalho (main) não entra');
    assert.deepEqual(j.testes, ['t/a.test.mjs']);
    // sem main, sem origin: a base não existe → todos
    git(c.r, 'branch', '-m', 'main', 'outra');
    const t = rodar('node', [SCRIPT, '--json'], c.r);
    assert.equal(t.status, 0, t.stderr);
    const k = JSON.parse(t.stdout);
    assert.equal(k.base, null);
    assert.match(k.todos, /base/);
    assert.deepEqual(k.testes, ['t/a.test.mjs', 't/b.test.mjs']);
    // com `--`: roda o comando sem lista de arquivos (o runner acha todos)
    const u = rodar('node', [SCRIPT, '--', 'node', '-e', 'console.log(JSON.stringify(process.argv.slice(1)))'], c.r);
    assert.equal(u.status, 0, u.stderr);
    assert.equal(u.stdout.trim(), '[]');
    assert.match(u.stderr, /todos/);
  } finally { rmSync(c.raiz, { recursive: true, force: true }); }
});

const SPEC = `✔ passa (0.3ms)
✖ falha um (0.3ms)
✖ failing tests:

test at /tmp/fila-de-merge-x/arvore/t/a.test.mjs:3:1
✖ falha um (0.3ms)
  AssertionError [ERR_ASSERTION]: 1 == 2
      at TestContext.<anonymous> (file:///tmp/fila-de-merge-x/arvore/src/b.mjs:3:29)

test at t/b.test.mjs:1:1
✖ t/b.test.mjs (24.9ms)
  'test failed'
`;
const TAP = `TAP version 13
# Subtest: quebra
not ok 1 - quebra
  ---
  duration_ms: 0.4
  location: '/tmp/fila-de-merge-y/arvore/t/b.test.mjs:2:1'
  failureType: 'testCodeFailure'
  ...
ok 2 - passa
  ---
  location: '/tmp/fila-de-merge-y/arvore/t/a.test.mjs:2:1'
  ...
`;

test('testes que falharam: lidos do relatório spec e do TAP, só os arquivos de teste do repo', () => {
  const conhecidos = ['t/a.test.mjs', 't/b.test.mjs', 't/c.test.mjs'];
  assert.deepEqual(testesQueFalharam(SPEC, conhecidos), ['t/a.test.mjs', 't/b.test.mjs']);
  assert.deepEqual(testesQueFalharam(TAP, conhecidos), ['t/b.test.mjs'], 'o `ok` do a.test não conta');
  assert.deepEqual(testesQueFalharam('erro de sintaxe no gate\n', conhecidos), []);
});

test('acerto: falhou um teste da seleção → acerto; falhou um de fora → erro, com o teste perdido; sem teste lido → indeterminado', () => {
  const c = repo();
  const base = join(c.raiz, 'orq');
  try {
    const log = join(c.raiz, 'gate.log');
    writeFileSync(log, 'test at /tmp/x/arvore/t/a.test.mjs:1:1\n');
    const a = registrarAcerto({ cwd: c.r, pr: 7, sha: c.sha, base: 'main', log, env: { HOOKS_CREWAI_BASE: base } });
    assert.equal(a.acerto, true);
    writeFileSync(log, 'test at t/b.test.mjs:1:1\n');
    const e = registrarAcerto({ cwd: c.r, pr: 8, sha: c.sha, base: 'main', log, env: { HOOKS_CREWAI_BASE: base } });
    assert.equal(e.acerto, false);
    assert.deepEqual(e.perdidos, ['t/b.test.mjs']);
    writeFileSync(log, 'npm ERR! algo\n');
    const i = registrarAcerto({ cwd: c.r, pr: 9, sha: c.sha, base: 'main', log, env: { HOOKS_CREWAI_BASE: base } });
    assert.equal(i.acerto, null);
    const linhas = readFileSync(join(base, 'testes-afetados-acerto.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    assert.deepEqual(linhas.map((l) => [l.pr, l.acerto]), [[7, true], [8, false], [9, null]]);
    assert.equal(linhas[0].sha, c.sha);
    assert.deepEqual(linhas[0].selecao, ['t/a.test.mjs']);
    assert.ok(linhas[0].repo && linhas[0].em);
    assert.deepEqual(resumoDoAcerto(linhas), { registros: 3, acertos: 1, erros: 1, indeterminados: 1, perdidos: ['t/b.test.mjs'] });
    // o CLI resume o log
    const s = rodar('node', [SCRIPT, '--acerto'], c.r, { HOOKS_CREWAI_BASE: base });
    assert.equal(s.status, 0, s.stderr);
    assert.equal(JSON.parse(s.stdout).erros, 1);
  } finally { rmSync(c.raiz, { recursive: true, force: true }); }
});
