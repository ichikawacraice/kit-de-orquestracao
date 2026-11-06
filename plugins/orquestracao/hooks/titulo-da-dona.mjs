#!/usr/bin/env node
// PreToolUse (F181, Q473): start_session cujo prompt é de dona ("Você é a dona do F<n>") só passa com título que começa por `F<n> · `.
// O ID primeiro dá ao operador a referência do item; a regra só no texto da skill foi violada (F140, F172, F174).
// F419 (ADR 0025): e só com `model` e `effort` explícitos, em sessão `fresh` (o fork herda modelo e contexto de quem abre);
// Sonnet é o padrão, Opus só com a linha `Gatilho do Opus: <gatilho>` no prompt, de uma lista fechada. Nuvem passa sem modelo.
// Cada dona que passa vai ao log (`abriu-sonnet`, `abriu-opus` com o gatilho, `abriu-nuvem`): é a contagem do roteamento.
// A recusa traz o título certo. Sem título nem prompt (`proposal_id` sozinho) passa: o cartão já foi checado ao nascer.
// Erro do próprio hook vai para o log e DEIXA PASSAR: a trava não pode derrubar as sessões.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registrar, lerEntrada } from './hooks-crewai-comum.mjs';

const HOOK = 'titulo-da-dona';
const TOOL = 'mcp__ccd_session__start_session';
// A frase que diz quem a sessão É ("Você é a dona do F<n>", da skill orquestradora), não qualquer "dona do F<n>" citada no
// contexto do prompt: "a dona do F174 abriu sem ID" ou "avise a dona do F150" não fazem desta sessão a dona de outro item.
export const MARCA_DE_DONA = /\b(?:você|voce)\s+é\s+a\s+dona\s+do\s+`?(F\d+)\b/i;
// Um ID solto no começo do título (`F180 · `, `F181 - `, `F181: `) sai da sugestão: o certo entra no lugar dele.
const ID_NO_COMECO = /^\s*F\d+\b\s*[·:\-–—]?\s*/i;

// Os gatilhos do Opus (ADR 0025, protocolo#modelo-e-esforco). Fora deles, a dona nasce em Sonnet.
export const GATILHOS_DO_OPUS = ['decisao', 'contrato', 'estado', 'seguranca', 'producao', 'devolvido'];
const SEM_ACENTO = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
// Linha própria (pode vir em item de lista, citação ou negrito); a menção em prosa ("não há gatilho do Opus: estado") não conta.
const LINHA_DO_GATILHO = /^[\s>*_`-]*gatilho do opus[*_`]*:[*_`]*\s*[`*_]*([a-z]+)/m;

/** O gatilho do Opus nomeado no prompt, ou null. */
export function gatilhoDoOpus(prompt) {
  const m = LINHA_DO_GATILHO.exec(SEM_ACENTO(String(prompt ?? '')));
  return m && GATILHOS_DO_OPUS.includes(m[1]) ? m[1] : null;
}

const LISTA = GATILHOS_DO_OPUS.join(', ') + ' (skill papeis-e-modelos).';
const PADRAO = 'Padrão: `model: "sonnet"`, `effort: "medium"`; Opus (`effort: "high"`) só com a linha `Gatilho do Opus: <gatilho>` no prompt, um de: ' + LISTA;
// F438 (ADR 0030): no Orca o modelo vai em bandeira do `orca` (que o repassa ao `claude --model`, que aceita o apelido).
const PADRAO_ORCA = 'Padrão: `--model sonnet --effort medium`; Opus (`--model opus --effort high`) só com a linha `Gatilho do Opus: <gatilho>` no texto do pedido, um de: ' + LISTA;

/**
 * A recusa pelo modelo, ou null quando passa. No app (padrão), só para prompt de dona.
 * F438: `papel` 'worker' (quem não é dona, no Orca) aceita também o Haiku; `sintaxe` 'orca' fala em bandeiras do `orca`.
 */
export function recusaDoModelo(id, input, { papel = 'dona', sintaxe = 'app' } = {}) {
  const orca = sintaxe === 'orca';
  const padrao = orca ? PADRAO_ORCA : PADRAO;
  const quem = papel === 'dona' ? (orca ? `worker dono do ${id}` : `sessão dona do ${id}`) : 'worker';
  if (input?.target === 'cloud') return null;
  if (input?.context === 'fork') return `${quem} aberta por fork: o fork herda o modelo e a conversa inteira de quem abre. Abra com context "fresh" e \`model\`/\`effort\` explícitos. ${padrao}`;
  const model = typeof input?.model === 'string' ? input.model.trim().toLowerCase() : '';
  const effort = typeof input?.effort === 'string' ? input.effort.trim() : '';
  const [m, e] = orca ? ['`--model`', '`--effort`'] : ['`model`', '`effort`'];
  const herda = orca ? 'sem eles o worker nasce no modelo da configuração do Orca, e não no do risco do item' : 'sem eles a dona herda o Opus de quem abre';
  if (!model || !effort) return `${quem} sem ${!model ? m : ''}${!model && !effort ? ' nem ' : ''}${!effort ? e : ''}: ${herda}. ${padrao}`;
  if (model.includes('haiku')) return papel === 'dona' ? `${quem} em Haiku: Haiku só lê, e a dona escreve. ${padrao}` : null;
  if (model.includes('sonnet')) return null;
  if (!model.includes('opus')) return `${quem} com modelo desconhecido ("${input.model}"). ${padrao}`;
  if (gatilhoDoOpus(input?.prompt)) return null;
  return `${quem} em Opus sem gatilho nomeado. ${padrao}`;
}

