import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// c6 (ressalvas da V1 no c5): recuperação depois de processo morto, exit 2 nas recusas, laço no gate, CRLF e BOM.
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const KIT = join(RAIZ, 'cli', 'kit.mjs');
const git = (d, ...a) => execFileSync('git', ['-C', d, ...a], { encoding: 'utf8', timeout: 10000, killSignal: 'SIGKILL' });
const casa = realpathSync(mkdtempSync(join(tmpdir(), 'kit-c6-casa-')));
const ler = (d, ...p) => readFileSync(join(d, ...p), 'utf8');
const json = (d, ...p) => JSON.parse(ler(d, ...p));
const limpar = (...ds) => ds.forEach((d) => rmSync(d, { recursive: true, force: true }));
const saida = (r) => `${r.stdout}${r.stderr}`;
const ENV = (extra = {}) => ({ ...process.env, HOME: casa, CI: '', KIT_GATE_TRAVA: join(casa, 'gate.trava'), KIT_CONSERTO_TRAVA: join(casa, 'conserto.trava'), KIT_GATE_VERDE_DIR: join(casa, 'verde'), ...extra });
const kit = (cwd, args, extra) => spawnSync('node', [KIT, ...args], { cwd, encoding: 'utf8', timeout: 60000, killSignal: 'SIGKILL', env: ENV(extra) });

const SUITE = `node -e "console.log('suite-do-projeto')"`;
const PACOTE = `${JSON.stringify({ name: 'r', version: '1.0.0', scripts: { test: SUITE } }, null, 2)}\n`;
function repo(arquivos = {}) {
  const d = realpathSync(mkdtempSync(join(tmpdir(), 'kit-c6-')));
  git(d, 'init', '-q'); git(d, 'config', 'user.email', 't@k.local'); git(d, 'config', 'user.name', 't'); git(d, 'config', 'core.autocrlf', 'false');
  for (const [rel, t] of Object.entries(arquivos)) { mkdirSync(join(d, rel, '..'), { recursive: true }); writeFileSync(join(d, rel), t); }
  if (Object.keys(arquivos).length) { git(d, 'add', '-A'); git(d, 'commit', '-qm', 'base'); }
  return d;
}
function arvore(d) {
  const mapa = {};
  const anda = (dir) => {
    for (const n of readdirSync(dir)) {
      if (n === '.git') continue;
      const p = join(dir, n);
      if (statSync(p).isDirectory()) { mapa[`${relative(d, p)}/`] = 'pasta'; anda(p); } else mapa[relative(d, p)] = readFileSync(p, 'utf8');
    }
  };
  anda(d);
  return mapa;
}
/** Roda `comando` com um preload que mata o processo (SIGKILL) quando ele vai fazer o N-ésimo rename de um `.kit-tmp`. */
function morreNoRename(d, args, n) {
  const pre = join(casa, `mata-${n}.cjs`);
  writeFileSync(pre, `const fs = require('fs'); const real = fs.renameSync; let i = 0;
fs.renameSync = function (a, b) { if (String(a).endsWith('.kit-tmp') && ++i === ${n}) process.kill(process.pid, 'SIGKILL'); return real.apply(this, arguments); };\n`);
  return spawnSync('node', ['-r', pre, KIT, ...args], { cwd: d, encoding: 'utf8', timeout: 60000, killSignal: 'SIGKILL', env: ENV() });
}

