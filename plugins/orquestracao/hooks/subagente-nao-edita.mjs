#!/usr/bin/env node
// PreToolUse: quem escreve é sessão, como TRAVA. Subagente (evento com `agent_id`) que chama
// Edit/Write/MultiEdit/NotebookEdit fora das pastas livres → `deny`, com o motivo.
// A configuração das travas (F323) mora em pasta livre — a lista de tipos abaixo, a dos repos da trava da
// orquestradora, os marcadores `ativas/` e a `batida/` que os recria, a bandeira do modo ausente, o estado do critério,
// o cache do registro, os settings.json, os transcripts e os plugins (o código destes hooks): subagente nenhum a
// grava, nem o tipo liberado, senão ele se libera. O subagente não
// aparece na lista de sessões nem no painel e, quando morre, deixa mudança no disco sem dono; quem
// grava é a sessão dona do item. Sessão aberta com `--agent <tipo>` chega com `agent_type` e SEM
// `agent_id`: é sessão, e passa.
// `deny`, não `ask`: a decisão já foi tomada e o subagente em background não teria a quem
// perguntar. Vale em bypass. Bash fica de fora pelo mesmo motivo do orquestradora-nao-edita
// (parsear shell deu 50 alertas falsos); o briefing do subagente diz que ele não grava. A exceção é o
// Bash que cita um arquivo da configuração das travas pelo nome e grava (redireção, tee, sed -i, cp, mv,
// rm, writeFile…): nome vindo de variável, `claude plugin` e afins passam — é cerca contra deslize, não cofre.
// Exceção por papel: subagent_type listado em subagente-pode-escrever.txt (um por linha, `*` no
// fim casa prefixo, `#` comenta) — o designer do projeto e os agentes de plugin que gravam; e o
// designer do kit (`kit-design:` ou o sucessor `design-system:`) grava na pasta de revisões (`design.revisoes` do .claude/kit.json) sem lista, como
// os designers de outro plugin que o projeto declara em `design.designers` (tipo exato, sem curinga:
// `*:designer` daria escrita a todo plugin instalado); a pasta é
// cercada: valor inválido (absoluto, `..`, a própria raiz) vale o padrão e symlink não libera
// (recusa com o motivo e o rótulo `recusou-symlink` no log).
// Erro do hook vai para o log e a ferramenta segue.
import { existsSync, lstatSync, readFileSync, readlinkSync, realpathSync, statSync } from 'node:fs';
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

// A configuração das travas (F323). Arquivos e pastas da máquina, o settings.json de qualquer `.claude/` (o do projeto
// também desliga plugin e hook) e os transcripts (a T3 e a T7 decidem pelo turno do operador gravado neles).
const ARQUIVOS_DAS_TRAVAS = () => ['subagente-pode-escrever.txt', 'trava-edicao-repos.txt', 'operador-ausente.json',
  'hooks-crewai-estado.json', 'pool-registro-cache.json'].map((n) => join(BASE, n));
// `batida/` nomeia a orquestradora: o início de sessão recria o marcador de `ativas/` a partir dela. `painel/` e `limpeza/`
// (respostas e clique do operador) a T5 da travas-da-sessao fecha só na grafia exata; aqui valem caixa, symlink e dev:ino.
const PASTAS_DAS_TRAVAS = () => ['ativas', 'batida', 'painel', 'limpeza'].map((n) => join(BASE, n)).concat(join(H, '.claude', 'plugins'));
// Os dados que os plugins guardam entre sessões (CLAUDE_PLUGIN_DATA) não são código nem configuração das travas.
const LIVRES_NAS_PASTAS = () => [join(H, '.claude', 'plugins', 'data')];
// Forma de comparar: o disco do macOS iguala caixa e compatibilidade Unicode (`Subagente-…`, `ſubagente-…` são a lista).
const forma = (p) => p.normalize('NFKC').toLowerCase();
const PADROES_DAS_TRAVAS = [/\/\.claude\/settings(\.local)?\.json$/];
const ehTranscript = (f) => f.startsWith(forma(join(H, '.claude', 'projects')) + '/') && f.endsWith('.jsonl');
const idDoArquivo = (p) => { try { const s = statSync(p); return `${s.dev}:${s.ino}`; } catch { return null; } };

