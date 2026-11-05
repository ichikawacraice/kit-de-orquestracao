#!/usr/bin/env node
// Testes de hooks/contexto-do-papel.mjs: a regra de contexto por papel (orquestradora e dona), lida do `usage` do transcript.
// HOME e HOOKS_CREWAI_BASE ficam em pasta temporária: nada aqui toca o ~/.claude real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOK = join(dirname(fileURLToPath(import.meta.url)), '..', 'contexto-do-papel.mjs');
// P é a dona (o `local_P` é dono de um item vivo da fila); AV é uma sessão avulsa; ORQ, a orquestradora.
const ID = { P: 'cli-p', AV: 'cli-av', ORQ: 'cli-orq' };
const TITULO = { P: 'F7 · plano do editor', AV: 'fix(web): algo', ORQ: '🎛 orquestradora — kit' };

function novo() {
  const base = mkdtempSync(join(tmpdir(), 'contexto-papel-'));
  mkdirSync(join(base, 'orq')); mkdirSync(join(base, 'app')); mkdirSync(join(base, 'home'));
  for (const k of Object.keys(ID)) writeFileSync(join(base, 'app', `local_${k}.json`), JSON.stringify({ sessionId: `local_${k}`, cliSessionId: ID[k], title: TITULO[k], isArchived: false }));
  mkdirSync(join(base, 'painel', 'fila'), { recursive: true });
  writeFileSync(join(base, 'painel', 'fila', 'F7.json'), JSON.stringify({ id: 'F7', version: 1, data: { titulo: 'plano do editor', etapa: 'execucao', donoLocalId: 'local_P' } }));
  return base;
}
const usage = (n) => ({ input_tokens: 2, cache_creation_input_tokens: 100, cache_read_input_tokens: n - 102, output_tokens: 50 });
const T1 = Date.now() - 10_000;
// Transcript: turno anterior, turno atual com `ferramentas`, e a última entrada do assistant com o texto e o usage dados.
function transcript(base, { tokens, texto = 'feito', ferramentas = [], anterior = [], extra = [] }) {
  const t0 = Date.now() - 60_000;
  const L = [{ type: 'user', origin: { kind: 'human' }, timestamp: new Date(t0).toISOString(), message: { content: 'antes' } }];
  anterior.forEach(([name, input], k) => L.push({ type: 'assistant', timestamp: new Date(t0 + 1000 + k).toISOString(), message: { content: [{ type: 'tool_use', name, input }] } }));
  L.push({ type: 'user', origin: { kind: 'human' }, timestamp: new Date(T1).toISOString(), message: { content: 'agora' } });
  ferramentas.forEach(([name, input], k) => L.push({ type: 'assistant', timestamp: new Date(T1 + 1000 + k).toISOString(), message: { content: [{ type: 'tool_use', id: `tu${k}`, name, input }] } }));
  if (tokens !== null) L.push({ type: 'assistant', timestamp: new Date(T1 + 5000).toISOString(), message: { content: [{ type: 'text', text: texto }], usage: usage(tokens) } });
  else L.push({ type: 'assistant', timestamp: new Date(T1 + 5000).toISOString(), message: { content: [{ type: 'text', text: texto }] } });
  L.push(...extra);
  const f = join(base, 't.jsonl'); writeFileSync(f, L.map((x) => JSON.stringify(x)).join('\n') + '\n'); return f;
}
function rodar(base, quem, f, extra = {}) {
  const out = execFileSync('node', [HOOK], {
    input: JSON.stringify({ session_id: ID[quem], transcript_path: f, hook_event_name: 'Stop', ...extra }), encoding: 'utf8', timeout: 15000, killSignal: 'SIGKILL',
    env: { ...process.env, HOME: join(base, 'home'), HOOKS_CREWAI_BASE: join(base, 'orq'), POOL_APP_SESSOES_DIR: join(base, 'app'), PAINEL_DIR: join(base, 'painel') },
  });
  return out ? JSON.parse(out) : null;
}
const log = (base) => { const p = join(base, 'orq', 'hooks-crewai.log'); return existsSync(p) ? readFileSync(p, 'utf8') : ''; };
const com = (fn) => { const base = novo(); try { fn(base); } finally { rmSync(base, { recursive: true, force: true }); } };
const LIMPA = ['mcp__ccd_session_mgmt__clear_session', { session_id: 'self' }];
const ligar = (b, extra = {}) => writeFileSync(join(b, 'orq', 'operador-ausente.json'), JSON.stringify({ desde: new Date().toISOString(), frase: '/ausente on', sessionId: 'x', por: 'comando', ...extra }));
const pergunta = (b, id, data) => { mkdirSync(join(b, 'painel', 'perguntas'), { recursive: true }); writeFileSync(join(b, 'painel', 'perguntas', `${id}.json`), JSON.stringify({ id, data })); };
const cobrou = (r, re) => { assert.equal(r?.decision, 'block', `esperava block, veio ${JSON.stringify(r)}`); assert.match(r.reason, re); };

