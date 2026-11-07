#!/usr/bin/env node
// Testes do Stop hook painel-das-sessoes.mjs: cobra só a pergunta (tirou ID, ou recebeu resposta a um Qnn DESTA sessão ainda
// aberta: perguntas/<Qnn>.json com `sessaoId` igual ao local_… dela), satisfeita só por gravar a coleção `perguntas` (F424). HOME, painel e registro do app em pasta temporária.
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
const pergunta = (id, sessaoId, estado = 'aberta') => writeFileSync(dir('painel', 'perguntas', `${id}.json`), JSON.stringify({ id, version: 1, data: { estado, sessaoId } }));
const GRAVA_PERGUNTA = `painel update perguntas Q12 '{"estado":"respondida","resposta":"sim"}'`;
const TIRA_ID = 'Q=$(proxima-pergunta)';
function transcript(textoDoTurno, comandos = [], { origem = { origin: { kind: 'peer' } }, depois = [] } = {}) {
  const f = dir('t.jsonl');
  const linhas = [{ type: 'user', timestamp: '2026-10-24T12:00:00.000Z', ...origem, message: { role: 'user', content: textoDoTurno } }, ...depois];
  for (const c of comandos) linhas.push({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 't', name: 'Bash', input: { command: c } }] } });
  writeFileSync(f, `${linhas.map((l) => JSON.stringify(l)).join('\n')}\n`);
  return f;
}
function rodar(tp, envExtra = {}, entradaExtra = {}) {
  const out = execFileSync('node', [join(HOOKS, 'painel-das-sessoes.mjs')], {
    input: JSON.stringify({ session_id: SID, transcript_path: tp, cwd: dir('repo'), stop_hook_active: false, ...entradaExtra }),
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
caso('(b2) F424: a resposta a Q12 que já está respondida no painel (respondida pelo pane) não cobra', () => {
  pergunta('Q12', LOCAL, 'respondida');
  ok(rodar(transcript('Q12 — resposta do operador pelo painel: sim')) === null, 'respondida não cobra');
  pergunta('Q12', LOCAL, 'assumida');
  ok(rodar(transcript('Q12 — resposta do operador pelo painel: sim'))?.decision === 'block', 'prova: assumida ainda espera a resposta');
});
caso('ADR 0007: sem orquestradora ativa no projeto, a sessão que tirou ID e não gravou também é cobrada', () => {
  pergunta('Q12', LOCAL);
  const msg = 'Q12 — resposta do operador pelo painel: sim';
  ok(rodar(transcript(msg))?.decision === 'block', 'precondição: com orquestradora a cobrança aparece');
  rmSync(dir('home', '.claude', 'orquestracao', 'ativas', ORQ));
  ok(!existsSync(dir('home', '.claude', 'orquestracao', 'ativas', ORQ)), 'precondição: o marcador saiu');
  const r = rodar(transcript(msg));
  ok(r?.decision === 'block', `esperava bloquear mesmo sem orquestradora: ${JSON.stringify(r)}`);
  const id = rodar(transcript('segue', [TIRA_ID]));
  ok(id?.decision === 'block' && id.reason.includes('tirou ID de pergunta'), `ID tirado e nada gravado: ${JSON.stringify(id)}`);
});
caso('(c) igual a (b), com painel.mjs update perguntas no turno: passa; gravar só a fila ou a sessão não basta (F424)', () => {
  pergunta('Q12', LOCAL);
  const r = rodar(transcript('Q12 — resposta do operador pelo painel: sim', [`node ~/.claude/skills/orquestradora/scripts/painel.mjs update perguntas Q12 '{"estado":"respondida"}'`]));
  ok(r === null, `esperava passar: ${JSON.stringify(r)}`);
  for (const cmd of [`painel update sessoes ${LOCAL} '{"etapa":"x"}'`, `painel update fila F9 '{"agora":"x"}'`]) {
    ok(rodar(transcript('Q12 — resposta do operador pelo painel: sim', [cmd]))?.decision === 'block', `não grava a pergunta: ${cmd}`);
  }
});
caso('(c2) K2: o comando `painel` do plugin (bin) também conta como gravar; só citar `painel` não conta', () => {
  pergunta('Q12', LOCAL);
  for (const cmd of [GRAVA_PERGUNTA, `"\${CLAUDE_PLUGIN_ROOT}/bin/painel" update perguntas Q12 '{"estado":"respondida"}'`, `cd x && painel batch '[{"op":"update","colecao":"perguntas","id":"Q12"}]'`]) {
    const r = rodar(transcript('Q12 — resposta do operador pelo painel: sim', [cmd]));
    ok(r === null, `devia contar como gravar: ${cmd} → ${JSON.stringify(r)}`);
  }
  const cita = rodar(transcript('Q12 — resposta do operador pelo painel: sim', ['echo "grave com painel update perguntas x"']));
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

caso('(f) turno aberto por turnOrigin "sdk" sem origin, que tirou ID sem gravar a pergunta: bloqueia', () => {
  const r = rodar(transcript('F7 para você', [TIRA_ID], { origem: { turnOrigin: 'sdk' } }));
  ok(r?.decision === 'block', `esperava bloquear: ${JSON.stringify(r)}`);
  ok(r.reason.includes('tirou ID de pergunta'), `motivo: ${r.reason}`);
});
caso('(f2) F424: abrir, mergear ou fechar PR e abrir ou arquivar sessão sem gravar no painel: passa (a batida deduz)', () => {
  for (const cmd of ['gh pr create --fill', 'gh pr merge 9 --squash', 'gh pr ready 9', 'gh pr close 9']) {
    ok(rodar(transcript('F7 para você', [cmd])) === null, `não devia cobrar: ${cmd}`);
  }
  const f = dir('t.jsonl');
  const linhas = [
    { type: 'user', timestamp: '2026-10-24T12:00:00.000Z', origin: { kind: 'peer' }, message: { role: 'user', content: 'F7 para você' } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'mcp__ccd_session__start_session', input: {} }] } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 't2', name: 'mcp__ccd_session_mgmt__archive_session', input: {} }] } },
  ];
  writeFileSync(f, `${linhas.map((l) => JSON.stringify(l)).join('\n')}\n`);
  ok(rodar(f) === null, 'abrir e arquivar sessão não cobram');
  // Prova de presença: o mesmo turno que também tira ID é cobrado.
  ok(rodar(transcript('F7 para você', ['gh pr create --fill', TIRA_ID]))?.decision === 'block', 'prova: tirar ID cobra');
});
caso('(g) F41 A1: entrada isMeta com turnOrigin (aviso do sistema, sem origin) abre o turno seguinte: o ID tirado no turno anterior não conta', () => {
  // Forma real das 41 linhas: `isMeta: true`, `turnOrigin: 'system'`, sem `origin`. Abre turno como nas outras duas cópias.
  const f = dir('t.jsonl');
  const linhas = [
    { type: 'user', timestamp: '2026-10-24T12:00:00.000Z', turnOrigin: 'sdk', message: { role: 'user', content: 'F7 para você' } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 't', name: 'Bash', input: { command: TIRA_ID } }] } },
    { type: 'user', isMeta: true, timestamp: '2026-10-24T12:00:09.000Z', turnOrigin: 'system', message: { role: 'user', content: '[Cross-session delivery notice]' } },
  ];
  writeFileSync(f, `${linhas.map((l) => JSON.stringify(l)).join('\n')}\n`);
  const r = rodar(f);
  ok(r === null || r?.decision !== 'block', `o ID é do turno anterior, não devia bloquear: ${JSON.stringify(r)}`);
  writeFileSync(f, `${linhas.slice(0, 2).map((l) => JSON.stringify(l)).join('\n')}\n`);
  ok(rodar(f)?.decision === 'block', 'prova: sem o aviso, o ID é deste turno e bloqueia');
});