// Symlink quebrado: o Write segue o link e cria o alvo, então o alvo conta (até 8 saltos).
function alvosDoLink(p) {
  const alvos = [];
  for (let a = p, i = 0; i < 8; i++) {
    try { if (!lstatSync(a).isSymbolicLink()) break; a = resolve(dirname(a), readlinkSync(a)); alvos.push(a); } catch { break; }
  }
  return alvos;
}

function daConfiguracaoDasTravas(p) {
  const candidatos = [p, ...alvosDoLink(p)];
  try { candidatos.push(caminhoReal(p)); } catch { /* sem o real, vale o lido */ }
  const arquivos = ARQUIVOS_DAS_TRAVAS();
  const pastas = PASTAS_DAS_TRAVAS();
  // O lado da configuração também pelo real: BASE ou ~/.claude por symlink (o /var → /private/var do macOS).
  const reais = (l) => l.concat(l.map((x) => { try { return caminhoReal(x); } catch { return x; } }));
  const fa = reais(arquivos).map(forma);
  const fd = reais(pastas).map((d) => forma(d) + '/');
  const livres = reais(LIVRES_NAS_PASTAS()).map((d) => forma(d) + '/');
  const porNome = candidatos.map(forma).some((c) => fa.includes(c) || (fd.some((d) => c.startsWith(d)) && !livres.some((d) => c.startsWith(d)))
    || PADROES_DAS_TRAVAS.some((r) => r.test(c)) || ehTranscript(c));
  if (porNome) return true;
  // Pelo próprio arquivo (dev:ino): link físico ou grafia que o disco iguala e a forma acima não pega.
  const ids = new Set(arquivos.map(idDoArquivo).filter(Boolean));
  const idsDePasta = new Set(pastas.map(idDoArquivo).filter(Boolean));
  const idsLivres = new Set(LIVRES_NAS_PASTAS().map(idDoArquivo).filter(Boolean));
  for (let a = p; ; a = dirname(a)) {
    const id = idDoArquivo(a);
    if (id && idsLivres.has(id)) return false;
    if (id && ((a === p && ids.has(id)) || idsDePasta.has(id))) return true;
    if (dirname(a) === a) return false;
  }
}

