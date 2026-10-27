#!/usr/bin/env node
// Testes de `atualizar-plugins [--seco] [--json]` (F151). GitHub = repo bare temporário; o clone do marketplace mora no HOME
// temporário; `claude` é um script falso (CLAUDE_BIN). Nunca toca ~/.claude real.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'skills', 'orquestradora', 'scripts', 'atualizar-plugins.mjs');
const MP = 'kit-de-orquestracao';

const CLAUDE_FALSO = `#!/usr/bin/env node
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const a = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_LOG, JSON.stringify(a) + '\\n');
const est = () => JSON.parse(fs.readFileSync(process.env.FAKE_ESTADO, 'utf8'));
if (a[1] === 'list') process.stdout.write(JSON.stringify(est().installed));
else if (a[1] === 'marketplace' && a[2] === 'update') {
  if (process.env.FAKE_PULL === '1') execFileSync('git', ['-C', process.env.FAKE_CLONE, 'pull', '-q'], { stdio: 'ignore' });
  process.stdout.write(JSON.stringify({ command: 'marketplace-update', outcome: 'ok' }) + '\\n');
} else if (a[1] === 'update') {
  const id = a[2];
  if (process.env.FAKE_FALHA === id) { process.stderr.write('boom ' + id + '\\n'); process.exit(1); }
  if (process.env.FAKE_NAO_PEGA === id) { process.stdout.write(JSON.stringify({ outcome: 'ok' }) + '\\n'); process.exit(0); }
  if (process.env.FAKE_SOME === id) {
    const e0 = est(); e0.installed = e0.installed.filter((p) => !(p.id === id && p.scope === 'user'));
    fs.writeFileSync(process.env.FAKE_ESTADO, JSON.stringify(e0));
    process.stdout.write(JSON.stringify({ outcome: 'ok' }) + '\\n'); process.exit(0);
  }
  const nome = id.split('@')[0];
  const pub = JSON.parse(fs.readFileSync(process.env.FAKE_CLONE + '/plugins/' + nome + '/.claude-plugin/plugin.json', 'utf8')).version;
  const e = est();
  for (const p of e.installed) if (p.id === id && p.scope === 'user') p.version = pub;
  fs.writeFileSync(process.env.FAKE_ESTADO, JSON.stringify(e));
  process.stdout.write(JSON.stringify({ outcome: 'ok' }) + '\\n');
} else process.exit(2);
`;

function git(cwd, ...args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 20000, killSignal: 'SIGKILL', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
}

// Publica no "GitHub" as versões dadas ({nome: versão}) e devolve o contexto.
function montar(publicadas, instalados) {
  const raiz = mkdtempSync(join(tmpdir(), 'atualizar-plugins-'));
  const origin = join(raiz, 'origin.git'); const work = join(raiz, 'work'); const home = join(raiz, 'home');
  const clone = join(home, '.claude', 'plugins', 'marketplaces', MP);
  git(raiz, 'init', '-q', '--bare', '-b', 'main', origin);
  git(raiz, 'clone', '-q', origin, work);
  git(work, 'checkout', '-q', '-b', 'main');
  const publicar = (versoes) => {
    mkdirSync(join(work, '.claude-plugin'), { recursive: true });
    writeFileSync(join(work, '.claude-plugin', 'marketplace.json'), JSON.stringify({ name: MP, plugins: Object.keys(versoes).map((n) => ({ name: n, source: `./plugins/${n}` })) }));
    for (const [n, v] of Object.entries(versoes)) {
      mkdirSync(join(work, 'plugins', n, '.claude-plugin'), { recursive: true });
      writeFileSync(join(work, 'plugins', n, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: n, version: v }));
    }
    git(work, 'add', '-A'); git(work, 'commit', '-qm', 'publica'); git(work, 'push', '-q', 'origin', 'main');
  };
  publicar(publicadas);
  mkdirSync(dirname(clone), { recursive: true });
  git(raiz, 'clone', '-q', origin, clone);
  const bin = join(raiz, 'claude'); writeFileSync(bin, CLAUDE_FALSO); chmodSync(bin, 0o755);
  const estado = join(raiz, 'estado.json'); const log = join(raiz, 'claude.log');
  writeFileSync(estado, JSON.stringify({ installed: instalados })); writeFileSync(log, '');
  const c = { raiz, clone, publicar, estado, log };
  c.rodar = (args = ['--json'], env = {}) => {
    const r = spawnSync('node', [SCRIPT, ...args], {
      encoding: 'utf8', timeout: 60000, killSignal: 'SIGKILL',
      env: { ...process.env, HOME: home, CLAUDE_BIN: bin, FAKE_ESTADO: estado, FAKE_LOG: log, FAKE_CLONE: clone, FAKE_PULL: '1', ...env },
    });
    assert.ok(!r.error, String(r.error));
    return { exit: r.status, out: r.stdout, err: r.stderr };
  };
  c.updates = () => readFileSync(log, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((x) => x[1] === 'update');
  return c;
}
const inst = (nome, version, extra = {}) => ({ id: `${nome}@${MP}`, version, scope: 'user', enabled: true, ...extra });
const limpar = (c) => rmSync(c.raiz, { recursive: true, force: true });
const achar = (s, nome, acao) => s.plugins.find((p) => p.id === `${nome}@${MP}` && (!acao || p.acao.startsWith(acao)));

