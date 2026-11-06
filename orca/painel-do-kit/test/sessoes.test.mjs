// Sessões por projeto (F452): o estado de cada item vivo, deduzido do item da fila, da batida (deduzido.json), da fila de
// merge do projeto, das perguntas abertas e do worker do Orca. Nunca toca o ~/.claude real: tudo numa pasta temporária.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sessoesDoKit, etapasDaSessao, ORDEM_DOS_ESTADOS } from '../src/nucleo/sessoes.mjs';

const AGORA = Date.parse('2026-11-06T15:00:00Z'); // 12:00 em São Paulo
const DESDE = Date.parse('2026-11-06T03:00:00Z'); // 00:00 em São Paulo

// Monta <base>/painel/fila, <base>/batida/deduzido.json, <base>/fila-de-merge/<projeto>.json e <base>/orca-sessoes;
// devolve a pasta do painel. Fila em texto entra crua (para o caso ilegível).
function montar({ itens = {}, deduzido = null, filas = {}, batidaEm = '2026-11-06T14:59:00Z', orcaSessoes = {} } = {}) {
  const base = mkdtempSync(join(tmpdir(), 'f452-'));
  const painel = join(base, 'painel');
  mkdirSync(join(painel, 'fila'), { recursive: true });
  for (const [id, data] of Object.entries(itens)) writeFileSync(join(painel, 'fila', `${id}.json`), JSON.stringify({ id, version: 1, data }));
  if (deduzido) {
    mkdirSync(join(base, 'batida'), { recursive: true });
    writeFileSync(join(base, 'batida', 'deduzido.json'), JSON.stringify({ em: batidaEm, itens: deduzido }));
  }
  mkdirSync(join(base, 'fila-de-merge'), { recursive: true });
  for (const [p, e] of Object.entries(filas)) writeFileSync(join(base, 'fila-de-merge', `${p}.json`), typeof e === 'string' ? e : JSON.stringify(e));
  mkdirSync(join(base, 'orca-sessoes'), { recursive: true });
  for (const [uuid, e] of Object.entries(orcaSessoes)) writeFileSync(join(base, 'orca-sessoes', `${uuid}.json`), JSON.stringify(e));
  return painel;
}
const item = (extra = {}) => ({ titulo: 'Aba de sessões', projeto: 'kit', tema: 'painel', etapa: 'execucao', atualizadoEm: '2026-11-06T14:50:00Z', ...extra });
const ded = (extra = {}) => ({ etapa: 'execucao', prs: [], prsAbertos: [], prsMergeados: [], donaViva: true, rodando: false, parado: false, minParado: 2, ultimaAtividade: '2026-11-06T14:55:00Z', ...extra });
const ler = (painel, extra = {}) => sessoesDoKit(painel, { agoraMs: AGORA, desdeMs: DESDE, abertas: [], ...extra });
const so = (r) => { assert.equal(r.projetos.length, 1, JSON.stringify(r)); assert.equal(r.projetos[0].sessoes.length, 1); return r.projetos[0].sessoes[0]; };
const porItem = (r) => Object.fromEntries(r.projetos.flatMap((g) => g.sessoes).map((s) => [s.item, s]));

test('trabalhando: nome F<n> · título, sub-etapa, "agora" com a idade da nota; a batida manda na etapa', () => {
  const p = montar({ itens: { F452: item({ etapa: 'planejamento', agora: 'escrevendo o núcleo' }) }, deduzido: { F452: ded({ etapa: 'execucao', rodando: true }) } });
  const s = so(ler(p));
  assert.equal(s.item, 'F452');
  assert.equal(s.nome, 'F452 · Aba de sessões');
  assert.equal(s.estado, 'trabalhando');
  assert.equal(s.subEtapa, 'execucao');
  assert.equal(s.agora, 'escrevendo o núcleo');
  assert.equal(s.notaEm, '2026-11-06T14:50:00Z');
  assert.equal(s.rodando, true);
  assert.equal(s.projeto, 'kit');
  assert.equal(s.desdeEm, '2026-11-06T14:55:00Z', 'o tempo conta da última atividade');
  assert.ok(!('tema' in s) && !('dona' in s), 'tema e dona saíram do contrato');
});