describe('M1 — recuperação depois de processo morto no meio', () => {
  for (const n of [6, 12]) {
    it(`iniciar morto no rename ${n} → adotar conclui, npm test roda a suíte do projeto, remover devolve o estado de antes`, () => {
      const d = repo({ 'package.json': PACOTE });
      try {
        const antes = arvore(d);
        const morto = morreNoRename(d, ['iniciar'], n);
        assert.equal(morto.signal, 'SIGKILL', `o preload não matou o processo: ${saida(morto)}`);
        assert.ok(existsSync(join(d, 'CLAUDE.md')), 'insumo: o iniciar não chegou a gravar nada');
        assert.ok(!existsSync(join(d, '.claude', 'kit.lock.json')), 'insumo: o lock não devia existir');
        // sem o conserto o adotar daria test:projeto inexistente; aqui ele tem de reconhecer o estado
        const r = kit(d, ['adotar']);
        assert.equal(r.status, 0, saida(r));
        assert.match(r.stdout, /recuperado:/);
        assert.ok(!Object.keys(arvore(d)).some((k) => k.endsWith('.kit-tmp')), 'sobrou .kit-tmp');
        assert.ok(existsSync(join(d, '.claude', 'kit.lock.json')));
        assert.equal(json(d, '.claude', 'kit.json').gate.comandoCompleto, 'npm run test:suite');
        assert.equal(json(d, 'package.json').scripts['test:suite'], SUITE);
        assert.notEqual(json(d, 'package.json').scripts.test, SUITE);
        const t = spawnSync('npm', ['test'], { cwd: d, encoding: 'utf8', timeout: 120000, killSignal: 'SIGKILL', env: ENV() });
        assert.equal(t.status, 0, saida(t));
        assert.match(saida(t), /suite-do-projeto/);
        const rm = kit(d, ['remover']);
        assert.equal(rm.status, 0, saida(rm));
        assert.match(rm.stdout, /instalação recuperada/);
        assert.deepEqual(arvore(d), antes, 'o remover não devolveu o estado de antes do primeiro comando');
      } finally { limpar(d); }
    });
  }
  it('test já é o gate e não há onde achar a suíte: recusa com exit 2 dizendo o que fazer', () => {
    const d = repo({ 'package.json': PACOTE });
    try {
      const morto = morreNoRename(d, ['iniciar'], 12);
      assert.equal(morto.signal, 'SIGKILL');
      const p = json(d, 'package.json'); delete p.scripts['test:suite'];
      writeFileSync(join(d, 'package.json'), `${JSON.stringify(p, null, 2)}\n`);
      const r = kit(d, ['adotar']);
      assert.equal(r.status, 2, saida(r));
      assert.match(r.stderr, /não sei qual era a suíte/);
      assert.match(r.stderr, /git checkout package\.json/);
      assert.ok(!existsSync(join(d, '.claude', 'kit.lock.json')), 'gravou lock apesar da recusa');
    } finally { limpar(d); }
  });
});

