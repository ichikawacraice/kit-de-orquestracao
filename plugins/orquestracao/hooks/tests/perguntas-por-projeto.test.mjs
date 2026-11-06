// F183: projeto num nome só e perguntas fechadas fora da pasta quente. Nunca toca ~/.claude real:
// HOME, PAINEL_DIR e POOL_APP_SESSOES_DIR são pastas temporárias; o projeto é um repositório git de mentira.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acharPergunta, caminhoNoArquivo, fechadasRecentes, mesDe, slugDoProjeto } from '../../skills/orquestradora/scripts/perguntas-arquivo.mjs';
import { perguntasDaSessao } from '../perguntas-da-sessao.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const PAINEL = join(AQUI, '..', '..', 'skills', 'orquestradora', 'scripts', 'painel.mjs');
const LOCAL = (n) => `local_00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

let base; let repo; let outro;
const pasta = () => join(base, 'painel', 'perguntas');
const quente = (id) => join(pasta(), `${id}.json`);
const noArquivo = (projeto, mes, id) => join(pasta(), 'arquivo', projeto, mes, `${id}.json`);
const lerJson = (f) => JSON.parse(readFileSync(f, 'utf8'));

function criarRepo(nome) {
  const d = join(base, 'repos', nome);
  mkdirSync(d, { recursive: true });
  const r = spawnSync('git', ['init', '-q', d], { encoding: 'utf8', timeout: 20000, killSignal: 'SIGKILL' });
  assert.equal(r.status, 0, `git init: ${r.stderr}`);
  return d;
}
beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'perg-projeto-'));
  for (const d of ['painel/perguntas', 'painel/sessoes', 'painel/fila', 'home', 'app', 'orq']) mkdirSync(join(base, d), { recursive: true });
  writeFileSync(join(base, 'painel', 'temas.json'), '[]');
  repo = criarRepo('Meu_Repo');
  outro = criarRepo('outro');
});
afterEach(() => { rmSync(base, { recursive: true, force: true }); });

function painel(args, { cwd = repo } = {}) {
  const r = spawnSync('node', [PAINEL, ...args], {
    encoding: 'utf8', timeout: 30000, killSignal: 'SIGKILL', cwd,
    env: { ...process.env, PAINEL_DIR: join(base, 'painel'), HOME: join(base, 'home'), CLAUDE_CODE_SESSION_ID: '', POOL_APP_SESSOES_DIR: join(base, 'app'), HOOKS_CREWAI_BASE: join(base, 'orq'), KIT_ORCA_BIN: 'off' }, // F444: nunca o orca real
  });
  if (r.error) throw r.error;
  return { exit: r.status, out: r.stdout, err: r.stderr, json: () => JSON.parse(r.stdout) };
}
function pergunta(id, data, dir = pasta()) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${id}.json`), `${JSON.stringify({ id, version: 1, data })}\n`);
}
const ids = (lista) => lista.map((d) => d.id).sort();

// ---- o slug e o lugar no arquivo ----
test('slugDoProjeto: minúsculo, [a-z0-9-], sem traço nas pontas; vazio vira null', () => {
  assert.equal(slugDoProjeto('Alfa'), 'alfa');
  assert.equal(slugDoProjeto('Meu_Repo.git'), 'meu-repo-git');
  assert.equal(slugDoProjeto('  kit-de-orquestracao '), 'kit-de-orquestracao');
  assert.equal(slugDoProjeto('Loja Azul IA'), 'loja-azul-ia');
  assert.equal(slugDoProjeto('__'), null);
  assert.equal(slugDoProjeto(undefined), null);
});

test('mesDe usa o horário de São Paulo e a data da resposta antes das outras', () => {
  assert.equal(mesDe({ respondidaEm: '2026-11-01T01:00:00Z', atualizadoEm: '2026-11-05T12:00:00Z' }), '2026-10', '01:00 UTC de 1/11 ainda é 31/10 em SP');
  assert.equal(mesDe({ atualizadoEm: '2026-11-05T12:00:00Z' }), '2026-11');
  assert.equal(mesDe({ criadaEm: '2026-09-30T12:00:00Z' }), '2026-09');
  assert.match(mesDe({}, Date.parse('2026-12-10T12:00:00Z')), /^2026-12$/, 'sem data, o relógio');
});

