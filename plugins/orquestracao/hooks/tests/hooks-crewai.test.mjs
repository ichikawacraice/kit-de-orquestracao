#!/usr/bin/env node
// Testes das travas da CrewAI (Q62): eventos JSON no formato do Claude Code 2.1.289,
// transcripts sintéticos no formato real (.jsonl), log e estado num diretório temporário.
// Rodar: node ~/.claude/hooks/tests/hooks-crewai.test.mjs   (HOOKS_DIR troca a pasta dos hooks)
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOKS = process.env.HOOKS_DIR || join(dirname(fileURLToPath(import.meta.url)), '..');
let base;
let falhas = 0;

function novoBase() {
  base = mkdtempSync(join(tmpdir(), 'hooks-crewai-'));
  mkdirSync(join(base, 'ativas'));
}
function rodar(hook, evento, extraEnv = {}) {
  const entrada = typeof evento === 'string' ? evento : JSON.stringify(evento);
  const out = execFileSync('node', [join(HOOKS, hook)], {
    input: entrada, encoding: 'utf8', env: { ...process.env, HOOKS_CREWAI_BASE: base, ...extraEnv },
    timeout: 10000, killSignal: 'SIGKILL',
  });
  return out ? JSON.parse(out) : null;
}
function log() {
  const f = join(base, 'hooks-crewai.log');
  return existsSync(f) ? readFileSync(f, 'utf8').trim().split('\n').map((l) => l.split('\t')) : [];
}
function caso(nome, fn) {
  novoBase();
  try { fn(); console.log(`ok   ${nome}`); } catch (e) { falhas++; console.log(`FAIL ${nome}\n     ${e.message}`); }
  rmSync(base, { recursive: true, force: true });
}
function igual(a, b, msg) { if (a !== b) throw new Error(`${msg}: esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`); }

// ---------- ideia 1: orquestradora não edita ----------
const SID = '6a6d90b1-2fe5-4255-a082-ecb2a2ebf520';
const REPO = join(homedir(), 'Developer/Projects/Izanagi');
const pre = (tool, input, extra = {}) => ({
  session_id: SID, transcript_path: '/x.jsonl', cwd: REPO, permission_mode: 'bypassPermissions',
  hook_event_name: 'PreToolUse', tool_name: tool, tool_input: input, tool_use_id: 'toolu_1', ...extra,
});
const marcar = () => writeFileSync(join(base, 'ativas', SID), `${REPO}/.git\n`);
const decisao = (r) => r?.hookSpecificOutput?.permissionDecision ?? null;

