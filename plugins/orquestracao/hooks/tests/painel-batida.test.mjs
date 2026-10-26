// Testes de `painel batida`, `painel pegar` e `painel livres` (painel.mjs). Nunca tocam o painel real:
// HOME, PAINEL_DIR, HOOKS_CREWAI_BASE e POOL_APP_SESSOES_DIR são pastas temporárias; o "projeto" é um repositório git de mentira.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, statSync } from 'node:fs';
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
  ...process.env, PAINEL_DIR: pastaPainel(), CLAUDE_CODE_SESSION_ID: '', HOME: join(base, 'home'), HOOKS_CREWAI_BASE: pastaOrq(),
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
    donoLocalId: lid(1), donoApelido: 'E1', com: [{ localId: lid(1), apelido: 'E1', oQue: 'faz o item' }],
    atualizadoEm: iso(T - 40 * MIN), historico: [{ em: iso(T - 40 * MIN), etapa: extra.etapa ?? 'execucao', dono: 'E1' }],
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

// ---- livres ----
test('livres: só o membro livre do papel, parado, do projeto e fora de item vivo; o mais antigo primeiro', () => {
  item('F1', { com: [{ localId: lid(5), apelido: 'E5', oQue: 'faz' }], donoLocalId: lid(7), donoApelido: 'E7' });
  const arq = sessoes(
    sessao(1, 'E1 · livre'), sessao(2, 'E2 · livre'), sessao(3, 'E3 · outra coisa'), sessao(4, 'E4 · livre', { isRunning: true }),
    sessao(5, 'E5 · livre'), sessao(6, 'E6 · livre', { isArchived: true }), sessao(7, 'E7 · livre'), sessao(8, 'E8 · livre', { cwd: outro }),
    sessao(9, 'D1 · livre'),
  );
  const r = painel(['livres', 'E', '--sessoes', arq, '--projeto', 'kit']);
  assert.equal(r.exit, 0, r.err);
  assert.deepEqual(r.json().map((x) => x.apelido), ['E1', 'E2']);
  assert.equal(r.json()[0].localId, lid(1));
  assert.deepEqual(painel(['livres', 'D', '--sessoes', arq, '--projeto', 'kit']).json().map((x) => x.apelido), ['D1']);
});
test('livres sem --sessoes: lê o registro do app e não conta a mesma sessão duas vezes', () => {
  for (const sub of ['a', 'b']) {
    mkdirSync(join(base, 'appsess', sub), { recursive: true });
    writeFileSync(join(base, 'appsess', sub, `${lid(1)}.json`), JSON.stringify({ sessionId: lid(1), title: 'E1 · livre', cwd: repo, isArchived: false }));
  }
  writeFileSync(join(base, 'appsess', `${lid(2)}.json`), JSON.stringify({ sessionId: lid(2), title: 'E2 · livre', cwd: repo, isArchived: false }));
  const r = painel(['livres', 'E']);
  assert.equal(r.exit, 0, r.err);
  assert.deepEqual(r.json().map((x) => x.localId).sort(), [lid(1), lid(2)]);
});

