#!/usr/bin/env node
// Stop + SubagentStop (Q62, ideia 2 do estudo CrewAI — Task.guardrail + guardrail_max_retries):
// o executor só termina o turno com a SAÍDA REAL do comando de critério no relatório.
// Quem é executor: subagente `executor` (agent_type), sessão aberta com --agent executor,
// sessão cujo título começa com "exec ·", ou executora do pool (título `E<n> · …` no registro do app).
// Só cobra turno que editou arquivo — por Edit/Write ou por Bash que grava (57% dos executores
// reais editam só por Bash). Status ("exit=0", "Found 0 errors") e contagem ("98 passed") só valem
// se aparecem na saída real do turno (Bash, Read de .output/.log, Monitor, TaskOutput, notificação).
// No subagente não há adiamento por background: o `background_tasks` do SubagentStop traz o próprio
// agente e as tarefas da mãe (validação de 23/10), e o subagente que termina não tem turno seguinte.
// No fio principal ("exec ·"), o turno que para esperando gate em background adia para o da notificação.
// No fio principal ("exec ·"), no máximo 2 turnos seguidos adiados: dev server/Monitor eterno não desliga a trava.
// Não cobra quem devolve dúvida (pergunta fora de bloco de código que não é título markdown,
// "Bloqueado: <motivo>" abrindo a linha, "devolvo", "parei", "estou bloqueado").
// Saída com "N failed" exige o relatório citar o N junto da falha.
// No máximo 2 cobranças por turno; depois deixa passar e registra. Erro vai para o log e o turno termina.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { BASE, registrar, lerEntrada, lerTranscript, semPrefixoDoPlugin } from './hooks-crewai-comum.mjs';
import { registroDaSessao, membroDoPool } from './pool-comum.mjs';