caso('R1 (F41): turno aberto por peer na forma real (isMeta + origin) depois de outro turno de peer que gravou no painel: bloqueia', () => {
  // O turno A gravou a pergunta; o turno B (isMeta + origin peer, a forma gravada de verdade) tirou ID sem gravar.
  // Pulando toda isMeta, o início ficava em A e o `painel update` de A escondia o ID de B.
  const f = dir('t.jsonl');
  const tu = (command) => ({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 't', name: 'Bash', input: { command } }] } });
  const linhas = [
    { type: 'user', timestamp: '2026-10-24T12:00:00.000Z', origin: { kind: 'peer' }, message: { role: 'user', content: 'F7 para você' } },
    tu(`node ~/x/painel.mjs update perguntas Q12 '{"estado":"respondida"}'`),
    { type: 'user', isMeta: true, timestamp: '2026-10-24T12:05:00.000Z', origin: { kind: 'peer' }, message: { role: 'user', content: 'F8 para você' } },
    tu(TIRA_ID),
  ];
  writeFileSync(f, `${linhas.map((l) => JSON.stringify(l)).join('\n')}\n`);
  const r = rodar(f);
  ok(r?.decision === 'block', `esperava bloquear: ${JSON.stringify(r)}`);
});


// ---- F27 fatia 3 / F424: a mensagem manda gravar a pergunta, com o item quando a sessão é dona de um ----
const itemDoDono = (id, data) => { mkdirSync(dir('painel', 'fila'), { recursive: true }); writeFileSync(dir('painel', 'fila', `${id}.json`), JSON.stringify({ id, version: 1, data })); };
caso('F27-3g: sessão dona de item vivo que tirou ID sem gravar: a mensagem manda gravar a pergunta com o item, sem fila nem agora', () => {
  itemDoDono('F27', { etapa: 'execucao', donoLocalId: LOCAL });
  const r = rodar(transcript('F27 para você', [TIRA_ID]));
  ok(r?.decision === 'block', `esperava bloquear: ${JSON.stringify(r)}`);
  ok(r.reason.includes('painel set perguntas <Q-ID>') && r.reason.includes(`"sessaoId":"${LOCAL}","item":"F27"`), `mensagem: ${r.reason}`);
  ok(!r.reason.includes('update fila') && !r.reason.includes('"agora"') && !r.reason.includes('update sessoes'), `não devia mandar gravar fila, agora ou sessão: ${r.reason}`);
});
caso('F27-3h: sessão sem item (ou com item feito / de outro dono): a pergunta sem o campo item', () => {
  itemDoDono('F1', { etapa: 'feito', donoLocalId: LOCAL });
  itemDoDono('F2', { etapa: 'execucao', donoLocalId: 'local_OUTRA' });
  const r = rodar(transcript('F7 para você', [TIRA_ID]));
  ok(r?.decision === 'block', `esperava bloquear: ${JSON.stringify(r)}`);
  ok(r.reason.includes('painel set perguntas <Q-ID>') && !r.reason.includes('"item"') && !r.reason.includes('update fila'), `mensagem: ${r.reason}`);
});

