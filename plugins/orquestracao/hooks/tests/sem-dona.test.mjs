import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as semDonaMod from '../sem-dona.mjs';
import { semDona, donaACaminho, ETAPAS_DE_TRABALHO } from '../sem-dona.mjs';
import { CASOS, CASOS_A_CAMINHO, AGORA } from './sem-dona.casos.mjs';

test('semDona responde à tabela inteira', () => {
  assert.ok(CASOS.length > 0, 'a tabela de casos não pode estar vazia');
  assert.ok(CASOS.some((c) => c.esperado) && CASOS.some((c) => c.esperado === null), 'a tabela precisa dos dois desfechos');
  for (const c of CASOS) assert.deepEqual(semDona(c.data, AGORA), c.esperado, c.nome);
});

test('semDona de entrada inválida é null', () => {
  assert.equal(semDona(null, AGORA), null);
  assert.equal(semDona('F1', AGORA), null);
});

test('ETAPAS_DE_TRABALHO são as quatro etapas em que alguém trabalha', () => {
  assert.deepEqual(ETAPAS_DE_TRABALHO, ['planejamento', 'design', 'execucao', 'validacao']);
});

test('ADR 0033: o teto de donas não existe mais no módulo', () => {
  assert.ok(Object.keys(semDonaMod).length > 0, 'prova: o módulo exporta algo');
  assert.equal(semDonaMod.tetoDeDonas, undefined);
  assert.equal(semDonaMod.donaTrabalhando, undefined);
});
test('donaACaminho responde à tabela inteira (F218)', () => {
  assert.ok(CASOS_A_CAMINHO.some((c) => c.esperado) && CASOS_A_CAMINHO.some((c) => !c.esperado), 'a tabela precisa dos dois desfechos');
  for (const c of CASOS_A_CAMINHO) assert.equal(donaACaminho(c.F, c.data, { cartoes: c.cartoes, agoraMs: AGORA }), c.esperado, c.nome);
});
