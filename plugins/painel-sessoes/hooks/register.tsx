import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderSurface } from 'claude-code'

import type { LinhaItem, Leitura, PerguntaAberta, PerguntaAnterior, Situacao, Tema } from '../types'
import { papelDe as papelDeDesenho, anteriorSvg, desde, fileteSvg, itemSvg, perguntaSvg, quemDoItem, quemSaiu, resumoSvg, seloDaEspera, textoDaTrava } from './desenho'

// Painel num pane (Q63, opção A; F27): lê os documentos de ~/.claude/orquestracao/painel/<coleção>/<id>.json,
// que as sessões gravam pelo script painel.mjs da skill orquestradora, e a lista de temas (temas.json).
// Desenha a FILA por tema: o que está em sessão e onde, e o que espera alguém começar; o list_sessions
// ao vivo só diz se o dono do item ainda existe.
// Só escreve a resposta de uma pergunta aberta (Q67).

const PANE = 'painel-sessoes'
const TITULO = 'Sessões'
const INTERVALO_MS = 60_000
const PASTA = '.claude/orquestracao/painel'

const VAZIA: Leitura = { lidoEm: null, lendo: false, erros: [], avisos: [], itens: [], temas: [], perguntas: [], anteriores: [] }
const leitura = atom({ plugin: 'painel-sessoes', key: 'leitura' } as const, VAZIA)
const respondendoEm = atom({ plugin: 'painel-sessoes', key: 'respondendoEm' } as const, null as string | null)
const verAnteriores = atom({ plugin: 'painel-sessoes', key: 'verAnteriores' } as const, false)
const verFeitos = atom({ plugin: 'painel-sessoes', key: 'verFeitos' } as const, false)
// A resposta em curso (a pergunta e a opção pressionada) e a sessão que o botão "abrir" está abrindo; null = nenhuma.
const enviando = atom({ plugin: 'painel-sessoes', key: 'enviando' } as const, null as { q: string; opcao: string } | null)
const abrindo = atom({ plugin: 'painel-sessoes', key: 'abrindo' } as const, null as string | null)

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

const texto = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() !== '' ? v : typeof v === 'number' ? String(v) : undefined

const ETAPAS = ['planejamento', 'design', 'execucao', 'validacao', 'merge', 'feito', 'descartado']
const FEITOS_MS = 24 * 3600 * 1000
const SEM_TEMA = 'sem-tema'

const inteiros = (v: unknown): number[] => (Array.isArray(v) ? v.filter((n): n is number => Number.isInteger(n) && n > 0) : [])

/** `temas.json`: lista de `{ id, rotulo, projeto? }`; o que não tiver id e rótulo fica de fora. */
export function lerTemas(texto_: string): Tema[] {
  const v = JSON.parse(texto_) as unknown
  if (!Array.isArray(v)) throw new Error('temas.json não é uma lista')

  return v.flatMap(t => {
    const o = (t ?? {}) as Record<string, unknown>
    const id = texto(o.id)
    const rotulo = texto(o.rotulo)

    return id && rotulo ? [{ id, rotulo, projeto: texto(o.projeto) }] : []
  })
}

/**
 * Os itens da fila prontos para desenhar. `vivas` é a lista ao vivo do app (sem arquivadas), ou `null` quando ela
 * falhou ou não diz quem é esta sessão: aí nenhum item vira "sem ninguém", porque a falha já aparece em `⚠`.
 * `feito` e `descartado` só ficam nas últimas 24 h; etapa ou tema fora da lista vão para "Sem tema", com o motivo.
 */