test('versão instalada < publicada: chama plugin update com o id completo, mostra antes → depois e reiniciar', () => {
  const c = montar({ orquestracao: '0.1.2' }, [inst('orquestracao', '0.1.1')]);
  try {
    // o GitHub anda depois do clone: o marketplace update (falso) puxa
    c.publicar({ orquestracao: '0.1.3' });
    const r = c.rodar();
    assert.equal(r.exit, 0, r.err + r.out);
    assert.deepEqual(c.updates()[0].slice(1), ['update', `orquestracao@${MP}`, '--json', '-s', 'user']);
    assert.equal(c.updates().length, 1);
    const s = JSON.parse(r.out);
    const p = achar(s, 'orquestracao');
    assert.deepEqual([p.antes, p.publicado, p.depois, p.acao], ['0.1.1', '0.1.3', '0.1.3', 'atualizado']);
    assert.equal(s.reiniciar, true);
    assert.ok(s.clone.depois && s.clone.depois === s.clone.remoto, JSON.stringify(s.clone));
  } finally { limpar(c); }
});

test('texto: uma linha por plugin e o aviso de reiniciar', () => {
  const c = montar({ orquestracao: '0.1.2' }, [inst('orquestracao', '0.1.1')]);
  try {
    const r = c.rodar([]);
    assert.equal(r.exit, 0, r.err);
    assert.match(r.out, /orquestracao\s+0\.1\.1 → 0\.1\.2/);
    assert.match(r.out, /Reinicie o app para valer\./);
  } finally { limpar(c); }
});

test('todos em dia: nenhum plugin update, reiniciar false, exit 0', () => {
  const c = montar({ orquestracao: '0.1.2', design: '0.2.0' }, [inst('orquestracao', '0.1.2'), inst('design', '0.2.0')]);
  try {
    const r = c.rodar();
    assert.equal(r.exit, 0, r.err);
    assert.equal(c.updates().length, 0);
    const s = JSON.parse(r.out);
    assert.equal(s.reiniciar, false);
    assert.equal(s.plugins.length, 2);
    assert.ok(s.plugins.every((p) => p.acao === 'em dia'), JSON.stringify(s.plugins));
    assert.match(c.rodar([]).out, /Nada a atualizar\./);
  } finally { limpar(c); }
});

test('clone que não andou: tenta de novo; continuando atrás, erro com os dois shas e nenhum plugin update', () => {
  const c = montar({ orquestracao: '0.1.2' }, [inst('orquestracao', '0.1.1')]);
  try {
    c.publicar({ orquestracao: '0.1.3' });
    const r = c.rodar(['--json'], { FAKE_PULL: '0' });
    assert.equal(r.exit, 1);
    assert.match(r.err, /o clone do marketplace ficou em [0-9a-f]{7,}, o GitHub está em [0-9a-f]{7,}/);
    assert.equal(c.updates().length, 0);
    const tentativas = readFileSync(c.log, 'utf8').split('\n').filter((l) => l.includes('"marketplace"')).length;
    assert.equal(tentativas, 2, 'uma tentativa a mais');
  } finally { limpar(c); }
});