test('caminhoNoArquivo: projeto em slug, sem projeto vai para sem-projeto', () => {
  assert.equal(caminhoNoArquivo('/p', 'Q1', { projeto: 'Alfa', respondidaEm: '2026-10-20T12:00:00Z' }), join('/p', 'arquivo', 'alfa', '2026-10', 'Q1.json'));
  assert.equal(caminhoNoArquivo('/p', 'Q1', { respondidaEm: '2026-10-20T12:00:00Z' }), join('/p', 'arquivo', 'sem-projeto', '2026-10', 'Q1.json'));
});

test('acharPergunta: a quente primeiro, depois o arquivo; ausente = null', () => {
  pergunta('Q1', { estado: 'aberta' });
  pergunta('Q2', { estado: 'respondida' }, join(pasta(), 'arquivo', 'alfa', '2026-10'));
  assert.equal(acharPergunta(pasta(), 'Q1'), quente('Q1'));
  assert.equal(acharPergunta(pasta(), 'Q2'), noArquivo('alfa', '2026-10', 'Q2'));
  assert.equal(acharPergunta(pasta(), 'Q3'), null);
});

// ---- escrita: projeto num nome só ----
test('gravar projeto fora do slug é recusado e nada é gravado', () => {
  const r = painel(['set', 'perguntas', 'Q1', JSON.stringify({ estado: 'aberta', sessaoId: LOCAL(1), projeto: 'Alfa' })]);
  assert.equal(r.exit, 1, r.out);
  assert.match(r.err, /projeto "Alfa".*alfa/);
  assert.ok(!existsSync(quente('Q1')));
  const s = painel(['set', 'sessoes', LOCAL(2), JSON.stringify({ estado: 'parada', projeto: 'Kit De' })]);
  assert.equal(s.exit, 1, 'vale para todas as coleções');
});

test('pergunta nova sem projeto ganha o slug da raiz do git', () => {
  const r = painel(['set', 'perguntas', 'Q1', JSON.stringify({ estado: 'aberta', sessaoId: LOCAL(1), titulo: 't' })]);
  assert.equal(r.exit, 0, r.err);
  assert.equal(lerJson(quente('Q1')).data.projeto, 'meu-repo');
});

test('update de documento antigo com projeto em caixa alta, sem mexer no projeto, não é recusado', () => {
  pergunta('Q1', { estado: 'assumida', sessaoId: LOCAL(1), projeto: 'Alfa' });
  const r = painel(['update', 'perguntas', 'Q1', '{"nota":"x"}']);
  assert.equal(r.exit, 0, r.err);
});

// ---- a pasta quente ----
test('fechar pela painel move para o arquivo; reabrir traz de volta; get acha nos dois lugares', () => {
  pergunta('Q1', { estado: 'aberta', sessaoId: LOCAL(1), projeto: 'alfa', titulo: 't' });
  const r = painel(['update', 'perguntas', 'Q1', JSON.stringify({ estado: 'respondida', resposta: 'sim', atualizadoEm: '2026-10-20T15:00:00Z' })]);
  assert.equal(r.exit, 0, r.err);
  assert.ok(!existsSync(quente('Q1')), 'saiu da pasta quente');
  const arq = noArquivo('alfa', '2026-10', 'Q1');
  assert.ok(existsSync(arq), 'foi para o arquivo do projeto e do mês');
  assert.equal(lerJson(arq).version, 2);
  assert.equal(painel(['get', 'perguntas', 'Q1']).json().data.resposta, 'sim');
  const v = painel(['update', 'perguntas', 'Q1', '{"estado":"aberta"}']);
  assert.equal(v.exit, 0, v.err);
  assert.ok(existsSync(quente('Q1')) && !existsSync(arq), 'reaberta volta à pasta quente e some do arquivo');
  assert.equal(lerJson(quente('Q1')).version, 3);
});

test('assumida fica na pasta quente', () => {
  const r = painel(['set', 'perguntas', 'Q1', JSON.stringify({ estado: 'assumida', sessaoId: LOCAL(1), titulo: 't', recomendacao: 'r' })]);
  assert.equal(r.exit, 0, r.err);
  assert.ok(existsSync(quente('Q1')));
});

