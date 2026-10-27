#!/usr/bin/env node
// F181: start_session com prompt de dona ("dona do F<n>") só passa com título que começa por `F<n> · `; a recusa traz o título certo.
// Rodar: node --test hooks/tests/titulo-da-dona.test.mjs   (HOME e a pasta do log apontam para diretório temporário)
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decidir, tituloSugerido } from '../titulo-da-dona.mjs';

const HOOKS = join(dirname(fileURLToPath(import.meta.url)), '..');
const TOOL = 'mcp__ccd_session__start_session';
const PROMPT = 'Você é a dona do F181 · Trava que recusa abrir sessão dona sem o ID (projeto kit-de-orquestracao). Leia dona.md ao começar.';

function rodar(entrada) {
  const dir = mkdtempSync(join(tmpdir(), 'titulo-da-dona-'));
  try {
    const r = spawnSync('node', [join(HOOKS, 'titulo-da-dona.mjs')], {
      input: JSON.stringify(entrada), encoding: 'utf8', timeout: 15000, killSignal: 'SIGKILL',
      env: { ...process.env, HOME: dir, HOOKS_CREWAI_BASE: dir, PAINEL_DIR: dir, CLAUDE_CODE_HOST_SESSION_ID: '' },
    });
    const log = existsSync(join(dir, 'hooks-crewai.log')) ? readFileSync(join(dir, 'hooks-crewai.log'), 'utf8') : '';
    return { ...r, log };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('prompt de dona com título que começa por F<n> · passa', () => {
  assert.equal(decidir(TOOL, { title: 'F181 · Trava do título da dona', prompt: PROMPT }), null);
  const r = rodar({ session_id: 's', tool_name: TOOL, tool_input: { title: 'F181 · Trava do título da dona', prompt: PROMPT } });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
});

test('prompt de dona com título sem o ID é recusado, e a recusa traz o título certo', () => {
  const entrada = { title: 'Trava do título da dona', prompt: PROMPT };
  const motivo = decidir(TOOL, entrada);
  assert.ok(typeof motivo === 'string' && motivo.length > 0, 'devia recusar');
  assert.ok(motivo.includes('"F181 · Trava do título da dona"'), `sem o título sugerido: ${motivo}`);
  const r = rodar({ session_id: 's', tool_name: TOOL, tool_input: entrada });
  assert.equal(r.status, 0);
  const s = JSON.parse(r.stdout).hookSpecificOutput;
  assert.equal(s.hookEventName, 'PreToolUse');
  assert.equal(s.permissionDecision, 'deny');
  assert.ok(s.permissionDecisionReason.includes('F181 · Trava do título da dona'));
  assert.match(r.log, /titulo-da-dona\trecusou/);
});

test('título com outro ID, ou com o ID em formato errado, é recusado e o ID velho sai da sugestão', () => {
  for (const title of ['F180 · Trava do título', 'F181 - Trava do título', 'F181: Trava do título', 'Trava F181 · do título']) {
    const motivo = decidir(TOOL, { title, prompt: PROMPT });
    assert.ok(motivo, `devia recusar "${title}"`);
  }
  assert.equal(tituloSugerido('F181', 'F181 - Trava do título'), 'F181 · Trava do título');
  assert.equal(tituloSugerido('F181', 'F180 · Trava do título'), 'F181 · Trava do título');
  assert.equal(tituloSugerido('F181', '  '), 'F181 · <tema em palavras do produto>');
});

test('prompt de dona sem título é recusado com o modelo do título', () => {
  const motivo = decidir(TOOL, { prompt: PROMPT });
  assert.ok(motivo?.includes('F181 · '), `devia recusar: ${motivo}`);
});

test('prompt que não é de dona passa, com qualquer título', () => {
  const prompt = 'Investigue por que o gate demora e devolva um laudo.';
  assert.ok(!/dona do F\d/i.test(prompt), 'o insumo não pode ter o marcador de dona');
  assert.equal(decidir(TOOL, { title: 'Gate lento', prompt }), null);
  const r = rodar({ session_id: 's', tool_name: TOOL, tool_input: { title: 'Gate lento', prompt } });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
});

test('proposal_id sozinho (sem título nem prompt) passa', () => {
  assert.equal(decidir(TOOL, { proposal_id: 'abc123' }), null);
  const r = rodar({ session_id: 's', tool_name: TOOL, tool_input: { proposal_id: 'abc123' } });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
});

test('outra tool com o marcador no texto passa (só start_session é lida)', () => {
  assert.equal(decidir('SendMessage', { message: PROMPT }), null);
});

test('entrada quebrada não trava: termina em 0 sem decisão', () => {
  const dir = mkdtempSync(join(tmpdir(), 'titulo-da-dona-'));
  try {
    const r = spawnSync('node', [join(HOOKS, 'titulo-da-dona.mjs')], {
      input: '{não é json', encoding: 'utf8', timeout: 15000, killSignal: 'SIGKILL',
      env: { ...process.env, HOME: dir, HOOKS_CREWAI_BASE: dir },
    });
    assert.equal(r.status, 0);
    assert.equal(r.stdout, '');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
