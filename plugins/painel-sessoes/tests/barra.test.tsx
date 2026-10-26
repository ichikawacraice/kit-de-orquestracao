import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { TestBody } from 'claude-code/testing'
import {
  CACHE_TTL_MS,
  PALAVRA_ALTO,
  PALAVRA_LIMPAR,
  REGUAS,
  abertasDoProjeto,
  contarPool,
  corDoContexto,
  faixaDaBarra,
  janelaDeCompactacao,
  larguraDaFaixa,
  meuItem,
  mostraLimparAntes,
  nivelDoCache,
  orquestradorasDoProjeto,
  papelEApelido,
  pecasDaBarra,
  perguntaDeLimpeza,
  reguaDoPapel,
  relogio,
  textoDoContexto,
} from '../hooks/barra.js'
import type { EstadoBarra } from '../hooks/barra.js'

type Doc = { id: string; data: Record<string, unknown>; version: number }
const doc = (id: string, data: Record<string, unknown>, version = 1): Doc => ({ id, data, version })

const EU = 'local_eu'
const ORQ = 'local_orq'
const HOME = '/home/teste'
const SETTINGS = `${HOME}/.claude/settings.json`
const PASTA = `${HOME}/.claude/orquestracao/painel`
const BANDEIRA = `${HOME}/.claude/orquestracao/operador-ausente.json`
const REGISTRO_DO_APP = `${HOME}/Library/Application Support/Claude/claude-code-sessions/conta/org/${EU}.json`
const AGORA = Date.UTC(2026, 9, 26, 12)
const RESPOSTA = 'sim (segue a recomendação)'
const PEDIDO = 'limpar · orquestradora'

// ---- funções puras ----

const sessaoOrq = (extra: Record<string, unknown> = {}) => doc(ORQ, { projeto: 'Kit', titulo: '🎛 orquestradora — kit', papel: 'orquestradora', ...extra })

test('reguaDoPapel: o teto sai do papel do título', () => {
  expect(REGUAS, 'as réguas existem').toBeTruthy()
  expect(reguaDoPapel('E2 · x')?.teto).toBe(REGUAS.E.teto)
  expect(reguaDoPapel('P1 · x')?.teto).toBe(REGUAS.P.teto)
  expect(reguaDoPapel('D1 · x')?.teto).toBe(REGUAS.D.teto)
  expect(reguaDoPapel('V3 · x')?.teto).toBe(REGUAS.V.teto)
  expect(reguaDoPapel('🎛 orquestradora — kit')?.teto).toBe(REGUAS.orquestradora.teto)
  expect(reguaDoPapel('🎛 orquestradora — kit', true)?.teto, 'ausente: a orquestradora segue a régua da planejadora').toBe(REGUAS.P.teto)
  expect(reguaDoPapel('qualquer coisa')).toBeNull()
  expect(reguaDoPapel(null)).toBeNull()
  expect(papelEApelido('E2 · x')).toEqual({ papel: 'E', apelido: 'E2' })
  expect(papelEApelido('🎛 orquestradora — kit').papel).toBe('orquestradora')
  expect(papelEApelido('nada').papel).toBeNull()
})

test('corDoContexto: normal, aviso, teto e sem cor', () => {
  const regua = { aviso: 200_000, teto: 300_000 }
  expect(corDoContexto(199_999, regua)).toBe('normal')
  expect(corDoContexto(200_000, regua)).toBe('aviso')
  expect(corDoContexto(299_999, regua)).toBe('aviso')
  expect(corDoContexto(300_000, regua)).toBe('teto')
  expect(corDoContexto(900_000, null)).toBeNull()
  expect(corDoContexto(250_000, { aviso: 250_000, teto: 250_000 }), 'aviso e teto iguais: vale o teto').toBe('teto')
})

test('nivelDoCache: aviso aos 20 min, alerta aos 10, nenhum trabalhando', () => {
  expect(nivelDoCache(1201, false)).toBeNull()
  expect(nivelDoCache(1200, false)).toBe('aviso')
  expect(nivelDoCache(601, false)).toBe('aviso')
  expect(nivelDoCache(600, false)).toBe('alerta')
  expect(nivelDoCache(1, false)).toBe('alerta')
  expect(nivelDoCache(0, false)).toBe('venceu')
  for (const s of [3000, 1200, 600, 0]) expect(nivelDoCache(s, true)).toBeNull()
  expect(nivelDoCache(null, false)).toBeNull()
})

test('relogio: mm:ss, venceu e sem resposta', () => {
  expect(relogio(3600)).toBe('60:00')
  expect(relogio(59)).toBe('00:59')
  expect(relogio(0)).toBe('venceu')
  expect(relogio(null)).toBe('—')
  expect(CACHE_TTL_MS).toBe(3_600_000)
})

test('orquestradorasDoProjeto: pelo papel e pelo título, só as do projeto', () => {
  const docs = [
    sessaoOrq(),
    doc('local_orq2', { projeto: 'kit', titulo: '🎛 orquestradora — kit (2)' }),
    doc('local_outra', { projeto: 'outro', titulo: '🎛 orquestradora — outro', papel: 'orquestradora' }),
    doc('local_p3', { projeto: 'kit', titulo: 'P3 · barra', papel: 'planejador' }),
  ]
  const ids = orquestradorasDoProjeto(docs, 'kit')
  expect(ids.length, 'achou ao menos uma').toBeGreaterThan(0)
  expect(ids.sort()).toEqual([ORQ, 'local_orq2'])
  expect(orquestradorasDoProjeto(docs, 'KIT').length).toBe(2)
  expect(orquestradorasDoProjeto(docs, 'outro')).toEqual(['local_outra'])
})

const limpar = (id: string, extra: Record<string, unknown> = {}, versao = 1) =>
  doc(id, { projeto: 'kit', sessao: 'orq', sessaoId: ORQ, titulo: PEDIDO, estado: 'aberta', atualizadoEm: '2026-10-26T10:00:00Z', ...extra }, versao)

test('perguntaDeLimpeza: só a pedido de limpeza aberto da orquestradora do projeto', () => {
  const ids = [ORQ]
  const achada = perguntaDeLimpeza([limpar('Q290')], ids)
  expect(achada?.id, 'achou uma').toBe('Q290')
  expect(achada?.sessaoId).toBe(ORQ)
  expect(perguntaDeLimpeza([limpar('Q290', { projeto: undefined })], ids)?.id, 'sem o campo projeto').toBe('Q290')
  expect(perguntaDeLimpeza([limpar('Q290', { estado: 'respondida' })], ids)).toBeNull()
  expect(perguntaDeLimpeza([limpar('Q290', { sessaoId: 'local_outra' })], ids), 'sessaoId de outra sessão').toBeNull()
  expect(perguntaDeLimpeza([limpar('Q290', { titulo: 'limpar · outra-coisa' })], ids)).toBeNull()
  expect(perguntaDeLimpeza([limpar('Q290', { titulo: `  ${PEDIDO}  ` })], ids)?.id).toBe('Q290')
  expect(perguntaDeLimpeza([limpar('Q290')], [])).toBeNull()
  // a mais recente vale, tenha ela o número maior ou o menor
  const velha = limpar('Q290', { atualizadoEm: '2026-10-26T09:00:00Z' })
  const nova = limpar('Q300', { atualizadoEm: '2026-10-26T11:00:00Z' })
  expect(perguntaDeLimpeza([velha, nova], ids)?.id).toBe('Q300')
  const novaMenor = limpar('Q280', { atualizadoEm: '2026-10-26T12:00:00Z' })
  expect(perguntaDeLimpeza([velha, novaMenor], ids)?.id).toBe('Q280')
  expect(perguntaDeLimpeza([limpar('Q290')], ids, EU)?.propria).toBe(false)
  expect(perguntaDeLimpeza([limpar('Q290', { sessaoId: EU })], [EU], EU)?.propria).toBe(true)
})

