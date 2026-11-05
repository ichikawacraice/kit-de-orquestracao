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
caso('ADR 0007: sem orquestradora ativa no projeto, a sessão que abriu PR e não gravou também é cobrada', () => {
  pergunta('Q12', LOCAL);
  const msg = 'Q12 — resposta do operador pelo painel: sim';
  ok(rodar(transcript(msg))?.decision === 'block', 'precondição: com orquestradora a cobrança aparece');
  rmSync(dir('home', '.claude', 'orquestracao', 'ativas', ORQ));
  ok(!existsSync(dir('home', '.claude', 'orquestracao', 'ativas', ORQ)), 'precondição: o marcador saiu');
  const r = rodar(transcript(msg));
  ok(r?.decision === 'block', `esperava bloquear mesmo sem orquestradora: ${JSON.stringify(r)}`);
  const pr = rodar(transcript('segue', ['gh pr create --title x']));
  ok(pr?.decision === 'block' && pr.reason.includes('abriu PR'), `PR aberto e nada gravado: ${JSON.stringify(pr)}`);
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
caso('(g) F41 A1: entrada isMeta com turnOrigin (aviso do sistema, sem origin) abre o turno seguinte: o PR do turno anterior não conta', () => {
  // Forma real das 41 linhas: `isMeta: true`, `turnOrigin: 'system'`, sem `origin`. Abre turno como nas outras duas cópias.
  const f = dir('t.jsonl');
  const linhas = [
    { type: 'user', timestamp: '2026-10-24T12:00:00.000Z', turnOrigin: 'sdk', message: { role: 'user', content: 'F7 para você' } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 't', name: 'Bash', input: { command: 'gh pr create --fill' } }] } },
    { type: 'user', isMeta: true, timestamp: '2026-10-24T12:00:09.000Z', turnOrigin: 'system', message: { role: 'user', content: '[Cross-session delivery notice]' } },
  ];
  writeFileSync(f, `${linhas.map((l) => JSON.stringify(l)).join('\n')}\n`);
  const r = rodar(f);
  ok(r === null || r?.decision !== 'block', `o PR é do turno anterior, não devia bloquear: ${JSON.stringify(r)}`);
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

// ---- F400: decisão marcada "assumida, a confirmar" (ou "Q-ID não reservado") na mensagem final sem a pergunta assumida no painel ----
// O turno: a mensagem do operador, os comandos (cada um com o tool_result) e, por último, o texto final do assistente.
function turnoComFinal(final, comandos = [], { antes = '' } = {}) {
  const f = dir('t.jsonl');
  const linhas = [{ type: 'user', timestamp: '2026-10-24T12:00:00.000Z', origin: { kind: 'peer' }, message: { role: 'user', content: 'F9 para você' } }];
  if (antes) linhas.push({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: antes }] } });
  for (const c of comandos) {
    linhas.push({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 't', name: 'Bash', input: { command: c } }] } });
    linhas.push({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't', content: 'ok' }] } });
  }
  linhas.push({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: final }] } });
  writeFileSync(f, `${linhas.map((l) => JSON.stringify(l)).join('\n')}\n`);
  return f;
}
const assumidaNoPainel = (id, sessaoId, atualizadoEm = '2026-10-24T11:00:00.000Z', estado = 'assumida') =>
  writeFileSync(dir('painel', 'perguntas', `${id}.json`), JSON.stringify({ id, version: 1, data: { estado, sessaoId, atualizadoEm } }));
// A forma real do F385 (izanagi, 05/11): marca no masculino, em itálico, e o "(Q-ID não reservado)" na linha da decisão.
const FINAL_IZANAGI = 'PR 1662 na fila.\n\nO que falta você confirmar:\n- **(Q-ID não reservado) Só lote encerrado?** Recomendo manter. *assumido, a confirmar*';
const GRAVA_ASSUMIDA_REAL = `Q2=$(proxima-pergunta); S=${LOCAL}\npainel set perguntas Q986 "$(cat <<EOF\n{"id":"Q986","sessaoId":"$S","item":"F385","estado":"assumida","titulo":"x","caso":"y","recomendacao":"z"}\nEOF\n)"`;

