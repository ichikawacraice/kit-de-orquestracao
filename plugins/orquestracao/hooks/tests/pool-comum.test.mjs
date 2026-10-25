#!/usr/bin/env node
// Testes de projetoDaSessao (pool-comum.mjs): projeto da sessão = git common dir do originCwd (cai para cwd).
// Rodar: node ~/.claude/hooks/tests/pool-comum.test.mjs   (HOOKS_DIR troca a pasta dos hooks)
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HOOKS = process.env.HOOKS_DIR || join(dirname(fileURLToPath(import.meta.url)), '..');
const base = realpathSync(mkdtempSync(join(tmpdir(), 'pool-comum-')));
mkdirSync(join(base, 'orq')); mkdirSync(join(base, 'app', 'conta'), { recursive: true });
process.env.HOOKS_CREWAI_BASE = join(base, 'orq');
process.env.POOL_APP_SESSOES_DIR = join(base, 'app');
const git = (cwd, ...a) => execFileSync('git', ['-C', cwd, ...a], { encoding: 'utf8', timeout: 15000, killSignal: 'SIGKILL', stdio: ['ignore', 'pipe', 'ignore'] });
function repo(nome) {
  const d = join(base, nome); mkdirSync(d);
  git(d, 'init', '-q'); git(d, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'x');
  return d;
}
const A = repo('alfa'); const B = repo('beta');
git(A, 'worktree', 'add', '-q', join(base, 'alfa-wt'), '-b', 'wt');
const SEM = join(base, 'semgit'); mkdirSync(SEM);

