import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// K7: `kit adotar`, `atualizar`, `remover` e o `doutor` completo, sobre um projeto de rascunho que já tem CLAUDE.md, settings.json e package.json próprios.
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const KIT = join(RAIZ, 'cli', 'kit.mjs');
const sha = (s) => createHash('sha256').update(s).digest('hex');
const git = (d, ...a) => execFileSync('git', ['-C', d, ...a], { timeout: 10000, killSignal: 'SIGKILL' });
const casa = realpathSync(mkdtempSync(join(tmpdir(), 'kit-k7-casa-')));

const CLAUDE_PROPRIO = '# Rascunho\n\nMeu texto próprio.\n\n## Regras\n- uma\n- duas\n';
const SETTINGS_PROPRIO = `${JSON.stringify({
  permissions: { allow: ['Bash(ls:*)'] },
  hooks: { PreToolUse: [{ matcher: 'Edit', hooks: [{ type: 'command', command: 'echo meu' }] }] },
  enabledPlugins: { 'outro@x': true },
}, null, 4)}\n`;
const PACKAGE_PROPRIO = `${JSON.stringify({
  name: 'rascunho', version: '2.0.0', private: true,
  scripts: { test: 'node -e "console.log(\'suite-do-projeto\')"', build: 'tsc' },
  dependencies: { left: '^1.0.0' },
}, null, 2)}\n`;

function rascunho() {
  const d = realpathSync(mkdtempSync(join(tmpdir(), 'kit-k7-')));
  git(d, 'init', '-q');
  git(d, 'config', 'user.email', 't@k.local');
  git(d, 'config', 'user.name', 't');
  mkdirSync(join(d, '.claude'));
  mkdirSync(join(d, 'src'));
  writeFileSync(join(d, 'CLAUDE.md'), CLAUDE_PROPRIO);
  writeFileSync(join(d, '.claude', 'settings.json'), SETTINGS_PROPRIO);
  writeFileSync(join(d, 'package.json'), PACKAGE_PROPRIO);
  writeFileSync(join(d, 'src', 'index.ts'), 'export {}\n');
  return d;
}
function kit(cwd, args, { home = casa } = {}) {
  return spawnSync('node', [KIT, ...args], {
    cwd, encoding: 'utf8', timeout: 60000, killSignal: 'SIGKILL',
    env: { ...process.env, HOME: home, CI: '', KIT_GATE_TRAVA: join(home, 'gate.trava'), KIT_CONSERTO_TRAVA: join(home, 'conserto.trava'), KIT_GATE_VERDE_DIR: join(home, 'verde') },
  });
}
const ler = (d, ...p) => readFileSync(join(d, ...p), 'utf8');
const json = (d, ...p) => JSON.parse(ler(d, ...p));
const limpar = (...ds) => ds.forEach((d) => rmSync(d, { recursive: true, force: true }));
const saida = (r) => `${r.stdout}${r.stderr}`;

/** Foto da árvore (sem .git): caminho → conteúdo. */
function foto(d) {
  const mapa = {};
  const anda = (dir) => {
    for (const n of readdirSync(dir)) {
      if (n === '.git') continue;
      const p = join(dir, n);
      if (statSync(p).isDirectory()) anda(p); else mapa[relative(d, p)] = readFileSync(p, 'utf8');
    }
  };
  anda(d);
  return mapa;
}
/** `sub` está contido em `todo`: toda chave de `sub` existe em `todo` com o mesmo valor (objeto em profundidade, lista por prefixo). */
function contido(sub, todo, caminho = '') {
  if (Array.isArray(sub)) {
    assert.ok(Array.isArray(todo), `${caminho} deixou de ser lista`);
    sub.forEach((v, i) => contido(v, todo[i], `${caminho}[${i}]`));
  } else if (sub !== null && typeof sub === 'object') {
    for (const [k, v] of Object.entries(sub)) { assert.ok(k in todo, `${caminho}.${k} sumiu`); contido(v, todo[k], `${caminho}.${k}`); }
  } else assert.equal(todo, sub, `${caminho} mudou`);
}
const NOMES_DOS_BLOCOS = ['projeto', 'comandos', 'regras-de-operacao', 'regras-de-trabalho', 'convencoes-de-teste', 'orquestradora'];

