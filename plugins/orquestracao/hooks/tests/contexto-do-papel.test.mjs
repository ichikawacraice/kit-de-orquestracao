#!/usr/bin/env node
// Testes de hooks/contexto-do-papel.mjs (F35): a regra de contexto por papel, lida do `usage` do transcript.
// HOME e HOOKS_CREWAI_BASE ficam em pasta temporária: nada aqui toca o ~/.claude real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOK = join(dirname(fileURLToPath(import.meta.url)), '..', 'contexto-do-papel.mjs');
const ID = { P: 'cli-p', D: 'cli-d', E: 'cli-e', V: 'cli-v', AV: 'cli-av', ORQ: 'cli-orq' };
const TITULO = { P: 'P3 · plano', D: 'D1 · tela', E: 'E2 · F35', V: 'V4 · valida', AV: 'fix(web): algo', ORQ: '🎛 orquestradora — kit' };

function novo() {
  const base = mkdtempSync(join(tmpdir(), 'contexto-papel-'));
  mkdirSync(join(base, 'orq')); mkdirSync(join(base, 'app')); mkdirSync(join(base, 'home'));
  for (const k of Object.keys(ID)) writeFileSync(join(base, 'app', `local_${k}.json`), JSON.stringify({ sessionId: `local_${k}`, cliSessionId: ID[k], title: TITULO[k], isArchived: false }));
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
  ferramentas.forEach(([name, input], k) => L.push({ type: 'assistant', timestamp: new Date(T1 + 1000 + k).toISOString(), message: { content: [{ type: 'tool_use', name, input }] } }));
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

test('1. P com 360 mil sem a linha de escape: cobra (cobrou-200)', () => com((b) => {
  const r = rodar(b, 'P', transcript(b, { tokens: 360_000 }));
  cobrou(r, /360 mil.*clear_session "self".*Contexto: sigo/s);
  assert.match(log(b), /\tcontexto-do-papel\tcobrou-200\tplanejadora 360 mil/);
}));
test('2. P com 360 mil e a linha "Contexto: sigo — …": passa (satisfeito-sigo)', () => com((b) => {
  const r = rodar(b, 'P', transcript(b, { tokens: 360_000, texto: 'pronto\nContexto: sigo — falta o passo 3 do plano' }));
  assert.equal(r, null);
  assert.match(log(b), /\tsatisfeito-sigo\t/); assert.doesNotMatch(log(b), /cobrou/);
}));
test('2b. a linha de escape curta demais (< 10 caracteres) não vale', () => com((b) => {
  cobrou(rodar(b, 'P', transcript(b, { tokens: 360_000, texto: 'Contexto: sigo — sim' })), /360 mil/);
}));
test('3. P com 510 mil e a linha "Contexto: sigo — …": cobra mesmo assim (cobrou-300)', () => com((b) => {
  const r = rodar(b, 'P', transcript(b, { tokens: 510_000, texto: 'Contexto: sigo — falta o passo 3 do plano' }));
  cobrou(r, /510 mil.*Não pegue trabalho novo/s);
  assert.match(log(b), /\tcobrou-300\t/);
}));
test('4. P com 260 mil: cobra só se o último parágrafo espera o operador (? ou Q<n>)', () => com((b) => {
  cobrou(rodar(b, 'P', transcript(b, { tokens: 260_000, texto: 'plano pronto.\n\nQuer que eu abra a executora?' })), /260 mil.*esperando resposta/s);
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
test('5. P com 360 mil que chamou clear_session "self" no turno: passa (limpou); só no turno anterior, cobra', () => com((b) => {
  assert.equal(rodar(b, 'P', transcript(b, { tokens: 360_000, ferramentas: [LIMPA] })), null);
  assert.match(log(b), /\tlimpou\t/);
  cobrou(rodar(b, 'P', transcript(b, { tokens: 360_000, anterior: [LIMPA] })), /360 mil/);
  assert.match(log(b), /\tcobrou-200\t/); // O1: a segunda metade também deixa a linha de cobrança no log
}));
test('5b. clear_session de OUTRA sessão não vale', () => com((b) => {
  cobrou(rodar(b, 'P', transcript(b, { tokens: 360_000, ferramentas: [['mcp__ccd_session_mgmt__clear_session', { session_id: 'local_X' }]] })), /360 mil/);
}));
test('6. E com 310 mil sem limpar: cobra (cobrou-exec-150) mesmo com "Parei em:"; só a limpeza satisfaz', () => com((b) => {
  const r = rodar(b, 'E', transcript(b, { tokens: 310_000, texto: 'Parei em: passo 4, falta o teste' }));
  cobrou(r, /clear_session.*"self"/s); cobrou(r, /quem despachou/); cobrou(r, /recebido; limpo antes de começar/);
  assert.match(log(b), /\tcobrou-exec-150\texecutora 310 mil/);
}));
test('6b. E abaixo de 300 mil não é cobrada', () => com((b) => { assert.equal(rodar(b, 'E', transcript(b, { tokens: 299_000 })), null); }));
test('7. V com 400 mil: não cobra e registra validadora-400', () => com((b) => {
  assert.equal(rodar(b, 'V', transcript(b, { tokens: 400_000 })), null);
  assert.match(log(b), /\tvalidadora-400\tvalidadora 400 mil/);
}));
test('7b. V com 349.999 não registra nada; com 350.000 registra', () => com((b) => { assert.equal(rodar(b, 'V', transcript(b, { tokens: 349_999 })), null); assert.equal(log(b), ''); rodar(b, 'V', transcript(b, { tokens: 350_000 })); assert.match(log(b), /\tvalidadora-350\t/); }));
test('8. sessão avulsa com 400 mil: não cobra e não registra', () => com((b) => {
  assert.equal(rodar(b, 'AV', transcript(b, { tokens: 400_000 })), null);
  assert.equal(log(b), '');
}));
test('8b. D segue a régua da planejadora; a orquestradora (título) também', () => com((b) => {
  cobrou(rodar(b, 'D', transcript(b, { tokens: 360_000 })), /360 mil/);
  ligar(b);
  cobrou(rodar(b, 'ORQ', transcript(b, { tokens: 360_000 })), /360 mil/);
}));
test('9. stop_hook_active com P a 360 mil: passa (deixou-passar)', () => com((b) => {
  assert.equal(rodar(b, 'P', transcript(b, { tokens: 360_000 }), { stop_hook_active: true }), null);
  assert.match(log(b), /\tdeixou-passar\tcobrou-200 planejadora 360 mil/);
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
test('14. os limites são inclusivos: 350.000 cobra e 349.999 não; 500.000 já é o teto; E cobra em 300.000', () => com((b) => {
  cobrou(rodar(b, 'P', transcript(b, { tokens: 350_000 })), /350 mil/);
  assert.match(log(b), /\tcobrou-200\t/);
  const b2 = novo();
  try { assert.equal(rodar(b2, 'P', transcript(b2, { tokens: 349_999 })), null); assert.equal(log(b2), ''); } finally { rmSync(b2, { recursive: true, force: true }); }
  cobrou(rodar(b, 'P', transcript(b, { tokens: 500_000, texto: 'Contexto: sigo — falta o passo 3 do plano' })), /Não pegue trabalho novo/);
  cobrou(rodar(b, 'E', transcript(b, { tokens: 300_000 })), /Parei em:/);
}));

// O2 (F35): a entrada sintética do assistant (`model: "<synthetic>"`, usage zerado) não vira a última leitura.
const SINTETICA = { type: 'assistant', timestamp: new Date(T1 + 9000).toISOString(), message: { model: '<synthetic>', content: [{ type: 'text', text: 'No response requested.' }], usage: { input_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 0 } } };
test('O2. transcript que termina em "No response requested." (sintética, usage zerado): o hook ainda cobra pela leitura real', () => com((b) => {
  cobrou(rodar(b, 'P', transcript(b, { tokens: 360_000, extra: [SINTETICA] })), /360 mil/);
  assert.match(log(b), /\tcobrou-200\tplanejadora 360 mil/);
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

// F48: a orquestradora com o operador presente só pede o ok (250 mil); com o modo ausente ligado vale a régua de antes.
const agora = () => new Date().toISOString(); const haMin = (m) => new Date(Date.now() - m * 60_000).toISOString();
const LIMPAR = (extra = {}) => ({ titulo: 'limpar · orquestradora', sessaoId: 'local_ORQ', estado: 'aberta', atualizadoEm: agora(), ...extra });
test('F48-1. ORQ com 260 mil, sem bandeira nem pergunta: cobra pedir (cobrou-pedir)', () => com((b) => {
  cobrou(rodar(b, 'ORQ', transcript(b, { tokens: 260_000 })), /limpar · orquestradora/);
  assert.match(log(b), /\tcobrou-pedir\t/);
}));
test('F48-2. ORQ com 260 mil e pergunta de limpeza aberta dela: passa (satisfeito-pediu)', () => com((b) => {
  pergunta(b, 'Q1', LIMPAR());
  assert.equal(rodar(b, 'ORQ', transcript(b, { tokens: 260_000 })), null);
  assert.match(log(b), /\tsatisfeito-pediu\t/);
}));
test('F48-3. a pergunta de limpeza é de outra sessão: cobra', () => com((b) => {
  pergunta(b, 'Q1', LIMPAR({ sessaoId: 'local_P' }));
  cobrou(rodar(b, 'ORQ', transcript(b, { tokens: 260_000 })), /limpar · orquestradora/);
}));
test('F48-4. pergunta respondida "não" há 1 h segura a cobrança; há 3 h não', () => com((b) => {
  pergunta(b, 'Q1', LIMPAR({ estado: 'respondida', resposta: 'não', atualizadoEm: haMin(60) }));
  assert.equal(rodar(b, 'ORQ', transcript(b, { tokens: 260_000 })), null);
  pergunta(b, 'Q1', LIMPAR({ estado: 'respondida', resposta: 'não', atualizadoEm: haMin(180) }));
  cobrou(rodar(b, 'ORQ', transcript(b, { tokens: 260_000 })), /limpar · orquestradora/);
}));
test('F48-5. ORQ com 260 mil que chamou clear_session "self" no turno: passa (limpou)', () => com((b) => {
  assert.equal(rodar(b, 'ORQ', transcript(b, { tokens: 260_000, ferramentas: [LIMPA] })), null);
  assert.match(log(b), /\tlimpou\t/);
  cobrou(rodar(b, 'ORQ', transcript(b, { tokens: 260_000 })), /limpar · orquestradora/); // sem a chamada no turno a mesma entrada cobra: o teste mede a limpeza
  cobrou(rodar(b, 'ORQ', transcript(b, { tokens: 260_000, anterior: [LIMPA] })), /limpar · orquestradora/);
}));
test('F48-6. ORQ com "?" no fim: sem bandeira, a 260 mil, cobra pedir (não espera); com bandeira cobra cobrou-150-espera', () => com((b) => {
  cobrou(rodar(b, 'ORQ', transcript(b, { tokens: 260_000, texto: 'pronto.\n\nPosso seguir?' })), /limpar · orquestradora/);
  assert.match(log(b), /\tcobrou-pedir\t/); assert.doesNotMatch(log(b), /cobrou-150-espera/);
  ligar(b);
  cobrou(rodar(b, 'ORQ', transcript(b, { tokens: 260_000, texto: 'pronto.\n\nPosso seguir?' })), /esperando resposta/);
  assert.match(log(b), /\tcobrou-150-espera\t/);
}));
test('F48-7. ORQ a 360 mil: sem bandeira cobra pedir; com bandeira cobra cobrou-200', () => com((b) => {
  cobrou(rodar(b, 'ORQ', transcript(b, { tokens: 360_000 })), /limpar · orquestradora/);
  assert.match(log(b), /\tcobrou-pedir\t/); assert.doesNotMatch(log(b), /cobrou-200/);
  ligar(b);
  cobrou(rodar(b, 'ORQ', transcript(b, { tokens: 360_000 })), /360 mil/);
  assert.match(log(b), /\tcobrou-200\t/);
}));
test('F48-8. bandeira {ligado:false} vale como desligada: ORQ a 360 mil cobra pedir, não cobrou-200', () => com((b) => {
  ligar(b, { ligado: false, desligadoEm: agora(), por: 'painel' });
  cobrou(rodar(b, 'ORQ', transcript(b, { tokens: 360_000 })), /limpar · orquestradora/);
  assert.match(log(b), /\tcobrou-pedir\t/); assert.doesNotMatch(log(b), /cobrou-200/);
}));
test('F48-9. planejadora com 360 mil segue cobrando sem bandeira (a mudança é só da orquestradora)', () => com((b) => {
  cobrou(rodar(b, 'P', transcript(b, { tokens: 360_000 })), /360 mil/);
}));
test('M1. pergunta `limpar · worktrees órfãos` aberta não satisfaz o pedido: cobra (cobrou-pedir)', () => com((b) => {
  pergunta(b, 'Q1', LIMPAR({ titulo: 'limpar · worktrees órfãos' }));
  cobrou(rodar(b, 'ORQ', transcript(b, { tokens: 260_000 })), /limpar · orquestradora/);
  assert.match(log(b), /\tcobrou-pedir\t/);
  pergunta(b, 'Q1', LIMPAR()); // contraste: com o título exato a mesma fixture passa
  assert.equal(rodar(b, 'ORQ', transcript(b, { tokens: 260_000 })), null);
}));
test('B1. trégua conta do respondidaEm: "não" do painel há 3 h com atualizadoEm de agora (uma nota) cobra; atualizadoEm em 2099 não segura', () => com((b) => {
  pergunta(b, 'Q1', LIMPAR({ estado: 'respondida', resposta: 'não', respondidaPor: 'painel', respondidaEm: haMin(180), atualizadoEm: agora() }));
  cobrou(rodar(b, 'ORQ', transcript(b, { tokens: 260_000 })), /limpar · orquestradora/);
  pergunta(b, 'Q1', LIMPAR({ estado: 'respondida', resposta: 'não', atualizadoEm: '2099-01-01T00:00:00.000Z' }));
  cobrou(rodar(b, 'ORQ', transcript(b, { tokens: 260_000 })), /limpar · orquestradora/);
  pergunta(b, 'Q1', LIMPAR({ estado: 'respondida', resposta: 'não', respondidaPor: 'painel', respondidaEm: haMin(60), atualizadoEm: agora() }));
  assert.equal(rodar(b, 'ORQ', transcript(b, { tokens: 260_000 })), null); // contraste: "não" de 1 h segura
}));

// F49: executora cheia termina com a limpeza.
test('F49.1 E com 310 mil e clear_session "self" no turno: passa (limpou)', () => com((b) => {
  assert.equal(rodar(b, 'E', transcript(b, { tokens: 310_000, ferramentas: [LIMPA] })), null);
  assert.match(log(b), /\tlimpou\texecutora 310 mil/);
}));
test('F49.2 E com 310 mil e a limpeza só no turno anterior: cobra', () => com((b) => {
  cobrou(rodar(b, 'E', transcript(b, { tokens: 310_000, anterior: [LIMPA] })), /310 mil/);
}));
test('F49.3 E com 310 mil e stop_hook_active: passa (deixou-passar)', () => com((b) => {
  assert.equal(rodar(b, 'E', transcript(b, { tokens: 310_000 }), { stop_hook_active: true }), null);
  assert.match(log(b), /\tdeixou-passar\tcobrou-exec-150 executora 310 mil/);
  assert.doesNotMatch(log(b), /satisfeito-parei/);
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
