import type { Barra, ParaAplicar, ParaBaixar } from '../types'

// A barra de status acima do prompt: o relógio do cache de 1 h, o contexto contra a janela de compactação, o selo das perguntas
// abertas, o botão de limpar (só na orquestradora), o do modo ausente e o do painel, cada um com glifo e cor. Só lê arquivos
// (a cada 30 s e a cada turno); o `list_sessions` fica para o pane aberto. O clique de limpar manda o prompt à própria sessão
// com o cache quente e, com ele frio, limpa direto (F213).

type Doc = { id: string; data: Record<string, unknown>; version?: number }
export type Regua = { aviso: number; teto: number }

export const CACHE_TTL_MS = 3_600_000
export const LEITURA_MS = 30_000
export const AVISO_MIN = 20 * 60
const ALERTA_MIN = 10 * 60
export const BANDEIRA_DO_APP = 'Library/Application Support/Claude/claude-code-sessions'

/** O que o clique de limpar manda à própria sessão (o prompt chega com origem `plugin`; o ok que a T7 lê é o arquivo gravado antes). */
export const PROMPT_DE_LIMPAR = 'O operador mandou limpar pelo botão da barra: grave o estado (handoff do que estiver aberto) e limpe-se com clear_session "self". Na volta, o painel reabre e a skill orquestradora é carregada sem você pedir.'
/**
 * F219: a mensagem que acorda a orquestradora depois de uma limpeza. O app só sobe o processo novo de uma sessão limpa quando chega
 * uma mensagem (medido no log do app: `Clearing session` e, só na mensagem seguinte, `cold-starting`); por isso quem a manda é o
 * mod de outra sessão viva, que acha a marca de volta que a T7 gravou ao liberar o `clear_session`.
 */
export const PROMPT_DA_VOLTA = 'Voltei de uma limpeza de contexto (aviso automático do painel): carregue a skill `orquestracao:orquestradora` e cumpra o "Ao assumir"; o painel já foi reaberto.'
/** A marca espera isto antes de acordar a sessão: a limpeza da própria sessão só acontece quando o turno dela termina. */
export const ACORDAR_DEPOIS_DE_MS = 30_000
/** Marca mais velha que isto não acorda ninguém: é limpeza que não aconteceu, ou o operador já voltou por conta própria. */
export const VOLTA_VALE_MS = 10 * 60_000
/** No processo novo, a marca reabre o painel até isto depois de gravada (o operador pode voltar horas depois). */
export const PAINEL_NA_VOLTA_MS = 12 * 3_600_000
/** Com o cache frio o clique limpa direto (`clear_session` pelo mod) e espera isto a sessão recomeçar (o processo morre na limpeza); passado o prazo, pede à sessão. */
export const ESPERA_DA_LIMPEZA_DIRETA_MS = 20_000
/** O `Limpando…` segue até a leitura ver o contexto abaixo disto e, se o clique já foi abaixo disto, abaixo da metade do que era no clique (senão a leitura apagaria o aviso antes da limpeza), ou até `LIMPANDO_MAX_MS`. */
export const LIMPANDO_ABAIXO_DE = 150_000
export const LIMPANDO_MAX_MS = 10 * 60_000
/**
 * O glifo de cada botão, 1º caractere do rótulo. A cor própria do glifo que a revisão pedia (`Text color` filho do `Button`) o
 * motor desta build recusa ("takes one string child, its label, or none"): o destaque do limpar fica só na variante primária.
 */
export const GLIFO = {
  limpar: { g: '↺' },
  modo: { g: '☾' },
  painel: { g: '◨' },
  perguntas: { g: '●' },
} as const
/** O glifo do aviso de reinício e a cor dele por estado (`Text color` filho, como o contexto); `⏻` (U+23FB) é o liga/desliga: nenhuma seta nova. */
export const GLIFO_REINICIO = { g: '⏻', esperando: 'subtle', pode: 'success', semDado: 'subtle' } as const
/** A forma mais longa da peça, que a largura reserva em todo estado (a barra não se rearruma quando o estado vira). */
export const TEXTO_MAIS_LONGO_DO_REINICIO = `${GLIFO_REINICIO.g} Pode reiniciar`
/** As palavras do contexto: só elas levam cor; o denominador é a janela, a régua do papel só dá a palavra. */
export const PALAVRA_ALTO = ' · alto'
export const PALAVRA_LIMPAR = ' · limpar'

