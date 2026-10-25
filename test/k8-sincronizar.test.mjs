import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SINC = join(RAIZ, 'scripts', 'k8', 'sincronizar.mjs');
const git = (d, ...a) => execFileSync('git', ['-C', d, ...a], { encoding: 'utf8', timeout: 10000, killSignal: 'SIGKILL' });

// Um repo com o plugin e uma "viva" falsos. `hooks/pool-comum.mjs` não é declarado na paridade; `hooks/executor-criterio.mjs` é.
function cenario() {
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'kit-sinc-')));
  const repo = join(base, 'repo'); const plugin = join(repo, 'plugins', 'orquestracao'); const viva = join(base, 'claude');
  for (const [d, arqs] of [[plugin, { 'hooks/pool-comum.mjs': 'velho\n', 'hooks/executor-criterio.mjs': 'adaptado-plugin\n', 'hooks/outro.mjs': 'igual\n' }],
    [viva, { 'hooks/pool-comum.mjs': 'novo\n', 'hooks/executor-criterio.mjs': 'novo-vivo\n', 'hooks/outro.mjs': 'igual\n' }]]) {
    for (const [r, t] of Object.entries(arqs)) { mkdirSync(join(d, r, '..'), { recursive: true }); writeFileSync(join(d, r), t); }
  }
  mkdirSync(repo, { recursive: true }); git(repo, 'init', '-q'); git(repo, 'config', 'user.email', 't@k.local'); git(repo, 'config', 'user.name', 't');
  git(repo, 'add', '-A'); git(repo, 'commit', '-qm', 'base');
  const env = { ...process.env, KIT_PARIDADE_HOME: viva, KIT_PARIDADE_PLUGIN: plugin };
  const sinc = (...a) => spawnSync('node', [SINC, ...a], { encoding: 'utf8', timeout: 60000, killSignal: 'SIGKILL', env });
  return { base, repo, plugin, viva, sinc, ler: (rel) => readFileSync(join(plugin, rel), 'utf8') };
}

describe('K8 — sincronizar.mjs: porte deliberado, um item por vez', () => {
  it('--listar nomeia cada diferença e diz se é declarada', () => {
    const c = cenario();
    try {
      const r = c.sinc('--listar');
      const s = `${r.stdout}${r.stderr}`;
      assert.equal(r.status, 0, s);
      assert.match(s, /hooks\/pool-comum\.mjs {2}\[sem declaração/);
      assert.match(s, /hooks\/executor-criterio\.mjs {2}\[declarada: prefixo \+ painel/);
      assert.doesNotMatch(s, /hooks\/outro\.mjs/);
    } finally { rmSync(c.base, { recursive: true, force: true }); }
  });
  it('copia só o arquivo passado, mostra o diff e grava um commit sync(<rótulo>) só com ele', () => {
    const c = cenario();
    try {
      const antes = git(c.repo, 'rev-list', '--count', 'HEAD').trim();
      const r = c.sinc('F28', 'hooks/pool-comum.mjs');
      const s = `${r.stdout}${r.stderr}`;
      assert.equal(r.status, 0, s);
      assert.match(s, /^-velho$/m); assert.match(s, /^\+novo$/m);
      assert.equal(c.ler('hooks/pool-comum.mjs'), 'novo\n');
      assert.equal(c.ler('hooks/executor-criterio.mjs'), 'adaptado-plugin\n', 'copiou o que não foi pedido');
      assert.equal(Number(git(c.repo, 'rev-list', '--count', 'HEAD').trim()), Number(antes) + 1);
      assert.match(git(c.repo, 'log', '-1', '--format=%s').trim(), /^sync\(F28\): hooks\/pool-comum\.mjs$/);
      assert.equal(git(c.repo, 'show', '--name-only', '--format=', 'HEAD').trim(), 'plugins/orquestracao/hooks/pool-comum.mjs');
    } finally { rmSync(c.base, { recursive: true, force: true }); }
  });
  it('arquivo com diferença declarada recusa (exit 2) e não copia nem commita; --forcar copia', () => {
    const c = cenario();
    try {
      const antes = git(c.repo, 'rev-parse', 'HEAD').trim();
      const r = c.sinc('F28', 'hooks/executor-criterio.mjs');
      assert.equal(r.status, 2, `${r.stdout}${r.stderr}`);
      assert.match(r.stderr, /diferença declarada/);
      assert.equal(c.ler('hooks/executor-criterio.mjs'), 'adaptado-plugin\n');
      assert.equal(git(c.repo, 'rev-parse', 'HEAD').trim(), antes);
      const f = c.sinc('F28', 'hooks/executor-criterio.mjs', '--forcar');
      assert.equal(f.status, 0, `${f.stdout}${f.stderr}`);
      assert.equal(c.ler('hooks/executor-criterio.mjs'), 'novo-vivo\n');
    } finally { rmSync(c.base, { recursive: true, force: true }); }
  });
  it('arquivo inexistente na viva ou fora das pastas do plugin: exit 2, nada muda', () => {
    const c = cenario();
    try {
      const antes = git(c.repo, 'rev-parse', 'HEAD').trim();
      for (const rel of ['hooks/nao-existe.mjs', '.claude-plugin/plugin.json']) {
        const r = c.sinc('F28', rel);
        assert.equal(r.status, 2, `${rel}: ${r.stdout}${r.stderr}`);
      }
      assert.equal(git(c.repo, 'rev-parse', 'HEAD').trim(), antes);
      assert.equal(c.ler('hooks/pool-comum.mjs'), 'velho\n');
    } finally { rmSync(c.base, { recursive: true, force: true }); }
  });
});
