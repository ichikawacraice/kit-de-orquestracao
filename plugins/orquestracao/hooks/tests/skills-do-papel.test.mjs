#!/usr/bin/env node
// Testes da F6 (24/10): aplicar-skills-do-papel.mjs e hooks/skill-do-papel.mjs.
// Rodar: node ~/.claude/hooks/tests/skills-do-papel.test.mjs
// Env para a prova de mutação: HOOKS_DIR (hook), APLICAR (script aplicar).
import { execFileSync, spawnSync } from 'node:child_process';
import { renameSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync, statSync, copyFileSync } from 'node:fs';
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
const ACC = 'acc-atual'; const ORG = 'org-x'; // pasta da conta, como o app grava: claude-code-sessions/<conta>/<org>/
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
  mkdirSync(dir('app', ACC, ORG), { recursive: true }); mkdirSync(dir('bk'));
  copyFileSync(MAPA_REAL, dir('mapa.json'));
  for (const [k, [cli, titulo, git]] of Object.entries(S)) {
    const wt = dir('wt', k); mkdirSync(join(wt, '.claude'), { recursive: true });
    if (git === 'principal') mkdirSync(join(wt, '.git')); else writeFileSync(join(wt, '.git'), 'gitdir: /x\n');
    writeFileSync(dir('app', ACC, ORG, `local_${k}.json`), JSON.stringify({ sessionId: `local_${k}`, cliSessionId: cli, priorCliSessionIds: [], title: titulo, isArchived: false, cwd: wt, worktreePath: wt }));
  }
}
const env = (extra = {}) => ({ ...process.env, HOME: dir('home'), HOOKS_CREWAI_BASE: dir('orq'), POOL_APP_SESSOES_DIR: dir('app'), CLAUDE_CODE_ACCOUNT_UUID: ACC, CLAUDE_CODE_ORGANIZATION_UUID: ORG, SKILLS_MAPA: dir('mapa.json'), SKILLS_BACKUP_DIR: dir('bk'), ...extra });
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
  ok(!("design:revisao-de-arquitetura-de-ui" in s.skillOverrides), "skill de plugin não se grava em skillOverrides");
  ok(s.enabledPlugins["design@kit-de-orquestracao"] === true && s.enabledPlugins["processos@kit-de-orquestracao"] === true, "design liga em E (A6), processos liga");
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
  ok(!('design:critica-de-ui' in s.skillOverrides), 'skill de plugin fora de skillOverrides');
  ok(s.enabledPlugins['design@kit-de-orquestracao'] === true, 'design liga em D');
  ok(s.enabledPlugins['document-skills@anthropic-agent-skills'] === false, 'document-skills em D');
});
caso('2b: cópia de projeto sem prefixo segue filtrada por papel (projeto que ainda tem as skills como suas)', () => {
  aplicar('local_E3');
  const e = settings('E3').skillOverrides;
  ok(e['critica-de-ui'] === 'user-invocable-only', `E critica-de-ui: ${e['critica-de-ui']}`);
  ok(e['revisao-de-arquitetura-de-ui'] === 'user-invocable-only', `E revisao: ${e['revisao-de-arquitetura-de-ui']}`);
  ok(e['revisar-diff'] === 'user-invocable-only', `E revisar-diff: ${e['revisar-diff']}`);
  aplicar('local_D1');
  const d = settings('D1').skillOverrides;
  ok(!('critica-de-ui' in d), 'D lê critica-de-ui');
  ok(d['spec-driven'] === 'name-only', `D spec-driven: ${d['spec-driven']}`);
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
  writeFileSync(dir('app', ACC, ORG, 'local_V1.json'), JSON.stringify({ sessionId: 'local_V1', cliSessionId: S.V1[0], priorCliSessionIds: [], title: S.V1[1], isArchived: false, cwd: wt, worktreePath: wt }));
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
const irmaPrefixada = (mapa, nome) => ['processos', 'design'].find((p) => `${p}:${nome}` in mapa.skills);
function divergencias(mapa, pasta) {
  const out = [];
  for (const [papel, arq] of Object.entries(PAPEIS)) {
    const f = join(pasta, `${arq}.md`);
    if (!existsSync(f)) { out.push(`${arq}.md não existe`); continue; }
    const md = readFileSync(f, 'utf8');
    const usa = crases(secao(md, 'Skills que usa')); const cita = crases(secao(md, 'Skills que cita'));
    if (!usa.size || !cita.size) out.push(`${arq}.md: seção vazia (usa=${usa.size}, cita=${cita.size})`);
    for (const [nome, s] of Object.entries(mapa.skills)) {
      if (s.origem === 'projeto' && irmaPrefixada(mapa, nome)) continue; // cópia de projeto: os papéis citam só o nome prefixado
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

caso('2c: a linha de projeto sem prefixo e a prefixada têm as mesmas colunas', () => {
  const mapa = JSON.parse(readFileSync(MAPA_REAL, 'utf8'));
  const projeto = Object.entries(mapa.skills).filter(([, s]) => s.origem === 'projeto');
  ok(projeto.length === 5, `linhas de projeto: ${projeto.length}`);
  for (const [nome, s] of projeto) {
    const par = irmaPrefixada(mapa, nome);
    ok(par, `${nome} sem irmã prefixada`);
    const o = mapa.skills[`${par}:${nome}`];
    for (const papel of ['O', 'P', 'D', 'E', 'V']) ok(s[papel] === o[papel], `${nome} ${papel}: ${s[papel]} × ${o[papel]}`);
  }
});

caso('K2: skill do plugin chega como `orquestracao:ausente` (ou sem prefixo): o mesmo aviso para papel que não a carrega', () => {
  for (const nome of ['ausente', 'orquestracao:ausente', '/orquestracao:ausente']) {
    const r = hook('E3', nome);
    ok(r?.additionalContext?.includes('ausente'), `${nome}: ${JSON.stringify(r)}`);
  }
  ok(hook('E3', 'orquestracao:orquestradora') === null, 'orquestradora é `cita` para E: cala, com ou sem prefixo');
  ok(hook('E3', 'orquestracao:nao-existe') === null, 'fora do mapa cala');
});

// F70: a conta vem do ambiente do app, e `<local_…>` não depende dela.
const VELHA = 'acc-velha';
function contaVelha() {
  const wt = dir('wt', 'E9'); mkdirSync(join(wt, '.claude'), { recursive: true }); writeFileSync(join(wt, '.git'), 'gitdir: /x\n');
  mkdirSync(dir('app', VELHA, ORG), { recursive: true });
  writeFileSync(dir('app', VELHA, ORG, 'local_VELHO.json'), JSON.stringify({ sessionId: 'local_VELHO', cliSessionId: 'aaaaaaaa-0000-0000-0000-0000000000e9', priorCliSessionIds: [], title: 'E9 · livre', isArchived: false, cwd: wt, worktreePath: wt }));
}
// Roda o script e devolve status/stdout/stderr. `semApp`: sem POOL_APP_SESSOES_DIR e sem as envs da conta (caminho de produção, HOME temporário).
function rodar(args, { semEnv = [], extra = {}, script = APLICAR } = {}) {
  const e = env(extra);
  for (const k of semEnv) delete e[k];
  const r = spawnSync('node', [script, ...args], { encoding: 'utf8', timeout: 15000, killSignal: 'SIGKILL', env: e });
  return { status: r.status, out: r.stdout, err: r.stderr };
}
const SEM_CONTA = ['CLAUDE_CODE_ACCOUNT_UUID', 'CLAUDE_CODE_ORGANIZATION_UUID'];
const EM_VELHA = { CLAUDE_CODE_ACCOUNT_UUID: VELHA };
const gravarContaAtual = (pasta, conteudo) => { mkdirSync(pasta, { recursive: true }); writeFileSync(join(pasta, 'conta-atual.txt'), conteudo); };

caso('F70.1: <local_…> acha a sessão sem conta nenhuma, no caminho de produção (sem POOL_APP_SESSOES_DIR)', () => {
  const reais = dir('home', 'Library', 'Application Support', 'Claude');
  mkdirSync(join(reais, 'claude-code-sessions'), { recursive: true });
  rmSync(join(reais, 'claude-code-sessions'), { recursive: true }); renameSync(dir('app'), join(reais, 'claude-code-sessions'));
  const r = rodar(['local_E3'], { semEnv: ['POOL_APP_SESSOES_DIR', ...SEM_CONTA] });
  ok(r.status === 0, `exit ${r.status}: ${r.err}`);
  ok(/E3 local_E3 .* aplicado/.test(r.out), `saída: ${r.out}`);
});
caso('F70.2: <local_…> de outra conta também acha', () => {
  contaVelha();
  const r = rodar(['local_VELHO', '--dry-run']);
  ok(r.status === 0 && /E9 local_VELHO .* aplicaria/.test(r.out), `exit ${r.status} saída: ${r.out} ${r.err}`);
});
caso('F70.3: --todos lê só a conta das envs (e a velha seria lida se fosse a atual)', () => {
  contaVelha();
  const velha = rodar(['--todos', '--conferir'], { extra: EM_VELHA });
  ok(velha.status === 0 && /^E9 /m.test(velha.out) && !/^E3 /m.test(velha.out), `precondição: ${velha.out} ${velha.err}`);
  const r = rodar(['--todos', '--conferir']);
  ok(r.status === 0, `exit ${r.status}: ${r.err}`);
  ok(/^E3 /m.test(r.out), `sem E3: ${r.out}`);
  ok(!/^E9 /m.test(r.out), `listou a conta velha: ${r.out}`);
});
caso('F70.4: --todos fora do app usa <BASE>/pool/conta-atual.txt, não a pasta do script', () => {
  contaVelha();
  gravarContaAtual(dir('orq', 'pool'), `${VELHA}/${ORG}\n`);
  const r = rodar(['--todos', '--conferir'], { semEnv: SEM_CONTA });
  ok(r.status === 0 && /^E9 /m.test(r.out) && !/^E3 /m.test(r.out), `exit ${r.status} saída: ${r.out} ${r.err}`);
  // o arquivo ao lado do script (lugar antigo) não vale mais
  rmSync(dir('orq', 'pool'), { recursive: true, force: true });
  const copia = dir('copia'); mkdirSync(join(copia, 'pool'), { recursive: true }); mkdirSync(join(copia, 'hooks'));
  for (const f of readdirSync(POOL).filter((n) => n.endsWith('.mjs') || n.endsWith('.json'))) copyFileSync(join(POOL, f), join(copia, 'pool', f));
  for (const f of readdirSync(HOOKS).filter((n) => n.endsWith('.mjs'))) copyFileSync(join(HOOKS, f), join(copia, 'hooks', f));
  // F183: pool-comum importa o módulo das perguntas, vizinho da skill
  mkdirSync(join(copia, 'skills', 'orquestradora', 'scripts'), { recursive: true });
  copyFileSync(join(PLUGIN, 'skills', 'orquestradora', 'scripts', 'perguntas-arquivo.mjs'), join(copia, 'skills', 'orquestradora', 'scripts', 'perguntas-arquivo.mjs'));
  gravarContaAtual(join(copia, 'pool'), `${VELHA}/${ORG}\n`);
  const r2 = rodar(['--todos', '--conferir'], { semEnv: SEM_CONTA, script: join(copia, 'pool', 'aplicar-skills-do-papel.mjs') });
  ok(r2.status === 2, `deveria recusar (exit 2), deu ${r2.status}: ${r2.out} ${r2.err}`);
});
caso('F70.5: sem envs e sem arquivo, --todos recusa e diz as duas fontes', () => {
  const r = rodar(['--todos'], { semEnv: SEM_CONTA });
  ok(r.status === 2, `exit ${r.status}: ${r.out}`);
  ok(/CLAUDE_CODE_ACCOUNT_UUID/.test(r.err) && /conta-atual\.txt/.test(r.err), `stderr: ${r.err}`);
});
caso('F70.6: env e arquivo discordam: vale a env, com aviso em stderr', () => {
  contaVelha();
  gravarContaAtual(dir('orq', 'pool'), `${VELHA}/${ORG}\n`);
  const r = rodar(['--todos', '--conferir']);
  ok(r.status === 0 && /^E3 /m.test(r.out) && !/^E9 /m.test(r.out), `exit ${r.status} saída: ${r.out}`);
  ok(/conta-atual\.txt aponta/.test(r.err) && r.err.includes(VELHA) && r.err.includes(ACC), `stderr: ${r.err}`);
});

// F79: env parcial não vale como conta; o script avisa qual falta e segue para o arquivo.
const ACC_ENV = 'CLAUDE_CODE_ACCOUNT_UUID'; const ORG_ENV = 'CLAUDE_CODE_ORGANIZATION_UUID';
const AVISA_FALTA = /falta/;
caso('F79.1: só ACCOUNT definida, com arquivo: avisa que falta ORGANIZATION e a conta sai do arquivo', () => {
  contaVelha();
  gravarContaAtual(dir('orq', 'pool'), `${VELHA}/${ORG}\n`);
  const r = rodar(['--todos', '--conferir'], { semEnv: [ORG_ENV] });
  ok(r.status === 0, `exit ${r.status}: ${r.err}`);
  ok(/^E9 /m.test(r.out) && !/^E3 /m.test(r.out), `saída: ${r.out}`);
  ok(r.err.includes(ORG_ENV) && r.err.includes('conta-atual.txt') && AVISA_FALTA.test(r.err), `stderr: ${r.err}`);
});
caso('F79.2: só ORGANIZATION definida, com arquivo: avisa que falta ACCOUNT', () => {
  contaVelha();
  gravarContaAtual(dir('orq', 'pool'), `${VELHA}/${ORG}\n`);
  const r = rodar(['--todos', '--conferir'], { semEnv: [ACC_ENV] });
  ok(r.status === 0, `exit ${r.status}: ${r.err}`);
  ok(/^E9 /m.test(r.out) && !/^E3 /m.test(r.out), `saída: ${r.out}`);
  ok(r.err.includes(ACC_ENV) && r.err.includes('conta-atual.txt') && AVISA_FALTA.test(r.err), `stderr: ${r.err}`);
});
caso('F79.3: só ACCOUNT definida, sem arquivo: recusa dizendo que falta ORGANIZATION', () => {
  const r = rodar(['--todos'], { semEnv: [ORG_ENV] });
  ok(r.status === 2, `exit ${r.status}: ${r.out}`);
  ok(r.err.includes(ORG_ENV) && AVISA_FALTA.test(r.err), `stderr: ${r.err}`);
  ok(!r.err.includes(`faltam ${ACC_ENV}/`), `ainda diz que faltam as duas: ${r.err}`);
});
caso('F79.4: as duas envs, sem arquivo: sem aviso de falta', () => {
  contaVelha();
  // precondição: o aviso, quando existe, é detectado pela mesma regex
  gravarContaAtual(dir('orq', 'pool'), `${VELHA}/${ORG}\n`);
  const parcial = rodar(['--todos', '--conferir'], { semEnv: [ORG_ENV] });
  ok(parcial.err.trim() && AVISA_FALTA.test(parcial.err), `precondição: ${parcial.err}`);
  rmSync(dir('orq', 'pool'), { recursive: true, force: true });
  const r = rodar(['--todos', '--conferir']);
  ok(r.status === 0 && /^E3 /m.test(r.out), `exit ${r.status} saída: ${r.out} ${r.err}`);
  ok(!AVISA_FALTA.test(r.err), `stderr: ${r.err}`);
});

console.log(falhas ? `\n${falhas} caso(s) falharam` : '\ntudo ok');
process.exitCode = falhas ? 1 : 0;
