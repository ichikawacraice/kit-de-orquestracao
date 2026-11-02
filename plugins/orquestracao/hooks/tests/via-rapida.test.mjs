// F348: o corte da via rápida da revisão se mede no diff (linhas, arquivos, contrato ou trava, removido), e o protocolo
// diz os mesmos números que o script. Repositório git temporário; nunca toca o HOME real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { corte, LINHAS_MAX, ARQUIVOS_MAX } from '../../pool/via-rapida.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(AQUI, '..', '..', 'pool', 'via-rapida.mjs');
const ENV = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t', KIT_BASE: '' };
const rodar = (cmd, args, cwd) => spawnSync(cmd, args, { cwd, encoding: 'utf8', timeout: 30000, killSignal: 'SIGKILL', env: ENV });
function git(cwd, ...args) {
  const r = rodar('git', args, cwd);
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
}
function gravar(raiz, arquivos) {
  for (const [f, t] of Object.entries(arquivos)) { mkdirSync(dirname(join(raiz, f)), { recursive: true }); writeFileSync(join(raiz, f), t); }
}
const n = (k) => Array.from({ length: k }, (_, i) => `l${i}`).join('\n') + '\n';

// base com src/a.mjs (5 linhas), src/b.mjs e docs/x.md; a branch `item` sai dela.
function repo(t) {
  const raiz = mkdtempSync(join(tmpdir(), 'via-rapida-'));
  t.after(() => rmSync(raiz, { recursive: true, force: true }));
  git(raiz, 'init', '-q', '-b', 'main');
  gravar(raiz, { 'src/a.mjs': n(5), 'src/b.mjs': n(5), 'docs/x.md': n(3) });
  git(raiz, 'add', '-A');
  git(raiz, 'commit', '-qm', 'base');
  git(raiz, 'switch', '-qc', 'item');
  return raiz;
}

test('item pequeno fora de contrato cabe, contando commit, árvore e arquivo novo', (t) => {
  const raiz = repo(t);
  gravar(raiz, { 'src/a.mjs': n(8) });
  git(raiz, 'commit', '-qam', 'a');
  gravar(raiz, { 'src/b.mjs': n(6), 'src/c.mjs': n(4) });
  const r = corte(raiz, 'main');
  assert.deepEqual(r.motivos, []);
  assert.equal(r.cabe, true);
  assert.deepEqual(r.arquivos.sort(), ['src/a.mjs', 'src/b.mjs', 'src/c.mjs']);
  assert.equal(r.linhas, 3 + 1 + 4, 'adições do commit, da árvore e as linhas do arquivo novo');
});

test('passa do teto de linhas ou de arquivos: não cabe, com o número no motivo', (t) => {
  const raiz = repo(t);
  gravar(raiz, { 'src/a.mjs': n(5 + LINHAS_MAX + 1) });
  const r = corte(raiz, 'main');
  assert.equal(r.cabe, false);
  assert.match(r.motivos.join('\n'), new RegExp(`${LINHAS_MAX + 1} linhas mudadas \\(o corte é ${LINHAS_MAX}\\)`));

  const raiz2 = repo(t);
  gravar(raiz2, Object.fromEntries(Array.from({ length: ARQUIVOS_MAX + 1 }, (_, i) => [`src/novo${i}.mjs`, 'x\n'])));
  const r2 = corte(raiz2, 'main');
  assert.equal(r2.cabe, false);
  assert.match(r2.motivos.join('\n'), new RegExp(`${ARQUIVOS_MAX + 1} arquivos`));
});

