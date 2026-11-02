#!/usr/bin/env node
// PreToolUse em `Skill` e UserPromptExpansion (F333, ADR 0014): a skill de fora que duplica uma peça do kit (`barrar` no
// catálogo, ou `absorver` já feita) é recusada com a peça certa, só em projeto que usa o kit (`.claude/kit.json` ou bloco
// `<!-- kit:` no CLAUDE.md, da pasta da sessão até a raiz do git). O projeto libera uma skill em `skillsDeFora.liberar` e
// declara em `skillsDeFora.substitutas` a peça dele que absorveu uma skill de fora (aí a absorção vale e a original é barrada).
// Um plugin ligado no projeto (ex.: o do design system) declara as dele em `substitutas.json` na raiz do plugin (F340): valem
// em todo projeto onde ele está ligado, só para skill `absorver` do catálogo e só com substituta do próprio plugin; o
// kit.json do projeto vence o plugin, e `liberar` vence os dois.
// O `/nome` digitado não passa pelo PreToolUse (doc do Claude Code): o UserPromptExpansion cobre esse caminho.
// Erro do próprio hook vai para o log e DEIXA PASSAR: a trava não pode derrubar as sessões.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registrar, lerEntrada } from './hooks-crewai-comum.mjs';

const HOOK = 'skills-de-fora';
export const CATALOGO = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills-de-fora.json');

export const lerCatalogo = (caminho = CATALOGO) => JSON.parse(readFileSync(caminho, 'utf8'));

const nomeLimpo = (nome) => String(nome ?? '').trim().replace(/^\//, '');

/**
 * O nome completo no catálogo de uma skill chamada sem o prefixo do plugin (o Claude Code aceita `architecture` por
 * `engineering:architecture`): a linha cujo nome curto é ele, se for uma só e não tiver `semPrefixo: false`.
 */
export function nomeCompleto(nome, catalogo) {
  const skill = nomeLimpo(nome);
  if (!skill || skill.includes(':')) return skill;
  const achadas = (catalogo.skills ?? []).filter((s) => s.skill.slice(s.skill.indexOf(':') + 1) === skill);
  return achadas.length === 1 && achadas[0].semPrefixo !== false ? achadas[0].skill : skill;
}

/** A linha do catálogo que vale para a skill: a dela, senão a do plugin, senão livre. */
export function saidaDe(nome, catalogo) {
  const skill = nomeCompleto(nome, catalogo);
  const propria = catalogo.skills?.find((s) => s.skill === skill);
  if (propria) return propria;
  const plugin = skill.includes(':') ? skill.slice(0, skill.indexOf(':')) : '';
  return catalogo.plugins?.find((p) => p.plugin === plugin) ?? { saida: 'livre' };
}

const curto = (nome) => nomeLimpo(nome).slice(nomeLimpo(nome).indexOf(':') + 1);

/** O motivo da recusa, ou null quando passa. */
// `substitutas` (do kit.json): skill absorvida → a peça que o projeto tem no lugar dela; com ela, a absorção vale aqui.
// `proprias`: nomes de skill do próprio projeto ou da conta (`.claude/skills/<nome>`); o nome curto delas não se expande.
export function decidir(nome, { catalogo, liberar = [], substitutas = {}, proprias = [] }) {
  const limpo = nomeLimpo(nome);
  if (!limpo) return null;
  // o nome curto que é uma substituta declarada (ou o curto dela) ou uma skill própria é ela mesma, não a de fora
  const deCasa = !limpo.includes(':') && (proprias.includes(limpo) || Object.values(substitutas).some((v) => typeof v === 'string' && (v.trim() === limpo || curto(v.trim()) === limpo)));
  if (deCasa) return null;
  const skill = nomeCompleto(limpo, catalogo);
  if (liberar.some((l) => nomeCompleto(l, catalogo) === skill)) return null;
  const linha = saidaDe(skill, catalogo);
  const substituta = linha.saida === 'absorver' && typeof substitutas[skill] === 'string' && substitutas[skill].trim() ? substitutas[skill].trim() : null;
  const barrada = linha.saida === 'barrar' || (linha.saida === 'absorver' && (linha.feito === true || substituta));
  if (!barrada) return null;
  return `o kit barra ${skill} neste projeto: use ${substituta ?? linha.use}. Motivo: ${linha.motivo} `
    + `Para liberar só aqui, ponha "${skill}" em skillsDeFora.liberar do .claude/kit.json.`;
}

/** As pastas da sessão até a raiz do git (inclusive), a mais próxima primeiro. */
function pastasAteARaiz(cwd) {
  const pastas = [];
  let d = resolve(cwd);
  for (;;) {
    pastas.push(d);
    if (existsSync(join(d, '.git'))) return pastas;
    const pai = dirname(d);
    if (pai === d) return pastas;
    d = pai;
  }
}

/** O projeto usa o kit: `.claude/kit.json` ou um bloco `<!-- kit:` no CLAUDE.md entre a pasta e a raiz do git. */
export function usaOKit(cwd) {
  if (!cwd) return false;
  return pastasAteARaiz(cwd).some((d) => {
    if (existsSync(join(d, '.claude', 'kit.json'))) return true;
    try { return /<!-- kit:[a-z-]+ v\d+ -->/.test(readFileSync(join(d, 'CLAUDE.md'), 'utf8')); } catch { return false; }
  });
}

/** A seção `skillsDeFora` do kit.json mais próximo; {} sem ele, sem a seção ou com o arquivo quebrado. */
function secaoDo(cwd) {
  if (!cwd) return {};
  for (const d of pastasAteARaiz(cwd)) {
    const f = join(d, '.claude', 'kit.json');
    if (!existsSync(f)) continue;
    try { const s = JSON.parse(readFileSync(f, 'utf8'))?.skillsDeFora; return s && typeof s === 'object' ? s : {}; } catch { return {}; }
  }
  return {};
}

/** `skillsDeFora.liberar`: as skills que o projeto libera. */
export function liberadasDo(cwd) {
  const lista = secaoDo(cwd).liberar;
  return Array.isArray(lista) ? lista.filter((x) => typeof x === 'string') : [];
}

/** `skillsDeFora.substitutas`: skill absorvida → a peça do projeto no lugar dela (só os pares de texto). */
export function substitutasDo(cwd) {
  const m = secaoDo(cwd).substitutas;
  if (!m || typeof m !== 'object' || Array.isArray(m)) return {};
  return Object.fromEntries(Object.entries(m).filter(([, v]) => typeof v === 'string'));
}

const lerJson = (f) => { try { return JSON.parse(readFileSync(f, 'utf8').replace(/^\uFEFF/, '')); } catch { return null; } };
const objeto = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);

