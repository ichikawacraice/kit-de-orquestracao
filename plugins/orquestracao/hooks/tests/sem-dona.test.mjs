import { test } from 'node:test';
import assert from 'node:assert/strict';
import { semDona, donaACaminho, donaTrabalhando, tetoDeDonas, ETAPAS_DE_TRABALHO } from '../sem-dona.mjs';
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

test('donaTrabalhando conta dona ou com em etapa de trabalho, nunca merge nem final', () => {
  assert.equal(donaTrabalhando({ etapa: 'execucao', donoLocalId: 'local_a' }), true);
  assert.equal(donaTrabalhando({ etapa: 'design', com: [{ localId: 'local_a' }] }), true);
  assert.equal(donaTrabalhando({ etapa: 'execucao', com: [] }), false);
  assert.equal(donaTrabalhando({ etapa: 'merge', donoLocalId: 'local_a' }), false);
  assert.equal(donaTrabalhando({ etapa: 'feito', donoLocalId: 'local_a' }), false);
  assert.equal(donaTrabalhando(null), false);
});

test('tetoDeDonas: KIT_TETO_DE_DONAS inteiro positivo, senão 4', () => {
  assert.equal(tetoDeDonas({}), 4);
  assert.equal(tetoDeDonas({ KIT_TETO_DE_DONAS: '2' }), 2);
  assert.equal(tetoDeDonas({ KIT_TETO_DE_DONAS: '0' }), 4);
  assert.equal(tetoDeDonas({ KIT_TETO_DE_DONAS: 'x' }), 4);
});

test('donaACaminho responde à tabela inteira (F218)', () => {
  assert.ok(CASOS_A_CAMINHO.some((c) => c.esperado) && CASOS_A_CAMINHO.some((c) => !c.esperado), 'a tabela precisa dos dois desfechos');
  for (const c of CASOS_A_CAMINHO) assert.equal(donaACaminho(c.F, { cartoes: c.cartoes, sessoes: c.sessoes, agoraMs: AGORA, desde: c.desde }), c.esperado, c.nome);
});
