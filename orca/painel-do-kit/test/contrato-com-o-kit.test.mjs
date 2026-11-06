// F448 (fatia 9): o painel do kit e a aba do Orca guardam, cada um, uma cópia do contrato do endereço de entrega (o
// plugin do Orca não importa o kit em tempo de execução). Este teste compara as duas cópias numa tabela de amostras, e a
// origem do clique que a aba grava com as que a trava de limpeza aceita.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { destinoValido } from '../src/nucleo/envio.mjs';
import { ORIGEM } from '../src/nucleo/painel.mjs';
import { ehDestinoDoOrca, DESTINO_DO_ORCA } from '../../../plugins/orquestracao/hooks/anfitriao.mjs';

const AMOSTRAS = [
  ['orca_session_id:880dae07-91e8-4aae-9a46-0e857a656849', true],
  ['orca_session_id:claude_3c8ec4cb_1849_49ba_be37_f9215e9742a6', true],
  ['dispatch:ctx_6eb257172494', true],
  ['run:run_a', true],
  ['orca_session_id:', false],
  ['dispatch:a b', false],
  ["run:x'; rm -rf ~", false],
  ['term_ab12', false],
  ['local_00000000-0000-4000-8000-0000000000a1', false],
  ['RUN:run_a', false],
  ['run:run_a\n', false],
  ['', false],
  [3, false],
  [null, false],
];

test('o endereço que o painel aceita é o mesmo que a aba envia (amostra por amostra)', () => {
  assert.ok(DESTINO_DO_ORCA instanceof RegExp, 'o kit exporta a regra');
  assert.ok(AMOSTRAS.some(([, ok]) => ok) && AMOSTRAS.some(([, ok]) => !ok), 'a tabela tem os dois lados');
  for (const [v, esperado] of AMOSTRAS) {
    assert.equal(ehDestinoDoOrca(v), esperado, `kit: ${JSON.stringify(v)}`);
    assert.equal(destinoValido(v), esperado, `aba: ${JSON.stringify(v)}`);
  }
});

test('a origem do clique que a aba grava é uma das que a trava de limpeza aceita', () => {
  const fonte = readFileSync(new URL('../../../plugins/orquestracao/hooks/travas-da-sessao.mjs', import.meta.url), 'utf8');
  const linha = fonte.split('\n').find((l) => l.includes('const ORIGENS_DO_CLIQUE = new Set('));
  assert.ok(linha, 'a trava declara as origens do clique');
  const origens = [...linha.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.ok(origens.includes('painel'), `insumo: ${linha}`);
  assert.ok(origens.includes(ORIGEM), `a trava não aceita ${ORIGEM}: ${linha}`);
});
