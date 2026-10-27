#!/usr/bin/env node
// `testes-afetados [--base <ref>] [--sha <ref>] [--padrao <regex>] [--json] [-- <comando…>]` (ADR 0011, decisão 3): os
// testes do que a branch tocou, para a dona rodar durante o trabalho; o gate completo é da fila de merge.
// `testes-afetados --acerto`: o resumo do log de acerto deste repositório (F184, abaixo).
//
// O que conta como tocado: `git diff --name-only <merge-base com a base>` (commits da branch + árvore de trabalho) e os
// arquivos novos ainda fora do índice; com `--sha`, só os commits até ele, lidos do git (sem checkout). Base: `--base`,
// `KIT_BASE`, `origin/HEAD`, `origin/main`, `main`, nessa ordem.
// Teste afetado: o arquivo de teste tocado, ou o que cita o NOME de um arquivo tocado (`papel-do-pool.mjs`, `protocolo.md`;
// em código, também o nome sem extensão depois de `/`, como em `from './x'`), ou o que cita um módulo que cita um tocado,
// em cadeia (fecho transitivo dos dependentes por citação de nome).
// Volta "todos" (F184), porque aí o efeito pode ser indireto: (1) tocou um gatilho global (`GATILHOS_PADRAO` mais
// `testesAfetados.gatilhos` do `.claude/kit.json`); (2) a seleção ficou vazia com o diff tocando algo fora de
// `testesAfetados.semTeste` (padrão `docs/**`); (3) a base não foi achada.
// Limites: import dinâmico montado em tempo de execução e leitura de pasta inteira fora dos gatilhos; dois arquivos de
// mesmo nome em pastas diferentes pegam os dois (erra para o lado de rodar a mais).
// Sem `--`, lista os testes, um por linha (`--json`: `{base, tocados, testes, todos}`). Com `--`, roda o comando com os
// testes no fim (ex.: `testes-afetados -- node gate/com-fichas.mjs -- node --test`) e sai com o status dele; em "todos",
// roda o comando sem lista (o runner acha todos); sem teste afetado, não roda nada e sai 0.
//
// Acerto (F184): quando o gate da fila fica vermelho num PR, `registrarAcerto` confere se os testes que falharam no log
// estavam na seleção da dona no sha do PR e grava uma linha em `~/.claude/orquestracao/testes-afetados-acerto.jsonl`.
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { basename, dirname, extname, join, resolve } from 'node:path';

// `.tsx` fica de fora do padrão: o `node --test` não o roda (o mod tem o próprio `claude plugin test`); `--padrao` troca.
const PADRAO_DE_TESTE = /(^|\/)[^/]*\.test\.(mjs|cjs|js|ts|mts)$|(^|\/)test\/.*\.(mjs|js|ts)$/;
const CODIGO = /\.(mjs|cjs|js|ts|tsx|mts|jsx)$/;
// O que muda o resultado de testes sem que eles o citem: dependências e versão do runtime, a config do kit, o gate,
// helpers e fixtures lidos por pasta. Padrão sem `/` casa o nome em qualquer pasta. O manifesto do plugin fica de fora:
// quem o lê o cita pelo nome, e como gatilho levaria a "todos" a cada versão subida.
export const GATILHOS_PADRAO = [
  'package.json', 'package-lock.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'yarn.lock', '.nvmrc', '.node-version',
  'tsconfig*.json', '.claude/kit.json', 'gate/**', '**/fixtures/**', '**/__fixtures__/**', '**/test/helpers/**',
  '**/tests/helpers/**',
];
export const SEM_TESTE_PADRAO = ['docs/**'];
const ARQUIVO_DE_ACERTO = 'testes-afetados-acerto.jsonl';

