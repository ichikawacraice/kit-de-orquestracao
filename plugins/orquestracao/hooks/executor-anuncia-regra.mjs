// A regra da trava de anúncio (F28), pura: o hook (executor-anuncia.mjs) e o replay
// (tests/executor-anuncia.replay.mjs) leem a MESMA, para o replay medir o que o hook faz.
import { devolveuDuvida } from './hooks-crewai-comum.mjs';

const ANUNCIA = /(?<![\w"'`])(volto (a|à|ao|aos|às|para|pra)|retomo|sigo (com|para|pra|no|na|nos|nas)|falta retomar|agora (começo|comeco|vou|parto|passo|sigo|faço|faco)|vou (começar|comecar|seguir|retomar|partir|passar)|parto (para|pra)|em seguida (faço|faco|vou|sigo))/i;
const CONDICAO = /\b(quando|assim que|ao (receber|terminar|ficar|sair|chegar)|depois que|logo que|até (que|a|o)|aguard|esper(o|ando|a)\b|se (a|o|estiver|vier|der|você|voce|sim|não|nao|quiser|preferir|escolher|aprovar|ninguém|ninguem|essas?|esses?)|com (a |o )?(sua|seu|teu|tua) |me (avis|diz|diga|confirm)|confirm[ae]\b|diga\b|responder|próxima mensagem|proxima mensagem|depois d[oa] (seu|sua|teu|tua)|enquanto|na notificação|na notificacao)/i;
// "Se C estiver certa, sigo…": condição escrita com nome próprio (maiúscula; por isso sem /i).
const CONDICAO_DE_NOME = /\b[Ss]e [A-ZÁÉÍÓÚ]\w*\b/;
const ESPERA = /\baguard/i;
const NEGACAO = /\bn[ãa]o (volto|sigo|retomo|vou)\b/i;
export const LIVRE = /(·\s*livre\b|\bestou livre\b|ficar livre|voltou a ficar livre)/i;

// Prosa: sem blocos de código; `inline` vira X (o anúncio citado entre crases não conta).
export const prosa = (t) => t.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, 'X');
export function ultimoParagrafo(t) {
  const ps = prosa(t).split(/\n\s*\n/).filter((p) => p.trim());
  return ps.length ? ps[ps.length - 1] : '';
}
const frases = (par) => par.split(/(?<=[.!;])\s+|\n/).filter((f) => f.trim());

// A frase do último parágrafo que anuncia sem condição, sem negar e sem virar pergunta; ou null.
export function anuncio(texto) {
  for (const f of frases(ultimoParagrafo(texto))) {
    const m = ANUNCIA.exec(f);
    if (m && !CONDICAO.test(f) && !CONDICAO_DE_NOME.test(f) && !NEGACAO.test(f) && !f.trimEnd().endsWith('?')) return { trecho: m[0], frase: f.trim() };
  }
  return null;
}

// 'nao-anuncia' | 'duvida' | 'espera' | 'livre' | 'anuncia' (+ o achado). 'espera' = qualquer frase do último
// parágrafo com "aguardo…" (a saída que a mensagem de bloqueio oferece, escrita em frase à parte). O fundo e as cobranças são do hook.
export function classificar(texto) {
  const achado = anuncio(texto);
  if (!achado) return { tipo: 'nao-anuncia', achado: null };
  const par = ultimoParagrafo(texto);
  if (par.includes('?') || devolveuDuvida(texto)) return { tipo: 'duvida', achado };
  if (frases(par).some((f) => ESPERA.test(f))) return { tipo: 'espera', achado };
  if (LIVRE.test(par)) return { tipo: 'livre', achado };
  return { tipo: 'anuncia', achado };
}
