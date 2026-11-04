// F371: a dona parada pelo limite de uso volta depois do reset. A forma das linhas é a medida nos transcripts reais (03/11):
// a recusa é uma linha `assistant` sintética com `isApiErrorMessage`, `error: "rate_limit"`, o texto "… · resets 8pm (<fuso>)" e,
// desde o CLI de outubro, `quotaLimits.resetsAt` (epoch em segundos). As de julho só trazem o texto.
// Rodar: node gate/com-fichas.mjs -- node --test plugins/orquestracao/hooks/tests/limite-de-uso.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { limiteDoTranscript, resetDoTexto } from '../../skills/orquestradora/scripts/limite-de-uso.mjs';
import { julgar } from '../../skills/orquestradora/scripts/batida.mjs';

const MIN = 60_000;
const iso = (ms) => new Date(ms).toISOString();
// 03/11/2026 21:00 em São Paulo (UTC−3) = 04/11 00:00 UTC
const T = Date.UTC(2026, 10, 4, 0, 0);
const RESET = Date.UTC(2026, 10, 4, 1, 0); // 22:00 SP

const recusa = ({ em = T, resetsAt = RESET, texto = "You've hit your session limit · resets 10pm (America/Sao_Paulo)", comQuota = true, sidechain = false } = {}) => ({
  parentUuid: 'p', isSidechain: sidechain, type: 'assistant', timestamp: iso(em),
  message: { model: '<synthetic>', role: 'assistant', content: [{ type: 'text', text: texto }] },
  error: 'rate_limit', isApiErrorMessage: true, apiErrorStatus: 429,
  ...(comQuota ? { apiError: 'usage_limit_reached', apiErrorParams: { rate_limit_info: { status: 'rejected', resetsAt: resetsAt / 1000, rateLimitType: 'five_hour' } }, quotaLimits: { status: 'rejected', resetsAt: resetsAt / 1000, rateLimitType: 'five_hour' } } : {}),
});
const fala = (em, sidechain = false) => ({ type: 'assistant', isSidechain: sidechain, timestamp: iso(em), message: { role: 'assistant', content: [{ type: 'text', text: 'ok' }] } });
const pede = (em) => ({ type: 'user', timestamp: iso(em), origin: { kind: 'peer' }, message: { role: 'user', content: 'siga' } });
const jsonl = (...linhas) => linhas.map((l) => (typeof l === 'string' ? l : JSON.stringify(l))).join('\n') + '\n';

test('limiteDoTranscript: a última fala do fio principal é a recusa → resetsAt do quotaLimits e a hora da recusa', () => {
  const r = limiteDoTranscript(jsonl(fala(T - 10 * MIN), recusa()));
  assert.ok(r, 'a recusa não foi lida');
  assert.equal(r.resetsAtMs, RESET);
  assert.equal(r.emMs, T);
});

test('limiteDoTranscript: a recusa seguida de mensagem não respondida, de linha de sistema ou de subagente ainda vale; seguida de fala, não', () => {
  const sistema = { type: 'system', timestamp: iso(T + MIN), content: 'x' };
  assert.equal(limiteDoTranscript(jsonl(recusa(), sistema, fala(T + 2 * MIN, true), '{linha parcial'))?.resetsAtMs, RESET, 'sistema, subagente e linha parcial não contam');
  assert.equal(limiteDoTranscript(jsonl(recusa(), pede(T + MIN), recusa({ em: T + MIN, resetsAt: RESET + 5 * MIN })))?.resetsAtMs, RESET + 5 * MIN, 'a cutucada bateu de novo no limite: vale a última');
  assert.equal(limiteDoTranscript(jsonl(recusa(), pede(T + MIN), fala(T + 2 * MIN))), null, 'ela respondeu: não está no limite');
  assert.equal(limiteDoTranscript(jsonl(recusa(), pede(T + MIN))), null, 'mensagem depois da recusa, sem resposta ainda: não se sabe, não é limite');
});