// ---- pegar ----
const esperandoE = (extra = {}) => ({ ...semGente, etapa: 'execucao', historico: [{ em: iso(T - 10 * MIN), etapa: 'execucao', dono: null }], atualizadoEm: iso(T - 10 * MIN), ...extra });
test('pegar na execução: põe a sessão no com e grava o agora; o segundo a pegar é recusado', () => {
  item('F1', esperandoE());
  const a = painel(['pegar', 'F1', lid(11), 'E1']);
  assert.equal(a.exit, 0, a.err);
  assert.equal(a.json().pegou, true);
  assert.equal(a.json().etapa, 'execucao');
  const d = lerItem('F1').data;
  assert.deepEqual(d.com.map((c) => c.localId), [lid(11)]);
  assert.equal(d.agora, 'E1 começou');
  const b = painel(['pegar', 'F1', lid(12), 'E2']);
  assert.equal(b.exit, 1);
  assert.match(b.json().motivo, /./);
  assert.deepEqual(lerItem('F1').data.com.map((c) => c.localId), [lid(11)], 'o segundo não pode entrar');
});
test('pegar no planejamento grava o dono', () => {
  item('F1', esperandoE({ etapa: 'planejamento', historico: [{ em: iso(T - 10 * MIN), etapa: 'planejamento', dono: null }] }));
  const r = painel(['pegar', 'F1', lid(11), 'P1']);
  assert.equal(r.exit, 0, r.err);
  const d = lerItem('F1').data;
  assert.equal(d.donoLocalId, lid(11));
  assert.equal(d.donoApelido, 'P1');
  assert.deepEqual(d.com.map((c) => c.apelido), ['P1']);
});
test('pegar recusa: item que não existe, em merge, final, de outro papel e entregue', () => {
  assert.equal(painel(['pegar', 'F9', lid(11), 'E1']).exit, 1);
  item('F2', esperandoE({ etapa: 'merge', historico: [{ em: iso(T - 10 * MIN), etapa: 'merge', dono: null }] }));
  item('F3', esperandoE({ etapa: 'feito' }));
  item('F4', esperandoE());
  item('F5', esperandoE({ fez: [{ localId: lid(3), apelido: 'E3', oQue: 'fez', em: iso(T - 5 * MIN) }] }));
  for (const [F, ap] of [['F2', 'E1'], ['F3', 'E1'], ['F4', 'V1'], ['F5', 'E1']]) {
    const r = painel(['pegar', F, lid(11), ap]);
    assert.equal(r.exit, 1, `${F} ${ap} devia recusar: ${r.out}`);
    assert.ok(r.json().recusado, `${F}: sem "recusado"`);
    assert.deepEqual(lerItem(F).data.com, [], `${F}: não pode mudar`);
  }
  assert.equal(painel(['pegar', 'F4', lid(11), 'E1']).exit, 0, 'o mesmo item serve ao papel certo (a recusa acima não vinha de outra causa)');
});
test('pegar em corrida: dois livres, um pega e o outro é recusado', async () => {
  item('F1', esperandoE());
  const [a, b] = await Promise.all([painelAsync(['pegar', 'F1', lid(11), 'E1']), painelAsync(['pegar', 'F1', lid(12), 'E2'])]);
  assert.deepEqual([a.exit, b.exit].sort(), [0, 1], `a: ${a.err} b: ${b.err}`);
  assert.equal(lerItem('F1').data.com.length, 1);
});

