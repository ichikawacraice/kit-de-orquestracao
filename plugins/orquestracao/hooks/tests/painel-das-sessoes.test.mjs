#!/usr/bin/env node
// Testes do Stop hook painel-das-sessoes.mjs, na parte do Qnn: só conta a pergunta que é DESTA sessão
// (perguntas/<Qnn>.json com `sessaoId` igual ao local_… dela). HOME, painel e registro do app em pasta temporária.
// Rodar: node ~/.claude/hooks/tests/painel-das-sessoes.test.mjs   (HOOKS_DIR troca a pasta dos hooks)
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOKS = process.env.HOOKS_DIR || join(dirname(fileURLToPath(import.meta.url)), '..');
const SID = 'cccccccc-0000-0000-0000-000000000001';
const LOCAL = 'local_MINHA';
const ORQ = 'dddddddd-0000-0000-0000-000000000002';
let base; let falhas = 0;
const dir = (...p) => join(base, ...p);

function novoBase() {
  base = mkdtempSync(join(tmpdir(), 'painel-sessoes-'));
  const repo = dir('repo'); mkdirSync(repo);
  execFileSync('git', ['init', '-q', repo], { timeout: 10000, killSignal: 'SIGKILL' });
  const comum = execFileSync('git', ['-C', repo, 'rev-parse', '--path-format=absolute', '--git-common-dir'], { encoding: 'utf8', timeout: 10000, killSignal: 'SIGKILL' }).trim();
  mkdirSync(dir('home', '.claude', 'projects', 'proj'), { recursive: true });
  mkdirSync(dir('home', '.claude', 'orquestracao', 'ativas'), { recursive: true });
  // Orquestradora de OUTRA sessão no mesmo repositório: é o que faz o hook valer.
  writeFileSync(dir('home', '.claude', 'projects', 'proj', `${ORQ}.jsonl`), `${JSON.stringify({ type: 'user', cwd: repo })}\n`);
  writeFileSync(dir('home', '.claude', 'orquestracao', 'ativas', ORQ), `${comum}\n`);
  mkdirSync(dir('app', 'conta'), { recursive: true });
  writeFileSync(dir('app', 'conta', `${LOCAL}.json`), JSON.stringify({ sessionId: LOCAL, cliSessionId: SID, title: 'E3 · x', isArchived: false }));
  mkdirSync(dir('painel', 'perguntas'), { recursive: true });
}
const pergunta = (id, sessaoId) => writeFileSync(dir('painel', 'perguntas', `${id}.json`), JSON.stringify({ id, version: 1, data: { estado: 'aberta', sessaoId } }));
function transcript(textoDoTurno, comandos = [], { origem = { origin: { kind: 'peer' } }, depois = [] } = {}) {
  const f = dir('t.jsonl');
  const linhas = [{ type: 'user', timestamp: '2026-10-24T12:00:00.000Z', ...origem, message: { role: 'user', content: textoDoTurno } }, ...depois];
  for (const c of comandos) linhas.push({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 't', name: 'Bash', input: { command: c } }] } });
  writeFileSync(f, `${linhas.map((l) => JSON.stringify(l)).join('\n')}\n`);
  return f;
}
function rodar(tp, envExtra = {}) {
  const out = execFileSync('node', [join(HOOKS, 'painel-das-sessoes.mjs')], {
    input: JSON.stringify({ session_id: SID, transcript_path: tp, cwd: dir('repo'), stop_hook_active: false }),
    encoding: 'utf8', timeout: 15000, killSignal: 'SIGKILL',
    env: { ...process.env, HOME: dir('home'), PAINEL_DIR: dir('painel'), POOL_APP_SESSOES_DIR: dir('app'), HOOKS_CREWAI_BASE: dir('home', '.claude', 'orquestracao'), ...envExtra },
  });
  return out ? JSON.parse(out) : null;
}
const ok = (c, m) => { if (!c) throw new Error(m); };
function caso(nome, fn) {
  novoBase();
  try { fn(); console.log(`ok   ${nome}`); } catch (e) { falhas++; console.log(`FAIL ${nome}\n     ${e.message}`); }
  rmSync(base, { recursive: true, force: true });
}

