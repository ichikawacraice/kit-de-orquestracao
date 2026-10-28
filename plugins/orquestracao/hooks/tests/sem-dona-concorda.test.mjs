// A regra "item sem dona" existe em duas cópias (hooks/sem-dona.mjs e a do pane, painel-sessoes/hooks/sem-dona.ts);
// aqui as duas respondem à mesma tabela. O Node tira os tipos do `.ts` sozinho a partir da 22.6; sem isso o teste é `skip`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { semDona, donaACaminho, ETAPAS_DE_TRABALHO } from '../sem-dona.mjs';
import { CASOS, CASOS_A_CAMINHO, AGORA } from './sem-dona.casos.mjs';

const TS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'painel-sessoes', 'hooks', 'sem-dona.ts');
const semTs = process.features.typescript ? false : `Node ${process.version} não tira tipos de .ts (precisa de process.features.typescript)`;

test('as duas cópias dão o mesmo resultado em todos os casos', { skip: semTs }, async () => {
  const copia = await import(pathToFileURL(TS).href);
  assert.ok(CASOS.length > 0, 'a tabela de casos não pode estar vazia');
  assert.ok(CASOS.some((c) => c.esperado), 'a tabela precisa de ao menos um caso sem dona');
  assert.deepEqual(copia.ETAPAS_DE_TRABALHO, ETAPAS_DE_TRABALHO);
  for (const c of CASOS) {
    assert.deepEqual(copia.semDona(c.data, AGORA), semDona(c.data, AGORA), c.nome);
  }
});

test('as duas cópias de donaACaminho dão o mesmo resultado (F218)', { skip: semTs }, async () => {
  const copia = await import(pathToFileURL(TS).href);
  assert.ok(CASOS_A_CAMINHO.length > 0, 'a tabela de casos não pode estar vazia');
  for (const c of CASOS_A_CAMINHO) {
    const args = { cartoes: c.cartoes, agoraMs: AGORA };
    assert.equal(copia.donaACaminho(c.F, c.data, args), donaACaminho(c.F, c.data, args), c.nome);
  }
});
