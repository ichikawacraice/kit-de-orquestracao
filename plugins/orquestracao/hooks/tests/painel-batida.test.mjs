// Testes de `painel batida` (painel.mjs). Nunca tocam o painel real:
// HOME, PAINEL_DIR, HOOKS_CREWAI_BASE e POOL_APP_SESSOES_DIR são pastas temporárias; o "projeto" é um repositório git de mentira.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, statSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS = process.env.SCRIPTS_DIR || join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'skills', 'orquestradora', 'scripts');
const PAINEL = join(SCRIPTS, 'painel.mjs');
const MIN = 60_000;
const lid = (n) => `local_00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const iso = (ms) => new Date(ms).toISOString();

let base; let repo; let outro; let T;
const pastaPainel = () => join(base, 'painel');
const pastaOrq = () => join(base, 'orq');

function criarRepo(nome) {
  const d = join(base, 'repos', nome);
  mkdirSync(d, { recursive: true });
  const r = spawnSync('git', ['init', '-q', d], { encoding: 'utf8', timeout: 20000, killSignal: 'SIGKILL' });
  assert.equal(r.status, 0, `git init: ${r.stderr}`);
  return d;
}
beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'painel-batida-'));
  for (const d of ['painel/fila', 'painel/perguntas', 'home', 'orq', 'appsess', 'nuc']) mkdirSync(join(base, d), { recursive: true });
  writeFileSync(join(base, 'painel', 'temas.json'), JSON.stringify([{ id: 'editor', rotulo: 'Editor' }]));
  repo = criarRepo('kit');
  outro = criarRepo('outro');
  T = Date.now();
});
afterEach(() => { rmSync(base, { recursive: true, force: true }); });

const ambiente = (extra = {}) => ({
  ...process.env, PAINEL_DIR: pastaPainel(), CLAUDE_CODE_SESSION_ID: '', CLAUDE_CODE_HOST_SESSION_ID: '', HOME: join(base, 'home'), HOOKS_CREWAI_BASE: pastaOrq(),
  POOL_APP_SESSOES_DIR: join(base, 'appsess'), KIT_CARGA_1MIN: '0', KIT_NUCLEOS_DIR: join(base, 'nuc'), KIT_NUCLEOS_DE_TESTE: '4', ...extra,
});
function painel(args, { env = {}, cwd = repo } = {}) {
  const r = spawnSync('node', [PAINEL, ...args], { encoding: 'utf8', timeout: 60000, killSignal: 'SIGKILL', cwd, env: ambiente(env) });
  if (r.error) throw r.error;
  return { exit: r.status, out: r.stdout, err: r.stderr, json: () => JSON.parse(r.stdout) };
}
function painelAsync(args, env = {}) {
  return new Promise((resolve, reject) => {
    const c = spawn('node', [PAINEL, ...args], { cwd: repo, env: ambiente(env) });
    let out = ''; let err = '';
    const t = setTimeout(() => c.kill('SIGKILL'), 60000);
    c.stdout.on('data', (d) => { out += d; }); c.stderr.on('data', (d) => { err += d; });
    c.on('error', reject);
    c.on('close', (exit) => { clearTimeout(t); resolve({ exit, out, err }); });
  });
}

// ---- fixturas ----
const arquivoDoItem = (F) => join(pastaPainel(), 'fila', `${F}.json`);
function item(F, extra = {}) {
  const data = {
    titulo: `Item ${F.toLowerCase()}`, etapa: 'execucao', tema: 'editor', projeto: 'kit',
    donoLocalId: lid(1), donoApelido: 'dona', com: [{ localId: lid(1), apelido: 'dona', oQue: 'faz o item' }],
    atualizadoEm: iso(T - 40 * MIN), historico: [{ em: iso(T - 40 * MIN), etapa: extra.etapa ?? 'execucao', dono: 'dona' }],
    ...extra,
  };
  for (const k of Object.keys(data)) if (data[k] === undefined) delete data[k];
  writeFileSync(arquivoDoItem(F), `${JSON.stringify({ id: F, version: 1, data })}\n`);
}
const lerItem = (F) => JSON.parse(readFileSync(arquivoDoItem(F), 'utf8'));
const semGente = { donoLocalId: null, donoApelido: null, com: [] };
function sessao(n, titulo, extra = {}) {
  return { sessionId: lid(n), title: titulo, cwd: repo, isArchived: false, isRunning: false, lastActivityAt: iso(T - (100 - n) * MIN), ...extra };
}
function sessoes(...linhas) {
  const f = join(base, 'sessoes.json');
  writeFileSync(f, JSON.stringify(linhas));
  return f;
}
const batida = (arq, agoraMs = T, extra = []) => painel(['batida', '--sessoes', arq, '--agora', iso(agoraMs), ...extra]);
const msgs = (r, tipo) => r.json().mensagens.filter((m) => !tipo || m.tipo === tipo);

// ---- cutucada e soltura ----
test('batida: vencido sem cutucada → uma mensagem à dona e o estado gravado; 5 min depois, nada', () => {
  item('F1');
  const arq = sessoes(sessao(1, 'F1 · faz o item'));
  const a = batida(arq);
  assert.equal(a.exit, 0, a.err);
  const m = msgs(a, 'cutucada');
  assert.equal(m.length, 1, a.out);
  assert.equal(m[0].para, lid(1));
  assert.equal(m[0].item, 'F1');
  assert.match(m[0].texto, /F1/);
  assert.match(m[0].texto, /painel soltar F1/);
  const estado = JSON.parse(readFileSync(join(pastaOrq(), 'batida', 'estado.json'), 'utf8'));
  assert.ok(estado.cutucadas.F1.em, 'a cutucada não ficou gravada');
  const b = batida(arq, T + 5 * MIN);
  assert.deepEqual(msgs(b), [], 'a mesma cutucada não pode sair duas vezes');
  assert.deepEqual(b.json().soltos, []);
});
test('batida: 20 min depois da cutucada, sem gravação, solta o item', () => {
  item('F1');
  const arq = sessoes(sessao(1, 'F1 · faz o item'));
  batida(arq);
  const c = batida(arq, T + 21 * MIN);
  assert.deepEqual(c.json().soltos, ['F1'], c.out);
  const d = lerItem('F1').data;
  assert.equal(d.donoLocalId, undefined);
  assert.deepEqual(d.com, []);
  assert.match(d.agora, /ninguém gravou/);
});
test('batida: a dona gravou depois da cutucada → cutuca de novo e não solta', () => {
  item('F1');
  const arq = sessoes(sessao(1, 'F1 · faz o item'));
  assert.equal(msgs(batida(arq), 'cutucada').length, 1);
  const f = lerItem('F1'); f.data.atualizadoEm = iso(T + 3 * MIN); writeFileSync(arquivoDoItem('F1'), JSON.stringify(f));
  const r = batida(arq, T + 35 * MIN);
  assert.deepEqual(r.json().soltos, [], 'quem gravou não pode ser solto');
  assert.equal(msgs(r, 'cutucada').length, 1, 'parou de novo: a cutucada recomeça');
});
test('batida: alguém do com rodando → nada (e sem ele rodando, cutuca: a prova de que a regra morde)', () => {
  item('F1', { com: [{ localId: lid(1), apelido: 'dona', oQue: 'faz' }, { localId: lid(2), apelido: 'ajuda', oQue: 'confere' }] });
  assert.equal(msgs(batida(sessoes(sessao(1, 'F1 · a'), sessao(2, 'F1 · b'))), 'cutucada').length, 1);
  rmSync(join(pastaOrq(), 'batida'), { recursive: true, force: true });
  const r = batida(sessoes(sessao(1, 'F1 · a'), sessao(2, 'F1 · b', { isRunning: true })));
  assert.deepEqual(msgs(r), []);
  assert.deepEqual(r.json().soltos, []);
});
test('batida: dono arquivado ou sumido → solta direto, sem cutucar', () => {
  item('F1', { com: [{ localId: lid(1), apelido: 'dona', oQue: 'faz' }] });
  const r = batida(sessoes(sessao(1, 'F1 · a', { isArchived: true })));
  assert.deepEqual(r.json().soltos, ['F1'], r.out);
  assert.deepEqual(msgs(r), []);
  assert.match(lerItem('F1').data.agora, /arquivada ou sumiu/);
  item('F2');
  assert.deepEqual(batida(sessoes(sessao(9, 'F9 · outra'))).json().soltos, ['F2'], 'sumida da lista');
});
test('batida: item sem dono nem com não é parado de ninguém', () => {
  item('F1', semGente);
  const r = batida(sessoes(sessao(1, 'F1 · a')));
  assert.deepEqual(r.json().soltos, []);
  assert.deepEqual(msgs(r, 'cutucada'), []);
});
test('batida: item em merge parado vai ao relatório, nada à dona; com a orquestradora viva, uma mensagem só', () => {
  item('F1', { etapa: 'merge', historico: [{ em: iso(T - 40 * MIN), etapa: 'merge', dono: 'dona' }] });
  const arq = sessoes(sessao(1, 'F1 · a'), sessao(30, '🎛 orquestradora — kit'));
  const a = batida(arq);
  assert.deepEqual(msgs(a, 'cutucada'), []);
  assert.deepEqual(a.json().projetos.kit.merge, ['F1']);
  const rel = msgs(a, 'relatorio');
  assert.equal(rel.length, 1, a.out);
  assert.equal(rel[0].para, lid(30));
  assert.match(rel[0].texto, /F1/);
  assert.ok(existsSync(join(pastaOrq(), 'batida', 'kit.json')));
  assert.deepEqual(msgs(batida(arq, T + 6 * MIN), 'relatorio'), [], 'o mesmo relatório não repete');
  const sem = batida(sessoes(sessao(1, 'F1 · a')), T + 12 * MIN);
  assert.deepEqual(msgs(sem, 'relatorio'), [], 'sem orquestradora viva, ninguém a quem avisar');
});

test('batida: apaga o marcador da orquestradora arquivada e mantém o da viva', () => {
  const reg = (n, cli, extra) => writeFileSync(join(base, 'appsess', `${lid(n)}.json`), JSON.stringify({ sessionId: lid(n), cliSessionId: cli, title: '🎛 orquestradora — kit', cwd: repo, isArchived: false, ...extra }));
  reg(40, 'cli-arquivada', { isArchived: true });
  reg(41, 'cli-viva', {});
  mkdirSync(join(pastaOrq(), 'ativas'), { recursive: true });
  writeFileSync(join(pastaOrq(), 'ativas', 'cli-arquivada'), '');
  writeFileSync(join(pastaOrq(), 'ativas', 'cli-viva'), '');
  const r = batida(sessoes(sessao(41, '🎛 orquestradora — kit', { isRunning: true })));
  assert.deepEqual(r.json().marcadoresApagados, ['cli-arquivada'], r.out);
  assert.ok(!existsSync(join(pastaOrq(), 'ativas', 'cli-arquivada')));
  assert.ok(existsSync(join(pastaOrq(), 'ativas', 'cli-viva')));
});
test('batida: apaga o marcador de id anterior da orquestradora viva (a limpeza trocou o session_id) e mantém o da atual', () => {
  writeFileSync(join(base, 'appsess', `${lid(41)}.json`), JSON.stringify({ sessionId: lid(41), cliSessionId: 'cli-atual', priorCliSessionIds: ['cli-anterior'], title: '🎛 orquestradora — kit', cwd: repo, isArchived: false }));
  mkdirSync(join(pastaOrq(), 'ativas'), { recursive: true });
  writeFileSync(join(pastaOrq(), 'ativas', 'cli-anterior'), '');
  writeFileSync(join(pastaOrq(), 'ativas', 'cli-atual'), '');
  const r = batida(sessoes(sessao(41, '🎛 orquestradora — kit', { isRunning: true })));
  assert.deepEqual(r.json().marcadoresApagados, ['cli-anterior'], r.out);
  assert.ok(!existsSync(join(pastaOrq(), 'ativas', 'cli-anterior')));
  assert.ok(existsSync(join(pastaOrq(), 'ativas', 'cli-atual')));
});
test('batida: marcador fora do registro só sai depois de 10 min (o app pode ainda não ter gravado a id nova da limpeza)', () => {
  mkdirSync(join(pastaOrq(), 'ativas'), { recursive: true });
  writeFileSync(join(pastaOrq(), 'ativas', 'cli-recente'), '');
  writeFileSync(join(pastaOrq(), 'ativas', 'cli-velho'), '');
  const onzeMin = new Date(T - 11 * MIN);
  utimesSync(join(pastaOrq(), 'ativas', 'cli-velho'), onzeMin, onzeMin);
  const r = batida(sessoes(sessao(1, 'F1 · a')));
  assert.deepEqual(r.json().marcadoresApagados, ['cli-velho'], r.out);
  assert.ok(existsSync(join(pastaOrq(), 'ativas', 'cli-recente')));
});
test('batida --seco: devolve o que faria e não muda arquivo nenhum', () => {
  item('F1');
  const antes = statSync(arquivoDoItem('F1')).mtimeMs;
  const r = batida(sessoes(sessao(1, 'F1 · a')), T, ['--seco']);
  assert.equal(msgs(r, 'cutucada').length, 1, 'o seco ainda diz o que faria');
  assert.ok(!existsSync(join(pastaOrq(), 'batida')), 'o seco não grava estado');
  assert.equal(statSync(arquivoDoItem('F1')).mtimeMs, antes);
  assert.equal(lerItem('F1').version, 1);
  const solto = batida(sessoes(sessao(9, 'F9 · outra')), T, ['--seco']);
  assert.deepEqual(solto.json().soltos, ['F1'], 'o seco diz quem soltaria');
  assert.equal(lerItem('F1').data.donoLocalId, lid(1), 'mas não solta');
});
test('batida: duas ao mesmo tempo não repetem a mensagem', async () => {
  item('F1');
  const arq = sessoes(sessao(1, 'F1 · a'));
  const [a, b] = await Promise.all([
    painelAsync(['batida', '--sessoes', arq, '--agora', iso(T)]),
    painelAsync(['batida', '--sessoes', arq, '--agora', iso(T)]),
  ]);
  assert.equal(a.exit, 0, a.err); assert.equal(b.exit, 0, b.err);
  const total = [a, b].flatMap((r) => JSON.parse(r.out).mensagens).filter((m) => m.tipo === 'cutucada');
  assert.equal(total.length, 1, `${a.out} ${b.out}`);
});
test('batida: sessão de outro projeto não entra na conta', () => {
  item('F1', { projeto: 'outro' });
  const r = batida(sessoes(sessao(1, 'F1 · a', { cwd: outro })));
  assert.equal(msgs(r, 'cutucada').length, 1, 'o item do outro projeto é tratado no projeto dele');
  assert.deepEqual(Object.keys(r.json().projetos).sort(), ['outro']);
});
test('ensaio do plano: uma sessão parada com três itens → 3 mensagens a ela; 21 min depois, 3 itens soltos', () => {
  for (const F of ['F1', 'F2', 'F3']) item(F, { donoLocalId: lid(8), donoApelido: 'dona', com: [{ localId: lid(8), apelido: 'dona', oQue: 'planeja' }], etapa: 'planejamento', historico: [{ em: iso(T - 40 * MIN), etapa: 'planejamento', dono: 'dona' }] });
  const arq = sessoes(sessao(8, 'F8 · planos'));
  const a = batida(arq);
  const m = msgs(a, 'cutucada');
  assert.equal(m.length, 3, a.out);
  assert.ok(m.every((x) => x.para === lid(8)));
  const b = batida(arq, T + 21 * MIN);
  assert.deepEqual(b.json().soltos.sort(), ['F1', 'F2', 'F3'], b.out);
  for (const F of ['F1', 'F2', 'F3']) assert.deepEqual(lerItem(F).data.com, []);
});


// ---- batida: o item sem dona vira vaga no relatório ----
test('batida: item sem dona há 5 min ou mais → vaga "dona" no relatório e uma mensagem à orquestradora; com 4 min, nada', () => {
  item('F1', { ...semGente, etapa: 'planejamento', atualizadoEm: iso(T - 4 * MIN), historico: [{ em: iso(T - 4 * MIN), etapa: 'planejamento', dono: null }] });
  const arq = sessoes(sessao(30, '🎛 orquestradora — kit'));
  const cedo = batida(arq);
  assert.equal(cedo.exit, 0, cedo.err);
  assert.deepEqual(cedo.json().projetos.kit.vagas, [], 'prova: com 4 min ainda não é vaga');
  const r = batida(arq, T + 2 * MIN);
  assert.deepEqual(r.json().projetos.kit.vagas, [{ papel: 'dona', item: 'F1' }], r.out);
  const rel = msgs(r, 'relatorio');
  assert.equal(rel.length, 1, r.out);
  assert.match(rel[0].texto, /sem dona: F1/);
  assert.deepEqual(msgs(r, 'cutucada'), [], 'o item sem ninguém não é parado de ninguém');
});
test('batida: item sem dona com espera, trava ou em merge não vira vaga', () => {
  const sem = { ...semGente, atualizadoEm: iso(T - 40 * MIN) };
  item('F1', { ...sem, espera: { motivo: 'operador', texto: 'decide' } });
  item('F2', { ...sem, trava: { motivo: 'conflito', texto: 'x' } });
  item('F3', { ...sem, etapa: 'merge', historico: [{ em: iso(T - 40 * MIN), etapa: 'merge', dono: null }] });
  item('F4', sem);
  const r = batida(sessoes(sessao(30, '🎛 orquestradora — kit')));
  assert.deepEqual(r.json().projetos.kit.vagas, [{ papel: 'dona', item: 'F4' }], 'prova: o sem dona comum vira vaga');
});