test('delete apaga a pergunta onde ela estiver', () => {
  pergunta('Q2', { estado: 'respondida', projeto: 'alfa' }, join(pasta(), 'arquivo', 'alfa', '2026-10'));
  assert.equal(painel(['delete', 'perguntas', 'Q2']).exit, 0);
  assert.equal(acharPergunta(pasta(), 'Q2'), null);
});

test('list perguntas: o projeto da pasta atual e só a pasta quente; --todos, --projeto e o filtro fechado abrem o resto', () => {
  pergunta('Q1', { estado: 'aberta', sessaoId: LOCAL(1), projeto: 'meu-repo' });
  pergunta('Q2', { estado: 'aberta', sessaoId: LOCAL(1), projeto: 'outro' });
  pergunta('Q3', { estado: 'aberta', sessaoId: LOCAL(1) });
  pergunta('Q4', { estado: 'respondida', projeto: 'meu-repo' }, join(pasta(), 'arquivo', 'meu-repo', '2026-10'));
  pergunta('Q5', { estado: 'respondida', projeto: 'outro' }, join(pasta(), 'arquivo', 'outro', '2026-10'));
  assert.deepEqual(ids(painel(['list', 'perguntas']).json()), ['Q1'], 'só o projeto da pasta, sem o sem-projeto, sem o arquivo');
  assert.deepEqual(ids(painel(['list', 'perguntas', '--todos']).json()), ['Q1', 'Q2', 'Q3']);
  assert.deepEqual(ids(painel(['list', 'perguntas', '--projeto', 'outro']).json()), ['Q2']);
  assert.deepEqual(ids(painel(['list', 'perguntas', 'respondida']).json()), ['Q4'], 'o filtro fechado lê o arquivo do projeto');
  assert.deepEqual(ids(painel(['list', 'perguntas', '--arquivo', '--todos']).json()), ['Q1', 'Q2', 'Q3', 'Q4', 'Q5']);
  assert.deepEqual(ids(painel(['list', 'perguntas', 'aberta', '--sessao', LOCAL(1)]).json()), ['Q1', 'Q2', 'Q3'], '--sessao já identifica: não filtra por projeto');
});

test('perguntas arquivar: --seco só conta; sem ele leva as fechadas da pasta quente (a resposta gravada pelo pane)', () => {
  pergunta('Q1', { estado: 'respondida', projeto: 'alfa', respondidaPor: 'painel', respondidaEm: '2026-10-20T15:00:00Z' });
  pergunta('Q2', { estado: 'cancelada', atualizadoEm: '2026-09-02T15:00:00Z' });
  pergunta('Q3', { estado: 'aberta', sessaoId: LOCAL(1) });
  pergunta('Q4', { estado: 'assumida', sessaoId: LOCAL(1) });
  const seco = painel(['perguntas', 'arquivar', '--seco']);
  assert.equal(seco.exit, 0, seco.err);
  assert.deepEqual(seco.json().arquivadas.sort(), ['Q1', 'Q2']);
  assert.ok(existsSync(quente('Q1')), '--seco não move');
  const r = painel(['perguntas', 'arquivar']);
  assert.equal(r.exit, 0, r.err);
  assert.ok(existsSync(noArquivo('alfa', '2026-10', 'Q1')) && !existsSync(quente('Q1')));
  assert.ok(existsSync(noArquivo('sem-projeto', '2026-09', 'Q2')));
  assert.equal(lerJson(noArquivo('alfa', '2026-10', 'Q1')).data.respondidaPor, 'painel', 'move sem mexer no conteúdo');
  assert.deepEqual(readdirSync(pasta()).filter((n) => n.endsWith('.json')).sort(), ['Q3.json', 'Q4.json']);
});

