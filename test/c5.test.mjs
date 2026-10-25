import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// c5 (ressalvas da V3): escrita transacional, JSON com os bytes do usuário, bloco novo no atualizar, painel R1 pelo caminho, N1–N4.
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const git = (d, ...a) => execFileSync('git', ['-C', d, ...a], { encoding: 'utf8', timeout: 10000, killSignal: 'SIGKILL' });
const casa = realpathSync(mkdtempSync(join(tmpdir(), 'kit-c5-casa-')));
const ler = (d, ...p) => readFileSync(join(d, ...p), 'utf8');
const json = (d, ...p) => JSON.parse(ler(d, ...p));
const limpar = (...ds) => ds.forEach((d) => { try { for (const x of ['scripts/kit', 'scripts', '.claude']) chmodSync(join(d, x), 0o755); } catch { /* não existe */ } rmSync(d, { recursive: true, force: true }); });
const saida = (r) => `${r.stdout}${r.stderr}`;

function kitDe(raiz, cwd, args, home = casa) {
  return spawnSync('node', [join(raiz, 'cli', 'kit.mjs'), ...args], {
    cwd, encoding: 'utf8', timeout: 60000, killSignal: 'SIGKILL',
    env: { ...process.env, HOME: home, CI: '', KIT_GATE_TRAVA: join(home, 'gate.trava'), KIT_GATE_VERDE_DIR: join(home, 'verde') },
  });
}
const kit = (cwd, args, home) => kitDe(RAIZ, cwd, args, home);

/** Uma cópia do kit com versão e modelo de mentira: { raiz, gate(arquivo, texto), modelo(fn) }. */
function kitFalso(versao) {
  const raiz = realpathSync(mkdtempSync(join(tmpdir(), 'kit-c5-falso-')));
  for (const n of ['cli', 'gate', 'modelos']) cpSync(join(RAIZ, n), join(raiz, n), { recursive: true });
  mkdirSync(join(raiz, 'plugins', 'orquestracao', 'hooks'), { recursive: true });
  cpSync(join(RAIZ, 'plugins', 'orquestracao', 'hooks', 'hooks.json'), join(raiz, 'plugins', 'orquestracao', 'hooks', 'hooks.json'));
  const pk = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8'));
  writeFileSync(join(raiz, 'package.json'), JSON.stringify({ ...pk, version: versao }));
  return raiz;
}

function repoVazio() {
  const d = realpathSync(mkdtempSync(join(tmpdir(), 'kit-c5-')));
  git(d, 'init', '-q'); git(d, 'config', 'user.email', 't@k.local'); git(d, 'config', 'user.name', 't');
  return d;
}
function rascunho(extra = {}) {
  const d = repoVazio();
  mkdirSync(join(d, '.claude'));
  writeFileSync(join(d, 'CLAUDE.md'), '# Rascunho\n\nMeu texto.\n');
  writeFileSync(join(d, '.claude', 'settings.json'), extra.settings ?? `${JSON.stringify({ permissions: { allow: ['Bash(ls:*)'] } }, null, 2)}\n`);
  writeFileSync(join(d, 'package.json'), extra.pacote ?? `${JSON.stringify({ name: 'r', version: '1.0.0', scripts: { test: 'node -e "0"' } }, null, 2)}\n`);
  git(d, 'add', '-A'); git(d, 'commit', '-qm', 'base');
  return d;
}
/** Árvore completa (sem .git): arquivos com conteúdo e pastas. */
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
const semStack = (r) => assert.ok(!/\n\s+at .*\(.*:\d+:\d+\)/.test(saida(r)), `stack trace na saída: ${saida(r)}`);