test('sem deduzido, a etapa é a do item, e não se inventa dona sumida nem parado', () => {
  const p = montar({ itens: { F1: item({ etapa: 'design' }) } });
  const r = ler(p);
  assert.equal(r.batidaEm, null);
  const s = so(r);
  assert.equal(s.estado, 'trabalhando');
  assert.equal(s.subEtapa, 'design');
});

test('fila: mergeando com a fila ocupada; em voo sem ocupada e pendente dão na-fila, com a posição (em voo antes de pendentes)', () => {
  const p = montar({
    itens: { F2: item({ etapa: 'merge' }), F3: item({ etapa: 'merge' }), F5: item({ etapa: 'merge' }) },
    deduzido: {
      F2: ded({ etapa: 'merge', prsAbertos: [20] }),
      F3: ded({ etapa: 'merge', prsAbertos: [30] }),
      F5: ded({ etapa: 'merge', prsAbertos: [50] }),
    },
    filas: { kit: { ocupada: { pid: 1, desde: '2026-11-06T14:58:00Z', gate: 'npm test' }, emVoo: [{ pr: 30, sha: 'a' }], pendentes: [{ pr: 50 }, { pr: 20 }] } },
  });
  const s = porItem(ler(p));
  assert.equal(s.F3.estado, 'mergeando');
  assert.equal(s.F3.desdeEm, '2026-11-06T14:58:00Z', 'o tempo do gate conta de ocupada.desde');
  assert.equal(s.F3.prNaFila, 30);
  assert.equal(s.F5.estado, 'na-fila');
  assert.equal(s.F5.posicaoNaFila, 2);
  assert.equal(s.F5.foraDaFila, false);
  assert.equal(s.F2.posicaoNaFila, 3);

  const p2 = montar({ itens: { F1: item({ etapa: 'merge' }) }, deduzido: { F1: ded({ etapa: 'merge', prsAbertos: [9] }) }, filas: { kit: { ocupada: null, emVoo: [{ pr: 9 }], pendentes: [] } } });
  const s2 = so(ler(p2));
  assert.equal(s2.estado, 'na-fila', 'em voo sem ocupada: o processo já saiu');
  assert.equal(s2.posicaoNaFila, 1);
});

test('PR aberto fora da fila: na-fila com foraDaFila; a fila ilegível põe o grupo em aviso e o cartão como fora', () => {
  const p = montar({ itens: { F4: item({ etapa: 'merge' }) }, deduzido: { F4: ded({ etapa: 'merge', prsAbertos: [40] }) } });
  const r = ler(p);
  const s = so(r);
  assert.equal(s.estado, 'na-fila');
  assert.equal(s.foraDaFila, true);
  assert.equal(s.posicaoNaFila, null);
  assert.equal(s.prNaFila, 40);
  assert.deepEqual(s.prs, { abertos: [40], mergeados: [] });
  assert.equal(r.projetos[0].filaIlegivel, false, 'fila sem arquivo é fila vazia, não ilegível');

  const p2 = montar({ itens: { F4: item({ etapa: 'merge' }) }, deduzido: { F4: ded({ etapa: 'merge', prsAbertos: [40] }) }, filas: { kit: '{ruim' } });
  const r2 = ler(p2);
  assert.equal(r2.projetos[0].filaIlegivel, true);
  assert.equal(so(r2).foraDaFila, true);
});

