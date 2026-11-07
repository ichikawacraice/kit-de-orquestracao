// F484: a dona parada no limite de uso da conta, no Orca. O Orca manda à coordenadora uma `escalation` com
// `payload.failureKind: "usageLimitReached"` e o título da tarefa no corpo ("… while running task "Você é a dona do F441 · …""),
// e o chat segue com a dona (medido em 07/11/2026 no Izanagi: o despacho fica `ready`, terminal `active`, "The task is still
// assigned to this chat"). Quem lê é a trava do ritual: o item dessa dona tem dona, em espera, mesmo que ela não tenha chegado a
// se gravar nele. Falha fechada: sem orca, caixa ou lista ilegível → null, e quem chama segue cobrando.
import { spawnSync } from 'node:child_process';
import { binarioDoOrca, workersDoOrca, estadoFinal } from './orca-workers.mjs';

const JANELA_MS = 24 * 3_600_000; // escalation mais velha que isso não conta (o reset de 5 h já passou faz tempo)
// As duas leituras (caixa e lista de workers) somadas: bem abaixo dos 10 s de teto do hook do ritual no hooks.json, para a
// falha fechada valer com o Orca lento (morto pelo Claude Code, o hook não cobraria nada).
export const ORCAMENTO_MS = 6_000;
const POR_LEITURA = 200; // as mensagens mais novas da caixa; a escalation do dia está entre elas

const texto = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
function payloadDe(m) {
  if (m?.payload && typeof m.payload === 'object') return m.payload;
  try { const p = JSON.parse(m?.payload); return p && typeof p === 'object' ? p : null; } catch { return null; }
}

/**
 * As escalations de limite de uso das últimas 24 h, por item citado no título da tarefa. Puro.
 * → Map<F, { handle, dispatchId, emMs, detalhe }>, a mais nova de cada item.
 */
export function limitesDaCaixa(mensagens, agoraMs) {
  const porItem = new Map();
  for (const m of Array.isArray(mensagens) ? mensagens : []) {
    if (m?.type !== 'escalation') continue;
    const p = payloadDe(m);
    if (p?.failureKind !== 'usageLimitReached') continue;
    const emMs = Date.parse(m.created_at);
    if (!Number.isFinite(emMs) || agoraMs - emMs > JANELA_MS) continue;
    const titulo = /while running task "([^"]*)"/.exec(String(m.body ?? ''))?.[1];
    if (!titulo) continue;
    const dado = { handle: texto(p.handle) ?? texto(m.from_handle), dispatchId: texto(p.dispatchId), emMs, detalhe: texto(p.detail) };
    for (const F of new Set(titulo.match(/\bF\d+\b/g) ?? [])) {
      if (!porItem.has(F) || porItem.get(F).emMs < emMs) porItem.set(F, dado);
    }
  }
  return porItem;
}

/** A caixa do Orca (todas as Runs), sem o vínculo de quem chama. → mensagens | null. */
function caixaDoOrca(env, prazoMs) {
  const bin = binarioDoOrca(env);
  if (!bin) return null;
  const filho = { ...env };
  delete filho.ORCA_TERMINAL_HANDLE;
  delete filho.ORCA_AGENT_SESSION_ID;
  const r = spawnSync(bin, ['orchestration', 'inbox', '--json', '--full', '--limit', String(POR_LEITURA)], {
    env: filho, encoding: 'utf8', timeout: prazoMs, killSignal: 'SIGKILL', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024,
  });
  if (r.error || r.status !== 0) return null;
  try {
    const d = JSON.parse(r.stdout);
    return d?.ok === true && Array.isArray(d.result?.messages) ? d.result.messages : null;
  } catch { return null; }
}

const parouDeVez = (w) => estadoFinal(w?.state) || String(w?.state ?? '').toLowerCase() === 'stopped';

/**
 * Os itens cuja dona está no limite de uso com o chat ainda vivo: escalation recente e algum despacho vivo e não parado no
 * terminal dela (o `send --to dispatch:` cria um follow-up com id novo no mesmo terminal) ou com o mesmo despacho.
 * → Set<F> | null (sem orca ou leitura que falhou).
 */
export function donasNoLimite({ env = process.env, agoraMs = Date.now(), orcamentoMs = ORCAMENTO_MS } = {}) {
  const fim = Date.now() + orcamentoMs;
  const mensagens = caixaDoOrca(env, Math.ceil(orcamentoMs / 2));
  if (!mensagens) return null;
  const limites = limitesDaCaixa(mensagens, agoraMs);
  if (limites.size === 0) return new Set();
  const resta = fim - Date.now();
  if (resta < 500) return null;
  const lista = workersDoOrca({ env, prazoMs: resta });
  if (!lista || lista.erro) return null;
  const vivo = (w) => w.vivo && !parouDeVez(w);
  const emEspera = new Set();
  for (const [F, l] of limites) {
    if (lista.workers.some((w) => vivo(w) && ((l.handle && w.terminal === l.handle) || (l.dispatchId && w.dispatchId === l.dispatchId)))) emEspera.add(F);
  }
  return emEspera;
}
