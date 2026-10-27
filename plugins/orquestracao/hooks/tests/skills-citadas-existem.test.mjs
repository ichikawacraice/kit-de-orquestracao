// Toda skill ou agente dos plugins do kit citado no protocolo, no manual da dona e em `skills-por-etapa.json` existe;
// e toda skill da tabela de skills por etapa do protocolo está no mapa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const PLUGINS = join(AQUI, '..', '..', '..');
const POOL = join(PLUGINS, 'orquestracao', 'pool');
const MAPA = JSON.parse(readFileSync(join(POOL, 'skills-por-etapa.json'), 'utf8'));
const DO_KIT = readdirSync(PLUGINS, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);

// `plugin:nome` para cada skill e agente que os plugins do kit entregam.
function entregues() {
  const r = new Set();
  for (const p of DO_KIT) {
    const skills = join(PLUGINS, p, 'skills');
    if (existsSync(skills)) for (const s of readdirSync(skills, { withFileTypes: true })) if (s.isDirectory()) r.add(`${p}:${s.name}`);
    const agentes = join(PLUGINS, p, 'agents');
    if (existsSync(agentes)) for (const a of readdirSync(agentes)) if (a.endsWith('.md')) r.add(`${p}:${a.slice(0, -3)}`);
  }
  return r;
}

// Citação = todo `plugin:nome` entre crases cujo plugin é do kit.
const citacoes = (texto) => [...texto.matchAll(/`([a-z0-9-]+):([a-z0-9-]+)`/g)].filter((m) => DO_KIT.includes(m[1])).map((m) => `${m[1]}:${m[2]}`);
const doMapa = Object.values(MAPA.etapas).flat();

test('o protocolo, a dona e o mapa citam só skills e agentes do kit que existem (insumos não vazios)', () => {
  const dados = entregues();
  assert.ok(dados.has('processos:spec-driven') && dados.has('design:critico-de-ui') && dados.has('orquestracao:validador'), `plugins do kit não lidos: ${[...dados]}`);
  const textos = {
    protocolo: readFileSync(join(POOL, 'protocolo.md'), 'utf8'),
    dona: readFileSync(join(POOL, 'dona.md'), 'utf8'),
    mapa: doMapa.map((s) => `\`${s}\``).join(' '),
  };
  let total = 0;
  const inventadas = [];
  for (const [nome, t] of Object.entries(textos)) {
    const cit = citacoes(t);
    total += cit.length;
    for (const c of cit) if (!dados.has(c)) inventadas.push(`${nome}: ${c}`);
  }
  assert.ok(total > 10, `poucas citações medidas: ${total}`);
  assert.deepEqual(inventadas, [], `citação sem skill correspondente:\n${inventadas.join('\n')}`);
  // skill do kit citada sem prefixo no mapa também existe
  for (const s of ['handoff-de-sessao', 'papeis-e-modelos']) {
    assert.ok(doMapa.includes(s), `${s} saiu do mapa`);
    assert.ok(dados.has(`orquestracao:${s}`), `${s} não existe no kit`);
  }
});

test('o detector pega citação inventada', () => {
  const t = 'roda o `design:skill-no-meio` em subagente e depois `processos:spec-driven` e `superpowers:x`.';
  assert.deepEqual(citacoes(t), ['design:skill-no-meio', 'processos:spec-driven'], 'só plugin do kit conta');
  assert.equal(entregues().has('design:skill-no-meio'), false, 'a inventada tem de ser reprovada');
});

test('toda skill da tabela de skills por etapa do protocolo está no mapa da etapa', () => {
  const protocolo = readFileSync(join(POOL, 'protocolo.md'), 'utf8');
  const secao = protocolo.slice(protocolo.indexOf('<a id="skills-da-etapa"></a>'), protocolo.indexOf('<a id="modelo-e-esforco"></a>'));
  assert.ok(secao.length > 200, 'seção ausente');
  let total = 0;
  for (const [etapa, lista] of Object.entries(MAPA.etapas)) {
    const linha = secao.split('\n').find((l) => l.startsWith(`| \`${etapa}\``));
    assert.ok(linha, `sem linha para ${etapa}`);
    const nomes = [...linha.split('|').slice(2).join('|').replace(/\([^)]*\)/g, '').matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    total += nomes.length;
    for (const n of nomes) assert.ok(lista.includes(n), `${etapa}: ${n} está na tabela e não no mapa`);
  }
  assert.ok(total >= 8, `poucas skills na tabela: ${total}`);
});
