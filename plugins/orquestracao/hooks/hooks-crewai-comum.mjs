// Comum às duas travas copiadas da CrewAI (Q62, 23/10): log do piloto e leitura de transcript.
// Estudo: estudo de CrewAI/swarms do operador (notas em ~/.claude/orquestracao), seção 5.
import { appendFileSync, chmodSync, readFileSync, writeFileSync, renameSync, existsSync, openSync, readSync, closeSync, fstatSync, statSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const BASE = process.env.HOOKS_CREWAI_BASE || join(homedir(), '.claude', 'orquestracao');
export const LOG = join(BASE, 'hooks-crewai.log');

// Os plugins do kit nomeiam os seus agents e skills com prefixo (`orquestracao:validador`, `kit-design:designer`): a trava de
// escrita casa o tipo com e sem o prefixo de qualquer um deles. Outro prefixo (`impeccable:x`) fica como chega. O `design:` é o
// nome velho do `kit-design` (F332), lido enquanto houver projeto com ele; o `design` da Anthropic não traz agente.
export const semPrefixoDoKit = (nome) => String(nome ?? '').replace(/^\/?(?:orquestracao|kit-design|design|processos|painel-sessoes):/, '');

// Uma linha por evento: data, sessão, hook, desfecho, detalhe (TSV).
export function registrar(sessao, hook, desfecho, detalhe = '') {
  try {
    const d = String(detalhe).replace(/\s+/g, ' ').slice(0, 300);
    appendFileSync(LOG, `${new Date().toISOString()}\t${sessao || '-'}\t${hook}\t${desfecho}\t${d}\n`, { mode: 0o600 }); // o modo vale ao criar
    chmodSync(LOG, 0o600); // e o log que já existia (0644) também fica só do dono
  } catch { /* sem log, segue */ }
}

// Início de comando (começo, `; & | ( \n` ou crase) seguido de atribuições `VAR=x` e dos prefixos `env`, `time`, `nice [-n N]`.
export const INICIO_DE_COMANDO = String.raw`(?:^|[;&|(\n` + '`' + String.raw`])\s*(?:(?:[A-Za-z_]\w*=\S*|env|time|nice(?:\s+-n\s*-?\d+)?)\s+)*`;
// A invocação do painel: `node …/painel.mjs` (caminho antigo) ou o comando `painel` do bin/ do plugin (com ou sem caminho).
export const INVOCACAO_DO_PAINEL = String.raw`(?:node\s+["']?\S*painel\.mjs["']?|["']?(?:\S*\/)?painel["']?)`;

// Gravar no painel = invocar o painel com um verbo de escrita. O caminho do script pode vir por variável
// (`P=…/painel.mjs; node "$P" update …`): basta citar o script e um verbo de escrita vir logo depois dele ou da variável.
export function gravaNoPainel(comando) {
  const c = String(comando ?? '');
  const porScript = /painel\.mjs/.test(c) && /(painel\.mjs|\$\{?\w+\}?)['"]?\s+(set|update|batch|delete)\b/.test(c);
  return porScript || new RegExp(INICIO_DE_COMANDO + INVOCACAO_DO_PAINEL + String.raw`\s+(?:set|update|batch|delete)\b`).test(c);
}

// Modo ausente (F48): ligado ⇔ a bandeira existe, é JSON válido, `desde` é data válida e `ligado !== false`. Qualquer outra
// coisa = desligado (`null`). O botão do painel desliga gravando `{ligado:false}` porque o pane não apaga arquivo.
export function modoAusente() {
  const f = join(BASE, 'operador-ausente.json');
  if (!existsSync(f)) return null;
  try {
    const b = JSON.parse(readFileSync(f, 'utf8'));
    if (!b || typeof b !== 'object' || b.ligado === false) return null;
    const desde = Date.parse(b.desde);
    return Number.isNaN(desde) ? null : { ...b, desdeMs: desde };
  } catch { return null; }
}

export function lerEntrada() {
  return JSON.parse(readFileSync(0, 'utf8'));
}

export function lerTranscript(caminho) {
  const entradas = [];
  if (!caminho) return entradas;
  for (const l of readFileSync(caminho, 'utf8').split('\n')) {
    if (!l) continue;
    try { entradas.push(JSON.parse(l)); } catch { /* linha parcial */ }
  }
  return entradas;
}

// Helpers comuns às travas de Stop da dona (criterio-da-dona, contexto-do-papel).
export function textoDe(msg) {
  const c = msg?.content;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) return c.filter((x) => x.type === 'text').map((x) => x.text).join('\n');
  return '';
}
export const conteudoDe = (c) => (typeof c === 'string' ? c : (c || []).map((x) => x.text || '').join('\n'));

export function ehMensagemDeAbertura(e) {
  if (e.type !== 'user' || e.isMeta || e.isCompactSummary) return false;
  const c = e.message?.content;
  if (typeof c === 'string') return !/^(Subagent)?Stop hook feedback/.test(c);
  return Array.isArray(c) && !c.some((x) => x.type === 'tool_result');
}

// O título vive na última entrada custom-title; achar sem parsear o transcript inteiro
// (o Stop roda em TODA sessão, e há transcripts de 100+ MB).
export function tituloRapido(caminho) {
  const s = readFileSync(caminho, 'utf8');
  const i = s.lastIndexOf('"customTitle":"');
  if (i < 0) return '';
  const m = s.slice(i + 14, i + 600).match(/^"((?:[^"\\]|\\.)*)"/);
  try { return m ? JSON.parse(`"${m[1]}"`) : ''; } catch { return ''; }
}