test('esperando: pergunta aberta (com o Q-ID e o tempo dela), espera do operador, trava por acesso e por operador', () => {
  const p = montar({
    itens: {
      F1: item(),
      F2: item({ espera: { motivo: 'operador', texto: 'precisa do token' } }),
      F3: item({ trava: { motivo: 'acesso', texto: 'sem acesso ao repo' } }),
      F4: item({ trava: { motivo: 'operador', texto: 'pausado pelo operador' } }),
    },
    deduzido: { F1: ded(), F2: ded(), F3: ded(), F4: ded() },
  });
  const abertas = [{ id: 'Q90', titulo: 'Qual cor?', item: 'F1', atualizadoEm: '2026-11-06T14:00:00Z' }, { id: 'Q91', titulo: 'de outro', item: 'F7' }];
  const s = porItem(ler(p, { abertas }));
  assert.equal(s.F1.estado, 'esperando');
  assert.deepEqual(s.F1.perguntas, [{ id: 'Q90', titulo: 'Qual cor?' }]);
  assert.equal(s.F1.desdeEm, '2026-11-06T14:00:00Z');
  for (const [id, motivo] of [['F2', 'precisa do token'], ['F3', 'sem acesso ao repo'], ['F4', 'pausado pelo operador']]) {
    assert.equal(s[id].estado, 'esperando', id);
    assert.equal(s[id].motivo, motivo, id);
  }
});

// F470: o item parado de propósito esperando OUTRO item ou PR (`espera: { motivo: 'item', texto }`) é Esperando com o texto, não Parada.
test('espera por item: esperando com o motivo, mesmo com a dona sem movimento ou sem sessão; não conta como parada e sai do topo da lista', () => {
  const espera = { motivo: 'item', texto: 'aguarda o F462 mergear' };
  const p = montar({
    itens: { F1: item({ espera }), F2: item({ espera }), F3: item(), F4: item({ espera: { motivo: 'operador', texto: 'precisa do token' } }) },
    deduzido: { F1: ded({ parado: true, minParado: 90, ultimaAtividade: '2026-11-06T13:30:00Z' }), F2: ded({ donaViva: false }), F3: ded(), F4: ded() },
  });
  const r = ler(p);
  const s = porItem(r);
  for (const id of ['F1', 'F2']) {
    assert.equal(s[id].estado, 'esperando', id);
    assert.equal(s[id].tipoDeEspera, 'item', id);
    assert.equal(s[id].motivo, 'aguarda o F462 mergear', id);
    assert.equal(s[id].tipoDeParada, null, id);
  }
  assert.equal(s.F4.tipoDeEspera, null, 'a espera do operador segue sendo da pessoa');
  assert.equal(s.F3.tipoDeEspera, null);
  assert.equal(r.paradas, 1, 'só a espera do operador sem pergunta conta; esperar outro item não pede nada ao operador');
  assert.deepEqual(r.projetos[0].sessoes.map((x) => x.item), ['F4', 'F3', 'F1', 'F2'], 'a espera do operador sobe; a por item fica depois de quem trabalha');
});

test('espera por item: a pergunta aberta e a trava vencem; sem a espera, a mesma dona sem movimento é Parada (a prova de que a regra morde)', () => {
  const espera = { motivo: 'item', texto: 'aguarda o F462' };
  const p = montar({
    itens: { F1: item({ espera }), F2: item({ espera, trava: { motivo: 'conflito', texto: 'c' } }), F3: item() },
    deduzido: { F1: ded(), F2: ded(), F3: ded({ parado: true, minParado: 90 }) },
  });
  const s = porItem(ler(p, { abertas: [{ id: 'Q1', titulo: 't', item: 'F1' }] }));
  assert.equal(s.F1.estado, 'esperando');
  assert.equal(s.F1.tipoDeEspera, null, 'a pergunta é da pessoa: vale o estado dela');
  assert.equal(s.F2.estado, 'parada');
  assert.equal(s.F2.tipoDeParada, 'conflito');
  assert.equal(s.F3.estado, 'parada');
  assert.equal(s.F3.tipoDeParada, 'sem-movimento');
});

