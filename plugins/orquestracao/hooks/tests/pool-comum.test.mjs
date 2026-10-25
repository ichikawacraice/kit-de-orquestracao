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
const { registroDaSessao, projetoDaSessao, repoDoMarcador, projetoTemOrquestradora, inicioDoTurno, origemDoTurno } = await import(pathToFileURL(join(HOOKS, 'pool-comum.mjs')).href);
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

// R1 (F41): o início do turno do pool-comum e a cópia local do fila-do-item concordam, e seguem a regra da origem: a linha
// `user` com origem abre o turno, meta ou não; a meta SEM origem e o `tool_result` não. A cópia do fila-do-item não é
// importável (o hook roda `main` ao carregar), então a função é extraída do texto do arquivo e carregada à parte.
async function inicioDoFila(arquivo = join(HOOKS, 'fila-do-item.mjs')) {
  const fonte = readFileSync(arquivo, 'utf8');
  const m = fonte.match(/function inicioDoTurno\(transcriptPath\) \{[\s\S]*?\n\}\n/);
  ok(m && m[0].length > 100, 'R1: não achei a função inicioDoTurno no fila-do-item.mjs');
  const f = join(base, `inicio-fila-${Math.random().toString(36).slice(2)}.mjs`);
  writeFileSync(f, `import { readFileSync } from 'node:fs';\nexport ${m[0]}`);
  return (await import(pathToFileURL(f).href)).inicioDoTurno;
}
async function inicioDoPainel() {
  const fonte = readFileSync(join(HOOKS, 'painel-das-sessoes.mjs'), 'utf8');
  const m = fonte.match(/function inicioDoTurno\(entradas\) \{[\s\S]*?\n\}\n/);
  ok(m && m[0].length > 100, 'R1: não achei a função inicioDoTurno no painel-das-sessoes.mjs');
  const f = join(base, `inicio-painel-${Math.random().toString(36).slice(2)}.mjs`);
  writeFileSync(f, `export ${m[0]}`);
  return (await import(pathToFileURL(f).href)).inicioDoTurno;
}
const U = (t, extra) => ({ type: 'user', timestamp: new Date(t).toISOString(), message: { role: 'user', content: 'x' }, ...extra });
const fixturesDeTurno = () => {
  const h = U(1000, { origin: { kind: 'human' } });
  return {
    'humano': { linhas: [h], inicio: 1000, origem: 'human' },
    'peer meta com origem depois de humano': { linhas: [h, U(2000, { isMeta: true, origin: { kind: 'peer' } })], inicio: 2000, origem: 'peer' },
    'system meta com origem': { linhas: [h, U(2000, { isMeta: true, origin: { kind: 'system' } })], inicio: 2000, origem: 'system' },
    'plugin sem meta': { linhas: [h, U(2000, { origin: { kind: 'plugin' } })], inicio: 2000, origem: 'plugin' },
    'notificação sem meta': { linhas: [h, U(2000, { origin: { kind: 'task-notification' } })], inicio: 2000, origem: 'task-notification' },
    'turnOrigin sdk': { linhas: [h, U(2000, { turnOrigin: 'sdk' })], inicio: 2000, origem: 'sdk' },
    'system meta com turnOrigin e sem origin (forma real das 41 linhas)': { linhas: [h, U(2000, { isMeta: true, turnOrigin: 'system' })], inicio: 2000, origem: 'system' },
    'meta SEM origem não abre turno': { linhas: [h, U(2000, { isMeta: true })], inicio: 1000, origem: 'human' },
    'tool_result com origem não abre turno': { linhas: [h, { ...U(2000, { origin: { kind: 'peer' } }), message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't', content: 'ok' }] } }], inicio: 1000, origem: 'human' },
  };
};
const casoR1 = async () => {
  const nome = 'R1: início do turno e origem seguem a mesma regra, e o pool-comum e o fila-do-item concordam em cada transcript';
  try {
    const duas = await inicioDoFila();
    const tres = await inicioDoPainel();
    const fx = fixturesDeTurno();
    ok(Object.keys(fx).length >= 9, 'R1: fixtures vazias');
    for (const [k, { linhas, inicio, origem }] of Object.entries(fx)) {
      const f = join(base, 'r1.jsonl'); writeFileSync(f, linhas.map((l) => JSON.stringify(l)).join('\n') + '\n');
      const a = inicioDoTurno(f), b = duas(f);
      if (a !== inicio) throw new Error(`pool-comum, "${k}": início esperado ${inicio}, veio ${a}`);
      if (b !== inicio) throw new Error(`fila-do-item, "${k}": início esperado ${inicio}, veio ${b}`);
      const ents = linhas.map((l) => ({ ...l }));
      const idx = tres(ents);
      const c = idx < 0 ? null : Date.parse(ents[idx].timestamp);
      if (c !== inicio) throw new Error(`painel-das-sessoes, "${k}": início esperado ${inicio}, veio ${c}`);
      if (origemDoTurno(f) !== origem) throw new Error(`origemDoTurno, "${k}": esperado ${origem}, veio ${origemDoTurno(f)}`);
    }
    console.log(`ok   ${nome}`);
  } catch (e) { falhas++; console.log(`FAIL ${nome}\n     ${e.message}`); }
};
await casoR1();

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