// ---- F400: decisão marcada "assumida, a confirmar" (ou "Q-ID não reservado") na mensagem final sem a pergunta assumida no painel ----
// O turno: a mensagem do operador, os comandos (cada um com o tool_result) e, por último, o texto final do assistente.
function turnoComFinal(final, comandos = [], { antes = '', abertura = 'F9 para você' } = {}) {
  const f = dir('t.jsonl');
  const linhas = [{ type: 'user', timestamp: '2026-10-24T12:00:00.000Z', origin: { kind: 'peer' }, message: { role: 'user', content: abertura } }];
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
// A forma real do F385 (num projeto, 05/11): marca no masculino, em itálico, e o "(Q-ID não reservado)" na linha da decisão.
const FINAL_REAL = 'PR 1662 na fila.\n\nO que falta você confirmar:\n- **(Q-ID não reservado) Só lote encerrado?** Recomendo manter. *assumido, a confirmar*';
const GRAVA_ASSUMIDA_REAL = `Q2=$(proxima-pergunta); S=${LOCAL}\npainel set perguntas Q986 "$(cat <<EOF\n{"id":"Q986","sessaoId":"$S","item":"F385","estado":"assumida","titulo":"x","caso":"y","recomendacao":"z"}\nEOF\n)"`;

caso('F400-a: mensagem final sem a marca, sem gravar nada: passa (e a mesma com a marca bloqueia)', () => {
  ok(rodar(turnoComFinal('PR 12 na fila. Testes verdes.')) === null, 'sem a marca devia passar');
  ok(rodar(turnoComFinal('Usei o nome curto (*assumida, a confirmar*).'))?.decision === 'block', 'precondição: a marca seria detectada');
});
caso('F400-b: a forma real de um projeto ("assumido", "Q-ID não reservado") sem gravar: bloqueia e diz o comando', () => {
  const r = rodar(turnoComFinal(FINAL_REAL));
  ok(r?.decision === 'block', `esperava bloquear: ${JSON.stringify(r)}`);
  ok(r.reason.includes('painel perguntas nova') && r.reason.includes('"estado":"assumida"'), `o motivo devia dar o comando (F478: o que reserva e grava num passo): ${r.reason}`);
  ok(r.reason.includes(LOCAL), `o comando devia trazer o sessaoId desta sessão: ${r.reason}`);
});
caso('F400-c: só "Q-ID não reservado", sem a palavra assumida: bloqueia', () => {
  const r = rodar(turnoComFinal('- (Q-ID não reservado) troquei o nome da coluna.'));
  ok(r?.decision === 'block', `esperava bloquear: ${JSON.stringify(r)}`);
});
caso('F400-d: o turno gravou a pergunta assumida (o arquivo no painel, com atualizadoEm no turno): passa', () => {
  assumidaNoPainel('Q986', LOCAL, '2026-10-24T12:01:00.000Z');
  ok(rodar(turnoComFinal(FINAL_REAL, [GRAVA_ASSUMIDA_REAL])) === null, 'heredoc com o arquivo gravado devia passar');
  assumidaNoPainel('Q7', LOCAL, '2026-10-24T12:02:00.000Z');
  ok(rodar(turnoComFinal('Nome curto (*assumida, a confirmar*, Q7).')) === null, 'citando o Q-ID gravado devia passar');
});
caso('F400-d2: o comando de gravar rodou mas o arquivo não existe (comando falhou): bloqueia', () => {
  ok(rodar(turnoComFinal(FINAL_REAL, [GRAVA_ASSUMIDA_REAL]))?.decision === 'block', 'sem arquivo, o comando não basta');
});
caso('F400-d3: sem registro da sessão (local desconhecido), o comando de gravar é o que vale', () => {
  rmSync(dir('app', 'conta', `${LOCAL}.json`));
  const escapado = `painel set perguntas Q7 "{\\"sessaoId\\":\\"x\\",\\"estado\\":\\"assumida\\"}"`;
  ok(rodar(turnoComFinal('Nome curto (*assumida, a confirmar*).', [escapado])) === null, 'aspas escapadas deviam passar');
  ok(rodar(turnoComFinal('Nome curto (*assumida, a confirmar*).'))?.decision === 'block', 'precondição: sem o comando bloqueia');
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
caso('F400-j: junto com outro motivo (tirou ID sem gravar), um bloqueio só com os dois', () => {
  const r = rodar(turnoComFinal('Nome curto (*assumida, a confirmar*).', [TIRA_ID]));
  ok(r?.decision === 'block' && r.reason.includes('tirou ID de pergunta') && r.reason.includes('assumida, a confirmar'), `esperava os dois motivos: ${JSON.stringify(r)}`);
});
caso('F400-l: o Q-ID na linha seguinte do mesmo item, ou o cabeçalho marcado com a lista abaixo: passa', () => {
  assumidaNoPainel('Q50', LOCAL); assumidaNoPainel('Q51', LOCAL);
  ok(rodar(turnoComFinal('- Nome curto, *assumida, a confirmar*.\n  No painel: Q50.')) === null, 'Q-ID na continuação do item');
  ok(rodar(turnoComFinal('Decisões *assumidas, a confirmar*:\n\n- Nome curto (Q50).\n- Coluna nova (Q51).')) === null, 'cabeçalho com itens citando Q-ID');
  ok(rodar(turnoComFinal('Decisões *assumidas, a confirmar*:\n- Nome curto (Q50).\n- Coluna nova.'))?.decision === 'block', 'item sem Q-ID sob o cabeçalho bloqueia');
});
caso('F400-m: uma assumida gravada no turno não cobre duas decisões soltas, nem a "Q-ID não reservado"', () => {
  assumidaNoPainel('Q80', LOCAL, '2026-10-24T12:01:00.000Z');
  ok(rodar(turnoComFinal('- Nome curto (*assumida, a confirmar*).\n- Coluna nova (*assumida, a confirmar*).'))?.decision === 'block', 'duas soltas, uma gravada');
  ok(rodar(turnoComFinal('- Nome curto (Q80, *assumida, a confirmar*).\n- Coluna nova (Q-ID não reservado).'))?.decision === 'block', 'Q80 já citada não cobre a outra');
  assumidaNoPainel('Q81', LOCAL, '2026-10-24T12:01:30.000Z');
  ok(rodar(turnoComFinal('- Nome curto (*assumida, a confirmar*).\n- Coluna nova (*assumida, a confirmar*).')) === null, 'duas soltas, duas gravadas');
});
caso('F400-n: depois da recusa de outra trava (stop_hook_active), cobra uma vez por turno', () => {
  const tp = turnoComFinal('Nome curto (*assumida, a confirmar*).');
  ok(rodar(tp, {}, { stop_hook_active: true })?.decision === 'block', 'primeira cobrança no turno, mesmo com stop_hook_active');
  ok(rodar(tp, {}, { stop_hook_active: true }) === null, 'segunda vez no mesmo turno passa');
});
caso('F400-o: o Stop de subagente (agent_id) fica de fora; last_assistant_message é a mensagem final', () => {
  ok(rodar(turnoComFinal('Nome curto (*assumida, a confirmar*).'), {}, { agent_id: 'a1' }) === null, 'subagente não é cobrado');
  ok(rodar(turnoComFinal('PR na fila.'), {}, { last_assistant_message: 'Nome curto (*assumida, a confirmar*).' })?.decision === 'block', 'lê last_assistant_message');
  ok(rodar(turnoComFinal('Nome curto, _assumida, a confirmar_.'))?.decision === 'block', 'marca em itálico com sublinhado');
});
caso('F400-p: fora de lista, a unidade é a linha marcada: tabela e parágrafo de duas decisões não se cobrem', () => {
  assumidaNoPainel('Q50', LOCAL);
  ok(rodar(turnoComFinal('| Nome curto | *assumida, a confirmar* | Q50 |\n| Coluna nova | *assumida, a confirmar* | — |'))?.decision === 'block', 'linha de tabela sem Q-ID');
  ok(rodar(turnoComFinal('Nome curto (Q50, *assumida, a confirmar*).\nColuna nova (*assumida, a confirmar*).'))?.decision === 'block', 'parágrafo: a segunda linha marcada é outra decisão');
  ok(rodar(turnoComFinal('| Nome curto | *assumida, a confirmar* | Q50 |')) === null, 'precondição: a linha de tabela com Q-ID passa');
  assumidaNoPainel('Q80', LOCAL, '2026-10-24T12:01:00.000Z');
  ok(rodar(turnoComFinal('Nome curto (*assumida, a confirmar*).\nColuna nova (*assumida, a confirmar*).'))?.decision === 'block', 'duas no parágrafo, uma gravada');
});
caso('F400-q: cabeçalho com # ou em negrito, e item pai terminado em ":" com subitens: passam a marca', () => {
  assumidaNoPainel('Q50', LOCAL); assumidaNoPainel('Q51', LOCAL);
  for (const cab of ['## Decisões assumidas, a confirmar', '**Decisões assumidas, a confirmar**', 'Decisões *assumidas, a confirmar*:']) {
    ok(rodar(turnoComFinal(`${cab}\n- Nome curto (Q50).\n- Coluna nova (Q51).`)) === null, `cabeçalho ${cab}`);
    ok(rodar(turnoComFinal(`${cab}\n- Nome curto (Q50).\n- Coluna nova.`))?.decision === 'block', `item sem Q-ID sob ${cab}`);
  }
  ok(rodar(turnoComFinal('- Nome curto, *assumida, a confirmar*:\n  - motivo (Q50)')) === null, 'subitem cita o Q-ID');
  ok(rodar(turnoComFinal('- Nome curto, *assumida, a confirmar*:\n  - motivo'))?.decision === 'block', 'subitem sem Q-ID');
  ok(rodar(turnoComFinal('**Nome curto, assumida, a confirmar**'))?.decision === 'block', 'linha em negrito sem lista abaixo é decisão');
});
caso('F400-r: sem como gravar a marca do turno, não recusa de novo depois de uma recusa (sem laço)', () => {
  const tp = turnoComFinal('Nome curto (*assumida, a confirmar*).');
  const sem = { HOOKS_CREWAI_BASE: dir('nao', 'existe') };
  writeFileSync(dir('nao'), 'arquivo, não pasta');
  ok(rodar(tp, sem)?.decision === 'block', 'precondição: a primeira recusa acontece');
  ok(rodar(tp, sem, { stop_hook_active: true }) === null, 'com stop_hook_active e sem estado gravável, passa');
});
caso('F400-s: a trava antiga não recusa duas vezes (stop_hook_active); last_assistant_message vazio cai no transcript', () => {
  ok(rodar(turnoComFinal('PR na fila.', [TIRA_ID]), {}, { stop_hook_active: true }) === null, 'trava antiga presa a stop_hook_active');
  ok(rodar(turnoComFinal('PR na fila.', [TIRA_ID]))?.decision === 'block', 'precondição: sem stop_hook_active recusa');
  ok(rodar(turnoComFinal('Nome curto (*assumida, a confirmar*).'), {}, { last_assistant_message: '' })?.decision === 'block', 'string vazia não esconde a marca');
});
const contador = (n) => writeFileSync(dir('home', '.claude', 'orquestracao', 'contador-de-perguntas'), `${n}\n`);
caso('F400-t: a mensagem final cita um Q-ID recente (reservado pelo contador) que não existe no painel: bloqueia e manda gravar', () => {
  contador(990);
  const final = 'PR 9 na fila.\n\nQ984 — Nome curto ou longo? Caso: … Recomendo o curto.';
  const r = rodar(turnoComFinal(final));
  ok(r?.decision === 'block' && r.reason.includes('Q984') && r.reason.includes('painel set perguntas Q984'), `esperava cobrar Q984: ${JSON.stringify(r)}`);
  ok(rodar(turnoComFinal('Decidido em `Q985`, ver painel.'))?.decision === 'block', 'entre crases também é citação de Q-ID');
  pergunta('Q984', 'local_OUTRA'); pergunta('Q985', LOCAL);
  ok(rodar(turnoComFinal(final)) === null, 'Q984 existe (de qualquer sessão): passa');
  ok(rodar(turnoComFinal('Decidido em `Q985`, ver painel.')) === null, 'Q985 existe: passa');
});
caso('F400-u: Q-ID fora da faixa recente do contador, já citado na abertura do turno ou só em bloco de código: não cobra', () => {
  contador(990);
  ok(rodar(turnoComFinal('Q986 — Nome curto? Recomendo o curto.'))?.decision === 'block', 'precondição: Q986 recente sem arquivo bloqueia');
  ok(rodar(turnoComFinal('A campanha entra no Q4 e o teste usa Q12.')) === null, 'Q4 trimestre e Q12 de exemplo: antigos demais');
  ok(rodar(turnoComFinal('Ver Q2026 do roadmap.')) === null, 'acima do contador não foi reservado');
  ok(rodar(turnoComFinal('Ok, sigo o que a Q986 decidiu.', [], { abertura: 'A Q986 já decidiu isso.' })) === null, 'repetido da abertura do turno');
  ok(rodar(turnoComFinal('```\nQ=$(proxima-pergunta) # ex.: Q986\n```\n~~~\nQ987\n~~~\nPR na fila.')) === null, 'só em bloco de código');
  rmSync(dir('home', '.claude', 'orquestracao', 'contador-de-perguntas'));
  ok(rodar(turnoComFinal('Q986 — Nome curto? Recomendo o curto.')) === null, 'sem contador não cobra');
});
caso('F400-v: só a chamada de `proxima-pergunta` (com ou sem .sh) conta como tirar ID; citar o nome em grep, cat ou commit não', () => {
  const r = rodar(turnoComFinal('PR na fila.', ['Q=$(proxima-pergunta)']));
  ok(r?.decision === 'block' && r.reason.includes('tirou ID de pergunta'), `esperava o motivo: ${JSON.stringify(r)}`);
  ok(rodar(turnoComFinal('PR na fila.', ['bash ~/.claude/plugins/x/bin/proxima-pergunta.sh']))?.decision === 'block', 'chamada pelo caminho com bash');
  ok(rodar(turnoComFinal('PR na fila.', ['cd /tmp && proxima-pergunta']))?.decision === 'block', 'chamada depois de &&');
  for (const c of ['grep -rn proxima-pergunta plugins/', 'cat plugins/orquestracao/bin/proxima-pergunta', 'git commit -m "fix: o wrapper proxima-pergunta"', 'which proxima-pergunta']) {
    ok(rodar(turnoComFinal('PR na fila.', [c])) === null, `só cita o nome: ${c}`);
  }
});
caso('F400-w: a faixa do contador tem borda exata, e a cobrança do Q-ID não gasta a da decisão assumida', () => {
  contador(990);
  ok(rodar(turnoComFinal('Ver Q941.'))?.decision === 'block', 'Q941 está na faixa (990−50 < 941)');
  ok(rodar(turnoComFinal('Ver Q940.')) === null, 'Q940 fica de fora');
  const tp = turnoComFinal('Reservei Q986.');
  ok(rodar(tp)?.decision === 'block', 'primeira recusa: Q-ID sem pergunta');
  ok(rodar(tp, {}, { stop_hook_active: true }) === null, 'o mesmo Q-ID de novo no turno passa (sem laço)');
  pergunta('Q986', LOCAL);
  ok(rodar(tp, {}, { stop_hook_active: true, last_assistant_message: 'Nome curto (*assumida, a confirmar*).' })?.decision === 'block', 'a decisão assumida ainda é cobrada no mesmo turno');
  ok(rodar(tp, {}, { stop_hook_active: true, last_assistant_message: 'Nome curto (*assumida, a confirmar*).' }) === null, 'e só uma vez');
});
caso('F400-k: a orquestradora (marcador próprio em ativas/) fica de fora da decisão assumida e da resposta recebida', () => {
  writeFileSync(dir('home', '.claude', 'orquestracao', 'ativas', SID), 'x\n');
  ok(rodar(turnoComFinal('Q50 e Q51 seguem *assumidas, a confirmar*.')) === null, 'relata decisões alheias: a marca não a cobra');
  pergunta('Q12', LOCAL);
  ok(rodar(transcript('Q12 — resposta do operador: sim')) === null, 'a resposta recebida não a cobra');
});

// ---- F478: o Q-ID que chega ao operador tem arquivo no painel, também na orquestradora e no `orca orchestration ask` ----
// O turno com a saída real de cada comando (o tool_result), para a trava ler o Q-ID que o `proxima-pergunta` devolveu.
function turnoComSaidas(final, pares, { abertura = 'F9 para você' } = {}) {
  const f = dir('t.jsonl');
  const linhas = [{ type: 'user', timestamp: '2026-10-24T12:00:00.000Z', origin: { kind: 'peer' }, message: { role: 'user', content: abertura } }];
  pares.forEach(([c, saida], i) => {
    linhas.push({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: `t${i}`, name: 'Bash', input: { command: c } }] } });
    linhas.push({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: `t${i}`, content: [{ type: 'text', text: saida }] }] } });
  });
  linhas.push({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: final }] } });
  writeFileSync(f, `${linhas.map((l) => JSON.stringify(l)).join('\n')}\n`);
  return f;
}
const orquestradora = () => writeFileSync(dir('home', '.claude', 'orquestracao', 'ativas', SID), 'x\n');
const SET_RECUSADO = `painel set perguntas Q988 '{"sessaoId":"${LOCAL}","estado":"aberta","titulo":"Dona do F13 parou","caso":"…","recomendacao":"…"}' | tail -3`;
const ERRO_DO_PAINEL = 'painel.mjs: perguntas/Q988: titulo cita "F13" solto — na primeira menção escreva "F13 · <título do item>"';