/**
 * As substitutas que o plugin `plugin` pode declarar: a chave é o nome completo de uma skill `absorver` ainda não feita (o
 * plugin não mexe no que o kit barra, deixa livre ou tem como dependência), e o valor, o nome de uma skill ou agente do
 * próprio plugin (`<plugin>:<nome>`): um plugin não aponta para peça de outro. O nome curto da substituta passa como peça
 * da casa (`decidir`), então ele não pode ser o de outra skill do catálogo (liberaria uma barrada), e o plugin dono da
 * original não se declara substituto dela.
 */
export function substitutasValidas(plugin, declaradas, catalogo) {
  if (!objeto(declaradas) || !plugin) return {};
  const nomeDaPeca = new RegExp(`^${plugin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:[A-Za-z0-9._-]+$`);
  return Object.fromEntries(Object.entries(declaradas).filter(([skill, v]) => typeof v === 'string'
    && nomeDaPeca.test(v.trim())
    && catalogo.skills?.some((s) => s.skill === skill && s.saida === 'absorver' && s.feito !== true)
    && skill.slice(0, skill.indexOf(':')) !== plugin
    && !catalogo.skills.some((s) => s.skill !== skill && curto(s.skill) === curto(v.trim()))).map(([skill, v]) => [skill, v.trim()]));
}

/**
 * Os plugins ligados neste projeto e a pasta de cada um: ligado é o `enabledPlugins` mais próximo (o `settings.local.json`
 * e o `settings.json` do projeto, da pasta da sessão até a raiz do git, e depois o da conta) dizendo `true`; a pasta é a
 * do `installed_plugins.json` cujo escopo vale aqui (`user`, ou `project`/`local` de uma pasta que contém a sessão; com
 * várias, a do `projectPath` mais específico).
 * Plugin que só a conta do app traz (fora do CLI) não aparece: o caminho dele não é documentado. → [{ id, nome, pasta }].
 */
