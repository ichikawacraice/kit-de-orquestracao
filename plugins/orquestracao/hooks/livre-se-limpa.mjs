#!/usr/bin/env node
// Stop hook: membro do pool que se declara livre no turno se limpa no mesmo turno (operador, 24/10:
// "quando ela se declara livre, ou vai procurar algo na fila, antes disso ela se limpa").
// "Declarar livre" = set_session_title "self" com título terminando em "· livre", ou painel.mjs
// gravando em `sessoes` com "livre" no comando. Satisfaz: clear_session com session_id "self" no turno
// (a limpeza roda quando o turno acaba). Cobra uma vez por turno (stop_hook_active solta).
// Segunda regra (operador, 24/10: "executoras rodando trabalho com o nome de livre"): membro cujo título
// ainda termina em "· livre" e que TRABALHOU no turno (Edit/Write, commit, push, PR, gate) sem chamar
// set_session_title "self" é cobrado a pôr o título do item.
// F30: quem está no `fez` de um item vivo (espera a validação ou o conserto) e fora de todo `com` fica livre SEM se limpar
// (o contexto serve ao conserto). Quem se declara livre e ainda está no `com` de um item é cobrado a sair (`painel com del`).
// Quem saiu do item no turno (`painel com del`) e ficou com o título dele é cobrado a pôr o título livre.
// Fonte da regra: ~/.claude/orquestracao/pool/protocolo.md, "Ao terminar um item" e "Pegar".
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registrar, INICIO_DE_COMANDO, INVOCACAO_DO_PAINEL } from './hooks-crewai-comum.mjs';
import { registroDaSessao, membroDoPool, inicioDoTurno, itensDaSessao, itensDonosDaSessao, declarouLivre, tituloLivre, semHeredoc, separadoresDeAspasNeutros } from './pool-comum.mjs';

