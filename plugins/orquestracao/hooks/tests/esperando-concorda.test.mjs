// A regra "esperando papel" existe em duas cópias (hooks/esperando-papel.mjs e a do pane, painel-sessoes/hooks/esperando.ts);
// aqui as duas respondem à mesma tabela. O Node tira os tipos do `.ts` sozinho a partir da 22.6; sem isso o teste é `skip`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { esperandoPapel, PAPEL_DA_ETAPA } from '../esperando-papel.mjs';
import { CASOS, AGORA } from './esperando-papel.casos.mjs';

const TS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'painel-sessoes', 'hooks', 'esperando.ts');
const semTs = process.features.typescript ? false : `Node ${process.version} não tira tipos de .ts (precisa de process.features.typescript)`;

test('as duas cópias dão o mesmo resultado em todos os casos', { skip: semTs }, async () => {
  const copia = await import(pathToFileURL(TS).href);
  assert.ok(CASOS.length > 0, 'a tabela de casos não pode estar vazia');
  assert.ok(CASOS.some((c) => c.esperado), 'a tabela precisa de ao menos um caso que espera');
  assert.deepEqual(copia.PAPEL_DA_ETAPA, PAPEL_DA_ETAPA);
  for (const c of CASOS) {
    assert.deepEqual(copia.esperandoPapel(c.data, AGORA), esperandoPapel(c.data, AGORA), c.nome);
  }
});
