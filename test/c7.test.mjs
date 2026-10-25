import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// c7 (ressalvas da V4 no c6): laço do gate por comportamento, test:projeto preexistente, iniciar repetido, flags, CLAUDE.md sem \n final, doutor.
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const KIT = join(RAIZ, 'cli', 'kit.mjs');
const git = (d, ...a) => execFileSync('git', ['-C', d, ...a], { encoding: 'utf8', timeout: 10000, killSignal: 'SIGKILL' });
const casa = realpathSync(mkdtempSync(join(tmpdir(), 'kit-c7-casa-')));
const ler = (d, ...p) => readFileSync(join(d, ...p), 'utf8');
const json = (d, ...p) => JSON.parse(ler(d, ...p));
const limpar = (...ds) => ds.forEach((d) => rmSync(d, { recursive: true, force: true }));
const saida = (r) => `${r.stdout}${r.stderr}`;
const ENV = (extra = {}) => ({ ...process.env, HOME: casa, CI: '', KIT_GATE_TRAVA: join(casa, 'gate.trava'), KIT_CONSERTO_TRAVA: join(casa, 'conserto.trava'), KIT_GATE_VERDE_DIR: join(casa, 'verde'), ...extra });
const kit = (cwd, args, extra) => spawnSync('node', [KIT, ...args], { cwd, encoding: 'utf8', timeout: 60000, killSignal: 'SIGKILL', env: ENV(extra) });

