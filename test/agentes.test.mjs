import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ENTRADA, planejarEntrada, contexto, executar } from '../cli/agentes.mjs';
import { sha256 } from '../cli/lock.mjs';

test('entrada Codex é criada, atualizada pelo hash e preserva regras do projeto', () => {
  const d = mkdtempSync(join(tmpdir(), 'kit-agentes-'));
  try {
    const lock = { arquivos: {} }; const mudancas = []; const conflitos = [];
    const planejar = () => planejarEntrada(d, lock, mudancas, (c) => conflitos.push(c));
    planejar();
    assert.equal(mudancas.length, 1);
    assert.equal(lock.arquivos['AGENTS.md'], sha256(ENTRADA));
    writeFileSync(join(d, 'AGENTS.md'), 'versão anterior');
    lock.arquivos['AGENTS.md'] = sha256('versão anterior');
    planejar();
    assert.equal(mudancas.length, 2);
    writeFileSync(join(d, 'AGENTS.md'), 'regras locais');
    planejar();
    assert.equal(conflitos.length, 1);
    delete lock.arquivos['AGENTS.md'];
    planejar();
    assert.equal(mudancas.length, 2);
  } finally { rmSync(d, { recursive: true, force: true }); }
});
test('catálogo e leitura usam o manual original; caminhos fora dele são recusados', () => {
  const c = contexto();
  assert.equal(c.codigo, 0);
  assert.match(c.saida, /plugins\/orquestracao\/pool\/dona.md/);
  const dona = contexto('plugins/orquestracao/pool/dona.md');
  assert.equal(dona.codigo, 0);
  assert.ok(dona.saida.length > 100);
  assert.equal(contexto('../../etc/passwd').codigo, 2);
  assert.equal(contexto('package.json').codigo, 2);
  assert.equal(executar('../hooks/segredo-sai', []).codigo, 2);
});

test('a guarda ORCA aplica modelo explícito e isolamento também ao Codex', async () => {
  const { decidir } = await import('../plugins/orquestracao/hooks/trava-do-orca.mjs');
  const base = 'orca orchestration worker-start --agent codex';
  const ctx = { cwd: tmpdir(), env: {} };
  const ok = decidir(`${base} --model modelo-codex --effort medium --worktree new-child --spec "Faça X"`, ctx);
  assert.ok(ok);
  assert.equal(ok.recusa, null);
  for (const flags of ['--worktree new-child', '--model sonnet --effort medium --worktree new-child', '--model modelo-codex --effort medium --worktree current']) {
    const r = decidir(`${base} ${flags} --spec "Faça X"`, ctx);
    assert.ok(r.recusa, JSON.stringify(r));
  }
});


test('recuperação reconhece AGENTS idêntico criado antes do lock, sem adotar arquivo alheio no fluxo normal', () => {
  const d = mkdtempSync(join(tmpdir(), 'kit-agentes-recuperacao-'));
  try {
    writeFileSync(join(d, 'AGENTS.md'), ENTRADA);
    const normal = { arquivos: {} }; const recuperado = { arquivos: {} };
    const mudancas = []; const conflito = (c) => assert.fail(c);
    planejarEntrada(d, normal, mudancas, conflito);
    assert.equal(normal.arquivos['AGENTS.md'], undefined);
    planejarEntrada(d, recuperado, mudancas, conflito, { recuperando: true });
    assert.equal(recuperado.arquivos['AGENTS.md'], sha256(ENTRADA));
    assert.equal(mudancas.length, 0);
  } finally { rmSync(d, { recursive: true, force: true }); }
});