test('1. a dona com 360 mil sem a linha de escape: cobra (cobrou-200)', () => com((b) => {
  const r = rodar(b, 'P', transcript(b, { tokens: 360_000 }));
  cobrou(r, /360 mil.*clear_session "self".*Contexto: sigo/s);
  assert.match(log(b), /\tcontexto-do-papel\tcobrou-200\tdona 360 mil/);
}));
test('2. a dona com 360 mil e a linha "Contexto: sigo — …": passa (satisfeito-sigo)', () => com((b) => {
  const r = rodar(b, 'P', transcript(b, { tokens: 360_000, texto: 'pronto\nContexto: sigo — falta o passo 3 do plano' }));
  assert.equal(r, null);
  assert.match(log(b), /\tsatisfeito-sigo\t/); assert.doesNotMatch(log(b), /cobrou/);
}));
test('2b. a linha de escape curta demais (< 10 caracteres) não vale', () => com((b) => {
  cobrou(rodar(b, 'P', transcript(b, { tokens: 360_000, texto: 'Contexto: sigo — sim' })), /360 mil/);
}));
test('3. a dona com 510 mil e a linha "Contexto: sigo — …": cobra mesmo assim (cobrou-300)', () => com((b) => {
  const r = rodar(b, 'P', transcript(b, { tokens: 510_000, texto: 'Contexto: sigo — falta o passo 3 do plano' }));
  cobrou(r, /510 mil.*Não pegue trabalho novo/s);
  assert.match(log(b), /\tcobrou-300\t/);
}));
test('4. a dona com 260 mil: cobra só se o último parágrafo espera o operador (? ou Q<n>)', () => com((b) => {
  cobrou(rodar(b, 'P', transcript(b, { tokens: 260_000, texto: 'plano pronto.\n\nQuer que eu siga para a execução?' })), /260 mil.*esperando resposta/s);
  assert.match(log(b), /\tcobrou-150-espera\t/);
}));
test('4b. o mesmo P com Q-ID no último parágrafo cobra; sem ? nem Q-ID passa sem log de cobrança', () => com((b) => {
  cobrou(rodar(b, 'P', transcript(b, { tokens: 260_000, texto: 'plano pronto.\n\nAguardo o Q231.' })), /esperando resposta/);
  const b2 = novo();
  try {
    assert.equal(rodar(b2, 'P', transcript(b2, { tokens: 260_000, texto: 'plano pronto, segue o trabalho.' })), null);
    assert.equal(log(b2), '', 'sem cobrança não há linha de log');
  } finally { rmSync(b2, { recursive: true, force: true }); }
}));
test('5. a dona com 360 mil que chamou clear_session "self" no turno: passa (limpou); só no turno anterior, cobra', () => com((b) => {
  assert.equal(rodar(b, 'P', transcript(b, { tokens: 360_000, ferramentas: [LIMPA] })), null);
  assert.match(log(b), /\tlimpou\t/);
  cobrou(rodar(b, 'P', transcript(b, { tokens: 360_000, anterior: [LIMPA] })), /360 mil/);
  assert.match(log(b), /\tcobrou-200\t/); // O1: a segunda metade também deixa a linha de cobrança no log
}));
test('5b. clear_session de OUTRA sessão não vale', () => com((b) => {
  cobrou(rodar(b, 'P', transcript(b, { tokens: 360_000, ferramentas: [['mcp__ccd_session_mgmt__clear_session', { session_id: 'local_X' }]] })), /360 mil/);
}));
test('8. sessão avulsa com 400 mil: não cobra e não registra', () => com((b) => {
  assert.equal(rodar(b, 'AV', transcript(b, { tokens: 400_000 })), null);
  assert.equal(log(b), '');
}));
test('8b. com o modo ausente ligado a orquestradora (título) segue a régua da dona', () => com((b) => {
  ligar(b);
  cobrou(rodar(b, 'ORQ', transcript(b, { tokens: 360_000 })), /360 mil/);
}));
test('9. stop_hook_active com P a 360 mil: passa (deixou-passar)', () => com((b) => {
  assert.equal(rodar(b, 'P', transcript(b, { tokens: 360_000 }), { stop_hook_active: true }), null);
  assert.match(log(b), /\tdeixou-passar\tcobrou-200 dona 360 mil/);
}));
test('10. a última entrada com usage é de subagente (400 mil) e a da sessão tem 50 mil: não cobra', () => com((b) => {
  const lado = { type: 'assistant', isSidechain: true, timestamp: new Date(T1 + 6000).toISOString(), message: { content: [{ type: 'text', text: 'sub' }], usage: usage(400_000) } };
  const f = transcript(b, { tokens: 50_000, extra: [lado] });
  const usos = readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((x) => x.message?.usage);
  assert.equal(usos.length, 2, 'precondição: as duas entradas têm usage');
  assert.equal(usos.at(-1).isSidechain, true, 'precondição: a última do arquivo é a do subagente');
  assert.equal(rodar(b, 'P', f), null);
  assert.equal(log(b), '');
}));
test('11. transcript sem nenhum usage: não cobra e registra sem-usage', () => com((b) => {
  assert.equal(rodar(b, 'P', transcript(b, { tokens: null })), null);
  assert.match(log(b), /\tsem-usage\t/);
}));
test('12. transcript inexistente: não cobra, registra erro e sai com exit 0', () => com((b) => {
  assert.equal(rodar(b, 'P', join(b, 'nao-existe.jsonl')), null); // execFileSync lança se o exit não for 0
  assert.match(log(b), /\terro\t/);
}));
test('13. depois de compactar vale a última leitura, não a maior', () => com((b) => {
  const antes = { type: 'assistant', timestamp: new Date(T1 - 5000).toISOString(), message: { content: [{ type: 'text', text: 'x' }], usage: usage(400_000) } };
  const f = transcript(b, { tokens: 80_000, anterior: [] });
  writeFileSync(f, JSON.stringify(antes) + '\n' + readFileSync(f, 'utf8'));
  assert.equal(rodar(b, 'P', f), null); assert.equal(log(b), '');
}));
test('14. os limites são inclusivos: 350.000 cobra e 349.999 não; 500.000 já é o teto', () => com((b) => {
  cobrou(rodar(b, 'P', transcript(b, { tokens: 350_000 })), /350 mil/);
  assert.match(log(b), /\tcobrou-200\t/);
  const b2 = novo();
  try { assert.equal(rodar(b2, 'P', transcript(b2, { tokens: 349_999 })), null); assert.equal(log(b2), ''); } finally { rmSync(b2, { recursive: true, force: true }); }
  cobrou(rodar(b, 'P', transcript(b, { tokens: 500_000, texto: 'Contexto: sigo — falta o passo 3 do plano' })), /Não pegue trabalho novo/);
}));