describe('kit adotar', () => {
  it('--simular imprime o diff e não grava nada', () => {
    const d = rascunho();
    try {
      const antes = foto(d);
      assert.ok(Object.keys(antes).length >= 4, 'insumo vazio: fixture sem arquivos');
      const r = kit(d, ['adotar', '--simular']);
      assert.equal(r.status, 0, saida(r));
      assert.deepEqual(foto(d), antes, 'o --simular gravou algo');
      assert.equal(existsSync(join(d, '.claude', 'kit.lock.json')), false);
      for (const n of NOMES_DOS_BLOCOS) assert.match(r.stdout, new RegExp(`\\+<!-- kit:${n} v1 -->`), `o diff não mostra o bloco ${n}`);
      assert.match(r.stdout, /CLAUDE\.md/);
      assert.match(r.stdout, /settings\.json/);
      assert.doesNotMatch(r.stdout, /--- a\/package\.json/, 'sem --trocar-test o package.json não muda');
    } finally { limpar(d); }
  });

  it('não altera nenhum byte fora dos blocos e das chaves novas', () => {
    const d = rascunho();
    try {
      const antes = foto(d);
      const r = kit(d, ['adotar']);
      assert.equal(r.status, 0, saida(r));
      const claude = ler(d, 'CLAUDE.md');
      assert.ok(claude.startsWith(CLAUDE_PROPRIO), 'o texto próprio do CLAUDE.md mudou');
      for (const n of NOMES_DOS_BLOCOS) assert.match(claude, new RegExp(`<!-- kit:${n} v1 -->`));
      // settings: indentação de 4 preservada, tudo que era do projeto continua, hook próprio e hook da guarda convivem
      const sRaw = ler(d, '.claude', 'settings.json');
      assert.match(sRaw, /\n {4}"permissions"/, 'a indentação do settings.json mudou');
      contido(JSON.parse(SETTINGS_PROPRIO), JSON.parse(sRaw));
      const s = JSON.parse(sRaw);
      assert.equal(s.hooks.PreToolUse.length, 2);
      assert.equal(s.hooks.PreToolUse[0].hooks[0].command, 'echo meu');
      assert.equal(s.enabledPlugins['orquestracao@kit-de-orquestracao'], true);
      assert.equal(s.enabledPlugins['outro@x'], true);
      // package.json: tudo do projeto continua, `test` ainda é o dele
      contido(JSON.parse(PACKAGE_PROPRIO), json(d, 'package.json'));
      const p = json(d, 'package.json');
      assert.equal(p.scripts.test, JSON.parse(PACKAGE_PROPRIO).scripts.test, 'o `test` do projeto foi trocado sem --trocar-test');
      assert.equal(p.scripts['test:projeto'], undefined, 'sem --trocar-test não nasce test:projeto');
      assert.deepEqual(json(d, '.claude', 'kit.json'), { gate: { comandoCompleto: JSON.parse(PACKAGE_PROPRIO).scripts.test } });
      assert.match(r.stdout, /--trocar-test/, 'a saída não avisa do --trocar-test');
      assert.equal(ler(d, 'src', 'index.ts'), antes['src/index.ts']);
      const lock = json(d, '.claude', 'kit.lock.json');
      assert.deepEqual(Object.keys(lock.blocos), NOMES_DOS_BLOCOS);
      assert.ok(Object.keys(lock.arquivos).some((f) => f.startsWith('scripts/kit/')));
      assert.equal(lock.arquivos['CLAUDE.md'], undefined, 'o CLAUDE.md é do projeto: não entra como arquivo do kit');
      assert.equal(lock.arquivos['package.json'], undefined);
    } finally { limpar(d); }
  });

  it('--trocar-test: o `test` passa a ser o gate e o antigo vira test:projeto; `npm test` roda a suíte do projeto pelo gate', () => {
    const d = rascunho();
    try {
      const r = kit(d, ['adotar', '--trocar-test']);
      assert.equal(r.status, 0, saida(r));
      const p = json(d, 'package.json');
      assert.equal(p.scripts.test, 'node scripts/kit/a-vez-do-gate.mjs');
      assert.equal(p.scripts['test:projeto'], JSON.parse(PACKAGE_PROPRIO).scripts.test);
      assert.equal(p.scripts.build, 'tsc');
      git(d, 'add', '-A');
      git(d, 'commit', '-qm', 'base');
      const env = { ...process.env, CI: '', HOME: casa, KIT_GATE_TRAVA: join(casa, 'gate.trava'), KIT_CONSERTO_TRAVA: join(casa, 'conserto.trava'), KIT_GATE_VERDE_DIR: join(casa, 'verde') };
      const npm = spawnSync('npm', ['test'], { cwd: d, env, encoding: 'utf8', timeout: 90000, killSignal: 'SIGKILL' });
      assert.equal(npm.status, 0, saida(npm));
      assert.match(npm.stdout + npm.stderr, /suite-do-projeto/, 'o gate não rodou a suíte do projeto');
      assert.match(npm.stderr, /a vez é minha/, 'não passou pelo gate');
    } finally { limpar(d); }
  });

  const comConflitos = (d) => {
    const settings = JSON.parse(SETTINGS_PROPRIO);
    settings.enabledPlugins['orquestracao@kit-de-orquestracao'] = false;
    settings.extraKnownMarketplaces = { 'kit-de-orquestracao': { source: { source: 'github', repo: 'outro/fork' } } };
    writeFileSync(join(d, '.claude', 'settings.json'), `${JSON.stringify(settings, null, 4)}\n`);
    writeFileSync(join(d, '.claude', 'kit.json'), `${JSON.stringify({ gate: { comandoCompleto: 'make test' } }, null, 2)}\n`);
    const pkg = JSON.parse(PACKAGE_PROPRIO);
    pkg.scripts.typecheck = 'tsc --noEmit -p .';
    writeFileSync(join(d, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);
  };

  it('com conflito não grava NADA (atômico): lista os conflitos, sai 1, árvore idêntica; resolver e repetir adota', () => {
    const d = rascunho();
    try {
      comConflitos(d);
      const antes = foto(d);
      assert.ok(Object.keys(antes).length >= 4, 'insumo vazio: fixture sem arquivos');
      const hashes = (m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, sha(v)]));
      const r = kit(d, ['adotar', '--perfil', 'pnpm-workspace']);
      assert.equal(r.status, 1, saida(r));
      assert.match(r.stdout, /conflito.*orquestracao@kit-de-orquestracao/);
      assert.match(r.stdout, /conflito.*extraKnownMarketplaces/);
      assert.match(r.stdout, /conflito.*scripts\.typecheck/);
      assert.match(r.stdout, /nada foi gravado/);
      assert.match(r.stdout, /--parcial/);
      assert.deepEqual(hashes(foto(d)), hashes(antes), 'o adotar gravou algo apesar do conflito');
      assert.equal(existsSync(join(d, '.claude', 'kit.lock.json')), false);
      assert.equal(existsSync(join(d, 'scripts')), false);
      const de = kit(d, ['adotar', '--perfil', 'pnpm-workspace']);
      assert.equal(de.stdout, r.stdout, 'rodar de novo sem resolver deveria dar o mesmo resultado');
      // resolvido o conflito, a mesma chamada adota
      writeFileSync(join(d, '.claude', 'settings.json'), SETTINGS_PROPRIO);
      writeFileSync(join(d, '.claude', 'kit.json'), '{}\n');
      writeFileSync(join(d, 'package.json'), PACKAGE_PROPRIO);
      assert.equal(kit(d, ['adotar', '--perfil', 'pnpm-workspace']).status, 0);
    } finally { limpar(d); }
  });

  it('--parcial grava o resto, não troca o que conflita e o lock declara o pendente (o doutor o mostra)', () => {
    const d = rascunho();
    const h = realpathSync(mkdtempSync(join(tmpdir(), 'kit-k7-home-')));
    try {
      comConflitos(d);
      const r = kit(d, ['adotar', '--perfil', 'pnpm-workspace', '--parcial']);
      assert.equal(r.status, 1, saida(r));
      assert.match(r.stdout, /conflito.*scripts\.typecheck/);
      const s = json(d, '.claude', 'settings.json');
      assert.equal(s.enabledPlugins['orquestracao@kit-de-orquestracao'], false);
      assert.equal(s.extraKnownMarketplaces['kit-de-orquestracao'].source.repo, 'outro/fork');
      assert.equal(json(d, 'package.json').scripts.typecheck, 'tsc --noEmit -p .');
      assert.equal(json(d, '.claude', 'kit.json').gate.comandoCompleto, 'make test');
      assert.equal(json(d, '.claude', 'kit.json').gate.perfil, 'pnpm-workspace', 'a chave nova do perfil entra mesmo com conflito noutra');
      assert.match(ler(d, 'CLAUDE.md'), /<!-- kit:projeto v1 -->/, 'o resto (blocos) não foi gravado');
      const lock = json(d, '.claude', 'kit.lock.json');
      assert.equal(lock.pendente.length, 4, JSON.stringify(lock.pendente));
      assert.ok(lock.pendente.some((p) => /scripts\.typecheck/.test(p)) && lock.pendente.some((p) => /extraKnownMarketplaces/.test(p)));
      const dr = kit(d, ['doutor'], { home: h });
      assert.match(dr.stdout, /pendente da adoção:.*scripts\.typecheck/);
    } finally { limpar(d, h); }
  });

  it('recusa: projeto sem CLAUDE.md (aponta para iniciar) e projeto já adotado (aponta para atualizar)', () => {
    const d = rascunho();
    try {
      rmSync(join(d, 'CLAUDE.md'));
      const a = kit(d, ['adotar']);
      assert.equal(a.status, 2);
      assert.match(a.stderr, /kit iniciar/);
      writeFileSync(join(d, 'CLAUDE.md'), CLAUDE_PROPRIO);
      assert.equal(kit(d, ['adotar']).status, 0);
      const b = kit(d, ['adotar']);
      assert.equal(b.status, 2);
      assert.match(b.stderr, /kit atualizar/);
    } finally { limpar(d); }
  });
});

