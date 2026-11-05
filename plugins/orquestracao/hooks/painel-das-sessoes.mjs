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
import { gravaNoPainel, BASE as BASE_CREWAI, lerEstadoDe, gravarEstadoDe } from './hooks-crewai-comum.mjs';
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
  // Só a chamada (início do comando, depois de ; & | ( ou $(, com caminho e `bash` opcionais): grep, cat ou commit que
  // citam o nome não tiram ID.
  [/(?:^|[;&|(\n]|\$\()\s*(?:(?:ba)?sh\s+)?(?:[^\s;&|()]*\/)?proxima-pergunta(?:\.sh)?(?![\w.-])/, 'tirou ID de pergunta'],
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
// Borda por letra/dígito (não `\b`): `_assumida, a confirmar_` também é marca.
const MARCA_ASSUMIDA = /(?<![\p{L}\d])(?:assumid[oa]s?\s*,\s*a\s+confirmar|Q-?IDs?\s+n[ãa]o\s+reservad[oa]s?)(?![\p{L}\d])/iu;
const NAO_RESERVADO = /(?<![\p{L}\d])Q-?IDs?\s+n[ãa]o\s+reservad[oa]s?(?![\p{L}\d])/iu;
// Sem o local_… da sessão, a gravação só se vê pelo comando: escrita no painel, coleção perguntas, `"estado":"assumida"`.
const ESTADO_ASSUMIDA = /estado\\?"\s*:\s*\\?"assumida\\?"/;
const ITEM_DE_LISTA = /^\s*(?:[-*+]|\d+[.)])\s/;
const ESTADO_HOOKS = join(BASE_CREWAI, 'hooks-crewai-estado.json');

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

// As decisões marcadas da mensagem. Item de lista: o item com as linhas que o continuam (a decisão e o Q-ID dela podem estar em
// linhas diferentes). Fora de lista, a linha marcada é a unidade: a linha seguinte sem marca a continua, a marcada abre outra
// decisão; linha de tabela vale sempre sozinha. Cabeçalho marcado (`#…`, linha toda em negrito ou terminada em ":") seguido de
// lista não é decisão: passa a marca aos itens abaixo, como o item terminado em ":" passa aos subitens dele.
const CABECALHO = /^\s*#{1,6}\s|:\s*[*_]*\s*$|^\s*(\*\*|__).*\1\s*$/;
function decisoesMarcadas(texto) {
  const unidades = [];
  let atual = null;
  for (const linha of texto.split('\n')) {
    if (!linha.trim()) { atual = null; continue; }
    const lista = ITEM_DE_LISTA.test(linha);
    const tabela = /^\s*\|/.test(linha);
    if (lista || tabela || !atual || atual.tabela || (!atual.lista && MARCA_ASSUMIDA.test(linha))) {
      atual = { linhas: [], lista, tabela, recuo: linha.match(/^\s*/)[0].length };
      unidades.push(atual);
    }
    atual.linhas.push(linha);
  }
  const marcadas = [];
  let herda = false;
  const pais = [];
  unidades.forEach((u, i) => {
    const t = u.linhas.join('\n');
    const marca = MARCA_ASSUMIDA.test(t);
    const prox = unidades[i + 1];
    if (u.tabela) { if (marca) marcadas.push(t); return; }
    if (!u.lista) {
      pais.length = 0;
      if (u.linhas.length === 1 && CABECALHO.test(t) && prox?.lista) { herda = marca; return; }
      herda = false;
      if (marca) marcadas.push(t);
      return;
    }
    while (pais.length && pais.at(-1).recuo >= u.recuo) pais.pop();
    const herdada = herda || pais.some((p) => p.marca);
    const temFilhos = Boolean(prox?.lista && prox.recuo > u.recuo);
    if (temFilhos && /:\s*[*_]*\s*$/.test(u.linhas[0])) { pais.push({ recuo: u.recuo, marca: marca || herdada }); return; }
    if (temFilhos) pais.push({ recuo: u.recuo, marca: false });
    if (marca || herdada) marcadas.push(t);
  });
  return marcadas;
}

function perguntaDaSessao(painel, q, local) {
  try { const f = acharPergunta(join(painel, 'perguntas'), q); return Boolean(f) && JSON.parse(readFileSync(f, 'utf8')).data?.sessaoId === local; } catch { return false; }
}

// Assumidas desta sessão gravadas no turno, pelo arquivo (o comando que falhou não conta): `atualizadoEm` desde o início do turno.
function assumidasGravadasNoTurno(painel, local, desdeIso) {
  const ids = new Set();
  const desde = Date.parse(desdeIso ?? '');
  const dir = join(painel, 'perguntas');
  if (Number.isNaN(desde) || !existsSync(dir)) return ids;
  for (const nome of readdirSync(dir)) {
    if (!nome.endsWith('.json')) continue;
    try {
      const doc = JSON.parse(readFileSync(join(dir, nome), 'utf8'));
      const d = doc?.data;
      if (d?.sessaoId === local && d.estado === 'assumida' && Date.parse(d.atualizadoEm ?? '') >= desde) ids.add(doc.id ?? nome.replace(/\.json$/, ''));
    } catch { /* ilegível: ignora */ }
  }
  return ids;
}

// Devolve as decisões marcadas que ficaram sem pergunta no painel ([] = nada a cobrar). A decisão se resolve quando o bloco dela
// cita um Qnn que é pergunta desta sessão (gravada agora ou num turno anterior, confirmada ou não), salvo o bloco que diz "Q-ID
// não reservado". As que sobram precisam, cada uma, de uma assumida gravada no turno e não citada por outro bloco.
function assumidasSemPergunta(mensagem, inicioIso, comandos, local) {
  const marcadas = decisoesMarcadas(semCitacao(mensagem));
  if (marcadas.length === 0) return [];
  const painel = process.env.PAINEL_DIR || join(BASE, 'painel');
  const citadas = new Set();
  const soltas = [];
  for (const t of marcadas) {
    const daSessao = local ? (t.match(/\bQ\d+\b/g) ?? []).filter((q) => perguntaDaSessao(painel, q, local)) : [];
    if (daSessao.length && !NAO_RESERVADO.test(t)) daSessao.forEach((q) => citadas.add(q));
    else soltas.push(t);
  }
  if (soltas.length === 0) return [];
  const gravadas = local
    ? [...assumidasGravadasNoTurno(painel, local, inicioIso)].filter((q) => !citadas.has(q)).length
    : comandos.filter((c) => GRAVA_NO_PAINEL.test(c) && /\bperguntas\b/.test(c) && ESTADO_ASSUMIDA.test(c)).length;
  return gravadas >= soltas.length ? [] : soltas;
}

// O Q-ID que a mensagem final cita e que não existe no painel (nem na pasta quente, nem no arquivo): reservado com
// `proxima-pergunta` e não gravado, o operador lê a pergunta no chat e não a vê no painel. Só conta o Q-ID da faixa recente
// do contador (os últimos JANELA_QID tirados): `Q4` de trimestre, `Q12` de exemplo e o Q-ID antigo que o arquivo já não
// guarda ficam de fora, e o acima do contador nunca foi reservado. Sem contador ou sem pasta de perguntas, não cobra.
// Conta o Q-ID entre crases; o bloco de código (``` ou ~~~) e o Q-ID que já vinha na mensagem que abriu o turno, não.
const JANELA_QID = 50;
const CONTADOR = join(BASE, 'contador-de-perguntas');
const SEM_BLOCO = /(```|~~~)[\s\S]*?(?:\1|$)/g;
const qidsDe = (t) => new Set(String(t ?? '').replace(SEM_BLOCO, ' ').match(/\bQ\d+\b/g) ?? []);
function qidsSemPergunta(mensagem, abertura) {
  const dir = join(process.env.PAINEL_DIR || join(BASE, 'painel'), 'perguntas');
  let teto;
  try { teto = parseInt(readFileSync(CONTADOR, 'utf8'), 10); } catch { return []; }
  if (!Number.isInteger(teto) || !existsSync(dir)) return [];
  const daAbertura = qidsDe(abertura);
  return [...qidsDe(mensagem)].filter((q) => {
    const n = Number(q.slice(1));
    return n > teto - JANELA_QID && n <= teto && !daAbertura.has(q) && !acharPergunta(dir, q);
  });
}

// Uma cobrança por turno: o Stop que vem depois de uma recusa (de qualquer trava) traz `stop_hook_active`, e é nele que costuma
// estar o relatório final; a trava o lê, mas não recusa duas vezes o mesmo turno.
// Cada cobrança (`assumida`, `qid`) tem a sua marca: recusar o Q-ID não gasta a da decisão assumida.
function jaCobrouNoTurno(sessionId, turno, tipo) {
  return lerEstadoDe(ESTADO_HOOKS)[`${sessionId}:${tipo}`]?.turno === turno;
}
// Devolve se gravou: sem a marca, a recusa seguinte não se distingue da primeira e a sessão entraria em laço.
function marcarCobranca(sessionId, turno, tipos) {
  try { gravarEstadoDe(ESTADO_HOOKS, (s) => { for (const t of tipos) s[`${sessionId}:${t}`] = { turno, em: Date.now() }; }); return true; } catch (err) {
    try { appendFileSync(LOG, `${new Date().toISOString()} F400: marca do turno não gravada (${err?.code || err}); ${sessionId} não é cobrado de novo\n`); } catch { /* sem log */ }
    return false;
  }
}

function main() {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const { session_id, transcript_path, stop_hook_active, cwd } = input;
  if (!session_id || !transcript_path) return;
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
  // A trava antiga recusa uma vez (stop_hook_active); a da assumida tem a marca própria por turno (F400).
  const cobraPainel = !stop_hook_active && !gravou && motivos.size > 0;
  const turno = String(entradas[inicio].uuid ?? entradas[inicio].timestamp ?? inicio);
  let soltas = [];
  let fantasmas = [];
  let local;
  if (!input.agent_id) {
    local = registroDaSessao(session_id)?.localId;
    const mensagem = String(input.last_assistant_message || mensagemFinal(entradas, inicio) || '');
    if (!(stop_hook_active && jaCobrouNoTurno(session_id, turno, 'assumida'))) {
      soltas = assumidasSemPergunta(mensagem, entradas[inicio].timestamp, comandos, local);
    }
    if (!(stop_hook_active && jaCobrouNoTurno(session_id, turno, 'qid'))) {
      fantasmas = qidsSemPergunta(mensagem, textoDe(entradas[inicio].message));
    }
  }
  // Depois de uma recusa (stop_hook_active), sem a marca gravada não se recusa de novo: é o que impede o laço.
  const tipos = [...(soltas.length ? ['assumida'] : []), ...(fantasmas.length ? ['qid'] : [])];
  if (tipos.length && !marcarCobranca(session_id, turno, tipos) && stop_hook_active) { soltas = []; fantasmas = []; }
  if (!cobraPainel && soltas.length === 0 && fantasmas.length === 0) return;

  const partes = [];
  if (cobraPainel) partes.push(motivoDoPainel(session_id, motivos));
  if (soltas.length) partes.push(motivoDaAssumida(soltas, local, itensDaSessao(session_id)));
  if (fantasmas.length) partes.push(motivoDoQidSemPergunta(fantasmas, local, itensDaSessao(session_id)));
  process.stdout.write(JSON.stringify({ decision: 'block', reason: partes.join('\n\n') }));
}

function motivoDaAssumida(soltas, local, itens) {
  const item = itens.length === 1 ? `,"item":"${itens[0]}"` : '';
  const exemplo = soltas.length ? ` (ex.: «${umaLinha(soltas[0]).slice(0, 120)}»)` : '';
  return `A mensagem final marca ${soltas.length} decisão(ões) como "assumida, a confirmar" ou "Q-ID não reservado"${exemplo}, ` +
    'e o turno não gravou a pergunta assumida no painel: sem ela o operador não vê a decisão (protocolo.md#nunca-travar). Para cada uma: ' +
    `\`Q=$(proxima-pergunta) && painel set perguntas "$Q" '{"sessaoId":"${local ?? '<seu local_…>'}"${item},"estado":"assumida","titulo":"…","caso":"…","recomendacao":"o que você assumiu"}'\` ` +
    'e cite o Q-ID junto da decisão. A que já está no painel não se grava de novo: só cite o Q-ID dela no mesmo item. ' +
    'Se a mensagem só cita a regra, ponha a expressão entre crases. Depois encerre o turno.';
}

function motivoDoQidSemPergunta(ids, local, itens) {
  const item = itens.length === 1 ? `,"item":"${itens[0]}"` : '';
  return `A mensagem final cita ${ids.join(', ')}, número recente do contador de perguntas que não está no painel: ` +
    'se é um Q-ID que você reservou, a pergunta não foi gravada e o operador não a vê. Para cada um: ' +
    ids.map((q) => `\`painel set perguntas ${q} '{"sessaoId":"${local ?? '<seu local_…>'}"${item},"estado":"aberta","titulo":"…","caso":"…","recomendacao":"…"}'\``).join(' · ') +
    ' (`"estado":"assumida"` se você já seguiu com a recomendação). Se não é Q-ID de pergunta (trimestre, exemplo, número errado), reescreva a mensagem sem ele. Depois encerre o turno.';
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
