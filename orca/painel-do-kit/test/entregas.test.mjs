// Entregas por sessão (F436): do painel (fila/<F>.json com `entrega`) e do Orca (worker_done da caixa), juntas e limpáveis.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { entregasDoPainel, entregasDoOrca, juntarEntregas, separarLidas, limpar, desfazer, podarLidas } from '../src/nucleo/entregas.mjs';

const DESDE = Date.parse('2026-11-01T00:00:00Z');
const painelCom = (itens) => {
  const p = mkdtempSync(join(tmpdir(), 'f436-fila-'));
  mkdirSync(join(p, 'fila'), { recursive: true });
  for (const [id, data] of Object.entries(itens)) writeFileSync(join(p, 'fila', `${id}.json`), JSON.stringify({ id, version: 1, data }));
  return p;
};

test('do painel: só itens feitos no período e com entrega; chave muda se o item for refeito', () => {
  const p = painelCom({
    F1: { titulo: 'um', projeto: 'kit', etapa: 'feito', feitoEm: '2026-11-05T10:00:00Z', prs: [12], entrega: { resultado: 'fez' }, donaAoFechar: { donoLocalId: 'local_a', donoApelido: 'F1 · um' } },
    F2: { titulo: 'velho', etapa: 'feito', feitoEm: '2026-10-01T10:00:00Z', entrega: { resultado: 'x' } },
    F3: { titulo: 'sem entrega', etapa: 'feito', feitoEm: '2026-11-05T10:00:00Z' },
    F4: { titulo: 'aberto', etapa: 'fazendo', entrega: { resultado: 'x' } },
  });
  writeFileSync(join(p, 'fila', 'F5.json'), '{ruim');
  const r = entregasDoPainel(p, { desdeMs: DESDE });
  assert.equal(r.length, 1);
  assert.deepEqual(r[0], { chave: 'painel:F1@2026-11-05T10:00:00Z', chaves: ['painel:F1@2026-11-05T10:00:00Z'], origem: 'painel', item: 'F1', titulo: 'um', projeto: 'kit', em: '2026-11-05T10:00:00Z', prs: [12], entrega: { resultado: 'fez' }, sessao: 'F1 · um' });
});

const INBOX = {
  result: {
    messages: [
      { id: 'msg_1', type: 'worker_done', run_id: 'run_a', from_handle: 'structworker_1', subject: 'F1 · PR 12 pronto', body: 'PR 12 pronto, HEAD abc', payload: '{"taskId":"task_1","dispatchId":"ctx_1","outcome":"succeeded"}', created_at: '2026-11-05T11:00:00Z' },
      { id: 'msg_2', type: 'worker_done', run_id: 'run_a', from_handle: 'structworker_2', subject: 'Ajustes aplicados', body: 'P1 feito', payload: { taskId: 'task_2', dispatchId: 'ctx_2', outcome: 'failed' }, created_at: '2026-11-06T01:00:00Z' },
      { id: 'msg_3', type: 'status', run_id: 'run_a', subject: 'oi', body: 'x', created_at: '2026-11-06T01:00:00Z' },
      { id: 'msg_4', type: 'worker_done', run_id: 'run_a', subject: 'velho', body: 'x', payload: '{}', created_at: '2026-10-01T01:00:00Z' },
      { id: 'msg_5', type: 'worker_done', run_id: 'run_a', subject: 'payload ruim', body: 'x', payload: '{ruim', created_at: '2026-11-06T02:00:00Z' },
    ],
  },
};
const WORKERS = { result: { workers: [
  { dispatchId: 'ctx_1', state: 'succeeded', terminalState: 'released', workspace: 'id::/Users/x/orca/workspaces/kit-de-orquestracao/f1-um' },
  { dispatchId: 'ctx_2', state: 'ready', terminalState: 'retained', workspace: 'id::/Users/x/orca/workspaces/outro-projeto/ajustes' },
] } };

test('do Orca: só worker_done no período; payload em texto ou objeto; sessão e projeto pela worktree; vivo pelo estado', () => {
  const r = entregasDoOrca(INBOX, WORKERS, { desdeMs: DESDE });
  assert.deepEqual(r.map((e) => e.chave), ['orca:msg_5', 'orca:msg_2', 'orca:msg_1'], 'mais recente primeiro');
  const [m5, m2, m1] = r;
  assert.equal(m1.item, 'F1');
  assert.equal(m1.sessao, 'f1-um');
  assert.equal(m1.projeto, 'kit-de-orquestracao');
  assert.equal(m1.vivo, false);
  assert.equal(m1.resultado, 'succeeded');
  assert.equal(m2.vivo, true);
  assert.equal(m2.resultado, 'failed');
  assert.equal(m2.item, null);
  assert.equal(m2.run, 'run_a');
  assert.equal(m5.dispatchId, null, 'payload ilegível não quebra a leitura');
});

