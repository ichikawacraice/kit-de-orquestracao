#!/usr/bin/env node
// PreToolUse (F37): recusa o que leva SEGREDO para outra sessão. O texto que sai daqui fica no transcript do destino,
// no painel e nas notas compartilhadas, e dali ninguém tira. Só olha os caminhos de saída (mensagem, start_session,
// notas e painel); qualquer outra tool passa sem ser lida. A recusa nomeia os padrões e nunca o valor.
// Erro do próprio hook vai para o log e DEIXA PASSAR: a trava não pode derrubar o pool.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE, registrar, lerEntrada, INICIO_DE_COMANDO, INVOCACAO_DO_PAINEL } from './hooks-crewai-comum.mjs';
import { segredosEm, nomesDe } from './varredura-entre-sessoes.mjs';

const HOOK = 'segredo-sai';
const MENSAGEM = new Set(['SendMessage', 'mcp__ccd_session_mgmt__send_message']);
const ESCRITA = new Set(['Write', 'Edit', 'MultiEdit']);
const ABRE_SESSAO = 'mcp__ccd_session__start_session';
const VERBO_DE_ESCRITA = String.raw`\s+(?:set|update|batch|com)\b`;

const strings = (obj, chaves) => chaves.map((k) => obj?.[k]).filter((v) => typeof v === 'string');

const naPastaDeSaida = (caminho) => {
  if (typeof caminho !== 'string' || caminho === '') return false;
  const abs = resolve(caminho);
  return abs.includes('/side-session-notes/') || abs === BASE || abs.startsWith(`${BASE}/`);
};

function chamaPainelEscrevendo(comando) {
  const c = String(comando ?? '');
  if (/painel\.mjs/.test(c) && /(painel\.mjs|\$\{?\w+\}?)['"]?\s+(?:set|update|batch|com)\b/.test(c)) return true;
  return new RegExp(INICIO_DE_COMANDO + INVOCACAO_DO_PAINEL + VERBO_DE_ESCRITA).test(c);
}

/** Os textos que a chamada manda para fora; [] quando a tool não é um caminho de saída. */
export function textosDeSaida(tool, input) {
  if (MENSAGEM.has(tool)) return strings(input, ['message']);
  if (tool === ABRE_SESSAO) return strings(input, ['prompt', 'brief']);
  if (ESCRITA.has(tool) && naPastaDeSaida(input?.file_path)) {
    const edicoes = Array.isArray(input?.edits) ? input.edits.flatMap((e) => strings(e, ['new_string'])) : [];
    return [...strings(input, ['content', 'new_string']), ...edicoes];
  }
  if (tool === 'Bash' && chamaPainelEscrevendo(input?.command)) return strings(input, ['command']);
  return [];
}

/** A recusa para esta chamada, ou null quando passa. */
export function decidir(tool, input) {
  const padroes = new Set();
  for (const t of textosDeSaida(tool, input)) for (const a of segredosEm(t)) padroes.add(a.padrao);
  if (padroes.size === 0) return null;
  return `segredo no que sai para outra sessão: ${nomesDe([...padroes].map((padrao) => ({ padrao })))}`;
}

function main() {
  const e = lerEntrada();
  const motivo = decidir(e.tool_name, e.tool_input);
  if (!motivo) return;
  registrar(e.session_id, HOOK, 'recusou', `${e.tool_name}: ${motivo}`);
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: motivo } }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (err) { registrar('-', HOOK, 'erro', err?.stack || err); }
  process.exitCode = 0;
}
