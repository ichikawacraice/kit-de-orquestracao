// Testes do limpador de disco (F428; nasceu como o limpador de worktrees do F15). Repositório falso em
// diretório temporário, stubs de lsof e gh; HOME e a pasta do kit apontam para o temporário (nunca o ~/.claude real).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, realpathSync, chmodSync, rmSync, utimesSync, symlinkSync, statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const LIMPADOR = process.env.LIMPADOR_SCRIPT || join(AQUI, '..', '..', 'limpeza', 'limpador.mjs'); // LIMPADOR_SCRIPT: prova de mutação
const H = 3600_000;
const GIT_ENV = {
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null',
  GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t',
};

function git(cwd, args, env = {}) {
  return execFileSync('git', args, {
    cwd, env: { ...GIT_ENV, ...env }, encoding: 'utf8', timeout: 30_000, killSignal: 'SIGKILL',
    stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024,
  }).trim();
}

const STUB = `#!${process.execPath}
const fs = require('fs');
const d = process.env.STUB_DIR;
const nome = process.argv[1].split('/').pop();
const cfg = JSON.parse(fs.readFileSync(d + '/' + nome + '.json', 'utf8'));
const cf = d + '/' + nome + '.n';
let n = 0; try { n = Number(fs.readFileSync(cf, 'utf8')); } catch {}
fs.writeFileSync(cf, String(n + 1));
const r = cfg.respostas[Math.min(n, cfg.respostas.length - 1)];
process.stdout.write(r.stdout || '');
process.stderr.write(r.stderr || '');
process.exitCode = r.exit || 0;
`;

// Ambiente falso: origin bare + clone principal + worktrees reais; "agora" fica 3 h à frente do relógio real.
function ambiente() {
  const T = realpathSync(mkdtempSync(join(tmpdir(), 'limp-')));
  const A = Date.now() + 3 * H; // agora do teste
  const origin = join(T, 'origin.git');
  git(T, ['init', '--bare', '-b', 'main', origin]);
  const repo = join(T, 'Principal');
  git(T, ['clone', origin, repo]);
  git(repo, ['remote', 'set-url', 'origin', 'https://github.com/o/n.git']);
  git(repo, ['config', `url.${origin}.insteadOf`, 'https://github.com/o/n.git']);
  writeFileSync(join(repo, '.git', 'info', 'exclude'), '.claude/\n');
  writeFileSync(join(repo, '.gitignore'), 'node_modules/\n.estudos/\n.claude/settings.local.json\n.env\n');
  writeFileSync(join(repo, 'README.md'), 'oi\n');
  writeFileSync(join(repo, 'package.json'), '{}\n');
  const data = (ms) => ({ GIT_AUTHOR_DATE: `${Math.floor(ms / 1000)} +0000`, GIT_COMMITTER_DATE: `${Math.floor(ms / 1000)} +0000` });
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-m', 'inicio'], data(A - 6 * H));
  git(repo, ['push', '-u', 'origin', 'main']);
  for (const d of ['stubs', 'saida', 'sessoes/conta1/org1', 'projetos']) mkdirSync(join(T, d), { recursive: true });
  for (const s of ['lsof', 'gh']) { writeFileSync(join(T, 'stubs', s), STUB); chmodSync(join(T, 'stubs', s), 0o755); }
  const env = {
    T, A, repo, data,
    saida: join(T, 'saida'),
    sessoes: join(T, 'sessoes'),
    appWt: join(T, 'app-worktrees.json'),
    projetos: join(T, 'projetos'),
  };
  setStub(env, 'lsof', [{ stdout: `p1\nfcwd\nn${T}/saida\n` }]);
  setStub(env, 'gh', [{ stdout: '[]' }]);
  sessao(env, 'local_base', { cwd: '/nao/existe/outro', arquivada: true });
  writeFileSync(env.appWt, JSON.stringify({ worktrees: {}, schemaVersion: 1 }));
  writeFileSync(join(env.saida, 'protegidos.txt'), '# nenhum caminho protegido neste ambiente\n');
  return env;
}

function setStub(env, nome, respostas) {
  writeFileSync(join(env.T, 'stubs', `${nome}.json`), JSON.stringify({ respostas }));
  rmSync(join(env.T, 'stubs', `${nome}.n`), { force: true });
}

function sessao(env, id, { cwd, arquivada = false, originCwd, extra = {} }) {
  writeFileSync(join(env.sessoes, 'conta1', 'org1', `${id}.json`),
    JSON.stringify({ sessionId: id, cwd, originCwd: originCwd || cwd, isArchived: arquivada, title: 'x', ...extra }));
}

function novoWt(env, nome, { push = true, commitMs } = {}) {
  const path = join(env.repo, '.claude', 'worktrees', nome);
  git(env.repo, ['worktree', 'add', '-b', `exec/${nome}`, path, 'main']);
  writeFileSync(join(path, `${nome}.txt`), 'a\n');
  git(path, ['add', '-A']);
  git(path, ['commit', '-m', `feat ${nome}`], env.data(commitMs ?? env.A - 5 * H));
  if (push) git(path, ['push', '-u', 'origin', `exec/${nome}`]);
  return path;
}

// Sem `--passos` nos argumentos, roda só o passo worktrees (os testes de builds e logs pedem o deles).
function rodar(env, args = ['--aplicar'], extra = {}) {
  const passos = args.includes('--passos') ? [] : ['--passos', 'worktrees'];
  const repos = env.semRepo ? [] : (env.repos || [env.repo]).flatMap((r) => ['--repo', r]);
  const r = spawnSync(process.execPath, [LIMPADOR, ...repos, ...passos, ...args], {
    env: {
      ...GIT_ENV,
      HOME: join(env.T, 'home'), LIMPADOR_BASE: join(env.T, 'base'),
      LIMPADOR_SESSOES_DIR: env.sessoes, LIMPADOR_APP_WORKTREES: env.appWt, LIMPADOR_PROJETOS_DIR: env.projetos,
      LIMPADOR_LSOF: join(env.T, 'stubs', 'lsof'), LIMPADOR_GH: join(env.T, 'stubs', 'gh'),
      LIMPADOR_AGORA: String(env.A), LIMPADOR_SAIDA_DIR: env.saida, STUB_DIR: join(env.T, 'stubs'),
      ...extra,
    },
    encoding: 'utf8', timeout: 90_000, killSignal: 'SIGKILL', maxBuffer: 16 * 1024 * 1024,
  });
  let json = null;
  try { json = JSON.parse(readFileSync(join(env.saida, 'ultimo-relatorio.json'), 'utf8')); } catch { /* sem relatório */ }
  let md = '';
  try { md = readFileSync(join(env.saida, 'ultimo-relatorio.md'), 'utf8'); } catch { /* idem */ }
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, json, md };
}

// a falha da rodada inteira e as de cada repositório, juntas
const falhas = (j) => [j.falhaFechada, ...(j.repos || []).map((x) => x.falhaFechada)].filter(Boolean).join('\n');
const mantido = (j, p) => j.mantidos.find((x) => x.caminho === p);
const temCriterio = (j, p, n) => Boolean(mantido(j, p)?.motivos.some((m) => m.criterio === n));
const saiu = (j, p) => (j.removidos || []).some((x) => x.caminho === p);
const seria = (j, p) => (j.seriamRemovidos || []).some((x) => x.caminho === p);

// Prova de que o ambiente removeria o worktree (relatório) ANTES de mutar; depois muda uma coisa e roda com --aplicar.
function mantem(nome, criterio, regex, mutar, { nomeWt = 'base' } = {}) {
  it(nome, () => {
    const env = ambiente();
    const wt = novoWt(env, nomeWt);
    const antes = rodar(env, []);
    assert.equal(antes.status, 0, antes.stderr);
    assert.ok(seria(antes.json, wt), 'precondição: o caso-base teria de ser removível');
    mutar(env, wt);
    const r = rodar(env, ['--aplicar']);
    assert.equal(r.status, 0, r.stderr + JSON.stringify(r.json?.erros));
    assert.ok(existsSync(wt), 'o worktree tem de continuar no disco');
    assert.ok(temCriterio(r.json, wt, criterio), `esperava o critério ${criterio} em ${JSON.stringify(mantido(r.json, wt))}`);
    assert.match(r.md, regex);
  });
}

