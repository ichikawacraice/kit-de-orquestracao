// K15: toda skill (ou agente) citada nos papéis do pool existe em plugins/*/skills, plugins/*/agents ou no mapa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const PLUGINS = join(AQUI, '..', '..', '..');
const POOL = join(PLUGINS, 'orquestracao', 'pool');
const PAPEIS = process.env.PAPEIS_DIR || join(POOL, 'papeis');
const MAPA = JSON.parse(readFileSync(join(POOL, 'skills-por-papel.json'), 'utf8'));

// `plugin:nome` para cada skill e agente que os plugins do kit entregam.
function entregues() {
  const r = new Set();
  for (const p of readdirSync(PLUGINS, { withFileTypes: true })) {
    if (!p.isDirectory()) continue;
    const skills = join(PLUGINS, p.name, 'skills');
    if (existsSync(skills)) for (const s of readdirSync(skills, { withFileTypes: true })) if (s.isDirectory()) r.add(`${p.name}:${s.name}`);
    const agentes = join(PLUGINS, p.name, 'agents');
    if (existsSync(agentes)) for (const a of readdirSync(agentes)) if (a.endsWith('.md')) r.add(`${p.name}:${a.slice(0, -3)}`);
  }
  return r;
}

// Citação = os nomes entre crases que abrem um item de lista ("- `a`, `b`: …").
function citacoes(texto) {
  const r = [];
  for (const linha of texto.split('\n')) {
    const m = linha.match(/^\s*- ((?:`[^`]+`[,\s]*(?:e\s+)?)+)/);
    if (m) for (const c of m[1].matchAll(/`([^`]+)`/g)) r.push(c[1]);
  }
  return r;
}

const existe = (nome, dados) => dados.has(nome) || nome in MAPA.skills || nome in (MAPA.apelidos ?? {});

test('os papéis citam skills que existem, e o insumo não está vazio', () => {
  const dados = entregues();
  assert.ok(dados.has('processos:spec-driven') && dados.has('design:critico-de-ui'), `plugins do kit não lidos: ${[...dados]}`);
  const papeis = readdirSync(PAPEIS).filter((f) => f.endsWith('.md'));
  assert.ok(papeis.length >= 5, `papéis lidos: ${papeis}`);
  let total = 0;
  const inventadas = [];
  for (const f of papeis) {
    const cit = citacoes(readFileSync(join(PAPEIS, f), 'utf8'));
    total += cit.length;
    for (const c of cit) if (!existe(c, dados)) inventadas.push(`${f}: ${c}`);
  }
  assert.ok(total > 30, `poucas citações medidas: ${total}`);
  assert.deepEqual(inventadas, [], `citação sem skill correspondente:\n${inventadas.join('\n')}`);
});

test('o detector pega citação inventada', () => {
  const t = '- `design:skill-inventada`, `processos:spec-driven`: x';
  assert.deepEqual(citacoes(t), ['design:skill-inventada', 'processos:spec-driven']);
  assert.equal(existe('design:skill-inventada', entregues()), false);
  assert.equal(existe('processos:spec-driven', entregues()), true);
});

test('toda skill dos plugins do kit (fora o painel) tem linha no mapa com o nome prefixado', () => {
  const skills = [...entregues()].filter((n) => {
    const [plugin, nome] = n.split(':');
    return plugin !== 'painel-sessoes' && existsSync(join(PLUGINS, plugin, 'skills', nome));
  });
  assert.ok(skills.length >= 10, `skills lidas: ${skills}`);
  assert.deepEqual(skills.filter((n) => !(n in MAPA.skills) && !(n in MAPA.apelidos) && !Object.values(MAPA.apelidos).includes(n.split(':')[1])), []);
});

test('o mapa lista os plugins processos e design com as colunas do plano', () => {
  const p = MAPA.plugins;
  assert.deepEqual(Object.values(p['processos@kit-de-orquestracao']), [true, true, true, true, true]);
  assert.deepEqual(p['design@kit-de-orquestracao'], { O: false, P: false, D: true, E: true, V: false });
});