function git(args, cwd) {
  return execFileSync(process.env.GIT_BIN || 'git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000, killSignal: 'SIGKILL', maxBuffer: 64 << 20 });
}
const linhas = (t) => t.split('\n').map((l) => l.trim()).filter(Boolean);

function primeiraRef(cwd, candidatas) {
  for (const c of candidatas.filter(Boolean)) {
    try { git(['rev-parse', '--verify', '-q', `${c}^{commit}`], cwd); return c; } catch { /* tenta a próxima */ }
  }
  return null;
}

export function acharBase(cwd, pedida = process.env.KIT_BASE) {
  const candidatas = [pedida];
  try { candidatas.push(git(['symbolic-ref', '-q', '--short', 'refs/remotes/origin/HEAD'], cwd).trim()); } catch { /* sem origin/HEAD */ }
  candidatas.push('origin/main', 'main');
  const base = primeiraRef(cwd, candidatas);
  if (!base) throw new Error('não achei a base (passe --base <ref>)');
  return base;
}

export function tocados(cwd, base, sha = null) {
  const mb = git(['merge-base', base, sha ?? 'HEAD'], cwd).trim();
  if (sha) return linhas(git(['diff', '--name-only', mb, sha], cwd)).sort();
  const r = new Set([...linhas(git(['diff', '--name-only', mb], cwd)), ...linhas(git(['ls-files', '--others', '--exclude-standard'], cwd))]);
  return [...r].sort();
}

// Glob → regex: `**` cruza pastas, `*` e `?` não; padrão sem `/` casa o nome do arquivo em qualquer pasta.
export function casaGlob(arquivo, glob) {
  const alvo = glob.includes('/') ? arquivo : basename(arquivo);
  const re = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\/|\/\*\*$|\*\*|\*|\?/g, (t) => ({ '**/': '(?:.*/)?', '/**': '(?:/.*)?', '**': '.*', '*': '[^/]*', '?': '[^/]' })[t]);
  return new RegExp(`^${re}$`).test(alvo);
}
const casaAlgum = (f, globs) => globs.some((g) => casaGlob(f, g));

// `testesAfetados.{gatilhos, semTeste}` do `.claude/kit.json` somam aos padrões; kit.json ausente ou ilegível vale o padrão.
export function regrasDoProjeto(raiz) {
  let cfg = {};
  try { cfg = JSON.parse(readFileSync(join(raiz, '.claude', 'kit.json'), 'utf8').replace(/^﻿/, ''))?.testesAfetados ?? {}; } catch { /* padrão */ }
  const lista = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x) : []);
  return { gatilhos: [...new Set([...GATILHOS_PADRAO, ...lista(cfg.gatilhos)])], semTeste: [...new Set([...SEM_TESTE_PADRAO, ...lista(cfg.semTeste)])] };
}

// Os nomes pelos quais um arquivo é citado: o nome com extensão; em código, também `/<nome sem extensão>` seguido de aspas.
export function citacoesDe(caminho) {
  const nome = basename(caminho);
  const r = [nome];
  if (CODIGO.test(nome)) r.push(`/${basename(nome, extname(nome))}'`, `/${basename(nome, extname(nome))}"`);
  return r;
}
const cita = (texto, alvos) => alvos.some((a) => citacoesDe(a).some((c) => texto.includes(c)));

// Puro: dado o conteúdo dos arquivos do repositório e os tocados, os testes afetados. `todos` é o motivo de rodar todos, ou false.
export function afetados({ arquivos, conteudo, mudados, padrao = PADRAO_DE_TESTE, gatilhos = GATILHOS_PADRAO, semTeste = SEM_TESTE_PADRAO }) {
  const ehTeste = (f) => padrao.test(f);
  const todosOsTestes = arquivos.filter(ehTeste);
  const gatilho = mudados.find((f) => casaAlgum(f, gatilhos));
  if (gatilho) return { dependentes: [], testes: todosOsTestes, todos: `gatilho global tocado: ${gatilho}` };
  // dependentes em cadeia: módulo de código (não teste) que cita um tocado, ou um dependente achado na volta anterior
  const modulos = arquivos.filter((f) => CODIGO.test(f) && !ehTeste(f));
  const visto = new Set(mudados);
  for (let fronteira = mudados; fronteira.length;) {
    fronteira = modulos.filter((f) => !visto.has(f) && cita(conteudo(f), fronteira));
    for (const f of fronteira) visto.add(f);
  }
  const dependentes = modulos.filter((f) => visto.has(f) && !mudados.includes(f));
  const existentes = new Set(arquivos);
  const vivos = mudados.filter((f) => existentes.has(f));
  const alvos = [...mudados, ...dependentes];
  const testes = todosOsTestes.filter((f) => vivos.includes(f) || cita(conteudo(f), alvos));
  if (!testes.length && mudados.some((f) => !casaAlgum(f, semTeste))) return { dependentes, testes: todosOsTestes, todos: 'nenhum teste cita o que mudou' };
  return { dependentes, testes, todos: false };
}