function remove(nome, mutar, { nomeWt = 'base', antesDeMutar } = {}) {
  it(nome, () => {
    const env = ambiente();
    const wt = novoWt(env, nomeWt);
    mutar(env, wt);
    const r = rodar(env, ['--aplicar']);
    assert.equal(r.status, 0, r.stderr + JSON.stringify(r.json?.erros));
    assert.ok(saiu(r.json, wt), `esperava remover; mantidos: ${JSON.stringify(r.json.mantidos)}`);
    assert.ok(!existsSync(wt), 'a pasta tem de sumir');
    assert.equal(git(env.repo, ['rev-parse', '--verify', `refs/heads/exec/${nomeWt}`]).length, 40, 'a branch fica');
  });
}

function falhaFechada(nome, regex, mutar) {
  it(nome, () => {
    const env = ambiente();
    const wt = novoWt(env, 'base');
    const antes = rodar(env, []);
    assert.ok(seria(antes.json, wt), 'precondição: o caso-base teria de ser removível');
    mutar(env, wt);
    const r = rodar(env, ['--aplicar']);
    assert.equal(r.status, 2, r.stdout + r.stderr);
    assert.ok(existsSync(wt));
    assert.match(falhas(r.json), regex);
    assert.deepEqual(r.json.removidos || [], []);
    assert.match(r.md, regex);
  });
}

describe('caso-base', () => {
  it('relatório não remove; --aplicar remove e a branch fica', () => {
    const env = ambiente();
    const wt = novoWt(env, 'base');
    const rel = rodar(env, []);
    assert.equal(rel.status, 0, rel.stderr);
    assert.ok(seria(rel.json, wt));
    assert.ok(existsSync(wt), 'modo relatório não remove');
    assert.match(rel.md, /seri(a|am) removido/i);
    const ap = rodar(env, ['--aplicar']);
    assert.equal(ap.status, 0, ap.stderr + JSON.stringify(ap.json?.erros));
    assert.ok(saiu(ap.json, wt));
    assert.ok(!existsSync(wt));
    assert.ok(!git(env.repo, ['worktree', 'list', '--porcelain']).includes(wt));
    assert.equal(git(env.repo, ['rev-parse', '--verify', 'refs/heads/exec/base']).length, 40);
  });

  it('--se-ligado sem o arquivo aplicar-ligado não remove; com ele remove', () => {
    const env = ambiente();
    const wt = novoWt(env, 'base');
    const r1 = rodar(env, ['--aplicar', '--se-ligado']);
    assert.equal(r1.status, 0, r1.stderr);
    assert.ok(existsSync(wt));
    assert.ok(seria(r1.json, wt));
    assert.match(r1.md, /aplicar-ligado/);
    writeFileSync(join(env.saida, 'aplicar-ligado'), '');
    const r2 = rodar(env, ['--aplicar', '--se-ligado']);
    assert.ok(saiu(r2.json, wt));
    assert.ok(!existsSync(wt));
  });

  it('escreve ultimo-relatorio.md/json e uma linha em historico.log por rodada', () => {
    const env = ambiente();
    novoWt(env, 'base');
    rodar(env, []);
    rodar(env, []);
    const linhas = readFileSync(join(env.saida, 'historico.log'), 'utf8').trim().split('\n');
    assert.equal(linhas.length, 2);
    assert.match(linhas[0], /relat/i);
  });
});

describe('critério 1: principal, protegidos, travado', () => {
  it('o checkout principal nunca é candidato', () => {
    const env = ambiente();
    const wt = novoWt(env, 'base');
    const antes = rodar(env, []);
    assert.ok(seria(antes.json, wt));
    const r = rodar(env, ['--aplicar']);
    assert.ok(temCriterio(r.json, env.repo, 1));
    assert.ok(existsSync(env.repo));
    assert.ok(!seria(r.json, env.repo));
  });
  mantem('protegidos.txt', 1, /protegid/i, (env, wt) => writeFileSync(join(env.saida, 'protegidos.txt'), `# comentário\n${wt}\n`));
  mantem('worktree travado (locked)', 1, /travado|locked/i, (env, wt) => git(env.repo, ['worktree', 'lock', wt]));
});

describe('critério 2: sessão não arquivada', () => {
  mantem('cwd igual ao caminho', 2, /sess[ãa]o/i, (env, wt) => sessao(env, 'local_viva', { cwd: wt }));
  mantem('cwd numa subpasta', 2, /sess[ãa]o/i, (env, wt) => {
    mkdirSync(join(wt, 'sub'));
    sessao(env, 'local_viva', { cwd: join(wt, 'sub') });
  });
  mantem('originCwd dentro do caminho', 2, /sess[ãa]o/i, (env, wt) => sessao(env, 'local_viva', { cwd: '/x', originCwd: wt }));
  mantem('sessão de OUTRA conta também vale', 2, /sess[ãa]o/i, (env, wt) => {
    mkdirSync(join(env.sessoes, 'conta2', 'org2'), { recursive: true });
    writeFileSync(join(env.sessoes, 'conta2', 'org2', 'local_outra.json'),
      JSON.stringify({ sessionId: 'local_outra', cwd: wt, originCwd: wt, isArchived: false }));
  });
  remove('sessão ARQUIVADA com o mesmo cwd não impede', (env, wt) => sessao(env, 'local_morta', { cwd: wt, arquivada: true }));
  remove('sessão não arquivada em caminho-irmão com o mesmo prefixo não impede', (env, wt) => sessao(env, 'local_viva', { cwd: `${wt}-irmao` }));
});

describe('critério 3: processo com cwd dentro', () => {
  mantem('lsof com cwd dentro', 3, /processo/i, (env, wt) => setStub(env, 'lsof', [{ stdout: `p9\nfcwd\nn${wt}/sub\np1\nfcwd\nn${env.T}\n` }]));
  mantem('lsof com cwd igual ao caminho', 3, /processo/i, (env, wt) => setStub(env, 'lsof', [{ stdout: `p9\nfcwd\nn${wt}\n` }]));
  remove('cwd em caminho-irmão com o mesmo prefixo não impede', (env, wt) => setStub(env, 'lsof', [{ stdout: `p9\nfcwd\nn${wt}-irmao\n` }]));
});

describe('critério 4: árvore limpa', () => {
  mantem('arquivo modificado', 4, /suja|modificad|n[ãa]o rastread/i, (env, wt) => writeFileSync(join(wt, 'README.md'), 'mudou\n'));
  mantem('arquivo não rastreado', 4, /suja|modificad|n[ãa]o rastread/i, (env, wt) => writeFileSync(join(wt, 'novo.txt'), 'x\n'));
});

describe('critério 5: todo commit está no GitHub', () => {
  mantem('commit sem push', 5, /sem push/i, (env, wt) => {
    writeFileSync(join(wt, 'novo.txt'), 'x\n');
    git(wt, ['add', '-A']);
    git(wt, ['commit', '-m', 'wip'], env.data(env.A - 5 * H));
  });
  remove('commit sem push, mas HEAD = headRefOid de PR mergeado da branch, não impede', (env, wt) => {
    writeFileSync(join(wt, 'novo.txt'), 'x\n');
    git(wt, ['add', '-A']);
    git(wt, ['commit', '-m', 'wip'], env.data(env.A - 5 * H));
    const oid = git(wt, ['rev-parse', 'HEAD']);
    setStub(env, 'gh', [{ stdout: JSON.stringify([{ number: 7, state: 'MERGED', headRefName: 'exec/base', headRefOid: oid }]) }]);
  });
  mantem('commit sem push; PR mergeado de OUTRA branch não vale', 5, /sem push/i, (env, wt) => {
    writeFileSync(join(wt, 'novo.txt'), 'x\n');
    git(wt, ['add', '-A']);
    git(wt, ['commit', '-m', 'wip'], env.data(env.A - 5 * H));
    const oid = git(wt, ['rev-parse', 'HEAD']);
    setStub(env, 'gh', [{ stdout: JSON.stringify([{ number: 7, state: 'MERGED', headRefName: 'exec/outra', headRefOid: oid }]) }]);
  });
  mantem('HEAD destacado com commit sem push', 5, /sem push/i, (env, wt) => {
    git(wt, ['checkout', '--detach']);
    writeFileSync(join(wt, 'novo.txt'), 'x\n');
    git(wt, ['add', '-A']);
    git(wt, ['commit', '-m', 'solto'], env.data(env.A - 5 * H));
  });
  remove('HEAD destacado em commit que já está no GitHub não impede', (env, wt) => git(wt, ['checkout', '--detach']));
});

