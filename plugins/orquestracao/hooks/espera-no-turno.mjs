#!/usr/bin/env node
// Stop hook (F373): a dona de item vivo que termina o turno com teste ou subagente ainda rodando em segundo plano acorda a
// orquestradora à toa: o app avisa a sessão que a abriu a cada fim de turno, e o aviso "testes rodando, aguardo" era 34% dos
// avisos medidos de 02 a 04/11. O hook segura esse fim de turno UMA vez e diz como esperar dentro do turno: `esperar-fundo`
// (volta quando os subagentes da sessão terminam) e o teste em primeiro plano. Lê `background_tasks` da entrada do Stop (doc dos
// hooks); sem o campo, passa. A segunda tentativa (`stop_hook_active`) passa: a dona que precisa mesmo parar, para.
// Não segura: sessão que não é dona de item vivo; só monitor, cron ou tarefa terminada; turno que termina perguntando ao
// operador (`?` ou `Q<n>` no último parágrafo). Erro nunca prende o turno.
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { registrar, lerEntrada } from './hooks-crewai-comum.mjs';
import { registroDaSessao, itensDonosDaSessao } from './pool-comum.mjs';

const HOOK = 'espera-no-turno';
const TIPOS = new Set(['shell', 'subagent', 'local_bash', 'local_agent']);
const TERMINADA = /^(?:completed|complete|done|failed|killed|stopped|cancell?ed|error)$/i;

export function emVoo(tarefas) {
  if (!Array.isArray(tarefas)) return [];
  return tarefas.filter((t) => t && TIPOS.has(String(t.type)) && !TERMINADA.test(String(t.status ?? '')));
}

function terminaPerguntando(texto) {
  const ultimo = (String(texto ?? '').trim().split(/\n\s*\n/).pop() || '').replace(/https?:\/\/\S*\?\S+/g, '');
  return /\?|\bQ\d+\b/.test(ultimo);
}

const nome = (t) => String(t.description || t.command || t.agent_type || t.id).slice(0, 80);

function main() {
  const e = lerEntrada();
  const sid = e.session_id;
  const voo = emVoo(e.background_tasks);
  if (!voo.length) return;
  const reg = registroDaSessao(sid);
  const itens = itensDonosDaSessao(reg?.localId);
  if (!itens.length) return;
  const det = `${itens.join(',')}: ${voo.map(nome).join('; ')}`;
  if (terminaPerguntando(e.last_assistant_message)) { registrar(sid, HOOK, 'pergunta', det); return; }
  if (e.stop_hook_active) { registrar(sid, HOOK, 'deixou-passar', det); return; }
  registrar(sid, HOOK, 'segurou', det);
  const subagentes = voo.some((t) => t.type === 'subagent' || t.type === 'local_agent');
  const shell = voo.filter((t) => t.type === 'shell' || t.type === 'local_bash');
  const reason = [
    `Ainda roda em segundo plano: ${voo.map(nome).join('; ')}. Terminar o turno agora manda à orquestradora um aviso só de espera, e ela relê o contexto inteiro para lê-lo.`,
    subagentes ? 'Espere o subagente dentro do turno: rode `esperar-fundo` (Bash, timeout 600000) — volta quando os subagentes desta sessão terminam, ou em 9 min; repita se precisar.' : '',
    shell.length ? 'Teste: rode-o de novo em primeiro plano (Bash com timeout até 600000), ou, se precisa seguir em segundo plano, faça o comando gravar um marcador ao acabar (`… ; echo $? > <arquivo>`) e espere com `esperar-fundo --arquivo <arquivo>`.' : '',
    'Se o turno precisa mesmo terminar agora (pergunta ao operador, espera de horas), termine de novo: a segunda vez passa.',
  ].filter(Boolean).join(' ');
  process.stdout.write(JSON.stringify({ decision: 'block', reason }));
}

const principal = (() => { try { return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href; } catch { return false; } })();
if (principal) {
  try { main(); } catch (err) {
    try { registrar('?', HOOK, 'erro', String(err?.stack || err)); } catch { /* sem log */ }
  }
  process.exitCode = 0;
}
