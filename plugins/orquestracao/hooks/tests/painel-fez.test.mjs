// Testes de `painel fez del` e da saída do `com` dos outros itens no `pegar` (F169). Nunca tocam o painel real:
// HOME, PAINEL_DIR e HOOKS_CREWAI_BASE são pastas temporárias; o "projeto" é um repositório git de mentira.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS = process.env.SCRIPTS_DIR || join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'skills', 'orquestradora', 'scripts');
const PAINEL = join(SCRIPTS, 'painel.mjs');
const MIN = 60_000;
const lid = (n) => `local_00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const iso = (ms) => new Date(ms).toISOString();

let base; let repo; let T;
beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'painel-fez-'));
  for (const d of ['painel/fila', 'painel/perguntas', 'home', 'orq', 'appsess', 'nuc', 'repos/kit']) mkdirSync(join(base, d), { recursive: true });
  writeFileSync(join(base, 'painel', 'temas.json'), JSON.stringify([{ id: 'editor', rotulo: 'Editor' }]));
  repo = join(base, 'repos', 'kit');
  const g = spawnSync('git', ['init', '-q', repo], { encoding: 'utf8', timeout: 20000, killSignal: 'SIGKILL' });
  assert.equal(g.status, 0, `git init: ${g.stderr}`);
  T = Date.now();
});
afterEach(() => { rmSync(base, { recursive: true, force: true }); });

function painel(args, env = {}) {
  const r = spawnSync('node', [PAINEL, ...args], {
    encoding: 'utf8', timeout: 60000, killSignal: 'SIGKILL', cwd: repo,
    env: {
      ...process.env, PAINEL_DIR: join(base, 'painel'), CLAUDE_CODE_SESSION_ID: '', CLAUDE_CODE_HOST_SESSION_ID: '', HOME: join(base, 'home'),
      HOOKS_CREWAI_BASE: join(base, 'orq'), POOL_APP_SESSOES_DIR: join(base, 'appsess'), KIT_CARGA_1MIN: '0', KIT_NUCLEOS_DIR: join(base, 'nuc'), KIT_NUCLEOS_DE_TESTE: '4', ...env,
    },
  });
  if (r.error) throw r.error;
  return { exit: r.status, out: r.stdout, err: r.stderr, json: () => JSON.parse(r.stdout) };
}
const arquivo = (F) => join(base, 'painel', 'fila', `${F}.json`);
const lerItem = (F) => JSON.parse(readFileSync(arquivo(F), 'utf8'));
function item(F, extra = {}) {
  const data = {
    titulo: `Item ${F.toLowerCase()}`, etapa: 'execucao', tema: 'editor', projeto: 'kit',
    donoLocalId: lid(1), donoApelido: 'P1', com: [], prs: [],
    atualizadoEm: iso(T - 10 * MIN), historico: [{ em: iso(T - 10 * MIN), etapa: 'execucao', dono: 'P1' }],
    ...extra,
  };
  writeFileSync(arquivo(F), `${JSON.stringify({ id: F, version: 1, data })}\n`);
}
const fezDe = (n, ap) => ({ localId: lid(n), apelido: ap, oQue: 'fez', em: iso(T - 5 * MIN) });
const nada = { donoLocalId: null, donoApelido: null };

// ---- fez del ----
test('fez del: tira o fez pelo local_ e pelo apelido, grava o agora e deixa o resto do fez', () => {
  item('F1', { ...nada, fez: [fezDe(21, 'E21'), fezDe(22, 'E22')] });
  const a = painel(['fez', 'del', 'F1', lid(21), 'entrega falsa']);
  assert.equal(a.exit, 0, a.err);
  const d = lerItem('F1').data;
  assert.deepEqual(d.fez.map((f) => f.apelido), ['E22'], 'só a E21 sai');
  assert.match(d.agora, /^fez de E21 tirado: entrega falsa$/);
  const b = painel(['fez', 'del', 'F1', 'E22', 'outra']);
  assert.equal(b.exit, 0, b.err);
  assert.deepEqual(lerItem('F1').data.fez, []);
});
test('fez del recusa: apelido ambíguo, sessão fora do fez, motivo vazio, item que não existe e item final', () => {
  item('F1', { ...nada, fez: [fezDe(21, 'E21'), fezDe(22, 'E21')] });
  item('F2', { ...nada, fez: [fezDe(21, 'E21')] });
  item('F3', { ...nada, etapa: 'feito', fez: [fezDe(21, 'E21')] });
  const casos = [
    [['fez', 'del', 'F1', 'E21', 'x'], /ambíguo/],
    [['fez', 'del', 'F2', lid(30), 'x'], /não está em fez/],
    [['fez', 'del', 'F2', lid(21), ''], /motivo/],
    [['fez', 'del', 'F2', lid(21)], /motivo/],
    [['fez', 'del', 'F9', lid(21), 'x'], /não existe/],
    [['fez', 'del', 'F3', lid(21), 'x'], /etapa final/],
  ];
  for (const [args, esperado] of casos) {
    const r = painel(args);
    assert.equal(r.exit, 1, `${args.join(' ')} devia recusar: ${r.out}`);
    assert.match(r.err, esperado, args.join(' '));
  }
  assert.equal(lerItem('F1').data.fez.length, 2, 'a recusa não grava');
  assert.equal(lerItem('F2').data.fez.length, 1, 'a recusa não grava');
  assert.equal(painel(['fez', 'del', 'F2', lid(21), 'x']).exit, 0, 'o mesmo item aceita com os argumentos certos (a recusa não vinha de outra causa)');
});
test('fez del sem argumentos imprime o uso', () => {
  const r = painel(['fez']);
  assert.equal(r.exit, 1);
  assert.match(r.err, /painel\.mjs fez del <F>/);
});
test('o caso F145: item em execução com fez de E recusa o pegar; depois do fez del o pegar aceita', () => {
  item('F1', { ...nada, fez: [fezDe(21, 'E21')] });
  const antes = painel(['pegar', 'F1', lid(11), 'E1']);
  assert.equal(antes.exit, 1);
  assert.match(antes.json().motivo, /já foi entregue/);
  assert.equal(painel(['fez', 'del', 'F1', lid(21), 'entrega falsa']).exit, 0);
  const depois = painel(['pegar', 'F1', lid(11), 'E1']);
  assert.equal(depois.exit, 0, depois.out);
  assert.equal(depois.json().pegou, true);
});
test('o fez ainda não se muda por set/update (o fez del é a única via de tirar)', () => {
  item('F1', { ...nada, fez: [fezDe(21, 'E21')] });
  const r = painel(['update', 'fila', 'F1', '{"fez":[]}']);
  assert.equal(r.exit, 1);
  assert.match(r.err, /painel fez del/);
});

// ---- pegar sai do com dos outros itens ----
test('pegar tira a sessão do com dos outros itens vivos, sem fez e sem mexer no dono', () => {
  item('F1', { donoLocalId: lid(5), donoApelido: 'E5', com: [{ localId: lid(11), apelido: 'E1', oQue: 'item um' }, { localId: lid(5), apelido: 'E5', oQue: 'item um' }] });
  item('F2', { ...nada });
  item('F3', { etapa: 'feito', com: [{ localId: lid(11), apelido: 'E1', oQue: 'item final' }] });
  const r = painel(['pegar', 'F2', lid(11), 'E1']);
  assert.equal(r.exit, 0, r.out + r.err);
  const f1 = lerItem('F1').data;
  assert.deepEqual(f1.com.map((c) => c.localId), [lid(5)], 'sai do com de F1 e a outra fica');
  assert.equal(f1.fez, undefined, 'sem fez');
  assert.equal(f1.donoLocalId, lid(5), 'dono intacto');
  assert.deepEqual(lerItem('F2').data.com.map((c) => c.localId), [lid(11)], 'entra em F2');
  assert.deepEqual(lerItem('F3').data.com.map((c) => c.localId), [lid(11)], 'item final não é tocado');
});