// O2 (F35): a entrada sintética do assistant (`model: "<synthetic>"`, usage zerado) não vira a última leitura.
const SINTETICA = { type: 'assistant', timestamp: new Date(T1 + 9000).toISOString(), message: { model: '<synthetic>', content: [{ type: 'text', text: 'No response requested.' }], usage: { input_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 0 } } };
test('O2. transcript que termina em "No response requested." (sintética, usage zerado): o hook ainda cobra pela leitura real', () => com((b) => {
  cobrou(rodar(b, 'P', transcript(b, { tokens: 360_000, extra: [SINTETICA] })), /360 mil/);
  assert.match(log(b), /\tcobrou-200\tdona 360 mil/);
}));
test('O2b. precondição: sem pular a sintética o hook leria 0 e calaria (a fixture tem a entrada zerada como ÚLTIMA)', () => com((b) => {
  const f = transcript(b, { tokens: 360_000, extra: [SINTETICA] });
  const ultima = JSON.parse(readFileSync(f, 'utf8').trim().split('\n').pop());
  assert.equal(ultima.message.model, '<synthetic>'); assert.equal(ultima.message.usage.cache_read_input_tokens, 0);
}));
// O3 (F35): o `?` dentro de uma URL com query não conta como pergunta no último parágrafo.
test('O3a. P com 260 mil e o último parágrafo com só uma URL com query: não dispara a regra dos 250 mil', () => com((b) => {
  assert.equal(rodar(b, 'P', transcript(b, { tokens: 260_000, texto: 'pronto\n\nveja https://exemplo.com/a?b=1&c=2 depois' })), null);
  assert.doesNotMatch(log(b), /cobrou/);
}));
test('O3b. o mesmo parágrafo com uma pergunta de verdade ao lado da URL dispara', () => com((b) => {
  cobrou(rodar(b, 'P', transcript(b, { tokens: 260_000, texto: 'pronto\n\nveja https://exemplo.com/a?b=1 — posso seguir?' })), /260 mil/);
  assert.match(log(b), /\tcobrou-150-espera\t/);
}));
test('O3c. precondição: sem URL, o `?` sozinho dispara (o teste mede a URL, não um hook que nunca cobra)', () => com((b) => {
  cobrou(rodar(b, 'P', transcript(b, { tokens: 260_000, texto: 'pronto\n\nposso seguir?' })), /260 mil/);
}));