caso('1.1 sem marcador: Edit no produto passa calado', () => {
  igual(rodar('orquestradora-nao-edita.mjs', pre('Edit', { file_path: `${REPO}/apps/web/a.ts`, old_string: 'a', new_string: 'b' })), null, 'saída');
});
caso('1.2 orquestradora: Edit no produto pergunta (ask)', () => {
  marcar();
  const r = rodar('orquestradora-nao-edita.mjs', pre('Edit', { file_path: `${REPO}/apps/web/a.ts`, old_string: 'a', new_string: 'b' }));
  igual(decisao(r), 'ask', 'decisão');
  igual(r.hookSpecificOutput.hookEventName, 'PreToolUse', 'evento');
  igual(log()[0][3], 'perguntou', 'log');
});
caso('1.3 orquestradora: Write com caminho relativo resolve pelo cwd e pergunta', () => {
  marcar();
  igual(decisao(rodar('orquestradora-nao-edita.mjs', pre('Write', { file_path: 'docs/specs/SPEC-999.md', content: 'x' }))), 'ask', 'decisão');
  if (!log()[0][4].includes(`${REPO}/docs/specs/SPEC-999.md`)) throw new Error('log sem o caminho absoluto');
});
caso('1.4 orquestradora: subagente dela (agent_id) também pergunta', () => {
  marcar();
  const r = rodar('orquestradora-nao-edita.mjs', pre('Edit', { file_path: `${REPO}/packages/runner/src/x.ts`, old_string: 'a', new_string: 'b' }, { agent_id: 'a123', agent_type: 'general-purpose' }));
  igual(decisao(r), 'ask', 'decisão');
  if (!log()[0][4].startsWith('subagente general-purpose')) throw new Error('log não diz que foi subagente');
});
caso('1.5 orquestradora: NotebookEdit pergunta', () => {
  marcar();
  igual(decisao(rodar('orquestradora-nao-edita.mjs', pre('NotebookEdit', { notebook_path: `${REPO}/n.ipynb`, new_source: 'x' }))), 'ask', 'decisão');
});
for (const [nome, p] of [
  ['estado da orquestração', () => join(base, 'izanagi.md')],
  ['notas de release', () => `${REPO}/docs/releases/2026-10-23-1.md`],
  ['notas de release em worktree', () => join(homedir(), 'Developer/Projects/Izanagi-wt-rel/docs/releases/2026-10-23-2.md')],
  ['memória', () => join(homedir(), '.claude/projects/-Users-x-Izanagi/memory/a.md')],
  ['scratchpad', () => '/private/tmp/claude-501/proj/sessao/scratchpad/a.md'],
  ['notas entre sessões', () => join(homedir(), 'Library/Application Support/Claude/side-session-notes/local_x/n.md')],
]) {
  caso(`1.6 orquestradora: ${nome} passa calado`, () => {
    marcar();
    igual(rodar('orquestradora-nao-edita.mjs', pre('Write', { file_path: p(), content: 'x' })), null, 'saída');
    igual(log().length, 0, 'linhas de log');
  });
}
caso('1.7 orquestradora: Bash não é coberto (nem pergunta, nem registra)', () => {
  marcar();
  igual(rodar('orquestradora-nao-edita.mjs', pre('Bash', { command: "sed -i '' 's/a/b/' apps/web/a.ts" })), null, 'saída');
  igual(log().length, 0, 'linhas de log');
});
caso('1.8 só nos repositórios listados: repo fora da lista passa calado, repo da lista pergunta', () => {
  marcar();
  const ev = pre('Edit', { file_path: `${REPO}/apps/web/a.ts`, old_string: 'a', new_string: 'b' });
  writeFileSync(join(base, 'trava-edicao-repos.txt'), '/Users/x/Developer/Projects/battlewand/.git\n');
  igual(rodar('orquestradora-nao-edita.mjs', ev), null, 'fora da lista');
  writeFileSync(join(base, 'trava-edicao-repos.txt'), `/Users/x/outro/.git\n${REPO}/.git\n`);
  igual(decisao(rodar('orquestradora-nao-edita.mjs', ev)), 'ask', 'na lista');
});
caso('1.8c marcador sem repo (vazio ou null) resolve pelo cwd; sem repo no cwd, pergunta', () => {
  const ev = (cwd) => pre('Edit', { file_path: '/opt/produto/a.ts', old_string: 'a', new_string: 'b' }, { cwd });
  const outro = join(base, 'outro-repo');
  mkdirSync(outro);
  execFileSync('git', ['init', '-q', outro], { timeout: 10000, killSignal: 'SIGKILL' });
  writeFileSync(join(base, 'trava-edicao-repos.txt'), `${REPO}/.git\n`);
  for (const conteudo of ['', 'null\n']) {
    writeFileSync(join(base, 'ativas', SID), conteudo);
    igual(decisao(rodar('orquestradora-nao-edita.mjs', ev(REPO))), 'ask', `repo da lista pelo cwd (${JSON.stringify(conteudo)})`);
    igual(rodar('orquestradora-nao-edita.mjs', ev(outro)), null, `repo fora da lista pelo cwd (${JSON.stringify(conteudo)})`);
    igual(decisao(rodar('orquestradora-nao-edita.mjs', ev('/'))), 'ask', `cwd sem repo (${JSON.stringify(conteudo)})`);
  }
});
caso('1.8b toda a ~/.claude é da orquestração (CLAUDE.md global, registro de uso, hooks)', () => {
  marcar();
  for (const p of ['.claude/CLAUDE.md', '.claude/uso-do-claude/registro.md', '.claude/hooks/x.mjs', '.claude/skills/outra/SKILL.md']) {
    igual(rodar('orquestradora-nao-edita.mjs', pre('Edit', { file_path: join(homedir(), p), old_string: 'a', new_string: 'b' })), null, p);
  }
  igual(log().length, 0, 'log');
});
caso('1.9 entrada quebrada: sai 0, sem saída, erro no log', () => {
  igual(rodar('orquestradora-nao-edita.mjs', '{nao json'), null, 'saída');
  igual(log()[0][3], 'erro', 'log');
});

// ---------- ideia 2: executor só termina com a saída real ----------
let n = 0;
const id = () => `u${++n}`;
const abertura = (texto, extra = {}) => ({ type: 'user', uuid: id(), message: { role: 'user', content: texto }, ...extra });
const usa = (nome, input, tid) => ({ type: 'assistant', uuid: id(), message: { role: 'assistant', content: [{ type: 'tool_use', id: tid, name: nome, input }] } });
const resultado = (tid, texto) => ({ type: 'user', uuid: id(), message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: tid, content: texto }] } });
const fala = (texto) => ({ type: 'assistant', uuid: id(), message: { role: 'assistant', content: [{ type: 'text', text: texto }] } });
const SAIDA_VITEST = ' Test Files  4 passed (4)\n      Tests  98 passed (98)\n   Duration  12.31s';
function transcript(entradas, titulo) {
  const f = join(base, `t${++n}.jsonl`);
  const linhas = entradas.map((e) => JSON.stringify(e));
  if (titulo) linhas.push(JSON.stringify({ type: 'custom-title', customTitle: titulo, sessionId: SID }));
  writeFileSync(f, linhas.join('\n') + '\n');
  return f;
}
const trabalho = (bashSaida = SAIDA_VITEST) => [
  abertura('Plano: edite a.ts; critério: vitest run a.test.ts'),
  usa('Edit', { file_path: '/r/a.ts', old_string: 'a', new_string: 'b' }, 't1'),
  resultado('t1', 'ok'),
  usa('Bash', { command: 'npx vitest run a.test.ts; echo exit=$?' }, 't2'),
  resultado('t2', bashSaida + '\nexit=0'),
];
const subStop = (f, relatorio, extra = {}) => ({
  session_id: SID, transcript_path: '/pai.jsonl', cwd: '/r', hook_event_name: 'SubagentStop', stop_hook_active: false,
  agent_id: 'a77', agent_type: 'executor', agent_transcript_path: f, last_assistant_message: relatorio, background_tasks: [], ...extra,
});
const bloqueou = (r) => r?.decision === 'block';