test('do Orca: saída que não é a da caixa devolve vazio, sem erro', () => {
  assert.deepEqual(entregasDoOrca(null, null, { desdeMs: DESDE }), []);
  assert.deepEqual(entregasDoOrca({ ok: false }, {}, { desdeMs: DESDE }), []);
});

test('juntar: o worker_done do mesmo item vira parte da entrega do painel (um cartão, duas chaves); o resto segue', () => {
  const painel = entregasDoPainel(painelCom({ F1: { titulo: 'um', projeto: 'kit-de-orquestracao', etapa: 'feito', feitoEm: '2026-11-05T10:00:00Z', entrega: { resultado: 'fez' } } }), { desdeMs: DESDE });
  const orca = entregasDoOrca(INBOX, WORKERS, { desdeMs: DESDE });
  const j = juntarEntregas(painel, orca);
  assert.equal(j.length, 3);
  const f1 = j.find((e) => e.item === 'F1');
  assert.deepEqual(f1.chaves.sort(), ['orca:msg_1', 'painel:F1@2026-11-05T10:00:00Z']);
  assert.equal(f1.orca.corpo, 'PR 12 pronto, HEAD abc');
  assert.equal(f1.runDoProjeto, 'run_a', 'a Run do projeto vira o destino do seguimento de uma sessão do app');
});

test('limpar some da lista sem apagar, desfazer volta; limpa todas as chaves do cartão; poda as antigas', () => {
  const lista = [{ chave: 'a', chaves: ['a', 'a2'] }, { chave: 'b', chaves: ['b'] }];
  let lidas = {};
  lidas = limpar(lidas, lista[0].chaves, 1000);
  assert.deepEqual(separarLidas(lista, lidas), { visiveis: [lista[1]], limpas: [lista[0]] });
  lidas = desfazer(lidas, lista[0].chaves);
  assert.deepEqual(separarLidas(lista, lidas).visiveis, lista);
  assert.deepEqual(separarLidas(lista, { a2: 1 }).limpas, [lista[0]], 'basta uma chave do cartão estar limpa');
  const velhas = { x: 0, y: 10 * 86_400_000 };
  assert.deepEqual(podarLidas(velhas, 40 * 86_400_000, 35), { y: 10 * 86_400_000 });
});

// F461: caixa real do Orca (medida em 2026-11-06). O worker_done sem taskId é recusado e a caixa ganha "Rejected worker_done: <assunto>"
// (mesmo from_handle e run, corpo "Orca rejected …\n\nOriginal body:\n<corpo>", payload com `_orcaLifecycleRejection`); o reenvio certo chega ~30 s depois.
const HANDLE_F442 = 'structworker_53ce4b37-c6bb-47b5-a428-23a99dd195c5';
const CORPO_F442 = 'PR 1725 pronto, HEAD 3a5e476fa9bb17b68b22bbae579c95350775c046. S7c rebaseada sobre o squash do #1724.';
const rejeitada = (id, em, extra = {}) => ({
  id, type: 'worker_done', run_id: 'run_26395036e57b', from_handle: HANDLE_F442, subject: 'Rejected worker_done: F442 pronto',
  body: `Orca rejected this worker_done: worker_done requires taskId.\n\nOriginal body:\n${CORPO_F442}`,
  payload: '{"outcome":"succeeded","_orcaLifecycleRejection":{"code":"missing_task_id","reason":"worker_done requires taskId."}}', created_at: em, ...extra,
});
const aceita = (id, em, extra = {}) => ({
  id, type: 'worker_done', run_id: 'run_26395036e57b', from_handle: HANDLE_F442, subject: 'F442 pronto', body: CORPO_F442,
  payload: '{"taskId":"task_f6be4ad20649","dispatchId":"ctx_0aa595dfd2a7","outcome":"succeeded"}', created_at: em, ...extra,
});
const caixa = (...messages) => ({ result: { messages } });

