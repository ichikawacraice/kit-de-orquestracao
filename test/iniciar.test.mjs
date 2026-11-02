import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// `kit iniciar` e `kit doutor` (K6). Tudo em pasta temporária com `git init`; HOME e a trava do gate também são temporários.
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const KIT = join(RAIZ, 'cli', 'kit.mjs');
const sha = (s) => createHash('sha256').update(s).digest('hex');

function pasta({ git = true } = {}) {
  const d = realpathSync(mkdtempSync(join(tmpdir(), 'kit-iniciar-')));
  if (git) execFileSync('git', ['init', '-q', d], { timeout: 10000, killSignal: 'SIGKILL' });
  return d;
}
// HOME e a trava/verde do gate ficam FORA da pasta do projeto: arquivo novo dentro dela mudaria a árvore e o verde nunca pularia.
const casa = realpathSync(mkdtempSync(join(tmpdir(), 'kit-casa-')));
const kit = (cwd, ...args) => spawnSync('node', [KIT, ...args], {
  cwd, encoding: 'utf8', timeout: 30000, killSignal: 'SIGKILL',
  env: { ...process.env, HOME: casa, CI: '' },
});
const ler = (d, ...p) => readFileSync(join(d, ...p), 'utf8');
const json = (d, ...p) => JSON.parse(ler(d, ...p));
const limpar = (d) => rmSync(d, { recursive: true, force: true });