process.env.HOME = join(base, 'home'); mkdirSync(join(base, 'home', '.claude', 'projects', 'p'), { recursive: true });
const { registroDaSessao, projetoDaSessao, repoDoMarcador, projetoTemOrquestradora } = await import(pathToFileURL(join(HOOKS, 'pool-comum.mjs')).href);
function reg(k, campos) {
  writeFileSync(join(base, 'app', 'conta', `local_${k}.json`), JSON.stringify({ sessionId: `local_${k}`, cliSessionId: `cli-${k}`, title: `E1 · x`, ...campos }));
  return registroDaSessao(`cli-${k}`, { fresco: true });
}
let falhas = 0;
function caso_repoDoMarcador() {
  const nome = 'repoDoMarcador: vazio e `null` = sem repo, barra final sai; os três leitores do marcador a usam';
  try {
    const eq = (a, b) => { if (a !== b) throw new Error(`esperava ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`); };
    eq(repoDoMarcador('/r/x/.git\n'), '/r/x/.git'); eq(repoDoMarcador('/r/x/.git/\n'), '/r/x/.git');
    eq(repoDoMarcador('\n'), ''); eq(repoDoMarcador('null\n'), ''); eq(repoDoMarcador(undefined), '');
    for (const h of ['pool-comum.mjs', 'painel-das-sessoes.mjs', 'orquestradora-nao-edita.mjs']) {
      const src = readFileSync(join(HOOKS, h), 'utf8');
      if (h === 'pool-comum.mjs' ? !/repoDoMarcador\(readFileSync/.test(src) : !(/repoDoMarcador/.test(src) || /projetoTemOrquestradora.*from '\.\/pool-comum\.mjs'/.test(src))) throw new Error(`${h} não lê o marcador pela função comum`);
    }
    console.log(`ok   ${nome}`);
  } catch (e) { falhas++; console.log(`FAIL ${nome}\n     ${e.message}`); }
}
function caso(nome, fn) { try { fn(); console.log(`ok   ${nome}`); } catch (e) { falhas++; console.log(`FAIL ${nome}\n     ${e.message}`); } }
const ok = (c, m) => { if (!c) throw new Error(m); };

caso('dois repositórios → repos diferentes, nomes alfa e beta', () => {
  const a = projetoDaSessao(reg('a', { originCwd: A, cwd: A })); const b = projetoDaSessao(reg('b', { originCwd: B, cwd: B }));
  ok(a && b && a.repo !== b.repo, `repos iguais: ${JSON.stringify([a, b])}`);
  ok(a.nome === 'alfa' && b.nome === 'beta', `nomes: ${a.nome} ${b.nome}`);
});
caso('worktree do mesmo repositório → mesmo repo', () => {
  const a = projetoDaSessao(reg('a2', { originCwd: A })); const w = projetoDaSessao(reg('w', { originCwd: join(base, 'alfa-wt') }));
  ok(a && w && a.repo === w.repo && w.nome === 'alfa', `${JSON.stringify([a, w])}`);
});
caso('sem originCwd cai para cwd', () => {
  const p = projetoDaSessao(reg('c', { cwd: B }));
  ok(p?.nome === 'beta', JSON.stringify(p));
});
caso('pasta que não é git → null; registro null → null', () => {
  ok(projetoDaSessao(reg('n', { originCwd: SEM })) === null, 'esperava null');
  ok(projetoDaSessao(null) === null, 'registro null');
});
caso('cache antigo (sem cwd/originCwd) é descartado, não vira "sem projeto"', () => {
  reg('k', { originCwd: A });
  const f = join(base, 'orq', 'pool-registro-cache.json');
  writeFileSync(f, JSON.stringify({ 'cli-k': { em: Date.now(), reg: { localId: 'local_k', titulo: 'E1 · x', arquivada: false } } }));
  const p = projetoDaSessao(registroDaSessao('cli-k'));
  ok(p?.nome === 'alfa', `cache antigo foi usado: ${JSON.stringify(p)}`);
});
caso_repoDoMarcador();
{
  const nome = 'gravaNoPainel (comum): `node …/painel.mjs`, `$P`, `painel` e `…/bin/painel` + verbo de escrita; leitura e citação não';
  try {
    const { gravaNoPainel } = await import(pathToFileURL(join(HOOKS, 'hooks-crewai-comum.mjs')).href);
    const sim = ['node ~/x/painel.mjs update sessoes a b', 'P=~/x/painel.mjs; node "$P" update sessoes a b', 'painel set sessoes a b', 'painel batch []', '"${CLAUDE_PLUGIN_ROOT}/bin/painel" delete fila F1', 'cd d && painel update fila F1 {}'];
    const nao = ['node ~/x/painel.mjs list fila', 'painel list sessoes', 'painel get sessoes a', 'echo "use painel update"', 'ls painel'];
    for (const c of sim) if (!gravaNoPainel(c)) throw new Error(`devia gravar: ${c}`);
    for (const c of nao) if (gravaNoPainel(c)) throw new Error(`não devia gravar: ${c}`);
    console.log(`ok   ${nome}`);
  } catch (e) { falhas++; console.log(`FAIL ${nome}\n     ${e.message}`); }
}
{
  const nome = 'projetoTemOrquestradora: três estados (true medido, false medido, null não deu para medir)';
  try {
    const eq = (a, b, m) => { if (a !== b) throw new Error(`${m}: esperava ${b}, veio ${a}`); };
    const ativas = join(base, 'orq', 'ativas'); mkdirSync(ativas, { recursive: true });
    const comum = (git(A, 'rev-parse', '--path-format=absolute', '--git-common-dir')).trim();
    const t = join(base, 'home', '.claude', 'projects', 'p', 'orq1.jsonl');
    eq(projetoTemOrquestradora('eu', comum), false, 'sem marcador nenhum');
    writeFileSync(join(ativas, 'orq1'), `${comum}\n`); writeFileSync(t, `${JSON.stringify({ cwd: A })}\n`);
    eq(projetoTemOrquestradora('eu', comum), true, 'marcador do repo com transcript recente');
    eq(projetoTemOrquestradora('eu', `${comum}/`), true, 'barra final no repo pedido');
    eq(projetoTemOrquestradora('orq1', comum), false, 'a própria sessão não conta');
    eq(projetoTemOrquestradora('eu', (git(B, 'rev-parse', '--path-format=absolute', '--git-common-dir')).trim()), false, 'outro repo, marcador medido');
    const velho = (Date.now() - 8 * 24 * 3600 * 1000) / 1000; utimesSync(t, velho, velho);
    eq(projetoTemOrquestradora('eu', comum), null, 'transcript velho do repo: não dá para dizer que morreu, e não vale como ativa');
    rmSync(join(ativas, 'orq1')); rmSync(t);
    // Orquestradora só por título, cuja pasta não é git: não sei.
    writeFileSync(join(base, 'app', 'conta', 'local_ORQX.json'), JSON.stringify({ sessionId: 'local_ORQX', cliSessionId: 'cli-orqx', title: '🎛 orquestradora — x', isArchived: false, cwd: SEM }));
    eq(projetoTemOrquestradora('eu', comum), null, 'orquestradora só por título sem git');
    console.log(`ok   ${nome}`);
  } catch (e) { falhas++; console.log(`FAIL ${nome}\n     ${e.message}`); }
}
rmSync(base, { recursive: true, force: true });
console.log(falhas ? `\n${falhas} caso(s) falharam` : '\ntodos verdes');
process.exitCode = falhas ? 1 : 0;
