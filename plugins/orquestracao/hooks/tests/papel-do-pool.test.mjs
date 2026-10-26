#!/usr/bin/env node
// Testes das travas do pool (hooks/papel-do-pool.mjs e hooks/operador-ausente.mjs, F5/24-10).
// Tudo em pasta temporária: HOME, HOOKS_CREWAI_BASE (BASE) e POOL_APP_SESSOES_DIR (registro do app).
// Rodar: node ~/.claude/hooks/tests/papel-do-pool.test.mjs   (HOOKS_DIR troca a pasta dos hooks)
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOKS = process.env.HOOKS_DIR || join(dirname(fileURLToPath(import.meta.url)), '..');
let base; let falhas = 0; let FILA = null;
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
  FILA = dir('fila'); mkdirSync(FILA);
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
    env: { ...process.env, HOME: dir('home'), HOOKS_CREWAI_BASE: BASE_ORQ(), POOL_APP_SESSOES_DIR: dir('app'), PAINEL_DIR: dir('painel'), ...(FILA ? { FILA_DIR: FILA } : {}), ...extraEnv },
  });
  return out ? JSON.parse(out).hookSpecificOutput : null;
}
// Turno aberto pelo operador (origem `human`) / por mensagem de outra sessão: o T2 olha a origem (Q245).
function humano() { return transcriptCom(Date.now() - 60_000, 'human'); }
function depeer() { return transcriptCom(Date.now() - 60_000, 'peer'); }
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
  const A = (quem, alvo, extra = humano()) => pre(quem, 'mcp__ccd_session_mgmt__archive_session', { session_id: alvo }, extra);
  passa(A('ORQ', 'local_E3'), 'Q245: orquestradora, turno humano, alvo com título de trabalho (E3 ocupado) → passa');
  passa(A('ORQ', 'local_E1'), 'Q245: orquestradora, turno humano, alvo `· livre` → passa');
  ok(log().includes('deixou-arquivar-por-comando'), 'sem o log deixou-arquivar-por-comando');
  // D8: sem a bandeira e sem item vivo, a orquestradora arquiva sozinha em qualquer turno (era `nega`).
  passa(A('ORQ', 'local_E1', depeer()), 'D8: turno de peer, alvo fora de todo item → passa');
  ok(log().includes('arquivou-sozinha'), 'sem o log arquivou-sozinha');
  passa(A('ORQ', 'local_E3', depeer()), 'D8: o título de trabalho não importa, só o item vivo');
  passa(A('ORQ', 'local_E1', {}), 'D8: transcript ausente passa');
  nega(A('P1', 'local_E1'), 'Q245: planejadora em turno humano nega');
  // B1: o turno do operador e, DEPOIS dele, um aberto por outra sessão (meta com origem): vale o último.
  const humanoEDepoisPeer = () => transcriptDe([Date.now() - 120_000, 'human'], [Date.now() - 60_000, 'peer']);
  passa(A('ORQ', 'local_E1', humanoEDepoisPeer()), 'B1: sem bandeira e sem item vivo passa em qualquer origem');
  passa(A('ORQ', 'local_E1', transcriptDe([Date.now() - 120_000, 'peer'], [Date.now() - 60_000, 'human'])), 'B1: humano depois de peer passa');
  passa(A('ORQ', 'local_E1', transcriptCom(Date.now() - 60_000, 'plugin')), 'D8: origem plugin cai nas regras de bandeira e item');
  nega(pre('P1', 'mcp__ccd_session_mgmt__delete_session', { session_ids: ['bbbb-e1'] }, humano()), 'delete por cli id');
  nega(pre('P1', 'mcp__ccd_session_mgmt__delete_session', { session_ids: ['local_COMUM', 'local_E1'] }, humano()), 'delete com dois alvos, só um membro');
  passa(pre('P1', 'mcp__ccd_session_mgmt__delete_session', { session_ids: ['local_COMUM', 'local_NAOEXISTE'] }), 'delete só de não membros');
  passa(A('ORQ', 'local_COMUM'), 'comum');
  passa(A('ORQ', 'local_NAOEXISTE'), 'inexistente');
  ok(log().includes('alvo-desconhecido'), 'sem o log alvo-desconhecido');
});
// Orquestradora ativa de outro projeto: marcador em ativas/ (conteúdo = git common dir) + transcript recente.
function orquestradoraDe(repo, id = 'cccccccc-0000-0000-0000-000000000001') {
  mkdirSync(join(BASE_ORQ(), 'ativas'), { recursive: true });
  writeFileSync(join(BASE_ORQ(), 'ativas', id), `${realpathSync(dir(repo))}/.git\n`);
  writeFileSync(dir('home', '.claude', 'projects', 'proj', `${id}.jsonl`), `${JSON.stringify({ type: 'user', cwd: dir(repo) })}\n`);
}
const arquiva = (quem, alvo, extra = humano()) => pre(quem, 'mcp__ccd_session_mgmt__archive_session', { session_id: alvo }, extra);
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
// A forma REAL de cada origem no transcript: o humano é uma linha comum; mensagem entre sessões, notificação e a
// resposta do painel são `isMeta: true` COM origem (medido em transcripts de verdade, 25/10).
function linhaDeTurno(inicio, origem) { return { type: 'user', timestamp: new Date(inicio).toISOString(), ...(origem === 'human' ? {} : { isMeta: true }), origin: { kind: origem }, message: { role: 'user', content: origem === 'peer' ? '<cross-session-message from="local_x">item</cross-session-message>' : 'item' } }; }
function transcriptDe(...turnos) {
  const f = dir('t.jsonl');
  writeFileSync(f, turnos.map(([inicio, origem]) => JSON.stringify(linhaDeTurno(inicio, origem))).join('\n') + '\n');
  return { transcript_path: f };
}
function transcriptCom(inicio, origem = 'peer') { return transcriptDe([inicio, origem]); }
const start = (quem, extra) => pre(quem, 'mcp__ccd_session__start_session', { prompt: 'x' }, extra);
caso('T2: archive/delete de "self" por membro → deny; por sessão comum passa', () => {
  nega(pre('E3', 'mcp__ccd_session_mgmt__archive_session', { session_id: 'self' }), 'E3 arquiva self');
  nega(pre('V1', 'mcp__ccd_session_mgmt__delete_session', { session_ids: ['self'] }), 'V1 deleta self');
  passa(pre('AVULSA', 'mcp__ccd_session_mgmt__archive_session', { session_id: 'self' }), 'avulsa arquiva self');
});
const fila = (id, data) => writeFileSync(join(FILA, `${id}.json`), JSON.stringify({ id, version: 1, data: { titulo: 't', ...data } }));
caso('D8.1: modo ausente ligado → a orquestradora não arquiva fora do turno do operador; no turno dele passa', () => {
  bandeira(Date.now() - 3600_000);
  const r = arquiva('ORQ', 'local_E1', depeer());
  nega(r, 'bandeira + peer');
  ok(/ausente/.test(r.permissionDecisionReason), `motivo sem "ausente": ${r.permissionDecisionReason}`);
  passa(arquiva('ORQ', 'local_E1', humano()), 'bandeira + turno humano passa');
});
caso('D8.2: alvo no com/fez/dono de item vivo → deny citando o item; o mesmo item em feito passa', () => {
  for (const [campo, data] of [['com', { com: [{ localId: 'local_E3', apelido: 'E3' }] }], ['fez', { fez: [{ localId: 'local_E3', apelido: 'E3' }] }], ['dono', { donoLocalId: 'local_E3' }]]) {
    fila('F5', { etapa: 'planejamento', ...data });
    const r = arquiva('ORQ', 'local_E3', depeer());
    nega(r, `${campo} de item vivo`);
    ok(/F5/.test(r.permissionDecisionReason), `${campo}: motivo sem F5: ${r.permissionDecisionReason}`);
    fila('F5', { etapa: 'feito', ...data });
    passa(arquiva('ORQ', 'local_E3', depeer()), `${campo} com o item em feito passa`);
  }
});
caso('D8.3: fila que não se lê (arquivo no lugar da pasta) → deny com o motivo da fila', () => {
  const arq = dir('fila-arquivo'); writeFileSync(arq, 'x'); FILA = arq;
  const r = arquiva('ORQ', 'local_E1', depeer());
  nega(r, 'fila ilegível');
  ok(/fila/.test(r.permissionDecisionReason), `motivo sem "fila": ${r.permissionDecisionReason}`);
});
caso('D8.4: projeto — turno peer, sem bandeira, livre de B com orquestradora própria → deny "outro projeto"', () => {
  orquestradoraDe('beta');
  const r = arquiva('ORQ', 'local_E1B', depeer());
  nega(r, 'outro projeto');
  ok(/outro projeto/.test(r.permissionDecisionReason), `motivo: ${r.permissionDecisionReason}`);
});
caso('D8.5: planejadora em turno peer continua negada (P1)', () => {
  nega(arquiva('P1', 'local_E1', depeer()), 'P1 arquiva');
});
caso('D8.6: doc × código — protocolo e skill da orquestradora citam Q277 e não mandam mais "arquive só quando ele mandar"', () => {
  const raiz = join(HOOKS, '..');
  for (const f of ['pool/protocolo.md', 'skills/orquestradora/SKILL.md']) {
    const t = readFileSync(join(raiz, f), 'utf8');
    ok(t.length > 0 && t.includes('Q277'), `${f} sem Q277`);
    ok(!t.includes('arquive só quando ele mandar'), `${f} ainda manda arquivar só por comando`);
  }
  // A1: a regra velha (só com o comando do operador, pergunta de arquivar) não pode sobrar em doc nem no ritual.
  for (const f of ['pool/protocolo.md', 'skills/orquestradora/SKILL.md', 'pool/papeis/orquestradora.md', 'hooks/orquestradora-ritual.mjs']) {
    const t = readFileSync(join(raiz, f), 'utf8');
    ok(t.length > 0, `${f} vazio`);
    for (const velho of ['comando do operador', 'pergunta de arquivar', 'não conta no teto']) ok(!t.includes(velho), `${f} ainda tem "${velho}"`);
  }
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
caso('T3a B1: modo ausente, turno humano seguido de turno aberto por peer (meta com origem) → start_session nega', () => {
  bandeira(Date.now() - 3600_000);
  nega(start('ORQ', transcriptDe([Date.now() - 120_000, 'human'], [Date.now() - 60_000, 'peer'])), 'B1: peer depois de humano');
  passa(start('ORQ', transcriptDe([Date.now() - 120_000, 'peer'], [Date.now() - 60_000, 'human'])), 'B1: humano depois de peer');
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


// F48 · T7: a orquestradora só se limpa inteira com o ok do operador (turno humano, modo ausente ou o sim do painel).
const limpa = (quem, extra, alvo = 'self') => pre(quem, 'mcp__ccd_session_mgmt__clear_session', { session_id: alvo }, extra);
const perguntaLimpar = (data) => { mkdirSync(dir('painel', 'perguntas'), { recursive: true }); writeFileSync(dir('painel', 'perguntas', 'Q9.json'), JSON.stringify({ id: 'Q9', data })); };
const haMin = (m) => new Date(Date.now() - m * 60_000).toISOString();
const OKP = (extra = {}) => ({ titulo: 'limpar · orquestradora', sessaoId: 'local_ORQ', estado: 'respondida', respondidaPor: 'painel', resposta: 'sim (segue a recomendação)', respondidaEm: haMin(10), atualizadoEm: haMin(10), ...extra });
const nega7 = (r, msg) => { nega(r, msg); ok(/T7/.test(JSON.stringify(r)) || /Limpeza inteira/.test(r.permissionDecisionReason), `${msg}: negou, mas não pelo T7: ${r.permissionDecisionReason}`); };
caso('T7: orquestradora clear_session "self" em turno peer, sem bandeira nem pergunta → nega; em turno humano passa', () => {
  nega7(limpa('ORQ', depeer()), 'peer');
  passa(limpa('ORQ', humano()), 'humano');
  ok(log().includes('liberou-limpeza'), 'sem o log liberou-limpeza');
});
caso('T7: o alvo é a própria sessão por qualquer nome (local_ e session_id); o log grava o alvo real', () => {
  nega7(limpa('ORQ', depeer(), 'local_ORQ'), 'alvo local_ORQ');
  ok(/T7 .*local_ORQ/.test(log()), `log sem o alvo real: ${log()}`);
  nega7(limpa('ORQ', depeer(), S.ORQ[0]), 'alvo session_id');
  nega7(limpa('ORQ', depeer(), 'self'), 'alvo self');
  passa(limpa('ORQ', depeer(), 'local_E1'), 'membro (o contraste: o teste mede a presença)');
});
caso('T7: modo ausente ligado libera; {ligado:false} nega', () => {
  bandeira(Date.now() - 3600_000);
  passa(limpa('ORQ', depeer()), 'bandeira ligada');
  writeFileSync(join(BASE_ORQ(), 'operador-ausente.json'), JSON.stringify({ ligado: false, desligadoEm: new Date().toISOString(), por: 'painel' }));
  nega7(limpa('ORQ', depeer()), 'bandeira ligado:false');
});
caso('T7: o sim do painel libera (≤ 30 min, respondidaPor painel, resposta sim, sessaoId dela); o resto nega', () => {
  perguntaLimpar(OKP());
  passa(limpa('ORQ', depeer()), 'sim do painel');
  perguntaLimpar(OKP({ respondidaPor: undefined })); nega7(limpa('ORQ', depeer()), 'sem respondidaPor');
  perguntaLimpar(OKP({ respondidaEm: haMin(40), atualizadoEm: new Date().toISOString() })); nega7(limpa('ORQ', depeer()), 'respondidaEm há 40 min com atualizadoEm de agora');
  perguntaLimpar(OKP({ respondidaEm: undefined })); nega7(limpa('ORQ', depeer()), 'sem respondidaEm');
  perguntaLimpar(OKP({ respondidaEm: new Date(Date.now() + 3600_000).toISOString() })); nega7(limpa('ORQ', depeer()), 'respondidaEm no futuro');
  perguntaLimpar(OKP({ atualizadoEm: '2099-01-01T00:00:00.000Z', respondidaEm: haMin(180) })); nega7(limpa('ORQ', depeer()), 'atualizadoEm no futuro');
  perguntaLimpar(OKP({ resposta: 'não' })); nega7(limpa('ORQ', depeer()), 'resposta não');
  perguntaLimpar(OKP({ sessaoId: 'local_P1' })); nega7(limpa('ORQ', depeer()), 'sessaoId de outra');
  perguntaLimpar(OKP({ titulo: 'outra coisa' })); nega7(limpa('ORQ', depeer()), 'título que não é de limpeza');
  perguntaLimpar(OKP({ titulo: 'limpar · worktrees órfãos' })); nega7(limpa('ORQ', depeer()), 'M1: outra pergunta `limpar · …`');
  perguntaLimpar(OKP({ titulo: ' limpar · orquestradora ' })); passa(limpa('ORQ', depeer()), 'título exato com espaços nas pontas');
});
caso('T7: orquestradora limpando um membro passa; P1 limpando "self" passa', () => {
  passa(limpa('ORQ', depeer(), 'local_E1'), 'orquestradora limpa membro');
  passa(limpa('P1', depeer()), 'P1 self');
});
// Ponta a ponta (V2): o painel.mjs de verdade grava e o papel-do-pool.mjs de verdade decide.
const PAINEL_MJS = join(HOOKS, '..', 'skills', 'orquestradora', 'scripts', 'painel.mjs');
const painelCli = (...args) => spawnSync('node', [PAINEL_MJS, ...args], { encoding: 'utf8', timeout: 10000, killSignal: 'SIGKILL', env: { ...process.env, PAINEL_DIR: dir('painel'), CLAUDE_CODE_SESSION_ID: '', POOL_APP_SESSOES_DIR: dir('app'), HOOKS_CREWAI_BASE: BASE_ORQ(), HOME: dir('home') } });
const viaCli = (...args) => { const r = painelCli(...args); ok(r.status === 0, `painel ${args.join(' ')} saiu ${r.status}: ${r.stderr}`); };
caso('T7 ponta a ponta: "sim" de 3 h + nota → nega; "sim" de outra pergunta + troca de título → nega; atualizadoEm futuro → nega; "sim" de 5 min + regravação da skill → passa', () => {
  perguntaLimpar(OKP({ respondidaEm: haMin(180), atualizadoEm: haMin(180) }));
  nega7(limpa('ORQ', depeer()), 'precondição: sim de 3 h nega');
  viaCli('update', 'perguntas', 'Q9', '{"nota":"x"}');
  nega7(limpa('ORQ', depeer()), 'sim de 3 h + nota');
  viaCli('update', 'perguntas', 'Q9', '{"atualizadoEm":"2099-01-01T00:00:00.000Z"}');
  nega7(limpa('ORQ', depeer()), 'atualizadoEm no futuro');
  perguntaLimpar(OKP({ titulo: 'merge · PR 9', respondidaEm: haMin(5), atualizadoEm: haMin(5) }));
  nega7(limpa('ORQ', depeer()), 'precondição: sim de outra pergunta nega');
  viaCli('update', 'perguntas', 'Q9', '{"titulo":"limpar · orquestradora"}');
  nega7(limpa('ORQ', depeer()), 'sim de outra pergunta + troca de título');
  perguntaLimpar(OKP({ respondidaEm: haMin(5), atualizadoEm: haMin(5) }));
  passa(limpa('ORQ', depeer()), 'contraste: sim de 5 min');
  viaCli('update', 'perguntas', 'Q9', '{"estado":"respondida","resposta":"sim (segue a recomendação)"}');
  passa(limpa('ORQ', depeer()), 'sim de 5 min + regravação da skill');
});
caso('T3a: bandeira {ligado:false} vale como desligada → start_session em turno peer passa', () => {
  writeFileSync(join(BASE_ORQ(), 'operador-ausente.json'), JSON.stringify({ ligado: false, desligadoEm: new Date().toISOString(), por: 'painel', desde: new Date().toISOString() }));
  passa(start('ORQ', transcriptCom(Date.now() - 60_000, 'peer')), 'desligada');
});
caso('operador-ausente: /ausente on grava por:"comando"', () => {
  ent('/ausente on'); ok(JSON.parse(readFileSync(bandeiraArq(), 'utf8')).por === 'comando', 'sem por:comando');
});

console.log(falhas ? `\n${falhas} FALHA(S)` : '\ntodos verdes');
process.exitCode = falhas ? 1 : 0;