// Dúvida devolvida: pergunta fora de bloco de código (título markdown terminando em "?" não é
// pergunta), "Bloqueado:" abrindo a linha, ou o verbo de quem parou.
export function devolveuDuvida(relatorio) {
  const prosa = relatorio.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  return /^(?![ \t]*#)[^\n]*\?[ \t*]*$/m.test(prosa)
    || /^[ \t]*(?:[-*][ \t]*)?\**bloquead[oa]\**[ \t]*:\**[ \t]*\S[^\n]{14,}/im.test(prosa)
    || /\b(devolvo|devolvendo|parei|travei|(estou|fiquei|estava)\s+bloquead[oa])\b/i.test(prosa);
}

// A mensagem que abriu o turno atual (a última de abertura) e a posição dela no transcript.
export function aberturaDoTurno(entradas) {
  for (let i = entradas.length - 1; i >= 0; i--) if (ehMensagemDeAbertura(entradas[i])) return { inicio: i, abertura: entradas[i] };
  return { inicio: 0, abertura: entradas[0] };
}

// Só o fim do transcript, ampliado até conter a mensagem que abriu o turno atual (ou o arquivo inteiro).
// Para o hook que roda em todo Stop: transcripts passam de 70 MB e o turno cabe nos últimos MB.
export function lerTranscriptDaCauda(caminho, inicial = 2 * 1024 * 1024) {
  const fd = openSync(caminho, 'r');
  try {
    const tamanho = fstatSync(fd).size;
    for (let janela = inicial; ; janela *= 4) {
      const lido = Math.min(janela, tamanho);
      const buf = Buffer.alloc(lido);
      readSync(fd, buf, 0, lido, tamanho - lido);
      let texto = buf.toString('utf8');
      // A primeira linha pode vir cortada no meio (ou no meio de um caractere): descarta até a quebra.
      if (lido < tamanho) { const q = texto.indexOf('\n'); texto = q < 0 ? '' : texto.slice(q + 1); }
      const entradas = [];
      for (const l of texto.split('\n')) {
        if (!l) continue;
        try { entradas.push(JSON.parse(l)); } catch { /* linha parcial */ }
      }
      if (lido >= tamanho || entradas.some(ehMensagemDeAbertura)) return entradas;
    }
  } finally { closeSync(fd); }
}

// Estado dos hooks de Stop (cobranças por turno): lê, e grava só a própria mudança (F28, achado 3).
export function lerEstadoDe(arquivo) {
  try {
    const e = existsSync(arquivo) ? JSON.parse(readFileSync(arquivo, 'utf8')) : {};
    return e && typeof e === 'object' && !Array.isArray(e) ? e : {};
  } catch { return {}; }
}
// Lê, aplica `mudar` (só a chave da própria sessão), poda o que passou de 7 dias ou não é `{ em: número }`
// e grava por tmp+rename, tudo sob um lock de arquivo (`<arquivo>.lock`, criação exclusiva): duas sessões
// que param juntas não apagam uma à outra (F28, achado 3). Lock preso há mais de 5 s é de processo morto e
// é tomado; se nem assim sair em ~1 s, grava sem lock — trava de Stop não pode prender a sessão por causa do estado.
export function gravarEstadoDe(arquivo, mudar) {
  const lock = `${arquivo}.lock`;
  let tem = false;
  for (let i = 0; i < 100 && !tem; i++) {
    try { closeSync(openSync(lock, 'wx')); tem = true; } catch {
      try { if (Date.now() - statSync(lock).mtimeMs > 5000) unlinkSync(lock); } catch { /* sumiu: tenta de novo */ }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
    }
  }
  try {
    const estado = lerEstadoDe(arquivo);
    mudar(estado);
    const limite = Date.now() - 7 * 24 * 3600 * 1000;
    for (const [k, v] of Object.entries(estado)) if (!v || typeof v.em !== 'number' || v.em < limite) delete estado[k];
    const tmp = `${arquivo}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(estado));
    renameSync(tmp, arquivo);
  } finally {
    if (tem) { try { unlinkSync(lock); } catch { /* já removido */ } }
  }
}