/**
 * As réguas de contexto por papel, as mesmas do hook `contexto-do-papel` (um teste da raiz compara): `aviso` marca `· alto`,
 * `teto` marca `· limpar`; nenhum dos dois é o denominador (esse é a janela de compactação). Sem faixa intermediária
 * (orquestradora com o operador presente), aviso e teto coincidem, em 250 mil: a sessão já recomeça com ~90 mil (F219).
 */
export const REGUAS = {
  dona: { aviso: 350_000, teto: 500_000 },
  orquestradora: { aviso: 250_000, teto: 250_000 },
  orquestradoraAusente: { aviso: 350_000, teto: 500_000 },
} as const satisfies Record<string, Regua>

const texto = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v : undefined)
const numero = (id: string) => Number(id.replace(/\D/g, '')) || 0
const mensagem = (err: unknown) => (err instanceof Error ? err.message : String(err))
const largura = (t: string) => [...t].length
const vivo = (d: Doc) => !['feito', 'descartado'].includes(texto(d.data.etapa) ?? '')
const mesmoProjeto = (a: unknown, b: string | null) => b !== null && texto(a)?.toLowerCase() === b.toLowerCase()

// ---- funções puras ----

export type Papel = 'dona' | 'orquestradora'

/** O papel e o apelido do título da sessão (`F12 · …` é a dona, `🎛 orquestradora — …`); outro título, nenhum. */
export function papelEApelido(titulo: string | null | undefined): { papel: Papel | null; apelido: string | null } {
  const t = titulo ?? ''
  if (t.startsWith('🎛 orquestradora')) return { papel: 'orquestradora', apelido: '🎛' }
  const m = /^(F\d+) · /.exec(t)

  return m ? { papel: 'dona', apelido: m[1] as string } : { papel: null, apelido: null }
}

/** A régua do papel do título; a orquestradora com o modo ausente ligado segue a da dona. Sem papel, `null`. */
export function reguaDoPapel(titulo: string | null | undefined, ausente = false): Regua | null {
  const { papel } = papelEApelido(titulo)
  if (!papel) return null
  if (papel === 'orquestradora') return ausente ? REGUAS.orquestradoraAusente : REGUAS.orquestradora

  return REGUAS[papel]
}

export const corDoContexto = (tokens: number, regua: Regua | null): 'normal' | 'aviso' | 'teto' | null =>
  regua === null ? null : tokens >= regua.teto ? 'teto' : tokens >= regua.aviso ? 'aviso' : 'normal'

const inteiroPositivo = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : null)

/**
 * A janela em que a sessão compacta, para o denominador do contexto: `CLAUDE_CODE_AUTO_COMPACT_WINDOW`, senão o
 * `autoCompactWindow` do `~/.claude/settings.json` (texto do arquivo), senão a janela do modelo. Só inteiro > 0 vale; o
 * escolhido nunca passa da janela do modelo (a compactação não passa dela). Nenhuma: `null`, sem denominador.
 */
export function janelaDeCompactacao({ env, settings, modelo }: { env: string | undefined; settings: string | null | undefined; modelo: number | null | undefined }): number | null {
  const doModelo = inteiroPositivo(modelo)
  const daEnv = env !== undefined && env.trim() !== '' ? inteiroPositivo(Number(env)) : null
  let doSettings: number | null = null
  try {
    const lido: unknown = settings ? JSON.parse(settings) : null
    doSettings = typeof lido === 'object' && lido !== null ? inteiroPositivo((lido as Record<string, unknown>).autoCompactWindow) : null
  } catch {
    doSettings = null
  }
  const escolhida = daEnv ?? doSettings
  if (escolhida === null) return doModelo

  return doModelo === null ? escolhida : Math.min(escolhida, doModelo)
}

/** O `em` da marca de volta (`{ em, … }`) e a idade dela em ms: `em` legível e não no futuro (1 min de folga); senão `null`. */
export function idadeDaVolta(textoDaMarca: string | null | undefined, agora: number): number | null {
  try {
    const em = texto((JSON.parse(textoDaMarca ?? '') as Record<string, unknown> | null)?.em)
    const t = em === undefined ? NaN : Date.parse(em)
    if (Number.isNaN(t) || t - agora > 60_000) return null

    return Math.max(0, agora - t)
  } catch {
    return null
  }
}