describe('M2 — toda recusa sai com código ≠ 0 (as de uso, 2)', () => {
  it('as recusas do CLI', () => {
    const adotado = repo({ 'CLAUDE.md': '# x\n', 'package.json': PACOTE });
    const semClaude = repo();
    const comClaude = repo({ 'CLAUDE.md': '# x\n' });
    const invalido = repo({ 'CLAUDE.md': '# x\n', 'package.json': '{ meio' });
    try {
      assert.equal(kit(adotado, ['adotar']).status, 0);
      const casos = [
        [adotado, ['adotar', '--trocar-test'], 2], [adotado, ['iniciar'], 2], [semClaude, ['adotar'], 2], [comClaude, ['iniciar'], 2],
        [semClaude, ['iniciar', '--perfil', 'nada'], 2], [invalido, ['adotar'], 2], [semClaude, ['voar'], 2],
        [semClaude, ['atualizar'], 1], [semClaude, ['remover'], 1], [semClaude, ['doutor'], 1],
      ];
      for (const [dir, args, esperado] of casos) {
        const r = kit(dir, args);
        assert.equal(r.status, esperado, `${args.join(' ')}: exit ${r.status} (${saida(r)})`);
        assert.notEqual(r.status, 0);
      }
    } finally { limpar(adotado, semClaude, comClaude, invalido); }
  });
  it('o aviso de pendente aponta o caminho real, e `atualizar --trocar-test` o percorre', () => {
    const d = repo({ 'CLAUDE.md': '# x\n', 'package.json': PACOTE });
    try {
      assert.equal(kit(d, ['adotar']).status, 0);
      assert.match(json(d, '.claude', 'kit.lock.json').pendente[0], /kit atualizar --trocar-test/);
      const dr = kit(d, ['doutor']).stdout;
      assert.match(dr, /aviso: pendente da adoção:.*kit atualizar --trocar-test/);
      const r = kit(d, ['atualizar', '--trocar-test']);
      assert.equal(r.status, 0, saida(r));
      assert.match(r.stdout, /trocado: scripts\.test/);
      const p = json(d, 'package.json');
      assert.match(p.scripts.test, /scripts\/kit\//);
      assert.equal(p.scripts['test:projeto'], SUITE);
      assert.equal(json(d, '.claude', 'kit.json').gate.comandoCompleto, 'npm run test:projeto');
      assert.equal(json(d, '.claude', 'kit.lock.json').pendente, undefined);
      const t = spawnSync('npm', ['test'], { cwd: d, encoding: 'utf8', timeout: 120000, killSignal: 'SIGKILL', env: ENV() });
      assert.equal(t.status, 0, saida(t));
      assert.match(saida(t), /suite-do-projeto/);
      assert.doesNotMatch(kit(d, ['doutor']).stdout, /aviso: pendente/);
      assert.equal(kit(d, ['remover']).status, 0);
      assert.equal(git(d, 'status', '--porcelain').trim(), '');
    } finally { limpar(d); }
  });
});

describe('Laço — o gate não pode chamar o `test` que é ele mesmo', () => {
  it('carregarConfig recusa comandoCompleto que invoca o test, nomeando o campo', async () => {
    const { carregarConfig } = await import('../gate/config.mjs');
    for (const c of ['npm test', 'npm run test', 'pnpm test', 'yarn test', 'cd x && npm test -- --run', 'npm run test --silent']) {
      assert.throws(() => carregarConfig('/x', { gate: { comandoCompleto: c } }), /gate\.comandoCompleto/, c);
    }
    for (const c of ['npm run test:suite', 'node --test', 'yarn test:unit', 'pnpm run testar', 'npm run suite']) {
      assert.doesNotThrow(() => carregarConfig('/x', { gate: { comandoCompleto: c } }), c);
    }
  });
});

describe('CRLF e BOM', () => {
  it('CRLF continua CRLF no adotar e o remover devolve o original', () => {
    const crlf = (t) => t.replace(/\n/g, '\r\n');
    const d = repo({
      'CLAUDE.md': crlf('# x\n\nmeu texto\n'),
      'package.json': crlf(PACOTE),
      '.claude/settings.json': crlf(`${JSON.stringify({ permissions: { allow: ['Bash(ls:*)'] } }, null, 2)}\n`),
    });
    try {
      assert.equal(git(d, 'status', '--porcelain').trim(), '');
      const r = kit(d, ['adotar', '--trocar-test']);
      assert.equal(r.status, 0, saida(r));
      for (const f of ['CLAUDE.md', 'package.json', '.claude/settings.json']) {
        const t = ler(d, f);
        assert.ok(t.includes('\r\n'), `${f} perdeu o CRLF`);
        assert.ok(!/(^|[^\r])\n/.test(t), `${f} ficou com LF solto`);
      }
      assert.equal(kit(d, ['remover']).status, 0);
      assert.equal(git(d, 'status', '--porcelain').trim(), '', git(d, 'diff'));
    } finally { limpar(d); }
  });
  it('JSON com BOM é lido e regravado com o BOM; o remover devolve os bytes', () => {
    const bom = '﻿';
    const d = repo({
      'CLAUDE.md': '# x\n',
      'package.json': bom + PACOTE,
      '.claude/settings.json': `${bom}${JSON.stringify({ permissions: { allow: ['Bash(ls:*)'] } }, null, 2)}\n`,
    });
    try {
      const r = kit(d, ['adotar', '--trocar-test']);
      assert.equal(r.status, 0, saida(r));
      assert.ok(ler(d, 'package.json').startsWith(bom), 'package.json perdeu o BOM');
      assert.ok(ler(d, '.claude/settings.json').startsWith(bom), 'settings.json perdeu o BOM');
      assert.equal(JSON.parse(ler(d, 'package.json').slice(1)).scripts['test:projeto'], SUITE);
      assert.equal(kit(d, ['doutor']).stdout.includes('ilegível'), false);
      assert.equal(kit(d, ['remover']).status, 0);
      assert.equal(git(d, 'status', '--porcelain').trim(), '', git(d, 'diff'));
    } finally { limpar(d); }
  });
});
