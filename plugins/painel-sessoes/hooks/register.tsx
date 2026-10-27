import { atom, read, update } from 'claude-code'
import type { EngineInterface, On, Register, RenderSurface } from 'claude-code'

import { semDona } from './sem-dona'
import type { CartaoDeSessao, Citado, EstadoPedido, ItemDoIndice, LinhaItem, Leitura, PerguntaAberta, PerguntaAnterior, Reinicio, Situacao, Tema } from '../types'
import { AVISO_MIN, BANDEIRA_DO_APP, CACHE_TTL_MS, GLIFO_REINICIO, LEITURA_MS, VIGIA_MS, LIMPANDO_ABAIXO_DE, LIMPANDO_MAX_MS, PROMPT_DE_LIMPAR, abertasDoProjeto, contarDonas, desenharBarra, janelaDeCompactacao, meuItem, orquestradorasDoProjeto, papelEApelido, relogio as relogioDoCache, estadoDoReinicio, proximoDaVigia, vigiaSumiu } from './barra'
import type { AvisoDeReinicio, ArquivoDeReinicio } from './barra'
import type { Barra } from '../types'
import { papelDe as papelDeDesenho, altDosCitados, fraseDoGrupoSvg, paraQueDoCartao, sessaoParaAbrirSvg, anteriorSvg, cartaoSvg, desde, faixaSvg, fileteSvg, filaSvg, modoDescrito, modoSvg, parouSvg, perguntaSvg, quemDoItem, quemSaiu, reinicioSvg, resumoSvg, rotuloModoSvg, secaoSvg, seloDaEspera, textoDaTrava, textoEsperando, tituloDoTema, todosSvg } from './desenho'

// Painel num pane (Q63, opção A; F27): lê os documentos de ~/.claude/orquestracao/painel/<coleção>/<id>.json,
// que as sessões gravam pelo script painel.mjs da skill orquestradora, e a lista de temas (temas.json).
// Desenha a FILA por tema: o que está em sessão e onde, e o que espera alguém começar; o list_sessions
// ao vivo só diz se o dono do item ainda existe.
// Só escreve a resposta de uma pergunta aberta (Q67).

export const PANE = 'painel-sessoes'
export const TITULO = 'Sessões'
/** Pixels por coluna do pane no desktop: o `bodyColumns` conta células, o `Svg` mede em px. */
const COLUNA_PX = 8.75
// F45: a limpeza do app mata o processo do CLI e o pane vai junto. O store guarda quais sessões do app (`local_…`) deixaram o painel aberto.
const ABERTOS = 'abertos'
const VALIDADE_MARCA_MS = 7 * 86_400_000

type Marcas = Record<string, string>

export const marcar = (marcas: Marcas, id: string, quando: number): Marcas => ({ ...marcas, [id]: new Date(quando).toISOString() })
export const desmarcar = (marcas: Marcas, id: string): Marcas => Object.fromEntries(Object.entries(marcas).filter(([k]) => k !== id))
/** O engine só levanta `ui.close` de `person` e `unload` para o mod (o teste não consegue); `unload` é o processo indo embora, não o operador fechando. */
export const fechamentoDesmarca = (origem: string): boolean => origem !== 'unload'
/** Fecha só o pane que a pessoa vê: o reaberto sem pedido pode estar sem lugar (`isPlaced` false) e, então, o `/painel` o abre de vez. */
export const deveFechar = (panes: ReadonlyArray<{ id: string; isPlaced: boolean }>): boolean => panes.some(p => p.id === PANE && p.isPlaced)
export const vencidas = (marcas: Marcas, agora: number): string[] =>
  Object.entries(marcas)
    .filter(([, em]) => !(agora - Date.parse(em) <= VALIDADE_MARCA_MS))
    .map(([id]) => id)
const INTERVALO_MS = 60_000
export const PASTA = '.claude/orquestracao/painel'
const BASE_ORQUESTRACAO = '.claude/orquestracao'
const BANDEIRA = 'operador-ausente.json'

const VAZIA: Leitura = { lidoEm: null, lendo: false, erros: [], avisos: [], itens: [], temas: [], perguntas: [], assumidas: [], anteriores: [] }
export const leitura = atom({ plugin: 'painel-sessoes', key: 'leitura' } as const, VAZIA)
const respondendoEm = atom({ plugin: 'painel-sessoes', key: 'respondendoEm' } as const, null as string | null)
const verAnteriores = atom({ plugin: 'painel-sessoes', key: 'verAnteriores' } as const, false)
const verAssumidas = atom({ plugin: 'painel-sessoes', key: 'verAssumidas' } as const, false)
const verFeitos = atom({ plugin: 'painel-sessoes', key: 'verFeitos' } as const, false)
const verTodos = atom({ plugin: 'painel-sessoes', key: 'verTodos' } as const, false)
const filtroTodos = atom({ plugin: 'painel-sessoes', key: 'filtroTodos' } as const, '')
const limpezas = atom({ plugin: 'painel-sessoes', key: 'limpezas' } as const, 0)
// A resposta em curso (a pergunta e a opção pressionada) e a sessão que o botão "abrir" está abrindo, com o botão pressionado; null = nenhuma.
export const enviando = atom({ plugin: 'painel-sessoes', key: 'enviando' } as const, null as { q: string; opcao: string } | null)
const abrindo = atom({ plugin: 'painel-sessoes', key: 'abrindo' } as const, null as { localId: string; botao: string } | null)
// Os pedidos de sessão em curso, por id de item (e `lote`); só em memória (F69 D6): recarregar o pane traz os botões de volta.
export const pedindo = atom({ plugin: 'painel-sessoes', key: 'pedindo' } as const, {} as Record<string, EstadoPedido>)
// O relógio da leitura pendurada: cada tique que encontra a leitura em curso grava a hora, para a tela redesenhar e dizer "Parou".
const tique = atom({ plugin: 'painel-sessoes', key: 'tique' } as const, 0)
// O botão do modo está gravando a bandeira.
export const trocandoModo = atom({ plugin: 'painel-sessoes', key: 'trocandoModo' } as const, false)

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
  createdAt?: string
  link?: string
}

type Doc = { id: string; data: Record<string, unknown>; version?: number }

/** Um documento do painel: o arquivo inteiro, `{ id, version, data }`. */
export function lerDoc(texto: string, nome: string): Doc {
  const v = JSON.parse(texto) as Partial<Doc>
  if (!v || typeof v.data !== 'object' || v.data === null) throw new Error(`${nome}: sem o campo data`)

  return { id: typeof v.id === 'string' ? v.id : nome.replace(/\.json$/, ''), data: v.data, version: v.version }
}

const CARTAO_VALIDADE_MS = 12 * 3_600_000

/** O documento de `cartoes` no contrato (apelido e papel `dona`, um item `F<n>`, data); fora dele, `undefined`. */
export function lerCartao(d: Doc): CartaoDeSessao | undefined {
  const c = d.data
  const apelido = texto(c.apelido)
  const projeto = texto(c.projeto)
  const orquestradoraId = texto(c.orquestradoraId)
  const propostoEm = texto(c.propostoEm)
  if (apelido !== 'dona' || !projeto || !orquestradoraId || !propostoEm || Number.isNaN(Date.parse(propostoEm))) return undefined
  if (c.papel !== 'dona' || !Array.isArray(c.itens) || c.itens.length !== 1 || c.itens.some(F => typeof F !== 'string' || !/^F\d+$/.test(F))) return undefined

  return { id: d.id, projeto: projeto.toLowerCase(), apelido, papel: 'dona', itens: c.itens as string[], orquestradoraId, propostoEm }
}

/**
 * Os cartões que ainda esperam o clique: o apelido não aparece vivo na lista que o pane leu (criado depois de `propostoEm`; a
 * mesma régua da batida) e não passou de 12 h. Sem a lista (`semLista`), só o prazo vale. Mais antigo primeiro.
 */
export function cartoesVisiveis(cartoes: CartaoDeSessao[], sessoes: SessaoViva[] | undefined, semLista: boolean, agora: number): CartaoDeSessao[] {
  return cartoes
    .filter(c => {
      const proposto = Date.parse(c.propostoEm)
      if (Number.isNaN(proposto) || agora - proposto >= CARTAO_VALIDADE_MS) return false
      if (semLista) return true

      return !(sessoes ?? []).some(s => {
        if (!s.title?.startsWith(`${c.itens[0] ?? c.apelido} · `)) return false
        const criada = Date.parse(s.createdAt ?? s.lastActivityAt ?? '')

        return !Number.isNaN(criada) && criada >= proposto
      })
    })
    .sort((a, b) => Date.parse(a.propostoEm) - Date.parse(b.propostoEm))
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

const NOME_SOLTO = 20

/**
 * F189: quem o pane mostra no lugar do apelido `dona`, igual para toda sessão dona. O `F<n>` do título da sessão
 * (`F<n> · <tema>`) achada pelo `localId` na lista ao vivo (que o pane lê sem as arquivadas); título fora desse formato vai cortado;
 * sem a sessão na lista, o `F<n>` do item. Outro apelido passa como está.
 */
export function nomeDoDono(apelido: string, localId: string, itemId: string, vivas: Vivo[] | null): { apelido: string; titulo?: string; dona?: true } {
  if (apelido.trim().toLowerCase() !== 'dona') return { apelido }
  const titulo = texto(vivas?.find(v => v.sessionId === localId)?.title)?.trim()
  if (!titulo) return { apelido: itemId, dona: true }
  const F = /^(F\d+) · /.exec(titulo)?.[1]
  // Por caractere, não por unidade UTF-16: o corte não parte um emoji.
  const letras = Array.from(titulo)
  const curto = F ?? (letras.length > NOME_SOLTO ? `${letras.slice(0, NOME_SOLTO - 1).join('').replace(/\s+\S*$/, '')}…` : titulo)

  return { apelido: curto, titulo, dona: true }
}

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
  return montarTodos(docs, temas, vivas, proprio, perguntasAbertas, agora)
    .filter(t => !t.antigo)
    .map(t => t.linha)
}

/** O índice de todos os itens, de qualquer etapa e idade: a mesma regra de tema da leitura (F43). */
export function montarIndice(docs: Doc[], temas: Tema[]): ItemDoIndice[] {
  return montarTodos(docs, temas, null, undefined, [], 0).map(({ linha, projeto }) => ({
    id: linha.id,
    titulo: linha.titulo,
    tema: linha.tema,
    temaProjeto: linha.temaProjeto,
    temaRotulo: linha.temaRotulo,
    etapa: linha.etapa,
    projeto,
  }))
}

/** Todos os itens montados; `antigo` marca o feito ou descartado de mais de 24 h, que a leitura não desenha mas o índice guarda. */
function montarTodos(
  docs: Doc[],
  temas: Tema[],
  vivas: Vivo[] | null,
  proprio: string | undefined,
  perguntasAbertas: Array<{ id: string; item?: string }>,
  agora: number,
): Array<{ linha: LinhaItem; antigo: boolean; projeto?: string }> {
  const vivos = vivas === null ? null : new Set([...vivas.filter(v => v.isArchived !== true).map(v => v.sessionId), ...(proprio ? [proprio] : [])])
  const abertas = new Set(perguntasAbertas.map(q => q.id))
  const itens: Array<{ linha: LinhaItem; antigo: boolean; projeto?: string }> = []
  for (const d of docs) {
    let antigo = false
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

      return [{ ...nomeDoDono(apelidoCom, localId, d.id, vivas), localId, oQue: texto(c?.oQue) ?? '', vivo, link: vivo ? linkDe(localId, vivas ?? []) : undefined }]
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
    const dono = donoLocalId && apelido ? { ...nomeDoDono(apelido, donoLocalId, d.id, vivas), localId: donoLocalId, link: donoVivo ? linkDe(donoLocalId, vivas ?? []) : undefined } : undefined
    const t = d.data.trava as Record<string, unknown> | null | undefined
    const travaGravada = t && texto(t.motivo) && texto(t.texto) ? { motivo: texto(t.motivo) as string, texto: texto(t.texto) as string } : undefined
    if (final) {
      const quando = Date.parse(feitoEm ?? texto(d.data.atualizadoEm) ?? '')
      antigo = Number.isNaN(quando) || agora - quando > FEITOS_MS
      situacao = 'feito'
    } else if (dono) {
      if (vivos && !vivos.has(dono.localId)) {
        situacao = 'travado'
        trava = { motivo: 'sem-ninguem', texto: `${dono.dona ? 'a dona ' : ''}${dono.apelido} não está mais ativa` }
      } else {
        situacao = travaGravada ? 'travado' : 'andando'
        trava = travaGravada
      }
    } else situacao = com.some(c => c.vivo === true) ? 'andando' : 'fila' // sem dono, mas com alguém vivo no `com`: o item anda (F69 A0)
    itens.push({ antigo, projeto: projetoDoItem, linha: {
      id: d.id,
      titulo: texto(d.data.titulo) ?? d.id,
      resumo: texto(d.data.resumo),
      // Qualquer descumprimento do contrato (etapa, tema, dono) manda o item para "Sem tema", com o motivo.
      tema: tema && motivos.length === 0 ? tema.id : SEM_TEMA,
      temaProjeto: tema && motivos.length === 0 ? tema.projeto?.toLowerCase() : undefined,
      temaRotulo: tema && motivos.length === 0 ? tema.rotulo : 'Sem tema',
      projeto: projetoDoItem,
      etapa: etapaCrua ?? '?',
      situacao,
      dono,
      com,
      // Trava vence espera: o item travado já diz o que o prende, e o selo de espera seria um segundo recado.
      espera: final || situacao === 'travado' ? undefined : esperaGravada,
      // Sem dona no item há tempo: some quando o item está final ou travado (a trava já diz o que o prende).
      esperando: final || situacao === 'travado' ? undefined : (s => (s ? { desde: s.desde } : undefined))(semDona(d.data, agora)),
      prs: inteiros(d.data.prs),
      depois: Array.isArray(d.data.depois)
        ? d.data.depois.flatMap(x => {
            const o = x as Record<string, unknown> | null
            const item = texto(o?.item)

            return texto(o?.texto) ? [{ texto: texto(o?.texto) as string, ...(item && /^F\d+$/.test(item) ? { item } : {}) }] : []
          })
        : [],
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
    } })
  }

  return itens
}

/**
 * Os temas, na ordem de `temas.json`, com "Sem tema" no fim; só os que têm item. Dentro, a ordem de `ordenar`.
 * Um grupo por (projeto, id): dois projetos com o tema `geral` são dois grupos, e quando os visíveis repetem o rótulo
 * o título vira `Rótulo · projeto`.
 */
export function porTema<T extends { tema: string; temaProjeto?: string }>(itens: T[], temas: Tema[], ordenar: (a: T, b: T) => number): Array<{ id: string; rotulo: string; projeto?: string; itens: T[] }> {
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
 * ordem dos temas segue `temas.json`), mais os feitos nas últimas 24 h.
 */
export function secoes(itens: LinhaItem[], temas: Tema[]) {
  const planas = (lista: LinhaItem[], ordenar: (a: LinhaItem, b: LinhaItem) => number) => porTema(lista, temas, ordenar).flatMap(g => g.itens)
  const feitos = itens.filter(i => i.situacao === 'feito').sort((a, b) => (Date.parse(b.feitoEm ?? '') || 0) - (Date.parse(a.feitoEm ?? '') || 0))

  return {
    esperam: planas(itens.filter(esperaOperadorSemPergunta), maisAntigoPrimeiro),
    travados: planas(itens.filter(i => i.situacao === 'travado'), pelaOrdemDoId),
    executando: planas(itens.filter(i => i.situacao === 'andando' && !esperaOperadorSemPergunta(i)), pelaOrdemDoId),
    fila: planas(itens.filter(i => i.situacao === 'fila' && !esperaOperadorSemPergunta(i)), maisAntigoPrimeiro),
    feitos,
  }
}

export const papelDe = papelDeDesenho

/**
 * O F<n> que o texto cita sem dizer o que é: não seguido de ` · ` (a regra de texto do painel, que recusa a pergunta nesse caso).
 * A tecla F5 também casa: descreve-se por extenso.
 */
export const ITEM_SOLTO = /\bF\d+\b(?! · )/g

/**
 * Os números que os textos citam, resolvidos pelo índice. Primeiro os ligados por `depois[].item`, depois os achados nos
 * textos, na ordem; ignora o próprio item, o repetido e o que já veio escrito como `F<n> · …`. Os textos são lidos inteiros:
 * o desenho pode cortá-los, e é o número que o corte escondeu que a legenda precisa dizer.
 */
