import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esperandoPapel, PAPEL_DA_ETAPA } from '../esperando-papel.mjs';
import { CASOS, AGORA } from './esperando-papel.casos.mjs';

test('a tabela de casos não está vazia', () => {
  assert.ok(CASOS.length >= 15);
  assert.ok(CASOS.some((c) => c.esperado) && CASOS.some((c) => c.esperado === null));
});

for (const c of CASOS) {
  test(c.nome, () => {
    assert.deepEqual(esperandoPapel(c.data, AGORA), c.esperado);
  });
}

test('PAPEL_DA_ETAPA mapeia design, execucao e validacao', () => {
  assert.deepEqual(PAPEL_DA_ETAPA, { design: 'D', execucao: 'E', validacao: 'V' });
});

test('data inválida ou ausente não quebra', () => {
  assert.equal(esperandoPapel(null, AGORA), null);
  assert.equal(esperandoPapel({ etapa: 'execucao' }, AGORA), null);
});
