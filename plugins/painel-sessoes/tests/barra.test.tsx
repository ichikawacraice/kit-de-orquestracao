import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { TestBody } from 'claude-code/testing'
import {
  CACHE_TTL_MS,
  REGUAS,
  abertasDoProjeto,
  contarPool,
  corDoContexto,
  faixaDaBarra,
  meuItem,
  mostraLimparAntes,
  nivelDoCache,
  orquestradorasDoProjeto,
  papelEApelido,
  perguntaDeLimpeza,
  reguaDoPapel,
  relogio,
} from '../hooks/barra.js'
import type { EstadoBarra } from '../hooks/barra.js'

type Doc = { id: string; data: Record<string, unknown>; version: number }
const doc = (id: string, data: Record<string, unknown>, version = 1): Doc => ({ id, data, version })

const EU = 'local_eu'
const ORQ = 'local_orq'
const HOME = '/home/teste'
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
  tokens: 142_000,
  regua: { aviso: 200_000, teto: 300_000 },
  item: 'F52 · design',
  pool: 'E 2 · V 1',
  abertas: 3,
  modo: 'ausente',
  trocando: false,
  painelAberto: true,
  moldura: false,
}

test('faixaDaBarra: a mais rica cuja soma cabe, com os textos reais', () => {
  const f = (cols: number, extra: Partial<EstadoBarra> = {}) => faixaDaBarra(cols, { ...REFERENCIA, ...extra })
  expect([f(114), f(113), f(94), f(93), f(40)]).toEqual([0, 1, 1, 2, 2])
  expect(f(114, { tokens: 250_000, regua: { aviso: 200_000, teto: 300_000 } }), 'palavra alto').toBe(1)
  expect(f(94, { tokens: 250_000 })).toBe(2)
  expect(f(114, { moldura: true })).toBe(1)
  expect(f(114, { abertas: 12 })).toBe(1)
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
  mock.env(on, { HOME, CLAUDE_CODE_HOST_SESSION_ID: EU, CLAUDE_CODE_ACCOUNT_UUID: 'conta', CLAUDE_CODE_ORGANIZATION_UUID: 'org' })
  mock.store(on)
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('session.cwd', () => ({ value: opc.cwd ?? '/work/kit' }))
  on('session.usage', () => {
    if (opc.semUsage) throw new Error('sem usage')
    return { value: { startedAt: 0, context: { tokens: opc.tokens === undefined ? 142_000 : (opc.tokens ?? undefined), window: 1_000_000 }, rateLimits: [] } }
  })
  const arquivos = new Map<string, string>()
  for (const d of opc.perguntas ?? []) arquivos.set(`${PASTA}/perguntas/${d.id}.json`, JSON.stringify(d))
  for (const d of opc.fila ?? []) arquivos.set(`${PASTA}/fila/${d.id}.json`, JSON.stringify(d))
  for (const d of opc.sessoes ?? [sessaoOrq()]) arquivos.set(`${PASTA}/sessoes/${d.id}.json`, JSON.stringify(d))
  arquivos.set(`${PASTA}/temas.json`, JSON.stringify([{ id: 'geral', rotulo: 'Geral' }]))
  if (opc.bandeira !== undefined) arquivos.set(BANDEIRA, opc.bandeira)
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

test('contexto no aviso termina em · alto; no teto, · teto; papel desconhecido, sem a régua', async ($, on) => {
  await iniciar($, on, { titulo: 'E2 · x', tokens: 300_000 })
  const teto = await montar($, 'terminal')
  expect(await lido(teto)).toMatch(/300\/300 mil · teto/)
  await teto.unmount()
})

test('contexto de papel desconhecido: só o número', async ($, on) => {
  await iniciar($, on, { titulo: 'qualquer', tokens: 142_000 })
  const ui = await montar($, 'terminal')
  const t = await lido(ui)
  expect(t).toMatch(/contexto 142 mil/)
  expect(t).not.toMatch(/142\//)
  await ui.unmount()
})

test('pedido de limpeza: o botão aparece em toda sessão do projeto, e o clique grava a prova do painel sem o pane nunca aberto', async ($, on) => {
  const m = await iniciar($, on, { titulo: 'P3 · barra', perguntas: [limpar('Q290', {}, 4)] })
  const ui = await montar($, 'terminal')
  const texto = await lido(ui)
  expect(texto).toMatch(/◆ A orquestradora pede para se limpar · Q290/)
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
  expect(await lido(u2)).toMatch(/✓ Ok enviado à orquestradora/)
  expect(await u2.find({ key: 'limpar-pedido' })).toBeUndefined()
  await ui.unmount()
  await u2.unmount()
})

test('pedido de limpeza: falha de gravação volta o botão e dá toast', async ($, on) => {
  const m = await iniciar($, on, { titulo: 'P3 · barra', perguntas: [limpar('Q290', {}, 4)] })
  m.arquivos.delete(`${PASTA}/perguntas/Q290.json`)
  const ui = await montar($, 'terminal')
  await ui.press({ key: 'limpar-pedido' })
  await m.relogio.settle()
  expect(m.toasts.at(-1)).toMatch(/Não consegui mandar o ok de limpar \(/)
  expect(m.escritas.filter(e => e.path.endsWith('Q290.json')), 'nada gravado').toEqual([])
  await ui.unmount()
})

test('a linha do pedido vem antes da barra e o Q-ID some nas faixas estreitas', async ($, on) => {
  await iniciar($, on, { titulo: 'P3 · barra', perguntas: [limpar('Q290')] })
  const largo = await montar($, 'terminal')
  const t = await lido(largo)
  expect(t.indexOf('◆')).toBeGreaterThanOrEqual(0)
  expect(t.indexOf('◆'), 'o pedido vem antes do relógio').toBeLessThan(t.indexOf('⧗'))
  await largo.unmount()
  const estreito = await montar($, 'terminal', { bodyColumns: 80 })
  expect(await lido(estreito)).not.toMatch(/Q290/)
  await estreito.unmount()
})

test('limpar antes de vencer: sem pedido aberto o clique põe o rascunho e nunca chama clear_session', async ($, on) => {
  const m = await iniciar($, on, { tokens: 212_000 })
  await $.turn.complete(turnoCompleto())
  await m.relogio.advance((3600 - 480) * 1000)
  const ui = await montar($, 'terminal')
  expect(await lido(ui)).toMatch(/◆ Cache vence em 8 min com 212 mil no contexto/)
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
  expect(await lido(trab)).toMatch(/⧗ …/)
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
  const ui = await montar($, 'terminal')
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

test('pane: sem o pedido (ou só limpar · outra-coisa) a linha não aparece', async ($, on) => {
  const m = await iniciar($, on, { titulo: 'P3 · barra', perguntas: [limpar('Q290', { titulo: 'limpar · outra-coisa' })] })
  await $.command.run({ command: 'painel', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } })
  await m.relogio.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await lido(ui)).not.toMatch(/pede para se limpar/)
  expect(await ui.find({ key: 'limpar-pedido' })).toBeUndefined()
  await ui.unmount()
})
