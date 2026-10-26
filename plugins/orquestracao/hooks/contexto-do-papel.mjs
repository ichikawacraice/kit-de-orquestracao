#!/usr/bin/env node
// Stop hook (F35): cobra a regra de contexto por papel da skill `papeis-e-modelos` ("Contexto"), que só valia se a sessão
// lembrasse de chamar `get_usage`. Lê o `usage` do transcript (último não-sidechain) e não grava estado nenhum.
//   orquestradora (F48): com o modo ausente ligado segue a régua da planejadora abaixo; com o operador presente ela não limpa
//     sozinha: ≥ 250 mil cobra PEDIR (pergunta `limpar · orquestradora` aberta, ou respondida há ≤ 2 h; ou limpou), abaixo disso nada.
//   planejadora / design: ≥ 300 mil cobra limpar (só `clear_session` "self" satisfaz); ≥ 200 mil cobra limpar OU
//     a linha `Contexto: sigo — <o que falta na unidade>`; ≥ 150 mil com o turno terminando esperando o operador (`?` ou `Q<n>` no
//     último parágrafo) cobra limpar antes.
//   executora (F49): ≥ 150 mil cobra limpar (só `clear_session` "self" satisfaz; a linha `Parei em:` sozinha não).
//   validadora: nunca cobra (não limpa no meio); só registra `validadora-<mil>` a partir de 200 mil.
// Uma cobrança por turno (`stop_hook_active` deixa passar). Erro nunca prende o turno. Limites: constantes abaixo, com override
// `CONTEXTO_LIMITE_<NOME>` só para teste. Fonte da regra: skills/papeis-e-modelos/SKILL.md, seção "Contexto".
import { readFileSync } from 'node:fs';
import { registrar, textoDe, modoAusente } from './hooks-crewai-comum.mjs';
import { registroDaSessao, membroDoPool, ehOrquestradora, ehExecutora, inicioDoTurno, contextoDoTranscript, perguntasDeLimpeza } from './pool-comum.mjs';

const HOOK = 'contexto-do-papel';
const limite = (nome, padrao) => { const v = Number(process.env[`CONTEXTO_LIMITE_${nome}`]); return Number.isFinite(v) && v > 0 ? v : padrao; };
const ESPERA = limite('ESPERA', 150_000); const ALTO = limite('ALTO', 200_000); const TETO = limite('TETO', 300_000); const EXEC = limite('EXEC', 150_000);
const PEDIR = limite('PEDIR', 250_000); const SEGURA_MS = 2 * 3600_000;
const mil = (t) => Math.round(t / 1000);

// Papel pela ordem: orquestradora, executora, membro do pool (P e D = planejadora, V = validadora, E = executora). Sem papel → null.
function papelDe(e, transcript, reg) {
  if (ehOrquestradora(e.session_id, reg?.titulo)) return modoAusente() ? 'planejadora' : 'orquestradora';
  if (ehExecutora(e, transcript)) return 'executora';
  const m = membroDoPool(reg?.titulo);
  if (!m) return null;
  return m.papel === 'V' ? 'validadora' : m.papel === 'E' ? 'executora' : 'planejadora';
}

// O que o turno que começou em `inicio` (ms) fez e disse: chamou `clear_session` "self"? e o último texto (a última entrada com texto).
function doTurno(transcript, inicio, ultimaMensagem) {
  let limpou = false; let texto = '';
  for (const l of readFileSync(transcript, 'utf8').split('\n')) {
    if (!l) continue;
    let x; try { x = JSON.parse(l); } catch { continue; }
    if (x.type !== 'assistant' || x.isSidechain === true || Date.parse(x.timestamp) < inicio) continue;
    const t = textoDe(x.message).trim(); if (t) texto = t;
    const c = x.message?.content;
    if (!Array.isArray(c)) continue;
    for (const b of c) {
      if (b?.type === 'tool_use' && String(b.name || '').endsWith('clear_session') && [undefined, null, 'self'].includes(b.input?.session_id)) limpou = true;
    }
  }
  if (typeof ultimaMensagem === 'string' && ultimaMensagem.trim()) texto = ultimaMensagem.trim();
  return { limpou, texto };
}

