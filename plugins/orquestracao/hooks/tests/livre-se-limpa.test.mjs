#!/usr/bin/env node
// Testes de hooks/livre-se-limpa.mjs: membro que se declara livre no turno se limpa no mesmo turno.
// Rodar: node ~/.claude/hooks/tests/livre-se-limpa.test.mjs
import { execFileSync } from 'node:child_process';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOK = join(process.env.HOOKS_DIR || join(dirname(fileURLToPath(import.meta.url)), '..'), 'livre-se-limpa.mjs');
let base; let falhas = 0;
const ok = (c, m) => { if (!c) throw new Error(m); };
const ID = { E3: 'cli-e3', E4: 'cli-e4', AVULSA: 'cli-avulsa' };

function novoBase() {
  base = mkdtempSync(join(tmpdir(), 'livre-limpa-'));
  mkdirSync(join(base, 'orq')); mkdirSync(join(base, 'app'));
  writeFileSync(join(base, 'app', 'local_E3.json'), JSON.stringify({ sessionId: 'local_E3', cliSessionId: ID.E3, title: 'E3 · lançador', isArchived: false }));
  writeFileSync(join(base, 'app', 'local_E4.json'), JSON.stringify({ sessionId: 'local_E4', cliSessionId: ID.E4, title: 'E4 · livre', isArchived: false }));
  writeFileSync(join(base, 'app', 'local_AV.json'), JSON.stringify({ sessionId: 'local_AV', cliSessionId: ID.AVULSA, title: 'fix(web): algo', isArchived: false }));
}

// Transcript: um turno anterior (com limpeza velha) e o turno atual com as ferramentas dadas.
function transcript(ferramentas, { limpezaNoTurnoAnterior = false } = {}) {
  const t0 = Date.now() - 60_000; const t1 = Date.now() - 10_000;
  const L = [{ type: 'user', origin: { kind: 'human' }, timestamp: new Date(t0).toISOString(), message: { content: 'antes' } }];
  if (limpezaNoTurnoAnterior) L.push({ type: 'assistant', timestamp: new Date(t0 + 1000).toISOString(), message: { content: [{ type: 'tool_use', name: 'mcp__ccd_session_mgmt__clear_session', input: { session_id: 'self' } }] } });
  L.push({ type: 'user', origin: { kind: 'human' }, timestamp: new Date(t1).toISOString(), message: { content: 'agora' } });
  ferramentas.forEach(([name, input], k) => L.push({ type: 'assistant', timestamp: new Date(t1 + 1000 + k).toISOString(), message: { content: [{ type: 'tool_use', name, input }] } }));
  const f = join(base, 't.jsonl'); writeFileSync(f, L.map((x) => JSON.stringify(x)).join('\n') + '\n'); return f;
}
function rodar(quem, f, extra = {}, envExtra = {}) {
  const out = execFileSync('node', [HOOK], {
    input: JSON.stringify({ session_id: ID[quem], transcript_path: f, hook_event_name: 'Stop', ...extra }), encoding: 'utf8', timeout: 15000, killSignal: 'SIGKILL',
    env: { ...process.env, HOOKS_CREWAI_BASE: join(base, 'orq'), POOL_APP_SESSOES_DIR: join(base, 'app'), FILA_DIR: join(base, 'fila'), ...envExtra },
  });
  return out ? JSON.parse(out) : null;
}
const log = () => { const p = join(base, 'orq', 'hooks-crewai.log'); return existsSync(p) ? readFileSync(p, 'utf8') : ''; };
const TITULO = ['mcp__ccd_session_mgmt__set_session_title', { session_id: 'self', title: 'E3 · livre' }];
const LIMPA = ['mcp__ccd_session_mgmt__clear_session', { session_id: 'self' }];
const PAINEL = ['Bash', { command: `node ~/.claude/skills/orquestradora/scripts/painel.mjs update sessoes local_E3 '{"estado":"parada","etapa":"livre"}'` }];

function caso(nome, fn) {
  novoBase();
  try { fn(); console.log(`ok   ${nome}`); } catch (e) { falhas++; console.log(`FAIL ${nome}\n     ${e.message}`); }
  rmSync(base, { recursive: true, force: true });
}