// ---- migração única ----
function registro(n, cwd) {
  writeFileSync(join(base, 'app', `local_${n}.json`), JSON.stringify({ sessionId: LOCAL(n), cliSessionId: `cli-${n}`, title: 't', cwd, originCwd: cwd }));
}
test('perguntas migrar: --seco não grava; depois, backup, slug, projeto pela sessão e o resto em sem-projeto', () => {
  pergunta('Q1', { estado: 'aberta', sessaoId: LOCAL(1), projeto: 'Alfa' });
  pergunta('Q2', { estado: 'respondida', sessaoId: LOCAL(2), respondidaEm: '2026-10-20T15:00:00Z' });
  pergunta('Q3', { estado: 'assumida', sessaoId: LOCAL(3) });
  pergunta('Q4', { estado: 'respondida', atualizadoEm: '2026-10-21T15:00:00Z' });
  pergunta('Q5', { estado: 'assumida', sessao: LOCAL(2) });
  writeFileSync(join(base, 'painel', 'sessoes', `${LOCAL(2)}.json`), JSON.stringify({ id: LOCAL(2), version: 1, data: { sessionId: LOCAL(2), projeto: 'Beta' } }));
  writeFileSync(join(base, 'painel', 'sessoes', `${LOCAL(9)}.json`), JSON.stringify({ id: LOCAL(9), version: 1, data: { sessionId: LOCAL(9) } }));
  registro(3, outro);

  const seco = painel(['perguntas', 'migrar', '--seco']);
  assert.equal(seco.exit, 0, seco.err);
  const s = seco.json();
  assert.equal(s.seco, true);
  assert.deepEqual(s.projeto, { Q1: 'alfa', Q2: 'beta', Q3: 'outro', Q4: 'sem-projeto', Q5: 'beta', [`sessoes/${LOCAL(2)}`]: 'beta', [`sessoes/${LOCAL(9)}`]: 'sem-projeto' });
  assert.deepEqual(s.arquivadas.sort(), ['Q2', 'Q4']);
  assert.equal(lerJson(quente('Q1')).data.projeto, 'Alfa', '--seco não grava');
  assert.ok(!existsSync(join(base, 'backups')), '--seco não faz backup');

  const r = painel(['perguntas', 'migrar']);
  assert.equal(r.exit, 0, r.err);
  const feito = r.json();
  assert.ok(feito.backup && existsSync(join(feito.backup, 'perguntas', 'Q1.json')), 'o backup tem o estado de antes');
  assert.equal(lerJson(join(feito.backup, 'perguntas', 'Q1.json')).data.projeto, 'Alfa');
  assert.equal(lerJson(quente('Q1')).data.projeto, 'alfa');
  assert.equal(lerJson(quente('Q1')).version, 2, 'mudou o conteúdo, sobe a versão');
  assert.equal(lerJson(quente('Q3')).data.projeto, 'outro');
  assert.equal(lerJson(noArquivo('beta', '2026-10', 'Q2')).data.projeto, 'beta');
  assert.ok(existsSync(noArquivo('sem-projeto', '2026-10', 'Q4')));
  assert.equal(lerJson(join(base, 'painel', 'sessoes', `${LOCAL(9)}.json`)).data.projeto, 'sem-projeto');

  const de_novo = painel(['perguntas', 'migrar', '--seco']).json();
  assert.deepEqual([de_novo.projeto, de_novo.arquivadas], [{}, []], 'a segunda passada não tem o que fazer');
});

// ---- leitores do arquivo ----
test('perguntasDaSessao lê a respondida recente no arquivo e pula o arquivo velho', () => {
  const agora = Date.parse('2026-10-26T12:00:00Z');
  pergunta('Q1', { estado: 'respondida', sessaoId: 'A', resposta: 'sim', respondidaEm: '2026-10-26T10:00:00Z' }, join(pasta(), 'arquivo', 'alfa', '2026-10'));
  pergunta('Q2', { estado: 'respondida', sessaoId: 'A', resposta: 'não', respondidaEm: '2026-10-20T10:00:00Z' }, join(pasta(), 'arquivo', 'alfa', '2026-10'));
  utimesSync(join(pasta(), 'arquivo', 'alfa', '2026-10', 'Q2.json'), new Date('2026-10-20T10:00:00Z'), new Date('2026-10-20T10:00:00Z'));
  pergunta('Q3', { estado: 'aberta', sessaoId: 'A' });
  const r = perguntasDaSessao('A', { dir: pasta(), agora });
  assert.deepEqual(r.abertas.map((p) => p.id), ['Q3']);
  assert.deepEqual(r.respondidas.map((p) => p.id), ['Q1']);
});