export function pluginsLigados(cwd, pastaConfig) {
  if (!cwd || !pastaConfig) return [];
  const camadas = [];
  for (const d of pastasAteARaiz(cwd)) for (const n of ['settings.local.json', 'settings.json']) camadas.push(lerJson(join(d, '.claude', n))?.enabledPlugins);
  camadas.push(lerJson(join(pastaConfig, 'settings.json'))?.enabledPlugins);
  const decidido = new Map();
  for (const c of camadas) if (objeto(c)) for (const [id, v] of Object.entries(c)) if (typeof v === 'boolean' && !decidido.has(id)) decidido.set(id, v);
  const instalados = lerJson(join(pastaConfig, 'plugins', 'installed_plugins.json'))?.plugins ?? {};
  const aqui = resolve(cwd);
  const contem = (pasta) => typeof pasta === 'string' && (aqui === resolve(pasta) || aqui.startsWith(`${resolve(pasta)}/`));
  const ligados = [];
  for (const [id, v] of [...decidido].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    if (v !== true || !Array.isArray(instalados[id])) continue;
    const entradas = instalados[id].filter((e) => typeof e?.installPath === 'string' && (e.scope === 'user' || contem(e.projectPath)));
    const deProjeto = entradas.filter((e) => e.scope !== 'user').sort((a, b) => resolve(b.projectPath).length - resolve(a.projectPath).length);
    const entrada = deProjeto[0] ?? entradas[0];
    if (entrada && existsSync(entrada.installPath)) ligados.push({ id, nome: id.split('@')[0], pasta: entrada.installPath });
  }
  return ligados;
}

/** As substitutas que os plugins ligados declaram em `substitutas.json`, filtradas; dois para a mesma skill, vence o primeiro id. */
export function substitutasDosPlugins(cwd, pastaConfig, catalogo) {
  const juntas = {};
  for (const { nome, pasta } of pluginsLigados(cwd, pastaConfig)) {
    const validas = substitutasValidas(nome, lerJson(join(pasta, 'substitutas.json'))?.substitutas, catalogo);
    for (const [skill, v] of Object.entries(validas)) if (!(skill in juntas)) juntas[skill] = v;
  }
  return juntas;
}

/** Os nomes das skills do projeto (`.claude/skills/*` da pasta até a raiz do git) e da conta (`~/.claude/skills/*`). */
export function skillsProprias(cwd, home) {
  const nomes = new Set();
  for (const d of [...(cwd ? pastasAteARaiz(cwd) : []), ...(home ? [home] : [])]) {
    try { for (const n of readdirSync(join(d, '.claude', 'skills'))) nomes.add(n); } catch { /* sem a pasta */ }
  }
  return [...nomes];
}

function main() {
  const e = lerEntrada();
  const expansao = e.hook_event_name === 'UserPromptExpansion';
  const nome = expansao ? e.command_name : (e.tool_name === 'Skill' ? e.tool_input?.skill : null);
  if (!nome) return;
  const cwd = e.cwd || process.cwd();
  if (!usaOKit(cwd)) return;
  const home = e.home || homedir();
  const catalogo = lerCatalogo();
  // o kit.json do projeto vence o plugin: é a exceção do projeto
  const substitutas = { ...substitutasDosPlugins(cwd, process.env.CLAUDE_CONFIG_DIR || join(home, '.claude'), catalogo), ...substitutasDo(cwd) };
  const motivo = decidir(nome, { catalogo, liberar: liberadasDo(cwd), substitutas, proprias: skillsProprias(cwd, home) });
  if (!motivo) return;
  registrar(e.session_id, HOOK, 'recusou', motivo);
  const saida = expansao
    ? { decision: 'block', reason: motivo }
    : { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: motivo } };
  process.stdout.write(JSON.stringify(saida));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (err) { registrar('-', HOOK, 'erro', `${err?.name ?? 'Error'}: ${err?.message ?? ''}`); }
  process.exitCode = 0;
}
