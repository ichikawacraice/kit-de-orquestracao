// F479: `painel orquestradora retomar F<n> --dispatch <ctx novo>`. No Orca, a dona que para por limite de uso (ou troca de
// sessão por contexto cheio) termina `stopped/failed`; a orquestradora abre outra sessão na mesma worktree, e o item tem de
// passar a ela: `donoLocalId`, o `com` e o `sessaoId` das perguntas que esperam resposta. Sem isso, a aba pinta "Sessão
// falhou" e a resposta dada na aba vai à sessão morta.
// HOME, HOOKS_CREWAI_BASE e PAINEL_DIR são pastas temporárias; o `orca` é falso.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { orcaFalso, recibo, worker } from './orca-falso.mjs';

const HOOKS = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAINEL = join(HOOKS, '..', 'skills', 'orquestradora', 'scripts', 'painel.mjs');
const VELHA = 'orca_session_id:dona-velha';
const NOVA = 'orca_session_id:dona-nova';

let base; let repo; let pasta;
const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 20000, killSignal: 'SIGKILL' });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
const envBase = (extra = {}) => ({
  ...process.env, HOME: join(base, 'home'), HOOKS_CREWAI_BASE: join(base, 'orq'), PAINEL_DIR: join(base, 'painel'),
  POOL_APP_SESSOES_DIR: join(base, 'app'), CLAUDE_CODE_HOST_SESSION_ID: '', ORCA_TERMINAL_HANDLE: '', KIT_ORCA_BIN: 'off',
  KIT_ANFITRIAO: 'orca', ORCA_AGENT_SESSION_ID: 'orq-do-orca', CLAUDE_CODE_SESSION_ID: 'cli-orq', KIT_ESTADO_DEDUZIDO: 'off',
  CLAUDE_CONFIG_DIR: join(base, 'cfg'), ...extra,
});
const json = (s) => { try { return JSON.parse(s); } catch { return null; } };
function painel(args, env = {}) {
  const r = spawnSync('node', [PAINEL, ...args], { cwd: repo, encoding: 'utf8', timeout: 60000, killSignal: 'SIGKILL', env: envBase(env) });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, json: json(r.stdout) };
}
const lerDoc = (colecao, id) => JSON.parse(readFileSync(join(base, 'painel', colecao, `${id}.json`), 'utf8'));
const gravarDoc = (colecao, id, data) => writeFileSync(join(base, 'painel', colecao, `${id}.json`), JSON.stringify({ id, version: 1, data }));
const registro = (orcaId, terminal, cwd) => {
  mkdirSync(join(base, 'orq', 'orca-sessoes'), { recursive: true });
  writeFileSync(join(base, 'orq', 'orca-sessoes', `${orcaId.split(':')[1]}.json`), JSON.stringify({
    orcaId, cliAtual: `cli-${orcaId.split(':')[1]}`, cliIds: [`cli-${orcaId.split(':')[1]}`], terminal, enderecoDoSend: orcaId, cwd, em: new Date().toISOString(),
  }));
};

beforeEach(() => {
  base = realpathSync(mkdtempSync(join(tmpdir(), 'orq-retomar-')));
  for (const d of ['home', 'orq/ativas', 'app', 'painel/fila', 'painel/perguntas']) mkdirSync(join(base, d), { recursive: true });
  const origin = join(base, 'origin.git');
  git(base, 'init', '-q', '--bare', '-b', 'main', origin);
  repo = join(base, 'kit');
  git(base, 'clone', '-q', origin, repo);
  git(repo, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'raiz');
  git(repo, 'push', '-q', 'origin', 'HEAD:main');
  pasta = join(base, 'wt-f7');
  git(repo, 'worktree', 'add', '-q', '-b', 'f7-tema', pasta);
});
afterEach(() => rmSync(base, { recursive: true, force: true }));

