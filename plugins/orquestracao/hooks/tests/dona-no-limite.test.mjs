// F484: a dona parada no limite de uso da conta, no Orca, lida da caixa do Orca (escalation `usageLimitReached`) e da lista de
// workers. O `orca` real nunca é chamado: o falso de `orca-falso.mjs` responde o `inbox` e o `worker-list`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync, mkdtempSync, writeFileSync, chmodSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { limitesDaCaixa, donasNoLimite, ORCAMENTO_MS } from '../dona-no-limite.mjs';
import { orcaFalso, recibo, worker, escalacao, reciboCaixa } from './orca-falso.mjs';

const AGORA = Date.parse('2026-11-07T12:00:00Z');
const esc = (F, o = {}) => escalacao(F, { agoraMs: AGORA, ...o });
const haMin = (n) => new Date(AGORA - n * 60_000).toISOString().replace(/\.\d{3}Z$/, 'Z');

test('limitesDaCaixa: só a escalation de limite de uso, das últimas 24 h, com o item no título da tarefa', () => {
  const m = limitesDaCaixa([
    esc('F7', { handle: 'structworker_7', dispatchId: 'ctx_7' }),
    esc('F8', { kind: 'hostFault' }),
    esc('F9', { min: 25 * 60 }),
    { ...esc('F10'), type: 'status' },
    { ...esc('F11'), body: 'sem título de tarefa F11' },
    { ...esc('F12'), payload: 'não é json' },
  ], AGORA);
  assert.ok(m.size > 0, 'precondição: a escalation do F7 tem de ser lida');
  assert.deepEqual([...m.keys()], ['F7']);
  assert.deepEqual(m.get('F7'), { handle: 'structworker_7', dispatchId: 'ctx_7', emMs: Date.parse(haMin(10)), detalhe: "You've hit your 5-hour limit · resets 11am (America/Sao_Paulo)" });
});
test('limitesDaCaixa: payload já como objeto também vale; F7 não casa com F70; a mais nova do item vence', () => {
  const objeto = { ...esc('F7'), payload: JSON.parse(esc('F7').payload) };
  assert.deepEqual([...limitesDaCaixa([objeto], AGORA).keys()], ['F7']);
  assert.deepEqual([...limitesDaCaixa([esc('F70')], AGORA).keys()], ['F70']);
  const m = limitesDaCaixa([esc('F7', { dispatchId: 'ctx_velho', min: 120 }), esc('F7', { dispatchId: 'ctx_novo', min: 5 })], AGORA);
  assert.equal(m.get('F7').dispatchId, 'ctx_novo');
});

function comOrca(caixa, workers) {
  const o = orcaFalso({ '': recibo(workers), outros: { 'orchestration inbox': caixa } });
  return { o, env: { ...process.env, ...o.env, ORCA_TERMINAL_HANDLE: 'term_quem_chama', ORCA_AGENT_SESSION_ID: 'quem-chama' } };
}

test('donasNoLimite: a dona do limite com o chat vivo (ready/active) está em espera; a do despacho parado não', () => {
  const vivo = worker('/w/f7', 'active', { terminal: 'structworker_7', dispatchId: 'ctx_7', state: 'ready' });
  const parado = worker('/w/f8', 'released', { terminal: 'structworker_8', dispatchId: 'ctx_8', state: 'stopped' });
  const { o, env } = comOrca(reciboCaixa([esc('F7', { handle: 'structworker_7', dispatchId: 'ctx_7' }), esc('F8', { handle: 'structworker_8', dispatchId: 'ctx_8' })]), [vivo, parado]);
  try {
    const r = donasNoLimite({ env, agoraMs: AGORA });
    assert.ok(r instanceof Set, 'precondição: a leitura tem de dar certo');
    assert.deepEqual([...r], ['F7']);
    const inbox = o.chamadas().find((c) => c.argv.slice(0, 2).join(' ') === 'orchestration inbox');
    assert.ok(inbox, 'o inbox foi chamado');
    assert.ok(inbox.argv.includes('--full') && inbox.argv.includes('--json'), 'o payload só vem inteiro com --full');
    assert.equal(inbox.env.ORCA_TERMINAL_HANDLE, undefined, 'sem o vínculo de quem chama (a caixa seria só a dele)');
    assert.equal(inbox.env.ORCA_AGENT_SESSION_ID, undefined);
  } finally { rmSync(o.dir, { recursive: true, force: true }); }
});
test('donasNoLimite: acordada por send, o follow-up no mesmo terminal com outro despacho ainda conta como a mesma dona', () => {
  const antigo = worker('/w/f7', 'active', { terminal: 'structworker_7', dispatchId: 'ctx_7', state: 'succeeded' });
  const followUp = worker('/w/f7', 'active', { terminal: 'structworker_7', dispatchId: 'ctx_7b', state: 'ready' });
  const { o, env } = comOrca(reciboCaixa([esc('F7', { handle: 'structworker_7', dispatchId: 'ctx_7' })]), [antigo, followUp]);
  try { assert.deepEqual([...donasNoLimite({ env, agoraMs: AGORA })], ['F7']); } finally { rmSync(o.dir, { recursive: true, force: true }); }
});
test('donasNoLimite: falha fechada — sem orca, caixa ilegível ou recusada → null (quem chama segue cobrando)', () => {
  assert.equal(donasNoLimite({ env: { ...process.env, KIT_ORCA_BIN: 'off' }, agoraMs: AGORA }), null);
  for (const caixa of [{ stdout: 'não é json' }, { stdout: { ok: false, error: 'x' } }, { stdout: { ok: true, result: {} } }, { stdout: '{}', exit: 2 }]) {
    const { o, env } = comOrca(caixa, []);
    try { assert.equal(donasNoLimite({ env, agoraMs: AGORA }), null, JSON.stringify(caixa)); } finally { rmSync(o.dir, { recursive: true, force: true }); }
  }
});

// Validador: o hook do ritual tem 10 s de teto no hooks.json; se a caixa e a lista do Orca passassem disso, o Claude Code mataria o
// hook e o turno terminaria sem cobrar nada (a falha fechada não valeria). O orçamento das duas leituras fica bem abaixo.
test('donasNoLimite: o orçamento das leituras do Orca cabe com folga no teto do hook do ritual', () => {
  const json = JSON.parse(readFileSync(new URL('../hooks.json', import.meta.url), 'utf8'));
  const ritual = json.hooks.Stop.flatMap((g) => g.hooks).find((h) => h.command.includes('orquestradora-ritual.mjs'));
  assert.ok(ritual?.timeout > 0, 'precondição: o hook do ritual tem timeout no hooks.json');
  assert.ok(ORCAMENTO_MS > 0 && ORCAMENTO_MS <= ritual.timeout * 1000 * 0.7, `orçamento ${ORCAMENTO_MS} ms × teto ${ritual.timeout} s`);
});
test('donasNoLimite: orca travado não passa do orçamento e devolve null (segue cobrando)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'orca-lento-'));
  const bin = join(dir, 'orca');
  writeFileSync(bin, '#!/bin/sh\nexec sleep 5\n');
  chmodSync(bin, 0o755);
  try {
    const t0 = Date.now();
    assert.equal(donasNoLimite({ env: { ...process.env, KIT_ORCA_BIN: bin }, agoraMs: AGORA, orcamentoMs: 600 }), null);
    assert.ok(Date.now() - t0 < 3000, `demorou ${Date.now() - t0} ms`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