describe('critério 6: ignorado fora da lista de regeneráveis', () => {
  mantem('.estudos/nota.md ignorado', 6, /ignorado fora da lista.*\.estudos/is, (env, wt) => {
    mkdirSync(join(wt, '.estudos'));
    writeFileSync(join(wt, '.estudos', 'nota.md'), 'trabalho\n');
  });
  mantem('.env ignorado', 6, /ignorado fora da lista.*\.env/is, (env, wt) => writeFileSync(join(wt, '.env'), 'X=1\n'));
  remove('só node_modules/ e .claude/settings.local.json ignorados não impedem', (env, wt) => {
    mkdirSync(join(wt, 'node_modules', 'x'), { recursive: true });
    writeFileSync(join(wt, 'node_modules', 'x', 'i.js'), '1');
    mkdirSync(join(wt, '.claude'), { recursive: true });
    writeFileSync(join(wt, '.claude', 'settings.local.json'), '{}');
  });
});

describe('critério 7: operação pausada', () => {
  const gitdir = (wt) => git(wt, ['rev-parse', '--absolute-git-dir']);
  mantem('MERGE_HEAD', 7, /opera[çc][ãa]o pausada|merge/i, (env, wt) => writeFileSync(join(gitdir(wt), 'MERGE_HEAD'), `${git(wt, ['rev-parse', 'HEAD'])}\n`));
  mantem('rebase-merge/', 7, /opera[çc][ãa]o pausada|rebase/i, (env, wt) => mkdirSync(join(gitdir(wt), 'rebase-merge')));
});

describe('critério 8: PR aberto', () => {
  mantem('PR aberto da branch', 8, /PR aberto/i, (env) => setStub(env, 'gh', [{ stdout: JSON.stringify([{ number: 9, state: 'OPEN', headRefName: 'exec/base', headRefOid: 'a'.repeat(40) }]) }]));
  remove('PR aberto de OUTRA branch não impede', (env) => setStub(env, 'gh', [{ stdout: JSON.stringify([{ number: 9, state: 'OPEN', headRefName: 'exec/outra', headRefOid: 'a'.repeat(40) }]) }]));
});

describe('critério 9: parado há mais de 2 h', () => {
  mantem('último commit há 1 h', 9, /parado h[áa]/i, (env, wt) => {
    writeFileSync(join(wt, 'novo.txt'), 'x\n');
    git(wt, ['add', '-A']);
    git(wt, ['commit', '-m', 'recente'], env.data(env.A - 1 * H));
    git(wt, ['push']);
  });
  mantem('index tocado há 1 h', 9, /parado h[áa]/i, (env, wt) => {
    const idx = join(git(wt, ['rev-parse', '--absolute-git-dir']), 'index');
    const t = new Date(env.A - 1 * H);
    utimesSync(idx, t, t);
  });
  mantem('transcript do subagente tocado há 1 h', 9, /parado h[áa]/i, (env) => {
    mkdirSync(join(env.projetos, 'p', 's', 'subagents'), { recursive: true });
    const f = join(env.projetos, 'p', 's', 'subagents', 'agent-abc123.jsonl');
    writeFileSync(f, '{}\n');
    const t = new Date(env.A - 1 * H);
    utimesSync(f, t, t);
  }, { nomeWt: 'agent-abc123' });
});

describe('critério 10: reservado pelo app', () => {
  const reg = (env, wt, leasedBy) => writeFileSync(env.appWt, JSON.stringify({ worktrees: { base: { name: 'base', path: wt, leasedBy, pooledAt: 1 } }, schemaVersion: 1 }));
  mantem('entrada com leasedBy nulo', 10, /reservad/i, (env, wt) => reg(env, wt, null));
  remove('entrada com leasedBy de sessão arquivada não impede', (env, wt) => {
    sessao(env, 'local_dona', { cwd: '/x', arquivada: true });
    reg(env, wt, 'local_dona');
  });
});

describe('falha fechada: nada é removido e a saída é 2', () => {
  falhaFechada('registro de sessões vazio', /sess[õo]es/i, (env) => rmSync(join(env.sessoes, 'conta1'), { recursive: true }));
  falhaFechada('um local_*.json ilegível', /ileg[íi]vel|sess[õo]es/i, (env) => writeFileSync(join(env.sessoes, 'conta1', 'org1', 'local_ruim.json'), '{'));
  falhaFechada('lsof saindo com erro', /lsof/i, (env) => setStub(env, 'lsof', [{ exit: 1, stderr: 'boom' }]));
  falhaFechada('lsof saindo com erro MESMO com linhas n na saída', /lsof falhou/i, (env) => setStub(env, 'lsof', [{ exit: 1, stdout: `p1\nfcwd\nn${env.T}/saida\n`, stderr: 'parcial' }]));
  falhaFechada('lsof sem nenhuma linha n', /lsof/i, (env) => setStub(env, 'lsof', [{ stdout: 'p1\n' }]));
  falhaFechada('gh saindo com erro', /gh/i, (env) => setStub(env, 'gh', [{ exit: 1, stderr: 'auth' }]));
  falhaFechada('gh devolvendo texto que não é JSON', /gh/i, (env) => setStub(env, 'gh', [{ stdout: 'não sou json' }]));
  falhaFechada('gh devolvendo JSON que não é lista', /gh devolveu JSON que não é uma lista/i, (env) => setStub(env, 'gh', [{ stdout: '{}' }]));
  falhaFechada('registro de worktrees do app ausente', /worktrees do app|git-worktrees/i, (env) => rmSync(env.appWt));
  falhaFechada('registro de worktrees do app ilegível', /worktrees do app|git-worktrees/i, (env) => writeFileSync(env.appWt, '{'));
  falhaFechada('outra rodada em curso (trava)', /rodada em curso|trava/i, (env) => mkdirSync(join(env.saida, 'limpador.trava')));

  it('trava velha (mais de 1 h) é dada como abandonada, anotada, e a rodada segue', () => {
    const env = ambiente();
    const wt = novoWt(env, 'base');
    const trava = join(env.saida, 'limpador.trava');
    mkdirSync(trava);
    const velha = new Date(Date.now() - 2 * H);
    utimesSync(trava, velha, velha);
    const r = rodar(env, []);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(seria(r.json, wt));
    assert.match(r.md, /trava.*abandonad/i);
    assert.ok(!existsSync(trava), 'a trava é liberada no fim');
  });

  it('repositório que não é git', () => {
    const env = ambiente();
    const r = rodar({ ...env, repo: env.T }, ['--aplicar']);
    assert.equal(r.status, 2, r.stdout + r.stderr);
    assert.match(falhas(r.json), /worktree/i);
  });

  it('a trava não sobra depois de uma rodada normal', () => {
    const env = ambiente();
    novoWt(env, 'base');
    rodar(env, []);
    assert.ok(!existsSync(join(env.saida, 'limpador.trava')));
  });
});

describe('pasta solta', () => {
  it('pasta em .claude/worktrees que não é worktree: relatório "pasta solta" e fica intacta', () => {
    const env = ambiente();
    const wt = novoWt(env, 'base');
    const solta = join(env.repo, '.claude', 'worktrees', 'solta');
    mkdirSync(solta);
    writeFileSync(join(solta, 'importante.txt'), 'x');
    const r = rodar(env, ['--aplicar']);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(saiu(r.json, wt));
    assert.ok(r.json.pastasSoltas.some((p) => p.caminho === solta));
    assert.match(r.md, /pasta solta/i);
    assert.ok(existsSync(join(solta, 'importante.txt')));
  });
});

