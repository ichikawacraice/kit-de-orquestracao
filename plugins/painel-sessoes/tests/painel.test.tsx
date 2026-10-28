import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'
import type { On } from 'claude-code'
import { cartaoSvg, faixaSvg, filaSvg, itemSvg, largura, modoSvg, parouSvg, perguntaSvg, resumoSvg, rotuloModoSvg, secaoSvg } from '../hooks/desenho.js'
import { contarSecoes, desmarcar, deveFechar, fechamentoDesmarca, marcar, vencidas, esperaOperadorSemPergunta, leituraParada, montarItens, papelDe, porTema, secoes, situacaoDe } from '../hooks/register.js'
import * as R from '../hooks/register.js'
import * as D from '../hooks/desenho.js'
import { FILA_REAL, TEMAS_DOIS_PROJETOS, TEMAS_REAIS, filaCompleta } from './fixtura-fila.js'

const PANE = {
  plugin: 'painel-sessoes',
  component: 'Pane',
  requestId: 'painel-sessoes',
  props: {
    title: 'Sessões',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const ABRIR = {
  command: 'painel',
  args: '',
  origin: { kind: 'composer' },
  presentation: { isFullscreen: false, columns: 120 },
} as const

type Doc = { id: string; data: Record<string, unknown>; version: number }
const doc = (id: string, data: Record<string, unknown>, version = 1): Doc => ({ id, data, version })
const banco = (...docs: Doc[]) => docs
const PASTA = '/home/teste/.claude/orquestracao/painel'
const BANDEIRA = '/home/teste/.claude/orquestracao/operador-ausente.json'

const PERGUNTAS = banco(
  doc(
    'Q7',
    {
      projeto: 'alfa',
      sessao: 'frente A',
      titulo: 'qual caminho',
      estado: 'aberta',
      opcoes: [
        { id: 'a', label: 'Caminho A' },
        { id: 'b', label: 'Caminho B' },
        { id: 'outra', label: 'Outra' },
      ],
    },
    4,
  ),
  doc(
    'Q8',
    {
      projeto: 'alfa',
      // o id cru no lugar do nome: o pane mostra o título da sessão
      sessao: 'local_b',
      sessaoId: 'local_b',
      titulo: 'posso rebasear',
      caso: 'a develop andou',
      recomendacao: 'rebasear agora',
      estado: 'aberta',
    },
    2,
  ),
  doc(
    'Q9',
    {
      projeto: 'alfa',
      sessao: 'eu mesma',
      // a pergunta é da sessão onde o painel está aberto
      sessaoId: 'local_eu',
      titulo: 'abro o release',
      estado: 'aberta',
    },
    1,
  ),
  doc('Q5', { projeto: 'alfa', sessao: 'frente B', titulo: 'já foi', estado: 'respondida', resposta: 'sim' }),
)

const VIVAS = JSON.stringify([
  { sessionId: 'local_a', title: 'frente A', isRunning: false, isArchived: false, lastActivityAt: '2026-10-23T11:55:00Z' },
  { sessionId: 'local_b', title: 'frente B', isRunning: false, isArchived: false },
  { sessionId: 'local_e', title: 'frente E', isRunning: false, isArchived: false },
  { sessionId: 'local_o', title: 'orq', isRunning: true, isArchived: false },
  { sessionId: 'local_d', title: 'nova sem linha', cwd: '/Users/x/Developer/Projects/Alfa', isRunning: true },
])

const EU = JSON.stringify({ sessionId: 'local_eu', title: 'eu mesma', isRunning: true, isArchived: false })

type Escrita = Record<string, unknown>

type Falhas = { envio?: string; prompt?: string }

type Opcoes = {
  /** O relógio do teste; o padrão é 23/10 12h, o que as respostas gravam. */
  agora?: number
  fila?: Record<string, Record<string, unknown>>
  perguntas?: Doc[]
  /** list_sessions: o JSON que ele devolve. */
  vivas?: string
  listaFalha?: boolean
  euFalha?: boolean
  /** open_session_in: o texto de erro que ele devolve, ou 'deny' para recusa. */
  abrirFalha?: string
  /** ui.copy: não copiou (o que o app faz sem área de transferência). */
  copiaFalha?: boolean
  semTemas?: boolean
  temas?: typeof TEMAS_REAIS
  /** A pasta deixa de responder (a leitura fica pendurada) quando `.on` vira true: a leitura que não renova. */
  parar?: { on: boolean }
  /** send_message e open_session_in só voltam quando esta promessa se resolve: o gesto em curso. */
  segurar?: Promise<void>
  /** Só o open_session_in espera `p` (quando posta): o "Abrindo…" em curso sem prender o pedido nem o foco automático. */
  segurarAbrir?: { p?: Promise<void> }
  /** CLAUDE_CODE_HOST_SESSION_ID: a sessão do app que roda este processo (sem ele, o CLI no terminal). */
  host?: string
  /** O que o store do plugin já guarda ao começar. */
  store?: Record<string, unknown>
  /** O store recusa toda leitura e escrita. */
  storeFalha?: boolean
  /** O desktop não tem onde desenhar um pane aberto sem pedido: o pane consta, mas `isPlaced` é false (até a pessoa pedir). */
  semLugar?: boolean
  /** O texto cru da bandeira do modo ausente (`operador-ausente.json`); sem ele o arquivo não existe. */
  bandeira?: string
  /** Documentos da coleção `sessoes` do painel (a orquestradora ativa é a de `papel: "orquestradora"` e estado fora de `concluida`). */
  sessoesDocs?: Doc[]
  /** Documentos da coleção `cartoes` (o cartão de sessão nova que espera o clique). */
  cartoes?: Doc[]
  /** O que o operador já digitou na caixa do prompt (`$.prompt.read`); vazio por padrão. */
  rascunho?: string
  /** `$.prompt.fill` não pôs o texto na caixa. */
  fillRecusa?: boolean
  /** Perguntas fechadas no arquivo (F183): `caminho` relativo a `perguntas/arquivo/`, com o mtime do arquivo. */
  arquivadas?: Array<{ caminho: string; doc: Doc; mtimeMs: number }>
  /** A gravação da bandeira falha com este motivo. */
  bandeiraFalha?: string
  /** A gravação da bandeira só termina quando esta promessa se resolve: o clique em curso. */
  segurarBandeira?: Promise<void>
}

function engine(on: On, falhaPasta = false, falhas: Falhas = {}, opc: Opcoes = {}) {
  on('command.register', () => ({ value: { command: 'painel' } }))
  const registradas: string[] = []
  on('tool.register', (_, e) => {
    registradas.push(String((e as unknown as { name?: string }).name))
    return { value: { tool: 'mcp__painel-sessoes__onde_esta_o_painel' } }
  })
  let aberto = false
  let pedido = false
  on('ui.open', () => {
    aberto = true
    const colocado = !opc.semLugar || pedido
    return { value: colocado ? { isPlaced: true } : { isPlaced: false, reason: 'no-surface' as const } }
  })
  on('ui.panes', () => ({
    value: aberto ? [{ id: 'painel-sessoes', title: 'Sessões', isShown: true, isFocused: false, isPlaced: !opc.semLugar || pedido }] : [],
  }))
  on('ui.close', () => {
    aberto = false
    pedido = false
    return { value: undefined }
  })
  const toasts: string[] = []
  const copiadas: Array<{ text: string; surface: string }> = []
  const abertas: Escrita[] = []
  on('ui.toast', (_, e) => {
    toasts.push(String((e as unknown as { message?: string; text?: string }).message ?? (e as unknown as { text?: string }).text))
    return { value: undefined }
  })
  on('ui.copy', (_, e) => {
    copiadas.push({ text: String((e as unknown as { text: string }).text), surface: String((e as unknown as { surface: string }).surface) })
    return { value: opc.copiaFalha ? { isCopied: false as const, reason: 'no-clipboard' as const } : { isCopied: true as const } }
  })
  const relogio = mock.clock(on, { now: opc.agora ?? Date.UTC(2026, 9, 23, 12) })
  mock.env(on, { HOME: '/home/teste', BATIDA: 'off', ...(opc.host ? { CLAUDE_CODE_HOST_SESSION_ID: opc.host } : {}) })
  const loja = new Map<string, unknown>(Object.entries(opc.store ?? {}))
  on('store.get', (_, e) => (opc.storeFalha ? { deny: 'store fora do ar' } : { value: loja.get(e.key) }))
  on('store.set', (_, e) => {
    if (opc.storeFalha) return { deny: 'store fora do ar' }
    loja.set(e.key, JSON.parse(JSON.stringify(e.value)))
    return { value: undefined }
  })
  on('store.delete', (_, e) => {
    loja.delete(e.key)
    return { value: undefined }
  })
  on('store.keys', () => ({ value: [...loja.keys()] }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  // A pasta do painel em memória: um arquivo por documento.
  const arquivos = new Map<string, string>()
  for (const d of opc.perguntas ?? PERGUNTAS) arquivos.set(`${PASTA}/perguntas/${d.id}.json`, JSON.stringify(d))
  // a foto da fila não traz o `projeto`, mas os 29 itens reais têm `alfa`: sem ele o item legado cai em "Sem tema" (c19)
  for (const [id, data] of Object.entries(opc.fila ?? FILA_REAL)) arquivos.set(`${PASTA}/fila/${id}.json`, JSON.stringify(doc(id, { projeto: 'alfa', ...data })))
  if (opc.bandeira !== undefined) arquivos.set(BANDEIRA, opc.bandeira)
  for (const d of opc.sessoesDocs ?? []) arquivos.set(`${PASTA}/sessoes/${d.id}.json`, JSON.stringify(d))
  for (const d of opc.cartoes ?? []) arquivos.set(`${PASTA}/cartoes/${d.id}.json`, JSON.stringify(d))
  const mtimes = new Map<string, number>()
  for (const a of opc.arquivadas ?? []) {
    arquivos.set(`${PASTA}/perguntas/arquivo/${a.caminho}`, JSON.stringify(a.doc))
    mtimes.set(`${PASTA}/perguntas/arquivo/${a.caminho}`, a.mtimeMs)
  }
  const bandeiras: Escrita[] = []
  if (!opc.semTemas) arquivos.set(`${PASTA}/temas.json`, JSON.stringify(opc.temas ?? TEMAS_REAIS))
  const escritas: Escrita[] = []
  on('fs.list', async (_, e) => {
    if (falhaPasta) return { deny: 'sem acesso à pasta do painel' }
    if (opc.parar?.on) await new Promise(() => undefined)
    // Como o disco: só os filhos diretos, a subpasta como `directory` (F183: `perguntas/arquivo/` mora dentro da coleção).
    const prefixo = `${e.path}/`
    const filhos = new Map<string, { name: string; kind: 'file' | 'directory'; size: number; mtimeMs: number; isLink: boolean }>()
    for (const k of arquivos.keys()) {
      if (!k.startsWith(prefixo)) continue
      const resto = k.slice(prefixo.length)
      const barra = resto.indexOf('/')
      if (barra < 0) filhos.set(resto, { name: resto, kind: 'file', size: 1, mtimeMs: mtimes.get(k) ?? 0, isLink: false })
      else if (!filhos.has(resto.slice(0, barra))) filhos.set(resto.slice(0, barra), { name: resto.slice(0, barra), kind: 'directory', size: 0, mtimeMs: 0, isLink: false })
    }

    return { value: [...filhos.values()] }
  })
  on('fs.read', (_, e) => {
    const t = arquivos.get(e.path)
    if (t === undefined) throw new Error(`ENOENT ${e.path}`)

    return { value: t }
  })
  on('fs.write', async (_, e) => {
    if (e.path === BANDEIRA) {
      if (opc.segurarBandeira) await opc.segurarBandeira
      if (opc.bandeiraFalha) return { deny: opc.bandeiraFalha }
      arquivos.set(e.path, e.text)
      bandeiras.push(JSON.parse(e.text) as Escrita)

      return { value: undefined }
    }
    arquivos.set(e.path, e.text)
    const d = JSON.parse(e.text) as Doc
    escritas.push({ path: e.path, doc_id: d.id, version: d.version, data: d.data })

    return { value: undefined }
  })
  const contagem = { vivas: 0 }
  const enviadas: Escrita[] = []
  const fills: Array<{ text: string; mode?: string }> = []
  on('prompt.read', () => ({ value: { text: opc.rascunho ?? '', cursor: (opc.rascunho ?? '').length } }))
  on('prompt.fill', (_, e) => {
    if (opc.fillRecusa) return { isFilled: false }
    fills.push({ text: e.text, mode: (e as unknown as { mode?: string }).mode })
    return { isFilled: true }
  })
  const prompts: string[] = []
  on('prompt.submit', (_, e) => {
    if (falhas.prompt) return { drop: falhas.prompt }
    prompts.push(e.text)
    return { text: e.text }
  })
  on('tool.call', async (_, e) => {
    const input = e as unknown as Escrita
    if (opc.segurar && (e.tool === 'mcp__ccd_session_mgmt__send_message' || e.tool === 'mcp__ccd_window__open_session_in')) await opc.segurar
    if (opc.segurarAbrir?.p && e.tool === 'mcp__ccd_window__open_session_in') await opc.segurarAbrir.p
    if (e.tool === 'mcp__ccd_session_mgmt__send_message') {
      if (falhas.envio) return { result: {}, text: falhas.envio, isError: true }
      enviadas.push(input)
      return { result: {}, text: 'sent' }
    }
    if (e.tool === 'mcp__ccd_window__open_session_in') {
      abertas.push(input)
      if (opc.abrirFalha === 'deny') return { deny: 'a sessão não é desta' }
      if (opc.abrirFalha) return { result: {}, text: opc.abrirFalha, isError: true }
      return { result: {}, text: 'focused' }
    }
    if (e.tool === 'mcp__ccd_session_mgmt__get_session') return opc.euFalha ? { result: {}, text: 'sessão não achada', isError: true } : { result: {}, text: EU }
    contagem.vivas++
    if (opc.listaFalha) return { result: {}, text: 'app fora do ar', isError: true }
    return { result: {}, text: opc.vivas ?? VIVAS }
  })

  return { relogio, escritas, contagem, enviadas, prompts, fills, toasts, copiadas, abertas, loja, registradas, bandeiras, arquivos, painelAberto: () => aberto }
}

const lerSuperficie = async (ui: { findAll: (q: object) => Promise<Array<{ text: string; props: Record<string, unknown> }>> }) =>
  (await ui.findAll({})).map(el => `${el.text} ${typeof el.props.alt === 'string' ? el.props.alt : ''}`).join('\n')

/** Abre o pane, deixa a leitura acontecer e devolve o que a pessoa lê em cada superfície. */
async function lerPane($: Parameters<TestBody>[0], on: On, opc: Opcoes = {}, falhaPasta = false) {
  const motor = engine(on, falhaPasta, {}, { agora: AGORA, ...opc })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run(ABRIR)
  await motor.relogio.settle()
  const lido: Record<'terminal' | 'desktop', string> = { terminal: '', desktop: '' }
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    lido[surface] = await lerSuperficie(ui)
    await ui.unmount()
  }

  return { ...motor, lido }
}

const AGORA = Date.UTC(2026, 9, 25, 15)
const P7 = 'local_00000000-0000-4000-8000-0000000000f7'
const P2 = 'local_00000000-0000-4000-8000-0000000000f2'
const P1 = 'local_00000000-0000-4000-8000-0000000000f1'
const E8 = 'local_00000000-0000-4000-8000-0000000000e8'
const vivasDe = (...ids: string[]) => JSON.stringify(ids.map(sessionId => ({ sessionId, title: sessionId, isRunning: true, isArchived: false })))
const fila = (...ids: string[]) => Object.fromEntries(ids.map(id => [id, FILA_REAL[id] as Record<string, unknown>]))
// A superfície lida repete o texto: o pai concatena os filhos e cada filho aparece de novo, com o alt dos desenhos.
// A última ocorrência é a do elemento de folha, na ordem em que a tela os desenha.
const ultima = (texto: string, r: RegExp) => {
  const todas = [...texto.matchAll(new RegExp(r.source, 'g'))]

  return todas.length > 0 ? (todas[todas.length - 1]?.index ?? -1) : -1
}
const antes = (texto: string, a: RegExp, b: RegExp) => {
  const ia = ultima(texto, a)
  const ib = ultima(texto, b)
  expect([ia >= 0, ib >= 0], `os dois textos existem: ${a} e ${b}`).toEqual([true, true])
  expect(ia, `${a} vem antes de ${b}`).toBeLessThan(ib)
}

test('ainda não lido: contadores sem bloco nenhum', async ($, on) => {
  engine(on, false, {}, { agora: AGORA })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const lido = await lerSuperficie(ui)
    expect(lido).toMatch(/ainda não lido/)
    expect(lido).not.toMatch(/Executando · |Na fila · /)
    await ui.unmount()
  }
})

test('vazio: os dois blocos dizem que leram e não acharam, e os contadores ficam em zero', async ($, on) => {
  const { lido } = await lerPane($, on, { fila: {}, perguntas: [] })
  for (const surface of ['terminal', 'desktop'] as const) {
    expect(lido[surface]).toMatch(/Executando · 0/)
    expect(lido[surface]).toMatch(/Nada executando agora\./)
    expect(lido[surface]).toMatch(/Na fila · 0/)
    expect(lido[surface]).toMatch(/Nada na fila\./)
  }
  expect(lido.desktop).toMatch(/0 Esperam você, 0 Travados, 0 Executando, 0 Na fila/)
})

test('só fila: Executando vazio, a fila por tema, o mais antigo primeiro', async ($, on) => {
  const { lido, escritas } = await lerPane($, on, { fila: fila('F8', 'F17', 'F18'), vivas: vivasDe() })
  for (const surface of ['terminal', 'desktop'] as const) {
    expect(lido[surface]).toMatch(/Executando · 0/)
    expect(lido[surface]).toMatch(/Nada executando agora\./)
    expect(lido[surface]).toMatch(/Na fila · 3/)
    expect(lido[surface]).toMatch(/Editor da loja/)
    antes(lido[surface], /aviso de leitura/, /comCodigo/)
    antes(lido[surface], /comCodigo/, /painel do componente da loja/)
  }
  // Na fila o texto de apoio é o resumo; o "espera <etapa>" diz onde parou.
  expect(lido.desktop).toMatch(/espera planejamento/)
  expect(lido.desktop).toMatch(/espera execução/)
  expect(lido.desktop).toMatch(/Falta um teste que prove/)
  expect(lido.desktop).toMatch(/parado há 1 h/)
  expect(escritas).toEqual([])
})

test('andando: temas na ordem de temas.json, com etapa, dono, PR e o que vem depois', async ($, on) => {
  const { lido } = await lerPane($, on, { fila: fila('F27', 'F13', 'F1', 'F23'), vivas: vivasDe(P7, P2, P1, E8), perguntas: [] })
  for (const surface of ['terminal', 'desktop'] as const) {
    expect(lido[surface]).toMatch(/Executando · 4/)
    expect(lido[surface]).toMatch(/Na fila · 0/)
    antes(lido[surface], /Editor da loja/, /Sessões e painel/)
    antes(lido[surface], /Sessões e painel/, /Kit de orquestração/)
    expect(lido[surface]).toMatch(/execução · .*#1129/)
    expect(lido[surface]).not.toMatch(/Travados · /)
  }
  expect(lido.desktop).toMatch(/depois: validação das duas fatias \(\+2\)/)
  expect(lido.desktop).toMatch(/0 Esperam você, 0 Travados, 4 Executando, 0 Na fila/)
})

test('travado: vai para Travados, com o tema na linha 2 e a trava inteira', async ($, on) => {
  const travada = { ...FILA_REAL.F13, trava: { motivo: 'gate-vermelho', texto: 'três casos do diálogo falham' } }
  const { lido } = await lerPane($, on, { fila: { ...fila('F1', 'F27'), F13: travada }, vivas: vivasDe(P7, P2, P1), perguntas: [] })
  for (const surface of ['terminal', 'desktop'] as const) {
    expect(lido[surface]).toMatch(/Executando · 2/)
    antes(lido[surface], /Travados · 1/, /SPEC-155 fatia 2/)
    expect(lido[surface]).toMatch(/Editor da loja/)
    expect(lido[surface]).toMatch(/(Trava \()?[Gg]ate-vermelho\)?: três casos do diálogo falham/)
  }
  expect(lido.desktop).toMatch(/Editor da loja — SPEC-155.*execução · #1129/)
  expect(lido.desktop).toMatch(/0 Esperam você, 1 Travados, 2 Executando, 0 Na fila/)
})

test('item com pergunta: o selo vem do item e da pergunta, e só de pergunta aberta', async ($, on) => {
  const q8 = doc('Q8', { projeto: 'alfa', sessao: 'P1', sessaoId: P1, titulo: 'posso rebasear', estado: 'aberta', item: 'F1' }, 2)
  const q7 = doc('Q7', { projeto: 'alfa', sessao: 'P2', sessaoId: P2, titulo: 'qual caminho', estado: 'aberta' }, 4)
  const q5 = doc('Q5', { projeto: 'alfa', sessao: 'P7', titulo: 'já foi', estado: 'respondida', resposta: 'sim' })
  const itens = {
    F13: { ...FILA_REAL.F13, perguntas: ['Q7'] },
    F1: FILA_REAL.F1 as Record<string, unknown>,
    F27: { ...FILA_REAL.F27, perguntas: ['Q5'] },
  }
  const { lido } = await lerPane($, on, { fila: itens, perguntas: [q7, q8, q5], vivas: vivasDe(P7, P2, P1) })
  for (const surface of ['terminal', 'desktop'] as const) {
    expect(lido[surface]).toMatch(/aguarda você · Q7/)
    expect(lido[surface]).toMatch(/aguarda você · Q8/)
    expect(lido[surface]).not.toMatch(/aguarda você · Q5/)
  }
  // O cartão da pergunta com item leva o número e o título do item no lugar da sessão (F43: sem o tema).
  expect(lido.desktop).toMatch(/Q8 · F1 · builder: fatias 1 a 8/)
  expect(lido.desktop).toMatch(/Q7 · P2 · qual caminho/)
  expect(lido.desktop).toMatch(/2 Esperam você, 0 Travados, 3 Executando, 0 Na fila/)
})

test('sem ninguém: dono que não está na lista vira trava, com a mesma contagem', async ($, on) => {
  const { lido } = await lerPane($, on, { fila: fila('F23', 'F13'), vivas: vivasDe(P2), perguntas: [] })
  for (const surface of ['terminal', 'desktop'] as const) {
    antes(lido[surface], /Travados · 1/, /Editor da loja/)
    expect(lido[surface]).toMatch(/(Trava \()?[Ss]em ninguém\)?: E8 não está mais ativa/)
    expect(lido[surface]).not.toMatch(/sem-ninguem/)
  }
  expect(lido.desktop).toMatch(/0 Esperam você, 1 Travados, 1 Executando, 0 Na fila/)
})

test('o dono vivo é a sessão que olha o painel, mesmo fora do list_sessions', async ($, on) => {
  // O list_sessions exclui quem chama: a sessão própria vem do get_session (local_eu).
  const meu = { ...FILA_REAL.F27, donoLocalId: 'local_eu', donoApelido: 'EU' }
  const { lido } = await lerPane($, on, { fila: { F27: meu }, vivas: vivasDe(), perguntas: [] })
  expect(lido.desktop).toMatch(/0 Esperam você, 0 Travados, 1 Executando, 0 Na fila/)
  expect(lido.desktop).not.toMatch(/sem-ninguem/)
})

test('list_sessions que falha: o erro aparece e nenhum item vira "sem ninguém"', async ($, on) => {
  const { lido } = await lerPane($, on, { fila: fila('F23', 'F13'), listaFalha: true, perguntas: [] })
  for (const surface of ['terminal', 'desktop'] as const) {
    expect(lido[surface]).toMatch(/list_sessions: app fora do ar/)
    expect(lido[surface]).not.toMatch(/sem-ninguem|Travados · /)
  }
  expect(lido.desktop).toMatch(/0 Esperam você, 0 Travados, 2 Executando, 0 Na fila/)
})

test('get_session que falha: a sessão própria é desconhecida, e nenhum item vira "sem ninguém"', async ($, on) => {
  const { lido } = await lerPane($, on, { fila: fila('F23', 'F13'), vivas: vivasDe(P2), euFalha: true, perguntas: [] })
  expect(lido.desktop).toMatch(/esta sessão \(get_session\): sessão não achada/)
  expect(lido.desktop).not.toMatch(/sem-ninguem/)
  expect(lido.desktop).toMatch(/0 Travados, 2 Executando/)
})

test('fora do contrato: o item aparece em "Sem tema", no fim, com o motivo, e fora da lista de erros', async ($, on) => {
  const etapaVelha = { ...FILA_REAL.F18, etapa: 'andando' }
  const temaVelho = { ...FILA_REAL.F17, tema: 'inexistente' }
  const { lido } = await lerPane($, on, { fila: { F18: etapaVelha, F17: temaVelho, F8: FILA_REAL.F8 as Record<string, unknown> }, vivas: vivasDe(), perguntas: [] })
  for (const surface of ['terminal', 'desktop'] as const) {
    expect(lido[surface]).toMatch(/Na fila · 3/)
    expect(lido[surface]).toMatch(/Sem tema/)
    antes(lido[surface], /Editor da loja/, /Sem tema/)
    expect(lido[surface]).toMatch(/⚠ fora do contrato: etapa 'andando' fora da lista/)
    expect(lido[surface]).toMatch(/⚠ fora do contrato: tema 'inexistente' fora da lista/)
    // Aviso de gravação não vai para a lista vermelha do topo, que é de erro de leitura.
    expect(lido[surface]).not.toMatch(/⚠ (temas|fila|list_sessions)/)
  }
})

test('sem temas.json: o erro aparece e os itens caem em "Sem tema"', async ($, on) => {
  const { lido } = await lerPane($, on, { fila: fila('F8'), vivas: vivasDe(), perguntas: [], semTemas: true })
  expect(lido.desktop).toMatch(/temas do painel: /)
  expect(lido.desktop).toMatch(/Sem tema/)
  expect(lido.desktop).toMatch(/fora do contrato: tema 'editor' fora da lista/)
})

test('feitos: só nas últimas 24 h, recolhidos, e o botão abre', async ($, on) => {
  const velho = { ...FILA_REAL.F4, feitoEm: '2026-10-24T10:00:00.000Z' }
  const { relogio } = engine(on, false, {}, { agora: AGORA, fila: { F28: FILA_REAL.F28 as Record<string, unknown>, F4: velho }, vivas: vivasDe(), perguntas: [] })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run(ABRIR)
  await relogio.settle()
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const fechado = await lerSuperficie(ui)
    expect(fechado).toMatch(/Feitos hoje · 1/)
    expect(fechado).not.toMatch(/executora que termina o turno/)
    await ui.press({ key: 'feitos' })
    const aberto = await lerSuperficie(ui)
    expect(aberto).toMatch(/executora que termina o turno/)
    expect(aberto).not.toMatch(/crítica ao detalhe do designer/)
    await ui.press({ key: 'feitos' })
    await ui.unmount()
  }
})

test('a 300 px os quatro rótulos do resumo cabem inteiros, em 2×2', () => {
  const contagens = [
    { rotulo: 'Esperam você', n: 2, cor: 'av' },
    { rotulo: 'Travados', n: 1, cor: 'er' },
    { rotulo: 'Executando', n: 5, cor: 'an' },
    { rotulo: 'Na fila', n: 4, cor: 'an', classe: 't' },
  ]
  for (const W of [300, 420, 480]) {
    const r = resumoSvg(W, contagens)
    expect(r.source, 'o desenho não pode vir vazio').toBeTruthy()
    expect(r.height, W < 360 ? 'compacto: dois blocos de 36 px e o vão' : '2×2').toBe(W < 360 ? 78 : 130)
    for (const rotulo of ['Esperam você', 'Travados', 'Executando', 'Na fila']) expect(r.source).toContain(`>${rotulo}<`)
    expect(r.source).not.toContain('…')
  }
  const largo = resumoSvg(640, contagens)
  expect(largo.height).toBe(62)
})

test('a 300 px o selo da pergunta cabe inteiro na linha 2 e o título quebra em duas linhas', () => {
  const base = { id: 'F9', titulo: 'x', tema: 'editor', temaRotulo: 'Editor da loja', etapa: 'execucao', situacao: 'andando' as const, prs: [1128], depois: [], com: [], perguntas: ['Q225'], dono: { apelido: 'E3', localId: 'local_x' } }
  const item = itemSvg(300, { ...base, titulo: 'Canvas com 60% da largura' }, AGORA)
  expect(item.source, 'o desenho não pode vir vazio').toBeTruthy()
  expect(item.source).toContain('aguarda você · Q225')
  expect(item.source).not.toMatch(/Q225[^<]*…/)
  const fila = itemSvg(300, { ...base, situacao: 'fila' as const, perguntas: [], dono: undefined, prs: [], paradoDesde: '2026-10-23T15:00:00Z', titulo: 'Aviso de leitura fala de "descarte" que ninguém pediu' }, AGORA)
  expect(fila.source.match(/font-size="16"/g)?.length).toBe(2)
  expect(fila.source).not.toMatch(/font-size="16"[^>]*>[^<]*…/)
  expect(fila.source).toContain('parado há 2 d')
})

test('sem o pane aberto a sessão não lê nada', async ($, on) => {
  const { relogio, contagem } = engine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await relogio.advance(180_000)
  expect(contagem.vivas).toBe(0)
})

// F45: a limpeza do app mata o processo e o pane vai junto; o mod lembra no store que a sessão do app tinha o painel aberto.
const marcas = (loja: Map<string, unknown>) => (loja.get('abertos') ?? {}) as Record<string, string>

test('F45 t1: /painel abrindo marca a sessão do app no store', async ($, on) => {
  const { loja } = engine(on, false, {}, { host: 'local_a' })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(Object.keys(marcas(loja)), 'antes de abrir o store está sem marca').toEqual([])
  await $.command.run(ABRIR)
  expect(Object.keys(marcas(loja))).toEqual(['local_a'])
  expect(Number.isNaN(Date.parse(marcas(loja).local_a ?? '')), 'a marca guarda a data de abertura').toBe(false)
})

test('F45 t2: processo novo com a sessão marcada reabre o pane e liga a leitura', async ($, on) => {
  const { relogio, contagem, painelAberto } = engine(on, false, {}, { host: 'local_a', agora: AGORA, store: { abertos: { local_a: new Date(AGORA - 3_600_000).toISOString() } } })
  expect(painelAberto(), 'antes da partida não há pane').toBe(false)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(painelAberto()).toBe(true)
  await relogio.advance(180_000)
  expect(contagem.vivas, 'a leitura ligou').toBeGreaterThan(0)
})

test('F45 t3: marca de outra sessão do app não abre nada', async ($, on) => {
  const marca = { abertos: { local_a: new Date(AGORA - 3_600_000).toISOString() } }
  const certo = engine(on, false, {}, { host: 'local_a', agora: AGORA, store: marca })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(certo.painelAberto(), 'prova: a marca de local_a abriria').toBe(true)
  await certo.relogio.advance(180_000)
  expect(certo.contagem.vivas).toBeGreaterThan(0)
})

test('F45 t3b: com a marca só de local_b, local_a não abre e não lê', async ($, on) => {
  const { relogio, contagem, painelAberto } = engine(on, false, {}, { host: 'local_a', agora: AGORA, store: { abertos: { local_b: new Date(AGORA - 3_600_000).toISOString() } } })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(painelAberto()).toBe(false)
  await relogio.advance(180_000)
  expect(contagem.vivas).toBe(0)
})

test('F45 t4: fechar por /painel apaga a marca e abrir de novo marca', async ($, on) => {
  const { loja } = engine(on, false, {}, { host: 'local_a', agora: AGORA })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run(ABRIR)
  expect(Object.keys(marcas(loja)), 'abriu e marcou').toEqual(['local_a'])
  await $.command.run(ABRIR)
  expect(Object.keys(marcas(loja)), '/painel fechando apaga').toEqual([])
})

test('F45 t4b: a pessoa fechando desmarca; a descarga do mod (unload) não; as funções puras', () => {
  expect(fechamentoDesmarca('person')).toBe(true)
  expect(fechamentoDesmarca('plugin')).toBe(true)
  expect(fechamentoDesmarca('unload')).toBe(false)
  const m = marcar({}, 'local_a', AGORA)
  expect(Object.keys(m), 'marcou').toEqual(['local_a'])
  expect(Object.keys(desmarcar(m, 'local_a'))).toEqual([])
  expect(vencidas({ x: new Date(AGORA - 8 * 86_400_000).toISOString(), y: new Date(AGORA - 1000).toISOString(), z: 'lixo' }, AGORA)).toEqual(['x', 'z'])
})

test('F45 t7: pane reaberto sem lugar não conta como aberto: um /painel basta e a marca fica', async ($, on) => {
  const { loja, painelAberto } = engine(on, false, {}, { host: 'local_a', agora: AGORA, semLugar: true, store: { abertos: { local_a: new Date(AGORA - 3_600_000).toISOString() } } })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(painelAberto(), 'a reabertura sem pedido consta como aberta, sem lugar').toBe(true)
  const r = await $.command.run(ABRIR)
  expect(String((r as { text?: string }).text), 'o /painel abre, não fecha').toMatch(/aberto/)
  expect(String((r as { text?: string }).text)).not.toMatch(/fechado/)
  expect(Object.keys(marcas(loja)), 'a marca continua').toEqual(['local_a'])
})

test('F45 t7b: deveFechar só com o pane colocado', () => {
  expect(deveFechar([{ id: 'painel-sessoes', isPlaced: true }])).toBe(true)
  expect(deveFechar([{ id: 'painel-sessoes', isPlaced: false }])).toBe(false)
  expect(deveFechar([{ id: 'outro', isPlaced: true }])).toBe(false)
  expect(deveFechar([])).toBe(false)
})

test('F45 t5: sem CLAUDE_CODE_HOST_SESSION_ID o /painel funciona e o store não ganha nada', async ($, on) => {
  const { loja, painelAberto } = engine(on, false, {}, { agora: AGORA })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run(ABRIR)
  expect(painelAberto(), 'o pane abriu').toBe(true)
  expect([...loja.keys()]).toEqual([])
})

test('F45 t6: marca com mais de 7 dias é ignorada e removida na partida', async ($, on) => {
  const velha = new Date(AGORA - 8 * 86_400_000).toISOString()
  const nova = new Date(AGORA - 86_400_000).toISOString()
  const { loja, painelAberto } = engine(on, false, {}, { host: 'local_a', agora: AGORA, store: { abertos: { local_a: velha, local_c: nova } } })
  expect(Object.keys(marcas(loja)), 'antes: as duas marcas existem').toEqual(['local_a', 'local_c'])
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(painelAberto()).toBe(false)
  expect(Object.keys(marcas(loja))).toEqual(['local_c'])
})

test('F45: store que falha não derruba a partida nem o /painel', async ($, on) => {
  const { painelAberto } = engine(on, false, {}, { host: 'local_a', agora: AGORA, storeFalha: true })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run(ABRIR)
  expect(painelAberto()).toBe(true)
})

test('o botão da opção grava a resposta presa à versão lida', async ($, on) => {
  const { relogio, escritas } = engine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run(ABRIR)
  await relogio.settle()

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'Q7:b' })
  const primeira = escritas[0] ?? {}
  expect([primeira.path, primeira.doc_id, primeira.version]).toEqual([`${PASTA}/perguntas/Q7.json`, 'Q7', 5])
  expect(primeira.data).toMatchObject({ estado: 'respondida', resposta: 'b', atualizadoEm: '2026-10-23T12:00:00.000Z', titulo: 'qual caminho' })
  // Respondida, ela sai das abertas e entra nas anteriores.
  const lido = (await ui.findAll({})).map(el => String(el.props.alt ?? el.text)).join('\n')
  expect(lido).toMatch(/Perguntas respondidas · 2/)
  expect(await ui.find({ key: 'Q7:b' })).toBeUndefined()
  await ui.unmount()
})

test('F183: o rodapé lê do arquivo só as respondidas hoje (São Paulo), além das fechadas da pasta quente', async ($, on) => {
  const AGORA_SP = Date.UTC(2026, 9, 23, 12) // 09:00 em São Paulo
  const hoje = Date.UTC(2026, 9, 23, 10)
  const ontem = Date.UTC(2026, 9, 22, 20)
  const { relogio } = engine(on, false, {}, {
    agora: AGORA_SP,
    arquivadas: [
      { caminho: 'alfa/2026-10/Q30.json', mtimeMs: hoje, doc: doc('Q30', { projeto: 'alfa', titulo: 'fechada hoje', estado: 'respondida', resposta: 'sim', respondidaEm: new Date(hoje).toISOString() }) },
      { caminho: 'kit/2026-10/Q31.json', mtimeMs: hoje, doc: doc('Q31', { projeto: 'kit', titulo: 'movida hoje, respondida ontem', estado: 'respondida', resposta: 'não', respondidaEm: new Date(ontem).toISOString() }) },
      { caminho: 'kit/2026-10/Q32.json', mtimeMs: ontem, doc: doc('Q32', { projeto: 'kit', titulo: 'de ontem', estado: 'respondida', resposta: 'x', respondidaEm: new Date(ontem).toISOString() }) },
    ],
  })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run(ABRIR)
  await relogio.settle()

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const lido = await lerTudo(ui)
  // Q5 (respondida que ainda está na pasta quente) + Q30 (do arquivo, hoje); Q31 e Q32 são de ontem
  expect(lido).toMatch(/Perguntas respondidas · 2/)
  if (!/Q30/.test(lido)) await ui.press({ key: 'anteriores' })
  const aberto = await lerTudo(ui)
  expect(aberto).toMatch(/Q30 · respondida/)
  expect(aberto).toMatch(/Q5 · respondida/)
  expect(aberto).not.toMatch(/Q31|Q32/)
  await ui.unmount()
})

test('F183: slugDoProjeto do pane dá o mesmo de perguntas-arquivo.mjs (os mesmos casos do teste do painel)', () => {
  expect(R.slugDoProjeto('Alfa')).toBe('alfa')
  expect(R.slugDoProjeto('Meu_Repo.git')).toBe('meu-repo-git')
  expect(R.slugDoProjeto('  kit-de-orquestracao ')).toBe('kit-de-orquestracao')
  expect(R.slugDoProjeto('Loja Azul IA')).toBe('loja-azul-ia')
  expect(R.slugDoProjeto('__')).toBeNull()
  expect(R.slugDoProjeto(undefined)).toBeNull()
})

test('F183: diaEmSP e inicioDoDiaEmSP contam o dia em São Paulo', () => {
  expect(R.diaEmSP(Date.UTC(2026, 10, 1, 1))).toBe('2026-10-31')
  expect(R.diaEmSP(Date.UTC(2026, 10, 1, 3))).toBe('2026-11-01')
  expect(new Date(R.inicioDoDiaEmSP(Date.UTC(2026, 9, 23, 12))).toISOString()).toBe('2026-10-23T03:00:00.000Z')
})

test('erro de leitura aparece no pane, nunca lista vazia calada', async ($, on) => {
  const { relogio } = engine(on, true)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run(ABRIR)
  await relogio.settle()

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await lerSuperficie(ui)).toContain('sem acesso à pasta do painel')
  await ui.unmount()
})