test('fechadasRecentes: só o arquivo mudado no período, de todos os projetos', () => {
  const agora = Date.now();
  pergunta('Q1', { estado: 'respondida' }, join(pasta(), 'arquivo', 'a', '2026-10'));
  pergunta('Q2', { estado: 'respondida' }, join(pasta(), 'arquivo', 'b', '2026-10'));
  pergunta('Q3', { estado: 'respondida' }, join(pasta(), 'arquivo', 'b', '2026-09'));
  utimesSync(join(pasta(), 'arquivo', 'b', '2026-09', 'Q3.json'), new Date(agora - 3 * 86_400_000), new Date(agora - 3 * 86_400_000));
  assert.deepEqual(fechadasRecentes(pasta(), { desdeMs: agora - 86_400_000 }).map((f) => f.split('/').pop()).sort(), ['Q1.json', 'Q2.json']);
});

test('com migração pendente a batida não arquiva; depois dela, leva a resposta que o pane deixou na pasta quente (--seco não)', () => {
  pergunta('Q1', { estado: 'respondida', projeto: 'Alfa', respondidaPor: 'painel', respondidaEm: '2026-10-20T15:00:00Z' });
  const lista = join(base, 'sessoes.json');
  writeFileSync(lista, '[]');
  const antes = painel(['batida', '--sessoes', lista]);
  assert.equal(antes.exit, 0, antes.err);
  assert.deepEqual(antes.json().perguntasArquivadas, [], 'sem a migração (o ok do operador), a batida não move o estado real');
  assert.ok(existsSync(quente('Q1')));
  assert.equal(painel(['perguntas', 'migrar']).exit, 0);
  pergunta('Q2', { estado: 'respondida', projeto: 'alfa', respondidaPor: 'painel', respondidaEm: '2026-10-21T15:00:00Z' });
  const seco = painel(['batida', '--sessoes', lista, '--seco']);
  assert.equal(seco.exit, 0, seco.err);
  assert.ok(existsSync(quente('Q2')), 'a presença seria detectada: --seco deixa onde está');
  const r = painel(['batida', '--sessoes', lista]);
  assert.equal(r.exit, 0, r.err);
  assert.deepEqual(r.json().perguntasArquivadas, ['Q2']);
  assert.ok(!existsSync(quente('Q2')) && existsSync(noArquivo('alfa', '2026-10', 'Q2')));
});

test('a migração também conserta a pergunta que já estava no arquivo (arquivar antes de migrar)', () => {
  pergunta('Q2', { estado: 'respondida', sessaoId: LOCAL(2), respondidaEm: '2026-10-20T15:00:00Z' });
  pergunta('Q7', { estado: 'respondida', projeto: 'Alfa', respondidaEm: '2026-10-20T15:00:00Z' });
  writeFileSync(join(base, 'painel', 'sessoes', `${LOCAL(2)}.json`), JSON.stringify({ id: LOCAL(2), version: 1, data: { sessionId: LOCAL(2), projeto: 'beta' } }));
  assert.equal(painel(['perguntas', 'arquivar']).exit, 0);
  assert.ok(existsSync(noArquivo('sem-projeto', '2026-10', 'Q2')), 'precondição: arquivada sem o projeto da sessão');
  assert.equal(lerJson(noArquivo('alfa', '2026-10', 'Q7')).data.projeto, 'Alfa', 'precondição: arquivada com a caixa de antes');
  const seco = painel(['perguntas', 'migrar', '--seco']).json();
  assert.deepEqual(seco.projeto, { Q2: 'beta', Q7: 'alfa' });
  assert.equal(painel(['perguntas', 'migrar']).exit, 0);
  assert.ok(existsSync(noArquivo('beta', '2026-10', 'Q2')) && !existsSync(noArquivo('sem-projeto', '2026-10', 'Q2')), 'mudou de pasta com o projeto');
  assert.equal(lerJson(noArquivo('alfa', '2026-10', 'Q7')).data.projeto, 'alfa');
  assert.deepEqual(ids(painel(['list', 'perguntas', 'respondida', '--projeto', 'beta']).json()), ['Q2']);
});

