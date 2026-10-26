// F59: o Stop da orquestradora cobra o resumo do modo ausente quando há período desligado sem entrega.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const HOOK = join(dirname(fileURLToPath(import.meta.url)), '..', 'orquestradora-ritual.mjs');
const haH = (h) => new Date(Date.now() - h * 3600_000).toISOString();

function cenario({ bandeira, entregue = false, cwdGit = true } = {}) {
  const raiz = mkdtempSync(join(tmpdir(), 'ritual-'));
  const home = join(raiz, 'home'); const base = join(raiz, 'orq');
  const sid = 'sess-orq';
  mkdirSync(join(home, '.claude', 'orquestracao', 'ativas'), { recursive: true });
  writeFileSync(join(home, '.claude', 'orquestracao', 'ativas', sid), '');
  mkdirSync(base, { recursive: true });
  const repo = join(raiz, 'meuprojeto'); mkdirSync(repo);
  if (cwdGit) execFileSync('git', ['init', '-q', repo], { timeout: 15000, killSignal: 'SIGKILL' });
  if (bandeira) writeFileSync(join(base, 'operador-ausente.json'), JSON.stringify(bandeira));
  if (entregue) {
    mkdirSync(join(base, 'ausencias'), { recursive: true });
    writeFileSync(join(base, 'ausencias', `${bandeira.desde.replaceAll(':', '-')}--meuprojeto.json`), '{}');
  }
  // transcript que já cumpre os dois requisitos de hoje (list_sessions + gravação no painel)
  const linhas = [
    { type: 'user', origin: { kind: 'human' }, message: { content: 'oi' } },
    { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'mcp__ccd_session_mgmt__list_sessions', input: {} }, { type: 'tool_use', name: 'Bash', input: { command: 'node painel.mjs update sessoes x {}' } }] } },
  ];
  const tr = join(raiz, 't.jsonl'); writeFileSync(tr, linhas.map((l) => JSON.stringify(l)).join('\n'));
  const rodar = (extra = {}) => execFileSync('node', [HOOK], {
    input: JSON.stringify({ session_id: sid, transcript_path: tr, cwd: cwdGit ? repo : join(raiz, 'fora'), ...extra }),
    encoding: 'utf8', timeout: 15000, killSignal: 'SIGKILL', env: { ...process.env, HOME: home, HOOKS_CREWAI_BASE: base },
  });
  return { rodar };
}
const off = () => ({ ligado: false, desde: haH(12), desligadoEm: haH(2), por: 'painel' });

test('período desligado sem entrega: o Stop recusa e cita ausencia.mjs resumo e a seção da skill', () => {
  const out = cenario({ bandeira: off() }).rodar();
  assert.notEqual(out, '', 'precondição: a cobrança tem de aparecer');
  const r = JSON.parse(out);
  assert.equal(r.decision, 'block');
  assert.match(r.reason, /ausencia\.mjs"? resumo/);
  assert.match(r.reason, /resumo-da-ausencia/);
  assert.match(r.reason, /entregue/);
});
test('com a entrega registrada, sem bandeira ou com a bandeira ligada, não cobra', () => {
  const b = off();
  assert.equal(cenario({ bandeira: b, entregue: true }).rodar(), '');
  assert.equal(cenario({}).rodar(), '');
  assert.equal(cenario({ bandeira: { desde: haH(1), por: 'comando' } }).rodar(), '');
});
test('projeto que não resolve não cobra; stop_hook_active não prende em laço', () => {
  assert.equal(cenario({ bandeira: off(), cwdGit: false }).rodar(), '');
  assert.equal(cenario({ bandeira: off() }).rodar({ stop_hook_active: true }), '');
});
