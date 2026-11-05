"use client"

// O filtro da Lista lembrado no navegador (CONV-26): a tela volta como a pessoa
// a deixou. A chave tem versão e dono (app, tela, quem vê e o registro pai
// quando há); sem saber quem vê, não grava. Grava só no gesto (`mudar`,
// `limpar`): ler não grava, e o recorte igual ao padrão apaga a chave. Ao ler,
// confere campo a campo pelo esquema: o inválido volta ao padrão, o ilegível é
// apagado. Sem armazenamento (aba privada, cota cheia), o filtro vale só na
// memória, sem aviso. Busca de texto e data fixa não entram: ficam num estado
// da tela, fora do esquema.

import * as React from "react"

export const PREFIXO_DOS_FILTROS = "wicomm-filtros"

/** Devolve o valor saneado, ou `undefined` para voltar ao padrão. */
export type Validador<V> = (bruto: unknown) => V | undefined

/** Um validador por campo do filtro: o que não está aqui não se grava nem se lê. */
export type Esquema<F> = { readonly [K in keyof F]-?: Validador<F[K]> }

export interface DonoDoFiltro {
  /** O app, para dois apps no mesmo domínio não dividirem a chave. */
  app: string
  /** A tela da Lista. */
  tela: string
  /** Sobe quando o formato do filtro muda: a chave velha deixa de ser lida. */
  versao: number
  /** Quem vê (o id, nunca token, sessão ou e-mail). `undefined`: ainda não se sabe; `null`: não há como separar, e não grava. */
  pessoa: string | null | undefined
  /** O id do registro pai, quando a Lista é de dentro de um registro. */
  registro?: string
}

const pedacoValido = (p: unknown): p is string => typeof p === "string" && p.length > 0

/** A chave do filtro, ou `null` quando não há como dizer de quem ele é. */
export function chaveDoFiltro(dono: DonoDoFiltro): string | null {
  const { app, tela, versao, pessoa, registro } = dono
  if (!Number.isInteger(versao) || versao < 1) return null
  const pedacos = registro === undefined ? [app, tela, pessoa] : [app, tela, pessoa, registro]
  if (!pedacos.every(pedacoValido)) return null
  const [a, t, ...resto] = pedacos.map((p) => encodeURIComponent(p as string))
  return [PREFIXO_DOS_FILTROS, a, t, `v${versao}`, ...resto].join(":")
}

/** Uma das opções conhecidas. */
export function umaDas<T extends string>(opcoes: readonly T[]): Validador<T> {
  return (bruto) => (opcoes as readonly unknown[]).includes(bruto) ? (bruto as T) : undefined
}

/**
 * Algumas das opções conhecidas, sem repetir. A lista vazia gravada vale; a
 * que fica vazia porque nenhuma opção existe mais volta ao padrão, para não
 * virar um filtro que ninguém escolheu.
 */
export function algumasDas<T extends string>(opcoes: readonly T[]): Validador<T[]> {
  const conhecida = umaDas(opcoes)
  return (bruto) => {
    if (!Array.isArray(bruto)) return undefined
    const validas = [...new Set(bruto.filter((v) => conhecida(v) !== undefined) as T[])]
    return bruto.length > 0 && validas.length === 0 ? undefined : validas
  }
}

/** Ligado ou desligado. */
export const verdadeiroOuFalso: Validador<boolean> = (bruto) => (typeof bruto === "boolean" ? bruto : undefined)

/** Cópia do padrão que não divide as listas com quem o declarou. */
function copia<F>(padrao: F): F {
  const saida = { ...padrao }
  for (const campo of Object.keys(saida as object) as (keyof F)[]) {
    const v = saida[campo] as unknown
    if (Array.isArray(v)) saida[campo] = [...v] as F[keyof F]
  }
  return saida
}

const ehObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v)

/** Confere campo a campo: o inválido volta ao padrão e os outros ficam. */
export function sanearFiltros<F>(bruto: unknown, padrao: F, esquema: Esquema<F>): F {
  const saida = copia(padrao)
  if (!ehObjeto(bruto)) return saida
  for (const campo of Object.keys(padrao as object) as (keyof F)[]) {
    if (!Object.prototype.hasOwnProperty.call(bruto, campo)) continue
    const valor = esquema[campo](bruto[campo as string])
    if (valor !== undefined) saida[campo] = valor
  }
  return saida
}

/** Lê o filtro gravado; o ilegível é apagado e a tela abre no padrão. Ler nunca grava. */
export function lerFiltros<F>(chave: string, padrao: F, esquema: Esquema<F>): F {
  let texto: string | null
  try {
    texto = localStorage.getItem(chave)
  } catch {
    return copia(padrao)
  }
  if (texto === null) return copia(padrao)
  let bruto: unknown
  try {
    bruto = JSON.parse(texto)
  } catch {
    bruto = undefined
  }
  if (!ehObjeto(bruto)) {
    apagarFiltros(chave)
    return copia(padrao)
  }
  return sanearFiltros(bruto, padrao, esquema)
}