caso('F478-a: a orquestradora que cita na mensagem final um Q-ID recente sem arquivo no painel é cobrada', () => {
  orquestradora(); contador(990);
  const final = 'Q988 — Nome curto ou longo? Caso: … Recomendo o curto.';
  const r = rodar(turnoComFinal(final));
  ok(r?.decision === 'block' && r.reason.includes('Q988') && r.reason.includes('painel perguntas nova'), `esperava cobrar Q988 com o comando novo: ${JSON.stringify(r)}`);
  const sugeridos = [...r.reason.matchAll(/painel (?:set perguntas Q\d+|perguntas nova) '(\{[^']*\})'/g)].map((m) => m[1]);
  ok(sugeridos.length > 0, `o motivo devia trazer o comando com o JSON: ${r.reason}`);
  for (const j of sugeridos) JSON.parse(j.replace(/<[^>]*>/g, 'x'));
  pergunta('Q988', 'local_DONA');
  ok(rodar(turnoComFinal(final)) === null, 'Q988 no painel (de outra sessão, que ela relata): passa');
  pergunta('Q987', 'local_DONA', 'respondida');
  ok(rodar(turnoComFinal('Q987 decidido: sigo com o curto.')) === null, 'citar pergunta já respondida passa');
});

caso('F478-b: tirou ID e o `painel set perguntas` foi recusado (o comando rodou, o arquivo não existe): cobra pelo efeito', () => {
  contador(990);
  const pares = [['Q=$(proxima-pergunta); echo $Q', 'Q988'], [SET_RECUSADO, ERRO_DO_PAINEL]];
  const r = rodar(turnoComSaidas('Perguntei ao operador.', pares));
  ok(r?.decision === 'block' && r.reason.includes('Q988'), `esperava cobrar Q988 pelo arquivo ausente: ${JSON.stringify(r)}`);
  pergunta('Q988', LOCAL);
  ok(rodar(turnoComSaidas('Perguntei ao operador.', pares)) === null, 'com o arquivo no painel passa');
});

