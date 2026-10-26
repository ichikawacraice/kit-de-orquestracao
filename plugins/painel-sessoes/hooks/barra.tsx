import type { Barra, PerguntaAberta } from '../types'
import { desde } from './desenho'

// A barra de status acima do prompt: o relógio do cache de 1 h, o contexto contra a régua do papel, o selo das perguntas
// abertas, o botão do painel, o do modo ausente e o ok para a orquestradora se limpar. Só lê arquivos (a cada 30 s e a cada
// turno); o `list_sessions` fica para o pane aberto. Nunca manda a limpeza: o ok grava a resposta pelo mesmo `responder` do pane.

type Doc = { id: string; data: Record<string, unknown>; version?: number }
export type Regua = { aviso: number; teto: number }

export const CACHE_TTL_MS = 3_600_000
export const LEITURA_MS = 30_000
export const AVISO_MIN = 20 * 60
const ALERTA_MIN = 10 * 60
const LIMPAR_ANTES_SEG = 10 * 60
const LIMPAR_ANTES_TOKENS = 150_000
export const PEDIDO_TITULO = 'limpar · orquestradora'
/** A janela em que o ok do painel vale para a T7 (a trava da limpeza da orquestradora). */
const OK_VALE_MS = 30 * 60_000
export const RESPOSTA_DO_OK = 'sim (segue a recomendação)'
export const RASCUNHO = 'Pode se limpar agora, antes do cache vencer.'
export const BANDEIRA_DO_APP = 'Library/Application Support/Claude/claude-code-sessions'

export const ROTULO_LIMPAR = 'Pode se limpar'
export const ROTULO_LIMPAR_ANTES = 'Limpar antes de vencer'
export const FRASE_DO_PEDIDO = 'A orquestradora pede para se limpar'

/**
 * As réguas de contexto por papel, as mesmas do hook `contexto-do-papel` (um teste da raiz compara): `aviso` marca `· alto`,
 * `teto` marca `· teto` e é o denominador. Sem faixa intermediária (executora, orquestradora), aviso e teto coincidem.
 */
