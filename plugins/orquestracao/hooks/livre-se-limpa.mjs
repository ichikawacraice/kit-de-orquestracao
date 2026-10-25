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
import { readFileSync } from 'node:fs';
import { registrar, INICIO_DE_COMANDO, INVOCACAO_DO_PAINEL } from './hooks-crewai-comum.mjs';
import { registroDaSessao, membroDoPool, inicioDoTurno, itensDaSessao } from './pool-comum.mjs';

const HOOK = 'livre-se-limpa';
const ehSelf = (id) => id === undefined || id === null || id === 'self';
const tituloLivre = (t) => /· livre\s*$/.test(String(t || ''));
const trabalhoBash = (c) => /\bgit\s+(commit|push)\b|\bgh\s+pr\s+(create|ready)\b|\b(pnpm|npm|yarn|bun)(\s+run)?\s+(test|typecheck|check|lint)\b|\bnpx\s+(vitest|jest|tsc)\b|(^|[\s;&|(])(pytest|go\s+test|cargo\s+test|make\s+(test|check))\b/.test(c);
// Só vale a INVOCAÇÃO de `node …/painel.mjs` na mesma linha: `set|update sessoes <id> '…livre…'` ou `batch '…sessoes…livre…'`.
// Casar o comando inteiro cobrava heredoc que apenas citava essas palavras (falso positivo medido em 24/10 e de novo em 25/10),
// então o comando é normalizado antes: o corpo dos heredocs sai, e os separadores (`; & | ( `` \n`) DENTRO de aspas viram `_`
// (o tamanho não muda; `$(` e crase dentro de aspas duplas executam de verdade e ficam). A regex acha a invocação no normalizado.
// Início de comando e invocação do painel (`node …/painel.mjs` ou o `painel` do bin/ do plugin): hooks-crewai-comum.mjs.
// Limite declarado: caminho montado por variável (`node "$P" …`); JSON multilinha fora de aspas; atribuição com valor entre aspas e
// espaço (`FOO="a b" node …`); outros prefixos (`sudo`, `xargs`, `bash -c "…"`); heredoc dentro de string.
export function semHeredoc(c) {
  const linhas = String(c).split('\n'); const saida = []; const fila = []; // delimitadores pendentes, em ordem: `cat <<A; cat <<B`
  for (const l of linhas) {
    if (fila.length) { if (l.trim() === fila[0]) fila.shift(); continue; }
    saida.push(l);
    for (const m of l.matchAll(/(?<!<)<<(?!<)-?\s*(['"]?)(\w+)\1/g)) fila.push(m[2]);
  }
  return saida.join('\n');
}
export function separadoresDeAspasNeutros(c) {
  let aspa = null; let o = '';
  for (let k = 0; k < c.length; k++) {
    const ch = c[k];
    if (aspa === null) {
      if (ch === '\\') { o += ch + (c[k + 1] ?? ''); k++; continue; }
      if (ch === "'" || ch === '"') aspa = ch;
      o += ch; continue;
    }
    if (ch === aspa) { aspa = null; o += ch; continue; }
    if (aspa === '"' && ch === '\\') { o += ch + (c[k + 1] ?? ''); k++; continue; }
    const executa = aspa === '"' && (ch === '`' || (ch === '(' && c[k - 1] === '$'));
    o += !executa && /[;&|(\n`]/.test(ch) ? '_' : ch;
  }
  return o;
}
const INVOCACAO = new RegExp(INICIO_DE_COMANDO + INVOCACAO_DO_PAINEL + String.raw`\s+(?:(?:set|update)\s+sessoes\s+\S+|batch)\s[^\n]*\blivre\b`);
const COM_DEL = new RegExp(INICIO_DE_COMANDO + INVOCACAO_DO_PAINEL + String.raw`\s+com\s+del\b`);
const COM_DEL_DE = new RegExp(INICIO_DE_COMANDO + INVOCACAO_DO_PAINEL + String.raw`\s+com\s+del\s+\S+\s+["']?(local_[\w-]+)`);
// O `local_` que o `com del` tira, ou null: sair do item é tirar a PRÓPRIA sessão; tirar a de outra (o dono tirando uma V) não cobra título.
export const comDelDe = (c) => separadoresDeAspasNeutros(semHeredoc(c)).match(COM_DEL_DE)?.[1] ?? null;
export const painelComDel = (c) => COM_DEL.test(separadoresDeAspasNeutros(semHeredoc(c)));
export const painelLivre = (c) => {
  const n = separadoresDeAspasNeutros(semHeredoc(c));
  return INVOCACAO.test(n) && (!/painel(?:\.mjs)?["']?\s+batch\b/.test(n) || /painel(?:\.mjs)?["']?\s+batch\s[^\n]*sessoes/.test(n));
};

function main() {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const { session_id, transcript_path, stop_hook_active } = input;
  if (!session_id || !transcript_path) return;

  const inicio = inicioDoTurno(transcript_path);
  if (inicio === null) return;

  let declarou = null; let limpou = false; const tirados = []; let tituloNovo = null; let trocouTitulo = false; let trabalhou = null;
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
      else if (n.endsWith('set_session_title') && ehSelf(i.session_id) && tituloLivre(i.title)) { declarou = 'título livre'; tituloNovo = i.title; }
      else if (n === 'Bash' && painelLivre(String(i.command || ''))) declarou ||= 'painel livre';
      if (n === 'Bash') { const t = comDelDe(String(i.command || '')); if (t) tirados.push(t); }
    }
  }
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

  // F30, regra 3: declarou-se livre e ainda consta como trabalhando num item.
  if (itens.com.length) {
    const lista = itens.com.join(', ');
    if (stop_hook_active) { registrar(session_id, HOOK, 'deixou-passar-com', lista); return; }
    registrar(session_id, HOOK, 'cobrou-com', lista);
    process.stdout.write(JSON.stringify({
      decision: 'block',
      reason: `Você se declarou livre e ainda consta como trabalhando em ${lista}: \`painel com del <F> ${regDecl.localId} --fez\` (ou sem --fez, se não entregou) para cada um, e termine o turno.`,
    }));
    return;
  }
  if (limpou) return;
  // F30, regra 1 com exceção: no `fez` de item vivo e fora de todo `com`, o contexto serve ao conserto.
  if (itens.fez.length) { registrar(session_id, HOOK, 'livre-com-contexto', itens.fez.join(',')); return; }

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