// A dona velha bateu o limite (despacho stopped/failed, terminal solto); a nova está viva na mesma worktree e já se registrou.
// Perguntas: Q6 aberta e Q7 assumida da velha (passam), Q8 respondida da velha e Q9 aberta de outra sessão (ficam).
function cenario({ velho = {}, novo = {}, item = {}, registroDaNova = true, registroDaVelha = pasta, workersExtra = [], outros, branchDaWorktree } = {}) {
  if (branchDaWorktree) git(pasta, 'branch', '-m', branchDaWorktree);
  const wVelho = worker(pasta, 'released', { dispatchId: 'ctx_velho', state: 'stopped', outcome: 'failed', liveness: 'exited', terminal: 'structworker_velho', ...velho });
  const wNovo = worker(pasta, 'active', { dispatchId: 'ctx_novo', state: 'ready', outcome: 'in_progress', terminal: 'structworker_novo', ...novo });
  const orca = orcaFalso({ '': recibo([wVelho, wNovo, ...(typeof workersExtra === 'function' ? workersExtra() : workersExtra)]), ...(outros ? { outros } : {}) });
  if (registroDaVelha) registro(VELHA, 'structworker_velho', registroDaVelha);
  if (registroDaNova) registro(NOVA, 'structworker_novo', pasta);
  gravarDoc('fila', 'F7', {
    titulo: 'tema', tema: 'processos', etapa: 'execucao', projeto: 'kit', branch: 'f7-tema', donoLocalId: VELHA, donoApelido: 'dona',
    com: [{ localId: VELHA, apelido: 'dona', oQue: 'faz o tema' }], sessoes: [VELHA], ...item,
  });
  gravarDoc('perguntas', 'Q6', { estado: 'aberta', item: 'F7', titulo: 'F7 decide', sessaoId: VELHA, endereco: { orca: VELHA }, projeto: 'kit' });
  gravarDoc('perguntas', 'Q7', { estado: 'assumida', item: 'F7', titulo: 'F7 assumida', sessaoId: VELHA, endereco: { orca: VELHA }, projeto: 'kit' });
  gravarDoc('perguntas', 'Q8', { estado: 'respondida', item: 'F7', titulo: 'F7 já foi', sessaoId: VELHA, projeto: 'kit', resposta: 'sim' });
  gravarDoc('perguntas', 'Q9', { estado: 'aberta', item: 'F9', titulo: 'F9 outra', sessaoId: 'orca_session_id:outra', endereco: { orca: 'orca_session_id:outra' }, projeto: 'kit' });
  const mutantes = () => orca.chamadas().map((c) => c.argv).filter((a) => a.slice(0, 2).join(' ') !== 'orchestration worker-list');
  return { env: orca.env, orca, mutantes };
}
const retomar = (c, extra = []) => painel(['orquestradora', 'retomar', 'F7', '--dispatch', 'ctx_novo', '--esperar', '0', ...extra], c.env);

test('(retomar-1) passa o item à sessão nova: dona, com, sessões e as perguntas que esperam resposta; confere lendo de volta', () => {
  const c = cenario();
  assert.equal(lerDoc('perguntas', 'Q6').data.sessaoId, VELHA, 'prova: antes, a pergunta é da velha');
  const r = retomar(c);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const d = lerDoc('fila', 'F7').data;
  assert.equal(d.donoLocalId, NOVA);
  assert.equal(d.donoApelido, 'dona');
  assert.deepEqual(d.com, [{ localId: NOVA, apelido: 'dona', oQue: 'faz o tema' }]);
  assert.ok(d.sessoes.includes(VELHA) && d.sessoes.includes(NOVA), 'as duas contam no custo do item');
  for (const q of ['Q6', 'Q7']) {
    const p = lerDoc('perguntas', q).data;
    assert.equal(p.sessaoId, NOVA, `${q} passa`);
    assert.deepEqual(p.endereco, { orca: NOVA }, `${q}: a resposta da aba vai à nova`);
  }
  assert.equal(lerDoc('perguntas', 'Q8').data.sessaoId, VELHA, 'a respondida fica');
  assert.equal(lerDoc('perguntas', 'Q9').data.sessaoId, 'orca_session_id:outra', 'a de outra sessão fica');
  assert.equal(r.json?.conferido, true);
  assert.equal(r.json?.para, NOVA);
  assert.deepEqual(r.json?.de, [VELHA]);
  assert.deepEqual(r.json?.perguntas, ['Q6', 'Q7']);
  assert.deepEqual(c.mutantes(), [], 'o despacho velho já estava solto: nada a soltar');
});

test('(retomar-2) solta o despacho velho parado que ficou com o terminal preso; nunca o novo', () => {
  const c = cenario({ velho: { terminalState: 'retained' } });
  const r = retomar(c);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.deepEqual(c.mutantes(), [['orchestration', 'worker-release', '--dispatch', 'ctx_velho', '--json']]);
  assert.deepEqual(r.json?.liberados, ['ctx_velho']);
});