// ---- batida: o item parado ----
test('batida: vencido sem cutucada → uma mensagem à dona e o estado gravado; 5 min depois, nada', () => {
  item('F1');
  const arq = sessoes(sessao(1, 'E1 · faz o item'));
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
  const arq = sessoes(sessao(1, 'E1 · faz o item'));
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
  const arq = sessoes(sessao(1, 'E1 · faz o item'));
  assert.equal(msgs(batida(arq), 'cutucada').length, 1);
  const f = lerItem('F1'); f.data.atualizadoEm = iso(T + 3 * MIN); writeFileSync(arquivoDoItem('F1'), JSON.stringify(f));
  const r = batida(arq, T + 35 * MIN);
  assert.deepEqual(r.json().soltos, [], 'quem gravou não pode ser solto');
  assert.equal(msgs(r, 'cutucada').length, 1, 'parou de novo: a cutucada recomeça');
});
test('batida: alguém do com rodando → nada (e sem ele rodando, cutuca: a prova de que a regra morde)', () => {
  item('F1', { com: [{ localId: lid(1), apelido: 'E1', oQue: 'faz' }, { localId: lid(2), apelido: 'V1', oQue: 'confere' }] });
  assert.equal(msgs(batida(sessoes(sessao(1, 'E1 · a'), sessao(2, 'V1 · b'))), 'cutucada').length, 1);
  rmSync(join(pastaOrq(), 'batida'), { recursive: true, force: true });
  const r = batida(sessoes(sessao(1, 'E1 · a'), sessao(2, 'V1 · b', { isRunning: true })));
  assert.deepEqual(msgs(r), []);
  assert.deepEqual(r.json().soltos, []);
});
test('batida: dono arquivado ou sumido → solta direto, sem cutucar', () => {
  item('F1', { com: [{ localId: lid(1), apelido: 'E1', oQue: 'faz' }] });
  const r = batida(sessoes(sessao(1, 'E1 · a', { isArchived: true })));
  assert.deepEqual(r.json().soltos, ['F1'], r.out);
  assert.deepEqual(msgs(r), []);
  assert.match(lerItem('F1').data.agora, /arquivada ou sumiu/);
  item('F2');
  assert.deepEqual(batida(sessoes(sessao(9, 'E9 · outra'))).json().soltos, ['F2'], 'sumida da lista');
});
test('batida: item sem dono nem com não é parado de ninguém', () => {
  item('F1', semGente);
  const r = batida(sessoes(sessao(1, 'E1 · a')));
  assert.deepEqual(r.json().soltos, []);
  assert.deepEqual(msgs(r, 'cutucada'), []);
});
test('batida: item em merge parado vai ao relatório, nada à dona; com a orquestradora viva, uma mensagem só', () => {
  item('F1', { etapa: 'merge', historico: [{ em: iso(T - 40 * MIN), etapa: 'merge', dono: 'E1' }] });
  const arq = sessoes(sessao(1, 'E1 · a'), sessao(30, '🎛 orquestradora — kit'));
  const a = batida(arq);
  assert.deepEqual(msgs(a, 'cutucada'), []);
  assert.deepEqual(a.json().projetos.kit.merge, ['F1']);
  const rel = msgs(a, 'relatorio');
  assert.equal(rel.length, 1, a.out);
  assert.equal(rel[0].para, lid(30));
  assert.match(rel[0].texto, /F1/);
  assert.ok(existsSync(join(pastaOrq(), 'batida', 'kit.json')));
  assert.deepEqual(msgs(batida(arq, T + 6 * MIN), 'relatorio'), [], 'o mesmo relatório não repete');
  const sem = batida(sessoes(sessao(1, 'E1 · a')), T + 12 * MIN);
  assert.deepEqual(msgs(sem, 'relatorio'), [], 'sem orquestradora viva, ninguém a quem avisar');
});

// ---- batida: o item que espera um papel ----
test('batida: esperando E com dois livres → um aviso ao mais antigo; sem reavisar o mesmo par', () => {
  item('F1', esperandoE());
  const arq = sessoes(sessao(1, 'E1 · livre'), sessao(2, 'E2 · livre'));
  const a = batida(arq);
  const m = msgs(a, 'avisar-livre');
  assert.equal(m.length, 1, a.out);
  assert.equal(m[0].para, lid(1));
  assert.match(m[0].texto, /painel pegar F1/);
  assert.deepEqual(msgs(batida(arq, T + 2 * MIN), 'avisar-livre'), []);
});
test('batida: máquina cheia segura a V (gate), sem aviso', () => {
  item('F1', { ...semGente, etapa: 'validacao', historico: [{ em: iso(T - 10 * MIN), etapa: 'validacao', dono: null }], atualizadoEm: iso(T - 10 * MIN) });
  const arq = sessoes(sessao(1, 'V1 · livre'));
  const r = batida(arq, T, []);
  const livre = msgs(r, 'avisar-livre').length;
  assert.equal(livre, 1, 'prova: com a máquina livre há aviso');
  rmSync(join(pastaOrq(), 'batida'), { recursive: true, force: true });
  const cheia = painel(['batida', '--sessoes', arq, '--agora', iso(T)], { env: { KIT_CARGA_1MIN: '9999' } });
  assert.deepEqual(msgs(cheia, 'avisar-livre'), []);
  const d = lerItem('F1').data;
  assert.equal(d.espera?.motivo, 'gate');
  assert.match(d.espera.texto, /máquina cheia/);
});
test('batida: esperando E sem livre → vaga', () => {
  item('F1', esperandoE());
  const r = batida(sessoes(sessao(1, 'E1 · outra coisa')));
  assert.deepEqual(msgs(r, 'avisar-livre'), []);
  assert.ok(r.json().projetos.kit.vagas.some((v) => v.papel === 'E' && v.item === 'F1'), r.out);
});
test('batida: entregue → cutuca a dona para avançar a etapa, uma vez por entrega', () => {
  item('F1', {
    etapa: 'execucao', donoLocalId: lid(3), donoApelido: 'P1', com: [], atualizadoEm: iso(T - 10 * MIN),
    historico: [{ em: iso(T - 30 * MIN), etapa: 'execucao', dono: 'P1' }], fez: [{ localId: lid(9), apelido: 'E1', oQue: 'fez', em: iso(T - 10 * MIN) }],
  });
  const arq = sessoes(sessao(3, 'P1 · plano'), sessao(9, 'E1 · livre'));
  const a = batida(arq);
  const m = msgs(a, 'avancar');
  assert.equal(m.length, 1, a.out);
  assert.equal(m[0].para, lid(3));
  assert.deepEqual(msgs(a, 'avisar-livre'), [], 'entregue não pede despacho');
  assert.deepEqual(msgs(batida(arq, T + 3 * MIN), 'avancar'), []);
});

