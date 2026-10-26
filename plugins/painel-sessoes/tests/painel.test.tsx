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
      projeto: 'izanagi',
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
      projeto: 'izanagi',
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
      projeto: 'izanagi',
      sessao: 'eu mesma',
      // a pergunta é da sessão onde o painel está aberto
      sessaoId: 'local_eu',
      titulo: 'abro o release',
      estado: 'aberta',
    },
    1,
  ),
  doc('Q5', { projeto: 'izanagi', sessao: 'frente B', titulo: 'já foi', estado: 'respondida', resposta: 'sim' }),
)

const VIVAS = JSON.stringify([
  { sessionId: 'local_a', title: 'frente A', isRunning: false, isArchived: false, lastActivityAt: '2026-10-23T11:55:00Z' },
  { sessionId: 'local_b', title: 'frente B', isRunning: false, isArchived: false },
  { sessionId: 'local_e', title: 'frente E', isRunning: false, isArchived: false },
  { sessionId: 'local_o', title: 'orq', isRunning: true, isArchived: false },
  { sessionId: 'local_d', title: 'nova sem linha', cwd: '/Users/x/Developer/Projects/Izanagi', isRunning: true },
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
  mock.env(on, { HOME: '/home/teste', ...(opc.host ? { CLAUDE_CODE_HOST_SESSION_ID: opc.host } : {}) })
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
  // a foto da fila não traz o `projeto`, mas os 29 itens reais têm `izanagi`: sem ele o item legado cai em "Sem tema" (c19)
  for (const [id, data] of Object.entries(opc.fila ?? FILA_REAL)) arquivos.set(`${PASTA}/fila/${id}.json`, JSON.stringify(doc(id, { projeto: 'izanagi', ...data })))
  if (opc.bandeira !== undefined) arquivos.set(BANDEIRA, opc.bandeira)
  for (const d of opc.sessoesDocs ?? []) arquivos.set(`${PASTA}/sessoes/${d.id}.json`, JSON.stringify(d))
  const bandeiras: Escrita[] = []
  if (!opc.semTemas) arquivos.set(`${PASTA}/temas.json`, JSON.stringify(opc.temas ?? TEMAS_REAIS))
  const escritas: Escrita[] = []
  on('fs.list', async (_, e) => {
    if (falhaPasta) return { deny: 'sem acesso à pasta do painel' }
    if (opc.parar?.on) await new Promise(() => undefined)
    const prefixo = `${e.path}/`
    const value = [...arquivos.keys()]
      .filter(k => k.startsWith(prefixo))
      .map(k => ({ name: k.slice(prefixo.length), kind: 'file' as const, size: 1, mtimeMs: 0, isLink: false }))

    return { value }
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
  const prompts: string[] = []
  on('prompt.submit', (_, e) => {
    if (falhas.prompt) return { drop: falhas.prompt }
    prompts.push(e.text)
    return { text: e.text }
  })
  on('tool.call', async (_, e) => {
    const input = e as unknown as Escrita
    if (opc.segurar && (e.tool === 'mcp__ccd_session_mgmt__send_message' || e.tool === 'mcp__ccd_window__open_session_in')) await opc.segurar
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

  return { relogio, escritas, contagem, enviadas, prompts, toasts, copiadas, abertas, loja, registradas, bandeiras, arquivos, painelAberto: () => aberto }
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
const P7 = 'local_112bbb1c-9e59-4f31-9f65-7c3a31f6160f'
const P2 = 'local_d985d448-ecd4-40a1-b7ea-eb327779056b'
const P1 = 'local_c19b5998-5821-4435-91f3-320eac727d3b'
const E8 = 'local_7723bebb-d428-4bb6-ab63-37354ead5c78'
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
  const q8 = doc('Q8', { projeto: 'izanagi', sessao: 'P1', sessaoId: P1, titulo: 'posso rebasear', estado: 'aberta', item: 'F1' }, 2)
  const q7 = doc('Q7', { projeto: 'izanagi', sessao: 'P2', sessaoId: P2, titulo: 'qual caminho', estado: 'aberta' }, 4)
  const q5 = doc('Q5', { projeto: 'izanagi', sessao: 'P7', titulo: 'já foi', estado: 'respondida', resposta: 'sim' })
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
    { id: 'geral', rotulo: 'Geral', projeto: 'izanagi' },
    { id: 'kit', rotulo: 'Kit', projeto: 'izanagi' },
  ]
  const docs = [
    { id: 'F1', data: { titulo: 'F1', tema: 'geral', projeto: 'novo', etapa: 'planejamento' } },
    { id: 'F2', data: { titulo: 'F2', tema: 'geral', projeto: 'izanagi', etapa: 'planejamento' } },
    { id: 'F3', data: { titulo: 'F3', tema: 'kit', projeto: 'izanagi', etapa: 'planejamento' } },
  ]
  const itens = montarItens(docs, temas, [], undefined, [], AGORA)
  expect(itens.length, 'a montagem não pode vir vazia').toBe(3)
  expect(itens.map(i => i.foraDoContrato).filter(Boolean), 'nenhum item sai do contrato').toEqual([])
  const grupos = porTema(itens, temas, (a, b) => a.id.localeCompare(b.id))
  expect(grupos.length, 'um grupo por (projeto, id)').toBe(3)
  expect(grupos.map(g => g.itens.map(i => i.id).join())).toEqual(['F1', 'F2', 'F3'])
  expect(grupos.map(g => g.rotulo)).toEqual(['Geral · novo', 'Geral · izanagi', 'Kit'])
})

test('com um só projeto, o rótulo do tema não ganha sufixo', () => {
  const temas = [{ id: 'geral', rotulo: 'Geral', projeto: 'izanagi' }]
  const itens = montarItens([{ id: 'F1', data: { titulo: 'F1', tema: 'geral', projeto: 'izanagi', etapa: 'planejamento' } }], temas, [], undefined, [], AGORA)
  expect(itens.length).toBe(1)
  expect(itens[0]!.tema).toBe('geral')
  expect(porTema(itens, temas, () => 0).map(g => g.rotulo)).toEqual(['Geral'])
})

test('c19: item legado sem projeto não vai para o geral do primeiro projeto: cai em "Sem tema" com o motivo; tema global ainda casa', () => {
  const temas = [{ id: 'geral', rotulo: 'Geral', projeto: 'izanagi' }, { id: 'glob', rotulo: 'Global' }]
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
  const temas = [{ id: 'kit', rotulo: 'Kit', projeto: 'izanagi' }]
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
  expect(await ui.find({ key: `abrir:${P7}` }), 'dono vivo tem botão').toBeDefined()
  expect(await ui.find({ key: `abrir:${P1}` })).toBeDefined()
  expect(await lerSuperficie(ui)).not.toMatch(/claude:\/\//)
  await ui.unmount()
})

test('abrir: dono fora da lista de sessões vivas não tem botão', async ($, on) => {
  const morto = await abrirDe({ vivas: vivasDe(P1) }, $, on)
  expect(await morto.ui.find({ key: `abrir:${P7}` }), 'dono fora da lista: sem botão').toBeUndefined()
  expect(await morto.ui.find({ key: `abrir:${P1}` })).toBeDefined()
  await morto.ui.unmount()
})

test('abrir: o clique pede open_session_in com o localId e foco, e não copia nada quando abre', async ($, on) => {
  const { ui, abertas, copiadas, toasts } = await abrirDe({}, $, on)
  await ui.press({ key: `abrir:${P7}` })
  expect(abertas.length, 'o clique chamou a tool').toBe(1)
  expect([abertas[0]?.session_id, abertas[0]?.target]).toEqual([P7, 'focus'])
  expect(copiadas).toEqual([])
  expect(toasts).toEqual([])
  await ui.unmount()
})

const copiaAoFalhar = (abrirFalha: string) => async ($: Parameters<TestBody>[0], on: On) => {
  const { ui, copiadas, toasts } = await abrirDe({ abrirFalha }, $, on)
  await ui.press({ key: `abrir:${P7}` })
  expect(copiadas.length, `${abrirFalha}: copiou`).toBe(1)
  expect(copiadas[0]?.text).toBe(`claude://claude.ai/epitaxy/${P7}`)
  expect(toasts.join('\n')).toMatch(/não deu para abrir daqui .*endereço de P7 copiado/)
  await ui.unmount()
}

test('abrir: recusa da tool copia o endereço e diz o que houve', copiaAoFalhar('deny'))
test('abrir: erro da tool copia o endereço e diz o que houve', copiaAoFalhar('sessão não achada'))

test('abrir: copia que não pegou não diz "copiado" e mostra o endereço', async ($, on) => {
  const { ui, copiadas, toasts } = await abrirDe({ abrirFalha: 'deny', copiaFalha: true }, $, on)
  await ui.press({ key: `abrir:${P7}` })
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
  expect(await ui.find({ key: `abrir:${P7}` }), 'sem a lista, sem botão').toBeUndefined()
  expect(await ui.find({ key: `abrir:${P1}` })).toBeUndefined()
  await ui.unmount()
})

// F30 fatia 3: o `com` (quem trabalha agora no item) e a `espera` (o operador ou o gate).
const COM = (...c: Array<[string, string]>) => c.map(([apelido, localId]) => ({ apelido, localId, oQue: `trabalho de ${apelido}` }))
const comDuas = (extra: Record<string, unknown> = {}) => ({ F27: { ...FILA_REAL.F27, com: COM(['P2', P2], ['E8', E8]), ...extra } })

test('com: duas sessões vivas aparecem na linha 2 e cada uma ganha o seu "abrir", além do dono', async ($, on) => {
  const { ui } = await abrirDe({ fila: comDuas(), vivas: vivasDe(P7, P2, E8) }, $, on)
  for (const id of [P2, E8, P7]) expect(await ui.find({ key: `abrir:${id}` }), `botão de ${id}`).toBeDefined()
  expect(await ui.findAll({ key: `abrir:${P2}` }), 'um botão só por sessão').toHaveLength(1)
  const texto = await lerSuperficie(ui)
  expect(texto).toMatch(/P2, planejadora, trabalhando agora — E8, executora, trabalhando agora/)
  expect(texto, 'com `com` o dono deixa a linha 2').not.toMatch(/execução · P7/)
  await ui.unmount()
})

test('com: quem saiu da lista vem cinza com "saiu" depois do PR, sem botão e sem virar trava', async ($, on) => {
  const { ui } = await abrirDe({ fila: comDuas(), vivas: vivasDe(P7, P2) }, $, on)
  expect(await ui.find({ key: `abrir:${E8}` }), 'sem botão para quem saiu').toBeUndefined()
  expect(await ui.find({ key: `abrir:${P2}` })).toBeDefined()
  const texto = await lerSuperficie(ui)
  expect(texto).toMatch(/P2, planejadora, trabalhando agora — E8 saiu/)
  expect(texto, 'sem o ponto do meio, "saiu" não vira um terceiro nome').not.toMatch(/ · saiu/)
  expect(texto).not.toMatch(/Trava \(/)
  await ui.unmount()
  const itens = montarItens([docF('F1', { etapa: 'execucao', donoApelido: 'P7', donoLocalId: P7, com: COM(['E8', E8]) })], TEMAS_T, [{ sessionId: P7 }] as never, undefined, [], AGORA)
  expect(itens.length).toBe(1)
  expect([itens[0]!.situacao, itens[0]!.com[0]!.vivo, itens[0]!.trava]).toEqual(['andando', false, undefined])
})

test('com: sem a lista de sessões não há botão nem "saiu" (não se sabe quem saiu)', async ($, on) => {
  const { ui } = await abrirDe({ fila: comDuas(), listaFalha: true }, $, on)
  expect(await ui.find({ key: `abrir:${P2}` })).toBeUndefined()
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
  expect(await ui.findAll({ key: `abrir:${P7}` }), 'um botão só para o P7').toHaveLength(1)
  expect(await ui.findAll({ key: `abrir:${P2}` })).toHaveLength(1)
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
const perguntaAberta = (id: string, item?: string) => ({ id, projeto: 'izanagi', sessao: 's', titulo: id, item, opcoes: [] })
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

test('F34-1: papelDe lê a 1ª letra e devolve undefined para qualquer outra', () => {
  expect([papelDe('P1'), papelDe('E3'), papelDe('V4'), papelDe('D1'), papelDe('O')]).toEqual(['planejadora', 'executora', 'validadora', 'designer', 'orquestradora'])
  expect(papelDe('c20')).toBeUndefined()
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
  expect(r.source).toMatch(/>executora<\/tspan><tspan class="s"> · trabalhando agora</)
  expect(r.source).toContain('validadora')
  expect(r.source).toContain(' · parada há 40 min')
  expect(r.source.match(/class="vivo /g)?.length, 'um ponto só, o de quem trabalha agora').toBe(1)
  expect(r.alt).toMatch(/E9, executora, sessão encerrada/)
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
  expect(await ui.find({ key: `abrir:${E8}` }), 'sem botão').toBeUndefined()
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
  await ui.press({ key: `abrir:${P7}` })
  await relogio.settle()
  const durante = await lerSuperficie(ui)
  expect(durante).toMatch(/Abrindo…/)
  expect(durante, 'os outros botões seguem com o nome').toMatch(/Abrir P1/)
  await ui.press({ key: `abrir:${P7}` })
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
  expect(com.alt, 'sem a trava o dono é a linha "quem"').toMatch(/E8, executora, sessão encerrada/)
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
  const docs = Object.entries(filaTodos).map(([id, data]) => doc(id, { projeto: 'izanagi', ...data }))
  const itens = montarItens(docs, TEMAS_REAIS, null, undefined, [], AGORA)
  expect(itens.filter(x => x.situacao !== 'feito').length, 'os itens vivos existem').toBeGreaterThan(3)
  for (const i of itens.filter(x => x.situacao !== 'feito')) {
    const r = i.situacao === 'fila' ? filaSvg(300, i, AGORA) : cartaoSvg(300, i, AGORA, { situacao: () => undefined })
    expect(r.alt, `alt de ${i.id}`).toMatch(new RegExp(`^${i.id} · `))
    expect(r.source, `source de ${i.id}`).toContain(`>${i.id}<`)
    expect(lido.desktop, `o pane desenha ${i.id}`).toMatch(new RegExp(`${i.id} · `))
  }
})

const indiceDe = (...itens: Array<[string, string]>) => new Map(itens.map(([id, titulo]) => [id, { id, titulo, tema: 'editor', temaRotulo: 'Editor da loja', etapa: 'feito', projeto: 'izanagi' }]))

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
  const docs = Object.entries(filaTodos).map(([id, data]) => doc(id, { projeto: 'izanagi', ...data }))
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
  const docs = Object.entries(filaCompleta()).map(([id, data]) => doc(id, { projeto: 'izanagi', ...data }))
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
  expect(dois.source).toMatch(/izanagi|kit-de-orquestracao/)
  const um = D.todosSvg(300, grupos[0]!, { comProjeto: false })
  expect(um.source).not.toMatch(/izanagi|kit-de-orquestracao/)
  expect(dois.alt).toMatch(/F\d+ · /)
})

test('F43-6: filtro — 13, F13 e f13 acham só o F13; palavra sem acento acha título com acento; 99 não acha nada', () => {
  const lista = [...LISTA(), { id: 'F90', titulo: 'validação do painel', tema: 'editor', temaRotulo: 'Editor da loja', etapa: 'feito', projeto: 'izanagi' }]
  for (const f of ['13', 'F13', 'f13']) expect(R.filtrarIndice(lista, f).map(i => i.id), f).toEqual(['F13'])
  expect(R.filtrarIndice(lista, 'validacao').map(i => i.id)).toContain('F90')
  expect(R.filtrarIndice(lista, '99')).toEqual([])
  expect(R.filtrarIndice(lista, '  ').length, 'sem texto, a lista vem inteira').toBe(lista.length)
})

test('F43-7: pergunta com item: o rótulo é "F<n> · <título do item>", sem o tema', async ($, on) => {
  const perguntas = banco(doc('Q238', { projeto: 'izanagi', sessao: 's', sessaoId: 'local_b', titulo: 'qual', estado: 'aberta', item: 'F34' }))
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
  const com = cartaoSvg(360, itemCheio({ projeto: 'izanagi' }), AGORA, { situacao: situacaoDoTeste })
  expect(com.source, 'o desenho não pode vir vazio').toBeTruthy()
  expect(com.source).toContain('IZANAGI · EDITOR DA LOJA')
  const fila = filaSvg(360, itemCheio({ situacao: 'fila', com: [], projeto: 'kit-de-orquestracao' }), AGORA)
  expect(fila.source, 'a 360 px o tema pode encurtar; o projeto vem antes').toContain('KIT-DE-ORQUESTRACAO · EDITOR DA')
  const sem = cartaoSvg(360, itemCheio({ projeto: undefined }), AGORA, { situacao: situacaoDoTeste })
  expect(sem.source).toContain('EDITOR DA LOJA')
  expect(sem.source, 'sem projeto, nada de projeto no rótulo').not.toMatch(/IZANAGI|KIT-DE-ORQUESTRACAO/)
})

test('projeto no título: montarItens leva o projeto do documento ao item', () => {
  const [item] = montarItens([doc('F1', { titulo: 'x', tema: 'editor', etapa: 'execucao', projeto: 'Izanagi' })], TEMAS_REAIS, [], undefined, [], AGORA)
  expect(item, 'o item existe').toBeDefined()
  expect(item!.projeto).toBe('izanagi')
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
  expect(toasts.at(-1)).toBe('Modo ausente ligado. Para pré-abrir o pool, use /ausente on no chat.')
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
const ORQ_ATIVA = doc('local_orq_ativa', { projeto: 'izanagi', titulo: '🎛 orquestradora — izanagi', papel: 'orquestradora', estado: 'trabalhando' })
const ORQ_ARQUIVADA = doc('local_orq_velha', { projeto: 'izanagi', titulo: '🎛 orquestradora — izanagi', papel: 'orquestradora', estado: 'concluida' })
const MEMBRO = doc('local_e1', { projeto: 'izanagi', titulo: 'E1 · livre', papel: 'executor', estado: 'parada' })

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
  const { ui, enviadas, prompts, relogio, toasts } = await abrirDe({ bandeira: LIGADA(HA_3H), sessoesDocs: [ORQ_ATIVA, doc('local_orq_fantasma', { projeto: 'izanagi', papel: 'orquestradora', estado: 'trabalhando' })] }, $, on)
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
    const contadores = filhos(topo).slice(bandeira ? 2 : 1)
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

// F58: o chip "esperando E · N min" no cartão, na linha e na fila; some quando há quem trabalhe.
const ESPERA_DOC = (extra: Record<string, unknown> = {}) =>
  docF('F58', { projeto: 'kit', etapa: 'execucao', donoLocalId: 'local_P', donoApelido: 'P1', com: [{ localId: 'local_P', apelido: 'P1', oQue: 'planeja' }], historico: [{ em: new Date(AGORA - 35 * 60_000).toISOString(), etapa: 'execucao', dono: 'P1' }], ...extra })

test('F58: montarItens marca o item que anda sem E, e o cartão, a linha e o alt levam o chip com os minutos', () => {
  const [item] = monta([ESPERA_DOC()], [{ sessionId: 'local_P' }])
  expect(item?.esperando, 'o item sem E tem de sair esperando').toBeTruthy()
  expect(item?.esperando?.papel).toBe('E')
  const cartao = cartaoSvg(360, item as never, AGORA, { situacao: situacaoDoTeste })
  expect(cartao.source).toContain('esperando E · 35 min')
  expect(cartao.alt).toContain('esperando E · 35 min')
  expect(itemSvg(360, item as never, AGORA).source).toContain('esperando E · 35 min')
})

test('F58: item com E no com não mostra o chip', () => {
  const [item] = monta([ESPERA_DOC({ com: [{ localId: 'local_P', apelido: 'P1', oQue: 'a' }, { localId: 'local_E', apelido: 'E1', oQue: 'b' }] })], [{ sessionId: 'local_P' }, { sessionId: 'local_E' }])
  expect(item?.esperando).toBeUndefined()
  expect(cartaoSvg(360, item as never, AGORA, { situacao: situacaoDoTeste }).source).not.toContain('esperando')
})

test('F58: o item sem dono na fila leva os minutos no chip "espera execução"', () => {
  const [item] = monta([docF('F59', { projeto: 'kit', etapa: 'execucao', historico: [{ em: new Date(AGORA - 12 * 60_000).toISOString(), etapa: 'execucao', dono: null }] })])
  expect(item?.esperando?.papel).toBe('E')
  expect(filaSvg(360, item as never, AGORA).source).toContain('espera execução · 12 min')
})