export const REGUAS = {
  E: { aviso: 300_000, teto: 300_000 },
  P: { aviso: 350_000, teto: 500_000 },
  D: { aviso: 350_000, teto: 500_000 },
  V: { aviso: 350_000, teto: 500_000 },
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

export type Papel = 'E' | 'P' | 'D' | 'V' | 'orquestradora'

/** O papel e o apelido do título da sessão (`E2 · …`, `🎛 orquestradora — …`); sem prefixo do pool, nenhum. */
export function papelEApelido(titulo: string | null | undefined): { papel: Papel | null; apelido: string | null } {
  const t = titulo ?? ''
  if (t.startsWith('🎛 orquestradora')) return { papel: 'orquestradora', apelido: '🎛' }
  const m = /^(P|D|E|V)(\d+) · /.exec(t)

  return m ? { papel: m[1] as Papel, apelido: `${m[1]}${m[2]}` } : { papel: null, apelido: null }
}

/** A régua do papel do título; a orquestradora com o modo ausente ligado segue a da planejadora. Sem papel, `null`. */
export function reguaDoPapel(titulo: string | null | undefined, ausente = false): Regua | null {
  const { papel } = papelEApelido(titulo)
  if (!papel) return null
  if (papel === 'orquestradora') return ausente ? REGUAS.orquestradoraAusente : REGUAS.orquestradora

  return REGUAS[papel]
}

export const corDoContexto = (tokens: number, regua: Regua | null): 'normal' | 'aviso' | 'teto' | null =>
  regua === null ? null : tokens >= regua.teto ? 'teto' : tokens >= regua.aviso ? 'aviso' : 'normal'

/** A moldura do cache: nunca com o turno rodando (o cache está sendo renovado); `null` sem resposta ainda. */
export function nivelDoCache(segundos: number | null, trabalhando: boolean): 'aviso' | 'alerta' | 'venceu' | null {
  if (segundos === null || trabalhando) return null
  if (segundos <= 0) return 'venceu'
  if (segundos <= ALERTA_MIN) return 'alerta'

  return segundos <= AVISO_MIN ? 'aviso' : null
}

const dois = (n: number) => String(n).padStart(2, '0')

export const relogio = (segundos: number | null): string =>
  segundos === null ? '—' : segundos <= 0 ? 'venceu' : `${dois(Math.floor(segundos / 60))}:${dois(segundos % 60)}`

/** As sessões do projeto que são a orquestradora: pelo `papel` ou pelo título `🎛 orquestradora`; o `projeto` não distingue caixa. */
export function orquestradorasDoProjeto(docs: Doc[], projeto: string | null): string[] {
  return docs
    .filter(d => mesmoProjeto(d.data.projeto, projeto) && (d.data.papel === 'orquestradora' || (texto(d.data.titulo) ?? '').startsWith('🎛 orquestradora')))
    .map(d => texto(d.data.sessionId) ?? d.id)
}

/**
 * O pedido `limpar · orquestradora` aberto de uma orquestradora do projeto (o `sessaoId` está em `ids`); com vários, o de
 * `atualizadoEm` mais recente. Não filtra pelo `projeto` da pergunta: a skill não obriga a gravá-lo.
 */
export function perguntaDeLimpeza(docs: Doc[], ids: string[], proprio?: string, agora?: number): PerguntaAberta | null {
  const doOk = (d: Doc) => (texto(d.data.titulo) ?? '').trim() === PEDIDO_TITULO && ids.includes(texto(d.data.sessaoId) ?? '')
  // O sim do painel dado há até 30 min (a janela da T7) atende só as abertas com `atualizadoEm` até o `respondidaEm` dele (o mais recente);
  // a aberta depois do ok volta, e `atualizadoEm` ilegível conta como anterior.
  const oks =
    agora === undefined
      ? []
      : docs
          .filter(d => d.data.estado === 'respondida' && doOk(d) && d.data.respondidaPor === 'painel' && (texto(d.data.resposta) ?? '').trim().toLowerCase().startsWith('sim'))
          .map(d => Date.parse(texto(d.data.respondidaEm) ?? ''))
          .filter(q => Number.isFinite(q) && agora - q <= OK_VALE_MS)
  const okDoPainel = oks.length > 0 ? Math.max(...oks) : -Infinity
  const quando = (d: Doc) => Date.parse(texto(d.data.atualizadoEm) ?? '') || 0
  const achadas = docs.filter(d => d.data.estado === 'aberta' && (texto(d.data.titulo) ?? '').trim() === PEDIDO_TITULO && ids.includes(texto(d.data.sessaoId) ?? '') && quando(d) > okDoPainel)
  const d = achadas.sort((a, b) => quando(b) - quando(a) || numero(b.id) - numero(a.id))[0]
  if (!d) return null
  const sessaoId = texto(d.data.sessaoId)

  return {
    id: d.id,
    projeto: (texto(d.data.projeto) ?? '?').toLowerCase(),
    sessao: texto(d.data.sessao) ?? '',
    titulo: PEDIDO_TITULO,
    versao: d.version,
    opcoes: [],
    sessaoId,
    propria: proprio !== undefined && sessaoId === proprio,
    caso: texto(d.data.caso),
    recomendacao: texto(d.data.recomendacao),
    seNaoDecidir: texto(d.data.seNaoDecidir),
    item: texto(d.data.item),
    atualizadoEm: texto(d.data.atualizadoEm),
  }
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

/** Sessões distintas no `com` dos itens vivos do projeto, por apelido: `E<n>` e `V<n>` (sem teto: a F49 o tirou). */
export function contarPool(docs: Doc[], projeto: string | null): { e: number; v: number } {
  const e = new Set<string>()
  const v = new Set<string>()
  for (const d of docs.filter(x => vivo(x) && mesmoProjeto(x.data.projeto, projeto))) {
    for (const c of (Array.isArray(d.data.com) ? d.data.com : []) as Array<Record<string, unknown> | null>) {
      const localId = texto(c?.localId)
      const apelido = texto(c?.apelido) ?? ''
      if (!localId) continue
      if (/^E\d/.test(apelido)) e.add(localId)
      else if (/^V\d/.test(apelido)) v.add(localId)
    }
  }

  return { e: e.size, v: v.size }
}

export const mostraLimparAntes = (a: { ehOrquestradora: boolean; segundos: number | null; trabalhando: boolean; tokens: number | null }): boolean =>
  a.ehOrquestradora && !a.trabalhando && a.segundos !== null && a.segundos >= 1 && a.segundos <= LIMPAR_ANTES_SEG && a.tokens !== null && a.tokens >= LIMPAR_ANTES_TOKENS

// ---- a faixa de largura ----

export type EstadoBarra = {
  /** O relógio já escrito (`47:12`, `—`, `…`, `venceu`), sem o glifo. */
  relogio: string
  tokens: number | null
  regua: Regua | null
  /** `F52 · design`, quando há item. */
  item: string | null
  /** `E 2 · V 1`, quando há projeto. */
  pool: string | null
  abertas: number
  /** `null` = a bandeira não se leu: sem botão do modo. */
  modo: 'presente' | 'ausente' | null
  trocando: boolean
  painelAberto: boolean
  moldura: boolean
}

type Peca<K extends string> = { k: K; t: string }
export type Pecas = { esq: Array<Peca<'relogio' | 'contexto' | 'item' | 'pool'>>; dir: Array<Peca<'perguntas' | 'modo' | 'painel'>> }

export const mil = (t: number) => Math.floor(t / 1000)

/** O texto do contexto na faixa: mil para baixo (nunca `150/150` antes de chegar); a palavra do aviso conta em todas as faixas. */
export function textoDoContexto(tokens: number, regua: Regua | null, faixa: 0 | 1 | 2): string {
  const cor = corDoContexto(tokens, regua)
  const palavra = cor === 'aviso' ? ' · alto' : cor === 'teto' ? ' · teto' : ''
  const numeros = regua && faixa < 2 ? `${mil(tokens)}/${mil(regua.teto)} mil` : `${mil(tokens)} mil`

  return `${faixa === 0 ? 'contexto ' : ''}${numeros}${palavra}`
}

export const rotuloDoSelo = (n: number) => `● ${n} ${n === 1 ? 'pergunta' : 'perguntas'}`
export const rotuloDoModo = (modo: 'presente' | 'ausente', trocando: boolean) =>
  trocando ? (modo === 'ausente' ? 'Ligando…' : 'Desligando…') : modo === 'ausente' ? '☾ Estou de volta' : 'Ficar ausente'
export const rotuloDoPainel = (aberto: boolean) => (aberto ? 'Fechar painel' : 'Abrir painel')

/** As peças de cada faixa (0 larga, 1 média, 2 estreita): o que cai quando aperta está decidido aqui, não no desenho. */
export function pecasDaBarra(e: EstadoBarra, faixa: 0 | 1 | 2): Pecas {
  const esq: Pecas['esq'] = [{ k: 'relogio', t: `⧗ ${e.relogio}` }]
  if (e.tokens !== null) esq.push({ k: 'contexto', t: textoDoContexto(e.tokens, e.regua, faixa) })
  if (faixa < 2 && e.item) esq.push({ k: 'item', t: e.item })
  if (faixa === 0 && e.pool) esq.push({ k: 'pool', t: e.pool })
  const dir: Pecas['dir'] = []
  const selo = e.abertas > 0
  if (selo) dir.push({ k: 'perguntas', t: rotuloDoSelo(e.abertas) })
  if (e.modo && (faixa < 2 || e.modo === 'ausente')) dir.push({ k: 'modo', t: rotuloDoModo(e.modo, e.trocando) })
  if (faixa < 2 || !selo) dir.push({ k: 'painel', t: rotuloDoPainel(e.painelAberto) })

  return { esq, dir }
}

/** A faixa mais rica cuja soma cabe, com os textos reais do momento; nenhuma cabendo, a 2 (o `flexWrap` quebra). */
export function faixaDaBarra(colunas: number, e: EstadoBarra): 0 | 1 | 2 {
  for (const f of [0, 1, 2] as const) {
    const { esq, dir } = pecasDaBarra(e, f)
    const ladoEsq = esq.reduce((n, p) => n + largura(p.t), 0) + 2 * (esq.length - 1)
    const ladoDir = dir.reduce((n, p) => n + largura(p.t) + 4, 0) + Math.max(0, dir.length - 1)
    if (ladoEsq + 2 + ladoDir + 2 + (e.moldura ? 2 : 0) <= colunas) return f
  }

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
  /** A pergunta cuja resposta está sendo enviada. */
  enviandoQ: string | null
  painelAberto: boolean
  isWorking: boolean
  bodyColumns: number
  /** `F52 · design`, quando esta sessão tem item. */
  item: string | null
}
export type AcoesDaBarra = {
  abrirPainel: () => void
  alternarPainel: () => void
  alternarModo: () => void
  darOk: (limpeza: PerguntaAberta) => void
  rascunho: () => void
}

const minutosQueFaltam = (segundos: number) => (segundos < 60 ? 'menos de 1 min' : `${Math.ceil(segundos / 60)} min`)

export function desenharBarra({ Box, Text, Button }: Elementos, d: DadosDaBarra, acoes: AcoesDaBarra) {
  const { b, modo, trocando, painelAberto, bodyColumns: colunas } = d
  const nivel = nivelDoCache(b.cache.segundos, d.isWorking)
  const lido = b.lidoEm !== null
  const regua = reguaDoPapel(b.titulo, modo === 'ausente')
  const estado: EstadoBarra = {
    relogio: d.isWorking ? '…' : relogio(b.cache.segundos),
    tokens: b.tokens,
    regua,
    item: d.item,
    pool: b.projeto ? `E ${b.pool.e} · V ${b.pool.v}` : null,
    abertas: lido ? b.abertas : 0,
    modo: lido ? modo : null,
    trocando,
    painelAberto,
    moldura: nivel !== null,
  }
  const faixa = faixaDaBarra(colunas, estado)
  const { esq, dir: direita } = pecasDaBarra(estado, faixa)
  // Antes da primeira leitura só o relógio: nada à direita, para o selo não piscar `0` → `3`.
  const dir = lido ? direita : []

  const pecaEsq = (p: Pecas['esq'][number]) => {
    if (p.k === 'relogio') {
      return nivel === 'alerta' || nivel === 'venceu' ? (
        <Text key="relogio" inverse bold>{` ${p.t} `}</Text>
      ) : nivel === 'aviso' ? (
        <Text key="relogio" bold>{p.t}</Text>
      ) : (
        <Text key="relogio">{p.t}</Text>
      )
    }
    if (p.k === 'contexto') {
      const cor = b.tokens !== null ? corDoContexto(b.tokens, regua) : null

      return cor === 'aviso' ? (
        <Text key="contexto" color="warning">{p.t}</Text>
      ) : cor === 'teto' ? (
        <Text key="contexto" color="error" bold>{p.t}</Text>
      ) : (
        <Text key="contexto" dimColor>{p.t}</Text>
      )
    }

    return <Text key={p.k} dimColor wrap={p.k === 'item' ? 'truncate-end' : undefined}>{p.t}</Text>
  }

  const botaoDir = (p: Pecas['dir'][number]) => {
    if (p.k === 'perguntas') {
      return (
        <Button key="perguntas" variant="secondary" onPress={acoes.abrirPainel}>
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

  // A linha do pedido, acima da barra: o pedido de limpeza vale para toda sessão do projeto; sem ele, "limpar antes de vencer".
  let linhaDoPedido = null
  if (b.limpeza) {
    const lim = b.limpeza
    const enviado = b.okEnviado === lim.id
    const frase = colunas < 61 ? 'Orquestradora pede limpeza' : colunas >= 94 ? `${FRASE_DO_PEDIDO} · ${lim.id}` : FRASE_DO_PEDIDO
    linhaDoPedido = (
      <Box key="linha-do-pedido" flexDirection="row" flexWrap="wrap" columnGap={2} alignItems="center">
        {enviado ? (
          <Text>
            <Text color="success">✓</Text>
            {' Ok enviado à orquestradora'}
          </Text>
        ) : (
          <Text>
            <Text color="warning">◆</Text>
            {` ${frase}`}
          </Text>
        )}
        {enviado ? null : (
          <Button key="limpar-pedido" variant="primary" onPress={() => acoes.darOk(lim)}>
            {d.enviandoQ === lim.id ? 'Enviando…' : ROTULO_LIMPAR}
          </Button>
        )}
      </Box>
    )
  } else if (b.cache.segundos !== null && mostraLimparAntes({ ehOrquestradora: b.ehOrquestradora, segundos: b.cache.segundos, trabalhando: d.isWorking, tokens: b.tokens })) {
    const frase = `Cache vence em ${minutosQueFaltam(b.cache.segundos)}`
    linhaDoPedido = (
      <Box key="linha-limpar-antes" flexDirection="row" flexWrap="wrap" columnGap={2} alignItems="center">
        <Text>
          <Text color="warning">◆</Text>
          {` ${colunas >= 76 && b.tokens !== null ? `${frase} com ${mil(b.tokens)} mil no contexto` : frase}`}
        </Text>
        <Button key="limpar-antes" variant="secondary" onPress={acoes.rascunho}>
          {ROTULO_LIMPAR_ANTES}
        </Button>
      </Box>
    )
  }
  const moldura = nivel ? { borderStyle: 'round' as const, borderColor: nivel === 'aviso' ? ('warning' as const) : ('error' as const) } : {}

  return (
    <Box flexDirection="column" paddingX={1} {...moldura}>
      {linhaDoPedido}
      <Box flexDirection="row" flexWrap="wrap" columnGap={2} alignItems="center">
        <Box flexDirection="row" columnGap={2}>
          {esq.map(pecaEsq)}
        </Box>
        <Box flexDirection="row" columnGap={1} flexGrow={1} justifyContent="flex-end">
          {dir.map(botaoDir)}
        </Box>
      </Box>
    </Box>
  )
}

/** A faixa do topo do pane com o pedido de limpeza (mesma pergunta e mesmo botão da barra). */
export function desenharPedidoNoPane(
  { Box, Text, Button }: Elementos,
  { limpeza, okEnviado, enviandoQ, agora }: { limpeza: PerguntaAberta | null; okEnviado: string | null; enviandoQ: string | null; agora: number },
  darOk: (limpeza: PerguntaAberta) => void,
) {
  if (!limpeza) return null
  const quando = desde(limpeza.atualizadoEm, agora)

  return (
    <Box key="pedido-de-limpeza" flexDirection="column" borderStyle="round" borderColor="warning" paddingX={1}>
      <Text bold>
        <Text color="warning">◆</Text>
        {` ${FRASE_DO_PEDIDO}`}
      </Text>
      <Text dimColor>{quando ? `${limpeza.id} · ${quando}` : limpeza.id}</Text>
      <Box flexDirection="row" justifyContent="flex-end">
        {okEnviado === limpeza.id ? (
          <Text color="success">✓ Ok enviado</Text>
        ) : (
          <Button key="limpar-pedido" variant="primary" onPress={() => darOk(limpeza)}>
            {enviandoQ === limpeza.id ? 'Enviando…' : ROTULO_LIMPAR}
          </Button>
        )}
      </Box>
    </Box>
  )
}
