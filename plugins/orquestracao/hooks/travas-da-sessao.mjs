#!/usr/bin/env node
// PreToolUse: as regras que dependem de QUEM chama viram trava. Quem chama: orquestradora (marcador em ativas/ ou título
// `🎛 orquestradora`) ou qualquer outra sessão. Evento de subagente usa o título da sessão-mãe (mesmo `session_id`).
//   T3  start_session: com o modo ausente ligado (/ausente on), só abre sessão o turno em que o operador escreveu (inclusive a
//       mensagem que ele digitou no meio do turno, F315); o cartão
//       (initiation own_initiative) só propõe e passa.
//   T5  Edit/Write em <BASE>/painel/ (só o painel.mjs grava) e em <BASE>/limpeza/ (o ok de limpar só nasce do clique na barra).
//   T6  Bash `gh pr merge`, `painel mergear` ou `painel fila-de-merge` de quem não é a orquestradora, em repo com orquestradora ativa → ask.
//   T7  clear_session da orquestradora sobre ela mesma: só com o ok do operador (turno humano, modo ausente, o botão de limpar
//       da barra (o ok vale uma limpeza), o sim do painel ou o da janela). Ao liberar, grava a marca de volta (F219).
// Limites conhecidos: o cache do registro (pool-comum.mjs, 2 min) atrasa em até 2 min a troca de título. Orquestradora
// reconhecida só por título (sem marcador em ativas/) não ativa o T6; projeto não medido (null) pergunta; o
// painel-das-sessoes.mjs repõe o marcador no primeiro Stop dela.
// `deny` (vale em bypass) onde a decisão já foi tomada; `ask` no T6 (o operador às vezes manda mergear direto).
// Erro do hook vai para o log e a ferramenta segue.
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { registrar, lerEntrada, modoAusente, INICIO_DE_COMANDO, INVOCACAO_DO_PAINEL } from './hooks-crewai-comum.mjs';
import { BASE, registroDaSessao, ehOrquestradora, origemDoTurno, operadorNoTurno, gitCommonDir, projetoTemOrquestradora, perguntasDeLimpeza, okDoBotaoDeLimpar, gastarOkDoBotaoDeLimpar, marcarVoltaDaLimpeza, janelasDeLimpeza, SIM_DA_JANELA_MS, semHeredoc, separadoresDeAspasNeutros } from './pool-comum.mjs';

const HOOK = 'travas-da-sessao';
const H = homedir();

function caminhoDe(e) {
  const ti = e.tool_input || {};
  let p = ti.file_path || ti.notebook_path || '';
  if (!p) return '';
  if (p.startsWith('~/')) p = join(H, p.slice(2));
  return resolve(e.cwd || process.cwd(), p);
}

function decisao(tipo, motivo) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: tipo, permissionDecisionReason: motivo },
  }));
}

// O sim do painel vale 30 min a partir de `respondidaEm` (a hora do clique); `atualizadoEm` não conta (qualquer update o renova).
const OK_DO_PAINEL_MS = 30 * 60_000;
const noPrazo = (iso) => { const t = Date.parse(iso); const d = Date.now() - t; return !Number.isNaN(t) && d >= 0 && d <= OK_DO_PAINEL_MS; };

