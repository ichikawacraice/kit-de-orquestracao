// F444: o `orca` falso dos testes. Devolve as páginas fixas do `worker-list` (por `--cursor`) e grava os argumentos e as envs
// ORCA_* que recebeu em chamadas.jsonl. Quem usa passa `env` (KIT_ORCA_BIN e ORCA_FALSO_DIR) ao processo que chama o orca.
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const ORCA_FALSO = `#!${process.execPath}
const fs = require('fs');
const d = process.env.ORCA_FALSO_DIR;
const env = {};
for (const k of Object.keys(process.env)) if (k.startsWith('ORCA_')) env[k] = process.env[k];
fs.appendFileSync(d + '/chamadas.jsonl', JSON.stringify({ argv: process.argv.slice(2), env }) + '\\n');
// F447: outro subcomando (worker-release, worktree set, worktree rm…) responde pelo mapa 'outros' de paginas.json
// ('<palavra> <palavra>' → resposta), e sem entrada nele responde ok; só o worker-list lê as páginas.
const todas = JSON.parse(fs.readFileSync(d + '/paginas.json', 'utf8'));
const sub = process.argv.slice(2, 4).join(' ');
if (sub !== 'orchestration worker-list') {
  const o = (!Array.isArray(todas) && todas.outros && todas.outros[sub]) || { stdout: { ok: true, result: {} } };
  process.stdout.write(typeof o.stdout === 'string' ? o.stdout : JSON.stringify(o.stdout)); process.exitCode = o.exit || 0;
  return;
}
// paginas.json é um mapa cursor → resposta, ou uma lista de mapas: a N-ª leitura da lista sem cursor (e as páginas dela) usa o N-º
const n = fs.readFileSync(d + '/chamadas.jsonl', 'utf8').trim().split('\\n').map((l) => JSON.parse(l).argv).filter((a) => a.slice(0, 2).join(' ') === 'orchestration worker-list' && !a.includes('--cursor')).length;
const paginas = Array.isArray(todas) ? todas[Math.min(n, todas.length) - 1] : todas;
const i = process.argv.indexOf('--cursor');
const r = paginas[i >= 0 ? process.argv[i + 1] : ''];
if (!r) { process.stderr.write('cursor desconhecido'); process.exitCode = 3; }
else {
  // escrever: o falso grava um arquivo ao responder (o teste simula algo que muda no meio da rodada)
  if (r.escrever) fs.writeFileSync(r.escrever.arquivo, r.escrever.conteudo);
  process.stdout.write(typeof r.stdout === 'string' ? r.stdout : JSON.stringify(r.stdout)); process.exitCode = r.exit || 0;
}
`;

/**
 * Pasta com o `orca` falso; `paginas`: { '' : resposta da 1ª chamada, '<cursor>': da seguinte }, ou uma lista desses mapas,
 * um por leitura da lista (a última se repete).
 */
export function orcaFalso(paginas) {
  const d = realpathSync(mkdtempSync(join(tmpdir(), 'orca-falso-')));
  mkdirSync(join(d, 'bin'));
  writeFileSync(join(d, 'bin', 'orca'), ORCA_FALSO, { mode: 0o755 });
  writeFileSync(join(d, 'paginas.json'), JSON.stringify(paginas));
  const chamadas = () => (existsSync(join(d, 'chamadas.jsonl'))
    ? readFileSync(join(d, 'chamadas.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : []);
  return { dir: d, bin: join(d, 'bin', 'orca'), env: { KIT_ORCA_BIN: join(d, 'bin', 'orca'), ORCA_FALSO_DIR: d }, chamadas };
}

/** O recibo do `worker-list --json` como o Orca o devolve (medido em 06/11/2026). */
export const recibo = (workers, { nextCursor, source = 'all' } = {}) => ({
  stdout: { ok: true, result: { workers, scope: { source }, ...(nextCursor ? { nextCursor } : {}) } },
});
export const worker = (pasta, terminalState = 'retained', extra = {}) => ({
  dispatchId: `ctx_${Math.random().toString(16).slice(2, 10)}`, taskId: 'task_x', state: 'ready', liveness: 'unverifiable',
  terminal: `structworker_${Math.random().toString(16).slice(2, 10)}`, terminalState, workspace: `repo-uuid::${pasta}`, host: 'local', ...extra,
});

/**
 * O recibo do `worktree ps --json` como o Orca o devolve (medido em 06/11/2026): uma linha por worktree, com os agentes dela.
 * O falso o serve pelo mapa 'outros' de paginas.json, na chave 'worktree ps'.
 */
export const reciboPs = (worktrees, { truncated = false } = {}) => ({
  stdout: { ok: true, result: { worktrees, hostScope: { covered: ['local'] }, totalCount: worktrees.length, truncated } },
});
export const worktreeComAgentes = (path, agentes) => ({ workspaceKind: 'git', path, isArchived: false, status: 'working', agents: agentes });
/** Um agente do Orca: `cru` é o id da sessão sem o prefixo `orca_session_id:` (vai na paneKey); `state`: working, done… */
export const agenteDoOrca = (cru, state, extra = {}) => ({
  paneKey: `structured-agent-session-${cru}:af1bbe52-8eb9-457f-a5c3-8db0ec5559fe`, parentPaneKey: null, state, agentType: 'claude',
  mainAgent: { state, stateStartedAt: Date.now() }, stateStartedAt: Date.now(), ...extra,
});
