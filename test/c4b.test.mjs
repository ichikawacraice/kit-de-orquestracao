import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// c4b: os achados da V1 sobre a K6 (B1, B2, M1, M3 e os baixos do modelo/prosa), medidos no HEAD da K7.
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const KIT = join(RAIZ, 'cli', 'kit.mjs');
const casa = realpathSync(mkdtempSync(join(tmpdir(), 'kit-c4b-casa-')));
const git = (d, ...a) => execFileSync('git', ['-C', d, ...a], { timeout: 10000, killSignal: 'SIGKILL' });
const kit = (cwd, args, home = casa) => spawnSync('node', [KIT, ...args], {
  cwd, encoding: 'utf8', timeout: 60000, killSignal: 'SIGKILL',
  env: { ...process.env, HOME: home, CI: '' },
});
const ler = (d, ...p) => readFileSync(join(d, ...p), 'utf8');
const json = (d, ...p) => JSON.parse(ler(d, ...p));
const limpar = (...ds) => ds.forEach((d) => rmSync(d, { recursive: true, force: true }));
const saida = (r) => `${r.stdout}${r.stderr}`;
function pasta(arquivos = {}) {
  const d = realpathSync(mkdtempSync(join(tmpdir(), 'kit-c4b-')));
  git(d, 'init', '-q');
  for (const [f, c] of Object.entries(arquivos)) { mkdirSync(dirname(join(d, f)), { recursive: true }); writeFileSync(join(d, f), typeof c === 'string' ? c : `${JSON.stringify(c, null, 2)}\n`); }
  return d;
}
function foto(d) {
  const m = {};
  const anda = (dir) => { for (const n of readdirSync(dir)) { if (n === '.git') continue; const p = join(dir, n); if (statSync(p).isDirectory()) anda(p); else m[relative(d, p)] = readFileSync(p, 'utf8'); } };
  anda(d);
  return m;
}
const limpo = (r) => { assert.doesNotMatch(saida(r), /SyntaxError|\n\s+at |node:internal/, `stack trace cru na saída: ${saida(r)}`); };

describe('B1 — JSON inválido: recusa nomeando o arquivo, árvore intacta, sem stack trace', () => {
  for (const [arquivo, comando] of [
    ['.claude/settings.json', 'iniciar'], ['package.json', 'iniciar'], ['.claude/kit.json', 'iniciar'],
    ['.claude/settings.json', 'adotar'], ['package.json', 'adotar'], ['.claude/kit.json', 'adotar'],
  ]) {
    it(`${comando} com ${arquivo} inválido`, () => {
      const base = { [arquivo]: '{ruim' };
      if (comando === 'adotar') base['CLAUDE.md'] = '# meu\n';
      const d = pasta(base);
      try {
        const antes = foto(d);
        assert.ok(Object.keys(antes).length >= 1, 'insumo vazio');
        const r = kit(d, [comando]);
        assert.equal(r.status, 2, saida(r));
        assert.ok(saida(r).includes(arquivo), `a mensagem não nomeia ${arquivo}: ${saida(r)}`);
        limpo(r);
        assert.deepEqual(foto(d), antes, 'a árvore mudou');
      } finally { limpar(d); }
    });
  }

  it('atualizar e remover com o lock inválido, e remover com um JSON do projeto inválido', () => {
    const d = pasta({ 'CLAUDE.md': '# meu\n', 'package.json': { name: 'x', version: '1.0.0' } });
    try {
      assert.equal(kit(d, ['adotar']).status, 0);
      const lock = ler(d, '.claude', 'kit.lock.json');
      writeFileSync(join(d, '.claude', 'kit.lock.json'), '{ruim');
      for (const c of ['atualizar', 'remover', 'doutor']) {
        const antes = foto(d);
        const r = kit(d, [c]);
        assert.equal(r.status, 1, `${c}: ${saida(r)}`);
        assert.ok(saida(r).includes('kit.lock.json'), `${c}: ${saida(r)}`);
        limpo(r);
        assert.deepEqual(foto(d), antes, `${c} mexeu na árvore`);
      }
      writeFileSync(join(d, '.claude', 'kit.lock.json'), lock);
      writeFileSync(join(d, '.claude', 'settings.json'), '{ruim');
      const antes = foto(d);
      const r = kit(d, ['remover']);
      assert.equal(r.status, 1, saida(r));
      assert.ok(saida(r).includes('settings.json'), saida(r));
      limpo(r);
      assert.deepEqual(foto(d), antes, 'o remover gravou pela metade');
    } finally { limpar(d); }
  });
});

