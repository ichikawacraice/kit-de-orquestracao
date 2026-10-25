#!/usr/bin/env node
// Stop hook (Q14, opção b): numa sessão de projeto que TEM orquestradora ativa,
// o turno não termina se a sessão mudou de estado no painel (abriu/mergeou PR,
// tirou ID de pergunta, abriu/arquivou sessão, recebeu resposta a um Qnn) e não
// gravou nada no painel (painel.mjs set|update|batch|delete) no mesmo turno.
//
// "Projeto com orquestradora": existe marcador ~/.claude/orquestracao/ativas/<session_id>
// de OUTRA sessão cujo repositório (git common dir) é o desta. O marcador guarda o
// git common dir; marcador vazio (formato antigo) é resolvido pelo cwd do transcript.
// Marcador cujo transcript não muda há 7 dias é ignorado.
// A própria orquestradora fica com orquestradora-ritual.mjs; a que perdeu o marcador
// (limpeza de contexto troca o session_id) ganha um de volta pelo título.
import { readFileSync, existsSync, appendFileSync, writeFileSync, mkdirSync, readdirSync, statSync, openSync, readSync, closeSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { gravaNoPainel } from './hooks-crewai-comum.mjs';
import { BASE as BASE_DO_POOL, registroDaSessao, projetoTemOrquestradora, gitCommonDir } from './pool-comum.mjs';

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
  const painel = process.env.PAINEL_DIR || process.env.IZANAGI_PAINEL_DIR || join(BASE, 'painel');
  return ids.some((q) => {
    try { return JSON.parse(readFileSync(join(painel, 'perguntas', `${q}.json`), 'utf8')).data?.sessaoId === local; } catch { return false; }
  });
}

const ETAPAS_FINAIS = ['feito', 'descartado'];
const ETAPAS = ['planejamento', 'design', 'execucao', 'validacao', 'merge', 'feito', 'descartado'];
// Itens vivos da fila de que esta sessão é dona (mesma leitura do fila-do-item.mjs: donoLocalId + etapa fora de
// feito/descartado; sem etapa, o critério antigo estado === 'em-andamento'). Só serve para escolher a mensagem.
function itensDaSessao(sessionId) {
  const local = registroDaSessao(sessionId)?.localId;
  if (!local) return [];
  const dir = join(process.env.PAINEL_DIR || process.env.IZANAGI_PAINEL_DIR || join(BASE, 'painel'), 'fila');
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

// Abertura do turno pela mesma regra do pool-comum e do fila-do-item (F41): a linha `user` com origem abre o turno, meta ou
// não (mensagem entre sessões é gravada com `isMeta: true` e `origin`); a meta SEM origem e o `tool_result` não. Devolve o
// índice da entrada (-1 se nenhuma tem `origin` ou `turnOrigin`). Cópia local porque o hook roda `main` ao carregar; o teste
// de concordância extrai esta função do texto.
function inicioDoTurno(entradas) {
  for (let i = entradas.length - 1; i >= 0; i--) {
    const e = entradas[i];
    const c = e.message?.content;
    const ehResultado = Array.isArray(c) && c.some((b) => b?.type === 'tool_result');
    if (e.type !== 'user' || ehResultado) continue;
    if (e.isMeta && !e.origin?.kind) continue;
    if (e.origin?.kind || e.turnOrigin) return i;
  }
  return -1;
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

  // `null` (não consegui medir) aqui vale "não": o hook só cobra gravação no painel de quem sabe ter orquestradora.
  if (projetoTemOrquestradora(session_id, meuRepo) !== true) return;

  const inicio = inicioDoTurno(entradas);
  if (inicio < 0) return;

  const motivos = new Set();
  if (citaPerguntaDestaSessao(textoDe(entradas[inicio].message), session_id)) motivos.add('recebeu resposta a uma pergunta Qnn');

  let gravou = false;
  for (const e of entradas.slice(inicio + 1)) {
    if (e.type !== 'assistant' || !Array.isArray(e.message?.content)) continue;
    for (const it of e.message.content) {
      if (it.type !== 'tool_use') continue;
      if (it.name === 'Bash') {
        const cmd = String(it.input?.command ?? '');
        if (GRAVA_NO_PAINEL.test(cmd)) gravou = true;
        for (const [re, m] of GATILHOS_BASH) if (re.test(cmd)) motivos.add(m);
      }
      if (it.name.endsWith('start_session')) motivos.add('abriu sessão');
      if (it.name.endsWith('archive_session')) motivos.add('arquivou sessão');
    }
  }
  if (gravou || motivos.size === 0) return;

  const itens = itensDaSessao(session_id);
  const onde = itens.length
    ? `Grave no item que você é dona: ${itens.map((f) => `\`painel update fila ${f} '{"etapa":…,"agora":…}'\``).join(' · ')} ` +
      '(e, se houve pergunta ou resposta, `… perguntas <ID>`). Depois encerre o turno.'
    : 'Grave no painel com `painel update sessoes <sessionId> \'{...}\'` ' +
      '(estado, etapa, pr) e, se houve pergunta ou resposta, `… perguntas <ID>`. Depois encerre o turno.';
  process.stdout.write(JSON.stringify({
    decision: 'block',
    reason: `Painel das sessões não atualizado neste turno, e a sessão mudou de estado (${[...motivos].join('; ')}). ${onde}`,
  }));
}

try {
  main();
} catch (err) {
  try { appendFileSync(LOG, `${new Date().toISOString()} ${err?.stack || err}\n`); } catch { /* sem log */ }
}
process.exitCode = 0;