caso('título livre sem limpeza → block', () => {
  const r = rodar('E3', transcript([TITULO]));
  ok(r?.decision === 'block' && /clear_session/.test(r.reason), `esperava block, veio ${JSON.stringify(r)}`);
  ok(/cobrou/.test(log()), 'log sem "cobrou"');
});
caso('painel livre sem limpeza → block', () => {
  ok(rodar('E3', transcript([PAINEL]))?.decision === 'block', 'esperava block');
});
caso('título livre + clear_session self → passa', () => {
  ok(rodar('E3', transcript([TITULO, LIMPA])) === null, 'esperava passar');
});
caso('limpeza só no turno anterior não vale', () => {
  ok(rodar('E3', transcript([TITULO], { limpezaNoTurnoAnterior: true }))?.decision === 'block', 'esperava block');
});
caso('clear_session de OUTRA sessão não vale', () => {
  ok(rodar('E3', transcript([TITULO, ['mcp__ccd_session_mgmt__clear_session', { session_id: 'local_X' }]]))?.decision === 'block', 'esperava block');
});
caso('turno sem declarar livre → passa', () => {
  ok(rodar('E3', transcript([['Bash', { command: 'git status' }]])) === null, 'esperava passar');
});
caso('sessão fora do pool com painel livre → passa', () => {
  ok(rodar('AVULSA', transcript([PAINEL])) === null, 'esperava passar');
});
caso('stop_hook_active → deixa passar e registra', () => {
  ok(rodar('E3', transcript([TITULO]), { stop_hook_active: true }) === null, 'esperava passar');
  ok(/deixou-passar/.test(log()), 'log sem "deixou-passar"');
});

const EDITA = ['Edit', { file_path: '/x/a.ts', old_string: 'a', new_string: 'b' }];
caso('título livre + Edit sem trocar título → block de título', () => {
  const r = rodar('E4', transcript([EDITA]));
  ok(r?.decision === 'block' && /set_session_title/.test(r.reason), `esperava block de título, veio ${JSON.stringify(r)}`);
  ok(/cobrou-titulo/.test(log()), 'log sem "cobrou-titulo"');
});
caso('título livre + git commit sem trocar título → block', () => {
  ok(rodar('E4', transcript([['Bash', { command: 'git commit -m "x"' }]]))?.decision === 'block', 'esperava block');
});
caso('título livre + Edit + set_session_title self → passa', () => {
  ok(rodar('E4', transcript([['mcp__ccd_session_mgmt__set_session_title', { session_id: 'self', title: 'E4 · conversa da loja' }], EDITA])) === null, 'esperava passar');
});
caso('título livre sem trabalho → passa', () => {
  ok(rodar('E4', transcript([['Bash', { command: 'git status' }]])) === null, 'esperava passar');
});
caso('título de item + Edit → passa', () => {
  ok(rodar('E3', transcript([EDITA])) === null, 'esperava passar');
});
caso('título livre + Edit com stop_hook_active → passa e registra', () => {
  ok(rodar('E4', transcript([EDITA]), { stop_hook_active: true }) === null, 'esperava passar');
  ok(/deixou-passar-titulo/.test(log()), 'log sem "deixou-passar-titulo"');
});

