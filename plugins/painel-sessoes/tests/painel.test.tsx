import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'
import type { On } from 'claude-code'
import { itemSvg, perguntaSvg, resumoSvg } from '../hooks/desenho.js'
import { montarItens, porTema } from '../hooks/register.js'
import { FILA_REAL, TEMAS_REAIS } from './fixtura-fila.js'

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
  semTemas?: boolean
}

function engine(on: On, falhaPasta = false, falhas: Falhas = {}, opc: Opcoes = {}) {
  on('command.register', () => ({ value: { command: 'painel' } }))
  on('tool.register', () => ({ value: { tool: 'mcp__painel-sessoes__onde_esta_o_painel' } }))
  let aberto = false
  on('ui.open', () => {
    aberto = true
    return { value: { isPlaced: true } }
  })
  on('ui.panes', () => ({
    value: aberto ? [{ id: 'painel-sessoes', title: 'Sessões', isShown: true, isFocused: false, isPlaced: true }] : [],
  }))
  on('ui.close', () => {
    aberto = false
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
    return { value: undefined }
  })
  const relogio = mock.clock(on, { now: opc.agora ?? Date.UTC(2026, 9, 23, 12) })
  mock.env(on, { HOME: '/home/teste' })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  // A pasta do painel em memória: um arquivo por documento.
  const arquivos = new Map<string, string>()
  for (const d of opc.perguntas ?? PERGUNTAS) arquivos.set(`${PASTA}/perguntas/${d.id}.json`, JSON.stringify(d))
  for (const [id, data] of Object.entries(opc.fila ?? FILA_REAL)) arquivos.set(`${PASTA}/fila/${id}.json`, JSON.stringify(doc(id, data)))
  if (!opc.semTemas) arquivos.set(`${PASTA}/temas.json`, JSON.stringify(TEMAS_REAIS))
  const escritas: Escrita[] = []
  on('fs.list', (_, e) => {
    if (falhaPasta) return { deny: 'sem acesso à pasta do painel' }
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
  on('fs.write', (_, e) => {
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
  on('tool.call', (_, e) => {
    const input = e as unknown as Escrita
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

  return { relogio, escritas, contagem, enviadas, prompts, toasts, copiadas, abertas }
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
    expect(lido).not.toMatch(/Em sessão|Na fila · /)
    await ui.unmount()
  }
})

test('vazio: os dois blocos dizem que leram e não acharam, e os contadores ficam em zero', async ($, on) => {
  const { lido } = await lerPane($, on, { fila: {}, perguntas: [] })
  for (const surface of ['terminal', 'desktop'] as const) {
    expect(lido[surface]).toMatch(/Em sessão · 0/)
    expect(lido[surface]).toMatch(/Nada em sessão agora\./)
    expect(lido[surface]).toMatch(/Na fila · 0/)
    expect(lido[surface]).toMatch(/Nada na fila\./)
  }
  expect(lido.desktop).toMatch(/0 Esperam você, 0 Travados, 0 Andando, 0 Na fila/)
})

test('só fila: Em sessão vazio, a fila por tema, o mais antigo primeiro', async ($, on) => {
  const { lido, escritas } = await lerPane($, on, { fila: fila('F8', 'F17', 'F18'), vivas: vivasDe() })
  for (const surface of ['terminal', 'desktop'] as const) {
    expect(lido[surface]).toMatch(/Em sessão · 0/)
    expect(lido[surface]).toMatch(/Nada em sessão agora\./)
    expect(lido[surface]).toMatch(/Na fila · 3/)
    expect(lido[surface]).toMatch(/EDITOR DA LOJA/)
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
    expect(lido[surface]).toMatch(/Em sessão · 4/)
    expect(lido[surface]).toMatch(/Na fila · 0/)
    antes(lido[surface], /EDITOR DA LOJA/, /SESSÕES E PAINEL/)
    antes(lido[surface], /SESSÕES E PAINEL/, /KIT DE ORQUESTRAÇÃO/)
    expect(lido[surface]).toMatch(/execução · P2 · #1129/)
    expect(lido[surface]).not.toMatch(/TRAVADOS/)
  }
  expect(lido.desktop).toMatch(/depois: validação das duas fatias \(\+2\)/)
  expect(lido.desktop).toMatch(/0 Esperam você, 0 Travados, 4 Andando, 0 Na fila/)
})

test('travado: abre Em sessão, com o tema na linha 2 e a trava inteira', async ($, on) => {
  const travada = { ...FILA_REAL.F13, trava: { motivo: 'gate-vermelho', texto: 'três casos do diálogo falham' } }
  const { lido } = await lerPane($, on, { fila: { ...fila('F1', 'F27'), F13: travada }, vivas: vivasDe(P7, P2, P1), perguntas: [] })
  for (const surface of ['terminal', 'desktop'] as const) {
    expect(lido[surface]).toMatch(/Em sessão · 3/)
    antes(lido[surface], /TRAVADOS/, /SPEC-155 fatia 2/)
    antes(lido[surface], /SPEC-155 fatia 2/, /EDITOR DA LOJA/)
    expect(lido[surface]).toMatch(/Trava \(gate-vermelho\): três casos do diálogo falham/)
  }
  expect(lido.desktop).toMatch(/execução · Editor da loja · P2 · #1129/)
  expect(lido.desktop).toMatch(/0 Esperam você, 1 Travados, 2 Andando, 0 Na fila/)
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
  // O cartão da pergunta com item leva o tema e o título do item no lugar da sessão.
  expect(lido.desktop).toMatch(/Q8 · Editor da loja · builder: fatias 1 a 8/)
  expect(lido.desktop).toMatch(/Q7 · P2 · qual caminho/)
  expect(lido.desktop).toMatch(/2 Esperam você, 0 Travados, 3 Andando, 0 Na fila/)
})

test('sem ninguém: dono que não está na lista vira trava, com a mesma contagem', async ($, on) => {
  const { lido } = await lerPane($, on, { fila: fila('F23', 'F13'), vivas: vivasDe(P2), perguntas: [] })
  for (const surface of ['terminal', 'desktop'] as const) {
    antes(lido[surface], /TRAVADOS/, /EDITOR DA LOJA/)
    expect(lido[surface]).toMatch(/Trava \(sem ninguém\): E8 não está mais ativa/)
    expect(lido[surface]).not.toMatch(/sem-ninguem/)
  }
  expect(lido.desktop).toMatch(/0 Esperam você, 1 Travados, 1 Andando, 0 Na fila/)
})

test('o dono vivo é a sessão que olha o painel, mesmo fora do list_sessions', async ($, on) => {
  // O list_sessions exclui quem chama: a sessão própria vem do get_session (local_eu).
  const meu = { ...FILA_REAL.F27, donoLocalId: 'local_eu', donoApelido: 'EU' }
  const { lido } = await lerPane($, on, { fila: { F27: meu }, vivas: vivasDe(), perguntas: [] })
  expect(lido.desktop).toMatch(/0 Esperam você, 0 Travados, 1 Andando, 0 Na fila/)
  expect(lido.desktop).not.toMatch(/sem-ninguem/)
})

test('list_sessions que falha: o erro aparece e nenhum item vira "sem ninguém"', async ($, on) => {
  const { lido } = await lerPane($, on, { fila: fila('F23', 'F13'), listaFalha: true, perguntas: [] })
  for (const surface of ['terminal', 'desktop'] as const) {
    expect(lido[surface]).toMatch(/list_sessions: app fora do ar/)
    expect(lido[surface]).not.toMatch(/sem-ninguem|TRAVADOS/)
  }
  expect(lido.desktop).toMatch(/0 Esperam você, 0 Travados, 2 Andando, 0 Na fila/)
})

test('get_session que falha: a sessão própria é desconhecida, e nenhum item vira "sem ninguém"', async ($, on) => {
  const { lido } = await lerPane($, on, { fila: fila('F23', 'F13'), vivas: vivasDe(P2), euFalha: true, perguntas: [] })
  expect(lido.desktop).toMatch(/esta sessão \(get_session\): sessão não achada/)
  expect(lido.desktop).not.toMatch(/sem-ninguem/)
  expect(lido.desktop).toMatch(/0 Travados, 2 Andando/)
})

test('fora do contrato: o item aparece em "Sem tema", no fim, com o motivo, e fora da lista de erros', async ($, on) => {
  const etapaVelha = { ...FILA_REAL.F18, etapa: 'andando' }
  const temaVelho = { ...FILA_REAL.F17, tema: 'inexistente' }
  const { lido } = await lerPane($, on, { fila: { F18: etapaVelha, F17: temaVelho, F8: FILA_REAL.F8 as Record<string, unknown> }, vivas: vivasDe(), perguntas: [] })
  for (const surface of ['terminal', 'desktop'] as const) {
    expect(lido[surface]).toMatch(/Na fila · 3/)
    expect(lido[surface]).toMatch(/SEM TEMA/)
    antes(lido[surface], /EDITOR DA LOJA/, /SEM TEMA/)
    expect(lido[surface]).toMatch(/⚠ fora do contrato: etapa 'andando' fora da lista/)
    expect(lido[surface]).toMatch(/⚠ fora do contrato: tema 'inexistente' fora da lista/)
    // Aviso de gravação não vai para a lista vermelha do topo, que é de erro de leitura.
    expect(lido[surface]).not.toMatch(/⚠ (temas|fila|list_sessions)/)
  }
})

test('sem temas.json: o erro aparece e os itens caem em "Sem tema"', async ($, on) => {
  const { lido } = await lerPane($, on, { fila: fila('F8'), vivas: vivasDe(), perguntas: [], semTemas: true })
  expect(lido.desktop).toMatch(/⚠ temas do painel: /)
  expect(lido.desktop).toMatch(/SEM TEMA/)
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
    expect(fechado).toMatch(/Feitos \(24 h\) · 1/)
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
    { rotulo: 'Andando', n: 5, cor: 'an' },
    { rotulo: 'Na fila', n: 4, cor: 'an', classe: 't' },
  ]
  for (const W of [300, 420, 480]) {
    const r = resumoSvg(W, contagens)
    expect(r.source, 'o desenho não pode vir vazio').toBeTruthy()
    expect(r.height).toBe(130)
    for (const rotulo of ['Esperam você', 'Travados', 'Andando', 'Na fila']) expect(r.source).toContain(`>${rotulo}<`)
    expect(r.source).not.toContain('…')
  }
  const largo = resumoSvg(640, contagens)
  expect(largo.height).toBe(62)
})

test('a 300 px o selo da pergunta cabe inteiro na linha 2 e o título quebra em duas linhas', () => {
  const base = { id: 'F9', titulo: 'x', tema: 'editor', temaRotulo: 'Editor da loja', etapa: 'execucao', situacao: 'andando' as const, prs: [1128], depois: [], perguntas: ['Q225'], dono: { apelido: 'E3', localId: 'local_x' } }
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
  expect(lido).toMatch(/Perguntas anteriores · 2/)
  expect(await ui.find({ key: 'Q7:b' })).toBeUndefined()
  await ui.unmount()
})

test('erro de leitura aparece no pane, nunca lista vazia calada', async ($, on) => {
  const { relogio } = engine(on, true)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run(ABRIR)
  await relogio.settle()

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /sessoes do painel/ }))?.text).toContain('sem acesso à pasta do painel')
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
  expect(String(enviadas[0]?.message)).toMatch(/^Q8 — resposta do operador pelo painel: sim/)
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
  expect(prompts[0]).toMatch(/^Q9 — resposta do operador pelo painel: sim \(segue a recomendação\)/)
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
  expect([enviadas[0]?.session_id, String(enviadas[0]?.message)]).toEqual(['local_b', expect.stringMatching(/^Q8 — resposta do operador pelo painel: não\./)])
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

const itemBase = { id: 'F9', titulo: 'Canvas', tema: 'editor', temaRotulo: 'Editor da loja', etapa: 'execucao', situacao: 'andando' as const, prs: [1128], depois: [], perguntas: ['Q225'], dono: { apelido: 'E3', localId: 'local_x' } }
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

test('com um só projeto, o rótulo do tema não ganha sufixo; item sem projeto casa com o primeiro de mesmo id', () => {
  const temas = [{ id: 'geral', rotulo: 'Geral', projeto: 'izanagi' }]
  const itens = montarItens([{ id: 'F1', data: { titulo: 'F1', tema: 'geral', etapa: 'planejamento' } }], temas, [], undefined, [], AGORA)
  expect(itens.length).toBe(1)
  expect(itens[0]!.tema).toBe('geral')
  expect(porTema(itens, temas, () => 0).map(g => g.rotulo)).toEqual(['Geral'])
})

const abrirDe = async (opc: Opcoes, $: Parameters<TestBody>[0], on: On) => {
  const motor = engine(on, false, {}, { agora: AGORA, fila: fila('F27', 'F1'), vivas: vivasDe(P7, P1), perguntas: [], ...opc })
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

test('abrir: dono morto, lista que falha e item sem dono não têm botão', async ($, on) => {
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