caso('2.1 executor subagente: relatório sem saída é cobrado', () => {
  const f = transcript(trabalho());
  const r = rodar('executor-criterio.mjs', subStop(f, 'Pronto, editei a.ts e os testes passaram.'));
  if (!bloqueou(r)) throw new Error('não cobrou');
  if (!r.reason.includes('cobrança 1 de 2')) throw new Error(`motivo: ${r.reason}`);
  igual(log()[0][3], 'cobrou-1', 'log');
});
caso('2.2 no máximo 2 cobranças; a terceira deixa passar e registra', () => {
  const f = transcript(trabalho());
  const ev = subStop(f, 'Pronto, testes passaram.');
  if (!bloqueou(rodar('executor-criterio.mjs', ev))) throw new Error('1ª não cobrou');
  if (!bloqueou(rodar('executor-criterio.mjs', { ...ev, stop_hook_active: true }))) throw new Error('2ª não cobrou');
  igual(rodar('executor-criterio.mjs', { ...ev, stop_hook_active: true }), null, '3ª');
  igual(log().map((l) => l[3]).join(','), 'cobrou-1,cobrou-2,deixou-passar-apos-2', 'log');
});
caso('2.3 saída colada em bloco de código (igual à do Bash) passa', () => {
  const f = transcript(trabalho());
  igual(rodar('executor-criterio.mjs', subStop(f, 'Feito.\n```\n      Tests  98 passed (98)\n```')), null, 'saída');
  igual(log()[0][3], 'passou-com-saida', 'log');
});
caso('2.3b critério que não é teste (grep): a linha colada igual à saída passa', () => {
  const f = transcript(trabalho('apps/web/src/a.ts:12:export const ROTULO = "Publicar"'));
  igual(rodar('executor-criterio.mjs', subStop(f, 'Critério do plano:\n```\napps/web/src/a.ts:12:export const ROTULO = "Publicar"\n```')), null, 'saída');
  igual(log()[0][3], 'passou-com-saida', 'log');
});
caso('2.4 bloco de código inventado (não está na saída do Bash) é cobrado', () => {
  const f = transcript(trabalho());
  if (!bloqueou(rodar('executor-criterio.mjs', subStop(f, 'Feito.\n```\n      Tests  120 passed (120)\n```')))) throw new Error('não cobrou');
});
caso('2.5 status exit=0 com Bash rodado passa; sem Bash no turno é cobrado', () => {
  igual(rodar('executor-criterio.mjs', subStop(transcript(trabalho()), 'Gate: exit=0')), null, 'com Bash');
  const semBash = transcript([abertura('Plano'), usa('Edit', { file_path: '/r/a.ts' }, 't1'), resultado('t1', 'ok')]);
  if (!bloqueou(rodar('executor-criterio.mjs', subStop(semBash, 'Gate: exit=0', { agent_id: 'a78' })))) throw new Error('sem Bash não cobrou');
});
caso('2.6 paráfrase em PT com número que confere passa; número que não confere é cobrado', () => {
  igual(rodar('executor-criterio.mjs', subStop(transcript(trabalho()), '4 arquivos, 98 testes verdes.')), null, 'confere');
  if (!bloqueou(rodar('executor-criterio.mjs', subStop(transcript(trabalho()), '4 arquivos, 99 testes verdes.', { agent_id: 'a79' })))) throw new Error('não conferiu e passou');
});
caso('2.7 executor que devolve dúvida não é cobrado', () => {
  igual(rodar('executor-criterio.mjs', subStop(transcript(trabalho()), 'Parei no passo 3: o arquivo b.ts não existe como o plano descreve. Sigo com c.ts?')), null, 'pergunta');
  igual(rodar('executor-criterio.mjs', subStop(transcript(trabalho()), 'Devolvo: o plano não decide entre X e Y. Recomendo X.', { agent_id: 'a80' })), null, 'devolvo');
  igual(log().map((l) => l[3]).join(','), 'passou-duvida,passou-duvida', 'log');
});
caso('2.8 outro papel (validador) não é cobrado', () => {
  igual(rodar('executor-criterio.mjs', subStop(transcript(trabalho()), 'Achados: nenhum.', { agent_type: 'validador' })), null, 'saída');
  igual(log().length, 0, 'log');
});
caso('2.9 executor que não editou (conferência mecânica) não é cobrado', () => {
  const f = transcript([abertura('rode o gate'), usa('Bash', { command: 'pnpm test' }, 't2'), resultado('t2', 'ok')]);
  igual(rodar('executor-criterio.mjs', subStop(f, 'Gate rodado, verde.')), null, 'saída');
});
const stop = (f, extra = {}) => ({ session_id: SID, transcript_path: f, cwd: '/r', hook_event_name: 'Stop', stop_hook_active: false, background_tasks: [], ...extra });
caso('2.10 sessão "exec ·" no fio principal é cobrada; sessão de outro título não', () => {
  const ex = transcript([...trabalho(), fala('Pronto, tudo verde.')], 'exec · SPEC-150 rotas');
  if (!bloqueou(rodar('executor-criterio.mjs', stop(ex)))) throw new Error('exec não cobrado');
  const pl = transcript([...trabalho(), fala('Pronto, tudo verde.')], 'plano · SPEC-150');
  igual(rodar('executor-criterio.mjs', stop(pl)), null, 'plano');
});
caso('2.10b executora do pool (`E3 · …` no registro do app) é cobrada; `P3 · …` não', () => {
  const app = join(base, 'app'); mkdirSync(app);
  const reg = (sessionId, titulo) => writeFileSync(join(app, `local_${sessionId}.json`), JSON.stringify({ sessionId: `local_${sessionId}`, cliSessionId: sessionId, priorCliSessionIds: [], title: titulo, isArchived: false }));
  const E3 = 'cccccccc-0000-0000-0000-000000000003'; const P3 = 'cccccccc-0000-0000-0000-000000000099';
  reg(E3, 'E3 · histórico das etapas'); reg(P3, 'P3 · plano do editor');
  const f = transcript([...trabalho(), fala('Pronto, tudo verde.')]);
  if (!bloqueou(rodar('executor-criterio.mjs', stop(f, { session_id: E3 }), { POOL_APP_SESSOES_DIR: app }))) throw new Error('E3 não cobrada');
  igual(rodar('executor-criterio.mjs', stop(f, { session_id: P3 }), { POOL_APP_SESSOES_DIR: app }), null, 'P3');
});
caso('2.11 sessão --agent executor (agent_type sem agent_id) é cobrada', () => {
  const f = transcript([...trabalho(), fala('Pronto.')]);
  if (!bloqueou(rodar('executor-criterio.mjs', stop(f, { agent_type: 'executor' })))) throw new Error('não cobrou');
});
caso('2.12 Stop vindo de dentro de subagente (agent_id) é ignorado', () => {
  const f = transcript([...trabalho(), fala('Pronto.')], 'exec · x');
  igual(rodar('executor-criterio.mjs', stop(f, { agent_id: 'a1', agent_type: 'executor' })), null, 'saída');
});
caso('2.13 turno que para esperando background adia; o turno da notificação cobra', () => {
  const t1 = [...trabalho(), usa('Bash', { command: 'pnpm test', run_in_background: true }, 't9'), resultado('t9', 'Command running in background'), fala('Gate rodando; aviso quando terminar.')];
  const f1 = transcript(t1, 'exec · x');
  igual(rodar('executor-criterio.mjs', stop(f1, { background_tasks: [{ id: 'b1', status: 'running' }] })), null, 'turno 1');
  igual(log()[0][3], 'adiou-esperando-fundo', 'log 1');
  // Formato real (2.1.308): a notificação de Bash traz só o status, não a saída.
  const notif = abertura('<task-notification>\n<task-id>brdkei6q1</task-id>\n<tool-use-id>t9</tool-use-id>\n<output-file>/tmp/x/tasks/brdkei6q1.output</output-file>\n<status>completed</status>\n<summary>Background command "Run full gate" completed (exit code 0)</summary>\n</task-notification>', { origin: { kind: 'task-notification' } });
  const f2 = transcript([...t1, notif, fala('O gate terminou e passou.')], 'exec · x');
  if (!bloqueou(rodar('executor-criterio.mjs', stop(f2)))) throw new Error('turno da notificação não cobrou');
  const f3 = transcript([...t1, notif, fala('Gate completed (exit code 0).')], 'exec · x');
  igual(rodar('executor-criterio.mjs', stop(f3, { stop_hook_active: true })), null, 'com a saída da notificação');
  igual(log().map((l) => l[3]).join(','), 'adiou-esperando-fundo,cobrou-1,corrigiu-apos-cobranca', 'log');
});
caso('2.14 feedback do próprio Stop (isMeta) não abre turno novo', () => {
  const f = transcript([...trabalho(), fala('Pronto.'), { type: 'user', isMeta: true, uuid: id(), message: { role: 'user', content: 'Stop hook feedback:\nRelatório sem a saída' } }, fala('Pronto de novo.')], 'exec · x');
  if (!bloqueou(rodar('executor-criterio.mjs', stop(f, { stop_hook_active: true })))) throw new Error('perdeu o turno (não viu o Edit)');
});
caso('2.15 entrada quebrada: sai 0, sem saída, erro no log', () => {
  igual(rodar('executor-criterio.mjs', '{'), null, 'saída');
  igual(log()[0][3], 'erro', 'log');
});
// Casos da validação de 23/10 (eventos do 2.1.308, formatos de transcript reais).
caso('2.16 subagente em background: background_tasks traz o próprio agente e mesmo assim cobra', () => {
  const f = transcript(trabalho());
  const ev = subStop(f, 'Pronto, testes passaram.', { background_tasks: [{ id: 'a77', type: 'local_agent', status: 'running' }, { id: 'b1', type: 'local_bash', status: 'running' }] });
  if (!bloqueou(rodar('executor-criterio.mjs', ev))) throw new Error('adiou');
});
caso('2.17 edição por Bash conta como edição; Bash que só lê não conta', () => {
  for (const [i, cmd] of ["python3 - <<'EOF'\nopen('a.ts','w').write('x')\nEOF", "sed -i '' 's/a/b/' a.ts", 'cat >> b.md <<EOF\nx\nEOF', 'echo x | tee c.ts'].entries()) {
    const f = transcript([abertura('Plano'), usa('Bash', { command: cmd }, 't1'), resultado('t1', '')]);
    if (!bloqueou(rodar('executor-criterio.mjs', subStop(f, 'Feito.', { agent_id: `b${i}` })))) throw new Error(`não viu edição em: ${cmd}`);
  }
  for (const [i, cmd] of ['git status 2>&1 | head', 'node -e "[1].map((x)=>x)" > /dev/null', 'grep -n "a->b" x.ts']. entries()) {
    const f = transcript([abertura('Plano'), usa('Bash', { command: cmd }, 't1'), resultado('t1', '')]);
    igual(rodar('executor-criterio.mjs', subStop(f, 'Feito.', { agent_id: `c${i}` })), null, `leitura cobrada: ${cmd}`);
  }
});
caso('2.18 resumo de compactação não abre turno novo (a edição de antes vale)', () => {
  const compacta = { type: 'user', uuid: id(), isCompactSummary: true, message: { role: 'user', content: 'This session is being continued from a previous conversation…' } };
  const f = transcript([...trabalho(), compacta, fala('Pronto.')]);
  if (!bloqueou(rodar('executor-criterio.mjs', subStop(f, 'Pronto.')))) throw new Error('perdeu a edição de antes da compactação');
});
caso('2.19 status inventado (fora da saída real) é cobrado', () => {
  const f = transcript([abertura('Plano'), usa('Edit', { file_path: '/r/a.ts' }, 't1'), resultado('t1', 'ok'), usa('Bash', { command: 'git status' }, 't2'), resultado('t2', 'nothing to commit')]);
  if (!bloqueou(rodar('executor-criterio.mjs', subStop(f, 'Gate: exit=0')))) throw new Error('exit=0 de cabeça passou');
  if (!bloqueou(rodar('executor-criterio.mjs', subStop(f, 'test=0 typecheck=0', { agent_id: 'a81' })))) throw new Error('test=0 de cabeça passou');
});
caso('2.20 saída com falha e relatório que só cita os que passaram é cobrado', () => {
  const f = transcript(trabalho('      Tests  2 failed | 96 passed (98)'));
  if (!bloqueou(rodar('executor-criterio.mjs', subStop(f, 'Gate: 96 testes passaram.')))) throw new Error('escondeu a falha e passou');
  igual(rodar('executor-criterio.mjs', subStop(f, 'Gate: 2 falharam, 96 passaram.', { agent_id: 'a82' })), null, 'admitiu a falha');
  if (!bloqueou(rodar('executor-criterio.mjs', subStop(f, 'Gate: 96 testes passaram, nenhuma falha nova.', { agent_id: 'a85' })))) throw new Error('"nenhuma falha" escondeu as 2');
});
caso('2.21 "Q62" solto e "$?" dentro de bloco de código não são dúvida', () => {
  if (!bloqueou(rodar('executor-criterio.mjs', subStop(transcript(trabalho()), 'Implementei a Q62 conforme o plano.')))) throw new Error('Q62 virou dúvida');
  if (!bloqueou(rodar('executor-criterio.mjs', subStop(transcript(trabalho()), 'Rodei:\n```\npnpm test; echo exit=$?\n```', { agent_id: 'a83' })))) throw new Error('$? virou dúvida');
});
caso('2.22 saída lida do .output (Read) ou do Monitor conta como saída real', () => {
  const lido = transcript([abertura('Plano'), usa('Edit', { file_path: '/r/a.ts' }, 't1'), resultado('t1', 'ok'),
    usa('Read', { file_path: '/private/tmp/x/tasks/b1.output' }, 't2'), resultado('t2', SAIDA_VITEST)]);
  igual(rodar('executor-criterio.mjs', subStop(lido, 'Gate: 98 testes verdes.')), null, 'Read do .output');
  const mon = transcript([abertura('Plano'), usa('Edit', { file_path: '/r/a.ts' }, 't1'), resultado('t1', 'ok'),
    usa('Monitor', { command: 'tail -f g.log' }, 't3'), resultado('t3', 'EXIT=0')]);
  igual(rodar('executor-criterio.mjs', subStop(mon, 'Gate: EXIT=0', { agent_id: 'a84' })), null, 'Monitor');
});
caso('2.23 transcript que não existe: sai calado, sem erro no log', () => {
  igual(rodar('executor-criterio.mjs', subStop('/nao/existe.jsonl', 'Pronto.')), null, 'saída');
  igual(rodar('executor-criterio.mjs', stop('/nao/existe.jsonl')), null, 'Stop');
  igual(log().length, 0, 'log');
});
caso('2.24 só a ÚLTIMA saída com contagem conta: vermelho, conserto, verde passa', () => {
  const f = transcript([abertura('Plano'), usa('Edit', { file_path: '/r/a.ts' }, 't1'), resultado('t1', 'ok'),
    usa('Bash', { command: 'pnpm test' }, 't2'), resultado('t2', '      Tests  2 failed | 96 passed (98)'),
    usa('Edit', { file_path: '/r/a.ts' }, 't3'), resultado('t3', 'ok'),
    usa('Bash', { command: 'pnpm test' }, 't4'), resultado('t4', SAIDA_VITEST)]);
  igual(rodar('executor-criterio.mjs', subStop(f, 'Gate: 98 testes verdes.')), null, 'verde depois do conserto');
});
caso('2.24b saída completa do vitest ("Test Files  1 failed" antes de "Tests  2 failed"): relato honesto passa', () => {
  const f = transcript(trabalho(' FAIL  src/a.test.ts > soma\n Test Files  1 failed | 3 passed (4)\n      Tests  2 failed | 96 passed (98)\n   Duration  12.31s'));
  let i = 0;
  for (const rel of ['Gate: 2 testes falharam, 96 passaram.', 'Gate: falharam 2, os outros 96 passaram.',
    'Gate vermelho:\n```\n      Tests  2 failed | 96 passed (98)\n```', '1 arquivo e 2 testes falharam; 96 passaram.']) {
    igual(rodar('executor-criterio.mjs', subStop(f, rel, { agent_id: `h${i++}` })), null, `honesto cobrado: ${rel}`);
  }
  if (!bloqueou(rodar('executor-criterio.mjs', subStop(f, 'Gate: 96 testes passaram, nenhuma falha nova.', { agent_id: 'h9' })))) throw new Error('escondeu');
});
caso('2.24c o "exit=1" do relatório não conta como número de falhas', () => {
  const f = transcript(trabalho(' Test Files  1 failed | 3 passed (4)\n      Tests  2 failed | 96 passed (98)\nexit=1'));
  let i = 0;
  for (const rel of ['96 testes passaram, nenhuma falha nova (exit=1).', 'Gate: 96 passed, sem falhas, exit=1']) {
    if (!bloqueou(rodar('executor-criterio.mjs', subStop(f, rel, { agent_id: `x${i++}` })))) throw new Error(`escondeu com exit=1: ${rel}`);
  }
  igual(rodar('executor-criterio.mjs', subStop(f, 'exit=1: 2 testes falharam, 96 passaram.', { agent_id: 'x9' })), null, 'honesto com exit=1');
});
caso('2.24d relatório com milhares de linhas em branco termina rápido (sem backtracking)', () => {
  const ini = Date.now();
  rodar('executor-criterio.mjs', subStop(transcript(trabalho()), 'Pronto.' + '\n'.repeat(20000) + 'fim'));
  if (Date.now() - ini > 3000) throw new Error(`levou ${Date.now() - ini} ms`);
});
caso('2.25 "Bloqueado:" abrindo a linha é dúvida; título markdown com "?" não é', () => {
  igual(rodar('executor-criterio.mjs', subStop(transcript(trabalho()), 'Bloqueado: falta o token da loja.')), null, 'Bloqueado:');
  if (!bloqueou(rodar('executor-criterio.mjs', subStop(transcript(trabalho()), 'Pronto.\n\n## O que ficou de fora?\n\nNada.', { agent_id: 'a86' })))) throw new Error('título com ? virou dúvida');
  if (!bloqueou(rodar('executor-criterio.mjs', subStop(transcript(trabalho()), 'Bloqueado: nada.', { agent_id: 'a88' })))) throw new Error('"Bloqueado: nada." isentou');
});
caso('2.26 "exit=1" no relatório não casa com "exit=10" na saída', () => {
  const f = transcript(trabalho('rodou\nexit=10'));
  if (!bloqueou(rodar('executor-criterio.mjs', subStop(f, 'Critério: exit=1')))) throw new Error('exit=1 casou com exit=10');
  igual(rodar('executor-criterio.mjs', subStop(f, 'Critério: exit=10', { agent_id: 'a87' })), null, 'exit=10 confere');
});
caso('2.27 fio principal com background que nunca termina: no 3º turno adiado, cobra', () => {
  const f = transcript([...trabalho(), fala('Dev server no ar.')], 'exec · x');
  const ev = stop(f, { background_tasks: [{ id: 'b1', type: 'local_bash', status: 'running' }] });
  igual(rodar('executor-criterio.mjs', ev), null, '1º');
  igual(rodar('executor-criterio.mjs', ev), null, '2º');
  if (!bloqueou(rodar('executor-criterio.mjs', ev))) throw new Error('3º adiou de novo');
  igual(log().map((l) => l[3]).join(','), 'adiou-esperando-fundo,adiou-esperando-fundo,cobrou-1', 'log');
});

