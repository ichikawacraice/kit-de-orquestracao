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
const MP = 'ichikawa-kit';
const MP_ANTIGO = 'kit-de-orquestracao'; // o nome até o F344: a conta que não migrou ainda o tem

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
} else if (a[1] === 'install') {
  const id = a[2];
  if (process.env.FAKE_FALHA === id) { process.stderr.write('boom ' + id + '\\n'); process.exit(1); }
  const nome = id.split('@')[0];
  const pub = JSON.parse(fs.readFileSync(process.env.FAKE_CLONE + '/plugins/' + nome + '/.claude-plugin/plugin.json', 'utf8')).version;
  const e = est();
  e.installed.push({ id, version: pub, scope: a[a.indexOf('-s') + 1], enabled: true });
  fs.writeFileSync(process.env.FAKE_ESTADO, JSON.stringify(e));
  process.stdout.write(JSON.stringify({ outcome: 'ok' }) + '\\n');
} else if (a[1] === 'uninstall' || a[1] === 'disable') {
  const id = a[2]; const scope = a[a.indexOf('-s') + 1];
  if (process.env.FAKE_FALHA === a[1] + ' ' + id) { process.stderr.write('boom ' + a[1] + '\\n'); process.exit(1); }
  const e = est();
  if (a[1] === 'uninstall') e.installed = e.installed.filter((p) => !(p.id === id && p.scope === scope));
  else for (const p of e.installed) if (p.id === id && p.scope === scope) p.enabled = false;
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
function montar(publicadas, instalados, mp = MP) {
  const raiz = mkdtempSync(join(tmpdir(), 'atualizar-plugins-'));
  const origin = join(raiz, 'origin.git'); const work = join(raiz, 'work'); const home = join(raiz, 'home');
  const clone = join(home, '.claude', 'plugins', 'marketplaces', mp);
  git(raiz, 'init', '-q', '--bare', '-b', 'main', origin);
  git(raiz, 'clone', '-q', origin, work);
  git(work, 'checkout', '-q', '-b', 'main');
  const publicar = (versoes) => {
    mkdirSync(join(work, '.claude-plugin'), { recursive: true });
    writeFileSync(join(work, '.claude-plugin', 'marketplace.json'), JSON.stringify({ name: mp, plugins: Object.keys(versoes).map((n) => ({ name: n, source: `./plugins/${n}` })) }));
    for (const [n, v] of Object.entries(versoes)) {
      mkdirSync(join(work, 'plugins', n, '.claude-plugin'), { recursive: true });
      const userConfig = n === 'kit-design' ? { guarda: {}, cobrar_critica: {}, pasta_do_front: {}, largura: {} } : undefined;
      writeFileSync(join(work, 'plugins', n, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: n, version: v, userConfig }));
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
  c.chamadas = () => readFileSync(log, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  c.updates = () => c.chamadas().filter((x) => x[1] === 'update');
  c.estado = () => JSON.parse(readFileSync(estado, 'utf8')).installed;
  c.settings = (v) => { mkdirSync(join(home, '.claude'), { recursive: true }); writeFileSync(join(home, '.claude', 'settings.json'), JSON.stringify(v)); };
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
  const c = montar({ orquestracao: '0.1.2', processos: '0.2.9' }, [inst('orquestracao', '0.1.2')]);
  try {
    const r = c.rodar();
    assert.equal(r.exit, 0, r.err);
    assert.equal(achar(JSON.parse(r.out), 'processos').acao, 'não instalado');
    assert.equal(c.updates().length, 0);
  } finally { limpar(c); }
});

test('plugin update que sai ≠ 0: "falhou" com a mensagem, os outros seguem, exit 1', () => {
  const c = montar({ orquestracao: '0.1.2', design: '0.2.9' }, [inst('orquestracao', '0.1.1'), inst('design', '0.2.0')]);
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

// F332: o plugin `design` do kit virou `kit-design` (o `design` da Anthropic o ofuscava). Quem tem o velho no escopo user ganha o
// novo instalado com as mesmas opções e o mesmo liga/desliga, e só depois o velho sai.
const RENOMEADO = { orquestracao: '0.1.2', 'kit-design': '0.3.0' };

test('F332: design@ instalado e só kit-design@ publicado: instala o novo com as opções do velho e desinstala o velho', () => {
  const c = montar(RENOMEADO, [inst('orquestracao', '0.1.2'), inst('design', '0.0.7')]);
  try {
    c.settings({ pluginConfigs: { [`design@${MP}`]: { options: { guarda: false, pasta_do_front: 'web', largura: 1024, saiu_do_manifesto: true } } } });
    const r = c.rodar();
    assert.equal(r.exit, 0, r.err + r.out);
    const ch = c.chamadas().filter((x) => ['install', 'uninstall', 'disable'].includes(x[1]));
    assert.deepEqual(ch.map((x) => `${x[1]} ${x[2]}`), [`install kit-design@${MP}`, `uninstall design@${MP}`], 'o novo entra antes de o velho sair');
    const install = ch[0];
    assert.equal(install[install.indexOf('-s') + 1], 'user');
    const configs = install.flatMap((x, i) => (x === '--config' ? [install[i + 1]] : [])).sort();
    assert.deepEqual(configs, ['guarda=false', 'largura=1024', 'pasta_do_front=web']);
    const s = JSON.parse(r.out);
    const p = achar(s, 'kit-design');
    assert.ok(p, r.out);
    assert.deepEqual([p.antes, p.publicado, p.depois], ['0.0.7', '0.3.0', '0.3.0']);
    assert.match(p.acao, /^renomeado \(era design@ichikawa-kit\)/);
    assert.equal(s.reiniciar, true);
    assert.ok(!c.estado().some((x) => x.id === `design@${MP}` && x.scope === 'user'), 'o velho ficou');
    assert.ok(!achar(s, 'design'), 'o velho não aparece como linha própria');
    assert.match(c.rodar([]).out, /kit-design\s+\(em dia\)|kit-design\s+0\.3\.0 \(em dia\)/);
  } finally { limpar(c); }
});

test('F332: velho desligado no settings da conta: o novo entra desligado (o enabled da lista, que pode vir do projeto, não conta)', () => {
  const c = montar(RENOMEADO, [inst('design', '0.0.7', { enabled: true })]);
  try {
    c.settings({ enabledPlugins: { [`design@${MP}`]: false } });
    const r = c.rodar();
    assert.equal(r.exit, 0, r.err + r.out);
    const ch = c.chamadas().filter((x) => ['install', 'uninstall', 'disable'].includes(x[1]));
    assert.deepEqual(ch.map((x) => `${x[1]} ${x[2]}`), [`install kit-design@${MP}`, `disable kit-design@${MP}`, `uninstall design@${MP}`]);
    assert.equal(c.estado().find((x) => x.id === `kit-design@${MP}`).enabled, false);
  } finally { limpar(c); }
});

test('F332: velho desligado só na lista (projeto), ligado na conta: o novo não é desligado', () => {
  const c = montar(RENOMEADO, [inst('design', '0.0.7', { enabled: false })]);
  try {
    const r = c.rodar();
    assert.equal(r.exit, 0, r.err + r.out);
    assert.ok(c.chamadas().some((x) => x[1] === 'install'), 'precondição: instalou');
    assert.ok(!c.chamadas().some((x) => x[1] === 'disable'));
  } finally { limpar(c); }
});

test('F332: --seco diz que renomearia e não chama install nem uninstall', () => {
  const c = montar(RENOMEADO, [inst('design', '0.0.7')]);
  try {
    const r = c.rodar(['--seco', '--json']);
    assert.equal(r.exit, 0, r.err + r.out);
    assert.equal(achar(JSON.parse(r.out), 'kit-design').acao, 'renomearia (era design@ichikawa-kit)');
    assert.ok(!c.chamadas().some((x) => ['install', 'uninstall'].includes(x[1])));
    const txt = c.rodar(['--seco']).out;
    assert.match(txt, /kit-design\s+0\.0\.7 → 0\.3\.0 \(renomearia: era design@ichikawa-kit\)/);
    assert.match(txt, /Rode sem --seco para atualizar\./);
  } finally { limpar(c); }
});

test('F332: install do novo falha: o velho fica, falhou, exit 1', () => {
  const c = montar(RENOMEADO, [inst('design', '0.0.7')]);
  try {
    const r = c.rodar(['--json'], { FAKE_FALHA: `kit-design@${MP}` });
    assert.equal(r.exit, 1, r.err + r.out);
    const p = achar(JSON.parse(r.out), 'kit-design');
    assert.equal(p.acao, 'falhou'); assert.match(p.mensagem, /boom/);
    assert.ok(!c.chamadas().some((x) => x[1] === 'uninstall'), 'desinstalou o velho sem ter o novo');
    assert.ok(c.estado().some((x) => x.id === `design@${MP}`));
  } finally { limpar(c); }
});

test('F332: o novo já instalado: só desinstala o velho; cópia project do velho não se mexe e pede o kit atualizar', () => {
  const c = montar(RENOMEADO, [inst('kit-design', '0.3.0'), inst('design', '0.0.7'), inst('design', '0.0.6', { scope: 'project', projectPath: '/x/loja' })]);
  try {
    const r = c.rodar();
    assert.equal(r.exit, 0, r.err + r.out);
    const ch = c.chamadas().filter((x) => ['install', 'uninstall', 'disable'].includes(x[1]));
    assert.deepEqual(ch.map((x) => `${x[1]} ${x[2]} ${x[x.indexOf('-s') + 1]}`), [`uninstall design@${MP} user`]);
    const s = JSON.parse(r.out);
    const proj = s.plugins.find((p) => p.id === `design@${MP}` && p.acao.startsWith('não mexido'));
    assert.ok(proj, r.out);
    assert.match(proj.acao, /kit atualizar/);
    assert.ok(c.estado().some((x) => x.id === `design@${MP}` && x.scope === 'project'));
  } finally { limpar(c); }
});

test('conta com o nome antigo do marketplace (F344): atualiza pelo id antigo, no clone antigo, e avisa da migração', () => {
  const antigo = (nome, version) => ({ id: `${nome}@${MP_ANTIGO}`, version, scope: 'user', enabled: true });
  const c = montar({ orquestracao: '0.1.2' }, [antigo('orquestracao', '0.1.1')], MP_ANTIGO);
  try {
    const r = c.rodar();
    assert.equal(r.exit, 0, r.err + r.out);
    assert.deepEqual(c.updates()[0].slice(1), ['update', `orquestracao@${MP_ANTIGO}`, '--json', '-s', 'user']);
    assert.ok(c.chamadas().some((x) => x[1] === 'marketplace' && x[2] === 'update' && x[3] === MP_ANTIGO));
    const s = JSON.parse(r.out);
    assert.equal(s.plugins.find((p) => p.id === `orquestracao@${MP_ANTIGO}`)?.acao, 'atualizado');
    assert.match(s.aviso, /nome antigo do marketplace.*migrar-marketplace/);
    const t = c.rodar([]);
    assert.match(t.out, /aviso: .*migrar-marketplace/);
  } finally { limpar(c); }
});

test('conta já com o nome novo: sem aviso de migração', () => {
  const c = montar({ orquestracao: '0.1.2' }, [inst('orquestracao', '0.1.2')]);
  try {
    const s = JSON.parse(c.rodar().out);
    assert.equal(s.plugins.find((p) => p.id === `orquestracao@${MP}`)?.acao, 'em dia');
    assert.equal(s.aviso, undefined);
  } finally { limpar(c); }
});
