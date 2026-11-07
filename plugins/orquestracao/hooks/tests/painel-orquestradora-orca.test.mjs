// F447 (ADR 0030, item 7; plano do modo Orca, fatia 5): a orquestradora no Orca.
// `painel orquestradora assumir` grava o marcador `ativas/<id do CLI>` com o repositório e o id do Orca: as travas da
// orquestradora valem por ele (nada no Orca depende do título) e a batida não o apaga. `painel orquestradora arquivar <ctx_…>`
// confere as condições de arquivar lidas no Orca e só então solta o worker e marca a worktree `completed`.
// HOME, HOOKS_CREWAI_BASE, PAINEL_DIR e POOL_APP_SESSOES_DIR são pastas temporárias; o `orca` e o `gh` são falsos.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { orcaFalso, recibo, worker } from './orca-falso.mjs';

const HOOKS = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAINEL = join(HOOKS, '..', 'skills', 'orquestradora', 'scripts', 'painel.mjs');
const ORCA_CRU = 'orq-do-orca';
const ORCA_ID = `orca_session_id:${ORCA_CRU}`;

let base; let repo; let pasta;
const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 20000, killSignal: 'SIGKILL' });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
const ativas = () => join(base, 'orq', 'ativas');

// O ambiente de quem roda o teste (um worker do Orca, por exemplo) não entra: as envs do Orca e do app são fixadas aqui.
const envBase = (extra = {}) => ({
  ...process.env, HOME: join(base, 'home'), HOOKS_CREWAI_BASE: join(base, 'orq'), PAINEL_DIR: join(base, 'painel'),
  POOL_APP_SESSOES_DIR: join(base, 'app'), CLAUDE_CODE_HOST_SESSION_ID: '', ORCA_TERMINAL_HANDLE: '', KIT_ORCA_BIN: 'off',
  KIT_ANFITRIAO: 'orca', ORCA_AGENT_SESSION_ID: ORCA_CRU, CLAUDE_CODE_SESSION_ID: 'cli-orq', KIT_ESTADO_DEDUZIDO: 'off',
  CLAUDE_CONFIG_DIR: join(base, 'cfg'), ...extra,
});
function painel(args, { cwd = repo, env = {} } = {}) {
  const r = spawnSync('node', [PAINEL, ...args], { cwd, encoding: 'utf8', timeout: 60000, killSignal: 'SIGKILL', env: envBase(env) });
  let json = null;
  try { json = JSON.parse(r.stdout); } catch { /* saída que não é JSON */ }
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, json };
}

beforeEach(() => {
  base = realpathSync(mkdtempSync(join(tmpdir(), 'orq-orca-')));
  for (const d of ['home', 'orq/ativas', 'app', 'painel/fila', 'painel/perguntas']) mkdirSync(join(base, d), { recursive: true });
  // o repositório: origin nu + clone (o checkout principal) + a worktree da dona, com a branch do item empurrada
  const origin = join(base, 'origin.git');
  git(base, 'init', '-q', '--bare', '-b', 'main', origin);
  repo = join(base, 'kit');
  git(base, 'clone', '-q', origin, repo);
  git(repo, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'raiz');
  git(repo, 'push', '-q', 'origin', 'HEAD:main');
  pasta = join(base, 'wt-f7');
  git(repo, 'worktree', 'add', '-q', '-b', 'f7-tema', pasta);
  git(pasta, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'trabalho');
  git(pasta, 'push', '-q', '-u', 'origin', 'f7-tema');
});
afterEach(() => rmSync(base, { recursive: true, force: true }));

// ───────────────────────────── assumir ─────────────────────────────