// Bash: o nome de um arquivo da configuração das travas no comando, junto de algo que grava.
const NOMES_DAS_TRAVAS = /subagente-pode-escrever\.txt|trava-edicao-repos\.txt|operador-ausente\.json|hooks-crewai-estado\.json|pool-registro-cache\.json|orquestracao\/(ativas|batida|painel|limpeza)\b|\.claude\/settings(\.local)?\.json|\.claude\/plugins\//i;
const BASH_GRAVA = [
  /\b(sed|perl)\s+((-[a-zA-Z]*|--[\w-]+)\s+)*(-[a-zA-Z]*i|--in-place)/,
  /(^|[^<>=-])(\d|&)?>{1,2}\|?\s*(?!\/dev\/null\b|&)["']?[\w~./$-]/,
  /\b(tee|cp|mv|rm|ln|mkdir|truncate|touch|dd|rsync|chmod|unlink)\b/,
  /\b(writeFile|appendFile|rename|unlink|symlink|copyFile|rmSync|createWriteStream|write_text|write_bytes)\w*|\bopen\([^)]*['"][wa]/,
];
const bashGravaTrava = (c) => NOMES_DAS_TRAVAS.test(c.normalize('NFKC')) && BASH_GRAVA.some((r) => r.test(c));

function tipoLiberado(tipo) {
  const lista = join(BASE, 'subagente-pode-escrever.txt');
  if (!tipo || !existsSync(lista)) return false;
  return readFileSync(lista, 'utf8').split('\n')
    .map((l) => l.replace(/#.*/, '').trim()).filter(Boolean)
    .some((t) => [tipo, semPrefixoDoKit(tipo)].some((n) => (t.endsWith('*') ? n.startsWith(t.slice(0, -1)) : n === t)));
}

// A raiz do projeto: a pasta mais próxima do arquivo com `.claude/kit.json` ou `.git` (arquivo ou pasta),
// salvo a que é ou mora dentro da pasta de revisões de um projeto acima: o designer grava ali e um kit.json
// aninhado declararia designers novos (ou outra pasta). Essa vale como pasta comum do projeto de fora.
function raizDoProjeto(p, tipo) {
  const candidatas = [];
  for (let d = dirname(p); ; d = dirname(d)) {
    if (existsSync(join(d, '.claude', 'kit.json')) || existsSync(join(d, '.git'))) candidatas.push(d);
    if (dirname(d) === d) break;
  }
  // Comparado pelo caminho real nativo: no disco que não distingue caixa (APFS), `DOCS/…` acha o mesmo
  // kit.json que `docs/…`, e só o `.native` devolve a grafia do disco dos dois lados.
  let raiz = null;
  for (const d of candidatas.reverse()) {
    if (raiz) {
      const rev = realNativo(resolve(raiz, designDoProjeto(raiz, tipo).rel));
      const real = realNativo(d);
      if (rev && real && (real === rev || real.startsWith(rev + '/'))) continue;
    }
    raiz = d;
  }
  return raiz;
}

function realNativo(p) {
  try { return realpathSync.native(p); } catch { return null; }
}

// Pasta de revisões inválida (absoluta, com `..` ou a própria raiz) não vale.
const revisoesValida = (raiz, v) => {
  const rel = typeof v === 'string' ? v.trim().replace(/\/+$/, '') : '';
  return rel && !isAbsolute(rel) && !rel.split(/[\\/]+/).includes('..') && resolve(raiz, rel) !== raiz ? rel : '';
};

// O designer do `design-system` (F350) lê a pasta de revisões do `design/design-system.json`, que vence o kit.json; a trava
// lê o mesmo, salvo o arquivo que mora dentro da pasta que ele mesmo declara (o designer o regravaria e se mudaria de pasta).
function revisoesDoDesignSystem(raiz) {
  const arq = join(raiz, 'design', 'design-system.json');
  let v;
  try { v = JSON.parse(readFileSync(arq, 'utf8').replace(/^\uFEFF/, ''))?.revisoes; } catch { return ''; }
  const rel = revisoesValida(raiz, v);
  return rel && !arq.startsWith(resolve(raiz, rel) + '/') ? rel : '';
}

// A seção `design` do kit.json do projeto: a pasta de revisões (inválida vale o padrão) e os designers
// de plugin declarados (só texto exato; o que não é lista ou tem `*` não libera ninguém).
function designDoProjeto(raiz, tipo) {
  let design;
  try {
    design = JSON.parse(readFileSync(join(raiz, '.claude', 'kit.json'), 'utf8').replace(/^\uFEFF/, ''))?.design;
  } catch { /* sem kit.json legível: vale o padrão */ }
  // Inválido vale o padrão: o designer segue com uma pasta que funciona.
  const rel = (String(tipo ?? '').startsWith('design-system:') && revisoesDoDesignSystem(raiz))
    || revisoesValida(raiz, design?.revisoes) || 'docs/design/revisoes';
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
    const raiz = raizDoProjeto(p, tipo);
    if (!raiz) return false;
    const { rel, designers } = designDoProjeto(raiz, tipo);
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

function recusarTrava(e, quem, alvo) {
  registrar(e.session_id || '-', HOOK, 'recusou-trava', `${quem} ${e.tool_name} ${alvo}`);
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason:
        `Subagente não grava a configuração das travas (${alvo}): quem escreve nela é a sessão, ` +
        'senão o subagente se libera. Pare e devolva no relatório o que gravaria: quem te lançou é quem grava. ' +
        'Se o comando só lia, leia pelo Read ou pelo Grep.',
    },
  }));
}

function main() {
  const e = lerEntrada();
  if (!e.agent_id) return;
  const quem = `subagente ${e.agent_type || e.agent_id}`;
  if (e.tool_name === 'Bash') {
    const c = String(e.tool_input?.command ?? '');
    if (bashGravaTrava(c)) recusarTrava(e, quem, c.length > 200 ? `${c.slice(0, 200)}…` : c);
    return;
  }
  const p = caminhoDe(e);
  if (p && daConfiguracaoDasTravas(p)) return recusarTrava(e, quem, p);
  if (!p || LIVRES.some((f) => f(p))) return;
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
