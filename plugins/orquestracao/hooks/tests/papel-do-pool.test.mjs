#!/usr/bin/env node
// Testes das travas do pool (hooks/papel-do-pool.mjs e hooks/operador-ausente.mjs, F5/24-10).
// Tudo em pasta temporária: HOME, HOOKS_CREWAI_BASE (BASE) e POOL_APP_SESSOES_DIR (registro do app).
// Rodar: node ~/.claude/hooks/tests/papel-do-pool.test.mjs   (HOOKS_DIR troca a pasta dos hooks)
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOKS = process.env.HOOKS_DIR || join(dirname(fileURLToPath(import.meta.url)), '..');
let base; let falhas = 0;
const dir = (...p) => join(base, ...p);
const BASE_ORQ = () => dir('orq');
const log = () => (existsSync(join(BASE_ORQ(), 'hooks-crewai.log')) ? readFileSync(join(BASE_ORQ(), 'hooks-crewai.log'), 'utf8') : '');

// Sessões sintéticas: id (cli) → título. O registro do app casa por sessionId (local_), cliSessionId ou prior.
const S = {
  P1: ['aaaaaaaa-0000-0000-0000-000000000001', 'P1 · planejadora · F1'],
  D1: ['aaaaaaaa-0000-0000-0000-00000000000d', 'D1 · design · livre'],
  E3: ['aaaaaaaa-0000-0000-0000-000000000003', 'E3 · executora · F5'],
  V1: ['aaaaaaaa-0000-0000-0000-0000000000a1', 'V1 · validadora · livre'],
  ORQ: ['aaaaaaaa-0000-0000-0000-0000000000f0', '🎛 orquestradora — izanagi'],
  AVULSA: ['aaaaaaaa-0000-0000-0000-0000000000f1', 'fix(web): corrige botão'],
};
function novoBase() {
  base = mkdtempSync(join(tmpdir(), 'papel-pool-'));
  mkdirSync(BASE_ORQ()); mkdirSync(dir('home', '.claude', 'projects', 'proj'), { recursive: true });
  mkdirSync(dir('app', 'conta'), { recursive: true });
  // Dois repositórios git de verdade (a trava T2 compara o git common dir do originCwd): A é o do projeto das sessões
  // de sempre; B é "outro projeto".
  for (const r of ['alfa', 'beta']) {
    mkdirSync(dir(r));
    for (const a of [['init', '-q'], ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'x']]) {
      execFileSync('git', ['-C', dir(r), ...a], { timeout: 15000, killSignal: 'SIGKILL', stdio: 'ignore' });
    }
  }
  mkdirSync(dir('semgit'));
  for (const [k, [cli, titulo]] of Object.entries(S)) {
    writeFileSync(dir('app', 'conta', `local_${k}.json`), JSON.stringify({ sessionId: `local_${k}`, cliSessionId: cli, priorCliSessionIds: [], title: titulo, isArchived: false, cwd: dir('alfa'), originCwd: dir('alfa') }));
  }
  // O alvo de archive/delete é achado pelo `local_…` ou pelo id do CLI; E1 existe só para ser alvo.
  writeFileSync(dir('app', 'conta', 'local_E1.json'), JSON.stringify({ sessionId: 'local_E1', cliSessionId: 'bbbb-e1', title: 'E1 · executora · livre', isArchived: false, cwd: dir('alfa'), originCwd: dir('alfa') }));
  // Mesmo título `E1 · livre` em outro projeto (beta), e um livre cujo repositório não resolve.
  writeFileSync(dir('app', 'conta', 'local_E1B.json'), JSON.stringify({ sessionId: 'local_E1B', cliSessionId: 'bbbb-e1b', title: 'E1 · livre', isArchived: false, cwd: dir('beta'), originCwd: dir('beta') }));
  writeFileSync(dir('app', 'conta', 'local_E1X.json'), JSON.stringify({ sessionId: 'local_E1X', cliSessionId: 'bbbb-e1x', title: 'E1 · livre', isArchived: false, cwd: dir('semgit'), originCwd: dir('semgit') }));
  writeFileSync(dir('app', 'conta', 'local_COMUM.json'), JSON.stringify({ sessionId: 'local_COMUM', cliSessionId: 'bbbb-comum', title: 'feat(web): algo', isArchived: false }));
}
function rodar(hook, evento, extraEnv = {}) {
  const out = execFileSync('node', [join(HOOKS, hook)], {
    input: typeof evento === 'string' ? evento : JSON.stringify(evento), encoding: 'utf8', timeout: 15000, killSignal: 'SIGKILL',
    env: { ...process.env, HOME: dir('home'), HOOKS_CREWAI_BASE: BASE_ORQ(), POOL_APP_SESSOES_DIR: dir('app'), ...extraEnv },
  });
  return out ? JSON.parse(out).hookSpecificOutput : null;
}
const pre = (quem, tool, tool_input, extra = {}) => rodar('papel-do-pool.mjs', { session_id: S[quem][0], hook_event_name: 'PreToolUse', tool_name: tool, tool_input, cwd: dir(), ...extra });
const agent = (quem, tipo, extra) => pre(quem, 'Agent', { subagent_type: tipo, prompt: 'x' }, extra);
const nega = (r, msg) => { if (r?.permissionDecision !== 'deny') throw new Error(`${msg}: esperava deny, veio ${JSON.stringify(r)}`); };
const passa = (r, msg) => { if (r !== null) throw new Error(`${msg}: esperava passar, veio ${JSON.stringify(r)}`); };
const ok = (c, m) => { if (!c) throw new Error(m); };

