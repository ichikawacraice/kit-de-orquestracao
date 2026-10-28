#!/usr/bin/env node
// Testes de `painel mergear <PR> <sha> [--seco]` (F150). Repo git real (origin bare + clone) e um `gh` falso (GH_BIN)
// que lê o estado dos PRs de um JSON e anota cada chamada. Nunca toca o painel nem o HOME reais.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, chmodSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'skills', 'orquestradora', 'scripts');
const LA = 'local_00000000-0000-4000-8000-0000000000a1';
const LB = 'local_00000000-0000-4000-8000-0000000000b2';

const GH_FALSO = `#!/usr/bin/env node
const fs = require('node:fs');
const a = process.argv.slice(2);
fs.appendFileSync(process.env.GH_LOG, JSON.stringify(a) + '\\n');
const est = JSON.parse(fs.readFileSync(process.env.GH_ESTADO, 'utf8'));
const pr = est.prs[a[2]];
if (a[0] === 'pr' && a[1] === 'view') {
  if (!pr) { process.stderr.write('GraphQL: Could not resolve to a PullRequest with the number of ' + a[2] + '.\\n'); process.exit(1); }
  process.stdout.write(JSON.stringify({ number: Number(a[2]), ...pr }));
} else if (a[0] === 'pr' && a[1] === 'merge') {
  if (!pr) process.exit(1);
  const i = a.indexOf('--match-head-commit');
  if (i < 0 || !/^[0-9a-f]{40}$/.test(a[i + 1])) { process.stderr.write('Could not coerce value to GitObjectID\\n'); process.exit(1); }
  pr.state = 'MERGED';
  fs.writeFileSync(process.env.GH_ESTADO, JSON.stringify(est));
} else process.exit(2);
`;

function git(cwd, ...args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 20000, killSignal: 'SIGKILL', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
}