/** O que vai ao log quando a dona passa. */
export function desfechoDoModelo(input) {
  if (input?.target === 'cloud') return ['abriu-nuvem', ''];
  const model = String(input?.model ?? '').toLowerCase();
  if (model.includes('opus')) return ['abriu-opus', `${gatilhoDoOpus(input?.prompt)} effort=${input?.effort}`];
  return ['abriu-sonnet', `effort=${input?.effort}`];
}

export function tituloSugerido(id, titulo) {
  const tema = String(titulo ?? '').replace(ID_NO_COMECO, '').trim();
  return `${id} · ${tema || '<tema em palavras do produto>'}`;
}

/** A recusa para esta chamada, ou null quando passa. */
export function decidir(tool, input) {
  if (tool !== TOOL) return null;
  const prompt = typeof input?.prompt === 'string' ? input.prompt : '';
  const m = MARCA_DE_DONA.exec(prompt);
  if (!m) return null;
  const id = m[1].toUpperCase();
  const titulo = typeof input?.title === 'string' ? input.title : '';
  if (titulo.startsWith(`${id} · `) && titulo.slice(id.length + 3).trim() !== '') return recusaDoModelo(id, input);
  const certo = tituloSugerido(id, titulo);
  return `sessão dona do ${id} com título fora do padrão ("${titulo}"): o título começa pelo ID do item. Abra de novo com o título "${certo}".`;
}

function main() {
  const e = lerEntrada();
  const motivo = decidir(e.tool_name, e.tool_input);
  if (!motivo) {
    const dona = e.tool_name === TOOL && MARCA_DE_DONA.exec(typeof e.tool_input?.prompt === 'string' ? e.tool_input.prompt : '');
    if (dona) { const [desfecho, detalhe] = desfechoDoModelo(e.tool_input); registrar(e.session_id, HOOK, desfecho, `${dona[1].toUpperCase()} ${detalhe}`.trim()); }
    return;
  }
  registrar(e.session_id, HOOK, 'recusou', motivo);
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: motivo } }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (err) { registrar('-', HOOK, 'erro', `${err?.name ?? 'Error'}: ${err?.message ?? ''}`); }
  process.exitCode = 0;
}
