import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import { porProjeto, projetoDe } from '../hooks/register.js'

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

const SESSOES = banco(
  doc('local_a', {
    projeto: 'izanagi',
    titulo: 'frente A',
    estado: 'trabalhando',
    etapa: 'medindo',
    passos: [
      { estado: 'feito', texto: 'ler' },
      { estado: 'andamento', texto: 'medir o gate' },
      { estado: 'pendente', texto: 'abrir PR' },
    ],
  }),
  doc('local_e', { projeto: 'izanagi', titulo: 'frente E', estado: 'bloqueada', bloqueio: 'rebase', motivo: 'conflito' }),
  doc('local_b', { projeto: 'izanagi', titulo: 'frente B', estado: 'aguarda-merge', pr: 12, prUrl: 'https://x/12' }),
  doc('local_c', { projeto: 'izanagi', titulo: 'velha', estado: 'concluida' }),
  doc('local_x', { projeto: 'Izanagi', titulo: 'id que não existe', estado: 'trabalhando' }),
  doc('orquestradora-izanagi', { projeto: 'izanagi', titulo: 'orq', estado: 'trabalhando', sessionId: 'local_o' }),
  doc('local_eu', { projeto: 'izanagi', titulo: 'eu mesma', estado: 'trabalhando' }),
)

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

function engine(on: On, falhaPasta = false, falhas: Falhas = {}) {
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
  on('ui.toast', () => ({ value: undefined }))
  const relogio = mock.clock(on, { now: Date.UTC(2026, 9, 23, 12) })
  mock.env(on, { HOME: '/home/teste' })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  // A pasta do painel em memória: um arquivo por documento.
  const arquivos = new Map<string, string>()
  for (const [colecao, docs] of [['sessoes', SESSOES], ['perguntas', PERGUNTAS]] as const) {
    for (const d of docs) arquivos.set(`${PASTA}/${colecao}/${d.id}.json`, JSON.stringify(d))
  }
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
    if (e.tool === 'mcp__ccd_session_mgmt__get_session') return { result: {}, text: EU }
    contagem.vivas++
    return { result: {}, text: VIVAS }
  })

  return { relogio, escritas, contagem, enviadas, prompts }
}

test('o pane cruza o painel com as sessões vivas, em toda superfície', async ($, on) => {
  const { relogio, escritas, contagem } = engine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run(ABRIR)
  await relogio.settle()

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    // O que a pessoa lê: o texto e, no desktop, o alt de cada desenho.
    const lido = (await ui.findAll({}))
      .map(el => `${el.text} ${typeof el.props.alt === 'string' ? el.props.alt : ''}`)
      .join('\n')
    expect(lido).toMatch(/Q7[^\n]*qual caminho/)
    expect(lido).not.toMatch(/Q5/)
    expect(lido).toMatch(/Perguntas anteriores · 1/)
    expect(lido).toMatch(/mas está parada/)
    expect(lido).toMatch(/nova sem linha/)
    expect(lido).toMatch(/sem linha no painel/)
    expect(lido).not.toMatch(/velha/)
    expect(lido).toMatch(/Trava \(conflito\): rebase/)
    expect(lido).toMatch(/bloqueadas/i)
    if (surface === 'desktop') expect(lido).toMatch(/1\/3 passos, agora: medir o gate — há 5 min/)
    expect(await ui.find({ key: 'atualizar' })).toBeDefined()
    // Só a linha de id inexistente falta; a própria sessão e a orquestradora (por sessionId) casam.
    expect(lido).toMatch(/não está na lista ao vivo/)
    expect(lido).not.toMatch(/rodando agora/)
    await ui.unmount()
  }
  expect(escritas).toEqual([])
  const antes = contagem.vivas
  await relogio.advance(60_000)
  expect(contagem.vivas).toBe(antes + 1)
  // Fechado, o pane para de ler.
  await $.command.run(ABRIR)
  await relogio.advance(180_000)
  expect(contagem.vivas).toBe(antes + 1)
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

test('a orquestradora vem primeiro no grupo do projeto, qualquer que seja o estado', async () => {
  const linha = (id: string, titulo: string, estado: string) => ({ id, projeto: 'Izanagi', titulo, estado, perguntas: [] })
  const grupos = porProjeto([
    linha('a', 'exec · algo', 'aguarda-voce'),
    linha('o', '🎛 orquestradora — izanagi', 'parada'),
    linha('b', 'plano · outro', 'trabalhando'),
  ])
  expect(grupos.length).toBe(1)
  expect(grupos[0]?.[1].map(l => l.id)).toEqual(['o', 'a', 'b'])
})

test('projetoDe: worktree do app, projeto fora de Projects/ e pasta simples', () => {
  expect(projetoDe('/Users/x/Developer/Projects/Izanagi/.claude/worktrees/ab-12')).toBe('izanagi')
  expect(projetoDe('/Users/x/Developer/Wake/sumire/.claude/worktrees/q')).toBe('sumire')
  expect(projetoDe('/Users/x/code/foo')).toBe('foo')
  expect(projetoDe('/Users/x/code/foo/worktrees/bar')).toBe('foo')
  expect(projetoDe('/Users/x/Developer/Projects/clientes/loja-x')).toBe('loja-x')
  expect(projetoDe(undefined)).toBe('?')
})