caso('F478-c: na orquestradora, tirou ID e não gravou também é cobrado (pelo efeito)', () => {
  orquestradora(); contador(990);
  const pares = [['Q=$(proxima-pergunta) && painel set perguntas "$Q" \'{"estado":"aberta"}\'', `Q988\n${ERRO_DO_PAINEL}`]];
  const r = rodar(turnoComSaidas('Gravei.', pares));
  ok(r?.decision === 'block' && r.reason.includes('Q988'), `esperava cobrar: ${JSON.stringify(r)}`);
  pergunta('Q988', LOCAL);
  ok(rodar(turnoComSaidas('Gravei.', pares)) === null, 'com o arquivo passa');
});

caso('F478-d: a saída do proxima-pergunta sem Q-ID legível cai na regra antiga (o comando de gravar no turno basta)', () => {
  contador(990);
  ok(rodar(turnoComSaidas('Ok.', [['Q=$(proxima-pergunta)', '']]))?.decision === 'block', 'precondição: tirar ID sem gravar cobra');
  ok(rodar(turnoComSaidas('Ok.', [['Q=$(proxima-pergunta)', ''], [`painel set perguntas "$Q" '{"estado":"aberta"}'`, '{"id":"x"}']])) === null, 'com o comando de gravar passa');
});

