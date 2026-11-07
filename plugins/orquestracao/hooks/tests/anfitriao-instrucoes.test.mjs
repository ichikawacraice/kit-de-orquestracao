// F443 (ADR 0030, fatia 3): nenhuma instrução impossível. O resumo do início muda pelo anfitrião; toda ferramenta do app citada no
// kit tem linha na tabela de pool/anfitriao-orca.md; todo comando de exemplo da tabela passa pela trava do orca.
// Rodar: node gate/com-fichas.mjs -- node --test plugins/orquestracao/hooks/tests/anfitriao-instrucoes.test.mjs
// HOME, PAINEL_DIR e HOOKS_CREWAI_BASE apontam para diretório temporário; os sinais do anfitrião de quem roda são apagados.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decidir } from '../trava-do-orca.mjs';
import { filtrarPorAnfitriao } from '../regras-do-inicio.mjs';

const HOOKS = join(dirname(fileURLToPath(import.meta.url)), '..');
const PLUGIN = join(HOOKS, '..');
const TABELA = join(PLUGIN, 'pool', 'anfitriao-orca.md');
const SEM_SINAIS = { CLAUDE_CODE_HOST_SESSION_ID: '', ORCA_AGENT_SESSION_ID: '', ORCA_STRUCTURED_SESSION: '', KIT_ANFITRIAO: '' };

