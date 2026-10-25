import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// c8 (ressalvas da V3 no c8): `KIT_GATE_DENTRO` leva a raiz do worktree, dono ancestral recusa, teste do laço sem órfãos.
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const KIT = join(RAIZ, 'cli', 'kit.mjs');
const git = (d, ...a) => execFileSync('git', ['-C', d, ...a], { encoding: 'utf8', timeout: 10000, killSignal: 'SIGKILL' });
const casa = realpathSync(mkdtempSync(join(tmpdir(), 'kit-c8-casa-')));
const ler = (d, ...p) => readFileSync(join(d, ...p), 'utf8');
const json = (d, ...p) => JSON.parse(ler(d, ...p));
const limpar = (...ds) => ds.forEach((d) => rmSync(d, { recursive: true, force: true }));
const saida = (r) => `${r.stdout}${r.stderr}`;
const ENV = (extra = {}) => ({ ...process.env, HOME: casa, CI: '', KIT_GATE_TRAVA: join(casa, 'gate.trava'), KIT_CONSERTO_TRAVA: join(casa, 'conserto.trava'), KIT_GATE_VERDE_DIR: join(casa, 'verde'), ...extra });
const kit = (cwd, args, extra) => spawnSync('node', [KIT, ...args], { cwd, encoding: 'utf8', timeout: 60000, killSignal: 'SIGKILL', env: ENV(extra) });

const PACOTE = (scripts) => `${JSON.stringify({ name: 'r', version: '1.0.0', scripts }, null, 2)}\n`;
function repo(arquivos = {}) {
  const d = realpathSync(mkdtempSync(join(tmpdir(), 'kit-c8-')));
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


const orfaos = (d) => spawnSync('pgrep', ['-f', d], { encoding: 'utf8', timeout: 5000, killSignal: 'SIGKILL' }).stdout.trim();
async function semOrfaos(d) {
  for (let i = 0; i < 20; i++) { if (!orfaos(d)) return ''; await new Promise((r) => setTimeout(r, 250)); }
  return orfaos(d);
}
const adotado = (scripts, extras = {}) => {
  const d = repo({ 'CLAUDE.md': '# x\n', 'package.json': PACOTE(scripts), ...extras });
  assert.equal(kit(d, ['adotar', '--trocar-test']).status, 0);
  return d;
};

describe('R1 — KIT_GATE_DENTRO leva a raiz do worktree', () => {
  it('gate de outro repositório, chamado de dentro da suíte de outro gate, roda normal', async () => {
    const a = repo(); const b = adotado({ test: "node -e \"console.log('suite-b')\"" });
    try {
      const r = await npmTest(b, { KIT_GATE_DENTRO: realpathSync(a) }, 60000);
      assert.equal(r.status, 0, r.saida);
      assert.match(r.saida, /suite-b/);
    } finally { limpar(a, b); }
  });
  it('gate de worktree irmão, chamado de dentro da suíte do outro, roda normal', async () => {
    const d = adotado({ test: "node -e \"console.log('suite-irma')\"" });
    const irma = join(casa, `irma-${Date.now()}`);
    try {
      git(d, 'add', '-A'); git(d, 'commit', '-qm', 'kit');
      git(d, 'worktree', 'add', '-q', irma, '-b', 'irma');
      const r = await npmTest(irma, { KIT_GATE_DENTRO: realpathSync(d) }, 60000);
      assert.equal(r.status, 0, r.saida);
      assert.match(r.saida, /suite-irma/);
    } finally { limpar(d, irma); }
  });
  it('o mesmo worktree recusa, com a causa real na mensagem', async () => {
    const d = adotado({ test: 'node -e 1' });
    try {
      const r = await npmTest(d, { KIT_GATE_DENTRO: realpathSync(d) });
      assert.equal(r.status, 2, r.saida);
      assert.match(r.saida, /a suíte chama o gate deste mesmo worktree/);
    } finally { limpar(d); }
  });
});

describe('R2 — dono da vez ancestral recusa na hora (env limpa)', () => {
  it('env -i e script que limpa a env: exit 2 em menos de 10 s, sem esperar a vez', async () => {
    const limpa = 'env -i PATH="$PATH" HOME="$HOME" KIT_GATE_TRAVA="$KIT_GATE_TRAVA" KIT_CONSERTO_TRAVA="$KIT_CONSERTO_TRAVA" KIT_GATE_VERDE_DIR="$KIT_GATE_VERDE_DIR"';
    const casos = [['env -i direto', { suite: `${limpa} npm test` }], ['script que limpa a env', { suite: `${limpa} sh -c "npm test"` }]];
    for (const [nome, extra] of casos) {
      const d = repo({ 'CLAUDE.md': '# x\n', 'package.json': PACOTE({ test: 'node -e 1', ...extra }) });
      try {
        assert.equal(kit(d, ['adotar', '--trocar-test']).status, 0);
        const kj = json(d, '.claude', 'kit.json'); kj.gate.comandoCompleto = 'npm run suite';
        writeFileSync(join(d, '.claude', 'kit.json'), JSON.stringify(kj, null, 2));
        const t0 = Date.now();
        const r = await npmTest(d);
        const ms = Date.now() - t0;
        assert.notEqual(r.signal, 'SIGKILL', `${nome}: travou (${ms} ms): ${r.saida}`);
        assert.equal(r.status, 2, `${nome}: ${r.saida}`);
        assert.match(r.saida, /é ancestral deste processo/);
        assert.ok(ms < 10000, `${nome}: ${ms} ms`);
      } finally { limpar(d); }
    }
  });
});

describe('R3 — o teste do laço não deixa órfãos', () => {
  it('depois do prazo vencido, o grupo morto não deixa processo com a pasta do teste', async () => {
    const d = adotado({ test: 'node -e 1', suite: 'sleep 300' });
    try {
      const kj = json(d, '.claude', 'kit.json'); kj.gate.comandoCompleto = 'npm run suite';
      writeFileSync(join(d, '.claude', 'kit.json'), JSON.stringify(kj, null, 2));
      const r = await npmTest(d, undefined, 4000); // a suíte dorme: só o prazo encerra
      assert.equal(r.signal, 'SIGKILL', `insumo: devia ter sido morto pelo prazo (${r.saida})`);
      assert.equal(await semOrfaos(d), '', 'sobraram processos');
    } finally { limpar(d); }
  });
});