caso('F478-e: o `orca orchestration ask` que cita Q-ID recente sem arquivo no painel é cobrado', () => {
  contador(990);
  const ask = 'orca orchestration ask --from orca_session_id:abc --question "Q986 — Nome curto? Caso: … Recomendo o curto."';
  const r = rodar(turnoComSaidas('Perguntei à coordenadora.', [[ask, 'ok']]));
  ok(r?.decision === 'block' && r.reason.includes('Q986'), `esperava cobrar Q986: ${JSON.stringify(r)}`);
  pergunta('Q986', LOCAL);
  ok(rodar(turnoComSaidas('Perguntei à coordenadora.', [[ask, 'ok']])) === null, 'com o arquivo passa');
  ok(rodar(turnoComSaidas('Ok.', [['echo "orca orchestration ask --question Q985"', 'x']])) === null, 'citar o comando dentro de string não conta');
});

caso('F478-f: o subagente (agent_id) segue de fora, também na orquestradora', () => {
  orquestradora(); contador(990);
  ok(rodar(turnoComFinal('Q988 — x? Recomendo y.'))?.decision === 'block', 'precondição: na sessão cobra');
  ok(rodar(turnoComFinal('Q988 — x? Recomendo y.'), {}, { agent_id: 'sub-1' }) === null, 'o subagente não');
});
caso('F478-g: fora do registro (sem local_…), a decisão gravada por `painel perguntas nova` conta como gravada', () => {
  assumidaNoPainel('Q988', 'local_TERM', '2026-10-24T12:01:00.000Z');
  const final = 'Nome curto (*assumida, a confirmar*, Q988).';
  const fora = { session_id: 'eeeeeeee-0000-0000-0000-000000000009' };
  const r0 = rodar(turnoComFinal(final), {}, fora);
  ok(r0?.decision === 'block', `precondição: sem gravar, cobra: ${JSON.stringify(r0)}`);
  ok(r0.reason.includes('"sessaoId":"<'), `sem local_, o comando sugerido pede o sessaoId (no terminal o \`nova\` sem ele recusa): ${r0.reason}`);
  const nova = `painel perguntas nova '{"estado":"assumida","sessaoId":"local_TERM","titulo":"x","caso":"y","recomendacao":"z"}'`;
  ok(rodar(turnoComFinal(final, [nova]), {}, fora) === null, 'com o `perguntas nova` no turno passa');
});

