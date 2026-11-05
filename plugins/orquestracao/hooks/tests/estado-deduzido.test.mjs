// F423: o estado do item deduzido do git, do gh e das sessões (estado-deduzido.mjs), e a recusa do `feito` declarado (painel.mjs).
// Nunca toca o ~/.claude real: HOME e PAINEL_DIR são pastas temporárias; o gh é um script falso (GH_BIN); o git é real, num
// repositório de mentira (origin bare + clone).
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'skills', 'orquestradora', 'scripts');
const { deduzir, prsDoItem, prsDoRepositorio, gitDoWorktree, coletar, reabertoEm } = await import(join(SCRIPTS, 'estado-deduzido.mjs'));

const MIN = 60_000;
const T = Date.parse('2026-11-05T15:00:00Z');
const iso = (ms) => new Date(ms).toISOString();
const DONA = 'local_00000000-0000-4000-8000-000000000001';
const item = (extra = {}) => ({
  titulo: 'Item', etapa: 'execucao', projeto: 'kit', donoLocalId: DONA, donoApelido: 'dona',
  atualizadoEm: iso(T - 40 * MIN), historico: [{ em: iso(T - 60 * MIN), etapa: 'execucao', dono: 'dona' }], ...extra,
});
const linha = (extra = {}) => ({ sessionId: DONA, title: 'F1 · Item', cwd: '/x', branch: 'f1-x', isArchived: false, isRunning: false, lastActivityAt: iso(T - 30 * MIN), ...extra });
const pr = (number, state, extra = {}) => ({ number, state, headRefName: 'f1-x', createdAt: iso(T - 20 * MIN), updatedAt: iso(T - 20 * MIN), mergedAt: state === 'MERGED' ? iso(T - 10 * MIN) : null, ...extra });
const ded = (o) => deduzir({ agoraMs: T, prazoMin: 15, ...o });