describe('kit atualizar', () => {
  const adotado = () => { const d = rascunho(); assert.equal(kit(d, ['adotar']).status, 0); return d; };

  it('arquivo e bloco intocados são trocados pela versão nova; o lock acompanha', () => {
    const d = adotado();
    try {
      const lockPath = join(d, '.claude', 'kit.lock.json');
      const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
      const alvo = 'scripts/kit/o-teto-de-workers.mjs';
      const original = ler(d, alvo);
      assert.ok(original.length > 0 && lock.arquivos[alvo], 'insumo vazio: arquivo do kit ausente');
      // finge a versão antiga: conteúdo antigo no disco e no lock (= usuário nunca mexeu)
      writeFileSync(join(d, alvo), '// versão antiga\n');
      lock.arquivos[alvo] = sha('// versão antiga\n');
      const claude = ler(d, 'CLAUDE.md');
      const antigoBloco = '<!-- kit:comandos v0 -->\nantigo\n<!-- /kit:comandos -->';
      const m = claude.match(/<!-- kit:comandos v1 -->[\s\S]*?<!-- \/kit:comandos -->/);
      writeFileSync(join(d, 'CLAUDE.md'), claude.replace(m[0], antigoBloco));
      lock.blocos.comandos = { versao: 0, sha256: sha('\nantigo\n') };
      lock.versao = '0.0.1';
      writeFileSync(lockPath, JSON.stringify(lock, null, 2));
      const r = kit(d, ['atualizar']);
      assert.equal(r.status, 0, saida(r));
      assert.equal(ler(d, alvo), original);
      assert.equal(ler(d, 'CLAUDE.md'), claude, 'o bloco não voltou para a versão atual');
      const novo = json(d, '.claude', 'kit.lock.json');
      assert.equal(novo.arquivos[alvo], sha(original));
      assert.equal(novo.blocos.comandos.versao, 1);
      assert.equal(novo.versao, json(RAIZ, 'package.json').version);
    } finally { limpar(d); }
  });

  it('bloco e arquivo editados à mão: conflito listado com o diff, nada trocado, exit 1', () => {
    const d = adotado();
    try {
      const alvo = 'scripts/kit/o-teto-de-workers.mjs';
      writeFileSync(join(d, alvo), `${ler(d, alvo)}// meu ajuste\n`);
      const claude = ler(d, 'CLAUDE.md').replace('## Comandos', '## Comandos (editado por mim)');
      writeFileSync(join(d, 'CLAUDE.md'), claude);
      const antes = foto(d);
      const lockAntes = ler(d, '.claude', 'kit.lock.json');
      const r = kit(d, ['atualizar']);
      assert.equal(r.status, 1, saida(r));
      assert.match(r.stdout, /conflito.*bloco comandos/);
      assert.match(r.stdout, /conflito.*o-teto-de-workers\.mjs/);
      assert.match(r.stdout, /\+\/\/ meu ajuste|-\/\/ meu ajuste/, 'sem o diff do arquivo');
      assert.match(r.stdout, /Comandos \(editado por mim\)/, 'sem o diff do bloco');
      assert.deepEqual(foto(d), antes, 'o atualizar mexeu no que estava editado');
      assert.equal(ler(d, '.claude', 'kit.lock.json'), lockAntes);
    } finally { limpar(d); }
  });
});

