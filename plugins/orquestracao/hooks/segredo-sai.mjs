#!/usr/bin/env node
// PreToolUse (F37): recusa o que leva SEGREDO para outra sessão. O texto que sai daqui fica no transcript do destino,
// no painel e nas notas compartilhadas, e dali ninguém tira. Só olha os caminhos de saída (mensagem, start_session,
// notas e painel); qualquer outra tool passa sem ser lida. A recusa nomeia os padrões e nunca o valor.
// F445 (modo Orca, fatia 8): o Bash que chama o `orca` (qualquer subcomando: `orchestration send|ask|reply|worker-start|
// task-create`, `agent launch`, `worktree create`, `terminal send`…) também é caminho de saída: varre a linha inteira (heredoc
// incluído) e o arquivo que o comando manda ler (`--spec-file <arquivo>` e `--spec-file - < arquivo`). O reconhecimento do
// comando é o leitor da trava do orca: `orca …` dentro de string ou de comentário não é comando. O arquivo que o hook não lê
// (ausente, com variável, relativo depois de `cd`) recusa: o orca o acharia, e o texto sairia sem varredura. Limite: o texto que
// só existe quando o shell roda (`--body "$(cat arquivo)"`, pipe para o stdin) não é lido.
// Erro do próprio hook vai para o log e DEIXA PASSAR: a trava não pode derrubar as sessões.
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE, registrar, lerEntrada, INICIO_DE_COMANDO, INVOCACAO_DO_PAINEL } from './hooks-crewai-comum.mjs';
import { segredosEm, nomesDe } from './varredura-entre-sessoes.mjs';
import { invocacoesDoOrca, lerArquivo, lerComandos } from './trava-do-orca.mjs';

const HOOK = 'segredo-sai';
const MENSAGEM = new Set(['SendMessage', 'mcp__ccd_session_mgmt__send_message']);
const ESCRITA = new Set(['Write', 'Edit', 'MultiEdit']);
// Tools que levam texto a outra sessão: TODO valor de texto da entrada é varrido (o laudo da V4 mediu `background`, `title`
// e `remaining_plan` passando quando só `prompt` e `brief` eram lidos).
const COM_TEXTO = new Set(['mcp__ccd_session__start_session', 'mcp__ccd_session__hand_off_to_session']);
const VERBO_DE_ESCRITA = String.raw`\s+(?:set|update|batch|com)\b`;

const strings = (obj, chaves) => chaves.map((k) => obj?.[k]).filter((v) => typeof v === 'string');

/** Todo valor de texto de um objeto ou lista, em qualquer profundidade. */
function todosOsTextos(v, acc = [], fundo = 0) {
  if (typeof v === 'string') acc.push(v);
  else if (fundo < 8 && v && typeof v === 'object') for (const x of Object.values(v)) todosOsTextos(x, acc, fundo + 1);
  return acc;
}