test('perguntaDeLimpeza: o sim do painel há até 30 min vale para a T7 e esconde as outras abertas da mesma orquestradora', () => {
  const ids = [ORQ]
  const agora = Date.parse('2026-10-26T12:00:00Z')
  const velha = limpar('Q99051', { atualizadoEm: '2026-10-26T10:00:00Z' })
  const nova = limpar('Q99052', { atualizadoEm: '2026-10-26T11:00:00Z' })
  const ok = (id: string, minutos: number, extra: Record<string, unknown> = {}) =>
    limpar(id, { estado: 'respondida', resposta: RESPOSTA, respondidaPor: 'painel', respondidaEm: new Date(agora - minutos * 60_000).toISOString(), ...extra })
  expect(perguntaDeLimpeza([velha, nova], ids, undefined, agora)?.id, 'sem ok, a mais nova').toBe('Q99052')
  expect(perguntaDeLimpeza([velha, ok('Q99053', 5), nova], ids, undefined, agora), 'ok na mais nova: nada a pedir').toBeNull()
  expect(perguntaDeLimpeza([velha, ok('Q99053', 30), nova], ids, undefined, agora), 'no limite dos 30 min').toBeNull()
  expect(perguntaDeLimpeza([velha, ok('Q99053', 31), nova], ids, undefined, agora)?.id, 'há 31 min o ok venceu').toBe('Q99052')
  expect(perguntaDeLimpeza([velha, ok('Q99053', 5, { sessaoId: 'local_outra' }), nova], ids, undefined, agora)?.id, 'sim de outra sessaoId').toBe('Q99052')
  expect(perguntaDeLimpeza([velha, ok('Q99053', 5, { resposta: 'não' }), nova], ids, undefined, agora)?.id, 'resposta não').toBe('Q99052')
  expect(perguntaDeLimpeza([velha, ok('Q99053', 5, { respondidaPor: 'sessao' }), nova], ids, undefined, agora)?.id, 'não foi o painel').toBe('Q99052')
  expect(perguntaDeLimpeza([velha, ok('Q99053', 5, { titulo: 'limpar · outra-coisa' }), nova], ids, undefined, agora)?.id, 'outro título').toBe('Q99052')
})

test('perguntaDeLimpeza: o pedido aberto depois do ok volta; o anterior ou do mesmo instante segue escondido', () => {
  const ids = [ORQ]
  const agora = Date.parse('2026-10-26T12:00:00Z')
  const ok = (id: string, minutos: number) =>
    limpar(id, { estado: 'respondida', resposta: RESPOSTA, respondidaPor: 'painel', respondidaEm: new Date(agora - minutos * 60_000).toISOString() })
  // o sim é das 11:55
  expect(perguntaDeLimpeza([ok('Q99053', 5), limpar('Q99054', { atualizadoEm: '2026-10-26T11:58:00Z' })], ids, undefined, agora)?.id, 'aberta depois do ok').toBe('Q99054')
  expect(perguntaDeLimpeza([ok('Q99053', 5), limpar('Q99054', { atualizadoEm: '2026-10-26T11:55:00Z' })], ids, undefined, agora), 'empate: escondida').toBeNull()
  expect(perguntaDeLimpeza([ok('Q99053', 5), limpar('Q99054', { atualizadoEm: '2026-10-26T11:50:00Z' })], ids, undefined, agora), 'aberta antes do ok').toBeNull()
  // dois sins na janela (11:55 e 11:40) e a aberta das 11:50 entre eles: vale o sim mais recente
  expect(perguntaDeLimpeza([ok('Q99053', 5), ok('Q99055', 20), limpar('Q99054', { atualizadoEm: '2026-10-26T11:50:00Z' })], ids, undefined, agora), 'vale o sim mais recente').toBeNull()
  expect(perguntaDeLimpeza([ok('Q99053', 5), limpar('Q99054', { atualizadoEm: 'lixo' })], ids, undefined, agora), 'atualizadoEm ilegível: anterior').toBeNull()
  // entre as candidatas vale a mais recente, como sem ok
  const novaA = limpar('Q99056', { atualizadoEm: '2026-10-26T11:57:00Z' })
  const novaB = limpar('Q99057', { atualizadoEm: '2026-10-26T11:59:00Z' })
  expect(perguntaDeLimpeza([ok('Q99053', 5), novaA, novaB], ids, undefined, agora)?.id).toBe('Q99057')
  // sim vencido (31 min) não esconde nada, como antes
  expect(perguntaDeLimpeza([ok('Q99053', 31), limpar('Q99054', { atualizadoEm: '2026-10-26T11:20:00Z' })], ids, undefined, agora)?.id).toBe('Q99054')
})

test('abertasDoProjeto conta as abertas, todas', () => {
  const docs = [limpar('Q1'), limpar('Q2', { estado: 'respondida' }), doc('Q3', { estado: 'aberta', titulo: 'x' })]
  expect(abertasDoProjeto(docs)).toBe(2)
})

const item = (id: string, data: Record<string, unknown>) => doc(id, { projeto: 'kit', titulo: id, etapa: 'execucao', ...data })

test('meuItem: o dono vence o com, e o feito é ignorado', () => {
  const docs = [
    item('F10', { com: [{ localId: EU, apelido: 'E1' }] }),
    item('F20', { donoLocalId: EU, donoApelido: 'E1' }),
    item('F30', { donoLocalId: EU, donoApelido: 'E1', etapa: 'feito' }),
  ]
  expect(meuItem(docs, EU)?.id).toBe('F20')
  expect(meuItem([docs[0]!, docs[2]!], EU)?.id, 'sem dono vivo, vale o com').toBe('F10')
  expect(meuItem([docs[2]!], EU)).toBeNull()
})

test('contarPool: sessões distintas por apelido, só itens vivos do projeto', () => {
  const docs = [
    item('F1', { com: [{ localId: 'a', apelido: 'E1' }, { localId: 'b', apelido: 'V1' }] }),
    item('F2', { com: [{ localId: 'a', apelido: 'E1' }, { localId: 'c', apelido: 'E2' }] }),
    item('F3', { projeto: 'outro', com: [{ localId: 'd', apelido: 'E9' }] }),
    item('F4', { etapa: 'feito', com: [{ localId: 'e', apelido: 'V7' }] }),
  ]
  expect(contarPool(docs, 'kit'), 'um item vivo com E1 é contado').toEqual({ e: 2, v: 1 })
  expect(contarPool(docs, 'outro')).toEqual({ e: 1, v: 0 })
})

test('mostraLimparAntes: só orquestradora, 1–600 s, parada, com 150 mil', () => {
  const ok = { ehOrquestradora: true, segundos: 480, trabalhando: false, tokens: 212_000 }
  expect(mostraLimparAntes(ok)).toBe(true)
  expect(mostraLimparAntes({ ...ok, ehOrquestradora: false })).toBe(false)
  expect(mostraLimparAntes({ ...ok, segundos: 601 })).toBe(false)
  expect(mostraLimparAntes({ ...ok, segundos: 0 })).toBe(false)
  expect(mostraLimparAntes({ ...ok, segundos: null })).toBe(false)
  expect(mostraLimparAntes({ ...ok, trabalhando: true })).toBe(false)
  expect(mostraLimparAntes({ ...ok, tokens: 149_999 })).toBe(false)
  expect(mostraLimparAntes({ ...ok, tokens: null })).toBe(false)
})

const REFERENCIA: EstadoBarra = {
  relogio: '47:12',
  bloco: false,
  tokens: 142_000,
  janela: 600_000,
  regua: { aviso: 200_000, teto: 300_000 },
  item: 'F52 · design',
  pool: 'E 2 · V 1',
  abertas: 3,
  modo: 'ausente',
  trocando: false,
  painelAberto: true,
  moldura: false,
  pedido: null,
  limparAntes: false,
}

test('faixaDaBarra: a mais rica cuja soma cabe, com os textos reais', () => {
  const f = (cols: number, extra: Partial<EstadoBarra> = {}) => faixaDaBarra(cols, { ...REFERENCIA, ...extra })
  expect([f(114), f(113), f(94), f(93), f(40)]).toEqual([0, 1, 1, 2, 2])
  expect(f(114, { tokens: 250_000, regua: { aviso: 200_000, teto: 300_000 } }), 'palavra alto').toBe(1)
  expect(f(94, { tokens: 250_000 })).toBe(2)
  expect(f(114, { moldura: true })).toBe(1)
  expect(f(114, { abertas: 12 })).toBe(1)
})