// ---------- Q66: laço de comandos parecidos ----------
const post = (tool, input, resp, extra = {}) => ({
  session_id: SID, transcript_path: '/x.jsonl', cwd: REPO, permission_mode: 'bypassPermissions',
  hook_event_name: 'PostToolUse', tool_name: tool, tool_input: input, tool_response: resp, tool_use_id: 'toolu_1', ...extra,
});
const bash = (cmd, stdout, extra) => post('Bash', { command: cmd }, { stdout, stderr: '', interrupted: false }, extra);
const VITEST = ' FAIL  src/a.test.ts > soma\nAssertionError: expected 3 to be 4\n Tests  1 failed | 41 passed (42)\n';
const avisos = (eventos) => eventos.map((ev) => rodar('laco-de-comandos.mjs', ev)?.hookSpecificOutput?.additionalContext ?? null);

caso('3.1 o mesmo comando 4× com a mesma saída avisa no 4º, só uma vez', () => {
  const r = avisos(Array.from({ length: 5 }, () => bash('pnpm --filter @izanagi/runner test', VITEST)));
  igual(r.map(Boolean).join(','), 'false,false,false,true,false', 'avisos');
  igual(log().map((l) => l[3]).join(','), 'avisou', 'log');
});
caso('3.2 comando quase igual (só o filtro muda) com saída quase igual também avisa', () => {
  const r = avisos([1, 2, 3, 4].map((n) => bash(`pnpm vitest run src/a.test.ts -t soma${n}`, VITEST.replace('41', String(40 + n)))));
  igual(r[3] !== null, true, '4º');
});
caso('3.3 leitura em pedaços (sed -n com faixas): comando parecido, saída diferente, não avisa', () => {
  const trechos = ['import { useState } from "react";\nexport function Quadro() {', 'const colunas = agrupar(solicitacoes, "estado");\nreturn colunas.map(', '<Cartao key={s.id} titulo={s.titulo} onMover={mover} />\n</Coluna>', 'async function mover(id: string, destino: Estado) {\n  await fetch(`/api/x/${id}`)'];
  const r = avisos(trechos.map((t, n) => bash(`sed -n ${n + 1}01,${n + 1}99p apps/web/src/app/solicitacoes/quadro.tsx`, t)));
  igual(r.filter(Boolean).length, 0, 'avisos');
  // Precondição: o comando passa sozinho do limiar — quem decide aqui é a saída.
  igual(avisos(trechos.map((_, n) => bash(`sed -n ${n + 1}01,${n + 1}99p apps/web/src/app/solicitacoes/quadro.tsx`, trechos[0]))).filter(Boolean).length, 1, 'com a mesma saída avisa');
});
caso('3.4 outra ferramenta no meio zera a sequência', () => {
  const ev = [bash('pnpm test', VITEST), bash('pnpm test', VITEST), bash('pnpm test', VITEST),
    post('Edit', { file_path: '/r/a.ts' }, { filePath: '/r/a.ts' }), bash('pnpm test', VITEST)];
  igual(avisos(ev).filter(Boolean).length, 0, 'avisos');
});
caso('3.5 saída vazia não conta como "mesma saída"', () => {
  igual(avisos(Array.from({ length: 4 }, () => bash('sleep 30', ''))).filter(Boolean).length, 0, 'avisos');
});
caso('3.6 a sequência é por agente: o principal e um subagente não se somam', () => {
  const ev = [bash('pnpm test', VITEST), bash('pnpm test', VITEST, { agent_id: 'a1', agent_type: 'executor' }),
    bash('pnpm test', VITEST), bash('pnpm test', VITEST, { agent_id: 'a1', agent_type: 'executor' })];
  igual(avisos(ev).filter(Boolean).length, 0, 'avisos');
});
caso('3.8 o teste vermelho repetido chega como PostToolUseFailure (error, sem tool_response) e avisa', () => {
  const falha = { session_id: SID, transcript_path: '/x.jsonl', cwd: REPO, hook_event_name: 'PostToolUseFailure', tool_name: 'Bash',
    tool_input: { command: 'pnpm --filter @izanagi/runner test' }, tool_use_id: 'toolu_1', error: `Exit code 1\n${VITEST}`, is_interrupt: false };
  const r = Array.from({ length: 4 }, () => rodar('laco-de-comandos.mjs', falha));
  igual(r.slice(0, 3).every((x) => x === null), true, '1º–3º');
  igual(r[3]?.hookSpecificOutput?.hookEventName, 'PostToolUseFailure', 'evento do aviso');
});
caso('3.9 resposta em string e saída só em stderr também são saída', () => {
  igual(avisos(Array.from({ length: 4 }, () => post('Bash', { command: 'make check' }, VITEST)))[3] !== null, true, 'string');
  novoBase();
  igual(avisos(Array.from({ length: 4 }, () => post('Bash', { command: 'make check' }, { stdout: '', stderr: VITEST })))[3] !== null, true, 'stderr');
});
caso('3.7 entrada quebrada: sai 0, sem saída, erro no log', () => {
  igual(rodar('laco-de-comandos.mjs', '{'), null, 'saída');
  igual(log()[0][3], 'erro', 'log');
});

