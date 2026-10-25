import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// c13: temas.json semeado pelo painel na primeira gravação, o doutor diz se existe, e a regra do merge sem rebase em dia na SKILL.
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAINEL = join(RAIZ, 'plugins', 'orquestracao', 'skills', 'orquestradora', 'scripts', 'painel.mjs');
const SKILL = join(RAIZ, 'plugins', 'orquestracao', 'skills', 'orquestradora', 'SKILL.md');
const git = (d, ...a) => execFileSync('git', ['-C', d, ...a], { encoding: 'utf8', timeout: 10000, killSignal: 'SIGKILL' });
const novo = () => realpathSync(mkdtempSync(join(tmpdir(), 'kit-c13-')));
const painel = (dir, ...args) => spawnSync('node', [PAINEL, ...args], {
  encoding: 'utf8', timeout: 30000, killSignal: 'SIGKILL',
  env: { PATH: process.env.PATH, HOME: join(dir, 'home'), PAINEL_DIR: join(dir, 'painel') },
});
const ITEM = JSON.stringify({ titulo: 't', etapa: 'planejamento', tema: 'geral', estado: 'aberto' });

describe('c13 — temas.json semeado pelo painel', () => {
  it('instalação nova: a primeira gravação cria temas.json com o tema geral, grava o item e avisa uma vez no stderr', () => {
    const d = novo();
    try {
      const arq = join(d, 'painel', 'temas.json');
      assert.equal(existsSync(arq), false);
      const r = painel(d, 'update', 'fila', 'F1', ITEM);
      assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
      const temas = JSON.parse(readFileSync(arq, 'utf8'));
      assert.ok(temas.length > 0);
      assert.equal(temas[0].id, 'geral');
      assert.match(r.stderr, /temas\.json/);
      assert.ok(existsSync(join(d, 'painel', 'fila', 'F1.json')));
      const r2 = painel(d, 'update', 'fila', 'F2', ITEM);
      assert.equal(r2.status, 0, `${r2.stdout}${r2.stderr}`);
      assert.doesNotMatch(r2.stderr, /temas\.json/, 'avisou de novo');
    } finally { rmSync(d, { recursive: true, force: true }); }
  });
  it('temas.json existente fica intocado, byte a byte, e não avisa', () => {
    const d = novo();
    try {
      mkdirSync(join(d, 'painel'), { recursive: true });
      const meu = '[ { "id": "editor", "rotulo": "Editor", "projeto": "x" } ]\n';
      writeFileSync(join(d, 'painel', 'temas.json'), meu);
      const r = painel(d, 'update', 'fila', 'F1', JSON.stringify({ titulo: 't', etapa: 'planejamento', tema: 'editor', estado: 'aberto' }));
      assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
      assert.equal(readFileSync(join(d, 'painel', 'temas.json'), 'utf8'), meu);
      assert.doesNotMatch(r.stderr, /temas\.json/);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });
  it('temas.json ilegível NÃO é recriado por cima: a gravação recusa e o arquivo fica como está', () => {
    const d = novo();
    try {
      mkdirSync(join(d, 'painel'), { recursive: true });
      writeFileSync(join(d, 'painel', 'temas.json'), '{quebrado');
      const r = painel(d, 'update', 'fila', 'F1', ITEM);
      assert.notEqual(r.status, 0);
      assert.equal(readFileSync(join(d, 'painel', 'temas.json'), 'utf8'), '{quebrado');
    } finally { rmSync(d, { recursive: true, force: true }); }
  });
  it('o doutor diz se o temas.json existe', () => {
    const d = novo(); const home = novo();
    try {
      git(d, 'init', '-q'); git(d, 'config', 'user.email', 't@k.local'); git(d, 'config', 'user.name', 't');
      mkdirSync(join(d, '.claude')); writeFileSync(join(d, 'CLAUDE.md'), '# R\n');
      writeFileSync(join(d, 'package.json'), JSON.stringify({ name: 'r', version: '1.0.0', scripts: { test: 'node -e "0"' } }));
      writeFileSync(join(d, '.claude', 'settings.json'), '{}\n'); git(d, 'add', '-A'); git(d, 'commit', '-qm', 'b');
      const env = { ...process.env, HOME: home, CI: '', KIT_GATE_TRAVA: join(home, 'gate.trava'), KIT_GATE_VERDE_DIR: join(home, 'verde') };
      delete env.PAINEL_DIR; delete env.IZANAGI_PAINEL_DIR;
      const kit = (...a) => spawnSync('node', [join(RAIZ, 'cli', 'kit.mjs'), ...a], { cwd: d, encoding: 'utf8', timeout: 60000, killSignal: 'SIGKILL', env });
      assert.equal(kit('adotar').status, 0);
      assert.match(kit('doutor').stdout, /info: temas\.json ausente/);
      mkdirSync(join(home, '.claude', 'orquestracao', 'painel'), { recursive: true });
      writeFileSync(join(home, '.claude', 'orquestracao', 'painel', 'temas.json'), '[{"id":"geral"}]');
      const s = kit('doutor').stdout;
      assert.match(s, /ok: temas\.json do painel existe/);
      assert.doesNotMatch(s, /temas\.json ausente/);
    } finally { rmSync(d, { recursive: true, force: true }); rmSync(home, { recursive: true, force: true }); }
  });
});

describe('c13 — regra do merge sem rebase em dia, genérica, na SKILL da orquestradora', () => {
  const t = readFileSync(SKILL, 'utf8');
  it('traz o merge-tree, o --match-head-commit e o destino de cada status', () => {
    assert.ok(t.length > 1000);
    assert.match(t, /git merge-tree --write-tree origin\/<integração> <Y>/);
    assert.match(t, /gh pr merge <n> --squash --match-head-commit <Y>/);
    assert.match(t, /só o status 0 mergeia/);
    assert.match(t, /Status 1 com `CONFLICT`/);
    assert.match(t, /cobra o rebase delas quando o PR tem conflito com a branch de integração/);
    assert.match(t, /Ela confere que o PR entra sem conflito/);
  });
  it('sem ADR e sem Izanagi na regra', () => {
    const trecho = t.split('\n').filter((l) => /merge-tree|match-head-commit/.test(l)).join('\n');
    assert.ok(trecho.length > 0);
    assert.doesNotMatch(trecho, /izanagi|ADR \d|develop|pnpm/i);
  });
});