// ---- batida: piso, excedentes, modo ausente, marcadores ----
test('batida: quatro E livres → duas excedentes (as mais antigas); modo ausente → sem excedentes nem piso', () => {
  const arq = sessoes(sessao(1, 'E1 · livre'), sessao(2, 'E2 · livre'), sessao(3, 'E3 · livre'), sessao(4, 'E4 · livre'));
  const a = batida(arq);
  assert.deepEqual(a.json().projetos.kit.excedentes.map((x) => x.apelido), ['E1', 'E2'], a.out);
  rmSync(join(pastaOrq(), 'batida'), { recursive: true, force: true });
  writeFileSync(join(pastaOrq(), 'operador-ausente.json'), JSON.stringify({ desde: iso(T - 5 * MIN) }));
  const b = batida(arq);
  assert.deepEqual(b.json().projetos.kit.excedentes, []);
  const semE = batida(sessoes(sessao(1, 'P1 · a')));
  assert.deepEqual(semE.json().projetos.kit.vagas, [], 'ausente: o piso de E não pede vaga');
});
test('batida: sem nenhuma E livre, fora do ausente, o piso pede a vaga', () => {
  const r = batida(sessoes(sessao(1, 'P1 · a')));
  assert.ok(r.json().projetos.kit.vagas.some((v) => v.papel === 'E' && v.piso === true), r.out);
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
test('batida --seco: devolve o que faria e não muda arquivo nenhum', () => {
  item('F1');
  const antes = statSync(arquivoDoItem('F1')).mtimeMs;
  const r = batida(sessoes(sessao(1, 'E1 · a')), T, ['--seco']);
  assert.equal(msgs(r, 'cutucada').length, 1, 'o seco ainda diz o que faria');
  assert.ok(!existsSync(join(pastaOrq(), 'batida')), 'o seco não grava estado');
  assert.equal(statSync(arquivoDoItem('F1')).mtimeMs, antes);
  assert.equal(lerItem('F1').version, 1);
  const solto = batida(sessoes(sessao(9, 'E9 · outra')), T, ['--seco']);
  assert.deepEqual(solto.json().soltos, ['F1'], 'o seco diz quem soltaria');
  assert.equal(lerItem('F1').data.donoLocalId, lid(1), 'mas não solta');
});
test('batida: duas ao mesmo tempo não repetem a mensagem', async () => {
  item('F1');
  const arq = sessoes(sessao(1, 'E1 · a'));
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
  const r = batida(sessoes(sessao(1, 'E1 · a', { cwd: outro })));
  assert.equal(msgs(r, 'cutucada').length, 1, 'o item do outro projeto é tratado no projeto dele');
  assert.deepEqual(Object.keys(r.json().projetos).sort(), ['outro']);
});