for (const c of ['npm test', 'pytest -q', 'go test ./...', 'yarn run lint', 'npx vitest run', 'cargo test', 'make check']) {
  caso(`título livre + \`${c}\` sem trocar título → block`, () => {
    ok(rodar('E4', transcript([['Bash', { command: c }]]))?.decision === 'block', 'esperava block');
  });
}
caso('título livre + ls / git status → passa', () => {
  ok(rodar('E4', transcript([['Bash', { command: 'ls -la && git status' }]])) === null, 'esperava passar');
});
caso('título livre + pnpm test continua cobrando', () => {
  ok(rodar('E4', transcript([['Bash', { command: 'pnpm test' }]]))?.decision === 'block', 'esperava block');
});
caso('falso positivo: heredoc que só CITA painel.mjs, update, sessoes e livre não cobra', () => {
  const cmd = "python3 - <<'EOF'\ns = open('plano.md').read()\n# o painel.mjs faz update em sessoes quando o membro fica livre\nopen('plano.md','w').write(s)\nEOF";
  ok(rodar('E3', transcript([['Bash', { command: cmd }]])) === null, 'esperava passar');
});
caso('painel.mjs batch em sessoes com etapa livre → block; batch em fila com a palavra livre → passa', () => {
  const b = `node ~/.claude/skills/orquestradora/scripts/painel.mjs batch '[{"op":"update","colecao":"sessoes","id":"local_E3","data":{"etapa":"livre"}}]'`;
  ok(rodar('E3', transcript([['Bash', { command: b }]]))?.decision === 'block', 'batch sessoes livre devia cobrar');
  const f = `node ~/.claude/skills/orquestradora/scripts/painel.mjs batch '[{"op":"update","colecao":"fila","id":"F1","data":{"nota":"membro livre"}}]'`;
  ok(rodar('E3', transcript([['Bash', { command: f }]])) === null, 'batch em fila não é declarar livre');
});
caso('caminho do painel.mjs entre aspas → block (e batch entre aspas)', () => {
  const q = `node "$HOME/.claude/skills/orquestradora/scripts/painel.mjs" update sessoes x '{"etapa":"livre"}'`;
  ok(rodar('E3', transcript([['Bash', { command: q }]]))?.decision === 'block', 'update com aspas devia cobrar');
  const b = `node '$HOME/.claude/skills/orquestradora/scripts/painel.mjs' batch '[{"op":"update","colecao":"sessoes","id":"x","data":{"etapa":"livre"}}]'`;
  ok(rodar('E3', transcript([['Bash', { command: b }]]))?.decision === 'block', 'batch com aspas devia cobrar');
});
caso('painel.mjs só como invocação real: dentro de `node -e \'…\'` não cobra; depois de `cd x &&` cobra', () => {
  const dentro = `node -e 'require("child_process").execSync("node ~/.claude/skills/orquestradora/scripts/painel.mjs update sessoes x {\\"etapa\\":\\"livre\\"}")'`;
  ok(rodar('E3', transcript([['Bash', { command: dentro }]])) === null, 'string de outro comando não é invocação');
  const real = `cd x && node "$HOME/.claude/skills/orquestradora/scripts/painel.mjs" update sessoes y '{"etapa":"livre"}'`;
  ok(rodar('E3', transcript([['Bash', { command: real }]]))?.decision === 'block', 'cd && node painel.mjs devia cobrar');
});

caso('c3 R1: dois heredocs na mesma linha — o corpo do segundo com painel + livre não cobra; o corpo do primeiro também não', () => {
  const corpo = "node ~/.claude/skills/orquestradora/scripts/painel.mjs update sessoes x '{\"etapa\":\"livre\"}'";
  const cmd = `cat <<A > f; cat <<B > g\nlinha\nA\n${corpo}\nB`;
  ok(corpo.includes('livre') && cmd.split('\n').length === 5, 'precondição: o corpo do segundo está no comando');
  ok(rodar('E3', transcript([['Bash', { command: cmd }]])) === null, 'corpo do segundo heredoc cobrou');
  const real = `cat <<A > f; cat <<B > g\nx\nA\ny\nB\n${corpo}`;
  ok(rodar('E3', transcript([['Bash', { command: real }]]))?.decision === 'block', 'invocação real depois dos dois heredocs devia cobrar');
});
// c2 (R1/R3 da V1): a invocação tem de ser REAL — heredoc, string e `node -e` que só a citam não cobram.
const P = '$HOME/.claude/skills/orquestradora/scripts/painel.mjs';
const LINHA = `cd x && node "${P}" update sessoes y '{"etapa":"livre"}'`;
const cobra = (command) => rodar('E3', transcript([['Bash', { command }]]))?.decision === 'block';
caso('R1: o comando que a skill manda continua cobrando (precondição dos casos que não cobram)', () => {
  ok(cobra(`node "${P}" update sessoes y '{"etapa":"livre"}'`), 'sem cobrar, os casos abaixo não medem nada');
  ok(cobra(LINHA), 'cd x && node … devia cobrar');
  ok(cobra(`node "${P}" batch '[{"op":"update","colecao":"sessoes","id":"y","data":{"etapa":"livre"}}]'`), 'batch com sessoes devia cobrar');
});
caso('R1: heredoc que traz a linha de invocação no corpo não cobra', () => {
  ok(!cobra(`cat > x.md <<'X'\n${LINHA}\nX`), 'corpo de heredoc não é invocação');
  ok(!cobra(`cat > x.md <<-EOF\n\t${LINHA}\n\tEOF`), 'heredoc com <<- também');
  ok(cobra(`cat <<'X' > x.md\ntexto\nX\n${LINHA}`), 'invocação DEPOIS do heredoc ainda cobra');
});
caso('R1: node -e com quebra de linha, node -e com ; e echo com && não cobram', () => {
  ok(!cobra(`node -e "\n${LINHA}"`), 'quebra de linha dentro de aspas');
  ok(!cobra(`node -e 'const a = 1; node ${P} update sessoes x {"etapa":"livre"}'`), '; dentro de aspas simples');
  ok(!cobra(`echo "rode: cd x && node ${P} update sessoes y livre"`), '&& dentro de aspas duplas');
  ok(!cobra(`echo "ok \\" && node ${P} update sessoes y livre"`), 'aspas escapadas não fecham a string');
});
caso('R3: (node …), VAR=x node …, nice node …, env node …, $(node …) e crase cobram', () => {
  const inv = `node "${P}" update sessoes y '{"etapa":"livre"}'`;
  for (const c of [`(${inv})`, `FOO=1 ${inv}`, `nice ${inv}`, `nice -n 5 ${inv}`, `env FOO=1 ${inv}`, `time ${inv}`, `x=$(${inv})`, `echo \`${inv}\``, `echo "$(${inv})"`]) ok(cobra(c), `devia cobrar: ${c}`);
});
caso('K2: o comando `painel` do plugin (bin) cobra como o `node …/painel.mjs`; citá-lo em echo ou heredoc não', () => {
  ok(cobra(`painel update sessoes y '{"etapa":"livre"}'`), 'painel update sessoes … livre devia cobrar');
  ok(cobra(`cd x && "\${CLAUDE_PLUGIN_ROOT}/bin/painel" update sessoes y '{"etapa":"livre"}'`), 'caminho do bin entre aspas devia cobrar');
  ok(cobra(`painel batch '[{"op":"update","colecao":"sessoes","id":"y","data":{"etapa":"livre"}}]'`), 'batch com sessoes devia cobrar');
  ok(!cobra(`painel batch '[{"op":"update","colecao":"fila","id":"F1","data":{"nota":"livre"}}]'`), 'batch só de fila não cobra');
  ok(!cobra(`echo "painel update sessoes y livre"`), 'echo não é invocação');
  ok(!cobra(`cat > x.md <<'X'\npainel update sessoes y livre\nX`), 'heredoc não é invocação');
});