/** As sessões a acordar: marca `local_….json` (não a já acordada) de outra sessão, com idade entre `ACORDAR_DEPOIS_DE_MS` e `VOLTA_VALE_MS`; `cli` é a id do CLI que pediu a limpeza. */
export function paraAcordar(marcas: Array<{ nome: string; texto: string | null }>, eu: string | undefined, agora: number): Array<{ id: string; cli: string | null }> {
  return marcas.flatMap(({ nome, texto: t }) => {
    const id = /^(local_[\w-]+)\.json$/.exec(nome)?.[1]
    if (!id || id === eu) return []
    const idade = idadeDaVolta(t, agora)
    if (idade === null || idade < ACORDAR_DEPOIS_DE_MS || idade > VOLTA_VALE_MS) return []
    let cli: string | null = null
    try {
      cli = texto((JSON.parse(t ?? '') as Record<string, unknown>).cli) ?? null
    } catch {
      cli = null
    }

    return [{ id, cli }]
  })
}

/**
 * A limpeza pedida aconteceu: o registro do app não traz mais como atual a id do CLI que a pediu (sem `cliSessionId` é sessão
 * limpa ainda sem processo novo). Marca sem `cli` só vale com o registro sem `cliSessionId`. Sem registro, não se sabe: não.
 */
export function limpezaAconteceu(cliDaMarca: string | null, registro: { cliSessionId?: unknown } | null): boolean {
  if (registro === null) return false
  const atual = texto(registro.cliSessionId)
  if (atual === undefined) return true

  return cliDaMarca !== null && atual !== cliDaMarca
}

/** A moldura do cache: nunca com o turno rodando (o cache está sendo renovado); `null` sem resposta ainda. */
export function nivelDoCache(segundos: number | null, trabalhando: boolean): 'aviso' | 'alerta' | 'venceu' | null {
  if (segundos === null || trabalhando) return null
  if (segundos <= 0) return 'venceu'
  if (segundos <= ALERTA_MIN) return 'alerta'

  return segundos <= AVISO_MIN ? 'aviso' : null
}

/** Cache frio: o relógio venceu e o turno está parado. Só aí o limpar vai direto, sem turno do modelo (que reescreveria a conversa sem cache); sem relógio não é frio. */
export const cacheFrio = (segundos: number | null, trabalhando: boolean): boolean => segundos !== null && segundos <= 0 && !trabalhando

const dois = (n: number) => String(n).padStart(2, '0')

export const relogio = (segundos: number | null): string =>
  segundos === null ? '—' : segundos <= 0 ? 'venceu' : `${dois(Math.floor(segundos / 60))}:${dois(segundos % 60)}`

/** As sessões do projeto que são a orquestradora: pelo `papel` ou pelo título `🎛 orquestradora`; o `projeto` não distingue caixa. */
export function orquestradorasDoProjeto(docs: Doc[], projeto: string | null): string[] {
  return docs
    .filter(d => mesmoProjeto(d.data.projeto, projeto) && (d.data.papel === 'orquestradora' || (texto(d.data.titulo) ?? '').startsWith('🎛 orquestradora')))
    .map(d => texto(d.data.sessionId) ?? d.id)
}

/** As perguntas com `estado: "aberta"`, todas (o selo do pane conta igual). */
export const abertasDoProjeto = (docs: Doc[]): number => docs.filter(d => d.data.estado === 'aberta').length

/** O item vivo desta sessão: o de que ela é dona; senão o primeiro em cujo `com` ela está. */
export function meuItem(docs: Doc[], localId: string): { id: string; titulo: string; etapa: string; projeto?: string } | null {
  const vivos = docs.filter(vivo).sort((a, b) => numero(a.id) - numero(b.id))
  const d =
    vivos.find(x => texto(x.data.donoLocalId) === localId) ??
    vivos.find(x => Array.isArray(x.data.com) && (x.data.com as Array<Record<string, unknown> | null>).some(c => texto(c?.localId) === localId))

  return d ? { id: d.id, titulo: texto(d.data.titulo) ?? d.id, etapa: texto(d.data.etapa) ?? '?', projeto: texto(d.data.projeto)?.toLowerCase() } : null
}

const ETAPAS_DE_TRABALHO = ['planejamento', 'design', 'execucao', 'validacao']

/** Donas trabalhando no projeto: itens numa etapa de trabalho com dona ou alguém no `com` (a mesma conta do teto de donas). */
export function contarDonas(docs: Doc[], projeto: string | null): number {
  return docs.filter(d => {
    if (!mesmoProjeto(d.data.projeto, projeto) || !ETAPAS_DE_TRABALHO.includes(texto(d.data.etapa) ?? '')) return false

    return texto(d.data.donoLocalId) !== undefined || (Array.isArray(d.data.com) && d.data.com.length > 0)
  }).length
}