describe('corrida: reconferência antes de remover', () => {
  it('lsof limpo na primeira chamada e com cwd dentro na segunda: o worktree fica', () => {
    const env = ambiente();
    const wt = novoWt(env, 'base');
    setStub(env, 'lsof', [{ stdout: `p1\nfcwd\nn${env.T}/saida\n` }, { stdout: `p9\nfcwd\nn${wt}\n` }]);
    const r = rodar(env, ['--aplicar']);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(existsSync(wt));
    assert.ok(!saiu(r.json, wt));
    assert.ok(temCriterio(r.json, wt, 3), JSON.stringify(r.json.mantidos));
  });

  it('arquivo sujo que aparece entre a medição e a remoção: o worktree fica', () => {
    const env = ambiente();
    const wt = novoWt(env, 'base');
    // o stub de lsof (chamado de novo na reconferência) suja a árvore antes de responder
    const sujo = join(wt, 'chegou-agora.txt');
    writeFileSync(join(env.T, 'stubs', 'lsof'), `#!${process.execPath}
const fs = require('fs');
const d = process.env.STUB_DIR;
let n = 0; try { n = Number(fs.readFileSync(d + '/lsof.n', 'utf8')); } catch {}
fs.writeFileSync(d + '/lsof.n', String(n + 1));
if (n >= 1) fs.writeFileSync(${JSON.stringify(sujo)}, 'x');
process.stdout.write('p1\\nfcwd\\nn${env.T}/saida\\n');
`);
    const r = rodar(env, ['--aplicar']);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(existsSync(wt));
    assert.ok(temCriterio(r.json, wt, 4), JSON.stringify(r.json.mantidos));
  });
});

describe('recusa do git', () => {
  it('git worktree remove recusando é registrado inteiro e a rodada segue com o próximo', () => {
    const env = ambiente();
    const a = novoWt(env, 'a');
    const b = novoWt(env, 'b');
    // um .git/worktrees/<nome>/locked escrito DEPOIS da medição faria o git recusar; simulamos com o lsof falso
    writeFileSync(join(env.T, 'stubs', 'lsof'), `#!${process.execPath}
const fs = require('fs');
const d = process.env.STUB_DIR;
let n = 0; try { n = Number(fs.readFileSync(d + '/lsof.n', 'utf8')); } catch {}
fs.writeFileSync(d + '/lsof.n', String(n + 1));
if (n >= 1) { try { fs.writeFileSync(${JSON.stringify(join(env.repo, '.git', 'worktrees', 'a', 'locked'))}, 'trava tardia'); } catch {} }
process.stdout.write('p1\\nfcwd\\nn${env.T}/saida\\n');
`);
    const r = rodar(env, ['--aplicar']);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.ok(existsSync(a));
    assert.ok(!existsSync(b));
    assert.ok(r.json.erros.some((e) => /locked|travad/i.test(e.mensagem)), JSON.stringify(r.json.erros));
    assert.ok(saiu(r.json, b));
  });
});

