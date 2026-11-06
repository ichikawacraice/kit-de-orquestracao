#!/usr/bin/env node
// Stop hook: cobra a regra de contexto por papel da skill `papeis-e-modelos` ("Contexto"), que só valeria se a sessão
// lembrasse de chamar `get_usage`. Lê o `usage` do transcript (último não-sidechain). Grava só o nível já cobrado da sessão
// (F420, `<sid>:contexto` no estado dos hooks): um aviso por limiar cruzado, não um por turno.
//   orquestradora: com o operador presente o Stop não a bloqueia: a limpeza é dele, pelo botão `↺ Limpar` da barra (destacado
//     a partir de 250 mil: a sessão já recomeça com ~105 mil, F219); o hook só registra (`contexto-alto`, ou `limpou`). Com o modo ausente ligado o papel é
//     `orquestradora-ausente` e segue a régua da dona; o aviso diz que a régua vem da bandeira e como desligá-la, porque a
//     bandeira ligada pelo botão do painel fica ligada até alguém a desligar, mesmo com o operador de volta.
//   dona (a sessão é `donoLocalId` de item vivo da fila): ≥ 500 mil cobra limpar (só `clear_session` "self" satisfaz);
//     ≥ 350 mil cobra limpar OU a linha `Contexto: sigo — <o que falta na unidade>`; ≥ 250 mil com o turno terminando
//     esperando o operador (`?` ou `Q<n>` no último parágrafo) cobra limpar antes.
// `clear_session` recusado (tool_result com `is_error`) não conta como limpeza.
// Uma cobrança por limiar (espera=1, alto=2, teto=3): o turno seguinte no mesmo limiar passa (`ja-avisado`); só um limiar acima
// cobra de novo, e o contexto que cai abaixo do nível cobrado (limpeza, compactação) rearma. A linha `Contexto: sigo` também
// responde ao limiar. `stop_hook_active` deixa passar sem contar como avisado. Erro nunca prende o turno. Limites: constantes abaixo, com override
// `CONTEXTO_LIMITE_<NOME>` só para teste. Fonte da regra: skills/papeis-e-modelos/SKILL.md, seção "Contexto".
import { readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { BASE, registrar, textoDe, modoAusente, lerEstadoDe, gravarEstadoDe } from './hooks-crewai-comum.mjs';
import { anfitriao } from './anfitriao.mjs';
import { registroDaSessao, ehOrquestradora, itensDonosDaSessao, inicioDoTurno, contextoDoTranscript } from './pool-comum.mjs';

const HOOK = 'contexto-do-papel';
const limite = (nome, padrao) => { const v = Number(process.env[`CONTEXTO_LIMITE_${nome}`]); return Number.isFinite(v) && v > 0 ? v : padrao; };
const ESPERA = limite('ESPERA', 250_000); const ALTO = limite('ALTO', 350_000); const TETO = limite('TETO', 500_000);
const PEDIR = limite('PEDIR', 250_000);
const mil = (t) => Math.round(t / 1000);
const ESTADO = join(BASE, 'hooks-crewai-estado.json');

// Papel pela ordem: orquestradora (ou orquestradora-ausente), dona de item vivo. Sem papel → null.
function papelDe(e, reg) {
  if (ehOrquestradora(e.session_id, reg?.titulo)) return modoAusente() ? 'orquestradora-ausente' : 'orquestradora';
  if (itensDonosDaSessao(reg?.localId).length > 0) return 'dona';
  return null;
}

// F443 (ADR 0030, item 4): o anfitrião muda o que a cobrança manda fazer. No app, `clear_session "self"`; no Orca (que não tem
// essa ferramenta), o handoff e o `worker_done` — a coordenadora abre outro worker na worktree do item; no terminal, o handoff e
// o `/clear` pelo operador. `clear_session` só conta como limpeza no app.
const hostDaSessao = () => { try { return anfitriao({ env: process.env, cwd: process.cwd() }).anfitriao; } catch { return 'claude-desktop'; } };
const LIMPAR = {
  'claude-desktop': 'chame clear_session "self"',
  orca: 'grave o handoff (skill `handoff-de-sessao`) e termine o turno com `orca orchestration send --type worker_done --subject "troca de sessão" --outcome failed`, dizendo que é troca de sessão: a coordenadora abre outro worker na worktree do item',
  terminal: 'grave o handoff (skill `handoff-de-sessao`) e peça ao operador o `/clear`',
};

// O que o turno que começou em `inicio` (ms) fez e disse: chamou `clear_session` "self"? e o último texto (a última entrada com texto).
function doTurno(transcript, inicio, ultimaMensagem, host = 'claude-desktop') {
  const pedidos = new Set(); const recusados = new Set(); let texto = '';
  for (const l of readFileSync(transcript, 'utf8').split('\n')) {
    if (!l) continue;
    let x; try { x = JSON.parse(l); } catch { continue; }
    if (x.isSidechain === true || Date.parse(x.timestamp) < inicio) continue;
    if (x.type === 'user' && Array.isArray(x.message?.content)) {
      for (const b of x.message.content) if (b?.type === 'tool_result' && b.is_error === true && b.tool_use_id) recusados.add(b.tool_use_id);
      continue;
    }
    if (x.type !== 'assistant') continue;
    const t = textoDe(x.message).trim(); if (t) texto = t;
    const c = x.message?.content;
    if (!Array.isArray(c)) continue;
    for (const b of c) {
      if (host === 'claude-desktop' && b?.type === 'tool_use' && String(b.name || '').endsWith('clear_session') && [undefined, null, 'self'].includes(b.input?.session_id)) pedidos.add(b.id);
    }
  }
  if (typeof ultimaMensagem === 'string' && ultimaMensagem.trim()) texto = ultimaMensagem.trim();
  const limpou = [...pedidos].some((id) => !recusados.has(id)); // pedido sem `id` (transcript antigo) conta
  return { limpou, texto };
}

// O turno termina esperando o operador: `?` ou `Q<n>` no último parágrafo. O `?` de uma URL com query (`…/a?b=1`) não é pergunta;
// o `?` solto, mesmo colado numa URL, continua valendo.
function terminaEsperando(texto) {
  const ultimoParagrafo = (texto.split(/\n\s*\n/).pop() || '').replace(/https?:\/\/\S*\?\S+/g, '');
  return /\?|\bQ\d+\b/.test(ultimoParagrafo);
}

// Orquestradora com o operador presente: a limpeza é dele e o sinal é o botão `↺ Limpar` da barra, destacado a partir de
// 250 mil. O Stop não bloqueia (não há pergunta nem janela a cobrar); só registra, para o histórico.
function orquestradora(e, sid, transcript, t, det) {
  if (t < PEDIR) return;
  const { limpou } = doTurno(transcript, inicioDoTurno(transcript) ?? 0, e.last_assistant_message, hostDaSessao());
  registrar(sid, HOOK, limpou ? 'limpou' : 'contexto-alto', det);
}

// ` (desde 12:45 em São Paulo, pelo botão do painel)`: de onde veio a bandeira, para quem lê o aviso conferir.
function desdeDoModo() {
  const b = modoAusente(); if (!b) return '';
  const hora = new Date(b.desdeMs).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
  return ` (desde ${hora} em São Paulo${b.por === 'painel' ? ', pelo botão do painel' : b.por === 'comando' ? ', por `/ausente on`' : ''})`;
}

function main() {
  const e = JSON.parse(readFileSync(0, 'utf8'));
  const { session_id: sid, transcript_path: transcript, stop_hook_active: ativo } = e;
  if (!sid || !transcript) return;

  const ctx = contextoDoTranscript(transcript);
  if (!ctx) { registrar(sid, HOOK, 'sem-usage'); return; }
  const reg = registroDaSessao(sid);
  const papel = papelDe(e, reg);
  if (!papel) return;
  const host = hostDaSessao(); let limpar = LIMPAR[host] ?? LIMPAR['claude-desktop'];
  // No Orca a orquestradora é a coordenadora: não há dispatch para o `worker_done`; ela grava o handoff e o operador troca a sessão.
  if (host === 'orca' && papel === 'orquestradora-ausente') limpar = 'grave o handoff (skill `handoff-de-sessao`) e avise o operador no próximo contato que a sessão precisa ser trocada (a coordenadora do Orca não tem `worker_done`)';
  const t = ctx.tokens; const det = `${papel} ${mil(t)} mil`;

  if (papel === 'orquestradora') return orquestradora(e, sid, transcript, t, det);
  // Nível já cobrado nesta sessão; o contexto abaixo dele (limpeza, compactação) rearma.
  const chave = `${sid}:contexto`;
  const nivelDosTokens = t >= TETO ? 3 : t >= ALTO ? 2 : t >= ESPERA ? 1 : 0;
  let cobrado = Number(lerEstadoDe(ESTADO)[chave]?.nivel) || 0;
  if (cobrado && nivelDosTokens < cobrado) { gravarEstadoDe(ESTADO, (s) => { delete s[chave]; }); cobrado = 0; }
  const marcar = (nivel) => gravarEstadoDe(ESTADO, (s) => { s[chave] = { nivel, em: Date.now() }; });
  // O que cobraria, nesta ordem de gravidade. `sigoVale`: a linha de escape não vale no teto.
  let cobranca = null;
  if (t >= TETO) {
    cobranca = { nivel: 3, desfecho: 'cobrou-300', sigoVale: false, reason: `Contexto em ${mil(t)} mil. Não pegue trabalho novo. Escreva o estado (o próximo passo exato) e ${limpar}.` };
  } else if (t >= ALTO) {
    cobranca = { nivel: 2, desfecho: 'cobrou-200', sigoVale: true, reason: `Contexto em ${mil(t)} mil, acima de ${mil(ALTO)} mil. Se a unidade de trabalho acabou, escreva o estado e ${limpar}; se não acabou, diga numa linha \`Contexto: sigo — <o que falta na unidade>\`.` };
  } else if (t >= ESPERA) {
    cobranca = { nivel: 1, desfecho: 'cobrou-150-espera', sigoVale: true, esperando: true, reason: `Contexto em ${mil(t)} mil e o turno termina esperando resposta: ${host === 'claude-desktop' ? 'limpe antes' : `troque de sessão antes (${limpar})`} (retomar custa ~105 mil, reler ${mil(t)} mil a cada turno custa mais).` };
  }
  if (!cobranca) return;
  if (papel === 'orquestradora-ausente') cobranca.reason += ` Vale porque o modo ausente está ligado${desdeDoModo()}; se o operador está aqui, quem desliga é ele (\`/ausente off\` ou o botão do painel), e aí a limpeza volta a ser dele.`;

  const inicio = inicioDoTurno(transcript) ?? 0;
  const { limpou, texto } = doTurno(transcript, inicio, e.last_assistant_message, host);
  if (cobranca.esperando && !terminaEsperando(texto)) return; // não termina esperando o operador
  if (limpou) { registrar(sid, HOOK, 'limpou', det); return; }
  if (cobranca.nivel <= cobrado) { registrar(sid, HOOK, 'ja-avisado', `${cobranca.desfecho} ${det}`); return; }
  if (cobranca.sigoVale && /^\s*Contexto:\s*sigo\s*—\s*\S.{8,}/m.test(texto)) { marcar(cobranca.nivel); registrar(sid, HOOK, 'satisfeito-sigo', det); return; }
  if (ativo) { registrar(sid, HOOK, 'deixou-passar', `${cobranca.desfecho} ${det}`); return; }
  marcar(cobranca.nivel);
  registrar(sid, HOOK, cobranca.desfecho, det);
  process.stdout.write(JSON.stringify({ decision: 'block', reason: cobranca.reason }));
}

// Só roda como hook (script principal); importado pelo painel para ler as réguas, não lê o stdin.
const principal = (() => { try { return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href; } catch { return false; } })();
if (principal) {
  try { main(); } catch (err) {
    try { registrar('?', HOOK, 'erro', String(err?.stack || err)); } catch { /* sem log */ }
  }
  process.exitCode = 0;
}
