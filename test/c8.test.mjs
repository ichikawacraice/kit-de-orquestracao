import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { esperarAVez, quemSouEu } from '../gate/a-vez-do-gate.mjs';

// c8/c9 (ressalvas da V3 no c7 e no c8): `KIT_GATE_DENTRO` leva a raiz do worktree, dono ancestral recusa, teste do laço sem órfãos.
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

// `npm test` em grupo próprio, morto pelo GRUPO no prazo e num `after`. O gate roda a suíte em OUTRO grupo (detached): o grupo do
// npm não a alcança. A suíte dos testes grava o próprio PID (`suite.pid`) e é esse PID, que o filho do teste escreveu, que se mata (pelo
// grupo dele) — nunca por nome, nunca por varredura de linha de comando.
const grupos = new Set(); const pastas = new Set();
const vivo = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
const pidDaSuite = (d) => { try { return Number.parseInt(ler(d, 'suite.pid').trim(), 10) || 0; } catch { return 0; } };
function matarSuite(d) {
  const pid = pidDaSuite(d);
  if (pid <= 1 || !vivo(pid)) return;
  const g = Number.parseInt(spawnSync('ps', ['-o', 'pgid=', '-p', String(pid)], { encoding: 'utf8', timeout: 5000, killSignal: 'SIGKILL' }).stdout.trim(), 10);
  try { process.kill(g > 1 ? -g : pid, 'SIGKILL'); } catch { /* já morreu */ }
}
async function morreu(pid, ms = 5000) { for (let t = 0; t < ms; t += 100) { if (!vivo(pid)) return true; await new Promise((r) => setTimeout(r, 100)); } return !vivo(pid); }
after(() => { for (const g of grupos) try { process.kill(-g, 'SIGKILL'); } catch { /* já morreu */ } for (const d of pastas) matarSuite(d); limpar(casa); });
function npmTest(cwd, extra, prazoMs = 30000, { matarOrfao = true } = {}) {
  return new Promise((resolve) => {
    const f = spawn('npm', ['test'], { cwd, detached: true, env: ENV(extra), stdio: ['ignore', 'pipe', 'pipe'] });
    grupos.add(f.pid); pastas.add(cwd);
    let out = '';
    f.stdout.on('data', (c) => { out += c; }); f.stderr.on('data', (c) => { out += c; });
    const matar = () => { try { process.kill(-f.pid, 'SIGKILL'); } catch { /* já morreu */ } if (matarOrfao) matarSuite(cwd); };
    const t = setTimeout(matar, prazoMs);
    f.on('exit', (status, signal) => { clearTimeout(t); matar(); resolve({ status, signal, saida: out }); });
  });
}

const adotado = (scripts, extras = {}) => {
  const d = repo({ 'CLAUDE.md': '# x\n', 'package.json': PACOTE(scripts), ...extras });
  assert.equal(kit(d, ['adotar', '--trocar-test']).status, 0);
  return d;
};

// `d` adotado cuja suíte chama o gate de `irma`, worktree irmão; na última irmã a suíte só imprime. Com `cadeia` > 1, cada irmã chama a próxima.
async function irmaos(cadeia = 1) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const irmas = Array.from({ length: cadeia }, (_, i) => join(casa, `irma-${id}-${i}`));
  const ramos = irmas.map((p, i) => (i === cadeia - 1 ? `"${p}") echo suite-irma;;` : `"${p}") cd "${irmas[i + 1]}" && npm test;;`)).join(' ');
  const suite = `echo $$ > suite.pid; case "$PWD" in ${ramos} *) cd "${irmas[0]}" && npm test;; esac`;
  const d = repo({ 'CLAUDE.md': '# x\n', 'package.json': PACOTE({ test: 'node -e 1', suite }) });
  assert.equal(kit(d, ['adotar', '--trocar-test']).status, 0);
  const kj = json(d, '.claude', 'kit.json'); kj.gate.comandoCompleto = 'npm run suite';
  writeFileSync(join(d, '.claude', 'kit.json'), JSON.stringify(kj, null, 2));
  git(d, 'add', '-A'); git(d, 'commit', '-qm', 'kit');
  irmas.forEach((p, i) => git(d, 'worktree', 'add', '-q', p, '-b', `irma-${i}`));
  return { d, irma: irmas[0], irmas };
}

