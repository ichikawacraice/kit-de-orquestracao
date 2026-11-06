// F448 (fatia 9): respostas dadas a poucos segundos uma da outra para a mesma sessão saem juntas numa só mensagem; a
// janela conta da primeira resposta. O relógio é falso: o teste avança o tempo e conta os envios.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarFilaDeEntrega, montarLote } from '../src/nucleo/fila-de-entrega.mjs';

function relogio() {
  let agora = 0;
  let fila = [];
  return {
    agendar: (fn, ms) => { fila.push({ em: agora + ms, fn }); },
    async avancar(ms) {
      const ate = agora + ms;
      for (;;) {
        const prox = fila.filter((t) => t.em <= ate).sort((a, b) => a.em - b.em)[0];
        if (!prox) break;
        fila = fila.filter((t) => t !== prox);
        agora = prox.em;
        prox.fn();
        await new Promise((r) => setImmediate(r));
      }
      agora = ate;
      await new Promise((r) => setImmediate(r));
    },
    pendentes: () => fila.length,
  };
}

function montar({ janelaMs = 5000, resposta = () => ({ ok: true }) } = {}) {
  const r = relogio();
  const envios = [];
  const fila = criarFilaDeEntrega({
    janelaMs, agendar: r.agendar,
    enviarLote: async (destino, lote) => { envios.push({ destino, ...lote }); return resposta(destino, lote); },
  });
  return { r, envios, fila };
}

test('duas respostas para a mesma sessão em 3 s saem numa mensagem só; em 30 s, em duas', async () => {
  const a = montar();
  const p1 = a.fila.entregar('dispatch:ctx_1', { id: 'Q1', texto: 'resposta um' });
  await a.r.avancar(3000);
  const p2 = a.fila.entregar('dispatch:ctx_1', { id: 'Q2', texto: 'resposta dois' });
  assert.equal(a.envios.length, 0, 'nada sai antes da janela fechar');
  await a.r.avancar(2000);
  assert.deepEqual(await Promise.all([p1, p2]), [{ ok: true }, { ok: true }]);
  assert.equal(a.envios.length, 1);
  assert.deepEqual(a.envios[0].ids, ['Q1', 'Q2']);
  assert.equal(a.envios[0].assunto, 'Respostas Q1, Q2');
  assert.ok(a.envios[0].corpo.includes('resposta um') && a.envios[0].corpo.includes('resposta dois'), a.envios[0].corpo);

  const b = montar();
  const q1 = b.fila.entregar('dispatch:ctx_1', { id: 'Q1', texto: 'resposta um' });
  await b.r.avancar(30_000);
  const q2 = b.fila.entregar('dispatch:ctx_1', { id: 'Q2', texto: 'resposta dois' });
  await b.r.avancar(30_000);
  await Promise.all([q1, q2]);
  assert.deepEqual(b.envios.map((e) => e.ids), [['Q1'], ['Q2']]);
  assert.deepEqual(b.envios.map((e) => e.assunto), ['Resposta Q1', 'Resposta Q2']);
});

test('a janela conta da primeira resposta: uma terceira a cada 3 s não segura o lote para sempre', async () => {
  const a = montar();
  const ps = [a.fila.entregar('run:run_a', { id: 'Q1', texto: 'um' })];
  await a.r.avancar(3000);
  ps.push(a.fila.entregar('run:run_a', { id: 'Q2', texto: 'dois' }));
  await a.r.avancar(3000); // 6 s: o lote de Q1 e Q2 fechou aos 5 s
  ps.push(a.fila.entregar('run:run_a', { id: 'Q3', texto: 'três' }));
  await a.r.avancar(10_000);
  await Promise.all(ps);
  assert.deepEqual(a.envios.map((e) => e.ids), [['Q1', 'Q2'], ['Q3']]);
});

test('destinos diferentes nunca se juntam: cada sessão recebe só a resposta dela', async () => {
  const a = montar();
  const ps = [
    a.fila.entregar('orca_session_id:aaa', { id: 'Q1', texto: 'para a dona A' }),
    a.fila.entregar('orca_session_id:bbb', { id: 'Q2', texto: 'para a dona B' }),
  ];
  await a.r.avancar(5000);
  await Promise.all(ps);
  assert.equal(a.envios.length, 2);
  const por = Object.fromEntries(a.envios.map((e) => [e.destino, e]));
  assert.deepEqual(por['orca_session_id:aaa'].ids, ['Q1']);
  assert.ok(!por['orca_session_id:aaa'].corpo.includes('dona B'));
  assert.deepEqual(por['orca_session_id:bbb'].ids, ['Q2']);
});