describe('B2 — test:suite existente nunca vira laço nem é sobrescrito', () => {
  it('test = "npm run test:suite" com test:suite próprio: o test vira o gate, o test:suite fica como estava', () => {
    const d = pasta({ 'package.json': { name: 'x', version: '1.0.0', scripts: { test: 'npm run test:suite', 'test:suite': 'node --test' } } });
    try {
      const r = kit(d, ['iniciar']);
      assert.equal(r.status, 0, saida(r));
      const p = json(d, 'package.json');
      assert.equal(p.scripts['test:suite'], 'node --test');
      assert.equal(p.scripts.test, 'node scripts/kit/a-vez-do-gate.mjs');
      assert.notEqual(p.scripts['test:suite'], 'npm run test:suite', 'laço');
      assert.equal(kit(d, ['remover']).status, 0);
      assert.deepEqual(json(d, 'package.json').scripts, { test: 'npm run test:suite', 'test:suite': 'node --test' }, 'o remover não devolveu os scripts');
    } finally { limpar(d); }
  });

  it('test:suite próprio e test diferente: não sobrescreve — recusa com a causa (nada gravado)', () => {
    const d = pasta({ 'package.json': { name: 'x', version: '1.0.0', scripts: { test: 'vitest run', 'test:suite': 'jest' } } });
    try {
      const antes = foto(d);
      const r = kit(d, ['iniciar']);
      assert.equal(r.status, 1, saida(r));
      assert.match(saida(r), /conflito.*test:suite/);
      assert.deepEqual(foto(d), antes);
    } finally { limpar(d); }
  });

  it('segunda rodada (CLAUDE.md e lock apagados): o test:suite da primeira fica; com o lock presente, recusa', () => {
    const d = pasta({ 'package.json': { name: 'x', version: '1.0.0', scripts: { test: 'vitest run' } } });
    try {
      assert.equal(kit(d, ['iniciar']).status, 0);
      assert.equal(json(d, 'package.json').scripts['test:suite'], 'vitest run');
      rmSync(join(d, 'CLAUDE.md'));
      const de = kit(d, ['iniciar']);
      assert.equal(de.status, 2, saida(de));
      assert.match(de.stderr, /kit\.lock\.json/);
      rmSync(join(d, '.claude', 'kit.lock.json'));
      const r = kit(d, ['iniciar']);
      assert.equal(r.status, 0, saida(r));
      const p = json(d, 'package.json');
      assert.equal(p.scripts['test:suite'], 'vitest run', 'a segunda rodada sobrescreveu o test:suite');
      assert.equal(p.scripts.test, 'node scripts/kit/a-vez-do-gate.mjs');
    } finally { limpar(d); }
  });
});

describe('M1 — pnpm-workspace: test e typecheck antigos não somem calados', () => {
  it('iniciar: vão para test:suite e typecheck:suite, a saída diz, e o remover devolve', () => {
    const scripts = { test: 'vitest run', typecheck: 'tsc -b', build: 'tsc' };
    const d = pasta({ 'package.json': { name: 'x', version: '1.0.0', scripts } });
    try {
      const r = kit(d, ['iniciar', '--perfil', 'pnpm-workspace']);
      assert.equal(r.status, 0, saida(r));
      const p = json(d, 'package.json');
      assert.equal(p.scripts['test:suite'], 'vitest run');
      assert.equal(p.scripts['typecheck:suite'], 'tsc -b');
      assert.equal(p.scripts.test, 'node scripts/kit/a-vez-do-gate.mjs');
      assert.equal(p.scripts.typecheck, 'node scripts/kit/o-typecheck-do-gate.mjs');
      assert.match(r.stdout, /scripts\.test.*test:suite/);
      assert.match(r.stdout, /scripts\.typecheck.*typecheck:suite/);
      assert.equal(kit(d, ['remover']).status, 0);
      assert.deepEqual(json(d, 'package.json').scripts, scripts);
    } finally { limpar(d); }
  });
});