// Bash que grava (as regras BASH_GRAVA do criterio-da-dona, copiadas): redirecionamento, tee, sed -i, heredoc de interpretador.
const BASH_GRAVA = [
  /\b(sed|perl)\s+(-[a-zA-Z]*\s+)*-[a-zA-Z]*i/,
  /(^|[^<>&0-9=-])>>?\s*(?!\/dev\/null\b|&)["']?[\w~./$-]/,
  /\btee\b/,
  /\b(python3?|node|ruby)\b[^|;&]*<<-?\s*['"]?\w/,
];
const CITA_PASTA_DE_SAIDA = /side-session-notes\/|\.claude\/orquestracao\//i;

const naPastaDeSaida = (caminho) => {
  if (typeof caminho !== 'string' || caminho === '') return false;
  const abs = resolve(caminho);
  // O macOS não distingue maiúscula de minúscula no caminho: a comparação também não.
  const a = abs.toLowerCase();
  const base = BASE.toLowerCase();
  return a.includes('/side-session-notes/') || a === base || a.startsWith(`${base}/`);
};

function chamaPainelEscrevendo(comando) {
  const c = String(comando ?? '');
  if (/painel\.mjs/.test(c) && /(painel\.mjs|\$\{?\w+\}?)['"]?\s+(?:set|update|batch|com)\b/.test(c)) return true;
  return new RegExp(INICIO_DE_COMANDO + INVOCACAO_DO_PAINEL + VERBO_DE_ESCRITA).test(c);
}

const STDIN = new Set(['-', '/dev/stdin']);
const MUDA_DE_PASTA = new Set(['cd', 'pushd', 'popd']);
/**
 * O que um Bash manda para fora pelo `orca`: `{ invocou, arquivos, naoLidos }`. `arquivos`: o texto de cada arquivo que o comando
 * manda o orca ler (`--spec-file <arquivo>`, `--spec-file - < arquivo`); `naoLidos`: os caminhos que o hook não leu — ausente, com
 * variável, ou relativo numa linha que muda de pasta (o orca os resolveria no lugar dele, e o texto sairia sem varredura).
 */
function saidaPeloOrca(c, cwd) {
  const nada = { invocou: false, arquivos: [], naoLidos: [] };
  if (!/orca|ORCA_CLI_COMMAND/.test(c)) return nada;
  const env = process.env;
  const invocacoes = invocacoesDoOrca(c, { cwd, env });
  if (!invocacoes.length) return nada;
  // `cd` em qualquer posição (`{ cd`, `if cd`, `builtin cd`) ou um script dentro de `bash -c`/`eval` (onde o `cd` não se vê):
  // o caminho relativo não se sabe onde cai.
  const mudaDePasta = lerComandos(c, { cwd, env }).some((cmd) => cmd.palavras.some((p, i) => MUDA_DE_PASTA.has(p.v) || p.v === 'eval'
    || (i > 0 && /^-[a-z]*c$/.test(p.v) && /(?:^|\/)(?:ba|z|da|k)?sh$/.test(cmd.palavras[i - 1]?.v ?? ''))));
  const arquivos = []; const naoLidos = [];
  const ler = (f) => {
    let p = f;
    if (p === '~' || p.startsWith('~/')) p = (env.HOME ?? '') + p.slice(1);
    const t = p.includes('$') || (!isAbsolute(p) && mudaDePasta) ? null : lerArquivo(p, cwd);
    if (typeof t === 'string') arquivos.push(t); else naoLidos.push(f);
  };
  for (const o of invocacoes) {
    const f = o.bandeiras['spec-file'];
    if (typeof f === 'string' && !STDIN.has(f)) ler(f);
    if (o.stdin?.tipo === 'arquivo') ler(o.stdin.valor);
  }
  return { invocou: true, arquivos, naoLidos };
}

// `{ textos, naoLidos }`: os textos que a chamada manda para fora e os arquivos que sairiam sem o hook conseguir lê-los.
function saidaDe(tool, input, { cwd = process.cwd() } = {}) {
  const so = (textos) => ({ textos, naoLidos: [] });
  if (MENSAGEM.has(tool)) return so(strings(input, ['message']));
  if (COM_TEXTO.has(tool)) return so(todosOsTextos(input));
  if (ESCRITA.has(tool) && naPastaDeSaida(input?.file_path)) {
    const edicoes = Array.isArray(input?.edits) ? input.edits.flatMap((e) => strings(e, ['new_string'])) : [];
    return so([...strings(input, ['content', 'new_string']), ...edicoes]);
  }
  const c = input?.command;
  if (tool === 'Bash' && typeof c === 'string') {
    const grava = BASH_GRAVA.some((r) => r.test(c)) && CITA_PASTA_DE_SAIDA.test(c);
    const orca = saidaPeloOrca(c, cwd);
    if (grava || chamaPainelEscrevendo(c) || orca.invocou) return { textos: [c, ...orca.arquivos], naoLidos: orca.naoLidos };
  }
  return so([]);
}

/** Os textos que a chamada manda para fora; [] quando a tool não é um caminho de saída. `cwd`: a pasta da sessão (arquivo relativo). */
export const textosDeSaida = (tool, input, ctx = {}) => saidaDe(tool, input, ctx).textos;

/** A recusa para esta chamada, ou null quando passa. */
export function decidir(tool, input, ctx = {}) {
  const { textos, naoLidos } = saidaDe(tool, input, ctx);
  const padroes = new Set();
  for (const t of textos) for (const a of segredosEm(t)) padroes.add(a.padrao);
  if (padroes.size) return `segredo no que sai para outra sessão: ${nomesDe([...padroes].map((padrao) => ({ padrao })))}`;
  if (naoLidos.length) {
    return `não consegui ler o arquivo que o comando do orca manda para outra sessão (${naoLidos.map((f) => `\`${f}\``).join(', ')}), e o segredo-sai varre o que sai: `
      + 'passe o caminho absoluto, sem variável, de um arquivo que existe (sem `cd` antes na mesma linha), ou o texto em `--spec`/heredoc.';
  }
  return null;
}

function main() {
  const e = lerEntrada();
  const motivo = decidir(e.tool_name, e.tool_input, { cwd: typeof e.cwd === 'string' && e.cwd ? e.cwd : process.cwd() });
  if (!motivo) return;
  registrar(e.session_id, HOOK, 'recusou', `${e.tool_name}: ${motivo}`);
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: motivo } }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // O log leva só o tipo do erro: a mensagem do JSON.parse cita um trecho da entrada, e a entrada pode ter o segredo.
  try { main(); } catch (err) { registrar('-', HOOK, 'erro', `${err?.name ?? 'Error'} (sem detalhe: a entrada pode ter segredo)`); }
  process.exitCode = 0;
}