test('precedência: a pergunta aberta vence a trava; a trava vence a fila; a pergunta vence a fila', () => {
  const p = montar({
    itens: { F1: item({ etapa: 'merge', trava: { motivo: 'gate-vermelho', texto: 'gate vermelho' } }), F2: item({ etapa: 'merge' }), F3: item({ etapa: 'merge', trava: { motivo: 'conflito', texto: 'c' } }) },
    deduzido: { F1: ded({ etapa: 'merge' }), F2: ded({ etapa: 'merge', prsAbertos: [5] }), F3: ded({ etapa: 'merge', prsAbertos: [6] }) },
    filas: { kit: { ocupada: null, pendentes: [{ pr: 5 }, { pr: 6 }], emVoo: [] } },
  });
  const s = porItem(ler(p, { abertas: [{ id: 'Q1', titulo: 't', item: 'F1' }, { id: 'Q2', titulo: 't', item: 'F2' }] }));
  assert.equal(s.F1.estado, 'esperando');
  assert.equal(s.F2.estado, 'esperando');
  assert.equal(s.F3.estado, 'parada');
  assert.equal(s.F3.tipoDeParada, 'conflito');
});

test('parada: trava (conflito, gate), sessão do Orca que falhou, dona sumida (false ou null) e o parado da batida', () => {
  const p = montar({
    itens: {
      F1: item({ trava: { motivo: 'conflito', texto: 'conflito em panel.tsx' } }),
      F2: item({ trava: { motivo: 'gate-vermelho', texto: '3 testes falharam' } }),
      F3: item(),
      F4: item(),
      F5: item(),
      F6: item({ donoLocalId: 'orca_session_id:aaa-111' }),
    },
    deduzido: {
      F1: ded(), F2: ded(), F3: ded({ donaViva: false }), F4: ded({ donaViva: null }),
      F5: ded({ parado: true, ultimaAtividade: '2026-11-06T13:00:00Z' }), F6: ded({ parado: true }),
    },
    orcaSessoes: { 'aaa-111': { orcaId: 'orca_session_id:aaa-111', terminal: 'structworker_x' } },
  });
  const workers = [{ terminal: 'structworker_x', state: 'failed' }, { terminal: 'outro', state: 'failed' }];
  const s = porItem(ler(p, { workers }));
  assert.deepEqual([s.F1.estado, s.F1.tipoDeParada, s.F1.motivo], ['parada', 'conflito', 'conflito em panel.tsx']);
  assert.deepEqual([s.F2.estado, s.F2.tipoDeParada], ['parada', 'gate-vermelho']);
  assert.equal(s.F2.desdeEm, '2026-11-06T14:50:00Z', 'a trava conta do atualizadoEm do item');
  assert.deepEqual([s.F3.estado, s.F3.tipoDeParada], ['parada', 'sem-dona']);
  assert.deepEqual([s.F4.estado, s.F4.tipoDeParada], ['parada', 'sem-dona']);
  assert.deepEqual([s.F5.estado, s.F5.tipoDeParada], ['parada', 'sem-movimento']);
  assert.equal(s.F5.desdeEm, '2026-11-06T13:00:00Z', 'parada conta da última atividade');
  assert.deepEqual([s.F6.estado, s.F6.tipoDeParada], ['parada', 'falhou'], 'a falha (a causa) vence o parado (o sintoma)');
  // Sem a lista de workers, o mesmo item é só parado: prova que o "falhou" vem do worker.
  assert.equal(porItem(ler(p)).F6.tipoDeParada, 'sem-movimento');
});

test('na etapa merge, o parado e a dona encerrada não valem: o PR espera a fila', () => {
  const p = montar({
    itens: { F1: item({ etapa: 'merge' }), F2: item({ etapa: 'merge' }) },
    deduzido: { F1: ded({ etapa: 'merge', prsAbertos: [7], parado: true }), F2: ded({ etapa: 'merge', prsAbertos: [8], donaViva: null }) },
  });
  const s = porItem(ler(p));
  assert.equal(s.F1.estado, 'na-fila');
  assert.equal(s.F2.estado, 'na-fila');
  // O mesmo parado fora do merge vale: a ausência acima mede a regra, não um defeito do parado.
  const p2 = montar({ itens: { F1: item() }, deduzido: { F1: ded({ parado: true }) } });
  assert.equal(so(ler(p2)).estado, 'parada');
});

