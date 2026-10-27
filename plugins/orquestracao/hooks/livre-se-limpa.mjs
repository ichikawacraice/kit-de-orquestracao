#!/usr/bin/env node
// Stop hook: membro do pool que se declara livre no turno se limpa no mesmo turno (operador, 24/10:
// "quando ela se declara livre, ou vai procurar algo na fila, antes disso ela se limpa").
// "Declarar livre" = set_session_title "self" com título terminando em "· livre", ou painel.mjs
// gravando em `sessoes` com "livre" no comando. Satisfaz: clear_session com session_id "self" no turno
// (a limpeza roda quando o turno acaba). Cobra uma vez por turno (stop_hook_active solta).
// Segunda regra (operador, 24/10: "executoras rodando trabalho com o nome de livre"): membro cujo título
// ainda termina em "· livre" e que TRABALHOU no turno (Edit/Write, commit, push, PR, gate) sem chamar
// set_session_title "self" é cobrado a pôr o título do item.
// F49: "livre" é só conversa vazia: quem se declara livre se limpa SEMPRE, também no `fez` de item vivo. Quem entregou e quer guardar a
// conversa para o conserto põe `<ID> · aguardando validação` (vale só no `fez` de item vivo; fora dele é cobrado a pôr livre e se limpar).
// Quem se declara livre ou aguardando e ainda está no `com` de um item é solto dele (`painel com del`).
// Quem saiu do item no turno (`painel com del`) e ficou com o título dele é cobrado a pôr o título livre ou aguardando.
// Fonte da regra: ~/.claude/orquestracao/pool/protocolo.md, "Ao terminar um item" e "Pegar".
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registrar, INICIO_DE_COMANDO, INVOCACAO_DO_PAINEL } from './hooks-crewai-comum.mjs';
import { filaDir, registroDaSessao, membroDoPool, inicioDoTurno, itensDaSessao, itensDonosDaSessao, declarouLivre, vaiSoltar, tituloLivre, tituloAguardando, semHeredoc, separadoresDeAspasNeutros } from './pool-comum.mjs';

