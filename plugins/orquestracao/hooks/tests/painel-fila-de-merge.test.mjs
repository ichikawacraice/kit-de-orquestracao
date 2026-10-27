#!/usr/bin/env node
// Testes de `painel fila-de-merge <PR…>` (ADR 0011). Repo git real (origin bare + clone) e um `gh` falso (GH_BIN) que lê os
// PRs de um JSON e anota cada chamada; o gate é um comando de shell sobre a árvore combinada. Nunca toca o painel nem o HOME reais.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'skills', 'orquestradora', 'scripts');
const LA = 'local_00000000-0000-4000-8000-0000000000a1';

const GH_FALSO = `#!/usr/bin/env node
const fs = require('node:fs');
const a = process.argv.slice(2);
fs.appendFileSync(process.env.GH_LOG, JSON.stringify(a) + '\\n');
const est = JSON.parse(fs.readFileSync(process.env.GH_ESTADO, 'utf8'));
const pr = est.prs[a[2]];
if (a[0] === 'pr' && a[1] === 'view') {
  if (!pr) process.exit(1);
  process.stdout.write(JSON.stringify({ number: Number(a[2]), ...pr }));
} else if (a[0] === 'pr' && a[1] === 'merge') {
  if (!pr) process.exit(1);
  pr.state = 'MERGED';
  fs.writeFileSync(process.env.GH_ESTADO, JSON.stringify(est));
} else process.exit(2);
`;

const ENV_GIT = { GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
function git(cwd, ...args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 20000, killSignal: 'SIGKILL', env: { ...process.env, ...ENV_GIT } });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
}