// ---- deduzir: cada estado ----
test('execução: commit à frente da base sem PR → execucao pelo git, e a última atividade vem do commit', () => {
  const d = ded({ item: item({ etapa: 'planejamento' }), linha: linha(), prs: [], git: { aFrente: 2, sujo: false, ultimoCommitMs: T - 3 * MIN } });
  assert.equal(d.etapa, 'execucao');
  assert.equal(d.fontes.etapa, 'git');
  assert.equal(d.ultimaAtividade, iso(T - 3 * MIN));
  assert.equal(d.parado, false);
  assert.equal(d.mergeado, false);
});
test('execução: mudança sem commit também conta; design e validacao declarados ficam', () => {
  assert.equal(ded({ item: item({ etapa: 'planejamento' }), linha: linha(), prs: [], git: { aFrente: 0, sujo: true, ultimoCommitMs: null } }).etapa, 'execucao');
  assert.equal(ded({ item: item({ etapa: 'validacao' }), linha: linha(), prs: [], git: { aFrente: 1, sujo: false, ultimoCommitMs: null } }).etapa, 'validacao');
});
test('PR aberto na branch da dona → merge, com o PR ligado e aberto', () => {
  const d = ded({ item: item(), linha: linha(), prs: [pr(7, 'OPEN'), pr(8, 'OPEN', { headRefName: 'outra' })], git: null });
  assert.equal(d.etapa, 'merge');
  assert.deepEqual(d.prs, [7]);
  assert.deepEqual(d.prsAbertos, [7]);
});
test('merge: todos os PRs ligados mergeados → feito e mergeado; o fechado sem merge não conta', () => {
  const d = ded({ item: item({ etapa: 'merge', prs: [5] }), linha: linha(), prs: [pr(5, 'CLOSED', { headRefName: 'z' }), pr(7, 'MERGED')], git: null });
  assert.equal(d.etapa, 'feito');
  assert.equal(d.mergeado, true);
  assert.deepEqual(d.prs, [5, 7]);
});
test('merge de fatia (maisFatias) → volta a execucao, sem fechar', () => {
  const d = ded({ item: item({ etapa: 'merge', prs: [7], maisFatias: true }), linha: linha(), prs: [pr(7, 'MERGED')], git: null });
  assert.equal(d.etapa, 'execucao');
  assert.equal(d.mergeado, false);
  assert.equal(d.fatiaMergeada, true);
});
test('merge: um PR do item que o gh não leu segura o fechamento e conta como aberto', () => {
  const d = ded({ item: item({ etapa: 'merge', prs: [7, 99] }), linha: linha(), prs: [pr(7, 'MERGED')], git: null });
  assert.equal(d.mergeado, false);
  assert.deepEqual(d.prsAbertos, [99]);
});
test('PR herdado: o merge na mesma branch antes do item nascer não liga ao item (worktree reaproveitado)', () => {
  const velho = pr(3, 'MERGED', { createdAt: iso(T - 200 * MIN), mergedAt: iso(T - 180 * MIN) });
  const d = ded({ item: item(), linha: linha(), prs: [velho], git: null });
  assert.deepEqual(d.prs, []);
  assert.equal(d.mergeado, false);
  assert.equal(d.etapa, 'execucao');
});
test('a branch de base (main) nunca liga PR ao item', () => {
  const d = ded({ item: item(), linha: linha({ branch: 'main' }), prs: [pr(4, 'OPEN', { headRefName: 'main' })], git: null });
  assert.deepEqual(d.prs, []);
});
test('etapa merge declarada sem PR aberto, com o gh lido → volta a execucao (o PR foi fechado)', () => {
  const d = ded({ item: item({ etapa: 'merge', prs: [7] }), linha: linha(), prs: [pr(7, 'CLOSED')], git: null });
  assert.equal(d.etapa, 'execucao');
  assert.deepEqual(d.prsAbertos, []);
});
test('dona morta: sem linha ou arquivada → donaViva false, e a atividade dela não conta', () => {
  const sem = ded({ item: item(), linha: null, prs: [], git: null });
  assert.equal(sem.donaViva, false);
  const arq = ded({ item: item(), linha: linha({ isArchived: true, lastActivityAt: iso(T - 1 * MIN) }), prs: [], git: null });
  assert.equal(arq.donaViva, false);
  assert.equal(arq.ultimaAtividade, iso(T - 40 * MIN), 'a atividade da arquivada não conta');
  assert.equal(arq.parado, true);
  assert.equal(ded({ item: item({ donoLocalId: null }), linha: null, prs: [], git: null }).donaViva, null, 'sem dona: null');
});
test('parado: passou do prazo sem atividade; rodando, espera ou trava não é parado', () => {
  const p = ded({ item: item(), linha: linha(), prs: [], git: null });
  assert.equal(p.parado, true);
  assert.equal(p.minParado, 30);
  assert.equal(ded({ item: item(), linha: linha({ isRunning: true }), prs: [], git: null }).parado, false);
  assert.equal(ded({ item: item({ espera: { motivo: 'operador', texto: 'x' } }), linha: linha(), prs: [], git: null }).parado, false);
  assert.equal(ded({ item: item(), linha: linha({ lastActivityAt: iso(T - 2 * MIN) }), prs: [], git: null }).parado, false, 'a atividade recente da dona viva conta');
});
test('compatibilidade: sem gh, sem git e sem sessão, vale o declarado (item antigo)', () => {
  const d = ded({ item: item({ etapa: 'merge', prs: [7] }), linha: null, prs: null, git: null });
  assert.equal(d.etapa, 'merge');
  assert.equal(d.mergeado, false);
  assert.deepEqual(d.prs, [7]);
  assert.deepEqual(d.prsAbertos, [7]);
  assert.equal(d.fontes.prs, 'item');
  assert.equal(ded({ item: { titulo: 'velho', etapa: 'execucao' }, prs: null, git: null }).etapa, 'execucao');
});
test('prsDoItem: o item sem historico aceita o PR da branch (não há data para filtrar)', () => {
  assert.deepEqual(prsDoItem({ branch: 'f1-x' }, { prs: [pr(7, 'OPEN')] }).map((p) => p.number), [7]);
});

