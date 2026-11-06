// F444 (ADR 0030, item 6; fatia 4): a lista de workers do Orca, que diz se a dona do Orca está viva e se a worktree tem gente.
// `orca orchestration worker-list --json` sem o vínculo do Orca (o filho não herda ORCA_TERMINAL_HANDLE nem
// ORCA_AGENT_SESSION_ID, que restringiriam a lista à Run de quem chama), seguindo o `nextCursor` até o fim. O recibo precisa
// dizer `scope.source: "all"`. Lista parcial, ilegível ou que falhou é erro: quem lê trata como falha fechada (nenhuma dona do
// Orca conta como morta; o limpador não remove nada). Sem `orca` na máquina, null: o kit segue como antes.
// Achar o binário: KIT_ORCA_BIN vale sozinho quando definido ('' ou 'off' = sem orca); senão o `orca` do PATH; senão o do app
// (KIT_ORCA_APP_BIN, padrão /Applications/Orca.app/...): o launchd roda o limpador com PATH curto.
import { spawnSync } from 'node:child_process';
import { accessSync, constants, realpathSync, statSync } from 'node:fs';
import { delimiter, join, resolve, sep } from 'node:path';

export const ORCA_DO_APP = '/Applications/Orca.app/Contents/Resources/bin/orca';
const PRAZO_MS = 15_000;
const POR_PAGINA = 100; // o teto do `--limit`
const MAX_PAGINAS = 50;

function executavel(p) {
  try { accessSync(p, constants.X_OK); return statSync(p).isFile(); } catch { return false; }
}

/** O caminho do `orca` a chamar, ou null quando não há. */
export function binarioDoOrca(env = process.env) {
  if (env.KIT_ORCA_BIN !== undefined) {
    const v = String(env.KIT_ORCA_BIN).trim();
    return v && v !== 'off' ? v : null;
  }
  for (const d of String(env.PATH ?? '').split(delimiter)) {
    if (!d) continue;
    const p = join(d, 'orca');
    if (executavel(p)) return p;
  }
  const app = env.KIT_ORCA_APP_BIN ?? ORCA_DO_APP;
  return app && executavel(app) ? app : null;
}

const texto = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
// Estados finais do despacho. O despacho só de contexto (sem terminal) não tem processo dele: vivo só enquanto o estado não é
// um destes (medido em 06/11: a linha `succeeded` sem terminal fica na lista para sempre, e nunca vira `released`).
const ESTADOS_FINAIS = new Set(['succeeded', 'failed', 'cancelled', 'canceled', 'completed', 'done', 'expired']);

function normalizar(w) {
  const ws = texto(w?.workspace);
  const i = ws ? ws.indexOf('::') : -1;
  const terminalState = texto(w?.terminalState);
  const terminal = texto(w?.terminal);
  const state = texto(w?.state);
  return {
    terminal,
    terminalState,
    // com terminal, vivo é tudo que não está `released` (na dúvida, sem o campo, conta como vivo); sem terminal, pelo estado
    vivo: terminal || terminalState ? terminalState !== 'released' : !ESTADOS_FINAIS.has(String(state).toLowerCase()),
    pasta: ws ? (i >= 0 ? ws.slice(i + 2) : ws) || null : null,
    repoId: ws && i >= 0 ? ws.slice(0, i) || null : null,
    dispatchId: texto(w?.dispatchId),
    taskId: texto(w?.taskId),
    state,
    liveness: texto(w?.liveness),
  };
}

/**
 * Todos os workers do Orca. → null (sem orca) | { erro } | { workers: [{ terminal, terminalState, vivo, pasta, repoId, dispatchId,
 * taskId, state, liveness }] }.
 */
export function workersDoOrca({ env = process.env, prazoMs = PRAZO_MS } = {}) {
  const bin = binarioDoOrca(env);
  if (!bin) return null;
  const filho = { ...env };
  delete filho.ORCA_TERMINAL_HANDLE;
  delete filho.ORCA_AGENT_SESSION_ID;
  const workers = [];
  let cursor = null;
  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    const args = ['orchestration', 'worker-list', '--json', '--limit', String(POR_PAGINA), ...(cursor ? ['--cursor', cursor] : [])];
    const r = spawnSync(bin, args, {
      env: filho, encoding: 'utf8', timeout: prazoMs, killSignal: 'SIGKILL', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024,
    });
    const onde = `orca worker-list${cursor ? ' (página seguinte)' : ''}`;
    if (r.error) return { erro: `${onde} não rodou: ${r.error.code || r.error.message}` };
    if (r.status !== 0) return { erro: `${onde} saiu com ${r.status ?? r.signal}: ${String(r.stderr || r.stdout || '').trim().slice(0, 300)}` };
    let d;
    try { d = JSON.parse(r.stdout); } catch { return { erro: `${onde}: saída ilegível (não é JSON)` }; }
    if (d?.ok !== true) return { erro: `${onde} recusou: ${JSON.stringify(d?.error ?? d).slice(0, 300)}` };
    const res = d.result;
    if (!res || !Array.isArray(res.workers)) return { erro: `${onde}: o recibo não traz a lista de workers` };
    if (res.scope?.source !== 'all') return { erro: `${onde}: escopo ${JSON.stringify(res.scope?.source ?? null)}, não "all" (a lista seria só de uma Run)` };
    for (const w of res.workers) workers.push(normalizar(w));
    cursor = texto(res.nextCursor);
    if (!cursor) return { workers };
  }
  return { erro: `orca worker-list: mais de ${MAX_PAGINAS} páginas; a lista ficou parcial` };
}

function real(p) {
  try { return realpathSync(p); } catch { return resolve(p); }
}
/** `cwd` é `pasta` ou está dentro dela (caminhos reais). */
export function dentroDe(cwd, pasta) {
  if (!texto(cwd) || !texto(pasta)) return false;
  const a = real(cwd); const b = real(pasta);
  return a === b || a.startsWith(b.endsWith(sep) ? b : b + sep);
}

/**
 * A vida da sessão do Orca registrada em `orca-sessoes/` (`reg`: { terminal, cwd }), pela lista. true: há worker vivo com o
 * terminal dela, ou (o terminal dela fora da lista) worker vivo cuja pasta contém o cwd dela; false: a lista mostra o terminal
 * dela e todas as linhas dele estão `released` (a prova ganha da pasta compartilhada); null: fora da vista (sem a lista, lista
 * com erro, sem registro, ou nem o terminal nem a pasta dela na lista). Nunca false sem a prova.
 */
export function vidaDoRegistro(reg, lista) {
  if (!reg || !lista || lista.erro || !Array.isArray(lista.workers)) return null;
  const meus = reg.terminal ? lista.workers.filter((w) => w.terminal === reg.terminal) : [];
  if (meus.some((w) => w.vivo)) return true;
  if (meus.length) return false; // todas as linhas do terminal dela liberadas
  if (texto(reg.cwd) && lista.workers.some((w) => w.vivo && dentroDe(reg.cwd, w.pasta))) return true;
  return null;
}