test('(assumir-1) grava ativas/<id do CLI> com o git common dir na 1ª linha e o id do Orca na 2ª', () => {
  const r = painel(['orquestradora', 'assumir']);
  assert.equal(r.status, 0, r.stderr);
  const m = join(ativas(), 'cli-orq');
  assert.ok(existsSync(m), 'o marcador existe');
  const linhas = readFileSync(m, 'utf8').split('\n');
  assert.equal(linhas[0], join(repo, '.git'));
  assert.equal(linhas[1], ORCA_ID);
  assert.equal(r.json?.marcador, m);
  assert.equal(r.json?.orcaId, ORCA_ID);
});
test('(assumir-2) sem o id do CLI, fora de git ou com id que vira caminho: recusa e não grava', () => {
  const sem = painel(['orquestradora', 'assumir'], { env: { CLAUDE_CODE_SESSION_ID: '' } });
  assert.notEqual(sem.status, 0);
  assert.match(sem.stderr, /CLAUDE_CODE_SESSION_ID/);
  const fora = join(base, 'fora'); mkdirSync(fora);
  const r = painel(['orquestradora', 'assumir'], { cwd: fora });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /git/);
  const barra = painel(['orquestradora', 'assumir'], { env: { CLAUDE_CODE_SESSION_ID: '../fora' } });
  assert.notEqual(barra.status, 0);
  assert.equal(existsSync(join(base, 'orq', 'fora')), false);
  assert.deepEqual(readdirSync(ativas()), []);
});
test('(assumir-3) fora do Orca grava só o repositório', () => {
  const r = painel(['orquestradora', 'assumir'], { env: { KIT_ANFITRIAO: 'terminal', ORCA_AGENT_SESSION_ID: '' } });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(readFileSync(join(ativas(), 'cli-orq'), 'utf8'), `${join(repo, '.git')}\n`);
});

test('(assumir-4) o marcador de duas linhas liga a trava de edição da orquestradora no repositório dela', () => {
  painel(['orquestradora', 'assumir']);
  // a lista de repositórios cobertos obriga o leitor do marcador a achar o repo na 1ª linha; o arquivo fica fora da pasta
  // temporária (a trava deixa o /tmp livre), e o repo vem do marcador, não do caminho
  writeFileSync(join(base, 'orq', 'trava-edicao-repos.txt'), `${join(repo, '.git')}\n`);
  const r = spawnSync('node', [join(HOOKS, 'orquestradora-nao-edita.mjs')], {
    input: JSON.stringify({ session_id: 'cli-orq', hook_event_name: 'PreToolUse', tool_name: 'Edit', cwd: repo, tool_input: { file_path: '/caminho/do/projeto/a.mjs', old_string: 'a', new_string: 'b' } }),
    encoding: 'utf8', timeout: 15000, killSignal: 'SIGKILL', env: envBase(),
  });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stdout, 'a trava respondeu');
  assert.equal(JSON.parse(r.stdout).hookSpecificOutput.permissionDecision, 'ask');
});

test('(assumir-5) a batida não apaga o marcador da orquestradora do Orca registrada; o da id que ela deixou para trás, sim', () => {
  painel(['orquestradora', 'assumir']);
  mkdirSync(join(base, 'orq', 'orca-sessoes'), { recursive: true });
  writeFileSync(join(base, 'orq', 'orca-sessoes', `${ORCA_CRU}.json`), JSON.stringify({ orcaId: ORCA_ID, cliAtual: 'cli-orq', cliIds: ['cli-orq', 'cli-velho'], terminal: null, enderecoDoSend: ORCA_ID, cwd: repo, em: new Date().toISOString() }));
  writeFileSync(join(ativas(), 'cli-velho'), `${join(repo, '.git')}\n${ORCA_ID}\n`);
  transcript('cli-velho', 120);
  const sessoes = join(base, 'sessoes.json'); writeFileSync(sessoes, '[]');
  const r = painel(['batida', '--sessoes', sessoes, '--seco'], { env: { CLAUDE_CODE_SESSION_ID: '' } });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.json?.marcadoresApagados?.includes('cli-velho'), `prova: a batida apaga o marcador morto (${r.stdout.slice(0, 300)})`);
  assert.ok(!r.json.marcadoresApagados.includes('cli-orq'), 'o marcador da orquestradora viva fica');
});

// O transcript do id do CLI em CLAUDE_CONFIG_DIR/projects/<pasta>/<id>.jsonl, escrito há `minutos`.
function transcript(cli, minutos) {
  const d = join(base, 'cfg', 'projects', '-kit'); mkdirSync(d, { recursive: true });
  const f = join(d, `${cli}.jsonl`); writeFileSync(f, '{}\n');
  const t = new Date(Date.now() - minutos * 60_000); utimesSync(f, t, t);
}
test('(assumir-6) um `claude` lançado do Bash da orquestradora vira o CLI atual do registro: a batida não apaga o marcador dela enquanto ela escreve', () => {
  painel(['orquestradora', 'assumir']);
  mkdirSync(join(base, 'orq', 'orca-sessoes'), { recursive: true });
  writeFileSync(join(base, 'orq', 'orca-sessoes', `${ORCA_CRU}.json`), JSON.stringify({ orcaId: ORCA_ID, cliAtual: 'cli-filho', cliIds: ['cli-filho', 'cli-orq'], terminal: null, enderecoDoSend: ORCA_ID, cwd: repo, em: new Date().toISOString() }));
  transcript('cli-orq', 1);
  const sessoes = join(base, 'sessoes.json'); writeFileSync(sessoes, '[]');
  const viva = painel(['batida', '--sessoes', sessoes, '--seco'], { env: { CLAUDE_CODE_SESSION_ID: '' } });
  assert.equal(viva.status, 0, viva.stderr);
  assert.ok(Array.isArray(viva.json?.marcadoresApagados), viva.stdout.slice(0, 300));
  assert.ok(!viva.json.marcadoresApagados.includes('cli-orq'), 'escrevendo agora: fica');
  transcript('cli-orq', 120);
  const parada = painel(['batida', '--sessoes', sessoes, '--seco'], { env: { CLAUDE_CODE_SESSION_ID: '' } });
  assert.ok(parada.json?.marcadoresApagados?.includes('cli-orq'), 'prova: parada há 2 h, sai');
});

