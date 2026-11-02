#!/usr/bin/env node
// PreToolUse em `Skill` e UserPromptExpansion (F333, ADR 0014): a skill de fora que duplica uma peça do kit (`barrar` no
// catálogo, ou `absorver` já feita) é recusada com a peça certa, só em projeto que usa o kit (`.claude/kit.json` ou bloco
// `<!-- kit:` no CLAUDE.md, da pasta da sessão até a raiz do git). O projeto libera uma skill em `skillsDeFora.liberar` e
// declara em `skillsDeFora.substitutas` a peça dele que absorveu uma skill de fora (aí a absorção vale e a original é barrada).
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
  const motivo = decidir(nome, { catalogo: lerCatalogo(), liberar: liberadasDo(cwd), substitutas: substitutasDo(cwd), proprias: skillsProprias(cwd, e.home || homedir()) });
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