describe('R1 — KIT_GATE_DENTRO leva a raiz do worktree', () => {
  it('gate de outro repositório, chamado de dentro da suíte de outro gate, roda normal', async () => {
    const a = repo(); const b = adotado({ test: "node -e \"console.log('suite-b')\"" });
    try {
      const r = await npmTest(b, { KIT_GATE_DENTRO: realpathSync(a) }, 60000);
      assert.equal(r.status, 0, r.saida);
      assert.match(r.saida, /suite-b/);
    } finally { limpar(a, b); }
  });
  it('N1: gate de worktree irmão, chamado de dentro de uma suíte de verdade (chamada aninhada), roda normal', async () => {
    const { d, irmas } = await irmaos();
    try {
      const r = await npmTest(d, { KIT_GATE_VAGAS: '2' }, 60000);
      assert.equal(r.status, 0, r.saida);
      assert.match(r.saida, /suite-irma/);
    } finally { limpar(d, ...irmas); }
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

const SUITE_DORME = 'echo $$ > suite.pid; exec sleep 300';
async function adotadoComSuiteQueDorme() {
  const d = adotado({ test: 'node -e 1', suite: SUITE_DORME });
  const kj = json(d, '.claude', 'kit.json'); kj.gate.comandoCompleto = 'npm run suite';
  writeFileSync(join(d, '.claude', 'kit.json'), JSON.stringify(kj, null, 2));
  return d;
}

describe('R3/B1 — o teste do laço não deixa órfãos, e a guarda tem sujeito', () => {
  it('com a matança do órfão desligada, o órfão EXISTE (a guarda enxerga o que procura)', async () => {
    const d = await adotadoComSuiteQueDorme();
    try {
      const r = await npmTest(d, undefined, 4500, { matarOrfao: false });
      assert.equal(r.signal, 'SIGKILL', `insumo: devia ter sido morto pelo prazo (${r.saida})`);
      const pid = pidDaSuite(d);
      assert.ok(pid > 1, `a suíte não gravou o próprio PID (${r.saida})`);
      assert.ok(vivo(pid), `PID ${pid}: o órfão devia estar vivo depois de matar só o grupo do npm`);
      matarSuite(d);
      assert.ok(await morreu(pid), `PID ${pid}: não morreu`);
    } finally { matarSuite(d); limpar(d); }
  });
  it('no caminho normal, o órfão morre com o teste', async () => {
    const d = await adotadoComSuiteQueDorme();
    try {
      const r = await npmTest(d, undefined, 4500);
      assert.equal(r.signal, 'SIGKILL', `insumo: devia ter sido morto pelo prazo (${r.saida})`);
      const pid = pidDaSuite(d);
      assert.ok(pid > 1, `a suíte não gravou o próprio PID (${r.saida})`);
      assert.ok(await morreu(pid), `PID ${pid}: sobrou`);
    } finally { matarSuite(d); limpar(d); }
  });
});

describe('B2 — todas as vagas ocupadas por um ancestral de outro worktree: recusa', () => {
  it('V5b: 1 vaga, gate de worktree irmão chamado de dentro da suíte: exit 2 em menos de 10 s, citando outro worktree', async () => {
    const { d, irmas } = await irmaos();
    try {
      const t0 = Date.now();
      const r = await npmTest(d, { KIT_GATE_VAGAS: '1' }, 30000);
      const ms = Date.now() - t0;
      assert.notEqual(r.signal, 'SIGKILL', `travou (${ms} ms): ${r.saida}`);
      assert.equal(r.status, 2, r.saida);
      assert.match(r.saida, /outro worktree/);
      assert.match(r.saida, /a suíte chama o gate de um worktree irmão que espera por ela/, 'N5: título próprio');
      assert.doesNotMatch(r.saida, /a suíte chama o gate deste mesmo worktree/, 'N5: a mensagem se contradiz');
      assert.ok(ms < 10000, `${ms} ms`);
    } finally { limpar(d, ...irmas); }
  });
  it('esperarAVez: dono de outro worktree, ancestral, com todas as vagas ocupadas', async () => {
    const trava = join(casa, `b2-${Date.now()}.trava`);
    const eu = quemSouEu(RAIZ); let voltas = 0;
    writeFileSync(trava, JSON.stringify({ ...eu, pid: process.pid, token: 'outro', worktree: '/x/outro-worktree' }));
    await assert.rejects(
      esperarAVez(trava, 1, eu, { avisar() {}, dormir: async () => { if (++voltas > 5) throw new Error('não recusou: continua esperando'); }, ancestraisDe: () => [process.pid] }),
      (e) => e.codigo === 'LACO' && /outro worktree/.test(e.message),
    );
  });
});

describe('R1 — com várias vagas, recusa só quando TODAS são de ancestrais', () => {
  it('2 vagas, uma de ancestral e outra de um processo comum que sai em 3 s: o irmão espera e roda', async () => {
    const { d, irmas } = await irmaos();
    const z = spawn('sleep', ['3'], { stdio: 'ignore' });
    const trava = join(casa, `r1-${Date.now()}.trava`);
    try {
      const eu = quemSouEu(RAIZ);
      writeFileSync(trava, JSON.stringify({ ...eu, pid: z.pid, token: 'z', worktree: '/x/z', venceEm: new Date(Date.now() + 3600000).toISOString() }));
      const t0 = Date.now();
      const r = await npmTest(d, { KIT_GATE_VAGAS: '2', KIT_GATE_TRAVA: trava }, 60000);
      assert.equal(r.status, 0, `${Date.now() - t0} ms: ${r.saida}`);
      assert.match(r.saida, /suite-irma/);
      assert.doesNotMatch(r.saida, /recusado/);
    } finally { z.kill('SIGKILL'); limpar(d, ...irmas); }
  });
  it('2 vagas, as duas de ancestrais (cadeia de 2 irmãs): exit 2 em menos de 10 s', async () => {
    const { d, irmas } = await irmaos(2);
    try {
      const t0 = Date.now();
      const r = await npmTest(d, { KIT_GATE_VAGAS: '2' }, 30000);
      const ms = Date.now() - t0;
      assert.notEqual(r.signal, 'SIGKILL', `travou (${ms} ms): ${r.saida}`);
      assert.equal(r.status, 2, r.saida);
      assert.match(r.saida, /outro worktree/);
      assert.ok(ms < 15000, `${ms} ms`);
    } finally { limpar(d, ...irmas); }
  });
  it('esperarAVez: um dono ancestral e outro não → espera; os dois ancestrais → recusa', async () => {
    const eu = quemSouEu(RAIZ);
    const vivo2 = spawn('sleep', ['60'], { stdio: 'ignore' });
    try {
      const base = join(casa, `r1u-${Date.now()}.trava`);
      const dono = (pid, token) => JSON.stringify({ ...eu, pid, token, worktree: `/x/${token}`, venceEm: new Date(Date.now() + 3600000).toISOString() });
      writeFileSync(base, dono(process.pid, 'a')); writeFileSync(`${base}.2`, dono(vivo2.pid, 'b'));
      let voltas = 0;
      const vaga = await esperarAVez(base, 2, eu, { avisar() {}, dormir: async () => { if (++voltas === 2) rmSync(`${base}.2`); }, ancestraisDe: () => [process.pid] });
      assert.equal(vaga, 2); assert.ok(voltas >= 2, `insumo: ${voltas} voltas`);
      writeFileSync(`${base}.2`, dono(vivo2.pid, 'b'));
      await assert.rejects(
        esperarAVez(base, 2, eu, { avisar() {}, dormir: async () => { if (++voltas > 40) throw new Error('não recusou'); }, ancestraisDe: () => [process.pid, vivo2.pid] }),
        (e) => e.codigo === 'LACO' && /outro worktree/.test(e.message),
      );
    } finally { vivo2.kill('SIGKILL'); }
  });
});

describe('N4 — os ancestrais são olhados uma vez por dono', () => {
  for (const [nome, worktree] of [['mesmo worktree', null], ['outro worktree', '/x/outro-worktree']]) {
    it(`${nome}: ancestraisDe roda uma vez enquanto o dono é o mesmo`, async () => {
      const trava = join(casa, `n4-${Date.now()}-${nome.length}.trava`);
      const eu = quemSouEu(RAIZ);
      const filho = spawn('sleep', ['60'], { stdio: 'ignore' });
      try {
        writeFileSync(trava, JSON.stringify({ ...eu, pid: filho.pid, token: 'dono-1', worktree: worktree ?? eu.worktree }));
        let chamadas = 0; let sonos = 0;
        const vaga = await esperarAVez(trava, 1, eu, {
          avisar() {},
          dormir: async () => { if (++sonos === 4) rmSync(trava); },
          ancestraisDe: () => { chamadas++; return []; },
        });
        assert.equal(vaga, 1);
        assert.ok(sonos >= 4, `insumo: esperou só ${sonos} voltas`);
        assert.equal(chamadas, 1, `ancestraisDe chamado ${chamadas} vezes em ${sonos} voltas`);
      } finally { filho.kill('SIGKILL'); }
    });
  }
});

describe('N2 — `ps` que falha e `ps` que demora não travam a espera nem recusam', () => {
  const GATE = pathToFileURL(join(RAIZ, 'gate', 'a-vez-do-gate.mjs')).href;
  for (const [nome, ps, maxMs] of [['ps que sai 1', '#!/bin/sh\nexit 1\n', 8000], ['ps que dorme', '#!/bin/sh\nexec sleep 30\n', 20000]]) {
    it(`${nome}: dono do mesmo worktree que não é ancestral — espera e toma a vez`, () => {
      const bin = join(casa, `ps-${nome.length}`); mkdirSync(bin, { recursive: true });
      writeFileSync(join(bin, 'ps'), ps, { mode: 0o755 });
      const d = repo({ 'a': '1' });
      const script = join(casa, `n2-${nome.length}.mjs`);
      writeFileSync(script, `import { esperarAVez, quemSouEu, ancestrais } from ${JSON.stringify(GATE)};
import { writeFileSync, rmSync } from 'node:fs'; import { spawn } from 'node:child_process';
const trava = process.argv[2]; const eu = quemSouEu(process.argv[3]);
const f = spawn('sleep', ['60'], { stdio: 'ignore' });
writeFileSync(trava, JSON.stringify({ ...eu, pid: f.pid, token: 'dono' }));
let n = 0;
try { const v = await esperarAVez(trava, 1, eu, { avisar() {}, intervaloMs: 10, dormir: async () => { if (++n === 2) rmSync(trava); }, ancestraisDe: ancestrais });
  console.log('vaga=' + v + ' ancestrais=' + JSON.stringify(ancestrais())); } catch (e) { console.log('ERRO ' + e.codigo + ' ' + e.message); }
f.kill('SIGKILL');\n`);
      try {
        const t0 = Date.now();
        const r = spawnSync('node', [script, join(casa, `n2-${nome.length}.trava`), d], { encoding: 'utf8', timeout: 40000, killSignal: 'SIGKILL', env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } });
        const ms = Date.now() - t0;
        assert.match(saida(r), /vaga=1 ancestrais=\[\]/, saida(r));
        assert.ok(ms < maxMs, `${ms} ms`);
      } finally { limpar(d); }
    });
  }
});