const HOOK = 'executor-criterio';
const ESTADO = join(BASE, 'hooks-crewai-estado.json');
const MAX_COBRANCAS = 2;
const MAX_ADIAMENTOS = 2;
const EDITA = new Set(['Edit', 'Write', 'NotebookEdit', 'MultiEdit']);
// Bash que grava arquivo: sed/perl -i, redireção para arquivo (não /dev/null nem &N), tee, heredoc
// para interpretador, git apply/am, patch. Basta para separar "editou" de "só conferiu".
const BASH_GRAVA = [
  /\b(sed|perl)\s+(-[a-zA-Z]*\s+)*-[a-zA-Z]*i/,
  /(^|[^<>&0-9=-])>>?\s*(?!\/dev\/null\b|&)["']?[\w~./$-]/,
  /\btee\b/,
  /\b(python3?|node|ruby)\b[^|;&]*<<-?\s*['"]?\w/,
  /\bgit\s+(apply|am)\b/,
  /\bpatch\b\s+-/,
];
const SAIDA_DE_TOOL = new Set(['Bash', 'Monitor', 'TaskOutput', 'BashOutput']);

// Status de comando, normalizado para comparar com a saída real.
const STATUS = /\b(?:exit(?:\s*code|\s*status)?\s*[=:]?\s*-?\d+|\w+_EXIT\s*=\s*\d+|(?:test|tests|typecheck|gate|lint|build)\s*=\s*\d+|Found\s+\d+\s+errors?)\b/gi;
const normalizarStatus = (s) => s.toLowerCase().replace(/\bexit(?:\s*code|\s*status)?\s*[=:]?\s*/, 'exit=').replace(/\s+/g, ' ').trim();

function textoDe(msg) {
  const c = msg?.content;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) return c.filter((x) => x.type === 'text').map((x) => x.text).join('\n');
  return '';
}
const conteudoDe = (c) => (typeof c === 'string' ? c : (c || []).map((x) => x.text || '').join('\n'));

function ehMensagemDeAbertura(e) {
  if (e.type !== 'user' || e.isMeta || e.isCompactSummary) return false;
  const c = e.message?.content;
  if (typeof c === 'string') return !/^(Subagent)?Stop hook feedback/.test(c);
  return Array.isArray(c) && !c.some((x) => x.type === 'tool_result');
}

function turnoAtual(entradas) {
  let inicio = 0;
  for (let i = entradas.length - 1; i >= 0; i--) if (ehMensagemDeAbertura(entradas[i])) { inicio = i; break; }
  const turno = entradas.slice(inicio + 1);
  const usos = new Map();
  let editou = false;
  const fundo = new Set();
  let ultimoTexto = '';
  for (const e of turno) {
    if (e.type !== 'assistant' || !Array.isArray(e.message?.content)) continue;
    for (const c of e.message.content) {
      if (c.type !== 'tool_use') continue;
      usos.set(c.id, c);
      if (EDITA.has(c.name)) editou = true;
      if (c.name === 'Bash' && BASH_GRAVA.some((r) => r.test(String(c.input?.command || '')))) editou = true;
      if (c.name === 'Monitor' || c.input?.run_in_background === true) fundo.add(c.id);
    }
    const t = textoDe(e.message);
    if (t.trim()) ultimoTexto = t;
  }
  // A notificação de tarefa em background que abriu o turno traz o status do comando.
  const abertura = entradas[inicio];
  const saidas = abertura?.origin?.kind === 'task-notification' ? [textoDe(abertura.message)] : [];
  let rodou = saidas.length > 0;
  for (const e of turno) {
    if (e.type !== 'user' || !Array.isArray(e.message?.content)) continue;
    for (const c of e.message.content) {
      if (c.type !== 'tool_result') continue;
      const uso = usos.get(c.tool_use_id);
      const lido = uso?.name === 'Read' && /\.(output|log)$/.test(String(uso.input?.file_path || ''));
      if (!uso || !(SAIDA_DE_TOOL.has(uso.name) || lido)) continue;
      saidas.push(conteudoDe(c.content));
      rodou = true;
    }
  }
  // Notificação dentro do turno (no subagente chega como queued_command): traz o status e
  // fecha o fundo que ela cita. Fundo sem notificação = ainda esperando.
  for (const e of turno) {
    const t = e.type === 'user' ? textoDe(e.message) : e.attachment?.type === 'queued_command' ? String(e.attachment.prompt || '') : '';
    if (!t.includes('<task-notification>')) continue;
    saidas.push(t);
    rodou = true;
    for (const m of t.matchAll(/<tool-use-id>([^<]+)<\/tool-use-id>/g)) fundo.delete(m[1]);
  }
  return { chave: abertura?.uuid || 'inicio', editou, esperaFundo: fundo.size > 0, rodou, saidas: saidas.join("\n"), lista: saidas, ultimoTexto };
}

// O título vive na última entrada custom-title; achar sem parsear o transcript inteiro
// (o Stop roda em TODA sessão, e há transcripts de 100+ MB).
function tituloRapido(caminho) {
  const s = readFileSync(caminho, 'utf8');
  const i = s.lastIndexOf('"customTitle":"');
  if (i < 0) return '';
  const m = s.slice(i + 14, i + 600).match(/^"((?:[^"\\]|\\.)*)"/);
  try { return m ? JSON.parse(`"${m[1]}"`) : ''; } catch { return ''; }
}

// Status do relatório ("exit=0", "Found 0 errors") que aparece igual numa saída do turno.
function statusConfere(relatorio, saidas) {
  const real = saidas.toLowerCase().replace(/\bexit(?:\s*code|\s*status)?\s*[=:]?\s*/g, 'exit=').replace(/\s+/g, ' ');
  for (const m of relatorio.matchAll(STATUS)) {
    const s = normalizarStatus(m[0]);
    // "exit=1" não casa com "exit=10": o status acaba onde acaba o número.
    for (let i = real.indexOf(s); i >= 0; i = real.indexOf(s, i + 1)) {
      if (!/\d/.test(real[i + s.length] || '')) return true;
    }
  }
  return false;
}