describe('kit iniciar — perfil simples (o padrão), em pasta vazia', () => {
  it('grava CLAUDE.md, kit.json, scripts/kit, package.json, settings.json e o lock', () => {
    const d = pasta();
    try {
      const r = kit(d, 'iniciar');
      assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
      for (const f of ['CLAUDE.md', '.claude/kit.json', '.claude/settings.json', '.claude/kit.lock.json', 'package.json']) assert.ok(existsSync(join(d, f)), `falta ${f}`);
      const claude = ler(d, 'CLAUDE.md');
      assert.ok(claude.startsWith(`# ${basename(d)}\n`), 'o título leva o nome da pasta');
      assert.equal((claude.match(/<!-- kit:[a-z-]+ v\d+ -->/g) || []).length, 8);
      const kj = json(d, '.claude/kit.json');
      assert.deepEqual(kj.gate, { comandoCompleto: 'npm run test:suite' });
      assert.deepEqual(Object.keys(kj).sort(), ['design', 'documentos', 'gate'], 'as seções documentos e design (K14) entram sem o conferir');
      const gate = readdirSync(join(RAIZ, 'gate')).filter((f) => f.endsWith('.mjs')).sort();
      assert.ok(gate.length >= 7, 'insumo vazio: gate/ sem scripts');
      assert.deepEqual(readdirSync(join(d, 'scripts', 'kit')).sort(), gate, 'scripts/kit = cópia do gate/ (só os .mjs, sem test/)');
      for (const f of gate) assert.equal(ler(d, 'scripts/kit', f), readFileSync(join(RAIZ, 'gate', f), 'utf8'), `${f} difere do gate/`);
      const p = json(d, 'package.json');
      assert.equal(p.scripts.test, 'node scripts/kit/a-vez-do-gate.mjs');
      assert.equal(p.scripts['test:suite'], 'node --test --test-concurrency=${KIT_FICHAS_TOMADAS:-2}');
      for (const f of ['o-teto-da-maquina.mjs', 'com-fichas.mjs']) assert.ok(existsSync(join(d, 'scripts', 'kit', f)), `falta scripts/kit/${f}: a guarda e o gate dependem do teto da máquina`);
      assert.equal(p.scripts.typecheck, undefined, 'o perfil simples não tem typecheck');
    } finally { limpar(d); }
  });

  it('settings.json: o hook da guarda do projeto e o marketplace/plugins do kit', () => {
    const d = pasta();
    try {
      assert.equal(kit(d, 'iniciar').status, 0);
      const s = json(d, '.claude/settings.json');
      const hooks = s.hooks.PreToolUse;
      assert.equal(hooks.length, 1);
      assert.equal(hooks[0].matcher, 'Bash');
      assert.equal(hooks[0].hooks[0].command, 'node "$CLAUDE_PROJECT_DIR/scripts/kit/guarda-de-operacao.mjs"');
      assert.equal(s.extraKnownMarketplaces['kit-de-orquestracao'].source.repo, 'ichikawacraice/kit-de-orquestracao');
      assert.deepEqual(s.enabledPlugins, { 'orquestracao@kit-de-orquestracao': true, 'painel-sessoes@kit-de-orquestracao': true, 'processos@kit-de-orquestracao': true, 'design@kit-de-orquestracao': true });
    } finally { limpar(d); }
  });

  it('depois do iniciar, `npm test` passa pelo gate (e o segundo pula pelo verde da árvore)', () => {
    const d = pasta();
    try {
      assert.equal(kit(d, 'iniciar').status, 0);
      execFileSync('git', ['-C', d, 'config', 'user.email', 't@k.local'], { timeout: 10000, killSignal: 'SIGKILL' });
      execFileSync('git', ['-C', d, 'config', 'user.name', 't'], { timeout: 10000, killSignal: 'SIGKILL' });
      execFileSync('git', ['-C', d, 'add', '-A'], { timeout: 10000, killSignal: 'SIGKILL' });
      execFileSync('git', ['-C', d, 'commit', '-qm', 'base'], { timeout: 10000, killSignal: 'SIGKILL' });
      const env = { ...process.env, CI: '', HOME: casa, KIT_GATE_TRAVA: join(casa, 'gate.trava'), KIT_CONSERTO_TRAVA: join(casa, 'conserto.trava'), KIT_GATE_VERDE_DIR: join(casa, 'verde') };
      const npm = () => spawnSync('npm', ['test'], { cwd: d, env, encoding: 'utf8', timeout: 90000, killSignal: 'SIGKILL' });
      const a = npm();
      assert.equal(a.status, 0, `${a.stdout}${a.stderr}`);
      assert.match(a.stderr, /a vez é minha/);
      const b = npm();
      assert.equal(b.status, 0, `${b.stdout}${b.stderr}`);
      assert.match(b.stderr, /verde/i);
      assert.doesNotMatch(b.stderr, /a vez é minha/, 'o segundo gate sobre a mesma árvore não roda de novo');
    } finally { limpar(d); }
  });

  it('o lock traz a versão, o perfil e o sha256 de cada arquivo e de cada bloco, e bate com o disco', () => {
    const d = pasta();
    try {
      assert.equal(kit(d, 'iniciar').status, 0);
      const lock = json(d, '.claude/kit.lock.json');
      assert.equal(lock.versao, json(RAIZ, 'package.json').version);
      assert.equal(lock.perfil, 'simples');
      const arquivos = Object.keys(lock.arquivos);
      assert.ok(arquivos.includes('CLAUDE.md') && arquivos.includes('.claude/kit.json') && arquivos.includes('scripts/kit/a-vez-do-gate.mjs'), arquivos.join());
      assert.ok(!arquivos.includes('.claude/kit.lock.json'), 'o lock não lista a si mesmo');
      for (const [f, h] of Object.entries(lock.arquivos)) assert.equal(h, sha(ler(d, f)), `hash de ${f}`);
      assert.deepEqual(Object.keys(lock.blocos), ['projeto', 'comandos', 'regras-de-operacao', 'regras-de-trabalho', 'documentos', 'design', 'convencoes-de-teste', 'orquestradora']);
      const claude = ler(d, 'CLAUDE.md');
      for (const [nome, b] of Object.entries(lock.blocos)) {
        assert.equal(b.versao, { 'regras-de-trabalho': 4, comandos: 3, documentos: 2, 'regras-de-operacao': 3, orquestradora: 2 }[nome] ?? 1); // c18 subiu para v2; K10 para v3; o teste isolado (ADR 0005) subiu `comandos` para v2; o diário por entrada (ADR 0006) subiu `documentos` para v2; o modelo da dona (F179) subiu `comandos` para v3 e `regras-de-operacao` e `orquestradora` para v2; o CI só no PR para a main (F298) subiu `regras-de-operacao` para v3; a análise do pedido (F318) subiu `regras-de-trabalho` para v4
        const m = new RegExp(`<!-- kit:${nome} v${b.versao} -->([\\s\\S]*?)<!-- /kit:${nome} -->`).exec(claude);
        assert.ok(m, `bloco ${nome} sumiu`);
        assert.equal(b.sha256, sha(m[1]), `hash do bloco ${nome}`);
      }
    } finally { limpar(d); }
  });
});

describe('kit iniciar — perfil pnpm-workspace', () => {
  it('kit.json do perfil e scripts test/typecheck → gate, sem test:suite', () => {
    const d = pasta();
    try {
      const r = kit(d, 'iniciar', '--perfil', 'pnpm-workspace');
      assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
      const k = json(d, '.claude/kit.json');
      assert.equal(k.gate.perfil, 'pnpm-workspace');
      assert.equal(k.gate.pacotes, 'auto');
      const p = json(d, 'package.json');
      assert.equal(p.scripts.test, 'node scripts/kit/a-vez-do-gate.mjs');
      assert.equal(p.scripts.typecheck, 'node scripts/kit/o-typecheck-do-gate.mjs');
      assert.equal(p.scripts['test:suite'], undefined);
      assert.equal(json(d, '.claude/kit.lock.json').perfil, 'pnpm-workspace');
    } finally { limpar(d); }
  });
});

