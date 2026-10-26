// F58: doc × código — o protocolo cita o `ESPERA_MIN` do ritual com o mesmo padrão do código, e a regra aparece nos três textos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ler = (...p) => readFileSync(join(RAIZ, ...p), 'utf8');

test('o padrão do ESPERA_MIN no código é lido e o protocolo cita o mesmo número', () => {
  const m = ler('hooks', 'orquestradora-ritual.mjs').match(/Number\.isInteger\(n\) && n > 0 \? n : (\d+)/);
  assert.ok(m, 'padrão do ESPERA_MIN não achado no ritual');
  const protocolo = ler('pool', 'protocolo.md');
  assert.ok(protocolo.length > 0);
  assert.ok(protocolo.includes('<a id="esperando-papel"></a>'), 'sem a âncora esperando-papel');
  assert.match(protocolo, new RegExp(`\`ESPERA_MIN\` \\(padrão ${m[1]}\\)`));
});

test('a skill da orquestradora e a planejadora citam a trava nova', () => {
  const skill = ler('skills', 'orquestradora', 'SKILL.md');
  const plan = ler('pool', 'papeis', 'planejadora.md');
  assert.ok(skill.length > 0 && plan.length > 0);
  assert.match(skill, /esperando-papel/);
  assert.match(plan, /esperando-papel/);
});

test('F69: a âncora esperando-papel lista planejamento (P) e a vaga-pelo-painel existe na skill e no protocolo', () => {
  const protocolo = ler('pool', 'protocolo.md');
  const skill = ler('skills', 'orquestradora', 'SKILL.md');
  assert.ok(protocolo.length > 0 && skill.length > 0);
  const ancora = protocolo.split('\n').find((l) => l.includes('**Item esperando papel (F58).**'));
  assert.ok(ancora, 'parágrafo do esperando-papel não achado');
  assert.match(ancora, /`planejamento`, `design`, `execucao` ou `validacao`/);
  assert.ok(skill.includes('<a id="vaga-pelo-painel"></a>'), 'skill sem a âncora vaga-pelo-painel');
  assert.match(skill, /Pedido do operador pelo painel/);
  assert.match(protocolo, /skills\/orquestradora\/SKILL\.md#vaga-pelo-painel|orquestradora#vaga-pelo-painel|\(#vaga-pelo-painel\)/);
});
