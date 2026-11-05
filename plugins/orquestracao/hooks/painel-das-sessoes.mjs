#!/usr/bin/env node
// Stop hook (Q14, opção b): numa sessão de projeto (com ou sem orquestradora ativa, ADR 0007),
// o turno não termina se a sessão mudou de estado no painel (abriu/mergeou PR,
// tirou ID de pergunta, abriu/arquivou sessão, recebeu resposta a um Qnn) e não
// gravou nada no painel (painel.mjs set|update|batch|delete) no mesmo turno.
//
// "Projeto com orquestradora": existe marcador ~/.claude/orquestracao/ativas/<session_id>
// de OUTRA sessão cujo repositório (git common dir) é o desta. O marcador guarda o
// git common dir; marcador vazio (formato antigo) é resolvido pelo cwd do transcript.
// Marcador cujo transcript não muda há 7 dias é ignorado.
// A própria orquestradora fica com orquestradora-ritual.mjs; a que perdeu o marcador
// (limpeza de contexto troca o session_id) ganha um de volta no início da sessão (sessao-inicio.mjs, F208)
// e, se aquele falhar, aqui pelo título, no fim do primeiro turno.
// F400: o turno também não termina se a mensagem final marca decisão "assumida, a confirmar" (ou "Q-ID não reservado")
// e a pergunta `estado:"assumida"` dela não está no painel (protocolo.md#nunca-travar): sem ela o operador não vê a decisão.
import { readFileSync, existsSync, appendFileSync, writeFileSync, mkdirSync, readdirSync, statSync, openSync, readSync, closeSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { gravaNoPainel } from './hooks-crewai-comum.mjs';
import { BASE as BASE_DO_POOL, registroDaSessao, gitCommonDir } from './pool-comum.mjs';
import { acharPergunta } from '../skills/orquestradora/scripts/perguntas-arquivo.mjs';

const BASE = join(homedir(), '.claude', 'orquestracao');
const ATIVAS = join(BASE_DO_POOL, 'ativas'); // o mesmo `ativas/` que projetoTemOrquestradora lê
const LOG = join(BASE, 'painel-hook.log');
const VALIDADE_MS = 7 * 24 * 3600 * 1000;

function textoDe(msg) {
  const c = msg?.content;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) return c.filter((x) => x.type === 'text').map((x) => x.text).join('\n');
  return '';
}

// Gravar no painel: gravaNoPainel (hooks-crewai-comum.mjs), a mesma regra da orquestradora-ritual.
const GRAVA_NO_PAINEL = { test: gravaNoPainel };

const GATILHOS_BASH = [
  [/\bgh\s+pr\s+create\b/, 'abriu PR'],
  [/\bgh\s+pr\s+merge\b/, 'mergeou PR'],
  [/\bgh\s+pr\s+(ready|close)\b/, 'mudou o estado de um PR'],
  [/proxima-pergunta\.sh/, 'tirou ID de pergunta'],
];

// Só conta o Qnn que é pergunta DESTA sessão: existe perguntas/<Qnn>.json no painel com `sessaoId` igual ao
// local_… dela. Citação de decisão alheia ("Q197") não é resposta. Sem o local_… resolvido, não conta.
function citaPerguntaDestaSessao(texto, sessionId) {
  const ids = [...new Set(texto.match(/\bQ\d+\b/g) ?? [])];
  if (ids.length === 0) return false;
  const local = registroDaSessao(sessionId)?.localId;
  if (!local) {
    try { appendFileSync(LOG, `${new Date().toISOString()} sem local_ para ${sessionId}: Qnn não contado (${ids.join(',')})\n`); } catch { /* sem log */ }
    return false;
  }
  const painel = process.env.PAINEL_DIR || join(BASE, 'painel');
  return ids.some((q) => {
    // F183: a pergunta fechada mora no arquivo; acharPergunta olha a pasta quente e depois ele
    try { const f = acharPergunta(join(painel, 'perguntas'), q); return Boolean(f) && JSON.parse(readFileSync(f, 'utf8')).data?.sessaoId === local; } catch { return false; }
  });
}

const ETAPAS_FINAIS = ['feito', 'descartado'];
const ETAPAS = ['planejamento', 'design', 'execucao', 'validacao', 'merge', 'feito', 'descartado'];
// Itens vivos da fila de que esta sessão é dona (mesma leitura do fila-do-item.mjs: donoLocalId + etapa fora de
// feito/descartado; sem etapa, o critério antigo estado === 'em-andamento'). Só serve para escolher a mensagem.
function itensDaSessao(sessionId) {
  const local = registroDaSessao(sessionId)?.localId;
  if (!local) return [];
  const dir = join(process.env.PAINEL_DIR || join(BASE, 'painel'), 'fila');
  if (!existsSync(dir)) return [];
  const ids = [];
  for (const nome of readdirSync(dir)) {
    if (!nome.endsWith('.json')) continue;
    try {
      const doc = JSON.parse(readFileSync(join(dir, nome), 'utf8'));
      const d = doc?.data;
      const vivo = ETAPAS.includes(d?.etapa) ? !ETAPAS_FINAIS.includes(d.etapa) : d?.estado === 'em-andamento';
      if (vivo && d?.donoLocalId === local) ids.push(doc.id ?? nome.replace(/\.json$/, ''));
    } catch { /* ilegível: ignora */ }
  }
  return ids;
}