function caso(nome, fn) {
  novoBase();
  try { fn(); console.log(`ok   ${nome}`); } catch (e) { falhas++; console.log(`FAIL ${nome}\n     ${e.message}`); }
  rmSync(base, { recursive: true, force: true });
}

caso('T1: planejadora lança executor/validador → deny; explorador passa', () => {
  nega(agent('P1', 'executor'), 'P executor');
  nega(agent('P1', 'validador'), 'P validador');
  passa(agent('P1', 'explorador'), 'P explorador');
  nega(agent('D1', 'executor'), 'D executor');
});
caso('T1: subagente (agent_id) de planejadora lançando executor → deny; tool Task também', () => {
  nega(agent('P1', 'executor', { agent_id: 'sub1', agent_type: 'planejador' }), 'subagente de P');
  nega(pre('P1', 'Task', { subagent_type: 'executor' }), 'Task');
});
caso('T1: executora lança validador/executor → deny; validadora lança validador passa e executor nega', () => {
  nega(agent('E3', 'validador'), 'E validador');
  nega(agent('E3', 'executor'), 'E executor');
  passa(agent('E3', 'explorador'), 'E explorador');
  passa(agent('V1', 'validador'), 'V validador');
  nega(agent('V1', 'executor'), 'V executor');
});
caso('T1: orquestradora (título) lançando executor → deny; sessão sem prefixo passa; marcador conta', () => {
  nega(agent('ORQ', 'executor'), 'orquestradora');
  passa(agent('AVULSA', 'executor'), 'avulsa');
  mkdirSync(join(BASE_ORQ(), 'ativas')); writeFileSync(join(BASE_ORQ(), 'ativas', S.AVULSA[0]), '\n');
  nega(agent('AVULSA', 'executor'), 'marcador');
});
caso('T2: archive/delete de membro → deny; de sessão comum passa; alvo inexistente passa e loga', () => {
  nega(pre('ORQ', 'mcp__ccd_session_mgmt__archive_session', { session_id: 'local_E3' }), 'orquestradora arquiva membro OCUPADO');
  passa(pre('ORQ', 'mcp__ccd_session_mgmt__archive_session', { session_id: 'local_E1' }), 'orquestradora arquiva membro LIVRE (teto da Q214)');
  ok(log().includes('deixou-arquivar-livre'), 'sem o log deixou-arquivar-livre');
  nega(pre('P1', 'mcp__ccd_session_mgmt__archive_session', { session_id: 'local_E1' }), 'planejadora arquiva membro livre');
  nega(pre('P1', 'mcp__ccd_session_mgmt__delete_session', { session_ids: ['bbbb-e1'] }), 'delete por cli id');
  nega(pre('P1', 'mcp__ccd_session_mgmt__delete_session', { session_ids: ['local_COMUM', 'local_E1'] }), 'delete com dois alvos, só um membro');
  passa(pre('P1', 'mcp__ccd_session_mgmt__delete_session', { session_ids: ['local_COMUM', 'local_NAOEXISTE'] }), 'delete só de não membros');
  passa(pre('ORQ', 'mcp__ccd_session_mgmt__archive_session', { session_id: 'local_COMUM' }), 'comum');
  passa(pre('ORQ', 'mcp__ccd_session_mgmt__archive_session', { session_id: 'local_NAOEXISTE' }), 'inexistente');
  ok(log().includes('alvo-desconhecido'), 'sem o log alvo-desconhecido');
});
// Orquestradora ativa de outro projeto: marcador em ativas/ (conteúdo = git common dir) + transcript recente.
function orquestradoraDe(repo, id = 'cccccccc-0000-0000-0000-000000000001') {
  mkdirSync(join(BASE_ORQ(), 'ativas'), { recursive: true });
  writeFileSync(join(BASE_ORQ(), 'ativas', id), `${realpathSync(dir(repo))}/.git\n`);
  writeFileSync(dir('home', '.claude', 'projects', 'proj', `${id}.jsonl`), `${JSON.stringify({ type: 'user', cwd: dir(repo) })}\n`);
}
const arquiva = (quem, alvo) => pre(quem, 'mcp__ccd_session_mgmt__archive_session', { session_id: alvo });
caso('T2 entre projetos: livre de A passa; livre de B COM orquestradora própria → deny "outro projeto"; repo que não resolve → deny', () => {
  orquestradoraDe('beta');
  passa(arquiva('ORQ', 'local_E1'), 'livre do mesmo projeto');
  const r = arquiva('ORQ', 'local_E1B');
  nega(r, 'livre de outro projeto com orquestradora');
  ok(/outro projeto/.test(r.permissionDecisionReason), `motivo sem "outro projeto": ${r.permissionDecisionReason}`);
  nega(arquiva('ORQ', 'local_E1X'), 'livre sem repositório');
});
caso('T2 projeto SEM orquestradora própria: orquestradora de A arquiva livre de B → passa; repo do alvo indeterminado → deny', () => {
  passa(arquiva('ORQ', 'local_E1B'), 'livre de B sem orquestradora');
  nega(arquiva('ORQ', 'local_E1X'), 'livre sem repositório');
});
caso('T2 repo indeterminado dos DOIS lados → deny', () => {
  writeFileSync(dir('app', 'conta', 'local_ORQ.json'), JSON.stringify({ sessionId: 'local_ORQ', cliSessionId: S.ORQ[0], title: S.ORQ[1], isArchived: false, cwd: dir('semgit'), originCwd: dir('semgit') }));
  nega(arquiva('ORQ', 'local_E1X'), 'sem git dos dois lados');
});
// c2 (R2 da V1): "não consegui medir se o projeto do alvo tem orquestradora" nunca vira "não tem" — deny.
// Cada caso monta UMA orquestradora de beta que a regra não consegue medir por inteiro; o mundo sem orquestradora de beta passa.
import { utimesSync, rmSync as rm } from 'node:fs';
const marcador = (id, texto, { transcript = true, cwd = dir('beta') } = {}) => {
  mkdirSync(join(BASE_ORQ(), 'ativas'), { recursive: true });
  writeFileSync(join(BASE_ORQ(), 'ativas', id), texto);
  if (transcript) writeFileSync(dir('home', '.claude', 'projects', 'proj', `${id}.jsonl`), `${JSON.stringify({ type: 'user', cwd })}\n`);
};
const BID = 'cccccccc-0000-0000-0000-0000000000b1';
const gitB = () => `${realpathSync(dir('beta'))}/.git`;
caso('R2: marcador de beta vazio com o cwd do transcript apagado → deny', () => {
  passa(arquiva('ORQ', 'local_E1B'), 'precondição: sem orquestradora de beta passa');
  marcador(BID, '\n', { cwd: dir('apagado') });
  nega(arquiva('ORQ', 'local_E1B'), 'cwd sumido');
});
caso('R2: marcador com barra final ou com o texto `null` é lido como o resto (barra sai; null = vazio)', () => {
  marcador(BID, `${gitB()}/\n`);
  nega(arquiva('ORQ', 'local_E1B'), 'barra final: é o repo de beta');
  marcador(BID, 'null\n');
  nega(arquiva('ORQ', 'local_E1B'), '`null` com cwd em beta resolve para beta');
  marcador(BID, 'null\n', { cwd: dir('apagado') });
  nega(arquiva('ORQ', 'local_E1B'), '`null` sem cwd: não deu para medir');
});
caso('R2: transcript com mais de 7 dias ou marcador sem transcript, do repo de beta → deny (não dá para dizer que morreu)', () => {
  marcador(BID, `${gitB()}\n`);
  const t = dir('home', '.claude', 'projects', 'proj', `${BID}.jsonl`);
  const velho = (Date.now() - 8 * 24 * 3600 * 1000) / 1000;
  utimesSync(t, velho, velho);
  nega(arquiva('ORQ', 'local_E1B'), 'transcript velho');
  rm(t);
  nega(arquiva('ORQ', 'local_E1B'), 'sem transcript');
});
caso('R2: marcador velho ou sem transcript de OUTRO repositório (alfa) não atrapalha beta → passa', () => {
  marcador(BID, `${realpathSync(dir('alfa'))}/.git\n`, { transcript: false });
  passa(arquiva('ORQ', 'local_E1B'), 'repo conhecido e diferente: não é indeterminação');
});
caso('R2: orquestradora de beta reconhecida só pelo título (sem marcador) → deny; arquivada não conta', () => {
  const reg = { sessionId: 'local_ORQB', cliSessionId: 'dddd-orqb', title: '🎛 orquestradora — beta', isArchived: false, cwd: dir('beta'), originCwd: dir('beta') };
  writeFileSync(dir('app', 'conta', 'local_ORQB.json'), JSON.stringify(reg));
  nega(arquiva('ORQ', 'local_E1B'), 'só pelo título');
  writeFileSync(dir('app', 'conta', 'local_ORQB.json'), JSON.stringify({ ...reg, isArchived: true }));
  passa(arquiva('ORQ', 'local_E1B'), 'orquestradora arquivada não conta');
});
caso('R2: ~/.claude/projects ilegível não libera (deny), e continua passando sem marcador nenhum', () => {
  passa(arquiva('ORQ', 'local_E1B'), 'precondição');
  marcador(BID, `${gitB()}\n`);
  rm(dir('home', '.claude', 'projects'), { recursive: true });
  nega(arquiva('ORQ', 'local_E1B'), 'projects sumiu');
});
caso('K2 T1: `orquestracao:executor`/`orquestracao:validador` valem como `executor`/`validador`', () => {
  nega(agent('P1', 'orquestracao:executor'), 'P executor com prefixo');
  nega(agent('P1', 'orquestracao:validador'), 'P validador com prefixo');
  passa(agent('P1', 'orquestracao:explorador'), 'P explorador com prefixo');
  nega(agent('E3', 'orquestracao:validador'), 'E validador com prefixo');
  nega(agent('E3', 'orquestracao:executor'), 'E executor com prefixo');
  passa(agent('V1', 'orquestracao:validador'), 'V validador com prefixo');
  nega(agent('V1', 'orquestracao:executor'), 'V executor com prefixo');
});
caso('K2 T5: gravar o painel pelo comando `painel` (bin do plugin) e pelo caminho antigo, os dois', () => {
  const nega5 = (r) => nega(r, 'T5');
  nega5(pre('E3', 'Write', { file_path: join(BASE_ORQ(), 'painel', 'sessoes', 'x.json'), content: '{}' }));
});
const bandeira = (desde, frase = '/ausente on') => writeFileSync(join(BASE_ORQ(), 'operador-ausente.json'), JSON.stringify({ desde: new Date(desde).toISOString(), frase, sessionId: 'x' }));
function transcriptCom(inicio, origem = 'peer') {
  const f = dir('t.jsonl');
  writeFileSync(f, `${JSON.stringify({ type: 'user', timestamp: new Date(inicio).toISOString(), origin: { kind: origem }, message: { role: 'user', content: 'item' } })}\n`);
  return { transcript_path: f };
}
const start = (quem, extra) => pre(quem, 'mcp__ccd_session__start_session', { prompt: 'x' }, extra);
caso('T2: archive/delete de "self" por membro → deny; por sessão comum passa', () => {
  nega(pre('E3', 'mcp__ccd_session_mgmt__archive_session', { session_id: 'self' }), 'E3 arquiva self');
  nega(pre('V1', 'mcp__ccd_session_mgmt__delete_session', { session_ids: ['self'] }), 'V1 deleta self');
  passa(pre('AVULSA', 'mcp__ccd_session_mgmt__archive_session', { session_id: 'self' }), 'avulsa arquiva self');
});
caso('T3a: modo ausente e turno que NÃO é do operador → start_session nega, até para a orquestradora', () => {
  bandeira(Date.now() - 3600_000);
  nega(start('ORQ', transcriptCom(Date.now() - 60_000, 'peer')), 'orquestradora em turno de outra sessão');
  nega(start('AVULSA', transcriptCom(Date.now() - 60_000, 'task-notification')), 'avulsa em notificação');
});
caso('T3a: modo ausente e turno do OPERADOR passa (ele veio, deu um comando)', () => {
  bandeira(Date.now() - 3600_000);
  passa(start('ORQ', transcriptCom(Date.now() - 60_000, 'human')), 'turno humano');
});
caso('T3a: com o modo ausente, o cartão (own_initiative) da orquestradora passa', () => {
  bandeira(Date.now() - 3600_000);
  passa(pre('ORQ', 'mcp__ccd_session__start_session', { prompt: 'x', initiation: 'own_initiative' }, transcriptCom(Date.now() - 60_000)), 'cartão');
  nega(pre('ORQ', 'mcp__ccd_session__start_session', { prompt: 'x', initiation: 'user_asked' }, transcriptCom(Date.now() - 60_000)), 'abre direto');
});
caso('T3a: bandeira de 3 dias continua valendo (sem prazo; só /ausente off desliga)', () => {
  bandeira(Date.now() - 72 * 3600_000);
  nega(start('ORQ', transcriptCom(Date.now() - 60_000)), 'bandeira velha');
});
caso('T3b: sem bandeira, orquestradora passa e P1 nega', () => {
  passa(start('ORQ'), 'orquestradora');
  nega(start('P1'), 'P1');
  nega(start('E3'), 'E3');
  passa(start('AVULSA'), 'avulsa sem prefixo');
});
caso('T1c: validadora edita arquivo do projeto → deny; ~/.claude e side-session-notes passam; E edita o projeto', () => {
  nega(pre('V1', 'Edit', { file_path: '/repo/apps/web/x.ts' }), 'V no repo');
  nega(pre('V1', 'Write', { file_path: '/repo/apps/web/y.ts' }, { agent_id: 's' }), 'subagente de V');
  passa(pre('V1', 'Write', { file_path: join(dir('home'), '.claude', 'notas.md') }), 'V em ~/.claude');
  passa(pre('V1', 'Write', { file_path: join(dir('home'), 'Library', 'Application Support', 'Claude', 'side-session-notes', 'a', 'n.md') }), 'V em side-session-notes');
  passa(pre('E3', 'Edit', { file_path: '/repo/apps/web/x.ts' }), 'E no repo');
});
caso('T5: Edit/Write em <BASE>/painel/ → deny para qualquer sessão; outro arquivo da BASE passa', () => {
  nega(pre('P1', 'Edit', { file_path: join(BASE_ORQ(), 'painel', 'sessoes', 'x.json') }), 'P1');
  nega(pre('ORQ', 'Write', { file_path: join(BASE_ORQ(), 'painel', 'fila', 'F1.json') }), 'orquestradora');
  passa(pre('P1', 'Edit', { file_path: join(BASE_ORQ(), 'izanagi.md') }), 'outro arquivo');
});

