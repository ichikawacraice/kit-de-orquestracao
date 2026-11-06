// F446: o item em espera (ou com trava) não é cobrado pela batida. Medido no Izanagi (06/11): a dedução (F423) roda fora da trava,
// com até 25 s de gh, e o `parado` dela leva a espera de antes; a espera gravada no meio tempo não segurava a cutucada. A
// retomada do limite de uso e a fila órfã nem olhavam a espera.
// Rodar: node gate/com-fichas.mjs -- node --test plugins/orquestracao/hooks/tests/batida-espera.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { julgar } from '../../skills/orquestradora/scripts/batida.mjs';

const MIN = 60_000;
const T = Date.UTC(2026, 10, 6, 8, 0);
const iso = (ms) => new Date(ms).toISOString();
const DONA = 'local_00000000-0000-4000-8000-0000000000d1';
const ESPERA = { motivo: 'operador', texto: 'espera a resposta do operador' };
const item = (extra = {}) => ['F1', { titulo: 'um item', etapa: 'execucao', projeto: 'kit', donoLocalId: DONA, com: [{ localId: DONA }], atualizadoEm: iso(T - 40 * MIN), ...extra }];
const linhas = (extra = {}) => [{ sessionId: DONA, title: 'F1 · um item', isArchived: false, isRunning: false, ...extra }];
const rodar = ({ itens = [item()], limites = {}, deduzidos = new Map(), filasOrfas = {}, estado = {}, agoraMs = T } = {}) =>
  julgar({ agoraMs, itens: new Map(itens), linhas: linhas(), projetoDe: () => 'kit', estado, semDona: () => null, limites, deduzidos, filasOrfas });
const tipos = (r) => r.mensagens.map((m) => m.tipo);
// o deduzido da batida, calculado antes de a espera ser gravada
const ded = (extra = {}) => new Map([['F1', { etapa: 'execucao', prs: [], prsAbertos: [], mergeado: false, parado: true, ultimaAtividade: iso(T - 40 * MIN), ...extra }]]);

test('F446: o deduzido parado de antes da espera não cutuca o item que acabou de entrar em espera', () => {
  assert.deepEqual(tipos(rodar({ deduzidos: ded() })), ['cutucada'], 'contraste: sem espera, o parado deduzido cutuca');
  for (const extra of [{ espera: ESPERA }, { trava: { motivo: 'outra sessão' } }]) {
    const r = rodar({ itens: [item(extra)], deduzidos: ded() });
    assert.deepEqual(r.mensagens, [], JSON.stringify(extra));
    assert.deepEqual(r.soltar, []);
  }
});

test('F446: o item em merge com espera gravada depois da dedução não recebe a cobrança do --anotar', () => {
  const dd = ded({ etapa: 'merge', prs: [7], prsAbertos: [7] });
  assert.deepEqual(tipos(rodar({ itens: [item({ etapa: 'merge', prs: [7] })], deduzidos: dd })), ['anotar'], 'contraste: sem espera, cobra o --anotar');
  const r = rodar({ itens: [item({ etapa: 'merge', prs: [7], espera: ESPERA })], deduzidos: dd });
  assert.deepEqual(r.mensagens, []);
  assert.deepEqual(r.projetos.kit?.merge ?? [], [], 'nem vai ao relatório da orquestradora como merge parado');
});

test('F446: passado o reset do limite de uso, a dona não recebe a retomada do item em espera', () => {
  const RESET = T - 2 * MIN;
  const limites = { [DONA]: { resetsAtMs: RESET, emMs: T - 60 * MIN } };
  assert.deepEqual(tipos(rodar({ limites })), ['retomada'], 'contraste: sem espera, retoma');
  const r = rodar({ itens: [item({ espera: ESPERA })], limites });
  assert.deepEqual(r.mensagens, []);
  assert.equal(r.estado.limites?.[DONA], undefined, 'o reset não se dá por avisado: a retomada sai quando a espera acabar');
});

test('F446: o item em espera com PR numa fila órfã não vai ao relatório como merge parado (a fila parada vai, pela fila)', () => {
  const filasOrfas = { kit: { prs: [{ pr: 7, sha: 'a'.repeat(40) }], desde: iso(T - 30 * MIN) } };
  const emMerge = (extra = {}) => item({ etapa: 'merge', prs: [7], ...extra });
  assert.deepEqual(rodar({ itens: [emMerge()], filasOrfas }).projetos.kit.merge, ['F1'], 'contraste: sem espera, vai');
  const r = rodar({ itens: [emMerge({ espera: ESPERA })], filasOrfas });
  assert.deepEqual(r.projetos.kit.merge, []);
  assert.deepEqual(r.projetos.kit.filaParada?.prs, [7], 'a fila parada segue no relatório');
});