test('faixaDaBarra: a palavra · limpar conta na soma (P a 510 mil, 119 colunas)', () => {
  const p: EstadoBarra = { ...REFERENCIA, tokens: 510_000, regua: REGUAS.P, modo: 'presente', painelAberto: false }
  expect(larguraDaFaixa(p, 0), 'a soma é a da revisão: 63 + 2 + 52 + 2').toBe(119)
  expect([faixaDaBarra(119, p), faixaDaBarra(118, p)]).toEqual([0, 1])
})

test('faixaDaBarra: o relógio em bloco (alerta e venceu) soma as duas células do respiro', () => {
  const base = larguraDaFaixa(REFERENCIA, 0)
  expect(base, 'a referência soma 114').toBe(114)
  expect(larguraDaFaixa({ ...REFERENCIA, bloco: true }, 0)).toBe(base + 2)
  expect(faixaDaBarra(114, REFERENCIA)).toBe(0)
  expect(faixaDaBarra(114, { ...REFERENCIA, bloco: true }), 'com o bloco a faixa 0 já não cabe').toBe(1)
})

// O caso do print: orquestradora, 253 mil, 1 pergunta, presente, pane aberto, pedido aberto (revisão, teste 10).
const COM_PEDIDO: EstadoBarra = { ...REFERENCIA, tokens: 253_000, regua: REGUAS.orquestradora, item: null, pool: null, abertas: 1, modo: 'presente', pedido: 'aberto' }

test('faixaDaBarra: o pedido de limpeza entra na soma, com a frase e o botão reais', () => {
  expect([0, 1, 2].map(f => larguraDaFaixa(COM_PEDIDO, f as 0 | 1 | 2)), 'as somas da revisão').toEqual([142, 101, 79])
  const f = (cols: number, extra: Partial<EstadoBarra> = {}) => faixaDaBarra(cols, { ...COM_PEDIDO, ...extra })
  expect([f(142), f(141), f(114), f(101), f(100), f(94), f(79), f(78)]).toEqual([0, 1, 1, 1, 2, 2, 2, 2])
  expect(larguraDaFaixa({ ...COM_PEDIDO, modo: 'ausente' }, 2), 'ausente com selo: 100').toBe(100)
})

test('faixaDaBarra: Enviando… e ✓ ok enviado somam o texto deles, não o do repouso', () => {
  const repouso = larguraDaFaixa(COM_PEDIDO, 0)
  expect(repouso).toBe(142)
  expect(larguraDaFaixa({ ...COM_PEDIDO, pedido: 'enviando' }, 0), '`Enviando…` tem 5 células a menos que `Pode se limpar`').toBe(repouso - 5)
  expect(larguraDaFaixa({ ...COM_PEDIDO, pedido: 'enviado' }, 0), 'frase e botão dão lugar a `✓ ok enviado`').toBe(107)
  expect(faixaDaBarra(137, COM_PEDIDO), 'no repouso, 137 não cabe na faixa 0').toBe(1)
  expect(faixaDaBarra(137, { ...COM_PEDIDO, pedido: 'enviando' })).toBe(0)
  expect(faixaDaBarra(107, { ...COM_PEDIDO, pedido: 'enviado' })).toBe(0)
})

test('pecasDaBarra: o pedido abre o grupo da direita; item, pool e o Ficar ausente caem', () => {
  const dir = (e: EstadoBarra, f: 0 | 1 | 2) => pecasDaBarra(e, f).dir.map(p => p.k)
  expect(dir(COM_PEDIDO, 0)).toEqual(['pedido', 'limpar-pedido', 'perguntas', 'modo', 'painel'])
  expect(dir(COM_PEDIDO, 1), 'faixa 1: o Ficar ausente já caiu').toEqual(['pedido', 'limpar-pedido', 'perguntas', 'painel'])
  expect(dir(COM_PEDIDO, 2)).toEqual(['pedido', 'limpar-pedido', 'perguntas'])
  expect(dir({ ...COM_PEDIDO, modo: 'ausente' }, 1), 'o ☾ Estou de volta nunca cai').toEqual(['pedido', 'limpar-pedido', 'perguntas', 'modo', 'painel'])
  expect(dir({ ...COM_PEDIDO, pedido: 'enviado' }, 1)).toEqual(['pedido', 'perguntas', 'painel'])
  const completo = { ...COM_PEDIDO, item: 'F52 · design', pool: 'E 2 · V 1' }
  expect(pecasDaBarra(completo, 0).esq.map(p => p.k), 'com o pedido, sem item nem pool').toEqual(['relogio', 'contexto'])
  expect(pecasDaBarra({ ...completo, pedido: null }, 0).esq.map(p => p.k), 'sem o pedido, item e pool voltam').toEqual(['relogio', 'contexto', 'item', 'pool'])
  const frase = (f: 0 | 1 | 2) => pecasDaBarra(COM_PEDIDO, f).dir[0]?.t
  expect([frase(0), frase(1), frase(2)]).toEqual(['◆ orquestradora pede limpeza', '◆ pede limpeza', '◆ pede limpeza'])
  expect(pecasDaBarra({ ...COM_PEDIDO, pedido: 'enviado' }, 0).dir[0]?.t).toBe('✓ ok enviado')
})

test('pecasDaBarra: o limpar antes é só o botão, com as mesmas quedas e sem frase', () => {
  const e: EstadoBarra = { ...REFERENCIA, modo: 'presente', limparAntes: true }
  const p = pecasDaBarra(e, 1)
  expect(p.dir.map(x => x.k)).toEqual(['limpar-antes', 'perguntas', 'painel'])
  expect(p.dir.some(x => x.t.includes('◆')), 'sem frase').toBe(false)
  expect(p.esq.map(x => x.k)).toEqual(['relogio', 'contexto'])
  expect(pecasDaBarra({ ...e, pedido: 'aberto' }, 1).dir.map(x => x.k), 'o pedido vence o limpar antes').toEqual(['pedido', 'limpar-pedido', 'perguntas', 'painel'])
})

test('textoDoContexto: a janela é o denominador; a régua só dá a palavra', () => {
  expect(PALAVRA_ALTO).toBe(' · alto')
  expect(PALAVRA_LIMPAR).toBe(' · limpar')
  expect(textoDoContexto(198_000, REGUAS.orquestradora, 600_000, 0)).toBe('contexto 198/600 mil')
  expect(textoDoContexto(260_000, REGUAS.orquestradora, 600_000, 0)).toBe('contexto 260/600 mil · limpar')
  expect(textoDoContexto(360_000, REGUAS.P, 600_000, 0)).toBe('contexto 360/600 mil · alto')
  expect(textoDoContexto(510_000, REGUAS.P, 600_000, 0)).toBe('contexto 510/600 mil · limpar')
  expect(textoDoContexto(312_000, REGUAS.E, 600_000, 0)).toBe('contexto 312/600 mil · limpar')
  expect(textoDoContexto(500_000, REGUAS.V, 600_000, 0), 'a V também ganha o limpar aos 500 mil').toBe('contexto 500/600 mil · limpar')
  expect(textoDoContexto(260_000, REGUAS.orquestradora, 600_000, 1)).toBe('260/600 mil · limpar')
  expect(textoDoContexto(260_000, REGUAS.orquestradora, 600_000, 2)).toBe('260 mil · limpar')
  expect(textoDoContexto(142_000, null, 600_000, 0), 'papel desconhecido: com a janela, sem palavra').toBe('contexto 142/600 mil')
  expect(textoDoContexto(198_000, REGUAS.orquestradora, null, 0), 'sem janela, sem /').toBe('contexto 198 mil')
  expect(textoDoContexto(510_000, REGUAS.P, null, 0)).toBe('contexto 510 mil · limpar')
  expect(textoDoContexto(198_000, REGUAS.orquestradora, null, 1)).toBe('198 mil')
  // a ausência mede: o mesmo estado, só a janela muda, e o `/` aparece
  expect(textoDoContexto(198_000, REGUAS.orquestradora, 600_000, 0)).toContain('/')
  expect(textoDoContexto(198_000, REGUAS.orquestradora, null, 0)).not.toContain('/')
})

