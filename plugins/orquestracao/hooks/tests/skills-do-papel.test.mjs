#!/usr/bin/env node
// Testes da F6 (24/10): aplicar-skills-do-papel.mjs e hooks/skill-do-papel.mjs.
// Rodar: node ~/.claude/hooks/tests/skills-do-papel.test.mjs
// Env para a prova de mutação: HOOKS_DIR (hook), APLICAR (script aplicar).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync, statSync, copyFileSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const HOOKS = process.env.HOOKS_DIR || join(AQUI, '..');
const PLUGIN = join(AQUI, '..', '..');
const POOL = join(PLUGIN, 'pool');
const APLICAR = process.env.APLICAR || join(POOL, 'aplicar-skills-do-papel.mjs');
const MAPA_REAL = join(POOL, 'skills-por-papel.json');
let base; let falhas = 0;
const dir = (...p) => join(base, ...p);
const ok = (c, m) => { if (!c) throw new Error(m); };

const S = { // chave → [cliId, título, git]; git: 'wt' (arquivo .git) | 'principal' (pasta .git)
  E3: ['aaaaaaaa-0000-0000-0000-000000000003', 'E3 · executora · F6', 'wt'],
  D1: ['aaaaaaaa-0000-0000-0000-00000000000d', 'D1 · design · livre', 'wt'],
  P1: ['aaaaaaaa-0000-0000-0000-000000000001', 'P1 · planejadora · F1', 'wt'],
  V9: ['aaaaaaaa-0000-0000-0000-0000000000a9', 'V9 · validadora · livre', 'principal'],
  AV: ['aaaaaaaa-0000-0000-0000-0000000000f1', 'fix(web): botão', 'wt'],
  ORQ: ['aaaaaaaa-0000-0000-0000-0000000000f0', '🎛 orquestradora — izanagi', 'principal'],
};
function novoBase() {
  base = mkdtempSync(join(tmpdir(), 'skills-papel-'));
  mkdirSync(dir('orq')); mkdirSync(dir('home', '.claude', 'projects', 'proj'), { recursive: true });
  mkdirSync(dir('app', 'conta'), { recursive: true }); mkdirSync(dir('bk'));
  copyFileSync(MAPA_REAL, dir('mapa.json'));
  for (const [k, [cli, titulo, git]] of Object.entries(S)) {
    const wt = dir('wt', k); mkdirSync(join(wt, '.claude'), { recursive: true });
    if (git === 'principal') mkdirSync(join(wt, '.git')); else writeFileSync(join(wt, '.git'), 'gitdir: /x\n');
    writeFileSync(dir('app', 'conta', `local_${k}.json`), JSON.stringify({ sessionId: `local_${k}`, cliSessionId: cli, priorCliSessionIds: [], title: titulo, isArchived: false, cwd: wt, worktreePath: wt }));
  }
}
const env = (extra = {}) => ({ ...process.env, HOME: dir('home'), HOOKS_CREWAI_BASE: dir('orq'), POOL_APP_SESSOES_DIR: dir('app'), SKILLS_MAPA: dir('mapa.json'), SKILLS_BACKUP_DIR: dir('bk'), ...extra });
const aplicar = (...args) => execFileSync('node', [APLICAR, ...args], { encoding: 'utf8', timeout: 15000, killSignal: 'SIGKILL', env: env() });
const settings = (k) => JSON.parse(readFileSync(dir('wt', k, '.claude', 'settings.local.json'), 'utf8'));
const log = () => (existsSync(dir('orq', 'hooks-crewai.log')) ? readFileSync(dir('orq', 'hooks-crewai.log'), 'utf8') : '');
function hook(quem, skill) {
  const sessao = quem ? S[quem][0] : 'zzzz-sem-registro';
  const out = execFileSync('node', [join(HOOKS, 'skill-do-papel.mjs')], {
    input: JSON.stringify({ session_id: sessao, hook_event_name: 'PreToolUse', tool_name: 'Skill', tool_input: { skill }, cwd: dir() }),
    encoding: 'utf8', timeout: 15000, killSignal: 'SIGKILL', env: env(),
  });
  return out ? JSON.parse(out).hookSpecificOutput : null;
}
function caso(nome, fn) {
  novoBase();
  try { fn(); console.log(`ok   ${nome}`); } catch (e) { falhas++; console.log(`FAIL ${nome}\n     ${e.message}`); }
  rmSync(base, { recursive: true, force: true });
}