export function montarItens(
  docs: Doc[],
  temas: Tema[],
  vivas: Vivo[] | null,
  proprio: string | undefined,
  perguntasAbertas: Array<{ id: string; item?: string }>,
  agora: number,
): LinhaItem[] {
  const vivos = vivas === null ? null : new Set([...vivas.filter(v => v.isArchived !== true).map(v => v.sessionId), ...(proprio ? [proprio] : [])])
  const abertas = new Set(perguntasAbertas.map(q => q.id))
  const itens: LinhaItem[] = []
  for (const d of docs) {
    const etapaCrua = texto(d.data.etapa)
    const etapaOk = etapaCrua !== undefined && ETAPAS.includes(etapaCrua)
    const temaId = texto(d.data.tema)
    const projetoDoItem = texto(d.data.projeto)?.toLowerCase()
    const mesmoId = temas.filter(t => t.id === temaId)
    // O tema é o de mesmo id e do projeto do item; sem projeto no tema, vale para todos. Item legado (sem projeto) só casa com tema global:
    // adivinhar o projeto pela ordem do arquivo atribuiria o item a um projeto que ninguém escolheu.
    const tema = projetoDoItem
      ? mesmoId.find(t => t.projeto?.toLowerCase() === projetoDoItem) ?? mesmoId.find(t => !t.projeto)
      : mesmoId.find(t => !t.projeto)
    const motivos: string[] = []
    if (etapaCrua === undefined) motivos.push('sem etapa')
    else if (!etapaOk) motivos.push(`etapa '${etapaCrua}' fora da lista`)
    if (!tema) motivos.push(!temaId ? 'sem tema' : mesmoId.length > 0 ? `${projetoDoItem ? '' : 'item sem projeto: '}tema de outro projeto ('${temaId}')` : `tema '${temaId}' fora da lista`)
    const donoLocalId = texto(d.data.donoLocalId)
    const apelido = texto(d.data.donoApelido)
    // Dono pela metade não é fila: o item acusa o que falta, em vez de parecer livre.
    if (apelido && !donoLocalId) motivos.push(`dono '${apelido}' sem donoLocalId`)
    else if (donoLocalId && !apelido) motivos.push('donoLocalId sem donoApelido')
    const com: LinhaItem['com'] = (Array.isArray(d.data.com) ? (d.data.com as Array<Record<string, unknown> | null>) : []).flatMap(c => {
      const localId = texto(c?.localId)
      const apelidoCom = texto(c?.apelido)
      if (!localId || !apelidoCom) return []
      const vivo = vivos === null ? null : vivos.has(localId)

      return [{ apelido: apelidoCom, localId, oQue: texto(c?.oQue) ?? '', vivo, link: vivo ? linkDe(localId, vivas ?? []) : undefined }]
    })
    const esp = d.data.espera as Record<string, unknown> | null | undefined
    const esperaGravada: LinhaItem['espera'] =
      (esp?.motivo === 'operador' || esp?.motivo === 'gate') && texto(esp.texto) ? { motivo: esp.motivo, texto: texto(esp.texto) as string } : undefined
    const historico = Array.isArray(d.data.historico) ? (d.data.historico as Array<Record<string, unknown>>) : []
    const feitoEm = texto(d.data.feitoEm)
    const final = etapaCrua === 'feito' || etapaCrua === 'descartado'
    let situacao: Situacao
    let trava: LinhaItem['trava']
    const donoVivo = donoLocalId !== undefined && vivos !== null && vivos.has(donoLocalId)
    const dono = donoLocalId && apelido ? { apelido, localId: donoLocalId, link: donoVivo ? linkDe(donoLocalId, vivas ?? []) : undefined } : undefined
    const t = d.data.trava as Record<string, unknown> | null | undefined
    const travaGravada = t && texto(t.motivo) && texto(t.texto) ? { motivo: texto(t.motivo) as string, texto: texto(t.texto) as string } : undefined
    if (final) {
      const quando = Date.parse(feitoEm ?? texto(d.data.atualizadoEm) ?? '')
      if (Number.isNaN(quando) || agora - quando > FEITOS_MS) continue
      situacao = 'feito'
    } else if (dono) {
      if (vivos && !vivos.has(dono.localId)) {
        situacao = 'travado'
        trava = { motivo: 'sem-ninguem', texto: `${dono.apelido} não está mais ativa` }
      } else {
        situacao = travaGravada ? 'travado' : 'andando'
        trava = travaGravada
      }
    } else situacao = 'fila'
    itens.push({
      id: d.id,
      titulo: texto(d.data.titulo) ?? d.id,
      resumo: texto(d.data.resumo),
      // Qualquer descumprimento do contrato (etapa, tema, dono) manda o item para "Sem tema", com o motivo.
      tema: tema && motivos.length === 0 ? tema.id : SEM_TEMA,
      temaProjeto: tema && motivos.length === 0 ? tema.projeto?.toLowerCase() : undefined,
      temaRotulo: tema && motivos.length === 0 ? tema.rotulo : 'Sem tema',
      etapa: etapaCrua ?? '?',
      situacao,
      dono,
      com,
      // Trava vence espera: o item travado já diz o que o prende, e o selo de espera seria um segundo recado.
      espera: final || situacao === 'travado' ? undefined : esperaGravada,
      prs: inteiros(d.data.prs),
      depois: Array.isArray(d.data.depois) ? d.data.depois.flatMap(x => (texto((x as Record<string, unknown> | null)?.texto) ? [texto((x as Record<string, unknown>).texto) as string] : [])) : [],
      agora: texto(d.data.agora),
      trava,
      perguntas: [
        ...new Set([
          ...(Array.isArray(d.data.perguntas) ? d.data.perguntas.map(String).filter(q => abertas.has(q)) : []),
          ...perguntasAbertas.filter(q => q.item === d.id).map(q => q.id),
        ]),
      ],
      atualizadoEm: texto(d.data.atualizadoEm),
      paradoDesde: texto(historico[historico.length - 1]?.em) ?? texto(d.data.atualizadoEm),
      feitoEm,
      foraDoContrato: motivos.length > 0 ? motivos.join('; ') : undefined,
    })
  }

  return itens
}

