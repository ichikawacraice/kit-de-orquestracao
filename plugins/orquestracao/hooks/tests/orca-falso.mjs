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
// paginas.json é um mapa cursor → resposta, ou uma lista de mapas: a N-ª chamada sem cursor (e as páginas dela) usa o N-º
const todas = JSON.parse(fs.readFileSync(d + '/paginas.json', 'utf8'));
const n = fs.readFileSync(d + '/chamadas.jsonl', 'utf8').trim().split('\\n').filter((l) => !JSON.parse(l).argv.includes('--cursor')).length;
const paginas = Array.isArray(todas) ? todas[Math.min(n, todas.length) - 1] : todas;
const i = process.argv.indexOf('--cursor');
const r = paginas[i >= 0 ? process.argv[i + 1] : ''];
if (!r) { process.stderr.write('cursor desconhecido'); process.exitCode = 3; }
else { process.stdout.write(typeof r.stdout === 'string' ? r.stdout : JSON.stringify(r.stdout)); process.exitCode = r.exit || 0; }
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
