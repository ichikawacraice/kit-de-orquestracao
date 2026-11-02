#!/usr/bin/env node
// Testes das travas da CrewAI (Q62): eventos JSON no formato do Claude Code 2.1.289,
// transcripts sintéticos no formato real (.jsonl), log e estado num diretório temporário.
// Rodar: node gate/com-fichas.mjs -- node plugins/orquestracao/hooks/tests/hooks-crewai.test.mjs   (HOOKS_DIR troca a pasta dos hooks)
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, realpathSync, rmSync, symlinkSync, statSync, unlinkSync, linkSync } from "node:fs";
import { tmpdir, homedir, userInfo } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// HOME próprio: os casos medem caminhos sob `~/Developer/...` que a trava nega, e não dependem do HOME de quem roda. Ele fica FORA de tmpdir:
// as pastas livres da trava (caso 4.5) incluem /tmp, então um HOME ali dá falso vermelho (o que devia ser negado passa).
// Mesma regra de LIVRES das travas (`/tmp`, `/var/folders` e tmpdir): HOME nesses caminhos faz passar o que deve ser negado.
const CAI_NOS_LIVRES = (p) => /^\/(private\/)?tmp\//.test(`${p}/`) || `${p}/`.startsWith('/var/folders/') || `${p}/`.startsWith('/private/var/folders/') || `${p}/`.startsWith(`${realpathSync(tmpdir())}/`);
// Procura onde criar o HOME fora dos LIVRES: primeiro em `.tmp-testes/` na raiz do checkout, depois no HOME do usuário (checkout sob /tmp ou fora do git).
// Nunca ao lado do teste: c5, c14 e hooks-json copiam `hooks/` inteira e o cli.test varre `hooks/tests`, e um HOME que some no meio da cópia derruba quem copia.
function raizDoGit(d) {
  for (let p = d; ; p = dirname(p)) { if (existsSync(join(p, '.git'))) return p; if (dirname(p) === p) return null; }
}
function criarHomeDoTeste(candidatas, prefixo) {
  for (const base of candidatas.filter(Boolean)) {
    mkdirSync(base, { recursive: true });
    if (CAI_NOS_LIVRES(realpathSync(base))) continue;
    const h = mkdtempSync(join(base, prefixo));
    if (!CAI_NOS_LIVRES(realpathSync(h))) return h;
    rmSync(h, { recursive: true, force: true });
  }
  throw new Error(`precondição: não achei pasta fora das livres da trava (/tmp, /var/folders, ${realpathSync(tmpdir())}) para o HOME do teste; as candidatas foram ${candidatas.join(', ')}`);
}
const GIT = raizDoGit(dirname(fileURLToPath(import.meta.url)));
const HOME_DO_TESTE = criarHomeDoTeste([GIT && join(GIT, '.tmp-testes'), userInfo().homedir], '.home-crewai-');
process.on('exit', () => rmSync(HOME_DO_TESTE, { recursive: true, force: true }));
process.env.HOME = HOME_DO_TESTE;
if (CAI_NOS_LIVRES(realpathSync(HOME_DO_TESTE))) throw new Error('precondição: o HOME do teste está nas livres da trava');
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
const REPO = join(homedir(), 'Developer/Projects/Alfa');
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
  ['estado da orquestração', () => join(base, 'alfa.md')],
  ['notas de release', () => `${REPO}/docs/releases/2026-10-23-1.md`],
  ['notas de release em worktree', () => join(homedir(), 'Developer/Projects/Alfa-wt-rel/docs/releases/2026-10-23-2.md')],
  ['memória', () => join(homedir(), '.claude/projects/-Users-x-Alfa/memory/a.md')],
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
  writeFileSync(join(base, 'trava-edicao-repos.txt'), '/Users/x/Developer/Projects/beta/.git\n');
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

// ---------- ideia 2: a dona só termina com a saída real ----------
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
// A sessão que roda é dona de um item em execução: o registro do app e a fila moram em `base`, e cada `sid` ganha o seu item.
const dona = (sid, etapa = 'execucao') => {
  mkdirSync(join(base, 'app'), { recursive: true }); mkdirSync(join(base, 'fila'), { recursive: true });
  writeFileSync(join(base, 'app', `local_${sid}.json`), JSON.stringify({ sessionId: `local_${sid}`, cliSessionId: sid, priorCliSessionIds: [], title: 'F9 · tema qualquer', isArchived: false }));
  writeFileSync(join(base, 'fila', `F-${sid}.json`), JSON.stringify({ id: `F-${sid}`, version: 1, data: { titulo: 'x', etapa, donoLocalId: `local_${sid}` } }));
  return sid;
};
const rc = (ev, env = {}) => rodar('criterio-da-dona.mjs', ev, { POOL_APP_SESSOES_DIR: join(base, 'app'), FILA_DIR: join(base, 'fila'), ...env });
// Cada `chave` vira uma dona própria (estado de cobrança próprio): é o que deixa o mesmo caso medir vários relatórios.
const sidDe = (chave) => `eeeeeeee-0000-0000-0000-${Buffer.from(String(chave)).toString('hex').padStart(12, '0').slice(-12)}`;
const subStop = (f, relatorio, { chave = 'a77', ...extra } = {}) => ({
  session_id: dona(sidDe(chave)), transcript_path: f, cwd: '/r', hook_event_name: 'Stop', stop_hook_active: false,
  last_assistant_message: relatorio, background_tasks: [], ...extra,
});
const bloqueou = (r) => r?.decision === 'block';