// ---- o aviso de reinício (F152) ----

export type MotivoDeReinicio = { tipo: 'sessao' | 'teste' | 'merge'; texto: string; localId?: string }
/** O que `painel pode-reiniciar` grava em `batida/pode-reiniciar.json`: TODOS os motivos, a sessão que rodou incluída. */
export type ArquivoDeReinicio = { pode: boolean; motivos: MotivoDeReinicio[]; sessoesDe?: string; em: string; listaEm?: string; paraAplicar?: ParaAplicar[]; paraBaixar?: ParaBaixar[] }
/** `batida/aviso-de-reinicio.json`: o aviso que o operador ligou; a `vigia` é a sessão que confere a cada minuto. */
/** `appInicio`: o instante de início do processo do app quando o aviso foi ligado (só o reinício do app o muda); `vigiaEm`: a hora da última conferência da vigia. */
export type AvisoDeReinicio = { ligadoEm: string; vigia: string; avisadoEm?: string; naoPodeSeguidos: number; appInicio?: string; vigiaEm?: string }

/** "Pode" só com a lista de sessões e o arquivo de até 2 min; "espere" vale com o arquivo de até 15; fora disso, "não sei". */
export const PODE_MAX_MS = 2 * 60_000
export const ESPERE_MAX_MS = 15 * 60_000
/** Do clique em `Me avise` até a 1ª conferência da vigia (que confere no ato e depois a cada minuto). */
export const PRIMEIRA_CONFERENCIA_MS = 90_000
export const VIGIA_MS = 60_000
/** Sem conferência há tanto com o aviso ligado, a vigia sumiu: a próxima sessão que ler assume. */
export const VIGIA_SUMIU_MS = 3 * 60_000
/** Depois de avisar, ainda podendo e ninguém reiniciou: o aviso desliga sozinho. */
export const AVISO_VALE_MS = 30 * 60_000
/** Rearmar o aviso pede dois "não pode" seguidos (dois minutos de margem para não piscar). */
export const NAO_PODE_PARA_REARMAR = 2

export type EstadoDoReinicio = {
  estado: 'pode' | 'espere' | 'conferindo' | 'sem-dado'
  /** O número de motivos (sessões + testes + merges, a própria sessão incluída). */
  rodando: number
  /** Merge, depois teste, depois sessão; a própria sessão (ao vivo) primeiro entre as sessões. */
  motivos: MotivoDeReinicio[]
  conferidoEm: number | null
  /** Por que não se sabe (só no `sem-dado`). */
  razao?: string
}

const ORDEM_DO_MOTIVO = { merge: 0, teste: 1, sessao: 2 } as const
export const PROPRIA_TRABALHANDO = 'esta sessão trabalhando'
const emMs = (iso: string | undefined): number | null => {
  const t = iso === undefined ? NaN : Date.parse(iso)

  return Number.isNaN(t) ? null : t
}

/**
 * O que a tela diz do reinício. A régua de idade é assimétrica: o erro caro é dizer "pode" com dado velho. A própria sessão é ao
 * vivo: o motivo dela que estiver no arquivo sai e entra o de agora (`esta sessão trabalhando`). `conferindo` só com o aviso
 * ligado há menos tempo que a 1ª conferência da vigia e sem conferência posterior ao clique.
 */
export function estadoDoReinicio({ arquivo, aviso, eu, trabalhandoEu, agora, erro = false }: { arquivo: ArquivoDeReinicio | null; aviso: AvisoDeReinicio | null; eu: string | null | undefined; trabalhandoEu: boolean; agora: number; erro?: boolean }): EstadoDoReinicio {
  const em = emMs(arquivo?.em)
  const ligadoEm = emMs(aviso?.ligadoEm)
  if (aviso !== null && ligadoEm !== null && (em === null || em < ligadoEm) && agora - ligadoEm < PRIMEIRA_CONFERENCIA_MS) {
    return { estado: 'conferindo', rodando: 0, motivos: [], conferidoEm: null }
  }
  if (arquivo === null || em === null) return { estado: 'sem-dado', rodando: 0, motivos: [], conferidoEm: null, razao: erro ? 'não consegui conferir agora' : 'ainda não conferi' }
  const outros = arquivo.motivos.filter(m => !(m.tipo === 'sessao' && eu && m.localId === eu))
  const motivos = [...(trabalhandoEu ? [{ tipo: 'sessao' as const, texto: PROPRIA_TRABALHANDO, localId: eu ?? undefined }] : []), ...outros].sort((a, b) => ORDEM_DO_MOTIVO[a.tipo] - ORDEM_DO_MOTIVO[b.tipo])
  const idadeDoArquivo = agora - em
  const idadeDaLista = agora - (emMs(arquivo.listaEm) ?? em)
  const base = { rodando: motivos.length, motivos, conferidoEm: em }
  if (motivos.length === 0 && idadeDoArquivo <= PODE_MAX_MS && idadeDaLista <= PODE_MAX_MS) return { estado: 'pode', ...base }
  if (motivos.length > 0 && idadeDoArquivo <= ESPERE_MAX_MS) return { estado: 'espere', ...base }

  return { estado: 'sem-dado', ...base, razao: erro ? 'não consegui conferir agora' : `a última conferência é de há ${Math.max(1, Math.round(idadeDoArquivo / 60_000))} min` }
}

