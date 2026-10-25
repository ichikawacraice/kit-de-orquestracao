// Comum às duas travas copiadas da CrewAI (Q62, 23/10): log do piloto e leitura de transcript.
// Estudo: estudo de CrewAI/swarms do operador (notas em ~/.claude/orquestracao), seção 5.
import { appendFileSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const BASE = process.env.HOOKS_CREWAI_BASE || join(homedir(), '.claude', 'orquestracao');
export const LOG = join(BASE, 'hooks-crewai.log');

// O plugin `orquestracao` nomeia os seus agents e skills com prefixo (`orquestracao:executor`); as travas que casam por
// nome aceitam as duas formas. Só este prefixo sai: `impeccable:x` e outros ficam como chegam.
export const semPrefixoDoPlugin = (nome) => String(nome ?? '').replace(/^\/?orquestracao:/, '');

// Uma linha por evento: data, sessão, hook, desfecho, detalhe (TSV).
export function registrar(sessao, hook, desfecho, detalhe = '') {
  try {
    const d = String(detalhe).replace(/\s+/g, ' ').slice(0, 300);
    appendFileSync(LOG, `${new Date().toISOString()}\t${sessao || '-'}\t${hook}\t${desfecho}\t${d}\n`);
  } catch { /* sem log, segue */ }
}

// Início de comando (começo, `; & | ( \n` ou crase) seguido de atribuições `VAR=x` e dos prefixos `env`, `time`, `nice [-n N]`.
export const INICIO_DE_COMANDO = String.raw`(?:^|[;&|(\n` + '`' + String.raw`])\s*(?:(?:[A-Za-z_]\w*=\S*|env|time|nice(?:\s+-n\s*-?\d+)?)\s+)*`;
// A invocação do painel: `node …/painel.mjs` (caminho antigo) ou o comando `painel` do bin/ do plugin (com ou sem caminho).
export const INVOCACAO_DO_PAINEL = String.raw`(?:node\s+["']?\S*painel\.mjs["']?|["']?(?:\S*\/)?painel["']?)`;

// Gravar no painel = invocar o painel com um verbo de escrita. O caminho do script pode vir por variável
// (`P=…/painel.mjs; node "$P" update …`): basta citar o script e um verbo de escrita vir logo depois dele ou da variável.
export function gravaNoPainel(comando) {
  const c = String(comando ?? '');
  const porScript = /painel\.mjs/.test(c) && /(painel\.mjs|\$\{?\w+\}?)['"]?\s+(set|update|batch|delete)\b/.test(c);
  return porScript || new RegExp(INICIO_DE_COMANDO + INVOCACAO_DO_PAINEL + String.raw`\s+(?:set|update|batch|delete)\b`).test(c);
}

export function lerEntrada() {
  return JSON.parse(readFileSync(0, 'utf8'));
}

export function lerTranscript(caminho) {
  const entradas = [];
  if (!caminho) return entradas;
  for (const l of readFileSync(caminho, 'utf8').split('\n')) {
    if (!l) continue;
    try { entradas.push(JSON.parse(l)); } catch { /* linha parcial */ }
  }
  return entradas;
}