describe('R1 — escrita transacional', () => {
  /** Trava a pasta (555), prova que ela barra a escrita e devolve a árvore idêntica depois do comando. */
  function barrado(d, pasta, comando) {
    mkdirSync(join(d, pasta), { recursive: true });
    chmodSync(join(d, pasta), 0o555);
    assert.throws(() => writeFileSync(join(d, pasta, 'prova'), 'x'), /EACCES|EPERM/, `insumo: ${pasta} não barra a escrita (rodando como root?)`);
    const antes = arvore(d);
    assert.ok(Object.keys(antes).length > 0, 'insumo vazio: árvore sem nada');
    const r = comando();
    chmodSync(join(d, pasta), 0o755);
    assert.notEqual(r.status, 0, `devia falhar: ${saida(r)}`);
    chmodSync(join(d, pasta), 0o555);
    assert.deepEqual(arvore(d), antes, 'a árvore mudou depois da falha');
    chmodSync(join(d, pasta), 0o755);
    semStack(r);
    assert.match(saida(r), /Nada ficou gravado|desfeito/);
    assert.ok(!Object.keys(arvore(d)).some((k) => k.endsWith('.kit-tmp')), 'sobrou temporário');
    return r;
  }
  for (const pasta of ['scripts', '.claude']) {
    it(`iniciar com ${pasta}/ em 555: árvore idêntica, sem stack`, () => {
      const d = repoVazio();
      try { barrado(d, pasta, () => kit(d, ['iniciar'])); } finally { limpar(d); }
    });
    it(`adotar com ${pasta}/ em 555: árvore idêntica, sem stack`, () => {
      const d = rascunho();
      try { barrado(d, pasta, () => kit(d, ['adotar'])); } finally { limpar(d); }
    });
  }
  for (const pasta of ['scripts/kit', '.claude']) {
    it(`atualizar com ${pasta}/ em 555: árvore idêntica, sem stack`, () => {
      const d = rascunho();
      const falso = kitFalso('0.2.0');
      try {
        assert.equal(kit(d, ['adotar']).status, 0);
        writeFileSync(join(falso, 'gate', 'config.mjs'), `${readFileSync(join(falso, 'gate', 'config.mjs'), 'utf8')}// v2\n`);
        writeFileSync(join(falso, 'modelos', 'CLAUDE.md'), readFileSync(join(falso, 'modelos', 'CLAUDE.md'), 'utf8').replace('- Teste antes do código quando o comportamento muda.', '- Teste antes do código, sempre.'));
        // sem a trava o atualizar tem o que gravar (prova que o caso mede algo)
        const livre = kitDe(falso, d, ['atualizar', '--simular']);
        assert.match(livre.stdout, /atualizado: scripts\/kit\/config\.mjs/);
        assert.match(livre.stdout, /atualizado: bloco regras-de-trabalho/);
        barrado(d, pasta, () => kitDe(falso, d, ['atualizar']));
      } finally { limpar(d, falso); }
    });
  }
});

describe('R2 — o JSON do usuário volta com os mesmos bytes', () => {
  it('objeto numa linha e indentação 4: adotar + remover → git status vazio', () => {
    const settings = '{\n    "permissions": { "allow": ["Bash(ls:*)"] },\n    "enabledPlugins": { "outro@x": true }\n}\n';
    const pacote = '{\n    "name": "r",\n    "version": "1.0.0",\n    "dependencies": { "zod": "^3.0.0" }\n}\n';
    const d = rascunho({ settings, pacote });
    try {
      assert.equal(git(d, 'status', '--porcelain').trim(), '', 'insumo: árvore devia começar limpa');
      assert.equal(kit(d, ['adotar']).status, 0);
      assert.notEqual(git(d, 'status', '--porcelain').trim(), '', 'o adotar não mudou nada: o caso não mede');
      const r = kit(d, ['remover']);
      assert.equal(r.status, 0, saida(r));
      assert.equal(git(d, 'status', '--porcelain').trim(), '', git(d, 'diff'));
    } finally { limpar(d); }
  });
  it('se o usuário mexeu depois, o remover não devolve o texto velho por cima do trabalho dele', () => {
    const d = rascunho({ settings: '{\n    "permissions": { "allow": ["Bash(ls:*)"] }\n}\n' });
    try {
      kit(d, ['adotar']);
      const s = json(d, '.claude', 'settings.json'); s.model = 'opus';
      writeFileSync(join(d, '.claude', 'settings.json'), `${JSON.stringify(s, null, 4)}\n`);
      assert.equal(kit(d, ['remover']).status, 0);
      assert.equal(json(d, '.claude', 'settings.json').model, 'opus');
    } finally { limpar(d); }
  });
});

