// F59 · doc × código: a âncora da skill existe e o hook, o pane, a skill `ausente` e o script a citam.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const PLUGINS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const ler = (...p) => readFileSync(join(PLUGINS, ...p), 'utf8');
const ANCORA = 'resumo-da-ausencia';

test('a skill orquestradora tem a âncora e quem cobra o resumo cita a mesma seção', () => {
  const skill = ler('orquestracao', 'skills', 'orquestradora', 'SKILL.md');
  assert.ok(skill.includes(`<a id="${ANCORA}"></a>`), 'sem a âncora na skill');
  assert.ok(skill.includes('ausencia.mjs'), 'a seção não cita o script');
  for (const [nome, texto] of [
    ['hook ritual', ler('orquestracao', 'hooks', 'orquestradora-ritual.mjs')],
    ['skill ausente', ler('orquestracao', 'skills', 'ausente', 'SKILL.md')],
    ['pane do painel', ler('painel-sessoes', 'hooks', 'register.tsx')],
  ]) assert.ok(texto.includes(ANCORA), `${nome} não cita ${ANCORA}`);
});
test('o off não é mais descrito como "apaga" em protocolo e skill ausente', () => {
  for (const f of [['orquestracao', 'pool', 'protocolo.md'], ['orquestracao', 'skills', 'ausente', 'SKILL.md']]) {
    assert.ok(!/(apaga|apagada)[^.\n]{0,30}`?\/ausente off/.test(ler(...f)), `${f.join('/')} ainda diz que o off apaga`);
  }
});