test('rejeitada com o mesmo PR e HEAD aceito depois pelo mesmo worker some (as duas rejeições, só a aceita fica)', () => {
  const r = entregasDoOrca(caixa(aceita('msg_ok', '2026-11-06T15:53:03Z'), rejeitada('msg_r2', '2026-11-06T15:52:50Z'), rejeitada('msg_r1', '2026-11-06T15:52:27Z')), WORKERS, { desdeMs: DESDE });
  assert.deepEqual(r.map((e) => e.chave), ['orca:msg_ok']);
  assert.equal(r[0].titulo, 'F442 pronto');
});

test('rejeitada pelo _orcaLifecycleRejection no payload, mesmo sem o prefixo no assunto, também some com o reenvio', () => {
  const r = entregasDoOrca(caixa(aceita('msg_ok', '2026-11-06T15:53:03Z'), rejeitada('msg_r', '2026-11-06T15:52:50Z', { subject: 'F442 pronto' })), WORKERS, { desdeMs: DESDE });
  assert.deepEqual(r.map((e) => e.chave), ['orca:msg_ok']);
});

test('rejeitada sem reenvio aceito continua, em português de quem está de fora, com o assunto original e o PR', () => {
  const r = entregasDoOrca(caixa(rejeitada('msg_r', '2026-11-06T15:52:50Z')), WORKERS, { desdeMs: DESDE });
  assert.equal(r.length, 1);
  assert.equal(r[0].chave, 'orca:msg_r');
  assert.equal(r[0].titulo, 'F442 pronto');
  assert.equal(r[0].item, 'F442');
  assert.match(r[0].corpo, /^A sessão avisou que terminou, mas o Orca não registrou o aviso; o PR 1725 está pronto\./);
  assert.ok(!/Orca rejected|taskId/.test(r[0].corpo), 'o texto cru do Orca não aparece');
  assert.ok(r[0].corpo.includes(CORPO_F442), 'o que a sessão escreveu segue nos detalhes');
});

test('reenvio de outro worker, de outro PR ou de outro HEAD não apaga a rejeitada', () => {
  const outroWorker = aceita('msg_a', '2026-11-06T15:53:03Z', { from_handle: 'structworker_outro' });
  const outroHead = aceita('msg_b', '2026-11-06T15:53:03Z', { body: CORPO_F442.replace('3a5e476', 'ffffff0') });
  const outroPr = aceita('msg_c', '2026-11-06T15:53:03Z', { body: CORPO_F442.replace('PR 1725', 'PR 1726') });
  const r = entregasDoOrca(caixa(outroWorker, outroHead, outroPr, rejeitada('msg_r', '2026-11-06T15:52:50Z')), WORKERS, { desdeMs: DESDE });
  assert.ok(r.some((e) => e.chave === 'orca:msg_r'));
  assert.equal(r.length, 4);
});

test('rejeitada sem PR no corpo: a frase não inventa PR, e o reenvio idêntico a apaga', () => {
  const r0 = rejeitada('msg_r', '2026-11-06T15:52:50Z', { body: 'Orca rejected this worker_done: worker_done requires taskId.\n\nOriginal body:\ntroca de sessão por contexto cheio' });
  const sozinha = entregasDoOrca(caixa(r0), WORKERS, { desdeMs: DESDE });
  assert.match(sozinha[0].corpo, /^A sessão avisou que terminou, mas o Orca não registrou o aviso\./);
  assert.ok(!/PR/.test(sozinha[0].corpo.split('\n')[0]));
  const par = entregasDoOrca(caixa(aceita('msg_ok', '2026-11-06T15:53:03Z', { body: 'troca de sessão por contexto cheio' }), r0), WORKERS, { desdeMs: DESDE });
  assert.deepEqual(par.map((e) => e.chave), ['orca:msg_ok']);
});

test('rejeitada de uma sessão que falhou não diz que o PR está pronto', () => {
  const r0 = rejeitada('msg_r', '2026-11-06T15:52:50Z', {
    body: 'Orca rejected this worker_done: worker_done requires taskId.\n\nOriginal body:\nPR 55 ficou com conflito, bloqueado.',
    payload: '{"outcome":"failed","_orcaLifecycleRejection":{"code":"missing_task_id","reason":"worker_done requires taskId."}}',
  });
  const [e] = entregasDoOrca(caixa(r0), WORKERS, { desdeMs: DESDE });
  assert.ok(e.corpo.length > 0);
  assert.ok(!/está pronto/.test(e.corpo), e.corpo);
  assert.match(e.corpo, /^A sessão avisou que parou, mas o Orca não registrou o aviso\./);
  assert.ok(e.corpo.includes('PR 55 ficou com conflito'));
});