// Abertura do turno pela mesma regra do pool-comum e do fila-do-item (F41): a linha `user` com `origin` ou `turnOrigin` abre o
// turno, meta ou não (mensagem entre sessões é `isMeta: true` + `origin`; o aviso do sistema é `isMeta: true` + `turnOrigin`); o
// `tool_result` não. Devolve o índice
// da entrada (-1 se nenhuma tem `origin` ou `turnOrigin`). Cópia local porque o hook roda `main` ao carregar; o teste
// de concordância extrai esta função do texto.
function inicioDoTurno(entradas) {
  for (let i = entradas.length - 1; i >= 0; i--) {
    const e = entradas[i];
    const c = e.message?.content;
    const ehResultado = Array.isArray(c) && c.some((b) => b?.type === 'tool_result');
    if (e.type !== 'user' || ehResultado) continue;
    if (e.origin?.kind || e.turnOrigin) return i;
  }
  return -1;
}

// ---- F400: a decisão assumida da mensagem final precisa da pergunta assumida no painel ----
// A marca: "assumida, a confirmar" em qualquer gênero e número, ou "Q-ID não reservado" (a sessão admitindo que não gravou).
const MARCA_ASSUMIDA = /\bassumid[oa]s?\s*,\s*a\s+confirmar\b|\bQ-?IDs?\s+n[ãa]o\s+reservad[oa]s?\b/i;
const NAO_RESERVADO = /\bQ-?IDs?\s+n[ãa]o\s+reservad[oa]s?\b/i;
// Gravar a assumida pelo comando: escrita no painel, na coleção perguntas, com `"estado":"assumida"` (aspas escapadas ou não).
const ESTADO_ASSUMIDA = /estado\\?"\s*:\s*\\?"assumida\\?"/;

// A mensagem final do turno: o texto do assistente depois da última chamada de ferramenta (ou da última linha `user`).
function mensagemFinal(entradas, inicio) {
  const partes = [];
  for (let i = entradas.length - 1; i > inicio; i--) {
    const e = entradas[i];
    if (e.type === 'user') break;
    if (e.type !== 'assistant') continue;
    const c = e.message?.content;
    if (Array.isArray(c) && c.some((b) => b?.type === 'tool_use')) break;
    partes.unshift(textoDe(e.message));
  }
  return partes.join('\n');
}

// Citar a regra não é marcar decisão: o que está em bloco de código, entre crases ou entre aspas sai antes de procurar a marca.
function semCitacao(t) {
  return t
    .replace(/```[\s\S]*?(?:```|$)/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/"[^"\n]*"/g, ' ')
    .replace(/“[^”\n]*”/g, ' ')
    .replace(/«[^»\n]*»/g, ' ');
}

function perguntaDaSessao(painel, q, local) {
  try { const f = acharPergunta(join(painel, 'perguntas'), q); return Boolean(f) && JSON.parse(readFileSync(f, 'utf8')).data?.sessaoId === local; } catch { return false; }
}

// Assumida desta sessão gravada no turno por qualquer caminho (batch de arquivo, script): `atualizadoEm` desde o início do turno.
function gravouAssumidaNoTurno(painel, local, desdeIso) {
  const desde = Date.parse(desdeIso ?? '');
  const dir = join(painel, 'perguntas');
  if (Number.isNaN(desde) || !existsSync(dir)) return false;
  for (const nome of readdirSync(dir)) {
    if (!nome.endsWith('.json')) continue;
    try {
      const d = JSON.parse(readFileSync(join(dir, nome), 'utf8')).data;
      if (d?.sessaoId === local && d.estado === 'assumida' && Date.parse(d.atualizadoEm ?? '') >= desde) return true;
    } catch { /* ilegível: ignora */ }
  }
  return false;
}

// Devolve as linhas marcadas que ficaram sem pergunta no painel ([] = nada a cobrar). A linha marcada se resolve sozinha quando cita
// um Qnn que é pergunta desta sessão (assumida de turno anterior, já confirmada ou não), salvo a que diz "Q-ID não reservado"; as
// demais se resolvem se o turno gravou uma assumida (pelo comando ou pelo `atualizadoEm`).
function assumidasSemPergunta(entradas, inicio, comandos, local) {
  const linhas = semCitacao(mensagemFinal(entradas, inicio)).split('\n').filter((l) => MARCA_ASSUMIDA.test(l));
  if (linhas.length === 0) return [];
  const painel = process.env.PAINEL_DIR || join(BASE, 'painel');
  const soltas = linhas.filter((l) => NAO_RESERVADO.test(l) || !local || !(l.match(/\bQ\d+\b/g) ?? []).some((q) => perguntaDaSessao(painel, q, local)));
  if (soltas.length === 0) return [];
  const peloComando = comandos.some((c) => GRAVA_NO_PAINEL.test(c) && /\bperguntas\b/.test(c) && ESTADO_ASSUMIDA.test(c));
  if (peloComando || (local && gravouAssumidaNoTurno(painel, local, entradas[inicio]?.timestamp))) return [];
  return soltas;
}