caso('F400-a: mensagem final sem a marca, sem gravar nada: passa (e a mesma com a marca bloqueia)', () => {
  ok(rodar(turnoComFinal('PR 12 na fila. Testes verdes.')) === null, 'sem a marca devia passar');
  ok(rodar(turnoComFinal('Usei o nome curto (*assumida, a confirmar*).'))?.decision === 'block', 'precondição: a marca seria detectada');
});
caso('F400-b: a forma real do izanagi ("assumido", "Q-ID não reservado") sem gravar: bloqueia e diz o comando', () => {
  const r = rodar(turnoComFinal(FINAL_IZANAGI));
  ok(r?.decision === 'block', `esperava bloquear: ${JSON.stringify(r)}`);
  ok(r.reason.includes('proxima-pergunta') && r.reason.includes('painel set perguntas') && r.reason.includes('"estado":"assumida"'), `o motivo devia dar o comando: ${r.reason}`);
  ok(r.reason.includes(LOCAL), `o comando devia trazer o sessaoId desta sessão: ${r.reason}`);
});
caso('F400-c: só "Q-ID não reservado", sem a palavra assumida: bloqueia', () => {
  const r = rodar(turnoComFinal('- (Q-ID não reservado) troquei o nome da coluna.'));
  ok(r?.decision === 'block', `esperava bloquear: ${JSON.stringify(r)}`);
});
caso('F400-d: o turno gravou a pergunta assumida (forma real do heredoc e a de aspas escapadas): passa', () => {
  ok(rodar(turnoComFinal(FINAL_IZANAGI, [GRAVA_ASSUMIDA_REAL])) === null, 'heredoc devia passar');
  const escapado = `painel set perguntas Q7 "{\\"sessaoId\\":\\"${LOCAL}\\",\\"estado\\":\\"assumida\\"}"`;
  ok(rodar(turnoComFinal('Nome curto (*assumida, a confirmar*, Q7).', [escapado])) === null, 'aspas escapadas deviam passar');
});
caso('F400-e: gravar pergunta aberta (não assumida) ou outra coisa no painel não basta', () => {
  const aberta = `painel set perguntas Q8 '{"sessaoId":"${LOCAL}","estado":"aberta"}'`;
  ok(rodar(turnoComFinal('Nome curto (*assumida, a confirmar*).', [aberta]))?.decision === 'block', 'pergunta aberta não é a assumida');
  const fila = `painel update fila F9 '{"agora":"x"}'`;
  ok(rodar(turnoComFinal('Nome curto (*assumida, a confirmar*).', [fila]))?.decision === 'block', 'gravar o item não é gravar a assumida');
});
caso('F400-f: a mensagem que só cita a regra, entre crases ou aspas: passa', () => {
  for (const t of ['A regra manda marcar `assumida, a confirmar` e gravar a pergunta.', 'O protocolo pede "assumida, a confirmar" no PR.', 'Ela pediu para tirar o “assumido, a confirmar”.', '```\n- (Q-ID não reservado) exemplo\n```']) {
    const r = rodar(turnoComFinal(t));
    ok(r === null, `citação devia passar: ${t} → ${JSON.stringify(r)}`);
  }
});
caso('F400-g: a assumida gravada num turno anterior, citada pelo Q-ID na linha da marca: passa; Q-ID de outra sessão não', () => {
  assumidaNoPainel('Q50', LOCAL);
  ok(rodar(turnoComFinal('- Nome curto (Q50, *assumida, a confirmar*).')) === null, 'Q50 é assumida desta sessão');
  assumidaNoPainel('Q51', LOCAL, '2026-10-24T11:00:00.000Z', 'respondida');
  ok(rodar(turnoComFinal('- Nome curto (Q51, *assumida, a confirmar*).')) === null, 'Q51 desta sessão já confirmada também conta');
  assumidaNoPainel('Q60', 'local_OUTRA');
  ok(rodar(turnoComFinal('- Nome curto (Q60, *assumida, a confirmar*).'))?.decision === 'block', 'Q60 é de outra sessão');
  ok(rodar(turnoComFinal('- Nome curto (Q50, *assumida, a confirmar*).\n- Coluna nova (*assumida, a confirmar*).'))?.decision === 'block', 'a segunda linha não tem Q-ID');
});
caso('F400-h: assumida desta sessão gravada no turno por outro caminho (atualizadoEm depois do início do turno): passa; antes do turno, não', () => {
  assumidaNoPainel('Q70', LOCAL, '2026-10-24T11:59:00.000Z');
  ok(rodar(turnoComFinal('Nome curto (*assumida, a confirmar*).'))?.decision === 'block', 'gravada antes do turno e não citada: bloqueia');
  assumidaNoPainel('Q71', LOCAL, '2026-10-24T12:00:30.000Z');
  ok(rodar(turnoComFinal('Nome curto (*assumida, a confirmar*).')) === null, 'gravada no turno: passa');
});
caso('F400-i: a marca numa mensagem do meio do turno, não na final: passa', () => {
  ok(rodar(turnoComFinal('PR na fila.', ['ls'], { antes: 'Vou usar o nome curto (*assumida, a confirmar*).' })) === null, 'só a mensagem final conta');
});
caso('F400-j: junto com outro motivo (abriu PR sem gravar), um bloqueio só com os dois', () => {
  const r = rodar(turnoComFinal('Nome curto (*assumida, a confirmar*).', ['gh pr create --fill']));
  ok(r?.decision === 'block' && r.reason.includes('abriu PR') && r.reason.includes('proxima-pergunta'), `esperava os dois motivos: ${JSON.stringify(r)}`);
});
caso('F400-k: a orquestradora (marcador próprio em ativas/) fica de fora', () => {
  writeFileSync(dir('home', '.claude', 'orquestracao', 'ativas', SID), 'x\n');
  ok(rodar(turnoComFinal('Q50 e Q51 seguem *assumidas, a confirmar*.')) === null, 'a orquestradora tem o hook dela');
});
console.log(falhas ? `\n${falhas} FALHA(S)` : '\ntodos verdes');
process.exitCode = falhas ? 1 : 0;
