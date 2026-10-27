// Testes de `painel batida`, `painel pegar` e `painel livres` (painel.mjs). Nunca tocam o painel real:
// HOME, PAINEL_DIR, HOOKS_CREWAI_BASE e POOL_APP_SESSOES_DIR são pastas temporárias; o "projeto" é um repositório git de mentira.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
// ADR 0011: estes casos medem o pool de papéis, que só vale com KIT_MODELO=papeis (os filhos herdam o ambiente).
process.env.KIT_MODELO = 'papeis';

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
// ---- pegar: o id é o da própria sessão (F155) ----
const registrar = (n, titulo) => writeFileSync(join(base, 'appsess', `${lid(n)}.json`), JSON.stringify({ sessionId: lid(n), title: titulo, cwd: repo, isArchived: false }));
test('pegar com o id de outra sessão é recusado e não grava', () => {
  registrar(11, 'E1 · livre'); registrar(20, '🎛 orquestradora — kit');
  item('F2', esperandoE());
  const certo = painel(['pegar', 'F2', lid(11), 'E1'], { env: { CLAUDE_CODE_HOST_SESSION_ID: lid(11) } });
  assert.equal(certo.exit, 0, certo.err);
  assert.deepEqual(lerItem('F2').data.com.map((c) => c.localId), [lid(11)], 'a presença: o id da própria sessão grava');
  item('F1', esperandoE());
  const antes = readFileSync(arquivoDoItem('F1'), 'utf8');
  const r = painel(['pegar', 'F1', lid(20), 'E1'], { env: { CLAUDE_CODE_HOST_SESSION_ID: lid(11) } });
  assert.equal(r.exit, 1, r.out);
  assert.ok(r.err.includes(lid(20)) && r.err.includes(lid(11)), r.err);
  assert.equal(readFileSync(arquivoDoItem('F1'), 'utf8'), antes);
});
test('pegar sem o id usa o da sessão; sem como saber o id, pede o local_…', () => {
  item('F1', esperandoE());
  const r = painel(['pegar', 'F1', 'E1'], { env: { CLAUDE_CODE_HOST_SESSION_ID: lid(11) } });
  assert.equal(r.exit, 0, r.err);
  assert.equal(lerItem('F1').data.com[0].localId, lid(11));
  item('F3', esperandoE());
  const sem = painel(['pegar', 'F3', 'E1']);
  assert.equal(sem.exit, 1, sem.out);
  assert.match(sem.err, /local_/);
});
test('pegar com o id da sessão mas o apelido de outro é recusado', () => {
  registrar(11, 'E1 · livre');
  item('F1', esperandoE());
  const r = painel(['pegar', 'F1', lid(11), 'E2']);
  assert.equal(r.exit, 1, r.out);
  assert.match(r.err, /E1/);
  const ok = painel(['pegar', 'F1', lid(11), 'E1']);
  assert.equal(ok.exit, 0, ok.err);
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
test('batida: livre no fez de item vivo não é excedente nem conta para o teto; com o item fechado, o mais antigo é', () => {
  const arq = sessoes(sessao(1, 'D1 · livre'), sessao(2, 'D2 · livre'), sessao(3, 'D3 · livre'));
  const fez = [{ localId: lid(1), apelido: 'D1', oQue: 'fez', em: iso(T - 60 * MIN) }];
  item('F1', { ...semGente, etapa: 'validacao', historico: [{ em: iso(T - 40 * MIN), etapa: 'validacao', dono: null }], fez });
  const vivo = batida(arq);
  assert.equal(vivo.exit, 0, vivo.err);
  assert.deepEqual(vivo.json().projetos.kit.excedentes, [], vivo.out);
  item('F1', { ...semGente, etapa: 'feito', fez });
  rmSync(join(pastaOrq(), 'batida'), { recursive: true, force: true });
  const fechado = batida(arq);
  assert.deepEqual(fechado.json().projetos.kit.excedentes.map((x) => x.apelido), ['D1'], fechado.out);
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
test('ensaio do plano: uma sessão parada com três itens → 3 mensagens a ela; 21 min depois, 3 itens soltos', () => {
  for (const F of ['F1', 'F2', 'F3']) item(F, { donoLocalId: lid(8), donoApelido: 'P8', com: [{ localId: lid(8), apelido: 'P8', oQue: 'planeja' }], etapa: 'planejamento', historico: [{ em: iso(T - 40 * MIN), etapa: 'planejamento', dono: 'P8' }] });
  const arq = sessoes(sessao(8, 'P8 · planos'));
  const a = batida(arq);
  const m = msgs(a, 'cutucada');
  assert.equal(m.length, 3, a.out);
  assert.ok(m.every((x) => x.para === lid(8)));
  const b = batida(arq, T + 21 * MIN);
  assert.deepEqual(b.json().soltos.sort(), ['F1', 'F2', 'F3'], b.out);
  for (const F of ['F1', 'F2', 'F3']) assert.deepEqual(lerItem(F).data.com, []);
});

// ---- batida: o membro que ficou com o título do item que fechou (F134) ----
test('batida: membro parado com título de item que fechou → uma mensagem a ele e titulosVelhos no relatório; não repete', () => {
  item('F1', { etapa: 'feito', donoLocalId: lid(6), donoApelido: 'E6', com: [] });
  const arq = sessoes(sessao(6, 'E6 · histórico das etapas'), sessao(30, '🎛 orquestradora — kit'));
  const a = batida(arq);
  assert.equal(a.exit, 0, a.err);
  const m = msgs(a, 'titulo-velho');
  assert.equal(m.length, 1, a.out);
  assert.equal(m[0].para, lid(6));
  assert.equal(m[0].item, null);
  assert.match(m[0].texto, /`E6 · livre`/);
  assert.match(m[0].texto, /clear_session/);
  assert.deepEqual(a.json().projetos.kit.titulosVelhos, [{ apelido: 'E6', localId: lid(6), titulo: 'E6 · histórico das etapas' }]);
  assert.match(msgs(a, 'relatorio')[0]?.texto ?? '', /título velho: E6/, a.out);
  const b = batida(arq, T + 11 * MIN);
  assert.deepEqual(msgs(b, 'titulo-velho'), [], 'o mesmo título não é avisado duas vezes');
  assert.deepEqual(msgs(b, 'relatorio'), [], 'o relatório igual não repete');
});
test('batida: aguardando validação com o item fechado também é título velho; no fez de item vivo não é', () => {
  item('F1', { ...semGente, etapa: 'feito', fez: [{ localId: lid(13), apelido: 'E13', oQue: 'fez', em: iso(T - 60 * MIN) }] });
  item('F2', { ...semGente, etapa: 'validacao', historico: [{ em: iso(T - 40 * MIN), etapa: 'validacao', dono: null }], fez: [{ localId: lid(15), apelido: 'E15', oQue: 'fez', em: iso(T - 40 * MIN) }] });
  const r = batida(sessoes(sessao(13, 'E13 · aguardando validação'), sessao(15, 'E15 · aguardando validação')));
  assert.deepEqual(msgs(r, 'titulo-velho').map((m) => m.para), [lid(13)], r.out);
});
test('batida: não é título velho — livre, rodando, recém-parado, dono, no com, orquestradora, arquivado, sem apelido', () => {
  item('F1', { donoLocalId: lid(2), donoApelido: 'P2', com: [{ localId: lid(3), apelido: 'E3', oQue: 'faz' }], atualizadoEm: iso(T - MIN) });
  const arq = sessoes(
    sessao(1, 'E1 · livre'), sessao(2, 'P2 · plano do editor'), sessao(3, 'E3 · tela do editor'),
    sessao(4, 'E4 · coisa velha', { isRunning: true }), sessao(5, 'E5 · coisa velha', { lastActivityAt: iso(T - 2 * MIN) }),
    sessao(7, 'E7 · coisa velha', { isArchived: true }), sessao(8, 'conversa solta'), sessao(30, '🎛 orquestradora — kit'),
  );
  const r = batida(arq);
  assert.deepEqual(msgs(r, 'titulo-velho'), [], r.out);
  assert.deepEqual(r.json().projetos.kit.titulosVelhos, []);
  const prova = batida(sessoes(sessao(5, 'E5 · coisa velha', { lastActivityAt: iso(T - 20 * MIN) })), T + MIN);
  assert.deepEqual(msgs(prova, 'titulo-velho').map((m) => m.para), [lid(5)], 'prova: a mesma sessão, parada há mais tempo, é avisada');
});
test('batida: título velho trocado por outro título velho é avisado de novo; o que virou livre sai do estado', () => {
  const a = batida(sessoes(sessao(6, 'E6 · item a')));
  assert.equal(msgs(a, 'titulo-velho').length, 1, a.out);
  const b = batida(sessoes(sessao(6, 'E6 · item b')), T + 11 * MIN);
  assert.equal(msgs(b, 'titulo-velho').length, 1, 'título diferente: aviso novo');
  batida(sessoes(sessao(6, 'E6 · livre')), T + 22 * MIN);
  const estado = JSON.parse(readFileSync(join(pastaOrq(), 'batida', 'estado.json'), 'utf8'));
  assert.ok(!Object.keys(estado.avisos ?? {}).some((k) => k.startsWith('titulo:')), JSON.stringify(estado));
});
test('batida sem orquestradora: titulosVelhos fica no próximo relatório, como merge e vagas', () => {
  batida(sessoes(sessao(6, 'E6 · item a')));
  const rel = JSON.parse(readFileSync(join(pastaOrq(), 'batida', 'kit.json'), 'utf8'));
  assert.deepEqual(rel.titulosVelhos, [], 'sem orquestradora, o último relatório não absorve o título velho');
  const r = batida(sessoes(sessao(6, 'E6 · item a'), sessao(30, '🎛 orquestradora — kit')), T + 11 * MIN);
  assert.match(msgs(r, 'relatorio')[0]?.texto ?? '', /título velho: E6/, r.out);
});
test('batida: avisado que acorda e não troca o título não é reavisado (F134, achado 1 da V2)', () => {
  const a = batida(sessoes(sessao(6, 'E6 · item a')));
  assert.equal(msgs(a, 'titulo-velho').length, 1, a.out);
  batida(sessoes(sessao(6, 'E6 · item a', { isRunning: true })), T + 10 * MIN);
  batida(sessoes(sessao(6, 'E6 · item a', { lastActivityAt: iso(T + 10 * MIN) })), T + 12 * MIN);
  const c = batida(sessoes(sessao(6, 'E6 · item a', { lastActivityAt: iso(T + 10 * MIN) })), T + 21 * MIN);
  assert.deepEqual(msgs(c, 'titulo-velho'), [], 'rodar ou estar recente não zera o aviso');
});
test('batida: a mesma lista de títulos velhos em outra ordem não repete o relatório (F134, achado 2 da V2)', () => {
  const orq = sessao(30, '🎛 orquestradora — kit');
  const a = batida(sessoes(sessao(6, 'E6 · a'), sessao(12, 'E12 · b'), orq));
  assert.equal(msgs(a, 'relatorio').length, 1, a.out);
  assert.deepEqual(a.json().projetos.kit.titulosVelhos.map((x) => x.apelido), ['E6', 'E12']);
  const b = batida(sessoes(sessao(12, 'E12 · b'), sessao(6, 'E6 · a'), orq), T + 11 * MIN);
  assert.deepEqual(msgs(b, 'relatorio'), [], b.out);
});
test('batida: o avisado que acorda continua em titulosVelhos, sem relatório a mais (F134, nota da V1)', () => {
  const orq = sessao(30, '🎛 orquestradora — kit');
  assert.equal(msgs(batida(sessoes(sessao(6, 'E6 · a'), orq)), 'relatorio').length, 1);
  const b = batida(sessoes(sessao(6, 'E6 · a', { isRunning: true }), orq), T + 10 * MIN);
  assert.deepEqual(b.json().projetos.kit.titulosVelhos.map((x) => x.apelido), ['E6'], b.out);
  assert.deepEqual(msgs(b, 'relatorio'), []);
  const c = batida(sessoes(sessao(6, 'E6 · a', { lastActivityAt: iso(T + 10 * MIN) }), orq), T + 21 * MIN);
  assert.deepEqual(msgs(c, 'relatorio'), [], c.out);
});

// ---- F143: afinidade no despacho (ADR 0009) ----
const passou = (n, apelido, em, extra = {}) => ({ localId: lid(n), apelido, papel: apelido[0], em: iso(em), ...extra });
const esperandoDesde = (min, extra = {}) => esperandoE({ historico: [{ em: iso(T - min * MIN), etapa: 'execucao', dono: null }], atualizadoEm: iso(T - min * MIN), ...extra });

test('passaram: pegar e com add registram quem passou pelo item (papel e em); repetir atualiza; update recusa o campo', () => {
  item('F1', esperandoE());
  const a = painel(['pegar', 'F1', lid(3), 'E3']);
  assert.equal(a.exit, 0, a.err);
  const p1 = lerItem('F1').data.passaram;
  assert.equal(p1.length, 1);
  assert.deepEqual({ ...p1[0], em: undefined }, { localId: lid(3), apelido: 'E3', papel: 'E', em: undefined });
  assert.ok(!Number.isNaN(Date.parse(p1[0].em)));
  assert.equal(painel(['com', 'add', 'F1', lid(4), 'E4', 'ajuda']).exit, 0);
  assert.equal(painel(['com', 'add', 'F1', lid(3), 'E3', 'segue']).exit, 0);
  const p2 = lerItem('F1').data.passaram;
  assert.deepEqual(p2.map((x) => x.apelido).sort(), ['E3', 'E4']);
  assert.ok(Date.parse(p2.find((x) => x.apelido === 'E3').em) >= Date.parse(p1[0].em));
  const u = painel(['update', 'fila', 'F1', '{"passaram":[]}']);
  assert.notEqual(u.exit, 0, u.out);
  assert.match(u.err, /passaram/);
  assert.equal(lerItem('F1').data.passaram.length, 2, 'o update recusado não apagou nada');
});

test('afimDe: o mais recente do mesmo projeto, tema e papel, vivo e com o mesmo apelido no título', async () => {
  const { afimDe } = await import(pathToFileURL(join(SCRIPTS, 'batida.mjs')).href);
  const alvo = { projeto: 'kit', tema: 'editor', etapa: 'execucao' };
  const antigo = { projeto: 'kit', tema: 'editor', etapa: 'feito', passaram: [passou(3, 'E3', T - 60 * MIN), passou(5, 'E5', T - 10 * MIN)] };
  const mapa = (...ds) => new Map([['F9', alvo], ...ds.map((d, i) => [`F${i + 1}`, d])]);
  const projetoDe = () => 'kit';
  const vivas = [sessao(3, 'E3 · livre'), sessao(5, 'E5 · tela do editor')];
  const a = afimDe(alvo, 'E', mapa(antigo), vivas, projetoDe);
  assert.ok(a, 'achou o afim');
  assert.equal(a.localId, lid(5));
  assert.equal(a.apelido, 'E5');
  assert.equal(afimDe(alvo, 'E', mapa({ ...antigo, tema: 'quadro' }), vivas, projetoDe), null, 'outro tema não conta');
  assert.equal(afimDe(alvo, 'E', mapa({ ...antigo, projeto: 'outro' }), vivas, projetoDe), null, 'outro projeto não conta');
  assert.equal(afimDe(alvo, 'V', mapa(antigo), vivas, projetoDe), null, 'outro papel não conta');
  assert.equal(afimDe(alvo, 'E', mapa(antigo), [sessao(3, 'E3 · livre'), sessao(5, 'E5 · tela', { isArchived: true })], projetoDe).localId, lid(3), 'arquivada não conta: cai no seguinte');
  assert.equal(afimDe(alvo, 'E', mapa(antigo), [sessao(3, 'D3 · livre'), sessao(5, 'V5 · algo')], projetoDe), null, 'título de outro apelido não conta');
  const soFez = { projeto: 'kit', tema: 'editor', etapa: 'feito', fez: [{ localId: lid(3), apelido: 'E3', oQue: 'fez', em: iso(T - 30 * MIN) }] };
  assert.equal(afimDe(alvo, 'E', mapa(soFez), vivas, projetoDe).localId, lid(3), 'item antigo só com fez conta');
});

test('batida (afinidade): o afim livre recebe o aviso no lugar do livre mais antigo', () => {
  item('F1', { ...semGente, etapa: 'feito', tema: 'editor', passaram: [passou(5, 'E5', T - 90 * MIN)] });
  item('F9', esperandoDesde(10));
  const r = batida(sessoes(sessao(1, 'E1 · livre'), sessao(5, 'E5 · livre')));
  assert.deepEqual(msgs(r, 'avisar-livre').map((m) => m.para), [lid(5)], r.out);
});

test('batida (afinidade): afim ocupado recebe "pegue ao terminar" uma vez; ninguém mais é avisado nem vaga é pedida; passou do prazo, o de sempre', () => {
  item('F1', { ...semGente, etapa: 'feito', tema: 'editor', passaram: [passou(5, 'E5', T - 90 * MIN)] });
  item('F9', esperandoDesde(10));
  const arq = sessoes(sessao(1, 'E1 · livre'), sessao(5, 'E5 · tela do editor'));
  const a = batida(arq);
  assert.deepEqual(msgs(a, 'afinidade').map((m) => m.para), [lid(5)], a.out);
  assert.match(msgs(a, 'afinidade')[0].texto, /pegue ao terminar/);
  assert.deepEqual(msgs(a, 'avisar-livre'), [], 'o livre não é avisado dentro do prazo');
  assert.deepEqual(a.json().projetos.kit.vagas, []);
  assert.deepEqual(msgs(batida(arq, T + 2 * MIN), 'afinidade'), [], 'uma vez só');
  const tarde = batida(arq, T + 15 * MIN);
  assert.deepEqual(msgs(tarde, 'avisar-livre').map((m) => m.para), [lid(1)], tarde.out);
});

test('batida (afinidade): sem afim, o aviso é do livre mais antigo, como antes', () => {
  item('F1', { ...semGente, etapa: 'feito', tema: 'quadro', passaram: [passou(5, 'E5', T - 90 * MIN)] });
  item('F9', esperandoDesde(10));
  const r = batida(sessoes(sessao(1, 'E1 · livre'), sessao(5, 'E5 · livre')));
  assert.deepEqual(msgs(r, 'avisar-livre').map((m) => m.para), [lid(1)], r.out);
});

test('batida (afinidade): o afim livre já avisado de outro item nesta batida conta como ocupado', () => {
  item('F1', { ...semGente, etapa: 'feito', tema: 'editor', passaram: [passou(5, 'E5', T - 90 * MIN)] });
  item('F8', esperandoDesde(12));
  item('F9', esperandoDesde(10));
  const r = batida(sessoes(sessao(1, 'E1 · livre'), sessao(5, 'E5 · livre')));
  assert.deepEqual(msgs(r, 'avisar-livre').map((m) => [m.item, m.para]), [['F8', lid(5)]], r.out);
  assert.deepEqual(msgs(r, 'afinidade').map((m) => [m.item, m.para]), [['F9', lid(5)]], r.out);
});

function transcriptDoE3(tokens) {
  writeFileSync(join(base, 'appsess', `${lid(3)}.json`), JSON.stringify({ sessionId: lid(3), cliSessionId: 'cli-e3', title: 'E3 · tela', cwd: repo, isArchived: false }));
  const dir = join(base, 'home', '.claude', 'projects', 'proj');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'cli-e3.jsonl'), `${JSON.stringify({ type: 'assistant', timestamp: iso(T), message: { model: 'x', usage: { input_tokens: 10, cache_creation_input_tokens: 0, cache_read_input_tokens: tokens } } })}\n`);
}
test('seguinte: pega o item mais antigo do mesmo tema e papel que espera; outro tema, sem passagem e sem item dão pegou:false', () => {
  item('F1', { ...semGente, etapa: 'feito', tema: 'editor', passaram: [passou(3, 'E3', T - 90 * MIN)] });
  item('F4', esperandoDesde(10));
  item('F2', esperandoDesde(30));
  item('F3', esperandoDesde(50, { tema: 'quadro' }));
  const r = painel(['seguinte', lid(3), 'E3', '--tokens', '100000']);
  assert.equal(r.exit, 0, r.err);
  assert.equal(r.json().pegou, true, r.out);
  assert.equal(r.json().item, 'F2', r.out);
  assert.ok(lerItem('F2').data.com.some((c) => c.localId === lid(3)));
  const b = painel(['seguinte', lid(3), 'E3', '--tokens', '100000']);
  assert.equal(b.json().item, 'F4', 'pega o seguinte do mesmo tema');
  const c = painel(['seguinte', lid(3), 'E3', '--tokens', '100000']);
  assert.equal(c.json().pegou, false, 'só sobrou o de outro tema');
  assert.match(c.json().motivo, /tema|nenhum/i);
  assert.equal(painel(['seguinte', lid(9), 'E9', '--tokens', '100000']).json().pegou, false, 'sem passagem registrada');
});
test('seguinte: o teto de contexto manda mais — acima do aviso do papel recusa; mede o transcript; sem medida recusa; --tokens sobrescreve', () => {
  item('F1', { ...semGente, etapa: 'feito', tema: 'editor', passaram: [passou(3, 'E3', T - 90 * MIN)] });
  item('F2', esperandoDesde(30));
  const sem = painel(['seguinte', lid(3), 'E3']);
  assert.equal(sem.json().pegou, false, sem.out);
  assert.match(sem.json().motivo, /contexto/i);
  transcriptDoE3(320_000);
  const alto = painel(['seguinte', lid(3), 'E3']);
  assert.equal(alto.json().pegou, false, alto.out);
  assert.match(alto.json().motivo, /contexto alto/);
  assert.equal(lerItem('F2').data.com.length, 0, 'recusado não grava');
  transcriptDoE3(100_000);
  const baixo = painel(['seguinte', lid(3), 'E3']);
  assert.equal(baixo.json().pegou, true, baixo.out);
});
test('seguinte: sem o local_, o id da própria sessão sai de CLAUDE_CODE_HOST_SESSION_ID', () => {
  item('F1', { ...semGente, etapa: 'feito', tema: 'editor', passaram: [passou(3, 'E3', T - 90 * MIN)] });
  item('F2', esperandoDesde(30));
  const r = painel(['seguinte', 'E3', '--tokens', '1000'], { env: { CLAUDE_CODE_HOST_SESSION_ID: lid(3) } });
  assert.equal(r.exit, 0, r.err);
  assert.equal(r.json().item, 'F2', r.out);
});
test('seguinte: a V que acabou de dar o veredito não repega o item de onde saiu; pega outro do mesmo tema', () => {
  const emValidacao = (extra = {}) => ({ ...semGente, etapa: 'validacao', historico: [{ em: iso(T - 20 * MIN), etapa: 'validacao', dono: null }], atualizadoEm: iso(T - 20 * MIN), ...extra });
  item('F1', emValidacao({ passaram: [passou(7, 'V1', T - 5 * MIN)] })); // a V1 passou por ele e saiu sem --fez: o item segue esperando V
  const sozinha = painel(['seguinte', lid(7), 'V1', '--tokens', '1000']);
  assert.equal(sozinha.exit, 0, sozinha.err);
  assert.equal(sozinha.json().pegou, false, sozinha.out);
  assert.equal(lerItem('F1').data.com.length, 0, 'não gravou nada no item de origem');
  item('F2', emValidacao({ historico: [{ em: iso(T - 10 * MIN), etapa: 'validacao', dono: null }] }));
  const outro = painel(['seguinte', lid(7), 'V1', '--tokens', '1000']);
  assert.equal(outro.json().item, 'F2', outro.out);
});

// ---- F170: a afinidade não se perde quando o item volta para conserto ----
const conserto = (extra = {}) => ({
  ...semGente, etapa: 'execucao', tema: 'editor',
  historico: [
    { em: iso(T - 100 * MIN), etapa: 'planejamento', dono: null }, { em: iso(T - 80 * MIN), etapa: 'execucao', dono: 'E3' },
    { em: iso(T - 50 * MIN), etapa: 'validacao', dono: null }, { em: iso(T - 20 * MIN), etapa: 'execucao', dono: null },
  ],
  atualizadoEm: iso(T - 20 * MIN), passaram: [passou(3, 'E3', T - 60 * MIN)], ...extra,
});

test('seguinte (conserto): a E que fez o item numa rodada anterior o pega quando ele volta para execução', () => {
  item('F1', conserto());
  const r = painel(['seguinte', lid(3), 'E3', '--tokens', '100000']);
  assert.equal(r.exit, 0, r.err);
  assert.equal(r.json().pegou, true, r.out);
  assert.equal(r.json().item, 'F1', r.out);
});
test('seguinte (mesma rodada): a V que saiu sem --fez não repega o item que segue em validação', () => {
  const emValidacao = { ...semGente, etapa: 'validacao', tema: 'editor', historico: [{ em: iso(T - 20 * MIN), etapa: 'validacao', dono: null }], atualizadoEm: iso(T - 20 * MIN), passaram: [passou(7, 'V3', T - 5 * MIN)] };
  item('F1', emValidacao);
  const lista = painel(['list', 'fila']);
  assert.equal(lista.json().find((x) => x.id === 'F1').esperando?.papel, 'V', 'prova: o item espera V, então só o pulo o protege');
  const r = painel(['seguinte', lid(7), 'V3', '--tokens', '1000']);
  assert.equal(r.json().pegou, false, r.out);
});
test('seguinte (revalidação): a V da 1ª rodada pega o item quando ele volta para validação', () => {
  item('F1', {
    ...semGente, etapa: 'validacao', tema: 'editor', passaram: [passou(7, 'V3', T - 40 * MIN)],
    historico: [{ em: iso(T - 60 * MIN), etapa: 'validacao', dono: null }, { em: iso(T - 30 * MIN), etapa: 'execucao', dono: 'E3' }, { em: iso(T - 10 * MIN), etapa: 'validacao', dono: null }],
    atualizadoEm: iso(T - 10 * MIN),
  });
  const r = painel(['seguinte', lid(7), 'V3', '--tokens', '1000']);
  assert.equal(r.json().pegou, true, r.out);
  assert.equal(r.json().item, 'F1', r.out);
});

test('afimDe (conserto): quem passou pelo próprio item ganha de quem passou por outro item do tema, mesmo mais recente', async () => {
  const { afimDe } = await import(pathToFileURL(join(SCRIPTS, 'batida.mjs')).href);
  const alvo = { projeto: 'kit', tema: 'editor', etapa: 'execucao', passaram: [passou(3, 'E3', T - 60 * MIN), passou(4, 'E4', T - 50 * MIN)] };
  const outro = { projeto: 'kit', tema: 'editor', etapa: 'feito', passaram: [passou(5, 'E5', T - 10 * MIN)] };
  const mapa = new Map([['F1', alvo], ['F2', outro]]);
  const projetoDe = () => 'kit';
  const vivas = [sessao(3, 'E3 · tela'), sessao(4, 'E4 · tela'), sessao(5, 'E5 · tela')];
  assert.equal(afimDe(alvo, 'E', mapa, vivas, projetoDe)?.localId, lid(4), 'o mais recente do próprio item');
  assert.equal(afimDe(alvo, 'E', mapa, [sessao(3, 'E3 · tela'), sessao(4, 'E4 · tela', { isArchived: true }), sessao(5, 'E5 · tela')], projetoDe)?.localId, lid(3), 'morta cai para a seguinte do próprio item');
  assert.equal(afimDe(alvo, 'E', mapa, [sessao(5, 'E5 · tela')], projetoDe)?.localId, lid(5), 'sem ninguém vivo do próprio item, segue a regra dos outros itens');
});

test('batida (conserto): o aviso do item que voltou para execução vai à E que o fez, não ao livre mais antigo', () => {
  item('F1', conserto());
  const arq = sessoes(sessao(1, 'E1 · livre', { lastActivityAt: iso(T - 200 * MIN) }), sessao(2, 'E2 · livre', { lastActivityAt: iso(T - 150 * MIN) }), sessao(3, 'E3 · livre', { lastActivityAt: iso(T - 30 * MIN) }));
  const r = batida(arq);
  assert.deepEqual(msgs(r, 'avisar-livre').map((m) => m.para), [lid(3)], r.out);
});

// ADR 0011: no modelo da dona a batida não avisa livre nem conta piso; o item sem ninguém vira vaga de dona.
test('batida (dona): esperando sem ninguém → vaga "dona", sem aviso ao livre nem piso de E (contraste no pool)', () => {
  item('F1', esperandoE());
  const arq = sessoes(sessao(1, 'E1 · livre'));
  assert.equal(msgs(batida(arq), 'avisar-livre').length, 1, 'prova: no pool o livre é avisado');
  const antes = process.env.KIT_MODELO;
  process.env.KIT_MODELO = 'dona';
  try {
    const r = batida(sessoes(sessao(1, 'E1 · livre')), T + 40 * MIN);
    assert.deepEqual(msgs(r, 'avisar-livre'), []);
    const vagas = r.json().projetos.kit.vagas;
    assert.ok(vagas.some((v) => v.papel === 'dona' && v.item === 'F1'), r.out);
    assert.ok(!vagas.some((v) => v.piso), 'sem piso de E');
  } finally { process.env.KIT_MODELO = antes; }
});