test('dependeDe: só os itens ainda abertos entram', () => {
  const p = montar({
    itens: { F1: item({ dependeDe: ['F2', 'F3', 'F9'] }), F2: item(), F3: item({ etapa: 'feito', feitoEm: '2026-11-01T10:00:00Z' }) },
    deduzido: { F1: ded({ donaViva: null }), F2: ded() },
  });
  const s = porItem(ler(p));
  assert.deepEqual(s.F1.dependeDe, ['F2']);
  assert.deepEqual(s.F2.dependeDe, []);
});

test('batida com mais de 25 min ou no futuro: cai no declarado (etapa do item, sem parado nem dona sumida)', () => {
  const declarado = (batidaEm) => montar({
    itens: { F1: item({ etapa: 'validacao' }) },
    deduzido: { F1: ded({ etapa: 'execucao', parado: true, donaViva: false }) },
    batidaEm,
  });
  // A batida de 10 min ainda manda: prova que a dedução seria lida.
  const fresca = ler(declarado('2026-11-06T14:50:00Z'));
  assert.equal(so(fresca).estado, 'parada');
  assert.equal(fresca.batidaEm, '2026-11-06T14:50:00Z');
  const velha = ler(declarado('2026-11-06T14:30:00Z'));
  assert.equal(so(velha).estado, 'validando');
  assert.equal(velha.batidaEm, '2026-11-06T14:30:00Z', 'a idade continua dita, para a faixa');
  const futura = ler(declarado('2026-11-06T16:00:00Z'));
  assert.equal(so(futura).estado, 'validando');
  assert.equal(futura.batidaEm, null, 'em no futuro conta como ilegível');
});

test('entregue: só o item feito hoje, com os PRs; descartado e feito antigo não aparecem', () => {
  const p = montar({
    itens: {
      F1: item({ etapa: 'feito', feitoEm: '2026-11-06T13:00:00Z', prs: [7] }),
      F2: item({ etapa: 'feito', feitoEm: '2026-11-06T02:30:00Z' }), // 23:30 de ontem em SP
      F3: item({ etapa: 'descartado' }),
    },
  });
  const s = so(ler(p));
  assert.equal(s.item, 'F1');
  assert.equal(s.estado, 'entregue');
  assert.deepEqual(s.prs.mergeados, [7]);
  assert.equal(s.desdeEm, '2026-11-06T13:00:00Z');
});

test('fatias com nomes: feitas pelos PRs mergeados, a de agora é a seguinte', () => {
  const p = montar({
    itens: { F1: item({ maisFatias: true, fatias: ['núcleo', 'seção', 'polimento', 'docs'] }) },
    deduzido: { F1: ded({ prsMergeados: [1], prsAbertos: [2] }) },
  });
  const s = so(ler(p));
  assert.deepEqual(s.fatia, { atual: 2, total: 4 });
  assert.equal(s.todasFeitas, false);
  assert.deepEqual(s.etapas.map((e) => [e.nome, e.estado]), [['núcleo', 'feito'], ['seção', 'agora'], ['polimento', 'falta'], ['docs', 'falta']]);
  assert.equal(s.feitasJuntas, 0);
  assert.equal(s.maisBolinhas, 0);
});

test('o teto: com tantos PRs mergeados quanto fatias, todas feitas e o item ainda aberto', () => {
  const p = montar({ itens: { F1: item({ fatias: ['a', 'b', 'c', 'd'] }) }, deduzido: { F1: ded({ prsMergeados: [1, 2, 3, 4, 5] }) } });
  const s = so(ler(p));
  assert.deepEqual(s.fatia, { atual: 4, total: 4 });
  assert.equal(s.todasFeitas, true);
  assert.ok(s.etapas.length === 4 && s.etapas.every((e) => e.estado === 'feito'), JSON.stringify(s.etapas));
});

