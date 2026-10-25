import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { LinhaSessao, Leitura, Passo, PerguntaAberta, PerguntaAnterior } from '../types'
import { ALTURA_RESUMO, anteriorSvg, perguntaSvg, resumoSvg, sessaoSvg } from './desenho'

// Painel das sessões num pane (Q63, opção A): lê os documentos de
// ~/.claude/orquestracao/painel/<coleção>/<id>.json, que as sessões gravam pelo
// script painel.mjs da skill orquestradora, e cruza com o list_sessions ao vivo.
// Só escreve a resposta de uma pergunta aberta (Q67).

const PANE = 'painel-sessoes'
const TITULO = 'Sessões'
const INTERVALO_MS = 60_000
const PASTA = '.claude/orquestracao/painel'

const VAZIA: Leitura = { lidoEm: null, lendo: false, erros: [], avisos: [], sessoes: [], perguntas: [], anteriores: [] }
const leitura = atom({ plugin: 'painel-sessoes', key: 'leitura' } as const, VAZIA)
const respondendoEm = atom({ plugin: 'painel-sessoes', key: 'respondendoEm' } as const, null as string | null)
const verAnteriores = atom({ plugin: 'painel-sessoes', key: 'verAnteriores' } as const, false)

// As respostas rápidas das perguntas sem opções próprias: o texto vai ao banco e à sessão.
const RAPIDAS = [
  { id: 'sim', label: 'Sim', resposta: 'sim (segue a recomendação)' },
  { id: 'nao', label: 'Não', resposta: 'não' },
  { id: 'adiar', label: 'Adiar', resposta: "adiar (fica o que diz o 'se não decidir')" },
] as const
const ANTERIORES = 15

type Vivo = {
  sessionId: string
  title?: string
  cwd?: string
  isArchived?: boolean
  isRunning?: boolean
  prNumber?: number
  prState?: string
  lastActivityAt?: string
  link?: string
}

type Doc = { id: string; data: Record<string, unknown>; version?: number }

/** Um documento do painel: o arquivo inteiro, `{ id, version, data }`. */
export function lerDoc(texto: string, nome: string): Doc {
  const v = JSON.parse(texto) as Partial<Doc>
  if (!v || typeof v.data !== 'object' || v.data === null) throw new Error(`${nome}: sem o campo data`)

  return { id: typeof v.id === 'string' ? v.id : nome.replace(/\.json$/, ''), data: v.data, version: v.version }
}

/** O array JSON do list_sessions. */
export function lerVivas(texto: string): Vivo[] {
  const inicio = texto.indexOf('[')
  if (inicio < 0) throw new Error('list_sessions não devolveu uma lista: ' + texto.slice(0, 120))

  return JSON.parse(texto.slice(inicio)) as Vivo[]
}

export function projetoDe(cwd: string | undefined): string {
  if (!cwd) return '?'
  // Worktree do app (`<repo>/.claude/worktrees/<x>`) e `<repo>/worktrees/<x>` valem o repositório, não o worktree.
  const raiz = cwd.replace(/\/\.claude\/worktrees(\/.*)?$/, '').replace(/\/worktrees\/[^/]+\/?$/, '')
  const m = /\/Projects\/([^/]+)/.exec(raiz)
  const nome = m?.[1] ?? raiz.split('/').filter(Boolean).pop() ?? '?'

  return nome.toLowerCase()
}

const texto = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() !== '' ? v : typeof v === 'number' ? String(v) : undefined

/**
 * Cruza as linhas do painel com o estado vivo das sessões, pelo campo
 * `sessionId` da linha quando existe, senão pelo id do documento.
 * `proprio`: o id desta sessão (o list_sessions exclui quem chama, então ela
 * vem do get_session "self"); sem ele não se afirma que uma linha falta.
 */
