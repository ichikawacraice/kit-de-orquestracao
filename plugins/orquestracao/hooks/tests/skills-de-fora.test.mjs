#!/usr/bin/env node
// F333 (ADR 0014): a trava recusa a skill de fora que duplica o kit, só em projeto que usa o kit, e o catálogo concorda com
// o plugin.json (dependências), o marketplace.json e o README.
// Rodar: node --test hooks/tests/skills-de-fora.test.mjs   (HOME e a pasta do log apontam para diretório temporário)
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATALOGO, decidir, lerCatalogo, liberadasDo, nomeCompleto, saidaDe, skillsProprias, substitutasDo, usaOKit } from '../skills-de-fora.mjs';

const HOOKS = join(dirname(fileURLToPath(import.meta.url)), '..');
const PLUGIN = join(HOOKS, '..');
const RAIZ = join(PLUGIN, '..', '..');
const catalogo = lerCatalogo();

function projeto({ kitJson, claude } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'skills-de-fora-'));
  mkdirSync(join(dir, '.git'));
  if (kitJson !== undefined) { mkdirSync(join(dir, '.claude'), { recursive: true }); writeFileSync(join(dir, '.claude', 'kit.json'), JSON.stringify(kitJson)); }
  if (claude !== undefined) writeFileSync(join(dir, 'CLAUDE.md'), claude);
  mkdirSync(join(dir, 'apps', 'web'), { recursive: true });
  return dir;
}

function rodar(entrada) {
  const home = mkdtempSync(join(tmpdir(), 'skills-de-fora-home-'));
  try {
    const r = spawnSync('node', [join(HOOKS, 'skills-de-fora.mjs')], {
      input: JSON.stringify(entrada), encoding: 'utf8', timeout: 15000, killSignal: 'SIGKILL',
      env: { ...process.env, HOME: home, HOOKS_CREWAI_BASE: home, PAINEL_DIR: home },
    });
    const log = existsSync(join(home, 'hooks-crewai.log')) ? readFileSync(join(home, 'hooks-crewai.log'), 'utf8') : '';
    return { ...r, log };
  } finally { rmSync(home, { recursive: true, force: true }); }
}

test('o catálogo existe, tem plugins e skills, e toda saída é uma das quatro', () => {
  assert.ok(catalogo.plugins.length > 0 && catalogo.skills.length > 0, 'catálogo vazio');
  for (const x of [...catalogo.plugins, ...catalogo.skills]) {
    assert.ok(['depender', 'barrar', 'absorver', 'livre'].includes(x.saida), `saída inválida: ${JSON.stringify(x)}`);
    assert.ok(typeof x.motivo === 'string' && x.motivo.length > 10, `sem motivo: ${x.plugin ?? x.skill}`);
  }
  for (const s of catalogo.skills.filter((x) => ['barrar', 'absorver'].includes(x.saida))) assert.ok(s.use, `${s.skill} sem "use"`);
  for (const p of catalogo.plugins.filter((x) => x.saida === 'depender')) assert.ok(p.marketplace && p.repositorioDoMarketplace, `${p.plugin} sem marketplace ou repositorioDoMarketplace`);
});

test('saidaDe: a skill com linha própria vence, a sem linha herda do plugin, a de plugin desconhecido é livre', () => {
  assert.equal(saidaDe('engineering:architecture', catalogo).saida, 'barrar');
  assert.equal(saidaDe('engineering:standup', catalogo).saida, 'livre');
  assert.equal(saidaDe('superpowers:writing-plans', catalogo).saida, 'depender');
  assert.equal(saidaDe('fulano:qualquer', catalogo).saida, 'livre');
  assert.equal(saidaDe('/engineering:architecture', catalogo).saida, 'barrar', 'a barra do comando digitado não muda a saída');
});