// F147: com o operador presente a orquestradora não é mais bloqueada por contexto (o sinal é o botão de limpar da barra); com o
// modo ausente ligado vale a régua da dona, que cobra.
const agora = () => new Date().toISOString();
const LIMPAR = (extra = {}) => ({ titulo: 'limpar · orquestradora', sessaoId: 'local_ORQ', estado: 'aberta', atualizadoEm: agora(), ...extra });
test('F147-1. ORQ presente a 260, 360 e 460 mil, sem pergunta nem janela: o Stop sai sem block e registra o contexto alto', () => com((b) => {
  // F219: a régua subiu para 250 mil (a sessão recomeça com ~90 mil); 160 mil não registra mais.
  assert.equal(rodar(b, 'ORQ', transcript(b, { tokens: 160_000 })), null, '160 mil');
  assert.doesNotMatch(log(b), /contexto-alto/, '160 mil registrou contexto alto');
  for (const tokens of [260_000, 360_000, 460_000]) {
    assert.equal(rodar(b, 'ORQ', transcript(b, { tokens })), null, `${tokens}`);
    assert.match(log(b), new RegExp(`\\tcontexto-alto\\torquestradora ${tokens / 1000} mil`));
  }
  assert.doesNotMatch(log(b), /cobrou/);
}));
test('F147-2. ORQ presente a 260 mil com "?" no fim: também sem block (nem pedido, nem janela)', () => com((b) => {
  assert.equal(rodar(b, 'ORQ', transcript(b, { tokens: 260_000, texto: 'pronto.\n\nPosso seguir?' })), null);
  assert.doesNotMatch(log(b), /cobrou/);
}));
test('F147-3. ORQ a 140 mil: nada é registrado (abaixo da régua do botão)', () => com((b) => {
  assert.equal(rodar(b, 'ORQ', transcript(b, { tokens: 140_000 })), null);
  assert.doesNotMatch(log(b), /contexto-alto/);
}));
test('F147-4. ORQ a 260 mil que chamou clear_session "self" no turno: registra limpou', () => com((b) => {
  assert.equal(rodar(b, 'ORQ', transcript(b, { tokens: 260_000, ferramentas: [LIMPA] })), null);
  assert.match(log(b), /\tlimpou\t/);
  assert.doesNotMatch(log(b), /contexto-alto/);
}));
test('F147-5. pergunta `limpar · orquestradora` antiga aberta não muda nada (nem cobra, nem some o registro)', () => com((b) => {
  pergunta(b, 'Q1', LIMPAR());
  assert.equal(rodar(b, 'ORQ', transcript(b, { tokens: 260_000 })), null);
  assert.match(log(b), /\tcontexto-alto\t/);
}));
test('F147-6. contraste: com o modo ausente ligado a ORQ segue a régua da dona e cobra (360 mil → cobrou-200; 260 mil com "?" → cobrou-150-espera)', () => com((b) => {
  ligar(b);
  cobrou(rodar(b, 'ORQ', transcript(b, { tokens: 360_000 })), /360 mil/);
  assert.match(log(b), /\tcobrou-200\t/);
  cobrou(rodar(b, 'ORQ', transcript(b, { tokens: 260_000, texto: 'pronto.\n\nPosso seguir?' })), /esperando resposta/);
  assert.match(log(b), /\tcobrou-150-espera\t/);
}));
test('F147-7. bandeira {ligado:false} vale como desligada: ORQ a 360 mil sem block', () => com((b) => {
  ligar(b, { ligado: false, desligadoEm: agora(), por: 'painel' });
  assert.equal(rodar(b, 'ORQ', transcript(b, { tokens: 360_000 })), null);
  assert.doesNotMatch(log(b), /cobrou/);
}));
// A orquestradora em modo ausente segue a régua da dona, mas o log e o aviso dizem que é a orquestradora em modo ausente e
// como desligá-lo: a bandeira ligada pelo botão do painel fica ligada mesmo com o operador de volta.
const marcar = (b, sid) => { mkdirSync(join(b, 'orq', 'ativas'), { recursive: true }); writeFileSync(join(b, 'orq', 'ativas', sid), '{}'); };
const PERGUNTA = 'Fila vazia.\n\nTemos mais algo planejado?';
test('F190-1. ORQ marcada, modo ausente do painel ligado, 257 mil com "?": cobra dizendo modo ausente e registra orquestradora-ausente', () => com((b) => {
  marcar(b, ID.ORQ);
  ligar(b, { frase: 'botão do painel', por: 'painel' });
  const r = rodar(b, 'ORQ', transcript(b, { tokens: 257_000, texto: PERGUNTA }));
  cobrou(r, /257 mil.*esperando resposta/s);
  assert.match(r.reason, /modo ausente/i);
  assert.match(r.reason, /desde \d{2}:\d{2} em São Paulo, pelo botão do painel/);
  assert.match(r.reason, /\/ausente off/);
  assert.match(log(b), /\tcobrou-150-espera\torquestradora-ausente 257 mil/);
  assert.doesNotMatch(log(b), /\tdona /);
}));
test('F190-2. a mesma ORQ marcada com o modo ausente desligado: sem block, registra contexto-alto orquestradora', () => com((b) => {
  marcar(b, ID.ORQ);
  assert.equal(rodar(b, 'ORQ', transcript(b, { tokens: 257_000, texto: PERGUNTA })), null);
  assert.match(log(b), /\tcontexto-alto\torquestradora 257 mil/);
  assert.doesNotMatch(log(b), /cobrou/);
}));
test('F190-3. a dona não ganha o aviso do modo ausente', () => com((b) => {
  ligar(b);
  const r = rodar(b, 'P', transcript(b, { tokens: 360_000 }));
  cobrou(r, /360 mil/);
  assert.doesNotMatch(r.reason, /modo ausente/i);
  assert.match(log(b), /\tcobrou-200\tdona 360 mil/);
}));
test('F48-9. a dona com 360 mil segue cobrando sem bandeira (a mudança é só da orquestradora)', () => com((b) => {
  cobrou(rodar(b, 'P', transcript(b, { tokens: 360_000 })), /360 mil/);
}));

