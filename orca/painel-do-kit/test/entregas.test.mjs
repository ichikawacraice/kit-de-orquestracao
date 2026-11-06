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