test('limiteDoTranscript: sem quotaLimits, a hora sai do texto; sem as duas, ou recusa de subagente, null', () => {
  assert.equal(limiteDoTranscript(jsonl(recusa({ comQuota: false })))?.resetsAtMs, RESET, 'texto "resets 10pm (America/Sao_Paulo)"');
  assert.equal(limiteDoTranscript(jsonl(recusa({ comQuota: false, texto: 'Rate limited, try again' }))), null, 'sem hora: não é limite com reset');
  assert.equal(limiteDoTranscript(jsonl(fala(T - MIN), recusa({ sidechain: true }))), null, 'a recusa do subagente não parou a dona');
  assert.equal(limiteDoTranscript(''), null);
  assert.equal(limiteDoTranscript(jsonl(fala(T))), null, 'contraste: transcript sem recusa');
});

test('resetDoTexto: a próxima ocorrência da hora no fuso, depois da recusa', () => {
  // 21:00 SP, "resets 10pm" → 22:00 SP do mesmo dia
  assert.equal(resetDoTexto("You've hit your session limit · resets 10pm (America/Sao_Paulo)", T), RESET);
  // 21:00 SP, "resets 1:30am" → 01:30 SP do dia seguinte = 04:30 UTC
  assert.equal(resetDoTexto('· resets 1:30am (America/Sao_Paulo)', T), Date.UTC(2026, 10, 4, 4, 30));
  // 12am é meia-noite; 12pm é meio-dia
  assert.equal(resetDoTexto('· resets 12am (America/Sao_Paulo)', T), Date.UTC(2026, 10, 4, 3, 0));
  assert.equal(resetDoTexto('· resets 12pm (America/Sao_Paulo)', T), Date.UTC(2026, 10, 4, 15, 0));
  assert.equal(resetDoTexto('· resets 8pm (UTC)', T), Date.UTC(2026, 10, 4, 20, 0), 'outro fuso');
  assert.equal(resetDoTexto('· resets Nov 1 at 1am (America/Sao_Paulo)', T), null, 'semanal com data: não lido');
  assert.equal(resetDoTexto('· resets 8pm (Fuso/Inexistente)', T), null);
  assert.equal(resetDoTexto('sem hora', T), null);
});

// ---- julgar ----
const DONA = 'local_dona';
const item = (extra = {}) => ['F1', { titulo: 'um item', etapa: 'execucao', projeto: 'kit', donoLocalId: DONA, com: [{ localId: DONA }], atualizadoEm: iso(T - 40 * MIN), ...extra }];
const linhas = (extra = {}) => [{ sessionId: DONA, title: 'F1 · um item', isArchived: false, isRunning: false, ...extra }];
const rodar = ({ agoraMs = T, limites = { [DONA]: { resetsAtMs: RESET, emMs: T - 5 * MIN } }, estado = {}, itens = [item()], ls = linhas(), handoffDe = () => null } = {}) =>
  julgar({ agoraMs, itens: new Map(itens), linhas: ls, projetoDe: () => 'kit', estado, semDona: () => null, limites, handoffDe });

test('julgar: dona no limite antes do reset → nem cutucada nem soltura (o contraste: sem o limite, cutuca)', () => {
  assert.equal(rodar({ limites: {} }).mensagens.filter((m) => m.tipo === 'cutucada').length, 1, 'contraste: parada sem limite é cutucada');
  const r = rodar();
  assert.deepEqual(r.mensagens, []);
  assert.deepEqual(r.soltar, []);
  const cutucadaVelha = { cutucadas: { F1: { em: iso(T - 30 * MIN), localId: DONA } } };
  assert.deepEqual(rodar({ estado: cutucadaVelha }).soltar, [], 'a cutucada de antes do limite não solta o item no limite');
});

