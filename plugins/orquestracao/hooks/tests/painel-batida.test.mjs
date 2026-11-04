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

// F220: a limpeza de contexto mata a fila em background; o item gravado há menos do prazo não contava como merge parado.
const estadoDaFila = () => join(base, 'fila-de-merge', 'kit.json');
function fila(estado) { mkdirSync(dirname(estadoDaFila()), { recursive: true }); writeFileSync(estadoDaFila(), JSON.stringify(estado)); }
const pidMorto = () => spawnSync('true', { timeout: 5000, killSignal: 'SIGKILL' }).pid;
const SHA = 'a9f034d309a1546d29c807ea54ce3dc87cf919b2';

test('batida: fila de merge sem processo vivo → os itens dela vão ao merge na hora e a orquestradora recebe o comando de relance', () => {
  item('F1', { etapa: 'merge', prs: [7], atualizadoEm: iso(T - 5 * MIN) });
  item('F2', { etapa: 'merge', prs: [8], atualizadoEm: iso(T - 5 * MIN) });
  const arq = sessoes(sessao(1, 'F1 · a'), sessao(30, '🎛 orquestradora — kit'));
  fila({ ocupada: { pid: pidMorto(), desde: iso(T - 30 * MIN), gate: 'pnpm test' }, emVoo: [{ pr: 7, sha: SHA }], pendentes: [{ pr: 8 }] });
  const a = batida(arq);
  assert.equal(a.exit, 0, a.err);
  const kit = a.json().projetos.kit;
  assert.deepEqual(kit.merge, ['F1', 'F2'], 'gravados há 5 min, mas a fila deles está órfã');
  assert.deepEqual(kit.filaParada?.prs, [7, 8]);
  const rel = msgs(a, 'relatorio');
  assert.equal(rel.length, 1, a.out);
  assert.equal(rel[0].para, lid(30));
  assert.match(rel[0].texto, /fila de merge sem processo/);
  assert.ok(rel[0].texto.includes(`painel fila-de-merge 7:${SHA} 8 --gate 'pnpm test'`), rel[0].texto);
  assert.deepEqual(JSON.parse(readFileSync(join(pastaOrq(), 'batida', 'kit.json'), 'utf8')).filaParada?.prs, [7, 8], 'o relatório gravado diz a fila parada');
  assert.deepEqual(msgs(batida(arq, T + 6 * MIN), 'relatorio'), [], 'o mesmo relatório não repete');
});