// ---------- Q154: quem escreve é sessão ----------
const SN = 'subagente-nao-edita.mjs';
const sub = (tipo = 'executor') => ({ agent_id: 'a1b2c3', agent_type: tipo });
const editar = (file_path, extra = {}) => pre('Edit', { file_path, old_string: 'a', new_string: 'b' }, extra);

caso('4.1 sessão principal (sem agent_id) edita o produto: passa calado', () => {
  igual(rodar(SN, editar(`${REPO}/apps/web/a.ts`)), null, 'saída');
  igual(log().length, 0, 'log');
});
caso('4.2 sessão aberta com --agent executor (agent_type sem agent_id): passa', () => {
  igual(rodar(SN, editar(`${REPO}/apps/web/a.ts`, { agent_type: 'executor' })), null, 'saída');
});
caso('4.3 subagente Edit no produto: recusa (deny) e registra', () => {
  const r = rodar(SN, editar(`${REPO}/apps/web/a.ts`, sub()));
  igual(decisao(r), 'deny', 'decisão');
  igual(r.hookSpecificOutput.hookEventName, 'PreToolUse', 'evento');
  igual(r.hookSpecificOutput.permissionDecisionReason.includes(`${REPO}/apps/web/a.ts`), true, 'motivo cita o caminho');
  igual(log()[0][3], 'recusou', 'log');
  const m = r.hookSpecificOutput.permissionDecisionReason;
  igual(m.includes('despacha a uma executora E livre do pool'), true, 'B4: manda despachar a uma executora do pool');
  igual(/quem te lançou abre uma/.test(m), false, 'B4: não manda mais abrir sessão nova');
});
caso('4.4 subagente Write relativo, MultiEdit e NotebookEdit: recusa', () => {
  igual(decisao(rodar(SN, pre('Write', { file_path: 'docs/specs/SPEC-999.md', content: 'x' }, sub()))), 'deny', 'Write');
  igual(decisao(rodar(SN, pre('MultiEdit', { file_path: `${REPO}/a.ts`, edits: [] }, sub()))), 'deny', 'MultiEdit');
  igual(decisao(rodar(SN, pre('NotebookEdit', { notebook_path: `${REPO}/n.ipynb`, new_source: 'x' }, sub()))), 'deny', 'NotebookEdit');
});
caso('4.5 subagente nas pastas livres (~/.claude, ~/, scratchpad, /tmp, tmpdir): passa', () => {
  for (const p of [join(homedir(), '.claude/skills/x/SKILL.md'), '~/.claude/memoria.md',
    '/private/tmp/claude-501/proj/sess/scratchpad/a.md', '/tmp/a.txt', join(tmpdir(), 'b.txt'), join(base, 'estado.md')]) {
    igual(rodar(SN, editar(p, sub())), null, p);
  }
  igual(log().length, 0, 'log');
});
caso('4.6 o vizinho de ~/.claude não é livre (~/.claudeX, ~/Developer)', () => {
  igual(decisao(rodar(SN, editar(join(homedir(), '.claudeX/a.md'), sub()))), 'deny', '.claudeX');
  igual(decisao(rodar(SN, editar(join(homedir(), 'Developer/a.md'), sub()))), 'deny', 'Developer');
});
caso('4.7 tipo liberado na lista: exato e prefixo com *, comentário ignorado; o resto recusa', () => {
  writeFileSync(join(base, 'subagente-pode-escrever.txt'), '# papéis que gravam\ndesigner\nimpeccable:*  # plugin\n');
  igual(rodar(SN, editar(`${REPO}/docs/design/revisoes/a.md`, sub('designer'))), null, 'designer');
  igual(rodar(SN, editar(`${REPO}/apps/web/a.tsx`, sub('impeccable:impeccable-documenter'))), null, 'prefixo');
  igual(log()[0][3], 'liberado-por-tipo', 'log');
  igual(decisao(rodar(SN, editar(`${REPO}/a.ts`, sub('designerX')))), 'deny', 'designerX');
  igual(decisao(rodar(SN, editar(`${REPO}/a.ts`, sub('executor')))), 'deny', 'executor');
  igual(decisao(rodar(SN, editar(`${REPO}/a.ts`, { agent_id: 'a1' }))), 'deny', 'sem agent_type');
});
caso('4.8 sem lista de tipos: todo subagente recusa, inclusive o designer', () => {
  igual(existsSync(join(base, 'subagente-pode-escrever.txt')), false, 'precondição: sem lista');
  igual(decisao(rodar(SN, editar(`${REPO}/docs/design/revisoes/a.md`, sub('designer')))), 'deny', 'designer');
});
caso('4.9 Bash não é coberto; sem caminho passa; entrada quebrada sai 0 com erro no log', () => {
  igual(rodar(SN, pre('Bash', { command: 'echo x > a.ts' }, sub())), null, 'Bash');
  igual(rodar(SN, pre('Edit', {}, sub())), null, 'sem caminho');
  igual(rodar(SN, '{'), null, 'quebrada');
  igual(log()[0][3], 'erro', 'log');
});