describe('R3 — o atualizar traz bloco novo e renomeado', () => {
  it('modelo 0.2.0 com bloco novo e bloco renomeado', () => {
    const d = rascunho();
    const falso = kitFalso('0.2.0');
    try {
      assert.equal(kit(d, ['adotar']).status, 0);
      const m = join(falso, 'modelos', 'CLAUDE.md');
      const antigo = readFileSync(m, 'utf8');
      assert.match(antigo, /kit:regras-de-trabalho v\d+/);
      writeFileSync(m, `${antigo.replaceAll('regras-de-trabalho', 'regras-do-trabalho')}\n<!-- kit:novo-bloco v1 -->\n## Novo\n- uma regra nova\n<!-- /kit:novo-bloco -->\n`);
      const r = kitDe(falso, d, ['atualizar']);
      assert.equal(r.status, 0, saida(r));
      assert.match(r.stdout, /novo: novo-bloco/);
      assert.match(r.stdout, /novo: regras-do-trabalho/);
      assert.match(r.stdout, /aviso: o bloco regras-de-trabalho saiu do kit/);
      const claude = ler(d, 'CLAUDE.md');
      assert.match(claude, /<!-- kit:novo-bloco v1 -->/);
      assert.match(claude, /<!-- kit:regras-do-trabalho v\d+ -->/);
      assert.ok(claude.startsWith('# Rascunho\n\nMeu texto.\n'));
      const lock = json(d, '.claude', 'kit.lock.json');
      assert.ok('novo-bloco' in lock.blocos && 'regras-do-trabalho' in lock.blocos);
      // segunda rodada: nada novo a acrescentar
      const r2 = kitDe(falso, d, ['atualizar']);
      assert.doesNotMatch(r2.stdout, /novo: /);
      assert.equal(ler(d, 'CLAUDE.md'), claude);
    } finally { limpar(d, falso); }
  });
});

describe('N1 — o remover só apaga pasta que o kit criou', () => {
  it('pastas vazias que já existiam ficam; as criadas somem', () => {
    const d = repoVazio();
    try {
      mkdirSync(join(d, '.claude')); mkdirSync(join(d, 'scripts'));
      assert.equal(kit(d, ['iniciar']).status, 0);
      const lock = json(d, '.claude', 'kit.lock.json');
      assert.deepEqual(lock.pastasCriadas, ['scripts/kit']);
      assert.equal(kit(d, ['remover']).status, 0);
      assert.ok(existsSync(join(d, '.claude')) && existsSync(join(d, 'scripts')), 'apagou pasta que já existia');
      assert.ok(!existsSync(join(d, 'scripts', 'kit')), 'não apagou a pasta que o kit criou');
    } finally { limpar(d); }
    const n = repoVazio();
    try {
      assert.equal(kit(n, ['iniciar']).status, 0);
      assert.deepEqual(json(n, '.claude', 'kit.lock.json').pastasCriadas.sort(), ['.claude', 'scripts', 'scripts/kit']);
      assert.equal(kit(n, ['remover']).status, 0);
      assert.deepEqual(readdirSync(n).filter((x) => x !== '.git'), []);
    } finally { limpar(n); }
  });
});

describe('N2 — pendência sem conflito vai ao lock e ao doutor', () => {
  it('adotar sem --trocar-test: lock.pendente, doutor avisa, test:projeto não nasce', () => {
    const d = rascunho();
    const home = realpathSync(mkdtempSync(join(tmpdir(), 'kit-c5-h-')));
    try {
      const r = kit(d, ['adotar']);
      assert.equal(r.status, 0, saida(r));
      const lock = json(d, '.claude', 'kit.lock.json');
      assert.equal(lock.pendente.length, 1);
      assert.match(lock.pendente[0], /scripts\.test/);
      assert.equal(json(d, 'package.json').scripts['test:projeto'], undefined);
      assert.match(kit(d, ['doutor'], home).stdout, /aviso: pendente da adoção:.*scripts\.test/);
    } finally { limpar(d); rmSync(home, { recursive: true, force: true }); }
  });
  it('com --trocar-test nasce o test:projeto e não há pendência', () => {
    const d = rascunho();
    try {
      assert.equal(kit(d, ['adotar', '--trocar-test']).status, 0);
      assert.equal(json(d, 'package.json').scripts['test:projeto'], 'node -e "0"');
      assert.equal(json(d, '.claude', 'kit.lock.json').pendente, undefined);
    } finally { limpar(d); }
  });
});

