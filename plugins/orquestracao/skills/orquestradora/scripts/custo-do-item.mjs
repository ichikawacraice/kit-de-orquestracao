// O custo de um item (F348, protocolo `custo-do-item`): a soma do gasto das sessões que trabalharam nele, lida dos
// transcripts (o fio principal e os subagentes, inclusive os aninhados), com os pesos do preço relativo do Opus 5.5.
// `relativo` é em milhões de tokens-equivalentes de entrada: serve para comparar item com item, não é fatura.
// O transcript mora em <projetos>/<slug do cwd>/<id do CLI>.jsonl e os subagentes em <projetos>/<slug>/<id do CLI>/**;
// o slug é procurado em toda pasta de projeto (a sessão que mudou de worktree grava em outra). Cada limpeza de contexto
// troca a id do CLI: somam-se todas (`cliIds` do registro do app).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const PESOS = { entrada: 1, escrita5m: 1.25, escrita1h: 2, leitura: 0.1, saida: 5 };
export const projetosDir = () => process.env.KIT_PROJETOS_DIR || join(homedir(), '.claude', 'projects');

function jsonlsAbaixo(dir) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? jsonlsAbaixo(join(dir, d.name)) : d.name.endsWith('.jsonl') ? [join(dir, d.name)] : []);
}

export function transcriptsDoCli(cliId, raiz = projetosDir()) {
  if (!cliId || !existsSync(raiz)) return [];
  return readdirSync(raiz, { withFileTypes: true }).filter((d) => d.isDirectory()).flatMap((d) => {
    const f = join(raiz, d.name, `${cliId}.jsonl`);
    return [...(existsSync(f) ? [f] : []), ...jsonlsAbaixo(join(raiz, d.name, cliId))];
  });
}

// Soma as chamadas do modelo (entrada `assistant` com `usage`), deduplicadas por message.id + requestId: o streaming grava
// uma entrada por bloco com o mesmo usage.
export function somar(arquivos, vistos = new Set()) {
  const t = { chamadas: 0, entrada: 0, escrita5m: 0, escrita1h: 0, leitura: 0, saida: 0 };
  for (const f of arquivos) {
    let texto;
    try { texto = readFileSync(f, 'utf8'); } catch { continue; }
    for (const l of texto.split('\n')) {
      if (!l.includes('"usage"')) continue;
      let e;
      try { e = JSON.parse(l); } catch { continue; } // linha parcial
      const u = e?.message?.usage;
      if (e.type !== 'assistant' || !u) continue;
      const id = `${e.message.id ?? ''}:${e.requestId ?? ''}`;
      if (id !== ':' && vistos.has(id)) continue;
      vistos.add(id);
      const cc = u.cache_creation ?? {};
      const w1h = cc.ephemeral_1h_input_tokens ?? 0;
      t.chamadas++;
      t.entrada += u.input_tokens ?? 0;
      t.escrita1h += w1h;
      t.escrita5m += cc.ephemeral_5m_input_tokens ?? Math.max(0, (u.cache_creation_input_tokens ?? 0) - w1h);
      t.leitura += u.cache_read_input_tokens ?? 0;
      t.saida += u.output_tokens ?? 0;
    }
  }
  return t;
}

export const relativo = (t) => Object.entries(PESOS).reduce((s, [k, p]) => s + (t[k] ?? 0) * p, 0) / 1e6;

/**
 * `localIds`: as sessões do item; `registro(localId)` → { cliIds } (o `registroDaSessao` do pool-comum).
 * → { relativo (1 casa), chamadas, entrada, escrita5m, escrita1h, leitura, saida, sessoes: { lidas, de }, medidoEm }.
 * Sessão sem registro ou sem transcript na máquina conta zero e não entra em `lidas`.
 */
export function custoDoItem(localIds, { registro, raiz = projetosDir(), agora = new Date() } = {}) {
  const ids = [...new Set(localIds.filter(Boolean))];
  const vistos = new Set();
  const total = { chamadas: 0, entrada: 0, escrita5m: 0, escrita1h: 0, leitura: 0, saida: 0 };
  let lidas = 0;
  for (const id of ids) {
    let reg = null;
    try { reg = registro?.(id) ?? null; } catch { /* sem registro: conta zero */ }
    const arquivos = (reg?.cliIds ?? []).flatMap((c) => transcriptsDoCli(c, raiz));
    if (!arquivos.length) continue;
    lidas++;
    const t = somar(arquivos, vistos);
    for (const k of Object.keys(total)) total[k] += t[k];
  }
  return { relativo: Math.round(relativo(total) * 10) / 10, ...total, sessoes: { lidas, de: ids.length }, medidoEm: agora.toISOString() };
}

// As sessões de um item: as anotadas em `sessoes` (o `com add` as guarda), as do `com` e a dona.
export const sessoesDoItem = (d) => [
  ...(Array.isArray(d?.sessoes) ? d.sessoes : []),
  ...(Array.isArray(d?.com) ? d.com.map((c) => c?.localId) : []),
  d?.donoLocalId,
].filter((x) => typeof x === 'string' && x.startsWith('local_'));