/**
 * Os temas, na ordem de `temas.json`, com "Sem tema" no fim; só os que têm item. Dentro, a ordem de `ordenar`.
 * Um grupo por (projeto, id): dois projetos com o tema `geral` são dois grupos, e quando os visíveis repetem o rótulo
 * o título vira `Rótulo · projeto`.
 */
export function porTema(itens: LinhaItem[], temas: Tema[], ordenar: (a: LinhaItem, b: LinhaItem) => number): Array<{ id: string; rotulo: string; projeto?: string; itens: LinhaItem[] }> {
  const ordem = [...temas.map(t => ({ id: t.id, rotulo: t.rotulo, projeto: t.projeto?.toLowerCase() })), { id: SEM_TEMA, rotulo: 'Sem tema', projeto: undefined }]
  const grupos = ordem.flatMap(t => {
    const meus = itens.filter(i => i.tema === t.id && i.temaProjeto === t.projeto).sort(ordenar)

    return meus.length > 0 ? [{ ...t, itens: meus }] : []
  })

  return grupos.map(g => (g.projeto && grupos.some(o => o !== g && o.rotulo === g.rotulo) ? { ...g, rotulo: `${g.rotulo} · ${g.projeto}` } : g))
}

const pelaOrdemDoId = (a: LinhaItem, b: LinhaItem) => numero(a.id) - numero(b.id)
/** Na fila, o mais antigo primeiro (assumido, a confirmar). */
const maisAntigoPrimeiro = (a: LinhaItem, b: LinhaItem) =>
  (Date.parse(a.paradoDesde ?? '') || Infinity) - (Date.parse(b.paradoDesde ?? '') || Infinity) || pelaOrdemDoId(a, b)

/** O item espera o operador sem uma pergunta aberta que já diga isso: ele vai a "Esperam você", e sai de Executando e de Na fila. O travado fica só em Travados: o erro vem antes (assumido, a confirmar). */
export const esperaOperadorSemPergunta = (i: LinhaItem) => i.situacao !== 'feito' && i.situacao !== 'travado' && i.espera?.motivo === 'operador' && i.perguntas.length === 0

/**
 * A única conta das quatro seções; o contador e a pílula leem daqui. Esperam você = as perguntas abertas mais os itens que
 * esperam o operador sem pergunta aberta (em sessão ou na fila); o item com pergunta aberta não conta de novo.
 */