// Contagem ("98 passed", "98 testes verdes") vale quando o mesmo número sai, igual, de um
// "N passed"/"N failed" numa saída do turno. Saída com falha exige o relatório admitir a falha.
function resumoConfere(relatorio, saidas) {
  const re = /(\d+)\s+(?:testes?\s+|casos?\s+)?(passaram|verdes|passou|passed|falharam|falhou|vermelhos?|failed)\b/gi;
  for (const m of relatorio.matchAll(re)) {
    const palavra = /^(falh|verm|fail)/i.test(m[2]) ? 'failed' : 'passed';
    if (new RegExp(`(^|\\D)${m[1]}\\s+${palavra}\\b`).test(saidas)) return true;
  }
  return false;
}
// Só a ÚLTIMA saída com contagem conta: o gate vermelho de antes do conserto não é o resultado.
// Admitir a falha é citar um dos números de falha da saída junto da palavra, antes ou depois
// ("2 testes falharam", "falharam 2", "Tests  2 failed" colado): "nenhuma falha nova" usa a palavra e
// esconde o número. Todos os N contam — o vitest diz "Test Files  1 failed" antes de "Tests  2 failed".
// Resíduo aceito: um número qualquer a até 30 caracteres da palavra ("2 dias sem falha") libera.
const escondeFalha = (relatorio, lista) => {
  const ultima = [...lista].reverse().find((s) => /\d+\s+(passed|failed)\b/.test(s)) ?? '';
  const ns = [...ultima.matchAll(/(?:^|\D)([1-9]\d*)\s+failed\b/g)].map((m) => m[1]);
  if (!ns.length) return false;
  // O status ("exit=1") sai do texto antes: o 1 dele não é o número de falhas.
  const texto = relatorio.replace(STATUS, ' ');
  return !ns.some((n) => new RegExp(
    `(^|\\D)${n}(?!\\d)[^\\n]{0,30}?(falh|fail|vermelh)|(falh|fail|vermelh)[^\\n]{0,15}?(^|\\D)${n}(?!\\d)`, 'i').test(texto));
};

// Linha de bloco de código do relatório que aparece, igual, numa saída do turno.
function colouSaidaReal(relatorio, saidas) {
  const blocos = relatorio.match(/```[^\n]*\n[\s\S]*?```/g) || [];
  for (const b of blocos) {
    for (const linha of b.split('\n').slice(1, -1)) {
      const l = linha.trim();
      if (l.length >= 10 && saidas.includes(l)) return true;
    }
  }
  return false;
}