describe('consertos do laudo da V1 (B1–B4 e os dois mutantes que sobreviveram)', () => {
  // B1: o protegidos.txt ilegível é falha fechada (a lista existe e não sei o que ela protege). Ausente vale lista
  // vazia desde a F428: o kit roda em máquina nova, onde ninguém escreveu a lista ainda.
  remove('B1: protegidos.txt ausente vale lista vazia', (env) => rmSync(join(env.saida, 'protegidos.txt')));
  falhaFechada('B1: protegidos.txt ilegível', /protegidos/i, (env) => chmodSync(join(env.saida, 'protegidos.txt'), 0o000));

  // B2: o git status confia no índice; skip-worktree e assume-unchanged escondem mudança.
  mantem('B2: arquivo modificado com skip-worktree', 4, /skip-worktree|assume-unchanged|marca/i, (env, wt) => {
    writeFileSync(join(wt, 'README.md'), 'mudou escondido\n');
    git(wt, ['update-index', '--skip-worktree', 'README.md']);
  });
  mantem('B2: arquivo modificado com assume-unchanged', 4, /skip-worktree|assume-unchanged|marca/i, (env, wt) => {
    writeFileSync(join(wt, 'README.md'), 'mudou escondido\n');
    git(wt, ['update-index', '--assume-unchanged', 'README.md']);
  });

  // B3: regenerável se decide pelo caminho que o git reporta como ignorado, não por um segmento no meio.
  mantem('B3: .estudos/ ignorado inteiro com dist/ dentro', 6, /ignorado fora da lista.*\.estudos/is, (env, wt) => {
    mkdirSync(join(wt, '.estudos', 'dist'), { recursive: true });
    writeFileSync(join(wt, '.estudos', 'dist', 'nota.md'), 'trabalho\n');
  });
  mantem('B3: .estudos/ ignorado inteiro com node_modules/ dentro', 6, /ignorado fora da lista.*\.estudos/is, (env, wt) => {
    mkdirSync(join(wt, '.estudos', 'node_modules', 'x'), { recursive: true });
    writeFileSync(join(wt, '.estudos', 'node_modules', 'x', 'nota.md'), 'trabalho\n');
  });

  // B4: sessão viva protege por mais que o cwd, e o registro tem de ser lido por completo.
  mantem('B4: pasta de conta ligada por symlink com sessão viva no worktree', 2, /sess[ãa]o/i, (env, wt) => {
    const fora = join(env.T, 'conta-externa', 'org1');
    mkdirSync(fora, { recursive: true });
    writeFileSync(join(fora, 'local_viva.json'), JSON.stringify({ sessionId: 'local_viva', cwd: wt, originCwd: wt, isArchived: false, title: 'viva' }));
    symlinkSync(join(env.T, 'conta-externa'), join(env.sessoes, 'conta2'));
  });
  mantem('B4: worktree em sessionPermissionUpdates[addDirectories].directories, com o cwd fora (formato real)', 2, /sess[ãa]o/i, (env, wt) => sessao(env, 'local_viva', { cwd: '/fora/de/tudo', extra: { sessionPermissionUpdates: [{ type: 'addRules', rules: [] }, { type: 'addDirectories', directories: ['/outro/lugar', wt], destination: 'session' }] } }));
  mantem('B4: subpasta do worktree em addDirectories (formato real)', 2, /sess[ãa]o/i, (env, wt) => {
    mkdirSync(join(wt, 'sub'), { recursive: true });
    sessao(env, 'local_viva', { cwd: '/fora/de/tudo', extra: { sessionPermissionUpdates: [{ type: 'addDirectories', directories: [join(wt, 'sub')], destination: 'session' }] } });
  });
  remove('B4: addDirectories para o checkout principal (ancestral) NÃO protege o worktree', (env) => sessao(env, 'local_viva', { cwd: '/fora/de/tudo', extra: { sessionPermissionUpdates: [{ type: 'addDirectories', directories: [env.repo], destination: 'session' }] } }));
  remove('B4: symlink em laço no registro de sessões termina e a rodada segue (guarda de laço)', (env) => symlinkSync(env.sessoes, join(env.sessoes, 'conta2')));
  mantem('B4: `worktreePath` da sessão com o cwd fora', 2, /sess[ãa]o/i, (env, wt) => sessao(env, 'local_viva', { cwd: '/fora/de/tudo', extra: { worktreePath: wt } }));
  mantem('B4: cwd da sessão por um symlink para o worktree (realpath dos dois lados)', 2, /sess[ãa]o/i, (env, wt) => {
    const elo = join(env.T, 'elo-do-worktree');
    symlinkSync(wt, elo);
    sessao(env, 'local_viva', { cwd: elo });
  });

  // B3-bis: o git reporta a SUBPASTA quando o padrão do gitignore é de conteúdo (`dir/*`, `dir/**`);
  // regenerável só se o nome casa a lista E a pasta-mãe tem arquivo rastreado (a raiz conta).
  const exclui = (env, ...padroes) => writeFileSync(join(env.repo, '.git', 'info', 'exclude'), `.claude/\n${padroes.join('\n')}\n`);
  mantem('B3-bis: `notas/*` no gitignore e notas/dist/nota.md', 6, /ignorado fora da lista.*notas/is, (env, wt) => {
    exclui(env, 'notas/*');
    mkdirSync(join(wt, 'notas', 'dist'), { recursive: true });
    writeFileSync(join(wt, 'notas', 'dist', 'nota.md'), 'trabalho\n');
  });
  mantem('B3-bis: `rascunhos/**` no gitignore e rascunhos/node_modules/nota.md', 6, /ignorado fora da lista.*rascunhos/is, (env, wt) => {
    exclui(env, 'rascunhos/**');
    mkdirSync(join(wt, 'rascunhos', 'node_modules'), { recursive: true });
    writeFileSync(join(wt, 'rascunhos', 'node_modules', 'nota.md'), 'trabalho\n');
  });
  remove('B3-bis: apps/web/.next/ (a pasta-mãe tem arquivo rastreado) continua regenerável', (env, wt) => {
    exclui(env, '.next/');
    mkdirSync(join(wt, 'apps', 'web', '.next'), { recursive: true });
    writeFileSync(join(wt, 'apps', 'web', '.next', 'cache'), 'x\n');
    writeFileSync(join(wt, 'apps', 'web', 'package.json'), '{}\n');
    git(wt, ['add', '-A']); git(wt, ['commit', '-m', 'web'], env.data(env.A - 5 * H)); git(wt, ['push', 'origin', 'HEAD']);
  });
  remove('B3-bis: node_modules/ na raiz continua regenerável (a raiz conta)', (env, wt) => {
    mkdirSync(join(wt, 'node_modules', 'x'), { recursive: true });
    writeFileSync(join(wt, 'node_modules', 'x', 'i.js'), 'x\n');
  });
  // B3-ter: a pasta-mãe tem rastreado só por causa de um `!` (.gitkeep/README); o padrão que ignorou é `dir/*`, que não
  // nomeia nada regenerável. A decisão é a REGRA que ignorou o caminho (`git check-ignore -v`), a pasta-mãe é a segunda condição.
  mantem('B3-ter: `.notas/*` + `!.notas/.gitkeep` rastreado e .notas/dist/nota.md', 6, /ignorado fora da lista.*\.notas/is, (env, wt) => {
    exclui(env, '.notas/*', '!.notas/.gitkeep');
    mkdirSync(join(wt, '.notas', 'dist'), { recursive: true });
    writeFileSync(join(wt, '.notas', '.gitkeep'), '');
    git(wt, ['add', '-f', '.notas/.gitkeep']); git(wt, ['commit', '-m', 'gitkeep'], env.data(env.A - 5 * H)); git(wt, ['push', 'origin', 'HEAD']);
    writeFileSync(join(wt, '.notas', 'dist', 'nota.md'), 'trabalho\n');
  });
  mantem('B3-ter: `rascunhos/**` + `!rascunhos/README.md` rastreado e rascunhos/node_modules/nota.md', 6, /ignorado fora da lista.*rascunhos/is, (env, wt) => {
    exclui(env, 'rascunhos/**', '!rascunhos/README.md');
    mkdirSync(join(wt, 'rascunhos', 'node_modules'), { recursive: true });
    writeFileSync(join(wt, 'rascunhos', 'README.md'), 'r\n');
    writeFileSync(join(wt, 'rascunhos', 'package.json'), '{}\n'); git(wt, ['add', '-f', 'rascunhos/README.md', 'rascunhos/package.json']); git(wt, ['commit', '-m', 'readme'], env.data(env.A - 5 * H)); git(wt, ['push', 'origin', 'HEAD']);
    writeFileSync(join(wt, 'rascunhos', 'node_modules', 'nota.md'), 'trabalho\n');
  });
  // regra de pasta (`lib/*/`) que ignora cada subpasta: o `lib/dist/` é trabalho; a sonda (arquivo) não é ignorada, só o padrão denuncia.
  mantem('B3-ter: `lib/*/` ignora as subpastas e lib/dist/nota.md', 6, /ignorado fora da lista.*lib/is, (env, wt) => {
    exclui(env, 'lib/*/');
    mkdirSync(join(wt, 'lib', 'dist'), { recursive: true });
    writeFileSync(join(wt, 'lib', 'a.txt'), 'a\n');
    git(wt, ['add', '-A']); git(wt, ['commit', '-m', 'lib'], env.data(env.A - 5 * H)); git(wt, ['push', 'origin', 'HEAD']);
    writeFileSync(join(wt, 'lib', 'dist', 'nota.md'), 'trabalho\n');
  });
  // S14: `dist/` genérico no .gitignore (vence o info/exclude) + `rascunhos/*` + `!rascunhos/.*` (mantém os ocultos):
  // a sonda com ponto sai não ignorada; só a sem ponto mostra que a pasta é de trabalho.
  const commitarTudo = (env, wt, msg) => { git(wt, ['add', '-A']); git(wt, ['commit', '-m', msg], env.data(env.A - 5 * H)); git(wt, ['push', 'origin', 'HEAD']); };
  mantem('S14: `dist/` genérico + `rascunhos/*` + `!rascunhos/.*` + .gitkeep rastreado + rascunhos/dist/nota.md', 6, /ignorado fora da lista.*rascunhos/is, (env, wt) => {
    writeFileSync(join(wt, '.gitignore'), 'node_modules/\ndist/\n.estudos/\n.claude/settings.local.json\n.env\n'); commitarTudo(env, wt, 'gi');
    exclui(env, 'rascunhos/*', '!rascunhos/.*');
    mkdirSync(join(wt, 'rascunhos'), { recursive: true }); writeFileSync(join(wt, 'rascunhos', '.gitkeep'), ''); commitarTudo(env, wt, 'gk');
    mkdirSync(join(wt, 'rascunhos', 'dist'), { recursive: true }); writeFileSync(join(wt, 'rascunhos', 'dist', 'nota.md'), 't\n');
  });
  mantem('S15 (controle): igual ao S14 sem o `dist/` genérico', 6, /ignorado fora da lista.*rascunhos/is, (env, wt) => {
    exclui(env, 'rascunhos/*', '!rascunhos/.*');
    mkdirSync(join(wt, 'rascunhos'), { recursive: true }); writeFileSync(join(wt, 'rascunhos', '.gitkeep'), ''); commitarTudo(env, wt, 'gk');
    mkdirSync(join(wt, 'rascunhos', 'dist'), { recursive: true }); writeFileSync(join(wt, 'rascunhos', 'dist', 'nota.md'), 't\n');
  });
  // S16–S19: a regra que cobre `rascunhos/` não precisa ser a que a sonda-arquivo imagina; a sonda tem o formato do caminho real.
  mantem('S16: `dist/` genérico + `rascunhos/*` + `!rascunhos/.*` + `!rascunhos/limpador-*`', 6, /ignorado fora da lista.*rascunhos/is, (env, wt) => {
    writeFileSync(join(wt, '.gitignore'), 'node_modules/\ndist/\n.estudos/\n.claude/settings.local.json\n.env\n'); commitarTudo(env, wt, 'gi');
    exclui(env, 'rascunhos/*', '!rascunhos/.*', '!rascunhos/limpador-*');
    mkdirSync(join(wt, 'rascunhos'), { recursive: true }); writeFileSync(join(wt, 'rascunhos', '.gitkeep'), 'x\n'); writeFileSync(join(wt, 'rascunhos', 'package.json'), '{}\n'); git(wt, ['add', '-f', 'rascunhos/.gitkeep', 'rascunhos/package.json']); git(wt, ['commit', '-m', 'gk'], env.data(env.A - 5 * H)); git(wt, ['push', 'origin', 'HEAD']);
    mkdirSync(join(wt, 'rascunhos', 'dist'), { recursive: true }); writeFileSync(join(wt, 'rascunhos', 'dist', 'nota.md'), 't\n');
  });
  mantem('S17: `dist/` genérico + `rascunhos/*` + `!rascunhos/*sonda*`', 6, /ignorado fora da lista.*rascunhos/is, (env, wt) => {
    writeFileSync(join(wt, '.gitignore'), 'node_modules/\ndist/\n.estudos/\n.claude/settings.local.json\n.env\n'); commitarTudo(env, wt, 'gi');
    exclui(env, 'rascunhos/*', '!rascunhos/*sonda*');
    mkdirSync(join(wt, 'rascunhos'), { recursive: true }); writeFileSync(join(wt, 'rascunhos', 'README.md'), 'x\n'); writeFileSync(join(wt, 'rascunhos', 'package.json'), '{}\n'); git(wt, ['add', '-f', 'rascunhos/README.md', 'rascunhos/package.json']); git(wt, ['commit', '-m', 'gk'], env.data(env.A - 5 * H)); git(wt, ['push', 'origin', 'HEAD']);
    mkdirSync(join(wt, 'rascunhos', 'dist'), { recursive: true }); writeFileSync(join(wt, 'rascunhos', 'dist', 'nota.md'), 't\n');
  });
  mantem('S18: `dist/` genérico + `rascunhos/*/` (só subpastas, sem negação)', 6, /ignorado fora da lista.*rascunhos/is, (env, wt) => {
    writeFileSync(join(wt, '.gitignore'), 'node_modules/\ndist/\n.estudos/\n.claude/settings.local.json\n.env\n'); commitarTudo(env, wt, 'gi');
    exclui(env, 'rascunhos/*/');
    mkdirSync(join(wt, 'rascunhos'), { recursive: true }); writeFileSync(join(wt, 'rascunhos', 'README.md'), 'x\n'); writeFileSync(join(wt, 'rascunhos', 'package.json'), '{}\n'); git(wt, ['add', '-f', 'rascunhos/README.md', 'rascunhos/package.json']); git(wt, ['commit', '-m', 'gk'], env.data(env.A - 5 * H)); git(wt, ['push', 'origin', 'HEAD']);
    mkdirSync(join(wt, 'rascunhos', 'dist'), { recursive: true }); writeFileSync(join(wt, 'rascunhos', 'dist', 'nota.md'), 't\n');
  });
  mantem('S19: `dist/` genérico + `rascunhos/*` + `!rascunhos/*-*`', 6, /ignorado fora da lista.*rascunhos/is, (env, wt) => {
    writeFileSync(join(wt, '.gitignore'), 'node_modules/\ndist/\n.estudos/\n.claude/settings.local.json\n.env\n'); commitarTudo(env, wt, 'gi');
    exclui(env, 'rascunhos/*', '!rascunhos/*-*');
    mkdirSync(join(wt, 'rascunhos'), { recursive: true }); writeFileSync(join(wt, 'rascunhos', 'README.md'), 'x\n'); writeFileSync(join(wt, 'rascunhos', 'package.json'), '{}\n'); git(wt, ['add', '-f', 'rascunhos/README.md', 'rascunhos/package.json']); git(wt, ['commit', '-m', 'gk'], env.data(env.A - 5 * H)); git(wt, ['push', 'origin', 'HEAD']);
    mkdirSync(join(wt, 'rascunhos', 'dist'), { recursive: true }); writeFileSync(join(wt, 'rascunhos', 'dist', 'nota.md'), 't\n');
  });
  // (b) sozinho: a regra deixa a sonda passar (só `dist/` genérico), mas a pasta-mãe rastreada não tem package.json.
  mantem('pasta rastreada sem package.json: docs/dist/nota.md com `dist/` genérico', 6, /ignorado fora da lista.*docs/is, (env, wt) => {
    writeFileSync(join(wt, '.gitignore'), 'node_modules/\ndist/\n.estudos/\n.claude/settings.local.json\n.env\n'); commitarTudo(env, wt, 'gi');
    mkdirSync(join(wt, 'docs', 'dist'), { recursive: true }); writeFileSync(join(wt, 'docs', 'a.md'), 'a\n'); commitarTudo(env, wt, 'docs');
    writeFileSync(join(wt, 'docs', 'dist', 'nota.md'), 't\n');
  });
  // S13 (controle): apps/web/dist com package.json rastreado continua removível.
  remove('S13: apps/web/dist com package.json rastreado e `dist/` genérico continua regenerável', (env, wt) => {
    writeFileSync(join(wt, '.gitignore'), 'node_modules/\ndist/\n.estudos/\n.claude/settings.local.json\n.env\n'); commitarTudo(env, wt, 'gi');
    mkdirSync(join(wt, 'apps', 'web', 'dist'), { recursive: true }); writeFileSync(join(wt, 'apps', 'web', 'package.json'), '{}\n'); commitarTudo(env, wt, 'web');
    writeFileSync(join(wt, 'apps', 'web', 'dist', 'i.js'), 'x\n');
  });
  // dois segmentos regeneráveis no caminho: trocar só um deixaria a sonda cair em `node_modules/` e manteria o que é build.
  remove('dois segmentos regeneráveis (apps/web/dist/node_modules/) continuam regeneráveis', (env, wt) => {
    exclui(env, 'apps/web/dist/*');
    mkdirSync(join(wt, 'apps', 'web', 'dist', 'node_modules'), { recursive: true });
    writeFileSync(join(wt, 'apps', 'web', 'package.json'), '{}\n'); commitarTudo(env, wt, 'web');
    writeFileSync(join(wt, 'apps', 'web', 'dist', 'node_modules', 'i.js'), 'x\n');
  });
  // R3: erro da sonda (status nem 0 nem 1) não vira "não ignorada": o git de teste falha só em `check-ignore -q`.
  it('R3: erro da sonda mantém o worktree (apps/web/.next/ seria regenerável)', () => {
    const env = ambiente();
    const wt = novoWt(env, 'base');
    exclui(env, '.next/');
    mkdirSync(join(wt, 'apps', 'web', '.next'), { recursive: true });
    writeFileSync(join(wt, 'apps', 'web', '.next', 'cache'), 'x\n');
    writeFileSync(join(wt, 'apps', 'web', 'package.json'), '{}\n');
    commitarTudo(env, wt, 'web');
    assert.ok(seria(rodar(env, []).json, wt), 'precondição: sem o erro o worktree seria removível');
    const falho = join(env.T, 'stubs', 'git-sonda-falha');
    writeFileSync(falho, '#!/bin/sh\nfor a in "$@"; do if [ "$a" = -q ]; then echo "fatal: erro de teste" >&2; exit 128; fi; done\nexec git "$@"\n');
    chmodSync(falho, 0o755);
    const r = rodar(env, ['--aplicar'], { LIMPADOR_GIT: falho });
    assert.equal(r.status, 0, r.stderr + JSON.stringify(r.json?.erros));
    assert.ok(existsSync(wt), 'o worktree tem de continuar no disco');
    assert.ok(temCriterio(r.json, wt, 6), JSON.stringify(mantido(r.json, wt)));
    assert.ok(!saiu(r.json, wt));
  });
  // R7-2: erro do `ls-files --error-unmatch` (a trava do package.json) não vira "tem package.json": o git de teste falha só nessa chamada.
  it('R7-2: erro do ls-files na trava do package.json mantém o worktree (apps/web/.next/ seria regenerável)', () => {
    const env = ambiente();
    const wt = novoWt(env, 'base');
    exclui(env, '.next/');
    mkdirSync(join(wt, 'apps', 'web', '.next'), { recursive: true });
    writeFileSync(join(wt, 'apps', 'web', '.next', 'cache'), 'x\n');
    writeFileSync(join(wt, 'apps', 'web', 'package.json'), '{}\n');
    commitarTudo(env, wt, 'web');
    assert.ok(seria(rodar(env, []).json, wt), 'precondição: sem o erro o worktree seria removível');
    const falho = join(env.T, 'stubs', 'git-lsfiles-falha');
    writeFileSync(falho, '#!/bin/sh\nfor a in "$@"; do if [ "$a" = --error-unmatch ]; then echo "fatal: erro de teste" >&2; exit 128; fi; done\nexec git "$@"\n');
    chmodSync(falho, 0o755);
    const r = rodar(env, ['--aplicar'], { LIMPADOR_GIT: falho });
    assert.equal(r.status, 0, r.stderr + JSON.stringify(r.json?.erros));
    assert.ok(existsSync(wt), 'o worktree tem de continuar no disco');
    assert.ok(temCriterio(r.json, wt, 6), JSON.stringify(mantido(r.json, wt)));
    assert.ok(!saiu(r.json, wt));
  });
  // R7-1: `.next-<porta>` (o que um app Next com várias portas gera) é regenerável; qualquer outro `.next-*` ignorado é pasta de trabalho.
  mantem('R7-1: `.next-ideias/` ignorada à mão com trabalho dentro', 6, /ignorado fora da lista.*\.next-ideias/is, (env, wt) => {
    exclui(env, '.next-ideias/');
    mkdirSync(join(wt, '.next-ideias'), { recursive: true });
    writeFileSync(join(wt, '.next-ideias', 'nota.md'), 'trabalho\n');
  });
  remove('R7-1 (controle): `.next-3000/` continua regenerável', (env, wt) => {
    exclui(env, '.next-3000/');
    mkdirSync(join(wt, '.next-3000'), { recursive: true });
    writeFileSync(join(wt, '.next-3000', 'cache'), 'x\n');
  });
  // B3b: a pasta ignorada que o git reporta e que o ls-files não consegue abrir (sem permissão de leitura) conta como trabalho.
  mantem('B3b: pasta ignorada que não consigo abrir', 6, /ignorado fora da lista.*\.estudos/is, (env, wt) => {
    mkdirSync(join(wt, '.estudos'), { recursive: true });
    writeFileSync(join(wt, '.estudos', 'nota.md'), 'trabalho\n');
    chmodSync(join(wt, '.estudos'), 0o000);
    process.on('exit', () => { try { chmodSync(join(wt, '.estudos'), 0o755); } catch { /* já removida */ } });
  });

  // mutante M-gh: sair com erro mas imprimir uma lista válida não pode passar.
  falhaFechada('gh saindo com erro e imprimindo [] no stdout', /gh falhou/i, (env) => setStub(env, 'gh', [{ exit: 1, stdout: '[]', stderr: 'auth' }]));

  // mutante Mprunable: worktree registrado cuja pasta sumiu fica com o motivo certo.
  it('worktree registrado com a pasta apagada: mantido com o motivo "a pasta não existe mais"', () => {
    const env = ambiente();
    const wt = novoWt(env, 'base');
    assert.ok(seria(rodar(env, []).json, wt), 'precondição: o caso-base teria de ser removível');
    rmSync(wt, { recursive: true, force: true });
    const r = rodar(env, ['--aplicar']);
    assert.equal(r.status, 0, r.stderr + JSON.stringify(r.json?.erros));
    assert.ok(mantido(r.json, wt)?.motivos.some((m) => /pasta não existe mais/.test(m.texto)), JSON.stringify(mantido(r.json, wt)));
    assert.match(r.md, /a pasta não existe mais/);
    assert.ok(!saiu(r.json, wt));
  });
});

