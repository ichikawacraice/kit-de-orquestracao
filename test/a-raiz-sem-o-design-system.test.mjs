// F357 (ADR 0020): o design system mora em design-system/, com dependências npm e gate próprios. O `npm test` da raiz roda os
// mesmos testes que o `node --test` sem argumento rodaria, menos os de design-system/: o kit segue sem `npm install`.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { globSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const script = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8')).scripts.test;
// os globs entre aspas simples, depois do `node --test`
const globs = [...script.split(' node --test ')[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
// a descoberta padrão do `node --test` sem argumento (Node ≥ 22, com os .ts que ele já remove o tipo)
const EXT = '{cjs,mjs,js,cts,mts,ts}';
const PADRAO = [`**/*.test.${EXT}`, `**/*-test.${EXT}`, `**/*_test.${EXT}`, `**/test-*.${EXT}`, `**/test.${EXT}`, `**/test/**/*.${EXT}`];
const achar = (padroes) => new Set(padroes.flatMap((p) => globSync(p, { cwd: RAIZ, exclude: (f) => f.split(/[\\/]/).includes('node_modules') })));

describe('a raiz não roda os testes do design-system', () => {
  it('o npm test da raiz roda o que o node --test acharia, menos design-system/', () => {
    assert.ok(globs.length > 0, `sem glob no script: ${script}`);
    const padrao = achar(PADRAO);
    assert.ok([...padrao].some((f) => f.startsWith('design-system/')), 'precondição: a descoberta padrão pegaria design-system/');
    const esperado = [...padrao].filter((f) => !f.startsWith('design-system/')).sort();
    assert.ok(esperado.length > 50, `precondição: testes do kit achados: ${esperado.length}`);
    assert.deepEqual([...achar(globs)].sort(), esperado);
  });
});