test('janelaDeCompactacao: env, depois autoCompactWindow do settings, depois a janela do modelo; o modelo limita', () => {
  const j = (env: string | undefined, settings: string | null, modelo: number | null | undefined = 1_000_000) => janelaDeCompactacao({ env, settings, modelo })
  const doSettings = '{"autoCompactWindow": 600000}'
  expect(doSettings, 'o insumo existe').toContain('600000')
  expect(j(undefined, doSettings)).toBe(600_000)
  expect(j('500000', doSettings), 'a env vence o settings').toBe(500_000)
  for (const ruim of ['x', '0', '-5', '1.5', '']) expect(j(ruim, doSettings), `env inválida (${ruim}) cai para o settings`).toBe(600_000)
  for (const ruim of ['{"autoCompactWindow": "x"}', '{"autoCompactWindow": 0}', '{"autoCompactWindow": -1}', '{"autoCompactWindow": 1.5}', '{"autoCompactWindow": "600000"}', '{"outra": 1}', '{não é json', '[]', 'null', '']) {
    expect(j(undefined, ruim), `settings inválido (${ruim}) cai para o modelo`).toBe(1_000_000)
  }
  expect(j(undefined, null), 'sem settings').toBe(1_000_000)
  expect(j(undefined, '{"autoCompactWindow": 2000000}'), 'maior que a janela do modelo: vale a do modelo').toBe(1_000_000)
  expect(j('2000000', null)).toBe(1_000_000)
  expect(j(undefined, doSettings, null), 'sem janela do modelo, vale o settings').toBe(600_000)
  expect(j(undefined, doSettings, undefined)).toBe(600_000)
  expect(j(undefined, null, null), 'nada disponível').toBeNull()
  expect(j(undefined, null, 0), 'janela do modelo inválida').toBeNull()
  expect(j('x', 'lixo', null)).toBeNull()
})

// ---- o mod, pelo motor ----

type Opcoes = {
  perguntas?: Doc[]
  fila?: Doc[]
  sessoes?: Doc[]
  tokens?: number | null
  cwd?: string
  titulo?: string | null
  bandeira?: string
  semUsage?: boolean
  fillRecusa?: boolean
  envioFalha?: string
  notificacaoFalha?: boolean
  painelAbertoNoInicio?: boolean
  /** O teste registra command.register e tool.register por conta própria. */
  semRegistros?: boolean
  /** O texto de `~/.claude/settings.json`; `null` = o arquivo não existe. Padrão: o do operador, `autoCompactWindow` 600 000. */
  settings?: string | null
  /** Variáveis de ambiente a mais (ex.: `CLAUDE_CODE_AUTO_COMPACT_WINDOW`). */
  env?: Record<string, string>
  /** O `context.window` do `usage()`; `null` = o motor não informa. Padrão: 1 000 000 (a janela do modelo). */
  janelaDoModelo?: number | null
}

function engine(on: On, opc: Opcoes = {}) {
  if (!opc.semRegistros) {
    on('command.register', () => ({ value: { command: 'x' } }))
    on('tool.register', () => ({ value: { tool: 'x' } }))
  }
  let aberto = opc.painelAbertoNoInicio ?? false
  const aberturas: number[] = []
  on('ui.open', () => {
    aberto = true
    aberturas.push(1)
    return { value: { isPlaced: true } }
  })
  on('ui.panes', () => ({ value: aberto ? [{ id: 'painel-sessoes', title: 'Sessões', isShown: true, isFocused: false, isPlaced: true }] : [] }))
  on('ui.close', () => {
    aberto = false
    return { value: undefined }
  })
  const toasts: string[] = []
  on('ui.toast', (_, e) => {
    toasts.push(String((e as unknown as { message?: string; text?: string }).message ?? (e as unknown as { text?: string }).text))
    return { value: undefined }
  })
  const relogioDeTeste = mock.clock(on, { now: AGORA })
  mock.env(on, { HOME, CLAUDE_CODE_HOST_SESSION_ID: EU, CLAUDE_CODE_ACCOUNT_UUID: 'conta', CLAUDE_CODE_ORGANIZATION_UUID: 'org', ...opc.env })
  mock.store(on)
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('session.cwd', () => ({ value: opc.cwd ?? '/work/kit' }))
  on('session.usage', () => {
    if (opc.semUsage) throw new Error('sem usage')
    return { value: { startedAt: 0, context: { tokens: opc.tokens === undefined ? 142_000 : (opc.tokens ?? undefined), window: opc.janelaDoModelo === null ? undefined : (opc.janelaDoModelo ?? 1_000_000) }, rateLimits: [] } }
  })
  const arquivos = new Map<string, string>()
  for (const d of opc.perguntas ?? []) arquivos.set(`${PASTA}/perguntas/${d.id}.json`, JSON.stringify(d))
  for (const d of opc.fila ?? []) arquivos.set(`${PASTA}/fila/${d.id}.json`, JSON.stringify(d))
  for (const d of opc.sessoes ?? [sessaoOrq()]) arquivos.set(`${PASTA}/sessoes/${d.id}.json`, JSON.stringify(d))
  arquivos.set(`${PASTA}/temas.json`, JSON.stringify([{ id: 'geral', rotulo: 'Geral' }]))
  if (opc.bandeira !== undefined) arquivos.set(BANDEIRA, opc.bandeira)
  if (opc.settings !== null) arquivos.set(SETTINGS, opc.settings ?? '{"autoCompactWindow": 600000}')
  if (opc.titulo !== null) arquivos.set(REGISTRO_DO_APP, JSON.stringify({ title: opc.titulo ?? '🎛 orquestradora — kit' }))
  const escritas: Array<{ path: string; data: Record<string, unknown>; texto: string }> = []
  const bandeiras: Array<Record<string, unknown>> = []
  on('fs.list', (_, e) => {
    const prefixo = `${e.path}/`
    return { value: [...arquivos.keys()].filter(k => k.startsWith(prefixo) && !k.slice(prefixo.length).includes('/')).map(k => ({ name: k.slice(prefixo.length), kind: 'file' as const, size: 1, mtimeMs: 0, isLink: false })) }
  })
  on('fs.read', (_, e) => {
    const t = arquivos.get(e.path)
    if (t === undefined) throw new Error(`ENOENT ${e.path}`)
    return { value: t }
  })
  on('fs.write', (_, e) => {
    arquivos.set(e.path, e.text)
    if (e.path === BANDEIRA) bandeiras.push(JSON.parse(e.text) as Record<string, unknown>)
    else escritas.push({ path: e.path, data: (JSON.parse(e.text) as Doc).data, texto: e.text })
    return { value: undefined }
  })
  const fills: string[] = []
  on('prompt.fill', (_, e) => {
    if (opc.fillRecusa) return { isFilled: false }
    fills.push(e.text)
    return { isFilled: true }
  })
  const prompts: string[] = []
  on('prompt.submit', (_, e) => {
    prompts.push(e.text)
    return { text: e.text }
  })
  const chamadas: string[] = []
  const enviadas: Array<Record<string, unknown>> = []
  const notificacoes: string[] = []
  on('tool.call', (_, e) => {
    chamadas.push(e.tool)
    const entrada = e as unknown as Record<string, unknown>
    if (e.tool === 'mcp__ccd_session_mgmt__send_message') {
      if (opc.envioFalha) return { result: {}, text: opc.envioFalha, isError: true }
      enviadas.push(entrada)
      return { result: {}, text: 'sent' }
    }
    if (e.tool === 'PushNotification') {
      if (opc.notificacaoFalha) return { result: {}, text: 'não entregue', isError: true }
      notificacoes.push(String(entrada.message))
      return { result: {}, text: 'ok' }
    }
    if (e.tool === 'mcp__ccd_session_mgmt__get_session') return { result: {}, text: JSON.stringify({ sessionId: EU, title: 'eu', isRunning: true }) }
    return { result: {}, text: '[]' }
  })

  return { relogio: relogioDeTeste, escritas, bandeiras, fills, prompts, toasts, chamadas, enviadas, notificacoes, arquivos, aberturas, painelAberto: () => aberto }
}

