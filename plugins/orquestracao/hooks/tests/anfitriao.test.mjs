#!/usr/bin/env node
// F438 (ADR 0030): o kit reconhece três anfitriões (claude-desktop, orca, terminal). A ordem: KIT_ANFITRIAO > chave
// `anfitriao` do .claude/kit.json (quando não é "auto") > sinais do ambiente. A contradição entre a chave e os sinais é
// devolvida para o aviso do início; o valor desconhecido vale "auto". quemSou() dá o endereço da sessão em cada anfitrião.
// Rodar: node --test hooks/tests/anfitriao.test.mjs   (nada lê o ambiente real: env e cwd entram por parâmetro)
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { anfitriao, quemSou, ANFITRIOES, ID_DO_ORCA } from '../anfitriao.mjs';

const APP = { CLAUDE_CODE_HOST_SESSION_ID: 'local_1b2c3d4e-0000-4000-8000-000000000001' };
const ORCA_ID = { ORCA_AGENT_SESSION_ID: '233c0ce8-1111-4222-8333-444455556666' };
const ORCA_ESTRUTURADA = { ORCA_STRUCTURED_SESSION: '1' };

// Um projeto temporário (com .git, que é onde a busca pelo kit.json para) e, se pedido, um .claude/kit.json.
function projeto(kit) {
  const dir = mkdtempSync(join(tmpdir(), 'anfitriao-'));
  mkdirSync(join(dir, '.git'));
  if (kit !== undefined) { mkdirSync(join(dir, '.claude')); writeFileSync(join(dir, '.claude', 'kit.json'), typeof kit === 'string' ? kit : JSON.stringify(kit)); }
  mkdirSync(join(dir, 'sub', 'pasta'), { recursive: true });
  return dir;
}
function com(kit, f) { const dir = projeto(kit); try { return f(dir); } finally { rmSync(dir, { recursive: true, force: true }); } }

test('a lista de anfitriões é a do ADR', () => {
  assert.deepEqual(ANFITRIOES, ['claude-desktop', 'orca', 'terminal']);
});

test('pelos sinais: cada combinação dá o anfitrião do ADR', () => {
  com(undefined, (cwd) => {
    const casos = [
      [APP, 'claude-desktop'],
      [ORCA_ID, 'orca'],
      [ORCA_ESTRUTURADA, 'orca'],
      [{ ...ORCA_ID, ...ORCA_ESTRUTURADA }, 'orca'],
      [{ ...APP, ...ORCA_ID, ...ORCA_ESTRUTURADA }, 'claude-desktop'], // o app traz as ferramentas de sessão: vence
      [{}, 'terminal'],
      [{ ORCA_STRUCTURED_SESSION: '0' }, 'terminal'],
      [{ CLAUDE_CODE_HOST_SESSION_ID: '' }, 'terminal'],
    ];
    for (const [env, esperado] of casos) {
      const r = anfitriao({ env, cwd });
      assert.equal(r.anfitriao, esperado, JSON.stringify(env));
      assert.equal(r.fonte, 'sinais');
      assert.equal(r.pelosSinais, esperado);
      assert.equal(r.contradicao, null);
    }
  });
});

test('KIT_ANFITRIAO vence a chave, e a chave vence os sinais', () => {
  com({ anfitriao: 'terminal' }, (cwd) => {
    const r = anfitriao({ env: { ...ORCA_ID, KIT_ANFITRIAO: 'claude-desktop' }, cwd });
    assert.equal(r.anfitriao, 'claude-desktop');
    assert.equal(r.fonte, 'env');
    const s = anfitriao({ env: ORCA_ID, cwd });
    assert.equal(s.anfitriao, 'terminal');
    assert.equal(s.fonte, 'chave');
  });
});

test('a chave é achada subindo de uma subpasta até a raiz do projeto', () => {
  com({ anfitriao: 'orca' }, (raiz) => {
    const r = anfitriao({ env: {}, cwd: join(raiz, 'sub', 'pasta') });
    assert.equal(r.anfitriao, 'orca');
    assert.equal(r.fonte, 'chave');
  });
});

test('"auto" e a chave ausente seguem os sinais', () => {
  for (const kit of [{ anfitriao: 'auto' }, { perfis: {} }, undefined, '{ isto não é json']) {
    com(kit, (cwd) => {
      const r = anfitriao({ env: ORCA_ID, cwd });
      assert.equal(r.anfitriao, 'orca', JSON.stringify(kit));
      assert.equal(r.fonte, 'sinais');
      assert.equal(r.desconhecido, null);
    });
  }
});

test('valor desconhecido vale "auto" e é devolvido (para o log)', () => {
  com({ anfitriao: 'vscode' }, (cwd) => {
    const r = anfitriao({ env: APP, cwd });
    assert.equal(r.anfitriao, 'claude-desktop');
    assert.equal(r.fonte, 'sinais');
    assert.equal(r.desconhecido, 'vscode');
  });
  com(undefined, (cwd) => {
    const r = anfitriao({ env: { ...ORCA_ID, KIT_ANFITRIAO: 'Orca!' }, cwd });
    assert.equal(r.anfitriao, 'orca');
    assert.equal(r.fonte, 'sinais');
    assert.equal(r.desconhecido, 'Orca!');
  });
});

test('a contradição entre a chave e os sinais é devolvida; sem contradição, null', () => {
  com({ anfitriao: 'claude-desktop' }, (cwd) => {
    const r = anfitriao({ env: ORCA_ID, cwd });
    assert.equal(r.anfitriao, 'claude-desktop');
    assert.equal(r.pelosSinais, 'orca');
    assert.ok(r.contradicao, 'a contradição deveria vir');
    assert.match(r.contradicao, /claude-desktop/);
    assert.match(r.contradicao, /orca/);
    assert.equal(anfitriao({ env: APP, cwd }).contradicao, null);
  });
});

test('quemSou: local_… no app, orca_session_id:<id> no Orca, null no terminal', () => {
  com(undefined, (cwd) => {
    assert.equal(quemSou({ env: APP, cwd }), APP.CLAUDE_CODE_HOST_SESSION_ID);
    assert.equal(quemSou({ env: ORCA_ID, cwd }), `orca_session_id:${ORCA_ID.ORCA_AGENT_SESSION_ID}`);
    const coordenadora = { ORCA_AGENT_SESSION_ID: 'claude_3c8ec4cb_1849_49ba_be37_f9215e9742a6' };
    assert.equal(quemSou({ env: coordenadora, cwd }), 'orca_session_id:claude_3c8ec4cb_1849_49ba_be37_f9215e9742a6');
    assert.match(quemSou({ env: coordenadora, cwd }), ID_DO_ORCA);
    assert.equal(quemSou({ env: {}, cwd }), null);
    // No Orca sem o id (só ORCA_STRUCTURED_SESSION) não há endereço; id com caractere estranho não vira endereço.
    assert.equal(quemSou({ env: ORCA_ESTRUTURADA, cwd }), null);
    assert.equal(quemSou({ env: { ORCA_AGENT_SESSION_ID: 'a b;rm' }, cwd }), null);
  });
});