export function cruzar(docs: Doc[], vivas: Vivo[], proprio?: string): LinhaSessao[] {
  const porId = new Map(vivas.map(v => [v.sessionId, v]))
  const linhas: LinhaSessao[] = docs.map(d => {
    const chave = texto(d.data.sessionId) ?? d.id
    const v = porId.get(chave)
    const estado = texto(d.data.estado) ?? '?'
    const linha: LinhaSessao = {
      id: chave,
      projeto: (texto(d.data.projeto) ?? projetoDe(v?.cwd)).toLowerCase(),
      titulo: texto(d.data.titulo) ?? v?.title ?? d.id,
      estado,
      etapa: texto(d.data.etapa),
      pr: texto(d.data.pr),
      prUrl: texto(d.data.prUrl),
      bloqueio: texto(d.data.bloqueio),
      motivo: texto(d.data.motivo),
      perguntas: Array.isArray(d.data.perguntas) ? d.data.perguntas.map(String) : [],
      atualizadoEm: texto(d.data.atualizadoEm),
      passos: lerPassos(d.data.passos),
      ativaEm: v?.lastActivityAt,
    }
    if (v) {
      linha.vivo = {
        isRunning: v.isRunning === true,
        isArchived: v.isArchived === true,
        prNumber: v.prNumber,
        prState: v.prState,
      }
      linha.divergencia = divergencia(estado, linha.vivo)
    } else if (proprio && vivas.length > 0 && estado !== 'concluida') {
      linha.divergencia = 'não está na lista ao vivo (id errado ou sessão antiga)'
    }

    return linha
  })
  const comLinha = new Set(docs.map(d => texto(d.data.sessionId) ?? d.id))
  for (const v of vivas) {
    if (comLinha.has(v.sessionId) || v.isArchived) continue
    linhas.push({
      id: v.sessionId,
      projeto: projetoDe(v.cwd),
      titulo: v.title ?? v.sessionId,
      estado: v.isRunning ? 'trabalhando' : 'parada',
      pr: v.prNumber ? String(v.prNumber) : undefined,
      perguntas: [],
      vivo: { isRunning: v.isRunning === true, isArchived: false, prNumber: v.prNumber, prState: v.prState },
      semLinha: true,
      ativaEm: v.lastActivityAt,
      divergencia: 'sem linha no painel',
    })
  }

  return linhas
}

const numero = (id: string) => Number(id.replace(/\D/g, '')) || 0

/** O endereço que abre a sessão no app: o que o list_sessions dá, ou o mesmo formato montado. */
export function linkDe(sessaoId: string | undefined, vivas: Vivo[]): string | undefined {
  if (!sessaoId) return undefined

  return vivas.find(v => v.sessionId === sessaoId)?.link ?? `claude://claude.ai/epitaxy/${sessaoId}`
}

/** Só os passos com texto; estado fora de feito/andamento conta como pendente. */
export function lerPassos(v: unknown): Passo[] | undefined {
  if (!Array.isArray(v)) return undefined
  const passos = v.flatMap(p => {
    const o = (p ?? {}) as Record<string, unknown>
    const t = texto(o.texto)
    if (!t) return []
    const estado = o.estado === 'feito' || o.estado === 'andamento' ? o.estado : 'pendente'

    return [{ texto: t, estado, detalhe: texto(o.detalhe) }]
  })

  return passos.length > 0 ? passos : undefined
}

export function divergencia(estado: string, vivo: NonNullable<LinhaSessao['vivo']>): string | undefined {
  if (vivo.isArchived) return estado === 'concluida' ? undefined : `arquivada, o painel diz ${estado}`
  if (estado === 'trabalhando' && !vivo.isRunning) return 'o painel diz trabalhando, mas está parada'
  if (estado !== 'trabalhando' && vivo.isRunning) return `rodando agora, o painel diz ${estado}`

  return undefined
}

const SELO: Record<string, string> = {
  trabalhando: '🔵',
  'aguarda-subsessao': '🔵',
  'aguarda-voce': '🟡',
  'aguarda-validacao': '🟡',
  'aguarda-merge': '🟢',
  bloqueada: '🔴',
  parada: '⚪',
  concluida: '⚪',
}

const ORDEM = [
  'aguarda-voce',
  'bloqueada',
  'trabalhando',
  'aguarda-subsessao',
  'aguarda-validacao',
  'aguarda-merge',
  'pr-aberto',
  'esperando',
  'parada',
  'concluida',
]

export const selo = (estado: string) => SELO[estado] ?? '⚪'

/** Cor do ponto e do rótulo de cada estado, em chaves do tema (seguem claro/escuro). */
const COR: Record<string, string> = {
  trabalhando: 'suggestion',
  'aguarda-subsessao': 'suggestion',
  'aguarda-voce': 'warning',
  'aguarda-validacao': 'warning',
  'aguarda-merge': 'success',
  bloqueada: 'error',
}

const COR_RESUMO: Record<string, string> = { warning: '#e2a94e', error: '#e0846b', suggestion: '#5b8def', success: '#4caf6e' }