export function contarSecoes(itens: LinhaItem[], perguntas: PerguntaAberta[]): { esperam: number; travados: number; executando: number; fila: number } {
  return {
    esperam: perguntas.length + itens.filter(esperaOperadorSemPergunta).length,
    travados: itens.filter(i => i.situacao === 'travado').length,
    executando: itens.filter(i => i.situacao === 'andando' && !esperaOperadorSemPergunta(i)).length,
    fila: itens.filter(i => i.situacao === 'fila' && !esperaOperadorSemPergunta(i)).length,
  }
}

/**
 * As quatro listas, nesta ordem: esperam, travados, executando e fila (o tema vai como campo do item, não como grupo; a
 * ordem dos temas segue `temas.json`). `andando`, `filaPorTema`, `emSessao` e `naFila` são o formato de antes, que o
 * desenho atual ainda lê; saem quando o desenho passar às quatro listas.
 */
export function secoes(itens: LinhaItem[], temas: Tema[]) {
  const planas = (lista: LinhaItem[], ordenar: (a: LinhaItem, b: LinhaItem) => number) => porTema(lista, temas, ordenar).flatMap(g => g.itens)
  const esperam = planas(itens.filter(esperaOperadorSemPergunta), maisAntigoPrimeiro)
  const travados = planas(itens.filter(i => i.situacao === 'travado'), pelaOrdemDoId)
  const executando = planas(itens.filter(i => i.situacao === 'andando' && !esperaOperadorSemPergunta(i)), pelaOrdemDoId)
  const naFilaPlana = planas(itens.filter(i => i.situacao === 'fila' && !esperaOperadorSemPergunta(i)), maisAntigoPrimeiro)
  const andando = porTema(itens.filter(i => i.situacao === 'andando'), temas, pelaOrdemDoId)
  const filaPorTema = porTema(itens.filter(i => i.situacao === 'fila'), temas, maisAntigoPrimeiro)
  const feitos = itens.filter(i => i.situacao === 'feito').sort((a, b) => (Date.parse(b.feitoEm ?? '') || 0) - (Date.parse(a.feitoEm ?? '') || 0))

  return {
    esperam,
    travados,
    executando,
    fila: naFilaPlana,
    feitos,
    andando,
    filaPorTema,
    emSessao: travados.length + andando.reduce((n, g) => n + g.itens.length, 0),
    naFila: filaPorTema.reduce((n, g) => n + g.itens.length, 0),
  }
}

export const papelDe = papelDeDesenho

/**
 * O que a sessão faz agora, do `list_sessions`: "trabalhando agora" (isRunning), "parada há X" (da última atividade) ou
 * "sem leitura da sessão" quando a lista falhou. A sessão do próprio pane vem em `self` (o list_sessions não a traz).
 * Sessão que não está na lista, e a sem última atividade, não têm o que dizer: devolve undefined.
 */
export function situacaoDe(localId: string, vivas: Vivo[], self: Vivo | undefined, erroDeLeitura: boolean, agora: number): string | undefined {
  if (erroDeLeitura) return 'sem leitura da sessão'
  const v = self?.sessionId === localId ? self : vivas.find(x => x.sessionId === localId)
  if (!v) return undefined
  if (v.isRunning) return 'trabalhando agora'
  const quanto = desde(v.lastActivityAt, agora)
  if (!quanto) return undefined

  return quanto === 'agora' ? 'parada há menos de 1 min' : `parada ${quanto}`
}

/** A leitura parou de renovar: a última tem mais de 180 s. Sem leitura nenhuma ainda, não está parada, está começando. */
export function leituraParada(ultimaLeitura: number | null, agora: number): boolean {
  return ultimaLeitura !== null && agora - ultimaLeitura > 180_000
}

const numero = (id: string) => Number(id.replace(/\D/g, '')) || 0

/** O endereço que abre a sessão no app: o que o list_sessions dá, ou o mesmo formato montado. */
export function linkDe(sessaoId: string | undefined, vivas: Vivo[]): string | undefined {
  if (!sessaoId) return undefined

  return vivas.find(v => v.sessionId === sessaoId)?.link ?? `claude://claude.ai/epitaxy/${sessaoId}`
}

