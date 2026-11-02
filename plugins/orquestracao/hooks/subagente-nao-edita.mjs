#!/usr/bin/env node
// PreToolUse: quem escreve é sessão, como TRAVA. Subagente (evento com `agent_id`) que chama
// Edit/Write/MultiEdit/NotebookEdit fora das pastas livres → `deny`, com o motivo. O subagente não
// aparece na lista de sessões nem no painel e, quando morre, deixa mudança no disco sem dono; quem
// grava é a sessão dona do item. Sessão aberta com `--agent <tipo>` chega com `agent_type` e SEM
// `agent_id`: é sessão, e passa.
// `deny`, não `ask`: a decisão já foi tomada e o subagente em background não teria a quem
// perguntar. Vale em bypass. Bash fica de fora pelo mesmo motivo do orquestradora-nao-edita
// (parsear shell deu 50 alertas falsos); o briefing do subagente diz que ele não grava.
// Exceção por papel: subagent_type listado em subagente-pode-escrever.txt (um por linha, `*` no
// fim casa prefixo, `#` comenta) — o designer do projeto e os agentes de plugin que gravam; e o
// designer do kit grava na pasta de revisões (`design.revisoes` do .claude/kit.json) sem lista, como
// os designers de outro plugin que o projeto declara em `design.designers` (tipo exato, sem curinga:
// `*:designer` daria escrita a todo plugin instalado); a pasta é
// cercada: valor inválido (absoluto, `..`, a própria raiz) vale o padrão e symlink não libera
// (recusa com o motivo e o rótulo `recusou-symlink` no log).
// Erro do hook vai para o log e a ferramenta segue.
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { BASE, registrar, lerEntrada, semPrefixoDoKit } from './hooks-crewai-comum.mjs';

const HOOK = 'subagente-nao-edita';
const H = homedir();

// Livre: toda a ~/.claude (estado, memória, planos, skills), o estado da orquestração, o rascunho
// (scratchpad/tmp) e as notas entre sessões. O que a trava guarda é o código e a doc do projeto.
const LIVRES = [
  (p) => p.startsWith(BASE + '/'),
  (p) => p.startsWith(join(H, '.claude') + '/'),
  (p) => p.startsWith(join(H, 'Library', 'Application Support', 'Claude', 'side-session-notes') + '/'),
  (p) => /^\/(private\/)?tmp\//.test(p) || p.startsWith('/var/folders/') || p.startsWith('/private/var/folders/'),
  (p) => p.startsWith(resolve(tmpdir()) + '/'),
];