const BARRA = {
  plugin: 'painel-sessoes',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 114, scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

type Montada = Awaited<ReturnType<TestBody extends (...a: infer _A) => unknown ? never : never>>
const SUPERFICIES = ['terminal', 'desktop'] as const

async function iniciar($: Parameters<TestBody>[0], on: On, opc: Opcoes = {}) {
  const motor = engine(on, opc)
  await $.session.start({ cwd: '/work/kit', surface: 'desktop', isInteractive: true })
  await motor.relogio.settle()
  return motor
}

type PropsDaBarra = { hasSurvey: boolean; isWorking: boolean; maxRows: number; bodyColumns: number; scroll: { offset: number; bodyRows: number }; view: Record<string, never> }
const montar = async ($: Parameters<TestBody>[0], surface: (typeof SUPERFICIES)[number], props: Partial<PropsDaBarra> = {}) =>
  $.ui.mount({ ...BARRA, surface, props: { ...BARRA.props, ...props } })

const lido = async (ui: { findAll: (q: object) => Promise<Array<{ text: string; props: Record<string, unknown> }>> }) => (await ui.findAll({})).map(el => `${el.text} ${typeof el.props.alt === 'string' ? el.props.alt : ''}`).join('\n')
const turnoCompleto = (extra: Record<string, unknown> = {}) => ({ answer: 'ok', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer', ...extra }) as never
void ({} as Montada)

test('cache: sem resposta o relógio é —; depois de um turno sem agentId, 60:00; com agentId não reinicia', async ($, on) => {
  const m = await iniciar($, on)
  for (const surface of SUPERFICIES) {
    const ui = await montar($, surface)
    expect(await lido(ui)).toMatch(/⧗ —/)
    await ui.unmount()
  }
  await $.turn.complete(turnoCompleto({ agentId: 'sub' }))
  await m.relogio.settle()
  const ui = await montar($, 'terminal')
  expect(await lido(ui), 'turno de subagente não reinicia').toMatch(/⧗ —/)
  await ui.unmount()
  await $.turn.complete(turnoCompleto())
  await m.relogio.settle()
  for (const surface of SUPERFICIES) {
    const u = await montar($, surface)
    expect(await lido(u)).toMatch(/⧗ 60:00/)
    await u.unmount()
  }
  await m.relogio.advance(61_000)
  const u2 = await montar($, 'terminal')
  expect(await lido(u2)).toMatch(/⧗ 58:59/)
  await u2.unmount()
})

test('hasSurvey e /barra entregam a faixa ao motor', async ($, on) => {
  on('ui.render', ($e, e) => {
    const { Text } = $e.ui.resolve(e)
    return <Text>do-motor</Text>
  })
  await iniciar($, on)
  const surv = await montar($, 'terminal', { hasSurvey: true })
  expect(await lido(surv)).toMatch(/do-motor/)
  await surv.unmount()
  const r1 = await $.command.run({ command: 'barra', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } })
  expect(r1.text).toBe('Barra de status escondida.')
  const ui = await montar($, 'terminal')
  expect(await lido(ui)).toMatch(/do-motor/)
  await ui.unmount()
  const r2 = await $.command.run({ command: 'barra', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } })
  expect(r2.text).toBe('Barra de status à mostra.')
  const ui2 = await montar($, 'terminal')
  expect(await lido(ui2)).toMatch(/⧗/)
  await ui2.unmount()
})

const abertas = (n: number) => Array.from({ length: n }, (_, i) => doc(`Q${i + 1}`, { projeto: 'kit', titulo: `p${i}`, estado: 'aberta', sessaoId: 'local_x' }))

test('selo: 3 abertas → diz 3 e abre o painel; com zero some; aberto o clique não fecha', async ($, on) => {
  const m = await iniciar($, on, { perguntas: abertas(3) })
  for (const surface of SUPERFICIES) {
    const ui = await montar($, surface)
    expect((await ui.find({ key: 'perguntas' }))?.text).toMatch(/3 perguntas/)
    await ui.unmount()
  }
  const ui = await montar($, 'terminal')
  await ui.press({ key: 'perguntas' })
  await m.relogio.settle()
  expect(m.aberturas.length, 'abriu o painel').toBe(1)
  expect(m.painelAberto()).toBe(true)
  const ui2 = await montar($, 'terminal')
  await ui2.press({ key: 'perguntas' })
  await m.relogio.settle()
  expect(m.painelAberto(), 'aberto, o selo não fecha').toBe(true)
  expect(m.aberturas.length).toBe(1)
  await ui.unmount()
  await ui2.unmount()
})

test('sem perguntas abertas o selo some', async ($, on) => {
  await iniciar($, on, { perguntas: [] })
  const ui = await montar($, 'terminal')
  expect(await ui.find({ key: 'perguntas' })).toBeUndefined()
  await ui.unmount()
})

test('botão do painel: aberto fecha, fechado abre', async ($, on) => {
  const m = await iniciar($, on)
  const ui = await montar($, 'terminal')
  expect((await ui.find({ key: 'painel' }))?.text).toBe('Abrir painel')
  await ui.press({ key: 'painel' })
  await m.relogio.settle()
  expect(m.painelAberto()).toBe(true)
  const ui2 = await montar($, 'terminal')
  expect((await ui2.find({ key: 'painel' }))?.text).toBe('Fechar painel')
  await ui2.press({ key: 'painel' })
  await m.relogio.settle()
  expect(m.painelAberto()).toBe(false)
  await ui.unmount()
  await ui2.unmount()
})

test('ordem: à esquerda relógio e contexto; à direita selo, modo e painel', async ($, on) => {
  await iniciar($, on, { perguntas: abertas(3) })
  const ui = await montar($, 'terminal')
  const botoes = (await ui.findAll({ type: 'Button' })).map(b => b.props.key)
  expect(botoes).toEqual(['perguntas', 'modo', 'painel'])
  const texto = await lido(ui)
  expect(texto.indexOf('⧗'), 'relógio antes do contexto').toBeLessThan(texto.indexOf('contexto'))
  const selo = (await ui.findAll({ type: 'Button' })).find(b => b.props.key === 'perguntas')
  // O Button do motor tem uma string só, o rótulo: ele é também o nome acessível.
  expect(selo?.text).toBe('● 3 perguntas')
  await ui.unmount()
})

const textosDe = async (ui: Awaited<ReturnType<typeof montar>>) => (await ui.findAll({ type: 'Text' })).map(t => t.text)

test('contexto contra a janela do settings: a orquestradora a 198 mil mostra 198/600 mil, sem palavra, nas duas superfícies', async ($, on) => {
  const m = await iniciar($, on, { tokens: 198_000 })
  expect(m.arquivos.get(SETTINGS), 'o fixture devolve o settings').toContain('"autoCompactWindow": 600000')
  for (const surface of SUPERFICIES) {
    const ui = await montar($, surface)
    const t = await lido(ui)
    expect(t).toMatch(/contexto 198\/600 mil/)
    expect(t).not.toMatch(/limpar|alto/)
    await ui.unmount()
  }
})

test('contexto no limpar: só a palavra leva cor (error e negrito), o número fica apagado', async ($, on) => {
  await iniciar($, on, { tokens: 260_000 })
  const ui = await montar($, 'terminal')
  expect(await lido(ui)).toMatch(/contexto 260\/600 mil · limpar/)
  const textos = await ui.findAll({ type: 'Text' })
  const palavra = textos.find(t => t.text === ' · limpar')
  const numero = textos.find(t => t.text === 'contexto 260/600 mil')
  expect(palavra, 'a palavra é um Text à parte').toBeTruthy()
  expect(palavra?.props.color).toBe('error')
  expect(palavra?.props.bold).toBe(true)
  expect(numero, 'o número é um Text à parte').toBeTruthy()
  expect(numero?.props.dimColor).toBe(true)
  expect(numero?.props.color).toBeUndefined()
  await ui.unmount()
})

test('contexto no alto: P a 360 mil → · alto, warning só na palavra; E a 300 mil → direto ao · limpar', async ($, on) => {
  await iniciar($, on, { titulo: 'P1 · x', tokens: 360_000 })
  const p = await montar($, 'terminal')
  expect(await lido(p)).toMatch(/contexto 360\/600 mil · alto/)
  const alto = (await p.findAll({ type: 'Text' })).find(t => t.text === ' · alto')
  expect(alto?.props.color).toBe('warning')
  expect((await p.findAll({ type: 'Text' })).find(t => t.text === 'contexto 360/600 mil')?.props.dimColor).toBe(true)
  await p.unmount()
})

test('contexto da E no teto: 300/600 mil · limpar', async ($, on) => {
  await iniciar($, on, { titulo: 'E2 · x', tokens: 300_000 })
  const ui = await montar($, 'terminal')
  expect(await lido(ui)).toMatch(/300\/600 mil · limpar/)
  expect(await lido(ui)).not.toMatch(/teto/)
  await ui.unmount()
})

test('janela: a env CLAUDE_CODE_AUTO_COMPACT_WINDOW vence o settings', async ($, on) => {
  await iniciar($, on, { tokens: 198_000, env: { CLAUDE_CODE_AUTO_COMPACT_WINDOW: '500000' } })
  expect(await lido(await montar($, 'terminal'))).toMatch(/198\/500 mil/)
})

test('janela: env inválida cai para o settings', async ($, on) => {
  await iniciar($, on, { tokens: 198_000, env: { CLAUDE_CODE_AUTO_COMPACT_WINDOW: 'x' } })
  expect(await lido(await montar($, 'terminal'))).toMatch(/198\/600 mil/)
})

test('janela: settings ausente → context.window do motor', async ($, on) => {
  const m = await iniciar($, on, { tokens: 198_000, settings: null })
  expect(m.arquivos.has(SETTINGS), 'o settings não existe').toBe(false)
  const ui = await montar($, 'terminal')
  expect(await lido(ui)).toMatch(/198\/1000 mil/)
  await ui.unmount()
})

for (const [nome, settings] of [
  ['texto', '{"autoCompactWindow": "x"}'],
  ['zero', '{"autoCompactWindow": 0}'],
  ['JSON quebrado', '{não é json'],
] as const) {
  test(`janela: settings inválido (${nome}) → context.window do motor`, async ($, on) => {
    await iniciar($, on, { tokens: 198_000, settings })
    const ui = await montar($, 'terminal')
    expect(await lido(ui)).toMatch(/198\/1000 mil/)
    await ui.unmount()
  })
}

test('janela: autoCompactWindow maior que a janela do modelo → vale a do modelo', async ($, on) => {
  await iniciar($, on, { tokens: 198_000, settings: '{"autoCompactWindow": 2000000}', janelaDoModelo: 800_000 })
  const ui = await montar($, 'terminal')
  expect(await lido(ui)).toMatch(/198\/800 mil/)
  await ui.unmount()
})

test('janela: nada disponível → sem o / (o mesmo estado com settings mostra /600, no primeiro teste da janela)', async ($, on) => {
  await iniciar($, on, { tokens: 198_000, settings: null, janelaDoModelo: null })
  const sem = await montar($, 'terminal')
  const t = await lido(sem)
  expect(t, 'a barra desenhou o contexto').toMatch(/contexto 198 mil/)
  expect(t).not.toMatch(/198\//)
  await sem.unmount()
})

test('contexto de papel desconhecido: com a janela e sem palavra', async ($, on) => {
  await iniciar($, on, { titulo: 'qualquer', tokens: 142_000 })
  const ui = await montar($, 'terminal')
  const t = await lido(ui)
  expect(t).toMatch(/contexto 142\/600 mil/)
  expect(t).not.toMatch(/limpar|alto/)
  await ui.unmount()
})

test('pedido de limpeza: o botão aparece em toda sessão do projeto, e o clique grava a prova do painel sem o pane nunca aberto', async ($, on) => {
  const m = await iniciar($, on, { titulo: 'P3 · barra', perguntas: [limpar('Q290', {}, 4)] })
  const ui = await montar($, 'terminal')
  const texto = await lido(ui)
  expect(texto).toMatch(/◆ pede limpeza/)
  expect(texto, 'o Q-ID não entra na barra').not.toMatch(/Q290/)
  const botao = await ui.find({ key: 'limpar-pedido' })
  expect(botao?.text).toBe('Pode se limpar')
  expect(botao?.props.variant).toBe('primary')
  expect((await ui.findAll({ type: 'Button' })).filter(b => b.props.variant === 'primary').length, 'o único primário').toBe(1)
  await ui.press({ key: 'limpar-pedido' })
  await m.relogio.settle()
  const gravada = m.escritas.find(e => e.path.endsWith('Q290.json'))
  expect(gravada, 'gravou a pergunta').toBeTruthy()
  expect(gravada?.data.estado).toBe('respondida')
  expect(gravada?.data.resposta).toBe(RESPOSTA)
  expect(gravada?.data.respondidaPor).toBe('painel')
  expect(typeof gravada?.data.respondidaEm).toBe('string')
  expect(gravada?.data.respondidaEm).toBe(gravada?.data.atualizadoEm)
  expect(Number.isNaN(Date.parse(String(gravada?.data.respondidaEm)))).toBe(false)
  expect(m.enviadas.length).toBe(1)
  expect(m.enviadas[0]?.session_id).toBe(ORQ)
  await ui.unmount()
})

test('pedido de limpeza: o ok enviado troca o botão por ✓ e o clique repetido grava uma vez', async ($, on) => {
  const m = await iniciar($, on, { titulo: 'P3 · barra', perguntas: [limpar('Q290')] })
  const ui = await montar($, 'terminal')
  await Promise.all([ui.press({ key: 'limpar-pedido' }), ui.press({ key: 'limpar-pedido' })])
  await m.relogio.settle()
  expect(m.escritas.filter(e => e.path.endsWith('Q290.json')).length).toBe(1)
  const u2 = await montar($, 'terminal')
  expect(await lido(u2)).toMatch(/✓ ok enviado/)
  expect(await u2.find({ key: 'limpar-pedido' })).toBeUndefined()
  await ui.unmount()
  await u2.unmount()
})

test('pedido de limpeza: pergunta apagada antes do clique dá toast e não grava nada', async ($, on) => {
  const m = await iniciar($, on, { titulo: 'P3 · barra', perguntas: [limpar('Q290', {}, 4)] })
  m.arquivos.delete(`${PASTA}/perguntas/Q290.json`)
  const ui = await montar($, 'terminal')
  await ui.press({ key: 'limpar-pedido' })
  await m.relogio.settle()
  expect(m.toasts.at(-1)).toMatch(/Não consegui mandar o ok de limpar \(/)
  expect(m.escritas.filter(e => e.path.endsWith('Q290.json')), 'nada gravado').toEqual([])
  await ui.unmount()
})

test('pedido de limpeza: versão mudada entre a leitura e o clique dá toast, não grava e o botão volta', async ($, on) => {
  const m = await iniciar($, on, { titulo: 'P3 · barra', perguntas: [limpar('Q290', {}, 4)] })
  const ui = await montar($, 'terminal')
  expect((await ui.find({ key: 'limpar-pedido' }))?.text, 'o botão existe antes do clique').toBe('Pode se limpar')
  m.arquivos.set(`${PASTA}/perguntas/Q290.json`, JSON.stringify(limpar('Q290', {}, 5)))
  await ui.press({ key: 'limpar-pedido' })
  await m.relogio.settle()
  expect(m.toasts.at(-1)).toMatch(/Não consegui mandar o ok de limpar \(/)
  expect(m.escritas.filter(e => e.path.endsWith('Q290.json')), 'nada gravado').toEqual([])
  expect(m.enviadas).toEqual([])
  expect((await ui.find({ key: 'limpar-pedido' }))?.text, 'o botão volta na mesma montagem').toBe('Pode se limpar')
  const u2 = await montar($, 'terminal')
  expect((await u2.find({ key: 'limpar-pedido' }))?.text, 'e numa montagem nova').toBe('Pode se limpar')
  expect(await lido(ui)).not.toMatch(/✓ ok enviado/)
  expect(await lido(u2)).not.toMatch(/✓ ok enviado/)
  await ui.unmount()
  await u2.unmount()
})

test('pedido de limpeza: não há linha acima; a barra tem uma linha principal com o botão do pedido, em 94, 114 e 140 colunas, no terminal e no desktop', async ($, on) => {
  await iniciar($, on, { titulo: 'P3 · barra', perguntas: [limpar('Q290')] })
  for (const surface of SUPERFICIES) {
    for (const bodyColumns of [94, 114, 140]) {
      const ui = await montar($, surface, { bodyColumns })
      const caixas = await ui.findAll({ type: 'Box' })
      const rotulo = `${surface} ${bodyColumns}`
      expect(caixas.length, `${rotulo}: a barra desenhou caixas`).toBeGreaterThan(0)
      expect(caixas.some(b => b.props.key === 'linha-do-pedido'), `${rotulo}: não há Box linha-do-pedido`).toBe(false)
      expect(caixas.filter(b => b.props.flexDirection === 'column').length, `${rotulo}: só a coluna da moldura`).toBe(1)
      expect(caixas.filter(b => b.props.flexDirection === 'row' && b.props.flexWrap === 'wrap').length, `${rotulo}: uma linha principal`).toBe(1)
      const botao = await ui.find({ key: 'limpar-pedido' })
      expect(botao?.text, `${rotulo}: o botão do pedido`).toBe('Pode se limpar')
      const t = await lido(ui)
      expect(t.indexOf('⧗'), `${rotulo}: relógio antes da frase`).toBeLessThan(t.indexOf('◆'))
      expect(t).toMatch(bodyColumns >= 140 ? /◆ orquestradora pede limpeza/ : /◆ pede limpeza/)
      expect(t, `${rotulo}: sem Q-ID`).not.toMatch(/Q290/)
      expect((await ui.findAll({ type: 'Button' })).map(b => b.props.key)[0], `${rotulo}: o pedido abre o grupo da direita`).toBe('limpar-pedido')
      await ui.unmount()
    }
  }
})

test('pedido de limpeza: item e pool caem enquanto ele está aberto; o Ficar ausente cai já a 114', async ($, on) => {
  await iniciar($, on, {
    titulo: 'E1 · x',
    perguntas: [limpar('Q290')],
    fila: [item('F1', { donoLocalId: EU, com: [{ localId: EU, apelido: 'E1' }, { localId: 'b', apelido: 'V1' }] })],
  })
  const ui = await montar($, 'terminal', { bodyColumns: 140 })
  const t = await lido(ui)
  expect(t, 'sem o pedido item e pool existiriam: o item é F1').not.toMatch(/F1 ·/)
  expect(t).not.toMatch(/E 1 · V 1/)
  await ui.unmount()
  const m = await montar($, 'terminal', { bodyColumns: 114 })
  expect((await m.findAll({ type: 'Button' })).map(b => b.props.key)).toEqual(['limpar-pedido', 'perguntas', 'painel'])
  await m.unmount()
})

test('pedido de limpeza: o item e o pool voltam sem o pedido (a ausência acima mede)', async ($, on) => {
  await iniciar($, on, {
    titulo: 'E1 · x',
    fila: [item('F1', { donoLocalId: EU, com: [{ localId: EU, apelido: 'E1' }, { localId: 'b', apelido: 'V1' }] })],
  })
  const ui = await montar($, 'terminal', { bodyColumns: 140 })
  const t = await lido(ui)
  expect(t).toMatch(/F1 ·/)
  expect(t).toMatch(/E 1 · V 1/)
  await ui.unmount()
})

test('limpar antes de vencer: sem pedido aberto o clique põe o rascunho e nunca chama clear_session', async ($, on) => {
  const m = await iniciar($, on, { tokens: 212_000 })
  await $.turn.complete(turnoCompleto())
  await m.relogio.advance((3600 - 480) * 1000)
  const ui = await montar($, 'terminal')
  const texto = await lido(ui)
  expect(texto, 'a barra desenhou o contexto').toMatch(/contexto 212\/600 mil/)
  expect(texto, 'o limpar antes é só o botão, sem frase').not.toMatch(/◆|Cache vence/)
  const botao = await ui.find({ key: 'limpar-antes' })
  expect(botao?.text).toBe('Limpar antes de vencer')
  expect(botao?.props.variant).toBe('secondary')
  await ui.press({ key: 'limpar-antes' })
  await m.relogio.settle()
  expect(m.fills).toEqual(['Pode se limpar agora, antes do cache vencer.'])
  expect(m.toasts.at(-1)).toBe('Rascunho na caixa do prompt: aperte Enter para mandar.')
  expect(m.escritas.filter(e => e.path.includes('/perguntas/'))).toEqual([])
  expect(m.chamadas.includes('mcp__ccd_session_mgmt__clear_session')).toBe(false)
  await ui.unmount()
})

test('limpar antes de vencer: caixa recusa o rascunho → toast que não deu; com pedido aberto vale só o pedido', async ($, on) => {
  const m = await iniciar($, on, { tokens: 212_000, fillRecusa: true })
  await $.turn.complete(turnoCompleto())
  await m.relogio.advance((3600 - 480) * 1000)
  const ui = await montar($, 'terminal')
  await ui.press({ key: 'limpar-antes' })
  await m.relogio.settle()
  expect(m.toasts.at(-1)).toMatch(/Não deu para pôr o rascunho/)
  await ui.unmount()
})

test('orquestradora com pedido aberto e cache a 8 min: uma linha, a do pedido, com a key limpar-pedido', async ($, on) => {
  const m = await iniciar($, on, { tokens: 212_000, perguntas: [limpar('Q290')] })
  await $.turn.complete(turnoCompleto())
  await m.relogio.advance((3600 - 480) * 1000)
  const ui = await montar($, 'terminal')
  expect(await ui.find({ key: 'limpar-antes' })).toBeUndefined()
  expect((await ui.findAll({ type: 'Button' })).filter(b => String(b.props.key).startsWith('limpar')).map(b => b.props.key)).toEqual(['limpar-pedido'])
  await ui.unmount()
})

test('cache: 1201 s sem moldura; 1200 s aviso (round, warning, relógio bold sem cor); 600 s alerta (error, inverse); trabalhando sem borda', async ($, on) => {
  const m = await iniciar($, on)
  await $.turn.complete(turnoCompleto())
  await m.relogio.advance((3600 - 1201) * 1000)
  const sem = await montar($, 'terminal')
  expect((await sem.findAll({ type: 'Box' })).some(b => b.props.borderStyle)).toBe(false)
  await sem.unmount()
  await m.relogio.advance(1000)
  const aviso = await montar($, 'terminal')
  const caixas = await aviso.findAll({ type: 'Box' })
  const moldura = caixas.find(b => b.props.borderStyle)
  expect([moldura?.props.borderStyle, moldura?.props.borderColor]).toEqual(['round', 'warning'])
  const relogioAviso = (await aviso.findAll({ type: 'Text' })).find(t => t.text.includes('⧗'))
  expect(relogioAviso?.props.bold).toBe(true)
  expect(relogioAviso?.props.color).toBeUndefined()
  await aviso.unmount()
  await m.relogio.advance(600_000)
  const alerta = await montar($, 'terminal')
  const m2 = (await alerta.findAll({ type: 'Box' })).find(b => b.props.borderStyle)
  expect(m2?.props.borderColor).toBe('error')
  expect((await alerta.findAll({ type: 'Text' })).find(t => t.text.includes('⧗'))?.props.inverse).toBe(true)
  await alerta.unmount()
  const trab = await montar($, 'terminal', { isWorking: true })
  expect((await trab.findAll({ type: 'Box' })).some(b => b.props.borderStyle)).toBe(false)
  expect(await lido(trab)).toMatch(/⧗ ativo/)
  await trab.unmount()
})

test('aviso do cache: um aos 10 min e outro aos 5, parado; trabalhando nenhum', async ($, on) => {
  const m = await iniciar($, on)
  await $.turn.complete(turnoCompleto())
  await m.relogio.advance((3600 - 601) * 1000)
  expect(m.notificacoes).toEqual([])
  await m.relogio.advance(2000)
  expect(m.notificacoes.length).toBe(1)
  expect(m.notificacoes[0]).toMatch(/o cache vence em 10 min/)
  await m.relogio.advance(5000)
  expect(m.notificacoes.length, 'o tique seguinte não repete').toBe(1)
  await m.relogio.advance((600 - 299 - 7) * 1000 + 1000)
  expect(m.notificacoes.length).toBe(2)
  expect(m.notificacoes[1]).toMatch(/o cache vence em 5 min/)
})

test('aviso do cache com turno em curso: nenhum', async ($, on) => {
  const m = await iniciar($, on)
  await $.turn.complete(turnoCompleto())
  await $.turn.start({ text: 'x', turnId: 't2' })
  await m.relogio.advance((3600 - 590) * 1000)
  expect(m.notificacoes).toEqual([])
})

test('aviso do cache: notificação não entregue vira toast', async ($, on) => {
  const m = await iniciar($, on, { notificacaoFalha: true })
  await $.turn.complete(turnoCompleto())
  await m.relogio.advance((3600 - 590) * 1000)
  expect(m.toasts.some(t => /o cache vence em 10 min/.test(t))).toBe(true)
})

test('modo ausente com o pane nunca aberto: a barra lê e o botão grava a bandeira', async ($, on) => {
  const m = await iniciar($, on)
  const ui = await montar($, 'terminal')
  expect((await ui.find({ key: 'modo' }))?.text).toBe('Ficar ausente')
  await ui.press({ key: 'modo' })
  await m.relogio.settle()
  expect(m.bandeiras.length).toBe(1)
  expect(m.bandeiras[0]?.por).toBe('painel')
  expect(m.bandeiras[0]?.frase).toBe('botão do painel')
  const u2 = await montar($, 'terminal')
  expect((await u2.find({ key: 'modo' }))?.text).toBe('☾ Estou de volta')
  await ui.unmount()
  await u2.unmount()
})

test('clique na barra com o pane nunca aberto não dispara a leitura pesada (list_sessions/get_session)', async ($, on) => {
  const pesadas = (c: string[]) => c.filter(t => t.endsWith('__list_sessions') || t.endsWith('__get_session'))
  const m = await iniciar($, on, { titulo: 'P3 · barra', perguntas: [limpar('Q290', {}, 4)] })
  const ui = await montar($, 'terminal', { bodyColumns: 140 })
  expect(pesadas(m.chamadas), 'a leitura da barra não chama').toEqual([])
  await ui.press({ key: 'modo' })
  await m.relogio.settle()
  expect(m.bandeiras.length, 'o clique do modo gravou').toBe(1)
  await ui.press({ key: 'limpar-pedido' })
  await m.relogio.settle()
  expect(m.escritas.some(e => e.path.endsWith('Q290.json')), 'o clique do pedido gravou').toBe(true)
  expect(pesadas(m.chamadas), 'nenhuma leitura pesada depois dos cliques').toEqual([])
  await ui.unmount()
  // prova de que o detector enxerga: com o pane aberto a leitura pesada acontece
  await $.command.run({ command: 'painel', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } })
  await m.relogio.settle()
  expect(pesadas(m.chamadas).length, 'com o pane aberto o detector vê a chamada').toBeGreaterThan(0)
})

test('antes da primeira leitura só o relógio; sem a bandeira legível não há botão do modo', async ($, on) => {
  engine(on, { bandeira: '{não é json' })
  const antes = await montar($, 'terminal')
  expect(await antes.findAll({ type: 'Button' })).toEqual([])
  await antes.unmount()
  await $.session.start({ cwd: '/work/kit', surface: 'desktop', isInteractive: true })
  const ui = await montar($, 'terminal')
  expect(await ui.find({ key: 'modo' })).toBeUndefined()
  await ui.unmount()
})

test('pool: E n · V m na faixa larga', async ($, on) => {
  await iniciar($, on, {
    fila: [item('F1', { com: [{ localId: 'a', apelido: 'E1' }, { localId: 'b', apelido: 'V1' }] }), item('F2', { com: [{ localId: 'c', apelido: 'E2' }] })],
  })
  const ui = await montar($, 'terminal')
  expect(await lido(ui)).toMatch(/E 2 · V 1/)
  await ui.unmount()
})

test('o mod continua registrando só a ferramenta onde_esta_o_painel e os comandos painel e barra', async ($, on) => {
  const comandos: string[] = []
  const ferramentas: string[] = []
  on('command.register', (_, e) => {
    comandos.push(String((e as unknown as { name?: string }).name))
    return { value: { command: 'x' } }
  })
  on('tool.register', (_, e) => {
    ferramentas.push(String((e as unknown as { name?: string }).name))
    return { value: { tool: 'x' } }
  })
  engine(on, { semRegistros: true })
  await $.session.start({ cwd: '/work/kit', surface: 'desktop', isInteractive: true })
  expect(comandos.sort()).toEqual(['barra', 'painel'])
  expect(ferramentas).toEqual(['onde_esta_o_painel'])
})

// D10: o pedido no pane
const PANE = {
  plugin: 'painel-sessoes',
  component: 'Pane',
  requestId: 'painel-sessoes',
  props: { title: 'Sessões', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

test('pane: o pedido de limpeza vem na faixa do topo, com o botão que grava como o da barra; a pergunta segue em Esperam você', async ($, on) => {
  const m = await iniciar($, on, { titulo: 'P3 · barra', perguntas: [limpar('Q290', {}, 4)] })
  await $.command.run({ command: 'painel', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } })
  await m.relogio.settle()
  for (const surface of SUPERFICIES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const t = await lido(ui)
    expect(t).toMatch(/A orquestradora pede para se limpar/)
    expect(t).toMatch(/Esperam você/)
    const botao = await ui.find({ key: 'limpar-pedido' })
    expect(botao?.text).toBe('Pode se limpar')
    expect(botao?.props.variant).toBe('primary')
    await ui.unmount()
  }
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'limpar-pedido' })
  await m.relogio.settle()
  const gravada = m.escritas.find(e => e.path.endsWith('Q290.json'))
  expect(gravada?.data.respondidaPor).toBe('painel')
  expect(gravada?.data.resposta).toBe(RESPOSTA)
  await ui.unmount()
})

test('pane: o ok já dado esconde a linha mesmo com outra aberta da mesma orquestradora', async ($, on) => {
  const ok = limpar('Q290', { estado: 'respondida', resposta: RESPOSTA, respondidaPor: 'painel', respondidaEm: new Date(AGORA - 60_000).toISOString() })
  const m = await iniciar($, on, { titulo: 'P3 · barra', perguntas: [ok, limpar('Q291', {}, 2)] })
  await $.command.run({ command: 'painel', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } })
  await m.relogio.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await lido(ui)).not.toMatch(/pede para se limpar/)
  expect(await ui.find({ key: 'limpar-pedido' })).toBeUndefined()
  await ui.unmount()
})