caso('(a) mensagem cita Q197, pergunta de OUTRA sessão: não bloqueia', () => {
  pergunta('Q197', 'local_OUTRA');
  const r = rodar(transcript('F5 para você. Q197 já decidiu isso.'));
  ok(r === null, `esperava passar: ${JSON.stringify(r)}`);
});
caso('(b) resposta a Q12 desta sessão, sem gravar no painel: bloqueia', () => {
  pergunta('Q12', LOCAL);
  const r = rodar(transcript('Q12 — resposta do operador pelo painel: sim'));
  ok(r?.decision === 'block', `esperava bloquear: ${JSON.stringify(r)}`);
  ok(r.reason.includes('Qnn'), `motivo: ${r.reason}`);
});
caso('c3 R2: marcador sem transcript (projeto indeterminado, null) → passa, mesmo com a resposta do painel sem gravar', () => {
  pergunta('Q12', LOCAL);
  const msg = 'Q12 — resposta do operador pelo painel: sim';
  ok(rodar(transcript(msg))?.decision === 'block', 'precondição: com o projeto medido, a mesma situação bloqueia');
  rmSync(dir('home', '.claude', 'projects', 'proj', `${ORQ}.jsonl`));
  ok(!existsSync(dir('home', '.claude', 'projects', 'proj', `${ORQ}.jsonl`)) && existsSync(dir('home', '.claude', 'orquestracao', 'ativas', ORQ)), 'precondição: marcador ficou, transcript saiu');
  const r = rodar(transcript(msg));
  ok(r === null, `esperava passar: ${JSON.stringify(r)}`);
});
caso('(b2) o nome antigo IZANAGI_PAINEL_DIR segue valendo (PAINEL_DIR vazio): bloqueia como (b)', () => {
  pergunta('Q12', LOCAL);
  const r = rodar(transcript('Q12 — resposta do operador pelo painel: sim'), { PAINEL_DIR: '', IZANAGI_PAINEL_DIR: dir('painel') });
  ok(r?.decision === 'block', `esperava bloquear: ${JSON.stringify(r)}`);
});
caso('(c) igual a (b), com painel.mjs update no turno: passa', () => {
  pergunta('Q12', LOCAL);
  const r = rodar(transcript('Q12 — resposta do operador pelo painel: sim', [`node ~/.claude/skills/orquestradora/scripts/painel.mjs update sessoes ${LOCAL} '{"etapa":"x"}'`]));
  ok(r === null, `esperava passar: ${JSON.stringify(r)}`);
});
caso('(c2) K2: o comando `painel` do plugin (bin) também conta como gravar; só citar `painel` não conta', () => {
  pergunta('Q12', LOCAL);
  for (const cmd of [`painel update sessoes ${LOCAL} '{"etapa":"x"}'`, `"\${CLAUDE_PLUGIN_ROOT}/bin/painel" update sessoes ${LOCAL} '{"etapa":"x"}'`, `cd x && painel batch '[]'`]) {
    const r = rodar(transcript('Q12 — resposta do operador pelo painel: sim', [cmd]));
    ok(r === null, `devia contar como gravar: ${cmd} → ${JSON.stringify(r)}`);
  }
  const cita = rodar(transcript('Q12 — resposta do operador pelo painel: sim', ['echo "grave com painel update sessoes x"']));
  ok(cita?.decision === 'block', 'só citar o comando no echo não é gravar');
});
caso('(d) Qnn sem documento no painel: não bloqueia', () => {
  const r = rodar(transcript('Q404 — resposta do operador pelo painel: sim'));
  ok(r === null, `esperava passar: ${JSON.stringify(r)}`);
});
caso('(e) sessão sem local_ no registro: não conta o Qnn e registra no log', () => {
  pergunta('Q12', LOCAL);
  rmSync(dir('app', 'conta', `${LOCAL}.json`));
  const r = rodar(transcript('Q12 — resposta do operador pelo painel: sim'));
  ok(r === null, `esperava passar: ${JSON.stringify(r)}`);
  const log = execFileSync('cat', [dir('home', '.claude', 'orquestracao', 'painel-hook.log')], { encoding: 'utf8', timeout: 5000, killSignal: 'SIGKILL' });
  ok(log.includes('sem local_'), `log: ${log}`);
});