test('batida: fila com o dono vivo não é parada (e o item gravado há 5 min segue fora do merge parado)', () => {
  item('F1', { etapa: 'merge', prs: [7], atualizadoEm: iso(T - 5 * MIN) });
  const arq = sessoes(sessao(1, 'F1 · a'), sessao(30, '🎛 orquestradora — kit'));
  fila({ ocupada: { pid: process.pid, desde: new Date().toISOString() }, emVoo: [{ pr: 7, sha: SHA }], pendentes: [] });
  const a = batida(arq);
  assert.equal(a.exit, 0, a.err);
  assert.deepEqual(a.json().projetos.kit.merge, []);
  assert.equal(a.json().projetos.kit.filaParada ?? null, null);
  assert.deepEqual(msgs(a, 'relatorio'), []);
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

test('batida F218: item sem dona com cartão de sessão dona esperando o clique não vira vaga; cartão de antes de a dona soltar, sim', () => {
  const sem = { ...semGente, etapa: 'planejamento', atualizadoEm: iso(T - 40 * MIN), historico: [{ em: iso(T - 40 * MIN), etapa: 'planejamento', dono: null }] };
  // F2: a dona pegou em T−90 e soltou em T−40 (o `painel soltar`), e o cartão é de T−60, da rodada dela
  const soltou = { ...semGente, etapa: 'planejamento', atualizadoEm: iso(T - 40 * MIN), historico: [{ em: iso(T - 120 * MIN), etapa: 'planejamento', dono: null }, { em: iso(T - 90 * MIN), etapa: 'planejamento', dono: 'dona' }, { em: iso(T - 40 * MIN), etapa: 'planejamento', dono: null }] };
  item('F1', sem); item('F2', soltou); item('F3', sem);
  const cartao = (id, F, min) => writeFileSync(join(pastaPainel(), 'cartoes', `${id}.json`), JSON.stringify({ id, version: 1, data: { projeto: 'kit', apelido: 'dona', papel: 'dona', itens: [F], orquestradoraId: lid(30), propostoEm: iso(T - min * MIN) } }));
  mkdirSync(join(pastaPainel(), 'cartoes'), { recursive: true });
  cartao('task_a', 'F1', 30); cartao('task_b', 'F2', 60);
  // a sessão do F2 da dona que soltou segue viva: não conta
  const r = batida(sessoes(sessao(30, '🎛 orquestradora — kit'), sessao(31, 'F2 · item f2', { lastActivityAt: iso(T - 30 * MIN) })), T, ['--seco']);
  assert.equal(r.exit, 0, r.err);
  assert.deepEqual(r.json().projetos.kit.vagas, [{ papel: 'dona', item: 'F2' }, { papel: 'dona', item: 'F3' }], 'prova: F3 sem cartão vira vaga; F1 com cartão não; F2 com cartão velho e sessão velha, sim');
  assert.match(msgs(r, 'relatorio')[0]?.texto ?? '', /sem dona: F2, F3\./);
});

test('batida F218: a sessão aberta pelo cartão só o apaga quando o item ganhou quem trabalhe', () => {
  const sem = { ...semGente, etapa: 'planejamento', atualizadoEm: iso(T - 40 * MIN), historico: [{ em: iso(T - 40 * MIN), etapa: 'planejamento', dono: null }] };
  item('F1', sem); item('F2', { etapa: 'planejamento' });
  mkdirSync(join(pastaPainel(), 'cartoes'), { recursive: true });
  for (const [id, F] of [['task_a', 'F1'], ['task_b', 'F2']])
    writeFileSync(join(pastaPainel(), 'cartoes', `${id}.json`), JSON.stringify({ id, version: 1, data: { projeto: 'kit', apelido: 'dona', papel: 'dona', itens: [F], orquestradoraId: lid(30), propostoEm: iso(T - 10 * MIN) } }));
  const abertas = sessoes(sessao(30, '🎛 orquestradora — kit'), sessao(31, 'F1 · item f1', { createdAt: iso(T - 2 * MIN) }), sessao(32, 'F2 · item f2', { createdAt: iso(T - 2 * MIN) }));
  const r = batida(abertas, T, ['--seco']);
  assert.equal(r.exit, 0, r.err);
  assert.deepEqual(r.json().cartoesApagados, ['task_b'], 'prova: o F2 tem dona e o cartão dele sai; o do F1, aberto e ainda sem dona, fica');
  assert.deepEqual(r.json().projetos.kit.vagas, [], 'o F1 segue a caminho');
});

test('batida F218: a sessão aberta pelo cartão que passa de 30 min sem se gravar dona solta o cartão e o item volta a ser vaga', () => {
  const sem = { ...semGente, etapa: 'planejamento', atualizadoEm: iso(T - 60 * MIN), historico: [{ em: iso(T - 60 * MIN), etapa: 'planejamento', dono: null }] };
  item('F1', sem); item('F2', sem);
  mkdirSync(join(pastaPainel(), 'cartoes'), { recursive: true });
  for (const [id, F] of [['task_a', 'F1'], ['task_b', 'F2']])
    writeFileSync(join(pastaPainel(), 'cartoes', `${id}.json`), JSON.stringify({ id, version: 1, data: { projeto: 'kit', apelido: 'dona', papel: 'dona', itens: [F], orquestradoraId: lid(30), propostoEm: iso(T - 50 * MIN) } }));
  // o sessoes.json real só traz lastActivityAt: a do F1 parou há 31 min; a do F2 trabalhou há 5
  const arq = sessoes(sessao(30, '🎛 orquestradora — kit'), sessao(31, 'F1 · item f1', { lastActivityAt: iso(T - 31 * MIN) }), sessao(32, 'F2 · item f2', { lastActivityAt: iso(T - 5 * MIN) }));
  const r = batida(arq);
  assert.equal(r.exit, 0, r.err);
  assert.deepEqual(r.json().cartoesApagados, ['task_a'], 'prova: a do F2, ativa, segura o cartão; a do F1, parada há 31 min, não');
  const depois = batida(arq, T + MIN);
  assert.deepEqual(depois.json().projetos.kit.vagas, [{ papel: 'dona', item: 'F1' }], 'sem o cartão, o F1 volta a ser vaga');
});

// F241: a batida roda no mod de uma sessão viva qualquer, de qualquer projeto, e o app mostra essa sessão como remetente.
// O aviso vai à orquestradora do projeto do item e diz que o remetente é só quem rodou a batida.
test('batida F241: dois projetos, cada relatório vai à orquestradora do próprio projeto e avisa que o remetente não é o autor', () => {
  const merge = { etapa: 'merge', historico: [{ em: iso(T - 40 * MIN), etapa: 'merge', dono: 'dona' }] };
  item('F1', merge);
  item('F2', { ...merge, projeto: 'outro', donoLocalId: lid(2), com: [{ localId: lid(2), apelido: 'dona', oQue: 'faz' }] });
  item('F3', { projeto: 'outro', donoLocalId: lid(3), com: [{ localId: lid(3), apelido: 'dona', oQue: 'faz' }] });
  const r = batida(sessoes(
    sessao(1, 'F1 · a'), sessao(2, 'F2 · b', { cwd: outro }), sessao(3, 'F3 · c', { cwd: outro }),
    sessao(30, '🎛 orquestradora — kit'), sessao(40, '🎛 orquestradora — outro', { cwd: outro }),
  ));
  assert.equal(r.exit, 0, r.err);
  const rel = msgs(r, 'relatorio');
  assert.equal(rel.length, 2, r.out);
  assert.deepEqual(rel.map((m) => [m.para, /F1/.test(m.texto), /F2/.test(m.texto)]).sort(), [[lid(30), true, false], [lid(40), false, true]].sort());
  const cut = msgs(r, 'cutucada');
  assert.deepEqual(cut.map((m) => m.para), [lid(3)], r.out);
  for (const m of [...rel, ...cut]) assert.match(m.texto, /aviso automático da batida: o remetente é só a sessão que rodou a batida desta vez, de qualquer projeto; não responda a ela/, m.texto);
});

// ---- F351: a fila de merge sem turno ----
const lerFila = () => JSON.parse(readFileSync(estadoDaFila(), 'utf8'));
async function esperar(cond, ms = 20000) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) { if (cond()) return true; await new Promise((r) => setTimeout(r, 100)); }
  return false;
}