function inicio(sinais) {
  const dir = mkdtempSync(join(tmpdir(), 'anfitriao-instr-'));
  try {
    const proj = join(dir, 'proj'); mkdirSync(join(proj, '.git'), { recursive: true });
    const out = execFileSync(process.execPath, [join(HOOKS, 'sessao-inicio.mjs')], {
      input: JSON.stringify({ session_id: 's1', hook_event_name: 'SessionStart', source: 'startup', cwd: proj }), encoding: 'utf8', timeout: 15000, killSignal: 'SIGKILL',
      env: { ...process.env, HOME: dir, PAINEL_DIR: dir, HOOKS_CREWAI_BASE: dir, ...SEM_SINAIS, ...sinais },
    });
    return JSON.parse(out).hookSpecificOutput.additionalContext;
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

const DESKTOP = { CLAUDE_CODE_HOST_SESSION_ID: 'local_11111111-2222-3333-4444-555555555555' };
const ORCA = { ORCA_AGENT_SESSION_ID: 'e953a7bc-918d-43c5-ba93-34016337a5f0', ORCA_STRUCTURED_SESSION: '1' };

// ── o resumo do início ──────────────────────────────────────────────────────────────────────────────────────────────────

test('resumo no claude-desktop cita list_sessions (a presença que dá valor à ausência dos outros)', () => {
  const t = inicio(DESKTOP);
  assert.ok(t.length > 500, 'o resumo deveria vir inteiro');
  assert.match(t, /list_sessions/);
  assert.doesNotMatch(t, /worker_done/);
});

test('resumo no orca não cita list_sessions nem mcp__ccd_ e traz o worker_done', () => {
  const t = inicio(ORCA);
  assert.ok(t.length > 500, 'o resumo deveria vir inteiro');
  assert.doesNotMatch(t, /list_sessions|mcp__ccd_/);
  assert.match(t, /worker_done/);
  assert.match(t, /PR N pronto, HEAD <sha completo>/);
});

test('resumo no terminal não cita list_sessions, mcp__ccd_ nem worker_done', () => {
  const t = inicio({});
  assert.ok(t.length > 500, 'o resumo deveria vir inteiro');
  assert.doesNotMatch(t, /list_sessions|mcp__ccd_|worker_done/);
  assert.match(t, /Achar a orquestradora|orquestradora/);
});

test('nenhum marcador de variante chega à sessão, em nenhum anfitrião', () => {
  for (const s of [DESKTOP, ORCA, {}]) assert.doesNotMatch(inicio(s), /<!--|so:\s*(claude-desktop|orca|terminal)/);
});

test('filtrarPorAnfitriao: a linha marcada só vale nos anfitriões listados; a sem marca vale em todos', () => {
  const regras = ['- a', '- b <!-- so: orca -->', '- c <!-- so: claude-desktop, terminal -->'].join('\n');
  assert.equal(filtrarPorAnfitriao(regras, 'orca'), '- a\n- b');
  assert.equal(filtrarPorAnfitriao(regras, 'terminal'), '- a\n- c');
  assert.equal(filtrarPorAnfitriao(regras, 'claude-desktop'), '- a\n- c');
});

// ── doc × código: a tabela cobre toda ferramenta do app citada ─────────────────────────────────────────────────────────

const CURTOS = ['start_session', 'clear_session', 'get_session', 'list_sessions', 'detach_session', 'get_usage', 'hand_off_to_session', 'send_message', 'archive_session', 'set_session_title', 'sync_with_base_branch', 'list_events'];
const REGEX_FERRAMENTA = new RegExp(`mcp__ccd_[a-z_]+__([a-z_]+)|\\b(${CURTOS.join('|')})\\b`, 'g');

function arquivosDoPlugin(dir, achados = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (n === 'tests' || n === 'node_modules' || n === '.git') continue;
    if (statSync(p).isDirectory()) arquivosDoPlugin(p, achados);
    else if (/\.(md|mjs|json)$/.test(n)) achados.push(p);
  }
  return achados;
}

/** As ferramentas do app citadas em `arquivos` ([caminho, texto]) sem linha de tabela em `tabela`: [{ ferramenta, arquivo }]. */
function ferramentasSemLinha(arquivos, tabela) {
  const linhas = tabela.split('\n').filter((l) => l.startsWith('|'));
  const faltam = [];
  for (const [arq, texto] of arquivos) {
    for (const m of texto.matchAll(REGEX_FERRAMENTA)) {
      const nome = m[1] ?? m[2];
      if (!linhas.some((l) => new RegExp(`\\b${nome}\\b`).test(l))) faltam.push({ ferramenta: nome, arquivo: arq });
    }
  }
  return faltam;
}

test('doc × código: a verificação acha a ferramenta inventada citada num arquivo (prova antes da ausência)', () => {
  const tabela = '| App | Orca |\n|---|---|\n| `start_session` | `orca orchestration worker-start` |\n';
  const f = ferramentasSemLinha([['x.md', 'use mcp__ccd_session__inventada_x e start_session']], tabela);
  assert.deepEqual(f, [{ ferramenta: 'inventada_x', arquivo: 'x.md' }]);
  assert.deepEqual(ferramentasSemLinha([['x.md', 'só start_session']], tabela), []);
});

test('doc × código: toda ferramenta mcp__ccd_* (e nome curto) citada em plugins/orquestracao tem linha em pool/anfitriao-orca.md', () => {
  assert.ok(existsSync(TABELA), 'pool/anfitriao-orca.md não existe');
  const tabela = readFileSync(TABELA, 'utf8');
  const arquivos = arquivosDoPlugin(PLUGIN).filter((p) => p !== TABELA).map((p) => [relative(PLUGIN, p), readFileSync(p, 'utf8')]);
  assert.ok(arquivos.some(([, t]) => /start_session/.test(t)), 'a varredura não achou nem o start_session: o insumo está vazio');
  assert.deepEqual(ferramentasSemLinha(arquivos, tabela), []);
});

// O marcador `/caminho/da/worktree` dos exemplos vira uma worktree de verdade, fora da pasta de quem chama (F484: o retry da dona
// no limite leva `--worktree path:` sem `--terminal`, e um caminho que não existe conta como a pasta de quem chama).
const MARCADOR_DA_WORKTREE = '/caminho/da/worktree';
function pastasDoTeste(dir) {
  const repo = join(dir, 'repo'); mkdirSync(repo);
  execFileSync('git', ['-C', repo, 'init', '-q', '-b', 'principal'], { timeout: 15000, killSignal: 'SIGKILL' });
  const wt = join(dir, 'worktree-da-dona'); mkdirSync(wt);
  execFileSync('git', ['-C', wt, 'init', '-q', '-b', 'f123-tema'], { timeout: 15000, killSignal: 'SIGKILL' });
  return { repo, comWorktree: (c) => c.replaceAll(MARCADOR_DA_WORKTREE, wt) };
}

// ── doc × trava: todo comando de exemplo da tabela passa ───────────────────────────────────────────────────────────────

test('doc × trava: todo comando `orca …` de exemplo da tabela passa pela trava do orca', () => {
  assert.ok(existsSync(TABELA), 'pool/anfitriao-orca.md não existe');
  const comandos = [...readFileSync(TABELA, 'utf8').matchAll(/`(orca [^`\n]+)`/g)].map((m) => m[1]);
  assert.ok(comandos.length >= 8, `a tabela traz poucos comandos de exemplo (${comandos.length})`);
  assert.ok(comandos.some((c) => /worker-start --agent claude/.test(c)), 'a tabela não traz o worker-start da dona');
  const dir = mkdtempSync(join(tmpdir(), 'anfitriao-trava-'));
  try {
    const { repo, comWorktree } = pastasDoTeste(dir);
    for (const c of comandos) {
      const r = decidir(comWorktree(c), { cwd: repo, env: { HOME: dir } });
      assert.equal(r.recusa, null, `a trava recusa o exemplo da tabela: ${c}\nmotivo: ${r.recusa}`);
    }
    // a trava enxerga os exemplos: o mesmo worker-start sem --model é recusado
    assert.ok(decidir('orca orchestration worker-start --agent claude --effort medium --worktree new-child --spec "x"', { cwd: repo, env: { HOME: dir } }).recusa);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// F447: a seção "No Orca" da skill da orquestradora (e a referência) também dá comandos `orca …` de exemplo
const SKILL_ORQ = join(PLUGIN, 'skills', 'orquestradora', 'SKILL.md');
test('doc × trava: todo comando `orca …` da seção "No Orca" da skill orquestradora passa pela trava do orca', () => {
  const texto = readFileSync(SKILL_ORQ, 'utf8');
  const i = texto.indexOf('<a id="no-orca"></a>');
  assert.ok(i >= 0, 'a skill não tem a âncora no-orca');
  const secao = texto.slice(i, texto.indexOf('\n<a id=', i + 1));
  const comandos = [...secao.matchAll(/`(orca [^`\n]+)`/g)].map((m) => m[1]);
  for (const sub of ['worker-start --agent claude', 'worker-start --terminal', 'send --from', 'worker-release', 'worktree set', 'worktree rm', 'worker-list', 'worker-keep-open', 'worker-read', 'worker-stop', 'worker-start --task']) {
    assert.ok(comandos.some((c) => c.includes(sub)), `a seção não traz o exemplo de ${sub}`);
  }
  const dir = mkdtempSync(join(tmpdir(), 'anfitriao-no-orca-'));
  try {
    const { repo, comWorktree } = pastasDoTeste(dir);
    // prova: sem a troca do marcador, o retry da dona no limite cairia na pasta de quem chama e a trava o recusaria
    const retry = comandos.find((c) => c.includes('--retry-of'));
    assert.ok(retry && decidir(retry, { cwd: repo, env: { HOME: dir } }).recusa, 'o retry sem a worktree de verdade deveria ser recusado');
    for (const c of comandos) {
      const r = decidir(comWorktree(c), { cwd: repo, env: { HOME: dir } });
      assert.equal(r.recusa, null, `a trava recusa o exemplo da skill: ${c}\nmotivo: ${r.recusa}`);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a tabela tem uma linha por ferramenta do app listada no ADR 0030 (item 2)', () => {
  assert.ok(existsSync(TABELA), 'pool/anfitriao-orca.md não existe');
  const tabela = readFileSync(TABELA, 'utf8');
  for (const f of ['start_session', 'hand_off_to_session', 'get_session', 'list_sessions', 'detach_session', 'get_usage', 'send_message', 'clear_session', 'archive_session', 'set_session_title', 'sync_with_base_branch']) {
    assert.ok(tabela.split('\n').some((l) => l.startsWith('|') && l.includes(f)), `sem linha para ${f}`);
  }
});
