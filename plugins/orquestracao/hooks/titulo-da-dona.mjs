#!/usr/bin/env node
// PreToolUse (F181, Q473): start_session cujo prompt é de dona ("dona do F<n>") só passa com título que começa por `F<n> · `.
// O ID primeiro dá ao operador a referência do item; a regra só no texto da skill foi violada (F140, F172, F174).
// A recusa traz o título certo. Sem título nem prompt (`proposal_id` sozinho) passa: o cartão já foi checado ao nascer.
// Erro do próprio hook vai para o log e DEIXA PASSAR: a trava não pode derrubar o pool.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registrar, lerEntrada } from './hooks-crewai-comum.mjs';

const HOOK = 'titulo-da-dona';
const TOOL = 'mcp__ccd_session__start_session';
const MARCA_DE_DONA = /\bdona\s+do\s+(F\d+)\b/i;
// Um ID solto no começo do título (`F180 · `, `F181 - `, `F181: `) sai da sugestão: o certo entra no lugar dele.
const ID_NO_COMECO = /^\s*F\d+\b\s*[·:\-–—]?\s*/i;

export function tituloSugerido(id, titulo) {
  const tema = String(titulo ?? '').replace(ID_NO_COMECO, '').trim();
  return `${id} · ${tema || '<tema em palavras do produto>'}`;
}

/** A recusa para esta chamada, ou null quando passa. */
export function decidir(tool, input) {
  if (tool !== TOOL) return null;
  const prompt = typeof input?.prompt === 'string' ? input.prompt : '';
  const m = MARCA_DE_DONA.exec(prompt);
  if (!m) return null;
  const id = m[1].toUpperCase();
  const titulo = typeof input?.title === 'string' ? input.title : '';
  if (titulo.startsWith(`${id} · `)) return null;
  const certo = tituloSugerido(id, titulo);
  return `sessão dona do ${id} com título fora do padrão ("${titulo}"): o título começa pelo ID do item. Abra de novo com o título "${certo}".`;
}

function main() {
  const e = lerEntrada();
  const motivo = decidir(e.tool_name, e.tool_input);
  if (!motivo) return;
  registrar(e.session_id, HOOK, 'recusou', motivo);
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: motivo } }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (err) { registrar('-', HOOK, 'erro', `${err?.name ?? 'Error'}: ${err?.message ?? ''}`); }
  process.exitCode = 0;
}