describe('N3 — o doutor só acusa hook duplicado em command de hooks', () => {
  function doutorCom(settingsGlobal) {
    const d = rascunho();
    const home = realpathSync(mkdtempSync(join(tmpdir(), 'kit-c5-h-')));
    try {
      kit(d, ['adotar']);
      mkdirSync(join(home, '.claude'), { recursive: true });
      writeFileSync(join(home, '.claude', 'settings.json'), JSON.stringify(settingsGlobal));
      return kit(d, ['doutor'], home).stdout;
    } finally { limpar(d); rmSync(home, { recursive: true, force: true }); }
  }
  it('permissão que cita o script não é hook', () => {
    assert.doesNotMatch(doutorCom({ permissions: { allow: ['Bash(node ~/.claude/hooks/painel-das-sessoes.mjs --listar)'] } }), /falha: hook do kit também/);
  });
  it('hook de verdade com o mesmo script acusa (prova que o caso mede)', () => {
    assert.match(doutorCom({ hooks: { Stop: [{ hooks: [{ type: 'command', command: 'node ~/.claude/hooks/painel-das-sessoes.mjs' }] }] } }), /falha: hook do kit também em ~\/\.claude\/settings\.json: painel-das-sessoes\.mjs/);
  });
});

describe('N4 — a mensagem diz o que de fato ficou em test:suite', () => {
  it('test = npm run test:suite com test:suite próprio', () => {
    const pacote = `${JSON.stringify({ name: 'r', version: '1.0.0', scripts: { test: 'npm run test:suite', 'test:suite': 'vitest run' } }, null, 2)}\n`;
    const d = repoVazio();
    writeFileSync(join(d, 'package.json'), pacote);
    try {
      const r = kit(d, ['iniciar']);
      assert.equal(r.status, 0, saida(r));
      assert.match(r.stdout, /trocado: .*test:suite.*vitest run/);
      assert.doesNotMatch(r.stdout, /o seu `npm run test:suite` está em test:suite/);
    } finally { limpar(d); }
  });
});

describe('R4 — o caso c4 R1 do painel decide pelo caminho e pega a volta do fallback', () => {
  it('mutante: HOOKS_DIR de volta para ~/.claude/hooks → o teste do plugin fica vermelho', () => {
    const raiz = realpathSync(mkdtempSync(join(tmpdir(), 'kit-c5-plug-')));
    try {
      const plug = join(raiz, 'plugins', 'orquestracao');
      cpSync(join(RAIZ, 'plugins', 'orquestracao', 'hooks'), join(plug, 'hooks'), { recursive: true });
      cpSync(join(RAIZ, 'plugins', 'orquestracao', 'skills'), join(plug, 'skills'), { recursive: true });
      const roda = () => spawnSync('node', [join(plug, 'hooks', 'tests', 'painel-validacao.test.mjs')], {
        encoding: 'utf8', timeout: 120000, killSignal: 'SIGKILL', env: { ...process.env, SCRIPTS_DIR: join(plug, 'skills', 'orquestradora', 'scripts') },
      });
      const limpo = roda();
      assert.equal(limpo.status, 0, limpo.stdout + limpo.stderr);
      assert.match(limpo.stdout, /ok +c4 R1/);
      const alvo = join(plug, 'skills', 'orquestradora', 'scripts', 'painel.mjs');
      const fonte = readFileSync(alvo, 'utf8');
      const linha = "const HOOKS_DIR = process.env.KIT_HOOKS_DIR || join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'hooks');";
      assert.ok(fonte.includes(linha), 'insumo: a linha do HOOKS_DIR mudou');
      writeFileSync(alvo, fonte.replace(linha, "const HOOKS_DIR = process.env.KIT_HOOKS_DIR || join(homedir(), '.claude', 'hooks');"));
      const mutante = roda();
      assert.notEqual(mutante.status, 0, 'o mutante passou: o teste não pega a volta do fallback');
      assert.match(mutante.stdout, /FAIL +c4 R1/);
    } finally { rmSync(raiz, { recursive: true, force: true }); }
  });
});