test('arquivo de contrato ou de trava tira do corte, mesmo com uma linha', (t) => {
  for (const f of ['docs/adr/0002-decisão.md', 'src/ação.sql', 'CLAUDE.md', 'plugins/p/skills/papeis-e-modelos/SKILL.md', '.github/workflows/ci.yml', 'docs/adr/0099-x.md', 'db/migrations/001.sql', 'plugins/p/hooks/trava.mjs', 'package.json', '.claude/kit.json', 'plugins/p/agents/validador.md', 'plugins/p/pool/protocolo.md']) {
    const raiz = repo(t);
    gravar(raiz, { [f]: 'x\n' });
    const r = corte(raiz, 'main');
    assert.equal(r.cabe, false, f);
    assert.match(r.motivos.join('\n'), new RegExp(`${f.replace(/[.]/g, '\\.')}: contrato ou trava`), f);
  }
});

test('o projeto soma padrões em viaRapida.fora do kit.json', (t) => {
  const raiz = repo(t);
  gravar(raiz, { '.claude/kit.json': JSON.stringify({ viaRapida: { fora: ['src/pagamento/**'] } }) });
  git(raiz, 'add', '-A');
  git(raiz, 'commit', '-qm', 'kit');
  git(raiz, 'switch', '-qc', 'item2');
  gravar(raiz, { 'src/pagamento/x.mjs': 'x\n' });
  const r = corte(raiz, 'item');
  assert.deepEqual(r.arquivos, ['src/pagamento/x.mjs']);
  assert.match(r.motivos.join('\n'), /src\/pagamento\/x\.mjs: contrato ou trava \(src\/pagamento\/\*\*\)/);
});

test('caminho com acento commitado é lido cru (sem as aspas do git) e casa o padrão', (t) => {
  const raiz = repo(t);
  gravar(raiz, { 'docs/adr/0002-decisão.md': 'x\n', 'src/ação.mjs': 'y\n' });
  git(raiz, 'add', '-A');
  git(raiz, 'commit', '-qm', 'acento');
  const r = corte(raiz, 'main');
  assert.deepEqual(r.arquivos.sort(), ['docs/adr/0002-decisão.md', 'src/ação.mjs']);
  assert.match(r.motivos.join('\n'), /docs\/adr\/0002-decisão\.md: contrato ou trava/);
  assert.ok(!r.motivos.some((m) => /binário/.test(m)), r.motivos.join('\n'));
});

test('removido ou renomeado tira do corte; diff vazio também', (t) => {
  const raiz = repo(t);
  git(raiz, 'mv', 'src/b.mjs', 'src/b2.mjs');
  const r = corte(raiz, 'main');
  assert.equal(r.cabe, false);
  assert.match(r.motivos.join('\n'), /src\/b\.mjs: removido/);

  const vazio = repo(t);
  const rv = corte(vazio, 'main');
  assert.equal(rv.cabe, false);
  assert.match(rv.motivos.join('\n'), /vazio/);
});

test('o CLI sai 0 quando cabe e 1 quando não cabe, com o motivo', (t) => {
  const raiz = repo(t);
  gravar(raiz, { 'src/a.mjs': n(6) });
  const ok = rodar(process.execPath, [SCRIPT, '--base', 'main'], raiz);
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /via rápida: cabe \(base main, 1 linhas em 1 arquivos\)/);
  gravar(raiz, { 'hooks.json': '{}' });
  const nao = rodar(process.execPath, [SCRIPT, '--base', 'main', '--json'], raiz);
  assert.equal(nao.status, 1, nao.stderr);
  assert.equal(JSON.parse(nao.stdout).cabe, false);
});

test('o protocolo diz os mesmos tetos que o script', () => {
  const p = readFileSync(join(AQUI, '..', '..', 'pool', 'protocolo.md'), 'utf8');
  const sec = p.slice(p.indexOf('<a id="via-rapida-da-revisao"></a>'), p.indexOf('<a id="custo-do-item"></a>'));
  assert.ok(sec.length > 200, 'a seção da via rápida existe');
  assert.match(sec, new RegExp(`até \\*\\*${LINHAS_MAX} linhas\\*\\*`));
  assert.match(sec, new RegExp(`até \\*\\*${ARQUIVOS_MAX} arquivos\\*\\*`));
  assert.match(sec, /via-rapida\.mjs/);
});
