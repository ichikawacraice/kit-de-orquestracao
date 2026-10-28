// F51 T4: o manual da dona e a skill orquestradora apontam para a âncora `perguntas-proprias`, e ela existe no protocolo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PLUGIN = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const POOL = join(PLUGIN, 'pool');

test('a âncora perguntas-proprias existe no protocolo, antes de "Nunca travar"', () => {
  const t = readFileSync(join(POOL, 'protocolo.md'), 'utf8');
  const ancora = t.indexOf('<a id="perguntas-proprias"></a>');
  assert.ok(ancora >= 0, 'falta a âncora');
  assert.ok(ancora < t.indexOf('## Nunca travar'), 'a seção vem antes de "Nunca travar"');
});

test('o manual da dona e a skill orquestradora apontam para a âncora', () => {
  const dona = readFileSync(join(POOL, 'dona.md'), 'utf8');
  assert.ok(dona.length > 0);
  assert.match(dona, /\[protocolo\]\(protocolo\.md#perguntas-proprias\)/, 'dona.md não aponta para a âncora');
  const skill = readFileSync(join(PLUGIN, 'skills', 'orquestradora', 'SKILL.md'), 'utf8');
  assert.ok(skill.length > 0);
  assert.match(skill, /^4\. As perguntas que você abriu antes da limpeza continuam suas/m);
});

// F147: o prompt que a skill descreve é o que o botão da barra manda (doc × código), e a skill não ensina mais a pedir.
test('a seção "Orçamento de contexto" da skill descreve o botão de limpar e o prompt dela é o que o mod manda', () => {
  const skill = readFileSync(join(PLUGIN, 'skills', 'orquestradora', 'SKILL.md'), 'utf8');
  const secao = skill.slice(skill.indexOf('## Orçamento de contexto'));
  assert.ok(secao.length > 100, 'seção ausente');
  for (const t of ['↺ Limpar', 'limpeza/<local_…>.json', 'clear_session "self"']) assert.ok(secao.includes(t), `a seção não cita ${t}`);
  const mod = readFileSync(join(PLUGIN, '..', 'painel-sessoes', 'hooks', 'barra.tsx'), 'utf8');
  const prompt = mod.match(/PROMPT_DE_LIMPAR = '([^']+)'/)?.[1];
  assert.ok(prompt, 'o mod não traz o PROMPT_DE_LIMPAR');
  assert.ok(secao.includes(prompt), `a skill não traz o prompt do botão: ${prompt}`);
  assert.doesNotMatch(secao, /abre a janela \(`AskUserQuestion`\)/, 'a skill ainda manda abrir a janela');
  assert.doesNotMatch(secao, /grava o estado, abre a pergunta/, 'a skill ainda manda abrir a pergunta');
});

// F213: o rótulo do cache frio e o aviso da queda que a skill cita são os do mod (doc × código).
test('a skill descreve a limpeza direta do cache frio com o rótulo e o aviso que o mod mostra', () => {
  const skill = readFileSync(join(PLUGIN, 'skills', 'orquestradora', 'SKILL.md'), 'utf8');
  const secao = skill.slice(skill.indexOf('## Orçamento de contexto'));
  assert.ok(secao.length > 100, 'seção ausente');
  const barra = readFileSync(join(PLUGIN, '..', 'painel-sessoes', 'hooks', 'barra.tsx'), 'utf8');
  const rotulo = barra.match(/direto \? '([^']+)'/)?.[1];
  assert.ok(rotulo, 'o mod não traz o rótulo do cache frio');
  assert.ok(secao.includes(`↺ ${rotulo}`), `a skill não cita ↺ ${rotulo}`);
  const register = readFileSync(join(PLUGIN, '..', 'painel-sessoes', 'hooks', 'register.tsx'), 'utf8');
  const aviso = register.match(/`(A limpeza direta não pegou) \(\$\{motivo\}\)(; pedi à sessão que se limpe\.)`/);
  assert.ok(aviso, 'o mod não traz o aviso da queda');
  assert.ok(secao.includes(`${aviso[1]} (…)${aviso[2]}`), 'a skill não traz o aviso da queda');
});