// ---------- F428: critério 9 corrigido, vários repositórios, builds, logs, plist ----------
const gitdirDe = (wt) => git(wt, ['rev-parse', '--absolute-git-dir']);
const tocar = (p, ms) => { const t = new Date(ms); utimesSync(p, t, t); };

describe('F428: critério 9 pelo conteúdo do reflog e pelo transcript da sessão', () => {
  remove('reflog regravado pelo gc (mtime novo, sem entrada nova) não conta como atividade', (env, wt) => {
    const arq = join(gitdirDe(wt), 'logs', 'HEAD');
    assert.ok(readFileSync(arq, 'utf8').trim().length > 0, 'precondição: o reflog existe e tem entrada');
    tocar(arq, env.A - 1 * H);
  });
  mantem('entrada nova no reflog há 1 h conta', 9, /pelo reflog/i, (env, wt) => {
    git(wt, ['reset', '--hard', 'HEAD'], env.data(env.A - 1 * H));
  });
  mantem('transcript da sessão cujo cwd é a worktree, tocado há 1 h, conta', 9, /transcript da sess/i, (env, wt) => {
    const d = join(env.projetos, wt.replace(/[^a-zA-Z0-9]/g, '-'));
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, 'abc.jsonl'), '{}\n');
    tocar(join(d, 'abc.jsonl'), env.A - 1 * H);
  });
});