describe('M3 — doutor diz o bloco, ignora o que é do projeto e confere só as chaves do kit', () => {
  const NOME = 'orquestracao@kit-de-orquestracao';
  const lar = () => {
    const h = realpathSync(mkdtempSync(join(tmpdir(), 'kit-c4b-home-')));
    mkdirSync(join(h, '.claude', 'plugins'), { recursive: true });
    writeFileSync(join(h, '.claude', 'plugins', 'installed_plugins.json'), JSON.stringify({ version: 2, plugins: { [NOME]: [{ scope: 'user' }], 'superpowers@claude-plugins-official': [{ scope: 'user' }] } }));
    writeFileSync(join(h, '.claude', 'settings.json'), JSON.stringify({ enabledPlugins: { 'superpowers@claude-plugins-official': true } }));
    return h;
  };
  // o aviso do placeholder do bloco projeto (c17.4) é esperado num CLAUDE.md recém-adotado; os testes abaixo medem outra coisa
  const semPlaceholder = (t) => t.split('\n').filter((l) => !/ainda tem o texto de preencher/.test(l)).join('\n');
  const adotado = (h) => {
    const d = pasta({ 'CLAUDE.md': '# meu\n', 'package.json': { name: 'x', version: '1.0.0', scripts: { test: 'vitest run' } } });
    assert.equal(kit(d, ['adotar', '--trocar-test'], h).status, 0);
    const base = kit(d, ['doutor'], h);
    assert.equal(base.status, 0, `base não está em dia: ${saida(base)}`);
    return d;
  };

  it('linha fora dos blocos, dependência nova e chave nova no settings não acusam', () => {
    const h = lar(); const d = adotado(h);
    try {
      writeFileSync(join(d, 'CLAUDE.md'), `${ler(d, 'CLAUDE.md')}\nMinha regra própria.\n`);
      const p = json(d, 'package.json'); p.dependencies = { left: '^1.0.0' }; writeFileSync(join(d, 'package.json'), `${JSON.stringify(p, null, 2)}\n`);
      const s = json(d, '.claude', 'settings.json'); s.model = 'opus'; writeFileSync(join(d, '.claude', 'settings.json'), `${JSON.stringify(s, null, 2)}\n`);
      const r = kit(d, ['doutor'], h);
      assert.equal(r.status, 0, saida(r));
      assert.doesNotMatch(semPlaceholder(r.stdout), /aviso|falha/);
    } finally { limpar(d, h); }
  });

  it('byte editado dentro de um bloco: nomeia o BLOCO, e só ele', () => {
    const h = lar(); const d = adotado(h);
    try {
      writeFileSync(join(d, 'CLAUDE.md'), ler(d, 'CLAUDE.md').replace('## Convenções de teste', '## Convenções de teste!'));
      const r = kit(d, ['doutor'], h);
      assert.match(r.stdout, /aviso: bloco convencoes-de-teste editado à mão/);
      assert.doesNotMatch(semPlaceholder(r.stdout), /bloco (projeto|comandos|regras|orquestradora)/);
    } finally { limpar(d, h); }
  });

  it('o que o kit escreveu e sumiu: hook da guarda → falha nomeando o settings.json; test fora do gate → aviso', () => {
    const h = lar(); const d = adotado(h);
    try {
      const s = json(d, '.claude', 'settings.json'); s.hooks.PreToolUse = []; writeFileSync(join(d, '.claude', 'settings.json'), `${JSON.stringify(s, null, 2)}\n`);
      const p = json(d, 'package.json'); p.scripts.test = 'vitest run'; writeFileSync(join(d, 'package.json'), `${JSON.stringify(p, null, 2)}\n`);
      const r = kit(d, ['doutor'], h);
      assert.equal(r.status, 1, saida(r));
      assert.match(r.stdout, /falha:.*hook da guarda.*settings\.json/);
      assert.match(r.stdout, /aviso:.*scripts\.test.*package\.json/);
    } finally { limpar(d, h); }
  });
});

describe('baixos — modelo e prosa', () => {
  const modelo = readFileSync(join(RAIZ, 'modelos', 'CLAUDE.md'), 'utf8');
  it('convencoes-de-teste traz a regra original do filho síncrono (sem process.exit, todo subprocesso com prazo)', () => {
    const bloco = modelo.match(/<!-- kit:convencoes-de-teste v1 -->[\s\S]*?<!-- \/kit:convencoes-de-teste -->/)?.[0] ?? '';
    assert.ok(bloco.length > 100, 'insumo vazio: bloco não achado');
    assert.match(bloco, /process\.exit\(\)/);
    assert.match(bloco, /prazo/);
    assert.doesNotMatch(bloco, /Processo filho de teste é síncrono/);
  });
  it('"commit em português" não é regra do modelo: vira campo a preencher no bloco projeto', () => {
    const operacao = modelo.match(/<!-- kit:regras-de-operacao v\d+ -->[\s\S]*?<!-- \/kit:regras-de-operacao -->/)?.[0] ?? '';
    assert.ok(operacao.length > 100);
    assert.doesNotMatch(operacao, /português/i);
    const projeto = modelo.match(/<!-- kit:projeto v1 -->[\s\S]*?<!-- \/kit:projeto -->/)?.[0] ?? '';
    assert.match(projeto, /commit/i);
  });
});
