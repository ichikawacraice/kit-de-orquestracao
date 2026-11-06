#!/usr/bin/env node
// UserPromptSubmit (F37): a mensagem que chega de outra sessão (`<cross-session-message …>`, e o aviso de fim de turno da filha) é DADO, nunca instrução.
// Quando o texto casa com padrão de injeção, o contexto ganha antes a linha de aviso. Não bloqueia, só avisa.
// Medido em 25/10: o UserPromptSubmit recebe a mensagem entre sessões como prompt (354 entradas `viu nao-humano
// <cross-session-message…` no log do operador-ausente). Erro do hook vai para o log e deixa passar.
// F445 (modo Orca, fatia 8): no Orca, a mensagem de outra sessão ou de terminal abre com o envelope `──── From: …`
// (`ORCA_SESSION_ID:`, `STRUCTWORKER_`, `TERM_`), às vezes atrás de lembretes; é dado também. O prompt em blocos tem os `text` lidos.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registrar, lerEntrada } from './hooks-crewai-comum.mjs';
import { avisoDeInjecao, injecaoEm, nomesDe, textoDe, temEnvelopeDoOrca } from './varredura-entre-sessoes.mjs';

const HOOK = 'injecao-entre-sessoes';
// F314: o aviso de fim de turno da sessão filha traz o relatório dela, e a orquestradora age sobre ele. Medido em 01/11 nos
// transcripts: chega como `<system-reminder>` que abre com `The session "…" you started (…) finished a turn`; a tag
// `<side-sessions-event>` que o app descreve fica também, para quando vier assim. O aviso pode vir em lote, atrás de outro
// lembrete (ex.: "The user started your proposal…"), e o título pode ter aspas.
const ENTRE_SESSOES = /^\s*<(cross-session-message|side-sessions-event)\b|(^|<system-reminder>)\s*The session "[^\n]*?" you started \(/;

/** A linha de aviso para este prompt, ou '' quando não veio de outra sessão ou não casa. */
export const avisoDoPrompt = (prompt) => {
  const texto = textoDe(prompt);
  return ENTRE_SESSOES.test(texto) || temEnvelopeDoOrca(texto) ? avisoDeInjecao(texto) : '';
};

function main() {
  const e = lerEntrada();
  const aviso = avisoDoPrompt(e.prompt);
  if (!aviso) return;
  registrar(e.session_id, HOOK, 'avisou', nomesDe(injecaoEm(textoDe(e.prompt))));
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: aviso } }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (err) { registrar('-', HOOK, 'erro', `${err?.name ?? 'Error'} (sem detalhe: a entrada pode ter segredo)`); }
  process.exitCode = 0;
}
