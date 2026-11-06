// F470: o estado dos agentes do Orca, que diz se a dona do Orca está trabalhando agora. `orca worktree ps --json` traz, por
// worktree, os agentes dela com o `state` que a barra lateral do Orca mostra (working, done…); o agente da dona se acha pelo id
// dela na `paneKey` (`structured-agent-session-<id>:<painel>`). Medido em 06/11/2026: o `lastOutputAt` do `terminal list` é do
// terminal de shell (horas parado com a dona trabalhando) e o `liveness` do `worker-list` é "unverifiable" para toda dona viva;
// só o `state` do agente separa a dona trabalhando (working) da que terminou o turno e espera resposta (done).
// Lista que falhou, não é JSON ou veio truncada é erro: quem lê trata como "não sei" (ninguém roda), nunca como "rodando".
import { spawnSync } from 'node:child_process';
import { binarioDoOrca } from './orca-workers.mjs';

const PRAZO_MS = 15_000;
const LIMITE = 500; // as worktrees do Orca numa página
const DA_SESSAO = /^structured-agent-session-(.+?):/;
const PREFIXO = 'orca_session_id:';

/** → null (sem orca) | { erro } | { agentes: Map<id da sessão sem prefixo, state> } */
export function agentesDoOrca({ env = process.env, prazoMs = PRAZO_MS } = {}) {
  const bin = binarioDoOrca(env);
  if (!bin) return null;
  const filho = { ...env };
  delete filho.ORCA_TERMINAL_HANDLE;
  delete filho.ORCA_AGENT_SESSION_ID;
  const r = spawnSync(bin, ['worktree', 'ps', '--json', '--limit', String(LIMITE)], {
    env: filho, encoding: 'utf8', timeout: prazoMs, killSignal: 'SIGKILL', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024,
  });
  if (r.error) return { erro: `orca worktree ps não rodou: ${r.error.code || r.error.message}` };
  if (r.status !== 0) return { erro: `orca worktree ps saiu com ${r.status ?? r.signal}: ${String(r.stderr || r.stdout || '').trim().slice(0, 300)}` };
  let d;
  try { d = JSON.parse(r.stdout); } catch { return { erro: 'orca worktree ps: saída ilegível (não é JSON)' }; }
  if (d?.ok !== true) return { erro: `orca worktree ps recusou: ${JSON.stringify(d?.error ?? d).slice(0, 300)}` };
  const lista = d.result?.worktrees;
  if (!Array.isArray(lista)) return { erro: 'orca worktree ps: o recibo não traz as worktrees' };
  if (d.result.truncated === true) return { erro: `orca worktree ps: lista truncada em ${lista.length} worktrees` };
  const agentes = new Map();
  for (const w of lista) {
    for (const a of Array.isArray(w?.agents) ? w.agents : []) {
      const id = typeof a?.paneKey === 'string' ? DA_SESSAO.exec(a.paneKey)?.[1] : null;
      if (id && typeof a.state === 'string') agentes.set(id, a.state);
    }
  }
  return { agentes };
}

/**
 * A dona `orca_session_id:<id>` está trabalhando agora? true só com o agente dela em `working`; `done` (terminou o turno: espera
 * resposta ou entregou), qualquer outro estado e o agente ausente são false; null: fora da vista (sem a lista, ou com erro).
 */
export function rodandoDoRegistro(orcaId, lista) {
  if (!lista || lista.erro || !(lista.agentes instanceof Map)) return null;
  if (typeof orcaId !== 'string' || !orcaId.startsWith(PREFIXO)) return null;
  return lista.agentes.get(orcaId.slice(PREFIXO.length)) === 'working';
}
