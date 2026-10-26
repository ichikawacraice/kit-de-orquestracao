import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { TestBody } from 'claude-code/testing'

const EU = 'local_eu'
const OUTRA = 'local_outra'
const HOME = '/home/teste'
const VEZ = `${HOME}/.claude/orquestracao/batida/vez.json`
const FALHAS = `${HOME}/.claude/orquestracao/batida/falhas.jsonl`
const SESSOES = `${HOME}/.claude/orquestracao/batida/sessoes.json`
const INSTALADOS = `${HOME}/.claude/plugins/installed_plugins.json`
const SCRIPT = '/cache/orquestracao/0.1.40/skills/orquestradora/scripts/painel.mjs'
const AGORA = Date.UTC(2026, 9, 26, 12)
const MIN = 60_000

type Opc = {
  env?: Record<string, string>
  vez?: { localId: string; em: number }
  semPlugin?: boolean
  mensagens?: Array<{ para: string; texto: string; item: string | null; tipo: string }>
  envioFalha?: 'erro' | 'excecao'
  /** Outra sessão regrava a vez nesses ms depois da nossa (a corrida). */
  roubaAVez?: boolean
}

async function iniciar($: Parameters<TestBody>[0], on: On, opc: Opc = {}) {
  on('command.register', () => ({ value: { command: 'x' } }))
  on('tool.register', () => ({ value: { tool: 'x' } }))
  on('ui.panes', () => ({ value: [] }))
  on('ui.open', () => ({ value: { isPlaced: false, reason: 'sem lugar' } }))
  const relogio = mock.clock(on, { now: AGORA })
  mock.env(on, { HOME, ...opc.env })
  mock.store(on)
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: '/work/kit' }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 1000, window: 1_000_000 }, rateLimits: [] } }))
  const arquivos = new Map<string, string>()
  if (opc.vez) arquivos.set(VEZ, JSON.stringify(opc.vez))
  if (!opc.semPlugin) arquivos.set(INSTALADOS, JSON.stringify({ version: 2, plugins: { 'orquestracao@kit-de-orquestracao': [{ scope: 'user', installPath: '/cache/orquestracao/0.1.40' }] } }))
  const escritas: string[] = []
  on('fs.list', () => ({ value: [] }))
  on('fs.read', (_, e) => {
    const t = arquivos.get(e.path)
    if (t === undefined) throw new Error(`ENOENT ${e.path}`)
    return { value: t }
  })
  on('fs.write', (_, e) => {
    escritas.push(e.path)
    arquivos.set(e.path, e.text)
    if (e.path === VEZ && opc.roubaAVez) arquivos.set(VEZ, JSON.stringify({ localId: OUTRA, em: AGORA }))
    return { value: undefined }
  })
  const logs: string[] = []
  on('ui.log', (_, e) => {
    logs.push(String((e as unknown as { text?: string }).text))
    return { value: undefined }
  })
  const chamadas: string[] = []
  const enviadas: Array<Record<string, unknown>> = []
  const listas: Array<Record<string, unknown>> = []
  on('tool.call', (_, e) => {
    chamadas.push(e.tool)
    const entrada = e as unknown as Record<string, unknown>
    if (e.tool === 'mcp__ccd_session_mgmt__get_session') return { result: {}, text: JSON.stringify({ sessionId: EU, title: 'eu', isRunning: true }) }
    if (e.tool === 'mcp__ccd_session_mgmt__list_sessions') {
      listas.push(entrada)
      return { result: {}, text: JSON.stringify([{ sessionId: OUTRA, title: 'E1 · livre', isRunning: false }]) }
    }
    if (e.tool === 'mcp__ccd_session_mgmt__send_message') {
      if (opc.envioFalha === 'excecao') throw new Error('caiu')
      if (opc.envioFalha === 'erro') return { result: {}, text: 'recusada', isError: true }
      enviadas.push(entrada)
      return { result: {}, text: 'sent' }
    }
    return { result: {}, text: '[]' }
  })
  const execucoes: Array<{ argv: readonly string[]; timeoutMs?: number }> = []
  on('process.run', (_, e) => {
    execucoes.push({ argv: e.argv, timeoutMs: e.init?.timeoutMs })
    return { value: { exitCode: 0, stdout: JSON.stringify({ mensagens: opc.mensagens ?? [], soltos: [], projetos: {}, marcadoresApagados: [] }), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  await $.session.start({ cwd: '/work/kit', surface: 'desktop', isInteractive: true })
  await relogio.settle()
  const nChamadas = () => chamadas.filter(c => c.endsWith('list_sessions')).length
  const rodarMinuto = async () => {
    await relogio.advance(MIN)
    await relogio.settle()
    await relogio.advance(3000) // a espera de 2 s da vez
    await relogio.settle()
  }

  return { relogio, arquivos, escritas, logs, chamadas, enviadas, listas, execucoes, nChamadas, rodarMinuto }
}

const dois = (para: string) => [
  { para, texto: 'F1 · item parado', item: 'F1', tipo: 'cutucada' },
  { para: 'local_terceira', texto: 'Batida', item: null, tipo: 'relatorio' },
]

test('vez nova: roda o script com a lista de sessões (e a própria) e grava a vez', async ($, on) => {
  const m = await iniciar($, on)
  await m.rodarMinuto()
  expect(m.execucoes.length, 'o script rodou').toBe(1)
  expect(m.execucoes[0].argv).toEqual(['node', SCRIPT, 'batida', '--sessoes', SESSOES])
  expect(m.execucoes[0].timeoutMs).toBe(60_000)
  expect(JSON.parse(m.arquivos.get(VEZ) ?? '{}').localId).toBe(EU)
  const lista = JSON.parse(m.arquivos.get(SESSOES) ?? '[]') as Array<{ sessionId: string }>
  expect(lista.map(s => s.sessionId).sort(), 'a lista leva a própria sessão').toEqual([EU, OUTRA])
  expect(m.listas[0].limit).toBe(200)
})

test('vez de 3 min de outra sessão: não roda (e com a vez velha, roda)', async ($, on) => {
  const nova = await iniciar($, on, { vez: { localId: OUTRA, em: AGORA - 3 * MIN } })
  await nova.rodarMinuto()
  expect(nova.execucoes.length).toBe(0)
  expect(nova.nChamadas()).toBe(0)
})

test('vez velha de outra sessão: roda', async ($, on) => {
  const m = await iniciar($, on, { vez: { localId: OUTRA, em: AGORA - 30 * MIN } })
  await m.rodarMinuto()
  expect(m.execucoes.length).toBe(1)
})

test('duas instâncias gravando ao mesmo tempo: a que se relê e não se acha dona não roda', async ($, on) => {
  const m = await iniciar($, on, { roubaAVez: true })
  await m.rodarMinuto()
  expect(m.escritas.includes(VEZ), 'ela chegou a gravar a vez').toBe(true)
  expect(m.execucoes.length).toBe(0)
})

test('o script devolve duas mensagens: dois send_message com o session_id certo', async ($, on) => {
  const m = await iniciar($, on, { mensagens: dois(OUTRA) })
  await m.rodarMinuto()
  expect(m.enviadas.map(e => e.session_id)).toEqual([OUTRA, 'local_terceira'])
  expect(m.enviadas[0].message).toBe('F1 · item parado')
})

test('send_message com erro: linha em falhas.jsonl e nenhuma exceção (e a seguinte ainda sai)', async ($, on) => {
  const m = await iniciar($, on, { mensagens: dois(OUTRA), envioFalha: 'erro' })
  await m.rodarMinuto()
  const linhas = (m.arquivos.get(FALHAS) ?? '').trim().split('\n').map(l => JSON.parse(l) as Record<string, unknown>)
  expect(linhas.length).toBe(2)
  expect(linhas[0]).toMatchObject({ para: OUTRA, item: 'F1', motivo: 'recusada' })
  expect(m.logs.some(l => l.includes('não chegou'))).toBe(true)
})

test('send_message que lança: também vai ao falhas.jsonl', async ($, on) => {
  const m = await iniciar($, on, { mensagens: dois(OUTRA), envioFalha: 'excecao' })
  await m.rodarMinuto()
  expect((m.arquivos.get(FALHAS) ?? '').trim().split('\n').length).toBe(2)
})

test('plugin orquestracao ausente: nada roda e o log diz', async ($, on) => {
  const m = await iniciar($, on, { semPlugin: true })
  await m.rodarMinuto()
  expect(m.execucoes.length).toBe(0)
  expect(m.logs.some(l => l.includes('batida sem o plugin orquestracao'))).toBe(true)
})

test('BATIDA=off: nenhum list_sessions (e ligada há chamada)', async ($, on) => {
  const ligada = await iniciar($, on)
  await ligada.rodarMinuto()
  expect(ligada.nChamadas(), 'prova: ligada, a batida chama o list_sessions').toBeGreaterThan(0)
})

test('BATIDA=off desliga', async ($, on) => {
  const m = await iniciar($, on, { env: { BATIDA: 'off' } })
  await m.rodarMinuto()
  expect(m.nChamadas()).toBe(0)
  expect(m.execucoes.length).toBe(0)
})

test('BATIDA_MIN troca o intervalo', async ($, on) => {
  const m = await iniciar($, on, { env: { BATIDA_MIN: '30' }, vez: { localId: OUTRA, em: AGORA - 20 * MIN } })
  await m.rodarMinuto()
  expect(m.execucoes.length, '20 min < 30: espera').toBe(0)
})