test('decidir: barrar recusa com a peça do kit; absorver só recusa quando feito; livre e depender passam', () => {
  const motivo = decidir('engineering:architecture', { catalogo });
  assert.ok(typeof motivo === 'string' && motivo.includes('processos:spec-driven'), `sem a peça do kit: ${motivo}`);
  assert.ok(motivo.includes('skillsDeFora.liberar'), 'a recusa diz como liberar');
  assert.equal(decidir('engineering:standup', { catalogo }), null);
  assert.equal(decidir('superpowers:writing-plans', { catalogo }), null);
  const abs = catalogo.skills.find((s) => s.saida === 'absorver');
  assert.ok(abs, 'o catálogo tem ao menos uma absorção para o teste medir');
  assert.equal(decidir(abs.skill, { catalogo }), null, 'absorção não feita fica livre');
  const feito = { ...catalogo, skills: catalogo.skills.map((s) => (s === abs ? { ...s, feito: true } : s)) };
  assert.ok(decidir(abs.skill, { catalogo: feito }), 'absorção feita é barrada como duplicata');
});

test('sem o prefixo do plugin: o nome curto único casa com a linha; o homônimo marcado semPrefixo: false não', () => {
  assert.equal(nomeCompleto('architecture', catalogo), 'engineering:architecture');
  assert.ok(decidir('architecture', { catalogo })?.includes('processos:spec-driven'), 'architecture sem prefixo escapou');
  assert.ok(decidir('/design-critique', { catalogo }), 'design-critique sem prefixo escapou');
  const cr = catalogo.skills.find((s) => s.skill === 'engineering:code-review');
  assert.equal(cr?.semPrefixo, false, 'code-review tem homônimo no Claude Code');
  assert.equal(decidir('code-review', { catalogo }), null, 'o /code-review do Claude Code não pode ser barrado');
  assert.equal(decidir('standup', { catalogo }), null);
  assert.equal(decidir('architecture', { catalogo, liberar: ['engineering:architecture'] }), null, 'liberar pelo nome completo vale para o curto');
});

test('o nome curto que é a substituta declarada, o curto dela ou uma skill própria não é barrado; o completo da original segue barrado', () => {
  const subs = { 'design:ux-copy': 'ds:ux-copy', 'design:accessibility-review': 'accessibility-review' };
  assert.equal(decidir('ux-copy', { catalogo, substitutas: subs }), null, 'a substituta pelo nome curto foi recusada');
  assert.equal(decidir('accessibility-review', { catalogo, substitutas: subs }), null, 'substituta sem prefixo virou beco sem saída');
  assert.ok(decidir('design:ux-copy', { catalogo, substitutas: subs }), 'a original pelo nome completo devia seguir barrada');
  assert.equal(decidir('architecture', { catalogo, proprias: ['architecture'] }), null, 'skill própria do projeto foi barrada');
  assert.ok(decidir('engineering:architecture', { catalogo, proprias: ['architecture'] }));
  assert.equal(decidir('engineering:architecture', { catalogo, liberar: ['architecture'] }), null, 'liberar pelo nome curto vale para o completo');
});

test('skillsProprias: as pastas de .claude/skills do projeto (até a raiz do git) e da conta', () => {
  const p = projeto({ kitJson: {} });
  const home = mkdtempSync(join(tmpdir(), 'skills-de-fora-home-'));
  try {
    mkdirSync(join(p, '.claude', 'skills', 'architecture'), { recursive: true });
    mkdirSync(join(home, '.claude', 'skills', 'minha'), { recursive: true });
    assert.deepEqual(skillsProprias(join(p, 'apps', 'web'), home).sort(), ['architecture', 'minha']);
    assert.deepEqual(skillsProprias('', ''), []);
  } finally { rmSync(p, { recursive: true, force: true }); rmSync(home, { recursive: true, force: true }); }
});

test('hook: Skill sem o prefixo do plugin também é recusada', () => {
  const p = projeto({ kitJson: {} });
  try {
    const r = rodar({ session_id: 's', hook_event_name: 'PreToolUse', cwd: p, tool_name: 'Skill', tool_input: { skill: 'architecture' } });
    assert.equal(JSON.parse(r.stdout).hookSpecificOutput.permissionDecision, 'deny');
  } finally { rmSync(p, { recursive: true, force: true }); }
});

test('decidir: o projeto libera uma skill pela lista do kit.json', () => {
  assert.equal(decidir('engineering:architecture', { catalogo, liberar: ['engineering:architecture'] }), null);
  assert.ok(decidir('engineering:code-review', { catalogo, liberar: ['engineering:architecture'] }));
});

