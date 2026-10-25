#!/usr/bin/env node
// Stop hook: numa sessão orquestradora, o turno só termina depois do ritual
// (skill orquestradora, seção "Ritual de cada turno"): list_sessions e um
// gravação no painel (painel.mjs set|update|batch|delete) desde a última mensagem que abriu o turno.
// A sessão é orquestradora quando existe ~/.claude/orquestracao/ativas/<session_id>.
import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { gravaNoPainel } from './hooks-crewai-comum.mjs';

const LOG = join(homedir(), '.claude', 'orquestracao', 'ritual-hook.log');

function main() {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const { session_id, transcript_path, stop_hook_active } = input;
  if (!session_id || !existsSync(join(homedir(), '.claude', 'orquestracao', 'ativas', session_id))) return;
  if (stop_hook_active) return; // já cobrou uma vez neste turno; não prende em laço

  const linhas = readFileSync(transcript_path, 'utf8').split('\n').filter(Boolean);
  const entradas = [];
  for (const l of linhas) {
    try { entradas.push(JSON.parse(l)); } catch { /* linha parcial */ }
  }

  // Início do turno: a última mensagem com origem (operador, sessão, notificação).
  let inicio = -1;
  for (let i = entradas.length - 1; i >= 0; i--) {
    const e = entradas[i];
    if (e.type === 'user' && e.origin && e.origin.kind) { inicio = i; break; }
  }
  if (inicio < 0) return;

  const usadas = new Set();
  let gravou = false;
  for (const e of entradas.slice(inicio + 1)) {
    if (e.type !== 'assistant') continue;
    const c = e.message?.content;
    if (!Array.isArray(c)) continue;
    for (const item of c) {
      if (item.type !== 'tool_use') continue;
      usadas.add(item.name);
      if (item.name === 'Bash' && gravaNoPainel(String(item.input?.command ?? ''))) gravou = true;
    }
  }

  const faltam = [];
  if (![...usadas].some((n) => n.endsWith('list_sessions'))) faltam.push('list_sessions {"linked": true}');
  if (!gravou) faltam.push('gravar no painel com painel.mjs (batch com o que mudou, ou ao menos update da própria linha)');
  if (faltam.length === 0) return;

  process.stdout.write(JSON.stringify({
    decision: 'block',
    reason:
      `Ritual da orquestradora não feito neste turno. Falta: ${faltam.join('; ')}. ` +
      'Rode list_sessions, arquive quem cumpre as quatro condições, dê set na sessão sem linha, ' +
      'tire o estado mecânico (isRunning → trabalhando, arquivada → concluida) e grave tudo no painel ' +
      'com `painel batch \'[...]\'`. Depois responda.',
  }));
}

try {
  main();
} catch (err) {
  try { appendFileSync(LOG, `${new Date().toISOString()} ${err?.stack || err}\n`); } catch { /* sem log */ }
}
process.exitCode = 0;
