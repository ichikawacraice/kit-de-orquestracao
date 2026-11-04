import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { TestBody } from 'claude-code/testing'
import {
  CACHE_TTL_MS,
  LEITURA_MS,
  GLIFO,
  LIMPANDO_ABAIXO_DE,
  ESPERA_DA_LIMPEZA_DIRETA_MS,
  PROMPT_DE_LIMPAR,
  PROMPT_DA_VOLTA,
  promptDaVolta,
  VOLTA_VALE_MS,
  ACORDAR_DEPOIS_DE_MS,
  PAINEL_NA_VOLTA_MS,
  paraAcordar,
  limpezaAconteceu,
  PALAVRA_ALTO,
  PALAVRA_LIMPAR,
  REGUAS,
  abertasDoProjeto,
  cacheFrio,
  contarDonas,
  corDoContexto,
  faixaDaBarra,
  janelaDeCompactacao,
  larguraDaFaixa,
  meuItem,
  limparEmDestaque,
  nivelDoCache,
  orquestradorasDoProjeto,
  papelEApelido,
  palavraDoContexto,
  pecasDaBarra,
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
const PASTA_DA_VOLTA = `${HOME}/.claude/orquestracao/volta-da-limpeza`
const VOLTA = `${PASTA_DA_VOLTA}/${EU}.json`
const REGISTRO_DO_APP = `${HOME}/Library/Application Support/Claude/claude-code-sessions/conta/org/${EU}.json`
const AGORA = Date.UTC(2026, 9, 26, 12)

// ---- funções puras ----

const sessaoOrq = (extra: Record<string, unknown> = {}) => doc(ORQ, { projeto: 'Kit', titulo: '🎛 orquestradora — kit', papel: 'orquestradora', ...extra })

test('reguaDoPapel: o teto sai do papel do título', () => {
  expect(REGUAS, 'as réguas existem').toBeTruthy()
  expect(reguaDoPapel('F12 · editor')?.teto, 'a sessão dona').toBe(REGUAS.dona.teto)
  expect(reguaDoPapel('🎛 orquestradora — kit')?.teto).toBe(REGUAS.orquestradora.teto)
  expect(reguaDoPapel('🎛 orquestradora — kit', true)?.teto, 'ausente: a orquestradora segue a régua da dona').toBe(REGUAS.dona.teto)
  expect(reguaDoPapel('qualquer coisa')).toBeNull()
  expect(reguaDoPapel(null)).toBeNull()
  expect(papelEApelido('F12 · editor')).toEqual({ papel: 'dona', apelido: 'F12' })
  expect(papelEApelido('E2 · x').papel, 'o título do pool antigo não diz papel').toBeNull()
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

test('abertasDoProjeto conta as abertas, todas', () => {
  const docs = [doc('Q1', { estado: 'aberta', titulo: 'x' }), doc('Q2', { estado: 'respondida', titulo: 'x' }), doc('Q3', { estado: 'aberta', titulo: 'x' })]
  expect(abertasDoProjeto(docs)).toBe(2)
})

const item = (id: string, data: Record<string, unknown>) => doc(id, { projeto: 'kit', titulo: id, etapa: 'execucao', ...data })

test('meuItem: o dono vence o com, e o feito é ignorado', () => {
  const docs = [
    item('F10', { com: [{ localId: EU, apelido: 'dona' }] }),
    item('F20', { donoLocalId: EU, donoApelido: 'dona' }),
    item('F30', { donoLocalId: EU, donoApelido: 'dona', etapa: 'feito' }),
  ]
  expect(meuItem(docs, EU)?.id).toBe('F20')
  expect(meuItem([docs[0]!, docs[2]!], EU)?.id, 'sem dono vivo, vale o com').toBe('F10')
  expect(meuItem([docs[2]!], EU)).toBeNull()
})

test('contarDonas: itens do projeto em etapa de trabalho com dona ou alguém no com', () => {
  const docs = [
    item('F1', { donoLocalId: 'a', donoApelido: 'dona' }),
    item('F2', { com: [{ localId: 'b', apelido: 'dona' }] }),
    item('F3', { projeto: 'outro', donoLocalId: 'c', donoApelido: 'dona' }),
    item('F4', { etapa: 'merge', donoLocalId: 'd', donoApelido: 'dona' }),
    item('F5', { etapa: 'feito', donoLocalId: 'e', donoApelido: 'dona' }),
    item('F6', {}),
  ]
  expect(contarDonas(docs, 'kit'), 'merge, feito, outro projeto e item sem ninguém não contam').toBe(2)
  expect(contarDonas(docs, 'outro')).toBe(1)
})

test('limparEmDestaque: exatamente quando o contexto mostra · limpar (a régua do papel)', () => {
  expect(limparEmDestaque(250_000, REGUAS.orquestradora)).toBe(true)
  expect(limparEmDestaque(249_999, REGUAS.orquestradora), 'a sessão nasce com ~90 mil: 150 mil já não acende (F219)').toBe(false)
  expect(limparEmDestaque(150_000, REGUAS.orquestradora)).toBe(false)
  expect(limparEmDestaque(null, REGUAS.orquestradora)).toBe(false)
  expect(limparEmDestaque(260_000, null), 'sem régua não há palavra').toBe(false)
  expect(limparEmDestaque(260_000, REGUAS.orquestradoraAusente), 'ausente: a régua da dona, a palavra e o botão juntos').toBe(false)
  expect(limparEmDestaque(500_000, REGUAS.orquestradoraAusente)).toBe(true)
  for (const t of [100_000, 150_000, 250_000, 300_000, 500_000]) {
    expect(limparEmDestaque(t, REGUAS.orquestradora), `${t}`).toBe(palavraDoContexto(t, REGUAS.orquestradora) === PALAVRA_LIMPAR)
  }
})

const REFERENCIA: EstadoBarra = {
  relogio: '47:12',
  bloco: false,
  tokens: 142_000,
  janela: 600_000,
  regua: { aviso: 200_000, teto: 300_000 },
  item: 'F52 · design',
  donas: 'donas 2',
  abertas: 3,
  modo: 'ausente',
  trocando: false,
  painelAberto: true,
  moldura: false,
  ehOrquestradora: false,
  limpando: false,
}

test('faixaDaBarra: a mais rica cuja soma cabe, com os textos reais', () => {
  const f = (cols: number, extra: Partial<EstadoBarra> = {}) => faixaDaBarra(cols, { ...REFERENCIA, ...extra })
  expect([f(114), f(113), f(96), f(95), f(40)]).toEqual([0, 1, 1, 2, 2])
  expect(f(114, { tokens: 250_000, regua: { aviso: 200_000, teto: 300_000 } }), 'palavra alto').toBe(1)
  expect(f(96, { tokens: 250_000 })).toBe(2)
  expect(f(114, { moldura: true })).toBe(1)
  expect(f(114, { abertas: 12 })).toBe(1)
})

test('faixaDaBarra: a palavra · limpar conta na soma (dona a 510 mil, 121 colunas)', () => {
  const p: EstadoBarra = { ...REFERENCIA, tokens: 510_000, regua: REGUAS.dona, modo: 'presente', painelAberto: false }
  expect(larguraDaFaixa(p, 0), 'a soma: 61 + 2 + 56 + 2 (a revisão do botão de limpar: +2 do ◨ e +2 do ☾)').toBe(121)
  expect([faixaDaBarra(121, p), faixaDaBarra(120, p)]).toEqual([0, 1])
})

test('faixaDaBarra: o relógio em bloco (alerta e venceu) soma as duas células do respiro', () => {
  const base = larguraDaFaixa(REFERENCIA, 0)
  expect(base, 'a referência soma 114').toBe(114)
  expect(larguraDaFaixa({ ...REFERENCIA, bloco: true }, 0)).toBe(base + 2)
  expect(faixaDaBarra(114, REFERENCIA)).toBe(0)
  expect(faixaDaBarra(114, { ...REFERENCIA, bloco: true }), 'com o bloco a faixa 0 já não cabe').toBe(1)
})

// A orquestradora da revisão: 298 mil (acima da régua de 250 mil; a largura é a dos 198 da revisão), sem item, 3 perguntas, presente, painel fechado.
const ORQ_BARRA: EstadoBarra = { ...REFERENCIA, tokens: 298_000, regua: REGUAS.orquestradora, item: null, abertas: 3, modo: 'presente', painelAberto: false, ehOrquestradora: true }

test('faixaDaBarra: o limpar entra na soma como ↺ Limpando… (a reserva): 123, 105 e 62, e +1 com Fechar painel', () => {
  expect([0, 1, 2].map(f => larguraDaFaixa(ORQ_BARRA, f as 0 | 1 | 2)), 'as somas da revisão').toEqual([123, 105, 62])
  expect([0, 1, 2].map(f => larguraDaFaixa({ ...ORQ_BARRA, painelAberto: true }, f as 0 | 1 | 2))).toEqual([124, 106, 62])
  const f = (cols: number, extra: Partial<EstadoBarra> = {}) => faixaDaBarra(cols, { ...ORQ_BARRA, ...extra })
  expect([f(123), f(122), f(105), f(104), f(62), f(40)]).toEqual([0, 1, 1, 2, 2, 2])
  expect(f(114), 'a 114 colunas a orquestradora cai na faixa 1, com os quatro botões').toBe(1)
  expect(pecasDaBarra(ORQ_BARRA, 1).dir.map(p => p.k)).toEqual(['perguntas', 'limpar', 'modo', 'painel'])
})

test('faixaDaBarra: Limpar, Limpar já e Limpando… somam o mesmo, e a faixa não muda debaixo do clique nem quando o cache esfria', () => {
  for (const faixa of [0, 1, 2] as const) {
    expect(larguraDaFaixa({ ...ORQ_BARRA, limpando: true }, faixa), `faixa ${faixa}`).toBe(larguraDaFaixa(ORQ_BARRA, faixa))
    expect(larguraDaFaixa({ ...ORQ_BARRA, limparDireto: true }, faixa), `faixa ${faixa} já`).toBe(larguraDaFaixa(ORQ_BARRA, faixa))
  }
  for (const cols of [125, 124, 105, 104, 62]) {
    expect(faixaDaBarra(cols, { ...ORQ_BARRA, limpando: true }), `${cols} colunas`).toBe(faixaDaBarra(cols, ORQ_BARRA))
    expect(faixaDaBarra(cols, { ...ORQ_BARRA, limparDireto: true }), `${cols} colunas direto`).toBe(faixaDaBarra(cols, ORQ_BARRA))
  }
})

test('pecasDaBarra: a ordem é selo → limpar → modo → painel; o limpar só na orquestradora e nunca cai', () => {
  const dir = (e: EstadoBarra, f: 0 | 1 | 2) => pecasDaBarra(e, f).dir.map(p => p.k)
  expect(dir(ORQ_BARRA, 0)).toEqual(['perguntas', 'limpar', 'modo', 'painel'])
  expect(dir(ORQ_BARRA, 2), 'faixa 2 presente: sem modo, e o painel cai com selo').toEqual(['perguntas', 'limpar'])
  expect(dir({ ...ORQ_BARRA, modo: 'ausente' }, 2), 'o ☾ Estou de volta nunca cai').toEqual(['perguntas', 'limpar', 'modo'])
  expect(dir({ ...ORQ_BARRA, abertas: 0 }, 2), 'sem selo o painel fica').toEqual(['limpar', 'painel'])
  expect(dir({ ...ORQ_BARRA, ehOrquestradora: false }, 0), 'em outra sessão não existe, nem apagado').toEqual(['perguntas', 'modo', 'painel'])
  expect(dir({ ...ORQ_BARRA, ehOrquestradora: false }, 2).includes('limpar')).toBe(false)
  const rotulos = pecasDaBarra({ ...ORQ_BARRA, modo: 'ausente', painelAberto: true }, 0).dir.map(p => p.t)
  expect(rotulos).toEqual(['● 3 perguntas', '↺ Limpar', '☾ Estou de volta', '◨ Fechar painel'])
  expect(pecasDaBarra({ ...ORQ_BARRA, limpando: true }, 0).dir.find(p => p.k === 'limpar')?.t).toBe('↺ Limpando…')
  expect(pecasDaBarra({ ...ORQ_BARRA, limparDireto: true }, 0).dir.find(p => p.k === 'limpar')?.t).toBe('↺ Limpar já')
  expect(pecasDaBarra({ ...ORQ_BARRA, limparDireto: true, limpando: true }, 0).dir.find(p => p.k === 'limpar')?.t, 'depois do clique vale o Limpando…').toBe('↺ Limpando…')
  expect(pecasDaBarra(ORQ_BARRA, 0).dir.find(p => p.k === 'modo')?.t).toBe('☾ Ficar ausente')
  expect(pecasDaBarra({ ...ORQ_BARRA, trocando: true }, 0).dir.find(p => p.k === 'modo')?.t).toBe('☾ Desligando…')
  expect(pecasDaBarra({ ...ORQ_BARRA, trocando: true, modo: 'ausente' }, 0).dir.find(p => p.k === 'modo')?.t).toBe('☾ Ligando…')
})

test('pecasDaBarra: sem pedido, item e donas voltam à esquerda em qualquer momento (o pedido de limpeza acabou)', () => {
  const completo = { ...ORQ_BARRA, item: 'F52 · design', donas: 'donas 2' }
  expect(pecasDaBarra(completo, 0).esq.map(p => p.k)).toEqual(['relogio', 'contexto', 'item', 'donas'])
  expect(pecasDaBarra(completo, 2).esq.map(p => p.k)).toEqual(['relogio', 'contexto'])
})

test('os glifos: cada botão tem o seu, o da barra e o da constante concordam, e as quatro formas diferem', () => {
  expect(GLIFO.limpar.g).toBe('↺')
  expect(GLIFO.modo.g).toBe('☾')
  expect(GLIFO.painel.g).toBe('◨')
  expect(GLIFO.perguntas.g).toBe('●')
  expect(new Set([GLIFO.limpar.g, GLIFO.modo.g, GLIFO.painel.g, GLIFO.perguntas.g]).size).toBe(4)
  const todas = pecasDaBarra({ ...ORQ_BARRA, modo: 'ausente' }, 0).dir
  expect(todas.length, 'os quatro botões').toBe(4)
  const g = (k: string) => todas.find(p => p.k === k)?.t[0]
  expect([g('perguntas'), g('limpar'), g('modo'), g('painel')]).toEqual([GLIFO.perguntas.g, GLIFO.limpar.g, GLIFO.modo.g, GLIFO.painel.g])
})

test('barra: o grupo da direita quebra a linha a 40 colunas', async ($, on) => {
  await iniciar($, on)
  const ui = await montar($, 'terminal', { bodyColumns: 40 })
  const direita = (await ui.findAll({ type: 'Box' })).filter(b => b.props.justifyContent === 'flex-end')
  expect(direita.length, 'o grupo da direita desenhou').toBe(1)
  expect(direita[0]?.props.flexWrap).toBe('wrap')
  await ui.unmount()
})

test('textoDoContexto: a janela é o denominador; a régua só dá a palavra', () => {
  expect(PALAVRA_ALTO).toBe(' · alto')
  expect(PALAVRA_LIMPAR).toBe(' · limpar')
  expect(textoDoContexto(98_000, REGUAS.orquestradora, 600_000, 0)).toBe('contexto 98/600 mil')
  expect(textoDoContexto(260_000, REGUAS.orquestradora, 600_000, 0)).toBe('contexto 260/600 mil · limpar')
  expect(textoDoContexto(360_000, REGUAS.dona, 600_000, 0)).toBe('contexto 360/600 mil · alto')
  expect(textoDoContexto(510_000, REGUAS.dona, 600_000, 0)).toBe('contexto 510/600 mil · limpar')
  expect(textoDoContexto(260_000, REGUAS.orquestradora, 600_000, 1)).toBe('260/600 mil · limpar')
  expect(textoDoContexto(260_000, REGUAS.orquestradora, 600_000, 2)).toBe('260 mil · limpar')
  expect(textoDoContexto(142_000, null, 600_000, 0), 'papel desconhecido: com a janela, sem palavra').toBe('contexto 142/600 mil')
  expect(textoDoContexto(98_000, REGUAS.orquestradora, null, 0), 'sem janela, sem /').toBe('contexto 98 mil')
  expect(textoDoContexto(510_000, REGUAS.dona, null, 0)).toBe('contexto 510 mil · limpar')
  expect(textoDoContexto(98_000, REGUAS.orquestradora, null, 1)).toBe('98 mil')
  // a ausência mede: o mesmo estado, só a janela muda, e o `/` aparece
  expect(textoDoContexto(98_000, REGUAS.orquestradora, 600_000, 0)).toContain('/')
  expect(textoDoContexto(98_000, REGUAS.orquestradora, null, 0)).not.toContain('/')
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
  /** O `prompt.submit` devolve este `drop` (o app recusou o prompt). */
  submitDrop?: string
  /** O `fs.write` da pasta `limpeza/` falha com este motivo. */
  limpezaFalha?: string
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
  /** A resposta do `clear_session`: aceito (padrão), recusado pelo app (`isError` com o texto) ou negado por hook (`deny`). */
  limpezaDireta?: { erro: string } | { deny: string }
  /** Roda dentro do `fs.write` do ok do botão (ex.: um turno que começa entre o clique e a limpeza direta). */
  aoGravarOk?: ($: Parameters<TestBody>[0]) => Promise<unknown>
  /** O texto da marca de volta da limpeza (`volta-da-limpeza/<local_…>.json`), que a T7 grava ao liberar a limpeza. */
  volta?: string
  /** Marcas de volta a mais, por nome de arquivo (ex.: a de outra sessão, ou a `.acordada.json`). */
  voltas?: Record<string, string>
  /** O que o `get_session` de outra sessão devolve (padrão: parada, não arquivada). */
  alvo?: { isRunning?: boolean; isArchived?: boolean; starting?: boolean }
  /** O `mv` que toma a marca falha (outro mod a tomou antes). */
  mvFalha?: boolean
  /** O registro do app da outra sessão (`local_orq`); `null` = sem arquivo. Padrão: limpa e sem processo novo (sem `cliSessionId`). */
  registroAlvo?: Record<string, unknown> | null
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
  let tokensAgora: number | null = opc.tokens === undefined ? 142_000 : opc.tokens
  on('session.usage', () => {
    if (opc.semUsage) throw new Error('sem usage')
    return { value: { startedAt: 0, context: { tokens: tokensAgora ?? undefined, window: opc.janelaDoModelo === null ? undefined : (opc.janelaDoModelo ?? 1_000_000) }, rateLimits: [] } }
  })
  const arquivos = new Map<string, string>()
  for (const d of opc.perguntas ?? []) arquivos.set(`${PASTA}/perguntas/${d.id}.json`, JSON.stringify(d))
  for (const d of opc.fila ?? []) arquivos.set(`${PASTA}/fila/${d.id}.json`, JSON.stringify(d))
  for (const d of opc.sessoes ?? [sessaoOrq()]) arquivos.set(`${PASTA}/sessoes/${d.id}.json`, JSON.stringify(d))
  arquivos.set(`${PASTA}/temas.json`, JSON.stringify([{ id: 'geral', rotulo: 'Geral' }]))
  if (opc.bandeira !== undefined) arquivos.set(BANDEIRA, opc.bandeira)
  if (opc.settings !== null) arquivos.set(SETTINGS, opc.settings ?? '{"autoCompactWindow": 600000}')
  if (opc.volta !== undefined) arquivos.set(VOLTA, opc.volta)
  for (const [nome, t] of Object.entries(opc.voltas ?? {})) arquivos.set(`${PASTA_DA_VOLTA}/${nome}`, t)
  if (opc.registroAlvo !== null) arquivos.set(REGISTRO_DO_APP.replace(EU, 'local_orq'), JSON.stringify(opc.registroAlvo ?? { title: '🎛 orquestradora — kit', priorCliSessionIds: ['cli-velho'] }))
  // Só o `mv` e o `rm` da marca de volta; o resto do process.run segue sem implementação, como antes.
  const comandos: string[][] = []
  on('process.run', (_, e) => {
    const argv = [...e.argv]
    if (argv[0] === 'mv' && argv[1]?.startsWith(PASTA_DA_VOLTA)) {
      comandos.push(argv)
      const t = arquivos.get(argv[1])
      if (opc.mvFalha || t === undefined) return { value: { exitCode: 1, stdout: '', stderr: 'mv: no such file', isStdoutTruncated: false, isStderrTruncated: false } }
      arquivos.delete(argv[1])
      arquivos.set(argv[2] as string, t)
      return { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    }
    if (argv[0] === 'rm' && argv.slice(2).every(a => a.startsWith(PASTA_DA_VOLTA))) {
      comandos.push(argv)
      for (const a of argv.slice(2)) arquivos.delete(a)
      return { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    }
    throw new Error(`sem process.run no teste: ${argv[0]}`)
  })
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
  const limpezas: Array<{ path: string; data: Record<string, unknown> }> = []
  on('fs.write', async ($e, e) => {
    if (e.path.includes('/limpeza/')) {
      if (opc.limpezaFalha) throw new Error(opc.limpezaFalha)
      if (opc.aoGravarOk && limpezas.length === 0) await opc.aoGravarOk($e as never)
      limpezas.push({ path: e.path, data: JSON.parse(e.text) as Record<string, unknown> })
      arquivos.set(e.path, e.text)

      return { value: undefined }
    }
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
    if (opc.submitDrop !== undefined) return { drop: opc.submitDrop }

    return { text: e.text }
  })
  const chamadas: string[] = []
  const enviadas: Array<Record<string, unknown>> = []
  const notificacoes: string[] = []
  const limpezasDiretas: Array<Record<string, unknown>> = []
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
    if (e.tool === 'mcp__ccd_session_mgmt__clear_session') {
      limpezasDiretas.push({ ...entrada, voltaGravada: arquivos.has(VOLTA) })
      const r = opc.limpezaDireta
      if (r && 'deny' in r) return { deny: r.deny }
      if (r) return { result: {}, text: r.erro, isError: true }
      return { result: {}, text: 'Clear queued.' }
    }
    if (e.tool === 'mcp__ccd_session_mgmt__get_session') {
      if (entrada.session_id !== 'self') return { result: {}, text: JSON.stringify({ sessionId: entrada.session_id, isRunning: false, isArchived: false, ...opc.alvo }) }
      return { result: {}, text: JSON.stringify({ sessionId: EU, title: 'eu', isRunning: true }) }
    }
    return { result: {}, text: '[]' }
  })

  return { relogio: relogioDeTeste, comandos, limpezas, definirTokens: (t: number | null) => { tokensAgora = t }, escritas, bandeiras, fills, prompts, toasts, chamadas, enviadas, notificacoes, limpezasDiretas, arquivos, aberturas, painelAberto: () => aberto }
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
  expect((await ui.find({ key: 'painel' }))?.text).toBe('◨ Abrir painel')
  await ui.press({ key: 'painel' })
  await m.relogio.settle()
  expect(m.painelAberto()).toBe(true)
  const ui2 = await montar($, 'terminal')
  expect((await ui2.find({ key: 'painel' }))?.text).toBe('◨ Fechar painel')
  await ui2.press({ key: 'painel' })
  await m.relogio.settle()
  expect(m.painelAberto()).toBe(false)
  await ui.unmount()
  await ui2.unmount()
})

test('ordem: à esquerda relógio e contexto; à direita selo, limpar, modo e painel', async ($, on) => {
  await iniciar($, on, { perguntas: abertas(3) })
  const ui = await montar($, 'terminal')
  const botoes = (await ui.findAll({ type: 'Button' })).map(b => b.props.key)
  expect(botoes).toEqual(['perguntas', 'limpar', 'modo', 'painel'])
  const texto = await lido(ui)
  expect(texto.indexOf('⧗'), 'relógio antes do contexto').toBeLessThan(texto.indexOf('contexto'))
  const selo = (await ui.findAll({ type: 'Button' })).find(b => b.props.key === 'perguntas')
  // O Button do motor tem uma string só, o rótulo: ele é também o nome acessível.
  expect(selo?.text).toBe('● 3 perguntas')
  await ui.unmount()
})

const textosDe = async (ui: Awaited<ReturnType<typeof montar>>) => (await ui.findAll({ type: 'Text' })).map(t => t.text)

test('contexto contra a janela do settings: a orquestradora a 98 mil mostra 98/600 mil, sem palavra, nas duas superfícies', async ($, on) => {
  const m = await iniciar($, on, { tokens: 98_000 })
  expect(m.arquivos.get(SETTINGS), 'o fixture devolve o settings').toContain('"autoCompactWindow": 600000')
  for (const surface of SUPERFICIES) {
    const ui = await montar($, surface)
    const t = await lido(ui)
    expect(t).toMatch(/contexto 98\/600 mil/)
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

test('contexto no alto: a dona a 360 mil → · alto, warning só na palavra', async ($, on) => {
  await iniciar($, on, { titulo: 'F1 · x', tokens: 360_000 })
  const p = await montar($, 'terminal')
  expect(await lido(p)).toMatch(/contexto 360\/600 mil · alto/)
  const alto = (await p.findAll({ type: 'Text' })).find(t => t.text === ' · alto')
  expect(alto?.props.color).toBe('warning')
  expect((await p.findAll({ type: 'Text' })).find(t => t.text === 'contexto 360/600 mil')?.props.dimColor).toBe(true)
  await p.unmount()
})

test('contexto da dona no teto: 500/600 mil · limpar', async ($, on) => {
  await iniciar($, on, { titulo: 'F2 · x', tokens: 500_000 })
  const ui = await montar($, 'terminal')
  expect(await lido(ui)).toMatch(/500\/600 mil · limpar/)
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

const botoesDe = async (ui: Awaited<ReturnType<typeof montar>>) => (await ui.findAll({ type: 'Button' })).map(b => b.props.key)

test('limpar: só na barra da orquestradora, à esquerda do modo, em toda faixa e nas duas superfícies', async ($, on) => {
  await iniciar($, on, { perguntas: abertas(3) })
  for (const surface of SUPERFICIES) {
    for (const bodyColumns of [62, 94, 114, 140]) {
      const ui = await montar($, surface, { bodyColumns })
      const chaves = await botoesDe(ui)
      expect(chaves.includes('limpar'), `${surface} ${bodyColumns}: o limpar existe`).toBe(true)
      expect(chaves[0], `${surface} ${bodyColumns}: o selo abre o grupo`).toBe('perguntas')
      expect(chaves[1], `${surface} ${bodyColumns}: o limpar vem logo depois do selo`).toBe('limpar')
      if (chaves.includes('modo')) expect(chaves.indexOf('limpar')).toBeLessThan(chaves.indexOf('modo'))
      expect((await ui.find({ key: 'limpar' }))?.text).toBe('↺ Limpar')
      await ui.unmount()
    }
  }
  expect(await (async () => botoesDe(await montar($, 'terminal', { bodyColumns: 114 })))()).toEqual(['perguntas', 'limpar', 'modo', 'painel'])
})

test('limpar: em outra sessão (uma dona) não existe, nem apagado', async ($, on) => {
  await iniciar($, on, { titulo: 'F1 · x', perguntas: abertas(3), sessoes: [] })
  for (const surface of SUPERFICIES) {
    const ui = await montar($, surface, { bodyColumns: 140 })
    const chaves = await botoesDe(ui)
    expect(chaves, `${surface}: os outros botões desenharam`).toEqual(['perguntas', 'modo', 'painel'])
    expect(await ui.find({ key: 'limpar' })).toBeUndefined()
    await ui.unmount()
  }
})

test('limpar: abaixo da régua é discreto (secundário, apagado, sem a palavra · limpar)', async ($, on) => {
  await iniciar($, on, { tokens: 142_000 })
  const baixo = await montar($, 'terminal', { bodyColumns: 140 })
  const repouso = await baixo.find({ key: 'limpar' })
  expect(repouso?.props.variant).toBe('secondary')
  expect(repouso?.props.dimColor).toBe(true)
  expect(await lido(baixo)).not.toMatch(/· limpar/)
  expect((await baixo.findAll({ type: 'Button' })).filter(b => b.props.variant === 'primary').length).toBe(0)
  await baixo.unmount()
})

test('limpar: na régua é o único primário, cheio, e a palavra · limpar acende junto', async ($, on) => {
  await iniciar($, on, { tokens: 262_000 })
  const alto = await montar($, 'terminal', { bodyColumns: 140 })
  const destaque = await alto.find({ key: 'limpar' })
  expect(destaque?.props.variant).toBe('primary')
  expect(destaque?.props.dimColor).not.toBe(true)
  expect(destaque?.text, 'o rótulo não muda com o destaque').toBe('↺ Limpar')
  expect(await lido(alto), 'a palavra e o botão acendem juntos').toMatch(/· limpar/)
  expect((await alto.findAll({ type: 'Button' })).filter(b => b.props.variant === 'primary').map(b => b.props.key)).toEqual(['limpar'])
  await alto.unmount()
})

test('os glifos da barra: cada botão leva o seu no rótulo (o motor só aceita um filho string no Button)', async ($, on) => {
  await iniciar($, on, { perguntas: abertas(3) })
  for (const surface of SUPERFICIES) {
    const ui = await montar($, surface, { bodyColumns: 140 })
    expect((await ui.find({ key: 'perguntas' }))?.text, `${surface} selo`).toBe('● 3 perguntas')
    expect((await ui.find({ key: 'limpar' }))?.text, `${surface} limpar`).toBe('↺ Limpar')
    expect((await ui.find({ key: 'modo' }))?.text).toBe('☾ Ficar ausente')
    expect((await ui.find({ key: 'painel' }))?.text).toBe('◨ Abrir painel')
    await ui.unmount()
  }
})

test('o clique de limpar: grava o ok da barra, manda o prompt à própria sessão, mostra Limpando… e nunca chama clear_session', async ($, on) => {
  const m = await iniciar($, on, { tokens: 212_000 })
  const ui = await montar($, 'terminal', { bodyColumns: 140 })
  await ui.press({ key: 'limpar' })
  await m.relogio.settle()
  expect(m.limpezas.length, 'gravou o ok').toBe(1)
  expect(m.limpezas[0]?.path).toBe(`${HOME}/.claude/orquestracao/limpeza/${EU}.json`)
  expect(m.limpezas[0]?.data).toEqual({ em: new Date(AGORA).toISOString(), por: 'barra' })
  expect(m.prompts).toEqual([PROMPT_DE_LIMPAR])
  expect(PROMPT_DE_LIMPAR).toMatch(/clear_session "self"/)
  expect(m.toasts, 'sem toast no caminho feliz').toEqual([])
  expect(m.escritas.filter(e => e.path.includes('/perguntas/')), 'não grava pergunta nenhuma').toEqual([])
  expect(m.chamadas.includes('mcp__ccd_session_mgmt__clear_session'), 'quem limpa é a orquestradora, com a T7').toBe(false)
  const depois = await montar($, 'terminal', { bodyColumns: 140 })
  expect((await depois.find({ key: 'limpar' }))?.text, 'segue Limpando… com o contexto ainda alto').toBe('↺ Limpando…')
  await depois.press({ key: 'limpar' })
  await m.relogio.settle()
  expect(m.prompts.length, 'o clique repetido é ignorado').toBe(1)
  await ui.unmount()
  await depois.unmount()
})

test('cacheFrio: só com o relógio vencido e o turno parado; sem relógio não é frio', () => {
  expect(cacheFrio(0, false)).toBe(true)
  expect(cacheFrio(-5, false)).toBe(true)
  expect(cacheFrio(1, false), 'falta 1 s: ainda quente').toBe(false)
  expect(cacheFrio(0, true), 'turno rodando nunca é frio').toBe(false)
  expect(cacheFrio(null, false), 'sem relógio (nenhum turno desde que o processo subiu): não sei, pede').toBe(false)
})

/** Um turno completo e o relógio passado do TTL: o cache esfriou. */
async function esfriar($: Parameters<TestBody>[0], m: Awaited<ReturnType<typeof iniciar>>) {
  await $.turn.complete(turnoCompleto())
  await m.relogio.advance(CACHE_TTL_MS + 2000)
}

test('limpar com o cache frio: rótulo Limpar já, grava o ok e chama clear_session "self" sem prompt nenhum', async ($, on) => {
  const m = await iniciar($, on, { tokens: 212_000 })
  await esfriar($, m)
  const ui = await montar($, 'terminal', { bodyColumns: 140 })
  expect((await ui.find({ key: 'limpar' }))?.text, 'o botão avisa que vai limpar direto').toBe('↺ Limpar já')
  await ui.press({ key: 'limpar' })
  await m.relogio.settle()
  expect(m.limpezas.length, 'o ok da T7 gravado antes').toBe(1)
  expect(m.limpezas[0]?.data.por).toBe('barra')
  expect(m.limpezasDiretas.length, 'chamou o clear_session').toBe(1)
  expect(m.limpezasDiretas[0]?.session_id).toBe('self')
  expect(m.chamadas.indexOf('mcp__ccd_session_mgmt__clear_session')).toBeGreaterThan(-1)
  expect(m.prompts, 'nenhum turno do modelo').toEqual([])
  expect(m.toasts).toEqual([])
  const depois = await montar($, 'terminal', { bodyColumns: 140 })
  expect((await depois.find({ key: 'limpar' }))?.text).toBe('↺ Limpando…')
  await ui.unmount()
  await depois.unmount()
  // No app o processo morre na limpeza; aqui o prazo corre para a espera não sobreviver ao teste.
  await m.relogio.advance(ESPERA_DA_LIMPEZA_DIRETA_MS + 1000)
})

test('limpar com o cache quente: pede à sessão, nunca limpa direto', async ($, on) => {
  const m = await iniciar($, on, { tokens: 212_000 })
  await $.turn.complete(turnoCompleto())
  await m.relogio.advance(CACHE_TTL_MS - 60_000)
  const ui = await montar($, 'terminal', { bodyColumns: 140 })
  expect((await ui.find({ key: 'limpar' }))?.text).toBe('↺ Limpar')
  await ui.press({ key: 'limpar' })
  await m.relogio.settle()
  expect(m.prompts).toEqual([PROMPT_DE_LIMPAR])
  expect(m.limpezasDiretas, 'falta 1 min: ainda quente').toEqual([])
  await ui.unmount()
})

test('limpar com o cache frio e o turno rodando: pede à sessão, nunca limpa direto', async ($, on) => {
  const m = await iniciar($, on, { tokens: 212_000 })
  await esfriar($, m)
  const ui = await montar($, 'terminal', { bodyColumns: 140, isWorking: true })
  expect((await ui.find({ key: 'limpar' }))?.text, 'rodando, o rótulo não promete limpar direto').toBe('↺ Limpar')
  await ui.press({ key: 'limpar' })
  await m.relogio.settle()
  expect(m.limpezasDiretas).toEqual([])
  expect(m.prompts).toEqual([PROMPT_DE_LIMPAR])
  await ui.unmount()
})

for (const [nome, opc, motivo] of [
  ['o app recusa', { erro: 'session has live work' }, 'session has live work'],
  ['um hook nega', { deny: 'T7 negou' }, 'T7 negou'],
] as const) {
  test(`limpar com o cache frio: ${nome} o clear_session → avisa, regrava o ok e cai no pedido à sessão`, async ($, on) => {
    const m = await iniciar($, on, { tokens: 212_000, limpezaDireta: opc })
    await esfriar($, m)
    const ui = await montar($, 'terminal', { bodyColumns: 140 })
    await ui.press({ key: 'limpar' })
    await m.relogio.settle()
    expect(m.limpezasDiretas.length).toBe(1)
    expect(m.toasts.at(-1)).toBe(`A limpeza direta não pegou (${motivo}); pedi à sessão que se limpe.`)
    expect(m.limpezas.length, 'o ok regravado: a T7 pode tê-lo gastado').toBe(2)
    expect(m.prompts).toEqual([PROMPT_DE_LIMPAR])
    await ui.unmount()
  })
}

test('limpar com o cache frio: o app aceita mas a sessão não recomeça em 20 s → cai no pedido à sessão', async ($, on) => {
  const m = await iniciar($, on, { tokens: 212_000 })
  await esfriar($, m)
  const ui = await montar($, 'terminal', { bodyColumns: 140 })
  await ui.press({ key: 'limpar' })
  await m.relogio.settle()
  await m.relogio.advance(ESPERA_DA_LIMPEZA_DIRETA_MS - 1000)
  expect(m.prompts, 'ainda esperando a limpeza').toEqual([])
  await m.relogio.advance(2000)
  expect(m.prompts).toEqual([PROMPT_DE_LIMPAR])
  expect(m.toasts.at(-1)).toBe('A limpeza direta não pegou (a sessão não recomeçou); pedi à sessão que se limpe.')
  expect(m.limpezas.length).toBe(2)
  await ui.unmount()
})

test('limpar com o cache frio: a limpeza pegou mas o processo seguiu vivo → nenhum prompt (não grava handoff vazio)', async ($, on) => {
  const m = await iniciar($, on, { tokens: 212_000 })
  await esfriar($, m)
  const ui = await montar($, 'terminal', { bodyColumns: 140 })
  await ui.press({ key: 'limpar' })
  await m.relogio.settle()
  expect(m.limpezasDiretas.length, 'precondição: chamou o clear_session').toBe(1)
  m.definirTokens(20_000)
  await m.relogio.advance(ESPERA_DA_LIMPEZA_DIRETA_MS + 1000)
  expect(m.prompts).toEqual([])
  expect(m.toasts).toEqual([])
  await ui.unmount()
})

test('limpar com o cache frio: um turno começa entre o clique e a chamada → não limpa direto, avisa e pede à sessão', async ($, on) => {
  const m = await iniciar($, on, { tokens: 212_000, aoGravarOk: async () => $.turn.start({ turnId: 't2' } as never) })
  await esfriar($, m)
  const ui = await montar($, 'terminal', { bodyColumns: 140 })
  expect((await ui.find({ key: 'limpar' }))?.text, 'precondição: o render viu o cache frio').toBe('↺ Limpar já')
  await ui.press({ key: 'limpar' })
  await m.relogio.settle()
  expect(m.limpezasDiretas).toEqual([])
  expect(m.toasts.at(-1), 'a decisão de limpar direto foi revista depois do clique').toBe('A limpeza direta não pegou (um turno começou); pedi à sessão que se limpe.')
  expect(m.prompts).toEqual([PROMPT_DE_LIMPAR])
  await ui.unmount()
})

test('limpar com o cache frio sem leitura de contexto no clique: o app recusa → avisa e pede à sessão (não confunde com limpeza feita)', async ($, on) => {
  const m = await iniciar($, on, { tokens: null, limpezaDireta: { erro: 'session has live work' } })
  await esfriar($, m)
  m.definirTokens(100_000)
  const ui = await montar($, 'terminal', { bodyColumns: 140 })
  await ui.press({ key: 'limpar' })
  await m.relogio.settle()
  expect(m.limpezasDiretas.length).toBe(1)
  expect(m.toasts.at(-1)).toBe('A limpeza direta não pegou (session has live work); pedi à sessão que se limpe.')
  expect(m.prompts).toEqual([PROMPT_DE_LIMPAR])
  await ui.unmount()
})

// F219: a volta da limpeza. A T7 grava a marca ao liberar o clear_session da orquestradora (e o clique com o cache frio, antes
// de limpar direto). O app só sobe o processo novo de uma sessão limpa quando chega uma mensagem: quem a manda é o mod de outra
// sessão viva (a leitura da barra), e o processo novo só reabre o painel.
const marcaDeVolta = (antesMs: number) => JSON.stringify({ em: new Date(AGORA - antesMs).toISOString(), motivo: 'botão da barra' })
const OUTRA = 'local_orq'

test('limpezaAconteceu: o registro sem cliSessionId, ou com outro que não o da marca; sem registro ou com o mesmo, não', () => {
  expect(limpezaAconteceu('cli-velho', { priorCliSessionIds: ['cli-velho'] }), 'limpa, sem processo novo').toBe(true)
  expect(limpezaAconteceu('cli-velho', { cliSessionId: 'cli-novo' }), 'limpa, processo novo já subiu').toBe(true)
  expect(limpezaAconteceu('cli-velho', { cliSessionId: 'cli-velho' }), 'a limpeza foi descartada').toBe(false)
  expect(limpezaAconteceu(null, { cliSessionId: 'cli-x' }), 'marca sem cli: só sem cliSessionId').toBe(false)
  expect(limpezaAconteceu(null, {})).toBe(true)
  expect(limpezaAconteceu('cli-velho', null), 'sem registro não se sabe').toBe(false)
})

test('paraAcordar: marca de outra sessão entre 30 s e 10 min; a própria, a acordada, a vencida e a ilegível ficam', () => {
  const m = (nome: string, antes: number | null) => ({ nome, texto: antes === null ? '{nao json' : marcaDeVolta(antes) })
  expect(
    paraAcordar(
      [m(`${OUTRA}.json`, 60_000), m(`${EU}.json`, 60_000), m(`local_b${'.acordada.json'}`, 60_000), m('local_c.json', ACORDAR_DEPOIS_DE_MS - 1000), m('local_d.json', VOLTA_VALE_MS + 1000), m('local_e.json', null), m('x.json', 60_000), m('local_f.json', -5 * 60_000)],
      EU,
      AGORA,
    ),
  ).toEqual([{ id: OUTRA, cli: null }])
  expect(paraAcordar([{ nome: `${OUTRA}.json`, texto: JSON.stringify({ em: new Date(AGORA - 60_000).toISOString(), cli: 'cli-velho' }) }], EU, AGORA)).toEqual([{ id: OUTRA, cli: 'cli-velho' }])
})

test('acordar: a leitura da barra acha a marca de outra sessão parada, toma a marca e manda a mensagem da volta, uma vez', async ($, on) => {
  const m = await iniciar($, on, { titulo: 'F1 · outra dona', voltas: { [`${OUTRA}.json`]: marcaDeVolta(60_000) } })
  const volta = m.enviadas.filter(e => e.message === PROMPT_DA_VOLTA)
  expect(volta.map(e => e.session_id), 'já na primeira leitura, a do início da sessão').toEqual([OUTRA])
  expect(PROMPT_DA_VOLTA).toMatch(/orquestracao:orquestradora/)
  expect(PROMPT_DA_VOLTA).toMatch(/Ao assumir/)
  // F241: quem manda é o mod de outra sessão, de qualquer projeto, e o app a mostra como remetente
  expect(PROMPT_DA_VOLTA).toMatch(/o remetente é só a sessão que notou a volta, de qualquer projeto; não responda a ela/)
  expect(m.arquivos.has(`${PASTA_DA_VOLTA}/${OUTRA}.json`), 'a marca foi tomada').toBe(false)
  expect(m.arquivos.has(`${PASTA_DA_VOLTA}/${OUTRA}.acordada.json`)).toBe(true)
  await m.relogio.advance(LEITURA_MS + 1000)
  expect(m.enviadas.filter(e => e.message === PROMPT_DA_VOLTA).length, 'a leitura seguinte não manda de novo').toBe(1)
})

for (const [caso, opc] of [
  ['marca nova demais (a limpeza ainda não aconteceu)', { voltas: { [`${OUTRA}.json`]: marcaDeVolta(5_000) } }],
  ['marca vencida', { voltas: { [`${OUTRA}.json`]: marcaDeVolta(VOLTA_VALE_MS + 1000) } }],
  ['a sessão está rodando', { voltas: { [`${OUTRA}.json`]: marcaDeVolta(60_000) }, alvo: { isRunning: true } }],
  ['a sessão foi arquivada', { voltas: { [`${OUTRA}.json`]: marcaDeVolta(60_000) }, alvo: { isArchived: true } }],
  ['outro mod tomou a marca antes', { voltas: { [`${OUTRA}.json`]: marcaDeVolta(60_000) }, mvFalha: true }],
  ['a marca já foi acordada', { voltas: { [`${OUTRA}.acordada.json`]: marcaDeVolta(60_000) } }],
  ['a limpeza foi descartada (o registro ainda traz o CLI da marca)', { voltas: { [`${OUTRA}.json`]: JSON.stringify({ em: new Date(AGORA - 60_000).toISOString(), cli: 'cli-velho' }) }, registroAlvo: { cliSessionId: 'cli-velho' } }],
  ['sem o registro do app', { voltas: { [`${OUTRA}.json`]: marcaDeVolta(60_000) }, registroAlvo: null }],
  ['o processo novo está subindo (o operador a acordou)', { voltas: { [`${OUTRA}.json`]: marcaDeVolta(60_000) }, alvo: { starting: true } }],
] as const) {
  test(`acordar: ${caso} → nenhuma mensagem (o contraste: o teste acima manda)`, async ($, on) => {
    // Só a leitura do início: com o relógio parado, a marca nova demais segue nova demais.
    const m = await iniciar($, on, { titulo: 'F1 · outra dona', ...opc })
    expect(m.enviadas.filter(e => e.message === PROMPT_DA_VOLTA)).toEqual([])
  })
}

// F371: a dona que se limpou também volta; a marca dela (`papel: "dona"`) traz os itens e o handoff de cada um, e a mensagem diz de onde retomar.
const marcaDaDona = (antesMs: number, itens: Array<Record<string, unknown>>) => JSON.stringify({ em: new Date(AGORA - antesMs).toISOString(), motivo: 'dona se limpou', papel: 'dona', itens })
const HANDOFF = `${HOME}/.claude/orquestracao/pool/handoffs/F358.md`

test('promptDaVolta: a marca da orquestradora (ou sem papel, ou ilegível) dá a mensagem dela; a da dona, a de retomar pelo handoff', () => {
  expect(promptDaVolta(marcaDeVolta(60_000)), 'marca sem papel: a de antes do F371').toBe(PROMPT_DA_VOLTA)
  expect(promptDaVolta('{nao json')).toBe(PROMPT_DA_VOLTA)
  const dona = promptDaVolta(marcaDaDona(60_000, [{ id: 'F358', handoff: HANDOFF }, { id: 'F359' }]))
  expect(dona, 'não é a da orquestradora').not.toBe(PROMPT_DA_VOLTA)
  expect(dona).toMatch(/o remetente é só a sessão que notou a volta, de qualquer projeto; não responda a ela/)
  expect(dona).toMatch(/dona/)
  expect(dona).toMatch(/pool\/dona\.md/)
  expect(dona.includes(HANDOFF), 'o caminho do handoff vai na mensagem').toBe(true)
  expect(dona).toMatch(/F359/)
  expect(dona).toMatch(/painel get fila F359/)
  expect(dona).not.toMatch(/orquestracao:orquestradora/)
  // marca da dona sem itens legíveis: ainda manda reler o manual, sem inventar item
  expect(promptDaVolta(marcaDaDona(60_000, []))).toMatch(/pool\/dona\.md/)
})

test('acordar: a marca da dona → a mensagem de retomar pelo handoff, uma vez (e não a da orquestradora)', async ($, on) => {
  const m = await iniciar($, on, { titulo: 'F1 · outra dona', voltas: { [`${OUTRA}.json`]: marcaDaDona(60_000, [{ id: 'F358', handoff: HANDOFF }]) } })
  const paraDona = m.enviadas.filter(e => e.session_id === OUTRA)
  expect(paraDona.length).toBe(1)
  expect(String(paraDona[0]?.message).includes(HANDOFF), 'a mensagem leva o handoff').toBe(true)
  expect(m.enviadas.filter(e => e.message === PROMPT_DA_VOLTA)).toEqual([])
  expect(m.arquivos.has(`${PASTA_DA_VOLTA}/${OUTRA}.acordada.json`)).toBe(true)
  await m.relogio.advance(LEITURA_MS + 1000)
  expect(m.enviadas.filter(e => e.session_id === OUTRA).length, 'a leitura seguinte não manda de novo').toBe(1)
})

test('volta: o processo novo da dona com a marca apaga a marca e não abre o painel', async ($, on) => {
  const m = await iniciar($, on, { titulo: 'F358 · uma dona', volta: marcaDaDona(60_000, [{ id: 'F358', handoff: HANDOFF }]) })
  expect(m.arquivos.has(VOLTA), 'a marca saiu').toBe(false)
  expect(m.painelAberto()).toBe(false)
  expect(m.prompts).toEqual([])
})

test('acordar: a limpeza com o processo novo já de pé (outro cliSessionId) e a sessão parada → manda', async ($, on) => {
  const m = await iniciar($, on, { titulo: 'F1 · outra dona', voltas: { [`${OUTRA}.json`]: JSON.stringify({ em: new Date(AGORA - 60_000).toISOString(), cli: 'cli-velho' }) }, registroAlvo: { cliSessionId: 'cli-novo' } })
  expect(m.enviadas.filter(e => e.message === PROMPT_DA_VOLTA).map(e => e.session_id)).toEqual([OUTRA])
})

test('acordar: o envio falha → a marca volta ao nome de antes, e a leitura seguinte tenta de novo', async ($, on) => {
  const m = await iniciar($, on, { titulo: 'F1 · outra dona', voltas: { [`${OUTRA}.json`]: marcaDeVolta(60_000) }, envioFalha: 'Target session is recovering its own pending input' })
  expect(m.arquivos.has(`${PASTA_DA_VOLTA}/${OUTRA}.json`), 'a marca foi devolvida').toBe(true)
  expect(m.arquivos.has(`${PASTA_DA_VOLTA}/${OUTRA}.acordada.json`)).toBe(false)
  expect(m.comandos.filter(c => c[0] === 'mv').length, 'tomou e devolveu').toBe(2)
  await m.relogio.advance(LEITURA_MS + 1000)
  expect(m.comandos.filter(c => c[0] === 'mv').length, 'tentou de novo na leitura seguinte').toBe(4)
})

test('acordar: a própria marca não se acorda (o processo dela é o que vai morrer)', async ($, on) => {
  const m = await iniciar($, on, { tokens: 260_000, volta: marcaDeVolta(60_000), painelAbertoNoInicio: true })
  await m.relogio.advance(LEITURA_MS + 1000)
  expect(m.enviadas.filter(e => e.message === PROMPT_DA_VOLTA)).toEqual([])
})

test('volta: o processo novo da orquestradora com a marca reabre o painel, apaga a marca e não manda prompt', async ($, on) => {
  const m = await iniciar($, on, { volta: marcaDeVolta(60_000) })
  expect(m.painelAberto(), 'o painel abriu sem o operador pedir').toBe(true)
  expect(m.prompts, 'a skill vem pela mensagem que acordou a sessão (ou pelo hook de início): nenhum turno a mais').toEqual([])
  expect(m.arquivos.has(VOLTA), 'a marca saiu: ninguém mais a acorda').toBe(false)
})

test('volta: a marca já acordada também reabre o painel e sai', async ($, on) => {
  const m = await iniciar($, on, { voltas: { [`${EU}.acordada.json`]: marcaDeVolta(90_000) } })
  expect(m.painelAberto()).toBe(true)
  expect(m.arquivos.has(`${PASTA_DA_VOLTA}/${EU}.acordada.json`)).toBe(false)
})

test('volta: o operador voltou horas depois (até 12 h) e a marca ainda reabre o painel', async ($, on) => {
  const m = await iniciar($, on, { volta: marcaDeVolta(PAINEL_NA_VOLTA_MS - 60_000) })
  expect(m.painelAberto()).toBe(true)
})

for (const [caso, volta] of [
  ['marca de mais de 12 h', marcaDeVolta(PAINEL_NA_VOLTA_MS + 1000)],
  ['marca no futuro', marcaDeVolta(-5 * 60_000)],
  ['marca ilegível', '{nao json'],
] as const) {
  test(`volta: ${caso} → o painel fica fechado, e a marca sai (o contraste: a fresca abre)`, async ($, on) => {
    const m = await iniciar($, on, { volta })
    expect(m.painelAberto()).toBe(false)
    expect(m.arquivos.has(VOLTA)).toBe(false)
  })
}

test('volta: sem marca, nada (nem rm)', async ($, on) => {
  const m = await iniciar($, on)
  expect(m.painelAberto()).toBe(false)
  expect(m.comandos).toEqual([])
})

test('volta: só na orquestradora (a dona com marca fresca não abre o painel)', async ($, on) => {
  const m = await iniciar($, on, { volta: marcaDeVolta(60_000), titulo: 'F12 · uma dona' })
  expect(m.painelAberto()).toBe(false)
})

test('limpar com o cache frio: grava a marca de volta antes do clear_session (a limpeza direta pode não passar pela T7)', async ($, on) => {
  const m = await iniciar($, on, { tokens: 212_000 })
  await esfriar($, m)
  const ui = await montar($, 'terminal', { bodyColumns: 140 })
  await ui.press({ key: 'limpar' })
  await m.relogio.settle()
  expect(m.limpezasDiretas.length, 'chamou o clear_session').toBe(1)
  expect(m.limpezasDiretas[0]?.voltaGravada, 'a marca de volta já estava gravada na chamada').toBe(true)
  expect(JSON.parse(m.arquivos.get(VOLTA) ?? '{}').motivo).toBe('limpeza direta da barra')
  await ui.unmount()
  await m.relogio.advance(ESPERA_DA_LIMPEZA_DIRETA_MS + 1000)
})

test('limpar com o cache quente: o mod não grava a marca de volta (quem grava é a T7, quando a sessão se limpa)', async ($, on) => {
  const m = await iniciar($, on, { tokens: 212_000 })
  const ui = await montar($, 'terminal', { bodyColumns: 140 })
  await ui.press({ key: 'limpar' })
  await m.relogio.settle()
  expect(m.prompts).toEqual([PROMPT_DE_LIMPAR])
  expect(m.arquivos.has(VOLTA)).toBe(false)
  await ui.unmount()
})

test('Limpando… volta quando a leitura vê o contexto abaixo de 150 mil, e não antes', async ($, on) => {
  const m = await iniciar($, on, { tokens: 212_000 })
  const ui = await montar($, 'terminal', { bodyColumns: 140 })
  await ui.press({ key: 'limpar' })
  await m.relogio.settle()
  await m.relogio.advance(LEITURA_MS + 1000)
  expect((await (await montar($, 'terminal', { bodyColumns: 140 })).find({ key: 'limpar' }))?.text, 'contexto ainda alto na leitura: segue').toBe('↺ Limpando…')
  m.definirTokens(LIMPANDO_ABAIXO_DE - 1)
  await m.relogio.advance(LEITURA_MS + 1000)
  const livre = await montar($, 'terminal', { bodyColumns: 140 })
  expect((await livre.find({ key: 'limpar' }))?.text, 'contexto pequeno: o botão volta').toBe('↺ Limpar')
  expect((await livre.find({ key: 'limpar' }))?.props.variant, 'e apagado de novo').toBe('secondary')
  await ui.unmount()
  await livre.unmount()
})

test('Limpando… com o clique já abaixo de 150 mil só volta quando o contexto cai à metade', async ($, on) => {
  const m = await iniciar($, on, { tokens: 90_000 })
  const ui = await montar($, 'terminal', { bodyColumns: 140 })
  await ui.press({ key: 'limpar' })
  await m.relogio.settle()
  await m.relogio.advance(LEITURA_MS + 1000)
  const preso = await montar($, 'terminal', { bodyColumns: 140 })
  expect((await preso.find({ key: 'limpar' }))?.text, 'mesmos 90 mil na leitura: segue Limpando…').toBe('↺ Limpando…')
  m.definirTokens(20_000)
  await m.relogio.advance(LEITURA_MS + 1000)
  const livre = await montar($, 'terminal', { bodyColumns: 140 })
  expect((await livre.find({ key: 'limpar' }))?.text, 'contexto caiu à metade: o botão volta').toBe('↺ Limpar')
  await ui.unmount()
  await preso.unmount()
  await livre.unmount()
})

test('Limpando… volta sozinho aos 10 min, mesmo com o contexto alto', async ($, on) => {
  const m = await iniciar($, on, { tokens: 212_000 })
  const ui = await montar($, 'terminal', { bodyColumns: 140 })
  await ui.press({ key: 'limpar' })
  await m.relogio.settle()
  await m.relogio.advance(9 * 60_000)
  expect((await (await montar($, 'terminal', { bodyColumns: 140 })).find({ key: 'limpar' }))?.text, 'aos 9 min segue').toBe('↺ Limpando…')
  await m.relogio.advance(2 * 60_000)
  expect((await (await montar($, 'terminal', { bodyColumns: 140 })).find({ key: 'limpar' }))?.text, 'passados os 10 min volta').toBe('↺ Limpar')
  await ui.unmount()
})

test('limpar: o app recusa o prompt → toast com o motivo e o botão volta na hora', async ($, on) => {
  const m = await iniciar($, on, { tokens: 212_000, submitDrop: 'fila cheia' })
  const ui = await montar($, 'terminal', { bodyColumns: 140 })
  await ui.press({ key: 'limpar' })
  await m.relogio.settle()
  expect(m.toasts.at(-1)).toBe('Não consegui mandar a limpeza (fila cheia).')
  const depois = await montar($, 'terminal', { bodyColumns: 140 })
  expect((await depois.find({ key: 'limpar' }))?.text).toBe('↺ Limpar')
  await ui.unmount()
  await depois.unmount()
})

test('limpar: o ok não grava → nenhum prompt é enviado, toast e o botão volta', async ($, on) => {
  const m = await iniciar($, on, { tokens: 212_000, limpezaFalha: 'disco cheio' })
  const ui = await montar($, 'terminal', { bodyColumns: 140 })
  await ui.press({ key: 'limpar' })
  await m.relogio.settle()
  expect(m.prompts, 'sem o ok a T7 nega: nada é enviado').toEqual([])
  expect(m.toasts.at(-1)).toMatch(/^Não consegui mandar a limpeza \(/)
  const depois = await montar($, 'terminal', { bodyColumns: 140 })
  expect((await depois.find({ key: 'limpar' }))?.text).toBe('↺ Limpar')
  await ui.unmount()
  await depois.unmount()
})

test('a barra não tem mais pedido de limpeza nem Limpar antes de vencer (a pergunta antiga aberta não desenha nada)', async ($, on) => {
  const m = await iniciar($, on, { tokens: 212_000, perguntas: [doc('Q290', { projeto: 'kit', sessao: 'orq', sessaoId: ORQ, titulo: 'limpar · orquestradora', estado: 'aberta' })] })
  await $.turn.complete(turnoCompleto())
  await m.relogio.advance((3600 - 480) * 1000)
  const ui = await montar($, 'terminal', { bodyColumns: 140 })
  const t = await lido(ui)
  expect(t, 'o contexto desenhou').toMatch(/contexto 212\/600 mil/)
  expect(t).not.toMatch(/◆|pede limpeza|Pode se limpar|Limpar antes de vencer|ok enviado/)
  expect(await ui.find({ key: 'limpar-pedido' })).toBeUndefined()
  expect(await ui.find({ key: 'limpar-antes' })).toBeUndefined()
  expect((await botoesDe(ui)).filter(k => String(k).startsWith('limpar'))).toEqual(['limpar'])
  await ui.unmount()
})

test('item e donas aparecem na faixa larga da barra de uma dona (nada cai por causa de pedido)', async ($, on) => {
  await iniciar($, on, {
    titulo: 'F1 · x',
    perguntas: abertas(1),
    fila: [item('F1', { donoLocalId: EU, donoApelido: 'dona', com: [{ localId: EU, apelido: 'dona' }] })],
  })
  const ui = await montar($, 'terminal', { bodyColumns: 140 })
  const t = await lido(ui)
  expect(t).toMatch(/F1 ·/)
  expect(t).toMatch(/donas 1/)
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
  expect((await ui.find({ key: 'modo' }))?.text).toBe('☾ Ficar ausente')
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
  const m = await iniciar($, on, { tokens: 212_000 })
  const ui = await montar($, 'terminal', { bodyColumns: 140 })
  expect(pesadas(m.chamadas), 'a leitura da barra não chama').toEqual([])
  await ui.press({ key: 'modo' })
  await m.relogio.settle()
  expect(m.bandeiras.length, 'o clique do modo gravou').toBe(1)
  await ui.press({ key: 'limpar' })
  await m.relogio.settle()
  expect(m.prompts.length, 'o clique do limpar mandou o prompt').toBe(1)
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

test('donas: quantas trabalham no projeto, na faixa larga', async ($, on) => {
  await iniciar($, on, {
    fila: [item('F1', { com: [{ localId: 'a', apelido: 'dona' }] }), item('F2', { donoLocalId: 'c', donoApelido: 'dona' }), item('F3', { etapa: 'merge', donoLocalId: 'd', donoApelido: 'dona' })],
  })
  const ui = await montar($, 'terminal')
  expect(await lido(ui)).toMatch(/donas 2/)
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

test('pane: a pergunta de limpeza antiga aberta fica só em Esperam você; o pane não tem mais a faixa do pedido nem o botão', async ($, on) => {
  const m = await iniciar($, on, { titulo: 'P3 · barra', perguntas: [doc('Q290', { projeto: 'kit', sessao: 'orq', sessaoId: ORQ, titulo: 'limpar · orquestradora', estado: 'aberta', atualizadoEm: '2026-10-26T10:00:00Z' }, 4)] })
  await $.command.run({ command: 'painel', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } })
  await m.relogio.settle()
  for (const surface of SUPERFICIES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const t = await lido(ui)
    expect(t, `${surface}: a pergunta segue em Esperam você (o teste mede a presença)`).toMatch(/Esperam você/)
    expect(t, `${surface}: sem a faixa do pedido`).not.toMatch(/pede para se limpar|Pode se limpar|Ok enviado/)
    expect(await ui.find({ key: 'limpar-pedido' })).toBeUndefined()
    await ui.unmount()
  }
})