test('sem opções, Sim grava e manda a resposta à sessão que perguntou', async ($, on) => {
  const { relogio, escritas, enviadas } = engine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run(ABRIR)
  await relogio.settle()

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const alt = (await ui.findAll({})).map(el => String(el.props.alt ?? '')).join('\n')
  expect(alt).toMatch(/Q8[^\n]*a develop andou[^\n]*Recomendo: rebasear agora/)
  expect(alt).toMatch(/Q8 · frente B · /)
  await ui.press({ key: 'Q8:sim' })
  expect([escritas[0]?.doc_id, escritas[0]?.version]).toEqual(['Q8', 3])
  expect((escritas[0]?.data as Escrita | undefined)?.resposta).toBe('sim (segue a recomendação)')
  expect(enviadas[0]?.session_id).toBe('local_b')
  expect(String(enviadas[0]?.message)).toMatch(/^Q8 — pergunta aberta POR ESTA SESSÃO/)
  expect(String(enviadas[0]?.message)).toMatch(/resposta do operador pelo painel: sim/i)
  expect(String(enviadas[0]?.message)).toContain('"posso rebasear"')
  expect(String(enviadas[0]?.message)).toContain('Caso: a develop andou.')
  await ui.unmount()
})

test('Responder abre o campo, e o texto vai ao arquivo e à sessão', async ($, on) => {
  const { relogio, escritas, enviadas } = engine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run(ABRIR)
  await relogio.settle()

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ key: 'Q8:outra' })).toBeUndefined()
  await ui.press({ key: 'Q8:responder' })
  expect((await ui.find({ key: 'Q8:outra' }))?.props.rows, 'o campo tem 3 linhas: o fim do texto longo fica à vista').toBe(3)
  await ui.input({ key: 'Q8:outra', text: 'espera o #12' })
  expect((escritas[0]?.data as Escrita | undefined)?.resposta).toBe('espera o #12')
  expect(String(enviadas[0]?.message)).toMatch(/espera o #12/)
  await ui.unmount()
})

test('o botão de anteriores mostra as perguntas fechadas', async ($, on) => {
  const { relogio } = engine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.command.run(ABRIR)
  await relogio.settle()

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const ler = async () =>
      (await ui.findAll({})).map(el => `${el.text} ${String(el.props.alt ?? '')}`).join('\n')
    if (!/Q5/.test(await ler())) await ui.press({ key: 'anteriores' })
    expect(await ler()).toMatch(/Q5 · respondida[^\n]*Resposta: sim/)
    await ui.unmount()
  }
})

const lerTudo = async (ui: { findAll: (q: object) => Promise<Array<{ text: string; props: Record<string, unknown> }>> }) =>
  (await ui.findAll({})).map(el => `${el.text} ${String(el.props.alt ?? '')}`).join('\n')

test('a pergunta da própria sessão entra como prompt dela, não por send_message', async ($, on) => {
  const { relogio, escritas, enviadas, prompts } = engine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run(ABRIR)
  await relogio.settle()

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ key: 'Q9:sim' })).toBeDefined()
  await ui.press({ key: 'Q9:sim' })
  expect([escritas[0]?.doc_id, (escritas[0]?.data as Escrita | undefined)?.estado]).toEqual(['Q9', 'respondida'])
  expect(prompts).toHaveLength(1)
  expect(prompts[0]).toMatch(/^Q9 — pergunta aberta POR ESTA SESSÃO/)
  expect(prompts[0]).toMatch(/resposta do operador pelo painel: sim \(segue a recomendação\)/i)
  expect(enviadas).toEqual([])
  expect(await lerTudo(ui)).not.toMatch(/não chegou/)
  await ui.unmount()
})

test('a pergunta de outra sessão vai por send_message, não como prompt desta', async ($, on) => {
  const { relogio, enviadas, prompts } = engine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run(ABRIR)
  await relogio.settle()

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'Q8:nao' })
  expect([enviadas[0]?.session_id, String(enviadas[0]?.message)]).toEqual(['local_b', expect.stringMatching(/^Q8 — pergunta aberta POR ESTA SESSÃO[\s\S]*resposta do operador pelo painel: não\./)])
  expect(prompts).toEqual([])
  await ui.unmount()
})

test('envio que falha aparece no pane e sobrevive à releitura', async ($, on) => {
  const { relogio, escritas } = engine(on, false, { envio: 'session not found' })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run(ABRIR)
  await relogio.settle()

  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    if (surface === 'desktop') {
      await ui.press({ key: 'Q8:sim' })
      expect(escritas[0]?.doc_id).toBe('Q8')
      await relogio.advance(60_000)
    }
    expect(await lerTudo(ui)).toMatch(/Q8 gravada, mas não chegou à sessão \(session not found\)/)
    await ui.unmount()
  }
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'avisos:limpar' })
  expect(await lerTudo(ui)).not.toMatch(/não chegou/)
  await ui.unmount()
})

test('prompt recusado e pergunta sem sessaoId também viram aviso', async ($, on) => {
  const { relogio } = engine(on, false, { prompt: 'bloqueado por hook' })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run(ABRIR)
  await relogio.settle()

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'Q9:sim' })
  await ui.press({ key: 'Q7:a' })
  const lido = await lerTudo(ui)
  expect(lido).toMatch(/Q9 gravada, mas não chegou à sessão \(bloqueado por hook\)/)
  expect(lido).toMatch(/Q7 gravada, mas não chegou à sessão \(a pergunta não tem sessaoId\)/)
  await ui.unmount()
})