/**
 * O passo da vigia depois de conferir: notifica uma vez quando passa a poder, rearma depois de dois "não pode" seguidos
 * (o aviso volta a esperar e notifica de novo), e desliga sozinho 30 min depois do aviso se ainda pode. `null` = apaga o aviso.
 */
export function proximoDaVigia({ aviso, estado, agora }: { aviso: AvisoDeReinicio; estado: EstadoDoReinicio['estado']; agora: number }): { aviso: AvisoDeReinicio | null; notificar: boolean } {
  const avisadoEm = emMs(aviso.avisadoEm)
  if (estado === 'pode') {
    if (avisadoEm === null) return { aviso: { ...aviso, avisadoEm: new Date(agora).toISOString(), naoPodeSeguidos: 0 }, notificar: true }
    if (agora - avisadoEm >= AVISO_VALE_MS) return { aviso: null, notificar: false }

    return { aviso: { ...aviso, naoPodeSeguidos: 0 }, notificar: false }
  }
  if (estado === 'espere') {
    // Sem aviso já dado não há o que rearmar: nada a contar nem a gravar a cada minuto.
    if (avisadoEm === null) return { aviso, notificar: false }
    const seguidos = aviso.naoPodeSeguidos + 1
    if (seguidos >= NAO_PODE_PARA_REARMAR) {
      const { avisadoEm: _, ...semAviso } = aviso

      return { aviso: { ...semAviso, naoPodeSeguidos: 0 }, notificar: false }
    }

    return { aviso: { ...aviso, naoPodeSeguidos: seguidos }, notificar: false }
  }

  return { aviso, notificar: false }
}

/** A vigia sumiu: a última conferência DELA (`vigiaEm`; sem ela, o clique) é de mais de 3 min. O arquivo não serve: qualquer pane o renova. */
export function vigiaSumiu({ aviso, agora }: { aviso: AvisoDeReinicio; agora: number }): boolean {
  const ultima = emMs(aviso.vigiaEm) ?? emMs(aviso.ligadoEm) ?? 0

  return agora - ultima >= VIGIA_SUMIU_MS
}

/** F209: há plugin do kit instalado que só vale com o app reiniciado. O painel só trata do kit (decisão do operador): app e motor não entram. */
export const esperaReinicio = (paraAplicar: unknown[] | null | undefined): boolean => (paraAplicar?.length ?? 0) > 0

/** O que o topo do pane mostra (as duas superfícies leem daqui): o kit para baixar (`null` = nada) e se o bloco do reinício aparece. */
export function oQueMostrarDoReinicio({ arquivo, aviso, falhou = false }: { arquivo: Pick<ArquivoDeReinicio, 'paraAplicar' | 'paraBaixar'> | null; aviso: unknown; falhou?: boolean }): { kit: ParaBaixar[] | null; reinicio: boolean } {
  // a conferência falhou: sem dado não se sabe se há pendência, e o arquivo do disco é velho; só o aviso ligado segue (com "não sei")
  if (falhou) return { kit: null, reinicio: aviso !== null }
  const kit = arquivo?.paraBaixar?.length ? arquivo.paraBaixar : null

  return { kit, reinicio: aviso !== null || esperaReinicio(arquivo?.paraAplicar) }
}

export const textoDoReinicioNaBarra = (r: Pick<EstadoDoReinicio, 'estado' | 'rodando'>): string =>
  `${GLIFO_REINICIO.g} ${r.estado === 'pode' ? 'Pode reiniciar' : r.estado === 'espere' ? `${r.rodando} rodando` : r.estado === 'conferindo' ? 'conferindo' : 'não sei'}`

