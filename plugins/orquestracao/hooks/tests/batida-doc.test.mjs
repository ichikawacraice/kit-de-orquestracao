#!/usr/bin/env node
// ADR 0007: doc × código — a âncora `batida` do protocolo cita os prazos e as variáveis que o código lê, com os mesmos padrões.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BATIDA_SOLTA_MIN, PRAZO_MIN, ESPERA_MIN, REAVISO_MIN, TETO_DE_LIVRES } from '../../skills/orquestradora/scripts/batida.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const ler = (...p) => readFileSync(join(RAIZ, ...p), 'utf8');
const protocolo = ler('plugins', 'orquestracao', 'pool', 'protocolo.md');
const painel = ler('plugins', 'orquestracao', 'skills', 'orquestradora', 'scripts', 'painel.mjs');
const mod = ler('plugins', 'painel-sessoes', 'hooks', 'register.tsx');
const secao = protocolo.slice(protocolo.indexOf('<a id="batida"></a>'), protocolo.indexOf('<a id="perguntas-proprias"></a>'));

test('o protocolo tem a âncora e a seção, e os insumos existem (não vazios)', () => {
  assert.ok(protocolo.length > 0 && painel.length > 0 && mod.length > 0);
  assert.ok(protocolo.includes('<a id="batida"></a>\n## A batida'), 'sem a âncora e o título');
  assert.ok(secao.length > 200, 'seção vazia: o recorte falhou');
});
test('a seção cita as variáveis e os padrões que o código usa', () => {
  for (const [nome, padrao] of [['PAINEL_PRAZO_MIN', PRAZO_MIN], ['BATIDA_SOLTA_MIN', BATIDA_SOLTA_MIN]]) {
    assert.ok(secao.includes(`\`${nome}\` (${padrao})`), `a seção não diz ${nome} (${padrao})`);
  }
  assert.ok(painel.includes('PAINEL_PRAZO_MIN') && painel.includes('BATIDA_SOLTA_MIN'), 'o código não lê as variáveis');
  assert.ok(secao.includes('`BATIDA_MIN`') && mod.includes("'BATIDA_MIN'"), 'BATIDA_MIN: doc ou mod discorda');
  assert.ok(secao.includes('`BATIDA=off`') && mod.includes("'BATIDA'"), 'BATIDA=off: doc ou mod discorda');
  assert.ok(secao.includes(`${ESPERA_MIN} min`) && secao.includes(`${REAVISO_MIN} min`) && secao.includes(`dois livres`) && TETO_DE_LIVRES === 2, 'prazos de espera, reaviso e teto de livres');
});
test('o ritual cita a mesma folga de batida velha que o código, e os papéis citam painel pegar', () => {
  const ritual = ler('plugins', 'orquestracao', 'hooks', 'orquestradora-ritual.mjs');
  assert.ok(ritual.includes('BATIDA_VELHA_MIN') && /: 30; \}\)\(\)/.test(ritual), 'o hook não tem o padrão de 30 min');
  assert.ok(secao.includes('mais de 30 min'), 'a seção não diz os 30 min do aviso');
  for (const papel of ['planejadora', 'design', 'executora', 'validadora']) {
    assert.ok(ler('plugins', 'orquestracao', 'pool', 'papeis', `${papel}.md`).includes('painel pegar <F<n>>'), `${papel}.md não manda usar painel pegar`);
  }
});
