#!/usr/bin/env node
// PreToolUse em `Skill` e UserPromptExpansion (F333, ADR 0014): a skill de fora que duplica uma peça do kit (`barrar` no
// catálogo, ou `absorver` já feita) é recusada com a peça certa, só em projeto que usa o kit (`.claude/kit.json` ou bloco
// `<!-- kit:` no CLAUDE.md, da pasta da sessão até a raiz do git). O projeto libera uma skill em `skillsDeFora.liberar`.
// O `/nome` digitado não passa pelo PreToolUse (doc do Claude Code): o UserPromptExpansion cobre esse caminho.
// Erro do próprio hook vai para o log e DEIXA PASSAR: a trava não pode derrubar as sessões.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registrar, lerEntrada } from './hooks-crewai-comum.mjs';

const HOOK = 'skills-de-fora';
export const CATALOGO = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills-de-fora.json');

export const lerCatalogo = (caminho = CATALOGO) => JSON.parse(readFileSync(caminho, 'utf8'));

const nomeLimpo = (nome) => String(nome ?? '').trim().replace(/^\//, '');

/** A linha do catálogo que vale para a skill: a dela, senão a do plugin, senão livre. */
export function saidaDe(nome, catalogo) {
  const skill = nomeLimpo(nome);
  const propria = catalogo.skills?.find((s) => s.skill === skill);
  if (propria) return propria;
  const plugin = skill.includes(':') ? skill.slice(0, skill.indexOf(':')) : '';
  return catalogo.plugins?.find((p) => p.plugin === plugin) ?? { saida: 'livre' };
}

/** O motivo da recusa, ou null quando passa. */
export function decidir(nome, { catalogo, liberar = [] }) {
  const skill = nomeLimpo(nome);
  if (!skill || liberar.includes(skill)) return null;
  const linha = saidaDe(skill, catalogo);
  const barrada = linha.saida === 'barrar' || (linha.saida === 'absorver' && linha.feito === true);
  if (!barrada) return null;
  return `o kit barra ${skill} neste projeto: use ${linha.use}. Motivo: ${linha.motivo} `
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

/** `skillsDeFora.liberar` do kit.json mais próximo; [] sem ele, sem a lista ou com o arquivo quebrado. */
export function liberadasDo(cwd) {
  if (!cwd) return [];
  for (const d of pastasAteARaiz(cwd)) {
    const f = join(d, '.claude', 'kit.json');
    if (!existsSync(f)) continue;
    try {
      const lista = JSON.parse(readFileSync(f, 'utf8'))?.skillsDeFora?.liberar;
      return Array.isArray(lista) ? lista.filter((x) => typeof x === 'string') : [];
    } catch { return []; }
  }
  return [];
}

function main() {
  const e = lerEntrada();
  const expansao = e.hook_event_name === 'UserPromptExpansion';
  const nome = expansao ? e.command_name : (e.tool_name === 'Skill' ? e.tool_input?.skill : null);
  if (!nome) return;
  const cwd = e.cwd || process.cwd();
  if (!usaOKit(cwd)) return;
  const motivo = decidir(nome, { catalogo: lerCatalogo(), liberar: liberadasDo(cwd) });
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