function main() {
  const e = lerEntrada();
  const sid = e.session_id || '-';
  const tool = e.tool_name || '';
  const ti = e.tool_input || {};
  const nega = (regra, quem, alvo, motivo) => {
    registrar(sid, HOOK, 'recusou', `${regra} ${quem} ${tool} ${alvo}`);
    decisao('deny', motivo);
  };
  if (tool.startsWith('mcp__ccd_')) registrar(sid, HOOK, 'viu', tool);

  // T5 primeiro: caminho decide antes de qualquer varredura do registro.
  if (/^(Edit|Write|MultiEdit|NotebookEdit)$/.test(tool)) {
    const p = caminhoDe(e);
    if (!p) return;
    if (p.startsWith(join(BASE, 'painel') + '/')) {
      return nega('T5', '-', p, 'O painel só se grava por `painel` (o comando do plugin orquestracao: ele valida e trava a escrita).');
    }
    if (p.startsWith(join(BASE, 'limpeza') + '/')) {
      return nega('T5', '-', p, 'O ok de limpar só se grava pelo botão `↺ Limpar` da barra: é o clique do operador.');
    }
    return;
  }

  if (tool === 'Bash') {
    const normal = separadoresDeAspasNeutros(semHeredoc(ti.command || ''));
    // F351: `fila-de-merge … --anotar` é a entrega da dona (só põe o PR na fila; quem roda o gate é a batida): passa. O pedaço
    // de comando é cortado nos separadores, para o `--anotar` de um não liberar o `mergear` de outro.
    const doPainel = new RegExp(INICIO_DE_COMANDO + INVOCACAO_DO_PAINEL + String.raw`\s+(?:mergear|fila-de-merge)\b`);
    // o `--anotar` vale só como palavra solta do comando: fora de aspas e antes de um comentário (o painel lê o argumento exato)
    const palavras = (pedaco) => pedaco.replace(/'[^']*'|"[^"]*"/g, ' ').replace(/(^|\s)#.*$/, '$1');
    const soAnota = (pedaco) => /\sfila-de-merge\b/.test(pedaco) && /\s--anotar(?=\s|$)/.test(palavras(pedaco));
    const mergearDoPainel = normal.split(/[;&|\n`(]+/).some((p) => doPainel.test(p) && !soAnota(p));
    if (!mergearDoPainel && !/\bgh\b[^\n|;&]*\bpr\s+merge\b/.test(ti.command || '')) return;
    const reg = registroDaSessao(e.session_id);
    if (ehOrquestradora(e.session_id, reg?.titulo)) return;
    const repo = gitCommonDir(e.cwd);
    if (!repo) return;
    const temOrq = projetoTemOrquestradora(e.session_id, repo);
    if (temOrq === false) return;
    if (temOrq === null) {
      registrar(sid, HOOK, 'perguntou', `T6 Bash ${mergearDoPainel ? 'painel mergear' : 'gh pr merge'} (projeto não conferido)`);
      return decisao('ask', 'Não consegui conferir se este projeto tem orquestradora ativa; se tiver, quem mergeia é ela. Aprove só se o operador mandou mergear daqui.');
    }
    registrar(sid, HOOK, 'perguntou', `T6 Bash ${mergearDoPainel ? 'painel mergear' : 'gh pr merge'}`);
    return decisao('ask', 'Com orquestradora ativa, quem mergeia é ela: mande `PR N pronto, HEAD <sha>`. Aprove só se o operador mandou mergear daqui.');
  }

  if (tool === 'mcp__ccd_session_mgmt__clear_session') {
    const reg = registroDaSessao(e.session_id);
    const alvo = ti.session_id;
    const ehEu = [undefined, null, 'self', e.session_id, reg?.localId].includes(alvo);
    if (!ehEu || !ehOrquestradora(e.session_id, reg?.titulo)) return;
    const alvoReal = String(alvo ?? 'self');
    // F213: o ok do botão vale uma limpeza por qualquer caminho que a libere (a limpeza direta do cache frio não abre turno, e a
    // origem lida é a do último turno, muitas vezes `human`): se sobrasse, um clear_session de turno peer passaria nos 30 min seguintes.
    // F219: e deixa a marca de volta, para o processo novo reabrir o painel e carregar a skill sem esperar o operador.
    const libera = (motivo) => { gastarOkDoBotaoDeLimpar(reg?.localId); marcarVoltaDaLimpeza(reg?.localId, motivo, e.session_id); registrar(sid, HOOK, 'liberou-limpeza', `${alvoReal} ${motivo}`); };
    if (modoAusente()) return libera('modo ausente ligado');
    let origem = null;
    try { origem = e.transcript_path ? origemDoTurno(e.transcript_path) : null; } catch { /* sem transcript */ }
    if (origem === 'human') return libera('turno do operador');
    if (okDoBotaoDeLimpar(reg?.localId)) return libera('botão da barra');
    const ok = perguntasDeLimpeza(reg?.localId).find((d) => d.estado === 'respondida' && d.respondidaPor === 'painel'
      && /^\s*sim/i.test(String(d.resposta ?? '')) && noPrazo(d.respondidaEm));
    if (ok) return libera('sim do painel');
    // O sim dado na janela (AskUserQuestion, F53): o app escreve o tool_result no transcript; vale 30 min, nunca no futuro.
    let janelas = [];
    try { janelas = e.transcript_path ? janelasDeLimpeza(e.transcript_path) : []; } catch { /* sem transcript */ }
    // Decide só a janela mais recente com desfecho (maior `respondidaEm`, a fechada sem resposta conta): um "não" depois do "sim" o cancela.
    const dif = (j) => Date.now() - j.respondidaEm;
    const ultima = janelas.filter((j) => Number.isFinite(j.respondidaEm)).sort((a, b) => b.respondidaEm - a.respondidaEm)[0];
    if (ultima && !ultima.recusada && typeof ultima.resposta === 'string' && /^\s*sim\b/i.test(ultima.resposta) && dif(ultima) >= -60_000 && dif(ultima) <= SIM_DA_JANELA_MS) return libera('sim da janela');
    return nega('T7', 'orquestradora', alvoReal, 'Limpeza inteira só com o ok do operador: ele pode estar lendo. Escreva o estado e siga; limpe quando ele mandar pelo botão `↺ Limpar` da barra (ou disser sim no chat), ou com o modo ausente ligado.');
  }

  if (tool === 'mcp__ccd_session__start_session') {
    // Modo ausente (/ausente on até /ausente off): abre sessão só o turno em que o OPERADOR escreveu — ele está ali —, na linha
    // que abriu o turno ou numa mensagem que ele digitou no meio dele (F315). Turno de notificação, de mensagem de outra sessão ou
    // de evento não abre: propõe o cartão (own_initiative), que fica pronto para a volta dele.
    const b = modoAusente();
    if (!b || ti.initiation === 'own_initiative') return;
    let operador = null;
    try { operador = e.transcript_path ? operadorNoTurno(e.transcript_path) : null; } catch { /* sem transcript */ }
    if (operador !== true) {
      return nega('T3', 'sessao', 'start_session', `Modo ausente ligado desde ${b.desde} (/ausente on). O operador não escreveu neste turno: não abra sessão; proponha o cartão (initiation own_initiative) e deixe o item na fila.`);
    }
  }
}

try {
  main();
} catch (err) {
  registrar('-', HOOK, 'erro', err?.stack || err);
}
process.exitCode = 0;