function tipoLiberado(tipo) {
  const lista = join(BASE, 'subagente-pode-escrever.txt');
  if (!tipo || !existsSync(lista)) return false;
  return readFileSync(lista, 'utf8').split('\n')
    .map((l) => l.replace(/#.*/, '').trim()).filter(Boolean)
    .some((t) => [tipo, semPrefixoDoKit(tipo)].some((n) => (t.endsWith('*') ? n.startsWith(t.slice(0, -1)) : n === t)));
}

// A raiz do projeto: a pasta mais próxima do arquivo com `.claude/kit.json` ou `.git` (arquivo ou pasta).
function raizDoProjeto(p) {
  for (let d = dirname(p); ; d = dirname(d)) {
    if (existsSync(join(d, '.claude', 'kit.json')) || existsSync(join(d, '.git'))) return d;
    if (dirname(d) === d) return null;
  }
}

// A seção `design` do kit.json do projeto: a pasta de revisões (inválida vale o padrão) e os designers
// de plugin declarados (só texto exato; o que não é lista ou tem `*` não libera ninguém).
function designDoProjeto(raiz) {
  let design;
  try {
    design = JSON.parse(readFileSync(join(raiz, '.claude', 'kit.json'), 'utf8').replace(/^\uFEFF/, ''))?.design;
  } catch { /* sem kit.json legível: vale o padrão */ }
  let rel = typeof design?.revisoes === 'string' ? design.revisoes.trim().replace(/\/+$/, '') : '';
  // Inválido (absoluto, com `..` ou a própria raiz) vale o padrão: o designer segue com uma pasta que funciona.
  if (!rel || isAbsolute(rel) || rel.split(/[\\/]+/).includes('..') || resolve(raiz, rel) === raiz) rel = 'docs/design/revisoes';
  const designers = Array.isArray(design?.designers)
    ? design.designers.filter((t) => typeof t === 'string').map((t) => t.trim()).filter((t) => t && !t.includes('*'))
    : [];
  return { rel, designers };
}

// Caminho real de `p` mesmo sem ele existir: resolve o primeiro ancestral que existe (symlink quebrado
// existe, por isso lstat) e junta o resto. Pode lançar (ex.: symlink quebrado).
function caminhoReal(p) {
  let a = p;
  for (;;) {
    try { lstatSync(a); break; } catch { /* sobe */ }
    if (dirname(a) === a) break;
    a = dirname(a);
  }
  return join(realpathSync(a), relative(a, p));
}

// `'liberado'`, `'symlink'` (o caminho, lido sem resolver links, está na pasta de revisões, mas o real
// não: recusa com o motivo) ou `false`. Na dúvida, nega: erro antes de saber a pasta vale `false`.
function designerNaRevisao(tipo, p) {
  if (!tipo) return false;
  let lido;
  try {
    const raiz = raizDoProjeto(p);
    if (!raiz) return false;
    const { rel, designers } = designDoProjeto(raiz);
    if (semPrefixoDoKit(tipo) !== 'designer' && !designers.includes(tipo)) return false;
    lido = { rel, dentro: p.startsWith(resolve(raiz, rel) + '/') };
    const esperada = resolve(realpathSync(raiz), rel);
    if (caminhoReal(resolve(raiz, rel)) === esperada && caminhoReal(p).startsWith(esperada + '/')) return 'liberado';
    return lido.dentro ? { symlink: rel } : false;
  } catch {
    return lido?.dentro ? { symlink: lido.rel } : false;
  }
}

function caminhoDe(entrada) {
  const ti = entrada.tool_input || {};
  let p = ti.file_path || ti.notebook_path || '';
  if (!p) return '';
  if (p.startsWith('~/')) p = join(H, p.slice(2));
  return resolve(entrada.cwd || process.cwd(), p);
}

function main() {
  const e = lerEntrada();
  if (!e.agent_id) return;
  const p = caminhoDe(e);
  if (!p || LIVRES.some((f) => f(p))) return;
  const quem = `subagente ${e.agent_type || e.agent_id}`;
  if (tipoLiberado(e.agent_type)) {
    registrar(e.session_id || '-', HOOK, 'liberado-por-tipo', `${quem} ${e.tool_name} ${p}`);
    return;
  }
  const revisao = designerNaRevisao(e.agent_type, p);
  if (revisao === 'liberado') {
    registrar(e.session_id || '-', HOOK, 'liberado-por-papel', `${quem} ${e.tool_name} ${p}`);
    return;
  }
  if (revisao?.symlink) {
    registrar(e.session_id || '-', HOOK, 'recusou-symlink', `${quem} ${e.tool_name} ${p}`);
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason:
          `O caminho passa por um link simbólico (${p}): o designer só grava na pasta de revisões real ` +
          `(${revisao.symlink}). Troque o link por uma pasta ou aponte design.revisoes do .claude/kit.json ` +
          'para o caminho real. Pare e devolva no relatório o que gravaria (arquivo e conteúdo).',
      },
    }));
    return;
  }

  registrar(e.session_id || '-', HOOK, 'recusou', `${quem} ${e.tool_name} ${p}`);
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason:
        `Subagente não grava arquivo do projeto (${p}): quem escreve é sessão. ` +
        'Pare e devolva no relatório o que gravaria (arquivo e conteúdo): quem te lançou é quem grava.',
    },
  }));
}

try {
  main();
} catch (err) {
  registrar('-', HOOK, 'erro', err?.stack || err);
}
process.exitCode = 0;
