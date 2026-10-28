#!/usr/bin/env node
// F54: doc × código — os limites de contexto do hook `contexto-do-papel.mjs` e os números que a skill `papeis-e-modelos`
// e o frontmatter dos agentes citam têm de concordar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ler = (...p) => readFileSync(join(RAIZ, ...p), 'utf8');
const hook = ler('hooks', 'contexto-do-papel.mjs');
const limite = (nome) => { const m = hook.match(new RegExp(`limite\\('${nome}', ([\\d_]+)\\)`)); assert.ok(m, `constante ${nome} não achada no hook`); return Number(m[1].replace(/_/g, '')); };
const mil = (n) => `${n / 1000} mil`;

test('F54.d1 as constantes do hook são lidas e não vazias', () => {
  const v = { ESPERA: limite('ESPERA'), ALTO: limite('ALTO'), TETO: limite('TETO'), PEDIR: limite('PEDIR') };
  assert.deepEqual(v, { ESPERA: 250_000, ALTO: 350_000, TETO: 500_000, PEDIR: 250_000 });
});
test('F54.d2 papeis-e-modelos cita os limites do hook', () => {
  const skill = ler('skills', 'papeis-e-modelos', 'SKILL.md');
  assert.ok(skill.length > 0, 'skill vazia');
  for (const nome of ['ESPERA', 'ALTO', 'TETO']) assert.ok(skill.includes(`**≥ ${mil(limite(nome))}`), `skill sem "≥ ${mil(limite(nome))}" (${nome})`);
  assert.ok(skill.includes(`a partir de ${mil(limite('PEDIR'))}`), 'skill sem o destaque do botão de limpar');
  assert.ok(skill.includes('**600 mil**'), 'skill sem o global de 600 mil');
});
test('F219 a skill orquestradora cita o destaque do botão de limpar na régua do hook', () => {
  const skill = ler('skills', 'orquestradora', 'SKILL.md');
  assert.ok(skill.length > 0, 'skill vazia');
  assert.ok(skill.includes(`\`· limpar\` a partir de ${mil(limite('PEDIR'))}`), `skill sem "· limpar a partir de ${mil(limite('PEDIR'))}"`);
  assert.ok(!/a partir de 150 mil/.test(skill), 'skill ainda cita a régua velha de 150 mil');
});
test('F54.d3 o frontmatter dos agentes tem 400000 / 200000 e a skill diz o mesmo', () => {
  const esperado = { validador: 400000, explorador: 200000 };
  for (const [ag, n] of Object.entries(esperado)) {
    const t = ler('agents', `${ag}.md`);
    assert.ok(t.length > 0, `${ag}.md vazio`);
    assert.match(t, new RegExp(`^autoCompactWindow: ${n}$`, 'm'), `${ag}.md sem autoCompactWindow: ${n}`);
  }
  const skill = ler('skills', 'papeis-e-modelos', 'SKILL.md');
  assert.ok(skill.includes('validador **400 mil**, explorador **200 mil**'));
});