caso('2.1 dona: relatório sem saída é cobrado', () => {
  const f = transcript(trabalho());
  const r = rc(subStop(f, 'Pronto, editei a.ts e os testes passaram.'));
  if (!bloqueou(r)) throw new Error('não cobrou');
  if (!r.reason.includes('cobrança 1 de 2')) throw new Error(`motivo: ${r.reason}`);
  igual(log()[0][3], 'cobrou-1', 'log');
});
caso('2.2 no máximo 2 cobranças; a terceira deixa passar e registra', () => {
  const f = transcript(trabalho());
  const ev = subStop(f, 'Pronto, testes passaram.');
  if (!bloqueou(rc(ev))) throw new Error('1ª não cobrou');
  if (!bloqueou(rc({ ...ev, stop_hook_active: true }))) throw new Error('2ª não cobrou');
  igual(rc({ ...ev, stop_hook_active: true }), null, '3ª');
  igual(log().map((l) => l[3]).join(','), 'cobrou-1,cobrou-2,deixou-passar-apos-2', 'log');
});
caso('2.3 saída colada em bloco de código (igual à do Bash) passa', () => {
  const f = transcript(trabalho());
  igual(rc(subStop(f, 'Feito.\n```\n      Tests  98 passed (98)\n```')), null, 'saída');
  igual(log()[0][3], 'passou-com-saida', 'log');
});
caso('2.3b critério que não é teste (grep): a linha colada igual à saída passa', () => {
  const f = transcript(trabalho('apps/web/src/a.ts:12:export const ROTULO = "Publicar"'));
  igual(rc(subStop(f, 'Critério do plano:\n```\napps/web/src/a.ts:12:export const ROTULO = "Publicar"\n```')), null, 'saída');
  igual(log()[0][3], 'passou-com-saida', 'log');
});
caso('2.4 bloco de código inventado (não está na saída do Bash) é cobrado', () => {
  const f = transcript(trabalho());
  if (!bloqueou(rc(subStop(f, 'Feito.\n```\n      Tests  120 passed (120)\n```')))) throw new Error('não cobrou');
});
caso('2.5 status exit=0 com Bash rodado passa; sem Bash no turno é cobrado', () => {
  igual(rc(subStop(transcript(trabalho()), 'Gate: exit=0')), null, 'com Bash');
  const semBash = transcript([abertura('Plano'), usa('Edit', { file_path: '/r/a.ts' }, 't1'), resultado('t1', 'ok')]);
  if (!bloqueou(rc(subStop(semBash, 'Gate: exit=0', { chave: 'a78' })))) throw new Error('sem Bash não cobrou');
});
caso('2.6 paráfrase em PT com número que confere passa; número que não confere é cobrado', () => {
  igual(rc(subStop(transcript(trabalho()), '4 arquivos, 98 testes verdes.')), null, 'confere');
  if (!bloqueou(rc(subStop(transcript(trabalho()), '4 arquivos, 99 testes verdes.', { chave: 'a79' })))) throw new Error('não conferiu e passou');
});
caso('2.7 dona que devolve dúvida não é cobrada', () => {
  igual(rc(subStop(transcript(trabalho()), 'Parei no passo 3: o arquivo b.ts não existe como o plano descreve. Sigo com c.ts?')), null, 'pergunta');
  igual(rc(subStop(transcript(trabalho()), 'Devolvo: o plano não decide entre X e Y. Recomendo X.', { chave: 'a80' })), null, 'devolvo');
  igual(log().map((l) => l[3]).join(','), 'passou-duvida,passou-duvida', 'log');
});
caso('2.9 dona que não editou (só conferiu) não é cobrada', () => {
  const f = transcript([abertura('rode o gate'), usa('Bash', { command: 'pnpm test' }, 't2'), resultado('t2', 'ok')]);
  igual(rc(subStop(f, 'Gate rodado, verde.')), null, 'saída');
});
const stop = (f, extra = {}) => ({ session_id: dona(SID), transcript_path: f, cwd: '/r', hook_event_name: 'Stop', stop_hook_active: false, background_tasks: [], ...extra });
caso('2.10 a dona em execução, validação ou merge é cobrada; em planejamento ou design, ou sem item, não', () => {
  const f = transcript([...trabalho(), fala('Pronto, tudo verde.')]);
  const ev = (sid) => ({ session_id: sid, transcript_path: f, cwd: '/r', hook_event_name: 'Stop', stop_hook_active: false, background_tasks: [] });
  for (const etapa of ['execucao', 'validacao', 'merge']) {
    if (!bloqueou(rc(ev(dona(sidDe(etapa), etapa))))) throw new Error(`dona em ${etapa} não cobrada`);
  }
  for (const etapa of ['planejamento', 'design', 'feito']) igual(rc(ev(dona(sidDe(etapa), etapa))), null, `dona em ${etapa}`);
  igual(rc(ev('ffffffff-0000-0000-0000-000000000000')), null, 'sessão sem item');
  // Com a saída real colada, a dona passa.
  const ok = transcript([...trabalho(), usa('Bash', { command: 'npm test; echo "exit=$?"' }, 't9'), resultado('t9', '# pass 12\nexit=0'), fala('Testes afetados verdes: exit=0.')]);
  igual(rc({ ...ev(dona(sidDe('ok'))), transcript_path: ok }), null, 'dona com exit=0');
});
caso('2.12 Stop vindo de dentro de subagente (agent_id) é ignorado', () => {
  const f = transcript([...trabalho(), fala('Pronto.')]);
  if (!bloqueou(rc(stop(f)))) throw new Error('precondição: a dona é cobrada');
  igual(rc(stop(f, { agent_id: 'a1', agent_type: 'validador' })), null, 'saída');
});
caso('2.13 turno que para esperando background adia; o turno da notificação cobra', () => {
  const t1 = [...trabalho(), usa('Bash', { command: 'pnpm test', run_in_background: true }, 't9'), resultado('t9', 'Command running in background'), fala('Gate rodando; aviso quando terminar.')];
  const f1 = transcript(t1);
  igual(rc(stop(f1, { background_tasks: [{ id: 'b1', status: 'running' }] })), null, 'turno 1');
  igual(log()[0][3], 'adiou-esperando-fundo', 'log 1');
  // Formato real (2.1.308): a notificação de Bash traz só o status, não a saída.
  const notif = abertura('<task-notification>\n<task-id>brdkei6q1</task-id>\n<tool-use-id>t9</tool-use-id>\n<output-file>/tmp/x/tasks/brdkei6q1.output</output-file>\n<status>completed</status>\n<summary>Background command "Run full gate" completed (exit code 0)</summary>\n</task-notification>', { origin: { kind: 'task-notification' } });
  const f2 = transcript([...t1, notif, fala('O gate terminou e passou.')]);
  if (!bloqueou(rc(stop(f2)))) throw new Error('turno da notificação não cobrou');
  const f3 = transcript([...t1, notif, fala('Gate completed (exit code 0).')]);
  igual(rc(stop(f3, { stop_hook_active: true })), null, 'com a saída da notificação');
  igual(log().map((l) => l[3]).join(','), 'adiou-esperando-fundo,cobrou-1,corrigiu-apos-cobranca', 'log');
});
caso('2.14 feedback do próprio Stop (isMeta) não abre turno novo', () => {
  const f = transcript([...trabalho(), fala('Pronto.'), { type: 'user', isMeta: true, uuid: id(), message: { role: 'user', content: 'Stop hook feedback:\nRelatório sem a saída' } }, fala('Pronto de novo.')]);
  if (!bloqueou(rc(stop(f, { stop_hook_active: true })))) throw new Error('perdeu o turno (não viu o Edit)');
});
caso('2.15 entrada quebrada: sai 0, sem saída, erro no log', () => {
  igual(rc('{'), null, 'saída');
  igual(log()[0][3], 'erro', 'log');
});
// Casos da validação de 23/10 (eventos do 2.1.308, formatos de transcript reais).
caso('2.17 edição por Bash conta como edição; Bash que só lê não conta', () => {
  for (const [i, cmd] of ["python3 - <<'EOF'\nopen('a.ts','w').write('x')\nEOF", "sed -i '' 's/a/b/' a.ts", 'cat >> b.md <<EOF\nx\nEOF', 'echo x | tee c.ts'].entries()) {
    const f = transcript([abertura('Plano'), usa('Bash', { command: cmd }, 't1'), resultado('t1', '')]);
    if (!bloqueou(rc(subStop(f, 'Feito.', { chave: `b${i}` })))) throw new Error(`não viu edição em: ${cmd}`);
  }
  for (const [i, cmd] of ['git status 2>&1 | head', 'node -e "[1].map((x)=>x)" > /dev/null', 'grep -n "a->b" x.ts']. entries()) {
    const f = transcript([abertura('Plano'), usa('Bash', { command: cmd }, 't1'), resultado('t1', '')]);
    igual(rc(subStop(f, 'Feito.', { chave: `c${i}` })), null, `leitura cobrada: ${cmd}`);
  }
});
caso('2.18 resumo de compactação não abre turno novo (a edição de antes vale)', () => {
  const compacta = { type: 'user', uuid: id(), isCompactSummary: true, message: { role: 'user', content: 'This session is being continued from a previous conversation…' } };
  const f = transcript([...trabalho(), compacta, fala('Pronto.')]);
  if (!bloqueou(rc(subStop(f, 'Pronto.')))) throw new Error('perdeu a edição de antes da compactação');
});
caso('2.19 status inventado (fora da saída real) é cobrado', () => {
  const f = transcript([abertura('Plano'), usa('Edit', { file_path: '/r/a.ts' }, 't1'), resultado('t1', 'ok'), usa('Bash', { command: 'git status' }, 't2'), resultado('t2', 'nothing to commit')]);
  if (!bloqueou(rc(subStop(f, 'Gate: exit=0')))) throw new Error('exit=0 de cabeça passou');
  if (!bloqueou(rc(subStop(f, 'test=0 typecheck=0', { chave: 'a81' })))) throw new Error('test=0 de cabeça passou');
});
caso('2.20 saída com falha e relatório que só cita os que passaram é cobrado', () => {
  const f = transcript(trabalho('      Tests  2 failed | 96 passed (98)'));
  if (!bloqueou(rc(subStop(f, 'Gate: 96 testes passaram.')))) throw new Error('escondeu a falha e passou');
  igual(rc(subStop(f, 'Gate: 2 falharam, 96 passaram.', { chave: 'a82' })), null, 'admitiu a falha');
  if (!bloqueou(rc(subStop(f, 'Gate: 96 testes passaram, nenhuma falha nova.', { chave: 'a85' })))) throw new Error('"nenhuma falha" escondeu as 2');
});
caso('2.21 "Q62" solto e "$?" dentro de bloco de código não são dúvida', () => {
  if (!bloqueou(rc(subStop(transcript(trabalho()), 'Implementei a Q62 conforme o plano.')))) throw new Error('Q62 virou dúvida');
  if (!bloqueou(rc(subStop(transcript(trabalho()), 'Rodei:\n```\npnpm test; echo exit=$?\n```', { chave: 'a83' })))) throw new Error('$? virou dúvida');
});
caso('2.22 saída lida do .output (Read) ou do Monitor conta como saída real', () => {
  const lido = transcript([abertura('Plano'), usa('Edit', { file_path: '/r/a.ts' }, 't1'), resultado('t1', 'ok'),
    usa('Read', { file_path: '/private/tmp/x/tasks/b1.output' }, 't2'), resultado('t2', SAIDA_VITEST)]);
  igual(rc(subStop(lido, 'Gate: 98 testes verdes.')), null, 'Read do .output');
  const mon = transcript([abertura('Plano'), usa('Edit', { file_path: '/r/a.ts' }, 't1'), resultado('t1', 'ok'),
    usa('Monitor', { command: 'tail -f g.log' }, 't3'), resultado('t3', 'EXIT=0')]);
  igual(rc(subStop(mon, 'Gate: EXIT=0', { chave: 'a84' })), null, 'Monitor');
});
caso('2.23 transcript que não existe: sai calado, sem erro no log', () => {
  igual(rc(subStop('/nao/existe.jsonl', 'Pronto.')), null, 'saída');
  igual(rc(stop('/nao/existe.jsonl')), null, 'Stop');
  igual(log().length, 0, 'log');
});
caso('2.24 só a ÚLTIMA saída com contagem conta: vermelho, conserto, verde passa', () => {
  const f = transcript([abertura('Plano'), usa('Edit', { file_path: '/r/a.ts' }, 't1'), resultado('t1', 'ok'),
    usa('Bash', { command: 'pnpm test' }, 't2'), resultado('t2', '      Tests  2 failed | 96 passed (98)'),
    usa('Edit', { file_path: '/r/a.ts' }, 't3'), resultado('t3', 'ok'),
    usa('Bash', { command: 'pnpm test' }, 't4'), resultado('t4', SAIDA_VITEST)]);
  igual(rc(subStop(f, 'Gate: 98 testes verdes.')), null, 'verde depois do conserto');
});
caso('2.24b saída completa do vitest ("Test Files  1 failed" antes de "Tests  2 failed"): relato honesto passa', () => {
  const f = transcript(trabalho(' FAIL  src/a.test.ts > soma\n Test Files  1 failed | 3 passed (4)\n      Tests  2 failed | 96 passed (98)\n   Duration  12.31s'));
  let i = 0;
  for (const rel of ['Gate: 2 testes falharam, 96 passaram.', 'Gate: falharam 2, os outros 96 passaram.',
    'Gate vermelho:\n```\n      Tests  2 failed | 96 passed (98)\n```', '1 arquivo e 2 testes falharam; 96 passaram.']) {
    igual(rc(subStop(f, rel, { chave: `h${i++}` })), null, `honesto cobrado: ${rel}`);
  }
  if (!bloqueou(rc(subStop(f, 'Gate: 96 testes passaram, nenhuma falha nova.', { chave: 'h9' })))) throw new Error('escondeu');
});
caso('2.24c o "exit=1" do relatório não conta como número de falhas', () => {
  const f = transcript(trabalho(' Test Files  1 failed | 3 passed (4)\n      Tests  2 failed | 96 passed (98)\nexit=1'));
  let i = 0;
  for (const rel of ['96 testes passaram, nenhuma falha nova (exit=1).', 'Gate: 96 passed, sem falhas, exit=1']) {
    if (!bloqueou(rc(subStop(f, rel, { chave: `x${i++}` })))) throw new Error(`escondeu com exit=1: ${rel}`);
  }
  igual(rc(subStop(f, 'exit=1: 2 testes falharam, 96 passaram.', { chave: 'x9' })), null, 'honesto com exit=1');
});
caso('2.24d relatório com milhares de linhas em branco termina rápido (sem backtracking)', () => {
  const ini = Date.now();
  rc(subStop(transcript(trabalho()), 'Pronto.' + '\n'.repeat(20000) + 'fim'));
  if (Date.now() - ini > 3000) throw new Error(`levou ${Date.now() - ini} ms`);
});
caso('2.25 "Bloqueado:" abrindo a linha é dúvida; título markdown com "?" não é', () => {
  igual(rc(subStop(transcript(trabalho()), 'Bloqueado: falta o token da loja.')), null, 'Bloqueado:');
  if (!bloqueou(rc(subStop(transcript(trabalho()), 'Pronto.\n\n## O que ficou de fora?\n\nNada.', { chave: 'a86' })))) throw new Error('título com ? virou dúvida');
  if (!bloqueou(rc(subStop(transcript(trabalho()), 'Bloqueado: nada.', { chave: 'a88' })))) throw new Error('"Bloqueado: nada." isentou');
});
caso('2.26 "exit=1" no relatório não casa com "exit=10" na saída', () => {
  const f = transcript(trabalho('rodou\nexit=10'));
  if (!bloqueou(rc(subStop(f, 'Critério: exit=1')))) throw new Error('exit=1 casou com exit=10');
  igual(rc(subStop(f, 'Critério: exit=10', { chave: 'a87' })), null, 'exit=10 confere');
});
caso('2.27 fio principal com background que nunca termina: no 3º turno adiado, cobra', () => {
  const f = transcript([...trabalho(), fala('Dev server no ar.')]);
  const ev = stop(f, { background_tasks: [{ id: 'b1', type: 'local_bash', status: 'running' }] });
  igual(rc(ev), null, '1º');
  igual(rc(ev), null, '2º');
  if (!bloqueou(rc(ev))) throw new Error('3º adiou de novo');
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

// F200: o aviso registra o laço sem o comando inteiro (que pode trazer token), e o log nasce legível só pelo dono.
caso('3.0 o log do laço não guarda o segredo do comando e nasce 0600', () => {
  const token = 'ghp_' + 'A'.repeat(36);
  const r = avisos(Array.from({ length: 4 }, () => bash(`curl -H "Authorization: Bearer ${token}" https://api.exemplo.com/user`, '{"message":"Bad credentials"}\n')));
  igual(r[3] !== null, true, 'precondição: o 4º avisou');
  const linhas = log().filter((l) => l[2] === 'laco-de-comandos');
  igual(linhas.length, 1, 'precondição: o aviso foi registrado');
  igual(linhas[0][4].includes(token), false, `o token foi para o log: ${linhas[0][4]}`);
  igual(linhas[0][4].includes('curl'), true, 'o log perdeu o nome do comando');
  igual(statSync(join(base, 'hooks-crewai.log')).mode & 0o777, 0o600, 'permissão do log');
});
caso('3.0b atribuição na frente do comando (GH_TOKEN=… gh) não vai para o log; log antigo 0644 vira 0600', () => {
  writeFileSync(join(base, 'hooks-crewai.log'), '', { mode: 0o644 });
  const token = 'ghp_' + 'B'.repeat(36);
  const r = avisos(Array.from({ length: 4 }, () => bash(`GH_TOKEN=${token} gh api user`, '{"message":"Bad credentials"}\n')));
  igual(r[3] !== null, true, 'precondição: o 4º avisou');
  const linha = log().find((l) => l[2] === 'laco-de-comandos');
  igual(linha?.[4]?.includes(token), false, `o token foi para o log: ${linha?.[4]}`);
  igual(linha?.[4]?.includes('gh'), true, 'o log perdeu o programa');
  igual(statSync(join(base, 'hooks-crewai.log')).mode & 0o777, 0o600, 'o log antigo ficou 0644');
});

caso('3.1 o mesmo comando 4× com a mesma saída avisa no 4º, só uma vez', () => {
  const r = avisos(Array.from({ length: 5 }, () => bash('pnpm --filter @alfa/runner test', VITEST)));
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
    tool_input: { command: 'pnpm --filter @alfa/runner test' }, tool_use_id: 'toolu_1', error: `Exit code 1\n${VITEST}`, is_interrupt: false };
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
  igual(m.includes('quem te lançou é quem grava'), true, 'manda devolver a quem o lançou');
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
caso('4.9 Bash fora da configuração das travas não é coberto; sem caminho passa; entrada quebrada sai 0 com erro no log', () => {
  igual(rodar(SN, pre('Bash', { command: 'echo x > a.ts' }, sub())), null, 'Bash');
  igual(rodar(SN, pre('Edit', {}, sub())), null, 'sem caminho');
  igual(rodar(SN, '{'), null, 'quebrada');
  igual(log()[0][3], 'erro', 'log');
});

// K2: o agent do plugin chega como `orquestracao:<tipo>`; a lista casa as duas formas.
caso('K2 subagente-nao-edita: a lista casa `orquestracao:designer` com `designer`; `orquestracao:executor` segue recusado', () => {
  writeFileSync(join(base, 'subagente-pode-escrever.txt'), 'designer\n');
  igual(rodar(SN, editar(`${REPO}/docs/design/revisoes/a.md`, sub('orquestracao:designer'))), null, 'designer com prefixo');
  igual(decisao(rodar(SN, editar(`${REPO}/a.ts`, sub('orquestracao:executor')))), 'deny', 'executor com prefixo');
});
// F60: o designer do kit grava a revisão sem a lista da máquina, só na pasta de revisões do projeto.
const REV = 'docs/design/revisoes';
const comRepo = (fn) => { mkdirSync(join(REPO, '.git'), { recursive: true }); try { fn(); } finally { rmSync(REPO, { recursive: true, force: true }); } };
const LISTA = () => join(base, 'subagente-pode-escrever.txt');
caso('F60.1 kit-design:designer sem lista grava na pasta de revisões padrão', () => comRepo(() => {
  igual(existsSync(LISTA()), false, 'precondição: sem lista');
  igual(decisao(rodar(SN, editar(`${REPO}/${REV}/a.md`, sub('executor')))), 'deny', 'precondição: executor é negado no mesmo caminho');
  igual(rodar(SN, editar(`${REPO}/${REV}/2026-10-26-a.md`, sub('kit-design:designer'))), null, 'Edit');
  igual(rodar(SN, pre('Write', { file_path: `${REPO}/${REV}/README.md`, content: 'x' }, sub('kit-design:designer'))), null, 'Write');
  igual(rodar(SN, editar(`${REPO}/${REV}/2026-10-26-b.md`, sub('design:designer'))), null, 'o nome velho do plugin (F332) ainda vale');
  igual(log().some((l) => l[3] === 'liberado-por-papel'), true, 'log');
}));
caso('F60.2 o designer fora da pasta de revisões continua recusado', () => comRepo(() => {
  for (const p of [`${REPO}/web/index.html`, `${REPO}/CLAUDE.md`, `${REPO}/${REV}/../../src/a.ts`]) {
    igual(decisao(rodar(SN, editar(p, sub('kit-design:designer')))), 'deny', p);
  }
}));
caso('F60.3 design.revisoes do kit.json manda', () => comRepo(() => {
  mkdirSync(join(REPO, '.claude'), { recursive: true });
  const kit = (v) => writeFileSync(join(REPO, '.claude', 'kit.json'), JSON.stringify({ design: { revisoes: v } }));
  kit('docs/ux');
  igual(rodar(SN, editar(`${REPO}/docs/ux/a.md`, sub('kit-design:designer'))), null, 'docs/ux');
  igual(decisao(rodar(SN, editar(`${REPO}/${REV}/a.md`, sub('kit-design:designer')))), 'deny', 'o padrão deixa de valer');
  kit('');
  igual(rodar(SN, editar(`${REPO}/${REV}/a.md`, sub('kit-design:designer'))), null, 'vazio volta ao padrão');
}));
caso('F60.4 a pasta de revisões é a do projeto mais próximo', () => {
  const solto = join(homedir(), 'solto');
  mkdirSync(join(solto, REV), { recursive: true });
  try {
    igual(existsSync(join(solto, '.git')) || existsSync(join(solto, '.claude', 'kit.json')), false, 'precondição: solto não é raiz');
    igual(decisao(rodar(SN, editar(join(solto, REV, 'a.md'), sub('kit-design:designer')))), 'deny', 'solto');
  } finally { rmSync(solto, { recursive: true, force: true }); }
});
caso('F60.5 a lista casa o prefixo de qualquer plugin do kit', () => {
  writeFileSync(LISTA(), 'designer\n');
  igual(rodar(SN, editar(`${REPO}/apps/web/a.tsx`, sub('kit-design:designer'))), null, 'kit-design:designer');
  igual(decisao(rodar(SN, editar(`${REPO}/apps/web/a.tsx`, sub('outro:designer')))), 'deny', 'outro:designer');
  writeFileSync(LISTA(), 'executor\n');
  igual(rodar(SN, editar(`${REPO}/apps/web/a.tsx`, sub('kit-design:executor'))), null, 'kit-design:executor');
  igual(decisao(rodar(SN, editar(`${REPO}/apps/web/a.tsx`, sub('outro:executor')))), 'deny', 'outro:executor');
});
caso('F60.6 os outros tipos não ganham a pasta de revisões', () => comRepo(() => {
  igual(existsSync(LISTA()), false, 'precondição: sem lista');
  for (const t of ['designerX', 'kit-design:critico-de-ui', 'executor']) {
    igual(decisao(rodar(SN, editar(`${REPO}/${REV}/a.md`, sub(t)))), 'deny', t);
  }
}));
// F350: o designer do plugin design-system (o sucessor do kit-design) é liberado pelo papel, com a mesma cerca.
caso('F350.1 design-system:designer sem lista grava só na pasta de revisões', () => comRepo(() => {
  igual(existsSync(LISTA()), false, 'precondição: sem lista');
  igual(decisao(rodar(SN, editar(`${REPO}/${REV}/a.md`, sub('outro:designer')))), 'deny', 'precondição: designer de plugin de fora é negado');
  igual(rodar(SN, editar(`${REPO}/${REV}/2026-11-02-a.md`, sub('design-system:designer'))), null, 'Edit');
  igual(rodar(SN, pre('Write', { file_path: `${REPO}/${REV}/README.md`, content: 'x' }, sub('design-system:designer'))), null, 'Write');
  igual(log().some((l) => l[3] === 'liberado-por-papel' && l[4].includes('design-system:designer')), true, 'log');
  for (const p of [`${REPO}/web/index.html`, `${REPO}/CLAUDE.md`, `${REPO}/${REV}/../../src/a.ts`]) {
    igual(decisao(rodar(SN, editar(p, sub('design-system:designer')))), 'deny', p);
  }
  igual(decisao(rodar(SN, editar(`${REPO}/${REV}/a.md`, sub('design-system:critico-de-ui')))), 'deny', 'o crítico não ganha a pasta');
}));
caso('F350.2 a pasta do design-system:designer vem do design/design-system.json, que vence o kit.json', () => comRepo(() => {
  mkdirSync(join(REPO, 'design'), { recursive: true });
  mkdirSync(join(REPO, '.claude'), { recursive: true });
  writeFileSync(join(REPO, '.claude', 'kit.json'), JSON.stringify({ design: { revisoes: 'docs/ux' } }));
  const ds = (v) => writeFileSync(join(REPO, 'design', 'design-system.json'), JSON.stringify({ revisoes: v }));
  ds('design/revisoes');
  igual(rodar(SN, editar(`${REPO}/design/revisoes/a.md`, sub('design-system:designer'))), null, 'a pasta do design-system.json');
  igual(decisao(rodar(SN, editar(`${REPO}/docs/ux/a.md`, sub('design-system:designer')))), 'deny', 'o kit.json perde para ele');
  igual(rodar(SN, editar(`${REPO}/docs/ux/a.md`, sub('kit-design:designer'))), null, 'o kit-design segue no kit.json');
  igual(decisao(rodar(SN, editar(`${REPO}/design/revisoes/a.md`, sub('kit-design:designer')))), 'deny', 'e não ganha a do design-system.json');
  ds('design');
  igual(decisao(rodar(SN, editar(`${REPO}/design/design-system.json`, sub('design-system:designer')))), 'deny', 'o arquivo dentro da própria pasta não vale');
  igual(rodar(SN, editar(`${REPO}/docs/ux/a.md`, sub('design-system:designer'))), null, 'e cai no kit.json');
  ds('../fora');
  igual(rodar(SN, editar(`${REPO}/docs/ux/a.md`, sub('design-system:designer'))), null, 'inválido cai no kit.json');
}));
caso('F350.3 nenhum designer grava os arquivos de onde a trava lê a pasta', () => comRepo(() => {
  mkdirSync(join(REPO, 'design'), { recursive: true });
  mkdirSync(join(REPO, '.claude'), { recursive: true });
  writeFileSync(join(REPO, '.claude', 'kit.json'), JSON.stringify({ design: { revisoes: 'design' } }));
  writeFileSync(join(REPO, 'design', 'design-system.json'), '{}');
  igual(rodar(SN, editar(`${REPO}/design/b.md`, sub('design-system:designer'))), null, 'precondição: a pasta do kit.json vale');
  for (const t of ['design-system:designer', 'kit-design:designer']) {
    igual(decisao(rodar(SN, editar(`${REPO}/design/design-system.json`, sub(t)))), 'deny', `${t}: design-system.json na pasta do kit.json`);
    igual(decisao(rodar(SN, editar(`${REPO}/Design/design-system.json`, sub(t)))), 'deny', `${t}: grafia de caixa`);
  }
  writeFileSync(join(REPO, '.claude', 'kit.json'), JSON.stringify({ design: { revisoes: '.claude' } }));
  igual(decisao(rodar(SN, editar(`${REPO}/.claude/kit.json`, sub('kit-design:designer')))), 'deny', 'o kit.json na pasta declarada');
}));
// F61: a pasta de revisões é cercada: valor inválido vale o padrão e symlink não leva a escrita para fora.
caso('F61.1 valor inválido de design.revisoes vale o padrão', () => comRepo(() => {
  mkdirSync(join(REPO, '.claude'), { recursive: true });
  const kit = (v) => writeFileSync(join(REPO, '.claude', 'kit.json'), JSON.stringify({ design: { revisoes: v } }));
  kit('docs/ux');
  igual(rodar(SN, editar(`${REPO}/docs/ux/a.md`, sub('kit-design:designer'))), null, 'precondição: docs/ux libera a.md');
  igual(decisao(rodar(SN, editar(`${REPO}/src/a.ts`, sub('kit-design:designer')))), 'deny', 'precondição: docs/ux nega src');
  for (const v of ['.', './', '..', 'docs/..', 'docs/../..', REPO, homedir(), '/']) {
    kit(v);
    igual(decisao(rodar(SN, editar(`${REPO}/src/a.ts`, sub('kit-design:designer')))), 'deny', `src/a.ts com revisoes=${v}`);
    igual(rodar(SN, editar(`${REPO}/${REV}/a.md`, sub('kit-design:designer'))), null, `o padrão vale com revisoes=${v}`);
  }
}));
caso('F61.2 symlink não tira o designer da pasta de revisões', () => comRepo(() => {
  mkdirSync(join(REPO, 'src'), { recursive: true });
  mkdirSync(join(REPO, REV), { recursive: true });
  igual(rodar(SN, editar(`${REPO}/${REV}/a.md`, sub('kit-design:designer'))), null, 'precondição: arquivo comum em pasta real');
  symlinkSync(join(REPO, 'src'), join(REPO, REV, 'link'));
  igual(decisao(rodar(SN, editar(`${REPO}/${REV}/link/a.ts`, sub('kit-design:designer')))), 'deny', 'symlink de pasta');
  symlinkSync(join(REPO, 'src', 'novo.ts'), join(REPO, REV, 'novo.ts'));
  igual(decisao(rodar(SN, editar(`${REPO}/${REV}/novo.ts`, sub('kit-design:designer')))), 'deny', 'symlink quebrado');
  rmSync(join(REPO, REV), { recursive: true, force: true });
  symlinkSync(join(REPO, 'src'), join(REPO, REV));
  igual(decisao(rodar(SN, editar(`${REPO}/${REV}/a.ts`, sub('kit-design:designer')))), 'deny', 'a pasta é symlink');
}));
caso('F61.3 o projeto aberto por um caminho com symlink continua liberado', () => comRepo(() => {
  const alias = join(homedir(), 'alias');
  symlinkSync(REPO, alias);
  try {
    igual(rodar(SN, editar(`${alias}/${REV}/a.md`, sub('kit-design:designer'))), null, 'revisão pelo alias');
    igual(decisao(rodar(SN, editar(`${alias}/src/a.ts`, sub('kit-design:designer')))), 'deny', 'src pelo alias');
  } finally { unlinkSync(alias); }
}));
// F66: a recusa por symlink diz o motivo e grava `recusou-symlink`; a recusa comum não muda.
caso('F66.1 symlink que leva para fora da pasta de revisões recusa com o motivo e o log próprio', () => comRepo(() => {
  const MOTIVO_SYMLINK = /link simb[oó]lico/i;
  const ultimo = () => log().at(-1)[3];
  const recusa = (p) => {
    const r = rodar(SN, editar(p, sub('kit-design:designer')));
    igual(decisao(r), 'deny', `deny de ${p}`);
    return r.hookSpecificOutput.permissionDecisionReason;
  };
  const confere = (p, onde) => {
    const motivo = recusa(p);
    igual(MOTIVO_SYMLINK.test(motivo), true, `${onde}: o motivo cita link simbólico (${motivo})`);
    igual(motivo.includes(REV), true, `${onde}: o motivo cita a pasta de revisões`);
    igual(ultimo(), 'recusou-symlink', `${onde}: log`);
  };
  mkdirSync(join(REPO, 'outra', 'design', 'revisoes'), { recursive: true });
  symlinkSync(join(REPO, 'outra'), join(REPO, 'docs'));
  confere(`${REPO}/${REV}/x.md`, 'docs em symlink para dentro do repo');
  unlinkSync(join(REPO, 'docs'));

  mkdirSync(join(REPO, 'src'), { recursive: true });
  mkdirSync(join(REPO, REV), { recursive: true });
  symlinkSync(join(REPO, 'src'), join(REPO, REV, 'link'));
  confere(`${REPO}/${REV}/link/a.ts`, 'symlink de pasta dentro da revisão');
  symlinkSync(join(REPO, 'src', 'novo.ts'), join(REPO, REV, 'novo.ts'));
  confere(`${REPO}/${REV}/novo.ts`, 'symlink quebrado');
  rmSync(join(REPO, REV), { recursive: true, force: true });
  symlinkSync(join(REPO, 'src'), join(REPO, REV));
  confere(`${REPO}/${REV}/a.ts`, 'a pasta é symlink');
  unlinkSync(join(REPO, REV));

  // Cerca: fora da pasta, sem symlink, segue o motivo genérico e o log `recusou`.
  const motivo = recusa(`${REPO}/src/a.ts`);
  igual(MOTIVO_SYMLINK.test(motivo), false, 'src/a.ts não cita link simbólico');
  igual(/não grava arquivo do projeto/.test(motivo), true, 'src/a.ts: motivo genérico');
  igual(ultimo(), 'recusou', 'src/a.ts: log');
}));
// F323: a configuração das travas fica numa pasta livre para subagente; nem o tipo liberado a grava (senão ele se libera).
const PROTEGIDOS = () => [
  join(base, 'subagente-pode-escrever.txt'), join(base, 'trava-edicao-repos.txt'), join(base, 'operador-ausente.json'),
  join(base, 'hooks-crewai-estado.json'), join(base, 'ativas', SID),
  join(homedir(), '.claude', 'settings.json'), join(homedir(), '.claude', 'settings.local.json'),
  join(homedir(), '.claude', 'plugins', 'cache', 'kit', 'orquestracao', '9.9.9', 'hooks', 'subagente-nao-edita.mjs'),
];
caso('F323.1 subagente não grava a configuração das travas, nem o tipo liberado com `*`', () => {
  writeFileSync(LISTA(), '*\n');
  igual(rodar(SN, editar(`${REPO}/apps/web/a.ts`, sub('executor'))), null, 'precondição: com `*` o executor grava o produto');
  igual(rodar(SN, editar(join(base, 'pool', 'handoffs', 'F1.md'), sub('executor'))), null, 'precondição: o resto do estado segue livre');
  const ps = PROTEGIDOS();
  igual(ps.length > 0, true, 'precondição: há arquivos protegidos');
  for (const p of ps) {
    for (const r of [rodar(SN, editar(p, sub('executor'))), rodar(SN, pre('Write', { file_path: p, content: '*\n' }, sub('impeccable:x')))]) {
      igual(decisao(r), 'deny', p);
      igual(/configura[cç][aã]o das travas/.test(r.hookSpecificOutput.permissionDecisionReason), true, `${p}: o motivo diz o que é`);
    }
  }
  igual(log().at(-1)[3], 'recusou-trava', 'log');
});
caso('F323.2 caixa trocada, `..` e `~/` chegam ao mesmo arquivo e recusam', () => {
  const H = homedir();
  for (const p of [join(base, 'Subagente-Pode-Escrever.TXT'), join(base, 'pool', '..', 'subagente-pode-escrever.txt'),
    '~/.claude/settings.json', join(H, '.claude', 'PLUGINS', 'x.mjs')]) {
    igual(decisao(rodar(SN, editar(p, sub()))), 'deny', p);
  }
  igual(rodar(SN, editar(join(base, 'subagente-pode-escrever.txt.bak'), sub())), null, 'o vizinho de nome parecido segue livre');
  igual(rodar(SN, editar(join(H, '.claude', 'settings.jsonc'), sub())), null, 'settings.jsonc segue livre');
});
caso('F323.3 symlink numa pasta livre que aponta para a lista recusa', () => {
  const link = join(base, 'atalho.txt');
  writeFileSync(LISTA(), 'designer\n');
  symlinkSync(LISTA(), link);
  igual(decisao(rodar(SN, editar(link, sub()))), 'deny', 'symlink para a lista');
});
caso('F323.4 a sessão (sem agent_id) grava a configuração das travas', () => {
  for (const p of PROTEGIDOS()) igual(rodar(SN, editar(p)), null, p);
});
caso('F323.5 Bash de subagente que grava a configuração das travas recusa; ler e gravar o resto passa', () => {
  const grava = [
    "echo '*' >> ~/.claude/orquestracao/subagente-pode-escrever.txt",
    'printf "x\\n" > "$HOME/.claude/orquestracao/trava-edicao-repos.txt"',
    "sed -i '' 's/true/false/' ~/.claude/orquestracao/operador-ausente.json",
    'echo {} | tee ~/.claude/orquestracao/hooks-crewai-estado.json',
    'rm ~/.claude/orquestracao/ativas/abc',
    'cp /tmp/x.json ~/.claude/settings.json',
    'mv /tmp/h.mjs ~/.claude/plugins/cache/kit/orquestracao/9.9.9/hooks/subagente-nao-edita.mjs',
    "node -e \"require('fs').writeFileSync(process.env.HOME+'/.claude/settings.local.json','{}')\"",
  ];
  for (const c of grava) {
    const r = rodar(SN, pre('Bash', { command: c }, sub()));
    igual(decisao(r), 'deny', c);
  }
  igual(log().at(-1)[3], 'recusou-trava', 'log');
  for (const c of ['cat ~/.claude/orquestracao/subagente-pode-escrever.txt', 'grep -n hooks ~/.claude/settings.json 2>/dev/null',
    'ls ~/.claude/plugins/cache', 'echo x > a.ts', "sed -i '' s/a/b/ ~/.claude/orquestracao/notas.md"]) {
    igual(rodar(SN, pre('Bash', { command: c }, sub())), null, c);
  }
  igual(rodar(SN, pre('Bash', { command: grava[0] })), null, 'a sessão (sem agent_id) passa');
});
caso('F323.6 o que a validação achou: ſ, link físico, cache do registro, batida, settings do projeto, transcripts', () => {
  writeFileSync(LISTA(), '*\n');
  const H = homedir();
  igual(rodar(SN, editar(join(H, '.claude', 'projects', '-x', 'memory', 'nota.md'), sub())), null, 'precondição: a memória segue livre');
  igual(rodar(SN, editar(`${REPO}/.claude/kit.json`, sub())), null, 'precondição: com `*` o resto do .claude do projeto passa');
  for (const p of [join(base, 'ſubagente-pode-escrever.txt'), join(H, '.claude', 'ſettings.json'), join(H, '.claude', 'pluginſ', 'x.mjs'),
    join(base, 'pool-registro-cache.json'), join(base, 'batida', 'kit.json'), `${REPO}/.claude/settings.local.json`, `${REPO}/.claude/settings.json`,
    join(H, '.claude', 'projects', '-x', 's1.jsonl')]) {
    igual(decisao(rodar(SN, editar(p, sub()))), 'deny', p);
  }
  const fisico = join(base, 'copia.txt');
  linkSync(LISTA(), fisico);
  igual(decisao(rodar(SN, editar(fisico, sub()))), 'deny', 'link físico da lista');
});
caso('F323.8 painel/ e limpeza/ por caixa e symlink, symlink quebrado para a lista; plugins/data segue livre', () => {
  const H = homedir();
  mkdirSync(join(base, 'limpeza'), { recursive: true });
  mkdirSync(join(H, '.claude', 'plugins', 'data', 'x'), { recursive: true });
  igual(rodar(SN, editar(join(H, '.claude', 'plugins', 'data', 'x', 'config.md'), sub())), null, 'plugins/data');
  const lnk = join(base, 'lnk-limpeza');
  symlinkSync(join(base, 'limpeza'), lnk);
  const quebrado = join(base, 'quebrado.txt');
  symlinkSync(LISTA(), quebrado);
  igual(existsSync(LISTA()), false, 'precondição: a lista não existe (o link está quebrado)');
  for (const p of [join(base, 'Limpeza', 'local_x.json'), join(base, 'PAINEL', 'sessoes', 'a.json'), join(lnk, 'local_x.json'), quebrado]) {
    igual(decisao(rodar(SN, editar(p, sub()))), 'deny', p);
  }
});
caso('F323.7 Bash: painel/limpeza, 1>, &>, --in-place e mkdir recusam; ler o install.sh passa', () => {
  for (const c of ["echo '{}' > ~/.claude/orquestracao/limpeza/local_x.json", 'echo x 1> ~/.claude/orquestracao/trava-edicao-repos.txt',
    'echo x &> ~/.claude/orquestracao/operador-ausente.json', "sed --in-place 's/a/b/' ~/.claude/settings.json",
    'mkdir -p ~/.claude/orquestracao/ativas/abc', 'echo {} > ~/.claude/orquestracao/batida/kit.json']) {
    igual(decisao(rodar(SN, pre('Bash', { command: c }, sub()))), 'deny', c);
  }
  igual(rodar(SN, pre('Bash', { command: 'cat ~/.claude/plugins/marketplaces/kit/install.sh' }, sub())), null, 'install.sh');
});
// F322: o projeto declara em `design.designers` do kit.json quais designers de plugin contam como o do
// kit — só na pasta de revisões, com a mesma cerca; sem curinga e sem a chave nada muda.
const kitDesign = (design) => { mkdirSync(join(REPO, '.claude'), { recursive: true }); writeFileSync(join(REPO, '.claude', 'kit.json'), JSON.stringify({ design })); };
caso('F322.1 designer de plugin declarado grava na pasta de revisões e só nela', () => comRepo(() => {
  igual(existsSync(LISTA()), false, 'precondição: sem lista');
  kitDesign({});
  igual(decisao(rodar(SN, editar(`${REPO}/${REV}/a.md`, sub('acme:designer')))), 'deny', 'precondição: sem a chave, acme:designer é negado');
  kitDesign({ designers: ['acme:designer'] });
  igual(rodar(SN, editar(`${REPO}/${REV}/a.md`, sub('acme:designer'))), null, 'na pasta padrão');
  igual(log().at(-1)[3], 'liberado-por-papel', 'log');
  for (const p of [`${REPO}/src/a.ts`, `${REPO}/.claude/kit.json`, `${REPO}/${REV}/../../src/a.ts`]) {
    igual(decisao(rodar(SN, editar(p, sub('acme:designer')))), 'deny', `fora: ${p}`);
  }
  kitDesign({ revisoes: 'docs/ux', designers: ['acme:designer'] });
  igual(rodar(SN, editar(`${REPO}/docs/ux/a.md`, sub('acme:designer'))), null, 'design.revisoes manda');
  igual(decisao(rodar(SN, editar(`${REPO}/${REV}/a.md`, sub('acme:designer')))), 'deny', 'o padrão deixa de valer');
}));
caso('F322.2 só o tipo declarado, exato: curinga e outro plugin seguem recusados', () => comRepo(() => {
  kitDesign({ designers: ['acme:designer'] });
  igual(rodar(SN, editar(`${REPO}/${REV}/a.md`, sub('acme:designer'))), null, 'precondição: o declarado passa');
  for (const t of ['outro:designer', 'acme:designerX', 'acme:executor', 'designer:acme']) {
    igual(decisao(rodar(SN, editar(`${REPO}/${REV}/a.md`, sub(t)))), 'deny', t);
  }
  kitDesign({ designers: ['*:designer', 'acme:*', '*'] });
  for (const t of ['acme:designer', 'outro:designer']) {
    igual(decisao(rodar(SN, editar(`${REPO}/${REV}/a.md`, sub(t)))), 'deny', `curinga não casa: ${t}`);
  }
  for (const v of ['acme:designer', null, 7, { a: 'acme:designer' }]) {
    kitDesign({ designers: v });
    igual(decisao(rodar(SN, editar(`${REPO}/${REV}/a.md`, sub('acme:designer')))), 'deny', `designers=${JSON.stringify(v)} não é lista`);
  }
  kitDesign({ designers: ['  acme:designer  ', 3, null] });
  igual(rodar(SN, editar(`${REPO}/${REV}/a.md`, sub('acme:designer'))), null, 'item com espaço vale; o que não é texto é ignorado');
}));
caso('F322.3 o declarado tem a mesma cerca: valor inválido vale o padrão, symlink não libera', () => comRepo(() => {
  kitDesign({ revisoes: '../fora', designers: ['acme:designer'] });
  igual(rodar(SN, editar(`${REPO}/${REV}/a.md`, sub('acme:designer'))), null, 'inválido vale o padrão');
  mkdirSync(join(REPO, 'src'), { recursive: true });
  mkdirSync(join(REPO, REV), { recursive: true });
  symlinkSync(join(REPO, 'src'), join(REPO, REV, 'link'));
  const r = rodar(SN, editar(`${REPO}/${REV}/link/a.ts`, sub('acme:designer')));
  igual(decisao(r), 'deny', 'symlink');
  igual(log().at(-1)[3], 'recusou-symlink', 'log do symlink');
}));
caso('F322.4 a declaração vale só para o projeto que a faz', () => comRepo(() => {
  kitDesign({ designers: ['acme:designer'] });
  const outro = join(homedir(), 'outro-projeto');
  mkdirSync(join(outro, '.git'), { recursive: true });
  try {
    igual(rodar(SN, editar(`${REPO}/${REV}/a.md`, sub('acme:designer'))), null, 'precondição: no projeto que declara, passa');
    igual(decisao(rodar(SN, editar(join(outro, REV, 'a.md'), sub('acme:designer')))), 'deny', 'outro projeto');
  } finally { rmSync(outro, { recursive: true, force: true }); }
}));
caso('F322.5 kit.json aninhado na pasta de revisões não declara designer', () => comRepo(() => {
  kitDesign({ designers: ['acme:designer'] });
  const aninhado = join(REPO, REV, 'x');
  mkdirSync(join(aninhado, '.claude'), { recursive: true });
  igual(rodar(SN, pre('Write', { file_path: join(aninhado, '.claude', 'kit.json'), content: 'x' }, sub('acme:designer'))), null, 'precondição: o declarado grava dentro da revisão');
  writeFileSync(join(aninhado, '.claude', 'kit.json'), JSON.stringify({ design: { revisoes: 'y', designers: ['general-purpose'] } }));
  igual(decisao(rodar(SN, editar(join(aninhado, 'y', 'a.ts'), sub('general-purpose')))), 'deny', 'o tipo declarado pelo aninhado segue recusado');
  igual(rodar(SN, editar(join(aninhado, 'y', 'a.ts'), sub('acme:designer'))), null, 'o declarado pelo projeto de fora segue na revisão');
  mkdirSync(join(aninhado, '.git'), { recursive: true });
  igual(decisao(rodar(SN, editar(join(aninhado, 'y', 'a.ts'), sub('general-purpose')))), 'deny', 'nem com .git aninhado');
}));
caso('F322.6 kit.json na raiz da pasta de revisões e caminho com outra caixa também não declaram', () => comRepo(() => {
  kitDesign({ designers: ['acme:designer'] });
  const rev = join(REPO, REV);
  mkdirSync(join(rev, '.claude'), { recursive: true });
  writeFileSync(join(rev, '.claude', 'kit.json'), JSON.stringify({ design: { revisoes: 'y', designers: ['general-purpose'] } }));
  igual(decisao(rodar(SN, editar(join(rev, 'y', 'a.ts'), sub('general-purpose')))), 'deny', 'kit.json na raiz da revisão');
  igual(rodar(SN, editar(join(rev, 'y', 'a.ts'), sub('acme:designer'))), null, 'o declarado de fora segue na revisão');
  rmSync(join(rev, '.claude'), { recursive: true, force: true });
  mkdirSync(join(rev, 'x', '.claude'), { recursive: true });
  writeFileSync(join(rev, 'x', '.claude', 'kit.json'), JSON.stringify({ design: { revisoes: 'y', designers: ['general-purpose'] } }));
  const outraCaixa = join(REPO, 'DOCS', 'Design', 'revisoes', 'x', 'y', 'a.ts');
  if (!existsSync(join(REPO, 'DOCS'))) return; // disco que distingue maiúsculas: não há outro caminho para o mesmo arquivo
  igual(decisao(rodar(SN, editar(outraCaixa, sub('general-purpose')))), 'deny', 'caminho com outra caixa');
}));
caso('F322.7 projeto aninhado fora da revisão segue com a própria raiz e a própria declaração', () => comRepo(() => {
  kitDesign({ designers: ['acme:designer'] });
  const b = join(REPO, 'packages', 'b');
  mkdirSync(join(b, '.git'), { recursive: true });
  igual(decisao(rodar(SN, editar(join(b, REV, 'a.md'), sub('acme:designer')))), 'deny', 'a declaração de fora não vale em b');
  igual(rodar(SN, editar(join(b, REV, 'a.md'), sub('kit-design:designer'))), null, 'o designer do kit grava nas revisões de b');
  igual(decisao(rodar(SN, editar(join(b, 'src', 'a.ts'), sub('kit-design:designer')))), 'deny', 'e não no código de b');
}));
caso('2.28 esgotado vale pelo turno: 4 paradas com o transcript crescendo dão 1, 2, passa, passa', () => {
  const f = transcript([...trabalho(), fala('Pronto, editei.')]);
  const cresce = (...es) => writeFileSync(f, readFileSync(f, 'utf8') + es.map((e) => JSON.stringify(e)).join('\n') + '\n');
  const seq = [];
  for (let i = 1; i <= 4; i++) {
    const r = rc(stop(f, { stop_hook_active: i > 1, last_assistant_message: 'Pronto, editei.' }));
    seq.push(r?.reason?.match(/cobrança \d de 2/)?.[0] ?? 'passou');
    cresce(abertura('Stop hook feedback:\ncobrança', { isMeta: true }), fala('Pronto, editei.'));
  }
  igual(seq.join(','), 'cobrança 1 de 2,cobrança 2 de 2,passou,passou', 'paradas');
  igual(log().map((l) => l[3]).join(','), 'cobrou-1,cobrou-2,deixou-passar-apos-2,passou-esgotado', 'log');
});
caso('2.29 estado malformado ({"x":null}) não derruba o hook e é limpo na gravação', () => {
  const arq = join(base, 'hooks-crewai-estado.json');
  writeFileSync(arq, JSON.stringify({ x: null, y: 5 }));
  if (!bloqueou(rc(stop(transcript([...trabalho(), fala('Pronto.')]))))) throw new Error('não cobrou');
  igual(log().some((l) => l[3] === 'erro'), false, 'erro no log');
  igual(Object.keys(JSON.parse(readFileSync(arq, 'utf8'))).length, 1, 'só a chave desta sessão sobra');
});

caso('2.30 turno que edita arquivo de teste registra `editou teste: <caminhos>`; turno que só edita código não registra', () => {
  const mexeu = (alvo, tid) => [abertura('Plano'), usa('Edit', { file_path: alvo, old_string: 'a', new_string: 'b' }, tid), resultado(tid, 'ok'),
    usa('Bash', { command: 'npm test; echo exit=$?' }, `${tid}b`), resultado(`${tid}b`, SAIDA_VITEST + '\nexit=0')];
  const comTeste = transcript(mexeu('/r/x.test.mjs', 'ta'));
  // Precondição: a fixtura tem o `tool_use` que o hook lê; sem isto o "não registra" abaixo mediria um transcript vazio.
  igual(readFileSync(comTeste, 'utf8').includes('"name":"Edit"'), true, 'fixtura sem o tool_use de Edit');
  igual(rc(subStop(comTeste, 'Gate: exit=0')), null, 'não cobra nem bloqueia por isso');
  const linhas = log().filter((l) => l[3] === 'editou-teste');
  igual(linhas.length, 1, 'linhas de editou-teste');
  igual(linhas[0][4], 'editou teste: /r/x.test.mjs', 'detalhe');
  const soCodigo = transcript(mexeu('/r/src/a.mjs', 'tb'));
  igual(readFileSync(soCodigo, 'utf8').includes('"name":"Edit"'), true, 'fixtura sem o tool_use de Edit');
  rc(subStop(soCodigo, 'Gate: exit=0', { chave: 'a79' }));
  igual(log().filter((l) => l[3] === 'editou-teste').length, 1, 'o turno só de código não registra');
  const pasta = transcript(mexeu('/r/hooks/tests/helper.mjs', 'tc'));
  rc(subStop(pasta, 'Gate: exit=0', { chave: 'a80' }));
  igual(log().filter((l) => l[3] === 'editou-teste').length, 2, 'caminho em pasta tests/ conta');
  const porBash = transcript([abertura('Plano'), usa('Bash', { command: "sed -i '' 's/a/b/' src/y.spec.ts && npm test; echo exit=$?" }, 'td'), resultado('td', SAIDA_VITEST + '\nexit=0')]);
  rc(subStop(porBash, 'Gate: exit=0', { chave: 'a81' }));
  igual(log().filter((l) => l[3] === 'editou-teste').length, 3, 'Bash que grava e cita o teste conta');
  const soRodou = transcript([abertura('Plano'), usa('Edit', { file_path: '/r/src/a.mjs', old_string: 'a', new_string: 'b' }, 'te'), resultado('te', 'ok'),
    usa('Bash', { command: 'npx vitest run src/z.test.ts; echo exit=$?' }, 'tf'), resultado('tf', SAIDA_VITEST + '\nexit=0')]);
  rc(subStop(soRodou, 'Gate: exit=0', { chave: 'a82' }));
  igual(log().filter((l) => l[3] === 'editou-teste').length, 3, 'rodar o teste não é editar o teste');
});

caso('2.31 registro de teste editado por Bash: conta o alvo da escrita', () => {
  let n = 0;
  const conta = (cmd) => {
    n += 1;
    const t = transcript([abertura('Plano'), usa('Bash', { command: cmd }, `bz${n}`), resultado(`bz${n}`, SAIDA_VITEST + '\nexit=0')]);
    const antes = log().filter((l) => l[3] === 'editou-teste').length;
    rc(subStop(t, 'Gate: exit=0', { chave: `bz${n}` }));
    return log().filter((l) => l[3] === 'editou-teste').length - antes;
  };
  igual(conta('echo x > src/a.test.ts'), 1, 'redireção para teste');
  igual(conta('echo x >> tests/h.mjs'), 1, 'redireção anexa para teste');
  igual(conta('echo x | tee src/b.spec.ts'), 1, 'tee em teste');
  igual(conta('sed -i "" s/a/b/ src/c.test.ts'), 1, 'sed -i em teste');
  igual(conta('perl -pi -e s/a/b/ src/d.test.ts'), 1, 'perl -i em teste');
  igual(conta('cp /tmp/x src/e.test.ts'), 1, 'cp com teste por último');
  igual(conta('mv /tmp/x src/f.test.ts'), 1, 'mv com teste por último');
  igual(conta('rm src/g.test.ts'), 1, 'rm de teste');
  igual(conta('git checkout -- src/h.test.ts'), 1, 'git checkout -- teste');
  igual(conta('git restore src/i.test.ts'), 1, 'git restore teste');
  igual(conta('npx vitest run a.test.ts > /tmp/log; echo exit=$?'), 0, 'laudo: vitest com saída para log');
  igual(conta('sed -i "" s/a/b/ src/y.ts && npx vitest run a.test.ts'), 0, 'laudo: sed -i em não teste encadeado com a execução');
  igual(conta('cp src/j.test.ts /tmp/backup'), 0, 'cp com teste só na origem');
  igual(conta('cat src/k.test.ts | grep x'), 0, 'cat de teste');
  // Conserto 2: R1 (não cobra o que não escreve teste) e R2 (aspas, branch com nome de teste).
  const cobra = (cmd, id) => rc(subStop(transcript([abertura('Plano'), usa('Bash', { command: cmd }, id)]), 'feito', { chave: id }));
  igual(cobra('git checkout develop', 'r1a')?.decision ?? null, null, 'R1: git checkout develop não cobra');
  igual(cobra('rm -rf /tmp/x', 'r1b')?.decision ?? null, null, 'R1: rm -rf /tmp/x não cobra');
  igual(cobra('cp a /tmp/b', 'r1c')?.decision ?? null, null, 'R1: cp a /tmp/b não cobra');
  igual(cobra('rm tests/a.test.mjs', 'r1d')?.decision, 'block', 'R1: rm de teste cobra');
  igual(log().some((l) => l[3] === 'editou-teste' && l[4].includes('tests/a.test.mjs')), true, 'R1: rm de teste registra');
  igual(conta("sed -i 's/x/y/; s/z/w/' a.test.ts"), 1, 'R2: ; dentro de aspas não corta, registra');
  igual(conta('git checkout -b test/foo'), 0, 'R2: git checkout -b test/foo não registra');
  igual(conta('git switch test/foo'), 0, 'R2: git switch não registra');
  igual(conta('git checkout test/foo'), 0, 'R2: git checkout <branch> não registra');
  igual(conta('echo "a > b.test.ts"'), 0, 'R2: > dentro de aspas não é redireção');
  igual(conta('npm test\nrm tests/a.test.mjs'), 1, 'N1: \\n separa comandos (rm depois de npm test)');
  igual(conta("cd /r\nsed -i 's/a/b/' a.test.ts"), 1, 'N1: \\n separa comandos (sed -i depois de cd)');
  igual(conta('cat > notas.md <<EOF\nrm tests/x.test.mjs\nEOF\nnpm test'), 0, 'N1: corpo de heredoc não vira comando');
  igual(conta("cat > notas.md <<'EOF'\nrm tests/x.test.mjs\nEOF"), 0, "N1: heredoc com <<'EOF' não vira comando");
  igual(conta('cat <<-EOF\n\trm tests/x.test.mjs\n\tEOF'), 0, 'N1: heredoc <<-EOF não vira comando');
  igual(conta('cat > a.test.ts <<EOF\nx\nEOF'), 1, 'N1: destino do heredoc continua registrando');
  igual(conta('cat <<EOF\nx\nEOF\nrm tests/z.test.mjs'), 1, 'N1: comando depois do heredoc registra');
  igual(conta('git restore --staged src/m.test.ts'), 0, 'N2: git restore --staged não registra');
  igual(conta("cat <<< 'aqui' > /tmp/x\nrm tests/a.test.mjs"), 1, 'A1: here-string <<< não abre heredoc, o rm seguinte registra');
  igual(conta('echo $((1<<2))\nrm tests/a.test.mjs'), 1, 'A1: << dentro de $(( )) é deslocamento, o rm seguinte registra');
  igual(conta('echo $(( (1<<2) + 1 ))\nrm tests/a.test.mjs'), 1, 'A1: parênteses aninhados na aritmética');
  igual(conta('cat <<EOF\nrm tests/x.test.mjs\nEOF'), 0, 'A1: heredoc de verdade continua pulando o corpo');
});

console.log(falhas ? `\n${falhas} FALHA(S)` : '\ntodos verdes');
process.exitCode = falhas ? 1 : 0;
