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
    for (const n of ['ALTO', 'TETO', 'EXEC', 'PEDIR']) assert.ok(doHook(n) > 0, n);
  });

  it('executora: o teto da barra é o EXEC do hook', () => {
    assert.equal(daBarra('E').teto, doHook('EXEC'));
  });

  it('planejadora, design e validadora: aviso = ALTO e teto = TETO', () => {
    for (const p of ['P', 'D', 'V']) assert.deepEqual(daBarra(p), { aviso: doHook('ALTO'), teto: doHook('TETO') }, p);
  });

  it('orquestradora com o operador presente: aviso e teto = PEDIR; ausente segue a planejadora', () => {
    assert.deepEqual(daBarra('orquestradora'), { aviso: doHook('PEDIR'), teto: doHook('PEDIR') });
    assert.deepEqual(daBarra('orquestradoraAusente'), daBarra('P'));
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