// ---- a faixa de largura ----

export type EstadoBarra = {
  /** O relógio já escrito (`47:12`, `—`, `ativo`, `venceu`), sem o glifo. */
  relogio: string
  /** O relógio em bloco invertido (alerta e venceu): ganha uma célula de respiro de cada lado, que a soma conta. */
  bloco: boolean
  tokens: number | null
  /** A janela de compactação (o denominador); `null` = sem `/`. */
  janela: number | null
  regua: Regua | null
  /** `F52 · design`, quando há item. */
  item: string | null
  /** `donas 2`, quando há projeto. */
  donas: string | null
  abertas: number
  /** `null` = a bandeira não se leu: sem botão do modo. */
  modo: 'presente' | 'ausente' | null
  trocando: boolean
  painelAberto: boolean
  moldura: boolean
  /** Esta sessão é a orquestradora (título `🎛 orquestradora`): só nela há o botão de limpar. */
  ehOrquestradora: boolean
  /** O limpar já foi mandado e a limpeza ainda não apareceu na leitura. */
  limpando: boolean
  /** O cache esfriou com o turno parado: o clique limpa direto (`↺ Limpar já`). */
  limparDireto?: boolean
  /** O aviso de reinício: `null` (ou ausente) com o aviso desligado, e a barra não diz nada. */
  reinicio?: 'esperando' | 'pode' | 'sem-dado' | 'conferindo' | null
  rodando?: number
}

type Peca<K extends string> = { k: K; t: string }
export type Pecas = {
  esq: Array<Peca<'relogio' | 'contexto' | 'item' | 'donas'>>
  dir: Array<Peca<'reinicio' | 'perguntas' | 'limpar' | 'modo' | 'painel'>>
}

export const mil = (t: number) => Math.floor(t / 1000)

/** A palavra da régua do papel para este contexto: `· alto` no aviso, `· limpar` no teto, nenhuma abaixo (ou sem régua). */
export function palavraDoContexto(tokens: number, regua: Regua | null): string {
  const cor = corDoContexto(tokens, regua)

  return cor === 'aviso' ? PALAVRA_ALTO : cor === 'teto' ? PALAVRA_LIMPAR : ''
}

/** O texto do contexto na faixa: mil para baixo, contra a janela (sem janela, sem `/`); a palavra da régua conta em todas as faixas. */
export function textoDoContexto(tokens: number, regua: Regua | null, janela: number | null, faixa: 0 | 1 | 2): string {
  const numeros = janela !== null && faixa < 2 ? `${mil(tokens)}/${mil(janela)} mil` : `${mil(tokens)} mil`

  return `${faixa === 0 ? 'contexto ' : ''}${numeros}${palavraDoContexto(tokens, regua)}`
}

export const rotuloDoSelo = (n: number) => `${GLIFO.perguntas.g} ${n} ${n === 1 ? 'pergunta' : 'perguntas'}`
export const rotuloDoLimpar = (limpando: boolean, direto = false) => `${GLIFO.limpar.g} ${limpando ? 'Limpando…' : direto ? 'Limpar já' : 'Limpar'}`
export const rotuloDoModo = (modo: 'presente' | 'ausente', trocando: boolean) =>
  `${GLIFO.modo.g} ${trocando ? (modo === 'ausente' ? 'Ligando…' : 'Desligando…') : modo === 'ausente' ? 'Estou de volta' : 'Ficar ausente'}`
export const rotuloDoPainel = (aberto: boolean) => `${GLIFO.painel.g} ${aberto ? 'Fechar painel' : 'Abrir painel'}`

/** O botão de limpar em destaque: exatamente quando o contexto mostra `· limpar` (a régua do papel). */
export const limparEmDestaque = (tokens: number | null, regua: Regua | null): boolean => tokens !== null && corDoContexto(tokens, regua) === 'teto'

