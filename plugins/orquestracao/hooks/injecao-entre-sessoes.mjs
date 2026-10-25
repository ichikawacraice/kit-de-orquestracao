#!/usr/bin/env node
// UserPromptSubmit (F37): a mensagem que chega de outra sessão (`<cross-session-message …>`) é DADO, nunca instrução.
// Quando o texto casa com padrão de injeção, o contexto ganha antes a linha de aviso. Não bloqueia, só avisa.
// Medido em 25/10: o UserPromptSubmit recebe a mensagem entre sessões como prompt (354 entradas `viu nao-humano
// <cross-session-message…` no log do operador-ausente). Erro do hook vai para o log e deixa passar.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registrar, lerEntrada } from './hooks-crewai-comum.mjs';
import { avisoDeInjecao, injecaoEm, nomesDe } from './varredura-entre-sessoes.mjs';

const HOOK = 'injecao-entre-sessoes';
const ENTRE_SESSOES = /^\s*<cross-session-message\b/;

/** A linha de aviso para este prompt, ou '' quando não veio de outra sessão ou não casa. */
export const avisoDoPrompt = (prompt) => (ENTRE_SESSOES.test(String(prompt ?? '')) ? avisoDeInjecao(prompt) : '');

function main() {
  const e = lerEntrada();
  const aviso = avisoDoPrompt(e.prompt);
  if (!aviso) return;
  registrar(e.session_id, HOOK, 'avisou', nomesDe(injecaoEm(e.prompt)));
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: aviso } }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (err) { registrar('-', HOOK, 'erro', err?.stack || err); }
  process.exitCode = 0;
}