// Dúvida devolvida: pergunta fora de bloco de código (título markdown terminando em "?" não é
// pergunta), "Bloqueado:" abrindo a linha, ou o verbo de quem parou.
function devolveuDuvida(relatorio) {
  const prosa = relatorio.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  return /^(?![ \t]*#)[^\n]*\?[ \t*]*$/m.test(prosa)
    || /^[ \t]*(?:[-*][ \t]*)?\**bloquead[oa]\**[ \t]*:\**[ \t]*\S[^\n]{14,}/im.test(prosa)
    || /\b(devolvo|devolvendo|parei|travei|(estou|fiquei|estava)\s+bloquead[oa])\b/i.test(prosa);
}

function lerEstado() {
  try { return existsSync(ESTADO) ? JSON.parse(readFileSync(ESTADO, 'utf8')) : {}; } catch { return {}; }
}
function gravarEstado(estado) {
  const limite = Date.now() - 7 * 24 * 3600 * 1000;
  for (const [k, v] of Object.entries(estado)) if (v.em < limite) delete estado[k];
  writeFileSync(ESTADO, JSON.stringify(estado));
}

function main() {
  const e = lerEntrada();
  const sub = e.hook_event_name === 'SubagentStop';
  if (!sub && e.agent_id) return; // Stop de dentro de subagente: quem cobra é o SubagentStop
  const tipo = semPrefixoDoPlugin(e.agent_type); // `orquestracao:executor` vale `executor`
  if (sub && tipo !== 'executor') return;
  const transcript = sub ? e.agent_transcript_path : e.transcript_path;
  if (!transcript || !existsSync(transcript)) return;
  if (!sub && tipo !== 'executor' && !/^exec\s*·/.test(tituloRapido(transcript))
    && membroDoPool(registroDaSessao(e.session_id)?.titulo)?.papel !== 'E') return; // executora do pool: `E<n> · …` no registro do app

  const turno = turnoAtual(lerTranscript(transcript));
  const sessao = e.session_id;
  const quem = sub ? `subagente ${e.agent_id}` : 'principal';
  const estado = lerEstado();
  // Fio principal: turno que editou e parou esperando trabalho em background não é o fim;
  // a cobrança fica pendente para o turno em que o resultado chega.
  const pendente = `${sessao}:principal:pendente`;
  if (!sub && estado[pendente] && estado[pendente].em < Date.now() - 24 * 3600 * 1000) delete estado[pendente];
  if (!turno.editou && (sub || !estado[pendente])) return;
  if (!sub) {
    const esperando = Array.isArray(e.background_tasks) ? e.background_tasks.length > 0 : turno.esperaFundo;
    // Dev server ou Monitor que nunca termina deixaria o adiamento eterno: no 3º turno seguido
    // adiado, cobra assim mesmo.
    const adiados = estado[pendente]?.n || 0;
    if (esperando && adiados < MAX_ADIAMENTOS) {
      estado[pendente] = { n: adiados + 1, em: Date.now() };
      gravarEstado(estado);
      registrar(sessao, HOOK, 'adiou-esperando-fundo', quem);
      return;
    }
  }

  const chave = `${sessao}:${sub ? e.agent_id : 'principal'}:${turno.chave}`;
  const encerrar = () => { delete estado[pendente]; delete estado[chave]; gravarEstado(estado); };
  const relatorio = e.last_assistant_message ?? turno.ultimoTexto;
  const cobrancas = estado[chave]?.n || 0;

  const comSaida = !escondeFalha(relatorio, turno.lista)
    && (statusConfere(relatorio, turno.saidas) || resumoConfere(relatorio, turno.saidas) || colouSaidaReal(relatorio, turno.saidas));
  if (comSaida) {
    registrar(sessao, HOOK, cobrancas ? 'corrigiu-apos-cobranca' : 'passou-com-saida', `${quem} cobrancas=${cobrancas}`);
    encerrar();
    return;
  }
  if (devolveuDuvida(relatorio)) {
    registrar(sessao, HOOK, 'passou-duvida', quem);
    encerrar();
    return;
  }
  if (cobrancas >= MAX_COBRANCAS) {
    registrar(sessao, HOOK, 'deixou-passar-apos-2', quem);
    encerrar();
    return;
  }

  estado[chave] = { n: cobrancas + 1, em: Date.now() };
  gravarEstado(estado);
  registrar(sessao, HOOK, `cobrou-${cobrancas + 1}`, `${quem} rodou=${turno.rodou}`);
  process.stdout.write(JSON.stringify({
    decision: 'block',
    reason:
      `Relatório sem a saída real do comando de critério (cobrança ${cobrancas + 1} de ${MAX_COBRANCAS}). ` +
      'Rode o comando de critério do plano terminando em `; echo "exit=$?"` e cole as últimas linhas da saída ' +
      'num bloco de código (inclusive o `exit=N`), mesmo se falhou — o status e os números têm de estar na saída. ' +
      'Se você parou por dúvida, escreva a pergunta inteira, terminando em "?".',
  }));
}

try {
  main();
} catch (err) {
  registrar('-', HOOK, 'erro', err?.stack || err);
}
process.exitCode = 0;
