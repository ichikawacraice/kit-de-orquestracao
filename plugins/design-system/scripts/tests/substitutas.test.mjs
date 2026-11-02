// substitutas.json: as skills da Anthropic que o plugin substitui (lido pelo kit de orquestração).
// Rodar: npm test na raiz do repositório.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CHAVES_DO_CATALOGO = ['design:accessibility-review', 'design:ux-copy', 'design:design-system'];

describe('substitutas.json', () => {
  const arquivo = join(RAIZ, 'substitutas.json');
  const json = JSON.parse(readFileSync(arquivo, 'utf8'));

  it('só tem a chave "substitutas"', () => {
    assert.deepEqual(Object.keys(json), ['substitutas']);
  });

  it('só declara skills absorvidas do catálogo do kit', () => {
    assert.deepEqual(Object.keys(json.substitutas).sort(), [...CHAVES_DO_CATALOGO].sort());
  });

  it('cada substituta é uma skill do próprio plugin que existe', () => {
    for (const [original, peca] of Object.entries(json.substitutas)) {
      const [plugin, nome, ...resto] = peca.split(':');
      assert.equal(plugin, 'design-system', `${original} aponta para outro plugin: ${peca}`);
      assert.ok(nome && resto.length === 0, `${original}: valor fora de <plugin>:<skill>: ${peca}`);
      assert.ok(existsSync(join(RAIZ, 'skills', nome, 'SKILL.md')), `${original} → ${peca}: skills/${nome}/SKILL.md não existe`);
    }
  });

  it('não vai no plugin.json (o validate --strict reprova campo novo)', () => {
    const plugin = readFileSync(join(RAIZ, '.claude-plugin', 'plugin.json'), 'utf8');
    assert.ok(!plugin.includes('substitutas'));
  });
});
