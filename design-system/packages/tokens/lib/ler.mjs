// Lê a fonte DTCG (sistema + marca) e resolve cada token por tema.
//
// A marca entra por um arquivo separado, e é por isso que o caminho dela é um
// parâmetro: trocar a marca é passar outro arquivo, e nada no sistema muda.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export const FONTE = join(import.meta.dirname, '..', 'fonte')
export const MARCA_PADRAO = join(FONTE, 'marca.tokens.json')
export const TEMAS = ['claro', 'escuro']

const ALIAS = /^\{([^{}]+)\}$/

function lerJson(caminho) {
  return JSON.parse(readFileSync(caminho, 'utf8'))
}

/** Junta sistema e marca numa árvore só; a marca não pode redefinir grupo do sistema. */
export function lerFonte({ marca = MARCA_PADRAO } = {}) {
  const sistema = lerJson(join(FONTE, 'sistema.tokens.json'))
  const daMarca = lerJson(marca)
  const chaves = Object.keys(daMarca).filter((k) => !k.startsWith('$'))
  if (chaves.length !== 1 || chaves[0] !== 'marca') {
    throw new Error(`o arquivo de marca declara só o grupo \`marca\` (achei: ${chaves.join(', ')})`)
  }
  if ('marca' in sistema) throw new Error('o sistema não declara o grupo `marca`: ele mora no slot')
  return { ...sistema, marca: daMarca.marca }
}

const ehToken = (no) => no !== null && typeof no === 'object' && '$value' in no

/** Cada folha com `$value`, com o caminho em pontos e o `$type` herdado do grupo. */
export function folhas(arvore, prefixo = [], tipo) {
  const saida = []
  for (const [chave, no] of Object.entries(arvore)) {
    if (chave.startsWith('$') || no === null || typeof no !== 'object') continue
    const caminho = [...prefixo, chave]
    const t = no.$type ?? tipo
    if (ehToken(no)) saida.push({ caminho: caminho.join('.'), chave, tipo: t, no })
    else saida.push(...folhas(no, caminho, t))
  }
  return saida
}

function acha(arvore, caminho) {
  let no = arvore
  for (const parte of caminho.split('.')) {
    no = no?.[parte]
    if (no === undefined) return undefined
  }
  return ehToken(no) ? no : undefined
}

/** O valor cru de um token num tema: o `escuro` da extensão, quando há, senão o `$value`. */
export function cru(no, tema) {
  const escuro = no.$extensions?.['com.wicomm']?.escuro
  return tema === 'escuro' && escuro !== undefined ? escuro : no.$value
}

/** O alvo de um alias (`{cor.card}` → `cor.card`), ou null. */
export function alvo(valor) {
  return typeof valor === 'string' ? (ALIAS.exec(valor)?.[1] ?? null) : null
}

/**
 * Resolve um valor num tema, seguindo aliases (também dentro de objetos
 * compostos). O alias resolve NO MESMO TEMA: `{cor.foreground}` no escuro é o
 * foreground do escuro.
 */
export function resolver(arvore, valor, tema, vistos = []) {
  const ref = alvo(valor)
  if (ref) {
    if (vistos.includes(ref)) throw new Error(`alias em ciclo: ${[...vistos, ref].join(' → ')}`)
    const no = acha(arvore, ref)
    if (!no) throw new Error(`alias para token que não existe: {${ref}}`)
    return resolver(arvore, cru(no, tema), tema, [...vistos, ref])
  }
  if (Array.isArray(valor)) return valor.map((v) => resolver(arvore, v, tema, vistos))
  if (valor !== null && typeof valor === 'object') {
    return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, resolver(arvore, v, tema, vistos)]))
  }
  return valor
}

/**
 * Os grupos que viram variável CSS de tema. A chave da folha é o nome da
 * variável, sem `--`. `raio` não muda por tema e só sai no claro (`:root`).
 */
export const GRUPOS_DE_VARIAVEL = ['cor', 'composto', 'sombra', 'raio']
export const GRUPOS_SO_NO_CLARO = ['raio']

/** As variáveis CSS resolvidas de cada tema: `{ claro: {'--x': v}, escuro: {...} }`. */
export function variaveis(arvore) {
  const saida = { claro: {}, escuro: {} }
  for (const grupo of GRUPOS_DE_VARIAVEL) {
    for (const f of folhas(arvore[grupo] ?? {}, [grupo])) {
      for (const tema of TEMAS) {
        if (tema === 'escuro' && GRUPOS_SO_NO_CLARO.includes(grupo)) continue
        saida[tema][`--${f.chave}`] = resolver(arvore, cru(f.no, tema), tema)
      }
    }
  }
  return saida
}

/** Os tokens do sistema que apontam para a marca (direto ou por cadeia de alias). */
export function apontamParaMarca(arvore) {
  const saida = []
  for (const grupo of GRUPOS_DE_VARIAVEL) {
    for (const f of folhas(arvore[grupo] ?? {}, [grupo])) {
      let ref = alvo(f.no.$value)
      const vistos = []
      while (ref && !vistos.includes(ref)) {
        vistos.push(ref)
        if (ref.startsWith('marca.')) {
          saida.push(`--${f.chave}`)
          break
        }
        ref = alvo(acha(arvore, ref)?.$value)
      }
    }
  }
  return saida
}
