import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { watch } from 'node:fs';
import { setTimeout as esperar } from 'node:timers/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// F187: c5, c14 e hooks-json copiam `plugins/orquestracao/hooks` inteira e o cli.test varre `test/` e `hooks/tests`. Um teste que cria
// pasta temporária dentro dessas árvores (o HOME `.home-*` do hooks-crewai e do c14) e a apaga no meio da cópia derruba quem copia
// (o `cpSync` nativo aborta o processo). Os testes que criam HOME fora das pastas livres da trava não escrevem em `test/` nem em `plugins/`.
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const VIGIADAS = ['test', 'plugins'];

async function oQueApareceEnquanto(args) {
  const vistos = new Set();
  const vigias = VIGIADAS.map((d) => watch(join(RAIZ, d), { recursive: true }, (_ev, nome) => { if (nome) vistos.add(`${d}/${nome}`); }));
  try {
    const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
    const r = spawnSync('node', args, { cwd: RAIZ, env, encoding: 'utf8', timeout: 180000, killSignal: 'SIGKILL' });
    assert.equal(r.status, 0, `${args.join(' ')} falhou:\n${r.stdout}${r.stderr}`);
    await esperar(500);
  } finally { vigias.forEach((v) => v.close()); }
  return [...vistos];
}

test('hooks-crewai não cria pasta dentro de plugins/ nem de test/', async () => {
  assert.deepEqual(await oQueApareceEnquanto(['plugins/orquestracao/hooks/tests/hooks-crewai.test.mjs']), []);
});

test('c14 não cria pasta dentro de plugins/ nem de test/', async () => {
  assert.deepEqual(await oQueApareceEnquanto(['--test', 'test/c14.test.mjs']), []);
});