// F54: `clear_session` "self" recusado (tool_result com is_error) não é limpeza.
const resultado = (id, erro) => ({ type: 'user', timestamp: new Date(T1 + 2000).toISOString(), message: { content: [{ type: 'tool_result', tool_use_id: id, is_error: erro, content: erro ? 'This session was not cleared: a message the user sent is waiting in the queue' : 'ok' }] } });
const limpaCom = (id) => ({ type: 'assistant', timestamp: new Date(T1 + 1500).toISOString(), message: { content: [{ type: 'tool_use', id, name: 'mcp__ccd_session_mgmt__clear_session', input: { session_id: 'self' } }] } });
test('F54.1 precondição: clear_session "self" com tool_result de sucesso continua contando (limpou)', () => com((b) => {
  const f = transcript(b, { tokens: 360_000, extra: [limpaCom('tu1'), resultado('tu1', false)] });
  assert.equal(rodar(b, 'P', f), null);
  assert.match(log(b), /\tlimpou\t/);
}));
test('F54.2 clear_session "self" com tool_result is_error: não conta como limpou e cobra', () => com((b) => {
  const f = transcript(b, { tokens: 360_000, extra: [limpaCom('tu2'), resultado('tu2', true)] });
  cobrou(rodar(b, 'P', f), /360 mil/);
  assert.doesNotMatch(log(b), /\tlimpou\t/);
  assert.match(log(b), /\tcobrou-200\t/);
}));