const HOOK = 'livre-se-limpa';
const ehSelf = (id) => id === undefined || id === null || id === 'self';
const trabalhoBash = (c) => /\bgit\s+(commit|push)\b|\bgh\s+pr\s+(create|ready)\b|\b(pnpm|npm|yarn|bun)(\s+run)?\s+(test|typecheck|check|lint)\b|\bnpx\s+(vitest|jest|tsc)\b|(^|[\s;&|(])(pytest|go\s+test|cargo\s+test|make\s+(test|check))\b/.test(c);
// A detecção de "declarar livre" (`declarouLivre`) mora em pool-comum.mjs, junto com a normalização do comando.
const COM_DEL = new RegExp(INICIO_DE_COMANDO + INVOCACAO_DO_PAINEL + String.raw`\s+com\s+del\b`);
const COM_DEL_DE = new RegExp(INICIO_DE_COMANDO + INVOCACAO_DO_PAINEL + String.raw`\s+com\s+del\s+\S+\s+["']?(local_[\w-]+)`);
// O `local_` que o `com del` tira, ou null: sair do item é tirar a PRÓPRIA sessão; tirar a de outra (o dono tirando uma V) não cobra título.
export const comDelDe = (c) => separadoresDeAspasNeutros(semHeredoc(c)).match(COM_DEL_DE)?.[1] ?? null;
export const painelComDel = (c) => COM_DEL.test(separadoresDeAspasNeutros(semHeredoc(c)));
// F32: o hook escreve pelo `painel.mjs` do próprio plugin (um caminho só para soltar), com prazo e SIGKILL. A pasta do painel segue
// PAINEL_DIR; sem ela, a pasta pai de FILA_DIR (teste), senão o padrão do script.
const PAINEL_MJS = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'orquestradora', 'scripts', 'painel.mjs');
function painelEnv() {
  const env = { ...process.env };
  if (!env.PAINEL_DIR && env.FILA_DIR) env.PAINEL_DIR = dirname(env.FILA_DIR);
  return env;
}
function painel(args) {
  execFileSync('node', [PAINEL_MJS, ...args], { encoding: 'utf8', timeout: 15000, killSignal: 'SIGKILL', env: painelEnv(), stdio: ['ignore', 'pipe', 'pipe'] });
}
const msgDe = (e) => String(e?.stderr || e?.message || e).trim().split('\n')[0];
// Tira a sessão de cada `com` (com `--fez` só para o papel E: quem sai sem entregar não ganha `fez`), solta os itens de que ela é dona
// e põe a linha dela em `sessoes` como livre (só se a linha já existe). → { falhou: [F…], erros: [texto] }.
function soltarDoItem(sessionId, reg, itens) {
  const falhou = []; const erros = [];
  const papel = membroDoPool(reg?.titulo)?.papel;
  const local = reg?.localId;
  for (const F of itens.com) {
    try { painel(['com', 'del', F, local, ...(papel === 'E' ? ['--fez'] : [])]); registrar(sessionId, HOOK, 'soltou-com', F); }
    catch (e) { falhou.push(F); erros.push(`com del ${F}: ${msgDe(e)}`); }
  }
  for (const F of itensDonosDaSessao(local)) {
    try { painel(['soltar', F, 'a dona se declarou livre sem soltar']); registrar(sessionId, HOOK, 'soltou-dono', F); }
    catch (e) { falhou.push(F); erros.push(`soltar ${F}: ${msgDe(e)}`); }
  }
  if (!falhou.length) {
    for (const id of new Set([local, sessionId].filter(Boolean))) {
      const f = join(painelEnv().PAINEL_DIR || join(process.env.HOME || '', '.claude', 'orquestracao', 'painel'), 'sessoes', `${id}.json`);
      if (!existsSync(f)) continue;
      try { painel(['update', 'sessoes', id, JSON.stringify({ estado: 'parada', etapa: 'livre' })]); }
      catch (e) { erros.push(`sessoes ${id}: ${msgDe(e)}`); registrar(sessionId, HOOK, 'erro-ao-soltar', `sessoes ${id}: ${msgDe(e)}`); }
    }
  }
  return { falhou, erros };
}

