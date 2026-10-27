// F166: doc × doc — o protocolo não diz que a dona é cobrada "a cada turno" sem limitar a planejamento e design.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const protocolo = readFileSync(join(RAIZ, 'pool', 'protocolo.md'), 'utf8');

test('toda frase com "cobra a cada turno" cita planejamento e design', () => {
  assert.ok(protocolo.length > 0);
  const frases = protocolo.split(/\n/).flatMap((l) => l.split(/(?<=[.;:])\s+/)).filter((f) => /cobra a cada turno/.test(f));
  assert.ok(frases.length >= 1, 'a frase da linha 27 deveria ser achada');
  for (const f of frases) assert.match(f, /planejamento/, `cobrança sem etapa: ${f}`);
  assert.match(protocolo, /em `planejamento` e `design`, onde a dona trabalha, \*\*todo turno\*\*/);
});
