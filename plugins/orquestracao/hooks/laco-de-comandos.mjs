#!/usr/bin/env node
// PostToolUse + PostToolUseFailure (Q66, ideia 6 do estudo CrewAI — detecção de laço por chamadas parecidas):
// AVISA, nunca bloqueia, quando 4 Bash SEGUIDOS (sem outra tool no meio) têm comando parecido
// (trigramas ≥ 0,7) e saída não vazia parecida (≥ 0,6): o mesmo comando, o mesmo resultado,
// nada avançando. Medido em 10 dias de transcripts (116 mil chamadas, 22/10): 1 aviso, num laço
// real (o mesmo vitest 4× sem editar) — a réplica da validação deu 0, então o piloto pode fechar em zero; com "comando parecido" sozinho eram 45, quase todos
// leitura de arquivo em pedaços (`sed -n` com faixas). Piloto de 1 semana, contagem no log.
// Bash que sai com exit ≠ 0 não dispara PostToolUse, e sim PostToolUseFailure (com `error` no
// lugar de `tool_response`) — e o laço típico é justamente o mesmo teste vermelho repetido.
// Vale para toda sessão e subagente. Erro vai para o log e a tool segue.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { BASE, registrar, lerEntrada } from './hooks-crewai-comum.mjs';

const HOOK = 'laco-de-comandos';
const DIR = join(BASE, 'laco');
const LIMIAR_VEZES = 4;
const SEMELHANCA_COMANDO = 0.7;
const SEMELHANCA_SAIDA = 0.6;

const normalizar = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 2000);
function trigramas(s) {
  const t = new Set();
  for (let i = 0; i < s.length - 2; i++) t.add(s.slice(i, i + 3));
  return t;
}
function semelhanca(a, b) {
  if (a === b) return 1;
  const ta = trigramas(a);
  const tb = trigramas(b);
  let comum = 0;
  for (const x of ta) if (tb.has(x)) comum++;
  return comum / (ta.size + tb.size - comum || 1);
}
function saidaDe(r) {
  if (typeof r === 'string') return r;
  if (r && typeof r === 'object') return [r.stdout, r.stderr].filter(Boolean).join('\n');
  return '';
}

function podar() {
  const limite = Date.now() - 2 * 24 * 3600 * 1000;
  for (const f of readdirSync(DIR)) {
    const p = join(DIR, f);
    try { if (statSync(p).mtimeMs < limite) unlinkSync(p); } catch { /* outra sessão apagou */ }
  }
}

function main() {
  const e = lerEntrada();
  if (!e.session_id) return;
  const arquivo = join(DIR, `${e.session_id}--${e.agent_id || 'principal'}.json`);
  const existe = existsSync(arquivo);

  if (e.tool_name !== 'Bash') {
    if (existe) writeFileSync(arquivo, '{}'); // outra tool no meio quebra a sequência
    return;
  }
  mkdirSync(DIR, { recursive: true });
  const cmd = normalizar(e.tool_input?.command);
  const saida = normalizar(e.hook_event_name === 'PostToolUseFailure' ? e.error : saidaDe(e.tool_response));
  let ant = {};
  if (existe) { try { ant = JSON.parse(readFileSync(arquivo, 'utf8')); } catch { ant = {}; } }

  const parecido = ant.cmd && saida && ant.saida
    && semelhanca(ant.cmd, cmd) >= SEMELHANCA_COMANDO
    && semelhanca(ant.saida, saida) >= SEMELHANCA_SAIDA;
  const vezes = parecido ? (ant.vezes || 1) + 1 : 1;
  writeFileSync(arquivo, JSON.stringify({ cmd, saida, vezes }), { mode: 0o600 });
  if (Math.random() < 0.02) podar();
  if (vezes !== LIMIAR_VEZES) return;

  const quem = e.agent_id ? `subagente ${e.agent_type || e.agent_id}` : 'principal';
  registrar(e.session_id, HOOK, 'avisou', `${quem}: ${cmd}`);
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: e.hook_event_name === 'PostToolUseFailure' ? 'PostToolUseFailure' : 'PostToolUse',
      additionalContext:
        `Aviso: este é o ${LIMIAR_VEZES}º comando seguido quase igual ao anterior, com quase a mesma saída — ` +
        'nada está avançando. Pare e mude de hipótese (leia o erro inteiro, meça outra coisa) em vez de repetir; ' +
        'se está esperando algo terminar, use Monitor ou run_in_background em vez de repetir o comando.',
    },
  }));
}

try {
  main();
} catch (err) {
  registrar('-', HOOK, 'erro', err?.stack || err);
}
process.exitCode = 0;