export function citadosDe(textos: string[], ligados: string[], proprio: string, indice: Map<string, { titulo: string }>): Citado[] {
  const nomeados = new Set(textos.flatMap(t => [...t.matchAll(/\b(F\d+) · /g)].map(m => m[1]!)))
  const achados = textos.flatMap(t => t.match(ITEM_SOLTO) ?? [])
  const vistos = new Set<string>([proprio])
  const ordem: Array<{ id: string; ligado: boolean }> = []
  for (const id of ligados) if (!vistos.has(id)) (vistos.add(id), ordem.push({ id, ligado: true }))
  for (const id of achados) if (!vistos.has(id) && !nomeados.has(id)) (vistos.add(id), ordem.push({ id, ligado: false }))

  return ordem.map(({ id, ligado }) => ({ id, titulo: indice.get(id)?.titulo, ligado }))
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/** O campo Achar: número exato (`13`, `F13`, `f13`) ou palavra do título, sem caixa e sem acento; vazio devolve tudo. */
export function filtrarIndice(indice: ItemDoIndice[], filtro: string): ItemDoIndice[] {
  const f = filtro.trim()
  if (!f) return indice
  if (/^f?\d+$/i.test(f)) return indice.filter(i => numero(i.id) === numero(f))

  return indice.filter(i => semAcento(i.titulo).includes(semAcento(f)))
}

const bloco = (i: ItemDoIndice) => (i.etapa === 'descartado' ? 2 : i.etapa === 'feito' ? 1 : 0)

/** Um grupo por tema na ordem de `temas.json`; dentro, os vivos, os feitos e os descartados, cada bloco do número maior para o menor. */
export function gruposDoIndice(indice: ItemDoIndice[], temas: Tema[]) {
  return porTema(indice, temas, (a, b) => bloco(a) - bloco(b) || numero(b.id) - numero(a.id))
}

/** O que o rodapé desenha, de cima para baixo: os botões e, abertas, as listas; a lista de todos os itens por último (é a mais comprida). */
export function ordemDoRodape(abertas: { todos: boolean; feitos: boolean; anteriores: boolean }): string[] {
  return ['botoes', ...(abertas.feitos ? ['feitos'] : []), ...(abertas.anteriores ? ['anteriores'] : []), ...(abertas.todos ? ['todos'] : [])]
}

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

/** As sessões vivas do item (as de `com` que seguem na lista; sem elas, o dono que não está sem ninguém). */
const pessoasVivas = (i: LinhaItem): Array<{ localId: string }> => {
  const vivos = (i.com ?? []).filter(c => c.vivo !== false)
  if (vivos.length > 0) return vivos

  return i.dono && i.trava?.motivo !== 'sem-ninguem' ? [i.dono] : []
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
export const ROTULO_ETAPA_TERMINAL: Record<string, string> = { planejamento: 'planejamento', design: 'design', execucao: 'execução', validacao: 'validação', merge: 'merge', feito: 'feito', descartado: 'descartado' }

const dois = (n: number) => String(n).padStart(2, '0')

export function hora(ms: number): string {
  const d = new Date(ms)

  return `${dois(d.getHours())}:${dois(d.getMinutes())}:${dois(d.getSeconds())}`
}

/** F183: o nome do projeto como o painel o grava (o mesmo de perguntas-arquivo.mjs): minúsculo, [a-z0-9-], sem traço nas pontas; vazio = null. */
export const slugDoProjeto = (nome: string | undefined | null): string | null =>
  String(nome ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || null

// São Paulo sem horário de verão desde 2019: UTC−3 fixo (o painel.mjs usa o fuso pelo Intl; dão o mesmo dia).
const SP_MS = 3 * 3_600_000
/** O dia (AAAA-MM-DD) de um instante em São Paulo. */
export const diaEmSP = (ms: number): string => new Date(ms - SP_MS).toISOString().slice(0, 10)
/** O instante em que começou, em São Paulo, o dia de `ms`. */
export const inicioDoDiaEmSP = (ms: number): number => Date.parse(`${diaEmSP(ms)}T00:00:00Z`) + SP_MS

const mensagem = (err: unknown) => (err instanceof Error ? err.message : String(err))

let timer: { cancel: () => void } | undefined

/** Lê agora e a cada 60 s, enquanto o pane estiver aberto. */
function ligar($: EngineInterface): void {
  timer?.cancel()
  timer = $.clock.every(INTERVALO_MS, () => {
    if (emCurso) void $.clock.now().then(agora => update($, tique, () => agora)).catch(() => {})
    else void atualizar($)
  })
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
export async function responder(
  $: EngineInterface,
  q: PerguntaAberta,
  resposta: string,
  opcao: string,
  como: { esperado?: 'aberta' | 'assumida'; entrega?: boolean; texto?: string; toast?: string } = {},
): Promise<{ gravou: boolean; motivo?: string }> {
  const { esperado = 'aberta', entrega = true } = como
  if (respondendo.has(q.id) || !resposta.trim()) return { gravou: false }
  respondendo.add(q.id)
  let resultado: { gravou: boolean; motivo?: string } = { gravou: false }
  await update($, enviando, () => ({ q: q.id, opcao }))
  try {
    const agora = new Date(await $.clock.now()).toISOString()
    // Com o pane nunca aberto (a barra responde sem ele) ainda não houve leitura: a pasta é a de sempre.
    const pasta = pastaLida || `${await $.env.get('HOME')}/${PASTA}`
    const arquivo = `${pasta}/perguntas/${q.id}.json`
    // Presa à versão lida: quem respondeu antes (no chat ou noutra janela) não é sobrescrito.
    const atual = lerDoc((await $.fs.read(arquivo)) as string, `${q.id}.json`)
    if (atual.data.estado !== esperado || (q.versao !== undefined && atual.version !== q.versao)) {
      throw new Error(`${q.id} mudou desde a leitura (agora: ${String(atual.data.estado)}); nada gravado`)
    }
    // `respondidaPor` e `respondidaEm` são a prova do clique do operador: só o pane os grava (a trava da limpeza da orquestradora os lê).
    const data = { ...atual.data, estado: 'respondida', resposta: resposta.trim(), atualizadoEm: agora, respondidaPor: 'painel', respondidaEm: agora }
    await $.fs.write(arquivo, `${JSON.stringify({ id: q.id, version: (atual.version ?? 0) + 1, data }, null, 2)}\n`)
    resultado = { gravou: true }
    await update($, respondendoEm, atual => (atual === q.id ? null : atual))
    // "Enviando…" dura até a sessão de fora responder ao send_message; o prompt da própria sessão não se espera.
    if (entrega) await entregar($, q, resposta.trim(), como.texto)
    else if (como.toast) $.ui.toast(como.toast)
  } catch (err) {
    resultado = { gravou: resultado.gravou, motivo: mensagem(err) }
    await avisar($, `${q.id} não gravada: ${mensagem(err)}`)
  } finally {
    respondendo.delete(q.id)
    await update($, enviando, atual => (atual?.q === q.id ? null : atual))
  }
  await relerDepoisDoClique($)

  return resultado
}

const AVISOS = 10
// A falha de uma resposta fica em `avisos`, que a releitura não apaga: só o botão de limpar.
export const avisar = ($: EngineInterface, aviso: string) =>
  update($, leitura, l => ({ ...l, avisos: [...(l.avisos ?? []), aviso].slice(-AVISOS) }))

const naoChegou = ($: EngineInterface, q: PerguntaAberta, motivo: string) =>
  avisar($, `${q.id} gravada, mas não chegou à sessão (${motivo}); abra a sessão pela barra lateral e responda lá`)

const CASO_NA_ENTREGA = 300

/** O texto que a sessão dona recebe: diz que a pergunta é dela (pode ter sido aberta antes de uma limpeza), com título e caso. */
export function textoDaEntrega(q: Pick<PerguntaAberta, 'id' | 'titulo' | 'caso'>, resposta: string): string {
  const caso = q.caso ? ` Caso: ${q.caso.length > CASO_NA_ENTREGA ? `${q.caso.slice(0, CASO_NA_ENTREGA)}…` : q.caso}.` : ''

  return `${q.id} — pergunta aberta POR ESTA SESSÃO (talvez antes de uma limpeza de contexto): "${q.titulo}".${caso} Chegou a resposta do operador pelo painel: ${resposta}. A pergunta já está como respondida no painel; retome pelo caso e pelo handoff do item, sem repassar a outra sessão.`
}

/** O que a sessão dona recebe quando o operador muda, pelo painel, uma decisão que ela assumiu. */
export function textoDaMudanca(q: Pick<PerguntaAberta, 'id' | 'titulo'>, resposta: string): string {
  return `${q.id} — decisão que ESTA sessão assumiu (talvez antes de uma limpeza de contexto): "${q.titulo}". O operador mudou pelo painel: ${resposta}. A pergunta já está como respondida no painel; ajuste pelo caso e pelo handoff do item.`
}

/**
 * Leva a resposta ao modelo da sessão dona. Outra sessão: send_message. A
 * própria (o painel aberto nela): um prompt desta sessão, que entra quando ela
 * fica livre — por isso não se espera por ele. Falha vira erro no pane. O que se espera (send_message) a devolução cobre.
 */
function entregar($: EngineInterface, q: PerguntaAberta, resposta: string, textoProprio?: string): Promise<void> {
  const texto = textoProprio ?? textoDaEntrega(q, resposta)
  if (!q.sessaoId) {
    void naoChegou($, q, 'a pergunta não tem sessaoId')

    return Promise.resolve()
  }
  if (q.propria) {
    void $.prompt.submit({ text: texto }).then(
      r => {
        if (r.drop !== undefined) return naoChegou($, q, r.drop || 'o prompt foi recusado')
        $.ui.toast(`${q.id} respondida e entregue a esta sessão: ${resposta}`)
      },
      err => naoChegou($, q, mensagem(err)),
    ).catch(() => {})

    return Promise.resolve()
  }

  return $.tool
    .call({ tool: 'mcp__ccd_session_mgmt__send_message', session_id: q.sessaoId, message: texto })
    .then(
      envio => {
        if (envio.deny !== undefined || envio.isError) return naoChegou($, q, envio.deny || envio.text || 'erro sem texto')
        $.ui.toast(`${q.id} respondida e enviada à sessão: ${resposta}`)
      },
      err => naoChegou($, q, mensagem(err)),
    )
    .then(() => undefined)
    .catch(() => {})
}

/**
 * "abrir <apelido>": o app põe a sessão em foco (só aceita as que esta sessão iniciou). Recusa ou erro viram o
 * endereço copiado e um aviso que diz o que houve; nunca fica calado.
 */
async function abrirSessao($: EngineInterface, dono: NonNullable<LinhaItem['dono']>, surface: RenderSurface, botao: string): Promise<void> {
  const naoDeu = async (porque: string) => {
    try {
      const c = dono.link ? await $.ui.copy({ text: dono.link, surface }) : undefined
      if (c?.isCopied) $.ui.toast(`não deu para abrir daqui (${porque}): endereço de ${dono.apelido} copiado`)
      else $.ui.toast(`não deu para abrir ${dono.apelido} nem copiar o endereço (${porque})${dono.link ? `: ${dono.link}` : ''}`)
    } catch (err) {
      $.ui.toast(`não deu para abrir ${dono.apelido} nem copiar o endereço: ${mensagem(err)}`)
    }
  }
  await update($, abrindo, () => ({ localId: dono.localId, botao }))
  try {
    const r = await $.tool.call({ tool: 'mcp__ccd_window__open_session_in', session_id: dono.localId, target: 'focus' })
    if (r.deny !== undefined || r.isError) await naoDeu(r.deny || r.text || 'erro sem texto')
  } catch (err) {
    await naoDeu(mensagem(err))
  } finally {
    await update($, abrindo, atual => (atual?.botao === botao ? null : atual))
  }
}

/** Valor gravado por versão anterior (só o id da sessão) vale nenhum. */
const normalizarAbrindo = (v: unknown): { localId: string; botao: string } | null => (v !== null && typeof v === 'object' ? (v as { localId: string; botao: string }) : null)

// ── pedir a sessão dona que falta a um item ────────────────────────────────────────────────────────────────────────────

export type PapelPedido = 'dona'
const ETAPAS_DE_TRABALHO = ['planejamento', 'design', 'execucao', 'validacao']
/** O "No prompt" some depois disto (o Enter costuma vir em segundos); o "Pedido às", depois do segundo. */
const PROMPT_MS = 5 * 60_000
const PEDIDO_MS = 30 * 60_000

/** Falta a dona ao item na fila numa etapa de trabalho; `espera` e `trava` não pedem, e o item que anda já tem quem trabalhe. */
export function papelQueFalta(i: LinhaItem): PapelPedido | undefined {
  if (i.espera || i.trava) return undefined
  if (i.situacao === 'fila') return ETAPAS_DE_TRABALHO.includes(i.etapa) ? 'dona' : undefined

  return undefined
}

export type Destino = { id: string } | { nenhuma: true } | { varias: number } | { semLista: true }

/** A orquestradora de um projeto: o documento com `papel: "orquestradora"` do projeto (sem distinguir caixa) que o app lista como viva. `vivas` null = a lista não veio. */
export function orquestradoraDoProjeto(projeto: string, orqs: Array<{ id: string; projeto: string }>, vivas: string[] | null): Destino {
  if (vivas === null) return { semLista: true }
  const doProjeto = projeto.toLowerCase()
  const ids = [...new Set(orqs.filter(o => o.projeto.toLowerCase() === doProjeto && vivas.includes(o.id)).map(o => o.id))]

  return ids.length === 1 ? { id: ids[0] as string } : ids.length === 0 ? { nenhuma: true } : { varias: ids.length }
}

/** O texto que vai à orquestradora (D7 do plano): a skill dela o atende pela âncora `vaga-pelo-painel`. */
export function textoDoPedidoDeVaga(projeto: string, itens: Array<{ id: string; titulo: string }>, agora: number): string {
  const lista = itens.map(i => `${i.id} · ${i.titulo}`).join('; ')

  return `Pedido do operador pelo painel (${hora(agora).slice(0, 5)}): abra a sessão dona de cada item sem dona em ${projeto} — ${lista}. Num turno do operador, abra a dona (start_session, modelo pelo risco do item, até o teto de donas); fora dele, proponha o cartão. Skill orquestradora, âncora vaga-pelo-painel.`
}

/** O estado ainda vale no instante `agora`? `enviando` vale até acabar; o resto, até o prazo. */
export const vivoDoEstado = (e: EstadoPedido, agora: number): boolean =>
  e.estado === 'enviando' || agora - e.em <= (e.estado === 'prompt' ? PROMPT_MS : PEDIDO_MS)

/** Tira do átomo o pedido de item que ganhou o papel (ou sumiu) e o que passou do prazo. A chave `lote` é do gesto, que a apaga. */
export function podarPedidos(atual: Record<string, EstadoPedido>, itens: LinhaItem[], agora: number): Record<string, EstadoPedido> {
  const porId = new Map(itens.map(i => [i.id, i]))
  const fica = Object.entries(atual).filter(([id, e]) => {
    if (id === 'lote') return true
    const item = porId.get(id)

    const falta = item === undefined ? undefined : papelQueFalta(item)

    return falta !== undefined && vivoDoEstado(e, agora) && (e.estado === 'enviando' || e.papel === falta)
  })

  return fica.length === Object.keys(atual).length ? atual : Object.fromEntries(fica)
}

const curto = (t: string) => (t.length > 40 ? `${t.slice(0, 39)}…` : t)
const hhmm = (ms: number) => hora(ms).slice(0, 5)

/**
 * O clique em "Pedir dona" (`ids` com um item) ou em "Pedir n sessões": um pedido por orquestradora de projeto. A própria sessão
 * recebe o texto no campo do prompt (o Enter é do operador, e só um turno dele abre sessão); outra recebe `send_message` e responde
 * com um cartão. Cada item sai do gesto num estado visível; a falha volta o botão e vai para os avisos.
 */
async function pedirSessoes($: EngineInterface, ids: string[], chave: string, surface: RenderSurface): Promise<void> {
  const atual = await read($, pedindo)
  if (atual[chave]?.estado === 'enviando') return
  const l = await read($, leitura)
  const agora = await $.clock.now()
  const lote = chave === 'lote'
  const vivas = l.semLista ? null : (l.sessoes ?? []).map(v => v.sessionId)
  const grupos = new Map<string, { orq: string; alvos: Array<{ item: LinhaItem; papel: PapelPedido }> }>()
  for (const item of l.itens.filter(i => ids.includes(i.id))) {
    const papel = papelQueFalta(item)
    const e = atual[item.id]
    if (!papel || !item.projeto || (e && (e.estado === 'enviando' || (lote ? vivoDoEstado(e, agora) : e.estado === 'pedido')))) continue
    const destino = orquestradoraDoProjeto(item.projeto, l.orquestradoras ?? [], vivas)
    if (!('id' in destino)) continue
    const g = grupos.get(item.projeto) ?? { orq: destino.id, alvos: [] }
    g.alvos.push({ item, papel })
    grupos.set(item.projeto, g)
  }
  if (grupos.size === 0) return

  const marcar = (alvos: Array<{ item: LinhaItem; papel: PapelPedido }>, estado: ((papel: PapelPedido) => EstadoPedido) | null) =>
    update($, pedindo, p => {
      const novo = { ...p }
      for (const { item, papel } of alvos) {
        if (estado) novo[item.id] = estado(papel)
        else delete novo[item.id]
      }

      return novo
    })
  const todos = [...grupos.values()].flatMap(g => g.alvos)
  await marcar(todos, () => ({ estado: 'enviando' }))
  if (lote) await update($, pedindo, p => ({ ...p, lote: { estado: 'enviando' } }))

  // Nada que escape do gesto deixa o botão em "Pedindo…" para sempre: o que ainda estiver `enviando` ao fim volta ao botão.
  const soltar = () =>
    update($, pedindo, p => Object.fromEntries(Object.entries(p).filter(([k, e]) => !(e.estado === 'enviando' && (k === 'lote' || todos.some(a => a.item.id === k))))))
  try {
    await enviarPedidos($, grupos, lote, agora, surface, marcar)
  } finally {
    await soltar()
  }
}

async function enviarPedidos(
  $: EngineInterface,
  grupos: Map<string, { orq: string; alvos: Array<{ item: LinhaItem; papel: PapelPedido }> }>,
  lote: boolean,
  agora: number,
  surface: RenderSurface,
  marcar: (alvos: Array<{ item: LinhaItem; papel: PapelPedido }>, estado: ((papel: PapelPedido) => EstadoPedido) | null) => Promise<void>,
): Promise<void> {
  const propria = await sessaoDoApp($)
  const saiu: Array<{ kind: 'prompt' | 'mensagem'; projeto: string; n: number; orq: string }> = []
  for (const [projeto, g] of grupos) {
    const texto = textoDoPedidoDeVaga(projeto, g.alvos.map(a => ({ id: a.item.id, titulo: a.item.titulo })), agora)
    const kind = g.orq === propria ? 'prompt' : 'mensagem'
    let erro: string | undefined
    try {
      if (kind === 'prompt') {
        const rascunho = await $.prompt.read()
        const comRascunho = rascunho.text.trim() !== ''
        const r = await $.prompt.fill({ text: comRascunho ? `\n${texto}` : texto, mode: comRascunho ? 'append' : 'replace' })
        if (!r.isFilled) erro = 'a caixa do prompt não aceitou o texto'
      } else {
        const r = await $.tool.call({ tool: 'mcp__ccd_session_mgmt__send_message', session_id: g.orq, message: texto })
        if (r.deny !== undefined || r.isError) erro = r.deny || r.text || 'erro sem texto'
      }
    } catch (err) {
      erro = mensagem(err)
    }
    if (erro === undefined) {
      await marcar(g.alvos, papel => ({ estado: kind === 'prompt' ? 'prompt' : 'pedido', em: agora, papel }))
      saiu.push({ kind, projeto, n: g.alvos.length, orq: g.orq })
      continue
    }
    await marcar(g.alvos, null)
    const titulos = g.alvos.map(a => `${a.item.id} · ${curto(a.item.titulo)}`)
    await avisar(
      $,
      kind === 'prompt'
        ? g.alvos.length === 1
          ? `Não pus o pedido do ${titulos[0]} na caixa do prompt (${erro}): escreva à orquestradora.`
          : `Não pus ${g.alvos.length} pedidos na caixa do prompt (${erro}): ${titulos.join(', ')}; escreva à orquestradora.`
        : g.alvos.length === 1
          ? `Não pedi a sessão do ${titulos[0]} à orquestradora de ${projeto} (${erro}): peça na conversa dela.`
          : `Não pedi ${g.alvos.length} sessões à orquestradora de ${projeto} (${erro}): ${titulos.join(', ')}; peça na conversa dela.`,
    )
  }
  if (saiu.length > 0) {
    $.ui.toast(
      lote
        ? `${saiu
            .map(s =>
              s.kind === 'prompt'
                ? `${s.n} ${s.n === 1 ? 'pedido' : 'pedidos'} na caixa do prompt, aperte Enter`
                : `${s.n} ${s.n === 1 ? 'pedido enviado' : 'pedidos enviados'} à orquestradora de ${s.projeto}, ${s.n === 1 ? 'o cartão aparece' : 'os cartões aparecem'} na conversa dela`,
            )
            .join('; ')}.`
        : saiu[0]?.kind === 'prompt'
          ? 'Pedido na caixa do prompt: aperte Enter para abrir a sessão.'
          : `Pedido enviado à orquestradora de ${saiu[0]?.projeto}: o cartão aparece na conversa dela.`,
    )
  }
  // Com um destino só e a mensagem enviada, a conversa da orquestradora vai a foco; com dois ou mais, o toast diz onde estão os cartões.
  const unico = saiu.length === 1 && grupos.size === 1 ? saiu[0] : undefined
  if (unico?.kind === 'mensagem') await abrirSessao($, { apelido: `orquestradora de ${unico.projeto}`, localId: unico.orq, link: linkDe(unico.orq, []) }, surface, `auto:${unico.orq}`)
}

// O último lugar onde uma superfície desenhou o pane: o que a tool de diagnóstico relata.
const desenhos: Record<string, { placement: string; bodyColumns: number; em: string }> = {}


// Uma leitura por vez; a falha que escapa vira erro visível, nunca rejeição solta.
// `forcar` solta a leitura pendurada e começa outra; a velha, se um dia voltar, não derruba o `emCurso` da nova.
let rodada = 0
async function atualizar($: EngineInterface, forcar = false): Promise<void> {
  if (emCurso && !forcar) return
  emCurso = true
  const minha = ++rodada
  try {
    await ler($)
  } catch (err) {
    await update($, leitura, l => ({ ...l, lendo: false, erros: [...l.erros, `leitura: ${mensagem(err)}`] })).catch(() => {})
  } finally {
    if (minha === rodada) emCurso = false
  }
}

// A leitura inteira: duas fontes, cada uma com o próprio erro, nunca lista vazia calada.
async function ler($: EngineInterface): Promise<void> {
  await update($, leitura, l => ({ ...l, lendo: true }))
  // O modo que uma troca mudou depois de a leitura começar vale mais que o que ela leu: ver `alternarModo`.
  const geracao = geracaoModo
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

  // F183: as fechadas moram em `perguntas/arquivo/<projeto>/<AAAA-MM>/`; o rodapé lê de lá só as respondidas hoje.
  const lerArquivoDoDia = async (): Promise<Doc[]> => {
    const raiz = `${pasta}/perguntas/arquivo`
    const agoraMs = await $.clock.now()
    const hoje = diaEmSP(agoraMs)
    const desde = inicioDoDiaEmSP(agoraMs)
    let projetos: Awaited<ReturnType<EngineInterface['fs']['list']>> = []
    try {
      projetos = await $.fs.list(raiz)
    } catch {
      return [] // sem arquivo ainda: nada fechado fora da pasta quente
    }
    const docs: Doc[] = []
    for (const p of projetos.filter(e => e.kind === 'directory')) {
      const dir = `${raiz}/${p.name}/${hoje.slice(0, 7)}`
      let entradas: typeof projetos = []
      try {
        entradas = await $.fs.list(dir)
      } catch {
        continue // projeto sem pergunta fechada neste mês
      }
      // o arquivo é escrito quando a pergunta fecha ou é movida: o que não mudou hoje não foi respondido hoje
      for (const e of entradas) {
        if (e.kind !== 'file' || !e.name.endsWith('.json') || e.mtimeMs < desde) continue
        try {
          const d = lerDoc((await $.fs.read(`${dir}/${e.name}`)) as string, e.name)
          const quando = texto(d.data.respondidaEm) ?? texto(d.data.atualizadoEm)
          if (quando && !Number.isNaN(Date.parse(quando)) && diaEmSP(Date.parse(quando)) === hoje) docs.push(d)
        } catch (err) {
          erros.push(`perguntas/arquivo/${p.name}/${e.name}: ${mensagem(err)}`)
        }
      }
    }

    return docs
  }

  let docsSessoes: Doc[] = []
  let docsPerguntas: Doc[] = []
  let docsDoDia: Doc[] = []
  let docsFila: Doc[] = []
  let docsCartoes: Doc[] = []
  let temas: Tema[] = []
  let vivas: Vivo[] = []
  let vivasLidas = false
  let ausente: Leitura['ausente'] = null
  await Promise.all([
    lerBandeira($).then(
      b => void (ausente = b),
      err => void erros.push(`modo ausente (${BANDEIRA}): ${mensagem(err)}`),
    ),
    lerColecao('sessoes').then(
      d => void (docsSessoes = d),
      err => void erros.push(`sessoes do painel: ${mensagem(err)}`),
    ),
    lerColecao('perguntas').then(
      d => void (docsPerguntas = d),
      err => void erros.push(`perguntas do painel: ${mensagem(err)}`),
    ),
    lerArquivoDoDia().then(
      d => void (docsDoDia = d),
      err => void erros.push(`perguntas respondidas hoje: ${mensagem(err)}`),
    ),
    lerColecao('fila').then(
      d => void (docsFila = d),
      err => void erros.push(`fila do painel: ${mensagem(err)}`),
    ),
    lerColecao('cartoes').then(
      d => void (docsCartoes = d),
      err => void erros.push(`cartoes do painel: ${mensagem(err)}`),
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

  // O reinício do app: o pane aberto confere com a lista que acabou de ler e guarda o resultado no arquivo que a barra lê.
  let falhouReinicio = false
  if (vivasLidas && proprio !== undefined) {
    try {
      await conferirReinicio($, vivas)
    } catch (err) {
      falhouReinicio = true
      erros.push(`reinício: ${mensagem(err)}`)
    }
  }
  await lerReinicio($, erros).catch(err => void erros.push(`reinício: ${mensagem(err)}`))
  await update($, reinicio, r => ({ ...r, falhou: falhouReinicio }))

  // O nome que a pergunta mostra: o `sessao` dela, senão o título da sessão pelo sessaoId — nunca o id cru.
  const pareceId = (t: string) => /^(local_)?[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(t)
  const nomeDaSessao = (sessao: string | undefined, sessaoId: string | undefined) => {
    if (sessao && sessao !== sessaoId && !pareceId(sessao)) return sessao
    const id = sessaoId ?? sessao
    if (!id) return '?'
    const doc = docsSessoes.find(d => (texto(d.data.sessionId) ?? d.id) === id)
    return texto(doc?.data.titulo) ?? vivas.find(v => v.sessionId === id)?.title ?? 'sessão sem nome'
  }
  const montarPergunta = (d: Doc): PerguntaAberta => ({
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
    })
  const perguntas = docsPerguntas.filter(d => d.data.estado === 'aberta').map(montarPergunta).sort((a, b) => numero(a.id) - numero(b.id))
  const assumidas = docsPerguntas.filter(d => d.data.estado === 'assumida').map(montarPergunta).sort((a, b) => numero(b.id) - numero(a.id))
  // As fechadas que ainda estão na pasta quente (a batida as leva ao arquivo) mais as do arquivo respondidas hoje.
  const naQuente = new Set(docsPerguntas.map(d => d.id))
  const anteriores: PerguntaAnterior[] = [...docsPerguntas, ...docsDoDia.filter(d => !naQuente.has(d.id))]
    .filter(d => d.data.estado !== 'aberta' && d.data.estado !== 'assumida')
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
  const indice = montarIndice(docsFila, temas)
  const porId = new Map(indice.map(i => [i.id, i]))
  for (const q of [...perguntas, ...assumidas]) {
    const dono = q.item ? porId.get(q.item) : undefined
    if (dono) q.rotulo = `${dono.id} · ${dono.titulo}`
  }
  const orquestradoras = docsSessoes
    .filter(d => d.data.papel === 'orquestradora' && d.data.estado !== 'concluida')
    .map(d => ({ id: texto(d.data.sessionId) ?? d.id, projeto: (texto(d.data.projeto) ?? '').toLowerCase() }))
  const cartoes = docsCartoes.flatMap(d => {
    const c = lerCartao(d)
    if (!c) erros.push(`cartoes/${d.id}: fora do contrato`)

    return c ? [c] : []
  })
  await update($, pedindo, p => podarPedidos(p, itens, agora))
  await update($, leitura, l => ({
    orquestradoras,
    cartoes,
    avisos: l.avisos ?? [],
    lidoEm: agora,
    lendo: false,
    erros,
    itens,
    indice,
    temas,
    perguntas,
    assumidas,
    anteriores,
    sessoes: vivas.map(({ sessionId, isRunning, lastActivityAt, title, createdAt }) => ({ sessionId, isRunning, lastActivityAt, title, createdAt })),
    semLista: !(vivasLidas && proprio !== undefined),
    ausente: geracao === geracaoModo && !trocandoAgora ? ausente : l.ausente,
  }))
}

/**
 * O modo ausente pelo contrato da bandeira: ligado só com o arquivo, JSON válido, `desde` data válida e `ligado !== false`;
 * sem arquivo ou com outro formato é desligado. JSON que não se lê é `null` (a leitura levanta o erro).
 */
async function lerBandeira($: EngineInterface): Promise<NonNullable<Leitura['ausente']>> {
  const base = `${await $.env.get('HOME')}/${BASE_ORQUESTRACAO}`
  const entradas = await $.fs.list(base)
  if (!entradas.some(e => e.kind === 'file' && e.name === BANDEIRA)) return { ligado: false }
  const b = JSON.parse((await $.fs.read(`${base}/${BANDEIRA}`)) as string) as Record<string, unknown> | null
  if (b === null || typeof b !== 'object' || Array.isArray(b)) throw new Error('o arquivo não é um objeto JSON')
  const desdeOk = typeof b.desde === 'string' && !Number.isNaN(Date.parse(b.desde))

  return { ligado: desdeOk && b.ligado !== false, desde: desdeOk ? (b.desde as string) : undefined, por: texto(b.por) }
}

// A cada troca do modo a geração sobe: a leitura que começou antes dela não escreve o campo `ausente` (escreve o resto).
let geracaoModo = 0
let trocandoAgora = false

/** Depois de um clique: com o pane aberto, a leitura dele; senão só a da barra (a leve, sem `list_sessions`). */
async function relerDepoisDoClique($: EngineInterface): Promise<void> {
  if (deveFechar(await $.ui.panes())) await atualizar($)
  else await lerBarra($)
}

/**
 * O botão do modo: o efeito entra na hora (`leitura.ausente` já é o modo novo) e a recusa desfaz, dizendo o motivo.
 * Liga gravando `{desde, frase, sessionId, por: "painel"}`; desliga gravando `{ligado: false, desde, desligadoEm, por: "painel"}`
 * (o pane não apaga arquivo; o `desde` do período fica para o resumo da ausência) e pede a cada orquestradora ativa o resumo
 * (skill orquestradora, seção resumo-da-ausencia). Não abre sessão: isso é do `/ausente on`.
 */
export async function alternarModo($: EngineInterface): Promise<void> {
  if (trocandoAgora) return
  trocandoAgora = true
  const antes = (await read($, leitura)).ausente
  if (antes === undefined || antes === null) {
    trocandoAgora = false

    return
  }
  await update($, trocandoModo, () => true)
  const ligando = !antes.ligado
  try {
    const agora = new Date(await $.clock.now()).toISOString()
    geracaoModo++
    await update($, leitura, l => ({ ...l, ausente: ligando ? { ligado: true, desde: agora, por: 'painel' } : { ligado: false, por: 'painel' } }))
    const conteudo = ligando
      ? { desde: agora, frase: 'botão do painel', sessionId: (await sessaoDoApp($)) ?? null, por: 'painel' }
      : { ligado: false, ...(antes.desde ? { desde: antes.desde } : {}), desligadoEm: agora, por: 'painel' }
    await $.fs.write(`${await $.env.get('HOME')}/${BASE_ORQUESTRACAO}/${BANDEIRA}`, `${JSON.stringify(conteudo, null, 2)}\n`)
    geracaoModo++
    if (ligando) {
      $.ui.toast('Modo ausente ligado. Para abrir as donas que faltam antes de sair, use /ausente on no chat.')
    } else {
      const pedidas = await pedirResumo($, antes.desde, agora)
      $.ui.toast(pedidas > 0 ? 'Modo ausente desligado. A orquestradora traz o resumo.' : 'Modo ausente desligado')
    }
  } catch (err) {
    geracaoModo++
    await update($, leitura, l => ({ ...l, ausente: antes }))
    await avisar($, `Não consegui ${ligando ? 'ligar' : 'desligar'} o modo ausente (${mensagem(err)}).`)
  } finally {
    trocandoAgora = false
    await update($, trocandoModo, () => false)
  }
  await relerDepoisDoClique($)
}

/**
 * Pede o resumo do período a cada orquestradora ativa (`papel: "orquestradora"` em `sessoes`, estado fora de `concluida`).
 * A própria sessão recebe um prompt; outra, send_message. Falha no envio vira aviso no pane e não desfaz o modo.
 * Devolve quantas orquestradoras receberam o pedido.
 */
async function pedirResumo($: EngineInterface, desde: string | undefined, ate: string): Promise<number> {
  let ativas: string[] = []
  // só vale a orquestradora que o app lista agora (não arquivada): o documento em `sessoes` envelhece
  const lida = await read($, leitura)
  const vivasIds = lida.semLista ? null : new Set((lida.sessoes ?? []).map(v => v.sessionId))
  try {
    const pasta = `${await $.env.get('HOME')}/${PASTA}/sessoes`
    for (const e of await $.fs.list(pasta)) {
      if (e.kind !== 'file' || !e.name.endsWith('.json')) continue
      try {
        const d = lerDoc((await $.fs.read(`${pasta}/${e.name}`)) as string, e.name)
        if (d.data.papel === 'orquestradora' && d.data.estado !== 'concluida' && (vivasIds === null || vivasIds.has(d.id))) ativas.push(d.id)
      } catch {
        /* documento ilegível não é orquestradora */
      }
    }
  } catch (err) {
    ativas = []
    await avisar($, `Modo ausente desligado, mas não li as sessões para pedir o resumo (${mensagem(err)}).`)
  }
  const mensagemDoPedido = `O operador desligou o modo ausente pelo painel (${desde ? `desde ${desde}` : 'sem início registrado'} até ${ate}). Traga a ele o resumo do período: skill orquestradora, seção resumo-da-ausencia.`
  const propria = await sessaoDoApp($)
  let pedidas = 0
  for (const id of ativas) {
    if (id === propria) {
      pedidas++
      void $.prompt.submit({ text: mensagemDoPedido }).then(
        r => (r.drop !== undefined ? avisar($, `Não pedi o resumo à orquestradora (${r.drop || 'o prompt foi recusado'}).`) : undefined),
        err => avisar($, `Não pedi o resumo à orquestradora (${mensagem(err)}).`),
      ).catch(() => {})
      continue
    }
    try {
      const r = await $.tool.call({ tool: 'mcp__ccd_session_mgmt__send_message', session_id: id, message: mensagemDoPedido })
      if (r.deny !== undefined || r.isError) await avisar($, `Não pedi o resumo à orquestradora ${id} (${r.deny || r.text || 'erro sem texto'}); peça a ela na conversa dela.`)
      else pedidas++
    } catch (err) {
      await avisar($, `Não pedi o resumo à orquestradora ${id} (${mensagem(err)}); peça a ela na conversa dela.`)
    }
  }

  return pedidas
}

/**
 * A leitura leve do modo (a barra, a cada 30 s): só a bandeira, no mesmo campo `leitura.ausente`, com o mesmo cuidado de
 * `ler` com uma troca em curso. Bandeira que não se lê = `null` (vale presente) e o motivo em `erros`.
 */
export async function atualizarModo($: EngineInterface): Promise<void> {
  const geracao = geracaoModo
  let ausente: Leitura['ausente'] = null
  let erro: string | undefined
  try {
    ausente = await lerBandeira($)
  } catch (err) {
    erro = `modo ausente (${BANDEIRA}): ${mensagem(err)}`
  }
  await update($, leitura, l => ({
    ...l,
    ausente: geracao === geracaoModo && !trocandoAgora ? ausente : l.ausente,
    erros: [...l.erros.filter(x => !x.startsWith('modo ausente (')), ...(erro ? [erro] : [])],
  }))
}

// A sessão do app (`local_…`) que roda este processo; o CLI no terminal não tem, e então o mod não grava nem reabre.
export async function sessaoDoApp($: EngineInterface): Promise<string | undefined> {
  try {
    return (await $.env.get('CLAUDE_CODE_HOST_SESSION_ID')) || undefined
  } catch (erro) {
    await $.ui.log(`painel: sem o id da sessão do app: ${String(erro)}`)
    return undefined
  }
}
async function lerMarcas($: EngineInterface): Promise<Marcas> {
  try {
    const v = await $.store.get(ABERTOS)

    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Marcas) : {}
  } catch (erro) {
    await $.ui.log(`painel: não li as marcas de painel aberto: ${String(erro)}`)
    return {}
  }
}
async function gravarMarcas($: EngineInterface, marcas: Marcas): Promise<void> {
  try {
    if (Object.keys(marcas).length === 0) await $.store.delete(ABERTOS)
    else await $.store.set(ABERTOS, marcas)
  } catch (erro) {
    await $.ui.log(`painel: não gravei as marcas de painel aberto: ${String(erro)}`)
  }
}
async function mudarMarca($: EngineInterface, quem: (marcas: Marcas, id: string, agora: number) => Marcas): Promise<void> {
  const id = await sessaoDoApp($)
  if (!id) return
  const antes = await lerMarcas($)
  const depois = quem(antes, id, await $.clock.now())
  if (JSON.stringify(antes) !== JSON.stringify(depois)) await gravarMarcas($, depois)
}

// Processo novo (limpeza ou reinício do app) numa sessão que deixou o painel aberto: abre de novo, sem comando.
async function reabrir($: EngineInterface): Promise<void> {
  const id = await sessaoDoApp($)
  if (!id) return
  const marcas = await lerMarcas($)
  const agora = await $.clock.now()
  const vencido = vencidas(marcas, agora)
  if (vencido.length > 0) await gravarMarcas($, vencido.reduce(desmarcar, marcas))
  if (!marcas[id] || vencido.includes(id)) return
  try {
    const r = await $.ui.open({ id: PANE, title: TITULO, columns: 60 })
    ligar($)
    if (!r.isPlaced) await $.ui.log(`painel: reabri sem lugar: ${r.reason}`)
  } catch (erro) {
    await $.ui.log(`painel: não reabri: ${String(erro)}`)
  }
}

// ---- a barra de status acima do prompt (F52): leitura leve, relógio do cache e gestos; o desenho e as regras puras vivem em barra.tsx ----

const BARRA_VAZIA: Barra = {
  lidoEm: null,
  abertas: 0,
  ehOrquestradora: false,
  titulo: null,
  item: null,
  donas: 0,
  projeto: null,
  cache: { expiraEm: null, segundos: null },
  avisado: 0,
  tokens: null,
  janela: null,
  erros: [],
}
/** Desde quando o limpar foi mandado e a limpeza ainda não apareceu (`null` = nenhum em curso). */
export const limpando = atom({ plugin: 'painel-sessoes', key: 'limpando' } as const, null as { desde: number; tokens: number | null } | null)
export const barra = atom({ plugin: 'painel-sessoes', key: 'barra' } as const, BARRA_VAZIA)
const barraEscondida = atom({ plugin: 'painel-sessoes', key: 'barraEscondida' } as const, false)

// O turno da conversa principal está rodando: o aviso do cache só sai com ele parado.
let trabalhandoNaBarra = false
let timerRelogio: { cancel: () => void } | undefined
let timerLeitura: { cancel: () => void } | undefined
let timerBatida: { cancel: () => void } | undefined
let lendoBarra = false

const nomeDaPasta = (p: string) => p.replace(/\/+$/, '').split('/').pop() ?? ''

/** O projeto como o painel o grava: a pasta que contém o `.git`; worktree `.claude/worktrees/x` → a pasta acima de `.claude`. Minúsculo. */
async function projetoDoCwd($: EngineInterface): Promise<string | null> {
  let cwd: string
  try {
    cwd = await $.session.cwd()
  } catch {
    return null
  }
  const w = cwd.indexOf('/.claude/worktrees/')
  if (w > 0) return slugDoProjeto(nomeDaPasta(cwd.slice(0, w)))
  let dir = cwd
  for (let i = 0; i < 12 && dir.length > 1; i++) {
    try {
      if ((await $.fs.list(dir)).some(x => x.name === '.git')) return slugDoProjeto(nomeDaPasta(dir))
    } catch {
      break
    }
    dir = dir.slice(0, dir.lastIndexOf('/')) || '/'
  }

  return slugDoProjeto(nomeDaPasta(cwd))
}

/** O título desta sessão no registro do app; fora do app (ou sem o arquivo), `null`. */
async function tituloDoApp($: EngineInterface, home: string | undefined, id: string): Promise<string | null> {
  try {
    const conta = await $.env.get('CLAUDE_CODE_ACCOUNT_UUID')
    const org = await $.env.get('CLAUDE_CODE_ORGANIZATION_UUID')
    if (!home || !conta || !org) return null
    const reg = JSON.parse((await $.fs.read(`${home}/${BANDEIRA_DO_APP}/${conta}/${org}/${id}.json`)) as string) as Record<string, unknown>

    return texto(reg.title) ?? null
  } catch {
    return null
  }
}

/** Uma leitura por vez; falha vira linha em `erros`, nunca exceção solta. Só arquivos: o `list_sessions` fica para o pane aberto. */
async function lerBarra($: EngineInterface): Promise<void> {
  if (lendoBarra) return
  lendoBarra = true
  try {
    const home = await $.env.get('HOME')
    const pasta = `${home}/${PASTA}`
    const erros: string[] = []
    const colecao = async (nome: string): Promise<Doc[]> => {
      let entradas: Awaited<ReturnType<EngineInterface['fs']['list']>> = []
      try {
        entradas = await $.fs.list(`${pasta}/${nome}`)
      } catch (err) {
        erros.push(`${nome}: ${mensagem(err)}`)
      }
      const docs: Doc[] = []
      for (const e of entradas) {
        if (e.kind !== 'file' || !e.name.endsWith('.json')) continue
        try {
          docs.push(lerDoc((await $.fs.read(`${pasta}/${nome}/${e.name}`)) as string, e.name))
        } catch (err) {
          erros.push(`${nome}/${e.name}: ${mensagem(err)}`)
        }
      }

      return docs
    }
    const [docsPerguntas, docsFila, docsSessoes] = await Promise.all([colecao('perguntas'), colecao('fila'), colecao('sessoes')])
    const host = await sessaoDoApp($)
    const titulo = host ? await tituloDoApp($, home, host) : null
    const item = host ? meuItem(docsFila, host) : null
    const projeto = item?.projeto ?? (await projetoDoCwd($))
    const orquestradoras = orquestradorasDoProjeto(docsSessoes, projeto)
    await atualizarModo($).catch(err => void erros.push(`modo ausente: ${mensagem(err)}`))
    await lerReinicio($).catch(() => undefined)
    let tokens: number | null = null
    let janelaDoModelo: number | null = null
    try {
      const { context } = await $.session.usage()
      tokens = context.tokens ?? null
      janelaDoModelo = context.window ?? null
    } catch (err) {
      erros.push(`contexto: ${mensagem(err)}`)
    }
    // A janela do denominador: falha de leitura não vira erro na barra, cai para o próximo da lista.
    const daEnv = await $.env.get('CLAUDE_CODE_AUTO_COMPACT_WINDOW').catch(() => undefined)
    const doSettings = home ? ((await $.fs.read(`${home}/.claude/settings.json`).catch(() => null)) as string | null) : null
    const janela = janelaDeCompactacao({ env: daEnv ?? undefined, settings: doSettings, modelo: janelaDoModelo })
    const agora = await $.clock.now()
    const desdeLimpar = await read($, limpando)
    if (desdeLimpar !== null && ((tokens !== null && tokens < LIMPANDO_ABAIXO_DE && (desdeLimpar.tokens === null || desdeLimpar.tokens >= LIMPANDO_ABAIXO_DE || tokens < desdeLimpar.tokens / 2)) || agora - desdeLimpar.desde > LIMPANDO_MAX_MS)) await update($, limpando, () => null)
    await update($, barra, b => {
      return {
        ...b,
        lidoEm: agora,
        abertas: abertasDoProjeto(docsPerguntas),
        ehOrquestradora: (host !== undefined && orquestradoras.includes(host)) || papelEApelido(titulo).papel === 'orquestradora',
        titulo,
        item: item ? { id: item.id, titulo: item.titulo, etapa: item.etapa } : null,
        donas: contarDonas(docsFila, projeto),
        projeto,
        tokens,
        janela,
        erros,
      }
    })
  } catch (err) {
    await update($, barra, b => ({ ...b, erros: [...b.erros, `leitura: ${mensagem(err)}`] })).catch(() => {})
  } finally {
    lendoBarra = false
  }
}

async function avisarCache($: EngineInterface, minutos: number): Promise<void> {
  const b = await read($, barra)
  const quem = [b.projeto, b.titulo].filter(Boolean).join(' — ')
  const aviso = `${quem ? `${quem}: ` : ''}o cache vence em ${minutos} min`
  try {
    const r = await $.tool.call({ tool: 'PushNotification', message: aviso, status: 'proactive' })
    if (r.deny !== undefined || r.isError) $.ui.toast(aviso)
  } catch {
    $.ui.toast(aviso)
  }
}

/** Um tique por segundo: recalcula os segundos (só grava quando o segundo muda) e dá o aviso de 10 e de 5 min, uma vez cada. */
async function tiqueDoCache($: EngineInterface): Promise<void> {
  const b = await read($, barra)
  if (b.cache.expiraEm === null) return
  const segundos = Math.max(0, Math.ceil((b.cache.expiraEm - (await $.clock.now())) / 1000))
  const alvo = trabalhandoNaBarra ? 0 : segundos <= AVISO_MIN / 4 ? 2 : segundos <= AVISO_MIN / 2 ? 1 : 0
  if (segundos === b.cache.segundos && alvo <= b.avisado) return
  await update($, barra, x => ({ ...x, cache: { ...x.cache, segundos }, avisado: Math.max(x.avisado, alvo) }))
  if (alvo > b.avisado) await avisarCache($, alvo === 2 ? 5 : 10)
}

/**
 * O botão `↺ Limpar` (só na orquestradora): grava o ok que a T7 lê (`limpeza/<local_…>.json`, o prompt do mod chega com origem
 * `plugin`, nunca `human`) e manda à própria sessão o prompt de limpar. Sem o arquivo, nada é enviado. O `Limpando…` aparece no
 * mesmo render e segue até a leitura ver o contexto pequeno (ou 10 min); falha volta o botão na hora, com toast e aviso.
 */
async function limparPelaBarra($: EngineInterface): Promise<void> {
  if ((await read($, limpando)) !== null) return
  const desde = await $.clock.now()
  const tokensNoClique = (await read($, barra)).tokens
  await update($, limpando, () => ({ desde, tokens: tokensNoClique }))
  const falhou = async (motivo: string) => {
    await update($, limpando, () => null)
    $.ui.toast(motivo)
    await avisar($, motivo).catch(() => {})
  }
  try {
    const host = await sessaoDoApp($)
    if (!host) return await falhou('Não consegui mandar a limpeza (sessão não identificada).')
    const pasta = `${await $.env.get('HOME')}/${BASE_ORQUESTRACAO}/limpeza`
    const arquivo = `${pasta}/${host}.json`
    const conteudo = `${JSON.stringify({ em: new Date(desde).toISOString(), por: 'barra' })}\n`
    try {
      await $.fs.write(arquivo, conteudo)
    } catch (erroDaEscrita) {
      // A pasta pode não existir ainda: cria e tenta uma vez mais; se continuar falhando, o motivo é o da escrita.
      try {
        await $.process.run(['mkdir', '-p', pasta], { timeoutMs: SCRIPT_TIMEOUT_MS })
        await $.fs.write(arquivo, conteudo)
      } catch {
        throw erroDaEscrita
      }
    }
    const r = await $.prompt.submit({ text: PROMPT_DE_LIMPAR })
    if (r.drop !== undefined) await falhou(`Não consegui mandar a limpeza (${r.drop || 'o prompt foi recusado'}).`)
  } catch (err) {
    await falhou(`Não consegui mandar a limpeza (${mensagem(err)}).`)
  }
}


// ---- o reinício do app (F152): quando dá para reiniciar sem derrubar trabalho, e o aviso "me avise" ----
// O julgamento é do script (`painel pode-reiniciar`, que grava `batida/pode-reiniciar.json`); aqui ficam a leitura dos dois arquivos
// de `batida/`, o aviso (`aviso-de-reinicio.json`), a vigia (o mod da sessão que ligou o aviso confere a cada minuto) e os gestos.

export const reinicio = atom({ plugin: 'painel-sessoes', key: 'reinicio' } as const, { arquivo: null, aviso: null, falhou: false } as Reinicio)
/** O botão do aviso está gravando: `Ligando…` ou `Desligando…`, e o clique repetido é ignorado. */
export const reiniciando = atom({ plugin: 'painel-sessoes', key: 'reiniciando' } as const, null as 'ligando' | 'desligando' | null)

const ARQUIVO_DO_REINICIO = 'pode-reiniciar.json'
const ARQUIVO_DO_AVISO = 'aviso-de-reinicio.json'
const ARQUIVO_DA_LISTA = 'sessoes-reinicio.json'
let vigiando = false
let timerVigia: { cancel: () => void } | undefined

const validoArquivo = (v: unknown): v is ArquivoDeReinicio =>
  typeof v === 'object' && v !== null && typeof (v as ArquivoDeReinicio).em === 'string' && Array.isArray((v as ArquivoDeReinicio).motivos)
const validoAviso = (v: unknown): v is AvisoDeReinicio =>
  typeof v === 'object' && v !== null && typeof (v as AvisoDeReinicio).ligadoEm === 'string' && typeof (v as AvisoDeReinicio).vigia === 'string'

/** Um arquivo de `batida/`: ausente = `null` sem erro; ilegível ou fora do formato = `null` e a linha em `erros`. */
async function lerArquivoDaBatida<T>($: EngineInterface, pasta: string, nome: string, valido: (v: unknown) => v is T, erros: string[]): Promise<T | null> {
  try {
    const entradas = await $.fs.list(pasta)
    if (!entradas.some(x => x.kind === 'file' && x.name === nome)) return null
  } catch {
    return null
  }
  try {
    const v = JSON.parse((await $.fs.read(`${pasta}/${nome}`)) as string) as unknown
    if (!valido(v)) throw new Error('fora do formato')

    return v
  } catch (err) {
    erros.push(`${nome}: ${mensagem(err)}`)

    return null
  }
}

/** Os dois arquivos do reinício para o átomo; durante o clique do botão o aviso na tela vale mais que o do disco. */
async function lerReinicio($: EngineInterface, erros: string[] = []): Promise<Pick<Reinicio, 'arquivo' | 'aviso'>> {
  const pasta = `${await $.env.get('HOME')}/${BASE_ORQUESTRACAO}/batida`
  const arquivo = await lerArquivoDaBatida($, pasta, ARQUIVO_DO_REINICIO, validoArquivo, erros)
  const aviso = await lerArquivoDaBatida($, pasta, ARQUIVO_DO_AVISO, validoAviso, erros)
  const gravando = (await read($, reiniciando)) !== null
  await update($, reinicio, r => ({ ...r, arquivo, aviso: gravando ? r.aviso : aviso }))

  return { arquivo, aviso }
}

/** A lista fresca de sessões do app, com a própria (o `list_sessions` não a traz): a mesma que a batida monta. */
async function listaFresca($: EngineInterface): Promise<Vivo[]> {
  const lista = await $.tool.call({ tool: 'mcp__ccd_session_mgmt__list_sessions', linked: false, include_archived: false, limit: 200 })
  if (lista.deny !== undefined || lista.isError) throw new Error(`list_sessions: ${lista.deny ?? lista.text ?? 'erro sem texto'}`)
  const texto_ = lista.text ?? ''
  const vivas = JSON.parse(texto_.slice(Math.max(0, texto_.indexOf('[')))) as Vivo[]
  const eu = await $.tool.call({ tool: 'mcp__ccd_session_mgmt__get_session', session_id: 'self' })
  if (eu.deny !== undefined || eu.isError) throw new Error(`get_session: ${eu.deny ?? eu.text ?? 'erro sem texto'}`)
  const proprio = JSON.parse(eu.text ?? '') as Vivo

  return [...vivas.filter(v => v.sessionId !== proprio.sessionId), proprio]
}

/**
 * Roda `painel pode-reiniciar` com a lista dada (que vai para `batida/sessoes-reinicio.json`) e deixa o resultado em
 * `batida/pode-reiniciar.json`. Sem o plugin orquestracao instalado não há comando: segue sem ele (a tela diz "não sei").
 */
async function conferirReinicio($: EngineInterface, vivas: Vivo[]): Promise<void> {
  const home = await $.env.get('HOME')
  if (!home) return
  const script = await caminhoDoPainel($, home)
  if (!script) {
    $.ui.log('reinício sem o plugin orquestracao')

    return
  }
  const lista = `${home}/${BASE_ORQUESTRACAO}/batida/${ARQUIVO_DA_LISTA}`
  await $.fs.write(lista, JSON.stringify(vivas))
  const r = await $.process.run(['node', script, 'pode-reiniciar', '--sessoes', lista, '--json'], { timeoutMs: SCRIPT_TIMEOUT_MS })
  if (r.exitCode !== 0) throw new Error(`painel pode-reiniciar saiu com ${r.exitCode}: ${r.stderr.slice(0, 200)}`)
}

async function gravarAviso($: EngineInterface, aviso: AvisoDeReinicio): Promise<void> {
  const pasta = `${await $.env.get('HOME')}/${BASE_ORQUESTRACAO}/batida`
  const arquivo = `${pasta}/${ARQUIVO_DO_AVISO}`
  const conteudo = `${JSON.stringify(aviso, null, 2)}\n`
  try {
    await $.fs.write(arquivo, conteudo)
  } catch (erroDaEscrita) {
    try {
      await $.process.run(['mkdir', '-p', pasta], { timeoutMs: SCRIPT_TIMEOUT_MS })
      await $.fs.write(arquivo, conteudo)
    } catch {
      throw erroDaEscrita
    }
  }
}

async function apagarAviso($: EngineInterface): Promise<void> {
  const arquivo = `${await $.env.get('HOME')}/${BASE_ORQUESTRACAO}/batida/${ARQUIVO_DO_AVISO}`
  const r = await $.process.run(['rm', '-f', arquivo], { timeoutMs: SCRIPT_TIMEOUT_MS })
  if (r.exitCode !== 0) throw new Error(`rm saiu com ${r.exitCode}: ${r.stderr.slice(0, 200)}`)
}

const falhouOAviso = async ($: EngineInterface, texto_: string) => {
  $.ui.toast(texto_)
  await avisar($, texto_).catch(() => {})
}

/**
 * `Me avise`: o bloco "Aviso ligado · conferindo" entra na hora, grava `aviso-de-reinicio.json` com esta sessão como vigia e
 * confere já. A recusa desfaz, com toast e a faixa "Ação não concluída" do pane.
 */
export async function ligarAviso($: EngineInterface): Promise<void> {
  if ((await read($, reiniciando)) !== null) return
  await update($, reiniciando, () => 'ligando')
  const antes = (await read($, reinicio)).aviso
  let ligou = false
  try {
    const vigia = await sessaoDoApp($)
    if (!vigia) throw new Error('sessão não identificada')
    const appInicio = await inicioDoApp($)
    const aviso: AvisoDeReinicio = { ligadoEm: new Date(await $.clock.now()).toISOString(), vigia, naoPodeSeguidos: 0, ...(appInicio ? { appInicio } : {}) }
    await update($, reinicio, r => ({ ...r, aviso }))
    await gravarAviso($, aviso)
    ligou = true
    $.ui.toast('Aviso ligado. A notificação chega quando der para reiniciar o app.')
  } catch (err) {
    await update($, reinicio, r => ({ ...r, aviso: antes }))
    await falhouOAviso($, `Não consegui ligar o aviso (${mensagem(err)}).`)
  } finally {
    await update($, reiniciando, () => null)
  }
  if (ligou) await vigiar($)
}

/** `Não avisar mais`: o bloco volta à linha na hora e o arquivo é apagado; a recusa traz o bloco de volta, com toast e faixa. */
export async function desligarAviso($: EngineInterface): Promise<void> {
  if ((await read($, reiniciando)) !== null) return
  await update($, reiniciando, () => 'desligando')
  const antes = (await read($, reinicio)).aviso
  try {
    await update($, reinicio, r => ({ ...r, aviso: null }))
    await apagarAviso($)
  } catch (err) {
    await update($, reinicio, r => ({ ...r, aviso: antes }))
    await falhouOAviso($, `Não consegui desligar o aviso (${mensagem(err)}).`)
  } finally {
    await update($, reiniciando, () => null)
  }
}

async function notificarReinicio($: EngineInterface, hhmm_: string): Promise<void> {
  const aviso = `Pode reiniciar o app. Nenhuma sessão trabalhando, nenhum teste nem merge rodando (${hhmm_}).`
  try {
    const r = await $.tool.call({ tool: 'PushNotification', message: aviso, status: 'proactive' })
    if (r.deny !== undefined || r.isError) $.ui.toast(aviso)
  } catch {
    $.ui.toast(aviso)
  }
}

/**
 * A vigia, a cada minuto, em toda sessão (só age quem é a vigia do aviso ligado; se a vigia sumiu há mais de 3 min, a próxima
 * sessão que passa por aqui assume): confere com a lista fresca, notifica UMA vez quando passa a poder, rearma depois de dois
 * "não pode" seguidos e desliga o aviso 30 min depois do aviso. Nunca lança.
 */
async function vigiar($: EngineInterface): Promise<void> {
  if (vigiando) return
  vigiando = true
  try {
    const pasta = `${await $.env.get('HOME')}/${BASE_ORQUESTRACAO}/batida`
    let aviso = await lerArquivoDaBatida($, pasta, ARQUIVO_DO_AVISO, validoAviso, [])
    if (aviso === null) return
    const eu = await sessaoDoApp($)
    if (!eu) return
    const agora = await $.clock.now()
    if (aviso.vigia !== eu) {
      if (!vigiaSumiu({ aviso, agora })) return
      await gravarAviso($, { ...aviso, vigia: eu, vigiaEm: new Date(agora).toISOString() })
      aviso = await lerArquivoDaBatida($, pasta, ARQUIVO_DO_AVISO, validoAviso, [])
      if (aviso?.vigia !== eu) return
    }
    await conferirReinicio($, await listaFresca($))
    const lido = await lerReinicio($)
    // quem desligou o aviso no meio da conferência vence
    if (lido.aviso === null) return
    const estado = estadoDoReinicio({ arquivo: lido.arquivo, aviso: lido.aviso, eu, trabalhandoEu: trabalhandoNaBarra, agora: await $.clock.now() })
    const passo = proximoDaVigia({ aviso: lido.aviso, estado: estado.estado, agora: await $.clock.now() })
    if (passo.aviso === null) {
      await apagarAviso($)
      await update($, reinicio, r => ({ ...r, aviso: null }))
    } else {
      // a conferência da vigia fica marcada no aviso (`vigiaEm`), junto com o boot do app em que ele nasceu (`appInicio`)
      const appInicio = passo.aviso.appInicio ?? (await inicioDoApp($)) ?? undefined
      const gravar: AvisoDeReinicio = { ...passo.aviso, vigiaEm: new Date(await $.clock.now()).toISOString(), ...(appInicio ? { appInicio } : {}) }
      await gravarAviso($, gravar)
      await update($, reinicio, r => ({ ...r, aviso: gravar }))
    }
    if (passo.notificar) await notificarReinicio($, hhmm(await $.clock.now()))
  } catch (err) {
    $.ui.log(`vigia do reinício: ${mensagem(err)}`)
  } finally {
    vigiando = false
  }
}

/**
 * O instante de início do processo principal do app (`ps -axo pid=,lstart=,command=`, linha cujo comando termina em
 * `Claude.app/Contents/MacOS/Claude`; `LC_ALL=C` porque o `lstart` segue o idioma do sistema): só um reinício do app o muda; sessão nova e `clear_session` não. `null` = não medi.
 */
async function inicioDoApp($: EngineInterface): Promise<string | null> {
  try {
    const r = await $.process.run(['ps', '-axo', 'pid=,lstart=,command='], { timeoutMs: SCRIPT_TIMEOUT_MS, env: { LC_ALL: 'C' } })
    if (r.exitCode !== 0) return null
    for (const linha of r.stdout.split('\n')) {
      const m = /^\s*\d+\s+(\w{3}\s+\w{3}\s+\d+\s+[\d:]+\s+\d{4})\s+(.+?)\s*$/.exec(linha)
      if (m?.[2]?.endsWith('Claude.app/Contents/MacOS/Claude')) return m[1].replace(/\s+/g, ' ')
    }
  } catch {
    // sem medida o aviso fica (o desligamento de 30 min cobre)
  }

  return null
}

/** Ao carregar o mod: aviso já dado (`avisadoEm`) só é apagado se o app reiniciou: o início do processo dele mudou desde que o aviso nasceu. */
async function limparAvisoVelho($: EngineInterface): Promise<void> {
  const pasta = `${await $.env.get('HOME')}/${BASE_ORQUESTRACAO}/batida`
  const aviso = await lerArquivoDaBatida($, pasta, ARQUIVO_DO_AVISO, validoAviso, [])
  if (!aviso?.avisadoEm || !aviso.appInicio) return
  const agoraDoApp = await inicioDoApp($)
  if (agoraDoApp !== null && agoraDoApp !== aviso.appInicio) await apagarAviso($)
}
// A batida (ADR 0007): de 10 em 10 min, UMA das sessões vivas roda `painel batida` (o julgamento é do script) e leva as
// mensagens que ele devolveu às sessões certas. Sem modelo e sem turno: só `$.process.run` e `send_message`.
// A vez mora em arquivo (`batida/vez.json`): cada sessão tem o próprio relógio, e a que grava a vez e se relê dona dela roda.

const BATIDA_TIQUE_MS = 60_000
const BATIDA_MIN_PADRAO = 10
const ESPERA_DA_VEZ_MS = 2000
const SCRIPT_TIMEOUT_MS = 60_000
const BASE_DA_BATIDA = '.claude/orquestracao'

type Mensagem = { para: string; texto: string; item: string | null; tipo: string }
type Vez = { localId: string; em: number }

const inteiroPositivo = (v: string | undefined, padrao: number) => (v !== undefined && /^[1-9]\d*$/.test(v) ? Number(v) : padrao)

async function lerJson<T>($: EngineInterface, caminho: string): Promise<T | null> {
  try {
    return JSON.parse((await $.fs.read(caminho)) as string) as T
  } catch {
    return null
  }
}

/** O `installPath` do plugin orquestracao (escopo user) em installed_plugins.json. */
async function caminhoDoPainel($: EngineInterface, home: string): Promise<string | null> {
  const reg = await lerJson<{ plugins?: Record<string, Array<{ scope?: string; installPath?: string }>> }>($, `${home}/.claude/plugins/installed_plugins.json`)
  const chave = Object.keys(reg?.plugins ?? {}).find(k => k.startsWith('orquestracao@'))
  const entrada = chave ? reg?.plugins?.[chave]?.find(e => e.scope === 'user' && typeof e.installPath === 'string') : undefined

  return entrada?.installPath ? `${entrada.installPath}/skills/orquestradora/scripts/painel.mjs` : null
}

async function registrarFalha($: EngineInterface, pasta: string, agora: number, m: Mensagem, motivo: string): Promise<void> {
  $.ui.log(`batida: a mensagem para ${m.para} não chegou (${motivo})`)
  try {
    const arquivo = `${pasta}/falhas.jsonl`
    const antes = (await $.fs.read(arquivo).catch(() => '')) as string
    await $.fs.write(arquivo, `${antes}${JSON.stringify({ em: new Date(agora).toISOString(), para: m.para, item: m.item, motivo })}\n`)
  } catch {
    /* sem o registro, o log acima já disse */
  }
}

async function rodar($: EngineInterface): Promise<void> {
  if ((await $.env.get('BATIDA')) === 'off') return
  const home = await $.env.get('HOME')
  if (!home) return
  const minutos = inteiroPositivo(await $.env.get('BATIDA_MIN'), BATIDA_MIN_PADRAO)
  const pasta = `${home}/${BASE_DA_BATIDA}/batida`
  const arquivoDaVez = `${pasta}/vez.json`
  const agora = await $.clock.now()
  const vez = await lerJson<Vez>($, arquivoDaVez)
  if (vez && typeof vez.em === 'number' && agora - vez.em < minutos * 60_000) return

  const eu = await $.tool.call({ tool: 'mcp__ccd_session_mgmt__get_session', session_id: 'self' })
  if (eu.deny !== undefined || eu.isError) throw new Error(`get_session: ${eu.deny ?? eu.text ?? 'erro sem texto'}`)
  const proprio = JSON.parse(eu.text ?? '') as Vivo
  await $.fs.write(arquivoDaVez, `${JSON.stringify({ localId: proprio.sessionId, em: agora })}\n`)
  await $.clock.sleep(ESPERA_DA_VEZ_MS)
  if ((await lerJson<Vez>($, arquivoDaVez))?.localId !== proprio.sessionId) return

  const lista = await $.tool.call({ tool: 'mcp__ccd_session_mgmt__list_sessions', linked: false, include_archived: false, limit: 200 })
  if (lista.deny !== undefined || lista.isError) throw new Error(`list_sessions: ${lista.deny ?? lista.text ?? 'erro sem texto'}`)
  const texto = lista.text ?? ''
  const vivas = (JSON.parse(texto.slice(Math.max(0, texto.indexOf('[')))) as Vivo[]).filter(v => v.sessionId !== proprio.sessionId)
  // o list_sessions não traz a própria sessão: sem ela, a batida a acharia "sumida" e soltaria o item dela
  const arquivoDasSessoes = `${pasta}/sessoes.json`
  await $.fs.write(arquivoDasSessoes, JSON.stringify([...vivas, proprio]))

  const script = await caminhoDoPainel($, home)
  if (!script) {
    $.ui.log('batida sem o plugin orquestracao')
    return
  }
  const r = await $.process.run(['node', script, 'batida', '--sessoes', arquivoDasSessoes], { timeoutMs: SCRIPT_TIMEOUT_MS })
  if (r.exitCode !== 0) throw new Error(`painel batida saiu com ${r.exitCode}: ${r.stderr.slice(0, 200)}`)
  const saida = JSON.parse(r.stdout) as { mensagens?: Mensagem[] }
  for (const m of saida.mensagens ?? []) {
    // a batida pode rodar na própria orquestradora: o app recusa send_message para a sessão atual, então entra como prompt dela
    if (m.para === proprio.sessionId) {
      void $.prompt.submit({ text: m.texto }).then(
        r => (r.drop !== undefined ? registrarFalha($, pasta, agora, m, r.drop || 'o prompt foi recusado') : undefined),
        err => registrarFalha($, pasta, agora, m, mensagem(err)),
      ).catch(() => {})
      continue
    }
    try {
      const envio = await $.tool.call({ tool: 'mcp__ccd_session_mgmt__send_message', session_id: m.para, message: m.texto })
      if (envio.deny !== undefined) await registrarFalha($, pasta, agora, m, envio.deny)
      else if (envio.isError) await registrarFalha($, pasta, agora, m, envio.text ?? 'erro sem texto')
    } catch (err) {
      await registrarFalha($, pasta, agora, m, mensagem(err))
    }
  }
}

/** Um tique do relógio de 1 min: nunca lança (o relógio do mod não pode cair por causa da batida). */
async function batida($: EngineInterface): Promise<void> {
  try {
    await rodar($)
  } catch (err) {
    $.ui.log(`batida: ${mensagem(err)}`)
  }
}

/** Do `session.start` do mod (o motor só aceita um por plugin): o comando, os dois relógios e a primeira leitura. */
async function iniciarBarra($: EngineInterface): Promise<void> {
  await $.command.register({ name: 'barra', description: 'Mostra ou esconde a barra de status do kit' })
  timerRelogio?.cancel()
  timerLeitura?.cancel()
  timerBatida?.cancel()
  timerRelogio = $.clock.every(1000, () => void tiqueDoCache($).catch(() => {}))
  timerLeitura = $.clock.every(LEITURA_MS, () => void lerBarra($))
  timerBatida = $.clock.every(BATIDA_TIQUE_MS, () => void batida($))
  timerVigia?.cancel()
  timerVigia = $.clock.every(VIGIA_MS, () => void vigiar($))
  await limparAvisoVelho($).catch(err => void $.ui.log(`reinício: ${mensagem(err)}`))
  await lerBarra($)
}

function registrarBarra(on: On): void {
  on('command.run', { command: 'barra' }, async $ => {
    const escondida = !(await read($, barraEscondida))
    await update($, barraEscondida, () => escondida)

    return { text: escondida ? 'Barra de status escondida.' : 'Barra de status à mostra.' }
  })

  on('turn.start', async ($, e, next) => {
    if (!(e as { agentId?: string }).agentId) trabalhandoNaBarra = true

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if ((e as { agentId?: string }).agentId) return r
    trabalhandoNaBarra = false
    const agora = await $.clock.now()
    await update($, barra, b => ({ ...b, cache: { expiraEm: agora + CACHE_TTL_MS, segundos: Math.ceil(CACHE_TTL_MS / 1000) }, avisado: 0 }))
    void lerBarra($)

    return r
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const b = await read($, barra)
    if (e.props.hasSurvey || (await read($, barraEscondida))) return next(e)
    const l = await read($, leitura)
    const trocando = await read($, trocandoModo)
    const elementos = $.ui.resolve(e)
    const painelAberto = deveFechar(await $.ui.panes())
    const modo = l.ausente === undefined || l.ausente === null ? null : l.ausente.ligado ? 'ausente' : 'presente'
    // O reinício só fala com o aviso ligado (o "pode" permanente seria ruído o dia inteiro); a própria sessão entra ao vivo.
    const rn = await read($, reinicio)
    const doReinicio = rn.aviso ? estadoDoReinicio({ arquivo: rn.arquivo, aviso: rn.aviso, eu: await sessaoDoApp($), trabalhandoEu: e.props.isWorking || trabalhandoNaBarra, agora: await $.clock.now(), erro: rn.falhou }) : null

    return desenharBarra(
      elementos,
      {
        b,
        modo,
        trocando,
        limpando: (await read($, limpando)) !== null,
        painelAberto,
        isWorking: e.props.isWorking,
        bodyColumns: e.props.bodyColumns,
        reinicio: doReinicio,
        item: b.item ? `${b.item.id} · ${ROTULO_ETAPA_TERMINAL[b.item.etapa] ?? b.item.etapa}` : null,
      },
      {
        abrirPainel: () => void abrirPainel($),
        alternarPainel: () => void alternarPainel($),
        alternarModo: () => void alternarModo($),
        limpar: () => void limparPelaBarra($),
      },
    )
  })
}

/** O `/painel` e o botão da barra: abre o pane, ou fecha o que a pessoa vê. */
export async function alternarPainel($: EngineInterface): Promise<{ text: string }> {
  if (deveFechar(await $.ui.panes())) {
    await $.ui.close({ id: PANE })
    parar()
    await mudarMarca($, (m, id) => desmarcar(m, id))

    return { text: 'Painel das sessões fechado.' }
  }
  const r = await $.ui.open({ id: PANE, title: TITULO, columns: 60 })
  ligar($)
  await mudarMarca($, marcar)

  return {
    text: r.isPlaced ? 'Painel das sessões aberto.' : `Painel aberto, mas sem lugar agora: ${r.reason}`,
  }
}

/** O selo da barra: abre o painel e, se ele já está à vista, não faz nada (o botão do painel é que fecha). */
export async function abrirPainel($: EngineInterface): Promise<void> {
  if (!deveFechar(await $.ui.panes())) await alternarPainel($)
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
    else await reabrir($)
    await iniciarBarra($)

    return r
  })

  on('command.run', { command: 'painel' }, $ => alternarPainel($))

  registrarBarra(on)

  on('ui.close', async ($, e, next) => {
    if (e.id === PANE) {
      parar()
      if (fechamentoDesmarca(e.origin.kind)) await mudarMarca($, (m, id) => desmarcar(m, id))
    }

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
        const dizer = (i: LinhaItem) => `${i.titulo} · ${i.etapa}${i.trava ? ` · trava (${i.trava.motivo})` : ''}${i.espera ? ` · espera (${i.espera.motivo})` : ''}${i.esperando ? ` · ${textoEsperando(i.esperando, Date.now())}` : ''}${(i.com ?? []).length > 0 ? ` · com ${(i.com ?? []).map(c => c.titulo ?? c.apelido).join(', ')}` : ''}`

        return { esperam: sec.esperam.map(dizer), travados: sec.travados.map(dizer), executando: sec.executando.map(dizer), fila: sec.fila.map(dizer), feitos: sec.feitos.map(dizer) }
      })(),
    }
    const texto = JSON.stringify({ aberto, panes: await $.ui.panes(), desenhos, lido }, null, 2)

    return { result: texto, text: texto }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const elementos = $.ui.resolve(e)
    const { Box, Text, Button } = elementos
    const enviandoAgora = await read($, enviando)
    const abrindoAgora = normalizarAbrindo(await read($, abrindo))
    await read($, tique)
    const trocando = await read($, trocandoModo)
    const doBarra = await read($, barra)
    // "Abrir P2": pede ao app que ponha a sessão em foco; o que ele recusar, o botão devolve como endereço copiado.
    // O `Button` não tem `disabled`: enquanto abre, o rótulo vira "Abrindo…" e o clique é ignorado.
    // O rótulo "Abrindo…" acende só no botão pressionado (`botao`); o clique repetido é ignorado em qualquer botão da mesma sessão.
    const abrir = (itemId: string, dono: NonNullable<LinhaItem['dono']>) => {
      const botao = `abrir:${itemId}:${dono.localId}`

      return (
        <Button
          key={botao}
          variant="secondary"
          onPress={() => {
            if (abrindoAgora?.localId !== dono.localId) void abrirSessao($, dono, e.surface, botao)
          }}
        >
          {abrindoAgora?.botao === botao ? 'Abrindo…' : `Abrir ${dono.apelido}`}
        </Button>
      )
    }
    // Um botão por sessão viva do item: as de `com` e o dono, sem repetir quem está nas duas listas; no máximo 3.
    const botoesAbrir = (i: LinhaItem) => {
      if (i.situacao === 'feito') return []
      const vistos = new Set<string>()
      const quem = [...(i.com ?? []).map(c => ({ apelido: c.apelido, localId: c.localId, link: c.link, titulo: c.titulo, dona: c.dona })), ...(i.dono ? [i.dono] : [])]

      return quem.flatMap(q => (q.link && !vistos.has(q.localId) ? (vistos.add(q.localId), [abrir(i.id, q)]) : [])).slice(0, 3)
    }
    // F69: pedir a sessão que falta. O estado vive no átomo `pedindo`; o destino vem das orquestradoras lidas e das sessões vivas.
    const pedindoAgora = await read($, pedindo)
    const agoraDoPedido = await $.clock.now()
    const lidaAgora = await read($, leitura)
    const idsVivos = lidaAgora.semLista ? null : (lidaAgora.sessoes ?? []).map(v => v.sessionId)
    const destinoDo = (projeto: string): Destino => orquestradoraDoProjeto(projeto, lidaAgora.orquestradoras ?? [], idsVivos)
    const estadoVivo = (id: string): EstadoPedido | undefined => {
      const e = pedindoAgora[id]

      return e && vivoDoEstado(e, agoraDoPedido) ? e : undefined
    }
    const pedidoDe = (i: LinhaItem) => {
      const papel = papelQueFalta(i)
      if (!papel || !i.projeto) return undefined

      return { papel, projeto: i.projeto, destino: destinoDo(i.projeto), estado: estadoVivo(i.id) }
    }
    const textoDoAviso = (projeto: string, d: Destino, n?: number): string =>
      'semLista' in d
        ? 'Sem a lista de sessões do app · os botões de pedir voltam na próxima leitura'
        : 'varias' in d
          ? `${d.varias} orquestradoras ativas em ${projeto} · peça na conversa da certa`
          : `Sem orquestradora ativa em ${projeto}${n === undefined ? '' : `\u00a0·\u00a0${n}\u00a0${n === 1 ? 'item' : 'itens'}`} · abra uma orquestradora para pedir`
    const botaoOrquestradora = (key: string, projeto: string, id: string) => (
      <Button
        key={key}
        variant="secondary"
        onPress={() => {
          if (abrindoAgora?.localId !== id) void abrirSessao($, { apelido: `orquestradora de ${projeto}`, localId: id, link: linkDe(id, []) }, e.surface, key)
        }}
      >
        {abrindoAgora?.botao === key || abrindoAgora?.botao === `auto:${id}` ? 'Abrindo…' : 'Abrir a orquestradora'}
      </Button>
    )
    // O que o item pede, em três peças: a linha de estado (acima), o botão e, no cartão, o botão da orquestradora. `curta`: na linha da fila.
    const acaoDoPedido = (i: LinhaItem, naFila: boolean) => {
      const p = pedidoDe(i)
      if (!p) return {}
      if (!('id' in p.destino)) {
        // Na fila o aviso mora no topo da seção; o cartão não o vê, então leva a própria linha.
        return naFila ? {} : { linha: { t: textoDoAviso(p.projeto, p.destino), cor: undefined as 'warning' | undefined } }
      }
      const enviando = p.estado?.estado === 'enviando'
      const botao = p.estado?.estado === 'pedido' ? undefined : (
        <Button
          key={`pedir:${i.id}`}
          variant="secondary"
          onPress={() => {
            if (!enviando) void pedirSessoes($, [i.id], i.id, e.surface)
          }}
        >
          {enviando ? 'Pedindo…' : 'Pedir dona'}
        </Button>
      )
      const linha =
        p.estado?.estado === 'prompt'
          ? { t: `No prompt às ${hhmm(p.estado.em)} · aperte Enter`, cor: 'warning' as 'warning' | undefined }
          : p.estado?.estado === 'pedido'
            ? { t: naFila ? `Pedido às ${hhmm(p.estado.em)} · inicie o cartão` : `Pedido às ${hhmm(p.estado.em)} · inicie o cartão na conversa da orquestradora`, cor: (naFila ? undefined : 'warning') as 'warning' | undefined }
            : undefined

      return { linha, botao, orq: p.estado?.estado === 'pedido' && !naFila ? botaoOrquestradora(`orq:${i.id}`, p.projeto, p.destino.id) : undefined }
    }
    // O topo da Na fila: "Pedir n sessões" e os avisos de projeto (os cartões esperando o clique moram em "Sessões para abrir").
    const topoDaFila = (naFila: LinhaItem[]) => {
      const podem = naFila.filter(i => {
        const p = pedidoDe(i)

        return p !== undefined && 'id' in p.destino && p.estado === undefined
      })
      const loteEnviando = pedindoAgora.lote?.estado === 'enviando'
      const lote =
        podem.length >= 2 || loteEnviando ? (
          <Button
            key="pedir:lote"
            variant="secondary"
            onPress={() => {
              if (!loteEnviando) void pedirSessoes($, podem.map(i => i.id), 'lote', e.surface)
            }}
          >
            {loteEnviando ? 'Pedindo…' : `Pedir ${podem.length} sessões`}
          </Button>
        ) : undefined
      const avisosDeProjeto: string[] = []
      const contados = new Map<string, { d: Destino; n: number }>()
      for (const i of naFila) {
        const p = pedidoDe(i)
        if (p && !('id' in p.destino)) contados.set(p.projeto, { d: p.destino, n: (contados.get(p.projeto)?.n ?? 0) + 1 })
      }
      if ([...contados.values()].some(c => 'semLista' in c.d)) avisosDeProjeto.push(textoDoAviso('', { semLista: true }))
      else for (const [projeto, c] of contados) avisosDeProjeto.push(textoDoAviso(projeto, c.d, c.n))

      return { lote, avisosDeProjeto }
    }
    // O topo inteiro numa coluna recuada como a linha da fila.
    const desenharTopo = (t: ReturnType<typeof topoDaFila>, paddingLeft: number, paddingBottom?: number) =>
      t.lote === undefined && t.avisosDeProjeto.length === 0 ? null : (
        <Box flexDirection="column" gap={1} paddingLeft={paddingLeft} paddingBottom={paddingBottom}>
          {t.lote && (
            <Box flexDirection="row" alignItems="center">
              {t.lote}
            </Box>
          )}
          {t.avisosDeProjeto.map(a => <Text key={`aviso:${a}`} dimColor wrap="wrap">{a}</Text>)}
        </Box>
      )
    // Campo de texto só onde a superfície tem um; sem ele, a opção "outra" fica sem campo.
    const Input = 'Input' in elementos ? elementos.Input : undefined
    const agora = await $.clock.now()
    desenhos[e.surface] = { placement: e.props.placement, bodyColumns: e.props.bodyColumns, em: hora(agora) }
    const l = await read($, leitura)
    // O estado da sessão sobrevive ao reload: o de antes desta versão não tem `avisos`, `sessoes` nem `semLista`.
    const avisos = l.avisos ?? []
    const sec = secoes(l.itens, l.temas)
    const contagem = contarSecoes(l.itens, l.perguntas)
    // Quatro seções, cada item contado uma vez: o contador, a pílula e a lista leem das mesmas quatro contas.
    const resumo = [
      { n: contagem.esperam, rotulo: 'Esperam você', cor: 'warning' },
      { n: contagem.travados, rotulo: 'Travados', cor: 'error' },
      { n: contagem.executando, rotulo: 'Executando', cor: 'suggestion' },
      { n: contagem.fila, rotulo: 'Na fila', cor: 'suggestion', classe: 't' },
    ]
    const resumo4 = resumo.map(r => ({ ...r, cor: COR_RESUMO[r.cor] ?? 'm' }))
    const lido = l.lidoEm !== null
    const parada = leituraParada(l.lidoEm, agora)
    const situacao = (localId: string) => situacaoDe(localId, l.sessoes ?? [], undefined, l.semLista ?? false, agora)
    const trabalhando = sec.executando.filter(i => pessoasVivas(i).some(p => situacao(p.localId) === 'trabalhando agora')).length

    const aberta = await read($, respondendoEm)
    const verVelhas = await read($, verAnteriores)
    const verAss = await read($, verAssumidas)
    const assumidas = l.assumidas ?? []
    const verFeitosAgora = await read($, verFeitos)
    const verTodosAgora = await read($, verTodos)
    const filtro = await read($, filtroTodos)
    const limpezasAgora = await read($, limpezas)
    // O índice de todos os itens; o estado de antes desta versão não o tem, e os itens da leitura de 24 h valem no lugar dele.
    const indice: ItemDoIndice[] = l.indice ?? l.itens.map(i => ({ id: i.id, titulo: i.titulo, tema: i.tema, temaProjeto: i.temaProjeto, temaRotulo: i.temaRotulo, etapa: i.etapa }))
    const mapa = new Map(indice.map(i => [i.id, i]))
    const ligadosDe = (i: LinhaItem) => i.depois.flatMap(d => (d.item ? [d.item] : []))
    // Só os campos que o bloco desenha, lidos inteiros: o desenho pode cortá-los.
    const citadosDoCartao = (i: LinhaItem) => citadosDe([i.titulo, i.trava?.texto ?? '', i.situacao !== 'travado' ? (i.espera?.texto ?? '') : '', i.agora ?? '', ...i.depois.map(d => d.texto)], ligadosDe(i), i.id, mapa)
    const citadosDaFila = (i: LinhaItem) => citadosDe([i.titulo, i.resumo ?? ''], ligadosDe(i), i.id, mapa)
    const citadosDaPergunta = (q: PerguntaAberta) => citadosDe([q.titulo, q.caso ?? '', q.seNaoDecidir ?? '', q.recomendacao ?? ''], [], q.item ?? '', mapa)
    const achados = filtrarIndice(indice, filtro)
    const comProjeto = new Set(indice.flatMap(i => (i.projeto ? [i.projeto] : []))).size > 1
    // "Sessões para abrir": os cartões que a orquestradora propôs e ainda esperam o clique, agrupados por orquestradora (o mais antigo primeiro).
    // A seção só nasce depois da 1ª leitura; sem a lista de sessões não se sabe qual orquestradora está aberta, e o botão fica.
    const idsDaLista = l.semLista ? null : new Set((l.sessoes ?? []).map(v => v.sessionId))
    const gruposDeCartoes = !lido
      ? []
      : [
          ...cartoesVisiveis(l.cartoes ?? [], l.sessoes, l.semLista ?? false, agora).reduce((por, c) => por.set(c.orquestradoraId, [...(por.get(c.orquestradoraId) ?? []), c]), new Map<string, CartaoDeSessao[]>()),
        ].map(([orqId, cs]) => {
          const viva = idsDaLista === null || idsDaLista.has(orqId)
          const projeto = cs[0]!.projeto

          return {
            orqId,
            projeto,
            viva,
            frase: viva ? `${cs.length === 1 ? 'O cartão está' : 'Os cartões estão'} na conversa da orquestradora de ${projeto}` : 'A orquestradora destes cartões não está aberta',
            linhas: cs.map(c => ({ id: c.id, papel: c.papel, apelido: c.apelido, propostoEm: c.propostoEm, itens: c.itens.map(id => ({ id, titulo: mapa.get(id)?.titulo })) })),
          }
        })
    const totalDeCartoes = gruposDeCartoes.reduce((n, g) => n + g.linhas.length, 0)

    // Os botões de uma pergunta: as opções dela (Q67) ou Sim/Não/Adiar/Responder, que vão à sessão que perguntou.
    // Só o botão pressionado vira "Enviando…"; enquanto a resposta da pergunta está em curso, os irmãos ignoram o clique.
    const acoes = (q: PerguntaAberta) => {
      const proprias = q.opcoes.filter(o => o.id !== 'outra')
      const comCampo = q.opcoes.length === 0 || q.opcoes.some(o => o.id === 'outra')
      const emCurso = enviandoAgora?.q === q.id
      const botao = (id: string, label: string, resposta: string, k: number) => (
        <Button
          key={`${q.id}:${id}`}
          variant={k === 0 ? 'primary' : 'secondary'}
          onPress={() => {
            if (!emCurso) void responder($, q, resposta, id)
          }}
        >
          {emCurso && enviandoAgora?.opcao === id ? 'Enviando…' : label}
        </Button>
      )

      return (
        <Box flexDirection="column" gap={1}>
          <Box flexDirection="row" flexWrap="wrap" columnGap={1} alignItems="center">
            {proprias.length > 0 ? proprias.map((o, k) => botao(o.id, o.label, o.id, k)) : RAPIDAS.map((r, k) => botao(r.id, r.label, r.resposta, k))}
            {Input && comCampo && (
              <Button
                key={`${q.id}:responder`}
                variant="secondary"
                onPress={() => void update($, respondendoEm, atual => (atual === q.id ? null : q.id))}
              >
                {aberta === q.id ? 'Fechar' : 'Responder…'}
              </Button>
            )}
          </Box>
          {Input && comCampo && aberta === q.id && (
            <Input
              key={`${q.id}:outra`}
              placeholder={q.propria ? 'sua resposta, vai para esta sessão…' : 'sua resposta, vai direto para a sessão…'}
              submitLabel={emCurso && enviandoAgora?.opcao === 'outra' ? 'Enviando…' : 'Enviar'}
              onSubmit={(valor: string) => {
                if (!emCurso) void responder($, q, valor, 'outra')
              }}
            />
          )}
        </Box>
      )
    }

    // As ações da decisão assumida: Confirmar só grava (a sessão já agiu assim, não se acorda ninguém); Mudar… grava e entrega o texto novo.
    const acoesAssumida = (q: PerguntaAberta) => {
      const emCurso = enviandoAgora?.q === q.id

      return (
        <Box flexDirection="column" gap={1}>
          <Box flexDirection="row" flexWrap="wrap" columnGap={1} alignItems="center">
            <Button
              key={`${q.id}:confirmar`}
              variant="primary"
              onPress={() => {
                if (!emCurso) void responder($, q, 'confirmada pelo operador (painel)', 'confirmar', { esperado: 'assumida', entrega: false, toast: `${q.id} confirmada` })
              }}
            >
              {emCurso && enviandoAgora?.opcao === 'confirmar' ? 'Enviando…' : 'Confirmar'}
            </Button>
            {Input && (
              <Button key={`${q.id}:mudar`} variant="secondary" onPress={() => void update($, respondendoEm, atual => (atual === q.id ? null : q.id))}>
                {aberta === q.id ? 'Fechar' : 'Mudar…'}
              </Button>
            )}
          </Box>
          {Input && aberta === q.id && (
            <Input
              key={`${q.id}:outra`}
              placeholder="o que fazer no lugar, vai direto para a sessão…"
              submitLabel={emCurso && enviandoAgora?.opcao === 'outra' ? 'Enviando…' : 'Enviar'}
              onSubmit={(valor: string) => {
                if (!emCurso) void responder($, q, valor, 'outra', { esperado: 'assumida', texto: textoDaMudanca(q, valor.trim()) })
              }}
            />
          )}
        </Box>
      )
    }

    // O reinício do app: a linha discreta (sem aviso) ou o bloco emoldurado (com aviso); nada antes da 1ª leitura.
    const rn = await read($, reinicio)
    const gravandoAviso = await read($, reiniciando)
    const doReinicio = estadoDoReinicio({ arquivo: rn.arquivo, aviso: rn.aviso, eu: await sessaoDoApp($), trabalhandoEu: trabalhandoNaBarra, agora, erro: rn.falhou })
    const botaoDoAviso = rn.aviso ? (
      <Button
        key="reinicio"
        variant="secondary"
        onPress={() => {
          if (gravandoAviso === null) void desligarAviso($)
        }}
      >
        {gravandoAviso === 'ligando' ? 'Ligando…' : 'Não avisar mais'}
      </Button>
    ) : doReinicio.estado !== 'pode' || gravandoAviso === 'desligando' ? (
      <Button
        key="reinicio"
        variant="secondary"
        onPress={() => {
          if (gravandoAviso === null) void ligarAviso($)
        }}
      >
        {gravandoAviso === 'desligando' ? 'Desligando…' : 'Me avise'}
      </Button>
    ) : null
    const dadosDoReinicio = { ...doReinicio, aviso: rn.aviso ? { avisadoEm: rn.aviso.avisadoEm } : null }
    // O modo da leitura: `undefined` é antes da 1ª leitura; `null`, o arquivo que não se leu; senão a bandeira.
    const modo: 'lendo' | 'presente' | 'ausente' | 'desconhecido' = l.ausente === undefined ? 'lendo' : l.ausente === null ? 'desconhecido' : l.ausente.ligado ? 'ausente' : 'presente'
    // O botão do modo fica no canto esquerdo da fileira e o rótulo é o gesto; sem ler o modo não há botão (gravar por cima esconderia o problema).
    // `trocando`: o modo na tela já é o novo (otimista), o rótulo diz que grava e o clique é ignorado.
    const botaoModo =
      modo === 'presente' || modo === 'ausente' ? (
        <Button
          key="modo"
          variant="secondary"
          onPress={() => {
            if (!trocando) void alternarModo($)
          }}
        >
          {trocando ? (modo === 'ausente' ? 'Ligando…' : 'Desligando…') : modo === 'ausente' ? 'Estou de volta' : 'Ficar ausente'}
        </Button>
      ) : null
    const botaoAtualizar = (rotulo: string, key: string, extra: { autoFocus?: boolean } = {}) => (
      <Button
        key={key}
        variant="secondary"
        {...(extra.autoFocus ? { autoFocus: true } : {})}
        onPress={() => {
          // Leitura que parou de renovar não trava o botão: ele solta a pendurada e lê de novo.
          if (!l.lendo || parada) void atualizar($, true)
        }}
      >
        {l.lendo && !parada ? 'Lendo…' : rotulo}
      </Button>
    )
    const limparAvisos =
      avisos.length > 0 ? (
        <Button key="avisos:limpar" variant="secondary" onPress={() => void update($, leitura, v => ({ ...v, avisos: [] }))}>
          Limpar avisos
        </Button>
      ) : null

    const botaoAnteriores =
      l.anteriores.length > 0 ? (
        <Button key="anteriores" variant="secondary" onPress={() => void update($, verAnteriores, v => !v)}>
          {`${verVelhas ? '▾' : '▸'} Perguntas respondidas · ${l.anteriores.length}`}
        </Button>
      ) : null

    const botaoAssumidas =
      assumidas.length > 0 ? (
        <Button key="assumidas" variant="secondary" onPress={() => void update($, verAssumidas, v => !v)}>
          {`${verAss ? '▾' : '▸'} Decisões assumidas · ${assumidas.length}`}
        </Button>
      ) : null

    const botaoTodos =
      indice.length > 0 ? (
        <Button key="todos" variant="secondary" onPress={() => void update($, verTodos, v => !v)}>
          {`${verTodosAgora ? '▾' : '▸'} Todos os itens · ${indice.length}`}
        </Button>
      ) : null

    const limparFiltro = () => {
      void update($, filtroTodos, () => '')
      void update($, limpezas, n => n + 1)
    }
    const campoAchar = Input ? (
      <Box key="achar" flexDirection="row" columnGap={1} alignItems="center" flexWrap="wrap">
        <Input key={`achar:${limpezasAgora}`} placeholder="número (13 ou F13) ou palavra" submitLabel="Achar" onSubmit={(v: string) => void update($, filtroTodos, () => v.trim())} />
        {filtro && (
          <Button key="achar:limpar" variant="secondary" onPress={limparFiltro}>
            Limpar
          </Button>
        )}
      </Box>
    ) : null
    const resultadoDoFiltro = filtro ? <Text dimColor>{`${achados.length} de ${indice.length} · “${filtro}”`}</Text> : null
    const nenhum = <Text>{`Nenhum item com “${filtro}”.`}</Text>

    const botaoFeitos =
      sec.feitos.length > 0 ? (
        <Button key="feitos" variant="secondary" onPress={() => void update($, verFeitos, v => !v)}>
          {`${verFeitosAgora ? '▾' : '▸'} Feitos hoje · ${sec.feitos.length}`}
        </Button>
      ) : null

    if (e.surface === 'desktop' && 'Svg' in elementos) {
      const { Svg } = elementos
      // A coluna do desktop mede ~8,8 px (66 colunas = 586 px); 8,75 enche o pane sem passar dele.
      const W = Math.max(240, Math.min(900, Math.floor((e.props.bodyColumns || 40) * COLUNA_PX)))
      // Dentro do `Box round` a borda e o respiro comem 4 colunas: o desenho do cartão leva essa largura.
      const Wc = Math.max(200, W - Math.ceil(4 * COLUNA_PX))
      const cartaoResumo = resumoSvg(W, resumo4)
      const faixa = (f: { titulo: string; n: number; tom: string; legenda?: string; tracejado?: boolean }) => {
        const r = secaoSvg(W, f)

        return <Svg key={`secao:${f.titulo}`} source={r.source} alt={r.alt} width={W} height={r.height} />
      }
      // A moldura é do `Box round`, na cor do tom; o desenho e os botões ficam dentro dela.
      const cartao = (i: LinhaItem, tom: 'subtle' | 'error' | 'warning') => {
        const r = cartaoSvg(Wc, i, agora, { situacao, citados: citadosDoCartao(i) })
        const botoes = [...(() => { const a = acaoDoPedido(i, false); return [a.botao, a.orq].filter(Boolean) })(), ...botoesAbrir(i)]
        const a = acaoDoPedido(i, false)

        return (
          <Box key={`item:${i.id}`} flexDirection="column" borderStyle="round" borderColor={tom} paddingX={1}>
            <Svg source={r.source} alt={r.alt} width={Wc} height={r.height} />
            {a.linha && <Text color={a.linha.cor} dimColor={a.linha.cor === undefined} wrap="wrap">{a.linha.t}</Text>}
            {botoes.length > 0 && (
              <Box flexDirection="row" columnGap={1} flexWrap="wrap" alignItems="center">
                {botoes}
              </Box>
            )}
            {i.foraDoContrato && <Text dimColor wrap="wrap">{`⚠ fora do contrato: ${i.foraDoContrato}`}</Text>}
          </Box>
        )
      }
      const linhaDaFila = (i: LinhaItem) => {
        const a = acaoDoPedido(i, true)
        const comAcao = a.linha !== undefined || a.botao !== undefined
        const r = filaSvg(W, i, agora, { citados: citadosDaFila(i), filete: !comAcao })
        const filete = comAcao ? fileteSvg(W) : undefined

        return (
          <Box key={`item:${i.id}`} flexDirection="column">
            <Svg source={r.source} alt={r.alt} width={W} height={r.height} />
            {a.linha && (
              <Box paddingLeft={3}>
                <Text color={a.linha.cor} dimColor={a.linha.cor === undefined} wrap="wrap">{a.linha.t}</Text>
              </Box>
            )}
            {a.botao && (
              <Box flexDirection="row" alignItems="center" flexWrap="wrap" columnGap={1} paddingLeft={3}>
                {a.botao}
              </Box>
            )}
            {i.foraDoContrato && <Text dimColor wrap="wrap">{`⚠ fora do contrato: ${i.foraDoContrato}`}</Text>}
            {filete && <Svg source={filete.source} alt="" width={W} height={filete.height} />}
          </Box>
        )
      }
      const erroLido = l.erros.length > 0 ? faixaSvg(W, { titulo: 'Não consegui ler tudo', detalhe: l.erros.join(' · '), tom: 'er' }) : undefined
      const avisoLido = avisos.length > 0 ? faixaSvg(W, { titulo: 'Ação não concluída', detalhe: avisos.join(' · '), tom: 'er' }) : undefined
      const rodape = fileteSvg(W)
      const horaLida = l.lidoEm !== null ? hora(l.lidoEm).slice(0, 5) : undefined
      const palavraDoModo = modo === 'presente' || modo === 'desconhecido' ? rotuloModoSvg(modo) : undefined
      const linhaParou = parada ? parouSvg(W, `⚠ Parou ${desde(new Date(l.lidoEm as number).toISOString(), agora) ?? 'há pouco'}`) : undefined
      const faixaModo = modo === 'ausente' ? modoSvg(W, { modo: 'ausente', desde: l.ausente?.desde, agora }) : undefined

      return (
        <Box flexDirection="column" gap={1}>
          <Box key="topo" flexDirection="column">
            <Box flexDirection="row" alignItems="center" flexWrap="wrap" columnGap={1}>
              <Box flexDirection="row" columnGap={1}>
                {botaoModo}
              </Box>
              <Box flexDirection="row" columnGap={1} alignItems="center" flexGrow={1} justifyContent="flex-end">
                {palavraDoModo && <Svg source={palavraDoModo.source} alt={palavraDoModo.alt} width={palavraDoModo.width} height={20} />}
                {!lido && !l.lendo && <Text dimColor>ainda não lido</Text>}
                {botaoAtualizar(l.lendo && !parada ? 'Lendo…' : horaLida ? `↻ ${horaLida}` : '↻ ler', 'atualizar', { autoFocus: true })}
              </Box>
            </Box>
            {linhaParou && <Svg source={linhaParou.source} alt={linhaParou.alt} width={W} height={linhaParou.height} />}
            {faixaModo && <Svg source={faixaModo.source} alt={faixaModo.alt} width={W} height={faixaModo.height} />}
          </Box>
          {lido && (() => {
            // Sem aviso: a linha de 20 px com o botão ao lado (a largura do SVG desconta o botão); com aviso: o bloco e o botão embaixo.
            const r = reinicioSvg(rn.aviso || !botaoDoAviso ? W : W - 96, dadosDoReinicio)

            return rn.aviso ? (
              <Box key="bloco-do-reinicio" flexDirection="column" gap={1} alignItems="flex-start">
                <Svg source={r.source} alt={r.alt} width={W} height={r.height} />
                {botaoDoAviso}
              </Box>
            ) : (
              <Box key="bloco-do-reinicio" flexDirection="row" alignItems="center" columnGap={1} flexWrap="wrap">
                <Svg source={r.source} alt={r.alt} width={botaoDoAviso ? W - 96 : W} height={r.height} />
                {botaoDoAviso}
              </Box>
            )
          })()}
          <Svg source={cartaoResumo.source} alt={resumo4.map(r => `${r.n} ${r.rotulo}`).join(', ')} width={W} height={cartaoResumo.height} />

          {erroLido && (
            <Box flexDirection="column" gap={1}>
              <Svg source={erroLido.source} alt={erroLido.alt} width={W} height={erroLido.height} />
              {botaoAtualizar('Tentar de novo', 'tentar')}
            </Box>
          )}
          {avisoLido && (
            <Box flexDirection="column" gap={1}>
              <Svg source={avisoLido.source} alt={avisoLido.alt} width={W} height={avisoLido.height} />
              {limparAvisos}
            </Box>
          )}

          {contagem.esperam > 0 && (
            <Box flexDirection="column" gap={1}>
              {faixa({ titulo: 'Esperam você', n: contagem.esperam, tom: 'av', legenda: 'responda aqui' })}
              {l.perguntas.map(q => {
                const citadosQ = citadosDaPergunta(q)
                const card = perguntaSvg(W, q, citadosQ)

                return (
                  <Box key={`pergunta:${q.id}`} flexDirection="column" gap={1} paddingBottom={1}>
                    <Svg
                      source={card.source}
                      alt={[`${q.id} · ${q.rotulo ?? q.sessao} · ${q.titulo}`, q.caso, q.seNaoDecidir && `Se não decidir: ${q.seNaoDecidir}`, q.recomendacao && `Recomendo: ${q.recomendacao}`, citadosQ.length > 0 && altDosCitados(citadosQ)].filter(Boolean).join(' — ')}
                      width={W}
                      height={card.height}
                    />
                    {q.sessaoId && q.link && <Box flexDirection="row">{abrir(`pergunta:${q.id}`, { apelido: q.sessao, localId: q.sessaoId, link: q.link })}</Box>}
                    {acoes(q)}
                  </Box>
                )
              })}
              {sec.esperam.map(i => cartao(i, 'warning'))}
            </Box>
          )}
          {totalDeCartoes > 0 && (
            <Box flexDirection="column" gap={1}>
              {faixa({ titulo: 'Sessões para abrir', n: totalDeCartoes, tom: 'av', legenda: 'na orquestradora', tracejado: true })}
              {gruposDeCartoes.map(g => {
                const frase = fraseDoGrupoSvg(W, g.frase, !g.viva)

                return (
                  <Box key={`grupo-cartoes:${g.orqId}`} flexDirection="column">
                    {g.linhas.map(c => {
                      const r = sessaoParaAbrirSvg(W, c, agora)

                      return <Svg key={`cartao:${c.id}`} source={r.source} alt={`${r.alt}, na conversa da orquestradora de ${g.projeto}`} width={W} height={r.height} />
                    })}
                    <Svg source={frase.source} alt={frase.alt} width={W} height={frase.height} />
                    {g.viva && (
                      <Box flexDirection="row" justifyContent="flex-end">
                        {botaoOrquestradora(`cartoes:${g.orqId}`, g.projeto, g.orqId)}
                      </Box>
                    )}
                  </Box>
                )
              })}
            </Box>
          )}
          {lido && sec.travados.length > 0 && (
            <Box flexDirection="column" gap={1}>
              {faixa({ titulo: 'Travados', n: contagem.travados, tom: 'er', legenda: 'pedem alguém agir' })}
              {sec.travados.map(i => cartao(i, 'error'))}
            </Box>
          )}
          {lido && (
            <Box flexDirection="column" gap={1}>
              {faixa({ titulo: 'Executando', n: contagem.executando, tom: 'an', legenda: trabalhando > 0 ? `${trabalhando} trabalhando` : undefined })}
              {contagem.executando === 0 && <Text dimColor>Nada executando agora.</Text>}
              {sec.executando.map(i => cartao(i, 'subtle'))}
            </Box>
          )}
          {lido && (
            <Box flexDirection="column" gap={1}>
              {faixa({ titulo: 'Na fila', n: contagem.fila, tom: 'm', legenda: 'não começaram', tracejado: true })}
              {contagem.fila === 0 && <Text dimColor>Nada na fila.</Text>}
              {desenharTopo(topoDaFila(sec.fila), 3, 1)}
              {sec.fila.map(i => linhaDaFila(i))}
            </Box>
          )}
          {(botaoTodos || botaoFeitos || botaoAssumidas || botaoAnteriores) && (
            <Box flexDirection="column" gap={1}>
              <Svg source={rodape.source} alt="" width={W} height={rodape.height} />
              <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
                {botaoTodos}
                {botaoFeitos}
                {botaoAssumidas}
                {botaoAnteriores}
              </Box>
            </Box>
          )}
          {verFeitosAgora && sec.feitos.map(i => cartao(i, 'subtle'))}
          {verAss &&
            assumidas.map(q => {
              const citadosQ = citadosDaPergunta(q)
              const card = perguntaSvg(W, q, citadosQ, 'Assumido')

              return (
                <Box key={`assumida:${q.id}`} flexDirection="column" gap={1} paddingBottom={1}>
                  <Svg
                    source={card.source}
                    alt={[`${q.id} · ${q.rotulo ?? q.sessao} · ${q.titulo}`, q.caso, q.recomendacao && `Assumido: ${q.recomendacao}`, citadosQ.length > 0 && altDosCitados(citadosQ)].filter(Boolean).join(' — ')}
                    width={W}
                    height={card.height}
                  />
                  {q.sessaoId && q.link && <Box flexDirection="row">{abrir(`assumida:${q.id}`, { apelido: q.sessao, localId: q.sessaoId, link: q.link })}</Box>}
                  {acoesAssumida(q)}
                </Box>
              )
            })}
          {verVelhas &&
            l.anteriores.map(a => {
              const linha = anteriorSvg(W, a, agora)

              return <Svg key={`anterior:${a.id}`} source={linha.source} alt={linha.alt} width={W} height={linha.height} />
            })}
          {verTodosAgora && (
            <Box flexDirection="column" gap={1}>
              {campoAchar}
              {resultadoDoFiltro}
              {achados.length === 0
                ? nenhum
                : gruposDoIndice(achados, l.temas).map(g => {
                    const r = todosSvg(W, g, { comProjeto })
                    return <Svg key={`todos:${g.projeto ?? ''}:${g.id}`} source={r.source} alt={r.alt} width={W} height={r.height} />
                  })}
            </Box>
          )}
        </Box>
      )
    }

    // Cada item em duas linhas: título e "etapa · tema · dono · #PR"; a trava e o aviso de contrato logo abaixo.
    const linhaItem = (i: LinhaItem) => {
      const cor = i.situacao === 'travado' ? 'error' : i.situacao === 'fila' ? 'inactive' : (COR_ETAPA_TERMINAL[i.etapa] ?? 'inactive')
      const etapa = ROTULO_ETAPA_TERMINAL[i.etapa] ?? i.etapa
      const info = [
        i.situacao === 'fila' ? `espera ${etapa}` : etapa,
        tituloDoTema(i),
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
            <Text wrap="truncate-end">{`${i.id} · ${i.titulo}`}</Text>
            <Text dimColor wrap="wrap">{info}</Text>
            {(() => {
              const c = i.situacao === 'fila' ? citadosDaFila(i) : citadosDoCartao(i)

              return c.length > 0 ? <Text dimColor wrap="wrap">{altDosCitados(c)}</Text> : null
            })()}
            {(() => {
              const a = acaoDoPedido(i, i.situacao === 'fila')

              return (
                <>
                  {a.linha && <Text color={a.linha.cor} dimColor={a.linha.cor === undefined} wrap="wrap">{a.linha.t}</Text>}
                  {a.botao}
                  {a.orq}
                </>
              )
            })()}
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
    const tituloDaSecao = (t: string, n: number, cor: string) => <Text bold color={cor}>{`${t} · ${n}`}</Text>

    return (
      <Box flexDirection="column" gap={1} paddingX={1}>
        <Box key="topo" flexDirection="column">
          <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
            <Box flexDirection="row" columnGap={1}>
              {botaoModo}
            </Box>
            <Box flexDirection="row" flexGrow={1} justifyContent="flex-end" columnGap={1}>
              {modo === 'presente' && <Text dimColor>presente</Text>}
              {modo === 'desconhecido' && <Text dimColor italic>modo não lido (vale presente)</Text>}
              {botaoAtualizar(parada ? '⚠ ler' : l.lidoEm === null ? '↻ ler' : `↻ ${hora(l.lidoEm)}`, 'atualizar', { autoFocus: true })}
            </Box>
          </Box>
          {modo === 'ausente' && (
            <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
              <Text inverse bold>{` ☾ AUSENTE ${modoDescrito(l.ausente?.desde, agora).ha} `}</Text>
              {modoDescrito(l.ausente?.desde, agora).quando && <Text dimColor>{`desde ${modoDescrito(l.ausente?.desde, agora).quando}`}</Text>}
              <Text dimColor>· a orquestradora pode se limpar</Text>
              <Text dimColor>· sessões novas só abrem com você</Text>
            </Box>
          )}
          {lido && (() => {
            const cor = doReinicio.estado === 'pode' ? GLIFO_REINICIO.pode : GLIFO_REINICIO.esperando
            const hora_ = doReinicio.conferidoEm === null ? 'sem conferência' : `conferido às ${hhmm(doReinicio.conferidoEm)}`
            const titulo_ = rn.aviso
              ? doReinicio.estado === 'pode' ? 'Pode reiniciar o app' : doReinicio.estado === 'espere' ? `Espere · ${doReinicio.rodando} rodando` : doReinicio.estado === 'conferindo' ? 'Aviso ligado · conferindo' : 'Não sei · aviso ligado'
              : doReinicio.estado === 'pode' ? 'Pode reiniciar o app' : doReinicio.estado === 'espere' ? `Reiniciar: espere · ${doReinicio.rodando} rodando` : 'Reiniciar: não sei'
            const titulo = (
              <Text key="titulo" wrap="truncate-end">
                <Text color={cor}>{GLIFO_REINICIO.g}</Text>
                <Text bold> {titulo_}</Text>
                {!rn.aviso && doReinicio.estado === 'pode' && <Text dimColor>{` · ${hora_}`}</Text>}
              </Text>
            )
            if (!rn.aviso) {
              return (
                <Box key="bloco-do-reinicio" flexDirection="row" flexWrap="wrap" columnGap={1}>
                  {titulo}
                  {botaoDoAviso}
                </Box>
              )
            }
            const visiveis = doReinicio.motivos.slice(0, 4)
            const mais = doReinicio.motivos.length - visiveis.length
            const linhas =
              doReinicio.estado === 'espere'
                ? [...visiveis.map(m => `· ${m.texto}`), `${mais > 0 ? `+ ${mais} mais · ` : ''}${hora_} · aviso ligado`]
                : doReinicio.estado === 'pode'
                  ? [`nada rodando · ${hora_}`, ...(rn.aviso.avisadoEm ? [`avisei às ${hhmm(Date.parse(rn.aviso.avisadoEm))}`] : [])]
                  : doReinicio.estado === 'conferindo'
                    ? ['a primeira conferência sai em instantes']
                    : [doReinicio.razao ?? 'ainda não conferi']

            return (
              <Box key="bloco-do-reinicio" flexDirection="column" gap={1} alignItems="flex-start">
                <Box flexDirection="column">
                  {titulo}
                  {linhas.map((t, i) => (
                    <Text key={`${i}:${t}`} dimColor wrap="truncate-end">{t}</Text>
                  ))}
                </Box>
                {botaoDoAviso}
              </Box>
            )
          })()}
          <Box flexDirection="row" columnGap={2} flexWrap="wrap">
            {resumo.every(r => r.n === 0) && <Text dimColor>{lido ? 'nada em andamento' : 'ainda não lido'}</Text>}
            {resumo.filter(r => r.n > 0).map(r => (
              <Text>
                <Text color={r.cor}>●</Text> <Text bold>{String(r.n)}</Text>
                <Text dimColor> {r.rotulo}</Text>
              </Text>
            ))}
          </Box>
        </Box>

        {avisos.length + l.erros.length > 0 && (
          <Box flexDirection="column" borderStyle="round" borderColor="error" paddingX={1}>
            {[...avisos, ...l.erros].map(err => (
              <Text color="error" wrap="wrap">
                ⚠ {err}
              </Text>
            ))}
            <Box flexDirection="row" columnGap={1}>
              {l.erros.length > 0 && botaoAtualizar('Tentar de novo', 'tentar')}
              {limparAvisos}
            </Box>
          </Box>
        )}

        {contagem.esperam > 0 && (
          <Box flexDirection="column" gap={1}>
            {tituloDaSecao('Esperam você', contagem.esperam, 'warning')}
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
                {citadosDaPergunta(q).length > 0 && <Text dimColor wrap="wrap">{altDosCitados(citadosDaPergunta(q))}</Text>}
                {q.caso && <Text wrap="wrap">{q.caso}</Text>}
                {q.seNaoDecidir && <Text dimColor wrap="wrap">{`Se não decidir: ${q.seNaoDecidir}`}</Text>}
                {q.recomendacao && <Text color="warning" wrap="wrap">{`Recomendo: ${q.recomendacao}`}</Text>}
                {acoes(q)}
              </Box>
            ))}
            {sec.esperam.map(i => linhaItem(i))}
          </Box>
        )}
        {totalDeCartoes > 0 && (
          <Box flexDirection="column" gap={1}>
            {tituloDaSecao('Sessões para abrir', totalDeCartoes, 'warning')}
            {gruposDeCartoes.map(g => (
              <Box key={`grupo-cartoes:${g.orqId}`} flexDirection="column">
                {g.linhas.map(c => (
                  <Box key={`cartao:${c.id}`} flexDirection="column">
                    <Text wrap="wrap">
                      <Text color="warning">◌</Text> <Text bold>{c.apelido === 'dona' ? (c.itens[0]?.id ?? c.apelido) : c.apelido}</Text>
                      <Text>{` ${papelDeDesenho(c.apelido) ?? 'sessão'}`}</Text>
                      <Text dimColor>{` · ${desde(c.propostoEm, agora) ?? 'agora'}`}</Text>
                    </Text>
                    <Text wrap="wrap">{`  ${paraQueDoCartao(c)}`}</Text>
                    {c.itens.length > 1 && <Text dimColor wrap="wrap">{`  + ${c.itens.length - 1} ${c.itens.length === 2 ? 'item' : 'itens'}`}</Text>}
                  </Box>
                ))}
                <Text dimColor={g.viva} color={g.viva ? undefined : 'error'} wrap="wrap">{g.frase}</Text>
                {g.viva && <Box flexDirection="row">{botaoOrquestradora(`cartoes:${g.orqId}`, g.projeto, g.orqId)}</Box>}
              </Box>
            ))}
          </Box>
        )}
        {lido && sec.travados.length > 0 && (
          <Box flexDirection="column" gap={1}>
            {tituloDaSecao('Travados', contagem.travados, 'error')}
            {sec.travados.map(i => linhaItem(i))}
          </Box>
        )}
        {lido && (
          <Box flexDirection="column" gap={1}>
            {tituloDaSecao('Executando', contagem.executando, 'suggestion')}
            {contagem.executando === 0 && <Text dimColor>Nada executando agora.</Text>}
            {sec.executando.map(i => linhaItem(i))}
          </Box>
        )}
        {lido && (
          <Box flexDirection="column" gap={1}>
            {tituloDaSecao('Na fila', contagem.fila, 'inactive')}
            {contagem.fila === 0 && <Text dimColor>Nada na fila.</Text>}
            {desenharTopo(topoDaFila(sec.fila), 2)}
            {sec.fila.map(i => linhaItem(i))}
          </Box>
        )}
        {(botaoTodos || botaoFeitos || botaoAssumidas || botaoAnteriores) && (
          <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
            {botaoTodos}
            {botaoFeitos}
            {botaoAssumidas}
            {botaoAnteriores}
          </Box>
        )}
        {verFeitosAgora && sec.feitos.map(i => linhaItem(i))}
        {verAss &&
          assumidas.map(q => (
            <Box key={`assumida:${q.id}`} flexDirection="column" borderStyle="round" borderColor="inactive" paddingX={1}>
              <Text wrap="wrap">
                <Text bold>{q.id}</Text>{' '}
                {q.titulo}
              </Text>
              <Text dimColor wrap="truncate-end">
                {q.rotulo ?? q.sessao}
              </Text>
              {citadosDaPergunta(q).length > 0 && <Text dimColor wrap="wrap">{altDosCitados(citadosDaPergunta(q))}</Text>}
              {q.caso && <Text wrap="wrap">{q.caso}</Text>}
              {q.recomendacao && <Text color="warning" wrap="wrap">{`Assumido: ${q.recomendacao}`}</Text>}
              {q.sessaoId && q.link && <Box flexDirection="row">{abrir(`assumida:${q.id}`, { apelido: q.sessao, localId: q.sessaoId, link: q.link })}</Box>}
              {acoesAssumida(q)}
            </Box>
          ))}
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
        {verTodosAgora && (
          <Box flexDirection="column">
            {campoAchar}
            {resultadoDoFiltro}
            {achados.length === 0
              ? nenhum
              : gruposDoIndice(achados, l.temas).map(g => (
                  <Box key={`todos:${g.projeto ?? ''}:${g.id}`} flexDirection="column">
                    <Text bold>{comProjeto ? `${g.rotulo} · ${g.projeto ?? g.itens[0]?.projeto ?? ''}` : g.rotulo}</Text>
                    {g.itens.map(i => (
                      <Text key={i.id} wrap="truncate-end" dimColor={i.etapa === 'feito' || i.etapa === 'descartado'}>{`${i.id}  ${i.titulo}  · ${ROTULO_ETAPA_TERMINAL[i.etapa] ?? i.etapa}`}</Text>
                    ))}
                  </Box>
                ))}
          </Box>
        )}
      </Box>
    )
  })
}