describe('kit remover', () => {
  it('devolve a árvore ao estado anterior (com --trocar-test também)', () => {
    for (const flags of [[], ['--trocar-test']]) {
      const d = rascunho();
      try {
        const antes = foto(d);
        assert.equal(kit(d, ['adotar', ...flags]).status, 0);
        assert.notDeepEqual(foto(d), antes, 'o adotar não mudou nada');
        const r = kit(d, ['remover']);
        assert.equal(r.status, 0, saida(r));
        assert.deepEqual(foto(d), antes, `a árvore não voltou (${flags.join(' ') || 'sem flags'})`);
      } finally { limpar(d); }
    }
  });

  it('o que foi mexido à mão fica, listado; o resto sai', () => {
    const d = rascunho();
    try {
      assert.equal(kit(d, ['adotar']).status, 0);
      const alvo = 'scripts/kit/o-teto-de-workers.mjs';
      writeFileSync(join(d, alvo), `${ler(d, alvo)}// meu ajuste\n`);
      writeFileSync(join(d, 'CLAUDE.md'), ler(d, 'CLAUDE.md').replace('## Comandos', '## Comandos (editado por mim)'));
      const r = kit(d, ['remover']);
      assert.equal(r.status, 0, saida(r));
      assert.match(r.stdout, /deixado.*o-teto-de-workers\.mjs/);
      assert.match(r.stdout, /deixado.*bloco comandos/);
      assert.ok(ler(d, alvo).includes('// meu ajuste'), 'apagou arquivo editado');
      assert.match(ler(d, 'CLAUDE.md'), /Comandos \(editado por mim\)/);
      assert.ok(!existsSync(join(d, 'scripts', 'kit', 'a-vez-do-gate.mjs')), 'arquivo intocado ficou');
      assert.ok(ler(d, 'CLAUDE.md').startsWith(CLAUDE_PROPRIO));
      assert.doesNotMatch(ler(d, 'CLAUDE.md'), /<!-- kit:projeto/, 'bloco intocado ficou');
    } finally { limpar(d); }
  });

  it('--simular lista e não grava; projeto criado por `iniciar` volta a pasta vazia', () => {
    const d = rascunho();
    const v = realpathSync(mkdtempSync(join(tmpdir(), 'kit-k7-vazio-')));
    try {
      assert.equal(kit(d, ['adotar']).status, 0);
      const meio = foto(d);
      const s = kit(d, ['remover', '--simular']);
      assert.equal(s.status, 0, saida(s));
      assert.deepEqual(foto(d), meio);
      assert.match(s.stdout, /scripts\/kit\/a-vez-do-gate\.mjs/);
      git(v, 'init', '-q');
      const antes = foto(v);
      assert.equal(kit(v, ['iniciar']).status, 0);
      assert.equal(kit(v, ['remover']).status, 0);
      assert.deepEqual(foto(v), antes, 'o remover não deixou a pasta como estava antes do iniciar');
    } finally { limpar(d, v); }
  });

  it('sem lock: exit 1 e aponta o que falta', () => {
    const d = rascunho();
    try {
      const r = kit(d, ['remover']);
      assert.equal(r.status, 1);
      assert.match(saida(r), /kit\.lock\.json/);
    } finally { limpar(d); }
  });
});