test('fila sem turno: a batida lança a fila anotada; o desfecho chega à orquestradora na batida seguinte e sai do estado', async () => {
  item('F1', { etapa: 'merge', prs: [77], atualizadoEm: iso(T - 40 * MIN) });
  const arq = sessoes(sessao(1, 'F1 · a'), sessao(30, '🎛 orquestradora — kit'));
  // o gh inexistente derruba a rodada logo na leitura do PR: o desfecho é um erro, e é o que se mede aqui
  fila({ ocupada: null, emVoo: [], pendentes: [{ pr: 77, sha: SHA }], config: { cwd: repo, gate: 'true', preparar: null } });
  const a = painel(['batida', '--sessoes', arq, '--agora', iso(T)], { env: { GH_BIN: join(base, 'gh-que-nao-existe') } });
  assert.equal(a.exit, 0, a.err);
  assert.deepEqual(a.json().filasLancadas, { kit: [77] }, a.out);
  assert.deepEqual(a.json().projetos.kit.merge, [], 'o item cujo PR a fila leva não é merge parado');
  assert.equal(lerFila().lancada.tentativas, 1);
  assert.ok(await esperar(() => (lerFila().desfechos ?? []).length > 0), `sem desfecho: ${readFileSync(estadoDaFila().replace(/\.json$/, '.sem-turno.log'), 'utf8')}`);
  assert.ok(lerFila().desfechos[0].erro, JSON.stringify(lerFila()));
  const b = batida(arq, T + 11 * MIN);
  const d = msgs(b, 'desfecho');
  assert.equal(d.length, 1, b.out);
  assert.equal(d[0].para, lid(30));
  assert.match(d[0].texto, /Fila de merge sem turno .*erro:/);
  assert.deepEqual(lerFila().desfechos, [], 'o desfecho entregue sai do estado');
});

test('fila sem turno: sem o sha da dona, sem gate gravado ou desligada, não lança e a fila parada vai à orquestradora', () => {
  item('F1', { etapa: 'merge', prs: [77] });
  const arq = sessoes(sessao(1, 'F1 · a'), sessao(30, '🎛 orquestradora — kit'));
  const casos = [
    [{ pendentes: [{ pr: 77 }], config: { cwd: repo, gate: 'true' } }, {}],
    [{ pendentes: [{ pr: 77, sha: SHA }] }, {}],
    [{ pendentes: [{ pr: 77, sha: SHA }], config: { cwd: repo, gate: 'true' } }, { KIT_FILA_SEM_TURNO: 'off' }],
  ];
  for (const [estado, env] of casos) {
    rmSync(join(pastaOrq(), 'batida'), { recursive: true, force: true });
    fila({ ocupada: null, emVoo: [], ...estado });
    const r = painel(['batida', '--sessoes', arq, '--agora', iso(T)], { env });
    assert.equal(r.exit, 0, r.err);
    assert.equal(r.json().filasLancadas, undefined, JSON.stringify(estado));
    assert.deepEqual(r.json().projetos.kit.filaParada?.prs, [77], r.out);
    assert.equal(lerFila().lancada, undefined);
  }
});