test('--seco: nenhum plugin update e a saída lista quem atualizaria', () => {
  const c = montar({ orquestracao: '0.1.2' }, [inst('orquestracao', '0.1.1')]);
  try {
    const r = c.rodar(['--seco', '--json']);
    assert.equal(r.exit, 0, r.err);
    assert.equal(c.updates().length, 0);
    const p = achar(JSON.parse(r.out), 'orquestracao');
    assert.equal(p.acao, 'atualizaria'); assert.equal(p.antes, '0.1.1'); assert.equal(p.publicado, '0.1.2');
    const txt = c.rodar(['--seco']).out;
    assert.match(txt, /orquestracao\s+0\.1\.1 → 0\.1\.2/);
    assert.doesNotMatch(txt, /Nada a atualizar/);
    assert.match(txt, /Rode sem --seco para atualizar\./);
  } finally { limpar(c); }
});

test('cópia scope project: "não mexido (projeto …)", sem plugin update para ela', () => {
  const c = montar({ orquestracao: '0.1.2' }, [inst('orquestracao', '0.1.2'), inst('orquestracao', '0.0.9', { scope: 'project', projectPath: '/x/rascunho' })]);
  try {
    const r = c.rodar();
    assert.equal(r.exit, 0, r.err);
    assert.equal(c.updates().length, 0);
    const p = JSON.parse(r.out).plugins.find((x) => x.acao.startsWith('não mexido'));
    assert.ok(p, r.out);
    assert.equal(p.acao, 'não mexido (projeto /x/rascunho)');
  } finally { limpar(c); }
});

test('plugin do marketplace sem instalação: "não instalado", e não é instalado', () => {
  const c = montar({ orquestracao: '0.1.2', processos: '0.2.1' }, [inst('orquestracao', '0.1.2')]);
  try {
    const r = c.rodar();
    assert.equal(r.exit, 0, r.err);
    assert.equal(achar(JSON.parse(r.out), 'processos').acao, 'não instalado');
    assert.equal(c.updates().length, 0);
  } finally { limpar(c); }
});

test('plugin update que sai ≠ 0: "falhou" com a mensagem, os outros seguem, exit 1', () => {
  const c = montar({ orquestracao: '0.1.2', design: '0.2.1' }, [inst('orquestracao', '0.1.1'), inst('design', '0.2.0')]);
  try {
    const r = c.rodar(['--json'], { FAKE_FALHA: `orquestracao@${MP}` });
    assert.equal(r.exit, 1);
    const s = JSON.parse(r.out);
    const f = achar(s, 'orquestracao');
    assert.equal(f.acao, 'falhou'); assert.match(f.mensagem, /boom/);
    assert.equal(achar(s, 'design').acao, 'atualizado');
    assert.equal(c.updates().length, 2);
  } finally { limpar(c); }
});

test('plugin update sai 0 sem a versão chegar: "não pegou", exit 1, sem pedir reinício', () => {
  const c = montar({ orquestracao: '0.1.2' }, [inst('orquestracao', '0.1.1')]);
  try {
    const r = c.rodar(['--json'], { FAKE_NAO_PEGA: `orquestracao@${MP}` });
    assert.equal(r.exit, 1, r.err + r.out);
    const s = JSON.parse(r.out);
    const p = achar(s, 'orquestracao');
    assert.ok(p, r.out);
    assert.equal(p.acao, 'não pegou');
    assert.equal(p.depois, '0.1.1');
    assert.equal(s.reiniciar, false);
    assert.equal(c.updates().length, 1, 'sem nova tentativa');
    const txt = c.rodar([], { FAKE_NAO_PEGA: `orquestracao@${MP}` }).out;
    assert.ok(txt.includes('0.1.1 (não pegou: instalada ficou em 0.1.1, publicada 0.1.2)'), txt);
    assert.ok(!txt.includes('Reinicie o app'), txt);
  } finally { limpar(c); }
});

test('plugin update sai 0 e o plugin some da lista: "não pegou", depois null, exit 1', () => {
  const c = montar({ orquestracao: '0.1.2' }, [inst('orquestracao', '0.1.1')]);
  try {
    const r = c.rodar(['--json'], { FAKE_SOME: `orquestracao@${MP}` });
    assert.equal(r.exit, 1, r.err + r.out);
    const s = JSON.parse(r.out);
    const p = achar(s, 'orquestracao');
    assert.ok(p, r.out);
    assert.equal(p.acao, 'não pegou');
    assert.equal(p.depois, null);
    assert.match(p.mensagem, /instalada sumiu da lista/);
    assert.equal(s.reiniciar, false);
  } finally { limpar(c); }
});
