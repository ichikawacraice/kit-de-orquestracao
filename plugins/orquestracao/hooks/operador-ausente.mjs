#!/usr/bin/env node
// UserPromptSubmit: liga e desliga o MODO AUSENTE. Só os comandos `/ausente on` e `/ausente off` mexem na bandeira
// (operador, 24/10: "só assim entrar e sair do modo ausente, mesmo que eu escreva não sair do modo, pq posso vir,
// dar um comando e sair novamente"). Frase solta ("vou dormir") e prompt comum NÃO mexem; não há prazo de validade.
// `/ausente` sem argumento só mostra o estado (a skill responde). Mensagem de outra sessão não liga nem desliga.
// O botão do painel é a segunda via humana: liga gravando `por:"painel"` e desliga gravando `{ligado:false}` (o pane não apaga arquivo).
// Bandeira: <BASE>/operador-ausente.json = { desde, frase, sessionId, por }. Quem lê: `modoAusente()` (T3a, T7, contexto-do-papel).
import { existsSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { BASE, registrar, lerEntrada } from './hooks-crewai-comum.mjs';

const HOOK = 'operador-ausente';
const NAO_HUMANO = /^\s*(<(cross-session-message|side-sessions-event|task-notification|ci-monitor-event)\b|This session is being continued from a previous conversation|Background \(from the session that started this one\))/;
const LEMBRETES = /^\s*<system-reminder>[\s\S]*?<\/system-reminder>/;
// "/ausente on" cru, ou o comando expandido (<command-name>/ausente</command-name> … <command-args>on</command-args>).
const CRU = /^\s*\/ausente[ \t]+(on|off)\b/i;
const EXPANDIDO = /<command-name>\/?ausente<\/command-name>[\s\S]*?<command-args>\s*(on|off)\b/i;
const PRESENTE = new Set(['human', 'plugin']);

export function comandoDoModo(prompt) {
  const m = CRU.exec(prompt) || EXPANDIDO.exec(prompt);
  return m ? m[1].toLowerCase() : null;
}

function main() {
  const e = lerEntrada();
  const bruto = typeof e.prompt === 'string' ? e.prompt : '';
  const sid = e.session_id || '-';
  let prompt = bruto;
  while (LEMBRETES.test(prompt)) prompt = prompt.replace(LEMBRETES, '');
  const origem = e.turnOrigin ?? e.origin?.kind ?? (typeof e.origin === 'string' ? e.origin : null);
  const humano = origem ? PRESENTE.has(String(origem)) : (prompt.trim() !== '' && !NAO_HUMANO.test(prompt));
  if (!humano) return;
  const cmd = comandoDoModo(prompt);
  if (!cmd) return;
  const arq = join(BASE, 'operador-ausente.json');
  if (cmd === 'on') {
    mkdirSync(BASE, { recursive: true });
    writeFileSync(arq, `${JSON.stringify({ desde: new Date().toISOString(), frase: '/ausente on', sessionId: e.session_id || null, por: 'comando' })}\n`);
    registrar(sid, HOOK, 'ausente-on');
  } else {
    rmSync(arq, { force: true });
    registrar(sid, HOOK, 'ausente-off');
  }
}

try {
  main();
} catch (err) {
  registrar('-', HOOK, 'erro', err?.stack || err);
}
process.exitCode = 0;