const ROTULO: Record<string, string> = {
  trabalhando: 'trabalhando',
  'aguarda-subsessao': 'espera subsessão',
  'aguarda-voce': 'espera você',
  'aguarda-validacao': 'espera validação',
  'aguarda-merge': 'espera merge',
  bloqueada: 'bloqueada',
  parada: 'parada',
  concluida: 'concluída',
}

const pos = (estado: string) => {
  const i = ORDEM.indexOf(estado)

  return i < 0 ? ORDEM.length : i
}

const orquestradora = (l: LinhaSessao) => /^🎛\s*orquestradora/i.test(l.titulo)

const ativa = (l: LinhaSessao) => l.estado !== 'concluida' && !l.vivo?.isArchived

export function porProjeto(linhas: LinhaSessao[]): Array<[string, LinhaSessao[]]> {
  const grupos = new Map<string, LinhaSessao[]>()
  for (const l of linhas.filter(ativa)) {
    const g = grupos.get(l.projeto) ?? []
    g.push(l)
    grupos.set(l.projeto, g)
  }
  // A orquestradora abre o grupo, qualquer que seja o estado dela (pedido do operador, 23/10).
  for (const g of grupos.values()) g.sort((a, b) => Number(orquestradora(b)) - Number(orquestradora(a)) || pos(a.estado) - pos(b.estado))

  return [...grupos.entries()].sort(([a], [b]) => a.localeCompare(b))
}

const dois = (n: number) => String(n).padStart(2, '0')

export function hora(ms: number): string {
  const d = new Date(ms)

  return `${dois(d.getHours())}:${dois(d.getMinutes())}:${dois(d.getSeconds())}`
}

const mensagem = (err: unknown) => (err instanceof Error ? err.message : String(err))

let timer: { cancel: () => void } | undefined

/** Lê agora e a cada 60 s, enquanto o pane estiver aberto. */
function ligar($: EngineInterface): void {
  timer?.cancel()
  timer = $.clock.every(INTERVALO_MS, () => void atualizar($))
  void atualizar($)
}

function parar(): void {
  timer?.cancel()
  timer = undefined
}
let emCurso = false
/** `opcoes` da pergunta: lista de `{ id, label }`; o que não tiver as duas fica de fora. */
export function lerOpcoes(v: unknown): Array<{ id: string; label: string }> {
  if (!Array.isArray(v)) return []

  return v.flatMap(o => {
    const id = texto((o as Record<string, unknown> | null)?.id)
    const label = texto((o as Record<string, unknown> | null)?.label) ?? id

    return id && label ? [{ id, label }] : []
  })
}

let pastaLida: string | undefined
const respondendo = new Set<string>()

/**
 * Responde uma pergunta pelo painel (Q67): grava `resposta` e `estado:
 * respondida`, presa à versão lida, para não sobrescrever quem respondeu antes.
 */
async function responder($: EngineInterface, q: PerguntaAberta, resposta: string): Promise<void> {
  if (respondendo.has(q.id) || !resposta.trim()) return
  respondendo.add(q.id)
  try {
    const agora = new Date(await $.clock.now()).toISOString()
    if (!pastaLida) throw new Error('a pasta do painel ainda não foi lida')
    const arquivo = `${pastaLida}/perguntas/${q.id}.json`
    // Presa à versão lida: quem respondeu antes (no chat ou noutra janela) não é sobrescrito.
    const atual = lerDoc((await $.fs.read(arquivo)) as string, `${q.id}.json`)
    if (atual.data.estado !== 'aberta' || (q.versao !== undefined && atual.version !== q.versao)) {
      throw new Error(`${q.id} mudou desde a leitura (agora: ${String(atual.data.estado)}); nada gravado`)
    }
    const data = { ...atual.data, estado: 'respondida', resposta: resposta.trim(), atualizadoEm: agora }
    await $.fs.write(arquivo, `${JSON.stringify({ id: q.id, version: (atual.version ?? 0) + 1, data }, null, 2)}\n`)
    await update($, respondendoEm, atual => (atual === q.id ? null : atual))
    entregar($, q, resposta.trim())
  } catch (err) {
    await avisar($, `${q.id} não gravada: ${mensagem(err)}`)
  } finally {
    respondendo.delete(q.id)
  }
  await atualizar($)
}

