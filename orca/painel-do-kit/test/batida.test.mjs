// A batida de leitura que o worker da aba roda no Orca (F460, ADR 0032): quando roda e qual script. Nunca toca o ~/.claude
// real: o painel e o HOME são pastas temporárias.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { precisaDaBatida, scriptDaBatida, ambienteDaBatida, BATIDA_MIN } from '../src/nucleo/batida.mjs';

const MIN = 60_000;
const AGORA = Date.parse('2026-11-06T15:00:00Z');
function painelCom(deduzido) {
  const base = mkdtempSync(join(tmpdir(), 'f460-'));
  mkdirSync(join(base, 'painel'), { recursive: true });
  if (deduzido !== undefined) {
    mkdirSync(join(base, 'batida'), { recursive: true });
    writeFileSync(join(base, 'batida', 'deduzido.json'), typeof deduzido === 'string' ? deduzido : JSON.stringify(deduzido));
  }
  return join(base, 'painel');
}

test('precisa da batida: sem deduzido, ilegível ou com 10 min ou mais; não precisa com menos de 10 min', () => {
  assert.equal(BATIDA_MIN, 10);
  assert.equal(precisaDaBatida(painelCom(), AGORA), true, 'sem o arquivo');
  assert.equal(precisaDaBatida(painelCom('{quebrado'), AGORA), true, 'ilegível');
  assert.equal(precisaDaBatida(painelCom({ itens: {} }), AGORA), true, 'sem em');
  assert.equal(precisaDaBatida(painelCom({ em: new Date(AGORA - 10 * MIN).toISOString(), itens: {} }), AGORA), true, '10 min');
  assert.equal(precisaDaBatida(painelCom({ em: new Date(AGORA - 9 * MIN).toISOString(), itens: {} }), AGORA), false, '9 min');
  assert.equal(precisaDaBatida(painelCom({ em: new Date(AGORA + 1 * MIN).toISOString(), itens: {} }), AGORA), false, 'outra batida que começou depois');
});

function home(registro) {
  const h = mkdtempSync(join(tmpdir(), 'f460-home-'));
  mkdirSync(join(h, '.claude', 'plugins'), { recursive: true });
  if (registro) writeFileSync(join(h, '.claude', 'plugins', 'installed_plugins.json'), JSON.stringify(registro));
  return h;
}
function instalacao(h) {
  const p = join(h, 'cache', 'orquestracao', '0.1.200');
  mkdirSync(join(p, 'skills', 'orquestradora', 'scripts'), { recursive: true });
  writeFileSync(join(p, 'skills', 'orquestradora', 'scripts', 'painel.mjs'), '');
  return p;
}

test('o script da batida: a variável de teste, senão o painel.mjs do plugin orquestracao instalado no escopo do usuário', () => {
  assert.equal(scriptDaBatida({ env: { PAINEL_DO_KIT_SCRIPT: '/x/painel.mjs' }, home: home() }), '/x/painel.mjs');
  const h = home();
  const p = instalacao(h);
  writeFileSync(join(h, '.claude', 'plugins', 'installed_plugins.json'), JSON.stringify({ plugins: {
    'outro@x': [{ scope: 'user', installPath: '/nao' }],
    'orquestracao@ichikawa-kit': [{ scope: 'project', projectPath: '/p', installPath: '/projeto' }, { scope: 'user', installPath: p }],
  } }));
  assert.equal(scriptDaBatida({ env: {}, home: h }), join(p, 'skills', 'orquestradora', 'scripts', 'painel.mjs'));
});

test('sem o plugin no escopo do usuário, ou com o caminho sumido, não há script (a aba não roda nada)', () => {
  assert.equal(scriptDaBatida({ env: {}, home: home() }), null, 'sem installed_plugins.json');
  assert.equal(scriptDaBatida({ env: {}, home: home({ plugins: { 'orquestracao@ichikawa-kit': [{ scope: 'project', installPath: '/p' }] } }) }), null);
  assert.equal(scriptDaBatida({ env: {}, home: home({ plugins: { 'orquestracao@ichikawa-kit': [{ scope: 'user', installPath: '/nao/existe' }] } }) }), null);
});

test('o ambiente da batida: roda como Node no binário do Orca e grava onde a aba lê', () => {
  const e = ambienteDaBatida({ PATH: '/bin', PAINEL_DIR: '/t/painel' });
  assert.equal(e.ELECTRON_RUN_AS_NODE, '1');
  assert.equal(e.PATH, '/bin');
  assert.equal(e.HOOKS_CREWAI_BASE, '/t', 'com o painel trocado, a batida grava ao lado dele');
  assert.equal(ambienteDaBatida({ PAINEL_DIR: '/t/painel', HOOKS_CREWAI_BASE: '/b' }).HOOKS_CREWAI_BASE, '/b', 'o já dado vale');
  assert.equal(ambienteDaBatida({}).HOOKS_CREWAI_BASE, undefined, 'sem nada trocado, os padrões do painel.mjs');
});