test('--projeto sem-projeto lista quem não tem o campo; delete leva as duas cópias da corrida com o pane', () => {
  pergunta('Q3', { estado: 'aberta', sessaoId: LOCAL(1) });
  pergunta('Q4', { estado: 'aberta', sessaoId: LOCAL(1), projeto: 'outro' });
  assert.deepEqual(ids(painel(['list', 'perguntas', '--projeto', 'sem-projeto']).json()), ['Q3']);
  pergunta('Q5', { estado: 'respondida', projeto: 'alfa' });
  pergunta('Q5', { estado: 'respondida', projeto: 'alfa' }, join(pasta(), 'arquivo', 'alfa', '2026-10'));
  assert.equal(painel(['delete', 'perguntas', 'Q5']).exit, 0);
  assert.equal(acharPergunta(pasta(), 'Q5'), null);
});

test('ehDaOrquestradora compara pelo mesmo slug do painel', async () => {
  const { ehDaOrquestradora } = await import('../../skills/orquestradora/scripts/batida.mjs');
  assert.equal(ehDaOrquestradora('🎛 orquestradora — Loja Azul IA', 'loja-azul-ia'), true);
  assert.equal(ehDaOrquestradora('🎛 orquestradora — Alfa', 'alfa'), true);
  assert.equal(ehDaOrquestradora('🎛 orquestradora — Alfa', 'outro'), false);
});

test('painel novo, sem nada a migrar: a primeira batida grava a marca e já arquiva', () => {
  pergunta('Q1', { estado: 'respondida', projeto: 'alfa', respondidaEm: '2026-10-20T15:00:00Z' });
  const lista = join(base, 'sessoes.json');
  writeFileSync(lista, '[]');
  const r = painel(['batida', '--sessoes', lista]);
  assert.equal(r.exit, 0, r.err);
  assert.deepEqual(r.json().perguntasArquivadas, ['Q1']);
  assert.ok(existsSync(join(base, 'painel', '.migracao-F183')));
});

test('migração com a mesma pergunta na pasta quente e no arquivo: fica a de versão maior, a outra sai', () => {
  writeFileSync(quente('Q5'), JSON.stringify({ id: 'Q5', version: 3, data: { estado: 'respondida', projeto: 'Alfa', resposta: 'PANE-NOVA', respondidaEm: '2026-10-20T15:00:00Z' } }));
  mkdirSync(join(pasta(), 'arquivo', 'alfa', '2026-10'), { recursive: true });
  writeFileSync(noArquivo('alfa', '2026-10', 'Q5'), JSON.stringify({ id: 'Q5', version: 2, data: { estado: 'respondida', projeto: 'Alfa', resposta: 'PAINEL-VELHA', respondidaEm: '2026-10-20T15:00:00Z' } }));
  const lista = join(base, 'sessoes.json');
  writeFileSync(lista, '[]');
  assert.deepEqual(painel(['batida', '--sessoes', lista]).json().perguntasArquivadas, [], 'com o que migrar, a batida espera');
  const seco = painel(['perguntas', 'migrar', '--seco']).json();
  assert.equal(seco.duplicadas.length, 1);
  const r = painel(['perguntas', 'migrar']);
  assert.equal(r.exit, 0, r.err);
  assert.ok(!existsSync(quente('Q5')));
  const ficou = lerJson(noArquivo('alfa', '2026-10', 'Q5'));
  assert.equal(ficou.data.resposta, 'PANE-NOVA');
  assert.equal(ficou.data.projeto, 'alfa');
});

test('projeto null conta como ausente: a batida espera a migração', () => {
  pergunta('Q1', { estado: 'respondida', projeto: null, respondidaEm: '2026-10-20T15:00:00Z' });
  const lista = join(base, 'sessoes.json');
  writeFileSync(lista, '[]');
  assert.deepEqual(painel(['batida', '--sessoes', lista]).json().perguntasArquivadas, []);
  assert.deepEqual(painel(['perguntas', 'migrar', '--seco']).json().projeto, { Q1: 'sem-projeto' });
});
