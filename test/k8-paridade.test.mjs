import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRAR = join(RAIZ, 'scripts', 'k8', 'migrar.mjs');

describe('K8 — a paridade é o primeiro passo', () => {
  it('paridade ≠ 0 aborta com exit 1 antes de tocar em qualquer coisa', () => {
    const home = realpathSync(mkdtempSync(join(tmpdir(), 'kit-k8par-')));
    try {
      mkdirSync(join(home, '.claude'), { recursive: true });
      const settings = '{"hooks":{}}\n';
      writeFileSync(join(home, '.claude', 'settings.json'), settings);
      // insumo: com este HOME vazio a paridade do kit sai ≠ 0 (nenhum par existe)
      const par = spawnSync('node', [join(RAIZ, 'scripts', 'paridade.mjs')], { encoding: 'utf8', timeout: 60000, killSignal: 'SIGKILL', env: { ...process.env, KIT_PARIDADE_HOME: join(home, '.claude') } });
      assert.equal(par.status, 1, `insumo: a paridade devia sair 1\n${par.stdout}${par.stderr}`);
      const r = spawnSync('node', [MIGRAR, '--home', home, '--fonte', 'x'], { encoding: 'utf8', timeout: 60000, killSignal: 'SIGKILL', env: { ...process.env, HOME: home, KIT_HOME_REAL: home } });
      assert.equal(r.status, 1, `${r.stdout}${r.stderr}`);
      assert.match(`${r.stdout}${r.stderr}`, /paridade não deu 0.*NÃO tocou em nada/s);
      assert.equal(readFileSync(join(home, '.claude', 'settings.json'), 'utf8'), settings);
      assert.equal(existsSync(join(home, '.claude', 'orquestracao')), false, 'criou o backup');
    } finally { rmSync(home, { recursive: true, force: true }); }
  });
});
