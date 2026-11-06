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