// ---- achados do validador ----
test('item reaberto: o merge que já o tinha fechado não o fecha de novo; o PR novo, mergeado depois da reabertura, fecha', () => {
  const historico = [{ em: iso(T - 300 * MIN), etapa: 'execucao' }, { em: iso(T - 100 * MIN), etapa: 'feito' }, { em: iso(T - 50 * MIN), etapa: 'execucao' }];
  assert.equal(reabertoEm({ historico }), T - 50 * MIN);
  const velho = pr(7, 'MERGED', { createdAt: iso(T - 200 * MIN), mergedAt: iso(T - 110 * MIN) });
  const d = ded({ item: item({ prs: [7], historico }), linha: linha(), prs: [velho], git: null });
  assert.deepEqual(d.prs, [], 'o PR do fechamento anterior sai da conta');
  assert.equal(d.mergeado, false);
  const novo = pr(8, 'MERGED', { createdAt: iso(T - 30 * MIN), mergedAt: iso(T - 5 * MIN) });
  const e = ded({ item: item({ prs: [7, 8], historico }), linha: linha(), prs: [velho, novo], git: null });
  assert.deepEqual(e.prs, [8]);
  assert.equal(e.mergeado, true);
  assert.equal(reabertoEm(item()), null, 'item nunca fechado: sem reabertura');
});
test('merge declarado com o gh caído e a branch à frente da base: fica em merge (o git não rebaixa)', () => {
  const git = { aFrente: 3, sujo: false, ultimoCommitMs: T - 50 * MIN };
  const caido = ded({ item: item({ etapa: 'merge', prs: [7] }), linha: linha(), prs: null, git });
  assert.equal(caido.etapa, 'merge');
  assert.deepEqual(caido.prsAbertos, [7]);
  const outroRepo = ded({ item: item({ etapa: 'merge', prs: [7] }), linha: linha(), prs: [pr(9, 'OPEN', { headRefName: 'z' })], git });
  assert.equal(outroRepo.etapa, 'merge', 'PR de outro repositório: o gh não o leu, vale o declarado');
  const semPrs = ded({ item: item({ etapa: 'merge' }), linha: linha(), prs: [], git });
  assert.equal(semPrs.etapa, 'merge', 'merge declarado sem prs: o git também não rebaixa');
  assert.equal(ded({ item: item({ etapa: 'planejamento' }), linha: linha(), prs: null, git }).etapa, 'execucao', 'o git ainda promove quem não começou');
});
test('a branch da dona vem do git do worktree, não da lista do app (a branch com que o app criou a sessão)', () => {
  const d = ded({ item: item(), linha: linha({ branch: 'claude/unruffled-pascal' }), prs: [pr(7, 'OPEN')], git: { branch: 'f1-x', aFrente: 1, sujo: false, ultimoCommitMs: null } });
  assert.deepEqual(d.prs, [7]);
  assert.equal(d.etapa, 'merge');
  const semGit = ded({ item: item(), linha: linha({ branch: 'claude/unruffled-pascal' }), prs: [pr(7, 'OPEN')], git: null });
  assert.deepEqual(semGit.prs, [], 'sem o git, a branch do app não acha o PR da branch renomeada');
});
test('o PR criado antes do item nascer e mergeado depois não liga pela branch (o segundo item da mesma dona)', () => {
  const p = pr(7, 'MERGED', { createdAt: iso(T - 120 * MIN), mergedAt: iso(T - 10 * MIN) });
  const d = ded({ item: item(), linha: linha(), prs: [p], git: null });
  assert.deepEqual(d.prs, []);
  assert.equal(d.mergeado, false);
});
test('coletar: o PR que a branch liga a dois itens vivos não liga nenhum; o de `prs` continua ligado', () => {
  const ler = { prsDoRepositorio: () => [pr(7, 'MERGED')], gitDoWorktree: () => ({ branch: 'f1-x', aFrente: 1, sujo: false, ultimoCommitMs: null }) };
  const itens = new Map([['F1', item()], ['F2', item()]]);
  const m = coletar({ itens, linhas: [linha({ cwd: '/repo/kit' })], projetoDe: () => 'kit', agoraMs: T, prazoMin: 15, ler });
  assert.equal(m.size, 2);
  for (const F of ['F1', 'F2']) { assert.deepEqual(m.get(F).prs, [], F); assert.equal(m.get(F).mergeado, false, F); }
  const n = coletar({ itens: new Map([['F1', item({ prs: [7] })], ['F2', item()]]), linhas: [linha({ cwd: '/repo/kit' })], projetoDe: () => 'kit', agoraMs: T, prazoMin: 15, ler });
  assert.equal(n.get('F1').mergeado, true, 'ligado por prs: não é ambíguo');
  assert.deepEqual(n.get('F2').prs, []);
});
test('coletar: a dona que trabalha no repositório de outro projeto não dá o repositório do item', () => {
  const lidos = [];
  const ler = { prsDoRepositorio: (cwd) => { lidos.push(cwd); return []; }, gitDoWorktree: () => null };
  const linhas = [linha({ cwd: '/repo/outro' }), { sessionId: 'local_k', title: 'K', cwd: '/repo/kit', isArchived: false }];
  coletar({ itens: new Map([['F1', item()]]), linhas, projetoDe: (r) => (r.cwd === '/repo/kit' ? 'kit' : 'outro'), agoraMs: T, prazoMin: 15, ler });
  assert.deepEqual(lidos, ['/repo/kit']);
});