test('o que chega durante um envio em voo vai no lote seguinte, depois que o primeiro termina', async () => {
  let liberar;
  const travado = new Promise((r) => { liberar = r; });
  const ordem = [];
  const a = montar({ resposta: async (_d, lote) => { ordem.push(`começa ${lote.ids}`); if (lote.ids[0] === 'Q1') await travado; ordem.push(`termina ${lote.ids}`); return { ok: true }; } });
  const p1 = a.fila.entregar('dispatch:ctx_1', { id: 'Q1', texto: 'um' });
  await a.r.avancar(5000);
  assert.deepEqual(ordem, ['começa Q1'], 'o primeiro lote está em voo');
  const p2 = a.fila.entregar('dispatch:ctx_1', { id: 'Q2', texto: 'dois' });
  await a.r.avancar(5000);
  assert.deepEqual(ordem, ['começa Q1'], 'o segundo espera o primeiro terminar');
  liberar();
  await Promise.all([p1, p2]);
  assert.deepEqual(ordem, ['começa Q1', 'termina Q1', 'começa Q2', 'termina Q2']);
});

test('a falha do envio chega a todas as respostas do lote, com o motivo; a exceção vira falha, não rejeição', async () => {
  const a = montar({ resposta: () => ({ ok: false, motivo: 'unknown_handle' }) });
  const ps = [a.fila.entregar('run:run_a', { id: 'Q1', texto: 'um' }), a.fila.entregar('run:run_a', { id: 'Q2', texto: 'dois' })];
  await a.r.avancar(5000);
  assert.deepEqual(await Promise.all(ps), [{ ok: false, motivo: 'unknown_handle' }, { ok: false, motivo: 'unknown_handle' }]);

  const b = montar({ resposta: () => { throw new Error('terminal sumiu'); } });
  const q = b.fila.entregar('run:run_a', { id: 'Q1', texto: 'um' });
  await b.r.avancar(5000);
  assert.deepEqual(await q, { ok: false, motivo: 'terminal sumiu' });
  // A falha não trava o destino: a próxima resposta sai.
  const q2 = b.fila.entregar('run:run_a', { id: 'Q2', texto: 'dois' });
  await b.r.avancar(5000);
  assert.equal((await q2).ok, false);
  assert.equal(b.envios.length, 2);
});

test('a mesma pergunta duas vezes no lote vai uma vez, com o texto mais novo', async () => {
  const a = montar();
  const ps = [a.fila.entregar('run:run_a', { id: 'Q1', texto: 'velho' }), a.fila.entregar('run:run_a', { id: 'Q1', texto: 'novo' })];
  await a.r.avancar(5000);
  await Promise.all(ps);
  assert.equal(a.envios.length, 1);
  assert.deepEqual(a.envios[0].ids, ['Q1']);
  assert.equal(a.envios[0].corpo, 'novo');
});

test('janela zero entrega na hora, sem agendar', async () => {
  const a = montar({ janelaMs: 0 });
  assert.deepEqual(await a.fila.entregar('run:run_a', { id: 'Q1', texto: 'um' }), { ok: true });
  assert.equal(a.envios.length, 1);
  assert.equal(a.r.pendentes(), 0);
});

test('montarLote: uma resposta fica como era; várias viram uma lista numerada que cita cada pergunta', () => {
  assert.deepEqual(montarLote([{ id: 'Q7', texto: 'Q7 — corpo inteiro' }]), { assunto: 'Resposta Q7', corpo: 'Q7 — corpo inteiro', ids: ['Q7'] });
  const l = montarLote([{ id: 'Q1', texto: 'Q1 — a' }, { id: 'Q2', texto: 'Q2 — b' }]);
  assert.equal(l.assunto, 'Respostas Q1, Q2');
  assert.deepEqual(l.ids, ['Q1', 'Q2']);
  assert.match(l.corpo, /^2 respostas do operador/);
  assert.ok(l.corpo.includes('\n\n1. Q1 — a\n\n2. Q2 — b'), l.corpo);
  assert.throws(() => montarLote([]), /vazio/);
});