caso('1: aplicar em E grava overrides do papel, plugins e preserva chave alheia', () => {
  writeFileSync(dir('wt', 'E3', '.claude', 'settings.local.json'), JSON.stringify({ permissions: { allow: ['Bash(ls)'] }, skillOverrides: { 'vercel-react-best-practices': 'off' }, enabledPlugins: { 'outro@x': false } }));
  const saida = aplicar('local_E3');
  ok(/E3 local_E3 .* aplicado/.test(saida), `saída: ${saida}`);
  const s = settings('E3');
  ok(!('vercel-react-best-practices' in s.skillOverrides), 'vercel-react deveria sair (on)');
  ok(s.skillOverrides['revisao-de-arquitetura-de-ui'] === 'user-invocable-only', 'revisao-de-arquitetura-de-ui');
  ok(s.skillOverrides.orquestradora === 'name-only', 'orquestradora');
  ok(s.skillOverrides['find-skills'] === 'off', 'find-skills');
  ok(s.enabledPlugins['impeccable@impeccable'] === false, 'impeccable plugin');
  ok(s.enabledPlugins['outro@x'] === false, 'plugin alheio apagado');
  ok(s.permissions?.allow?.[0] === 'Bash(ls)', 'permissions não preservada');
  ok(!Object.keys(s.skillOverrides).some((k) => k.includes(':')), 'skill de plugin não se grava em skillOverrides');
  ok(readdirSync(dir('bk')).length === 1, 'backup do arquivo anterior');
});
caso('2: D liga impeccable e não bloqueia critica-de-ui', () => {
  aplicar('local_D1');
  const s = settings('D1');
  ok(s.enabledPlugins['impeccable@impeccable'] === true, 'impeccable');
  ok(!('critica-de-ui' in s.skillOverrides), 'critica-de-ui deveria ser on');
  ok(s.enabledPlugins['document-skills@anthropic-agent-skills'] === false, 'document-skills em D');
});
caso('3: checkout principal → pulado e arquivo intocado', () => {
  const f = dir('wt', 'V9', '.claude', 'settings.local.json');
  writeFileSync(f, '{"x":1}');
  const m0 = statSync(f).mtimeMs; const c0 = readFileSync(f, 'utf8');
  const saida = aplicar('local_V9');
  ok(/pulado:checkout-principal/.test(saida), `saída: ${saida}`);
  ok(statSync(f).mtimeMs === m0 && readFileSync(f, 'utf8') === c0, 'arquivo mudou');
});
caso('4: título sem prefixo de membro → pulado', () => {
  const saida = aplicar('local_AV');
  ok(/pulado:nao-e-membro/.test(saida), `saída: ${saida}`);
  ok(!existsSync(dir('wt', 'AV', '.claude', 'settings.local.json')), 'gravou em quem não é membro');
});
caso('5: --dry-run não grava', () => {
  const saida = aplicar('local_E3', '--dry-run');
  ok(/aplicaria/.test(saida) && /skillOverrides/.test(saida), `saída: ${saida}`);
  ok(!existsSync(dir('wt', 'E3', '.claude', 'settings.local.json')), 'dry-run gravou');
});
caso('6: segunda rodada sai igual e não cria backup novo', () => {
  writeFileSync(dir('wt', 'P1', '.claude', 'settings.local.json'), '{}');
  aplicar('local_P1');
  const antes = readdirSync(dir('bk')).length;
  ok(antes === 1, `backup da 1ª rodada: ${antes}`);
  const saida = aplicar('local_P1');
  ok(/ igual/.test(saida), `saída: ${saida}`);
  ok(readdirSync(dir('bk')).length === antes, 'backup novo na 2ª rodada');
  ok(/ igual/.test(aplicar('--todos', '--conferir').split('\n').find((l) => l.startsWith('P1')) || ''), '--conferir');
});
caso('7: hook avisa só para nao/desligada e loga fora-do-mapa', () => {
  const r = hook('E3', 'impeccable:impeccable');
  ok(r?.additionalContext?.includes('impeccable:impeccable'), `E impeccable: ${JSON.stringify(r)}`);
  ok(r.permissionDecision === undefined, 'hook não pode decidir');
  ok(hook('E3', 'superpowers:test-driven-development') === null, 'E tdd deveria calar');
  ok(hook('P1', 'vercel-react-best-practices') === null, 'P react (cita) deveria calar');
  ok(hook(null, 'impeccable:impeccable') === null, 'sem membro deveria calar');
  ok(hook('E3', 'skill-que-nao-existe') === null, 'fora do mapa deveria calar');
  ok(/fora-do-mapa/.test(log()) && /skill-que-nao-existe/.test(log()), 'log fora-do-mapa');
  ok(/avisou/.test(log()), 'log avisou');
});
caso('7a: apelido de skill de plugin (name: do frontmatter) também avisa', () => {
  S.V1 = ['aaaaaaaa-0000-0000-0000-0000000000b1', 'V1 · validadora · livre', 'wt'];
  const wt = dir('wt', 'V1'); mkdirSync(join(wt, '.claude'), { recursive: true }); writeFileSync(join(wt, '.git'), 'gitdir: /x\n');
  writeFileSync(dir('app', 'conta', 'local_V1.json'), JSON.stringify({ sessionId: 'local_V1', cliSessionId: S.V1[0], priorCliSessionIds: [], title: S.V1[1], isArchived: false, cwd: wt, worktreePath: wt }));
  const r = hook('V1', 'hookify:writing-hookify-rules');
  ok(r?.additionalContext?.includes('hookify:writing-hookify-rules'), `V apelido: ${JSON.stringify(r)}`);
  ok(/avisou\tV hookify:writing-hookify-rules nao/.test(log()), `log: ${log()}`);
  delete S.V1;
});
caso('7b: apelidos do mapa real apontam para chave de skills e não colidem com ela', () => {
  const m = JSON.parse(readFileSync(MAPA_REAL, 'utf8'));
  ok(m.apelidos && Object.keys(m.apelidos).length >= 1, 'apelidos ausente ou vazio');
  for (const [a, alvo] of Object.entries(m.apelidos)) {
    ok(alvo in m.skills, `apelido ${a} aponta para ${alvo}, que não é chave de skills`);
    ok(!(a in m.skills), `apelido ${a} também é chave de skills`);
  }
});
caso('8: o mapa cobre toda skill do plugin (pelo name: do SKILL.md), e o apelido prefixado existe para cada uma', () => {
  const m = JSON.parse(readFileSync(MAPA_REAL, 'utf8'));
  const raiz = join(PLUGIN, 'skills');
  const doPlugin = readdirSync(raiz).filter((d) => existsSync(join(raiz, d, 'SKILL.md')))
    .map((d) => /^name:\s*(\S+)/m.exec(readFileSync(join(raiz, d, 'SKILL.md'), 'utf8'))?.[1].replace(/['"]/g, ''));
  ok(doPlugin.length >= 6, `insumo vazio: ${doPlugin.length}`);
  ok(doPlugin.every(Boolean), 'SKILL.md sem name:');
  const faltam = doPlugin.filter((n) => !(n in m.skills));
  ok(!faltam.length, `skills fora do mapa: ${faltam.join(', ')}`);
  const semApelido = doPlugin.filter((n) => m.apelidos[`orquestracao:${n}`] !== n);
  ok(!semApelido.length, `sem apelido orquestracao:<nome>: ${semApelido.join(', ')}`);
});
caso('10: todo nome do JSON aparece no skills-por-papel.md', () => {
  const nomes = Object.keys(JSON.parse(readFileSync(MAPA_REAL, 'utf8')).skills);
  ok(nomes.length >= 5, 'mapa vazio');
  const md = readFileSync(join(POOL, 'skills-por-papel.md'), 'utf8');
  // o .md abreviado agrupa `superpowers:a, b, c`: para skill de plugin vale o nome curto (depois do `:`)
  const faltam = nomes.filter((n) => !md.includes(n.includes(':') ? n.split(':')[1] : n));
  ok(!faltam.length, `fora do .md: ${faltam.join(', ')}`);
});

const PAPEIS = { O: 'orquestradora', P: 'planejadora', D: 'design', E: 'executora', V: 'validadora' };
const secao = (md, titulo) => { const m = new RegExp(`^## ${titulo}[^\\n]*\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, 'm').exec(md); return m ? m[1] : ''; };
const crases = (t) => new Set([...t.matchAll(/`([^`\s]+)`/g)].map((m) => m[1]));
// Devolve a lista de divergências entre o mapa e os cinco arquivos de papel.
function divergencias(mapa, pasta) {
  const out = [];
  for (const [papel, arq] of Object.entries(PAPEIS)) {
    const f = join(pasta, `${arq}.md`);
    if (!existsSync(f)) { out.push(`${arq}.md não existe`); continue; }
    const md = readFileSync(f, 'utf8');
    const usa = crases(secao(md, 'Skills que usa')); const cita = crases(secao(md, 'Skills que cita'));
    if (!usa.size || !cita.size) out.push(`${arq}.md: seção vazia (usa=${usa.size}, cita=${cita.size})`);
    for (const [nome, s] of Object.entries(mapa.skills)) {
      const v = s[papel];
      if (v === 'le' && !usa.has(nome)) out.push(`${papel} lê ${nome}: falta em "Skills que usa"`);
      if (v === 'cita' && !cita.has(nome)) out.push(`${papel} cita ${nome}: falta em "Skills que cita"`);
      if ((v === 'nao' || v === 'desligada') && (usa.has(nome) || cita.has(nome))) out.push(`${papel} não lê ${nome}: aparece em usa/cita`);
    }
  }
  return out;
}
caso('9: arquivos de papel × JSON concordam (le→usa, cita→cita, nao fora das duas)', () => {
  const mapa = JSON.parse(readFileSync(MAPA_REAL, 'utf8'));
  const pasta = join(POOL, 'papeis');
  const d = divergencias(mapa, pasta);
  ok(!d.length, d.join('; '));
  // prova de mutação do próprio caso: um `le` virando `nao` numa cópia do mapa tem de ser visto
  const copia = JSON.parse(JSON.stringify(mapa));
  copia.skills['superpowers:test-driven-development'].E = 'nao';
  ok(divergencias(copia, pasta).some((x) => x.includes('superpowers:test-driven-development')), 'mutação le→nao passou despercebida');
});

caso('K2: skill do plugin chega como `orquestracao:ausente` (ou sem prefixo): o mesmo aviso para papel que não a carrega', () => {
  for (const nome of ['ausente', 'orquestracao:ausente', '/orquestracao:ausente']) {
    const r = hook('E3', nome);
    ok(r?.additionalContext?.includes('ausente'), `${nome}: ${JSON.stringify(r)}`);
  }
  ok(hook('E3', 'orquestracao:orquestradora') === null, 'orquestradora é `cita` para E: cala, com ou sem prefixo');
  ok(hook('E3', 'orquestracao:nao-existe') === null, 'fora do mapa cala');
});

console.log(falhas ? `\n${falhas} caso(s) falharam` : '\ntudo ok');
process.exitCode = falhas ? 1 : 0;
