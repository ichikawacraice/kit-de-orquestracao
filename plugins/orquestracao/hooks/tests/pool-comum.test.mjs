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
const { registroDaSessao, projetoDaSessao, repoDoMarcador, projetoTemOrquestradora, inicioDoTurno, origemDoTurno, janelasDeLimpeza, ehPerguntaDeLimpeza, maquinaCheia, sessoesDaConta } = await import(pathToFileURL(join(HOOKS, 'pool-comum.mjs')).href);
function reg(k, campos) {
  writeFileSync(join(base, 'app', 'conta', `local_${k}.json`), JSON.stringify({ sessionId: `local_${k}`, cliSessionId: `cli-${k}`, title: `E1 · x`, ...campos }));
  return registroDaSessao(`cli-${k}`, { fresco: true });
}
let falhas = 0;
function caso_repoDoMarcador() {
  const nome = 'repoDoMarcador: vazio e `null` = sem repo, barra final sai; os leitores do marcador a usam';
  try {
    const eq = (a, b) => { if (a !== b) throw new Error(`esperava ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`); };
    eq(repoDoMarcador('/r/x/.git\n'), '/r/x/.git'); eq(repoDoMarcador('/r/x/.git/\n'), '/r/x/.git');
    eq(repoDoMarcador('\n'), ''); eq(repoDoMarcador('null\n'), ''); eq(repoDoMarcador(undefined), '');
    // F447: o marcador da orquestradora do Orca traz o id do Orca na 2ª linha; o repo é só a 1ª
    eq(repoDoMarcador('/r/x/.git\norca_session_id:abc\n'), '/r/x/.git'); eq(repoDoMarcador('/r/x/.git/\norca_session_id:abc'), '/r/x/.git');
    eq(repoDoMarcador('\norca_session_id:abc\n'), '');
    for (const h of ['pool-comum.mjs', 'orquestradora-nao-edita.mjs']) // painel-das-sessoes.mjs saiu: vale com ou sem orquestradora (ADR 0007)
     {
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
caso_janelas();
function caso_janelas() {
  const nome = 'F53: ehPerguntaDeLimpeza (termo inteiro) e janelasDeLimpeza (lê o par tool_use/tool_result do transcript)';
  try {
    const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m}: esperava ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`); };
    for (const t of ['Q9 · limpar · orquestradora: posso?', 'q9 · LIMPAR  ·  orquestradora', 'limpar · orquestradora', 'x limpar · orquestradora?']) eq(ehPerguntaDeLimpeza(t), true, t);
    for (const t of ['limpar · worktrees órfãos', 'limpar · orquestradora-velha', 'Q9 · merge do PR 7?', '', undefined]) eq(ehPerguntaDeLimpeza(t), false, String(t));
    const P = 'Q9 · limpar · orquestradora: posso me limpar?';
    const t0 = new Date(Date.now() - 120_000).toISOString(); const t1 = new Date(Date.now() - 60_000).toISOString();
    const f = join(base, 'janela.jsonl');
    writeFileSync(f, [
      { type: 'assistant', timestamp: t0, message: { content: [{ type: 'tool_use', id: 'a', name: 'AskUserQuestion', input: { questions: [{ question: P }] } }] } },
      { type: 'user', timestamp: t1, message: { content: [{ type: 'tool_result', tool_use_id: 'a', content: 'x' }] }, toolUseResult: { answers: { [P]: 'Sim, pode limpar' } } },
      { type: 'assistant', timestamp: t1, message: { content: [{ type: 'tool_use', id: 'b', name: 'AskUserQuestion', input: { questions: [{ question: P }] } }] } },
      { type: 'user', timestamp: t1, message: { content: [{ type: 'tool_result', tool_use_id: 'b', is_error: true, content: 'rej' }] }, toolUseResult: 'User rejected tool use' },
      { type: 'assistant', timestamp: t1, message: { content: [{ type: 'tool_use', id: 'c', name: 'AskUserQuestion', input: { questions: [{ question: P }] } }] } },
      { type: 'assistant', timestamp: t1, message: { content: [{ type: 'tool_use', id: 'd', name: 'AskUserQuestion', input: { questions: [{ question: 'Q1 · merge?' }] } }] } },
    ].map((x) => JSON.stringify(x)).join('\n') + '\n');
    const j = janelasDeLimpeza(f);
    if (j.length !== 3) throw new Error(`precondição: esperava 3 janelas de limpeza, veio ${j.length}`);
    eq(j[0].resposta, 'Sim, pode limpar', 'resposta'); eq(j[0].recusada, false, 'recusada'); eq(j[0].respondidaEm, Date.parse(t1), 'respondidaEm'); eq(j[0].abertaEm, Date.parse(t0), 'abertaEm');
    eq(j[1].recusada, true, 'fechada sem resposta'); eq(j[2].respondidaEm, null, 'sem resposta ainda');
    eq(janelasDeLimpeza(join(base, 'nao-existe.jsonl')), [], 'arquivo ausente');
    console.log(`ok   ${nome}`);
  } catch (e) { falhas++; console.log(`FAIL ${nome}\n     ${e.message}`); }
}
// ADR 0005 (26/10): a máquina está cheia para teste quando as fichas do teto acabam ou a carga alcança os núcleos. Pasta temporária.
caso('maquinaCheia: 2 fichas vivas e teto 2 → cheia; 1 ficha → não; sem fichas e carga ≥ núcleos → cheia; ficha de PID morto não conta', () => {
  const pasta = join(base, 'nucleos'); mkdirSync(pasta);
  const ficha = (k, pid) => writeFileSync(join(pasta, String(k)), JSON.stringify({ pid, token: 't', worktree: '/w', projeto: 'p', desde: new Date().toISOString() }));
  const morto = execFileSync(process.execPath, ['-e', 'process.stdout.write(String(process.pid))'], { encoding: 'utf8', timeout: 15000, killSignal: 'SIGKILL' }).trim();
  ok(Number(morto) > 0, 'precondição: PID do filho');
  ficha(1, process.pid);
  let r = maquinaCheia({ pasta, teto: 2, carga: 0, nucleos: 15 });
  ok(r.cheia === false && r.tomadas === 1, `1 ficha de 2: ${JSON.stringify(r)}`);
  ficha(2, process.pid);
  r = maquinaCheia({ pasta, teto: 2, carga: 0, nucleos: 15 });
  ok(r.cheia === true && r.tomadas === 2 && r.teto === 2, `2 de 2: ${JSON.stringify(r)}`);
  ficha(2, Number(morto));
  r = maquinaCheia({ pasta, teto: 2, carga: 0, nucleos: 15 });
  ok(r.cheia === false && r.tomadas === 1, `PID morto não conta: ${JSON.stringify(r)}`);
  rmSync(join(pasta, '1')); rmSync(join(pasta, '2'));
  r = maquinaCheia({ pasta, teto: 2, carga: 20, nucleos: 15 });
  ok(r.cheia === true && r.tomadas === 0 && r.carga === 20, `carga alta: ${JSON.stringify(r)}`);
  r = maquinaCheia({ pasta, teto: 2, carga: 14.9, nucleos: 15 });
  ok(r.cheia === false, `carga abaixo dos núcleos: ${JSON.stringify(r)}`);
  r = maquinaCheia({ pasta: join(base, 'nao-existe'), teto: 2, carga: 0, nucleos: 15 });
  ok(r.cheia === false && r.tomadas === 0, `pasta ausente: ${JSON.stringify(r)}`);
});
caso('maquinaCheia: pasta, teto e carga vêm do env (KIT_NUCLEOS_DIR, KIT_NUCLEOS_DE_TESTE, KIT_CARGA_1MIN)', () => {
  const pasta = join(base, 'nucleos-env'); mkdirSync(pasta);
  writeFileSync(join(pasta, '1'), JSON.stringify({ pid: process.pid }));
  const env = { KIT_NUCLEOS_DIR: pasta, KIT_NUCLEOS_DE_TESTE: '1', KIT_CARGA_1MIN: '0' };
  let r = maquinaCheia({ env });
  ok(r.cheia === true && r.pasta === pasta && r.teto === 1 && r.tomadas === 1, `env: ${JSON.stringify(r)}`);
  r = maquinaCheia({ env: { ...env, KIT_NUCLEOS_DE_TESTE: '2' } });
  ok(r.cheia === false && r.teto === 2, `teto 2: ${JSON.stringify(r)}`);
  r = maquinaCheia({ env: { ...env, KIT_NUCLEOS_DE_TESTE: '2', KIT_CARGA_1MIN: '99' } });
  ok(r.cheia === true && r.carga === 99, `carga pelo env: ${JSON.stringify(r)}`);
});
// O registro do app guarda uma pasta por conta (`<SESSOES_DIR>/<conta>/…`) e a de outra conta fica no disco. As travas só leem
// a pasta da conta atual (`lastKnownAccountUuid` do config.json do app); sem config, ou com a conta sem pasta, o registro inteiro.
caso('sessoesDaConta: com a conta atual no config, a pasta dela; sem config ou com conta sem pasta, o registro inteiro', () => {
  const app = join(base, 'app-contas');
  mkdirSync(join(app, 'conta-atual', 'org'), { recursive: true }); mkdirSync(join(app, 'conta-velha', 'org'), { recursive: true });
  const antes = process.env.POOL_APP_SESSOES_DIR; process.env.POOL_APP_SESSOES_DIR = app;
  try {
    ok(sessoesDaConta() === app, `sem config, o registro inteiro: ${sessoesDaConta()}`);
    writeFileSync(join(base, 'config.json'), JSON.stringify({ lastKnownAccountUuid: 'conta-atual' }));
    ok(sessoesDaConta() === join(app, 'conta-atual'), `com a conta atual, só ela: ${sessoesDaConta()}`);
    writeFileSync(join(base, 'config.json'), JSON.stringify({ lastKnownAccountUuid: 'conta-sem-pasta' }));
    ok(sessoesDaConta() === app, `conta sem pasta no disco não esconde todos: ${sessoesDaConta()}`);
  } finally { process.env.POOL_APP_SESSOES_DIR = antes; rmSync(join(base, 'config.json'), { force: true }); }
});
// ADR 0008 (26/10): o teto tem a faixa do gate (1..G) e a normal (G+1..T); a máquina está cheia para a V quando falta ficha NORMAL e não há o que emprestar.
caso('maquinaCheia (ADR 0008): gate rodando com a faixa normal livre → não cheia; faixa normal cheia com gate rodando → cheia; sem gate, faixa normal cheia e a do gate livre → não cheia', () => {
  const pasta = join(base, 'nucleos-faixas'); mkdirSync(pasta);
  const dono = { pid: process.pid, token: 't', worktree: '/w', projeto: 'p', desde: new Date().toISOString() };
  const ficha = (k) => writeFileSync(join(pasta, String(k)), JSON.stringify(dono));
  const vez = () => writeFileSync(join(pasta, 'gate'), JSON.stringify(dono));
  const maq = () => maquinaCheia({ pasta, teto: 10, carga: 0, nucleos: 15, env: {} });
  for (let k = 1; k <= 6; k++) ficha(k); // o gate com as 6 fichas dele
  vez();
  let r = maq();
  ok(r.faixas.gate === 7 && r.faixas.normal === 3, `faixas 7/3: ${JSON.stringify(r)}`);
  ok(r.gateRodando !== null && r.livresNormais === 3 && r.cheia === false, `gate rodando, normal livre: ${JSON.stringify(r)}`);
  for (const k of [8, 9, 10]) ficha(k);
  r = maq();
  ok(r.livresNormais === 0 && r.gateRodando !== null && r.cheia === true, `normal cheia com gate rodando: ${JSON.stringify(r)}`);
  rmSync(join(pasta, 'gate'));
  r = maq();
  ok(r.gateRodando === null && r.livresNormais === 0 && r.cheia === false, `sem gate e a ficha 7 emprestável: ${JSON.stringify(r)}`);
  ficha(7);
  r = maq();
  ok(r.cheia === true && r.tomadas === 10, `sem gate, tudo tomado: ${JSON.stringify(r)}`);
});
caso('maquinaCheia (ADR 0008): a vez do gate de PID morto não conta como gate rodando; `gate` não é ficha', () => {
  const pasta = join(base, 'nucleos-vez-morta'); mkdirSync(pasta);
  const morto = Number(execFileSync(process.execPath, ['-e', 'process.stdout.write(String(process.pid))'], { encoding: 'utf8', timeout: 15000, killSignal: 'SIGKILL' }).trim());
  ok(morto > 0, 'precondição: PID do filho');
  writeFileSync(join(pasta, 'gate'), JSON.stringify({ pid: morto }));
  const r = maquinaCheia({ pasta, teto: 10, carga: 0, nucleos: 15, env: {} });
  ok(r.gateRodando === null && r.tomadas === 0, `vez morta: ${JSON.stringify(r)}`);
  writeFileSync(join(pasta, 'gate'), JSON.stringify({ pid: process.pid }));
  const viva = maquinaCheia({ pasta, teto: 10, carga: 0, nucleos: 15, env: {} });
  ok(viva.gateRodando !== null && viva.tomadas === 0, `prova: com PID vivo o gate roda e ainda assim não é ficha: ${JSON.stringify(viva)}`);
});
rmSync(base, { recursive: true, force: true });
console.log(falhas ? `\n${falhas} caso(s) falharam` : '\ntodos verdes');
process.exitCode = falhas ? 1 : 0;