test('fila sem turno: lançada há menos de 5 min não relança; depois de 3 lançamentos sem dona, volta ao relatório', () => {
  item('F1', { etapa: 'merge', prs: [77] });
  const arq = sessoes(sessao(1, 'F1 · a'), sessao(30, '🎛 orquestradora — kit'));
  const base0 = { ocupada: null, emVoo: [], pendentes: [{ pr: 77, sha: SHA }], config: { cwd: repo, gate: 'true' } };
  fila({ ...base0, lancada: { em: iso(T - 2 * MIN), tentativas: 1 } });
  const r = batida(arq, T, ['--seco']);
  assert.equal(r.json().filasLancadas, undefined, 'recente: não relança');
  assert.equal(r.json().projetos.kit.filaParada, undefined, 'e também não é fila parada');
  fila({ ...base0, lancada: { em: iso(T - 10 * MIN), tentativas: 1 } });
  assert.deepEqual(batida(arq, T, ['--seco']).json().filasLancadas, { kit: [77] }, 'passou o prazo: relança');
  fila({ ...base0, lancada: { em: iso(T - 10 * MIN), tentativas: 3 } });
  const s = batida(arq, T, ['--seco']);
  assert.equal(s.json().filasLancadas, undefined);
  assert.deepEqual(s.json().projetos.kit.filaParada?.prs, [77], s.out);
});