// Um segundo clone do mesmo origin, com outra origin no GitHub (ou fora dele) e uma worktree pronta para sair.
function outroRepo(env, nome, { github = true } = {}) {
  const origin = join(env.T, 'origin.git');
  const r = join(env.T, nome);
  git(env.T, ['clone', origin, r]);
  if (github) {
    git(r, ['remote', 'set-url', 'origin', 'https://github.com/o/m.git']);
    git(r, ['config', `url.${origin}.insteadOf`, 'https://github.com/o/m.git']);
  }
  writeFileSync(join(r, '.git', 'info', 'exclude'), '.claude/\n');
  const wt = join(r, '.claude', 'worktrees', `wt-${nome}`);
  git(r, ['worktree', 'add', '-b', `exec/${nome}`, wt, 'main']);
  writeFileSync(join(wt, 'x.txt'), 'x\n');
  git(wt, ['add', '-A']);
  git(wt, ['commit', '-m', nome], env.data(env.A - 5 * H));
  git(wt, ['push', '-u', 'origin', `exec/${nome}`]);
  return { repo: r, wt };
}

describe('F428: vários repositórios', () => {
  it('dois repositórios numa rodada: os dois perdem a worktree parada', () => {
    const env = ambiente();
    const wt1 = novoWt(env, 'base');
    const b = outroRepo(env, 'Outro');
    const r = rodar({ ...env, repos: [env.repo, b.repo] }, ['--aplicar']);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(r.json.repos.length, 2);
    assert.ok(saiu(r.json, wt1) && saiu(r.json, b.wt), JSON.stringify(r.json.mantidos));
    assert.ok(!existsSync(wt1) && !existsSync(b.wt));
  });
  it('repositório fora do GitHub fica de fora do passo worktrees como aviso: o outro segue e a saída é 0', () => {
    const env = ambiente();
    const wt1 = novoWt(env, 'base');
    const b = outroRepo(env, 'Local', { github: false });
    const r = rodar({ ...env, repos: [env.repo, b.repo] }, ['--aplicar']);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(falhas(r.json), '', 'não é falha: é o estado do repositório');
    const fora = r.json.repos.filter((x) => x.foraDoPasso);
    assert.equal(fora.length, 1, JSON.stringify(r.json.repos));
    assert.match(fora[0].foraDoPasso, /GitHub/);
    assert.ok(saiu(r.json, wt1), 'o repositório do GitHub segue');
    assert.ok(existsSync(b.wt), 'a worktree do repositório sem GitHub fica');
    assert.match(r.md, /fora do passo worktrees/);
  });
  it('repositório sem origin também é aviso, não falha; gh quebrado segue saída 2 (o contraste)', () => {
    const env = ambiente();
    novoWt(env, 'base');
    const b = outroRepo(env, 'SemOrigin', { github: false });
    git(b.repo, ['remote', 'remove', 'origin']);
    const r = rodar({ ...env, repos: [env.repo, b.repo] }, []);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.json.repos.find((x) => x.foraDoPasso)?.foraDoPasso || '', /não tem origin/);
    setStub(env, 'gh', [{ exit: 1, stdout: '', stderr: 'auth' }]);
    const r2 = rodar({ ...env, repos: [env.repo, b.repo] }, []);
    assert.equal(r2.status, 2, r2.stdout + r2.stderr);
    assert.match(falhas(r2.json), /gh falhou/);
  });
  it('sem --repo, descobre os repositórios pelo registro do app (baseRepo) e pelas sessões, arquivadas inclusive', () => {
    const env = ambiente();
    const wt1 = novoWt(env, 'base');
    const b = outroRepo(env, 'Descoberto');
    writeFileSync(env.appWt, JSON.stringify({ worktrees: { x: { name: 'x', path: '/nao/existe/wt', leasedBy: 'local_y', baseRepo: env.repo } }, schemaVersion: 1 }));
    sessao(env, 'local_velha', { cwd: b.wt, arquivada: true });
    const r = rodar({ ...env, semRepo: true }, []);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.deepEqual(r.json.repos.map((x) => x.repo).sort(), [env.repo, b.repo].sort());
    assert.ok(seria(r.json, wt1) && seria(r.json, b.wt), JSON.stringify(r.json.mantidos));
  });
});