// K2: o agent do plugin chega como `orquestracao:executor`; as travas que casam por nome aceitam as duas formas.
caso('K2 executor-criterio: `orquestracao:executor` é cobrado como `executor`; `orquestracao:validador` não', () => {
  const f = transcript(trabalho());
  const r = rodar('executor-criterio.mjs', subStop(f, 'Pronto, editei a.ts e os testes passaram.', { agent_type: 'orquestracao:executor' }));
  if (!bloqueou(r)) throw new Error('executor com prefixo não foi cobrado');
  igual(rodar('executor-criterio.mjs', subStop(transcript(trabalho()), 'Achados: nenhum.', { agent_type: 'orquestracao:validador' })), null, 'validador com prefixo');
});
caso('K2 subagente-nao-edita: a lista casa `orquestracao:designer` com `designer`; `orquestracao:executor` segue recusado', () => {
  writeFileSync(join(base, 'subagente-pode-escrever.txt'), 'designer\n');
  igual(rodar(SN, editar(`${REPO}/docs/design/revisoes/a.md`, sub('orquestracao:designer'))), null, 'designer com prefixo');
  igual(decisao(rodar(SN, editar(`${REPO}/a.ts`, sub('orquestracao:executor')))), 'deny', 'executor com prefixo');
});

console.log(falhas ? `\n${falhas} FALHA(S)` : '\ntodos verdes');
process.exitCode = falhas ? 1 : 0;
