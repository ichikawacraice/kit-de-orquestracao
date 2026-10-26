import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const MODELOS = [
  'docs/adr/README.md', 'docs/specs/README.md', 'docs/roadmap.md', 'docs/diario/README.md',
  'docs/design/revisoes/README.md', 'docs/research/README.md', 'docs/planos/README.md',
  'front/PRODUCT.md', 'front/DESIGN.md', 'front/ANATOMIA.md', 'CLAUDE.md',
];
const PROIBIDAS = ['Izanagi', 'Wake', 'VTEX', 'apps/web'];
const ler = (f) => readFileSync(join(RAIZ, 'modelos', f), 'utf8');
const bloco = (texto, nome) => new RegExp(`<!-- kit:${nome} v(\\d+) -->([\\s\\S]*?)<!-- /kit:${nome} -->`).exec(texto);

describe('modelos de documento (K10)', () => {
  for (const f of MODELOS) {
    test(`${f}: existe, não é vazio e não cita o produto de origem`, () => {
      assert.ok(existsSync(join(RAIZ, 'modelos', f)), `${f} não existe`);
      const t = ler(f);
      assert.ok(t.trim().length > 200, `${f} vazio ou curto demais (${t.trim().length})`);
      for (const p of PROIBIDAS) assert.ok(!t.includes(p), `${f} cita "${p}"`);
    });
  }

  test('o detector de palavra proibida enxerga a palavra (a ausência acima mede algo)', () => {
    assert.ok(`texto do Izanagi`.includes(PROIBIDAS[0]));
    assert.ok(PROIBIDAS.every((p) => p.length > 0));
  });

  test('o modelo de spec traz o vocabulário fechado de status, na ordem', () => {
    const t = ler('docs/specs/README.md');
    assert.ok(t.includes('Rascunho · Em revisão · Aprovada · Implementada · Substituída'));
    assert.match(t, /Pendências:/);
  });

  test('o modelo de ADR traz "Alternativas consideradas"', () => {
    assert.match(ler('docs/adr/README.md'), /^## Alternativas consideradas/m);
  });

  test('o modelo de PRODUCT.md traz a marca de esquema do Impeccable', () => {
    assert.ok(ler('front/PRODUCT.md').includes('<!-- impeccable:product-schema 1 -->'));
  });

  test('o roadmap modelo traz o orçamento da linha (400 caracteres, 2 links)', () => {
    const t = ler('docs/roadmap.md');
    assert.match(t, /400 caracteres/); assert.match(t, /2 links/);
  });
});

describe('blocos do modelos/CLAUDE.md (K10)', () => {
  const t = ler('CLAUDE.md');

  test('kit:documentos v1 existe, fechado e com as regras de doc', () => {
    const b = bloco(t, 'documentos');
    assert.ok(b, 'bloco kit:documentos ausente'); assert.equal(b[1], '1');
    for (const frase of ['4 dígitos', 'imutável', '400 caracteres', 'diário', 'datada', 'âncora', 'mergeado']) {
      assert.ok(b[2].toLowerCase().includes(frase.toLowerCase()), `kit:documentos não diz "${frase}"`);
    }
  });

  test('kit:design v1 existe, fechado e com o fluxo, o teto e as envs do Impeccable', () => {
    const b = bloco(t, 'design');
    assert.ok(b, 'bloco kit:design ausente'); assert.equal(b[1], '1');
    for (const frase of ['24/30', 'IMPECCABLE_NO_TELEMETRY', 'IMPECCABLE_NO_UPDATE_CHECK', 'config.local.json', 'estado visível']) {
      assert.ok(b[2].includes(frase), `kit:design não diz "${frase}"`);
    }
  });

  test('kit:regras-de-trabalho sobe para v3 e aponta para o bloco de documentos', () => {
    const b = bloco(t, 'regras-de-trabalho');
    assert.ok(b, 'bloco ausente'); assert.equal(b[1], '3');
    assert.match(b[2], /kit:documentos/);
  });
});