test('dona: a mesma sessão sem item vivo não é medida; com o item em feito também não', () => com((b) => {
  cobrou(rodar(b, 'P', transcript(b, { tokens: 360_000 })), /360 mil/);
  writeFileSync(join(b, 'painel', 'fila', 'F7.json'), JSON.stringify({ id: 'F7', version: 1, data: { titulo: 'plano do editor', etapa: 'feito', donoLocalId: 'local_P' } }));
  assert.equal(rodar(b, 'P', transcript(b, { tokens: 360_000 })), null, 'item fechado');
  rmSync(join(b, 'painel', 'fila', 'F7.json'));
  assert.equal(rodar(b, 'P', transcript(b, { tokens: 360_000 })), null, 'sem item');
}));

// F420: um aviso por limiar cruzado, não um por turno. O nível já cobrado fica no estado (`<sid>:contexto`); só um limiar
// acima cobra de novo, e o nível cai (limpeza ou compactação) rearma.
const estado = (b) => { const p = join(b, 'orq', 'hooks-crewai-estado.json'); return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : {}; };
test('F420-1. a dona a 360 mil: o 1º turno cobra, os seguintes no mesmo limiar passam (ja-avisado); 510 mil cobra de novo', () => com((b) => {
  cobrou(rodar(b, 'P', transcript(b, { tokens: 360_000 })), /360 mil/);
  assert.equal(estado(b)[`${ID.P}:contexto`]?.nivel, 2, 'precondição: o nível cobrado foi gravado');
  assert.equal(rodar(b, 'P', transcript(b, { tokens: 370_000 })), null, '2º turno no mesmo limiar');
  assert.equal(rodar(b, 'P', transcript(b, { tokens: 380_000 })), null, '3º turno no mesmo limiar');
  assert.equal((log(b).match(/\tcobrou-200\t/g) || []).length, 1, 'uma cobrança só');
  assert.equal((log(b).match(/\tja-avisado\t/g) || []).length, 2, 'os outros registram ja-avisado');
  cobrou(rodar(b, 'P', transcript(b, { tokens: 510_000 })), /Não pegue trabalho novo/);
  assert.match(log(b), /\tcobrou-300\t/);
}));
test('F420-2. a dona a 260 mil terminando com pergunta: cobra uma vez, não a cada pergunta', () => com((b) => {
  const P2 = 'plano pronto.\n\nSigo para a execução?';
  cobrou(rodar(b, 'P', transcript(b, { tokens: 260_000, texto: P2 })), /esperando resposta/);
  assert.equal(rodar(b, 'P', transcript(b, { tokens: 265_000, texto: P2 })), null);
  assert.equal((log(b).match(/\tcobrou-150-espera\t/g) || []).length, 1);
}));
test('F420-3. o contexto que cai abaixo do nível cobrado (limpeza, compactação) rearma o aviso', () => com((b) => {
  cobrou(rodar(b, 'P', transcript(b, { tokens: 360_000 })), /360 mil/);
  assert.equal(rodar(b, 'P', transcript(b, { tokens: 90_000 })), null, 'depois de limpar');
  assert.equal(estado(b)[`${ID.P}:contexto`], undefined, 'o nível sai do estado');
  cobrou(rodar(b, 'P', transcript(b, { tokens: 360_000 })), /360 mil/);
  assert.equal((log(b).match(/\tcobrou-200\t/g) || []).length, 2);
}));
test('F420-4. a linha "Contexto: sigo — …" responde ao limiar: o turno seguinte no mesmo limiar não cobra', () => com((b) => {
  assert.equal(rodar(b, 'P', transcript(b, { tokens: 360_000, texto: 'Contexto: sigo — falta o passo 3 do plano' })), null);
  assert.equal(rodar(b, 'P', transcript(b, { tokens: 370_000 })), null);
  assert.doesNotMatch(log(b), /\tcontexto-do-papel\tcobrou-/);
}));
test('F420-5. o turno que deixou passar (stop_hook_active) não conta como avisado', () => com((b) => {
  assert.equal(rodar(b, 'P', transcript(b, { tokens: 360_000 }), { stop_hook_active: true }), null);
  cobrou(rodar(b, 'P', transcript(b, { tokens: 360_000 })), /360 mil/);
}));
test('F420-6. o nível é por sessão: a ORQ em modo ausente não herda o aviso da dona', () => com((b) => {
  ligar(b);
  cobrou(rodar(b, 'P', transcript(b, { tokens: 360_000 })), /360 mil/);
  cobrou(rodar(b, 'ORQ', transcript(b, { tokens: 360_000 })), /360 mil/);
}));