test('fila sem turno: desfecho sem orquestradora avisa só a dona uma vez e fica até haver orquestradora', () => {
  item('F1', { etapa: 'execucao', atualizadoEm: iso(T) });
  const devolvido = { pr: 77, motivo: 'gate vermelho (exit 1)', log: '/tmp/x.log', itens: [{ item: 'F1', dona: lid(1) }] };
  fila({ ocupada: null, emVoo: [], pendentes: [], desfechos: [{ em: iso(T - MIN), mergeados: [], devolvidos: [devolvido] }] });
  const so = sessoes(sessao(1, 'F1 · a'));
  const a = batida(so);
  assert.equal(msgs(a, 'devolucao').length, 1, a.out);
  assert.equal(msgs(a, 'devolucao')[0].para, lid(1));
  assert.match(msgs(a, 'devolucao')[0].texto, /PR 77 devolvido .*gate vermelho.*--anotar/);
  assert.equal(msgs(a, 'desfecho').length, 0);
  assert.equal(lerFila().desfechos[0].donasAvisadas, true);
  const b = batida(sessoes(sessao(1, 'F1 · a'), sessao(30, '🎛 orquestradora — kit')), T + 11 * MIN);
  assert.equal(msgs(b, 'devolucao').length, 0, 'a dona não é avisada duas vezes');
  assert.equal(msgs(b, 'desfecho').length, 1);
  assert.match(msgs(b, 'desfecho')[0].texto, /devolvidos #77 \(F1, dona avisada\)/);
  assert.deepEqual(lerFila().desfechos, []);
});

// F370 caso 1: o aviso de fatia gravado pelo merge chega à dona na batida, uma vez, e o desfecho não o repete.
test('F370: aviso de fatia gravado pelo merge vai à dona viva uma vez e sai do estado; o --seco não o tira', () => {
  item('F1', { etapa: 'execucao', atualizadoEm: iso(T) });
  item('F2', { etapa: 'execucao', atualizadoEm: iso(T), donoLocalId: lid(2), com: [] });
  fila({ ocupada: null, emVoo: [], pendentes: [], avisos: [
    { tipo: 'fatia', pr: 77, item: 'F1', dona: lid(1), em: iso(T - MIN) },
    { tipo: 'fatia', pr: 78, item: 'F2', dona: lid(2), em: iso(T - MIN) },
  ] });
  const so = sessoes(sessao(1, 'F1 · a'));
  const seco = batida(so, T, ['--seco']);
  assert.equal(msgs(seco, 'fatia').length, 1, seco.out);
  assert.equal(lerFila().avisos.length, 2, 'o --seco não mexe no estado');
  const a = batida(so);
  const f = msgs(a, 'fatia');
  assert.equal(f.length, 1, a.out);
  assert.equal(f[0].para, lid(1));
  assert.match(f[0].texto, /^fatia PR 77 mergeada \(F1\): siga com a próxima\./);
  assert.deepEqual(lerFila().avisos, [], 'entregue (ou sem dona viva para receber) sai do estado');
  const b = batida(so, T + 11 * MIN);
  assert.equal(msgs(b, 'fatia').length, 0, 'a dona não é avisada duas vezes');
});

test('F370: o desfecho sem turno não repete a fatia já avisada; o desfecho antigo, sem a marca, ainda avisa', () => {
  item('F1', { etapa: 'execucao', atualizadoEm: iso(T) });
  item('F2', { etapa: 'execucao', atualizadoEm: iso(T), donoLocalId: lid(2), com: [] });
  const mergeados = [
    { pr: 77, itens: [{ item: 'F1', fechado: false, fatia: true, dona: lid(1), avisoGravado: true }] },
    { pr: 78, itens: [{ item: 'F2', fechado: false, fatia: true, dona: lid(2) }] },
  ];
  fila({ ocupada: null, emVoo: [], pendentes: [], desfechos: [{ em: iso(T - MIN), mergeados, devolvidos: [] }] });
  const a = batida(sessoes(sessao(1, 'F1 · a'), sessao(2, 'F2 · b')));
  assert.deepEqual(msgs(a, 'fatia').map((m) => m.para), [lid(2)], a.out);

// ---- F371: a dona parada pelo limite de uso ----
// O registro do app dá a id do CLI atual da dona; o transcript dela, em <HOME>/.claude/projects/<pasta>/<cli>.jsonl, termina na recusa
// (a forma medida em 03/11: linha `assistant` sintética com `isApiErrorMessage`, `error: "rate_limit"` e `quotaLimits.resetsAt` em segundos).
const CLI_DA_DONA = 'cccccccc-0000-4000-8000-000000000001';
function donaNoLimite(resetsAtMs, { comRegistro = true } = {}) {
  if (comRegistro) {
    mkdirSync(join(base, 'appsess', 'conta'), { recursive: true });
    writeFileSync(join(base, 'appsess', 'conta', `${lid(1)}.json`), JSON.stringify({ sessionId: lid(1), cliSessionId: CLI_DA_DONA, priorCliSessionIds: [], title: 'F1 · faz o item', isArchived: false, cwd: repo, originCwd: repo }));
  }
  const pasta = join(base, 'home', '.claude', 'projects', '-repo-kit');
  mkdirSync(pasta, { recursive: true });
  const recusa = { type: 'assistant', isSidechain: false, timestamp: iso(T - 5 * MIN), message: { model: '<synthetic>', role: 'assistant', content: [{ type: 'text', text: "You've hit your session limit · resets 8pm (America/Sao_Paulo)" }] }, error: 'rate_limit', isApiErrorMessage: true, quotaLimits: { status: 'rejected', resetsAt: resetsAtMs / 1000 } };
  writeFileSync(join(pasta, `${CLI_DA_DONA}.jsonl`), `${JSON.stringify({ type: 'user', timestamp: iso(T - 10 * MIN), message: { content: 'x' } })}\n${JSON.stringify(recusa)}\n`);
}
test('batida F371: dona no limite antes do reset → nem cutucada nem soltura; passado o reset, uma retomada com o handoff', () => {
  item('F1');
  const arq = sessoes(sessao(1, 'F1 · faz o item'));
  const reset = T + 60 * MIN;
  donaNoLimite(reset);
  const a = batida(arq);
  assert.equal(a.exit, 0, a.err);
  assert.deepEqual(msgs(a), [], a.out);
  assert.equal(a.json().limites?.[lid(1)], iso(reset), 'a hora do reset não foi lida');
  assert.deepEqual(batida(arq, T + 25 * MIN).json().soltos, [], 'no limite o item não é solto');
  mkdirSync(join(pastaPainel(), '..', 'pool', 'handoffs'), { recursive: true });
  writeFileSync(join(pastaPainel(), '..', 'pool', 'handoffs', 'F1.md'), '# handoff');
  const b = batida(arq, reset + 3 * MIN);
  const ret = msgs(b, 'retomada');
  assert.equal(ret.length, 1, b.out);
  assert.equal(ret[0].para, lid(1));
  assert.ok(ret[0].texto.includes(join(pastaPainel(), '..', 'pool', 'handoffs', 'F1.md')), ret[0].texto);
  assert.equal(msgs(batida(arq, reset + 13 * MIN), 'retomada').length, 0, 'a retomada não se repete');
});
test('batida F371: sem o registro da dona, o limite não é lido e a batida cutuca como antes (o contraste do teste acima)', () => {
  item('F1');
  donaNoLimite(T + 60 * MIN, { comRegistro: false });
  const a = batida(sessoes(sessao(1, 'F1 · faz o item')));
  assert.equal(msgs(a, 'cutucada').length, 1, a.out);
  assert.equal(a.json().limites, undefined);
});