const itemBase = { id: 'F9', titulo: 'Canvas', tema: 'editor', temaRotulo: 'Editor da loja', etapa: 'execucao', situacao: 'andando' as const, prs: [1128], depois: [], com: [], perguntas: ['Q225'], dono: { apelido: 'E3', localId: 'local_x' } }
const luz = (h: string): number => {
  const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))

  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!
}
const razao = (a: string, b: string): number => {
  const [x, y] = [luz(a), luz(b)]

  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
const regras = (css: string): Record<string, string> =>
  Object.fromEntries([...css.matchAll(/\.(\w+)\{(?:fill|stroke):(#[0-9a-f]{6})\}/g)].map(m => [m[1]!, m[2]!]))

test('contraste: cada cor de texto passa de 4,5:1 sobre o fundo e o bloco, nos dois temas', () => {
  const css = itemSvg(360, itemBase, AGORA).source.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? ''
  const [claro = '', escuro = ''] = css.split('@media (prefers-color-scheme: dark)')
  const tema = { claro: regras(claro), escuro: regras(escuro) }
  const fundos = { claro: ['#ffffff', '#f4f3f0', '#fbf6ec'], escuro: ['#1b1b1d', '#262625', '#2a251b'] }
  for (const t of ['claro', 'escuro'] as const) {
    for (const classe of ['av', 'er', 'an', 'ok', 'li', 'm', 's', 't']) {
      const cor = tema[t][classe]
      expect(cor, `a classe ${classe} existe no tema ${t}`).toBeTruthy()
      for (const f of fundos[t]) expect(razao(cor!, f), `${classe} ${cor} sobre ${f} (${t})`).toBeGreaterThanOrEqual(4.5)
    }
  }
  // O Q-ID da pílula: texto `pt` sobre o fundo `av`, nos dois temas.
  for (const t of ['claro', 'escuro'] as const) expect(razao(tema[t].pt!, tema[t].av!)).toBeGreaterThanOrEqual(4.5)
})

test('nenhum texto leva cor fixa: tudo passa por classe de tema', () => {
  const q = { id: 'Q225', projeto: 'p', sessao: 's', titulo: 'Pergunta', opcoes: [], rotulo: 'F27' } as never
  const fontes = [
    itemSvg(360, { ...itemBase, trava: { motivo: 'decisao', texto: 'precisa de você' } }, AGORA).source,
    itemSvg(360, { ...itemBase, situacao: 'fila' as const }, AGORA).source,
    perguntaSvg(360, q).source,
    resumoSvg(360, [{ rotulo: 'A', n: 1, cor: 'av' }]).source,
  ]
  for (const f of fontes) {
    expect(f, 'o desenho não pode vir vazio').toBeTruthy()
    const corpo = f.replace(/<style>[\s\S]*?<\/style>/, '')
    expect(corpo.match(/<text[^>]*fill="#/g) ?? [], 'texto com fill hex').toEqual([])
  }
})

test('trava sem ninguém: escreve "Trava (sem ninguém)" e o dono não se repete na linha 2', () => {
  const item = { ...itemBase, perguntas: [], situacao: 'travado' as const, trava: { motivo: 'sem-ninguem', texto: 'E3 não está mais ativa' } }
  const r = itemSvg(360, item, AGORA, { noTravados: true })
  expect(r.source, 'o desenho não pode vir vazio').toBeTruthy()
  expect(r.source).toContain('Trava (sem ninguém): E3 não está mais ativa')
  expect(r.source).not.toContain('sem-ninguem')
  expect(r.source.match(/E3/g)?.length, 'o apelido aparece uma vez só').toBe(1)
  expect(r.alt.match(/E3/g)?.length).toBe(1)
  const comOutra = itemSvg(360, { ...item, trava: { motivo: 'decisao', texto: 'espera você' } }, AGORA)
  expect(comOutra.source).toContain(' · E3</tspan>')
})

test('o título que não cabe em duas linhas corta em palavra inteira, em qualquer largura', () => {
  const titulo = 'Migrar a fila para o formato novo e avisar o projeto derivado do git quando faltar o campo'
  const palavras = new Set(titulo.split(' '))
  let cortados = 0
  for (const W of [280, 300, 320, 340, 360, 380, 400, 420]) {
    const r = itemSvg(W, { ...itemBase, titulo }, AGORA)
    const linhas = [...r.source.matchAll(/font-size="16"[^>]*>([^<]*)</g)].map(m => m[1]!)
    expect(linhas.length, `o título tem duas linhas a ${W} px`).toBe(2)
    const ultima = linhas[1]!
    if (!ultima.endsWith('…')) continue
    cortados++
    const sobra = ultima.slice(0, -1).split(' ').pop()!
    expect(palavras.has(sobra), `a ${W} px "${sobra}" é palavra do título`).toBe(true)
  }
  expect(cortados, 'ao menos uma largura corta o título').toBeGreaterThan(0)
})

const TEMAS_T = [{ id: 'editor', rotulo: 'Editor da loja' }]
const docF = (id: string, data: Record<string, unknown>) => ({ id, data: { titulo: id, tema: 'editor', ...data } })
const monta = (docs: ReturnType<typeof docF>[], vivas: Array<{ sessionId: string; isArchived?: boolean }> | null = []) =>
  montarItens(docs, TEMAS_T, vivas as never, undefined, [], AGORA)

test('etapa fora da lista, ou sem etapa, manda o item para "Sem tema" mesmo com tema válido', () => {
  const itens = monta([docF('F1', { etapa: 'andando' }), docF('F2', {}), docF('F3', { etapa: 'planejamento' })])
  expect(itens.length, 'a montagem não pode vir vazia').toBe(3)
  const por = Object.fromEntries(itens.map(i => [i.id, i]))
  expect(por.F1!.tema).toBe('sem-tema')
  expect(por.F1!.foraDoContrato).toMatch(/etapa 'andando' fora da lista/)
  expect(por.F2!.tema).toBe('sem-tema')
  expect(por.F2!.foraDoContrato).toMatch(/sem etapa/)
  expect(por.F3!.tema, 'o item em ordem fica no tema').toBe('editor')
  expect(por.F3!.foraDoContrato).toBeUndefined()
})

test('dono pela metade não vira "Na fila" calado: sai fora do contrato, em "Sem tema"', () => {
  const itens = monta([docF('F1', { etapa: 'execucao', donoApelido: 'E9' }), docF('F2', { etapa: 'execucao', donoLocalId: 'local_x' })])
  expect(itens.length).toBe(2)
  expect(itens[0]!.foraDoContrato).toMatch(/dono 'E9' sem donoLocalId/)
  expect(itens[1]!.foraDoContrato).toMatch(/donoLocalId sem donoApelido/)
  for (const i of itens) expect(i.tema).toBe('sem-tema')
})

test('dono em sessão arquivada não conta como vivo', () => {
  const dono = { etapa: 'execucao', donoApelido: 'E1', donoLocalId: 'local_arq' }
  const arquivada = monta([docF('F1', dono)], [{ sessionId: 'local_arq', isArchived: true }])
  expect(arquivada[0]!.situacao).toBe('travado')
  expect(arquivada[0]!.trava?.motivo).toBe('sem-ninguem')
  const viva = monta([docF('F1', dono)], [{ sessionId: 'local_arq', isArchived: false }])
  expect(viva[0]!.situacao).toBe('andando')
})

test('palavra comprida na 1ª linha do título quebra depois do hífen, não no meio da letra', () => {
  const titulo = 'Reconciliação-automática-de-migrations-pendentes em produção'
  for (const W of [300, 360, 420]) {
    const r = itemSvg(W, { ...itemBase, titulo, atualizadoEm: new Date(AGORA - 5 * 3600e3).toISOString() }, AGORA)
    const linhas = [...r.source.matchAll(/font-size="16"[^>]*>([^<]*)</g)].map(m => m[1]!)
    expect(linhas.length, `o título tem duas linhas a ${W} px`).toBe(2)
    expect(linhas[0]!.endsWith('-'), `a 1ª linha a ${W} px termina em hífen: "${linhas[0]}"`).toBe(true)
    expect(titulo.replace(/\s/g, '').startsWith(linhas.join('').replace(/…$/, '').replace(/\s/g, '')), 'nenhuma letra some nem muda').toBe(true)
  }
})

test('dois projetos com o tema "geral" são dois grupos, cada item uma vez, e o rótulo repetido ganha o projeto (V3)', () => {
  const temas = [
    { id: 'geral', rotulo: 'Geral', projeto: 'novo' },
    { id: 'geral', rotulo: 'Geral', projeto: 'alfa' },
    { id: 'kit', rotulo: 'Kit', projeto: 'alfa' },
  ]
  const docs = [
    { id: 'F1', data: { titulo: 'F1', tema: 'geral', projeto: 'novo', etapa: 'planejamento' } },
    { id: 'F2', data: { titulo: 'F2', tema: 'geral', projeto: 'alfa', etapa: 'planejamento' } },
    { id: 'F3', data: { titulo: 'F3', tema: 'kit', projeto: 'alfa', etapa: 'planejamento' } },
  ]
  const itens = montarItens(docs, temas, [], undefined, [], AGORA)
  expect(itens.length, 'a montagem não pode vir vazia').toBe(3)
  expect(itens.map(i => i.foraDoContrato).filter(Boolean), 'nenhum item sai do contrato').toEqual([])
  const grupos = porTema(itens, temas, (a, b) => a.id.localeCompare(b.id))
  expect(grupos.length, 'um grupo por (projeto, id)').toBe(3)
  expect(grupos.map(g => g.itens.map(i => i.id).join())).toEqual(['F1', 'F2', 'F3'])
  expect(grupos.map(g => g.rotulo)).toEqual(['Geral · novo', 'Geral · alfa', 'Kit'])
})

test('com um só projeto, o rótulo do tema não ganha sufixo', () => {
  const temas = [{ id: 'geral', rotulo: 'Geral', projeto: 'alfa' }]
  const itens = montarItens([{ id: 'F1', data: { titulo: 'F1', tema: 'geral', projeto: 'alfa', etapa: 'planejamento' } }], temas, [], undefined, [], AGORA)
  expect(itens.length).toBe(1)
  expect(itens[0]!.tema).toBe('geral')
  expect(porTema(itens, temas, () => 0).map(g => g.rotulo)).toEqual(['Geral'])
})

test('c19: item legado sem projeto não vai para o geral do primeiro projeto: cai em "Sem tema" com o motivo; tema global ainda casa', () => {
  const temas = [{ id: 'geral', rotulo: 'Geral', projeto: 'alfa' }, { id: 'glob', rotulo: 'Global' }]
  const itens = montarItens([
    { id: 'F1', data: { titulo: 'F1', tema: 'geral', etapa: 'planejamento' } },
    { id: 'F2', data: { titulo: 'F2', tema: 'glob', etapa: 'planejamento' } },
  ], temas, [], undefined, [], AGORA)
  expect(itens.length, 'a montagem não pode vir vazia').toBe(2)
  const por = Object.fromEntries(itens.map(i => [i.id, i]))
  expect(por.F2!.tema, 'o tema global casa (prova que a montagem acha tema)').toBe('glob')
  expect(por.F1!.tema).toBe('sem-tema')
  expect(por.F1!.foraDoContrato).toMatch(/item sem projeto: tema de outro projeto \('geral'\)/)
})

test('c19: tema que existe, mas é de outro projeto, diz "tema de outro projeto" e não "fora da lista"', () => {
  const temas = [{ id: 'kit', rotulo: 'Kit', projeto: 'alfa' }]
  const itens = montarItens([
    { id: 'F1', data: { titulo: 'F1', tema: 'kit', projeto: 'novo', etapa: 'planejamento' } },
    { id: 'F2', data: { titulo: 'F2', tema: 'nada', projeto: 'novo', etapa: 'planejamento' } },
  ], temas, [], undefined, [], AGORA)
  expect(itens.length).toBe(2)
  const por = Object.fromEntries(itens.map(i => [i.id, i]))
  expect(por.F1!.foraDoContrato).toMatch(/tema de outro projeto \('kit'\)/)
  expect(por.F1!.foraDoContrato).not.toMatch(/fora da lista/)
  expect(por.F2!.foraDoContrato, 'tema que não existe em lugar nenhum continua "fora da lista"').toMatch(/tema 'nada' fora da lista/)
})

const abrirDe = async (opc: Opcoes, $: Parameters<TestBody>[0], on: On, falhas: Falhas = {}) => {
  const motor = engine(on, false, falhas, { agora: AGORA, fila: fila('F27', 'F1'), vivas: vivasDe(P7, P1), perguntas: [], ...opc })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run(ABRIR)
  await motor.relogio.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })

  return { ...motor, ui }
}

test('abrir: o botão só existe com dono vivo, e o endereço não aparece escrito', async ($, on) => {
  const { ui } = await abrirDe({}, $, on)
  expect(await ui.find({ key: `abrir:F27:${P7}` }), 'dono vivo tem botão').toBeDefined()
  expect(await ui.find({ key: `abrir:F1:${P1}` })).toBeDefined()
  expect(await lerSuperficie(ui)).not.toMatch(/claude:\/\//)
  await ui.unmount()
})

test('abrir: dono fora da lista de sessões vivas não tem botão', async ($, on) => {
  const morto = await abrirDe({ vivas: vivasDe(P1) }, $, on)
  expect(await morto.ui.find({ key: `abrir:F27:${P7}` }), 'dono fora da lista: sem botão').toBeUndefined()
  expect(await morto.ui.find({ key: `abrir:F1:${P1}` })).toBeDefined()
  await morto.ui.unmount()
})

test('abrir: o clique pede open_session_in com o localId e foco, e não copia nada quando abre', async ($, on) => {
  const { ui, abertas, copiadas, toasts } = await abrirDe({}, $, on)
  await ui.press({ key: `abrir:F27:${P7}` })
  expect(abertas.length, 'o clique chamou a tool').toBe(1)
  expect([abertas[0]?.session_id, abertas[0]?.target]).toEqual([P7, 'focus'])
  expect(copiadas).toEqual([])
  expect(toasts).toEqual([])
  await ui.unmount()
})

const copiaAoFalhar = (abrirFalha: string) => async ($: Parameters<TestBody>[0], on: On) => {
  const { ui, copiadas, toasts } = await abrirDe({ abrirFalha }, $, on)
  await ui.press({ key: `abrir:F27:${P7}` })
  expect(copiadas.length, `${abrirFalha}: copiou`).toBe(1)
  expect(copiadas[0]?.text).toBe(`claude://claude.ai/epitaxy/${P7}`)
  expect(toasts.join('\n')).toMatch(/não deu para abrir daqui .*endereço de P7 copiado/)
  await ui.unmount()
}

test('abrir: recusa da tool copia o endereço e diz o que houve', copiaAoFalhar('deny'))
test('abrir: erro da tool copia o endereço e diz o que houve', copiaAoFalhar('sessão não achada'))

test('abrir: copia que não pegou não diz "copiado" e mostra o endereço', async ($, on) => {
  const { ui, copiadas, toasts } = await abrirDe({ abrirFalha: 'deny', copiaFalha: true }, $, on)
  await ui.press({ key: `abrir:F27:${P7}` })
  expect(copiadas.length, 'tentou copiar').toBe(1)
  const t = toasts.join('\n')
  expect(t.length, 'houve aviso').toBeGreaterThan(0)
  expect(t).not.toMatch(/copiado/)
  expect(t).toMatch(/nem copiar/)
  expect(t).toContain(`claude://claude.ai/epitaxy/${P7}`)
  await ui.unmount()
})

test('abrir: com o list_sessions falho nenhum botão aparece', async ($, on) => {
  const { ui } = await abrirDe({ listaFalha: true }, $, on)
  expect(await ui.find({ key: `abrir:F27:${P7}` }), 'sem a lista, sem botão').toBeUndefined()
  expect(await ui.find({ key: `abrir:F1:${P1}` })).toBeUndefined()
  await ui.unmount()
})

// F30 fatia 3: o `com` (quem trabalha agora no item) e a `espera` (o operador ou o gate).
const COM = (...c: Array<[string, string]>) => c.map(([apelido, localId]) => ({ apelido, localId, oQue: `trabalho de ${apelido}` }))
const comDuas = (extra: Record<string, unknown> = {}) => ({ F27: { ...FILA_REAL.F27, com: COM(['P2', P2], ['E8', E8]), ...extra } })

test('com: duas sessões vivas aparecem na linha 2 e cada uma ganha o seu "abrir", além do dono', async ($, on) => {
  const { ui } = await abrirDe({ fila: comDuas(), vivas: vivasDe(P7, P2, E8) }, $, on)
  for (const id of [P2, E8, P7]) expect(await ui.find({ key: `abrir:F27:${id}` }), `botão de ${id}`).toBeDefined()
  expect(await ui.findAll({ key: `abrir:F27:${P2}` }), 'um botão só por sessão').toHaveLength(1)
  const texto = await lerSuperficie(ui)
  expect(texto).toMatch(/P2, trabalhando agora — E8, trabalhando agora/)
  expect(texto, 'com `com` o dono deixa a linha 2').not.toMatch(/execução · P7/)
  await ui.unmount()
})

test('com: quem saiu da lista vem cinza com "saiu" depois do PR, sem botão e sem virar trava', async ($, on) => {
  const { ui } = await abrirDe({ fila: comDuas(), vivas: vivasDe(P7, P2) }, $, on)
  expect(await ui.find({ key: `abrir:F27:${E8}` }), 'sem botão para quem saiu').toBeUndefined()
  expect(await ui.find({ key: `abrir:F27:${P2}` })).toBeDefined()
  const texto = await lerSuperficie(ui)
  expect(texto).toMatch(/P2, trabalhando agora — E8 saiu/)
  expect(texto, 'sem o ponto do meio, "saiu" não vira um terceiro nome').not.toMatch(/ · saiu/)
  expect(texto).not.toMatch(/Trava \(/)
  await ui.unmount()
  const itens = montarItens([docF('F1', { etapa: 'execucao', donoApelido: 'P7', donoLocalId: P7, com: COM(['E8', E8]) })], TEMAS_T, [{ sessionId: P7 }] as never, undefined, [], AGORA)
  expect(itens.length).toBe(1)
  expect([itens[0]!.situacao, itens[0]!.com[0]!.vivo, itens[0]!.trava]).toEqual(['andando', false, undefined])
})

test('com: sem a lista de sessões não há botão nem "saiu" (não se sabe quem saiu)', async ($, on) => {
  const { ui } = await abrirDe({ fila: comDuas(), listaFalha: true }, $, on)
  expect(await ui.find({ key: `abrir:F27:${P2}` })).toBeUndefined()
  expect(await lerSuperficie(ui)).not.toMatch(/saiu/)
  await ui.unmount()
})

const ESPERA = (motivo: string, texto: string) => ({ motivo, texto })

test('espera do operador: selo "espera você" e entra na contagem "Esperam você"', async ($, on) => {
  const fila = { F13: { ...FILA_REAL.F13, espera: ESPERA('operador', 'decidir o nome do botão') } }
  const { lido } = await lerPane($, on, { fila, perguntas: [], vivas: vivasDe(P2) })
  for (const surface of ['terminal', 'desktop'] as const) {
    expect(lido[surface]).toMatch(/espera você/i)
    expect(lido[surface]).toMatch(/decidir o nome do botão/)
    expect(lido[surface], 'a espera não é trava').not.toMatch(/Trava \(/)
  }
  expect(lido.desktop, 'o item que espera sem pergunta conta uma vez só: em Esperam você, e não em Executando').toMatch(/1 Esperam você, 0 Travados, 0 Executando, 0 Na fila/)
})

test('espera do gate: selo "espera o gate" e nenhuma contagem', async ($, on) => {
  const fila = { F13: { ...FILA_REAL.F13, espera: ESPERA('gate', 'gate do lote na develop') } }
  const { lido } = await lerPane($, on, { fila, perguntas: [], vivas: vivasDe(P2) })
  expect(lido.desktop).toMatch(/espera o gate/)
  expect(lido.desktop).toMatch(/gate do lote na develop/)
  expect(lido.desktop).toMatch(/0 Esperam você, 0 Travados, 1 Executando, 0 Na fila/)
})

test('espera do operador no item que também tem pergunta aberta conta uma vez só', async ($, on) => {
  const fila = { F13: { ...FILA_REAL.F13, perguntas: ['Q7'], espera: ESPERA('operador', 'a pergunta Q7') } }
  const { lido } = await lerPane($, on, { fila, perguntas: [PERGUNTAS[0]!], vivas: vivasDe(P2) })
  expect(lido.desktop).toMatch(/1 Esperam você, 0 Travados, 1 Executando, 0 Na fila/)
  expect(lido.desktop).toMatch(/aguarda você · Q7/)
  expect(lido.desktop, 'o selo "espera você" não repete o "aguarda você" da pergunta').not.toMatch(/ · espera você/)
  expect(lido.desktop.match(/Espera você:/g) ?? [], 'o rótulo da espera aparece uma vez só, no texto').toHaveLength(1)
})

test('o item com espera fica no bloco do tema, não em "Travados"', async ($, on) => {
  const fila = { F13: { ...FILA_REAL.F13, espera: ESPERA('operador', 'decidir') } }
  const { lido } = await lerPane($, on, { fila, perguntas: [], vivas: vivasDe(P2) })
  expect(lido.desktop).toMatch(/Editor da loja/i)
  expect(lido.desktop).not.toMatch(/Travados · [1-9]/)
})

test('a 300 px os selos de espera e o com cabem inteiros na linha 2', () => {
  const base = { ...itemBase, perguntas: [], dono: undefined, prs: [], com: [{ apelido: 'E1', localId: 'local_a', oQue: 'x', vivo: true }, { apelido: 'V4', localId: 'local_b', oQue: 'y', vivo: true }] }
  for (const [motivo, selo] of [['operador', 'espera você'], ['gate', 'espera o gate']] as const) {
    const r = itemSvg(300, { ...base, espera: { motivo, texto: 'precisa de uma resposta' } }, AGORA)
    expect(r.source, 'o desenho não pode vir vazio').toBeTruthy()
    expect(r.source).toContain(selo)
    expect(r.source.replace(/<[^>]*>/g, '')).toContain('E1 · V4')
    expect(r.source).not.toMatch(/[^<]*…<\/tspan>/)
    expect(r.source).toContain('precisa de uma resposta')
  }
})

test('a 300 px o PR entra inteiro: com muita gente as pessoas encolhem antes ("E1 +2")', () => {
  const pessoa = (apelido: string) => ({ apelido, localId: `local_${apelido}`, oQue: 'x', vivo: true })
  const base = { ...itemBase, perguntas: [], dono: undefined, prs: [1128], com: [pessoa('E1'), pessoa('E2'), pessoa('V4')], espera: { motivo: 'operador' as const, texto: 'decidir' } }
  const r = itemSvg(300, base, AGORA)
  const texto = r.source.replace(/<[^>]*>/g, '')
  expect(texto).toContain('#1128')
  expect(texto).toContain('E1 +2')
  expect(texto).not.toMatch(/#1…/)
  expect(r.alt).toContain('E2')
})

test('espera do gate fica neutra e a do operador âmbar; a espera aparece uma vez só (selo + texto, sem rótulo repetido)', () => {
  const base = { ...itemBase, perguntas: [], com: [] }
  const gate = itemSvg(360, { ...base, espera: { motivo: 'gate', texto: 'lote na develop' } }, AGORA)
  const op = itemSvg(360, { ...base, espera: { motivo: 'operador', texto: 'escolher o nome' } }, AGORA)
  expect(gate.source).toMatch(/>lote na develop</)
  expect(op.source).toMatch(/>escolher o nome</)
  expect(op.source, 'o rótulo da espera não repete o selo').not.toMatch(/Espera você:/)
  expect(gate.source).not.toMatch(/Espera o gate:/)
  expect(op.source).toMatch(/class="av"[^>]*font-weight="600"> · espera você/)
  expect(gate.source).not.toMatch(/class="av"[^>]*> · espera o gate/)
  expect(op.alt).toContain('Espera você: escolher o nome')
})

test('a 300 px o texto da espera não quebra e deixa palavra sozinha', () => {
  const base = { ...itemBase, perguntas: [], com: [{ apelido: 'E1', localId: 'local_a', oQue: 'x', vivo: true }, { apelido: 'V4', localId: 'local_b', oQue: 'y', vivo: true }] }
  for (const texto of ['escolher o nome do botão do componente', 'esperar o gate do lote na develop']) {
    const r = itemSvg(300, { ...base, espera: { motivo: 'operador', texto } }, AGORA)
    expect(r.source.match(new RegExp(`>${texto}<`))?.length, `${texto}: numa linha só`).toBe(1)
  }
})

test('com todo morto a linha 2 e o alt mostram o dono; com gente viva o dono fica no alt', () => {
  const morto = { apelido: 'E1', localId: 'local_a', oQue: 'x', vivo: false as boolean | null }
  const dono = { apelido: 'P7', localId: 'local_p' }
  const base = { ...itemBase, perguntas: [], prs: [12], dono }
  const todosMortos = itemSvg(360, { ...base, com: [morto] }, AGORA)
  expect(todosMortos.source.replace(/<[^>]*>/g, '')).toMatch(/execução · P7 · #12 · E1 saiu/)
  expect(todosMortos.alt).toContain('P7')
  const viva = itemSvg(360, { ...base, com: [{ ...morto, vivo: true }] }, AGORA)
  expect(viva.source.replace(/<[^>]*>/g, '')).not.toMatch(/P7/)
  expect(viva.alt, 'o dono não some do alt').toContain('dono P7')
})

test('abrir: o dono que também está no com ganha um botão só', async ($, on) => {
  const fila = { F27: { ...FILA_REAL.F27, com: COM(['P7', P7], ['P2', P2]) } }
  const { ui } = await abrirDe({ fila, vivas: vivasDe(P7, P2) }, $, on)
  expect(await ui.findAll({ key: `abrir:F27:${P7}` }), 'um botão só para o P7').toHaveLength(1)
  expect(await ui.findAll({ key: `abrir:F27:${P2}` })).toHaveLength(1)
  await ui.unmount()
})

test('espera: item final não a guarda e item travado não a mostra (trava vence)', () => {
  const espera = { motivo: 'operador', texto: 'decidir' }
  const itens = montarItens(
    [
      docF('F1', { etapa: 'feito', feitoEm: new Date(AGORA - 3600e3).toISOString(), espera }),
      docF('F2', { etapa: 'execucao', donoApelido: 'E9', donoLocalId: 'local_sumida', espera }),
      docF('F3', { etapa: 'execucao', donoApelido: 'E8', donoLocalId: E8, espera }),
    ],
    TEMAS_T,
    [{ sessionId: E8 }] as never,
    undefined,
    [],
    AGORA,
  )
  const por = Object.fromEntries(itens.map(i => [i.id, i]))
  expect(itens.length, 'os três itens vieram').toBe(3)
  expect(por.F1!.espera, 'item final').toBeUndefined()
  expect([por.F2!.situacao, por.F2!.espera], 'travado').toEqual(['travado', undefined])
  expect(por.F3!.espera?.motivo, 'andando mantém').toBe('operador')
  const selo = itemSvg(360, { ...itemBase, perguntas: [], com: [], situacao: 'travado', espera: { motivo: 'gate', texto: 'x' }, trava: { motivo: 'decisao', texto: 'y' } }, AGORA)
  expect(selo.source).not.toMatch(/espera o gate/)
})

test('com botões, o filete do item vem depois deles', () => {
  const sem = itemSvg(360, { ...itemBase, com: [] }, AGORA, { filete: false })
  const com = itemSvg(360, { ...itemBase, com: [] }, AGORA)
  expect(com.source).toContain('class="ln"')
  expect(sem.source).not.toContain('class="ln"')
})

// F34 fatia 1: as quatro seções, o papel, a situação da sessão e a leitura parada.
type Linha = Parameters<typeof contarSecoes>[0][number]
const linha = (id: string, extra: Partial<Linha> = {}): Linha => ({ id, titulo: id, tema: 'editor', temaRotulo: 'Editor da loja', etapa: 'execucao', situacao: 'andando', prs: [], depois: [], com: [], perguntas: [], ...extra })
const perguntaAberta = (id: string, item?: string) => ({ id, projeto: 'alfa', sessao: 's', titulo: id, item, opcoes: [] })
const TEMAS_S = [{ id: 'editor', rotulo: 'Editor da loja' }]
const ESPERA_OP = { motivo: 'operador' as const, texto: 'decidir' }
const CENARIOS = {
  vazio: { itens: [] as Linha[], perguntas: [] as ReturnType<typeof perguntaAberta>[] },
  misto: {
    itens: [
      linha('F1'),
      linha('F2', { espera: ESPERA_OP }),
      linha('F3', { espera: ESPERA_OP, perguntas: ['Q1'] }),
      linha('F4', { situacao: 'fila' }),
      linha('F5', { situacao: 'fila', espera: ESPERA_OP }),
      linha('F6', { situacao: 'travado', trava: { motivo: 'conflito', texto: 't' } }),
      linha('F7', { situacao: 'feito' }),
      linha('F8', { espera: { motivo: 'gate' as const, texto: 'gate' } }),
    ],
    perguntas: [perguntaAberta('Q1', 'F3'), perguntaAberta('Q2')],
  },
}

test('F34-1: contarSecoes é igual às listas de secoes em todo cenário, e o cenário não é vazio', () => {
  expect(CENARIOS.misto.itens.length, 'o cenário tem itens').toBeGreaterThan(0)
  for (const [nome, c] of Object.entries(CENARIOS)) {
    const n = contarSecoes(c.itens, c.perguntas)
    const sec = secoes(c.itens, TEMAS_S)
    expect([n.travados, n.executando, n.fila], nome).toEqual([sec.travados.length, sec.executando.length, sec.fila.length])
    expect(n.esperam, nome).toBe(c.perguntas.length + sec.esperam.length)
  }
  expect(contarSecoes(CENARIOS.misto.itens, CENARIOS.misto.perguntas)).toEqual({ esperam: 4, travados: 1, executando: 3, fila: 1 })
})

test('F34-1: o item que espera o operador sem pergunta aparece em esperam, e não em executando', () => {
  const sec = secoes(CENARIOS.misto.itens, TEMAS_S)
  expect(sec.esperam.map(i => i.id), 'esperam traz o item da sessão e o da fila').toEqual(['F2', 'F5'])
  expect(sec.executando.map(i => i.id)).not.toContain('F2')
  expect(sec.fila.map(i => i.id)).not.toContain('F5')
  expect(sec.executando.map(i => i.id), 'espera de gate continua executando').toContain('F8')
})

test('F34-1: o item que espera o operador e tem pergunta aberta é contado uma vez só', () => {
  const c = CENARIOS.misto
  const sec = secoes(c.itens, TEMAS_S)
  expect(sec.esperam.map(i => i.id), 'F3 não vai à lista, a pergunta dele já está').not.toContain('F3')
  expect(sec.executando.map(i => i.id), 'F3 segue executando').toContain('F3')
  expect(contarSecoes(c.itens, c.perguntas).esperam, '2 perguntas + F2 + F5, e F3 só na pergunta Q1').toBe(4)
})

test('F34-1: as quatro listas vêm na ordem dos temas de temas.json, com o tema como campo', () => {
  const temas = [{ id: 'motor', rotulo: 'Motor' }, { id: 'editor', rotulo: 'Editor' }]
  const itens = [linha('F1', { tema: 'editor' }), linha('F2', { tema: 'motor' }), linha('F3', { tema: 'editor' })]
  const sec = secoes(itens, temas)
  expect(sec.executando.length, 'há o que examinar').toBe(3)
  expect(sec.executando.map(i => i.id)).toEqual(['F2', 'F1', 'F3'])
  expect(sec.executando.map(i => i.tema)).toEqual(['motor', 'editor', 'editor'])
})

test('F34-1: papelDe diz dona (pelo apelido ou pelo F<n>) e orquestradora, e undefined para qualquer outro', () => {
  expect([papelDe('dona'), papelDe('F12'), papelDe('🎛'), papelDe('orquestradora')]).toEqual(['dona', 'dona', 'orquestradora', 'orquestradora'])
  expect([papelDe('E3'), papelDe('P1'), papelDe('c20')]).toEqual([undefined, undefined, undefined])
  expect(papelDe('')).toBeUndefined()
})

test('F34-1: situacaoDe diz trabalhando agora, parada há X e sem leitura da sessão', () => {
  const agora = AGORA
  const vivas = [
    { sessionId: 'local_a', isRunning: true, lastActivityAt: new Date(agora - 60_000).toISOString() },
    { sessionId: 'local_b', isRunning: false, lastActivityAt: new Date(agora - 12 * 60_000).toISOString() },
  ]
  expect(vivas.length).toBeGreaterThan(0)
  expect(situacaoDe('local_a', vivas, undefined, false, agora)).toBe('trabalhando agora')
  expect(situacaoDe('local_b', vivas, undefined, false, agora)).toBe('parada há 12 min')
  expect(situacaoDe('local_a', vivas, undefined, true, agora), 'a leitura falhou').toBe('sem leitura da sessão')
  expect(situacaoDe('local_eu', vivas, { sessionId: 'local_eu', isRunning: true }, false, agora), 'a própria sessão vem do self').toBe('trabalhando agora')
  expect(situacaoDe('local_x', vivas, undefined, false, agora), 'fora da lista não inventa situação').toBeUndefined()
})

test('F34-1: a leitura em 179 s não está parada, e em 181 s está', () => {
  expect(leituraParada(AGORA - 179_000, AGORA)).toBe(false)
  expect(leituraParada(AGORA - 181_000, AGORA)).toBe(true)
  expect(leituraParada(null, AGORA), 'sem leitura ainda está começando').toBe(false)
})

test('F34-2: esperaOperadorSemPergunta exclui o feito, o travado, a pergunta aberta e a espera do gate', () => {
  const casos: Array<[string, Linha, boolean]> = [
    ['andando que espera o operador', linha('F1', { espera: ESPERA_OP }), true],
    ['na fila que espera o operador', linha('F2', { situacao: 'fila', espera: ESPERA_OP }), true],
    ['feito', linha('F3', { situacao: 'feito', espera: ESPERA_OP }), false],
    ['travado: o erro vem antes, fica só em Travados', linha('F4', { situacao: 'travado', espera: ESPERA_OP, trava: { motivo: 'conflito', texto: 't' } }), false],
    ['com pergunta aberta: a pergunta já conta', linha('F5', { espera: ESPERA_OP, perguntas: ['Q1'] }), false],
    ['espera do gate', linha('F6', { espera: { motivo: 'gate', texto: 'g' } }), false],
    ['sem espera', linha('F7'), false],
  ]
  expect(casos.length, 'há o que examinar').toBeGreaterThan(0)
  for (const [nome, item, esperado] of casos) expect(esperaOperadorSemPergunta(item), nome).toBe(esperado)
  const travado = linha('F4', { situacao: 'travado', espera: ESPERA_OP, trava: { motivo: 'conflito', texto: 't' } })
  expect(contarSecoes([travado], []), 'o travado conta em Travados e em mais nenhuma seção').toEqual({ esperam: 0, travados: 1, executando: 0, fila: 0 })
})

test('F34-2: o item feito não entra em Esperam você, nem na contagem', () => {
  const feito = linha('F1', { situacao: 'feito', espera: ESPERA_OP })
  expect(feito.espera, 'o feito tem espera gravada').toBeDefined()
  expect(contarSecoes([feito], [])).toEqual({ esperam: 0, travados: 0, executando: 0, fila: 0 })
  expect(secoes([feito], TEMAS_S).esperam).toEqual([])
})

// F34 fatia 2: o desenho em cartões. O texto de linha única é medido com o mesmo `largura` que o desenho usa para cortar.
const LARGURA_PANE = 292
const textosDe = (source: string) =>
  [...source.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)].map(m => {
    const a = m[1]!
    const num = (n: string) => Number(a.match(new RegExp(`\\b${n}="([\\d.]+)"`))?.[1])
    const conteudo = m[2]!.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&')

    return { x: num('x'), tam: num('font-size'), ancora: a.match(/text-anchor="(\w+)"/)?.[1] ?? 'start', conteudo }
  })
const sobraDe = (source: string, W: number) => {
  const textos = textosDe(source)
  expect(textos.length, 'o desenho tem texto').toBeGreaterThan(0)

  return textos.filter(t => {
    const w = largura(t.conteudo, t.tam)
    const [de, ate] = t.ancora === 'end' ? [t.x - w, t.x] : t.ancora === 'middle' ? [t.x - w / 2, t.x + w / 2] : [t.x, t.x + w]

    return de < -0.01 || ate > W + 0.01
  }).map(t => t.conteudo)
}

const LONGO = 'Canvas com 60% da largura e o caminho do navegador (SPEC-155) sem espaço-nenhum-que-quebre-a-palavra-comprida'
const COM_VIVO = { apelido: 'E1', localId: 'local_e1', oQue: 'x', vivo: true }
const COM_VIVO2 = { apelido: 'V1', localId: 'local_v1', oQue: 'x', vivo: true }
const itemCheio = (extra: Partial<Linha> = {}): Linha =>
  linha('F34', {
    titulo: LONGO,
    prs: [1128, 1129, 1130],
    perguntas: ['Q225'],
    depois: [{ texto: 'validação das duas fatias com o painel real' }, { texto: 'merge' }],
    agora: 'travas (E4) e desenho do painel (E1) em execução no kit, com a leitura de cada sessão conferida',
    atualizadoEm: new Date(AGORA - 5 * 3600e3).toISOString(),
    com: [COM_VIVO, COM_VIVO2, { ...COM_VIVO, apelido: 'E22', localId: 'local_e22' }, { ...COM_VIVO, apelido: 'P7', localId: 'local_p7' }, { ...COM_VIVO, apelido: 'c20', localId: 'local_c20', vivo: false }],
    espera: { motivo: 'operador', texto: 'decidir o nome do botão e se o rótulo muda no terminal também, sem pressa nenhuma' },
    ...extra,
  })
const SITUACOES: Record<string, string | undefined> = { local_e1: 'trabalhando agora', local_v1: 'parada há 40 min', local_e22: 'sem leitura da sessão' }
const situacaoDoTeste = (id: string) => SITUACOES[id]

test('F34-2: todo texto de linha única dos desenhos novos cabe em W=292', () => {
  const trava = { motivo: 'gate-vermelho', texto: 'três casos do diálogo falham no gate do lote e ninguém olhou ainda por falta de gente' }
  const itens = [
    itemCheio(),
    itemCheio({ situacao: 'travado', espera: undefined, trava, perguntas: [] }),
    itemCheio({ trava: { motivo: 'sem-ninguem', texto: 'E8 não está mais ativa' }, situacao: 'travado', com: [], dono: { apelido: 'E8', localId: 'local_e8' } }),
    itemCheio({ situacao: 'fila', com: [], resumo: LONGO, paradoDesde: new Date(AGORA - 3 * 86400e3).toISOString() }),
  ]
  expect(itens.length).toBeGreaterThan(0)
  const desenhos = [
    ...itens.map(i => ['cartão', cartaoSvg(LARGURA_PANE, i, AGORA, { situacao: situacaoDoTeste }).source] as const),
    ...itens.map(i => ['fila', filaSvg(LARGURA_PANE, i, AGORA).source] as const),
    ['seção', secaoSvg(LARGURA_PANE, { titulo: 'Esperam você', n: 12, tom: 'av', legenda: 'pedem alguém agir' }).source] as const,
    ['seção na fila', secaoSvg(LARGURA_PANE, { titulo: 'Na fila', n: 1, tom: 'm', legenda: 'não começaram', tracejado: true }).source] as const,
    ['faixa', faixaSvg(LARGURA_PANE, { titulo: 'Não consegui ler o painel', detalhe: LONGO, tom: 'er' }).source] as const,
  ]
  for (const [nome, source] of desenhos) expect(sobraDe(source, LARGURA_PANE), `${nome}: texto que passa de ${LARGURA_PANE} px`).toEqual([])
  for (const W of [300, 360]) {
    const r = resumoSvg(W, [{ rotulo: 'Esperam você', n: 12, cor: 'av' }, { rotulo: 'Travados', n: 1, cor: 'er' }, { rotulo: 'Executando', n: 5, cor: 'an' }, { rotulo: 'Na fila', n: 4, cor: 'an', classe: 't' }])
    expect(sobraDe(r.source, W), `resumo a ${W}`).toEqual([])
  }
})

test('F34-2: a medida pega o que passa: o mesmo teste reprova um texto largo demais', () => {
  const fora = `<svg><text x="200" y="10" font-size="13">${'x'.repeat(30)}</text></svg>`
  expect(sobraDe(fora, LARGURA_PANE)).toEqual(['x'.repeat(30)])
})

test('F34-2: a legenda da faixa de seção some quando título, pílula e legenda passam de W', () => {
  const f = { titulo: 'Esperam você', n: 3, tom: 'av', legenda: 'pedem alguém agir' }
  const larga = secaoSvg(380, f)
  const estreita = secaoSvg(200, f)
  expect(larga.source, 'a 380 px a legenda cabe').toContain('pedem alguém agir')
  expect(estreita.source, 'a 200 px não cabe e some').not.toContain('pedem alguém agir')
  expect(estreita.source, 'o título e a contagem ficam').toContain('>Esperam você<')
  expect(larga.height).toBe(28)
  expect(secaoSvg(380, { ...f, tracejado: true }).source, 'Na fila leva o filete tracejado').toContain('stroke-dasharray')
  expect(larga.source).not.toContain('stroke-dasharray')
})

test('F34-2: o cartão diz "sessão encerrada" para a sessão fora da lista e põe o ponto vivo só em quem trabalha', () => {
  const item = itemCheio({ com: [COM_VIVO, { ...COM_VIVO, apelido: 'E9', localId: 'local_fora' }, COM_VIVO2], trava: undefined })
  const r = cartaoSvg(360, item, AGORA, { situacao: situacaoDoTeste })
  expect(r.source, 'o desenho não pode vir vazio').toBeTruthy()
  expect(r.source).toContain('sessão encerrada')
  expect(r.source).toMatch(/<tspan class="s">trabalhando agora</)
  expect(r.source).toContain('parada há 40 min')
  expect(r.source.match(/class="vivo /g)?.length, 'um ponto só, o de quem trabalha agora').toBe(1)
  expect(r.alt).toMatch(/E9, sessão encerrada/)
  const sem = cartaoSvg(360, itemCheio({ com: [COM_VIVO2], trava: undefined }), AGORA, { situacao: situacaoDoTeste })
  expect(sem.source, 'sessão parada vai sem ponto').not.toContain('class="vivo ')
})

test('F34-2: o cartão tem as linhas do desenho, na ordem, e o resto vai ao alt', () => {
  const r = cartaoSvg(360, itemCheio({ trava: { motivo: 'sem-ninguem', texto: 'E8 não está mais ativa' }, situacao: 'travado', espera: undefined }), AGORA, { situacao: situacaoDoTeste })
  expect(r.source).toContain('EDITOR DA LOJA')
  const ordem = ['EDITOR DA LOJA', 'Canvas', '>execução<', 'aguarda você · Q225', '#1130 +2', 'Sem ninguém:', 'Peça outra sessão à orquestradora.', '>E1<', 'travas (E4)', 'depois: validação']
  const posicoes = ordem.map(t => r.source.indexOf(t))
  expect(posicoes.every(n => n >= 0), `faltou: ${ordem.filter((_, k) => posicoes[k]! < 0).join(' | ')}`).toBe(true)
  expect(posicoes, 'a ordem das linhas').toEqual([...posicoes].sort((a, b) => a - b))
  expect(r.source.match(/<rect class="k" /g)?.length, 'no máximo 3 selos').toBe(3)
  expect(r.alt, 'o +n das pessoas, não o (+1) do depois').toMatch(/ — \+1 — /)
  expect(r.alt).toMatch(/c20 saiu/)
})

test('F34-2: sem moldura B o cartão não desenha fundo de tela, nem filete', () => {
  const r = cartaoSvg(360, itemCheio({ trava: undefined, espera: undefined }), AGORA, { situacao: situacaoDoTeste })
  expect(r.source).toBeTruthy()
  expect(r.source, 'sem filete').not.toContain('class="ln"')
  expect(r.source, 'nenhum retângulo da largura toda').not.toMatch(/<rect[^>]*width="360"/)
  const fila = filaSvg(360, itemCheio({ situacao: 'fila', com: [] }), AGORA)
  expect(fila.source, 'a fila leva o anel tracejado, o "espera" tracejado e o filete').toContain('stroke-dasharray="2 2"')
  expect(fila.source).toContain('espera execução')
  expect(fila.source).toContain('class="ln"')
  expect(fila.source, 'a fila não tem botão nem selo de sessão').not.toContain('class="k"')
})

test('F34-2: a faixa tinge de erro com o texto inteiro, nos dois tons', () => {
  const detalhe = 'list_sessions: o app não respondeu a tempo e a última leitura boa ficou na tela, então o que aparece pode estar velho'
  const erro = faixaSvg(300, { titulo: 'Não li o painel', detalhe, tom: 'er' })
  expect(erro.source).toContain('class="et"')
  expect(erro.source, 'o fim do texto está lá, sem reticências').toContain('pode estar velho')
  expect(erro.source).not.toContain('…')
  expect(erro.height).toBeGreaterThan(40)
  expect(faixaSvg(300, { titulo: 'Aviso', tom: 'av' }).source).toContain('class="card"')
})

test('F34-2: o resumo compacto tem 36 px por bloco, número na linha do rótulo, e abaixo de 360 px', () => {
  const contagens = [{ rotulo: 'Esperam você', n: 12, cor: 'av' }, { rotulo: 'Travados', n: 0, cor: 'er' }, { rotulo: 'Executando', n: 5, cor: 'an' }, { rotulo: 'Na fila', n: 4, cor: 'an', classe: 't' }]
  const compacto = resumoSvg(359, contagens)
  expect(compacto.height).toBe(78)
  expect(compacto.source).toContain('font-size="17"')
  expect(compacto.source).not.toContain('font-size="24"')
  expect(compacto.source, 'o rótulo novo').toContain('>Executando<')
  expect(resumoSvg(360, contagens).height, 'a 360 já é o 2×2 cheio').toBe(130)
})

const CORES = (() => {
  const css = cartaoSvg(300, itemCheio(), AGORA, { situacao: situacaoDoTeste }).source.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? ''
  const [claro = '', escuro = ''] = css.split('@media (prefers-color-scheme: dark)')
  const c = regras(claro)

  return { claro: c, escuro: { ...c, ...regras(escuro) } }
})()

const FUNDO_CARD = { claro: '#fbf6ec', escuro: '#2a251b' }

test('F34-2: o texto er sobre o fundo et e o texto pt sobre cada pílula chegam a 4,5:1 nos dois temas', () => {
  expect(Object.keys(CORES.claro).length, 'o CSS foi lido').toBeGreaterThan(8)
  for (const [tema, c] of [['claro', CORES.claro], ['escuro', CORES.escuro]] as const) {
    expect(razao(c.er!, c.et!), `er sobre et, ${tema}`).toBeGreaterThanOrEqual(4.5)
    for (const pilula of ['av', 'an', 'er', 'ok', 'li', 'm']) expect(razao(c.pt!, c[pilula]!), `pt sobre ${pilula}, ${tema}`).toBeGreaterThanOrEqual(4.5)
    for (const etapa of ['li', 'an', 'ok']) expect(razao(c[etapa]!, c.tile!), `${etapa} sobre a pílula da etapa (tile), ${tema}`).toBeGreaterThanOrEqual(4.5)
    expect(razao(c.av!, FUNDO_CARD[tema]), `av sobre card, ${tema}`).toBeGreaterThanOrEqual(4.5)
  }
  expect(razao('#ffffff', '#ffffff'), 'a medida enxerga 1:1').toBe(1)
})

test('F34-2: nenhuma pílula leva #fff fixo: o texto delas é a classe pt, que troca no tema escuro', () => {
  const todos = [
    cartaoSvg(300, itemCheio(), AGORA, { situacao: situacaoDoTeste }).source,
    filaSvg(300, itemCheio({ situacao: 'fila' }), AGORA).source,
    secaoSvg(300, { titulo: 'Executando', n: 2, tom: 'an' }).source,
    resumoSvg(300, [{ rotulo: 'A', n: 1, cor: 'av' }]).source,
  ]
  expect(todos.every(s => s.length > 0)).toBe(true)
  for (const s of todos) expect(s.replace(/<style>[\s\S]*?<\/style>/, ''), 'fora do CSS não sobra branco fixo').not.toMatch(/#fff/i)
  expect(CORES.escuro.pt, 'no escuro o pt é escuro').not.toBe(CORES.claro.pt)
})

test('F34-2: o source de cada desenho fica abaixo de 131 072 caracteres, no cenário mais cheio', () => {
  const itens = Array.from({ length: 40 }, (_, k) => itemCheio({ id: `F${k}`, situacao: k % 4 === 3 ? 'fila' : 'andando' }))
  const fontes = [
    resumoSvg(292, [{ rotulo: 'A', n: 1, cor: 'av' }]).source,
    ...(['Esperam você', 'Travados', 'Executando', 'Na fila'] as const).map(t => secaoSvg(292, { titulo: t, n: 9, tom: 'an', legenda: 'x' }).source),
    ...itens.map(i => (i.situacao === 'fila' ? filaSvg(292, i, AGORA).source : cartaoSvg(292, i, AGORA, { situacao: situacaoDoTeste }).source)),
  ]
  expect(fontes.length).toBeGreaterThan(40)
  expect(Math.max(...fontes.map(s => s.length)), 'o maior desenho sozinho').toBeLessThan(131_072)
  // O cenário da fixtura (o mais cheio que ela tem: oito itens e duas perguntas), todos os desenhos de uma vez.
  const c = CENARIOS.misto
  const todos = [
    ...c.itens.map(i => (i.situacao === 'fila' ? filaSvg(292, i, AGORA).source : cartaoSvg(292, i, AGORA, { situacao: situacaoDoTeste }).source)),
    ...c.perguntas.map(q => perguntaSvg(292, q as never).source),
  ]
  expect(todos.length, 'há o que somar').toBeGreaterThan(8)
  expect(todos.reduce((n, x) => n + x.length, 0), 'tudo junto').toBeLessThan(131_072)
})

// F34 fatia 3: a montagem do pane — as quatro seções, o estado dos botões e o que a leitura parada diz.
test('F34-3: resumo e lista concordam: cada número do resumo é o da seção de mesmo nome', async ($, on) => {
  const travada = { ...FILA_REAL.F13, trava: { motivo: 'gate-vermelho', texto: 'três casos falham' } }
  const { lido } = await lerPane($, on, { fila: { ...Object.fromEntries(Object.entries(FILA_REAL).filter(([id]) => id !== 'F8')), F13: travada } as never, vivas: vivasDe(P7, P2, P1, E8) })
  for (const surface of ['terminal', 'desktop'] as const) {
    const texto = lido[surface]
    const conta = (rotulo: string) => {
      const todas = [...texto.matchAll(new RegExp(`${rotulo} · (\\d+)`, 'g'))]

      return todas.length > 0 ? Number(todas[todas.length - 1]![1]) : 0
    }
    const secoesN = [conta('Esperam você'), conta('Travados'), conta('Executando'), conta('Na fila')]
    expect(secoesN.reduce((a, b) => a + b, 0), `${surface}: há o que somar`).toBeGreaterThan(3)
    expect(secoesN[1], `${surface}: o travado existe`).toBeGreaterThan(0)
    expect(secoesN[2], `${surface}: Executando e Na fila diferem, para o resumo não trocar um pelo outro`).not.toBe(secoesN[3])
    if (surface === 'desktop') {
      const resumo = texto.match(/(\d+) Esperam você, (\d+) Travados, (\d+) Executando, (\d+) Na fila/)
      expect(resumo, 'o resumo existe').not.toBeNull()
      expect(resumo!.slice(1).map(Number)).toEqual(secoesN)
    }
  }
})

test('F34-3: item sem ninguém não tem linha "quem" nem botão, e o erro de leitura não cria nenhum', async ($, on) => {
  const { ui } = await abrirDe({ fila: fila('F23'), vivas: vivasDe(P2) }, $, on)
  expect(await ui.find({ key: `abrir:F23:${E8}` }), 'sem botão').toBeUndefined()
  const texto = await lerSuperficie(ui)
  expect(texto).toMatch(/Sem ninguém: E8 não está mais ativa/)
  expect(texto, 'sem linha de quem trabalha').not.toMatch(/E8, executora/)
  await ui.unmount()
})

test('F34-3: erro de leitura da lista de sessões não cria item "sem ninguém"', async ($, on) => {
  const { ui } = await abrirDe({ fila: fila('F23'), listaFalha: true }, $, on)
  const texto = await lerSuperficie(ui)
  expect(texto, 'o item está lá').toMatch(/kit de orquestração/)
  expect(texto).not.toMatch(/Sem ninguém/)
  await ui.unmount()
})

test('F34-3 R8: leitura pendurada: o "Parou" aparece sozinho, sem remontar, e o botão solta a leitura', async ($, on) => {
  const parar = { on: false }
  const { ui, relogio } = await abrirDe({ parar }, $, on)
  const lidoAs = `↻ ${R.hora(AGORA).slice(0, 5)}`
  expect((await ui.find({ key: 'atualizar' }))?.text).toBe(lidoAs)
  parar.on = true
  await relogio.advance(60_000)
  expect(await lerSuperficie(ui), 'a leitura pendurada começou: ainda não passou de 3 min').not.toMatch(/⚠ Parou /)
  await relogio.advance(200_000)
  const texto = await lerSuperficie(ui)
  expect(texto, 'o tique redesenhou a tela e ela diz que parou').toMatch(/⚠ Parou /)
  expect((await ui.find({ key: 'atualizar' }))?.text, 'parada, o botão não fica em "Lendo…" e guarda a hora da última leitura').toBe(lidoAs)
  parar.on = false
  await ui.press({ key: 'atualizar' })
  await relogio.settle()
  const depois = await lerSuperficie(ui)
  expect(depois, 'o botão soltou a pendurada e leu de novo').not.toMatch(/⚠ Parou /)
  await ui.unmount()
})

test('F34-3: botão em curso: só o pressionado vira "Enviando…" e os irmãos ignoram o clique', async ($, on) => {
  let soltar: () => void = () => undefined
  const segurar = new Promise<void>(res => {
    soltar = res
  })
  const { ui, enviadas, relogio } = await abrirDe({ segurar, fila: {}, vivas: vivasDe(P2), perguntas: PERGUNTAS }, $, on)
  await ui.press({ key: 'Q8:sim' })
  await relogio.settle()
  expect((await ui.findAll({ type: 'Button', text: /Enviando…/ })).map(b => b.props.key ?? b.text), 'um botão só em curso').toHaveLength(1)
  expect((await ui.find({ key: 'Q8:sim' }))?.text, 'e é o pressionado').toBe('Enviando…')
  expect(await ui.find({ key: 'Q8:nao' }), 'o irmão segue lá').toBeDefined()
  await ui.press({ key: 'Q8:nao' })
  soltar()
  await relogio.settle()
  expect(enviadas.map(x => x.message), 'só a primeira resposta saiu').toEqual([expect.stringMatching(/Q8 .*sim/)])
  expect(await lerSuperficie(ui), 'terminado, o rótulo volta').not.toMatch(/Enviando…/)
  await ui.unmount()
})

test('F34-3: "Abrindo…" até o open_session_in voltar', async ($, on) => {
  let soltar: () => void = () => undefined
  const segurar = new Promise<void>(res => {
    soltar = res
  })
  const { ui, abertas, relogio } = await abrirDe({ segurar }, $, on)
  await ui.press({ key: `abrir:F27:${P7}` })
  await relogio.settle()
  const durante = await lerSuperficie(ui)
  expect(durante).toMatch(/Abrindo…/)
  expect(durante, 'os outros botões seguem com o nome').toMatch(/Abrir P1/)
  await ui.press({ key: `abrir:F27:${P7}` })
  soltar()
  await relogio.settle()
  expect(abertas.length, 'o segundo clique foi ignorado').toBe(1)
  expect(await lerSuperficie(ui)).not.toMatch(/Abrindo…/)
  await ui.unmount()
})

test('F34-2 R4: tirar as pessoas excedentes do alt é visto: o +1 é o das pessoas', () => {
  const r = cartaoSvg(360, itemCheio({ depois: [{ texto: 'só um' }] }), AGORA, { situacao: situacaoDoTeste })
  expect(r.alt, 'com um só item em depois não há "(+1)" para confundir').not.toMatch(/\(\+1\)/)
  expect(r.alt).toMatch(/ — \+1 — /)
})

test('F34-2 R5: sessão morta em com não vira selo; só o "saiu" a nomeia', () => {
  const r = cartaoSvg(360, itemCheio({ com: [COM_VIVO, { ...COM_VIVO, apelido: 'c20', localId: 'local_c20', vivo: false }], trava: undefined }), AGORA, { situacao: situacaoDoTeste })
  expect(r.alt).toMatch(/c20 saiu/)
  expect(r.alt, 'sem linha "quem" para a morta').not.toMatch(/c20, /)
  expect(r.source.match(/<rect class="k" /g)?.length, 'só o selo de E1 (rect class="k"): a morta não ganha selo').toBe(1)
  expect(r.source).not.toContain('sessão encerrada')
})

test('F34-2 R5: dono com trava sem ninguém não vira linha "quem"; sem a trava vira', () => {
  const dono = { apelido: 'E8', localId: 'local_e8' }
  const base = { com: [], dono, espera: undefined } as Partial<Linha>
  const sem = cartaoSvg(360, itemCheio({ ...base, trava: { motivo: 'sem-ninguem', texto: 'E8 não está mais ativa' }, situacao: 'travado' }), AGORA, { situacao: situacaoDoTeste })
  expect(sem.alt).toMatch(/Sem ninguém: E8 não está mais ativa/)
  expect(sem.alt, 'o dono já está na trava').not.toMatch(/E8, /)
  const com = cartaoSvg(360, itemCheio({ ...base, trava: undefined }), AGORA, { situacao: situacaoDoTeste })
  expect(com.alt, 'sem a trava o dono é a linha "quem"').toMatch(/E8, sessão encerrada/)
})

// F34 fatia 3, conserto: o resumo concorda com a LISTA (as chaves desenhadas), a moldura, o primary e o teto de "Abrir".
type ElPane = { type: string; text: string; props: Record<string, unknown> }
const chaveDe = (el: ElPane) => String(el.props.key ?? '')
const SECAO = /^(Esperam você|Travados|Executando|Na fila) · (\d+)/

/** Percorre o pane na ordem em que ele desenha e conta, por seção, os cartões (`item:`) e as perguntas (`pergunta:`). */
const contarDesenhado = async (ui: { findAll: (q: object) => Promise<ElPane[]> }) => {
  const certo: Record<string, number> = {}
  const contado: Record<string, number> = {}
  let atual = ''
  for (const el of await ui.findAll({})) {
    const rotulo = el.type === 'Svg' ? String(el.props.alt ?? '') : el.type === 'Text' ? el.text : ''
    const cab = SECAO.exec(rotulo)
    if (cab) {
      atual = cab[1]!
      certo[atual] = Number(cab[2])
      contado[atual] = 0
    } else if (atual && (chaveDe(el).startsWith('item:') || chaveDe(el).startsWith('pergunta:'))) contado[atual] = (contado[atual] ?? 0) + 1
  }

  return { certo, contado }
}

const travadaF13 = { ...FILA_REAL.F13, trava: { motivo: 'gate-vermelho', texto: 'três casos falham' } }
const CENARIOS_PANE: Record<string, Opcoes> = {
  vazio: { fila: {}, perguntas: [], vivas: vivasDe() },
  'só fila, ninguém vivo': { fila: fila('F8', 'F17', 'F18'), perguntas: [], vivas: vivasDe() },
  'tudo, com um travado': { fila: { ...Object.fromEntries(Object.entries(FILA_REAL).filter(([id]) => id !== 'F8')), F13: travadaF13 } as never, vivas: vivasDe(P7, P2, P1, E8) },
  'espera do operador sem pergunta': { fila: { F13: { ...FILA_REAL.F13, espera: { motivo: 'operador', texto: 'decidir' } }, F27: FILA_REAL.F27 } as never, perguntas: [], vivas: vivasDe(P2, P7) },
}
for (const [nome, opc] of Object.entries(CENARIOS_PANE)) {
  test(`F34-3 R7: o que se desenha em cada seção é o que o cabeçalho conta — ${nome}`, async ($, on) => {
    const motor = engine(on, false, {}, { agora: AGORA, ...opc })
    await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
    await $.command.run(ABRIR)
    await motor.relogio.settle()
    let total = 0
    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({ ...PANE, surface })
      const { certo, contado } = await contarDesenhado(ui)
      for (const nomeSecao of ['Esperam você', 'Travados', 'Executando', 'Na fila']) {
        // Esperam e Travados somem quando zerados: o que não tem cabeçalho não tem cartão.
        expect(contado[nomeSecao] ?? 0, `${surface}: ${nomeSecao}`).toBe(certo[nomeSecao] ?? 0)
        total += contado[nomeSecao] ?? 0
      }
      await ui.unmount()
    }
    if (nome !== 'vazio') expect(total, 'o cenário desenha cartões').toBeGreaterThan(0)
  })
}

test('F34-3 R9: cada cartão em sessão tem moldura round na cor do tom da seção', async ($, on) => {
  const fila3 = {
    F13: travadaF13,
    F27: FILA_REAL.F27,
    F1: { ...FILA_REAL.F1, espera: { motivo: 'operador', texto: 'decidir' } },
  } as never
  const { ui } = await abrirDe({ fila: fila3, vivas: vivasDe(P2, P7, P1), perguntas: [] }, $, on)
  for (const [id, tom] of [['F13', 'error'], ['F27', 'subtle'], ['F1', 'warning']] as const) {
    const el = await ui.find({ key: `item:${id}` })
    expect(el, `${id} existe`).toBeDefined()
    expect([el?.props.borderStyle, el?.props.borderColor], id).toEqual(['round', tom])
  }
  await ui.unmount()
})

test('F34-3 R10: um primary só por pergunta, na 1ª opção, e nenhum plain', async ($, on) => {
  const { ui } = await abrirDe({ fila: {}, perguntas: PERGUNTAS, vivas: vivasDe() }, $, on)
  const botoes = (await ui.findAll({ type: 'Button' })) as ElPane[]
  expect(botoes.length, 'há botões').toBeGreaterThan(5)
  expect(botoes.filter(b => b.props.variant === 'plain'), 'nenhum plain').toHaveLength(0)
  const primarios = botoes.filter(b => b.props.variant === 'primary').map(chaveDe)
  expect(primarios.sort(), 'uma por pergunta aberta, a 1ª opção').toEqual(['Q7:a', 'Q8:sim', 'Q9:sim'])
  await ui.unmount()
})

test('F34-3 R10: no máximo 3 "Abrir" por cartão', async ($, on) => {
  const quatro = ['local_a1', 'local_a2', 'local_a3', 'local_a4', 'local_a5']
  const com = quatro.map((id, k) => ({ apelido: `X${k + 1}`, localId: id, oQue: 'x' }))
  const { ui } = await abrirDe({ fila: { F27: { ...FILA_REAL.F27, com } } as never, vivas: vivasDe(P7, ...quatro), perguntas: [] }, $, on)
  const abrir = (await ui.findAll({ type: 'Button' })).map(chaveDe).filter(k => k.startsWith('abrir:'))
  expect(abrir.length, 'cinco vivas, e o cartão mostra o teto').toBe(3)
  await ui.unmount()
})

// ---- F43: o painel diz o que é cada item citado pelo número ----

const numeroDe = (id: string) => Number(id.slice(1))

test('F43-1: a fixtura de 44 itens não está vazia e todo cartão, linha de fila e feito traz F<n> no alt e no source', async ($, on) => {
  const filaTodos = filaCompleta()
  expect(Object.keys(filaTodos).length).toBe(44)
  const { lido } = await lerPane($, on, { fila: filaTodos, vivas: vivasDe(P1, P2, P7, E8), perguntas: [] })
  const docs = Object.entries(filaTodos).map(([id, data]) => doc(id, { projeto: 'alfa', ...data }))
  const itens = montarItens(docs, TEMAS_REAIS, null, undefined, [], AGORA)
  expect(itens.filter(x => x.situacao !== 'feito').length, 'os itens vivos existem').toBeGreaterThan(3)
  for (const i of itens.filter(x => x.situacao !== 'feito')) {
    const r = i.situacao === 'fila' ? filaSvg(300, i, AGORA) : cartaoSvg(300, i, AGORA, { situacao: () => undefined })
    expect(r.alt, `alt de ${i.id}`).toMatch(new RegExp(`^${i.id} · `))
    expect(r.source, `source de ${i.id}`).toContain(`>${i.id}<`)
    expect(lido.desktop, `o pane desenha ${i.id}`).toMatch(new RegExp(`${i.id} · `))
  }
})

const indiceDe = (...itens: Array<[string, string]>) => new Map(itens.map(([id, titulo]) => [id, { id, titulo, tema: 'editor', temaRotulo: 'Editor da loja', etapa: 'feito', projeto: 'alfa' }]))

test('F43-2: citadosDe — um número, repetido e o próprio item', () => {
  const idx = indiceDe(['F13', 'SPEC-155 fatia 2'], ['F7', 'sobras'])
  expect(R.citadosDe(['espera o F13'], [], 'F43', idx)).toEqual([{ id: 'F13', titulo: 'SPEC-155 fatia 2', ligado: false }])
  expect(R.citadosDe(['o F13', 'de novo o F13'], [], 'F43', idx), 'repetido fica uma vez').toHaveLength(1)
  expect(R.citadosDe(['é o F43 mesmo'], [], 'F43', idx), 'o próprio não entra').toEqual([])
})

test('F43-2: citadosDe — número fora da fila, já nomeado com " · ", e F<n> ligado vem primeiro', () => {
  const idx = indiceDe(['F13', 'SPEC-155 fatia 2'], ['F7', 'sobras'])
  expect(R.citadosDe(['bate no F99'], [], 'F43', idx)).toEqual([{ id: 'F99', titulo: undefined, ligado: false }])
  expect(R.citadosDe(['F13 · SPEC-155 fatia 2 parou'], [], 'F43', idx), 'quem escreveu já disse o que é').toEqual([])
  const r = R.citadosDe(['antes o F13'], ['F7'], 'F43', idx)
  expect(r.map(c => c.id)).toEqual(['F7', 'F13'])
  expect(r[0]!.ligado).toBe(true)
})

test('F43-2: citadosDe — número no fim de um agora longo que o desenho corta ainda entra', () => {
  const idx = indiceDe(['F13', 'SPEC-155 fatia 2'])
  const longo = `${'texto longo '.repeat(30)}e por fim o F13`
  const item = { ...linha('F44'), agora: longo }
  expect(cartaoSvg(300, item, AGORA, { situacao: () => undefined }).source, 'o desenho cortou o número').not.toContain('por fim o F13')
  expect(R.citadosDe([longo], [], 'F44', idx).map(c => c.id)).toEqual(['F13'])
})

test('F43-2: citadosDe — 3 números viram 3 linhas com título; 4 ou mais, 2 com título e "também"', () => {
  const idx = indiceDe(['F2', 'a'], ['F3', 'b'], ['F4', 'c'], ['F5', 'd'], ['F6', 'e'])
  const tres = D.citadosSvg(0, 0, 300, R.citadosDe(['F2 F3 F4'.replace(/F(\d)/g, 'o F$1')], [], 'F43', idx))
  expect(tres.partes.join('')).toMatch(/Citados/)
  expect(tres.partes.join('')).toContain('b')
  const cinco = R.citadosDe(['o F2, o F3, o F4, o F5, o F6'], [], 'F43', idx)
  expect(cinco).toHaveLength(5)
  const desenho = D.citadosSvg(0, 0, 300, cinco).partes.join('')
  expect(desenho).toContain('também F4, F5, F6')
  expect(desenho).not.toContain('>c<')
})

test('F43-2: a linha depois com item termina em " → F<n>" e o item ligado entra em Citados', () => {
  const idx = indiceDe(['F3', 'sobras do painel'])
  const item = { ...linha('F7'), depois: [{ texto: 'sobras deste item', item: 'F3' }] }
  const cit = R.citadosDe([item.depois[0]!.texto], ['F3'], 'F7', idx)
  const r = cartaoSvg(300, item, AGORA, { situacao: () => undefined, citados: cit })
  expect(r.source).toMatch(/depois: sobras deste item.*→ F3/)
  expect(r.source).toContain('sobras do painel')
  expect(r.alt).toMatch(/Citado: F3 · sobras do painel/)
})

test('F43-3: citadosDe e a recusa do painel classificam do mesmo jeito (marca no código)', () => {
  expect(R.ITEM_SOLTO.flags, 'a regex é global').toContain('g')
  const soltas = ['a executora do F13 está parada', 'espera o F42']
  const nomeadas = ['a executora do F13 · SPEC-155 fatia 2 está parada']
  for (const f of soltas) expect(f.match(R.ITEM_SOLTO), f).not.toBeNull()
  for (const f of nomeadas) expect(f.match(R.ITEM_SOLTO), f).toBeNull()
})

test('F43-4: a leitura guarda o índice com feito antigo e descartado; os itens visíveis seguem só com os feitos de 24 h', async ($, on) => {
  const filaTodos = filaCompleta()
  const docs = Object.entries(filaTodos).map(([id, data]) => doc(id, { projeto: 'alfa', ...data }))
  const indice = R.montarIndice(docs, TEMAS_REAIS)
  expect(indice).toHaveLength(44)
  expect(indice.find(i => i.id === 'F7')?.etapa, 'descartado antigo está no índice').toBe('descartado')
  expect(indice.find(i => i.id === 'F2')?.etapa, 'feito antigo está no índice').toBe('feito')
  const visiveis = montarItens(docs, TEMAS_REAIS, null, undefined, [], AGORA)
  expect(visiveis.find(i => i.id === 'F2'), 'a leitura de 24 h continua descartando F2').toBeUndefined()
  expect(visiveis.find(i => i.id === 'F4'), 'o feito de 22 h continua visível').toBeDefined()
  expect(visiveis.length).toBeLessThan(indice.length)
})

const LISTA = () => {
  const docs = Object.entries(filaCompleta()).map(([id, data]) => doc(id, { projeto: 'alfa', ...data }))
  return R.montarIndice(docs, TEMAS_DOIS_PROJETOS)
}

test('F43-5: Todos os itens · N com N do índice; grupos na ordem de temas.json, vivos antes dos feitos, número decrescente', async ($, on) => {
  const { lido } = await lerPane($, on, { fila: filaCompleta(), vivas: vivasDe(P1, P2, P7, E8), perguntas: [], temas: TEMAS_DOIS_PROJETOS })
  for (const surface of ['terminal', 'desktop'] as const) expect(lido[surface]).toMatch(/Todos os itens · 44/)
  const grupos = R.gruposDoIndice(LISTA(), TEMAS_DOIS_PROJETOS)
  expect(grupos.length).toBeGreaterThan(2)
  const ordemDosTemas = TEMAS_DOIS_PROJETOS.map(t => `${t.id}:${t.projeto}`)
  const vistos = grupos.map(g => `${g.id}:${g.projeto}`)
  expect(vistos.filter(v => ordemDosTemas.includes(v))).toEqual(ordemDosTemas.filter(v => vistos.includes(v)))
  const editor = grupos.find(g => g.id === 'editor')!
  const etapas = editor.itens.map(i => (i.etapa === 'feito' ? 1 : i.etapa === 'descartado' ? 2 : 0))
  expect(etapas, 'vivos → feitos → descartados').toEqual([...etapas].sort((a, b) => a - b))
  for (const bloco of [0, 1, 2]) {
    const ns = editor.itens.filter((_, k) => etapas[k] === bloco).map(i => numeroDe(i.id))
    expect(ns, `bloco ${bloco} em número decrescente`).toEqual([...ns].sort((a, b) => b - a))
  }
})

test('F43-5: o projeto aparece no cabeçalho com dois projetos e some com um', () => {
  const grupos = R.gruposDoIndice(LISTA(), TEMAS_DOIS_PROJETOS)
  const dois = D.todosSvg(300, grupos[0]!, { comProjeto: true })
  expect(dois.source).toMatch(/alfa|kit-de-orquestracao/)
  const um = D.todosSvg(300, grupos[0]!, { comProjeto: false })
  expect(um.source).not.toMatch(/alfa|kit-de-orquestracao/)
  expect(dois.alt).toMatch(/F\d+ · /)
})

test('F43-6: filtro — 13, F13 e f13 acham só o F13; palavra sem acento acha título com acento; 99 não acha nada', () => {
  const lista = [...LISTA(), { id: 'F90', titulo: 'validação do painel', tema: 'editor', temaRotulo: 'Editor da loja', etapa: 'feito', projeto: 'alfa' }]
  for (const f of ['13', 'F13', 'f13']) expect(R.filtrarIndice(lista, f).map(i => i.id), f).toEqual(['F13'])
  expect(R.filtrarIndice(lista, 'validacao').map(i => i.id)).toContain('F90')
  expect(R.filtrarIndice(lista, '99')).toEqual([])
  expect(R.filtrarIndice(lista, '  ').length, 'sem texto, a lista vem inteira').toBe(lista.length)
})

test('F43-7: pergunta com item: o rótulo é "F<n> · <título do item>", sem o tema', async ($, on) => {
  const perguntas = banco(doc('Q238', { projeto: 'alfa', sessao: 's', sessaoId: 'local_b', titulo: 'qual', estado: 'aberta', item: 'F34' }))
  const filaTodos = filaCompleta()
  const { lido } = await lerPane($, on, { fila: filaTodos, perguntas, vivas: vivasDe(P1, P2, P7, E8) })
  expect(lido.desktop).toMatch(/Q238 · F34 · item sintético 34/)
  expect(lido.desktop).not.toMatch(/Q238 · [^\n]*Editor da loja · item sintético 34/)
})

test('F43-8: terminal — a primeira linha do item começa por F<n> · e há a linha Citados', async ($, on) => {
  const fila2 = { ...fila('F13'), F13: { ...FILA_REAL.F13, agora: 'espera o F22', depois: [] }, F22: { titulo: 'produção do editor', tema: 'editor', etapa: 'feito', feitoEm: '2026-10-20T10:00:00.000Z', atualizadoEm: '2026-10-20T10:00:00.000Z' } }
  const { lido } = await lerPane($, on, { fila: fila2, vivas: vivasDe(P2), perguntas: [] })
  expect(lido.terminal).toMatch(/F13 · SPEC-155 fatia 2/)
  expect(lido.terminal).toMatch(/Citado: F22 · produção do editor/)
})

test('F43-10: com Todos os itens e Feitos hoje abertos, a lista inteira vem depois dos feitos; sem feitos o botão novo aparece', async ($, on) => {
  const semFeitos = await lerPane($, on, { fila: fila('F8'), vivas: vivasDe(), perguntas: [] })
  expect(semFeitos.lido.desktop).toMatch(/Todos os itens · 1/)
  expect(R.ordemDoRodape({ todos: true, feitos: true, anteriores: true })).toEqual(['botoes', 'feitos', 'anteriores', 'todos'])
})

test('projeto no título: o cartão e a linha da fila abrem com "PROJETO · TEMA"; sem projeto, só o tema', () => {
  const com = cartaoSvg(360, itemCheio({ projeto: 'alfa' }), AGORA, { situacao: situacaoDoTeste })
  expect(com.source, 'o desenho não pode vir vazio').toBeTruthy()
  expect(com.source).toContain('ALFA · EDITOR DA LOJA')
  const fila = filaSvg(360, itemCheio({ situacao: 'fila', com: [], projeto: 'kit-de-orquestracao' }), AGORA)
  expect(fila.source, 'a 360 px o tema pode encurtar; o projeto vem antes').toContain('KIT-DE-ORQUESTRACAO · EDITOR DA')
  const sem = cartaoSvg(360, itemCheio({ projeto: undefined }), AGORA, { situacao: situacaoDoTeste })
  expect(sem.source).toContain('EDITOR DA LOJA')
  expect(sem.source, 'sem projeto, nada de projeto no rótulo').not.toMatch(/ALFA|KIT-DE-ORQUESTRACAO/)
})

test('projeto no título: montarItens leva o projeto do documento ao item', () => {
  const [item] = montarItens([doc('F1', { titulo: 'x', tema: 'editor', etapa: 'execucao', projeto: 'Alfa' })], TEMAS_REAIS, [], undefined, [], AGORA)
  expect(item, 'o item existe').toBeDefined()
  expect(item!.projeto).toBe('alfa')
})

test('largura: no desktop o desenho ocupa a largura do pane, sem folga à direita', async ($, on) => {
  const motor = engine(on, false, {}, { agora: AGORA, fila: fila('F27', 'F1'), vivas: vivasDe(P7, P1), perguntas: [] })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run(ABRIR)
  await motor.relogio.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop', props: { ...PANE.props, bodyColumns: 66 } })
  const svgs = (await ui.findAll({ type: 'Svg' })) as ElPane[]
  expect(svgs.length, 'há desenhos').toBeGreaterThan(0)
  const larguras = svgs.map(s => s.props.width as number)
  // 66 colunas medem ~586 px no desktop: o desenho mais largo passa de 570 e nenhum passa de 586.
  expect(Math.max(...larguras)).toBeGreaterThanOrEqual(570)
  expect(Math.max(...larguras)).toBeLessThanOrEqual(586)
  await ui.unmount()
})


// F48, bloco B: o topo do painel diz o modo (presente ou ausente) e liga ou desliga o ausente.
type No = { type: string; props: Record<string, unknown>; text?: string; children?: Array<No | string> }
const filhos = (n: No): No[] => (n.children ?? []).filter((c): c is No => typeof c !== 'string')
const subarvore = (n: No): No[] => [n, ...filhos(n).flatMap(subarvore)]
const raiz = async (ui: { findAll: (q: object) => Promise<unknown[]> }) => (await ui.findAll({}))[0] as No
const rotulo = (n?: No) => String(n?.props.label ?? n?.text)
const HM = (ms: number) => R.hora(ms).slice(0, 5)
const LIGADA = (desde: string) => JSON.stringify({ desde, frase: '/ausente on', sessionId: 'local_x', por: 'comando' })
const HA_3H = new Date(AGORA - 3 * 3600_000).toISOString()
const botoesDoTopo = async (ui: { findAll: (q: object) => Promise<unknown[]> }) => {
  const topo = filhos(await raiz(ui))[0]!
  const fileira = filhos(topo)[0]!

  return { topo, fileira, botoes: subarvore(fileira).filter(n => n.type === 'Button') }
}

test('F48 B1: sem a bandeira o topo diz presente: Ficar ausente, o Svg Presente e o ↻ com a hora, nesta ordem', async ($, on) => {
  const { ui } = await abrirDe({}, $, on)
  const todos = (await ui.findAll({})) as No[]
  const iModo = todos.findIndex(n => n.type === 'Button' && n.props.key === 'modo')
  const iPresente = todos.findIndex(n => n.type === 'Svg' && String(n.props.source).includes('Presente'))
  const iAtualizar = todos.findIndex(n => n.type === 'Button' && n.props.key === 'atualizar')
  expect([iModo >= 0, iPresente >= 0, iAtualizar >= 0], 'os três existem').toEqual([true, true, true])
  expect(iModo).toBeLessThan(iPresente)
  expect(iPresente).toBeLessThan(iAtualizar)
  expect(todos[iModo]?.text).toBe('Ficar ausente')
  expect(todos[iAtualizar]?.text).toBe(`↻ ${HM(AGORA)}`)
  expect(todos.filter(n => n.type === 'Svg' && String(n.props.source).includes('☾')), 'presente não tem a faixa do ausente').toEqual([])
  await ui.unmount()
})

test('F48 B2: modoSvg ausente há 3 h a W = 372: as três linhas, altura 66, contorno lilás sem fundo', () => {
  const r = modoSvg(372, { modo: 'ausente', desde: HA_3H, agora: AGORA })
  expect(r.source, 'o desenho não pode vir vazio').toBeTruthy()
  expect(r.source).toContain('☾')
  expect(r.source).toContain('Ausente há 3 h')
  expect(r.source).toContain(`desde ${HM(AGORA - 3 * 3600_000)} · a orquestradora pode se limpar`)
  expect(r.source).toContain('sessões novas só abrem com você')
  expect(r.height).toBe(66)
  expect(r.source).toContain('class="lis"')
  const retangulos = r.source.match(/<rect[^>]*>/g) ?? []
  expect(retangulos.length, 'há o contorno').toBeGreaterThan(0)
  for (const re of retangulos) expect(re, 'sem fundo').toContain('fill="none"')
  expect(r.alt).toMatch(/a orquestradora pode se limpar sozinha/)
  expect(r.alt).toMatch(/sessão nova só abre num turno seu/)
})

test('F48 B3: a W = 288 com desde de ontem a frase quebra no " · ", em duas linhas inteiras, altura 82', () => {
  const d = new Date(AGORA)
  d.setDate(d.getDate() - 1)
  d.setHours(22, 10, 0, 0)
  const r = modoSvg(288, { modo: 'ausente', desde: d.toISOString(), agora: AGORA })
  expect(r.source).toContain('desde ontem 22:10 ·')
  expect(r.source).toContain('a orquestradora pode se limpar')
  expect(r.source, 'quebrou, não ficou numa linha só').not.toContain('desde ontem 22:10 · a orquestradora')
  expect(r.source, 'nenhuma linha termina em reticências').not.toContain('…')
  expect(r.height).toBe(82)
})

test('F48 B4: desde 5 min no futuro diz "Ausente agora", e o desde() segue devolvendo undefined', () => {
  const futuro = new Date(AGORA + 5 * 60_000).toISOString()
  expect(D.desde(futuro, AGORA)).toBeUndefined()
  const r = modoSvg(372, { modo: 'ausente', desde: futuro, agora: AGORA })
  expect(r.source).toContain('Ausente agora')
  expect(modoSvg(372, { modo: 'ausente', desde: new Date(AGORA).toISOString(), agora: AGORA }).source).toContain('Ausente agora')
  const presente = rotuloModoSvg('presente')
  expect(presente.source).toContain('Presente')
  expect(presente.width).toBeGreaterThan(0)
  expect(rotuloModoSvg('desconhecido').source).toContain('Modo não lido (vale presente)')
  expect(parouSvg(288, '⚠ Parou há 7 min').source).toContain('⚠ Parou há 7 min')
})

for (const bandeira of [undefined, LIGADA(HA_3H)]) {
  test(`F48 B5: bandeira ${bandeira ? 'ligada' : 'ausente'}: o botão do modo é o primeiro da fileira e o ↻ o último, com autoFocus e a hora; o grupo da direita cresce`, async ($, on) => {
    const { ui } = await abrirDe({ bandeira }, $, on)
    const { topo, fileira, botoes } = await botoesDoTopo(ui)
    expect(botoes.map(b => b.props.key)).toEqual(['modo', 'atualizar'])
    expect(rotulo(botoes[0])).toBe(bandeira ? 'Estou de volta' : 'Ficar ausente')
    // O motor não deixa o Button ter `label` e texto ao mesmo tempo: o nome acessível é o texto visível.
    expect(botoes[1]?.props.autoFocus).toBe(true)
    expect(rotulo(botoes[1])).toBe(`↻ ${HM(AGORA)}`)
    expect(botoes[1]?.props.variant, 'nenhum botão da faixa é primário').toBe('secondary')
    expect(botoes[0]?.props.variant).toBe('secondary')
    expect(topo.props.gap, 'o topo não tem gap: no motor ele é uma linha de texto').toBeUndefined()
    const direita = filhos(fileira)[1]
    expect([direita?.props.flexGrow, direita?.props.justifyContent]).toEqual([1, 'flex-end'])
    await ui.unmount()
  })
}

test('F48 B5b: sem ler o modo não há botão do modo, e o ↻ segue o último', async ($, on) => {
  const { ui } = await abrirDe({ bandeira: '{não é json' }, $, on)
  const { botoes } = await botoesDoTopo(ui)
  expect(botoes.map(b => b.props.key)).toEqual(['atualizar'])
  await ui.unmount()
})

test('F48 B6a: bandeira ligada mostra a faixa do ausente', async ($, on) => {
  const { ui } = await abrirDe({ bandeira: LIGADA(HA_3H) }, $, on)
  const lido = await lerSuperficie(ui)
  expect(lido).toMatch(/Modo ausente há 3 h/)
  expect(lido).not.toMatch(/Modo presente/)
  await ui.unmount()
})

test('F48 B6b: ligado:false é presente', async ($, on) => {
  const { ui } = await abrirDe({ bandeira: JSON.stringify({ ligado: false, desligadoEm: HA_3H, por: 'painel' }) }, $, on)
  const lido = await lerSuperficie(ui)
  expect(lido).toMatch(/Modo presente\./)
  expect(lido).not.toMatch(/Modo ausente/)
  await ui.unmount()
})

test('F48 B6c: bandeira sem desde válido é presente', async ($, on) => {
  const { ui } = await abrirDe({ bandeira: JSON.stringify({ frase: 'sem desde' }) }, $, on)
  expect(await lerSuperficie(ui)).toMatch(/Modo presente\./)
  await ui.unmount()
})

test('F48 B6d: JSON inválido: a faixa diz que não leu o modo, o erro vai para a faixa de erro e não há botão do modo', async ($, on) => {
  const { ui } = await abrirDe({ bandeira: '{não é json' }, $, on)
  const lido = await lerSuperficie(ui)
  expect(lido).toMatch(/Não consegui ler o modo ausente; para as travas, vale presente\./)
  expect(lido, 'o erro vai para a faixa de erro').toMatch(/modo ausente \(operador-ausente\.json\)/)
  expect(await ui.find({ key: 'modo' })).toBeUndefined()
  await ui.unmount()
})

test('F48 B7: ligar grava a bandeira com desde ISO e por painel, e a faixa troca antes de a gravação terminar', async ($, on) => {
  let soltar: () => void = () => undefined
  const segurarBandeira = new Promise<void>(res => (soltar = res))
  const { ui, bandeiras, relogio, toasts } = await abrirDe({ segurarBandeira }, $, on)
  await ui.press({ key: 'modo' })
  const durante = await lerSuperficie(ui)
  expect(bandeiras, 'a gravação ainda não terminou').toEqual([])
  expect(durante, 'a faixa já está na tela (otimista)').toMatch(/Modo ausente agora/)
  expect((await ui.find({ key: 'modo' }))?.text).toBe('Ligando…')
  soltar()
  await relogio.settle()
  expect(bandeiras.length).toBe(1)
  const gravada = bandeiras[0] as Record<string, unknown>
  expect(gravada.desde).toBe(new Date(AGORA).toISOString())
  expect(gravada.por).toBe('painel')
  expect(gravada.frase).toBe('botão do painel')
  expect('ligado' in gravada && gravada.ligado === false, 'não grava ligado:false ao ligar').toBe(false)
  expect((await ui.find({ key: 'modo' }))?.text).toBe('Estou de volta')
  expect(toasts.at(-1)).toBe('Modo ausente ligado. Para abrir as donas que faltam antes de sair, use /ausente on no chat.')
  await ui.unmount()
})

test('F48 B8: desligar grava {ligado:false, desligadoEm, por:"painel"}, volta ao presente e avisa', async ($, on) => {
  const { ui, bandeiras, relogio, toasts } = await abrirDe({ bandeira: LIGADA(HA_3H) }, $, on)
  await ui.press({ key: 'modo' })
  await relogio.settle()
  expect(bandeiras).toEqual([{ ligado: false, desde: HA_3H, desligadoEm: new Date(AGORA).toISOString(), por: 'painel' }])
  expect(await lerSuperficie(ui)).toMatch(/Modo presente\./)
  expect((await ui.find({ key: 'modo' }))?.text).toBe('Ficar ausente')
  expect(toasts.at(-1)).toBe('Modo ausente desligado')
  await ui.unmount()
})

// F59: o botão "Estou de volta" guarda o período e avisa cada orquestradora ativa; falha no envio avisa e não desfaz o modo.
const ORQ_ATIVA = doc('local_orq_ativa', { projeto: 'alfa', titulo: '🎛 orquestradora — alfa', papel: 'orquestradora', estado: 'trabalhando' })
const ORQ_ARQUIVADA = doc('local_orq_velha', { projeto: 'alfa', titulo: '🎛 orquestradora — alfa', papel: 'orquestradora', estado: 'concluida' })
const MEMBRO = doc('local_e1', { projeto: 'alfa', titulo: 'E1 · livre', papel: 'executor', estado: 'parada' })

test('F59 B12: desligar manda o pedido do resumo só à orquestradora ativa', async ($, on) => {
  const { ui, enviadas, relogio, toasts, bandeiras } = await abrirDe({ bandeira: LIGADA(HA_3H), vivas: vivasDe(P7, P1, 'local_orq_ativa'), sessoesDocs: [ORQ_ATIVA, ORQ_ARQUIVADA, MEMBRO] }, $, on)
  expect(bandeiras, 'precondição: ainda não gravou').toEqual([])
  await ui.press({ key: 'modo' })
  await relogio.settle()
  expect(enviadas.length, 'uma mensagem, só à ativa').toBe(1)
  expect(enviadas[0]?.session_id).toBe('local_orq_ativa')
  const msg = String(enviadas[0]?.message)
  expect(msg).toContain(HA_3H)
  expect(msg).toContain(new Date(AGORA).toISOString())
  expect(msg).toContain('resumo-da-ausencia')
  expect(toasts.at(-1)).toBe('Modo ausente desligado. A orquestradora traz o resumo.')
  await ui.unmount()
})

test('F59 B13: sem orquestradora ativa não envia nada e o toast é o curto', async ($, on) => {
  const { ui, enviadas, prompts, relogio, toasts } = await abrirDe({ bandeira: LIGADA(HA_3H), sessoesDocs: [ORQ_ARQUIVADA, MEMBRO] }, $, on)
  await ui.press({ key: 'modo' })
  await relogio.settle()
  expect([enviadas, prompts]).toEqual([[], []])
  expect(toasts.at(-1)).toBe('Modo ausente desligado')
  await ui.unmount()
})

test('F59 B14: envio que falha vira aviso no pane e o modo continua desligado', async ($, on) => {
  const { ui, relogio, bandeiras, toasts } = await abrirDe({ bandeira: LIGADA(HA_3H), vivas: vivasDe(P7, P1, 'local_orq_ativa'), sessoesDocs: [ORQ_ATIVA] }, $, on, { envio: 'sessão não achada' })
  await ui.press({ key: 'modo' })
  await relogio.settle()
  expect(bandeiras.length, 'a bandeira foi gravada antes do envio').toBe(1)
  expect(bandeiras[0]?.ligado).toBe(false)
  const lido = await lerSuperficie(ui)
  expect(lido).toMatch(/Modo presente\./)
  expect(lido).toMatch(/resumo.*sessão não achada|sessão não achada/)
  expect(toasts.at(-1)).toBe('Modo ausente desligado')
  await ui.unmount()
})

test('F59 B15: a orquestradora é a própria sessão do pane: o pedido entra como prompt dela, não por send_message', async ($, on) => {
  const { ui, enviadas, prompts, relogio } = await abrirDe({ bandeira: LIGADA(HA_3H), vivas: vivasDe(P7, P1, 'local_orq_ativa'), sessoesDocs: [ORQ_ATIVA], host: 'local_orq_ativa' }, $, on)
  await ui.press({ key: 'modo' })
  await relogio.settle()
  expect(enviadas).toEqual([])
  expect(prompts.length).toBe(1)
  expect(prompts[0]).toContain('resumo-da-ausencia')
  await ui.unmount()
})

test('F59 B16: orquestradora de sessoes que não está nas vivas do app não recebe pedido nem gera aviso', async ($, on) => {
  const { ui, enviadas, prompts, relogio, toasts } = await abrirDe({ bandeira: LIGADA(HA_3H), sessoesDocs: [ORQ_ATIVA, doc('local_orq_fantasma', { projeto: 'alfa', papel: 'orquestradora', estado: 'trabalhando' })] }, $, on)
  await ui.press({ key: 'modo' })
  await relogio.settle()
  expect([enviadas, prompts], 'nenhuma das duas está nas vivas').toEqual([[], []])
  expect(toasts.at(-1)).toBe('Modo ausente desligado')
  expect(await lerSuperficie(ui)).not.toMatch(/Não pedi o resumo/)
  await ui.unmount()
})

test('F48 B9: gravação que falha: a faixa volta ao modo anterior e a faixa de avisos diz o motivo', async ($, on) => {
  const { ui, relogio, bandeiras } = await abrirDe({ bandeiraFalha: 'disco cheio' }, $, on)
  await ui.press({ key: 'modo' })
  await relogio.settle()
  const lido = await lerSuperficie(ui)
  expect(bandeiras).toEqual([])
  expect(lido, 'voltou a presente').toMatch(/Modo presente\./)
  expect(lido).not.toMatch(/Modo ausente agora/)
  expect((await ui.find({ key: 'modo' }))?.text).toBe('Ficar ausente')
  expect(lido).toMatch(/Ação não concluída/)
  expect(lido).toMatch(/Não consegui ligar o modo ausente \(.*disco cheio.*\)/)
  await ui.unmount()
})

test('F48 B10: segundo clique durante a gravação não grava de novo', async ($, on) => {
  let soltar: () => void = () => undefined
  const segurarBandeira = new Promise<void>(res => (soltar = res))
  const { ui, bandeiras, relogio } = await abrirDe({ segurarBandeira }, $, on)
  await ui.press({ key: 'modo' })
  await ui.press({ key: 'modo' })
  soltar()
  await relogio.settle()
  expect(bandeiras.length, 'uma gravação só').toBe(1)
  await ui.unmount()
})

test('F48 B11a: sem piscar: a releitura pendente depois de ligar não apaga a faixa', async ($, on) => {
  const parar = { on: false }
  const a = await abrirDe({ parar }, $, on)
  parar.on = true
  await a.ui.press({ key: 'modo' })
  await a.relogio.settle()
  expect(a.bandeiras.length).toBe(1)
  expect(await lerSuperficie(a.ui), 'releitura pendurada: a faixa segue').toMatch(/Modo ausente agora/)
  await a.ui.unmount()
})

test('F48 B11b: sem piscar: o ↻ clicado durante a gravação, resolvido depois dela com o arquivo lido antes, mantém a faixa', async ($, on) => {
  let soltar: () => void = () => undefined
  const segurarBandeira = new Promise<void>(res => (soltar = res))
  const b = await abrirDe({ segurarBandeira }, $, on)
  await b.ui.press({ key: 'modo' })
  await b.ui.press({ key: 'atualizar' })
  await b.relogio.settle()
  expect(await lerSuperficie(b.ui), 'a leitura feita antes da gravação não apaga a faixa').toMatch(/Modo ausente agora/)
  soltar()
  await b.relogio.settle()
  expect(await lerSuperficie(b.ui)).toMatch(/Modo ausente/)
  expect(b.bandeiras.length).toBe(1)
  await b.ui.unmount()
})

test('F48 B12: a falha do modo vai para a faixa de avisos com o título novo; a resposta não entregue usa o mesmo título', async ($, on) => {
  const { ui, relogio } = await abrirDe({ bandeiraFalha: 'sem permissão' }, $, on)
  await ui.press({ key: 'modo' })
  await relogio.settle()
  const lido = await lerSuperficie(ui)
  expect(lido).toMatch(/Ação não concluída/)
  expect(lido).not.toMatch(/Resposta não entregue/)
  await ui.unmount()
})

test('F48 B13: leitura parada: o Svg "⚠ Parou há" vem logo depois da fileira', async ($, on) => {
  const parar = { on: false }
  const { ui, relogio } = await abrirDe({ parar }, $, on)
  parar.on = true
  await relogio.advance(60_000)
  await relogio.advance(200_000)
  const topo = filhos(await raiz(ui))[0]!
  const seguinte = filhos(topo)[1]
  expect(seguinte?.type).toBe('Svg')
  expect(String(seguinte?.props.source)).toContain('⚠ Parou há')
  await ui.unmount()
})

for (const bandeira of [undefined, LIGADA(HA_3H)]) {
  test(`F48 B14: terminal, bandeira ${bandeira ? 'ligada' : 'ausente'}: a 1ª linha é a fileira com o botão do modo e o ↻; o ausente tem AUSENTE invertido; sem gap; o ↻ fora da linha dos contadores`, async ($, on) => {
    const motor = engine(on, false, {}, { agora: AGORA, fila: fila('F27', 'F1'), vivas: vivasDe(P7, P1), perguntas: [], bandeira })
    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    await $.command.run(ABRIR)
    await motor.relogio.settle()
    const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
    const topo = filhos(await raiz(ui))[0]!
    expect(topo.props.gap, 'sem gap').toBeUndefined()
    const [fileira, segunda] = filhos(topo)
    const botoes = subarvore(fileira!).filter(n => n.type === 'Button')
    expect(botoes.map(b => b.props.key)).toEqual(['modo', 'atualizar'])
    expect(rotulo(botoes[0])).toBe(bandeira ? 'Estou de volta' : 'Ficar ausente')
    expect(rotulo(botoes[1])).toBe(`↻ ${R.hora(AGORA)}`)
    const invertidos = (n: No) => subarvore(n).filter(x => x.type === 'Text' && x.props?.inverse === true)
    if (bandeira) {
      expect(invertidos(segunda!).length, 'o ausente é o único texto invertido').toBe(1)
      expect(String(invertidos(segunda!)[0]?.children?.join(''))).toMatch(/AUSENTE há 3 h/)
    } else {
      expect(invertidos(topo), 'presente não tem o bloco invertido').toEqual([])
    }
    // o bloco do reinício (F152) mora entre a faixa do modo e os contadores
    const reinicio = filhos(topo)[bandeira ? 2 : 1]!
    expect(subarvore(reinicio).filter(n => n.type === 'Button').map(b => b.props.key), 'o reinício vem logo depois do modo, com o botão Me avise').toEqual(['reinicio'])
    const contadores = filhos(topo).slice(bandeira ? 3 : 2)
    expect(contadores.length, 'os contadores vêm depois').toBeGreaterThan(0)
    expect(contadores.flatMap(subarvore).filter(n => n.type === 'Button'), 'o ↻ não está na linha dos contadores').toEqual([])
    await ui.unmount()
  })
}

test('F48 B15: responder pelo painel grava respondidaPor "painel" e respondidaEm igual ao atualizadoEm do clique', async ($, on) => {
  const { relogio, escritas } = engine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run(ABRIR)
  await relogio.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'Q7:b' })
  const data = escritas[0]?.data as Record<string, unknown> | undefined
  expect(data, 'a resposta foi gravada').toBeDefined()
  expect(data?.respondidaPor).toBe('painel')
  expect(typeof data?.respondidaEm).toBe('string')
  expect(data?.respondidaEm).toBe(data?.atualizadoEm)
  await ui.unmount()
})

test('F48 B16: o mod não registra ferramenta nova para o modo: só onde_esta_o_painel', async ($, on) => {
  const { registradas } = await abrirDe({}, $, on)
  expect(registradas.length, 'registrou ao menos a de hoje').toBeGreaterThan(0)
  expect(registradas).toEqual(['onde_esta_o_painel'])
})

test('textoDaEntrega: título, caso truncado em 300 e sem o trecho do caso quando ele falta', () => {
  const longo = 'c'.repeat(400)
  const com = R.textoDaEntrega({ id: 'Q1', titulo: 'T', caso: longo }, 'sim')
  expect(com).toBe(`Q1 — pergunta aberta POR ESTA SESSÃO (talvez antes de uma limpeza de contexto): "T". Caso: ${'c'.repeat(300)}…. Chegou a resposta do operador pelo painel: sim. A pergunta já está como respondida no painel; retome pelo caso e pelo handoff do item, sem repassar a outra sessão.`)
  const sem = R.textoDaEntrega({ id: 'Q2', titulo: 'T' }, 'não')
  expect(sem).toContain('"T". Chegou a resposta do operador pelo painel: não.')
  expect(sem).not.toContain('Caso:')
})

// F58: o chip com os minutos do item sem dona; some quando há quem trabalhe.
const ESPERA_DOC = (extra: Record<string, unknown> = {}) =>
  docF('F58', { projeto: 'kit', etapa: 'execucao', donoLocalId: 'local_P', donoApelido: 'dona', com: [{ localId: 'local_P', apelido: 'dona', oQue: 'faz' }], historico: [{ em: new Date(AGORA - 35 * 60_000).toISOString(), etapa: 'execucao', dono: 'dona' }], ...extra })

test('F58: item com dona não mostra o chip', () => {
  const [item] = monta([ESPERA_DOC()], [{ sessionId: 'local_P' }])
  expect(item, 'o item existe').toBeTruthy()
  expect(item?.esperando).toBeUndefined()
  expect(cartaoSvg(360, item as never, AGORA, { situacao: situacaoDoTeste }).source).not.toContain('sem dona')
})

test('F58: o item sem dona na fila leva os minutos no chip "espera execução"', () => {
  const [item] = monta([docF('F59', { projeto: 'kit', etapa: 'execucao', historico: [{ em: new Date(AGORA - 12 * 60_000).toISOString(), etapa: 'execucao', dono: null }] })])
  expect(item?.esperando?.desde).toBe(new Date(AGORA - 12 * 60_000).toISOString())
  expect(filaSvg(360, item as never, AGORA).source).toContain('espera execução · 12 min')
})

// F69 A0: item sem dono com sessão viva no `com` está andando: vai a Executando, não à Na fila.
const SEM_DONO = (extra: Record<string, unknown> = {}) => docF('F70', { projeto: 'alfa', etapa: 'execucao', historico: [{ em: new Date(AGORA - 60 * 60_000).toISOString(), etapa: 'execucao', dono: null }], ...extra })

test('F69 A0: sem dono e com alguém vivo no com vai a Executando, e a Na fila cai', () => {
  const sozinho = monta([SEM_DONO()], [{ sessionId: P1 }])
  expect(sozinho[0]?.situacao, 'sem ninguém no com, é fila (a precondição que a A0 não pode mudar)').toBe('fila')
  expect(contarSecoes(sozinho, []).fila).toBe(1)
  const andando = monta([SEM_DONO({ com: COM(['E8', E8]) })], [{ sessionId: E8 }])
  expect(andando[0]?.com[0]?.vivo, 'precondição: o E8 está vivo').toBe(true)
  expect(andando[0]?.situacao).toBe('andando')
  expect(andando[0]?.dono).toBeUndefined()
  expect([contarSecoes(andando, []).executando, contarSecoes(andando, []).fila]).toEqual([1, 0])
})

test('F69 A0: com só de sessão encerrada, ou sem a lista de sessões, continua na Na fila', () => {
  const morto = monta([SEM_DONO({ com: COM(['E8', E8]) })], [{ sessionId: P1 }])
  expect(morto[0]?.com[0]?.vivo, 'precondição: o E8 saiu').toBe(false)
  expect(morto[0]?.situacao).toBe('fila')
  const semLista = monta([SEM_DONO({ com: COM(['E8', E8]) })], null)
  expect(semLista[0]?.com[0]?.vivo, 'precondição: não se sabe').toBeNull()
  expect(semLista[0]?.situacao).toBe('fila')
})

test('F69 A0: no pane o item com com vivo e sem dono está em Executando, com o botão abrir', async ($, on) => {
  const { ui } = await abrirDe({ fila: { F70: SEM_DONO({ com: COM(['E8', E8]) }).data }, vivas: vivasDe(E8) }, $, on)
  expect(await lerSuperficie(ui)).toMatch(/0 Esperam você, 0 Travados, 1 Executando, 0 Na fila/)
  expect(await ui.find({ key: `abrir:F70:${E8}` })).toBeDefined()
  await ui.unmount()
})

// F69 A: o botão que pede a sessão que falta. Funções puras primeiro.
const linhaDe = (etapa: string, extra: Record<string, unknown> = {}, vivas: Array<{ sessionId: string }> | null = []) => monta([SEM_DONO({ etapa, ...extra })], vivas)[0]!

test('F69 A: papelQueFalta — a fila numa etapa de trabalho pede a dona; espera, trava, merge e feito não pedem', () => {
  const tabela: Array<[string, ReturnType<typeof linhaDe>, string | undefined]> = [
    ['planejamento na fila', linhaDe('planejamento'), 'dona'],
    ['design na fila', linhaDe('design'), 'dona'],
    ['execucao na fila', linhaDe('execucao'), 'dona'],
    ['validacao na fila', linhaDe('validacao'), 'dona'],
    ['merge na fila', linhaDe('merge'), undefined],
    ['homologacao na fila', linhaDe('homologacao'), undefined],
    ['execucao com espera do operador', linhaDe('execucao', { espera: { motivo: 'operador', texto: 'decidir' } }), undefined],
    ['execucao com espera do gate', linhaDe('execucao', { espera: { motivo: 'gate', texto: 'teste' } }), undefined],
    ['feito', linhaDe('feito', { feitoEm: new Date(AGORA).toISOString() }), undefined],
    ['execucao travada (dono sumiu)', monta([SEM_DONO({ donoApelido: 'dona', donoLocalId: 'local_p9' })], [{ sessionId: P1 }])[0]!, undefined],
  ]
  for (const [nome, item, esperado] of tabela) expect(R.papelQueFalta(item), nome).toBe(esperado)
  expect(tabela.filter(t => t[2] !== undefined).length, 'a tabela tem casos que pedem').toBe(4)
})

test('F69 A: papelQueFalta — item com dona trabalhando não pede', () => {
  const andando = monta([docF('F2', { projeto: 'alfa', etapa: 'validacao', donoApelido: 'dona', donoLocalId: P1, com: COM(['dona', P1]) })], [{ sessionId: P1 }])[0]!
  expect(andando.situacao, 'precondição: anda').toBe('andando')
  expect(R.papelQueFalta(andando)).toBeUndefined()
})

test('F69 A: orquestradoraDoProjeto — uma, nenhuma, várias, caixa do projeto, arquivada e sem lista', () => {
  const orqs = [{ id: 'local_a', projeto: 'alfa' }, { id: 'local_b', projeto: 'alfa' }, { id: 'local_k', projeto: 'kit' }]
  expect(R.orquestradoraDoProjeto('alfa', orqs, ['local_a', 'local_k'])).toEqual({ id: 'local_a' })
  expect(R.orquestradoraDoProjeto('Alfa', orqs, ['local_a', 'local_k']), 'a fila tem minúsculas, o título pode ter maiúscula').toEqual({ id: 'local_a' })
  expect(R.orquestradoraDoProjeto('alfa', orqs, ['local_a', 'local_b'])).toEqual({ varias: 2 })
  expect(R.orquestradoraDoProjeto('alfa', orqs, ['local_k']), 'as duas de alfa estão arquivadas').toEqual({ nenhuma: true })
  expect(R.orquestradoraDoProjeto('outro', orqs, ['local_a'])).toEqual({ nenhuma: true })
  expect(R.orquestradoraDoProjeto('alfa', orqs, null), 'sem a lista do app não se sabe').toEqual({ semLista: true })
})

test('F69 A: textoDoPedidoDeVaga — hora, projeto, cada item com "F<n> · " e a âncora da skill', () => {
  const t = R.textoDoPedidoDeVaga('alfa', [{ id: 'F68', titulo: 'editor da loja' }, { id: 'F63', titulo: 'painel do componente' }], AGORA)
  expect(t).toContain(`Pedido do operador pelo painel (${R.hora(AGORA).slice(0, 5)})`)
  expect(t).toContain('em alfa')
  expect(t).toContain('abra a sessão dona de cada item sem dona')
  expect(t).toContain('F68 · editor da loja; F63 · painel do componente')
  expect(t.match(D_ITEM_SOLTO) ?? [], 'nenhum F<n> sem o título').toEqual([])
  expect(t).toContain('vaga-pelo-painel')
})
const D_ITEM_SOLTO = R.ITEM_SOLTO

test('F69 A: podarPedidos — item que ganhou o papel, prompt de mais de 5 min e pedido de mais de 30 min saem', () => {
  const sem = linhaDe('execucao')
  const com = monta([SEM_DONO({ com: COM(['dona', E8]) })], [{ sessionId: E8 }])[0]!
  const min = (n: number) => AGORA - n * 60_000
  const pedindo = { F70: { estado: 'prompt' as const, em: min(2), papel: 'dona' as const } }
  expect(R.podarPedidos(pedindo, [sem], AGORA), 'o recente fica').toEqual(pedindo)
  expect(R.podarPedidos(pedindo, [com], AGORA), 'o item ganhou a dona: sai').toEqual({})
  expect(R.podarPedidos({ F70: { estado: 'prompt', em: min(6), papel: 'dona' } }, [sem], AGORA), 'prompt vence em 5 min').toEqual({})
  expect(R.podarPedidos({ F70: { estado: 'pedido', em: min(29), papel: 'dona' } }, [sem], AGORA), 'pedido de 29 min fica').toEqual({ F70: { estado: 'pedido', em: min(29), papel: 'dona' } })
  expect(R.podarPedidos({ F70: { estado: 'pedido', em: min(31), papel: 'dona' } }, [sem], AGORA), 'pedido vence em 30 min').toEqual({})
  expect(R.podarPedidos({ F70: { estado: 'enviando' } }, [sem], AGORA), 'enviando não vence por tempo').toEqual({ F70: { estado: 'enviando' } })
})

// Os gestos, no pane. O pane está na orquestradora do alfa quando `host` é o id dela.
const ORQ_IZ = doc('local_orq_iz', { projeto: 'alfa', titulo: '🎛 orquestradora — alfa', papel: 'orquestradora', estado: 'trabalhando' })
const ORQ_IZ2 = doc('local_orq_iz2', { projeto: 'alfa', titulo: '🎛 orquestradora — alfa', papel: 'orquestradora', estado: 'parada' })
const ORQ_KIT = doc('local_orq_kit', { projeto: 'kit', titulo: '🎛 orquestradora — kit', papel: 'orquestradora', estado: 'trabalhando' })
const vivasPedir = (...extra: string[]) => vivasDe('local_orq_iz', 'local_orq_kit', ...extra)
const parado = (etapa: string, extra: Record<string, unknown> = {}) => SEM_DONO({ etapa, ...extra }).data
const FILA_DOIS = () => ({ F68: parado('execucao', { titulo: 'editor da loja' }), F63: parado('planejamento', { titulo: 'painel do componente' }) })
const FILA_TRES = () => ({ ...FILA_DOIS(), F71: parado('validacao', { projeto: 'kit', titulo: 'barra de status' }) })
const pedir = (opc: Opcoes) => ({ vivas: vivasPedir(), sessoesDocs: [ORQ_IZ, ORQ_KIT], ...opc })
// proposto 5 min antes do AGORA dos testes
const cartaoDe = (id: string, extra: Record<string, unknown> = {}) => doc(id, { projeto: 'alfa', apelido: 'dona', papel: 'dona', itens: ['F68'], orquestradoraId: 'local_orq_iz', propostoEm: new Date(AGORA - 5 * 60_000).toISOString(), ...extra })
const CARTAO_F68 = cartaoDe('task_e21')

test('F69 A (i): pane na orquestradora do projeto: o pedido vai ao campo, sem Enter e sem mensagem', async ($, on) => {
  const { ui, fills, enviadas, prompts, abertas, toasts, relogio } = await abrirDe(pedir({ fila: { F68: FILA_DOIS().F68 }, host: 'local_orq_iz' }), $, on)
  expect(await ui.find({ key: 'pedir:F68' }), 'precondição: o botão existe').toBeDefined()
  expect((await ui.find({ key: 'pedir:F68' }))?.text).toBe('Pedir dona')
  await ui.press({ key: 'pedir:F68' })
  await relogio.settle()
  expect(fills.length, 'um preenchimento').toBe(1)
  expect(fills[0]?.mode, 'campo vazio: replace').toBe('replace')
  expect(fills[0]?.text).toContain('F68 · editor da loja')
  expect([enviadas, prompts, abertas], 'nada saiu: quem aperta Enter é o operador').toEqual([[], [], []])
  expect(toasts.at(-1)).toBe('Pedido na caixa do prompt: aperte Enter para abrir a sessão.')
  const lido = await lerSuperficie(ui)
  expect(lido).toMatch(/No prompt às \d\d:\d\d · aperte Enter/)
  expect((await ui.find({ key: 'pedir:F68' }))?.text, 'o botão segue à vista: o operador pode ter apagado o campo').toBe('Pedir dona')
  await ui.unmount()
})

test('F69 A (ii): campo com rascunho recebe o pedido depois dele, numa linha nova', async ($, on) => {
  const { ui, fills, relogio } = await abrirDe(pedir({ fila: { F68: FILA_DOIS().F68 }, host: 'local_orq_iz', rascunho: 'estava escrevendo isto' }), $, on)
  await ui.press({ key: 'pedir:F68' })
  await relogio.settle()
  expect(fills.length).toBe(1)
  expect(fills[0]?.mode).toBe('append')
  expect(fills[0]?.text.startsWith('\n')).toBe(true)
  await ui.unmount()
})

test('F69 A (iii): pane em outra sessão: send_message à orquestradora, foco nela, e o estado pede o cartão', async ($, on) => {
  const { ui, fills, enviadas, abertas, toasts, relogio } = await abrirDe(pedir({ fila: { F68: FILA_DOIS().F68 } }), $, on)
  await ui.press({ key: 'pedir:F68' })
  await relogio.settle()
  expect(fills, 'não usa o campo desta sessão').toEqual([])
  expect(enviadas.length).toBe(1)
  expect(enviadas[0]?.session_id).toBe('local_orq_iz')
  expect(String(enviadas[0]?.message)).toContain('F68 · editor da loja')
  expect([abertas[0]?.session_id, abertas[0]?.target], 'foco na orquestradora, como o "Abrir P2"').toEqual(['local_orq_iz', 'focus'])
  expect(toasts.at(-1)).toBe('Pedido enviado à orquestradora de alfa: o cartão aparece na conversa dela.')
  const lido = await lerSuperficie(ui)
  expect(lido).toMatch(/Pedido às \d\d:\d\d · inicie o cartão/)
  expect(await ui.find({ key: 'pedir:F68' }), 'o botão do item some: não vira reenvio').toBeUndefined()
  expect(await ui.find({ key: 'orq:alfa' }), 'o grupo do topo da Na fila saiu: o clique mora em "Sessões para abrir"').toBeUndefined()
  await ui.unmount()
})

test('F69 A (iv): "Pedir n sessões" faz um pedido por orquestradora e não põe foco com duas', async ($, on) => {
  const { ui, enviadas, abertas, toasts, relogio } = await abrirDe(pedir({ fila: FILA_TRES() }), $, on)
  expect((await ui.find({ key: 'pedir:lote' }))?.text).toBe('Pedir 3 sessões')
  await ui.press({ key: 'pedir:lote' })
  await relogio.settle()
  expect(enviadas.length, 'uma mensagem por orquestradora').toBe(2)
  const por = Object.fromEntries(enviadas.map(e => [String(e.session_id), String(e.message)]))
  expect(por.local_orq_iz).toContain('F68 ·')
  expect(por.local_orq_iz).toContain('F63 ·')
  expect(por.local_orq_iz, 'o item do kit não vai ao alfa').not.toContain('F71')
  expect(por.local_orq_kit).toContain('F71 ·')
  expect(por.local_orq_kit).not.toContain('F68')
  expect(abertas, 'dois destinos: nenhum foco automático').toEqual([])
  expect(toasts.at(-1)).toBe('2 pedidos enviados à orquestradora de alfa, os cartões aparecem na conversa dela; 1 pedido enviado à orquestradora de kit, o cartão aparece na conversa dela.')
  const lido = await lerSuperficie(ui)
  expect(lido.match(/Pedido às \d\d:\d\d · inicie o cartão/g)?.length, 'um estado por item').toBeGreaterThanOrEqual(3)
  expect(await ui.find({ key: 'pedir:lote' }), 'com todos pedidos o lote some').toBeUndefined()
  expect([await ui.find({ key: 'orq:alfa' }), await ui.find({ key: 'orq:kit' })], 'nenhum grupo no topo da Na fila').toEqual([undefined, undefined])
  await ui.unmount()
})

test('F69 A (iv-b): no lote a orquestradora desta sessão recebe pelo campo e a outra por mensagem', async ($, on) => {
  const { ui, fills, enviadas, relogio } = await abrirDe(pedir({ fila: FILA_TRES(), host: 'local_orq_iz' }), $, on)
  await ui.press({ key: 'pedir:lote' })
  await relogio.settle()
  expect(fills.length).toBe(1)
  expect(fills[0]?.text).toContain('F68 ·')
  expect(fills[0]?.text).not.toContain('F71')
  expect(enviadas.map(e => e.session_id)).toEqual(['local_orq_kit'])
  expect(await lerSuperficie(ui)).toMatch(/No prompt às/)
  await ui.unmount()
})

test('F69 A (v): projeto sem orquestradora ativa: sem botão, e o aviso no topo diz quantos itens', async ($, on) => {
  const { ui } = await abrirDe(pedir({ fila: FILA_TRES(), sessoesDocs: [ORQ_IZ] }), $, on)
  expect(await ui.find({ key: 'pedir:F68' }), 'precondição: o alfa tem botão').toBeDefined()
  expect(await ui.find({ key: 'pedir:F71' }), 'o kit não tem orquestradora').toBeUndefined()
  expect(await lerSuperficie(ui)).toMatch(/Sem orquestradora ativa em kit\u00a0·\u00a01\u00a0item · abra uma orquestradora para pedir/)
  expect((await ui.find({ key: 'pedir:lote' }))?.text, 'o item sem destino não conta no lote').toBe('Pedir 2 sessões')
  await ui.unmount()
})

test('F69 A (vi): duas orquestradoras ativas: nada é enviado e o aviso manda pedir na conversa da certa', async ($, on) => {
  const { ui, enviadas, fills } = await abrirDe(pedir({ fila: FILA_DOIS(), sessoesDocs: [ORQ_IZ, ORQ_IZ2], vivas: vivasPedir('local_orq_iz2') }), $, on)
  expect(await ui.find({ key: 'pedir:F68' })).toBeUndefined()
  expect(await ui.find({ key: 'pedir:lote' })).toBeUndefined()
  expect(await lerSuperficie(ui)).toMatch(/2 orquestradoras ativas em alfa · peça na conversa da certa/)
  expect([enviadas, fills]).toEqual([[], []])
  await ui.unmount()
})

test('F69 A (vi-b): orquestradora arquivada (fora das vivas) não conta nem recebe', async ($, on) => {
  const { ui, enviadas } = await abrirDe(pedir({ fila: FILA_DOIS(), sessoesDocs: [ORQ_IZ, ORQ_IZ2] }), $, on)
  expect(await ui.find({ key: 'pedir:F68' }), 'só a viva conta').toBeDefined()
  await ui.press({ key: 'pedir:F68' })
  expect(enviadas.map(e => e.session_id)).toEqual(['local_orq_iz'])
  await ui.unmount()
})

test('F69 A (vi-c): sem a lista de sessões do app, nenhum botão de pedir e o aviso diz que volta', async ($, on) => {
  const { ui } = await abrirDe(pedir({ fila: FILA_DOIS(), listaFalha: true }), $, on)
  expect(await ui.find({ key: 'pedir:F68' })).toBeUndefined()
  expect(await lerSuperficie(ui)).toMatch(/Sem a lista de sessões do app · os botões de pedir voltam na próxima leitura/)
  await ui.unmount()
})

test('F69 A (vii): send_message com erro: o botão volta e o motivo vai para a faixa de avisos', async ($, on) => {
  const { ui, relogio, abertas } = await abrirDe(pedir({ fila: { F68: FILA_DOIS().F68 } }), $, on, { envio: 'sessão não achada' })
  await ui.press({ key: 'pedir:F68' })
  await relogio.settle()
  expect((await ui.find({ key: 'pedir:F68' }))?.text, 'o botão voltou').toBe('Pedir dona')
  const lido = await lerSuperficie(ui)
  expect(lido).toMatch(/Ação não concluída/)
  expect(lido).toMatch(/Não pedi a sessão do F68 · editor da loja à orquestradora de alfa \(sessão não achada\): peça na conversa dela\./)
  expect(lido).not.toMatch(/Pedido às/)
  expect(abertas, 'sem envio, sem foco').toEqual([])
  await ui.unmount()
})

test('F69 A (vii-b): lote com falha numa orquestradora: um aviso por orquestradora com os itens, e o toast só o que saiu', async ($, on) => {
  const { ui, relogio, toasts } = await abrirDe(pedir({ fila: FILA_TRES() }), $, on, { envio: 'sessão não achada' })
  await ui.press({ key: 'pedir:lote' })
  await relogio.settle()
  const lido = await lerSuperficie(ui)
  expect(lido).toMatch(/Não pedi 2 sessões à orquestradora de alfa \(sessão não achada\): F\d+ · [^;]*, F\d+ · [^;]*; peça na conversa dela/)
  expect(lido).toMatch(/Não pedi a sessão do F71 · barra de status à orquestradora de kit/)
  expect(toasts.some(t => /enviado/.test(t)), 'nada saiu: nenhum toast de sucesso').toBe(false)
  expect((await ui.find({ key: 'pedir:lote' }))?.text, 'o lote volta recontado').toBe('Pedir 3 sessões')
  await ui.unmount()
})

test('F69 A (vii-c): fill recusado vira aviso e o botão volta', async ($, on) => {
  const { ui, relogio } = await abrirDe(pedir({ fila: { F68: FILA_DOIS().F68 }, host: 'local_orq_iz', fillRecusa: true }), $, on)
  await ui.press({ key: 'pedir:F68' })
  await relogio.settle()
  expect(await lerSuperficie(ui)).toMatch(/Não pus o pedido do F68 · editor da loja na caixa do prompt \(.*\): escreva à orquestradora\./)
  expect((await ui.find({ key: 'pedir:F68' }))?.text).toBe('Pedir dona')
  await ui.unmount()
})

test('F69 A (viii): segundo clique durante o envio é ignorado e o rótulo diz "Pedindo…"', async ($, on) => {
  let soltar: () => void = () => undefined
  const segurar = new Promise<void>(res => (soltar = res))
  const { ui, enviadas, relogio } = await abrirDe(pedir({ fila: { F68: FILA_DOIS().F68 }, segurar }), $, on)
  await ui.press({ key: 'pedir:F68' })
  await relogio.settle()
  expect((await ui.find({ key: 'pedir:F68' }))?.text).toBe('Pedindo…')
  await ui.press({ key: 'pedir:F68' })
  soltar()
  await relogio.settle()
  expect(enviadas.length, 'um envio só').toBe(1)
  expect(await lerSuperficie(ui)).not.toMatch(/Pedindo…/)
  await ui.unmount()
})

test('F69 A (ix): o item que ganha o papel na releitura perde o "Pedido às"', async ($, on) => {
  const { ui, relogio, arquivos } = await abrirDe(pedir({ fila: { F68: FILA_DOIS().F68 }, vivas: vivasPedir(E8) }), $, on)
  await ui.press({ key: 'pedir:F68' })
  await relogio.settle()
  expect(await lerSuperficie(ui), 'precondição: o pedido aparece').toMatch(/Pedido às/)
  const caminho = `${PASTA}/fila/F68.json`
  const atual = JSON.parse(arquivos.get(caminho) as string) as Doc
  arquivos.set(caminho, JSON.stringify({ ...atual, version: 2, data: { ...atual.data, com: COM(['E8', E8]) } }))
  await ui.press({ key: 'atualizar' })
  await relogio.settle()
  const lido = await lerSuperficie(ui)
  expect(lido).not.toMatch(/Pedido às/)
  expect(lido).toMatch(/1 Executando/)
  expect(await ui.find({ key: 'orq:alfa' }), 'sem item em Pedido, o botão da orquestradora some').toBeUndefined()
  await ui.unmount()
})

test('F69 A (x): item em merge não tem botão, e o do papel ao lado tem (a ausência é medida)', async ($, on) => {
  const { ui } = await abrirDe(pedir({ fila: { F68: FILA_DOIS().F68, F72: parado('merge', { titulo: 'pronto para mergear' }) } }), $, on)
  expect(await ui.find({ key: 'pedir:F68' }), 'precondição: a mesma tela acha botão em item com papel').toBeDefined()
  expect(await ui.find({ key: 'pedir:F72' })).toBeUndefined()
  expect((await ui.find({ key: 'pedir:lote' })), 'um item pedível só: sem o lote').toBeUndefined()
  await ui.unmount()
})


test('F69 A (xii): R2 — depois do lote a linha diz só "inicie o cartão" e o topo da Na fila não repete a frase do grupo', async ($, on) => {
  const { ui, relogio } = await abrirDe(pedir({ fila: FILA_DOIS() }), $, on)
  await ui.press({ key: 'pedir:lote' })
  await relogio.settle()
  const textos = (await ui.findAll({ type: 'Text' })).map(t => t.text)
  expect(textos.filter(t => /^Pedido às \d\d:\d\d · inicie o cartão$/.test(t)).length, 'uma por linha, curta').toBe(2)
  expect(textos.filter(t => /cartões? da fila esperam? você/.test(t)), 'a frase do grupo saiu do topo').toEqual([])
  await ui.unmount()
})

test('F69 A (xiii): o terminal tem os mesmos botões e a mesma ordem', async ($, on) => {
  const motor = engine(on, false, {}, { agora: AGORA, fila: FILA_DOIS(), ...pedir({}) })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run(ABRIR)
  await motor.relogio.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ key: 'pedir:F68' }))?.text).toBe('Pedir dona')
  expect((await ui.find({ key: 'pedir:F63' }))?.text).toBe('Pedir dona')
  expect((await ui.find({ key: 'pedir:lote' }))?.text).toBe('Pedir 2 sessões')
  await ui.press({ key: 'pedir:lote' })
  await motor.relogio.settle()
  expect(motor.enviadas.length).toBe(1)
  expect(await lerSuperficie(ui)).toMatch(/Pedido às/)
  await ui.unmount()
})

// F76: os botões de pedir sessão no lugar certo e contando só a Na fila.
const pais = (r: No): Map<No, No> => {
  const m = new Map<No, No>()
  const anda = (n: No) => filhos(n).forEach(c => (m.set(c, n), anda(c)))
  anda(r)

  return m
}
const cadeia = (m: Map<No, No>, n: No): No[] => (m.has(n) ? [n, ...cadeia(m, m.get(n)!)] : [n])
const ancestralComum = (m: Map<No, No>, nos: No[]): No | undefined => cadeia(m, nos[0]!).find(a => nos.every(n => cadeia(m, n).includes(a)))
const txt = (n: No): string => n.text ?? (n.children ?? []).map(c => (typeof c === 'string' ? c : txt(c))).join('')
const achar = (r: No, f: (n: No) => boolean) => subarvore(r).filter(f)
const FILA_F76 = () => ({
  F68: parado('execucao', { titulo: 'editor da loja' }),
  F63: parado('planejamento', { titulo: 'painel do componente' }),
  F64: parado('execucao', { titulo: 'outro da loja' }),
  F71: parado('validacao', { projeto: 'kit', titulo: 'barra de status' }),
  F73: parado('execucao', { projeto: 'kit', titulo: 'rotas do kit' }),
})

const pedirDoisProjetos = async (ui: { press: (q: object) => Promise<unknown> }, relogio: { settle: () => Promise<unknown> }) => {
  for (const k of ['pedir:F68', 'pedir:F71']) {
    await ui.press({ key: k })
    await relogio.settle()
  }
}

test('F76 C/E: o topo da Na fila só tem o lote e os avisos, com o recuo da linha, e nenhum grupo de projeto', async ($, on) => {
  const { ui, relogio } = await abrirDe(pedir({ fila: FILA_F76() }), $, on)
  const antesDoPedido = await raiz(ui)
  const lote = achar(antesDoPedido, n => n.props?.key === 'pedir:lote')[0]!
  expect(lote, 'precondição: o lote existe').toBeDefined()
  const topo = pais(antesDoPedido).get(pais(antesDoPedido).get(lote)!)!
  expect([topo.props.paddingLeft, topo.props.paddingBottom], 'o recuo da linha').toEqual([3, 1])
  await pedirDoisProjetos(ui, relogio)
  const r = await raiz(ui)
  expect(achar(r, n => n.props?.key === 'orq:alfa' || n.props?.key === 'orq:kit'), 'sem botão de grupo').toEqual([])
  expect(achar(r, n => n.type === 'Text' && /cartão da fila espera você/.test(txt(n))), 'sem frase de grupo').toEqual([])
  expect(achar(r, n => n.type === 'Text' && /^Pedido às \d\d:\d\d · inicie o cartão$/.test(txt(n))).length, 'cada item diz que o pedido saiu').toBe(2)
  await ui.unmount()
})

test('F76 D: o aviso do prompt de um lote diz quais itens ficaram de fora', async ($, on) => {
  const { ui, relogio } = await abrirDe(pedir({ fila: FILA_DOIS(), host: 'local_orq_iz', fillRecusa: true }), $, on)
  await ui.press({ key: 'pedir:lote' })
  await relogio.settle()
  const lido = await lerSuperficie(ui)
  expect(lido).toMatch(/Não pus 2 pedidos na caixa do prompt \(.*\): .*F68 · .*; escreva à orquestradora\./)
  expect(lido).toContain('F63 · ')
  await ui.unmount()
})

test('F76 D: o aviso do prompt de um item cita o item', async ($, on) => {
  const { ui, relogio } = await abrirDe(pedir({ fila: { F68: FILA_DOIS().F68 }, host: 'local_orq_iz', fillRecusa: true }), $, on)
  await ui.press({ key: 'pedir:F68' })
  await relogio.settle()
  expect(await lerSuperficie(ui)).toMatch(/Não pus o pedido do F68 · editor da loja na caixa do prompt \(.*\): escreva à orquestradora\./)
  await ui.unmount()
})

// F82: o "Abrindo…" não confunde botões da mesma sessão.
test('F82 C: "No prompt às … · aperte Enter" segue warning', async ($, on) => {
  const { ui, relogio } = await abrirDe(pedir({ fila: { F68: FILA_DOIS().F68 }, host: 'local_orq_iz' }), $, on)
  await ui.press({ key: 'pedir:F68' })
  await relogio.settle()
  const r = await raiz(ui)
  const nos = achar(r, n => n.type === 'Text' && /^No prompt às \d\d:\d\d · aperte Enter$/.test(txt(n)))
  expect(nos.length, 'precondição: a linha existe').toBeGreaterThan(0)
  for (const n of nos) expect(n.props.color).toBe('warning')
  await ui.unmount()
})

test('F82 D: o aviso sem orquestradora prende "· N item(ns)" com espaço inquebrável', async ($, on) => {
  const um = await abrirDe(pedir({ fila: FILA_TRES(), sessoesDocs: [ORQ_IZ] }), $, on)
  const ts = (await um.ui.findAll({ type: 'Text' })).map(t => t.text)
  const aviso = ts.find(t => /^Sem orquestradora ativa em kit/.test(t))
  expect(aviso, 'precondição: o aviso existe').toBeDefined()
  expect(aviso).toBe('Sem orquestradora ativa em kit\u00a0·\u00a01\u00a0item · abra uma orquestradora para pedir')
  expect(aviso!.split(' · '), 'o espaço inquebrável prende só o "· N item"').toEqual(['Sem orquestradora ativa em kit\u00a0·\u00a01\u00a0item', 'abra uma orquestradora para pedir'])
  await um.ui.unmount()
})

test('F82 D: com dois itens o sufixo é "2 itens", também inquebrável', async ($, on) => {
  const dois = await abrirDe(pedir({ fila: { ...FILA_TRES(), F72: parado('execucao', { projeto: 'kit', titulo: 'outro do kit' }) }, sessoesDocs: [ORQ_IZ] }), $, on)
  const ts2 = (await dois.ui.findAll({ type: 'Text' })).map(t => t.text)
  expect(ts2).toContain('Sem orquestradora ativa em kit\u00a0·\u00a02\u00a0itens · abra uma orquestradora para pedir')
  await dois.ui.unmount()
})

// F85: o que o F82 deixou de sobra.
test('F85 A: a orquestradora aberta sozinha depois do pedido acende "Abrindo…" no botão dela e o clique não abre outra vez', async ($, on) => {
  let soltar: () => void = () => undefined
  const segurarAbrir: { p?: Promise<void> } = {}
  const { ui, abertas, relogio } = await abrirDe(pedir({ fila: { F68: FILA_DOIS().F68 }, segurarAbrir, cartoes: [CARTAO_F68] }), $, on)
  segurarAbrir.p = new Promise<void>(res => (soltar = res))
  await ui.press({ key: 'pedir:F68' })
  await relogio.settle()
  expect(await ui.find({ key: 'cartoes:local_orq_iz' }), 'precondição: o botão da orquestradora existe').toBeDefined()
  expect((await ui.find({ key: 'cartoes:local_orq_iz' }))?.text, 'enquanto abre, o botão dela diz "Abrindo…"').toBe('Abrindo…')
  await ui.press({ key: 'cartoes:local_orq_iz' })
  await relogio.settle()
  soltar()
  await relogio.settle()
  expect(abertas.length, 'o foco automático pediu uma vez e o clique no botão que abria foi ignorado').toBe(1)
  expect((await ui.find({ key: 'cartoes:local_orq_iz' }))?.text).toBe('Abrir a orquestradora')
  await ui.unmount()
})

test('F85 B: o mesmo dono em dois cartões ganha dois botões de chave única, e o "Abrindo…" acende só no pressionado', async ($, on) => {
  let soltar: () => void = () => undefined
  const segurarAbrir: { p?: Promise<void> } = {}
  const fila = { F27: { ...FILA_REAL.F27, com: COM(['P1', P1]) }, F1: { ...FILA_REAL.F1, com: COM(['P1', P1]) } }
  const { ui, abertas, relogio } = await abrirDe({ fila, vivas: vivasDe(P7, P1), segurarAbrir }, $, on)
  const doItem1 = `abrir:F27:${P1}`
  const doItem2 = `abrir:F1:${P1}`
  const chaves = (await ui.findAll({ type: 'Button' })).map(chaveDe).filter(k => k.endsWith(`:${P1}`))
  expect(chaves.length, 'precondição: um botão do P1 em cada cartão').toBe(2)
  expect(new Set(chaves).size, 'cada key aparece uma vez').toBe(2)
  expect(chaves.sort()).toEqual([doItem2, doItem1].sort())
  segurarAbrir.p = new Promise<void>(res => (soltar = res))
  await ui.press({ key: doItem1 })
  await relogio.settle()
  expect((await ui.find({ key: doItem1 }))?.text, 'o pressionado acende').toBe('Abrindo…')
  expect((await ui.find({ key: doItem2 }))?.text, 'o do outro cartão segue com o nome').toBe('Abrir P1')
  await ui.press({ key: doItem2 })
  await relogio.settle()
  soltar()
  await relogio.settle()
  expect(abertas.length, 'o clique no segundo, com o primeiro abrindo, não pede outro open_session_in').toBe(1)
  expect((await ui.find({ key: doItem1 }))?.text).toBe('Abrir P1')
  await ui.unmount()
})

// F85 D: a decisão que a sessão assumiu fica no painel, a confirmar.
const ASSUMIDA = (id: string, extra: Record<string, unknown> = {}, version = 3) =>
  doc(id, { projeto: 'alfa', sessao: 'frente B', sessaoId: 'local_b', titulo: `decisão ${id}`, recomendacao: `seguir com ${id}`, estado: 'assumida', ...extra }, version)
const RESPONDIDA_ANTIGA = doc('Q5', { projeto: 'alfa', sessao: 'frente B', titulo: 'já fechada', estado: 'respondida', resposta: 'sim' }, 2)
const comAssumidas = (extra: Partial<Opcoes> = {}): Opcoes => ({ perguntas: [ASSUMIDA('Q30'), ASSUMIDA('Q31'), RESPONDIDA_ANTIGA], fila: {}, ...extra })
const abrirAssumidas = async ($: Parameters<TestBody>[0], on: On, surface: 'desktop' | 'terminal' = 'desktop', extra: Partial<Opcoes> = {}) => {
  const motor = engine(on, false, {}, { agora: AGORA, vivas: vivasDe(P7), ...comAssumidas(extra) })
  await $.session.start({ cwd: '/', surface, isInteractive: true })
  await $.command.run(ABRIR)
  await motor.relogio.settle()
  const ui = await $.ui.mount({ ...PANE, surface })

  return { ...motor, ui }
}

test('F85 D (1): a assumida não entra em "Perguntas respondidas" nem nas contas do topo', async ($, on) => {
  const { ui } = await abrirAssumidas($, on)
  const lido = await lerTudo(ui)
  expect(lido, 'precondição: a respondida de verdade existe').toMatch(/Perguntas respondidas · 1/)
  expect(lido, 'só a respondida conta').not.toMatch(/Perguntas respondidas · [23]/)
  expect(lido).toMatch(/0 Esperam você/)
  expect(await ui.find({ key: 'Q30:confirmar' }), 'recolhida: o cartão não aparece').toBeUndefined()
  await ui.press({ key: 'anteriores' })
  expect(await lerTudo(ui), 'as assumidas não vão à lista das fechadas').not.toMatch(/Q30 · assumida/)
  await ui.unmount()
})

test('F85 D (2): o botão do rodapé mostra o N e abre a lista com "Assumido:" e as ações', async ($, on) => {
  const { ui } = await abrirAssumidas($, on)
  expect((await ui.find({ key: 'assumidas' }))?.text).toBe('▸ Decisões assumidas · 2')
  await ui.press({ key: 'assumidas' })
  expect((await ui.find({ key: 'assumidas' }))?.text).toBe('▾ Decisões assumidas · 2')
  const lido = await lerTudo(ui)
  expect(lido).toMatch(/Q31[^\n]*decisão Q31/)
  expect(lido).toMatch(/Assumido: seguir com Q30/)
  expect(lido, 'o rótulo da pergunta aberta não vaza').not.toMatch(/Recomendo: seguir com Q30/)
  for (const q of ['Q30', 'Q31']) {
    expect(await ui.find({ key: `${q}:confirmar` }), `${q} Confirmar`).toBeDefined()
    expect(await ui.find({ key: `${q}:mudar` }), `${q} Mudar…`).toBeDefined()
  }
  expect(lido.indexOf('Q31'), 'a mais nova primeiro').toBeLessThan(lido.indexOf('Q30'))
  await ui.unmount()
})

test('F85 D (2b): sem assumida o botão não existe (o rodapé existe, a ausência é medida)', async ($, on) => {
  const { ui } = await abrirAssumidas($, on, 'desktop', { perguntas: [RESPONDIDA_ANTIGA] })
  expect(await ui.find({ key: 'anteriores' }), 'precondição: o rodapé existe').toBeDefined()
  expect(await ui.find({ key: 'assumidas' })).toBeUndefined()
  await ui.unmount()
})

test('F85 D (2c): o terminal tem a mesma lista e as mesmas ações', async ($, on) => {
  const { ui } = await abrirAssumidas($, on, 'terminal')
  expect((await ui.find({ key: 'assumidas' }))?.text).toBe('▸ Decisões assumidas · 2')
  await ui.press({ key: 'assumidas' })
  expect(await lerTudo(ui)).toMatch(/Assumido: seguir com Q30/)
  expect(await ui.find({ key: 'Q30:confirmar' })).toBeDefined()
  expect(await ui.find({ key: 'Q30:mudar' })).toBeDefined()
  await ui.unmount()
})

test('F85 D (3): Confirmar grava respondida com a prova do clique e não acorda a sessão', async ($, on) => {
  const { ui, arquivos, enviadas, prompts, toasts, relogio } = await abrirAssumidas($, on)
  await ui.press({ key: 'assumidas' })
  expect(await ui.find({ key: 'Q30:confirmar' }), 'precondição').toBeDefined()
  await ui.press({ key: 'Q30:confirmar' })
  await relogio.settle()
  const gravado = JSON.parse(arquivos.get(`${PASTA}/perguntas/Q30.json`) as string) as Doc
  expect(gravado.version).toBe(4)
  expect(gravado.data).toMatchObject({ estado: 'respondida', resposta: 'confirmada pelo operador (painel)', respondidaPor: 'painel', respondidaEm: new Date(AGORA).toISOString() })
  expect(enviadas, 'não manda nada à sessão').toEqual([])
  expect(prompts).toEqual([])
  expect(toasts).toContain('Q30 confirmada')
  const lido = await lerTudo(ui)
  expect(lido, 'a confirmada sai das assumidas').toMatch(/Decisões assumidas · 1/)
  expect(lido, 'e entra nas respondidas').toMatch(/Perguntas respondidas · 2/)
  await ui.unmount()
})

test('F85 D (4): Mudar… grava o texto e entrega à sessão dona com o texto da assumida', async ($, on) => {
  const { ui, arquivos, enviadas, relogio } = await abrirAssumidas($, on)
  await ui.press({ key: 'assumidas' })
  expect(await ui.find({ key: 'Q30:outra' }), 'precondição: o campo começa fechado').toBeUndefined()
  await ui.press({ key: 'Q30:mudar' })
  expect((await ui.find({ key: 'Q30:outra' }))?.props.rows, 'o campo do Mudar… também tem 3 linhas').toBe(3)
  await ui.input({ key: 'Q30:outra', text: 'rebasear só depois do gate' })
  await relogio.settle()
  const gravado = JSON.parse(arquivos.get(`${PASTA}/perguntas/Q30.json`) as string) as Doc
  expect(gravado.data).toMatchObject({ estado: 'respondida', resposta: 'rebasear só depois do gate', respondidaPor: 'painel' })
  expect(enviadas.length).toBe(1)
  expect(enviadas[0]?.session_id).toBe('local_b')
  const msg = String(enviadas[0]?.message)
  expect(msg).toMatch(/^Q30 — decisão que ESTA sessão assumiu/)
  expect(msg).toContain('"decisão Q30"')
  expect(msg).toContain('O operador mudou pelo painel: rebasear só depois do gate.')
  await ui.unmount()
})

test('F85 D (5): assumida que mudou desde a leitura não é sobrescrita e vira aviso', async ($, on) => {
  const { ui, arquivos, escritas, enviadas, relogio } = await abrirAssumidas($, on)
  await ui.press({ key: 'assumidas' })
  const mudada = JSON.stringify(ASSUMIDA('Q30', { estado: 'respondida', resposta: 'outro operador' }, 4))
  arquivos.set(`${PASTA}/perguntas/Q30.json`, mudada)
  await ui.press({ key: 'Q30:confirmar' })
  await relogio.settle()
  expect(escritas.filter(e => e.doc_id === 'Q30'), 'nada gravado').toEqual([])
  expect(arquivos.get(`${PASTA}/perguntas/Q30.json`)).toBe(mudada)
  expect(enviadas).toEqual([])
  expect(await lerTudo(ui)).toMatch(/Q30 não gravada: Q30 mudou desde a leitura \(agora: respondida\)/)
  await ui.unmount()
})

// F144: "Sessões para abrir" — o cartão de sessão nova sai das perguntas e ganha seção própria.
const MIN5 = 5 * 60_000
const iso5 = (min: number) => new Date(AGORA - min * 60_000).toISOString()
const PLANOS = { F68: parado('execucao', { titulo: 'editor da loja' }), F63: parado('planejamento', { titulo: 'painel do componente' }) }
const comCartoes = (cartoes: Doc[], extra: Partial<Opcoes> = {}) => pedir({ fila: PLANOS, cartoes, ...extra })

test('F144 pura: lerCartao aceita o contrato e recusa apelido, papel, itens e data fora dele', () => {
  const ok = { projeto: 'Alfa', apelido: 'dona', papel: 'dona', itens: ['F68'], orquestradoraId: 'local_o', propostoEm: iso5(5) }
  expect(R.lerCartao({ id: 't', data: ok, version: 1 })).toEqual({ id: 't', projeto: 'alfa', apelido: 'dona', papel: 'dona', itens: ['F68'], orquestradoraId: 'local_o', propostoEm: iso5(5) })
  for (const ruim of [{ apelido: 'E21' }, { papel: 'E' }, { itens: [] }, { itens: ['x'] }, { itens: 'F68' }, { propostoEm: 'ontem' }, { orquestradoraId: '' }, { projeto: '' }])
    expect(R.lerCartao({ id: 't', data: { ...ok, ...ruim }, version: 1 }), JSON.stringify(ruim)).toBeUndefined()
})

test('F180 pura: lerCartao aceita o cartão de dona (apelido dona, um F<n>) e cartoesVisiveis o some quando abre `F<n> · …`', () => {
  const ok = { projeto: 'Alfa', apelido: 'dona', papel: 'dona', itens: ['F140'], orquestradoraId: 'local_o', propostoEm: iso5(10) }
  const c = R.lerCartao({ id: 'd', data: ok, version: 1 })
  expect(c).toEqual({ id: 'd', projeto: 'alfa', apelido: 'dona', papel: 'dona', itens: ['F140'], orquestradoraId: 'local_o', propostoEm: iso5(10) })
  for (const ruim of [{ itens: [] }, { itens: ['F140', 'F141'] }, { papel: 'E' }]) expect(R.lerCartao({ id: 'd', data: { ...ok, ...ruim }, version: 1 }), JSON.stringify(ruim)).toBeUndefined()
  const viva = (title: string, createdAt: string) => ({ sessionId: 'local_x', title, createdAt })
  expect(R.cartoesVisiveis([c!], [], false, AGORA).map(x => x.id)).toEqual(['d'])
  expect(R.cartoesVisiveis([c!], [viva('F140 · cartão da dona', iso5(1))], false, AGORA)).toEqual([])
  expect(R.cartoesVisiveis([c!], [viva('F141 · outro', iso5(1))], false, AGORA).map(x => x.id)).toEqual(['d'])
})

test('F180 desenho: a linha de dona diz "dona", o item e o tema', () => {
  const l = D.sessaoParaAbrirSvg(360, { apelido: 'dona', itens: [{ id: 'F140', titulo: 'editor da loja' }], propostoEm: iso5(4) }, AGORA)
  expect(l.alt).toContain('dona')
  expect(l.alt).toContain('F140 · editor da loja')
  expect(l.source).toContain('DONA')
})

test('F144 pura: cartoesVisiveis — a sessão F<n> aberta depois do pedido some, a de antes fica, 12 h some, sem lista só o prazo vale', () => {
  const c = (id: string, item: string, min: number) => ({ id, projeto: 'alfa', apelido: 'dona', papel: 'dona' as const, itens: [item], orquestradoraId: 'local_o', propostoEm: iso5(min) })
  const cartoes = [c('b', 'F22', 6), c('a', 'F21', 10), c('v', 'F23', 13 * 60)]
  const viva = (title: string, createdAt: string) => ({ sessionId: 'local_x', title, createdAt })
  expect(R.cartoesVisiveis(cartoes, [], false, AGORA).map(x => x.id), 'mais antigo primeiro; o de 13 h já saiu').toEqual(['a', 'b'])
  expect(R.cartoesVisiveis(cartoes, [viva('F21 · editor', iso5(1))], false, AGORA).map(x => x.id), 'F21 abriu depois do pedido').toEqual(['b'])
  expect(R.cartoesVisiveis(cartoes, [viva('F21 · editor', iso5(60))], false, AGORA).map(x => x.id), 'F21 antiga é outra sessão').toEqual(['a', 'b'])
  expect(R.cartoesVisiveis(cartoes, [viva('F21 · editor', iso5(1))], true, AGORA).map(x => x.id), 'sem a lista não se sabe quem abriu').toEqual(['a', 'b'])
})

test('F144 desenho: a linha diz o item, DONA, há quanto tempo, para quê e + N itens', () => {
  const com = D.sessaoParaAbrirSvg(360, { apelido: 'dona', propostoEm: iso5(4), itens: [{ id: 'F68', titulo: 'editor da loja' }, { id: 'F63', titulo: 'painel do componente' }] }, AGORA)
  expect(com.source.length, 'o desenho existe').toBeGreaterThan(0)
  for (const t of ['F68', ' · DONA', 'há 4 min', 'editor da loja', '+ 1 item']) expect(com.source, t).toContain(t)
  expect(com.alt, 'o alt traz todos os itens').toMatch(/F68 · editor da loja; F63 · painel do componente/)
  const um = D.sessaoParaAbrirSvg(360, { apelido: 'dona', propostoEm: iso5(4), itens: [{ id: 'F68', titulo: 'editor da loja' }] }, AGORA)
  expect(um.source, 'sem mais itens não há a linha "+ N"').not.toContain('+ ')
  expect(D.sessaoParaAbrirSvg(288, { apelido: 'dona', propostoEm: iso5(4), itens: [{ id: 'F9' }] }, AGORA).source, 'sem título, o número').toContain('F9')
  expect(D.fraseDoGrupoSvg(360, 'A orquestradora destes cartões não está aberta', true).source).toContain('class="er"')
})

test('F144: sem cartão a seção não existe, nem o título', async ($, on) => {
  const sem = await lerPane($, on, comCartoes([]))
  for (const sup of ['terminal', 'desktop'] as const) expect(sem.lido[sup], sup).not.toContain('Sessões para abrir')
})

test('F144: com cartão a seção vem depois de "Esperam você" e antes da fila, nas duas superfícies', async ($, on) => {
  const { lido } = await lerPane($, on, comCartoes([CARTAO_F68], { perguntas: PERGUNTAS }))
  for (const sup of ['terminal', 'desktop'] as const) {
    expect(lido[sup], `${sup}: a seção existe`).toContain('Sessões para abrir')
    antes(lido[sup], /Sessões para abrir/, /Na fila/)
  }
  expect(lido.terminal).toMatch(/Sessões para abrir · 1/)
  expect(lido.terminal).toMatch(/F68 dona · há 5 min/)
  expect(lido.terminal).toContain('editor da loja')
  expect(lido.terminal).toContain('O cartão está na conversa da orquestradora de alfa')
  antes(lido.terminal, /Esperam você/, /Sessões para abrir/)
})

test('F144: duas linhas e uma orquestradora ganham um só botão, e o resumo do topo não conta cartão', async ($, on) => {
  const outro = cartaoDe('task_f63', { itens: ['F63'], propostoEm: iso5(8) })
  const { ui, relogio } = await abrirDe(comCartoes([CARTAO_F68, outro]), $, on)
  expect((await ui.findAll({ key: 'cartoes:local_orq_iz' })).length, 'um botão por grupo').toBe(1)
  const lido = await lerSuperficie(ui)
  expect(lido).toContain('Os cartões estão na conversa da orquestradora de alfa')
  expect(lido).toMatch(/Sessões para abrir · 2/)
  antes(lido, /F63, dona/, /F68, dona/)
  expect(lido, 'o resumo segue contando itens').not.toMatch(/2 sessões para abrir/)
  await relogio.settle()
  await ui.unmount()
})

test('F144: o apelido que já aparece vivo depois do pedido esconde a linha na hora; o de antes não', async ($, on) => {
  const vivas = JSON.stringify([
    { sessionId: 'local_orq_iz', title: '🎛 orquestradora — alfa', isRunning: true, isArchived: false },
    { sessionId: 'local_nova', title: 'F68 · editor da loja', isRunning: false, isArchived: false, createdAt: iso5(1) },
    { sessionId: 'local_velha', title: 'F63 · painel', isRunning: false, isArchived: false, createdAt: iso5(120) },
  ])
  const f63 = cartaoDe('task_f63', { itens: ['F63'] })
  const { lido } = await lerPane($, on, comCartoes([CARTAO_F68, f63], { vivas }))
  expect(lido.terminal, 'F68 abriu: a linha some').not.toContain('F68 dona')
  expect(lido.terminal, 'a F63 de antes do pedido não conta').toContain('F63 dona')
  expect(lido.terminal).toMatch(/Sessões para abrir · 1/)
})

test('F202: cartão com propostoEm no futuro some quando a sessão do item já está viva', async ($, on) => {
  const vivas = JSON.stringify([
    { sessionId: 'local_orq_iz', title: '🎛 orquestradora — alfa', isRunning: true, isArchived: false },
    { sessionId: 'local_nova', title: 'F68 · editor da loja', isRunning: false, isArchived: false, createdAt: iso5(1) },
  ])
  const errado = cartaoDe('task_errado', { propostoEm: iso5(-180) })
  const { lido } = await lerPane($, on, comCartoes([errado], { vivas }))
  expect(lido.terminal).not.toContain('Sessões para abrir')
})

test('F144: cartão de mais de 12 h não aparece', async ($, on) => {
  const velho = cartaoDe('task_velho', { propostoEm: iso5(13 * 60) })
  const { lido } = await lerPane($, on, comCartoes([velho, CARTAO_F68]))
  expect(lido.terminal).toMatch(/Sessões para abrir · 1/)
  expect(lido.terminal).not.toMatch(/task_velho/)
})

test('F144: só o cartão de mais de 12 h: a seção não existe', async ($, on) => {
  const velho = cartaoDe('task_velho', { propostoEm: iso5(13 * 60) })
  expect((await lerPane($, on, comCartoes([velho]))).lido.terminal).not.toContain('Sessões para abrir')
})

test('F144: sem a lista de sessões as linhas aparecem todas', async ($, on) => {
  const nova = { sessionId: 'local_nova', title: 'F68 · editor da loja', isRunning: false, isArchived: false, createdAt: iso5(1) }
  const semLista = await lerPane($, on, comCartoes([CARTAO_F68], { vivas: JSON.stringify([nova]), listaFalha: true }))
  expect(semLista.lido.terminal, 'sem lista não dá para saber quais abriram').toContain('F68 dona')
})

test('F144: a orquestradora do grupo não está aberta — a frase avisa e o grupo fica sem botão', async ($, on) => {
  const { ui } = await abrirDe(comCartoes([CARTAO_F68], { vivas: vivasDe('local_orq_kit') }), $, on)
  expect(await lerSuperficie(ui)).toContain('A orquestradora destes cartões não está aberta')
  expect(await ui.find({ key: 'cartoes:local_orq_iz' })).toBeUndefined()
  await ui.unmount()
})

test('F144: "Abrir a orquestradora" da seção foca a conversa dela e mostra "Abrindo…" enquanto abre', async ($, on) => {
  let soltar: () => void = () => undefined
  const segurarAbrir: { p?: Promise<void> } = {}
  const { ui, abertas, relogio } = await abrirDe(comCartoes([CARTAO_F68], { segurarAbrir }), $, on)
  segurarAbrir.p = new Promise<void>(res => (soltar = res))
  expect((await ui.find({ key: 'cartoes:local_orq_iz' }))?.text).toBe('Abrir a orquestradora')
  await ui.press({ key: 'cartoes:local_orq_iz' })
  await relogio.settle()
  expect((await ui.find({ key: 'cartoes:local_orq_iz' }))?.text).toBe('Abrindo…')
  soltar()
  await relogio.settle()
  expect([abertas.at(-1)?.session_id, abertas.at(-1)?.target]).toEqual(['local_orq_iz', 'focus'])
  expect((await ui.find({ key: 'cartoes:local_orq_iz' }))?.text).toBe('Abrir a orquestradora')
  await ui.unmount()
})

test('F144: cartoes ilegível vai para a faixa de erro e a seção não aparece', async ($, on) => {
  const ruim = doc('task_ruim', { apelido: 'lixo' })
  const { lido } = await lerPane($, on, comCartoes([ruim]))
  expect(lido.terminal).toMatch(/cartoes\/task_ruim: fora do contrato/)
  expect(lido.terminal).not.toContain('Sessões para abrir')
})

test('o pedido pelo painel pede a sessão dona e aponta a âncora da skill', () => {
  const so = R.textoDoPedidoDeVaga('kit', [{ id: 'F9', titulo: 'fila de merge' }], AGORA)
  expect(so).toContain('abra a sessão dona')
  expect(so).toContain('F9 · fila de merge')
  expect(so).toContain('vaga-pelo-painel')
})

test('o chip do item sem dona diz "sem dona" com os minutos', () => {
  const e = { desde: new Date(AGORA - 12 * 60_000).toISOString() }
  expect(D.textoEsperando(e, AGORA)).toBe('sem dona · 12 min')
})

// F189: no modelo da dona o apelido gravado é sempre "dona"; o pane diz qual sessão é pelo título dela na lista ao vivo.
const DONA_DOC = (extra: Record<string, unknown> = {}) =>
  docF('F189', { titulo: 'O painel diz qual sessão é a dona', projeto: 'kit', etapa: 'execucao', donoLocalId: 'local_d', donoApelido: 'dona', com: [{ localId: 'local_d', apelido: 'dona', oQue: 'conserta o painel' }], ...extra })
const VIVA_DONA = { sessionId: 'local_d', title: 'F189 · O painel diz qual sessão é a dona' }

test('F189: o dono e o com "dona" viram o F<n> do título da sessão, com o título inteiro ao lado', () => {
  const [item] = monta([DONA_DOC()], [VIVA_DONA])
  expect(item?.dono, 'o item tem de sair com dono').toBeTruthy()
  expect(item?.dono).toMatchObject({ apelido: 'F189', titulo: 'F189 · O painel diz qual sessão é a dona', dona: true })
  expect(item?.com[0]).toMatchObject({ apelido: 'F189', titulo: 'F189 · O painel diz qual sessão é a dona', dona: true })
})

test('F189: a dona cujo título cita outro item mostra esse F<n>; título sem F<n> aparece cortado', () => {
  const [outro] = monta([DONA_DOC()], [{ sessionId: 'local_d', title: 'F150 · Outro tema' }])
  expect(outro?.dono?.apelido).toBe('F150')
  const [solto] = monta([DONA_DOC()], [{ sessionId: 'local_d', title: 'Consertar o painel das sessões do kit' }])
  expect(solto?.dono?.apelido).toBe('Consertar o painel…')
  expect(solto?.dono?.titulo).toBe('Consertar o painel das sessões do kit')
})

test('F189: sem a sessão na lista (ou sem lista), a dona cai no F<n> do item e a trava diz "a dona F<n>"', () => {
  const [fora] = monta([DONA_DOC()], [{ sessionId: 'local_outra' }])
  expect(fora?.dono).toMatchObject({ apelido: 'F189', dona: true })
  expect(fora?.dono?.titulo).toBeUndefined()
  expect(fora?.trava?.texto).toBe('a dona F189 não está mais ativa')
  const [semLista] = monta([DONA_DOC()], null)
  expect(semLista?.dono?.apelido).toBe('F189')
})

test('F189: a arquivada que vier na lista ainda dá o título, e o item segue sem ninguém', () => {
  const [item] = monta([DONA_DOC()], [{ sessionId: 'local_d', title: 'F150 · Outro tema', isArchived: true }])
  expect(item?.dono?.apelido, 'o F<n> vem do título, não do item').toBe('F150')
  expect(item?.trava?.texto).toBe('a dona F150 não está mais ativa')
})

test('F189: o corte do título solto não parte emoji', () => {
  // 18 letras e um emoji na 19ª posição: por unidade UTF-16 o corte deixaria meio emoji.
  const [item] = monta([DONA_DOC()], [{ sessionId: 'local_d', title: 'abcdefghijklmnopqr😀😀z' }])
  expect(item?.dono?.apelido).toBe('abcdefghijklmnopqr😀…')
})

test('F189: título solto curto fica inteiro', () => {
  const [item] = monta([DONA_DOC()], [{ sessionId: 'local_d', title: 'Painel curto' }])
  expect(item?.dono?.apelido).toBe('Painel curto')
})

test('F189: apelido gravado que não é dona segue como está, sem título nem marca de dona', () => {
  const [item] = monta([docF('F9', { projeto: 'kit', etapa: 'execucao', donoLocalId: 'local_e', donoApelido: 'E3', com: [{ localId: 'local_v', apelido: 'V1', oQue: 'valida' }] })], [{ sessionId: 'local_e', title: 'E3 · x' }, { sessionId: 'local_v', title: 'V1 · y' }])
  expect(item?.dono).toEqual({ apelido: 'E3', localId: 'local_e', link: 'claude://claude.ai/epitaxy/local_e' })
  expect(item?.com[0]?.apelido).toBe('V1')
  expect(item?.com[0]?.titulo).toBeUndefined()
})

test('F189 desenho: a linha e o cartão mostram o F<n> no selo, "dona" por extenso e o título da sessão no alt', () => {
  const [item] = monta([DONA_DOC()], [VIVA_DONA])
  const linhaSvg = itemSvg(360, item as never, AGORA)
  expect(linhaSvg.source).toContain('F189')
  expect(linhaSvg.source).toContain('<tspan class="s"> · dona F189</tspan>')
  expect(linhaSvg.source, 'o selo da linha não diz mais só "dona"').not.toContain(' · dona</tspan>')
  expect(linhaSvg.alt, 'o alt da linha leva o título da sessão, como o cartão').toContain('dona F189 · O painel diz qual sessão é a dona')
  const cartao = cartaoSvg(360, item as never, AGORA, { situacao: () => 'trabalhando agora' })
  expect(cartao.source).toContain('>F189<')
  expect(cartao.alt).toContain('F189 · O painel diz qual sessão é a dona, dona, trabalhando agora')
})

test('F189 desenho: a dona que sumiu fica só na trava, sem "F189 saiu" na linha nem no cartão', () => {
  const [item] = monta([DONA_DOC()], [{ sessionId: 'local_outra' }])
  expect(item?.trava?.texto, 'o item tem de sair travado sem ninguém').toBe('a dona F189 não está mais ativa')
  expect(item?.com[0]?.vivo, 'o com da dona tem de sair morto').toBe(false)
  expect(D.quemSaiu(item as never)).toEqual([])
  expect(itemSvg(360, item as never, AGORA).source).not.toContain('saiu')
  expect(cartaoSvg(360, item as never, AGORA, { situacao: () => undefined }).source).not.toContain('saiu')
})

test('F189 desenho: a dona que saiu do com sem travar o item diz "dona F<n> saiu"', () => {
  const [item] = monta([DONA_DOC({ donoLocalId: 'local_e', donoApelido: 'E3' })], [{ sessionId: 'local_e' }])
  expect(D.quemSaiu(item as never).map(q => q.t)).toEqual(['dona F189 saiu'])
})

// F200: o id do documento vira caminho na resposta (`perguntas/<id>.json`); o id de dentro do JSON só vale se for um nome simples.
test('lerDoc: id com barra ou ".." fica com o nome do arquivo', () => {
  expect(R.lerDoc('{"id":"Q7","data":{}}', 'Q7.json').id).toBe('Q7')
  expect(R.lerDoc('{"id":"../../alvo","data":{}}', 'Q8.json').id).toBe('Q8')
  expect(R.lerDoc('{"id":"a/b","data":{}}', 'Q9.json').id).toBe('Q9')
  expect(R.lerDoc('{"id":"..","data":{}}', 'Q10.json').id).toBe('Q10')
  expect(R.lerDoc('{"data":{}}', 'Q11.json').id).toBe('Q11')
})