const HOOK = 'livre-se-limpa';
const ehSelf = (id) => id === undefined || id === null || id === 'self';
const trabalhoBash = (c) => /\bgit\s+(commit|push)\b|\bgh\s+pr\s+(create|ready)\b|\b(pnpm|npm|yarn|bun)(\s+run)?\s+(test|typecheck|check|lint)\b|\bnpx\s+(vitest|jest|tsc)\b|(^|[\s;&|(])(pytest|go\s+test|cargo\s+test|make\s+(test|check))\b/.test(c);
// A detecção de "declarar livre" (`declarouLivre`) mora em pool-comum.mjs, junto com a normalização do comando.
const COM_DEL = new RegExp(INICIO_DE_COMANDO + INVOCACAO_DO_PAINEL + String.raw`\s+com\s+del\b`);
const COM_DEL_DE = new RegExp(INICIO_DE_COMANDO + INVOCACAO_DO_PAINEL + String.raw`\s+com\s+del\s+\S+\s+["']?(local_[\w-]+)`);
// O `local_` que o `com del` tira, ou null: sair do item é tirar a PRÓPRIA sessão; tirar a de outra (o dono tirando uma V) não cobra título.
export const comDelDe = (c) => separadoresDeAspasNeutros(semHeredoc(c)).match(COM_DEL_DE)?.[1] ?? null;
export const painelComDel = (c) => COM_DEL.test(separadoresDeAspasNeutros(semHeredoc(c)));
// F32: o hook escreve pelo `painel.mjs` do próprio plugin (um caminho só para soltar). O `hooks.json` dá 10 s ao hook: o orçamento
// TOTAL é de 8 s e cada chamada tem no máximo 2,5 s (a trava do painel presa leva ~5 s para desistir). Estourado o orçamento, o que
// falta não é escrito e entra em `falhou`: o hook bloqueia dizendo o que faltou, nunca morre calado pelo prazo.
// A pasta do painel segue PAINEL_DIR/IZANAGI_PAINEL_DIR; sem elas, a pasta pai de FILA_DIR (teste), senão o padrão do script.
const PAINEL_MJS = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'orquestradora', 'scripts', 'painel.mjs');
const ORCAMENTO_MS = 8000; const POR_CHAMADA_MS = 2500;
let prazoFinal = 0;
function painelEnv() {
  const env = { ...process.env };
  delete env.CLAUDE_CODE_SESSION_ID; // sem ela o painel.mjs não varre o registro do app (tempo) nem aplica a trava de linha alheia
  if (!env.PAINEL_DIR && !env.IZANAGI_PAINEL_DIR && env.FILA_DIR) env.PAINEL_DIR = dirname(env.FILA_DIR);
  return env;
}
function painel(args) {
  const resta = prazoFinal - Date.now();
  if (resta <= 0) throw new Error(`orçamento de ${ORCAMENTO_MS / 1000} s esgotado`);
  execFileSync('node', [PAINEL_MJS, ...args], { encoding: 'utf8', timeout: Math.min(POR_CHAMADA_MS, resta), killSignal: 'SIGKILL', env: painelEnv(), stdio: ['ignore', 'pipe', 'pipe'] });
}
const msgDe = (e) => String(e?.stderr || e?.message || e).trim().split('\n')[0] || (e?.signal ? `morto por ${e.signal}` : 'sem mensagem');
const baseDoPainel = () => { const e = painelEnv(); return e.PAINEL_DIR || e.IZANAGI_PAINEL_DIR || join(process.env.HOME || '', '.claude', 'orquestracao', 'painel'); };
// Tira a sessão de cada `com` (com `--fez` só para a E que MOSTRA entrega no item: PR no item e push/PR no transcript desde a entrada; F169), solta SÓ O DONO dos itens de que ela é
// dona (o `com` das outras sessões fica) e põe a linha dela em `sessoes` como livre (só se a linha já existe; falha ali só vai ao log).
// → { falhou: [{F, tipo}], erros: [texto] }.
const PUSH_OU_PR = /\bgit\s+push\b|\bgh\s+pr\s+(create|ready)\b/;
// F169: a E entregou neste item? O item tem `prs` e o transcript, desde a entrada dela (o `em` dela em `passaram`; sem entrada, o
// transcript inteiro), tem `git push` ou `gh pr create|ready` num Bash. `linhas` são as linhas do transcript (jsonl).
export function entregou(item, localId, linhas) {
  if (!Array.isArray(item?.prs) || item.prs.length === 0) return false;
  const entrada = (Array.isArray(item.passaram) ? item.passaram : []).find((p) => p?.localId === localId);
  const desde = entrada ? Date.parse(entrada.em) : -Infinity;
  for (const l of linhas) {
    if (!l) continue;
    let e; try { e = JSON.parse(l); } catch { continue; }
    if (e.type !== 'assistant' || !(Date.parse(e.timestamp) >= desde) || !Array.isArray(e.message?.content)) continue;
    for (const b of e.message.content) {
      if (b?.type === 'tool_use' && b.name === 'Bash' && PUSH_OU_PR.test(semHeredoc(String(b.input?.command || '')))) return true;
    }
  }
  return false;
}
const itemDaFila = (F) => { try { return JSON.parse(readFileSync(join(filaDir(), `${F}.json`), 'utf8'))?.data ?? null; } catch { return null; } };
function soltarDoItem(sessionId, reg, itens, aguardando = false, linhas = []) {
  const falhou = []; const erros = [];
  const papel = membroDoPool(reg?.titulo)?.papel;
  const local = reg?.localId;
  prazoFinal = Date.now() + ORCAMENTO_MS;
  for (const F of itens.com) {
    try { painel(['com', 'del', F, local, ...(papel === 'E' && entregou(itemDaFila(F), local, linhas) ? ['--fez'] : [])]); registrar(sessionId, HOOK, 'soltou-com', F); }
    catch (e) { falhou.push({ F, tipo: 'com' }); erros.push(`com del ${F}: ${msgDe(e)}`); }
  }
  for (const F of itensDonosDaSessao(local)) {
    try { painel(['soltar', F, 'a dona se declarou livre sem soltar', '--so-dono']); registrar(sessionId, HOOK, 'soltou-dono', F); }
    catch (e) { falhou.push({ F, tipo: 'dono' }); erros.push(`soltar ${F}: ${msgDe(e)}`); }
  }
  if (!falhou.length) {
    for (const id of new Set([local, sessionId].filter(Boolean))) {
      if (!existsSync(join(baseDoPainel(), 'sessoes', `${id}.json`))) continue;
      try { painel(['update', 'sessoes', id, JSON.stringify({ estado: 'parada', etapa: aguardando ? 'aguardando validação' : 'livre' })]); }
      catch (e) { registrar(sessionId, HOOK, 'erro-sessoes', `${id}: ${msgDe(e)}`); }
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
  const regAntes = registroDaSessao(session_id);
  const decl = declarouLivre(transcript_path, inicio, [regAntes?.localId, session_id]);
  const declarou = decl?.como ?? null; const tituloNovo = decl?.tituloNovo ?? null;
  if (!declarou && trabalhou && !trocouTitulo) {
    const reg = registroDaSessao(session_id, { fresco: true });
    const m = membroDoPool(reg?.titulo);
    if (!m || !(tituloLivre(reg.titulo) || tituloAguardando(reg.titulo))) return;
    const tituloAtual = tituloAguardando(reg.titulo) ? 'aguardando validação' : 'livre';
    if (stop_hook_active) { registrar(session_id, HOOK, 'deixou-passar-titulo', trabalhou); return; }
    registrar(session_id, HOOK, 'cobrou-titulo', `${m.id} ${trabalhou}`);
    process.stdout.write(JSON.stringify({
      decision: 'block',
      reason:
        `Seu título ainda diz "${tituloAtual}" e você trabalhou neste turno (${trabalhou}). Quem olha a lista acha que você está parado ` +
        `e pode te mandar outro item. Chame set_session_title com session_id "self" e o título \`${m.id} · <o item, em poucas palavras>\` ` +
        '(com o número do PR, se houver), e termine o turno.',
    }));
    return;
  }
  // F30, regra 4: saiu do item neste turno e o título ainda é o dele.
  if (tirados.length && !tituloLivre(tituloNovo) && !tituloAguardando(tituloNovo)) {
    const reg = registroDaSessao(session_id, { fresco: true });
    const m = membroDoPool(reg?.titulo);
    if (m && tirados.includes(reg.localId) && !tituloLivre(reg.titulo) && !tituloAguardando(reg.titulo) && itensDaSessao(reg.localId).com.length === 0) {
      if (stop_hook_active) { registrar(session_id, HOOK, 'deixou-passar-titulo-velho', m.id); return; }
      registrar(session_id, HOOK, 'cobrou-titulo-velho', m.id);
      process.stdout.write(JSON.stringify({
        decision: 'block',
        reason: `Você saiu do item e o título ainda é o dele: chame set_session_title com session_id "self" e o título \`${m.id} · livre\` (ou \`${m.id} · aguardando validação\`, se guarda a conversa para o conserto), e termine o turno.`,
      }));
      return;
    }
  }
  if (!declarou) return;

  // Só membro do pool: pelo título que ele acabou de pôr ou pelo registro do app.
  const regDecl = registroDaSessao(session_id);
  if (!membroDoPool(tituloNovo) && !membroDoPool(regDecl?.titulo)) return;
  const itens = itensDaSessao(regDecl?.localId);

  // F32: declarou-se livre SOBRE SI e ainda consta como trabalhando num item ou como dona de item vivo: o hook solta em vez de
  // cobrar (`vaiSoltar` é a mesma função que o `fila-do-item` usa para deixar de cobrar). Se a escrita falhar ou estourar o
  // orçamento, volta a bloquear dizendo o que faltou (nunca passa calado). Declaração sobre a linha de OUTRA sessão não solta nada.
  if (vaiSoltar(transcript_path, inicio, { sessionId: session_id, localId: regDecl?.localId, titulo: regDecl?.titulo })) {
    const solto = soltarDoItem(session_id, regDecl, itens, decl.aguardando, readFileSync(transcript_path, 'utf8').split('\n'));
    if (solto.falhou.length) {
      const lista = solto.falhou.map((f) => f.F).join(', ');
      registrar(session_id, HOOK, 'erro-ao-soltar', solto.erros.join(' | '));
      if (stop_hook_active) { registrar(session_id, HOOK, 'deixou-passar-com', lista); return; }
      registrar(session_id, HOOK, 'cobrou-com', lista);
      const doCom = solto.falhou.filter((f) => f.tipo === 'com').map((f) => f.F);
      const doDono = solto.falhou.filter((f) => f.tipo === 'dono').map((f) => f.F);
      const pedidos = [];
      if (doCom.length) pedidos.push(`ainda consta como trabalhando em ${doCom.join(', ')}: \`painel com del <F> ${regDecl.localId} --fez\` (ou sem --fez, se não entregou) para cada um`);
      if (doDono.length) pedidos.push(`ainda é dona de ${doDono.join(', ')}: \`painel soltar <F> "<motivo>"\` para cada um (ou grave a etapa seguinte com o dono em null)`);
      process.stdout.write(JSON.stringify({ decision: 'block', reason: `Você se declarou livre e ${pedidos.join('; e ')}, e termine o turno.` }));
      return;
    }
  }
  const itensDepois = itensDaSessao(regDecl?.localId);
  if (limpou) return;
  // F49: aguardando validação vale só no `fez` de item vivo (a conversa fica para o conserto); fora dele, livre e limpa.
  if (decl.aguardando) {
    if (itensDepois.fez.length) { registrar(session_id, HOOK, 'aguardando-com-contexto', itensDepois.fez.join(',')); return; }
    if (stop_hook_active) { registrar(session_id, HOOK, 'deixou-passar', declarou); return; }
    registrar(session_id, HOOK, 'cobrou-aguardando-sem-fez', declarou);
    process.stdout.write(JSON.stringify({
      decision: 'block',
      reason:
        'Aguardando validação é só para quem entregou um item que ainda espera validação ou conserto. ' +
        'Sem item esperando: título `' + (membroDoPool(tituloNovo)?.id ?? 'E<n>') + ' · livre` e clear_session com session_id "self", e termine o turno.',
    }));
    return;
  }
  if (stop_hook_active) { registrar(session_id, HOOK, 'deixou-passar', declarou); return; }
  const noFez = itensDepois.fez.length > 0;
  registrar(session_id, HOOK, noFez ? 'cobrou-livre-no-fez' : 'cobrou', noFez ? itensDepois.fez.join(',') : declarou);
  if (noFez) {
    process.stdout.write(JSON.stringify({
      decision: 'block',
      reason:
        `Você está no \`fez\` de ${itensDepois.fez.join(', ')} e não se limpou. Livre é só com a conversa vazia: se quer guardar a conversa para o conserto, ` +
        `o título é \`${membroDoPool(tituloNovo)?.id ?? membroDoPool(regDecl?.titulo)?.id ?? 'E<n>'} · aguardando validação\`; se não, chame clear_session com session_id "self" e termine o turno.`,
    }));
    return;
  }
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