/** As peças de cada faixa (0 larga, 1 média, 2 estreita): o que cai quando aperta está decidido aqui, não no desenho. */
export function pecasDaBarra(e: EstadoBarra, faixa: 0 | 1 | 2): Pecas {
  const esq: Pecas['esq'] = [{ k: 'relogio', t: e.bloco ? ` ⧗ ${e.relogio} ` : `⧗ ${e.relogio}` }]
  if (e.tokens !== null) esq.push({ k: 'contexto', t: textoDoContexto(e.tokens, e.regua, e.janela, faixa) })
  if (faixa < 2 && e.item) esq.push({ k: 'item', t: e.item })
  if (faixa === 0 && e.donas) esq.push({ k: 'donas', t: e.donas })
  // Ordem da direita: reinício → selo → limpar → modo → painel. O reinício (só com o aviso ligado), o limpar e o modo ausente nunca caem; o modo presente cai na faixa 2.
  const dir: Pecas['dir'] = []
  if (e.reinicio) dir.push({ k: 'reinicio', t: textoDoReinicioNaBarra({ estado: e.reinicio === 'esperando' ? 'espere' : e.reinicio, rodando: e.rodando ?? 0 }) })
  const selo = e.abertas > 0
  if (selo) dir.push({ k: 'perguntas', t: rotuloDoSelo(e.abertas) })
  if (e.ehOrquestradora) dir.push({ k: 'limpar', t: rotuloDoLimpar(e.limpando, e.limparDireto) })
  if (e.modo && (e.modo === 'ausente' ? true : faixa < 2)) dir.push({ k: 'modo', t: rotuloDoModo(e.modo, e.trocando) })
  if (faixa < 2 || !selo) dir.push({ k: 'painel', t: rotuloDoPainel(e.painelAberto) })

  return { esq, dir }
}

/** A largura que a faixa pede, com os textos reais: peça à esquerda com 2 de vão, botão com `[ ]` (+4), texto sem (o reinício, 16), a moldura +2. */
export function larguraDaFaixa(e: EstadoBarra, faixa: 0 | 1 | 2): number {
  // O limpar conta sempre como `↺ Limpando…` (o `↺ Limpar já` do cache frio tem a mesma largura): a barra não se rearruma debaixo do clique.
  const { esq, dir } = pecasDaBarra({ ...e, limpando: true }, faixa)
  const ladoEsq = esq.reduce((n, p) => n + largura(p.t), 0) + 2 * (esq.length - 1)
  // O reinício é texto (sem `[ ]`) e conta sempre como `⏻ Pode reiniciar`, a forma mais longa.
  const ladoDir = dir.reduce((n, p) => n + (p.k === 'reinicio' ? largura(TEXTO_MAIS_LONGO_DO_REINICIO) : largura(p.t) + 4), 0) + Math.max(0, dir.length - 1)

  return ladoEsq + 2 + ladoDir + 2 + (e.moldura ? 2 : 0)
}

/** A faixa mais rica cuja soma cabe, com os textos reais do momento; nenhuma cabendo, a 2 (o `flexWrap` quebra). */
export function faixaDaBarra(colunas: number, e: EstadoBarra): 0 | 1 | 2 {
  for (const f of [0, 1, 2] as const) if (larguraDaFaixa(e, f) <= colunas) return f

  return 2
}

// ---- o desenho (sem `$`: os gestos chegam prontos, como funções) ----

// Os elementos do motor: a mesma árvore no terminal e no desktop, só com Box, Text e Button.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Elementos = { Box: any; Text: any; Button: any }

export type DadosDaBarra = {
  b: Barra
  modo: 'presente' | 'ausente' | null
  trocando: boolean
  /** O limpar foi mandado e a limpeza ainda não apareceu. */
  limpando: boolean
  painelAberto: boolean
  isWorking: boolean
  bodyColumns: number
  /** `F52 · design`, quando esta sessão tem item. */
  item: string | null
  /** O estado do reinício com o aviso ligado; `null` = o aviso desligado (a barra não diz nada). */
  reinicio?: Pick<EstadoDoReinicio, 'estado' | 'rodando'> | null
}
export type AcoesDaBarra = {
  abrirPainel: () => void
  alternarPainel: () => void
  alternarModo: () => void
  limpar: () => void
}