describe('kit iniciar — o que ele recusa e o que preserva', () => {
  it('recusa repo que já tem CLAUDE.md: exit 2, nada escrito', () => {
    const d = pasta();
    try {
      writeFileSync(join(d, 'CLAUDE.md'), '# meu\n');
      const r = kit(d, 'iniciar');
      assert.equal(r.status, 2);
      assert.match(r.stderr, /CLAUDE\.md/);
      assert.equal(ler(d, 'CLAUDE.md'), '# meu\n');
      assert.ok(!existsSync(join(d, '.claude')), 'escreveu .claude apesar de recusar');
      assert.ok(!existsSync(join(d, 'scripts')), 'escreveu scripts apesar de recusar');
    } finally { limpar(d); }
  });

  it('perfil desconhecido: exit 2 e nada escrito', () => {
    const d = pasta();
    try {
      const r = kit(d, 'iniciar', '--perfil', 'xyz');
      assert.equal(r.status, 2);
      assert.match(r.stderr, /xyz/);
      assert.deepEqual(readdirSync(d).filter((f) => f !== '.git'), []);
    } finally { limpar(d); }
  });

  it('package.json existente: preserva campos e o `test` antigo vira `test:suite`', () => {
    const d = pasta();
    try {
      writeFileSync(join(d, 'package.json'), JSON.stringify({ name: 'meu-app', version: '2.0.0', scripts: { test: 'vitest run', build: 'tsc' }, dependencies: { a: '1' } }, null, 2));
      assert.equal(kit(d, 'iniciar').status, 0);
      const p = json(d, 'package.json');
      assert.equal(p.name, 'meu-app');
      assert.equal(p.version, '2.0.0');
      assert.deepEqual(p.dependencies, { a: '1' });
      assert.equal(p.scripts.build, 'tsc');
      assert.equal(p.scripts.test, 'node scripts/kit/a-vez-do-gate.mjs');
      assert.equal(p.scripts['test:suite'], 'vitest run');
    } finally { limpar(d); }
  });

  it('settings.json existente: preserva as chaves alheias e não duplica o hook', () => {
    const d = pasta();
    try {
      mkdirSync(join(d, '.claude'));
      writeFileSync(join(d, '.claude', 'settings.json'), JSON.stringify({ permissions: { allow: ['Bash(ls)'] }, hooks: { PreToolUse: [{ matcher: 'Edit', hooks: [{ type: 'command', command: 'echo x' }] }] }, enabledPlugins: { 'outro@m': true } }));
      assert.equal(kit(d, 'iniciar').status, 0);
      const s = json(d, '.claude/settings.json');
      assert.deepEqual(s.permissions, { allow: ['Bash(ls)'] });
      assert.equal(s.hooks.PreToolUse.length, 2);
      assert.equal(s.enabledPlugins['outro@m'], true);
      assert.equal(s.enabledPlugins['orquestracao@kit-de-orquestracao'], true);
    } finally { limpar(d); }
  });
});

describe('kit doutor: lê o lock (o diagnóstico completo está em k7.test.mjs)', () => {
  it('sem lock: exit 1 e diz que não há .claude/kit.lock.json', () => {
    const d = pasta();
    try {
      const r = kit(d, 'doutor');
      assert.equal(r.status, 1);
      assert.match(r.stderr + r.stdout, /kit\.lock\.json/);
    } finally { limpar(d); }
  });

  it('com lock em dia: exit 0, versão, perfil e a contagem de arquivos; arquivo editado → exit 1 nomeando-o', () => {
    const d = pasta();
    try {
      assert.equal(kit(d, 'iniciar').status, 0);
      const lock = json(d, '.claude/kit.lock.json');
      const n = Object.keys(lock.arquivos).length;
      assert.ok(n >= 10, `poucos arquivos no lock: ${n}`);
      // o doutor completo exige o plugin instalado: planta o registro dele na casa temporária
      mkdirSync(join(casa, '.claude', 'plugins'), { recursive: true });
      writeFileSync(join(casa, '.claude', 'plugins', 'installed_plugins.json'), JSON.stringify({ version: 2, plugins: { 'orquestracao@kit-de-orquestracao': [{ scope: 'user' }], 'superpowers@claude-plugins-official': [{ scope: 'user' }] } }));
      writeFileSync(join(casa, '.claude', 'settings.json'), JSON.stringify({ enabledPlugins: { 'superpowers@claude-plugins-official': true } }));
      const ok = kit(d, 'doutor');
      assert.equal(ok.status, 0, ok.stdout + ok.stderr);
      assert.ok(ok.stdout.includes(lock.versao) && ok.stdout.includes('simples') && ok.stdout.includes(String(n)), ok.stdout);
      writeFileSync(join(d, 'scripts', 'kit', 'a-vez-do-gate.mjs'), '// editado\n');
      const mod = kit(d, 'doutor');
      assert.equal(mod.status, 1);
      assert.match(mod.stdout, /modificado.*scripts\/kit\/a-vez-do-gate\.mjs/);
    } finally { limpar(d); }
  });
});