// F30 fatia 2: o `fez` deixa a executora livre sem limpar; o `com` e o título velho ganham cobrança.
const item = (id, data) => { mkdirSync(join(base, 'fila'), { recursive: true }); writeFileSync(join(base, 'fila', `${id}.json`), JSON.stringify({ id, version: 1, data: { titulo: 't', tema: 'x', ...data } })); };
const QUEM = (apelido, localId) => ({ localId, apelido, oQue: 'parte', em: '2026-10-25T10:00:00.000Z' });
const COM_DEL = (F, l, extra = '') => ['Bash', { command: `node ~/.claude/skills/orquestradora/scripts/painel.mjs com del ${F} ${l} ${extra}`.trim() }];
caso('F30-2: livre no fez de um item em validação, sem limpar → passa (livre-com-contexto)', () => {
  item('F1', { etapa: 'validacao', fez: [QUEM('E3', 'local_E3')], com: [] });
  ok(rodar('E3', transcript([TITULO])) === null, 'esperava passar');
  ok(/livre-com-contexto/.test(log()), 'log sem livre-com-contexto');
});
caso('F30-2: livre sem estar no fez de nenhum item e sem limpar → block (a regra 1 de hoje)', () => {
  item('F1', { etapa: 'validacao', fez: [QUEM('E4', 'local_E4')], com: [] });
  const r = rodar('E3', transcript([TITULO]));
  ok(r?.decision === 'block' && /clear_session/.test(r.reason), `esperava block da regra 1, veio ${JSON.stringify(r)}`);
});
caso('F30-2: livre ainda no com de um item → block da regra 3, mesmo estando no fez de outro', () => {
  item('F1', { etapa: 'execucao', com: [{ localId: 'local_E3', apelido: 'E3', oQue: 'parte' }] });
  item('F2', { etapa: 'validacao', fez: [QUEM('E3', 'local_E3')], com: [] });
  const r = rodar('E3', transcript([TITULO]));
  ok(r?.decision === 'block' && /ainda consta como trabalhando em F1/.test(r.reason) && /com del <F> local_E3/.test(r.reason), `esperava a regra 3, veio ${JSON.stringify(r)}`);
  ok(/cobrou-com/.test(log()), 'log sem cobrou-com');
});
caso('F30-2: com del com o título do item → block da regra 4; com del com título livre → passa', () => {
  item('F1', { etapa: 'validacao', fez: [QUEM('E3', 'local_E3')], com: [] });
  const r = rodar('E3', transcript([COM_DEL('F1', 'local_E3', '--fez')]));
  ok(r?.decision === 'block' && /E3 · livre/.test(r.reason), `esperava a regra 4, veio ${JSON.stringify(r)}`);
  ok(/cobrou-titulo-velho/.test(log()), 'log sem cobrou-titulo-velho');
  ok(rodar('E4', transcript([COM_DEL('F1', 'local_E4')])) === null, 'título livre devia passar');
});
caso('F30-2: com del do local_ de OUTRA sessão não cobra o título de quem tirou', () => {
  item('F1', { etapa: 'validacao', com: [{ localId: 'local_V4', apelido: 'V4', oQue: 'valida' }] });
  ok(rodar('E3', transcript([COM_DEL('F1', 'local_V4')])) === null, 'tirar a V4 não é sair do item');
});
caso('F30-2: com del estando no com de outro item → passa', () => {
  item('F1', { etapa: 'validacao', com: [] });
  item('F2', { etapa: 'execucao', com: [{ localId: 'local_E3', apelido: 'E3', oQue: 'parte' }] });
  ok(rodar('E3', transcript([COM_DEL('F1', 'local_E3')])) === null, 'esperava passar: ainda trabalha em F2');
});
caso('F30-2: as regras 3 e 4 cobram uma vez só (stop_hook_active solta) e fila ilegível deixa passar', () => {
  item('F1', { etapa: 'execucao', com: [{ localId: 'local_E3', apelido: 'E3', oQue: 'parte' }] });
  ok(rodar('E3', transcript([TITULO]), { stop_hook_active: true }) === null, 'a 3 devia soltar');
  writeFileSync(join(base, 'fila', 'F1.json'), '{ruim');
  ok(rodar('E3', transcript([COM_DEL('F1', 'local_E3')]))?.decision === 'block', 'fila ilegível: a regra 4 ainda vale (sem com legível)');
  ok(rodar('E3', transcript([COM_DEL('F1', 'local_E3')]), { stop_hook_active: true }) === null, 'a 4 devia soltar');
});