const AVISOS = 10
// A falha de uma resposta fica em `avisos`, que a releitura não apaga: só o botão de limpar.
const avisar = ($: EngineInterface, aviso: string) =>
  update($, leitura, l => ({ ...l, avisos: [...(l.avisos ?? []), aviso].slice(-AVISOS) }))

const naoChegou = ($: EngineInterface, q: PerguntaAberta, motivo: string) =>
  avisar($, `${q.id} gravada, mas não chegou à sessão (${motivo}); abra a sessão pela barra lateral e responda lá`)

/**
 * Leva a resposta ao modelo da sessão dona. Outra sessão: send_message. A
 * própria (o painel aberto nela): um prompt desta sessão, que entra quando ela
 * fica livre — por isso não se espera por ele. Falha vira erro no pane.
 */
function entregar($: EngineInterface, q: PerguntaAberta, resposta: string): void {
  const texto = `${q.id} — resposta do operador pelo painel: ${resposta}. A pergunta já está como respondida no painel.`
  if (!q.sessaoId) {
    void naoChegou($, q, 'a pergunta não tem sessaoId')

    return
  }
  if (q.propria) {
    void $.prompt.submit({ text: texto }).then(
      r => {
        if (r.drop !== undefined) return naoChegou($, q, r.drop || 'o prompt foi recusado')
        $.ui.toast(`${q.id} respondida e entregue a esta sessão: ${resposta}`)
      },
      err => naoChegou($, q, mensagem(err)),
    ).catch(() => {})

    return
  }
  void $.tool
    .call({ tool: 'mcp__ccd_session_mgmt__send_message', session_id: q.sessaoId, message: texto })
    .then(
      envio => {
        if (envio.deny !== undefined || envio.isError) return naoChegou($, q, envio.deny || envio.text || 'erro sem texto')
        $.ui.toast(`${q.id} respondida e enviada à sessão: ${resposta}`)
      },
      err => naoChegou($, q, mensagem(err)),
    )
    .catch(() => {})
}

// O último lugar onde uma superfície desenhou o pane: o que a tool de diagnóstico relata.
const desenhos: Record<string, { placement: string; bodyColumns: number; em: string }> = {}


// Uma leitura por vez; a falha que escapa vira erro visível, nunca rejeição solta.
async function atualizar($: EngineInterface): Promise<void> {
  if (emCurso) return
  emCurso = true
  try {
    await ler($)
  } catch (err) {
    await update($, leitura, l => ({ ...l, lendo: false, erros: [...l.erros, `leitura: ${mensagem(err)}`] })).catch(() => {})
  } finally {
    emCurso = false
  }
}

