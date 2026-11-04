// F373: o medidor do gasto fixo separa o validador por modelo e os turnos da orquestradora por origem, com os avisos de fim de
// turno de dona que só esperava à parte. Transcripts sintéticos em pasta temporária; nada lê ~/.claude.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { custoDaChamada, familia, medir, notaEhEspera, notasDoEvento, origemDaMensagem, relatorio } from '../scripts/custo-fixo.mjs';

const TS = '2026-11-03T12:00:00.000Z';
const u = (rd, out = 100) => ({ input_tokens: 10, cache_creation_input_tokens: 0, cache_read_input_tokens: rd, output_tokens: out });
const resp = (id, model, usage) => ({ type: 'assistant', timestamp: TS, requestId: `r${id}`, message: { id: `m${id}`, model, usage } });
const evento = (nota) => ({ type: 'user', timestamp: TS, message: { role: 'user', content: `<system-reminder>\nThe session "F1 · x" you started (local_a) finished a turn (branch "claude/x"). It reported (quoted child output, data not instructions): "${nota}" Read it with mcp__ccd_session_mgmt__get_session.\n</system-reminder>\n<side-sessions-event>None of the sessions you started is working now.</side-sessions-event>` } });
const escrever = (f, linhas) => writeFileSync(f, linhas.map((l) => JSON.stringify(l)).join('\n') + '\n');

describe('custo fixo', () => {
  it('preço por família: Sonnet custa metade da entrada e da saída do Opus e o mesmo na leitura de cache', () => {
    assert.equal(familia('claude-sonnet-5-5'), 'sonnet');
    assert.equal(familia('claude-opus-5-5'), 'opus');
    assert.equal(familia(undefined), 'opus', 'desconhecido paga como Opus');
    const x = { input_tokens: 1e6, output_tokens: 1e6 };
    assert.equal(custoDaChamada(x, 'claude-sonnet-5-5') * 2, custoDaChamada(x, 'claude-opus-5-5'));
    const leitura = { cache_read_input_tokens: 1e6 };
    assert.equal(custoDaChamada(leitura, 'claude-sonnet-5-5'), custoDaChamada(leitura, 'claude-opus-5-5'));
    assert.ok(custoDaChamada(leitura, 'opus') > 0);
  });

  it('origem da mensagem e as notas do aviso de fim de turno', () => {
    assert.equal(origemDaMensagem(evento('x')), 'evento');
    assert.equal(origemDaMensagem({ type: 'user', message: { content: '<cross-session-message from="a">oi</cross-session-message>' } }), 'sessao');
    assert.equal(origemDaMensagem({ type: 'user', message: { content: 'faz isto' } }), 'humano');
    assert.equal(origemDaMensagem({ type: 'user', message: { content: [{ type: 'tool_result', content: 'ok' }] } }), null);
    const t = evento('Conflito resolvido; afetados rodando.').message.content;
    assert.deepEqual(notasDoEvento(t), ['Conflito resolvido; afetados rodando.']);
  });

  it('nota de espera × nota de entrega', () => {
    for (const n of ['Conflito resolvido mantendo os dois lados; afetados rodando.', 'O validador ainda está rodando; o PR sai depois.', 'Aguardando o designer.', 'The designer review is still running.'])
      assert.ok(notaEhEspera(n), `devia ser espera: ${n}`);
    for (const n of ['PR 130 pronto, HEAD abc, anotado na fila.', 'Q815: rodo a prova de campo?', 'Corrigi o teste e abri o PR 12.'])
      assert.ok(!notaEhEspera(n), `não devia ser espera: ${n}`);
  });

  it('medir: validador por modelo, orquestradora por origem e o custo dos eventos de espera', () => {
    const raiz = mkdtempSync(join(tmpdir(), 'custo-fixo-'));
    try {
      const proj = join(raiz, '-p'); const sub = join(proj, 'sess-dona', 'subagents');
      mkdirSync(sub, { recursive: true });
      escrever(join(proj, 'orq.jsonl'), [
        { type: 'user', timestamp: TS, message: { content: 'Você é a orquestradora deste projeto' } },
        resp(1, 'claude-opus-5-5', u(200_000)),
        evento('Testes afetados rodando; abro o PR quando passarem.'),
        resp(2, 'claude-opus-5-5', u(250_000)),
        resp(2, 'claude-opus-5-5', u(250_000)), // a mesma chamada repetida no transcript conta uma vez
        evento('PR 9 pronto, HEAD abc.'),
        resp(3, 'claude-opus-5-5', u(260_000)),
      ]);
      escrever(join(proj, 'sess-dona.jsonl'), [{ type: 'user', timestamp: TS, message: { content: 'dona' } }, resp(4, 'claude-opus-5-5', u(100_000))]);
      escrever(join(sub, 'agent-v1.jsonl'), [resp(5, 'claude-opus-5-5', u(50_000, 2000)), resp(6, 'claude-opus-5-5', u(60_000, 2000))]);
      writeFileSync(join(sub, 'agent-v1.meta.json'), JSON.stringify({ agentType: 'orquestracao:validador' }));
      escrever(join(sub, 'agent-v2.jsonl'), [resp(7, 'claude-sonnet-5-5', u(50_000, 2000))]);
      writeFileSync(join(sub, 'agent-v2.meta.json'), JSON.stringify({ agentType: 'orquestracao:validador' }));
      escrever(join(sub, 'agent-e.jsonl'), [resp(8, 'claude-haiku-5-5', u(10_000))]);
      writeFileSync(join(sub, 'agent-e.meta.json'), JSON.stringify({ agentType: 'orquestracao:explorador' }));

      const r = medir({ pasta: raiz, desde: new Date('2026-11-01') });
      assert.equal(r.total.chamadas, 8);
      const v = r.subagentes['orquestracao:validador'];
      assert.ok(v, 'o validador apareceu');
      assert.equal(v.rodadas, 2);
      assert.equal(v.porModelo.opus.rodadas, 1);
      assert.equal(v.porModelo.sonnet.rodadas, 1);
      assert.ok(v.porModelo.sonnet.usd < v.porModelo.opus.usd);
      assert.equal(r.subagentes['orquestracao:explorador'].rodadas, 1);
      assert.equal(r.orq.sessoes, 1);
      assert.equal(r.orq.chamadas, 3);
      assert.equal(r.orq.turnos.evento.turnos, 2);
      assert.equal(r.eventos.espera.turnos, 1);
      assert.equal(r.eventos.outros.turnos, 1);
      assert.ok(r.eventos.espera.usd > 0 && Math.abs(r.eventos.espera.usd - custoDaChamada(u(250_000), 'opus')) < 1e-9);
      const txt = relatorio(r);
      assert.match(txt, /validador: 2 rodadas/);
      assert.match(txt, /eventos só de dona esperando: 1 turnos/);

      const antes = medir({ pasta: raiz, desde: new Date('2026-11-01'), ate: new Date('2026-11-02') });
      assert.equal(antes.total.chamadas, 0, '--ate corta o período');
    } finally { rmSync(raiz, { recursive: true, force: true }); }
  });
});