// ---- coleta: gh falso e git real ----
let base;
beforeEach(() => { base = mkdtempSync(join(tmpdir(), 'estado-deduzido-')); });
afterEach(() => { rmSync(base, { recursive: true, force: true }); });

const GH_FALSO = `#!/usr/bin/env node
const { readFileSync, appendFileSync } = require('node:fs');
appendFileSync(process.env.GH_LOG, process.argv.slice(2).join(' ') + '\\n');
if (process.env.GH_DORME) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Number(process.env.GH_DORME));
const prs = JSON.parse(readFileSync(process.env.GH_PRS, 'utf8'));
const [cmd, sub, n] = process.argv.slice(2);
if (cmd === 'pr' && sub === 'list') process.stdout.write(JSON.stringify(prs.filter((p) => !p.soView)));
else if (cmd === 'pr' && sub === 'view') { const p = prs.find((x) => String(x.number) === n); if (!p) process.exitCode = 1; else process.stdout.write(JSON.stringify(p)); }
else process.exitCode = 1;
`;
function comGh(prs, fn) {
  const gh = join(base, 'gh'); writeFileSync(gh, GH_FALSO, { mode: 0o755 });
  writeFileSync(join(base, 'prs.json'), JSON.stringify(prs));
  const antes = { GH_BIN: process.env.GH_BIN, GH_PRS: process.env.GH_PRS, GH_LOG: process.env.GH_LOG };
  Object.assign(process.env, { GH_BIN: gh, GH_PRS: join(base, 'prs.json'), GH_LOG: join(base, 'gh.log') });
  try { return fn(); } finally { for (const [k, v] of Object.entries(antes)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } }
}
const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 20000, killSignal: 'SIGKILL', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout;
};

test('prsDoRepositorio: uma lista por repositório, mais um view por PR do item que a lista não trouxe; gh quebrado → null', () => {
  const lista = comGh([pr(7, 'OPEN'), { ...pr(2, 'MERGED'), soView: true }], () => prsDoRepositorio(base, [7, 2]));
  assert.ok(Array.isArray(lista) && lista.length === 2, JSON.stringify(lista));
  const log = readFileSync(join(base, 'gh.log'), 'utf8').trim().split('\n');
  assert.equal(log.length, 2, log.join(' | '));
  assert.match(log[0], /^pr list --state all/);
  assert.match(log[1], /^pr view 2 /);
  process.env.GH_BIN = join(base, 'nao-existe');
  try { assert.equal(prsDoRepositorio(base, []), null); } finally { delete process.env.GH_BIN; }
});
test('gitDoWorktree: commits à frente da origin, mudança sem commit e a hora do último commit; pasta que não existe → null', () => {
  const origem = join(base, 'origem.git'); const clone = join(base, 'clone');
  git(base, 'init', '-q', '--bare', '-b', 'main', origem);
  git(base, 'clone', '-q', origem, clone);
  writeFileSync(join(clone, 'a.txt'), '1'); git(clone, 'add', 'a.txt'); git(clone, 'commit', '-q', '-m', 'a'); git(clone, 'push', '-q', 'origin', 'HEAD:main');
  git(clone, 'fetch', '-q'); git(clone, 'remote', 'set-head', 'origin', 'main');
  git(clone, 'checkout', '-q', '-b', 'f1-x');
  assert.deepEqual({ ...gitDoWorktree(clone), ultimoCommitMs: 'x' }, { branch: 'f1-x', aFrente: 0, sujo: false, ultimoCommitMs: 'x' });
  writeFileSync(join(clone, 'a.txt'), '2'); git(clone, 'commit', '-q', '-am', 'b');
  writeFileSync(join(clone, 'a.txt'), '3');
  const g = gitDoWorktree(clone);
  assert.equal(g.aFrente, 1);
  assert.equal(g.sujo, true);
  assert.ok(g.ultimoCommitMs > Date.now() - 5 * MIN, String(g.ultimoCommitMs));
  assert.equal(gitDoWorktree(join(base, 'nada')), null);
});
test('coletar: o repositório vem da dona viva; a dona arquivada não lê git; projeto sem sessão viva fica no declarado', () => {
  const lidos = [];
  const ler = {
    prsDoRepositorio: (cwd, extras) => { lidos.push(['gh', cwd, extras]); return [pr(7, 'MERGED')]; },
    gitDoWorktree: (cwd) => { lidos.push(['git', cwd]); return { aFrente: 1, sujo: false, ultimoCommitMs: null }; },
  };
  const itens = new Map([['F1', item({ etapa: 'merge', prs: [7] })], ['F2', item({ projeto: 'outro', donoLocalId: 'local_x' })]]);
  const linhas = [linha({ cwd: '/repo/kit' }), { sessionId: 'local_x', title: 'F2', cwd: '/repo/outro', isArchived: true }];
  const m = coletar({ itens, linhas, projetoDe: (r) => (r.cwd === '/repo/kit' ? 'kit' : 'outro'), agoraMs: T, prazoMin: 15, ler });
  assert.equal(m.get('F1').mergeado, true);
  assert.equal(m.get('F2').fontes.prs, 'item', 'outro: nenhuma sessão viva, o gh não foi chamado');
  assert.deepEqual(lidos, [['gh', '/repo/kit', [7]], ['git', '/repo/kit']]);
});