caso('F478-h: todo JSON que a trava sugere faz parse (também o do Q-ID já reservado)', () => {
  const r = rodar(transcript('F5 para você.', [TIRA_ID]));
  ok(r?.decision === 'block', `precondição: tirar ID sem gravar cobra: ${JSON.stringify(r)}`);
  const jsons = [...r.reason.matchAll(/'(\{[^']*\})'/g)].map((m) => m[1]);
  ok(jsons.length >= 3, `o motivo devia trazer os comandos com JSON: ${r.reason}`);
  for (const j of jsons) { try { JSON.parse(j.replace(/<[^>]*>/g, 'x')); } catch (e) { throw new Error(`JSON sugerido inválido: ${j} (${e.message})`); } }
});

caso('F478-i: só conta como reservado o Q-ID sozinho na linha (o que o contador imprime), não o de outra saída do mesmo comando', () => {
  contador(990);
  const pares = [[`Q=$(proxima-pergunta) && echo $Q && painel set perguntas "$Q" '{"estado":"aberta"}'; grep Q /tmp/log`, 'Q988\nlinha antiga Q970 cancelada']];
  const r0 = rodar(turnoComSaidas('Gravei.', pares));
  ok(r0?.decision === 'block' && r0.reason.includes('Q988'), `precondição: o Q988 da saída é lido e cobrado sem arquivo: ${JSON.stringify(r0)}`);
  pergunta('Q988', LOCAL);
  ok(rodar(turnoComSaidas('Gravei.', pares)) === null, 'Q988 no painel: o Q970 da linha do grep não conta');
});
console.log(falhas ? `\n${falhas} FALHA(S)` : '\ntodos verdes');
process.exitCode = falhas ? 1 : 0;