// Monta: origin bare, clone `projx` (o nome da pasta é o projeto), PR 12 = commit em refs/pull/12/head.
function montar({ conflito = false, bump = false } = {}) {
  const raiz = mkdtempSync(join(tmpdir(), 'painel-mergear-'));
  const origin = join(raiz, 'origin.git');
  const clone = join(raiz, 'projx');
  git(raiz, 'init', '-q', '--bare', '-b', 'main', origin);
  git(raiz, 'clone', '-q', origin, clone);
  writeFileSync(join(clone, 'a.txt'), 'base\n');
  const pluginJson = join(clone, 'plugins', 'p', '.claude-plugin', 'plugin.json');
  mkdirSync(dirname(pluginJson), { recursive: true });
  writeFileSync(pluginJson, '{\n  "name": "p",\n  "version": "0.1.0"\n}\n');
  git(clone, 'add', '.'); git(clone, 'commit', '-qm', 'base'); git(clone, 'branch', '-M', 'main'); git(clone, 'push', '-q', 'origin', 'main');
  git(clone, 'checkout', '-q', '-b', 'pr');
  writeFileSync(join(clone, conflito ? 'a.txt' : 'b.txt'), 'do pr\n');
  if (bump) writeFileSync(pluginJson, '{\n  "name": "p",\n  "version": "0.1.1"\n}\n');
  git(clone, 'add', '.'); git(clone, 'commit', '-qm', 'pr');
  const sha = git(clone, 'rev-parse', 'HEAD');
  git(clone, 'push', '-q', 'origin', 'pr:refs/pull/12/head');
  git(clone, 'checkout', '-q', 'main');
  if (conflito) { writeFileSync(join(clone, 'a.txt'), 'da main\n'); git(clone, 'commit', '-qam', 'main anda'); git(clone, 'push', '-q', 'origin', 'main'); }
  const gh = join(raiz, 'gh');
  writeFileSync(gh, GH_FALSO); chmodSync(gh, 0o755);
  const estado = join(raiz, 'estado.json');
  const log = join(raiz, 'gh.log');
  writeFileSync(log, '');
  const prs = { 12: { state: 'OPEN', headRefOid: sha, baseRefName: 'main', headRefName: 'pr' } };
  writeFileSync(estado, JSON.stringify({ prs }));
  mkdirSync(join(raiz, 'painel')); mkdirSync(join(raiz, 'home'));
  writeFileSync(join(raiz, 'painel', 'temas.json'), JSON.stringify([{ id: 'editor', rotulo: 'Editor', projeto: 'projx' }, { id: 'editor', rotulo: 'Editor', projeto: 'outro' }]));
  const ctx = { raiz, clone, sha, estado, log, gh };
  ctx.painel = (...args) => {
    const r = spawnSync('node', [join(SCRIPTS, 'painel.mjs'), ...args], {
      cwd: clone, encoding: 'utf8', timeout: 60000, killSignal: 'SIGKILL',
      env: { ...process.env, PAINEL_DIR: join(raiz, 'painel'), HOME: join(raiz, 'home'), CLAUDE_CODE_SESSION_ID: '', GH_BIN: gh, GH_ESTADO: estado, GH_LOG: log },
    });
    assert.ok(!r.error, String(r.error));
    return { exit: r.status, out: r.stdout, err: r.stderr };
  };
  ctx.chamadas = () => readFileSync(log, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  ctx.merges = () => ctx.chamadas().filter((c) => c[1] === 'merge');
  ctx.item = (F, extra = {}) => {
    const r = ctx.painel('set', 'fila', F, JSON.stringify({ titulo: 'T', etapa: 'merge', tema: 'editor', prs: [12], donoLocalId: LA, donoApelido: 'P1', ...extra }));
    assert.equal(r.exit, 0, r.err);
    assert.equal(ctx.painel('com', 'add', F, LA, 'E1', 'o código').exit, 0);
    assert.equal(ctx.painel('com', 'add', F, LB, 'V4', 'a validação').exit, 0);
  };
  ctx.dado = (F) => JSON.parse(ctx.painel('get', 'fila', F).out).data;
  return ctx;
}
const limpar = (c) => rmSync(c.raiz, { recursive: true, force: true });

test('sha curto vira os 40 hex no gh pr merge, e o merge sai com 0', () => {
  const c = montar();
  try {
    const r = c.painel('mergear', '12', c.sha.slice(0, 7));
    assert.equal(r.exit, 0, r.err + r.out);
    const m = c.merges();
    assert.equal(m.length, 1, 'um merge');
    assert.deepEqual(m[0], ['pr', 'merge', '12', '--squash', '--match-head-commit', c.sha]);
    const s = JSON.parse(r.out);
    assert.equal(s.mergeado, true); assert.equal(s.sha, c.sha);
  } finally { limpar(c); }
});

test('sha que não é prefixo da ponta: recusa "a ponta mudou", sem merge', () => {
  const c = montar();
  try {
    const r = c.painel('mergear', '12', 'abc1234');
    assert.equal(r.exit, 1);
    const s = JSON.parse(r.out);
    assert.equal(s.recusado, true);
    assert.match(s.motivo, /a ponta mudou: validado abc1234, agora /);
    assert.equal(c.merges().length, 0);
  } finally { limpar(c); }
});

test('sha com menos de 7 hex ou não hex: erro de uso, sem chamar o gh', () => {
  const c = montar();
  try {
    for (const ruim of ['abc12', 'zzzzzzz', 'HEAD']) {
      const r = c.painel('mergear', '12', ruim);
      assert.equal(r.exit, 1, ruim);
      assert.match(r.err, /uso: painel\.mjs mergear/);
    }
    assert.equal(c.chamadas().length, 0);
  } finally { limpar(c); }
});

test('PR que não está OPEN: recusa, sem merge', () => {
  const c = montar();
  try {
    for (const estado of ['MERGED', 'CLOSED']) {
      const e = JSON.parse(readFileSync(c.estado, 'utf8')); e.prs[12].state = estado; writeFileSync(c.estado, JSON.stringify(e));
      const r = c.painel('mergear', '12', c.sha.slice(0, 7));
      assert.equal(r.exit, 1, estado);
      assert.equal(JSON.parse(r.out).recusado, true);
      assert.match(JSON.parse(r.out).motivo, new RegExp(estado));
    }
    assert.equal(c.merges().length, 0);
  } finally { limpar(c); }
});

test('conflito com a base: recusa com conflito:true e os arquivos, sem merge', () => {
  const c = montar({ conflito: true });
  try {
    const r = c.painel('mergear', '12', c.sha.slice(0, 7));
    assert.equal(r.exit, 1, r.err);
    const s = JSON.parse(r.out);
    assert.equal(s.recusado, true); assert.equal(s.conflito, true);
    assert.ok(Array.isArray(s.arquivos) && s.arquivos.length > 0, 'lista de arquivos vazia');
    assert.ok(s.arquivos.includes('a.txt'), JSON.stringify(s.arquivos));
    assert.equal(c.merges().length, 0);
  } finally { limpar(c); }
});

test('item com o PR: fecha (feito, sem dono, com vazio), agora com o sha curto; item de outro projeto não muda', () => {
  const c = montar();
  try {
    c.item('F1');
    c.painel('com', 'add', 'F1', LB, 'ajuda', 'a revisão');
    assert.ok(c.dado('F1').com.length >= 1, 'com montado');
    // item de outro projeto, mesmo número de PR
    const outro = c.painel('set', 'fila', 'F2', JSON.stringify({ titulo: 'T', etapa: 'merge', tema: 'editor', projeto: 'outro', prs: [12] }));
    assert.equal(outro.exit, 0, outro.err);
    const r = c.painel('mergear', '12', c.sha.slice(0, 7));
    assert.equal(r.exit, 0, r.err);
    const d = c.dado('F1');
    assert.equal(d.etapa, 'feito');
    assert.equal(d.donoLocalId, undefined); assert.equal(d.donoApelido, undefined);
    assert.deepEqual(d.com, []);
    assert.ok(d.agora.includes(c.sha.slice(0, 7)), d.agora);
    assert.equal(c.dado('F2').etapa, 'merge');
    const s = JSON.parse(r.out);
    assert.deepEqual(s.itens.map((i) => [i.item, i.fechado]), [['F1', true]]);
  } finally { limpar(c); }
});

test('item com dois PRs e o outro ainda OPEN: fica em merge, com vazio, agora "um PR entrou; falta outro"', () => {
  const c = montar();
  try {
    const e = JSON.parse(readFileSync(c.estado, 'utf8')); e.prs[13] = { state: 'OPEN', headRefOid: 'f'.repeat(40), baseRefName: 'main', headRefName: 'x' }; writeFileSync(c.estado, JSON.stringify(e));
    c.item('F1', { prs: [12, 13] });
    const r = c.painel('mergear', '12', c.sha.slice(0, 7));
    assert.equal(r.exit, 0, r.err);
    const d = c.dado('F1');
    assert.equal(d.etapa, 'merge');
    assert.deepEqual(d.com, []);
    assert.equal(d.agora, 'um PR entrou; falta outro');
    assert.equal(JSON.parse(r.out).itens[0].fechado, false);
  } finally { limpar(c); }
});

test('F222: item com maisFatias: o merge da fatia não fecha — volta a execucao com a dona e o com; o --seco diz fecharia: false', () => {
  const c = montar();
  try {
    c.item('F1', { maisFatias: true });
    const seco = JSON.parse(c.painel('mergear', '12', c.sha.slice(0, 7), '--seco').out);
    assert.deepEqual(seco.itens.map((i) => [i.item, i.fecharia]), [['F1', false]]);
    const comAntes = c.dado('F1').com;
    assert.ok(comAntes.length >= 1, 'com montado');
    const r = c.painel('mergear', '12', c.sha.slice(0, 7));
    assert.equal(r.exit, 0, r.err);
    const d = c.dado('F1');
    assert.equal(d.etapa, 'execucao');
    assert.equal(d.donoLocalId, LA); assert.equal(d.donoApelido, 'P1');
    assert.deepEqual(d.com, comAntes);
    assert.equal(d.maisFatias, true, 'a marca fica até a dona tirá-la na última fatia');
    assert.deepEqual(d.prs, [12], 'o PR mergeado continua no item');
    assert.ok(d.agora.includes('fatia') && d.agora.includes(c.sha.slice(0, 7)), d.agora);
    assert.deepEqual(JSON.parse(r.out).itens.map((i) => [i.item, i.fechado, i.fatia, i.dona]), [['F1', false, true, LA]]);
  } finally { limpar(c); }
});

test('F222: a última fatia (maisFatias: false) fecha como o item de um PR só', () => {
  const c = montar();
  try {
    c.item('F1', { maisFatias: false });
    const r = c.painel('mergear', '12', c.sha.slice(0, 7));
    assert.equal(r.exit, 0, r.err);
    const d = c.dado('F1');
    assert.equal(d.etapa, 'feito');
    assert.equal(d.donoLocalId, undefined);
    assert.deepEqual(d.com, []);
  } finally { limpar(c); }
});

test('F222: maisFatias que não é booleano é recusado', () => {
  const c = montar();
  try {
    const r = c.painel('set', 'fila', 'F1', JSON.stringify({ titulo: 'T', etapa: 'merge', tema: 'editor', maisFatias: 'sim' }));
    assert.notEqual(r.exit, 0);
    assert.match(r.err, /maisFatias/);
  } finally { limpar(c); }
});

test('--seco confere tudo e não chama gh pr merge nem grava o painel', () => {
  const c = montar();
  try {
    c.item('F1');
    const antes = c.dado('F1');
    const r = c.painel('mergear', '12', c.sha.slice(0, 7), '--seco');
    assert.equal(r.exit, 0, r.err);
    const s = JSON.parse(r.out);
    assert.equal(s.seco, true);
    assert.equal(c.merges().length, 0);
    assert.deepEqual(c.dado('F1'), antes);
    // e o --seco também recusa o que o merge real recusaria
    const ruim = c.painel('mergear', '12', 'abc1234', '--seco');
    assert.equal(ruim.exit, 1);
  } finally { limpar(c); }
});

test('nenhum item com o PR: mergeia e diz itens: [] (não é erro)', () => {
  const c = montar();
  try {
    const r = c.painel('mergear', '12', c.sha.slice(0, 7));
    assert.equal(r.exit, 0, r.err);
    const s = JSON.parse(r.out);
    assert.ok(Array.isArray(s.itens)); assert.equal(s.itens.length, 0);
    assert.equal(c.merges().length, 1);
  } finally { limpar(c); }
});

test('PR que o gh não conhece: erro legível, exit ≠ 0, sem merge', () => {
  const c = montar();
  try {
    const r = c.painel('mergear', '999', 'abc1234', '--seco');
    assert.notEqual(r.exit, 0);
    assert.match(r.err, /999/);
    assert.ok(existsSync(c.log));
    assert.equal(c.merges().length, 0);
  } finally { limpar(c); }
});

test('F173: PR que sobe a version de um plugin → merge feito e `aviso` citando o plugin (também no --seco)', () => {
  const c = montar({ bump: true });
  try {
    const seco = c.painel('mergear', '12', c.sha.slice(0, 10), '--seco');
    assert.equal(seco.exit, 0, seco.err);
    assert.match(JSON.parse(seco.out).aviso, /sobe a versão de p; a versão é da orquestradora depois do lote \(rode subir-versao\)/);
    const r = c.painel('mergear', '12', c.sha.slice(0, 10));
    assert.equal(r.exit, 0, r.err);
    const j = JSON.parse(r.out);
    assert.equal(j.mergeado, true);
    assert.match(j.aviso, /sobe a versão de p/);
    assert.equal(c.merges().length, 1);
  } finally { rmSync(c.raiz, { recursive: true, force: true }); }
});
test('F173: PR sem bump → mergeia sem `aviso` (a fixture tem plugin.json, então a ausência é medida)', () => {
  const c = montar();
  try {
    assert.ok(existsSync(join(c.clone, 'plugins', 'p', '.claude-plugin', 'plugin.json')), 'a fixture precisa ter o plugin.json');
    const r = c.painel('mergear', '12', c.sha.slice(0, 10));
    assert.equal(r.exit, 0, r.err);
    assert.equal(JSON.parse(r.out).mergeado, true);
    assert.equal(JSON.parse(r.out).aviso, undefined);
  } finally { rmSync(c.raiz, { recursive: true, force: true }); }
});
