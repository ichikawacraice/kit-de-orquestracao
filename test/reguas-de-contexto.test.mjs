import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// As réguas de contexto da barra de status (painel-sessoes) e as do hook contexto-do-papel (orquestracao) devem ser as mesmas.
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const HOOK = readFileSync(join(RAIZ, 'plugins', 'orquestracao', 'hooks', 'contexto-do-papel.mjs'), 'utf8');
const BARRA = readFileSync(join(RAIZ, 'plugins', 'painel-sessoes', 'hooks', 'barra.tsx'), 'utf8');

const numero = (t) => Number(t.replaceAll('_', ''));
const doHook = (nome) => {
  const m = new RegExp(`limite\\('${nome}',\\s*([\\d_]+)\\)`).exec(HOOK);
  assert.ok(m, `constante ${nome} achada em contexto-do-papel.mjs`);

  return numero(m[1]);
};
const daBarra = (papel) => {
  const m = new RegExp(`\\b${papel}:\\s*\\{\\s*aviso:\\s*([\\d_]+),\\s*teto:\\s*([\\d_]+)\\s*\\}`).exec(BARRA);
  assert.ok(m, `régua ${papel} achada em barra.tsx`);

  return { aviso: numero(m[1]), teto: numero(m[2]) };
};

const REGUA_LIDA = /regua\??\.(teto|aviso)/;

describe('réguas de contexto: barra × hook', () => {
  it('os números do hook existem e não são zero', () => {
    for (const n of ['ALTO', 'TETO', 'PEDIR']) assert.ok(doHook(n) > 0, n);
  });

  it('dona: aviso = ALTO e teto = TETO', () => {
    assert.deepEqual(daBarra('dona'), { aviso: doHook('ALTO'), teto: doHook('TETO') });
  });

  it('orquestradora com o operador presente: aviso e teto = PEDIR; ausente segue a dona', () => {
    assert.deepEqual(daBarra('orquestradora'), { aviso: doHook('PEDIR'), teto: doHook('PEDIR') });
    assert.deepEqual(daBarra('orquestradoraAusente'), daBarra('dona'));
  });

  it('o denominador do contexto é a janela, não a régua: textoDoContexto não usa regua.teto', () => {
    const fn = /export function textoDoContexto\([\s\S]*?\n}\n/.exec(BARRA);
    assert.ok(fn, 'textoDoContexto achada em barra.tsx');
    assert.ok(fn[0].includes('janela'), 'a função usa a janela');
    assert.ok(!REGUA_LIDA.test(fn[0]), 'a função não lê regua.teto nem regua.aviso (com ou sem `?.`)');
  });

  it('a regex que barra a leitura da régua pega `regua?.teto` e `regua.aviso`', () => {
    assert.ok(REGUA_LIDA.test('mil(regua?.teto ?? janela)'));
    assert.ok(REGUA_LIDA.test('mil(regua.aviso)'));
    assert.ok(!REGUA_LIDA.test('corDoContexto(tokens, regua)'));
  });
});