describe('kit doutor (completo)', () => {
  const NOME = 'orquestracao@kit-de-orquestracao';
  function lar({ instalado = true, settings } = {}) {
    const h = realpathSync(mkdtempSync(join(tmpdir(), 'kit-k7-home-')));
    mkdirSync(join(h, '.claude', 'plugins'), { recursive: true });
    writeFileSync(join(h, '.claude', 'plugins', 'installed_plugins.json'), JSON.stringify({ version: 2, plugins: instalado ? { [NOME]: [{ scope: 'user', installPath: '/x', version: '0.1.0' }] } : {} }));
    if (settings) writeFileSync(join(h, '.claude', 'settings.json'), JSON.stringify(settings));
    return h;
  }
  const hooksDoKit = () => [...JSON.stringify(json(RAIZ, 'plugins', 'orquestracao', 'hooks', 'hooks.json')).matchAll(/\/hooks\/([\w-]+\.mjs)/g)].map((m) => m[1]);

  it('tudo em dia: exit 0 e uma linha ok por verificação', () => {
    const d = rascunho();
    const h = lar();
    try {
      assert.equal(kit(d, ['adotar'], { home: h }).status, 0);
      const r = kit(d, ['doutor'], { home: h });
      assert.equal(r.status, 0, saida(r));
      for (const re of [/ok:.*plugin instalado na máquina: sim/, /ok:.*plugin habilitado no projeto: sim/, /ok:.*nenhum hook do kit/, /ok:.*kit\.json/, /ok:.*versão/, /ok:.*node/i, /ok:.*git/]) assert.match(r.stdout, re);
      assert.doesNotMatch(r.stdout, /falha:/);
    } finally { limpar(d, h); }
  });

  it('plugin não instalado ou não habilitado: exit 1 nomeando', () => {
    const d = rascunho();
    const h = lar({ instalado: false });
    try {
      assert.equal(kit(d, ['adotar'], { home: h }).status, 0);
      const r = kit(d, ['doutor'], { home: h });
      assert.equal(r.status, 1);
      assert.match(r.stdout, /falha:.*plugin instalado na máquina: não/);
      const h2 = lar();
      const s = json(d, '.claude', 'settings.json');
      s.enabledPlugins[NOME] = false;
      writeFileSync(join(d, '.claude', 'settings.json'), JSON.stringify(s));
      const r2 = kit(d, ['doutor'], { home: h2 });
      assert.equal(r2.status, 1);
      assert.match(r2.stdout, /falha:.*plugin habilitado no projeto: não/);
      limpar(h2);
    } finally { limpar(d, h); }
  });

  it('hook do kit também em ~/.claude/settings.json: exit 1 com o nome do .mjs', () => {
    const nomes = hooksDoKit();
    assert.ok(nomes.length >= 8, `insumo vazio: hooks do plugin = ${nomes.join()}`);
    const d = rascunho();
    const h = lar({ settings: { hooks: { Stop: [{ hooks: [{ type: 'command', command: `node "$HOME/.claude/hooks/${nomes[0]}"` }] }] } } });
    try {
      assert.equal(kit(d, ['adotar'], { home: h }).status, 0);
      const r = kit(d, ['doutor'], { home: h });
      assert.equal(r.status, 1);
      assert.match(r.stdout, new RegExp(`falha:.*${nomes[0].replace('.', '\\.')}`));
    } finally { limpar(d, h); }
  });

  it('kit.json inválido e lock de outra versão: exit 1 com os dois achados', () => {
    const d = rascunho();
    const h = lar();
    try {
      assert.equal(kit(d, ['adotar'], { home: h }).status, 0);
      writeFileSync(join(d, '.claude', 'kit.json'), JSON.stringify({ gate: { perfil: 'inexistente' } }));
      const lockPath = join(d, '.claude', 'kit.lock.json');
      writeFileSync(lockPath, JSON.stringify({ ...json(d, '.claude', 'kit.lock.json'), versao: '0.0.1' }));
      const r = kit(d, ['doutor'], { home: h });
      assert.equal(r.status, 1);
      assert.match(r.stdout, /falha:.*kit\.json.*inexistente/);
      assert.match(r.stdout, /falha:.*versão.*0\.0\.1.*kit atualizar/);
    } finally { limpar(d, h); }
  });
});
