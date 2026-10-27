import type { Barra } from '../types'

// A barra de status acima do prompt: o relógio do cache de 1 h, o contexto contra a janela de compactação, o selo das perguntas
// abertas, o botão de limpar (só na orquestradora), o do modo ausente e o do painel, cada um com glifo e cor. Só lê arquivos
// (a cada 30 s e a cada turno); o `list_sessions` fica para o pane aberto. O clique de limpar manda o prompt à própria sessão.

type Doc = { id: string; data: Record<string, unknown>; version?: number }
export type Regua = { aviso: number; teto: number }

export const CACHE_TTL_MS = 3_600_000
export const LEITURA_MS = 30_000
export const AVISO_MIN = 20 * 60
const ALERTA_MIN = 10 * 60
export const BANDEIRA_DO_APP = 'Library/Application Support/Claude/claude-code-sessions'

/** O que o clique de limpar manda à própria sessão (o prompt chega com origem `plugin`; o ok que a T7 lê é o arquivo gravado antes). */
export const PROMPT_DE_LIMPAR = 'O operador mandou limpar pelo botão da barra: grave o estado (handoff do que estiver aberto) e limpe-se com clear_session "self".'
/** O `Limpando…` segue até a leitura ver o contexto abaixo disto, ou até `LIMPANDO_MAX_MS`. */
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
/** As palavras do contexto: só elas levam cor; o denominador é a janela, a régua do papel só dá a palavra. */
export const PALAVRA_ALTO = ' · alto'
export const PALAVRA_LIMPAR = ' · limpar'

/**
 * As réguas de contexto por papel, as mesmas do hook `contexto-do-papel` (um teste da raiz compara): `aviso` marca `· alto`,
 * `teto` marca `· limpar`; nenhum dos dois é o denominador (esse é a janela de compactação). Sem faixa intermediária
 * (executora, orquestradora), aviso e teto coincidem.
 */
export const REGUAS = {
  E: { aviso: 300_000, teto: 300_000 },
  P: { aviso: 350_000, teto: 500_000 },
  D: { aviso: 350_000, teto: 500_000 },
  V: { aviso: 350_000, teto: 500_000 },
  orquestradora: { aviso: 150_000, teto: 150_000 },
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
  /** `E 2 · V 1`, quando há projeto. */
  pool: string | null
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
}

type Peca<K extends string> = { k: K; t: string }
export type Pecas = {
  esq: Array<Peca<'relogio' | 'contexto' | 'item' | 'pool'>>
  dir: Array<Peca<'perguntas' | 'limpar' | 'modo' | 'painel'>>
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
export const rotuloDoLimpar = (limpando: boolean) => `${GLIFO.limpar.g} ${limpando ? 'Limpando…' : 'Limpar'}`
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
  if (faixa === 0 && e.pool) esq.push({ k: 'pool', t: e.pool })
  // Ordem da direita: selo → limpar → modo → painel. O limpar nunca cai; o modo ausente nunca cai; o presente cai na faixa 2.
  const dir: Pecas['dir'] = []
  const selo = e.abertas > 0
  if (selo) dir.push({ k: 'perguntas', t: rotuloDoSelo(e.abertas) })
  if (e.ehOrquestradora) dir.push({ k: 'limpar', t: rotuloDoLimpar(e.limpando) })
  if (e.modo && (e.modo === 'ausente' ? true : faixa < 2)) dir.push({ k: 'modo', t: rotuloDoModo(e.modo, e.trocando) })
  if (faixa < 2 || !selo) dir.push({ k: 'painel', t: rotuloDoPainel(e.painelAberto) })

  return { esq, dir }
}

/** A largura que a faixa pede, com os textos reais: peça à esquerda com 2 de vão, botão com `[ ]` (+4), texto sem, a moldura +2. */
export function larguraDaFaixa(e: EstadoBarra, faixa: 0 | 1 | 2): number {
  // O limpar conta sempre como `↺ Limpando…`: a barra não se rearruma debaixo do clique.
  const { esq, dir } = pecasDaBarra({ ...e, limpando: true }, faixa)
  const ladoEsq = esq.reduce((n, p) => n + largura(p.t), 0) + 2 * (esq.length - 1)
  const ladoDir = dir.reduce((n, p) => n + largura(p.t) + 4, 0) + Math.max(0, dir.length - 1)

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
    pool: b.projeto ? `E ${b.pool.e} · V ${b.pool.v}` : null,
    abertas: lido ? b.abertas : 0,
    modo: lido ? modo : null,
    trocando,
    painelAberto,
    moldura: nivel !== null,
    ehOrquestradora: b.ehOrquestradora,
    limpando: d.limpando,
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