// ───────────────────────────── arquivar ─────────────────────────────

const GH_FALSO = `#!${process.execPath}
const fs = require('fs');
fs.appendFileSync(process.env.GH_LOG, JSON.stringify(process.argv.slice(2)) + '\\n');
if (process.env.GH_FALHA) { process.stderr.write('gh: sem rede'); process.exitCode = 1; return; }
process.stdout.write(process.env.GH_PRS || '[]');
`;
// o PR mergeado leva o HEAD da worktree: commit depois do merge é trabalho sem PR
function cenario({ prs, workers, item = {} } = {}) {
  prs ??= [{ number: 12, state: 'MERGED', headRefOid: git(pasta, 'rev-parse', 'HEAD') }];
  const gh = join(base, 'gh'); writeFileSync(gh, GH_FALSO); chmodSync(gh, 0o755);
  const w = worker(pasta, 'retained', { dispatchId: 'ctx_aaa111', state: 'succeeded', terminal: 'structworker_t1' });
  const orca = orcaFalso({ '': recibo(workers ?? [w]) });
  writeFileSync(join(base, 'painel', 'fila', 'F7.json'), JSON.stringify({ id: 'F7', version: 1, data: { titulo: 'tema', etapa: 'feito', projeto: 'kit', branch: 'f7-tema', prs: [12], donoLocalId: null, donoApelido: null, com: [], perguntas: [], ...item } }));
  const env = { ...orca.env, GH_BIN: gh, GH_LOG: join(base, 'gh.log'), GH_PRS: JSON.stringify(prs) };
  const mutantes = () => orca.chamadas().map((c) => c.argv).filter((a) => a.slice(0, 2).join(' ') !== 'orchestration worker-list');
  return { env, orca, mutantes };
}
const arquivar = (c, extra = [], env = {}) => painel(['orquestradora', 'arquivar', 'ctx_aaa111', ...extra], { env: { ...c.env, ...env } });

test('(arquivar-1) as condições valendo: solta o worker e marca a worktree completed; sem --remover-worktree não remove', () => {
  const c = cenario();
  const r = arquivar(c);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(r.json?.arquivado, true);
  assert.deepEqual(c.mutantes(), [
    ['orchestration', 'worker-release', '--dispatch', 'ctx_aaa111', '--json'],
    ['worktree', 'set', '--worktree', `path:${pasta}`, '--workspace-status', 'completed', '--json'],
  ]);
});
test('(arquivar-2) --remover-worktree remove pela mesma via, nunca com --force', () => {
  const c = cenario();
  const r = arquivar(c, ['--remover-worktree']);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const ms = c.mutantes();
  assert.deepEqual(ms.at(-1), ['worktree', 'rm', '--worktree', `path:${pasta}`, '--json']);
  assert.ok(ms.every((a) => !a.includes('--force')), 'nenhum --force');
});
test('(arquivar-3) trabalho sem PR e sem commit fora da main conta como a condição do PR valendo', () => {
  git(pasta, 'reset', '-q', '--hard', 'origin/main');
  const c = cenario({ prs: [] });
  const r = arquivar(c);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(c.mutantes().length, 2);
});