test('julgar: passado o reset, a dona parada recebe uma vez "retome pelo handoff", com o caminho; a batida seguinte não repete', () => {
  const H = '/home/x/.claude/orquestracao/pool/handoffs/F1.md';
  const r = rodar({ agoraMs: RESET + 2 * MIN, handoffDe: (F) => (F === 'F1' ? H : null) });
  const ret = r.mensagens.filter((m) => m.tipo === 'retomada');
  assert.equal(ret.length, 1, JSON.stringify(r.mensagens));
  assert.equal(ret[0].para, DONA);
  assert.match(ret[0].texto, /limite de uso/);
  assert.match(ret[0].texto, /retome pelo handoff/);
  assert.ok(ret[0].texto.includes(H), 'o caminho do handoff vai na mensagem');
  assert.equal(r.mensagens.filter((m) => m.tipo === 'cutucada').length, 0, 'não cutuca junto');
  assert.deepEqual(r.soltar, []);
  assert.equal(r.estado.limites?.[DONA], iso(RESET), 'a hora do reset fica guardada no estado');
  const depois = rodar({ agoraMs: RESET + 12 * MIN, estado: r.estado });
  assert.equal(depois.mensagens.filter((m) => m.tipo === 'retomada').length, 0, 'a mesma retomada não sai duas vezes');
});

test('julgar: sem handoff gravado, a retomada aponta o item no painel; dona rodando, arquivada ou item em merge não recebem', () => {
  const sem = rodar({ agoraMs: RESET + MIN }).mensagens.find((m) => m.tipo === 'retomada');
  assert.ok(sem, 'contraste: a dona parada recebe');
  assert.match(sem.texto, /painel get fila F1/);
  assert.deepEqual(rodar({ agoraMs: RESET + MIN, ls: linhas({ isRunning: true }) }).mensagens, [], 'rodando: já voltou');
  assert.equal(rodar({ agoraMs: RESET + MIN, ls: linhas({ isArchived: true }) }).mensagens.filter((m) => m.tipo === 'retomada').length, 0, 'arquivada');
  assert.equal(rodar({ agoraMs: RESET + MIN, itens: [item({ etapa: 'merge', prs: [9] })] }).mensagens.filter((m) => m.tipo === 'retomada').length, 0, 'em merge quem anda é a fila');
});

test('julgar: dona de dois itens recebe uma retomada só, com os dois itens', () => {
  const dois = [item(), ['F2', { ...item()[1], titulo: 'outro' }]];
  const ret = rodar({ agoraMs: RESET + MIN, itens: dois }).mensagens.filter((m) => m.tipo === 'retomada');
  assert.equal(ret.length, 1, JSON.stringify(ret));
  assert.match(ret[0].texto, /F1/);
  assert.match(ret[0].texto, /F2/);
});

test('julgar (validador): recusa com reset de mais de 24 h é velha → a batida segue como antes (cutuca e solta), sem retomada em laço', () => {
  const velho = { [DONA]: { resetsAtMs: T - 25 * 60 * MIN, emMs: T - 30 * 60 * MIN } };
  let estado = {};
  const tipos = [];
  for (let i = 0; i < 3; i++) {
    const r = rodar({ agoraMs: T + i * 21 * MIN, limites: velho, estado });
    tipos.push(r.mensagens.map((m) => m.tipo).join(',') + (r.soltar.length ? '+soltar' : ''));
    estado = r.estado;
  }
  // o item da fixtura não sai da lista depois do `soltar` (quem solta é o painel.mjs), então a 3ª volta cutuca de novo
  assert.deepEqual(tipos.slice(0, 2), ['cutucada', '+soltar'], JSON.stringify(tipos));
  assert.ok(!tipos.join().includes('retomada'), `retomada em laço: ${JSON.stringify(tipos)}`);
});

test('julgar (validador): dona arquivada no limite não segura o item até o reset (solta como antes)', () => {
  const r = rodar({ ls: linhas({ isArchived: true }) });
  assert.deepEqual(r.soltar.map((s) => s.F), ['F1']);
});
