// F447: o setup das worktrees do Orca roda `npm install` na raiz, que não tem dependência e não rastreia lockfile; o
// `package-lock.json` solto deixava toda worktree suja e o `painel orquestradora arquivar` nunca achava a worktree limpa.
// O da raiz é ignorado; o do design-system, rastreado, não.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ignorado = (caminho) => {
  const r = spawnSync('git', ['-C', RAIZ, 'check-ignore', '-q', '--no-index', caminho], { encoding: 'utf8', timeout: 10000, killSignal: 'SIGKILL' });
  assert.ok(r.status === 0 || r.status === 1, `git check-ignore: ${r.stderr}`);
  return r.status === 0;
};

test('o package-lock.json da raiz é ignorado; o do design-system, não', () => {
  assert.equal(ignorado('node_modules/x'), true, 'prova: o check-ignore acha um padrão do .gitignore');
  assert.equal(ignorado('package-lock.json'), true, 'o lockfile da raiz');
  assert.equal(ignorado('design-system/package-lock.json'), false, 'o lockfile do design-system segue rastreável');
});