test('mais de 7 fatias: as feitas se juntam, vêm a atual e até 5 das que faltam, o resto é contado', () => {
  const nomes = Array.from({ length: 12 }, (_, i) => `fatia ${i + 1}`);
  const p = montar({ itens: { F1: item({ fatias: nomes }) }, deduzido: { F1: ded({ prsMergeados: [1, 2, 3] }) } });
  const s = so(ler(p));
  assert.equal(s.feitasJuntas, 3);
  assert.deepEqual(s.etapas.map((e) => e.estado), ['agora', 'falta', 'falta', 'falta', 'falta', 'falta']);
  assert.equal(s.etapas[0].nome, 'fatia 4');
  assert.equal(s.maisBolinhas, 3);
});

test('fatias sem nomes: "fatia k" sem total, e as bolinhas seguem a esteira', () => {
  const p = montar({ itens: { F1: item({ maisFatias: true }) }, deduzido: { F1: ded({ prsMergeados: [1, 2] }) } });
  const s = so(ler(p));
  assert.deepEqual(s.fatia, { atual: 3, total: null });
  assert.deepEqual(s.etapas.map((e) => e.estado), ['feito', 'agora', 'falta', 'falta', 'falta']);
  assert.equal(so(ler(montar({ itens: { F1: item() }, deduzido: { F1: ded() } }))).fatia, null, 'item de um PR só não tem fatia');
  const conserto = so(ler(montar({ itens: { F1: item({ maisFatias: false }) }, deduzido: { F1: ded({ prsMergeados: [7] }) } })));
  assert.equal(conserto.fatia, null, 'um PR mergeado sem maisFatias não inventa "fatia 2"');
});

test('a esteira: cada etapa do item acende a sua bolinha', () => {
  const nomes = etapasDaSessao({ estado: 'trabalhando', etapa: 'planejamento' }).map((e) => e.nome);
  assert.deepEqual(nomes, ['planejamento', 'execução', 'validação', 'merge', 'entregue']);
  const agoraEm = (etapa, estado = 'trabalhando') => etapasDaSessao({ estado, etapa }).findIndex((e) => e.estado === 'agora');
  assert.equal(agoraEm('planejamento'), 0);
  assert.equal(agoraEm('design'), 0, 'design faz parte de planejar');
  assert.equal(agoraEm('execucao'), 1);
  assert.equal(agoraEm('validacao', 'validando'), 2);
  assert.equal(agoraEm('merge', 'na-fila'), 3);
  assert.equal(agoraEm('merge', 'parada'), 3, 'a parada fica na bolinha da etapa');
  const feita = etapasDaSessao({ estado: 'entregue', etapa: 'feito' });
  assert.ok(feita.every((e) => e.estado === 'feito'), JSON.stringify(feita));
});

test('ordem e conta do trilho: urgência no grupo e entre grupos; paradas soma as travas e a espera sem pergunta', () => {
  const p = montar({
    itens: {
      F1: item({ projeto: 'beta' }),
      F2: item({ projeto: 'beta', etapa: 'feito', feitoEm: '2026-11-06T12:00:00Z' }),
      F3: item({ projeto: 'beta', trava: { motivo: 'outra', texto: 'x' } }),
      F4: item({ projeto: 'alfa' }),
      F5: item({ projeto: undefined }),
      F6: item({ projeto: 'zeta', espera: { motivo: 'operador', texto: 'y' } }),
      F7: item({ projeto: 'zeta' }),
      F10: item({ projeto: 'beta', trava: { motivo: 'outra', texto: 'z' } }),
    },
    deduzido: { F1: ded(), F3: ded(), F4: ded(), F5: ded(), F6: ded(), F7: ded(), F10: ded() },
  });
  const r = ler(p, { abertas: [{ id: 'Q1', titulo: 't', item: 'F7' }] });
  assert.deepEqual(r.projetos.map((g) => g.projeto), ['zeta', 'beta', 'alfa', null]);
  assert.deepEqual(r.projetos[1].sessoes.map((s) => s.item), ['F3', 'F10', 'F1', 'F2'], 'empate pelo número do item');
  assert.equal(ORDEM_DOS_ESTADOS[0], 'esperando');
  // F3 e F10 travadas, F6 espera sem pergunta; F7 tem pergunta (Perguntas já a conta).
  assert.equal(r.paradas, 3);
});