/** O ponto do item no terminal, em chaves do tema. */
const COR_ETAPA_TERMINAL: Record<string, string> = { planejamento: 'suggestion', design: 'suggestion', execucao: 'suggestion', validacao: 'suggestion', merge: 'success' }
// A classe de cor que o desenho define para o claro e o escuro (hex fixo valeria para um tema só).
const COR_RESUMO: Record<string, string> = { warning: 'av', error: 'er', suggestion: 'an', success: 'ok' }
const ROTULO_ETAPA_TERMINAL: Record<string, string> = { planejamento: 'planejamento', design: 'design', execucao: 'execução', validacao: 'validação', merge: 'merge', feito: 'feito', descartado: 'descartado' }

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

/**
 * "abrir <apelido>": o app põe a sessão em foco (só aceita as que esta sessão iniciou). Recusa ou erro viram o
 * endereço copiado e um aviso que diz o que houve; nunca fica calado.
 */
async function abrirSessao($: EngineInterface, dono: NonNullable<LinhaItem['dono']>, surface: RenderSurface): Promise<void> {
  const naoDeu = async (porque: string) => {
    try {
      const c = dono.link ? await $.ui.copy({ text: dono.link, surface }) : undefined
      if (c?.isCopied) $.ui.toast(`não deu para abrir daqui (${porque}): endereço de ${dono.apelido} copiado`)
      else $.ui.toast(`não deu para abrir ${dono.apelido} nem copiar o endereço (${porque})${dono.link ? `: ${dono.link}` : ''}`)
    } catch (err) {
      $.ui.toast(`não deu para abrir ${dono.apelido} nem copiar o endereço: ${mensagem(err)}`)
    }
  }
  try {
    const r = await $.tool.call({ tool: 'mcp__ccd_window__open_session_in', session_id: dono.localId, target: 'focus' })
    if (r.deny !== undefined || r.isError) await naoDeu(r.deny || r.text || 'erro sem texto')
  } catch (err) {
    await naoDeu(mensagem(err))
  }
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
  let docsFila: Doc[] = []
  let temas: Tema[] = []
  let vivas: Vivo[] = []
  let vivasLidas = false
  await Promise.all([
    lerColecao('sessoes').then(
      d => void (docsSessoes = d),
      err => void erros.push(`sessoes do painel: ${mensagem(err)}`),
    ),
    lerColecao('perguntas').then(
      d => void (docsPerguntas = d),
      err => void erros.push(`perguntas do painel: ${mensagem(err)}`),
    ),
    lerColecao('fila').then(
      d => void (docsFila = d),
      err => void erros.push(`fila do painel: ${mensagem(err)}`),
    ),
    // Sem a lista de temas os itens caem em "Sem tema": a falta é erro de leitura, não lista vazia calada.
    $.fs.read(`${pasta}/temas.json`).then(
      t => void (temas = lerTemas(t as string)),
      err => void erros.push(`temas do painel: ${mensagem(err)}`),
    ),
    $.tool
      .call({
        tool: 'mcp__ccd_session_mgmt__list_sessions',
        linked: false,
        include_archived: false,
        // Teto da lista: com mais de 100 sessões não arquivadas, o dono que ficar fora do corte aparece como "sem ninguém"
        // (hoje são ~17). Se um dia chegar perto, o `⚠` precisa avisar do corte.
        limit: 100,
      })
      .then(r => {
        if (r.deny !== undefined) throw new Error(r.deny)
        if (r.isError) throw new Error(r.text ?? 'erro sem texto')
        vivas = lerVivas(r.text ?? '')
        vivasLidas = true
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
    proprio = undefined
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
      item: texto(d.data.item),
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
  // Sem a lista ao vivo ou sem saber quem sou, o dono "sumido" pode ser só falha de leitura: nenhum item vira "sem ninguém".
  const itens = montarItens(docsFila, temas, vivasLidas && proprio !== undefined ? vivas : null, proprio, perguntas, agora)
  const porId = new Map(itens.map(i => [i.id, i]))
  for (const q of perguntas) {
    const dono = q.item ? porId.get(q.item) : undefined
    if (dono) q.rotulo = `${dono.temaRotulo} · ${dono.titulo}`
  }
  await update($, leitura, l => ({
    avisos: l.avisos ?? [],
    lidoEm: agora,
    lendo: false,
    erros,
    itens,
    temas,
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
      itens: (() => {
        const sec = secoes(l.itens, l.temas)
        const dizer = (i: LinhaItem) => `${i.titulo} · ${i.etapa}${i.trava ? ` · trava (${i.trava.motivo})` : ''}${i.espera ? ` · espera (${i.espera.motivo})` : ''}${(i.com ?? []).length > 0 ? ` · com ${(i.com ?? []).map(c => c.apelido).join(', ')}` : ''}`

        return { emSessao: [...sec.travados, ...sec.andando.flatMap(g => g.itens)].map(dizer), naFila: sec.filaPorTema.flatMap(g => g.itens).map(dizer), feitos: sec.feitos.map(dizer) }
      })(),
    }
    const texto = JSON.stringify({ aberto, panes: await $.ui.panes(), desenhos, lido }, null, 2)

    return { result: texto, text: texto }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const elementos = $.ui.resolve(e)
    const { Box, Text, Button } = elementos
    // "abrir P2": pede ao app que ponha a sessão em foco; o que ele recusar, o botão devolve como endereço copiado.
    const abrir = (dono: NonNullable<LinhaItem['dono']>) => (
      <Button key={`abrir:${dono.localId}`} plain dimColor onPress={() => void abrirSessao($, dono, e.surface)}>
        {`abrir ${dono.apelido}`}
      </Button>
    )
    // Um botão por sessão viva do item: as de `com` e o dono, sem repetir quem está nas duas listas.
    const botoesAbrir = (i: LinhaItem) => {
      const vistos = new Set<string>()
      const quem = [...(i.com ?? []).map(c => ({ apelido: c.apelido, localId: c.localId, link: c.link })), ...(i.dono ? [i.dono] : [])]

      const botoes = quem.flatMap(q => (q.link && !vistos.has(q.localId) ? (vistos.add(q.localId), [abrir(q)]) : []))

      return botoes
    }
    // Campo de texto só onde a superfície tem um; sem ele, a opção "outra" fica sem campo.
    const Input = 'Input' in elementos ? elementos.Input : undefined
    const agora = await $.clock.now()
    desenhos[e.surface] = { placement: e.props.placement, bodyColumns: e.props.bodyColumns, em: hora(agora) }
    const l = await read($, leitura)
    // O estado da sessão sobrevive ao reload: o de antes desta versão não tem `avisos`.
    const avisos = l.avisos ?? []
    const sec = secoes(l.itens, l.temas)
    const contagem = contarSecoes(l.itens, l.perguntas)
    // Quatro seções, cada item contado uma vez: o contador e a pílula leem de `contarSecoes`.
    const resumo = [
      { n: contagem.esperam, rotulo: 'Esperam você', cor: 'warning' },
      { n: contagem.travados, rotulo: 'Travados', cor: 'error' },
      { n: contagem.executando, rotulo: 'Executando', cor: 'suggestion' },
      { n: contagem.fila, rotulo: 'Na fila', cor: 'suggestion', classe: 't' },
    ]
    const resumo4 = resumo.map(r => ({ ...r, cor: COR_RESUMO[r.cor] ?? 'm' }))
    const lido = l.lidoEm !== null

    const aberta = await read($, respondendoEm)
    const verVelhas = await read($, verAnteriores)
    const verFeitosAgora = await read($, verFeitos)

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

    const botaoFeitos =
      sec.feitos.length > 0 ? (
        <Button key="feitos" plain dimColor onPress={() => void update($, verFeitos, v => !v)}>
          {`${verFeitosAgora ? '▾' : '▸'} Feitos (24 h) · ${sec.feitos.length}`}
        </Button>
      ) : null

    if (e.surface === 'desktop' && 'Svg' in elementos) {
      const { Svg } = elementos
      const W = Math.max(240, Math.min(900, (e.props.bodyColumns || 40) * 8 - 8))
      const titulo = (t: string) => <Text bold>{t}</Text>
      const cartaoResumo = resumoSvg(W, resumo4)
      // O tema é cabeçalho discreto (dimColor, caixa alta curta); o título do bloco é o Text bold, os dois não pesam igual.
      const cabecalho = (t: string) => <Text dimColor>{t.toUpperCase()}</Text>
      const desenhar = (i: LinhaItem, noTravados = false) => {
        const botoes = botoesAbrir(i)
        // Com botões, o filete que fecha o item vem depois deles: sem isso eles caem na faixa do item seguinte.
        const linha = itemSvg(W, i, agora, { noTravados, filete: botoes.length === 0 })
        const filete = fileteSvg(W)

        return (
          <Box key={`item:${i.id}`} flexDirection="column">
            <Svg source={linha.source} alt={linha.alt} width={W} height={linha.height} />
            {botoes.length > 0 && (
              <Box flexDirection="row" columnGap={1} flexWrap="wrap">
                {botoes}
              </Box>
            )}
            {botoes.length > 0 && <Svg source={filete.source} alt="" width={W} height={filete.height} />}
            {i.foraDoContrato && <Text dimColor wrap="wrap">{`⚠ fora do contrato: ${i.foraDoContrato}`}</Text>}
          </Box>
        )
      }

      return (
        <Box flexDirection="column" gap={1}>
          <Svg source={cartaoResumo.source} alt={resumo4.map(r => `${r.n} ${r.rotulo}`).join(', ')} width={W} height={cartaoResumo.height} />
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
                      alt={[`${q.id} · ${q.rotulo ?? q.sessao} · ${q.titulo}`, q.caso, q.seNaoDecidir && `Se não decidir: ${q.seNaoDecidir}`, q.recomendacao && `Recomendo: ${q.recomendacao}`].filter(Boolean).join(' — ')}
                      width={W}
                      height={card.height}
                    />
                    {q.sessaoId && q.link && abrir({ apelido: q.sessao, localId: q.sessaoId, link: q.link })}
                    {acoes(q)}
                  </Box>
                )
              })}
            </Box>
          )}

          {lido && (
            <Box flexDirection="column" gap={1}>
              {titulo(`Em sessão · ${sec.emSessao}`)}
              {sec.emSessao === 0 && <Text dimColor>Nada em sessão agora.</Text>}
              {sec.travados.length > 0 && (
                <Box flexDirection="column" gap={1}>
                  {cabecalho('Travados')}
                  {sec.travados.map(i => desenhar(i, true))}
                </Box>
              )}
              {sec.andando.map(g => (
                <Box key={`andando:${g.id}`} flexDirection="column" gap={1}>
                  {cabecalho(g.rotulo)}
                  {g.itens.map(i => desenhar(i))}
                </Box>
              ))}
            </Box>
          )}
          {lido && (
            <Box flexDirection="column" gap={1}>
              {titulo(`Na fila · ${sec.naFila}`)}
              {sec.naFila === 0 && <Text dimColor>Nada na fila.</Text>}
              {sec.filaPorTema.map(g => (
                <Box key={`fila:${g.id}`} flexDirection="column" gap={1}>
                  {cabecalho(g.rotulo)}
                  {g.itens.map(i => desenhar(i))}
                </Box>
              ))}
            </Box>
          )}
          {botaoFeitos}
          {verFeitosAgora && sec.feitos.map(i => desenhar(i))}
          {botaoAnteriores}
          {verVelhas &&
            l.anteriores.map(a => {
              const linha = anteriorSvg(W, a, agora)

              return <Svg key={`anterior:${a.id}`} source={linha.source} alt={linha.alt} width={W} height={linha.height} />
            })}
        </Box>
      )
    }

    // Cada item em duas linhas: título e "etapa · dono · #PR"; a trava e o aviso de contrato logo abaixo.
    const linhaItem = (i: LinhaItem, noTravados = false) => {
      const cor = i.situacao === 'travado' ? 'error' : i.situacao === 'fila' ? 'inactive' : (COR_ETAPA_TERMINAL[i.etapa] ?? 'inactive')
      const etapa = ROTULO_ETAPA_TERMINAL[i.etapa] ?? i.etapa
      const info = [
        i.situacao === 'fila' ? `espera ${etapa}` : etapa,
        noTravados ? i.temaRotulo : undefined,
        i.perguntas[0] ? `aguarda você · ${i.perguntas[0]}` : undefined,
        seloDaEspera(i),
        ...quemDoItem(i).map(q => q.t),
        i.prs.length > 0 ? `#${i.prs[i.prs.length - 1]}${i.prs.length > 1 ? ` +${i.prs.length - 1}` : ''}` : undefined,
        ...quemSaiu(i).map(q => q.t),
      ].filter(Boolean).join(' · ')

      return (
        <Box key={`item:${i.id}`} flexDirection="row" columnGap={1}>
          <Text color={cor}>●</Text>
          <Box flexDirection="column" flexGrow={1} flexShrink={1}>
            <Text wrap="truncate-end">{i.titulo}</Text>
            <Text dimColor wrap="wrap">{info}</Text>
            {botoesAbrir(i)}
            {i.trava && <Text color="error" wrap="wrap">{textoDaTrava(i.trava)}</Text>}
            {i.espera && <Text color={i.espera.motivo === 'operador' ? 'warning' : undefined} dimColor={i.espera.motivo !== 'operador'} wrap="wrap">{i.espera.texto}</Text>}
            {i.situacao === 'fila' && i.resumo && <Text dimColor wrap="wrap">{i.resumo}</Text>}
            {i.situacao !== 'fila' && i.agora && <Text dimColor wrap="wrap">{i.agora}</Text>}
            {i.foraDoContrato && <Text dimColor wrap="wrap">{`⚠ fora do contrato: ${i.foraDoContrato}`}</Text>}
          </Box>
        </Box>
      )
    }

    return (
      <Box flexDirection="column" gap={1} paddingX={1}>
        <Box flexDirection="row" justifyContent="space-between" alignItems="center">
          <Box flexDirection="row" columnGap={2} flexWrap="wrap">
            {resumo.every(r => r.n === 0) && <Text dimColor>{lido ? 'nada em andamento' : 'ainda não lido'}</Text>}
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
                  {q.rotulo ?? q.sessao}
                </Text>
                {q.caso && <Text wrap="wrap">{q.caso}</Text>}
                {q.seNaoDecidir && <Text dimColor wrap="wrap">{`Se não decidir: ${q.seNaoDecidir}`}</Text>}
                {q.recomendacao && <Text color="warning" wrap="wrap">{`Recomendo: ${q.recomendacao}`}</Text>}
                {acoes(q)}
              </Box>
            ))}
          </Box>
        )}

        {lido && (
          <Box flexDirection="column" gap={1}>
            <Text bold>{`Em sessão · ${sec.emSessao}`}</Text>
            {sec.emSessao === 0 && <Text dimColor>Nada em sessão agora.</Text>}
            {sec.travados.length > 0 && (
              <Box flexDirection="column">
                <Text dimColor bold>TRAVADOS</Text>
                {sec.travados.map(i => linhaItem(i, true))}
              </Box>
            )}
            {sec.andando.map(g => (
              <Box key={`andando:${g.id}`} flexDirection="column">
                <Text dimColor bold>{g.rotulo.toUpperCase()}</Text>
                {g.itens.map(i => linhaItem(i))}
              </Box>
            ))}
          </Box>
        )}
        {lido && (
          <Box flexDirection="column" gap={1}>
            <Text bold>{`Na fila · ${sec.naFila}`}</Text>
            {sec.naFila === 0 && <Text dimColor>Nada na fila.</Text>}
            {sec.filaPorTema.map(g => (
              <Box key={`fila:${g.id}`} flexDirection="column">
                <Text dimColor bold>{g.rotulo.toUpperCase()}</Text>
                {g.itens.map(i => linhaItem(i))}
              </Box>
            ))}
          </Box>
        )}
        {botaoFeitos}
        {verFeitosAgora && sec.feitos.map(i => linhaItem(i))}
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
      </Box>
    )
  })
}
