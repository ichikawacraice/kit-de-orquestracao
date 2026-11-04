// F373: o hook PreToolUse `modelo-do-validador.mjs` põe `model: "sonnet"` no `orquestracao:validador` lançado sem `model`
// quando o diff da branch não toca contrato nem trava (o corte da via rápida); com risco, ou com `model` dado, não mexe.
// Repositório git temporário e log em pasta temporária: nada toca o ~/.claude real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOK = join(dirname(fileURLToPath(import.meta.url)), '..', 'modelo-do-validador.mjs');
const GIT_ENV = { GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
function git(cwd, ...args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 30000, killSignal: 'SIGKILL', env: { ...process.env, ...GIT_ENV } });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
}
function gravar(raiz, arquivos) {
  for (const [f, t] of Object.entries(arquivos)) { mkdirSync(dirname(join(raiz, f)), { recursive: true }); writeFileSync(join(raiz, f), t); }
}
function repo(t) {
  const base = mkdtempSync(join(tmpdir(), 'modelo-validador-'));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const raiz = join(base, 'r'); mkdirSync(raiz); mkdirSync(join(base, 'orq'));
  git(raiz, 'init', '-q', '-b', 'main');
  gravar(raiz, { 'src/a.mjs': 'a\n' });
  git(raiz, 'add', '-A'); git(raiz, 'commit', '-qm', 'base'); git(raiz, 'switch', '-qc', 'item');
  return { base, raiz };
}
function rodar({ base, raiz }, toolInput, tool = 'Agent') {
  const r = spawnSync('node', [HOOK], {
    input: JSON.stringify({ session_id: 'cli-x', hook_event_name: 'PreToolUse', tool_name: tool, tool_input: toolInput, cwd: raiz }),
    encoding: 'utf8', timeout: 15000, killSignal: 'SIGKILL', cwd: raiz,
    env: { ...process.env, ...GIT_ENV, HOME: join(base, 'home'), HOOKS_CREWAI_BASE: join(base, 'orq'), KIT_BASE: 'main' },
  });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim() ? JSON.parse(r.stdout) : null;
}
const log = ({ base }) => { const p = join(base, 'orq', 'hooks-crewai.log'); return existsSync(p) ? readFileSync(p, 'utf8') : ''; };
const PEDIDO = { subagent_type: 'orquestracao:validador', description: 'revisão', prompt: 'revise o diff' };

test('diff sem contrato nem trava: troca para Sonnet, mantendo o resto do pedido, e registra', (t) => {
  const r = repo(t);
  gravar(r.raiz, { 'src/a.mjs': 'a\nb\n', 'src/b.mjs': 'novo\n' });
  const out = rodar(r, PEDIDO);
  assert.ok(out?.hookSpecificOutput, `esperava saída, veio ${JSON.stringify(out)}`);
  const h = out.hookSpecificOutput;
  assert.equal(h.hookEventName, 'PreToolUse');
  assert.equal(h.permissionDecision, 'allow');
  assert.deepEqual(h.updatedInput, { ...PEDIDO, model: 'sonnet' });
  assert.match(h.permissionDecisionReason, /Sonnet/);
  assert.match(log(r), /\tmodelo-do-validador\tsonnet\t/);
});

test('diff que toca trava (hooks/) ou ADR: não mexe (fica o Opus do agente) e registra o motivo', (t) => {
  const r = repo(t);
  gravar(r.raiz, { 'plugins/p/hooks/trava.mjs': 'x\n' });
  assert.equal(rodar(r, PEDIDO), null);
  assert.match(log(r), /\tmodelo-do-validador\topus\t.*plugins\/p\/hooks\/trava\.mjs/);
});

test('model dado pela dona vale: não mexe, nem para baixo nem para cima', (t) => {
  const r = repo(t);
  gravar(r.raiz, { 'src/a.mjs': 'a\nb\n' });
  assert.equal(rodar(r, { ...PEDIDO, model: 'opus' }), null);
  gravar(r.raiz, { 'plugins/p/hooks/trava.mjs': 'x\n' });
  assert.equal(rodar(r, { ...PEDIDO, model: 'sonnet' }), null);
  assert.match(log(r), /\tmodelo-do-validador\tescolhido\topus/);
});

test('outro subagente, ou outra ferramenta, passa sem tocar', (t) => {
  const r = repo(t);
  gravar(r.raiz, { 'src/a.mjs': 'a\nb\n' });
  assert.equal(rodar(r, { ...PEDIDO, subagent_type: 'orquestracao:explorador' }), null);
  assert.equal(rodar(r, PEDIDO, 'Bash'), null);
  assert.equal(log(r), '');
});

test('fora de repositório git (ou sem base): não mexe, fica o padrão do agente', (t) => {
  const base = mkdtempSync(join(tmpdir(), 'modelo-validador-sem-git-'));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const raiz = join(base, 'r'); mkdirSync(raiz); mkdirSync(join(base, 'orq'));
  assert.equal(rodar({ base, raiz }, PEDIDO), null);
});