// O conteúdo de cada arquivo no commit, numa chamada só (`git cat-file --batch`).
function conteudosNoSha(cwd, sha, arquivos) {
  const out = execFileSync(process.env.GIT_BIN || 'git', ['cat-file', '--batch'], {
    cwd, input: arquivos.map((f) => `${sha}:${f}\n`).join(''), stdio: ['pipe', 'pipe', 'pipe'], timeout: 60_000, killSignal: 'SIGKILL', maxBuffer: 1 << 30,
  });
  const mapa = new Map();
  let i = 0;
  for (const f of arquivos) {
    const fim = out.indexOf(10, i);
    if (fim < 0) break;
    const m = /^\S+ (\S+) (\d+)$/.exec(out.toString('utf8', i, fim));
    i = fim + 1;
    if (!m) continue; // `missing` (submódulo): sem conteúdo
    const n = Number(m[2]);
    if (m[1] === 'blob') mapa.set(f, out.toString('utf8', i, i + n));
    i += n + 1;
  }
  return (f) => mapa.get(f) ?? '';
}

// A seleção na árvore de trabalho (ou no `sha`). `base` null (não achada) → todos.
export function selecao({ cwd, base, sha = null, padrao = PADRAO_DE_TESTE }) {
  const arquivos = sha
    ? linhas(git(['ls-tree', '-r', '--name-only', sha], cwd))
    : [...new Set([...linhas(git(['ls-files'], cwd)), ...linhas(git(['ls-files', '--others', '--exclude-standard'], cwd))])];
  const todosOsTestes = arquivos.filter((f) => padrao.test(f));
  if (!base) return { base: null, tocados: [], testes: todosOsTestes, todos: 'base não achada', todosOsTestes };
  const mudados = tocados(cwd, base, sha);
  let conteudo;
  if (sha) conteudo = conteudosNoSha(cwd, sha, arquivos);
  else {
    const cache = new Map();
    conteudo = (f) => {
      if (!cache.has(f)) { try { cache.set(f, readFileSync(join(cwd, f), 'utf8')); } catch { cache.set(f, ''); } }
      return cache.get(f);
    };
  }
  const { testes, todos } = afetados({ arquivos, conteudo, mudados, padrao, ...regrasDoProjeto(cwd) });
  return { base, tocados: mudados, testes, todos, todosOsTestes };
}

