// F373: o Stop hook `espera-no-turno.mjs` segura uma vez o fim de turno da dona que ainda tem teste ou subagente rodando em
// segundo plano (o aviso de fim de turno acordaria a orquestradora só para ler "aguardo"). Lê `background_tasks` da entrada do
// Stop. HOME, painel e registro do app em pasta temporária: nada toca o ~/.claude real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const HOOK = join(AQUI, '..', 'espera-no-turno.mjs');
const POOL = join(AQUI, '..', '..', 'pool');
const ID = { DONA: 'cli-dona', AV: 'cli-av' };

function novo() {
  const base = mkdtempSync(join(tmpdir(), 'espera-no-turno-'));
  for (const d of ['orq', 'app', 'home']) mkdirSync(join(base, d));
  writeFileSync(join(base, 'app', 'local_DONA.json'), JSON.stringify({ sessionId: 'local_DONA', cliSessionId: ID.DONA, title: 'F7 · editor', isArchived: false }));
  writeFileSync(join(base, 'app', 'local_AV.json'), JSON.stringify({ sessionId: 'local_AV', cliSessionId: ID.AV, title: 'avulsa', isArchived: false }));
  mkdirSync(join(base, 'painel', 'fila'), { recursive: true });
  writeFileSync(join(base, 'painel', 'fila', 'F7.json'), JSON.stringify({ id: 'F7', version: 1, data: { titulo: 'editor', etapa: 'validacao', donoLocalId: 'local_DONA' } }));
  return base;
}
function rodar(base, quem, extra = {}) {
  const out = execFileSync('node', [HOOK], {
    input: JSON.stringify({ session_id: ID[quem], transcript_path: join(base, 't.jsonl'), hook_event_name: 'Stop', stop_hook_active: false, last_assistant_message: 'O validador ainda roda; abro o PR quando ele voltar.', ...extra }),
    encoding: 'utf8', timeout: 15000, killSignal: 'SIGKILL',
    env: { ...process.env, HOME: join(base, 'home'), HOOKS_CREWAI_BASE: join(base, 'orq'), POOL_APP_SESSOES_DIR: join(base, 'app'), PAINEL_DIR: join(base, 'painel') },
  });
  return out.trim() ? JSON.parse(out) : null;
}
const log = (b) => { const p = join(b, 'orq', 'hooks-crewai.log'); return existsSync(p) ? readFileSync(p, 'utf8') : ''; };
const com = (fn) => { const b = novo(); try { fn(b); } finally { rmSync(b, { recursive: true, force: true }); } };
const VALIDADOR = { id: 'a1', type: 'subagent', status: 'running', description: 'Revisão do F7', agent_type: 'orquestracao:validador' };
const TESTES = { id: 'b2', type: 'shell', status: 'running', description: 'testes afetados', command: 'testes-afetados -- node --test' };

test('dona com validador e teste rodando: segura uma vez, nomeia o que roda e diz como esperar no turno', () => com((b) => {
  const r = rodar(b, 'DONA', { background_tasks: [VALIDADOR, TESTES] });
  assert.equal(r?.decision, 'block', JSON.stringify(r));
  assert.match(r.reason, /Revisão do F7/);
  assert.match(r.reason, /testes afetados/);
  assert.match(r.reason, /esperar-fundo/);
  assert.match(r.reason, /primeiro plano/);
  assert.match(log(b), /\tespera-no-turno\tsegurou\t/);
}));

test('a segunda tentativa de parar (stop_hook_active) passa e registra', () => com((b) => {
  assert.equal(rodar(b, 'DONA', { background_tasks: [VALIDADOR], stop_hook_active: true }), null);
  assert.match(log(b), /\tespera-no-turno\tdeixou-passar\t/);
}));

test('nada em segundo plano, ou só monitor e cron: passa sem registrar', () => com((b) => {
  assert.equal(rodar(b, 'DONA', { background_tasks: [] }), null);
  assert.equal(rodar(b, 'DONA', {}), null, 'sem o campo (versão antiga do Claude Code)');
  assert.equal(rodar(b, 'DONA', { background_tasks: [{ id: 'm', type: 'monitor', status: 'running', description: 'log' }] }), null);
  assert.equal(rodar(b, 'DONA', { background_tasks: [{ ...VALIDADOR, status: 'completed' }] }), null);
  assert.equal(log(b), '');
}));

test('sessão que não é dona de item vivo: passa (o hook vale só para a dona)', () => com((b) => {
  assert.equal(rodar(b, 'AV', { background_tasks: [VALIDADOR] }), null);
  assert.equal(log(b), '');
}));

test('turno que termina perguntando ao operador (Q-ID ou "?" no fim) passa: a espera é do operador', () => com((b) => {
  assert.equal(rodar(b, 'DONA', { background_tasks: [TESTES], last_assistant_message: 'Os testes rodam.\n\nQ920: subo a versão agora?' }), null);
  assert.match(log(b), /\tespera-no-turno\tpergunta\t/);
}));

test('o protocolo, o manual da dona e a skill de papéis dizem a regra e o comando', () => {
  const protocolo = readFileSync(join(POOL, 'protocolo.md'), 'utf8');
  const dona = readFileSync(join(POOL, 'dona.md'), 'utf8');
  assert.match(protocolo, /<a id="espera-no-turno"><\/a>/);
  for (const [nome, texto] of [['protocolo', protocolo], ['dona.md', dona]]) {
    assert.ok(texto.includes('esperar-fundo'), `${nome} não cita esperar-fundo`);
    assert.ok(texto.includes('espera-no-turno'), `${nome} não cita espera-no-turno`);
  }
});