// F32: o hook solta em vez de cobrar. Ids no formato de verdade (o `painel` recusa `local_E3`); a pasta do painel é `base` (pai de FILA_DIR).
const UE5 = 'local_00000000-0000-4000-8000-0000000000e5'; const UV5 = 'local_00000000-0000-4000-8000-0000000000f5';
const UP5 = 'local_00000000-0000-4000-8000-0000000000a5'; const UE6 = 'local_00000000-0000-4000-8000-0000000000e6';
function pessoal() {
  ID.E5 = 'cli-e5'; ID.V5 = 'cli-v5'; ID.P5 = 'cli-p5'; ID.E6 = 'cli-e6';
  for (const [l, c, t] of [[UE5, ID.E5, 'E5 · lançador'], [UV5, ID.V5, 'V5 · valida'], [UP5, ID.P5, 'P5 · planeja'], [UE6, ID.E6, 'E6 · outra']]) {
    writeFileSync(join(base, 'app', `${l}.json`), JSON.stringify({ sessionId: l, cliSessionId: c, title: t, isArchived: false }));
  }
  writeFileSync(join(base, 'temas.json'), JSON.stringify([{ id: 'x', rotulo: 'X' }]));
}
const real = (id) => JSON.parse(readFileSync(join(base, 'fila', `${id}.json`), 'utf8')).data;
const livre = (n) => ['mcp__ccd_session_mgmt__set_session_title', { session_id: 'self', title: `${n} · livre` }];
const comDe = (l, ap) => [{ localId: l, apelido: ap, oQue: 'parte' }];
caso('F32: E livre no com → o hook tira com `fez`, não bloqueia, e o item fica sem a sessão', () => {
  pessoal(); item('F1', { etapa: 'execucao', com: comDe(UE5, 'E5') });
  const r = rodar('E5', transcript([livre('E5'), LIMPA]));
  ok(r === null, `esperava passar, veio ${JSON.stringify(r)}`);
  const d = real('F1');
  ok(Array.isArray(d.com) && d.com.length === 0, `com devia ficar vazio: ${JSON.stringify(d.com)}`);
  ok(d.fez?.length === 1 && d.fez[0].localId === UE5, `a E devia ficar no fez: ${JSON.stringify(d.fez)}`);
  ok(/soltou-com/.test(log()), 'log sem soltou-com');
});
caso('F32: V livre no com → tira sem `fez`', () => {
  pessoal(); item('F1', { etapa: 'validacao', com: comDe(UV5, 'V5') });
  ok(rodar('V5', transcript([livre('V5'), LIMPA])) === null, 'esperava passar');
  const d = real('F1');
  ok(d.com.length === 0 && d.fez === undefined, `V não entrega: ${JSON.stringify(d)}`);
});
caso('F32: P livre e dona → o item fica sem dono, o historico ganha a entrada e o agora é o motivo', () => {
  pessoal(); item('F1', { etapa: 'planejamento', donoLocalId: UP5, donoApelido: 'P5', historico: [] });
  ok(rodar('P5', transcript([livre('P5'), LIMPA])) === null, 'esperava passar');
  const d = real('F1');
  ok(d.donoLocalId === undefined && d.donoApelido === undefined, `dono devia sair: ${JSON.stringify(d)}`);
  ok(d.agora === 'a dona se declarou livre sem soltar', `agora: ${d.agora}`);
  ok(d.historico.length === 1 && d.historico[0].dono === null, `historico: ${JSON.stringify(d.historico)}`);
  ok(/soltou-dono/.test(log()), 'log sem soltou-dono');
});
caso('F32: item de OUTRA dona e com de outra sessão ficam como estão', () => {
  pessoal(); item('F1', { etapa: 'execucao', donoLocalId: UE6, donoApelido: 'E6', com: comDe(UE6, 'E6') });
  ok(rodar('E5', transcript([livre('E5'), LIMPA])) === null, 'esperava passar');
  const d = real('F1');
  ok(d.donoLocalId === UE6 && d.com.length === 1 && d.com[0].localId === UE6, `intacto: ${JSON.stringify(d)}`);
});
caso('F32: a linha de `sessoes` que já existe vira parada/livre; sessão sem linha não ganha uma', () => {
  pessoal(); item('F1', { etapa: 'execucao', com: comDe(UE5, 'E5') });
  mkdirSync(join(base, 'sessoes'), { recursive: true });
  writeFileSync(join(base, 'sessoes', `${UE5}.json`), JSON.stringify({ id: UE5, version: 1, data: { estado: 'trabalhando', etapa: 'x' } }));
  ok(rodar('E5', transcript([livre('E5'), LIMPA])) === null, 'esperava passar');
  const l = JSON.parse(readFileSync(join(base, 'sessoes', `${UE5}.json`), 'utf8')).data;
  ok(l.estado === 'parada' && l.etapa === 'livre', `linha: ${JSON.stringify(l)}`);
  item('F2', { etapa: 'execucao', com: comDe(UV5, 'V5') });
  ok(rodar('V5', transcript([livre('V5'), LIMPA])) === null, 'esperava passar');
  ok(!existsSync(join(base, 'sessoes', `${UV5}.json`)), 'o hook não cria linha');
});
caso('F32: escrita falhando (pasta da fila sem escrita) → bloqueia com a mensagem antiga e registra erro-ao-soltar', () => {
  pessoal(); item('F1', { etapa: 'execucao', com: comDe(UE5, 'E5') });
  chmodSync(join(base, 'fila'), 0o555);
  try {
    ok(!existsSync(join(base, 'fila', 'F1.json.teste')) && (() => { try { writeFileSync(join(base, 'fila', 'F1.json.teste'), 'x'); return false; } catch { return true; } })(), 'precondição: a pasta devia recusar escrita (rodando como root?)');
    const r = rodar('E5', transcript([livre('E5'), LIMPA]));
    ok(r?.decision === 'block' && /ainda consta como trabalhando em F1/.test(r.reason) && new RegExp(`com del <F> ${UE5}`).test(r.reason), `esperava a mensagem antiga, veio ${JSON.stringify(r)}`);
    ok(/erro-ao-soltar/.test(log()) && /cobrou-com/.test(log()), `log: ${log()}`);
  } finally { chmodSync(join(base, 'fila'), 0o755); }
  ok(real('F1').com.length === 1, 'o com não mudou');
});

