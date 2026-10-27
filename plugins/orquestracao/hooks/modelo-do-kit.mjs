// Qual modelo de trabalho vale (ADR 0011): `dona` (padrão: uma sessão dona do item do plano ao PR) ou `papeis` (o pool de
// P/D/E/V, para os itens antigos que ainda terminam nele). Ordem: `KIT_MODELO` no ambiente, depois `modelo.json`
// (`{"modelo":"papeis"}`) na pasta do estado (`HOOKS_CREWAI_BASE`, padrão ~/.claude/orquestracao). Valor estranho ou
// arquivo ilegível = `dona`. Sem I/O além dessa leitura, para o painel, a batida e os hooks importarem sem custo.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const MODELOS = ['dona', 'papeis'];

export function modeloDoKit(env = process.env) {
  const doEnv = String(env.KIT_MODELO ?? '').trim().toLowerCase();
  if (MODELOS.includes(doEnv)) return doEnv;
  try {
    const base = env.HOOKS_CREWAI_BASE || join(env.HOME || homedir(), '.claude', 'orquestracao');
    const m = String(JSON.parse(readFileSync(join(base, 'modelo.json'), 'utf8'))?.modelo ?? '').toLowerCase();
    if (MODELOS.includes(m)) return m;
  } catch { /* sem arquivo: o padrão */ }
  return 'dona';
}

export const modeloDaDona = (env = process.env) => modeloDoKit(env) === 'dona';

// Teto de donas trabalhando ao mesmo tempo no projeto (ADR 0011, decisão 5): `KIT_TETO_DE_DONAS`, padrão 4.
export function tetoDeDonas(env = process.env) {
  const n = Number(env.KIT_TETO_DE_DONAS);
  return Number.isInteger(n) && n > 0 ? n : 4;
}

// Item do modelo da dona com alguém trabalhando nele (a dona ou quem está no `com`), em etapa que conta para o teto.
export const ETAPAS_DE_TRABALHO = ['planejamento', 'design', 'execucao', 'validacao'];
export const itemDaDona = (d) => d?.via === 'dona';
export function donaTrabalhando(d) {
  if (!itemDaDona(d) || !ETAPAS_DE_TRABALHO.includes(d.etapa)) return false;
  return Boolean(d.donoLocalId) || (Array.isArray(d.com) && d.com.length > 0);
}