test('decidir: a absorção não feita vale no projeto que declara a substituta, e a recusa aponta a substituta', () => {
  const abs = catalogo.skills.find((s) => s.saida === 'absorver' && s.feito !== true);
  assert.ok(abs, 'o catálogo tem absorção não feita para o teste medir');
  assert.equal(decidir(abs.skill, { catalogo, substitutas: {} }), null);
  const motivo = decidir(abs.skill, { catalogo, substitutas: { [abs.skill]: 'ds:acessibilidade' } });
  assert.ok(motivo && motivo.includes('use ds:acessibilidade'), `sem a substituta: ${motivo}`);
  assert.equal(decidir(abs.skill, { catalogo, substitutas: { [abs.skill]: '  ' } }), null, 'substituta vazia não conta');
  assert.equal(decidir('engineering:standup', { catalogo, substitutas: { 'engineering:standup': 'x:y' } }), null, 'substituta só vale para absorver');
});

test('substitutasDo: só os pares de texto; sem a seção, {}', () => {
  const p = projeto({ kitJson: { skillsDeFora: { substitutas: { 'design:ux-copy': 'ds:textos', ruim: 3 } } } });
  try {
    assert.deepEqual(substitutasDo(join(p, 'apps', 'web')), { 'design:ux-copy': 'ds:textos' });
    writeFileSync(join(p, '.claude', 'kit.json'), JSON.stringify({ skillsDeFora: { substitutas: ['x'] } }));
    assert.deepEqual(substitutasDo(p), {});
  } finally { rmSync(p, { recursive: true, force: true }); }
});

test('usaOKit: kit.json ou bloco kit: no CLAUDE.md, subindo da subpasta até a raiz do git; senão não', () => {
  const comKit = projeto({ kitJson: {} });
  const comBloco = projeto({ claude: '# x\n<!-- kit:projeto v1 -->\noi\n<!-- /kit:projeto -->\n' });
  const sem = projeto({ claude: '# projeto sem kit\n' });
  try {
    assert.equal(usaOKit(join(comKit, 'apps', 'web')), true);
    assert.equal(usaOKit(join(comBloco, 'apps', 'web')), true);
    assert.equal(usaOKit(join(sem, 'apps', 'web')), false);
    assert.equal(usaOKit(''), false);
  } finally { for (const d of [comKit, comBloco, sem]) rmSync(d, { recursive: true, force: true }); }
});

test('liberadasDo: lê skillsDeFora.liberar do kit.json; kit.json quebrado ou sem a lista dá []', () => {
  const p = projeto({ kitJson: { skillsDeFora: { liberar: ['engineering:debug'] } } });
  const q = projeto({ kitJson: {} });
  try {
    assert.deepEqual(liberadasDo(join(p, 'apps', 'web')), ['engineering:debug']);
    assert.deepEqual(liberadasDo(q), []);
    writeFileSync(join(q, '.claude', 'kit.json'), '{quebrado');
    assert.deepEqual(liberadasDo(q), []);
  } finally { rmSync(p, { recursive: true, force: true }); rmSync(q, { recursive: true, force: true }); }
});

