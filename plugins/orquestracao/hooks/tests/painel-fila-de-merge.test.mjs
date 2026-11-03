#!/usr/bin/env node
// Testes de `painel fila-de-merge <PR…>` (ADR 0011). Repo git real (origin bare + clone) e um `gh` falso (GH_BIN) que lê os
// PRs de um JSON e anota cada chamada; o gate é um comando de shell sobre a árvore combinada. Nunca toca o painel nem o HOME reais.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, chmodSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'skills', 'orquestradora', 'scripts');
const LA = 'local_00000000-0000-4000-8000-0000000000a1';

const GH_FALSO = `#!/usr/bin/env node
const fs = require('node:fs');
const a = process.argv.slice(2);
fs.appendFileSync(process.env.GH_LOG, JSON.stringify(a) + '\\n');
// GH_FALHA=<PR>: o primeiro \`pr view\` desse PR falha (gh passageiro); a marca fica ao lado do estado
const marca = process.env.GH_ESTADO + '.falhou';
if (a[1] === 'view' && a[2] === process.env.GH_FALHA && !fs.existsSync(marca)) { fs.writeFileSync(marca, ''); process.exit(1); }
const est = JSON.parse(fs.readFileSync(process.env.GH_ESTADO, 'utf8'));
const pr = est.prs[a[2]];
if (a[0] === 'pr' && a[1] === 'view') {
  if (!pr) process.exit(1);
  // só os campos pedidos no --json, como o gh de verdade: um campo que o código deixa de pedir some da resposta
  const campos = a[a.indexOf('--json') + 1]?.split(',') ?? [];
  const todo = { number: Number(a[2]), ...pr };
  process.stdout.write(JSON.stringify(Object.fromEntries(campos.filter((c) => c in todo).map((c) => [c, todo[c]]))));
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

// PRs: 21 muda a 1ª linha de a.txt; 22 também (conflita com o 21); 23 cria c.txt (o gate do caso 2 o recusa); 24 cria d.txt;
// 25 e 26 criam e.txt e f.txt; 27 cria g.txt (o segundo culpado da bisseção).
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
  pr(25, 'e.txt', 'ok\n'); pr(26, 'f.txt', 'ok\n'); pr(27, 'g.txt', 'quebra\n');
  const gh = join(raiz, 'gh');
  writeFileSync(gh, GH_FALSO); chmodSync(gh, 0o755);
  const estado = join(raiz, 'estado.json');
  const log = join(raiz, 'gh.log');
  writeFileSync(log, '');
  writeFileSync(estado, JSON.stringify({ prs: Object.fromEntries(Object.entries(shas).map(([n, sha]) => [n, { state: 'OPEN', headRefOid: sha, baseRefName: 'main', headRefName: `pr${n}` }])) }));
  mkdirSync(join(raiz, 'painel')); mkdirSync(join(raiz, 'home'));
  writeFileSync(join(raiz, 'painel', 'temas.json'), JSON.stringify([{ id: 'editor', rotulo: 'Editor', projeto: 'projx' }]));
  const ctx = { raiz, clone, shas, estadoDaFila: join(raiz, 'fila-de-merge', 'projx.json') };
  ctx.envExtra = {};
  ctx.painel = (...args) => {
    const r = spawnSync('node', [join(SCRIPTS, 'painel.mjs'), ...args], {
      cwd: clone, encoding: 'utf8', timeout: 120000, killSignal: 'SIGKILL',
      env: { ...process.env, ...ENV_GIT, PAINEL_DIR: join(raiz, 'painel'), HOME: join(raiz, 'home'), HOOKS_CREWAI_BASE: '', CLAUDE_CODE_SESSION_ID: '', GH_BIN: gh, GH_ESTADO: estado, GH_LOG: log, ...ctx.envExtra },
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
    // F314: o motivo do conflito diz à dona como resolver, e o `agora` dela o carrega
    assert.match(s.devolvidos[0].motivo, /sync_with_base_branch/);
    assert.match(s.devolvidos[0].motivo, /rebase origin\/main/);
    assert.match(s.devolvidos[0].motivo, /PR 22 pronto/);
    assert.doesNotMatch(s.devolvidos[1].motivo, /sync_with_base_branch/, 'gate vermelho não manda trazer a base');
    assert.match(c.dado('F2').agora, /sync_with_base_branch/);
    assert.match(s.devolvidos[1].motivo, /gate vermelho/);
    assert.equal(s.gates, 3, 'lote, repetição e o 21 sozinho (o 23 sai por dedução)');
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

test('vermelho que passa ao repetir: mergeia tudo e registra a suspeita de teste instável', () => {
  const c = montar();
  try {
    c.item('F1', 21); c.item('F4', 24);
    const marca = join(c.raiz, 'ja-falhou');
    // falha só na primeira vez (a marca prova que a primeira rodada caiu no vermelho)
    const r = c.painel('fila-de-merge', '21', '24', '--gate', `if [ -f ${marca} ]; then true; else touch ${marca}; false; fi`);
    assert.equal(r.exit, 0, r.err + r.out);
    const s = JSON.parse(r.out);
    assert.ok(existsSync(marca), 'a primeira rodada do gate rodou e falhou');
    assert.equal(s.gates, 2, 'o lote e a repetição');
    assert.deepEqual(s.mergeados.map((m) => m.pr), [21, 24]);
    assert.deepEqual(s.devolvidos, []);
    assert.match(s.suspeitaDeInstavel ?? '', /instável/);
    assert.match(readFileSync(join(s.logs, 'instavel.txt'), 'utf8'), /passou ao repetir/);
  } finally { limpar(c); }
});

test('bisseção: o lado verde entra sem retestar e o culpado no fim sai por dedução', () => {
  const c = montar();
  try {
    for (const [F, n] of [['F4', 24], ['F5', 25], ['F6', 26], ['F3', 23]]) c.item(F, n);
    const r = c.painel('fila-de-merge', '24', '25', '26', '23', '--gate', 'test ! -f c.txt');
    assert.equal(r.exit, 0, r.err + r.out);
    const s = JSON.parse(r.out);
    assert.deepEqual(s.mergeados.map((m) => m.pr), [24, 25, 26]);
    assert.deepEqual(s.devolvidos.map((d) => d.pr), [23]);
    assert.match(s.devolvidos[0].motivo, /gate vermelho/);
    // lote, repetição, [24,25] verde, [26] verde; o 23 sobra vermelho sem gate próprio (um por vez seriam 1 + 1 + 4)
    assert.equal(s.gates, 4);
    assert.deepEqual(c.merges(), [24, 25, 26]);
    assert.equal(c.dado('F3').etapa, 'execucao');
  } finally { limpar(c); }
});

test('bisseção com dois culpados em metades diferentes devolve os dois', () => {
  const c = montar();
  try {
    const r = c.painel('fila-de-merge', '23', '24', '25', '27', '--gate', 'test ! -f c.txt && test ! -f g.txt', '--seco');
    assert.equal(r.exit, 0, r.err + r.out);
    const s = JSON.parse(r.out);
    assert.deepEqual(s.mergearia, [24, 25]);
    assert.deepEqual(s.devolveria.map((d) => d.pr), [23, 27]);
    // lote, repetição, [23,24] vermelho, [23] vermelho, [24] verde, [25,27] vermelho, [25] verde
    assert.equal(s.gates, 7);
  } finally { limpar(c); }
});

test('um PR só, vermelho: repete uma vez e devolve', () => {
  const c = montar();
  try {
    const r = c.painel('fila-de-merge', '23', '--gate', 'test ! -f c.txt', '--seco');
    assert.equal(r.exit, 0, r.err + r.out);
    const s = JSON.parse(r.out);
    assert.deepEqual(s.devolveria.map((d) => d.pr), [23]);
    assert.equal(s.gates, 2);
  } finally { limpar(c); }
});

test('fila ocupada: o PR que chega entra na lista de pendentes e não monta nada', () => {
  const c = montar();
  try {
    mkdirSync(dirname(c.estadoDaFila), { recursive: true });
    // ocupada por um processo vivo (o do próprio teste)
    writeFileSync(c.estadoDaFila, JSON.stringify({ ocupada: { pid: process.pid, desde: new Date().toISOString() }, pendentes: [{ pr: 21 }] }));
    const r = c.painel('fila-de-merge', `24:${c.shas[24].slice(0, 7)}`, '21');
    assert.equal(r.exit, 0, r.err + r.out);
    const s = JSON.parse(r.out);
    assert.equal(s.pendente, true);
    assert.deepEqual(s.pendentes.map((p) => p.pr), [21, 24], 'na ordem de chegada, sem repetir');
    const est = JSON.parse(readFileSync(c.estadoDaFila, 'utf8'));
    assert.deepEqual(est.pendentes, [{ pr: 21 }, { pr: 24, sha: c.shas[24].slice(0, 7) }]);
    assert.deepEqual(c.merges(), []);
    assert.equal(c.worktrees(), 1, 'não montou árvore');
  } finally { limpar(c); }
});

test('o que chega com o gate rodando vira o lote seguinte da mesma chamada', () => {
  const c = montar();
  try {
    c.item('F1', 21); c.item('F4', 24);
    const marca = join(c.raiz, 'chegou');
    // o gate da 1ª rodada faz o papel do recado que chega no meio: chama a fila de novo, que só anota o 24
    const chegada = `node ${join(SCRIPTS, 'painel.mjs')} fila-de-merge 24 > ${join(c.raiz, 'chegada.json')}`;
    const r = c.painel('fila-de-merge', '21', '--gate', `[ -f ${marca} ] || { touch ${marca}; ${chegada}; }`);
    assert.equal(r.exit, 0, r.err + r.out);
    const s = JSON.parse(r.out);
    assert.equal(JSON.parse(readFileSync(join(c.raiz, 'chegada.json'), 'utf8')).pendente, true, 'a chamada do meio só anotou');
    assert.deepEqual(s.mergeados.map((m) => m.pr), [21, 24]);
    assert.equal(s.rodadas.length, 2);
    assert.deepEqual(s.rodadas.map((x) => x.prs), [[21], [24]]);
    assert.equal(s.gates, 2);
    const est = JSON.parse(readFileSync(c.estadoDaFila, 'utf8'));
    assert.equal(est.ocupada, null, 'a fila fica livre ao terminar');
    assert.deepEqual(est.pendentes, []);
  } finally { limpar(c); }
});

test('fila presa por processo morto: a chamada nova assume e leva os pendentes antes', () => {
  const c = montar();
  try {
    c.item('F1', 21); c.item('F4', 24);
    const morto = spawnSync('true', { timeout: 5000, killSignal: 'SIGKILL' }).pid;
    assert.ok(morto > 0);
    mkdirSync(dirname(c.estadoDaFila), { recursive: true });
    writeFileSync(c.estadoDaFila, JSON.stringify({ ocupada: { pid: morto, desde: '2026-10-27T10:00:00.000Z' }, pendentes: [{ pr: 24 }] }));
    const r = c.painel('fila-de-merge', '21', '--gate', 'true');
    assert.equal(r.exit, 0, r.err + r.out);
    const s = JSON.parse(r.out);
    assert.deepEqual(s.mergeados.map((m) => m.pr), [24, 21]);
    assert.equal(s.gates, 1);
    assert.equal(JSON.parse(readFileSync(c.estadoDaFila, 'utf8')).ocupada, null);
  } finally { limpar(c); }
});

test('F220: pid reciclado (vivo, mas começou depois de ocupar a fila) não prende a fila', () => {
  const c = montar();
  try {
    c.item('F1', 21); c.item('F4', 24);
    // o pid do próprio teste está vivo, mas começou bem depois de `desde`: é outro processo que herdou o número
    mkdirSync(dirname(c.estadoDaFila), { recursive: true });
    writeFileSync(c.estadoDaFila, JSON.stringify({ ocupada: { pid: process.pid, desde: '2020-01-01T00:00:00.000Z' }, pendentes: [{ pr: 24 }] }));
    const r = c.painel('fila-de-merge', '21', '--gate', 'true');
    assert.equal(r.exit, 0, r.err + r.out);
    const s = JSON.parse(r.out);
    assert.notEqual(s.pendente, true, 'não ficou só anotado');
    assert.deepEqual(s.mergeados.map((m) => m.pr), [24, 21]);
  } finally { limpar(c); }
});

test('F220: quem ocupa a fila grava o gate e o preparo (o relance da fila órfã os repete)', () => {
  const c = montar();
  try {
    c.item('F1', 21);
    const copia = join(c.raiz, 'estado-no-gate.json');
    const r = c.painel('fila-de-merge', '21', '--gate', `cp ${c.estadoDaFila} ${copia}`, '--preparar', 'true');
    assert.equal(r.exit, 0, r.err + r.out);
    const ocupada = JSON.parse(readFileSync(copia, 'utf8')).ocupada;
    assert.ok(ocupada?.pid > 0, `sem ocupada no gate: ${JSON.stringify(ocupada)}`);
    assert.equal(ocupada.gate, `cp ${c.estadoDaFila} ${copia}`);
    assert.equal(ocupada.preparar, 'true');
  } finally { limpar(c); }
});

test('F220: o relance da fila órfã com um PR que fechou no meio tempo roda o resto (e PR fechado fora da fila segue recusado)', () => {
  const c = montar();
  try {
    c.item('F1', 21); c.item('F4', 24);
    const est = JSON.parse(readFileSync(join(c.raiz, 'estado.json'), 'utf8'));
    est.prs[21].state = 'MERGED';
    writeFileSync(join(c.raiz, 'estado.json'), JSON.stringify(est));
    const morto = spawnSync('true', { timeout: 5000, killSignal: 'SIGKILL' }).pid;
    mkdirSync(dirname(c.estadoDaFila), { recursive: true });
    // sem estar na fila, o PR fechado é erro de quem pediu, como antes (a prova de que a recusa existe)
    writeFileSync(c.estadoDaFila, JSON.stringify({ ocupada: null, pendentes: [], emVoo: [] }));
    const fora = c.painel('fila-de-merge', '21', '24', '--gate', 'true');
    assert.notEqual(fora.exit, 0);
    assert.match(fora.err, /não está aberto/);
    assert.deepEqual(c.merges(), []);
    // na fila órfã, o comando de relance repete o 21: ele sai da fila e o 24 entra
    writeFileSync(c.estadoDaFila, JSON.stringify({ ocupada: { pid: morto, desde: '2026-10-28T13:03:03.261Z', gate: 'true' }, emVoo: [{ pr: 21 }], pendentes: [{ pr: 24 }] }));
    const r = c.painel('fila-de-merge', '21', '24', '--gate', 'true');
    assert.equal(r.exit, 0, r.err + r.out);
    const s = JSON.parse(r.out);
    assert.deepEqual(s.mergeados.map((m) => m.pr), [24]);
    assert.match(s.devolvidos.find((d) => d.pr === 21)?.motivo ?? '', /saiu da fila/);
    assert.deepEqual(JSON.parse(readFileSync(c.estadoDaFila, 'utf8')), { ocupada: null, pendentes: [], emVoo: [] });
  } finally { limpar(c); }
});

test('--seco não usa nem mexe na lista de pendentes', () => {
  const c = montar();
  try {
    mkdirSync(dirname(c.estadoDaFila), { recursive: true });
    const antes = JSON.stringify({ ocupada: { pid: process.pid, desde: '2026-10-27T10:00:00.000Z' }, pendentes: [{ pr: 24 }] });
    writeFileSync(c.estadoDaFila, antes);
    const r = c.painel('fila-de-merge', '21', '--gate', 'true', '--seco');
    assert.equal(r.exit, 0, r.err + r.out);
    assert.deepEqual(JSON.parse(r.out).mergearia, [21]);
    assert.equal(readFileSync(c.estadoDaFila, 'utf8'), antes);
  } finally { limpar(c); }
});

test('PR da lista de pendentes que fechou no meio tempo sai da fila sem travar o lote', () => {
  const c = montar();
  try {
    c.item('F4', 24); c.item('F1', 21);
    const est = JSON.parse(readFileSync(join(c.raiz, 'estado.json'), 'utf8'));
    est.prs[21].state = 'MERGED';
    writeFileSync(join(c.raiz, 'estado.json'), JSON.stringify(est));
    mkdirSync(dirname(c.estadoDaFila), { recursive: true });
    writeFileSync(c.estadoDaFila, JSON.stringify({ ocupada: null, pendentes: [{ pr: 21 }] }));
    const r = c.painel('fila-de-merge', '24', '--gate', 'true');
    assert.equal(r.exit, 0, r.err + r.out);
    const s = JSON.parse(r.out);
    assert.deepEqual(s.mergeados.map((m) => m.pr), [24]);
    assert.equal(s.devolvidos[0].pr, 21);
    assert.match(s.devolvidos[0].motivo, /saiu da fila/);
    assert.deepEqual(JSON.parse(readFileSync(c.estadoDaFila, 'utf8')), { ocupada: null, pendentes: [], emVoo: [] });
    assert.equal(c.dado('F4').etapa, 'feito');
    assert.equal(c.dado('F1').etapa, 'merge', 'mergeado fora da fila: o item não volta à dona');
  } finally { limpar(c); }
});

test('PR ilegível na lista e PR de outra base não travam a fila: o primeiro sai no teto de leituras, o segundo vai para a rodada seguinte', () => {
  const c = montar();
  try {
    c.item('F4', 24); c.item('F5', 25);
    git(c.clone, 'push', '-q', 'origin', 'main:develop');
    const est = JSON.parse(readFileSync(join(c.raiz, 'estado.json'), 'utf8'));
    est.prs[25].baseRefName = 'develop';
    writeFileSync(join(c.raiz, 'estado.json'), JSON.stringify(est));
    mkdirSync(dirname(c.estadoDaFila), { recursive: true });
    // o 99 não existe: o gh falso falha ao lê-lo
    writeFileSync(c.estadoDaFila, JSON.stringify({ ocupada: null, pendentes: [{ pr: 99 }] }));
    const r = c.painel('fila-de-merge', '24', '25', '--gate', 'true');
    assert.equal(r.exit, 0, r.err + r.out);
    const s = JSON.parse(r.out);
    assert.deepEqual(s.rodadas.map((x) => x.prs), [[99, 24], [25]]);
    assert.deepEqual(s.mergeados.map((m) => m.pr), [24, 25]);
    assert.deepEqual(s.releitura, [99]);
    assert.deepEqual(JSON.parse(readFileSync(c.estadoDaFila, 'utf8')), { ocupada: null, pendentes: [{ pr: 99, leituras: 1 }], emVoo: [] });
    // 2ª leitura falha e fica; na 3ª sai da fila, sem travar quem chega
    c.item('F1', 21); c.item('F6', 26);
    assert.deepEqual(JSON.parse(c.painel('fila-de-merge', '21', '--gate', 'true').out).releitura, [99]);
    const r3 = c.painel('fila-de-merge', '26', '--gate', 'true');
    assert.equal(r3.exit, 0, r3.err + r3.out);
    const s3 = JSON.parse(r3.out);
    assert.deepEqual(s3.mergeados.map((m) => m.pr), [26]);
    assert.equal(s3.devolvidos[0].pr, 99);
    assert.match(s3.devolvidos[0].motivo, /3 tentativas.*saiu da fila/);
    assert.deepEqual(JSON.parse(readFileSync(c.estadoDaFila, 'utf8')), { ocupada: null, pendentes: [], emVoo: [] });
  } finally { limpar(c); }
});

test('erro da rodada inteira não volta à lista: sai no erro com os PRs que não rodaram', () => {
  const c = montar();
  try {
    c.item('F1', 21);
    const r = c.painel('fila-de-merge', '21', '--gate', 'true', '--preparar', 'false');
    assert.equal(r.exit, 1, r.out);
    assert.match(r.err, /preparo falhou/);
    assert.match(r.err, /não rodaram: #21/);
    assert.deepEqual(JSON.parse(readFileSync(c.estadoDaFila, 'utf8')), { ocupada: null, pendentes: [], emVoo: [] });
    assert.deepEqual(c.merges(), []);
    // a fila segue andando
    const r2 = c.painel('fila-de-merge', '21', '--gate', 'true');
    assert.equal(r2.exit, 0, r2.err + r2.out);
    assert.deepEqual(c.merges(), [21]);
  } finally { limpar(c); }
});

test('o lote em voo de um processo que morreu volta à frente na chamada seguinte', () => {
  const c = montar();
  try {
    c.item('F1', 21); c.item('F4', 24); c.item('F5', 25);
    const morto = spawnSync('true', { timeout: 5000, killSignal: 'SIGKILL' }).pid;
    mkdirSync(dirname(c.estadoDaFila), { recursive: true });
    writeFileSync(c.estadoDaFila, JSON.stringify({ ocupada: { pid: morto, desde: '2026-10-27T10:00:00.000Z' }, pendentes: [{ pr: 24 }], emVoo: [{ pr: 21 }] }));
    const r = c.painel('fila-de-merge', '25', '--gate', 'true');
    assert.equal(r.exit, 0, r.err + r.out);
    assert.deepEqual(JSON.parse(r.out).mergeados.map((m) => m.pr), [21, 24, 25]);
  } finally { limpar(c); }
});

test('PR da lista fechado sem merge volta à dona', () => {
  const c = montar();
  try {
    c.item('F1', 21);
    const est = JSON.parse(readFileSync(join(c.raiz, 'estado.json'), 'utf8'));
    est.prs[21].state = 'CLOSED';
    writeFileSync(join(c.raiz, 'estado.json'), JSON.stringify(est));
    mkdirSync(dirname(c.estadoDaFila), { recursive: true });
    writeFileSync(c.estadoDaFila, JSON.stringify({ ocupada: null, pendentes: [{ pr: 21 }] }));
    const r = c.painel('fila-de-merge', '24', '--gate', 'true');
    assert.equal(r.exit, 0, r.err + r.out);
    assert.equal(c.dado('F1').etapa, 'execucao');
    assert.match(c.dado('F1').agora, /não está mais aberto \(CLOSED\)/);
  } finally { limpar(c); }
});

test('gh que falha ao ler um PR da lista não o tira da fila: a chamada seguinte o leva', () => {
  const c = montar();
  try {
    c.item('F4', 24); c.item('F5', 25); c.item('F1', 21);
    c.envExtra = { GH_FALHA: '24' };
    mkdirSync(dirname(c.estadoDaFila), { recursive: true });
    writeFileSync(c.estadoDaFila, JSON.stringify({ ocupada: null, pendentes: [{ pr: 24 }] }));
    const r = c.painel('fila-de-merge', '25', '--gate', 'true');
    assert.equal(r.exit, 0, r.err + r.out);
    const s = JSON.parse(r.out);
    assert.ok(existsSync(join(c.raiz, 'estado.json.falhou')), 'o gh falhou de fato ao ler o 24');
    assert.deepEqual(s.mergeados.map((m) => m.pr), [25]);
    assert.deepEqual(s.releitura, [24]);
    assert.deepEqual(s.devolvidos, []);
    assert.equal(c.dado('F4').etapa, 'merge');
    assert.deepEqual(JSON.parse(readFileSync(c.estadoDaFila, 'utf8')).pendentes, [{ pr: 24, leituras: 1 }]);
    const r2 = c.painel('fila-de-merge', '21', '--gate', 'true');
    assert.equal(r2.exit, 0, r2.err + r2.out);
    assert.deepEqual(JSON.parse(r2.out).mergeados.map((m) => m.pr), [24, 21]);
  } finally { limpar(c); }
});

test('erro de preparo diz quem ficou na fila (o PR de outra base)', () => {
  const c = montar();
  try {
    git(c.clone, 'push', '-q', 'origin', 'main:develop');
    const est = JSON.parse(readFileSync(join(c.raiz, 'estado.json'), 'utf8'));
    est.prs[25].baseRefName = 'develop';
    writeFileSync(join(c.raiz, 'estado.json'), JSON.stringify(est));
    const r = c.painel('fila-de-merge', '21', '25', '--gate', 'true', '--preparar', 'false');
    assert.equal(r.exit, 1, r.out);
    assert.match(r.err, /não rodaram: #21 /);
    assert.match(r.err, /ficaram na fila: #25/);
  } finally { limpar(c); }
});

// F200: o repositório pode ser público; o PR de fork (de outra pessoa) não roda o gate na máquina nem é mergeado pela fila.
test('PR de fork é recusado: nem gate nem merge, e o pedido explica', () => {
  const c = montar();
  try {
    const est = JSON.parse(readFileSync(join(c.raiz, 'estado.json'), 'utf8'));
    est.prs[24].isCrossRepository = true;
    writeFileSync(join(c.raiz, 'estado.json'), JSON.stringify(est));
    const marca = join(c.raiz, 'gate-rodou');
    // antes de medir: o gate deste caso deixa marca, e o PR 21 (do próprio repositório) a deixa
    const ok = c.painel('fila-de-merge', '21', '--gate', `touch ${marca}`);
    assert.equal(ok.exit, 0, ok.err + ok.out);
    assert.ok(existsSync(marca), 'o gate do PR do repositório não rodou');
    rmSync(marca);
    const r = c.painel('fila-de-merge', '24', '--gate', `touch ${marca}`);
    assert.notEqual(r.exit, 0, 'a fila aceitou o PR de fork');
    assert.match(r.err, /fork/);
    assert.equal(existsSync(marca), false, 'o gate rodou o código do fork');
    assert.deepEqual(c.merges(), [21], 'mergeou o fork');
    const m = c.painel('mergear', '24', c.shas[24]);
    assert.equal(JSON.parse(m.out).recusado, true, `o mergear aceitou o PR de fork: ${m.out}${m.err}`);
    assert.match(JSON.parse(m.out).motivo, /fork/);
    assert.deepEqual(c.merges(), [21]);
  } finally { limpar(c); }
});

// F221: a dona abriu PR novo e não o pôs em `prs`. A fila liga o PR ao item pela branch do worktree da sessão dona, põe o item
// em `merge` enquanto o gate roda, e o fecha ou devolve como os outros.
function donaNaBranch(c, branch) {
  const wt = join(c.raiz, 'wt-dona');
  git(c.clone, 'worktree', 'add', '-q', wt, branch);
  const app = join(c.raiz, 'app');
  mkdirSync(app, { recursive: true });
  writeFileSync(join(app, `${LA}.json`), JSON.stringify({ sessionId: LA, title: 'F5 · item', cwd: wt, originCwd: c.clone, isArchived: false }));
  c.envExtra.POOL_APP_SESSOES_DIR = app;
}
function itemComPrVelho(c) {
  const est = JSON.parse(readFileSync(join(c.raiz, 'estado.json'), 'utf8'));
  est.prs['21'].state = 'MERGED';
  writeFileSync(join(c.raiz, 'estado.json'), JSON.stringify(est));
  const r = c.painel('set', 'fila', 'F5', JSON.stringify({ titulo: 'item da dona', etapa: 'execucao', tema: 'editor', via: 'dona', prs: [21], donoLocalId: LA, donoApelido: 'dona' }));
  assert.equal(r.exit, 0, r.err);
}
const GATE_COPIA = (c) => `cp ${join(c.raiz, 'painel', 'fila', 'F5.json')} ${join(c.raiz, 'F5-no-gate.json')}`;

test('F221: PR novo da dona fora de `prs` entra no item, que fica em merge durante o gate e fecha no merge', () => {
  const c = montar();
  try {
    itemComPrVelho(c); donaNaBranch(c, 'pr24');
    const r = c.painel('fila-de-merge', '24', '--gate', GATE_COPIA(c));
    assert.equal(r.exit, 0, r.err + r.out);
    const s = JSON.parse(r.out);
    assert.deepEqual(s.mergeados.map((m) => m.pr), [24]);
    assert.deepEqual(s.mergeados[0].itens.map((i) => [i.item, i.fechado]), [['F5', true]], 'o PR novo se liga ao item');
    const noGate = JSON.parse(readFileSync(join(c.raiz, 'F5-no-gate.json'), 'utf8')).data;
    assert.ok(noGate, 'o gate copiou o item');
    assert.equal(noGate.etapa, 'merge', 'durante o gate o item está em merge');
    assert.deepEqual(noGate.prs, [21, 24]);
    assert.match(noGate.agora, /PR 24 na fila de merge: o gate roda/);
    assert.equal(noGate.espera, undefined, 'sem espera: a batida segue vendo o merge parado');
    assert.deepEqual(s.ligados, [{ pr: 24, item: 'F5' }]);
    const d = c.dado('F5');
    assert.equal(d.etapa, 'feito');
    assert.equal(d.espera, undefined);
  } finally { limpar(c); }
});

test('F221: PR novo devolvido pelo gate volta o item a execucao', () => {
  const c = montar();
  try {
    itemComPrVelho(c); donaNaBranch(c, 'pr23');
    const r = c.painel('fila-de-merge', '23', '--gate', 'test ! -f c.txt');
    assert.equal(r.exit, 0, r.err + r.out);
    const s = JSON.parse(r.out);
    assert.deepEqual(s.devolvidos.map((x) => [x.pr, x.itens.map((i) => i.item)]), [[23, ['F5']]]);
    const d = c.dado('F5');
    assert.equal(d.etapa, 'execucao');
    assert.deepEqual(d.prs, [21, 23]);
    assert.equal(d.espera ?? null, null, 'a fila não grava espera');
  } finally { limpar(c); }
});

test('F221: PR de outra branch não se liga ao item da dona; o campo `branch` do item também liga', () => {
  const c = montar();
  try {
    itemComPrVelho(c); donaNaBranch(c, 'pr25');
    const r = c.painel('fila-de-merge', '24', '--gate', 'true');
    assert.equal(r.exit, 0, r.err + r.out);
    assert.deepEqual(JSON.parse(r.out).mergeados[0].itens, [], 'a branch da dona é outra');
    assert.deepEqual(c.dado('F5').prs, [21]);
    assert.equal(c.painel('update', 'fila', 'F5', JSON.stringify({ branch: 'pr26' })).exit, 0);
    const r2 = c.painel('fila-de-merge', '26', '--gate', 'true');
    assert.equal(r2.exit, 0, r2.err + r2.out);
    assert.deepEqual(JSON.parse(r2.out).mergeados[0].itens.map((i) => i.item), ['F5']);
  } finally { limpar(c); }
});

test('F221: com a fila ocupada, o PR anotado já liga o item e o põe em merge', () => {
  const c = montar();
  try {
    itemComPrVelho(c); donaNaBranch(c, 'pr24');
    mkdirSync(dirname(c.estadoDaFila), { recursive: true });
    writeFileSync(c.estadoDaFila, JSON.stringify({ ocupada: { pid: process.pid, desde: new Date().toISOString() }, pendentes: [] }));
    const r = c.painel('fila-de-merge', '24');
    assert.equal(r.exit, 0, r.err + r.out);
    assert.equal(JSON.parse(r.out).pendente, true);
    const d = c.dado('F5');
    assert.equal(d.etapa, 'merge');
    assert.deepEqual(d.prs, [21, 24]);
    assert.match(d.agora, /espera a vez/);
  } finally { limpar(c); }
});

test('F221: a branch que aponta dois itens (a dona com outro item vivo) não liga nenhum', () => {
  const c = montar();
  try {
    itemComPrVelho(c); donaNaBranch(c, 'pr24');
    assert.equal(c.painel('set', 'fila', 'F6', JSON.stringify({ titulo: 'outro item da dona', etapa: 'planejamento', tema: 'editor', via: 'dona', donoLocalId: LA, donoApelido: 'dona' })).exit, 0);
    const r = c.painel('fila-de-merge', '24', '--gate', 'true');
    assert.equal(r.exit, 0, r.err + r.out);
    const s = JSON.parse(r.out);
    assert.deepEqual(s.mergeados[0].itens, []);
    assert.deepEqual(s.ambiguos, [24]);
    assert.match(r.err, /aponta mais de um item/);
    assert.equal(c.dado('F6').etapa, 'planejamento');
    assert.equal(c.dado('F5').etapa, 'execucao');
  } finally { limpar(c); }
});

test('F221: a rodada que falha deixa o item em merge sem espera (a batida o vê parado)', () => {
  const c = montar();
  try {
    itemComPrVelho(c); donaNaBranch(c, 'pr24');
    const r = c.painel('fila-de-merge', '24', '--gate', 'true', '--preparar', 'false');
    assert.notEqual(r.exit, 0, 'o preparo falha');
    const d = c.dado('F5');
    assert.equal(d.etapa, 'merge');
    assert.deepEqual(d.prs, [21, 24]);
    assert.equal(d.espera, undefined);
  } finally { limpar(c); }
});

test('F221: o item devolvido numa rodada não volta a merge pela religação do outro PR dele na rodada seguinte', () => {
  const c = montar();
  try {
    const r0 = c.painel('set', 'fila', 'F5', JSON.stringify({ titulo: 'item de dois PRs', etapa: 'merge', tema: 'editor', via: 'dona', prs: [23, 24], donoLocalId: LA, donoApelido: 'dona' }));
    assert.equal(r0.exit, 0, r0.err);
    // o gate da rodada 1 (só o 23) anota o 24 uma vez: ele vira o lote da rodada 2
    const marca = join(c.raiz, 'anotou');
    const anota = `test -f ${marca} || { touch ${marca}; node ${join(SCRIPTS, 'painel.mjs')} fila-de-merge 24 >/dev/null; }`;
    const r = c.painel('fila-de-merge', '23', '--gate', `${anota}; test ! -f c.txt`);
    assert.equal(r.exit, 0, r.err + r.out);
    const s = JSON.parse(r.out);
    assert.ok(Array.isArray(s.rodadas) && s.rodadas.length === 2, `duas rodadas: ${r.out}`);
    assert.deepEqual(s.devolvidos.map((x) => x.pr), [23]);
    assert.deepEqual(s.mergeados.map((x) => x.pr), [24]);
    assert.equal(c.dado('F5').etapa, 'execucao', 'o 23 voltou à dona: o item fica em execucao');
  } finally { limpar(c); }
});

test('motivoDeConflito: lista longa de arquivos encurta e o caminho de resolver cabe no agora (F314)', async () => {
  const { motivoDeConflito } = await import(join(SCRIPTS, 'fila-de-merge.mjs'));
  const arquivos = Array.from({ length: 12 }, (_, i) => `plugins/orquestracao/skills/orquestradora/scripts/arquivo-${i}.mjs`);
  const m = motivoDeConflito({ pr: 123, sobre: 'main + o lote', arquivos, base: 'main' });
  assert.ok(m.length > 0);
  assert.match(m, /arquivo-0\.mjs/);
  assert.ok(m.indexOf('sync_with_base_branch') < m.indexOf('arquivo-0'), 'o caminho vem antes da lista');
  assert.doesNotMatch(m, /arquivo-3\.mjs/);
  assert.match(m, /e mais 9/);
  // o painel corta o `agora` em 300: o caminho de resolver vem antes da lista e sobrevive ao corte
  const agora = `devolvido pela fila de merge (PR 123): ${m}`.slice(0, 300);
  assert.match(agora, /sync_with_base_branch/);
  assert.match(agora, /PR 123 pronto/);
  assert.match(motivoDeConflito({ pr: 1, sobre: 'main', arquivos: [], base: 'main' }), /arquivos não listados/);
});

// F351: a dona anota o PR com o sha que testou; a rodada sem turno (a batida a lança) mergeia e grava o desfecho.
test('--anotar: exige o sha da ponta, só anota (sem gate nem merge), liga o item e grava a pasta do repositório', () => {
  const c = montar();
  try {
    c.item('F1', 21);
    const semSha = c.painel('fila-de-merge', '21', '--anotar');
    assert.notEqual(semSha.exit, 0); assert.match(semSha.err, /cada PR leva o sha/);
    const outraPonta = c.painel('fila-de-merge', `21:${c.shas[22]}`, '--anotar');
    assert.notEqual(outraPonta.exit, 0); assert.match(outraPonta.err, /a ponta do PR 21/);
    const comGate = c.painel('fila-de-merge', `21:${c.shas[21]}`, '--anotar', '--gate', 'true');
    assert.notEqual(comGate.exit, 0); assert.match(comGate.err, /--anotar não roda nada/);
    assert.ok(!existsSync(c.estadoDaFila), 'as recusas não gravam nada');
    const r = c.painel('fila-de-merge', `21:${c.shas[21].slice(0, 9)}`, '--anotar');
    assert.equal(r.exit, 0, r.err);
    const s = JSON.parse(r.out);
    assert.equal(s.anotado, true);
    assert.match(s.aviso, /ainda não tem gate/);
    const e = JSON.parse(readFileSync(c.estadoDaFila, 'utf8'));
    assert.deepEqual(e.pendentes, [{ pr: 21, sha: c.shas[21].slice(0, 9) }]);
    assert.ok(e.config.cwd.endsWith('/projx'), e.config.cwd);
    assert.deepEqual(c.merges(), [], 'anotar não mergeia');
    assert.equal(c.worktrees(), 1, 'anotar não monta árvore');
    assert.match(c.dado('F1').agora, /espera a batida/);
  } finally { limpar(c); }
});

test('rodada da orquestradora grava o config; a rodada --sem-turno usa a lista anotada, mergeia e grava o desfecho', () => {
  const c = montar();
  try {
    c.item('F1', 21); c.item('F2', 24); c.item('F3', 23);
    const orq = c.painel('fila-de-merge', `21:${c.shas[21]}`, '--gate', 'test ! -f c.txt');
    assert.equal(orq.exit, 0, orq.err + orq.out);
    let e = JSON.parse(readFileSync(c.estadoDaFila, 'utf8'));
    assert.equal(e.config.gate, 'test ! -f c.txt');
    assert.ok(e.config.cwd.endsWith('/projx'));
    assert.equal(e.desfechos, undefined, 'a rodada da orquestradora não grava desfecho: ela já leu a saída');
    assert.equal(c.painel('fila-de-merge', `24:${c.shas[24]}`, `23:${c.shas[23]}`, '--anotar').exit, 0);
    e = JSON.parse(readFileSync(c.estadoDaFila, 'utf8'));
    assert.equal(e.config.gate, 'test ! -f c.txt', 'anotar não apaga o gate gravado');
    const r = c.painel('fila-de-merge', `24:${c.shas[24]}`, `23:${c.shas[23]}`, '--gate', e.config.gate, '--sem-turno');
    assert.equal(r.exit, 0, r.err + r.out);
    e = JSON.parse(readFileSync(c.estadoDaFila, 'utf8'));
    assert.deepEqual(e.pendentes, []);
    assert.equal(e.ocupada, null);
    assert.equal(e.config.gate, 'test ! -f c.txt', 'a rodada sem turno mantém o config');
    assert.equal(e.desfechos.length, 1);
    assert.deepEqual(e.desfechos[0].mergeados.map((m) => m.pr), [24]);
    assert.deepEqual(e.desfechos[0].devolvidos.map((d) => d.pr), [23]);
    assert.deepEqual(e.desfechos[0].devolvidos[0].itens, [{ item: 'F3', dona: LA }]);
    assert.deepEqual(c.merges(), [21, 24]);
    assert.equal(c.dado('F2').etapa, 'feito');
    assert.equal(c.dado('F3').etapa, 'execucao');
  } finally { limpar(c); }
});

test('--sem-turno com erro da rodada grava o desfecho com o erro', () => {
  const c = montar();
  try {
    c.item('F1', 21);
    const r = c.painel('fila-de-merge', `21:${c.shas[21]}`, '--gate', 'true', '--preparar', 'exit 3', '--sem-turno');
    assert.notEqual(r.exit, 0);
    const e = JSON.parse(readFileSync(c.estadoDaFila, 'utf8'));
    assert.match(e.desfechos[0].erro, /preparo falhou/);
    assert.deepEqual(c.merges(), []);
  } finally { limpar(c); }
});
