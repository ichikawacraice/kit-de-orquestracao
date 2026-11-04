// F373: `esperar-fundo` segura o turno da dona até os subagentes desta sessão terminarem (o `"finished":true` do
// `agent-*.meta.json` que o Claude Code grava) ou até os arquivos dados existirem, com teto de tempo. Pastas temporárias.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(AQUI, '..', '..', 'pool', 'esperar-fundo.mjs');
const BIN = join(AQUI, '..', '..', 'bin', 'esperar-fundo');
const SESSAO = '11111111-2222-3333-4444-555555555555';

function pasta(t) {
  const base = mkdtempSync(join(tmpdir(), 'esperar-fundo-'));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const sub = join(base, 'projects', '-proj', SESSAO, 'subagents');
  mkdirSync(sub, { recursive: true });
  return { base, sub };
}
const agente = (sub, id, meta, idadeS = 0) => {
  writeFileSync(join(sub, `agent-${id}.meta.json`), JSON.stringify({ agentType: 'orquestracao:validador', description: `rev ${id}`, ...meta }));
  writeFileSync(join(sub, `agent-${id}.jsonl`), '{}\n');
  if (idadeS) { const t = (Date.now() - idadeS * 1000) / 1000; utimesSync(join(sub, `agent-${id}.jsonl`), t, t); }
};
function rodar(base, args = [], cmd = SCRIPT) {
  const ini = Date.now();
  const r = spawnSync(cmd === BIN ? cmd : 'node', cmd === BIN ? args : [cmd, ...args], {
    encoding: 'utf8', timeout: 20000, killSignal: 'SIGKILL',
    env: { ...process.env, KIT_PROJECTS_DIR: join(base, 'projects'), CLAUDE_CODE_SESSION_ID: SESSAO, KIT_ESPERA_PASSO_MS: '100' },
  });
  return { ...r, ms: Date.now() - ini };
}

test('subagente ainda rodando: espera até o teto e sai 3 dizendo o que roda', (t) => {
  const { base, sub } = pasta(t);
  agente(sub, 'a1', {});
  const r = rodar(base, ['--max', '1']);
  assert.equal(r.status, 3, r.stdout + r.stderr);
  assert.match(r.stdout, /ainda roda.*rev a1/s);
  assert.ok(r.ms >= 900, `voltou cedo demais: ${r.ms} ms`);
});

test('subagente que termina no meio da espera: sai 0 logo depois', (t) => {
  const { base, sub } = pasta(t);
  agente(sub, 'a1', {});
  const r = spawnSync('node', ['-e', `
    const { spawn } = require('node:child_process');
    const fs = require('node:fs');
    const p = spawn('node', [${JSON.stringify(SCRIPT)}, '--max', '10'], { env: { ...process.env, KIT_PROJECTS_DIR: ${JSON.stringify(join(base, 'projects'))}, CLAUDE_CODE_SESSION_ID: '${SESSAO}', KIT_ESPERA_PASSO_MS: '100' } });
    let out = ''; p.stdout.on('data', (d) => out += d);
    setTimeout(() => { const f = ${JSON.stringify(join(sub, 'agent-a1.meta.json'))}; fs.writeFileSync(f, JSON.stringify({ description: 'rev a1', finished: true })); }, 500);
    p.on('exit', (c) => { process.stdout.write(out + '\\nexit=' + c); });
  `], { encoding: 'utf8', timeout: 20000, killSignal: 'SIGKILL' });
  assert.match(r.stdout, /exit=0/, r.stdout + r.stderr);
  assert.match(r.stdout, /terminou/);
});

test('nada rodando: sai 0 na hora; subagente parado há muito (transcript sem escrita) não conta como rodando', (t) => {
  const { base, sub } = pasta(t);
  agente(sub, 'velho', {}, 3600);
  agente(sub, 'feito', { finished: true });
  const r = rodar(base, ['--max', '5']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(r.ms < 3000, `demorou ${r.ms} ms`);
});

test('--arquivo: espera o arquivo existir (o marcador que o comando em segundo plano grava ao acabar)', (t) => {
  const { base } = pasta(t);
  const marca = join(base, 'testes.exit');
  const r = rodar(base, ['--arquivo', marca, '--max', '1']);
  assert.equal(r.status, 3);
  assert.match(r.stdout, /testes\.exit/);
  writeFileSync(marca, '0\n');
  assert.equal(rodar(base, ['--arquivo', marca, '--max', '1']).status, 0);
});

test('sem o id da sessão no ambiente e sem --arquivo: erro claro, sai 2', (t) => {
  const { base } = pasta(t);
  const r = spawnSync('node', [SCRIPT], { encoding: 'utf8', timeout: 10000, killSignal: 'SIGKILL', env: { ...process.env, CLAUDE_CODE_SESSION_ID: '', KIT_PROJECTS_DIR: join(base, 'projects') } });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /CLAUDE_CODE_SESSION_ID/);
});

test('o bin do plugin chama o script', (t) => {
  const { base } = pasta(t);
  const r = rodar(base, ['--max', '1'], BIN);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
