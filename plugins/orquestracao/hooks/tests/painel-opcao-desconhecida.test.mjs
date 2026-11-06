// F433: `painel set|update|delete` com argumento sobrando (opção desconhecida) recusa sem gravar.
// PAINEL_DIR e HOME são pastas temporárias: nunca toca o painel real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PAINEL = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'skills', 'orquestradora', 'scripts', 'painel.mjs');

function com(fn) {
  const base = mkdtempSync(join(tmpdir(), 'painel-opcao-'));
  mkdirSync(join(base, 'home'));
  const painel = (...args) => spawnSync('node', [PAINEL, ...args], { encoding: 'utf8', timeout: 30000, killSignal: 'SIGKILL', env: { ...process.env, PAINEL_DIR: join(base, 'painel'), HOME: join(base, 'home'), CLAUDE_CODE_SESSION_ID: '', CLAUDE_CODE_HOST_SESSION_ID: '' } });
  try { fn(painel, join(base, 'painel')); } finally { rmSync(base, { recursive: true, force: true }); }
}
const arquivos = (dir) => (existsSync(dir) ? readdirSync(dir, { recursive: true }).filter((n) => String(n).endsWith('.json')) : []);

test('painel set/update/delete: argumento sobrando recusa (exit 1) e não grava nem apaga', () => com((painel, dir) => {
  const dado = '{"titulo":"Fatia 1","etapa":"planejamento","tema":"editor","frente":"builder","estado":"aberto","proximoPapel":"exec","aplicaMigration":false,"historico":[]}';
  assert.equal(painel('temas', 'add', 'editor', 'Editor').status, 0);
  // precondição: sem sobra o set grava (o teste mede de verdade)
  const ok = painel('set', 'fila', 'F1', dado);
  assert.equal(ok.status, 0, ok.stderr);
  const antes = arquivos(dir);
  assert.ok(antes.length > 0, 'precondição: o documento existe');
  const conteudo = readFileSync(join(dir, antes[0]), 'utf8');
  for (const cmd of ['set', 'update']) {
    const r = painel(cmd, 'fila', 'F2', dado, '--ajuda');
    assert.notEqual(r.status, 0, `${cmd}: ${r.stdout}`);
    assert.match(r.stderr, /argumento desconhecido: --ajuda/, r.stderr);
  }
  const d = painel('delete', 'fila', 'F1', '--ajuda');
  assert.notEqual(d.status, 0, d.stdout);
  assert.match(d.stderr, /argumento desconhecido: --ajuda/, d.stderr);
  assert.deepEqual(arquivos(dir), antes, 'nada novo, nada apagado');
  assert.equal(readFileSync(join(dir, antes[0]), 'utf8'), conteudo);
}));