// Conserto 1 (laudo V4).
const ROW = (id, json) => ['Bash', { command: `node ~/.claude/skills/orquestradora/scripts/painel.mjs update sessoes ${id} '${json}'` }];
caso('F32 A1: a dona que grava a linha de OUTRA sessão como livre não solta o item', () => {
  pessoal(); item('F1', { etapa: 'planejamento', donoLocalId: UP5, donoApelido: 'P5', historico: [] });
  rodar('P5', transcript([ROW(UE5, '{"estado":"parada","etapa":"livre"}')]));
  const d = real('F1');
  ok(d.donoLocalId === UP5 && d.agora === undefined, `o item devia ficar com a dona: ${JSON.stringify(d)}`);
  ok(!/soltou-dono/.test(log()), 'log com soltou-dono');
});
caso('F32 A1: "livre" noutro campo, ou noutra palavra da etapa, da PRÓPRIA linha não solta; etapa "livre" da própria linha solta', () => {
  pessoal(); item('F1', { etapa: 'planejamento', donoLocalId: UP5, donoApelido: 'P5', historico: [] });
  rodar('P5', transcript([ROW(UP5, '{"etapa":"planejando; caminho livre para a E"}')]));
  rodar('P5', transcript([ROW(UP5, '{"estado":"parada","bloqueio":"livre"}')]));
  ok(real('F1').donoLocalId === UP5, 'a palavra solta não é declaração');
  rodar('P5', transcript([ROW(UP5, '{"estado":"parada","etapa":"livre"}'), LIMPA]));
  ok(real('F1').donoLocalId === undefined, `a própria linha livre devia soltar: ${JSON.stringify(real('F1'))}`);
});
caso('F32 M5: a dona que se declara livre solta só o dono; o com das outras sessões fica', () => {
  pessoal(); item('F1', { etapa: 'execucao', donoLocalId: UP5, donoApelido: 'P5', historico: [], com: [...comDe(UV5, 'V5'), ...comDe(UE6, 'E6')] });
  ok(rodar('P5', transcript([livre('P5'), LIMPA])) === null, 'esperava passar');
  const d = real('F1');
  ok(d.donoLocalId === undefined && d.com.length === 2, `só o dono devia sair: ${JSON.stringify(d)}`);
});
caso('F32 M6: falha ao gravar a linha de `sessoes` só vai ao log (erro-sessoes) e não bloqueia', () => {
  pessoal(); item('F1', { etapa: 'execucao', com: comDe(UE5, 'E5') });
  mkdirSync(join(base, 'sessoes'), { recursive: true });
  writeFileSync(join(base, 'sessoes', `${UE5}.json`), '{ruim');
  ok(rodar('E5', transcript([livre('E5'), LIMPA])) === null, 'não devia bloquear');
  ok(real('F1').com.length === 0, 'o item foi solto');
  ok(/erro-sessoes/.test(log()), `log sem erro-sessoes: ${log()}`);
});
caso('F32 B7: a dona que não consegue soltar é mandada a `painel soltar`, não a `com del`', () => {
  pessoal(); item('F1', { etapa: 'planejamento', donoLocalId: UP5, donoApelido: 'P5', historico: [] });
  chmodSync(join(base, 'fila'), 0o555);
  try {
    const r = rodar('P5', transcript([livre('P5'), LIMPA]));
    ok(r?.decision === 'block' && /painel soltar <F>/.test(r.reason) && !/com del/.test(r.reason), `mensagem: ${JSON.stringify(r)}`);
  } finally { chmodSync(join(base, 'fila'), 0o755); }
});
caso('F32 B10: o hook confere a linha de `sessoes` na pasta de IZANAGI_PAINEL_DIR, como o painel.mjs', () => {
  pessoal();
  const alt = join(base, 'alt'); mkdirSync(join(alt, 'sessoes'), { recursive: true });
  writeFileSync(join(alt, 'sessoes', `${UP5}.json`), JSON.stringify({ id: UP5, version: 1, data: { estado: 'trabalhando', etapa: 'x' } }));
  ok(rodar('P5', transcript([livre('P5'), LIMPA]), {}, { IZANAGI_PAINEL_DIR: alt }) === null, 'esperava passar');
  const l = JSON.parse(readFileSync(join(alt, 'sessoes', `${UP5}.json`), 'utf8')).data;
  ok(l.estado === 'parada' && l.etapa === 'livre', `linha: ${JSON.stringify(l)}`);
});
caso('F32 A2: com a trava do painel presa e três escritas, o hook bloqueia dentro do prazo de 10 s do hooks.json (não morre calado)', () => {
  pessoal();
  item('F1', { etapa: 'execucao', com: comDe(UE5, 'E5') }); item('F3', { etapa: 'execucao', com: comDe(UE5, 'E5') });
  item('F2', { etapa: 'execucao', donoLocalId: UE5, donoApelido: 'E5', historico: [] });
  const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'skills', 'orquestradora', 'scripts', 'painel.mjs');
  const preso = spawn('node', [SCRIPT, 'update', 'fila', 'F2', '{"agora":"segura"}'], { env: { ...process.env, PAINEL_DIR: base, PAINEL_PAUSA_MS: '20000', CLAUDE_CODE_SESSION_ID: '' }, stdio: 'ignore' });
  try {
    execFileSync('sleep', ['0.7']); // o `preso` já tem a trava
    ok(existsSync(join(base, '.trava')), 'precondição: a trava está presa');
    const t0 = Date.now();
    const r = rodar('E5', transcript([livre('E5'), LIMPA]));
    const gasto = Date.now() - t0;
    ok(gasto < 9500, `o hook levou ${gasto} ms: passaria dos 10 s do hooks.json`);
    ok(r?.decision === 'block', `esperava block, veio ${JSON.stringify(r)}`);
    ok(/erro-ao-soltar/.test(log()), 'log sem erro-ao-soltar');
    ok(real('F1').com.length === 1 && real('F3').com.length === 1, 'nada foi gravado');
  } finally { preso.kill('SIGKILL'); }
});

