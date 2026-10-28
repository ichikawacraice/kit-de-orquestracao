#!/usr/bin/env node
// F147: doc × código — o caminho que o mod grava (`<HOME>/.claude/orquestracao/limpeza/<local_…>.json`) é o que a T7 lê por padrão
// (sem PAINEL_DIR), e o ok do botão vale só nas condições da D4 do plano.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PLUGIN = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const COMUM = pathToFileURL(join(PLUGIN, 'hooks', 'pool-comum.mjs')).href;

function lerOk(home, localId) {
  const r = spawnSync('node', ['--input-type=module', '-e', `import { okDoBotaoDeLimpar } from '${COMUM}'; process.stdout.write(JSON.stringify(okDoBotaoDeLimpar(${JSON.stringify(localId)})));`], {
    encoding: 'utf8', timeout: 15000, killSignal: 'SIGKILL', env: { ...process.env, HOME: home, PAINEL_DIR: '' },
  });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

test('o mod grava onde a T7 lê: sem PAINEL_DIR, <HOME>/.claude/orquestracao/limpeza/<local_…>.json', () => {
  const mod = readFileSync(join(PLUGIN, '..', 'painel-sessoes', 'hooks', 'register.tsx'), 'utf8');
  assert.ok(mod.length > 0, 'register.tsx vazio');
  assert.match(mod, /\$\{BASE_ORQUESTRACAO\}\/limpeza/, 'o mod não grava em BASE_ORQUESTRACAO/limpeza');
  assert.match(mod, /const BASE_ORQUESTRACAO = '\.claude\/orquestracao'/);
  const home = mkdtempSync(join(tmpdir(), 'limpeza-botao-'));
  try {
    assert.equal(lerOk(home, 'local_ORQ'), null, 'sem arquivo: null (o teste mede a presença abaixo)');
    mkdirSync(join(home, '.claude', 'orquestracao', 'limpeza'), { recursive: true });
    const arq = join(home, '.claude', 'orquestracao', 'limpeza', 'local_ORQ.json');
    writeFileSync(arq, JSON.stringify({ em: new Date().toISOString(), por: 'barra' }));
    const ok = lerOk(home, 'local_ORQ');
    assert.ok(ok && Number.isFinite(ok.em), `o arquivo do caminho do mod não foi lido: ${JSON.stringify(ok)}`);
    assert.equal(lerOk(home, 'local_OUTRA'), null, 'arquivo de outra sessão não vale');
    assert.equal(lerOk(home, '../local_ORQ'), null, 'id com ../ é recusado');
  } finally { rmSync(home, { recursive: true, force: true }); }
});

test('F219 o mod lê a marca de volta onde a T7 a grava: <BASE>/volta-da-limpeza/<local_…>.json', () => {
  const mod = readFileSync(join(PLUGIN, '..', 'painel-sessoes', 'hooks', 'register.tsx'), 'utf8');
  const comum = readFileSync(join(PLUGIN, 'hooks', 'pool-comum.mjs'), 'utf8');
  assert.ok(mod.length > 0 && comum.length > 0, 'arquivo vazio');
  assert.match(mod, /\$\{BASE_ORQUESTRACAO\}\/volta-da-limpeza/, 'o mod não lê em BASE_ORQUESTRACAO/volta-da-limpeza');
  assert.match(comum, /'\.\.', 'volta-da-limpeza'/, 'a T7 não grava em <PAINEL_DIR>/../volta-da-limpeza');
});
