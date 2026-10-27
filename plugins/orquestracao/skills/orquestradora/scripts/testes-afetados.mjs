#!/usr/bin/env node
// `testes-afetados [--base <ref>] [--padrao <regex>] [--json] [-- <comando…>]` (ADR 0011, decisão 3): os testes do que a
// branch tocou, para a dona rodar durante o trabalho; o gate completo é da fila de merge.
//
// O que conta como tocado: `git diff --name-only <merge-base com a base>` (commits da branch + árvore de trabalho) e os
// arquivos novos ainda fora do índice. Base: `--base`, `KIT_BASE`, `origin/HEAD`, `origin/main`, nessa ordem.
// Teste afetado: o arquivo de teste tocado, ou o que cita o NOME de um arquivo tocado (`papel-do-pool.mjs`, `protocolo.md`;
// em código, também o nome sem extensão depois de `/`, como em `from './x'`), ou o que cita um módulo que cita um tocado
// (um nível de dependentes). Limites: import dinâmico montado em tempo de execução, mais de um nível de dependência e
// dois arquivos de mesmo nome em pastas diferentes (pega os dois: erra para o lado de rodar a mais).
// Sem `--`, lista os testes, um por linha (`--json`: `{base, tocados, testes}`). Com `--`, roda o comando com os testes
// no fim (ex.: `testes-afetados -- node gate/com-fichas.mjs -- node --test`) e sai com o status dele; sem teste afetado,
// não roda nada e sai 0.
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { basename, extname, join } from 'node:path';

// `.tsx` fica de fora do padrão: o `node --test` não o roda (o mod tem o próprio `claude plugin test`); `--padrao` troca.
const PADRAO_DE_TESTE = /(^|\/)[^/]*\.test\.(mjs|cjs|js|ts|mts)$|(^|\/)test\/.*\.(mjs|js|ts)$/;
const CODIGO = /\.(mjs|cjs|js|ts|tsx|mts|jsx)$/;

function git(args, cwd) {
  return execFileSync(process.env.GIT_BIN || 'git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000, killSignal: 'SIGKILL' });
}
const linhas = (t) => t.split('\n').map((l) => l.trim()).filter(Boolean);

export function acharBase(cwd, pedida = process.env.KIT_BASE) {
  const candidatas = [pedida];
  try { candidatas.push(git(['symbolic-ref', '-q', '--short', 'refs/remotes/origin/HEAD'], cwd).trim()); } catch { /* sem origin/HEAD */ }
  candidatas.push('origin/main', 'main');
  for (const c of candidatas.filter(Boolean)) {
    try { git(['rev-parse', '--verify', '-q', `${c}^{commit}`], cwd); return c; } catch { /* tenta a próxima */ }
  }
  throw new Error('não achei a base (passe --base <ref>)');
}

export function tocados(cwd, base) {
  const mb = git(['merge-base', base, 'HEAD'], cwd).trim();
  const r = new Set([...linhas(git(['diff', '--name-only', mb], cwd)), ...linhas(git(['ls-files', '--others', '--exclude-standard'], cwd))]);
  return [...r].sort();
}

// Os nomes pelos quais um arquivo é citado: o nome com extensão; em código, também `/<nome sem extensão>` seguido de aspas.
export function citacoesDe(caminho) {
  const nome = basename(caminho);
  const r = [nome];
  if (CODIGO.test(nome)) r.push(`/${basename(nome, extname(nome))}'`, `/${basename(nome, extname(nome))}"`);
  return r;
}
const cita = (texto, alvos) => alvos.some((a) => citacoesDe(a).some((c) => texto.includes(c)));

// Puro: dado o conteúdo dos arquivos do repositório e os tocados, os testes afetados.
export function afetados({ arquivos, conteudo, mudados, padrao = PADRAO_DE_TESTE }) {
  const ehTeste = (f) => padrao.test(f);
  const existentes = new Set(arquivos);
  const vivos = mudados.filter((f) => existentes.has(f));
  // um nível de dependentes: módulo de código (não teste) que cita um tocado
  const dependentes = arquivos.filter((f) => CODIGO.test(f) && !ehTeste(f) && !mudados.includes(f) && cita(conteudo(f), mudados));
  const alvos = [...mudados, ...dependentes];
  const testes = arquivos.filter((f) => ehTeste(f) && (vivos.includes(f) || cita(conteudo(f), alvos)));
  return { dependentes, testes };
}

function main(argv) {
  const i = argv.indexOf('--');
  const opcoes = i < 0 ? argv : argv.slice(0, i);
  const comando = i < 0 ? null : argv.slice(i + 1);
  const valor = (n) => { const k = opcoes.indexOf(n); return k < 0 ? undefined : opcoes[k + 1]; };
  const cwd = git(['rev-parse', '--show-toplevel'], process.cwd()).trim();
  const base = acharBase(cwd, valor('--base') ?? process.env.KIT_BASE);
  const padrao = valor('--padrao') ? new RegExp(valor('--padrao')) : PADRAO_DE_TESTE;
  const mudados = tocados(cwd, base);
  const arquivos = [...new Set([...linhas(git(['ls-files'], cwd)), ...linhas(git(['ls-files', '--others', '--exclude-standard'], cwd))])];
  const cache = new Map();
  const conteudo = (f) => {
    if (!cache.has(f)) { try { cache.set(f, readFileSync(join(cwd, f), 'utf8')); } catch { cache.set(f, ''); } }
    return cache.get(f);
  };
  const { testes } = afetados({ arquivos, conteudo, mudados, padrao });
  if (!comando) {
    process.stdout.write(opcoes.includes('--json') ? `${JSON.stringify({ base, tocados: mudados, testes }, null, 2)}\n` : testes.map((t) => `${t}\n`).join(''));
    return 0;
  }
  if (!comando.length) throw new Error('faltou o comando depois de --');
  if (!testes.length) { process.stderr.write(`testes-afetados: nenhum teste afetado (base ${base}, ${mudados.length} tocados); nada a rodar\n`); return 0; }
  process.stderr.write(`testes-afetados: ${testes.length} teste(s) (base ${base}): ${testes.join(' ')}\n`);
  const r = spawnSync(comando[0], [...comando.slice(1), ...testes], { cwd, stdio: 'inherit' });
  if (r.error) throw r.error;
  return r.status ?? 1;
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  try { process.exitCode = main(process.argv.slice(2)); } catch (e) { process.stderr.write(`testes-afetados: ${e?.message || e}\n`); process.exitCode = 2; }
}