test('barra e pane: o pedido aberto 2 min atrás volta mesmo com o sim de 5 min', async ($, on) => {
  const ok = limpar('Q290', { estado: 'respondida', resposta: RESPOSTA, respondidaPor: 'painel', respondidaEm: new Date(AGORA - 5 * 60_000).toISOString() })
  const novo = limpar('Q291', { atualizadoEm: new Date(AGORA - 2 * 60_000).toISOString() }, 2)
  const m = await iniciar($, on, { titulo: 'P3 · barra', perguntas: [ok, novo] })
  const ui = await montar($, 'terminal')
  expect(await lido(ui), 'a barra mostra o pedido novo').toMatch(/◆ pede limpeza/)
  expect((await ui.find({ key: 'limpar-pedido' }))?.text).toBe('Pode se limpar')
  await ui.unmount()
  await $.command.run({ command: 'painel', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } })
  await m.relogio.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await lido(pane), 'o pane também').toMatch(/A orquestradora pede para se limpar/)
  expect((await pane.find({ key: 'limpar-pedido' }))?.text).toBe('Pode se limpar')
  await pane.unmount()
})

test('pane: sem o pedido (ou só limpar · outra-coisa) a linha não aparece', async ($, on) => {
  const m = await iniciar($, on, { titulo: 'P3 · barra', perguntas: [limpar('Q290', { titulo: 'limpar · outra-coisa' })] })
  await $.command.run({ command: 'painel', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } })
  await m.relogio.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await lido(ui)).not.toMatch(/pede para se limpar/)
  expect(await ui.find({ key: 'limpar-pedido' })).toBeUndefined()
  await ui.unmount()
})