// Orquestradora com o operador presente (F48): a limpeza inteira é dele; ela PEDE a partir de 250 mil.
function orquestradora(e, sid, transcript, ativo, t, det, reg) {
  if (t < PEDIR) return;
  const { limpou } = doTurno(transcript, inicioDoTurno(transcript) ?? 0, e.last_assistant_message);
  if (limpou) { registrar(sid, HOOK, 'limpou', det); return; }
  // A trégua conta da hora do clique (`respondidaEm`, senão `atualizadoEm`); data no futuro (> agora + 1 min) não vale.
  const dentro = (iso) => { const d = Date.now() - Date.parse(iso); return d >= -60_000 && d <= SEGURA_MS; };
  const pediu = perguntasDeLimpeza(reg?.localId).some((d) => d.estado === 'aberta' || dentro(Number.isNaN(Date.parse(d.respondidaEm)) ? d.atualizadoEm : d.respondidaEm));
  if (pediu) { registrar(sid, HOOK, 'satisfeito-pediu', det); return; }
  if (ativo) { registrar(sid, HOOK, 'deixou-passar', `cobrou-pedir ${det}`); return; }
  registrar(sid, HOOK, 'cobrou-pedir', det);
  process.stdout.write(JSON.stringify({ decision: 'block', reason: `Contexto em ${mil(t)} mil. Não limpe sozinha (o operador pode estar lendo): escreva o estado, abra a pergunta \`limpar · orquestradora\` no painel (Q-ID de proxima-pergunta, sessaoId, recomendação: limpar) e siga; limpe só com o sim dele. Com o modo ausente ligado, pode limpar sozinha.` }));
}

function main() {
  const e = JSON.parse(readFileSync(0, 'utf8'));
  const { session_id: sid, transcript_path: transcript, stop_hook_active: ativo } = e;
  if (!sid || !transcript) return;

  const ctx = contextoDoTranscript(transcript);
  if (!ctx) { registrar(sid, HOOK, 'sem-usage'); return; }
  const reg = registroDaSessao(sid);
  const papel = papelDe(e, transcript, reg);
  if (!papel) return;
  const t = ctx.tokens; const det = `${papel} ${mil(t)} mil`;

  if (papel === 'validadora') { if (t >= ALTO) registrar(sid, HOOK, `validadora-${mil(t)}`, det); return; }
  if (papel === 'orquestradora') return orquestradora(e, sid, transcript, ativo, t, det, reg);
  // O que cobraria, nesta ordem de gravidade. `sigoVale`: a linha de escape não vale no teto.
  let cobranca = null;
  if (papel === 'executora') {
    if (t >= EXEC) cobranca = { desfecho: 'cobrou-exec-150', sigoVale: false, reason:
      `Contexto em ${mil(t)} mil, acima de 150 mil: a próxima etapa começa com a conversa vazia. Não compacte. Antes de limpar, conforme o caso: ` +
      'acabou de receber item (novo ou conserto) → grave no item `{"agora":"recebido; limpo antes de começar"}` e mande a quem despachou "limpa a ' + mil(t) + ' mil; reenvie o briefing"; ' +
      'no meio do item → commite o que está pronto e mande a quem despachou o relatório com `Parei em: <passo exato>`; ' +
      'entregou à validação → grave no handoff do item o que o conserto vai precisar e ponha o título `<ID> · livre`. ' +
      'Depois chame clear_session com session_id "self" e termine o turno.' };
  } else if (t >= TETO) {
    cobranca = { desfecho: 'cobrou-300', sigoVale: false, reason: `Contexto em ${mil(t)} mil. Não pegue trabalho novo. Escreva o estado (o próximo passo exato) e chame clear_session "self".` };
  } else if (t >= ALTO) {
    cobranca = { desfecho: 'cobrou-200', sigoVale: true, reason: `Contexto em ${mil(t)} mil, acima de 200 mil. Se a unidade de trabalho acabou, escreva o estado e chame clear_session "self"; se não acabou, diga numa linha \`Contexto: sigo — <o que falta na unidade>\`.` };
  } else if (t >= ESPERA) {
    cobranca = { desfecho: 'cobrou-150-espera', sigoVale: true, esperando: true, reason: `Contexto em ${mil(t)} mil e o turno termina esperando resposta: limpe antes (retomar custa ~90 mil, reler ${mil(t)} mil a cada turno custa mais).` };
  }
  if (!cobranca) return;

  const inicio = inicioDoTurno(transcript) ?? 0;
  const { limpou, texto } = doTurno(transcript, inicio, e.last_assistant_message);
  // O `?` de uma URL com query (`…/a?b=1`) não é pergunta (O3 do F35); o `?` solto, mesmo colado numa URL, continua valendo.
  const ultimoParagrafo = (texto.split(/\n\s*\n/).pop() || '').replace(/https?:\/\/\S*\?\S+/g, '');
  if (cobranca.esperando && !/\?|\bQ\d+\b/.test(ultimoParagrafo)) return; // não termina esperando o operador
  if (limpou) { registrar(sid, HOOK, 'limpou', det); return; }
  if (cobranca.sigoVale && /^\s*Contexto:\s*sigo\s*—\s*\S.{8,}/m.test(texto)) { registrar(sid, HOOK, 'satisfeito-sigo', det); return; }
  if (ativo) { registrar(sid, HOOK, 'deixou-passar', `${cobranca.desfecho} ${det}`); return; }
  registrar(sid, HOOK, cobranca.desfecho, det);
  process.stdout.write(JSON.stringify({ decision: 'block', reason: cobranca.reason }));
}

try { main(); } catch (err) {
  try { registrar('?', HOOK, 'erro', String(err?.stack || err)); } catch { /* sem log */ }
}
process.exitCode = 0;
