// F51 T4: os cinco papéis e a skill orquestradora apontam para a âncora `perguntas-proprias`, e ela existe no protocolo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PLUGIN = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const POOL = join(PLUGIN, 'pool');

test('a âncora perguntas-proprias existe no protocolo, antes de "Nunca travar"', () => {
  const t = readFileSync(join(POOL, 'protocolo.md'), 'utf8');
  const ancora = t.indexOf('<a id="perguntas-proprias"></a>');
  assert.ok(ancora >= 0, 'falta a âncora');
  assert.ok(ancora < t.indexOf('## Nunca travar'), 'a seção vem antes de "Nunca travar"');
});

test('cada papel e a skill orquestradora apontam para a âncora', () => {
  const papeis = readdirSync(join(POOL, 'papeis')).filter((f) => f.endsWith('.md'));
  assert.equal(papeis.length, 5, `esperava 5 papéis, veio ${papeis}`);
  for (const f of papeis) {
    const linha3 = readFileSync(join(POOL, 'papeis', f), 'utf8').split('\n')[2];
    assert.match(linha3, /\[protocolo\]\(\.\.\/protocolo\.md#perguntas-proprias\)/, `${f}: a linha 3 não aponta para a âncora`);
  }
  const skill = readFileSync(join(PLUGIN, 'skills', 'orquestradora', 'SKILL.md'), 'utf8');
  assert.ok(skill.length > 0);
  assert.match(skill, /^4\. As perguntas que você abriu antes da limpeza continuam suas/m);
});

// F53: o formato da janela escrito na skill é o que o código reconhece.
test('a seção "Orçamento de contexto" da skill descreve a janela de limpeza e o exemplo dela casa com ehPerguntaDeLimpeza', async () => {
  const skill = readFileSync(join(PLUGIN, 'skills', 'orquestradora', 'SKILL.md'), 'utf8');
  const secao = skill.slice(skill.indexOf('## Orçamento de contexto'));
  assert.ok(secao.length > 100, 'seção ausente');
  for (const t of ['limpar · orquestradora', 'Sim, pode limpar', 'AskUserQuestion']) assert.ok(secao.includes(t), `a seção não cita ${t}`);
  const exemplo = secao.match(/`question` = `([^`]+)`/)?.[1];
  assert.ok(exemplo, 'a skill não traz o exemplo de `question`');
  const { ehPerguntaDeLimpeza } = await import(pathToFileURL(join(PLUGIN, 'hooks', 'pool-comum.mjs')).href);
  assert.equal(ehPerguntaDeLimpeza(exemplo), true, `o exemplo da skill não casa: ${exemplo}`);
  assert.equal(ehPerguntaDeLimpeza(exemplo.replace('orquestradora', 'orquestradora-velha')), false, 'contraste: título parecido não casa');
});
