import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// F421: o protocolo e a skill da orquestradora mandam o detalhe por link com âncora
// para a referência. Todo link `arquivo.md#ancora` desses arquivos resolve: o arquivo
// existe e tem `<a id="ancora">`. A âncora interna (`#ancora`) também.
const PLUGIN = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ARQUIVOS = [
  'pool/protocolo.md',
  'pool/referencia.md',
  'pool/dona.md',
  'skills/orquestradora/SKILL.md',
  'skills/orquestradora/referencia.md',
].map((r) => join(PLUGIN, r));

const LINK = /\]\(([^)\s]*?)#([A-Za-z0-9_-]+)\)/g;
const ancorasDe = (texto) => new Set([...texto.matchAll(/<a id="([^"]+)"/g)].map((m) => m[1]));

function links() {
  const todos = [];
  for (const arq of ARQUIVOS) {
    const texto = readFileSync(arq, 'utf8');
    for (const m of texto.matchAll(LINK)) {
      const [, alvo, ancora] = m;
      if (/^[a-z]+:/i.test(alvo)) continue; // http(s), mailto
      if (alvo && !alvo.endsWith('.md')) continue;
      todos.push({ origem: arq, destino: alvo ? resolve(dirname(arq), alvo) : arq, ancora });
    }
  }
  return todos;
}

describe('links com âncora do protocolo e da skill da orquestradora', () => {
  it('os arquivos lidos existem', () => {
    for (const arq of ARQUIVOS) assert.ok(existsSync(arq), arq);
  });

  it('acha links para a referência (o teste mede alguma coisa)', () => {
    const l = links();
    assert.ok(l.length > 20, `só ${l.length} links`);
    assert.ok(l.some((x) => x.destino.endsWith(join('pool', 'referencia.md'))));
    assert.ok(l.some((x) => x.destino.endsWith(join('orquestradora', 'referencia.md'))));
  });

  it('a checagem pega âncora que não existe', () => {
    assert.equal(ancorasDe('<a id="tem"></a>').has('nao-tem'), false);
    assert.equal(ancorasDe('<a id="tem"></a>').has('tem'), true);
  });

  it('todo link resolve para um arquivo com a âncora', () => {
    const cache = new Map();
    const quebrados = [];
    for (const { origem, destino, ancora } of links()) {
      if (!existsSync(destino)) { quebrados.push(`${origem} → ${destino} (arquivo não existe)`); continue; }
      if (!cache.has(destino)) cache.set(destino, ancorasDe(readFileSync(destino, 'utf8')));
      if (!cache.get(destino).has(ancora)) quebrados.push(`${origem} → ${destino}#${ancora}`);
    }
    assert.deepEqual(quebrados, []);
  });
});