test('coletar: o orçamento total corta o gh travado; o projeto seguinte nem chama o gh e fica no declarado', () => {
  const antes = { a: process.env.KIT_DEDUCAO_ORCAMENTO_MS, b: process.env.KIT_GH_TIMEOUT_MS, c: process.env.GH_DORME };
  Object.assign(process.env, { KIT_DEDUCAO_ORCAMENTO_MS: '800', KIT_GH_TIMEOUT_MS: '10000', GH_DORME: '3000' });
  try {
    const m = comGh([pr(7, 'MERGED')], () => coletar({
      itens: new Map([['F1', item({ prs: [7] })], ['F2', item({ projeto: 'outro', donoLocalId: 'local_y', prs: [7] })]]),
      linhas: [linha({ cwd: base }), { sessionId: 'local_y', title: 'F2', cwd: base, isArchived: false }],
      projetoDe: (r) => (r.sessionId === DONA ? 'kit' : 'outro'), agoraMs: T, prazoMin: 15,
      ler: { prsDoRepositorio, gitDoWorktree: () => null },
    }));
    assert.equal(m.size, 2);
    for (const F of ['F1', 'F2']) { assert.equal(m.get(F).mergeado, false, F); assert.equal(m.get(F).fontes.prs, 'item', F); }
    const log = readFileSync(join(base, 'gh.log'), 'utf8').trim().split('\n');
    assert.equal(log.length, 1, `uma chamada só: ${log.join(' | ')}`);
  } finally { for (const [k, v] of Object.entries({ KIT_DEDUCAO_ORCAMENTO_MS: antes.a, KIT_GH_TIMEOUT_MS: antes.b, GH_DORME: antes.c })) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } }
});

// ---- a recusa do `feito` declarado ----
test('painel: "feito" declarado num update é recusado; descartado passa; criar um item já fechado passa', () => {
  const pdir = join(base, 'painel'); mkdirSync(join(pdir, 'fila'), { recursive: true });
  writeFileSync(join(pdir, 'temas.json'), JSON.stringify([{ id: 'geral', rotulo: 'Geral' }]));
  const p = (...args) => spawnSync('node', [join(SCRIPTS, 'painel.mjs'), ...args], { cwd: base, encoding: 'utf8', timeout: 30000, killSignal: 'SIGKILL', env: { ...process.env, KIT_FECHAR_DECLARADO: '', PAINEL_DIR: pdir, HOME: join(base, 'home'), CLAUDE_CODE_SESSION_ID: '', CLAUDE_CODE_HOST_SESSION_ID: '' } });
  const criar = p('update', 'fila', 'F1', JSON.stringify({ titulo: 'Item', etapa: 'execucao', tema: 'geral', projeto: 'kit' }));
  assert.equal(criar.status, 0, criar.stderr);
  const fechar = p('update', 'fila', 'F1', '{"etapa":"feito"}');
  assert.notEqual(fechar.status, 0);
  assert.match(fechar.stderr, /"feito" não se declara/);
  assert.equal(JSON.parse(readFileSync(join(pdir, 'fila', 'F1.json'), 'utf8')).data.etapa, 'execucao', 'nada gravado');
  const descartar = p('update', 'fila', 'F1', '{"etapa":"descartado","agora":"sem PR"}');
  assert.equal(descartar.status, 0, descartar.stderr);
  const fechado = p('update', 'fila', 'F2', JSON.stringify({ titulo: 'Velho', etapa: 'feito', tema: 'geral', projeto: 'kit' }));
  assert.equal(fechado.status, 0, fechado.stderr);
});