// PRs: 21 muda a 1ª linha de a.txt; 22 também (conflita com o 21); 23 cria c.txt (o gate do caso 2 o recusa); 24 cria d.txt.
function montar() {
  const raiz = mkdtempSync(join(tmpdir(), 'fila-de-merge-'));
  const origin = join(raiz, 'origin.git');
  const clone = join(raiz, 'projx');
  git(raiz, 'init', '-q', '--bare', '-b', 'main', origin);
  git(raiz, 'clone', '-q', origin, clone);
  writeFileSync(join(clone, 'a.txt'), 'base\n');
  git(clone, 'add', '.'); git(clone, 'commit', '-qm', 'base'); git(clone, 'branch', '-M', 'main'); git(clone, 'push', '-q', 'origin', 'main');
  const shas = {};
  const pr = (n, arquivo, conteudo) => {
    git(clone, 'checkout', '-q', '-b', `pr${n}`, 'main');
    writeFileSync(join(clone, arquivo), conteudo);
    git(clone, 'add', '.'); git(clone, 'commit', '-qm', `pr ${n}`);
    shas[n] = git(clone, 'rev-parse', 'HEAD');
    git(clone, 'push', '-q', 'origin', `pr${n}:refs/pull/${n}/head`);
    git(clone, 'checkout', '-q', 'main');
  };
  pr(21, 'a.txt', 'do 21\n'); pr(22, 'a.txt', 'do 22\n'); pr(23, 'c.txt', 'quebra\n'); pr(24, 'd.txt', 'ok\n');
  const gh = join(raiz, 'gh');
  writeFileSync(gh, GH_FALSO); chmodSync(gh, 0o755);
  const estado = join(raiz, 'estado.json');
  const log = join(raiz, 'gh.log');
  writeFileSync(log, '');
  writeFileSync(estado, JSON.stringify({ prs: Object.fromEntries(Object.entries(shas).map(([n, sha]) => [n, { state: 'OPEN', headRefOid: sha, baseRefName: 'main', headRefName: `pr${n}` }])) }));
  mkdirSync(join(raiz, 'painel')); mkdirSync(join(raiz, 'home'));
  writeFileSync(join(raiz, 'painel', 'temas.json'), JSON.stringify([{ id: 'editor', rotulo: 'Editor', projeto: 'projx' }]));
  const ctx = { raiz, clone, shas };
  ctx.painel = (...args) => {
    const r = spawnSync('node', [join(SCRIPTS, 'painel.mjs'), ...args], {
      cwd: clone, encoding: 'utf8', timeout: 120000, killSignal: 'SIGKILL',
      env: { ...process.env, ...ENV_GIT, PAINEL_DIR: join(raiz, 'painel'), HOME: join(raiz, 'home'), CLAUDE_CODE_SESSION_ID: '', GH_BIN: gh, GH_ESTADO: estado, GH_LOG: log },
    });
    assert.ok(!r.error, String(r.error));
    return { exit: r.status, out: r.stdout, err: r.stderr };
  };
  ctx.merges = () => readFileSync(log, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((c) => c[1] === 'merge').map((c) => Number(c[2]));
  ctx.item = (F, prNum) => {
    const r = ctx.painel('set', 'fila', F, JSON.stringify({ titulo: `item do ${prNum}`, etapa: 'merge', tema: 'editor', via: 'dona', prs: [prNum], donoLocalId: LA, donoApelido: 'dona' }));
    assert.equal(r.exit, 0, r.err);
  };
  ctx.dado = (F) => JSON.parse(ctx.painel('get', 'fila', F).out).data;
  ctx.worktrees = () => git(clone, 'worktree', 'list').split('\n').length;
  return ctx;
}
const limpar = (c) => rmSync(c.raiz, { recursive: true, force: true });

// F184: o gate vermelho de um PR grava o acerto dos testes afetados (o log da fila contra a seleção no sha do PR).
test('gate vermelho grava o acerto dos testes afetados do PR', () => {
  const c = montar();
  try {
    c.item('F3', 23);
    const r = c.painel('fila-de-merge', '23', '--gate', 'echo "test at t/c.test.mjs:1:1"; test ! -f c.txt');
    assert.equal(r.exit, 0, r.err + r.out);
    assert.deepEqual(JSON.parse(r.out).devolvidos.map((d) => d.pr), [23]);
    const linhas = readFileSync(join(c.raiz, 'home', '.claude', 'orquestracao', 'testes-afetados-acerto.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    assert.equal(linhas.length, 1);
    assert.deepEqual([linhas[0].pr, linhas[0].sha, linhas[0].base], [23, c.shas[23], 'main']);
    assert.equal(linhas[0].acerto, null, 'o repo do teste não tem t/c.test.mjs: nada lido do log');
  } finally { limpar(c); }
});

test('lote verde: um gate só, mergeia na ordem e fecha os itens', () => {
  const c = montar();
  try {
    c.item('F1', 21); c.item('F2', 24);
    const r = c.painel('fila-de-merge', '21', '24', '--gate', 'test -f d.txt && grep -q "do 21" a.txt');
    assert.equal(r.exit, 0, r.err + r.out);
    const s = JSON.parse(r.out);
    assert.equal(s.gates, 1, 'o gate roda uma vez na combinação');
    assert.deepEqual(s.mergeados.map((m) => m.pr), [21, 24]);
    assert.deepEqual(s.devolvidos, []);
    assert.deepEqual(c.merges(), [21, 24], 'merge no GitHub na ordem dada');
    assert.equal(c.dado('F1').etapa, 'feito'); assert.equal(c.dado('F2').etapa, 'feito');
    assert.equal(c.worktrees(), 1, 'o worktree temporário foi removido');
  } finally { limpar(c); }
});

test('conflito e gate vermelho: devolve os dois à dona com o motivo, mergeia o resto', () => {
  const c = montar();
  try {
    c.item('F1', 21); c.item('F2', 22); c.item('F3', 23);
    // antes de medir: o gate desta árvore reprova c.txt, e o 23 o cria (a ausência é detectável)
    const r = c.painel('fila-de-merge', '21', '22', '23', '--gate', 'test ! -f c.txt');
    assert.equal(r.exit, 0, r.err + r.out);
    const s = JSON.parse(r.out);
    assert.deepEqual(s.mergeados.map((m) => m.pr), [21]);
    assert.deepEqual(s.devolvidos.map((d) => d.pr), [22, 23]);
    assert.match(s.devolvidos[0].motivo, /conflito/);
    assert.match(s.devolvidos[1].motivo, /gate vermelho/);
    assert.equal(s.gates, 3, 'lote + um por PR aplicado (21 e 23)');
    assert.deepEqual(c.merges(), [21]);
    assert.equal(c.dado('F1').etapa, 'feito');
    for (const F of ['F2', 'F3']) {
      const d = c.dado(F);
      assert.equal(d.etapa, 'execucao', `${F} volta a execucao`);
      assert.match(d.agora, /devolvido pela fila de merge/);
      assert.equal(d.donoLocalId, LA, 'a dona continua dona');
    }
    assert.deepEqual(s.devolvidos[1].itens, [{ item: 'F3', dona: LA }]);
  } finally { limpar(c); }
});

test('--seco monta e testa sem mergear nem gravar', () => {
  const c = montar();
  try {
    c.item('F1', 21);
    const r = c.painel('fila-de-merge', '21', '22', '--gate', 'true', '--seco');
    assert.equal(r.exit, 0, r.err + r.out);
    const s = JSON.parse(r.out);
    assert.equal(s.seco, true);
    assert.deepEqual(s.mergearia, [21]);
    assert.deepEqual(s.devolveria.map((d) => d.pr), [22]);
    assert.deepEqual(c.merges(), []);
    assert.equal(c.dado('F1').etapa, 'merge');
  } finally { limpar(c); }
});

test('uso errado e PR fechado são recusados', () => {
  const c = montar();
  try {
    assert.equal(c.painel('fila-de-merge').exit, 1);
    assert.equal(c.painel('fila-de-merge', 'abc').exit, 1);
    const est = JSON.parse(readFileSync(join(c.raiz, 'estado.json'), 'utf8'));
    est.prs[21].state = 'MERGED';
    writeFileSync(join(c.raiz, 'estado.json'), JSON.stringify(est));
    const r = c.painel('fila-de-merge', '21');
    assert.equal(r.exit, 1);
    assert.match(r.err, /não está aberto/);
  } finally { limpar(c); }
});

test('o sha do recado: ponta diferente é devolvida sem montar; o certo passa', () => {
  const c = montar();
  try {
    c.item('F1', 21); c.item('F2', 24);
    const r = c.painel('fila-de-merge', '21:abc1234', `24:${c.shas[24].slice(0, 7)}`, '--gate', 'true');
    assert.equal(r.exit, 0, r.err + r.out);
    const s = JSON.parse(r.out);
    assert.deepEqual(s.mergeados.map((m) => m.pr), [24]);
    assert.equal(s.devolvidos[0].pr, 21);
    assert.match(s.devolvidos[0].motivo, /a ponta mudou/);
  } finally { limpar(c); }
});

test('arquivo solto que o gate deixa não vira conflito falso do PR seguinte', () => {
  const c = montar();
  try {
    c.item('F3', 23); c.item('F4', 24);
    // o gate cria d.txt (o arquivo do 24) e reprova c.txt (o do 23): sem limpar a árvore, o 24 abortaria por "untracked … overwritten"
    const r = c.painel('fila-de-merge', '23', '24', '--gate', 'touch d.txt; test ! -f c.txt');
    assert.equal(r.exit, 0, r.err + r.out);
    const s = JSON.parse(r.out);
    assert.deepEqual(s.mergeados.map((m) => m.pr), [24]);
    assert.deepEqual(s.devolvidos.map((d) => d.pr), [23]);
    assert.match(s.devolvidos[0].motivo, /gate vermelho/);
  } finally { limpar(c); }
});