describe('F428: passo builds', () => {
  // worktree que fica (.estudos/ é trabalho ignorado, critério 6) com node_modules regenerável
  const montar = () => {
    const env = ambiente();
    const wt = novoWt(env, 'base');
    mkdirSync(join(wt, 'node_modules', 'pacote'), { recursive: true });
    writeFileSync(join(wt, 'node_modules', 'pacote', 'index.js'), 'x'.repeat(4096));
    mkdirSync(join(wt, '.estudos'), { recursive: true });
    writeFileSync(join(wt, '.estudos', 'notas.md'), 'meu trabalho\n');
    mkdirSync(join(env.repo, 'node_modules', 'p'), { recursive: true });
    writeFileSync(join(env.repo, 'node_modules', 'p', 'i.js'), 'x');
    return { env, wt };
  };
  const PASSOS = ['--passos', 'worktrees,builds'];
  it('worktree parada há mais de 7 dias: relatório só lista; --aplicar apaga node_modules e a worktree fica', () => {
    const { env, wt } = montar();
    const longe = { LIMPADOR_AGORA: String(env.A + 8 * 24 * H) };
    const rel = rodar(env, PASSOS, longe);
    assert.equal(rel.status, 0, rel.stdout + rel.stderr);
    assert.ok(temCriterio(rel.json, wt, 6), 'precondição: a worktree fica pelo .estudos');
    const item = rel.json.builds.seriamLiberados.find((x) => x.caminho === wt);
    assert.ok(item, JSON.stringify(rel.json.builds));
    assert.deepEqual(item.pastas.map((p) => p.caminho), ['node_modules']);
    assert.ok(existsSync(join(wt, 'node_modules')), 'o relatório não apaga');
    assert.match(rel.md, /Builds que seriam liberados/);
    const ap = rodar(env, ['--aplicar', ...PASSOS], longe);
    assert.equal(ap.status, 0, ap.stdout + ap.stderr + JSON.stringify(ap.json?.erros));
    assert.ok(ap.json.builds.liberados.some((x) => x.caminho === wt));
    assert.ok(!existsSync(join(wt, 'node_modules')), 'node_modules sai');
    assert.ok(existsSync(join(wt, '.estudos', 'notas.md')), '.estudos fica');
    assert.ok(existsSync(join(wt, 'base.txt')), 'a worktree fica');
    assert.ok(existsSync(join(env.repo, 'node_modules')), 'o checkout principal nunca perde o build');
  });
  it('worktree parada há menos de 7 dias: não mexe no build', () => {
    const { env, wt } = montar();
    const ap = rodar(env, ['--aplicar', ...PASSOS]);
    assert.equal(ap.status, 0, ap.stdout + ap.stderr);
    assert.deepEqual(ap.json.builds.liberados, []);
    assert.ok(existsSync(join(wt, 'node_modules')));
  });
  it('sessão viva na worktree: não mexe no build', () => {
    const { env, wt } = montar();
    sessao(env, 'local_viva', { cwd: wt });
    const ap = rodar(env, ['--aplicar', ...PASSOS], { LIMPADOR_AGORA: String(env.A + 8 * 24 * H) });
    assert.equal(ap.status, 0, ap.stdout + ap.stderr);
    assert.deepEqual(ap.json.builds.liberados, []);
    assert.ok(existsSync(join(wt, 'node_modules')));
  });
  it('node_modules que é elo simbólico para fora fica', () => {
    const { env, wt } = montar();
    rmSync(join(wt, 'node_modules'), { recursive: true });
    const fora = join(env.T, 'fora-nm');
    mkdirSync(fora);
    writeFileSync(join(fora, 'vivo.js'), 'x');
    symlinkSync(fora, join(wt, 'node_modules'));
    const ap = rodar(env, ['--aplicar', ...PASSOS], { LIMPADOR_AGORA: String(env.A + 8 * 24 * H) });
    assert.equal(ap.status, 0, ap.stdout + ap.stderr);
    assert.deepEqual(ap.json.builds.liberados, []);
    assert.ok(existsSync(join(fora, 'vivo.js')));
  });
});

describe('F428: teto dos logs do kit', () => {
  const montar = () => {
    const env = ambiente();
    const base = join(env.T, 'base');
    mkdirSync(join(base, 'sub'), { recursive: true });
    mkdirSync(join(base, 'backups'), { recursive: true });
    const linhas = Array.from({ length: 2000 }, (_, i) => `linha ${String(i).padStart(5, '0')} ${'x'.repeat(20)}`).join('\n') + '\n';
    const grande = join(base, 'sub', 'hooks.log');
    writeFileSync(grande, linhas);
    chmodSync(grande, 0o600);
    writeFileSync(join(base, 'backups', 'velho.log'), linhas);
    writeFileSync(join(base, 'pequeno.jsonl'), '{}\n');
    return { env, base, grande, linhas };
  };
  const ARGS = ['--passos', 'logs', '--teto-log-mb', '0.01']; // teto de 10 KB
  it('relatório só lista o log acima do teto', () => {
    const { env, grande, linhas } = montar();
    const r = rodar(env, ARGS);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.deepEqual(r.json.logs.seriamCortados.map((x) => x.caminho), [grande]);
    assert.equal(readFileSync(grande, 'utf8'), linhas);
  });
  it('--aplicar deixa o fim, cortado em começo de linha, com o modo 0600; backups/ e o pequeno ficam', () => {
    const { env, base, grande, linhas } = montar();
    assert.ok(linhas.length > 10 * 1024 * 1.024, 'precondição: o log passa do teto');
    const r = rodar(env, ['--aplicar', ...ARGS]);
    assert.equal(r.status, 0, r.stdout + r.stderr + JSON.stringify(r.json?.erros));
    const depois = readFileSync(grande, 'utf8');
    assert.ok(depois.length > 0 && depois.length <= 5243, `tamanho ${depois.length}`);
    assert.ok(linhas.endsWith(depois), 'fica o fim do arquivo');
    assert.match(depois, /^linha \d{5} x{20}\n/, 'começa numa linha inteira');
    assert.equal(statSync(grande).mode & 0o777, 0o600);
    assert.equal(readFileSync(join(base, 'backups', 'velho.log'), 'utf8'), linhas, 'backups/ não se corta');
    assert.equal(readFileSync(join(base, 'pequeno.jsonl'), 'utf8'), '{}\n');
  });
});

describe('F428: agendamento', () => {
  it('--plist imprime o plist que roda o limpar-disco mais novo do cache com --se-ligado', () => {
    const env = ambiente();
    const r = rodar(env, ['--plist']);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /<key>Label<\/key><string>com\.ichikawa-kit\.limpar-disco<\/string>/);
    assert.match(r.stdout, /bin\/limpar-disco/);
    assert.match(r.stdout, /--aplicar --se-ligado --resumo/);
    assert.match(r.stdout, /<integer>21600<\/integer>/);
  });
  it('o wrapper bin/limpar-disco é executável e chega ao script', () => {
    const bin = join(AQUI, '..', '..', 'bin', 'limpar-disco');
    assert.ok(statSync(bin).mode & 0o111, 'executável');
    const r = spawnSync(bin, ['--plist'], { encoding: 'utf8', timeout: 30_000, killSignal: 'SIGKILL', env: { ...process.env, HOME: mkdtempSync(join(tmpdir(), 'limp-h-')) } });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /limpar-disco/);
  });
});

describe('o script não contém comandos perigosos', () => {
  it('sem --force, branch -D, rm -rf, worktree prune, process.exit(', () => {
    const src = readFileSync(LIMPADOR, 'utf8');
    assert.ok(src.length > 1000, 'o script precisa existir e ter conteúdo');
    for (const proibido of ['--force', 'branch -D', 'rm -rf', 'worktree prune', 'process.exit(']) {
      assert.ok(!src.includes(proibido), `achei ${proibido}`);
    }
  });
});