// Os arquivos de teste que falharam num log do `node --test`: `test at <caminho>:l:c` (relatório spec) ou o `location:` de um
// `not ok` (TAP). O caminho do log vem de outra árvore (o worktree da fila): casa pelo fim com os testes conhecidos.
export function testesQueFalharam(texto, conhecidos) {
  const caminhos = [];
  let falhou = false;
  for (const l of String(texto).split('\n')) {
    const spec = /^\s*test at (.+?):\d+:\d+\s*$/.exec(l);
    if (spec) { caminhos.push(spec[1]); continue; }
    if (/^\s*not ok\b/.test(l)) { falhou = true; continue; }
    if (/^\s*ok\b/.test(l)) { falhou = false; continue; }
    const tap = falhou && /^\s*location:\s*'(.+?):\d+:\d+'/.exec(l);
    if (tap) { caminhos.push(tap[1]); falhou = false; }
  }
  // cada caminho casa só o conhecido de sufixo mais longo (`t/a.test.mjs` não arrasta um `a.test.mjs` da raiz)
  const achados = new Set();
  for (const c of caminhos.map((x) => x.replace(/^file:\/\//, ''))) {
    const casa = conhecidos.filter((t) => c === t || c.endsWith(`/${t}`)).sort((x, y) => y.length - x.length)[0];
    if (casa) achados.add(casa);
  }
  return conhecidos.filter((t) => achados.has(t));
}

const pastaDoKit = (env) => env.HOOKS_CREWAI_BASE || join(env.HOME || homedir(), '.claude', 'orquestracao');
// O nome do repositório, igual em qualquer worktree: a pasta que contém o `.git` comum.
function nomeDoRepo(cwd) {
  try { return basename(dirname(resolve(cwd, git(['rev-parse', '--git-common-dir'], cwd).trim()))); } catch { return basename(cwd); }
}

// O gate da fila ficou vermelho no PR: os testes que falharam no `log` estavam na seleção da dona no `sha`?
// → o registro gravado: `acerto` true (todos estavam), false (`perdidos` diz quais não) ou null (nenhum teste lido do log).
export function registrarAcerto({ cwd: pedido, pr, sha, base, log, env = process.env }) {
  const cwd = git(['rev-parse', '--show-toplevel'], pedido).trim(); // de uma subpasta, o ls-tree listaria só ela
  const ref = primeiraRef(cwd, [`origin/${base}`, base]);
  const s = selecao({ cwd, base: ref, sha });
  let texto = '';
  try { texto = readFileSync(log, 'utf8'); } catch { /* log sumiu: indeterminado */ }
  const falharam = testesQueFalharam(texto, s.todosOsTestes);
  const perdidos = falharam.filter((f) => !s.testes.includes(f));
  const registro = {
    em: new Date().toISOString(), repo: nomeDoRepo(cwd), pr, sha, base,
    ...(s.todos ? { todos: s.todos } : { selecao: s.testes }),
    falharam, perdidos, acerto: falharam.length ? perdidos.length === 0 : null,
  };
  const pasta = pastaDoKit(env);
  mkdirSync(pasta, { recursive: true });
  appendFileSync(join(pasta, ARQUIVO_DE_ACERTO), `${JSON.stringify(registro)}\n`);
  return registro;
}

export function resumoDoAcerto(registros) {
  const conta = (v) => registros.filter((r) => r.acerto === v).length;
  return { registros: registros.length, acertos: conta(true), erros: conta(false), indeterminados: conta(null), perdidos: [...new Set(registros.flatMap((r) => r.perdidos ?? []))] };
}

function main(argv) {
  const i = argv.indexOf('--');
  const opcoes = i < 0 ? argv : argv.slice(0, i);
  const comando = i < 0 ? null : argv.slice(i + 1);
  const valor = (n) => { const k = opcoes.indexOf(n); return k < 0 ? undefined : opcoes[k + 1]; };
  const cwd = git(['rev-parse', '--show-toplevel'], process.cwd()).trim();
  if (opcoes.includes('--acerto')) {
    let texto = '';
    try { texto = readFileSync(join(pastaDoKit(process.env), ARQUIVO_DE_ACERTO), 'utf8'); } catch { /* sem log ainda */ }
    const repo = nomeDoRepo(cwd);
    const registros = linhas(texto).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } }).filter((r) => r.repo === repo);
    process.stdout.write(`${JSON.stringify(resumoDoAcerto(registros), null, 2)}\n`);
    return 0;
  }
  let base = null;
  try { base = acharBase(cwd, valor('--base') ?? process.env.KIT_BASE); } catch { /* base não achada: todos */ }
  const padrao = valor('--padrao') ? new RegExp(valor('--padrao')) : PADRAO_DE_TESTE;
  const s = selecao({ cwd, base, sha: valor('--sha') ?? null, padrao });
  if (!comando) {
    process.stdout.write(opcoes.includes('--json') ? `${JSON.stringify({ base: s.base, tocados: s.tocados, testes: s.testes, todos: s.todos }, null, 2)}\n` : s.testes.map((t) => `${t}\n`).join(''));
    return 0;
  }
  if (!comando.length) throw new Error('faltou o comando depois de --');
  let lista = s.testes;
  if (s.todos) { lista = []; process.stderr.write(`testes-afetados: todos os testes (${s.todos})\n`); }
  else if (!lista.length) { process.stderr.write(`testes-afetados: nenhum teste afetado (base ${base}, ${s.tocados.length} tocados); nada a rodar\n`); return 0; }
  else process.stderr.write(`testes-afetados: ${lista.length} teste(s) (base ${base}): ${lista.join(' ')}\n`);
  const r = spawnSync(comando[0], [...comando.slice(1), ...lista], { cwd, stdio: 'inherit' });
  if (r.error) throw r.error;
  return r.status ?? 1;
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  try { process.exitCode = main(process.argv.slice(2)); } catch (e) { process.stderr.write(`testes-afetados: ${e?.message || e}\n`); process.exitCode = 2; }
}