// T6 precisa de repositório git real e do transcript da orquestradora no HOME temporário.
function repoComOrquestradora() {
  const repo = dir('repo'); mkdirSync(repo);
  execFileSync('git', ['init', '-q', repo], { timeout: 10000, killSignal: 'SIGKILL' });
  const comum = execFileSync('git', ['-C', repo, 'rev-parse', '--path-format=absolute', '--git-common-dir'], { encoding: 'utf8', timeout: 10000, killSignal: 'SIGKILL' }).trim();
  ok(comum.length > 0 && realpathSync(repo).length > 0, 'precondição: git common dir vazio');
  writeFileSync(join(dir('home'), '.claude', 'projects', 'proj', `${S.ORQ[0]}.jsonl`), `${JSON.stringify({ type: 'user', cwd: repo })}\n`);
  mkdirSync(join(BASE_ORQ(), 'ativas'), { recursive: true }); writeFileSync(join(BASE_ORQ(), 'ativas', S.ORQ[0]), `${comum}\n`);
  return repo;
}
const merge = (quem, repo, cmd = 'gh pr merge 12 --squash') => pre(quem, 'Bash', { command: cmd }, { cwd: repo });
caso('T6: P1 com gh pr merge em repo com orquestradora ativa → ask; a própria orquestradora e gh pr view passam', () => {
  const repo = repoComOrquestradora();
  const r = merge('P1', repo);
  ok(r?.permissionDecision === 'ask', `esperava ask: ${JSON.stringify(r)}`);
  passa(merge('ORQ', repo), 'orquestradora');
  passa(merge('P1', repo, 'gh pr view 12'), 'gh pr view');
});
caso('T6: gh com flags antes de pr merge → ask; gh pr view seguido de echo merge passa', () => {
  const repo = repoComOrquestradora();
  const r = merge('P1', repo, 'gh -R dono/repo pr merge 1');
  ok(r?.permissionDecision === 'ask', `esperava ask: ${JSON.stringify(r)}`);
  passa(merge('P1', repo, 'gh pr view 1; echo merge'), 'view; echo merge');
});
caso('T6: não consegui medir o projeto (marcador sem transcript) → ask; mutante: tratar null como "não" passa', () => {
  const repo = repoComOrquestradora();
  rmSync(join(dir('home'), '.claude', 'projects', 'proj', `${S.ORQ[0]}.jsonl`));
  ok(!existsSync(join(dir('home'), '.claude', 'projects', 'proj', `${S.ORQ[0]}.jsonl`)), 'precondição: transcript saiu');
  ok(existsSync(join(BASE_ORQ(), 'ativas', S.ORQ[0])), 'precondição: marcador ficou');
  const r = merge('P1', repo);
  ok(r?.permissionDecision === 'ask', `esperava ask: ${JSON.stringify(r)}`);
  ok(/conferir/.test(r.permissionDecisionReason), `motivo: ${r.permissionDecisionReason}`);
  passa(merge('P1', repo, 'gh pr view 1'), 'gh pr view');
});
caso('T6: sem orquestradora ativa no repositório → passa', () => {
  const repo = dir('repo'); mkdirSync(repo);
  execFileSync('git', ['init', '-q', repo], { timeout: 10000, killSignal: 'SIGKILL' });
  passa(merge('P1', repo), 'sem orquestradora');
});
caso('entrada quebrada sai 0, sem saída, erro no log', () => {
  passa(rodar('papel-do-pool.mjs', '{nao json'), 'saída');
  ok(log().includes('\terro\t'), 'sem erro no log');
});
const ent = (prompt, extra = {}) => rodar('operador-ausente.mjs', { session_id: 'x', hook_event_name: 'UserPromptSubmit', prompt, ...extra });
const bandeiraArq = () => join(BASE_ORQ(), 'operador-ausente.json');
const EXP = (args) => `<command-name>/ausente</command-name>\n            <command-message>ausente</command-message>\n            <command-args>${args}</command-args>`;
caso('operador-ausente: /ausente on liga e /ausente off desliga (cru e expandido)', () => {
  ent('/ausente on'); ok(existsSync(bandeiraArq()), 'on cru não ligou');
  ent('/ausente off'); ok(!existsSync(bandeiraArq()), 'off cru não desligou');
  ent(EXP('on')); ok(existsSync(bandeiraArq()), 'on expandido não ligou');
  ent(EXP('off')); ok(!existsSync(bandeiraArq()), 'off expandido não desligou');
  ok(log().includes('ausente-on') && log().includes('ausente-off'), 'sem o log');
});
caso('operador-ausente: prompt comum e frase de ausência NÃO mexem', () => {
  ent('vou dormir'); ok(!existsSync(bandeiraArq()), 'frase ligou');
  ent('/ausente on');
  ent('voltei, mergeia o #1108'); ok(existsSync(bandeiraArq()), 'prompt comum desligou');
  ent('/ausente'); ok(existsSync(bandeiraArq()), '/ausente sem argumento desligou');
  ent(EXP('')); ok(existsSync(bandeiraArq()), 'expandido sem argumento desligou');
  ent('não saia do /ausente off ainda'); ok(existsSync(bandeiraArq()), 'citação no meio desligou');
});
caso('operador-ausente: outra sessão, notificação, compactação e lembrete não mexem', () => {
  ent('<cross-session-message from="local_x">/ausente on</cross-session-message>'); ok(!existsSync(bandeiraArq()), 'peer ligou');
  ent('/ausente on', { turnOrigin: 'peer' }); ok(!existsSync(bandeiraArq()), 'turnOrigin peer ligou');
  ent('<system-reminder>x</system-reminder>\n/ausente on'); ok(existsSync(bandeiraArq()), 'lembrete escondeu o humano');
  ent('<task-notification>/ausente off</task-notification>'); ok(existsSync(bandeiraArq()), 'notificação desligou');
  ent('This session is being continued from a previous conversation… /ausente off'); ok(existsSync(bandeiraArq()), 'compactação desligou');
});

console.log(falhas ? `\n${falhas} FALHA(S)` : '\ntodos verdes');
process.exitCode = falhas ? 1 : 0;