export function desenharBarra({ Box, Text, Button }: Elementos, d: DadosDaBarra, acoes: AcoesDaBarra) {
  const { b, modo, trocando, painelAberto, bodyColumns: colunas } = d
  const nivel = nivelDoCache(b.cache.segundos, d.isWorking)
  const lido = b.lidoEm !== null
  const regua = reguaDoPapel(b.titulo, modo === 'ausente')
  const destaque = limparEmDestaque(b.tokens, regua)
  const estado: EstadoBarra = {
    relogio: d.isWorking ? 'ativo' : relogio(b.cache.segundos),
    bloco: nivel === 'alerta' || nivel === 'venceu',
    tokens: b.tokens,
    janela: b.janela,
    regua,
    item: d.item,
    donas: b.projeto ? `donas ${b.donas}` : null,
    abertas: lido ? b.abertas : 0,
    modo: lido ? modo : null,
    trocando,
    painelAberto,
    moldura: nivel !== null,
    ehOrquestradora: b.ehOrquestradora,
    limpando: d.limpando,
    limparDireto: cacheFrio(b.cache.segundos, d.isWorking),
    reinicio: d.reinicio ? (d.reinicio.estado === 'espere' ? 'esperando' : d.reinicio.estado) : null,
    rodando: d.reinicio?.rodando ?? 0,
  }
  const faixa = faixaDaBarra(colunas, estado)
  const { esq, dir: direita } = pecasDaBarra(estado, faixa)
  // Antes da primeira leitura só o relógio: nada à direita, para o selo não piscar `0` → `3`.
  const dir = lido ? direita : []

  const pecaEsq = (p: Pecas['esq'][number]) => {
    if (p.k === 'relogio') {
      return nivel === 'alerta' || nivel === 'venceu' ? (
        <Text key="relogio" inverse bold>{p.t}</Text>
      ) : nivel === 'aviso' ? (
        <Text key="relogio" bold>{p.t}</Text>
      ) : (
        <Text key="relogio">{p.t}</Text>
      )
    }
    if (p.k === 'contexto') {
      const palavra = b.tokens !== null ? palavraDoContexto(b.tokens, regua) : ''
      const numeros = palavra ? p.t.slice(0, -palavra.length) : p.t

      // O número fica sempre apagado; só a palavra leva cor.
      return (
        <Text key="contexto">
          <Text dimColor>{numeros}</Text>
          {palavra === PALAVRA_ALTO ? <Text color="warning">{palavra}</Text> : palavra === PALAVRA_LIMPAR ? <Text color="error" bold>{palavra}</Text> : null}
        </Text>
      )
    }

    return <Text key={p.k} dimColor wrap={p.k === 'item' ? 'truncate-end' : undefined}>{p.t}</Text>
  }

  const botaoDir = (p: Pecas['dir'][number]) => {
    if (p.k === 'reinicio') {
      // Texto, não botão: o gesto de desligar mora no pane. `⏻` em `subtle` (espere, conferindo, não sei) ou `success` (pode, a única vez que a barra diz "vá").
      const pode = d.reinicio?.estado === 'pode'
      const cor = pode ? GLIFO_REINICIO.pode : GLIFO_REINICIO.esperando

      return (
        <Text key="reinicio">
          <Text color={cor}>{GLIFO_REINICIO.g}</Text>
          {pode ? <Text bold>{p.t.slice(1)}</Text> : <Text dimColor italic={d.reinicio?.estado === 'conferindo'}>{p.t.slice(1)}</Text>}
        </Text>
      )
    }
    if (p.k === 'perguntas') {
      return (
        <Button key="perguntas" variant="secondary" onPress={acoes.abrirPainel}>
          {p.t}
        </Button>
      )
    }
    if (p.k === 'limpar') {
      // Na régua: primário e cheio; abaixo dela: secundário e apagado.
      return (
        <Button
          key="limpar"
          variant={destaque ? 'primary' : 'secondary'}
          dimColor={!destaque}
          onPress={() => {
            if (!d.limpando) acoes.limpar()
          }}
        >
          {p.t}
        </Button>
      )
    }
    if (p.k === 'modo') {
      return (
        <Button
          key="modo"
          variant="secondary"
          dimColor={modo === 'presente'}
          onPress={() => {
            if (!trocando) acoes.alternarModo()
          }}
        >
          {p.t}
        </Button>
      )
    }

    return (
      <Button key="painel" variant="secondary" dimColor onPress={acoes.alternarPainel}>
        {p.t}
      </Button>
    )
  }

  const moldura = nivel ? { borderStyle: 'round' as const, borderColor: nivel === 'aviso' ? ('warning' as const) : ('error' as const) } : {}

  return (
    <Box flexDirection="column" paddingX={1} {...moldura}>
      <Box flexDirection="row" flexWrap="wrap" columnGap={2} alignItems="center">
        <Box flexDirection="row" columnGap={2}>
          {esq.map(pecaEsq)}
        </Box>
        <Box flexDirection="row" columnGap={1} flexGrow={1} flexWrap="wrap" justifyContent="flex-end">
          {dir.map(botaoDir)}
        </Box>
      </Box>
    </Box>
  )
}