test('hook: Skill barrada em projeto com o kit sai com deny e o motivo, e registra no log', () => {
  const p = projeto({ kitJson: {} });
  try {
    const r = rodar({ session_id: 's', hook_event_name: 'PreToolUse', cwd: p, tool_name: 'Skill', tool_input: { skill: 'engineering:architecture' } });
    assert.equal(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
    assert.match(out.hookSpecificOutput.permissionDecisionReason, /processos:spec-driven/);
    assert.match(r.log, /skills-de-fora\trecusou/);
  } finally { rmSync(p, { recursive: true, force: true }); }
});

test('hook: skill absorvida com substituta declarada no kit.json sai com deny apontando a substituta', () => {
  const p = projeto({ kitJson: { skillsDeFora: { substitutas: { 'design:accessibility-review': 'ds:acessibilidade' } } } });
  try {
    const r = rodar({ session_id: 's', hook_event_name: 'PreToolUse', cwd: join(p, 'apps', 'web'), tool_name: 'Skill', tool_input: { skill: 'design:accessibility-review' } });
    assert.equal(r.status, 0, r.stderr);
    assert.match(JSON.parse(r.stdout).hookSpecificOutput.permissionDecisionReason, /use ds:acessibilidade/);
  } finally { rmSync(p, { recursive: true, force: true }); }
});

test('hook: a mesma skill em projeto sem o kit passa calada', () => {
  const p = projeto({ claude: '# sem kit\n' });
  try {
    const r = rodar({ session_id: 's', hook_event_name: 'PreToolUse', cwd: p, tool_name: 'Skill', tool_input: { skill: 'engineering:architecture' } });
    assert.equal(r.status, 0);
    assert.equal(r.stdout, '');
  } finally { rmSync(p, { recursive: true, force: true }); }
});

test('hook: o /comando digitado (UserPromptExpansion) barrado sai com decision block', () => {
  const p = projeto({ kitJson: {} });
  try {
    const r = rodar({ session_id: 's', hook_event_name: 'UserPromptExpansion', cwd: p, command_name: 'engineering:code-review', command_args: '' });
    assert.equal(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.equal(out.decision, 'block');
    assert.match(out.reason, /orquestracao:validador/);
    const livre = rodar({ session_id: 's', hook_event_name: 'UserPromptExpansion', cwd: p, command_name: 'engineering:standup' });
    assert.equal(livre.stdout, '');
  } finally { rmSync(p, { recursive: true, force: true }); }
});

test('hook: entrada quebrada não derruba a sessão (exit 0, sem saída) e o erro vai ao log', () => {
  const home = mkdtempSync(join(tmpdir(), 'skills-de-fora-home-'));
  try {
    const r = spawnSync('node', [join(HOOKS, 'skills-de-fora.mjs')], { input: '{quebrado', encoding: 'utf8', timeout: 15000, killSignal: 'SIGKILL', env: { ...process.env, HOME: home, HOOKS_CREWAI_BASE: home } });
    assert.equal(r.status, 0);
    assert.equal(r.stdout, '');
    assert.match(readFileSync(join(home, 'hooks-crewai.log'), 'utf8'), /skills-de-fora\terro/);
  } finally { rmSync(home, { recursive: true, force: true }); }
});

test('catálogo × plugin.json × marketplace.json: cada `depender` é dependência do orquestracao, e o marketplace confia na origem dela', () => {
  const manifesto = JSON.parse(readFileSync(join(PLUGIN, '.claude-plugin', 'plugin.json'), 'utf8'));
  const deps = (manifesto.dependencies ?? []).map((d) => (typeof d === 'string' ? d : `${d.name}@${d.marketplace}`));
  const dependentes = catalogo.plugins.filter((p) => p.saida === 'depender').map((p) => `${p.plugin}@${p.marketplace}`);
  assert.ok(dependentes.length > 0, 'o catálogo não tem dependência para o teste medir');
  assert.deepEqual([...deps].sort(), [...dependentes].sort());
  const mk = JSON.parse(readFileSync(join(RAIZ, '.claude-plugin', 'marketplace.json'), 'utf8'));
  for (const p of catalogo.plugins.filter((x) => x.saida === 'depender')) assert.ok((mk.allowCrossMarketplaceDependenciesOn ?? []).includes(p.marketplace), `marketplace.json sem ${p.marketplace} em allowCrossMarketplaceDependenciesOn`);
});

test('catálogo × guia de conflitos: o guia cita cada dependência e cada skill barrada, e o README aponta para ele', () => {
  assert.match(readFileSync(join(RAIZ, 'README.md'), 'utf8'), /docs\/guia\/conflitos\.md/);
  const readme = readFileSync(join(RAIZ, 'docs', 'guia', 'conflitos.md'), 'utf8');
  const citadas = [...catalogo.plugins.filter((p) => p.saida === 'depender').map((p) => p.plugin), ...catalogo.skills.filter((s) => s.saida === 'barrar').map((s) => s.skill)];
  assert.ok(citadas.length > 0);
  for (const c of citadas) assert.ok(readme.includes(`\`${c}\``), `o guia de conflitos não cita \`${c}\``);
});

test('o caminho do catálogo é o do plugin', () => {
  assert.equal(CATALOGO, join(PLUGIN, 'skills-de-fora.json'));
});