test('(retomar-3) --seco diz o que faria e não grava nem chama o orca', () => {
  const c = cenario({ velho: { terminalState: 'retained' } });
  const antes = readFileSync(join(base, 'painel', 'fila', 'F7.json'), 'utf8');
  const r = retomar(c, ['--seco']);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(r.json?.seco, true);
  assert.equal(r.json?.para, NOVA);
  assert.deepEqual(r.json?.perguntas, ['Q6', 'Q7']);
  assert.deepEqual(r.json?.liberaria, ['ctx_velho']);
  assert.equal(readFileSync(join(base, 'painel', 'fila', 'F7.json'), 'utf8'), antes);
  assert.equal(lerDoc('perguntas', 'Q6').data.sessaoId, VELHA);
  assert.deepEqual(c.mutantes(), []);
});

test('(retomar-4) rodar de novo não muda nada e confere', () => {
  const c = cenario();
  assert.equal(retomar(c).status, 0);
  const depois = readFileSync(join(base, 'painel', 'fila', 'F7.json'), 'utf8');
  const r = retomar(c);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(r.json?.conferido, true);
  assert.deepEqual(r.json?.perguntas, []);
  assert.deepEqual(r.json?.de, []);
  assert.equal(JSON.parse(readFileSync(join(base, 'painel', 'fila', 'F7.json'), 'utf8')).data.donoLocalId, JSON.parse(depois).data.donoLocalId);
});

test('(retomar-5) o item acha a worktree pela branch quando a dona velha não tem registro; quem está no com em outra worktree fica', () => {
  const c = cenario({
    registroDaVelha: null,
    item: { com: [{ localId: VELHA, apelido: 'dona', oQue: 'faz o tema' }, { localId: 'orca_session_id:ajuda', apelido: 'revisora', oQue: 'revisa' }] },
  });
  registro('orca_session_id:ajuda', 'structworker_ajuda', join(base, 'outra'));
  const r = retomar(c);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const d = lerDoc('fila', 'F7').data;
  assert.equal(d.donoLocalId, NOVA);
  assert.deepEqual(d.com.map((x) => x.localId).sort(), [NOVA, 'orca_session_id:ajuda'].sort());
});

// O formato real (medido em 06/11 nos F476-F478): o item não tem `branch`, e o limpador apaga o registro da sessão cujo terminal
// foi solto. O item se liga à worktree pela branch dela (`f<n>-…`), e quem sai se acha no item, sem registro.
test('(retomar-8) sem registro da velha e sem `branch` no item: liga pela branch da worktree (f7-…) e passa tudo', () => {
  const c = cenario({ registroDaVelha: null, item: { branch: undefined } });
  assert.equal(lerDoc('fila', 'F7').data.branch, undefined, 'prova: o item não tem branch');
  const r = retomar(c);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const d = lerDoc('fila', 'F7').data;
  assert.equal(d.donoLocalId, NOVA);
  assert.deepEqual(d.com, [{ localId: NOVA, apelido: 'dona', oQue: 'faz o tema' }]);
  assert.deepEqual(r.json?.perguntas, ['Q6', 'Q7']);
  assert.deepEqual(lerDoc('perguntas', 'Q6').data.endereco, { orca: NOVA });
});

test('(retomar-9) item que a batida já soltou (sem dona, com vazio): as sessões de `sessoes` saem e as perguntas passam', () => {
  const c = cenario({ registroDaVelha: null, item: { branch: undefined, donoLocalId: null, donoApelido: null, com: [] } });
  const r = retomar(c);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const d = lerDoc('fila', 'F7').data;
  assert.equal(d.donoLocalId, NOVA);
  assert.deepEqual(d.com, [{ localId: NOVA, apelido: 'dona', oQue: 'tema' }]);
  assert.deepEqual(r.json?.de, [VELHA]);
  assert.deepEqual(r.json?.perguntas, ['Q6', 'Q7']);
  assert.equal(lerDoc('perguntas', 'Q7').data.sessaoId, NOVA);
});

test('(retomar-10) sessão morta antiga no com, sem registro (o F476): sai do com e a pergunta dela passa', () => {
  const MORTA = 'orca_session_id:morta-antiga';
  const c = cenario({ item: { branch: undefined, com: [{ localId: MORTA, apelido: 'dona', oQue: 'faz o tema' }, { localId: VELHA, apelido: 'dona', oQue: 'faz o tema' }], sessoes: [MORTA, VELHA] } });
  gravarDoc('perguntas', 'Q10', { estado: 'aberta', item: 'F7', titulo: 'F7 antiga', sessaoId: MORTA, endereco: { orca: MORTA }, projeto: 'kit' });
  const r = retomar(c);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.deepEqual(lerDoc('fila', 'F7').data.com.map((x) => x.localId), [NOVA]);
  assert.equal(lerDoc('perguntas', 'Q10').data.sessaoId, NOVA);
  assert.deepEqual(lerDoc('perguntas', 'Q10').data.endereco, { orca: NOVA });
});

