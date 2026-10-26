// F51 T1: perguntas que a própria sessão abriu (hook de início e `painel list --sessao`). Nunca toca ~/.claude real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { perguntasDaSessao, textoDasPerguntas } from '../perguntas-da-sessao.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const PAINEL_MJS = join(AQUI, '..', '..', 'skills', 'orquestradora', 'scripts', 'painel.mjs');
const AGORA = Date.parse('2026-10-26T12:00:00Z');
const horasAtras = (h) => new Date(AGORA - h * 3_600_000).toISOString();

function novoPainel(perguntas) {
  const base = mkdtempSync(join(tmpdir(), 'perg-sessao-'));
  const dir = join(base, 'perguntas');
  mkdirSync(dir);
  for (const [id, data] of Object.entries(perguntas)) writeFileSync(join(dir, `${id}.json`), JSON.stringify({ id, version: 1, data }));
  return { base, dir };
}
const q = (sessaoId, extra = {}) => ({ sessaoId, titulo: `título ${sessaoId}`, caso: 'o caso', estado: 'aberta', criadaEm: horasAtras(5), ...extra });
const ids = (l) => l.map((p) => p.id);

test('abertas e respondidas recentes da própria sessão entram; as de outra sessão não', () => {
  const { base, dir } = novoPainel({
    Q1: q('A'),
    Q2: q('A', { estado: 'respondida', resposta: 'sim', respondidaEm: horasAtras(1) }),
    Q3: q('B'),
  });
  try {
    assert.deepEqual(ids(perguntasDaSessao('B', { dir, agora: AGORA }).abertas), ['Q3'], 'a presença da Q3 seria detectada');
    const r = perguntasDaSessao('A', { dir, agora: AGORA });
    assert.deepEqual(ids(r.abertas), ['Q1']);
    assert.deepEqual(ids(r.respondidas), ['Q2']);
    assert.equal(r.respondidas[0].resposta, 'sim');
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('respondida há mais de 24 h e cancelada ficam de fora', () => {
  const { base, dir } = novoPainel({
    Q4: q('A', { estado: 'respondida', resposta: 'x', respondidaEm: horasAtras(25) }),
    Q5: q('A', { estado: 'cancelada' }),
  });
  try {
    const larga = perguntasDaSessao('A', { dir, agora: AGORA, janelaMs: 30 * 3_600_000 });
    assert.deepEqual(ids(larga.respondidas), ['Q4'], 'prova de presença com a janela larga');
    const padrao = perguntasDaSessao('A', { dir, agora: AGORA });
    assert.deepEqual(ids(padrao.respondidas), []);
    assert.deepEqual(ids(padrao.abertas), []);
    assert.deepEqual(ids(larga.abertas), []);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('arquivo quebrado é pulado e o resto lê', () => {
  const { base, dir } = novoPainel({ Q1: q('A') });
  try {
    writeFileSync(join(dir, 'Q6.json'), '{');
    assert.deepEqual(ids(perguntasDaSessao('A', { dir, agora: AGORA }).abertas), ['Q1']);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('pasta ausente e localId vazio → listas vazias', () => {
  assert.deepEqual(perguntasDaSessao('A', { dir: join(tmpdir(), 'nao-existe-perg-xyz') }), { abertas: [], respondidas: [] });
  const { base, dir } = novoPainel({ Q1: q('A') });
  try {
    assert.deepEqual(perguntasDaSessao('', { dir }), { abertas: [], respondidas: [] });
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('mais novas primeiro', () => {
  const { base, dir } = novoPainel({
    Q1: q('A', { criadaEm: horasAtras(9) }),
    Q2: q('A', { criadaEm: horasAtras(2) }),
  });
  try { assert.deepEqual(ids(perguntasDaSessao('A', { dir, agora: AGORA }).abertas), ['Q2', 'Q1']); }
  finally { rmSync(base, { recursive: true, force: true }); }
});

test('textoDasPerguntas', () => {
  assert.equal(textoDasPerguntas({ abertas: [], respondidas: [] }, 'A'), '');
  const longo = 'c'.repeat(250);
  const t = textoDasPerguntas({
    abertas: [{ id: 'Q1', titulo: 'T1', caso: longo }],
    respondidas: [{ id: 'Q2', titulo: 'T2', caso: 'curto', resposta: 'sim' }],
  }, 'A');
  assert.ok(t.length > 0);
  assert.ok(t.includes('Perguntas que ESTA sessão (A)'));
  assert.ok(t.includes('- Q1 · '));
  assert.ok(t.includes('resposta: sim'));
  assert.ok(t.includes(`${'c'.repeat(200)}…`) && !t.includes('c'.repeat(201)));
  const muitas = Array.from({ length: 12 }, (_, i) => ({ id: `Q${i + 10}`, titulo: 't', caso: 'c' }));
  const t2 = textoDasPerguntas({ abertas: muitas, respondidas: [] }, 'A');
  assert.equal((t2.match(/^- Q/gm) || []).length, 10);
  assert.ok(t2.includes('- e mais 2'));
  assert.ok(!t2.includes('Respondidas nas últimas 24 h'));
});

function painel(base, ...args) {
  return spawnSync('node', [PAINEL_MJS, ...args], { encoding: 'utf8', timeout: 10000, killSignal: 'SIGKILL', env: { ...process.env, PAINEL_DIR: base, CLAUDE_CODE_SESSION_ID: '' } });
}

test('painel list perguntas aberta --sessao A devolve só as de A; sem valor é erro', () => {
  const { base } = novoPainel({ Q1: q('A'), Q3: q('B'), Q2: q('A', { estado: 'respondida' }) });
  try {
    const todas = JSON.parse(painel(base, 'list', 'perguntas', 'aberta').stdout);
    assert.deepEqual(ids(todas).sort(), ['Q1', 'Q3'], 'sem o filtro as duas aparecem');
    const r = painel(base, 'list', 'perguntas', 'aberta', '--sessao', 'A');
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(ids(JSON.parse(r.stdout)), ['Q1']);
    const e = painel(base, 'list', 'perguntas', 'aberta', '--sessao');
    assert.equal(e.status, 1);
    assert.match(e.stderr, /--sessao pede o local_… da sessão/);
  } finally { rmSync(base, { recursive: true, force: true }); }
});
