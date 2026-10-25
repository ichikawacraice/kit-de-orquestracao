/**
 * Um `expect` mínimo sobre `node:assert/strict`, só para os testes do gate
 * portados do Izanagi (vitest) manterem a forma do original sem dependência.
 */
import assert from "node:assert/strict";
import { it } from "node:test";

const parcial = (real, esperado, caminho = "") => {
  for (const [k, v] of Object.entries(esperado)) {
    const aqui = `${caminho}${k}`;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) parcial(real?.[k], v, `${aqui}.`);
    else assert.deepStrictEqual(real?.[k], v, `campo ${aqui}`);
  }
};

function de(real, negado, msg) {
  const ok = (cond, texto) => assert.ok(negado ? !cond : cond, msg ?? texto);
  return {
    toBe: (e) => (negado ? assert.notStrictEqual(real, e, msg) : assert.strictEqual(real, e, msg)),
    toEqual: (e) => (negado ? assert.notDeepStrictEqual(real, e, msg) : assert.deepStrictEqual(real, e, msg)),
    toBeNull: () => ok(real === null, `esperava null, veio ${JSON.stringify(real)}`),
    toBeUndefined: () => ok(real === undefined, `esperava undefined, veio ${JSON.stringify(real)}`),
    toBeLessThan: (n) => ok(real < n, `esperava < ${n}, veio ${real}`),
    toBeGreaterThan: (n) => ok(real > n, `esperava > ${n}, veio ${real}`),
    toHaveLength: (n) => ok(real.length === n, `esperava tamanho ${n}, veio ${real.length}`),
    toMatch: (re) => ok(typeof re === "string" ? String(real).includes(re) : re.test(String(real)), `${JSON.stringify(real)} não casa ${re}`),
    toContain: (x) => ok(real.includes(x), `${JSON.stringify(real)} não contém ${JSON.stringify(x)}`),
    toMatchObject: (e) => parcial(real, e),
    toThrow: (re) => {
      if (negado) return assert.doesNotThrow(real);
      assert.throws(real, re instanceof RegExp ? re : undefined);
      if (re instanceof RegExp) assert.match(String((() => { try { real(); } catch (e) { return e?.message; } })()), re);
    },
  };
}

export function expect(real, msg) {
  const base = de(real, false, msg);
  base.not = de(real, true, msg);
  return base;
}

/** O `it.each` do vitest: um caso por entrada, `%s` trocado pelos argumentos em ordem. */
export function cada(casos, titulo, fn) {
  for (const caso of casos) {
    const args = Array.isArray(caso) ? caso : [caso];
    let i = 0;
    it(titulo.replace(/%s/g, () => String(args[i++])), () => fn(...args));
  }
}