// R1 (F41): o turno atual foi aberto por outra sessão (meta com origem) logo depois de um turno humano em que a E4 editou:
// o início é o do peer, então o Edit do turno anterior não conta como trabalho deste turno.
function transcriptComPeer(ferramentasAntes) {
  const t0 = Date.now() - 60_000; const t1 = Date.now() - 10_000;
  const L = [{ type: 'user', origin: { kind: 'human' }, timestamp: new Date(t0).toISOString(), message: { content: 'antes' } }];
  ferramentasAntes.forEach(([name, input], k) => L.push({ type: 'assistant', timestamp: new Date(t0 + 1000 + k).toISOString(), message: { content: [{ type: 'tool_use', name, input }] } }));
  L.push({ type: 'user', isMeta: true, origin: { kind: 'peer' }, timestamp: new Date(t1).toISOString(), message: { content: '<cross-session-message>outro item</cross-session-message>' } });
  const f = join(base, 't.jsonl'); writeFileSync(f, L.map((x) => JSON.stringify(x)).join('\n') + '\n'); return f;
}
const EDIT = ['Edit', { file_path: '/r/a.ts', old_string: 'a', new_string: 'b' }];
caso('R1: E4 livre que editou num turno humano e agora tem um turno aberto por peer → não cobra o título (o trabalho é do turno anterior)', () => {
  const r = rodar('E4', transcriptComPeer([EDIT]));
  ok(r === null, `esperava passar, veio ${JSON.stringify(r)}`);
});
caso('R1: precondição — a mesma edição no turno ATUAL aberto por peer continua cobrando', () => {
  const t0 = Date.now() - 60_000; const t1 = Date.now() - 10_000;
  const L = [
    { type: 'user', origin: { kind: 'human' }, timestamp: new Date(t0).toISOString(), message: { content: 'antes' } },
    { type: 'user', isMeta: true, origin: { kind: 'peer' }, timestamp: new Date(t1).toISOString(), message: { content: 'item' } },
    { type: 'assistant', timestamp: new Date(t1 + 1000).toISOString(), message: { content: [{ type: 'tool_use', name: EDIT[0], input: EDIT[1] }] } },
  ];
  const f = join(base, 't.jsonl'); writeFileSync(f, L.map((x) => JSON.stringify(x)).join('\n') + '\n');
  const r = rodar('E4', f);
  ok(r?.decision === 'block', `esperava block, veio ${JSON.stringify(r)}`);
});
console.log(falhas ? `${falhas} falha(s)` : 'todos verdes');
process.exitCode = falhas ? 1 : 0;