test('item ilegível e pasta sem fila não quebram a leitura', () => {
  const p = montar({ itens: { F1: item() } });
  writeFileSync(join(p, 'fila', 'F2.json'), '{ruim');
  const r = ler(p);
  assert.equal(r.projetos.length, 1);
  assert.equal(r.ilegiveis, 1);
  assert.equal(r.erro, null);
  const vazio = sessoesDoKit(join(tmpdir(), 'nao-existe-f452'), { agoraMs: AGORA, desdeMs: DESDE, abertas: [] });
  assert.deepEqual(vazio.projetos, []);
  assert.equal(vazio.paradas, 0);
});

test('dona do Orca fora da vista da batida (donaViva null com donoLocalId) não é dona sumida', () => {
  const p = montar({ itens: { F1: item({ donoLocalId: 'orca_session_id:abc' }), F2: item() }, deduzido: { F1: ded({ donaViva: null }), F2: ded({ donaViva: null }) } });
  const s = porItem(ler(p));
  assert.equal(s.F1.estado, 'trabalhando');
  // O mesmo null sem dona registrada é sem-dona: prova que a regra mede a dona, não o null.
  assert.deepEqual([s.F2.estado, s.F2.tipoDeParada], ['parada', 'sem-dona']);
  assert.equal(ler(p).paradas, 1);
});

test('sem a batida, os PRs do item não viram "abertos" nem fatia: só a fila de merge prova o PR aberto', () => {
  const prs = [1617, 1620, 1623, 1627];
  const p = montar({ itens: { F1: item({ etapa: 'merge', maisFatias: true, prs, fatias: ['a', 'b', 'c', 'd', 'e'] }) } });
  const s = so(ler(p));
  assert.equal(s.estado, 'na-fila');
  assert.equal(s.foraDaFila, true);
  assert.equal(s.prNaFila, null, 'o 1617 pode já ter entrado: não se afirma');
  assert.deepEqual(s.prs, { abertos: [], mergeados: [] });
  assert.equal(s.fatia, null);
  assert.deepEqual(s.etapas.map((e) => e.nome), ['planejamento', 'execução', 'validação', 'merge', 'entregue'], 'sem saber as feitas, vale a esteira declarada');
  // Com o PR anotado na fila de merge, ele está aberto: a fila basta.
  const p2 = montar({ itens: { F1: item({ etapa: 'merge', prs }) }, filas: { kit: { pendentes: [{ pr: 1627 }] } } });
  assert.deepEqual([so(ler(p2)).estado, so(ler(p2)).prNaFila, so(ler(p2)).foraDaFila], ['na-fila', 1627, false]);
});

test('mais de 7 fatias, todas com PR mergeado: a última fica como bolinha e as outras se juntam', () => {
  const nomes = Array.from({ length: 9 }, (_, i) => `fatia ${i + 1}`);
  const p = montar({ itens: { F1: item({ fatias: nomes }) }, deduzido: { F1: ded({ prsMergeados: [1, 2, 3, 4, 5, 6, 7, 8, 9] }) } });
  const s = so(ler(p));
  assert.equal(s.todasFeitas, true);
  assert.equal(s.feitasJuntas, 8);
  assert.deepEqual(s.etapas, [{ nome: 'fatia 9', estado: 'feito' }]);
});

test('terminal com vários despachos: só falhou quando todos falharam', () => {
  const p = montar({
    itens: { F1: item({ donoLocalId: 'orca_session_id:aaa' }) },
    deduzido: { F1: ded() },
    orcaSessoes: { aaa: { terminal: 'structworker_x' } },
  });
  const misto = [{ terminal: 'structworker_x', state: 'failed' }, { terminal: 'structworker_x', state: 'running' }];
  assert.equal(so(ler(p, { workers: misto })).estado, 'trabalhando');
  const todos = [{ terminal: 'structworker_x', state: 'failed' }, { terminal: 'structworker_x', state: 'failed' }];
  assert.equal(so(ler(p, { workers: todos })).tipoDeParada, 'falhou');
});