test('(retomar-11) o worker-release que falha deixa exit 1 e diz qual', () => {
  const c = cenario({ velho: { terminalState: 'retained' }, outros: { 'orchestration worker-release': { stdout: { ok: false, error: { message: 'recusou' } }, exit: 1 } } });
  const r = retomar(c);
  assert.notEqual(r.status, 0, r.stdout);
  assert.equal(lerDoc('fila', 'F7').data.donoLocalId, NOVA, 'a passagem já gravada fica');
  assert.ok(r.json?.falhas?.length, `falhas: ${r.stdout}`);
});

const RECUSAS = [
  ['despacho novo morto', { novo: { state: 'stopped', outcome: 'failed', terminalState: 'released' } }, /ctx_novo não está vivo/],
  ['despacho fora da lista', { novo: { dispatchId: 'ctx_outro' } }, /ctx_novo não está no orca worker-list/],
  ['a sessão nova ainda não se registrou', { registroDaNova: false }, /a sessão nova .*não gravou o registro/],
  ['item de outra worktree', { registroDaVelha: '/em/outra/pasta', branchDaWorktree: 'f9-outro' }, /F7 não é da worktree/],
  ['branch de item de número parecido', { registroDaVelha: null, item: { branch: undefined }, branchDaWorktree: 'f70-outro' }, /F7 não é da worktree/],
  ['outro despacho vivo na mesma worktree', { workersExtra: () => [worker(pasta, 'active', { dispatchId: 'ctx_intruso', state: 'ready', terminal: 'structworker_intruso' })] }, /outro despacho que ainda está vivo \(ctx_intruso\)/],
  ['a dona velha ainda viva', { velho: { state: 'ready', outcome: 'in_progress', terminalState: 'active' } }, /ainda está viva/],
  ['item fechado', { item: { etapa: 'feito', donoLocalId: null, donoApelido: null, com: [] } }, /F7 está em etapa final/],
];
for (const [nome, opcoes, motivo] of RECUSAS) {
  test(`(retomar-recusa) ${nome}: recusa com o motivo, sem gravar nem chamar o orca`, () => {
    const c = cenario(opcoes);
    const antes = readFileSync(join(base, 'painel', 'fila', 'F7.json'), 'utf8');
    const r = retomar(c);
    assert.notEqual(r.status, 0, `devia recusar: ${r.stdout}`);
    assert.match(r.stderr + r.stdout, motivo);
    assert.equal(readFileSync(join(base, 'painel', 'fila', 'F7.json'), 'utf8'), antes, 'o item não muda');
    assert.equal(lerDoc('perguntas', 'Q6').data.sessaoId, VELHA, 'a pergunta não muda');
    assert.deepEqual(c.mutantes(), []);
  });
}
test('(retomar-recusa-prova) o cenário base, sem a falta, passa (a recusa mede a falta, não um cenário quebrado)', () => {
  const r = retomar(cenario());
  assert.equal(r.status, 0, r.stderr + r.stdout);
});

test('(retomar-6) espera o registro da sessão nova aparecer, até --esperar segundos', async () => {
  const c = cenario({ registroDaNova: false });
  const filho = spawn('node', [PAINEL, 'orquestradora', 'retomar', 'F7', '--dispatch', 'ctx_novo', '--esperar', '20'], { cwd: repo, env: envBase(c.env), stdio: ['ignore', 'pipe', 'pipe'] });
  const corte = setTimeout(() => filho.kill('SIGKILL'), 30000);
  let saida = ''; let erro = '';
  filho.stdout.on('data', (b) => { saida += b; });
  filho.stderr.on('data', (b) => { erro += b; });
  setTimeout(() => registro(NOVA, 'structworker_novo', pasta), 1500);
  const status = await new Promise((ok) => filho.on('close', ok));
  clearTimeout(corte);
  assert.equal(status, 0, erro + saida);
  assert.equal(lerDoc('fila', 'F7').data.donoLocalId, NOVA);
});

test('(retomar-7) uso errado: sem F<n>, sem --dispatch ou com argumento a mais', () => {
  const c = cenario();
  for (const args of [['retomar', '--dispatch', 'ctx_novo'], ['retomar', 'F7'], ['retomar', 'F7', '--dispatch', 'novo'], ['retomar', 'F7', '--dispatch', 'ctx_novo', 'sobra']]) {
    const r = painel(['orquestradora', ...args, '--esperar', '0'], c.env);
    assert.notEqual(r.status, 0, args.join(' '));
    assert.match(r.stderr, /uso|argumento desconhecido/, args.join(' '));
  }
});
