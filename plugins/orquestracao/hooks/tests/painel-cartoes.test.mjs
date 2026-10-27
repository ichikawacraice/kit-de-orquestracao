// Testes da coleção `cartoes` (cartão de sessão dona que espera o clique do operador): validação do painel.mjs, a função pura
// `cartoesResolvidos` e a limpeza dentro de `painel batida`. Nunca tocam o painel real (pastas temporárias).
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS = process.env.SCRIPTS_DIR || join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'skills', 'orquestradora', 'scripts');
const PAINEL = join(SCRIPTS, 'painel.mjs');
const { cartoesResolvidos, CARTAO_VALIDADE_H } = await import(join(SCRIPTS, 'batida.mjs'));
const MIN = 60_000;
const H = 60 * MIN;
const lid = (n) => `local_00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const iso = (ms) => new Date(ms).toISOString();

let base; let repo; let T;
beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'painel-cartoes-'));
  for (const d of ['painel/fila', 'painel/perguntas', 'painel/cartoes', 'home', 'orq', 'appsess', 'nuc', 'repos/kit']) mkdirSync(join(base, d), { recursive: true });
  writeFileSync(join(base, 'painel', 'temas.json'), JSON.stringify([{ id: 'editor', rotulo: 'Editor' }]));
  repo = join(base, 'repos', 'kit');
  assert.equal(spawnSync('git', ['init', '-q', repo], { timeout: 20000, killSignal: 'SIGKILL' }).status, 0);
  T = Date.now();
});
afterEach(() => { rmSync(base, { recursive: true, force: true }); });

function painel(args) {
  const r = spawnSync('node', [PAINEL, ...args], {
    encoding: 'utf8', timeout: 60000, killSignal: 'SIGKILL', cwd: repo,
    env: { ...process.env, PAINEL_DIR: join(base, 'painel'), CLAUDE_CODE_SESSION_ID: '', HOME: join(base, 'home'), HOOKS_CREWAI_BASE: join(base, 'orq'), POOL_APP_SESSOES_DIR: join(base, 'appsess'), KIT_CARGA_1MIN: '0', KIT_NUCLEOS_DIR: join(base, 'nuc'), KIT_NUCLEOS_DE_TESTE: '4' },
  });
  if (r.error) throw r.error;
  return { exit: r.status, out: r.stdout, err: r.stderr, json: () => JSON.parse(r.stdout) };
}
// O cartão de sessão dona: apelido e papel `dona`, um item F<n>; a sessão aberta se chama `F<n> · <tema>`.
const cartao = (extra = {}) => ({ projeto: 'kit', apelido: 'dona', papel: 'dona', itens: ['F144'], orquestradoraId: lid(1), propostoEm: iso(T - 10 * MIN), ...extra });
const arq = (id) => join(base, 'painel', 'cartoes', `${id}.json`);

// ---- validação ----
test('cartoes: cartão de sessão dona (apelido dona, um item F<n>) é gravado', () => {
  const r = painel(['set', 'cartoes', 'task_a', JSON.stringify(cartao())]);
  assert.equal(r.exit, 0, r.err);
  assert.ok(existsSync(arq('task_a')));
});
for (const [nome, extra, trecho] of [
  ['apelido que não é dona', { apelido: 'E21' }, 'apelido'],
  ['apelido de dona com maiúscula', { apelido: 'Dona' }, 'apelido'],
  ['papel que não é dona', { papel: 'E' }, 'papel'],
  ['sem item', { itens: [] }, 'itens'],
  ['mais de um item', { itens: ['F144', 'F145'] }, 'itens'],
  ['item que não é F<n>', { itens: ['x'] }, 'itens'],
  ['itens que não é lista', { itens: 'F144' }, 'itens'],
  ['propostoEm que não é data', { propostoEm: 'ontem' }, 'propostoEm'],
  ['sem projeto', { projeto: '' }, 'projeto'],
  ['sem orquestradoraId', { orquestradoraId: '' }, 'orquestradoraId'],
]) {
  test(`cartoes: recusa ${nome} e não grava nada`, () => {
    const r = painel(['set', 'cartoes', 'task_x', JSON.stringify(cartao(extra))]);
    assert.equal(r.exit, 1, r.out);
    assert.ok(r.err.includes(trecho), r.err);
    assert.ok(!existsSync(arq('task_x')));
  });
}
test('cartoes: delete apaga o documento (a orquestradora retira o cartão)', () => {
  painel(['set', 'cartoes', 'task_a', JSON.stringify(cartao())]);
  assert.ok(existsSync(arq('task_a')));
  assert.equal(painel(['delete', 'cartoes', 'task_a']).exit, 0);
  assert.ok(!existsSync(arq('task_a')));
});

// ---- cartoesResolvidos (pura) ----
const projetoDe = (r) => r.projeto ?? 'kit';
const linha = (titulo, extra = {}) => ({ sessionId: lid(9), title: titulo, isArchived: false, createdAt: iso(T), lastActivityAt: iso(T), ...extra });
const doc = (id, extra = {}) => ({ id, data: cartao(extra) });

test('cartoesResolvidos: a sessão `F<n> · <tema>` do item criada depois de propostoEm apaga; outro F não resolve', () => {
  assert.deepEqual(cartoesResolvidos({ cartoes: [doc('d')], linhas: [linha('F144 · cartão da dona')], projetoDe, agoraMs: T }), ['d']);
  assert.deepEqual(cartoesResolvidos({ cartoes: [doc('d')], linhas: [linha('F145 · outro item'), linha('F1440 · não é o F144')], projetoDe, agoraMs: T }), []);
});
test('cartoesResolvidos: sessão de ANTES de propostoEm fica (é a sessão antiga com o mesmo título)', () => {
  const antiga = linha('F144 · cartão da dona', { createdAt: iso(T - 3 * H), lastActivityAt: iso(T - 3 * H) });
  assert.deepEqual(cartoesResolvidos({ cartoes: [doc('a')], linhas: [antiga], projetoDe, agoraMs: T }), []);
});
test('cartoesResolvidos: sem createdAt usa lastActivityAt', () => {
  const sem = { sessionId: lid(9), title: 'F144 · cartão da dona', isArchived: false, lastActivityAt: iso(T) };
  assert.deepEqual(cartoesResolvidos({ cartoes: [doc('a')], linhas: [sem], projetoDe, agoraMs: T }), ['a']);
});
test('cartoesResolvidos: arquivada, de outro projeto ou de outro título não resolve', () => {
  const l = [linha('F144 · x', { isArchived: true }), linha('F144 · x', { projeto: 'outro' }), linha('F143 · x'), linha('🎛 orquestradora — kit')];
  assert.deepEqual(cartoesResolvidos({ cartoes: [doc('a')], linhas: l, projetoDe, agoraMs: T }), []);
});
test('cartoesResolvidos: passou de 12 h apaga, mesmo sem sessão; dentro das 12 h fica', () => {
  assert.equal(CARTAO_VALIDADE_H, 12);
  const velho = doc('v', { propostoEm: iso(T - 13 * H) });
  const novo = doc('n', { propostoEm: iso(T - 11 * H) });
  assert.deepEqual(cartoesResolvidos({ cartoes: [velho, novo], linhas: [], projetoDe, agoraMs: T }), ['v']);
});
test('cartoesResolvidos: sem a lista de sessões (null) só o prazo vale; sem propostoEm legível vale como vencido', () => {
  assert.deepEqual(cartoesResolvidos({ cartoes: [doc('n'), doc('v', { propostoEm: iso(T - 13 * H) })], linhas: null, projetoDe, agoraMs: T }), ['v']);
  assert.deepEqual(cartoesResolvidos({ cartoes: [doc('x', { propostoEm: 'lixo' })], linhas: [], projetoDe, agoraMs: T }), ['x']);
});

// ---- dentro da batida ----
test('batida apaga o cartão cuja sessão apareceu viva e o que passou de 12 h; o resto fica', () => {
  painel(['set', 'cartoes', 'task_vivo', JSON.stringify(cartao())]);
  painel(['set', 'cartoes', 'task_velho', JSON.stringify(cartao({ itens: ['F145'], propostoEm: iso(T - 13 * H) }))]);
  painel(['set', 'cartoes', 'task_espera', JSON.stringify(cartao({ itens: ['F146'] }))]);
  const f = join(base, 'sessoes.json');
  writeFileSync(f, JSON.stringify([{ sessionId: lid(9), title: 'F144 · cartão da dona', cwd: repo, isArchived: false, isRunning: false, createdAt: iso(T), lastActivityAt: iso(T) }]));
  const r = painel(['batida', '--sessoes', f, '--agora', iso(T)]);
  assert.equal(r.exit, 0, r.err);
  assert.deepEqual([...r.json().cartoesApagados].sort(), ['task_velho', 'task_vivo']);
  assert.ok(!existsSync(arq('task_vivo')) && !existsSync(arq('task_velho')));
  assert.ok(existsSync(arq('task_espera')));
});
test('batida --seco não apaga cartão, só informa', () => {
  painel(['set', 'cartoes', 'task_velho', JSON.stringify(cartao({ propostoEm: iso(T - 13 * H) }))]);
  const f = join(base, 'sessoes.json');
  writeFileSync(f, '[]');
  const r = painel(['batida', '--sessoes', f, '--agora', iso(T), '--seco']);
  assert.deepEqual(r.json().cartoesApagados, ['task_velho']);
  assert.ok(existsSync(arq('task_velho')));
});
