#!/usr/bin/env node
// ADR 0005 (26/10): doc × código — o protocolo, o manual da dona e o código do teto de núcleos têm de concordar (pasta padrão, nomes de
// variável, âncora).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const ler = (...p) => readFileSync(join(RAIZ, ...p), 'utf8');
const protocolo = ler('plugins', 'orquestracao', 'pool', 'protocolo.md');
const teto = ler('gate', 'o-teto-da-maquina.mjs') + ler('gate', 'com-fichas.mjs');
const { pastaDoTeto, FRACAO_PADRAO_DE_TESTE, FRACAO_PADRAO_DO_GATE, NOME_DA_VEZ_DO_GATE } = await import(join(RAIZ, 'gate', 'o-teto-da-maquina.mjs'));
const readme = ler('gate', 'README.md');
const comum = ler('plugins', 'orquestracao', 'hooks', 'pool-comum.mjs');

test('o protocolo tem a seção e a âncora, e as insumos existem (não vazios)', () => {
  assert.ok(protocolo.length > 0 && teto.length > 0);
  assert.ok(protocolo.includes('<a id="teto-de-nucleos"></a>\n## Teto de núcleos da máquina'), 'sem a âncora e o título da seção');
});
test('o protocolo cita a mesma pasta padrão que o código', () => {
  const padrao = pastaDoTeto({}).replace(homedir(), '~');
  assert.equal(padrao, '~/.claude/orquestracao/nucleos-de-teste');
  assert.ok(protocolo.includes(`\`${padrao}/\``), `o protocolo não cita ${padrao}/`);
});
test('o protocolo cita as variáveis que o código lê, e o código as lê', () => {
  for (const nome of ['KIT_NUCLEOS_DIR', 'KIT_NUCLEOS_DE_TESTE', 'KIT_FICHAS_TOMADAS', 'KIT_FRACAO_DE_TESTE', 'KIT_FRACAO_DO_GATE']) {
    assert.ok(protocolo.includes(`\`${nome}`), `o protocolo não cita ${nome}`);
    const sufixo = nome.replace(/^KIT_/, '');
    assert.ok(teto.includes(nome) || teto.includes(`"${sufixo}"`), `o código não lê ${nome}`);
  }
});
test('as frações e o nome da vez do gate: o protocolo, o README, o gate e o plugin dizem o mesmo (ADR 0008)', () => {
  assert.ok(FRACAO_PADRAO_DE_TESTE > 0 && FRACAO_PADRAO_DO_GATE > 0 && NOME_DA_VEZ_DO_GATE.length > 0, 'insumos vazios');
  assert.equal(Math.floor(15 * FRACAO_PADRAO_DE_TESTE), 10, '2/3 de 15 núcleos');
  assert.equal(Math.floor(10 * FRACAO_PADRAO_DO_GATE), 7, '70% de 10');
  assert.ok(protocolo.includes('2/3') && protocolo.includes('70%'), 'o protocolo não cita 2/3 e 70%');
  assert.ok(readme.includes('2/3') && readme.includes('70%'), 'o README não cita 2/3 e 70%');
  assert.ok(protocolo.includes(`<pasta>/${NOME_DA_VEZ_DO_GATE}`) && readme.includes(`<pasta>/${NOME_DA_VEZ_DO_GATE}`), 'a doc não cita o arquivo da vez do gate');
  // o plugin repete as constantes (não importa gate/): têm de valer o mesmo que no gate
  assert.ok(comum.includes('const FRACAO_PADRAO_DE_TESTE = 2 / 3;'), 'o plugin mudou a fração de teste');
  assert.ok(comum.includes(`const FRACAO_PADRAO_DO_GATE = ${FRACAO_PADRAO_DO_GATE};`), 'o plugin mudou a fração do gate');
  assert.ok(comum.includes(`'${NOME_DA_VEZ_DO_GATE}'`), 'o plugin não lê o arquivo da vez do gate');
  assert.ok(teto.includes('2 / 3') && teto.includes('0.7'), 'o código do gate não tem 2/3 e 0,7');
});
test('o manual da dona cita a âncora e o com-fichas, e ela existe no protocolo', () => {
  const t = ler('plugins', 'orquestracao', 'pool', 'dona.md');
  assert.ok(t.length > 0, 'dona.md vazio');
  assert.ok(t.includes('protocolo.md#teto-de-nucleos'), 'dona.md não cita protocolo.md#teto-de-nucleos');
  assert.ok(t.includes('com-fichas'), 'dona.md não cita o com-fichas');
  assert.ok(protocolo.includes('(#teto-de-nucleos)'), 'a linha das regras do repositório não aponta a âncora');
});
test('a skill da orquestradora cita a âncora', () => {
  const skill = ler('plugins', 'orquestracao', 'skills', 'orquestradora', 'SKILL.md');
  assert.ok(skill.includes('teto-de-nucleos'), 'a skill não cita a âncora');
});