const PACOTE = (scripts) => `${JSON.stringify({ name: 'r', version: '1.0.0', scripts }, null, 2)}\n`;
function repo(arquivos = {}) {
  const d = realpathSync(mkdtempSync(join(tmpdir(), 'kit-c7-')));
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
function morreNoRename(d, args, n) {
  const pre = join(casa, `mata-${n}.cjs`);
  writeFileSync(pre, `const fs = require('fs'); const real = fs.renameSync; let i = 0;
fs.renameSync = function (a, b) { if (String(a).endsWith('.kit-tmp') && ++i === ${n}) process.kill(process.pid, 'SIGKILL'); return real.apply(this, arguments); };\n`);
  return spawnSync('node', ['-r', pre, KIT, ...args], { cwd: d, encoding: 'utf8', timeout: 60000, killSignal: 'SIGKILL', env: ENV() });
}

// `npm test` em grupo próprio, morto pelo GRUPO no prazo e num `after`. O gate roda a suíte em outro grupo (detached), então
// o grupo do npm não a alcança: o que sobrar com a pasta do teste na linha de comando é varrido por `pgrep -f`, nunca fica vivo.
const grupos = new Set(); const pastas = new Set();
function varrer(pasta) {
  const r = spawnSync('pgrep', ['-f', pasta], { encoding: 'utf8', timeout: 5000, killSignal: 'SIGKILL' });
  for (const p of r.stdout.split('\n').map(Number).filter((n) => n > 1 && n !== process.pid)) try { process.kill(p, 'SIGKILL'); } catch { /* já morreu */ }
}
after(() => { for (const g of grupos) try { process.kill(-g, 'SIGKILL'); } catch { /* já morreu */ } for (const d of pastas) varrer(d); });
function npmTest(cwd, extra, prazoMs = 30000) {
  return new Promise((resolve) => {
    const f = spawn('npm', ['test'], { cwd, detached: true, env: ENV(extra), stdio: ['ignore', 'pipe', 'pipe'] });
    grupos.add(f.pid); pastas.add(cwd);
    let out = '';
    f.stdout.on('data', (c) => { out += c; }); f.stderr.on('data', (c) => { out += c; });
    const matar = () => { try { process.kill(-f.pid, 'SIGKILL'); } catch { /* já morreu */ } varrer(cwd); };
    const t = setTimeout(matar, prazoMs);
    f.on('exit', (status, signal) => { clearTimeout(t); matar(); resolve({ status, signal, saida: out }); });
  });
}

describe('R1 — o gate detecta o laço pelo comportamento', () => {
  const casos = [
    ['npm t', { test: 'node -e 1' }, 'npm t'],
    ['npm tst', { test: 'node -e 1' }, 'npm tst'],
    ['npm run-script test', { test: 'node -e 1' }, 'npm run-script test'],
    ['pnpm t', { test: 'node -e 1' }, 'pnpm t'],
    ['indireto: npm run suite → npm test', { test: 'node -e 1', suite: 'npm test' }, 'npm run suite'],
  ];
  for (const [nome, scripts, comando] of casos) {
    it(`${nome}: recusa alto, exit 2, antes de tomar a trava`, async () => {
      const d = repo({ 'CLAUDE.md': '# x\n', 'package.json': PACOTE(scripts) });
      try {
        assert.equal(kit(d, ['adotar', '--trocar-test']).status, 0);
        const kj = json(d, '.claude', 'kit.json');
        kj.gate.comandoCompleto = comando;
        writeFileSync(join(d, '.claude', 'kit.json'), JSON.stringify(kj, null, 2));
        assert.equal(json(d, 'package.json').scripts.test.includes('a-vez-do-gate'), true, 'insumo: o `test` não é o gate');
        const t0 = Date.now();
        const r = await npmTest(d);
        const ms = Date.now() - t0;
        assert.notEqual(r.signal, 'SIGKILL', `o gate travou no laço (${ms} ms): ${r.saida}`);
        assert.equal(r.status, 2, r.saida);
        assert.match(r.saida, /chama o próprio gate/);
        assert.ok(ms < 10000, `demorou ${ms} ms`);
      } finally { limpar(d); }
    });
  }
  it('gate que nasce com KIT_GATE_DENTRO recusa sem criar a trava', () => {
    const d = repo({ 'CLAUDE.md': '# x\n', 'package.json': PACOTE({ test: 'node -e 1' }) });
    try {
      assert.equal(kit(d, ['adotar', '--trocar-test']).status, 0);
      const trava = join(casa, 'dentro.trava');
      const r = spawnSync('node', ['scripts/kit/a-vez-do-gate.mjs'], { cwd: d, encoding: 'utf8', timeout: 15000, killSignal: 'SIGKILL', env: ENV({ KIT_GATE_DENTRO: realpathSync(d), KIT_GATE_TRAVA: trava }) });
      assert.equal(r.status, 2, saida(r));
      assert.match(r.stderr, /chama o próprio gate/);
      assert.equal(existsSync(trava), false, 'tomou a trava antes de recusar');
    } finally { limpar(d); }
  });
  it('sem o laço, a suíte roda normal (a variável não atrapalha o gate legítimo)', async () => {
    const d = repo({ 'CLAUDE.md': '# x\n', 'package.json': PACOTE({ test: "node -e \"console.log('suite-ok')\"" }) });
    try {
      assert.equal(kit(d, ['adotar', '--trocar-test']).status, 0);
      const r = await npmTest(d, undefined, 60000);
      assert.equal(r.status, 0, r.saida);
      assert.match(r.saida, /suite-ok/);
    } finally { limpar(d); }
  });
});

describe('R2 — test:projeto que já existia não é apagado pelo remover', () => {
  it('test = test:projeto: adotar → atualizar --trocar-test → remover → git status vazio', () => {
    const d = repo({ 'CLAUDE.md': '# x\n', 'package.json': PACOTE({ test: 'node -e 1', 'test:projeto': 'node -e 1' }) });
    try {
      assert.equal(git(d, 'status', '--porcelain').trim(), '');
      const a = kit(d, ['adotar']); assert.equal(a.status, 0, saida(a));
      const t = kit(d, ['atualizar', '--trocar-test']); assert.equal(t.status, 0, saida(t));
      const p = json(d, 'package.json').scripts;
      assert.ok(p.test.includes('a-vez-do-gate'), `insumo: o test não virou o gate (${p.test})`);
      assert.equal(p['test:projeto'], 'node -e 1');
      const rm = kit(d, ['remover']); assert.equal(rm.status, 0, saida(rm));
      assert.equal(git(d, 'status', '--porcelain').trim(), '', git(d, 'diff'));
      assert.equal(json(d, 'package.json').scripts['test:projeto'], 'node -e 1');
    } finally { limpar(d); }
  });
});

describe('R3 — iniciar repetido depois de um iniciar morto', () => {
  it('morto no rename 1 → iniciar de novo → remover: nenhuma pasta vazia sobra', () => {
    const d = repo({ 'package.json': PACOTE({ test: 'node -e 1' }) });
    try {
      const antes = arvore(d);
      const morto = morreNoRename(d, ['iniciar'], 1);
      assert.equal(morto.signal, 'SIGKILL', saida(morto));
      assert.ok(['.claude', 'scripts', 'scripts/kit'].some((p) => existsSync(join(d, p))), 'insumo: o iniciar morto não deixou pasta');
      const r = kit(d, ['iniciar']);
      assert.equal(r.status, 0, saida(r));
      assert.match(r.stdout, /recuperado:/);
      assert.ok(!Object.keys(arvore(d)).some((k) => k.endsWith('.kit-tmp')), 'sobrou .kit-tmp');
      assert.equal(json(d, '.claude', 'kit.lock.json').recuperado, true);
      const rm = kit(d, ['remover']); assert.equal(rm.status, 0, saida(rm));
      assert.deepEqual(arvore(d), antes, 'sobrou pasta ou arquivo do kit');
    } finally { limpar(d); }
  });
});

describe('N1 — flag desconhecida', () => {
  it('exit 2 com a lista das válidas, em todos os subcomandos, sem gravar nada', () => {
    const d = repo({ 'CLAUDE.md': '# x\n', 'package.json': PACOTE({ test: 'node -e 1' }) });
    try {
      const antes = arvore(d);
      const casos = [['adotar', '--trocar-tes', '--trocar-test'], ['atualizar', '--nada', '--simular'], ['remover', '--tudo', '--simular'], ['doutor', '--x', '--simular'], ['iniciar', '--rapido', '--perfil']];
      for (const [cmd, ruim, valida] of casos) {
        const r = kit(d, [cmd, ruim]);
        assert.equal(r.status, 2, `${cmd} ${ruim}: ${saida(r)}`);
        assert.match(r.stderr, new RegExp(`flag desconhecida ${ruim}`));
        if (cmd !== 'doutor') assert.ok(r.stderr.includes(valida), `${cmd}: não listou ${valida}: ${r.stderr}`);
      }
      assert.deepEqual(arvore(d), antes);
      assert.equal(kit(d, ['adotar', '--simular', '--perfil', 'simples']).status, 0, 'flag válida deixou de funcionar');
    } finally { limpar(d); }
  });
});

describe('N2 — CLAUDE.md sem \\n final', () => {
  for (const [nome, eol] of [['LF', '\n'], ['CRLF', '\r\n']]) {
    it(`${nome}: adotar + remover devolvem o arquivo sem o fim de linha`, () => {
      const d = repo({ 'CLAUDE.md': `# x${eol}${eol}meu texto`, 'package.json': PACOTE({ test: 'node -e 1' }) });
      try {
        assert.equal(ler(d, 'CLAUDE.md').endsWith('\n'), false, 'insumo: o CLAUDE.md já termina com \\n');
        assert.equal(kit(d, ['adotar']).status, 0);
        assert.ok(ler(d, 'CLAUDE.md').includes('<!-- kit:'), 'insumo: o adotar não acrescentou bloco');
        assert.equal(kit(d, ['remover']).status, 0);
        assert.equal(JSON.stringify(ler(d, 'CLAUDE.md')), JSON.stringify(`# x${eol}${eol}meu texto`));
        assert.equal(git(d, 'status', '--porcelain').trim(), '', git(d, 'diff'));
      } finally { limpar(d); }
    });
  }
});

describe('N3 — doutor separa instalado na máquina de habilitado no projeto', () => {
  it('plugin não instalado mas habilitado no projeto: duas linhas distintas', () => {
    const d = repo({ 'CLAUDE.md': '# x\n', 'package.json': PACOTE({ test: 'node -e 1' }) });
    try {
      assert.equal(kit(d, ['adotar']).status, 0);
      const r = kit(d, ['doutor']);
      assert.match(r.stdout, /falha: plugin instalado na máquina: não/);
      assert.match(r.stdout, /ok: plugin habilitado no projeto: sim/);
    } finally { limpar(d); }
  });
  it('comandoCompleto que parece chamar o test vira aviso, não falha de kit.json', () => {
    const d = repo({ 'CLAUDE.md': '# x\n', 'package.json': PACOTE({ test: 'node -e 1' }) });
    try {
      assert.equal(kit(d, ['adotar']).status, 0);
      const kj = json(d, '.claude', 'kit.json');
      kj.gate.comandoCompleto = 'npm test';
      writeFileSync(join(d, '.claude', 'kit.json'), JSON.stringify(kj, null, 2));
      const r = kit(d, ['doutor']);
      assert.match(r.stdout, /aviso: gate\.comandoCompleto "npm test" parece chamar/);
      assert.doesNotMatch(r.stdout, /falha: \.claude\/kit\.json/);
    } finally { limpar(d); }
  });
});