function main() {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const { session_id, transcript_path, stop_hook_active, cwd } = input;
  if (stop_hook_active || !session_id || !transcript_path) return;
  if (existsSync(join(ATIVAS, session_id))) return; // é a orquestradora: outro hook

  const meuRepo = gitCommonDir(cwd);
  if (!meuRepo) return;

  const entradas = [];
  for (const l of readFileSync(transcript_path, 'utf8').split('\n')) {
    if (!l) continue;
    try { entradas.push(JSON.parse(l)); } catch { /* linha parcial */ }
  }

  // Limpar o contexto troca o session_id e órfã o marcador. Sessão cujo título é de
  // orquestradora e está sem marcador ganha um aqui; a partir do próximo turno o
  // orquestradora-ritual.mjs passa a valer para ela.
  const titulo = entradas.filter((e) => e.type === 'custom-title').pop()?.customTitle ?? '';
  if (titulo.startsWith('🎛 orquestradora')) {
    mkdirSync(ATIVAS, { recursive: true });
    writeFileSync(join(ATIVAS, session_id), `${meuRepo}\n`);
    return;
  }

  // Cada sessão cuida do próprio item (ADR 0007): vale com ou sem orquestradora ativa.
  const inicio = inicioDoTurno(entradas);
  if (inicio < 0) return;

  const motivos = new Set();
  if (citaPerguntaDestaSessao(textoDe(entradas[inicio].message), session_id)) motivos.add('recebeu resposta a uma pergunta Qnn');

  let gravou = false;
  const comandos = [];
  for (const e of entradas.slice(inicio + 1)) {
    if (e.type !== 'assistant' || !Array.isArray(e.message?.content)) continue;
    for (const it of e.message.content) {
      if (it.type !== 'tool_use') continue;
      if (it.name === 'Bash') {
        const cmd = String(it.input?.command ?? '');
        comandos.push(cmd);
        if (GRAVA_NO_PAINEL.test(cmd)) gravou = true;
        for (const [re, m] of GATILHOS_BASH) if (re.test(cmd)) motivos.add(m);
      }
      if (it.name.endsWith('start_session')) motivos.add('abriu sessão');
      if (it.name.endsWith('archive_session')) motivos.add('arquivou sessão');
    }
  }
  const local = registroDaSessao(session_id)?.localId;
  const soltas = assumidasSemPergunta(entradas, inicio, comandos, local);
  const cobraPainel = !gravou && motivos.size > 0;
  if (!cobraPainel && soltas.length === 0) return;

  const partes = [];
  if (cobraPainel) partes.push(motivoDoPainel(session_id, motivos));
  if (soltas.length) partes.push(motivoDaAssumida(soltas, local, itensDaSessao(session_id)));
  process.stdout.write(JSON.stringify({ decision: 'block', reason: partes.join('\n\n') }));
}

function motivoDaAssumida(soltas, local, itens) {
  const item = itens.length === 1 ? `,"item":"${itens[0]}"` : '';
  const exemplo = soltas.length ? ` (ex.: «${umaLinha(soltas[0]).slice(0, 120)}»)` : '';
  return `A mensagem final marca ${soltas.length} decisão(ões) como "assumida, a confirmar" ou "Q-ID não reservado"${exemplo}, ` +
    'e o turno não gravou a pergunta assumida no painel: sem ela o operador não vê a decisão (protocolo.md#nunca-travar). Para cada uma: ' +
    `\`Q=$(proxima-pergunta) && painel set perguntas "$Q" '{"sessaoId":"${local ?? '<seu local_…>'}"${item},"estado":"assumida","titulo":"…","caso":"…","recomendacao":"o que você assumiu"}'\` ` +
    'e cite o Q-ID na linha da decisão. Se a mensagem só cita a regra, ponha a expressão entre crases. Depois encerre o turno.';
}

const umaLinha = (s) => String(s).replace(/\s+/g, ' ').trim();

function motivoDoPainel(session_id, motivos) {
  const itens = itensDaSessao(session_id);
  const onde = itens.length
    ? `Grave no item que você é dona: ${itens.map((f) => `\`painel update fila ${f} '{"etapa":…,"agora":…}'\``).join(' · ')} ` +
      '(e, se houve pergunta ou resposta, `… perguntas <ID>`). Depois encerre o turno.'
    : 'Grave no painel com `painel update sessoes <sessionId> \'{...}\'` ' +
      '(estado, etapa, pr) e, se houve pergunta ou resposta, `… perguntas <ID>`. Depois encerre o turno.';
  return `Painel das sessões não atualizado neste turno, e a sessão mudou de estado (${[...motivos].join('; ')}). ${onde}`;
}

try {
  main();
} catch (err) {
  try { appendFileSync(LOG, `${new Date().toISOString()} ${err?.stack || err}\n`); } catch { /* sem log */ }
}
process.exitCode = 0;