function main() {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const { session_id, transcript_path, stop_hook_active } = input;
  if (!session_id || !transcript_path) return;

  const inicio = inicioDoTurno(transcript_path);
  if (inicio === null) return;

  let limpou = false; const tirados = []; let trocouTitulo = false; let trabalhou = null;
  for (const l of readFileSync(transcript_path, 'utf8').split('\n')) {
    if (!l) continue;
    let e; try { e = JSON.parse(l); } catch { continue; }
    if (e.type !== 'assistant' || Date.parse(e.timestamp) < inicio) continue;
    const c = e.message?.content;
    if (!Array.isArray(c)) continue;
    for (const b of c) {
      if (b?.type !== 'tool_use') continue;
      const n = String(b.name || ''); const i = b.input || {};
      if (n.endsWith('set_session_title') && ehSelf(i.session_id)) trocouTitulo = true;
      if (/^(Edit|Write|MultiEdit|NotebookEdit)$/.test(n)) trabalhou ||= n;
      else if (n === 'Bash' && trabalhoBash(String(i.command || ''))) trabalhou ||= 'git/gate';
      if (n.endsWith('clear_session') && ehSelf(i.session_id)) limpou = true;
      if (n === 'Bash') { const t = comDelDe(String(i.command || '')); if (t) tirados.push(t); }
    }
  }
  const decl = declarouLivre(transcript_path, inicio);
  const declarou = decl?.como ?? null; const tituloNovo = decl?.tituloNovo ?? null;
  if (!declarou && trabalhou && !trocouTitulo) {
    const reg = registroDaSessao(session_id, { fresco: true });
    const m = membroDoPool(reg?.titulo);
    if (!m || !tituloLivre(reg.titulo)) return;
    if (stop_hook_active) { registrar(session_id, HOOK, 'deixou-passar-titulo', trabalhou); return; }
    registrar(session_id, HOOK, 'cobrou-titulo', `${m.id} ${trabalhou}`);
    process.stdout.write(JSON.stringify({
      decision: 'block',
      reason:
        `Seu título ainda diz "livre" e você trabalhou neste turno (${trabalhou}). Quem olha a lista acha que você está parado ` +
        `e pode te mandar outro item. Chame set_session_title com session_id "self" e o título \`${m.id} · <o item, em poucas palavras>\` ` +
        '(com o número do PR, se houver), e termine o turno.',
    }));
    return;
  }
  // F30, regra 4: saiu do item neste turno e o título ainda é o dele.
  if (tirados.length && !tituloLivre(tituloNovo)) {
    const reg = registroDaSessao(session_id, { fresco: true });
    const m = membroDoPool(reg?.titulo);
    if (m && tirados.includes(reg.localId) && !tituloLivre(reg.titulo) && itensDaSessao(reg.localId).com.length === 0) {
      if (stop_hook_active) { registrar(session_id, HOOK, 'deixou-passar-titulo-velho', m.id); return; }
      registrar(session_id, HOOK, 'cobrou-titulo-velho', m.id);
      process.stdout.write(JSON.stringify({
        decision: 'block',
        reason: `Você saiu do item e o título ainda é o dele: chame set_session_title com session_id "self" e o título \`${m.id} · livre\`, e termine o turno.`,
      }));
      return;
    }
  }
  if (!declarou) return;

  // Só membro do pool: pelo título que ele acabou de pôr ou pelo registro do app.
  const regDecl = registroDaSessao(session_id);
  if (!membroDoPool(tituloNovo) && !membroDoPool(regDecl?.titulo)) return;
  const itens = itensDaSessao(regDecl?.localId);

  // F32: declarou-se livre e ainda consta como trabalhando num item, ou como dona de item vivo: o hook solta em vez de cobrar.
  // Se a escrita falhar, volta a bloquear com a mensagem de antes (nunca passa calado).
  const solto = soltarDoItem(session_id, regDecl, itens);
  if (solto.falhou.length) {
    const lista = solto.falhou.join(', ');
    registrar(session_id, HOOK, 'erro-ao-soltar', solto.erros.join(' | '));
    if (stop_hook_active) { registrar(session_id, HOOK, 'deixou-passar-com', lista); return; }
    registrar(session_id, HOOK, 'cobrou-com', lista);
    process.stdout.write(JSON.stringify({
      decision: 'block',
      reason: `Você se declarou livre e ainda consta como trabalhando em ${lista}: \`painel com del <F> ${regDecl.localId} --fez\` (ou sem --fez, se não entregou) para cada um, e termine o turno.`,
    }));
    return;
  }
  const itensDepois = itensDaSessao(regDecl?.localId);
  if (limpou) return;
  // F30, regra 1 com exceção: no `fez` de item vivo e fora de todo `com`, o contexto serve ao conserto.
  if (itensDepois.fez.length) { registrar(session_id, HOOK, 'livre-com-contexto', itensDepois.fez.join(',')); return; }

  if (stop_hook_active) { registrar(session_id, HOOK, 'deixou-passar', declarou); return; }
  registrar(session_id, HOOK, 'cobrou', declarou);
  process.stdout.write(JSON.stringify({
    decision: 'block',
    reason:
      `Você se declarou livre neste turno (${declarou}) e não se limpou. Todo item começa com a conversa vazia: ` +
      'chame clear_session com session_id "self" agora (a limpeza roda quando o turno acaba) e termine o turno. ' +
      'Não pegue item da fila antes disso; a orquestradora despacha o próximo depois da limpeza.',
  }));
}

try { main(); } catch (err) {
  try { registrar('?', HOOK, 'erro', String(err?.stack || err)); } catch { /* sem log */ }
}
process.exitCode = 0;