caso('(f) turno aberto por turnOrigin "sdk" sem origin, com PR aberto e sem gravar no painel: bloqueia', () => {
  const r = rodar(transcript('F7 para você', ['gh pr create --fill'], { origem: { turnOrigin: 'sdk' } }));
  ok(r?.decision === 'block', `esperava bloquear: ${JSON.stringify(r)}`);
  ok(r.reason.includes('abriu PR'), `motivo: ${r.reason}`);
});
caso('(g) entrada isMeta com turnOrigin depois do início não move o início', () => {
  // O turno real (sdk) abriu o PR; a entrada isMeta depois dele, se contasse, esconderia o `gh pr create`.
  const f = dir('t.jsonl');
  const linhas = [
    { type: 'user', timestamp: '2026-10-24T12:00:00.000Z', turnOrigin: 'sdk', message: { role: 'user', content: 'F7 para você' } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 't', name: 'Bash', input: { command: 'gh pr create --fill' } }] } },
    { type: 'user', isMeta: true, timestamp: '2026-10-24T12:00:09.000Z', turnOrigin: 'sdk', message: { role: 'user', content: 'lembrete do sistema' } },
  ];
  writeFileSync(f, `${linhas.map((l) => JSON.stringify(l)).join('\n')}\n`);
  const r = rodar(f);
  ok(r?.decision === 'block', `esperava bloquear: ${JSON.stringify(r)}`);
});


caso('R1 (F41): turno aberto por peer na forma real (isMeta + origin) depois de outro turno de peer que gravou no painel: bloqueia', () => {
  // O turno A gravou no painel; o turno B (isMeta + origin peer, a forma gravada de verdade) abriu PR sem gravar.
  // Pulando toda isMeta, o início ficava em A e o `painel update` de A escondia o PR de B.
  const f = dir('t.jsonl');
  const tu = (command) => ({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 't', name: 'Bash', input: { command } }] } });
  const linhas = [
    { type: 'user', timestamp: '2026-10-24T12:00:00.000Z', origin: { kind: 'peer' }, message: { role: 'user', content: 'F7 para você' } },
    tu(`node ~/x/painel.mjs update sessoes ${LOCAL} '{"etapa":"x"}'`),
    { type: 'user', isMeta: true, timestamp: '2026-10-24T12:05:00.000Z', origin: { kind: 'peer' }, message: { role: 'user', content: 'F8 para você' } },
    tu('gh pr create --fill'),
  ];
  writeFileSync(f, `${linhas.map((l) => JSON.stringify(l)).join('\n')}\n`);
  const r = rodar(f);
  ok(r?.decision === 'block', `esperava bloquear: ${JSON.stringify(r)}`);
});


// ---- F27 fatia 3: a mensagem manda gravar no item quando a sessão é dona de um ----
const itemDoDono = (id, data) => { mkdirSync(dir('painel', 'fila'), { recursive: true }); writeFileSync(dir('painel', 'fila', `${id}.json`), JSON.stringify({ id, version: 1, data })); };
caso('F27-3g: sessão dona de item vivo e com PR aberto sem gravar: a mensagem manda `update fila <F>` com etapa e agora', () => {
  itemDoDono('F27', { etapa: 'execucao', donoLocalId: LOCAL });
  const r = rodar(transcript('F27 para você', ['gh pr create --fill']));
  ok(r?.decision === 'block', `esperava bloquear: ${JSON.stringify(r)}`);
  ok(r.reason.includes("painel update fila F27 '{\"etapa\":…,\"agora\":…}'"), `mensagem: ${r.reason}`);
  ok(!r.reason.includes('update sessoes'), `não devia mandar a linha da sessão: ${r.reason}`);
});
caso('F27-3h: sessão sem item (ou com item feito / de outro dono): a mensagem de hoje, a da linha da sessão', () => {
  itemDoDono('F1', { etapa: 'feito', donoLocalId: LOCAL });
  itemDoDono('F2', { etapa: 'execucao', donoLocalId: 'local_OUTRA' });
  const r = rodar(transcript('F7 para você', ['gh pr create --fill']));
  ok(r?.decision === 'block', `esperava bloquear: ${JSON.stringify(r)}`);
  ok(r.reason.includes('painel update sessoes <sessionId>') && !r.reason.includes('update fila'), `mensagem: ${r.reason}`);
});
console.log(falhas ? `\n${falhas} FALHA(S)` : '\ntodos verdes');
process.exitCode = falhas ? 1 : 0;
