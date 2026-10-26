#!/usr/bin/env node
// K2: hooks/hooks.json concorda com os eventos que os hooks de hoje têm no settings.json, e o SessionStart injeta as regras globais.
// Rodar: node hooks/tests/hooks-json.test.mjs   (nada aqui toca ~/.claude: o settings.json de hoje está copiado abaixo)
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, mkdtempSync, rmSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOKS = join(dirname(fileURLToPath(import.meta.url)), '..');
const PLUGIN = join(HOOKS, '..');
let falhas = 0;
const ok = (c, m) => { if (!c) throw new Error(m); };
function caso(nome, fn) { try { fn(); console.log(`ok   ${nome}`); } catch (e) { falhas++; console.log(`FAIL ${nome}\n     ${e.message}`); } }

const PRE_EDICAO = 'Edit|Write|MultiEdit|NotebookEdit';
// Evento | matcher | script — o que o settings.json tinha (fase 1), mais o SessionStart novo.
const ESPERADO = [
  ['Stop', null, 'orquestradora-ritual.mjs'],
  ['Stop', null, 'painel-das-sessoes.mjs'],
  ['Stop', null, 'executor-criterio.mjs'],
  ['Stop', null, 'executor-anuncia.mjs'],
  ['Stop', null, 'fila-do-item.mjs'],
  ['Stop', null, 'livre-se-limpa.mjs'],
  ['Stop', null, 'contexto-do-papel.mjs'],
  ['PreToolUse', PRE_EDICAO, 'orquestradora-nao-edita.mjs'],
  ['PreToolUse', PRE_EDICAO, 'subagente-nao-edita.mjs'],
  ['PreToolUse', `Agent|Task|Bash|${PRE_EDICAO}|mcp__ccd_session_mgmt__archive_session|mcp__ccd_session_mgmt__delete_session|mcp__ccd_session__start_session|mcp__ccd_session_mgmt__clear_session`, 'papel-do-pool.mjs'],
  ['PreToolUse', 'Skill', 'skill-do-papel.mjs'],
  ['PreToolUse', 'SendMessage|mcp__ccd_session_mgmt__send_message|mcp__ccd_session__start_session|Write|Edit|MultiEdit|Bash', 'segredo-sai.mjs'],
  ['SubagentStop', null, 'executor-criterio.mjs'],
  ['PostToolUse', null, 'laco-de-comandos.mjs'],
  ['PostToolUseFailure', null, 'laco-de-comandos.mjs'],
  ['UserPromptSubmit', null, 'operador-ausente.mjs'],
  ['UserPromptSubmit', null, 'injecao-entre-sessoes.mjs'],
  ['SessionStart', null, 'sessao-inicio.mjs'],
];
const lerHooks = () => JSON.parse(readFileSync(join(HOOKS, 'hooks.json'), 'utf8')).hooks;

caso('hooks.json lista cada evento, matcher e script de hoje (e só eles), com ${CLAUDE_PLUGIN_ROOT} e timeout 10', () => {
  const h = lerHooks();
  const achado = [];
  for (const [ev, grupos] of Object.entries(h)) {
    for (const g of grupos) for (const c of g.hooks) {
      ok(c.type === 'command', `${ev}: type ${c.type}`);
      const m = /^node "\$\{CLAUDE_PLUGIN_ROOT\}\/hooks\/([\w-]+\.mjs)"$/.exec(c.command);
      ok(m, `${ev}: comando fora do padrão: ${c.command}`);
      ok(c.timeout === 10, `${ev} ${m[1]}: timeout ${c.timeout}`);
      achado.push([ev, g.matcher ?? null, m[1]]);
    }
  }
  const chave = (l) => l.map((x) => x.join(' | ')).sort();
  ok(achado.length === ESPERADO.length && ESPERADO.length > 0, `quantidade: ${achado.length} de ${ESPERADO.length}`);
  ok(JSON.stringify(chave(achado)) === JSON.stringify(chave(ESPERADO)), `diferem:\n  achado   ${chave(achado).join('\n           ')}\n  esperado ${chave(ESPERADO).join('\n           ')}`);
});
caso('todo script do hooks.json existe, e todo hook de hooks/ (fora os comuns) está no hooks.json', () => {
  const doJson = new Set(Object.values(lerHooks()).flatMap((gs) => gs.flatMap((g) => g.hooks.map((c) => /\/hooks\/([\w-]+\.mjs)"/.exec(c.command)[1]))));
  for (const s of doJson) ok(existsSync(join(HOOKS, s)), `${s} não existe`);
  const comuns = new Set(['hooks-crewai-comum.mjs', 'pool-comum.mjs', 'executor-anuncia-regra.mjs', 'varredura-entre-sessoes.mjs']);
  const soltos = readdirSync(HOOKS).filter((f) => f.endsWith('.mjs') && !comuns.has(f) && !doJson.has(f));
  ok(soltos.length === 0, `hooks sem entrada no hooks.json: ${soltos.join(', ')}`);
});
caso('SessionStart injeta as regras globais (Q-ID, papéis e modelos, achar a orquestradora) e termina em 0', () => {
  const out = execFileSync('node', [join(HOOKS, 'sessao-inicio.mjs')], { input: JSON.stringify({ session_id: 'x', hook_event_name: 'SessionStart', source: 'startup' }), encoding: 'utf8', timeout: 15000, killSignal: 'SIGKILL' });
  const r = JSON.parse(out).hookSpecificOutput;
  ok(r.hookEventName === 'SessionStart', `evento: ${r.hookEventName}`);
  const t = r.additionalContext;
  ok(typeof t === 'string' && t.length > 200, `texto curto demais: ${t?.length}`);
  for (const termo of ['Q-ID', 'proxima-pergunta', 'papeis-e-modelos', 'orquestradora', 'list_sessions']) ok(t.includes(termo), `falta "${termo}"`);
  ok(t.length < 6000, `o resumo deve ser curto: ${t.length}`);
  ok(!/Izanagi|ichikawa/i.test(t), 'o texto do plugin não cita projeto nem pessoa');
});
caso('SessionStart sem o .md das regras: não escreve nada e não falha (nunca trava o início da sessão)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'sessao-inicio-'));
  try {
    cpSync(HOOKS, join(tmp, 'hooks'), { recursive: true });
    rmSync(join(tmp, 'hooks', 'regras-globais.md'), { force: true });
    ok(!existsSync(join(tmp, 'hooks', 'regras-globais.md')), 'precondição: o .md saiu');
    const out = execFileSync('node', [join(tmp, 'hooks', 'sessao-inicio.mjs')], { input: '{}', encoding: 'utf8', timeout: 15000, killSignal: 'SIGKILL' });
    ok(out === '', `esperava vazio: ${out}`);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

console.log(falhas ? `\n${falhas} caso(s) falharam` : '\ntodos verdes');
process.exitCode = falhas ? 1 : 0;