const FALTAS = [
  ['PR aberto', () => cenario({ prs: [{ number: 12, state: 'OPEN' }] }), /PR #12 (está )?aberto/],
  ['PR fechado sem merge', () => cenario({ prs: [{ number: 12, state: 'CLOSED' }] }), /PR #12 fechado sem merge/],
  ['o gh não respondeu', () => { const c = cenario(); c.env.GH_FALHA = '1'; return c; }, /o gh não respondeu/],
  ['sem PR, com commit fora da main', () => cenario({ prs: [] }), /sem PR e com 1 commit\(s\) fora de origin\/main/],
  ['commit depois do PR mergeado', () => cenario({ prs: [{ number: 12, state: 'MERGED', headRefOid: '0'.repeat(40) }] }), /commit depois do PR #12 mergeado/],
  ['pergunta aberta da dona sem o campo item', () => {
    const c = cenario({ item: { donoLocalId: 'orca_session_id:dona-f7' } });
    writeFileSync(join(base, 'painel', 'perguntas', 'Q6.json'), JSON.stringify({ id: 'Q6', version: 1, data: { estado: 'aberta', sessaoId: 'orca_session_id:dona-f7', projeto: 'kit' } }));
    return c;
  }, /pergunta aberta do F7: Q6/],
  ['pergunta aberta de quem esteve no item fechado (donaAoFechar)', () => {
    const c = cenario({ item: { donaAoFechar: { donoLocalId: null, com: [{ localId: 'orca_session_id:dona-f7' }] } } });
    writeFileSync(join(base, 'painel', 'perguntas', 'Q8.json'), JSON.stringify({ id: 'Q8', version: 1, data: { estado: 'aberta', sessaoId: 'orca_session_id:dona-f7', projeto: 'kit' } }));
    return c;
  }, /pergunta aberta do F7: Q8/],
  ['pergunta aberta com o item só no título', () => {
    const c = cenario();
    writeFileSync(join(base, 'painel', 'perguntas', 'Q9.json'), JSON.stringify({ id: 'Q9', version: 1, data: { estado: 'aberta', sessaoId: 'orca_session_id:outra', titulo: 'F7 · qual caminho', projeto: 'kit' } }));
    return c;
  }, /pergunta aberta do F7: Q9/],
  ['a pasta é o checkout principal', () => cenario({ workers: [worker(repo, 'retained', { dispatchId: 'ctx_aaa111', state: 'succeeded', terminal: 'structworker_t1' })] }), /checkout principal/],
  ['pergunta aberta do item', () => {
    const c = cenario();
    writeFileSync(join(base, 'painel', 'perguntas', 'Q5.json'), JSON.stringify({ id: 'Q5', version: 1, data: { item: 'F7', estado: 'aberta', sessaoId: ORCA_ID, projeto: 'kit' } }));
    return c;
  }, /Q5/],
  ['arquivo sem commit na worktree', () => { const c = cenario(); writeFileSync(join(pasta, 'solto.txt'), 'x'); return c; }, /sem commit|não está limpa/],
  ['commit sem push', () => { const c = cenario(); git(pasta, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'local'); return c; }, /sem push/],
  ['worker ainda trabalhando', () => cenario({ workers: [worker(pasta, 'retained', { dispatchId: 'ctx_aaa111', state: 'ready', terminal: 'structworker_t1' })] }), /parado|trabalhando/],
  ['outro despacho vivo no mesmo terminal (a devolução por send)', () => cenario({ workers: [
    worker(pasta, 'retained', { dispatchId: 'ctx_aaa111', state: 'succeeded', terminal: 'structworker_t1' }),
    worker(pasta, 'retained', { dispatchId: 'ctx_bbb222', state: 'ready', terminal: 'structworker_t1' }),
  ] }), /ctx_bbb222/],
  ['despacho fora da lista', () => cenario({ workers: [worker(pasta, 'retained', { dispatchId: 'ctx_outro', state: 'succeeded' })] }), /não está no orca worker-list/],
  ['a lista do Orca falhou', () => { const c = cenario(); writeFileSync(join(c.orca.dir, 'paginas.json'), JSON.stringify({ '': { stdout: 'quebrado', exit: 2 } })); return c; }, /worker-list/],
];
for (const [nome, montar, motivo] of FALTAS) {
  test(`(arquivar-falta) ${nome}: não chama nada e diz o que faltou`, () => {
    const c = montar();
    const r = arquivar(c, ['--remover-worktree']);
    assert.equal(r.status, 1, `exit 1 (${r.stderr}${r.stdout})`);
    assert.match(r.stdout + r.stderr, motivo);
    assert.deepEqual(c.mutantes(), [], 'nenhum worker-release, worktree set nem worktree rm');
  });
}
// F484: o despacho que morreu no limite de uso fica `stopped`, outcome failed, terminal `released` (medido em 07/11/2026: o
// `worker-release` responde already_released). Isso é parado de vez: arquiva sem soltar de novo o que já está solto.
const morto = (extra = {}) => worker(pasta, 'released', { dispatchId: 'ctx_aaa111', state: 'stopped', terminal: 'structworker_t1', ...extra });
test('(arquivar-7) despacho stopped com terminal released conta como parado: arquiva e não chama worker-release', () => {
  const c = cenario({ workers: [morto()] });
  const r = arquivar(c);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(r.json?.arquivado, true);
  assert.equal(r.json?.condicoes?.parado, true);
  assert.deepEqual(c.mutantes(), [['worktree', 'set', '--worktree', `path:${pasta}`, '--workspace-status', 'completed', '--json']]);
});
test('(arquivar-8) stopped com o terminal ainda vivo não é parado de vez: recusa sem chamar nada', () => {
  const c = cenario({ workers: [morto({ terminalState: 'retained' })] });
  const r = arquivar(c, ['--remover-worktree']);
  assert.equal(r.status, 1, r.stderr + r.stdout);
  assert.match(r.stdout + r.stderr, /worker não está parado: ctx_aaa111 em stopped/);
  assert.deepEqual(c.mutantes(), []);
});
test('(arquivar-9) um despacho velho stopped/released e o follow-up succeeded no mesmo terminal: o release vai só ao vivo', () => {
  const c = cenario({ workers: [morto(), worker(pasta, 'retained', { dispatchId: 'ctx_bbb222', state: 'succeeded', terminal: 'structworker_t1' })] });
  const r = painel(['orquestradora', 'arquivar', 'ctx_bbb222'], { env: c.env });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.deepEqual(c.mutantes()[0], ['orchestration', 'worker-release', '--dispatch', 'ctx_bbb222', '--json']);
});
// F484 (validador): depois do retry na mesma Task, a pasta tem o despacho velho (stopped, terminal released) e o novo, sempre
// `--keep-open`, num terminal retido. Arquivar pelo velho tem de soltar o terminal do novo, senão ele fica aberto para sempre.
test('(arquivar-10) retry: arquivar pelo despacho velho solta o terminal do novo, um release por terminal', () => {
  const c = cenario({ workers: [
    worker(pasta, 'released', { dispatchId: 'ctx_velho0', state: 'stopped', terminal: 'structworker_t0' }),
    worker(pasta, 'retained', { dispatchId: 'ctx_aaa111', state: 'succeeded', terminal: 'structworker_t1' }),
    worker(pasta, 'retained', { dispatchId: 'ctx_aaa112', state: 'succeeded', terminal: 'structworker_t1' }),
  ] });
  const r = painel(['orquestradora', 'arquivar', 'ctx_velho0'], { env: c.env });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const releases = c.mutantes().filter((m) => m[1] === 'worker-release');
  assert.equal(releases.length, 1, JSON.stringify(c.mutantes()));
  assert.match(releases[0][3], /^ctx_aaa11[12]$/);
  assert.ok(!c.mutantes().some((m) => m.includes('ctx_velho0')), 'o terminal já solto não se solta de novo');
});
test('(arquivar-6) a decisão assumida (a confirmar) não segura o worker: só a pergunta aberta trava', () => {
  const c = cenario();
  writeFileSync(join(base, 'painel', 'perguntas', 'Q5.json'), JSON.stringify({ id: 'Q5', version: 1, data: { item: 'F7', estado: 'assumida', sessaoId: ORCA_ID, projeto: 'kit' } }));
  const r = arquivar(c, ['--seco']);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(r.json?.condicoes?.perguntas, true, 'a assumida não conta');
});
test('(arquivar-falta) prova: o mesmo cenário sem a falta arquiva (o teste da falta mede a falta, não um cenário quebrado)', () => {
  const c = cenario();
  assert.equal(arquivar(c, ['--remover-worktree']).status, 0);
  assert.equal(c.mutantes().length, 3);
});
test('(arquivar-4) --seco confere e não chama nada', () => {
  const c = cenario();
  const r = arquivar(c, ['--seco']);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.json?.seco, true);
  assert.deepEqual(c.mutantes(), []);
});
test('(arquivar-5) sem orca na máquina: recusa', () => {
  const c = cenario();
  const r = arquivar(c, [], { KIT_ORCA_BIN: 'off' });
  assert.equal(r.status, 1);
  assert.match(r.stderr + r.stdout, /orca/);
});

// ───────────────────── arquivar --concluidas (F469, o botão da aba do kit) ─────────────────────

// Duas donas concluídas: F7 (worktree `pasta`, despacho ctx_aaa111) e F8 (outra worktree, ctx_bbb222), ambas com PR mergeado.
function cenarioDeDuas({ itemF8 = {}, prsF8, workersExtra = [] } = {}) {
  const c = cenario();
  const pasta8 = join(base, 'wt-f8');
  git(repo, 'worktree', 'add', '-q', '-b', 'f8-tema', pasta8);
  git(pasta8, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'trabalho 8');
  git(pasta8, 'push', '-q', '-u', 'origin', 'f8-tema');
  const w7 = worker(pasta, 'retained', { dispatchId: 'ctx_aaa111', state: 'succeeded', terminal: 'structworker_t1' });
  const w8 = worker(pasta8, 'retained', { dispatchId: 'ctx_bbb222', state: 'succeeded', terminal: 'structworker_t2' });
  writeFileSync(join(c.orca.dir, 'paginas.json'), JSON.stringify({ '': recibo([w7, w8, ...workersExtra]) }));
  writeFileSync(join(base, 'painel', 'fila', 'F8.json'), JSON.stringify({ id: 'F8', version: 1, data: { titulo: 'outro tema', etapa: 'feito', projeto: 'kit', branch: 'f8-tema', prs: [13], donoLocalId: null, com: [], perguntas: [], ...itemF8 } }));
  // o gh falso devolve os PRs da branch pedida: o de F7 sempre mergeado com o HEAD; o de F8 como o cenário pedir
  const gh = join(base, 'gh'); writeFileSync(gh, `#!${process.execPath}
const fs = require('fs');
const a = process.argv.slice(2);
fs.appendFileSync(process.env.GH_LOG, JSON.stringify(a) + '\\n');
const branch = a[a.indexOf('--head') + 1];
process.stdout.write(branch === 'f8-tema' ? process.env.GH_PRS_F8 : process.env.GH_PRS);
`); chmodSync(gh, 0o755);
  c.env.GH_PRS_F8 = JSON.stringify(prsF8 ?? [{ number: 13, state: 'MERGED', headRefOid: git(pasta8, 'rev-parse', 'HEAD') }]);
  return { ...c, pasta8 };
}
const concluidas = (c, extra = []) => painel(['orquestradora', 'arquivar', '--concluidas', ...extra], { env: c.env });

test('(concluidas-1) --seco lista as aptas (achadas pela branch) e não chama nada', () => {
  const c = cenarioDeDuas();
  const r = concluidas(c, ['--seco']);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.deepEqual(r.json?.aptas?.map((x) => x.item), ['F7', 'F8']);
  assert.deepEqual(r.json.aptas.map((x) => x.dispatchId), ['ctx_aaa111', 'ctx_bbb222']);
  assert.deepEqual(r.json.arquivadas, []);
  assert.deepEqual(c.mutantes(), [], 'só lê');
});
test('(concluidas-1b) F484: a dona que morreu no limite (stopped, terminal released) é concluída apta', () => {
  const c = cenarioDeDuas();
  const w7 = worker(pasta, 'released', { dispatchId: 'ctx_aaa111', state: 'stopped', terminal: 'structworker_t1' });
  const w8 = worker(c.pasta8, 'retained', { dispatchId: 'ctx_bbb222', state: 'succeeded', terminal: 'structworker_t2' });
  writeFileSync(join(c.orca.dir, 'paginas.json'), JSON.stringify({ '': recibo([w7, w8]) }));
  const r = concluidas(c, ['--seco']);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.deepEqual(r.json?.aptas?.map((x) => x.item), ['F7', 'F8']);
});
test('(concluidas-2) sem branch no item, acha pela sessão que o trabalhou (orca-sessoes: terminal)', () => {
  const c = cenarioDeDuas({ itemF8: { branch: undefined, donaAoFechar: { donoLocalId: 'orca_session_id:dona-f8', com: [] } } });
  const dir = join(base, 'orq', 'orca-sessoes'); mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'dona-f8.json'), JSON.stringify({ orcaId: 'orca_session_id:dona-f8', cliAtual: 'x', cliIds: ['x'], terminal: 'structworker_t2', enderecoDoSend: 'orca_session_id:dona-f8', cwd: c.pasta8, em: new Date().toISOString() }));
  const r = concluidas(c, ['--seco']);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.ok(r.json?.aptas?.some((x) => x.item === 'F8'), `F8 achada pelo registro (${r.stdout.slice(0, 300)})`);
});
test('(concluidas-3) arquiva só as que passam: a de pergunta aberta fica, com o motivo; sem --remover-worktree, a worktree fica; nunca --force', () => {
  const c = cenarioDeDuas();
  writeFileSync(join(base, 'painel', 'perguntas', 'Q5.json'), JSON.stringify({ id: 'Q5', version: 1, data: { item: 'F8', estado: 'aberta', sessaoId: ORCA_ID, projeto: 'kit' } }));
  const r = concluidas(c);
  assert.equal(r.status, 1, 'exit 1: alguma ficou recusada');
  assert.deepEqual(r.json?.arquivadas?.map((x) => x.item), ['F7']);
  assert.equal(r.json.recusadas.length, 1);
  assert.equal(r.json.recusadas[0].item, 'F8');
  assert.match(r.json.recusadas[0].faltam.join(' '), /pergunta aberta do F8: Q5/);
  const ms = c.mutantes();
  assert.deepEqual(ms, [
    ['orchestration', 'worker-release', '--dispatch', 'ctx_aaa111', '--json'],
    ['worktree', 'set', '--worktree', `path:${pasta}`, '--workspace-status', 'completed', '--json'],
  ]);
  assert.ok(ms.every((a) => !a.includes('--force') && a[1] !== 'rm'), 'sem --force nem worktree rm');
});
test('(concluidas-4) item que não está feito/descartado não é candidato, mesmo com PR mergeado e worker parado', () => {
  const c = cenarioDeDuas({ itemF8: { etapa: 'execucao' } });
  const r = concluidas(c, ['--seco']);
  assert.deepEqual(r.json?.aptas?.map((x) => x.item), ['F7']);
  assert.ok(!JSON.stringify(r.json).includes('F8'), 'F8 nem aparece');
  const real = concluidas(c);
  assert.equal(real.status, 0);
  assert.equal(c.mutantes().filter((a) => a.includes('ctx_bbb222') || a.includes(`path:${c.pasta8}`)).length, 0, 'F8 intocada');
});
test('(concluidas-5) --itens arquiva só o confirmado; item fora das concluídas é recusado sem chamar nada', () => {
  const c = cenarioDeDuas();
  const r = concluidas(c, ['--itens', 'F7,F99']);
  assert.equal(r.status, 1);
  assert.deepEqual(r.json?.arquivadas?.map((x) => x.item), ['F7']);
  assert.equal(r.json.recusadas[0].item, 'F99');
  assert.equal(c.mutantes().length, 2, 'só o F7');
});
test('(concluidas-6) paridade: o que --concluidas arquiva é o que `arquivar <ctx_…>` arquivaria, e a recusa traz as mesmas faltas', () => {
  const c = cenarioDeDuas({ prsF8: [{ number: 13, state: 'OPEN' }] });
  const avulso = (ctx, item) => painel(['orquestradora', 'arquivar', ctx, '--item', item, '--seco'], { env: c.env });
  assert.equal(avulso('ctx_aaa111', 'F7').json?.seco, true, 'prova: o avulso diz que F7 arquivaria');
  const f8 = avulso('ctx_bbb222', 'F8');
  assert.equal(f8.status, 1);
  assert.match(f8.json.faltam.join(' '), /PR #13/);
  const lote = concluidas(c, ['--seco']);
  assert.deepEqual(lote.json?.aptas?.map((x) => x.item), ['F7']);
  assert.deepEqual(lote.json.recusadas[0].faltam, f8.json.faltam, 'mesmas faltas do avulso');
});
test('(concluidas-7) worker ainda trabalhando no mesmo terminal: não é arquivada', () => {
  const c = cenarioDeDuas({ workersExtra: [worker(join(base, 'wt-f8'), 'retained', { dispatchId: 'ctx_ccc333', state: 'ready', terminal: 'structworker_t2' })] });
  const r = concluidas(c);
  assert.deepEqual(r.json?.arquivadas?.map((x) => x.item), ['F7']);
  assert.match(JSON.stringify(r.json.recusadas), /ctx_ccc333/);
});
test('(concluidas-8b) --remover-worktree: cada concluída que passa também sai da barra lateral, pelo mesmo `worktree rm` do avulso, nunca --force; a recusada não remove nada', () => {
  const c = cenarioDeDuas();
  writeFileSync(join(base, 'painel', 'perguntas', 'Q5.json'), JSON.stringify({ id: 'Q5', version: 1, data: { item: 'F8', estado: 'aberta', sessaoId: ORCA_ID, projeto: 'kit' } }));
  const r = concluidas(c, ['--remover-worktree']);
  assert.deepEqual(r.json?.arquivadas?.map((x) => x.item), ['F7']);
  assert.equal(r.json.recusadas[0].item, 'F8');
  const ms = c.mutantes();
  assert.deepEqual(ms.map((a) => a.slice(0, 2).join(' ')), ['orchestration worker-release', 'worktree set', 'worktree rm']);
  assert.deepEqual(ms.at(-1), ['worktree', 'rm', '--worktree', `path:${pasta}`, '--json']);
  assert.ok(ms.every((a) => !a.includes('--force')), 'nenhum --force');
  // paridade com o avulso (arquivar-2): worker-release, worktree set completed e o mesmo `worktree rm path:` da pasta
  assert.deepEqual(ms, [
    ['orchestration', 'worker-release', '--dispatch', 'ctx_aaa111', '--json'],
    ['worktree', 'set', '--worktree', `path:${pasta}`, '--workspace-status', 'completed', '--json'],
    ['worktree', 'rm', '--worktree', `path:${pasta}`, '--json'],
  ]);
});
test('(concluidas-10) dona reaproveitada: sessão que também trabalha um item vivo não é candidata, mesmo com o item fechado achando-a', () => {
  const c = cenarioDeDuas();
  const dir = join(base, 'orq', 'orca-sessoes');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'dona-f8.json'), JSON.stringify({ orcaId: 'orca_session_id:dona-f8', cliAtual: 'x', cliIds: ['x'], terminal: 'structworker_t2', enderecoDoSend: 'orca_session_id:dona-f8', cwd: c.pasta8, em: new Date().toISOString() }));
  writeFileSync(join(base, 'painel', 'fila', 'F8.json'), JSON.stringify({ id: 'F8', version: 1, data: { titulo: 'tema', etapa: 'feito', projeto: 'kit', branch: null, prs: [], donoLocalId: 'orca_session_id:dona-f8', com: [], perguntas: [] } }));
  writeFileSync(join(base, 'painel', 'fila', 'F9.json'), JSON.stringify({ id: 'F9', version: 1, data: { titulo: 'item vivo', etapa: 'implementacao', projeto: 'kit', branch: null, prs: [], donoLocalId: 'orca_session_id:dona-f8', com: [], perguntas: [] } }));
  const antes = concluidas(c, ['--seco']);
  assert.deepEqual(antes.json?.aptas?.map((x) => x.item), ['F7'], 'F8 compartilha a dona com o F9 vivo: fora');
  assert.deepEqual(c.mutantes(), []);
});
test('(concluidas-8) recusa --item e despacho junto; --itens sem --concluidas', () => {
  const c = cenarioDeDuas();
  for (const extra of [['--item', 'F7'], ['ctx_aaa111']]) {
    const r = concluidas(c, extra);
    assert.notEqual(r.status, 0, extra.join(' '));
    assert.match(r.stderr, /uso:/);
  }
  const sem = painel(['orquestradora', 'arquivar', 'ctx_aaa111', '--itens', 'F7'], { env: c.env });
  assert.notEqual(sem.status, 0);
  assert.deepEqual(c.mutantes(), []);
});
test('(concluidas-1c) retry: o despacho velho stopped/released vem antes do novo retido na mesma pasta; o novo é solto', () => {
  const c = cenarioDeDuas();
  const velho = worker(pasta, 'released', { dispatchId: 'ctx_velho0', state: 'stopped', terminal: 'structworker_t0' });
  const novo = worker(pasta, 'retained', { dispatchId: 'ctx_aaa111', state: 'succeeded', terminal: 'structworker_t1' });
  const w8 = worker(c.pasta8, 'retained', { dispatchId: 'ctx_bbb222', state: 'succeeded', terminal: 'structworker_t2' });
  writeFileSync(join(c.orca.dir, 'paginas.json'), JSON.stringify({ '': recibo([velho, novo, w8]) }));
  const r = concluidas(c, ['--itens', 'F7']);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.ok(c.mutantes().some((m) => m.join(' ').includes('worker-release --dispatch ctx_aaa111')), JSON.stringify(c.mutantes()));
});
test('(concluidas-9) sem concluída com worker: lista vazia e exit 0', () => {
  const c = cenarioDeDuas({ itemF8: { etapa: 'execucao' } });
  writeFileSync(join(base, 'painel', 'fila', 'F7.json'), JSON.stringify({ id: 'F7', version: 1, data: { titulo: 'tema', etapa: 'execucao', branch: 'f7-tema' } }));
  const r = concluidas(c, ['--seco']);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(r.json, { seco: true, aptas: [], arquivadas: [], recusadas: [] });
});