// A leitura inteira: duas fontes, cada uma com o próprio erro, nunca lista vazia calada.
async function ler($: EngineInterface): Promise<void> {
  await update($, leitura, l => ({ ...l, lendo: true }))
  const erros: string[] = []
  const pasta = `${await $.env.get('HOME')}/${PASTA}`
  pastaLida = pasta

  const lerColecao = async (collection: string): Promise<Doc[]> => {
    const entradas = await $.fs.list(`${pasta}/${collection}`)
    const docs: Doc[] = []
    for (const e of entradas) {
      if (e.kind !== 'file' || !e.name.endsWith('.json')) continue
      try {
        docs.push(lerDoc((await $.fs.read(`${pasta}/${collection}/${e.name}`)) as string, e.name))
      } catch (err) {
        erros.push(`${collection}/${e.name}: ${mensagem(err)}`)
      }
    }

    return docs
  }

  let docsSessoes: Doc[] = []
  let docsPerguntas: Doc[] = []
  let vivas: Vivo[] = []
  await Promise.all([
    lerColecao('sessoes').then(
      d => void (docsSessoes = d),
      err => void erros.push(`sessoes do painel: ${mensagem(err)}`),
    ),
    lerColecao('perguntas').then(
      d => void (docsPerguntas = d),
      err => void erros.push(`perguntas do painel: ${mensagem(err)}`),
    ),
    $.tool
      .call({
        tool: 'mcp__ccd_session_mgmt__list_sessions',
        linked: false,
        include_archived: true,
        limit: 40,
      })
      .then(r => {
        if (r.deny !== undefined) throw new Error(r.deny)
        if (r.isError) throw new Error(r.text ?? 'erro sem texto')
        vivas = lerVivas(r.text ?? '')
      })
      .catch(err => void erros.push(`list_sessions: ${mensagem(err)}`)),
  ])
  // O list_sessions exclui a sessão que chama: ela vem do get_session.
  let proprio: string | undefined
  try {
    const r = await $.tool.call({ tool: 'mcp__ccd_session_mgmt__get_session', session_id: 'self' })
    if (r.deny !== undefined) throw new Error(r.deny)
    if (r.isError) throw new Error(r.text ?? 'erro sem texto')
    const eu = JSON.parse(r.text ?? '') as Vivo
    proprio = eu.sessionId
    vivas = [...vivas.filter(v => v.sessionId !== eu.sessionId), eu]
  } catch (err) {
    erros.push(`esta sessão (get_session): ${mensagem(err)}`)
  }

  // O nome que a pergunta mostra: o `sessao` dela, senão o título da sessão pelo sessaoId — nunca o id cru.
  const pareceId = (t: string) => /^(local_)?[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(t)
  const nomeDaSessao = (sessao: string | undefined, sessaoId: string | undefined) => {
    if (sessao && sessao !== sessaoId && !pareceId(sessao)) return sessao
    const id = sessaoId ?? sessao
    if (!id) return '?'
    const doc = docsSessoes.find(d => (texto(d.data.sessionId) ?? d.id) === id)
    return texto(doc?.data.titulo) ?? vivas.find(v => v.sessionId === id)?.title ?? 'sessão sem nome'
  }
  const perguntas: PerguntaAberta[] = docsPerguntas
    .filter(d => d.data.estado === 'aberta')
    .map(d => ({
      id: d.id,
      projeto: (texto(d.data.projeto) ?? '?').toLowerCase(),
      sessao: nomeDaSessao(texto(d.data.sessao), texto(d.data.sessaoId)),
      titulo: texto(d.data.titulo) ?? texto(d.data.pergunta) ?? texto(d.data.texto) ?? '',
      versao: d.version,
      opcoes: lerOpcoes(d.data.opcoes),
      sessaoId: texto(d.data.sessaoId),
      link: linkDe(texto(d.data.sessaoId), vivas),
      propria: proprio !== undefined && texto(d.data.sessaoId) === proprio,
      caso: texto(d.data.caso),
      recomendacao: texto(d.data.recomendacao),
      seNaoDecidir: texto(d.data.seNaoDecidir),
    }))
    .sort((a, b) => numero(a.id) - numero(b.id))
  const anteriores: PerguntaAnterior[] = docsPerguntas
    .filter(d => d.data.estado !== 'aberta')
    .sort((a, b) => numero(b.id) - numero(a.id))
    .slice(0, ANTERIORES)
    .map(d => ({
      id: d.id,
      titulo: texto(d.data.titulo) ?? texto(d.data.pergunta) ?? texto(d.data.texto) ?? '',
      sessao: nomeDaSessao(texto(d.data.sessao), texto(d.data.sessaoId)),
      estado: texto(d.data.estado) ?? '?',
      resposta: texto(d.data.resposta),
      recomendacao: texto(d.data.recomendacao),
      quando: texto(d.data.atualizadoEm) ?? texto(d.data.respondidaEm),
    }))

  const agora = await $.clock.now()
  await update($, leitura, l => ({
    avisos: l.avisos ?? [],
    lidoEm: agora,
    lendo: false,
    erros,
    sessoes: cruzar(docsSessoes, vivas, proprio),
    perguntas,
    anteriores,
  }))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const r = await next(e)
    await $.command.register({ name: 'painel', description: 'Abre ou fecha o painel das sessões' })
    await $.tool.register({
      name: 'onde_esta_o_painel',
      description:
        'Diagnóstico do mod painel-sessoes: abre o pane do painel (se fechado) e diz onde cada superfície o desenhou (dock/inline) e com que largura. Só leitura.',
    })
    // Global em toda sessão: só lê enquanto o pane está aberto, nunca de fundo.
    if ((await $.ui.panes()).some(p => p.id === PANE)) ligar($)

    return r
  })

  on('command.run', { command: 'painel' }, async $ => {
    const aberto = (await $.ui.panes()).some(p => p.id === PANE)
    if (aberto) {
      await $.ui.close({ id: PANE })
      parar()

      return { text: 'Painel das sessões fechado.' }
    }
    const r = await $.ui.open({ id: PANE, title: TITULO, columns: 60 })
    ligar($)

    return {
      text: r.isPlaced ? 'Painel das sessões aberto.' : `Painel aberto, mas sem lugar agora: ${r.reason}`,
    }
  })

  on('ui.close', async ($, e, next) => {
    if (e.id === PANE) parar()

    return next(e)
  })

  on('tool.call', { tool: 'mcp__painel-sessoes__onde_esta_o_painel' }, async $ => {
    const aberto = await $.ui.open({ id: PANE, title: TITULO, columns: 60 })
    ligar($)
    await $.clock.sleep(1500)
    const l = await read($, leitura)
    const lido = {
      lidoEm: l.lidoEm === null ? null : hora(l.lidoEm),
      erros: l.erros,
      avisos: l.avisos,
      perguntas: l.perguntas.map(q => q.id),
      sessoes: porProjeto(l.sessoes).map(([p, g]) => [p, g.map(s => `${selo(s.estado)} ${s.titulo}${s.divergencia ? ` ≠ ${s.divergencia}` : ''}`)]),
    }
    const texto = JSON.stringify({ aberto, panes: await $.ui.panes(), desenhos, lido }, null, 2)

    return { result: texto, text: texto }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const elementos = $.ui.resolve(e)
    const { Box, Text, Button, Link } = elementos
    // Campo de texto só onde a superfície tem um; sem ele, a opção "outra" fica sem campo.
    const Input = 'Input' in elementos ? elementos.Input : undefined
    const agora = await $.clock.now()
    desenhos[e.surface] = { placement: e.props.placement, bodyColumns: e.props.bodyColumns, em: hora(agora) }
    const l = await read($, leitura)
    // O estado da sessão sobrevive ao reload: o de antes desta versão não tem `avisos`.
    const avisos = l.avisos ?? []
    const grupos = porProjeto(l.sessoes)
    const ocultas = l.sessoes.length - grupos.reduce((n, [, g]) => n + g.length, 0)

    const ativas = grupos.flatMap(([, g]) => g)
    const conta = (...estados: string[]) => ativas.filter(s => estados.includes(s.estado)).length
    const resumo = [
      { n: conta('aguarda-voce', 'aguarda-validacao'), rotulo: 'esperam você', cor: 'warning' },
      { n: conta('bloqueada'), rotulo: 'bloqueadas', cor: 'error' },
      { n: conta('trabalhando', 'aguarda-subsessao'), rotulo: 'trabalhando', cor: 'suggestion' },
      { n: conta('aguarda-merge', 'pr-aberto'), rotulo: 'para merge', cor: 'success' },
    ]
    const resumo4 = resumo.map(r => ({ ...r, rotulo: r.rotulo.charAt(0).toUpperCase() + r.rotulo.slice(1), cor: COR_RESUMO[r.cor] ?? '#9a9a96' }))

    const aberta = await read($, respondendoEm)
    const verVelhas = await read($, verAnteriores)

    // Os botões de uma pergunta: as opções dela (Q67) ou Sim/Não/Adiar/Responder, que vão à sessão que perguntou.
    const acoes = (q: PerguntaAberta) => {
      const proprias = q.opcoes.filter(o => o.id !== 'outra')
      const comCampo = q.opcoes.length === 0 || q.opcoes.some(o => o.id === 'outra')

      return (
        <Box flexDirection="column" gap={1}>
          <Box flexDirection="row" flexWrap="wrap" columnGap={1} alignItems="center">
            {proprias.length > 0
              ? proprias.map((o, i) => (
                  <Button
                    key={`${q.id}:${o.id}`}
                    variant={i === 0 ? 'primary' : 'secondary'}
                    onPress={() => void responder($, q, o.id)}
                  >
                    {o.label}
                  </Button>
                ))
              : RAPIDAS.map((r, i) => (
                  <Button
                    key={`${q.id}:${r.id}`}
                    variant={i === 0 ? 'primary' : 'secondary'}
                    onPress={() => void responder($, q, r.resposta)}
                  >
                    {r.label}
                  </Button>
                ))}
            {Input && comCampo && (
              <Button
                key={`${q.id}:responder`}
                variant="secondary"
                onPress={() => void update($, respondendoEm, atual => (atual === q.id ? null : q.id))}
              >
                {aberta === q.id ? 'Fechar' : 'Responder'}
              </Button>
            )}
          </Box>
          {Input && comCampo && aberta === q.id && (
            <Input
              key={`${q.id}:outra`}
              placeholder={q.propria ? 'sua resposta, vai para esta sessão…' : 'sua resposta, vai direto para a sessão…'}
              submitLabel="Enviar"
              onSubmit={(valor: string) => void responder($, q, valor)}
            />
          )}
        </Box>
      )
    }

    const limparAvisos =
      avisos.length > 0 ? (
        <Button key="avisos:limpar" plain dimColor onPress={() => void update($, leitura, v => ({ ...v, avisos: [] }))}>
          ✕ limpar avisos
        </Button>
      ) : null

    const botaoAnteriores =
      l.anteriores.length > 0 ? (
        <Button key="anteriores" plain dimColor onPress={() => void update($, verAnteriores, v => !v)}>
          {`${verVelhas ? '▾' : '▸'} Perguntas anteriores · ${l.anteriores.length}`}
        </Button>
      ) : null

    if (e.surface === 'desktop' && 'Svg' in elementos) {
      const { Svg } = elementos
      const W = Math.max(240, Math.min(900, (e.props.bodyColumns || 40) * 8 - 8))
      const titulo = (t: string) => <Text bold>{t}</Text>

      return (
        <Box flexDirection="column" gap={1}>
          <Svg
            source={resumoSvg(W, resumo4)}
            alt={resumo4.map(r => `${r.n} ${r.rotulo}`).join(', ')}
            width={W}
            height={ALTURA_RESUMO}
          />
          <Box flexDirection="row" justifyContent="space-between" alignItems="center">
            <Text dimColor>
              {l.lendo ? 'lendo…' : l.lidoEm === null ? 'ainda não lido' : `lido às ${hora(l.lidoEm)} · a cada 60 s`}
            </Text>
            <Button key="atualizar" plain dimColor onPress={() => void atualizar($)}>
              ↻ Atualizar
            </Button>
          </Box>

          {[...avisos, ...l.erros].map(err => (
            <Text color="error" wrap="wrap">
              ⚠ {err}
            </Text>
          ))}
          {limparAvisos}

          {l.perguntas.length > 0 && (
            <Box flexDirection="column" gap={1}>
              {titulo(`Perguntas abertas · ${l.perguntas.length}`)}
              {l.perguntas.map(q => {
                const card = perguntaSvg(W, q)

                return (
                  <Box flexDirection="column" gap={1} paddingBottom={1}>
                    <Svg
                      key={`pergunta:${q.id}`}
                      source={card.source}
                      alt={[`${q.id} · ${q.sessao} · ${q.titulo}`, q.caso, q.seNaoDecidir && `Se não decidir: ${q.seNaoDecidir}`, q.recomendacao && `Recomendo: ${q.recomendacao}`].filter(Boolean).join(' — ')}
                      width={W}
                      height={card.height}
                    />
                    {acoes(q)}
                  </Box>
                )
              })}
            </Box>
          )}

          {botaoAnteriores}
          {verVelhas &&
            l.anteriores.map(a => {
              const linha = anteriorSvg(W, a, agora)

              return <Svg key={`anterior:${a.id}`} source={linha.source} alt={linha.alt} width={W} height={linha.height} />
            })}

          {grupos.length === 0 && l.lidoEm !== null && (
            <Text dimColor>Nenhuma sessão ativa no painel nem na lista ao vivo.</Text>
          )}
          {grupos.map(([projeto, linhas]) => (
            <Box flexDirection="column" gap={1}>
              {titulo(`${projeto.charAt(0).toUpperCase()}${projeto.slice(1)} · ${linhas.length}`)}
              {linhas.map(s => {
                const linha = sessaoSvg(W, s, agora)

                return <Svg key={`sessao:${s.id}`} source={linha.source} alt={linha.alt} width={W} height={linha.height} />
              })}
            </Box>
          ))}
          {ocultas > 0 && <Text dimColor>{`${ocultas} concluídas ou arquivadas ocultas`}</Text>}
        </Box>
      )
    }

    return (
      <Box flexDirection="column" gap={1} paddingX={1}>
        <Box flexDirection="row" justifyContent="space-between" alignItems="center">
          <Box flexDirection="row" columnGap={2} flexWrap="wrap">
            {resumo.every(r => r.n === 0) && <Text dimColor>nada em andamento</Text>}
            {resumo.filter(r => r.n > 0).map(r => (
              <Text>
                <Text color={r.cor}>●</Text> <Text bold>{String(r.n)}</Text>
                <Text dimColor> {r.rotulo}</Text>
              </Text>
            ))}
          </Box>
          <Button key="atualizar" plain dimColor onPress={() => void atualizar($)}>
            {l.lendo ? 'lendo…' : l.lidoEm === null ? '↻ ler' : `↻ ${hora(l.lidoEm)}`}
          </Button>
        </Box>

        {avisos.length + l.erros.length > 0 && (
          <Box flexDirection="column" borderStyle="round" borderColor="error" paddingX={1}>
            {[...avisos, ...l.erros].map(err => (
              <Text color="error" wrap="wrap">
                ⚠ {err}
              </Text>
            ))}
            {limparAvisos}
          </Box>
        )}

        {l.perguntas.length > 0 && (
          <Box flexDirection="column" gap={1}>
            <Text dimColor bold>
              PERGUNTAS · {String(l.perguntas.length)}
            </Text>
            {l.perguntas.map(q => (
              <Box
                key={`pergunta:${q.id}`}
                flexDirection="column"
                borderStyle="round"
                borderColor="warning"
                paddingX={1}
              >
                <Text wrap="wrap">
                  <Text bold color="warning">
                    {q.id}
                  </Text>{' '}
                  {q.titulo}
                </Text>
                <Text dimColor wrap="truncate-end">
                  {q.sessao}
                </Text>
                {q.caso && <Text wrap="wrap">{q.caso}</Text>}
                {q.seNaoDecidir && <Text dimColor wrap="wrap">{`Se não decidir: ${q.seNaoDecidir}`}</Text>}
                {q.recomendacao && <Text color="warning" wrap="wrap">{`Recomendo: ${q.recomendacao}`}</Text>}
                {acoes(q)}
              </Box>
            ))}
          </Box>
        )}

        {botaoAnteriores}
        {verVelhas &&
          l.anteriores.map(a => (
            <Box flexDirection="column">
              <Text wrap="wrap">
                <Text bold>{a.id}</Text>
                {` · ${a.estado} · ${a.titulo}`}
              </Text>
              {a.recomendacao && <Text dimColor wrap="wrap">{`Recomendado: ${a.recomendacao}`}</Text>}
              <Text color="success" wrap="wrap">{`Resposta: ${a.resposta ?? a.estado}`}</Text>
            </Box>
          ))}

        {grupos.length === 0 && l.lidoEm !== null && (
          <Text dimColor>Nenhuma sessão ativa no painel nem na lista ao vivo.</Text>
        )}
        {grupos.map(([projeto, linhas]) => (
          <Box flexDirection="column" gap={1}>
            <Text dimColor bold>
              {projeto.toUpperCase()} · {String(linhas.length)}
            </Text>
            {linhas.map(s => (
              <Box key={`sessao:${s.id}`} flexDirection="row" columnGap={1}>
                <Text color={COR[s.estado] ?? 'inactive'}>●</Text>
                <Box flexDirection="column" flexGrow={1} flexShrink={1}>
                  <Box flexDirection="row" justifyContent="space-between" columnGap={1}>
                    <Text wrap="truncate-end">
                      {s.titulo}
                    </Text>
                    {s.pr && s.prUrl && <Link href={s.prUrl} label={`#${s.pr}`} />}
                    {s.pr && !s.prUrl && <Text dimColor>{`#${s.pr}`}</Text>}
                  </Box>
                  <Text dimColor wrap="wrap">
                    <Text color={COR[s.estado] ?? 'inactive'}>{ROTULO[s.estado] ?? s.estado}</Text>
                    {s.etapa ? ` · ${s.etapa}` : ''}
                  </Text>
                  {(s.bloqueio || s.motivo) && (
                    <Text
                     
                      color={s.estado === 'bloqueada' ? 'error' : undefined}
                      dimColor={s.estado !== 'bloqueada'}
                      wrap="wrap"
                    >
                      {`${s.estado === 'bloqueada' ? 'Trava' : 'Esperando'}${s.motivo ? ` (${s.motivo})` : ''}: ${s.bloqueio ?? ''}`}
                    </Text>
                  )}
                  {s.divergencia && (
                    <Text color="warning" wrap="wrap">{`≠ ${s.divergencia}`}</Text>
                  )}
                </Box>
              </Box>
            ))}
          </Box>
        ))}
        {ocultas > 0 && (
          <Text dimColor>
            {ocultas} concluídas ou arquivadas ocultas
          </Text>
        )}
      </Box>
    )
  })
}