/** Grava só os campos do padrão; o recorte igual ao padrão apaga a chave. */
export function gravarFiltros<F>(chave: string, filtros: F, padrao: F): void {
  if (igualAoPadrao(filtros, padrao)) return apagarFiltros(chave)
  const gravado: Partial<F> = {}
  for (const campo of Object.keys(padrao as object) as (keyof F)[]) gravado[campo] = filtros[campo]
  try {
    localStorage.setItem(chave, JSON.stringify(gravado))
  } catch {
    // Sem armazenamento (aba privada, cota cheia): vale só na memória, e o
    // gravado antes não volta no F5 no lugar do último recorte.
    apagarFiltros(chave)
  }
}

export function apagarFiltros(chave: string): void {
  try {
    localStorage.removeItem(chave)
  } catch {
    // Sem armazenamento: não há o que apagar.
  }
}

/** Igual ao padrão campo a campo; lista compara como conjunto. */
export function igualAoPadrao<F>(filtros: F, padrao: F): boolean {
  return (Object.keys(padrao as object) as (keyof F)[]).every((campo) => {
    const a = filtros[campo] as unknown
    const b = padrao[campo] as unknown
    if (Array.isArray(a) && Array.isArray(b)) {
      const sa = new Set(a)
      const sb = new Set(b)
      return sa.size === sb.size && [...sa].every((v) => sb.has(v))
    }
    return Object.is(a, b)
  })
}

export type ValorDeFiltro = string | boolean | readonly string[]

export interface FiltroLembrado<F> {
  filtros: F
  /** `false` enquanto não leu: a região fica em carregando, nunca sem filtro. */
  lido: boolean
  /** Mostra o *Limpar filtros*. */
  foraDoPadrao: boolean
  /** O gesto da pessoa: muda e grava. Antes de ler, não vale. */
  mudar: (parcial: Partial<F>) => void
  /** Volta ao padrão e apaga a chave. */
  limpar: () => void
}

const SO_NA_MEMORIA = "\u0000memoria"

/**
 * O filtro da Lista lembrado por tela e por quem vê. `padrao` e `esquema`
 * podem ser recriados a cada desenho: só a chave e `aguardar` fazem reler.
 * Passe `aguardar` enquanto as opções ou o URL não chegaram. O filtro que veio
 * no URL vai em `doUrl` e vence o lembrado: com ele, a tela abre no padrão mais
 * o do URL (saneado), sem ler nem gravar; o gesto seguinte grava o recorte
 * inteiro que a pessoa vê. A leitura é depois da hidratação, num efeito.
 */
export function useFiltroLembrado<F extends Record<string, ValorDeFiltro>>(
  opcoes: DonoDoFiltro & { padrao: F; esquema: Esquema<F>; aguardar?: boolean; doUrl?: Partial<F> | null },
): FiltroLembrado<F> {
  const { app, tela, versao, pessoa, registro, padrao, esquema, aguardar = false, doUrl } = opcoes
  const chave = pessoa === undefined ? undefined : chaveDoFiltro({ app, tela, versao, pessoa, registro })
  const marca = chave === undefined || aguardar ? undefined : (chave ?? SO_NA_MEMORIA)

  const [estado, setEstado] = React.useState<{ marca: string | undefined; filtros: F }>(() => ({
    marca: undefined,
    filtros: padrao,
  }))
  const lido = marca !== undefined && estado.marca === marca

  const atual = React.useRef({ chave, marca, lido, padrao, esquema, doUrl, filtros: estado.filtros })
  React.useLayoutEffect(() => {
    atual.current = { ...atual.current, chave, marca, lido, padrao, esquema, doUrl }
  })

  React.useLayoutEffect(() => {
    if (marca === undefined) {
      // Voltou a não saber de quem é: a próxima chave relê, sem passar pelo velho.
      setEstado((e) => (e.marca === undefined ? e : { marca: undefined, filtros: e.filtros }))
      return
    }
    const { padrao: p, esquema: e, doUrl: u } = atual.current
    const temUrl = u != null && Object.keys(u).length > 0
    const filtros = temUrl
      ? sanearFiltros({ ...p, ...u }, p, e)
      : marca === SO_NA_MEMORIA
        ? copia(p)
        : lerFiltros(marca, p, e)
    atual.current = { ...atual.current, filtros }
    setEstado({ marca, filtros })
  }, [marca])

  const mudar = React.useCallback((parcial: Partial<F>) => {
    const { chave: c, marca: m, lido: l, padrao: p, filtros: f } = atual.current
    if (!l) return
    const proximos = { ...f, ...parcial }
    atual.current = { ...atual.current, filtros: proximos }
    setEstado({ marca: m, filtros: proximos })
    if (c) gravarFiltros(c, proximos, p)
  }, [])

  const limpar = React.useCallback(() => {
    const { chave: c, marca: m, lido: l, padrao: p } = atual.current
    if (!l) return
    const proximos = copia(p)
    atual.current = { ...atual.current, filtros: proximos }
    setEstado({ marca: m, filtros: proximos })
    if (c) apagarFiltros(c)
  }, [])

  const filtros = lido ? estado.filtros : padrao
  return { filtros, lido, foraDoPadrao: !igualAoPadrao(filtros, padrao), mudar, limpar }
}
