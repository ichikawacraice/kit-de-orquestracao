// O que as guardas repetem: a forma da violação e a varredura linha a linha.
import { linhaDe, resumo } from '../fonte.mjs'

export const TSX = /\.[jt]sx$/
export const CODIGO = /\.(tsx?|jsx?)$/

/** Uma violação: arquivo, linha, o que está errado e o trecho que prova. */
export function violacao(arquivo, linha, mensagem, trecho = '') {
  return { arquivo, linha, mensagem, trecho: resumo(trecho) }
}

/** Toda ocorrência de `re` (com `g`) no texto, com a linha. */
export function ocorrencias(texto, re) {
  return [...texto.matchAll(re)].map((m) => ({ m, linha: linhaDe(texto, m.index) }))
}

/** A linha do texto onde está a posição, inteira. */
export function linhaInteira(texto, indice) {
  const ini = texto.lastIndexOf('\n', indice - 1) + 1
  const fim = texto.indexOf('\n', indice)
  return texto.slice(ini, fim === -1 ? texto.length : fim)
}

/**
 * Os componentes que um arquivo exporta pelo nome com inicial maiúscula:
 * `export { A, B }`, `export function A`, `export const A`.
 */
export function exportadosComMaiuscula(fonte) {
  const nomes = new Set()
  for (const m of fonte.matchAll(/^export\s*\{([^}]+)\}/gm)) {
    for (const n of m[1].split(',')) {
      const nome = n.trim().replace(/^type\s+/, '').split(/\s+as\s+/).pop().trim()
      if (/^[A-Z]\w*$/.test(nome)) nomes.add(nome)
    }
  }
  for (const m of fonte.matchAll(/^export\s+(?:default\s+)?(?:async\s+)?(?:function|const|let|class)\s+([A-Z]\w*)/gm)) nomes.add(m[1])
  return [...nomes]
}

/** Os especificadores de import de um arquivo (estático, dinâmico e reexport). */
export function especificadores(fonte) {
  return [
    ...[...fonte.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((m) => m[1]),
    ...[...fonte.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]),
    ...[...fonte.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]),
  ]
}

/**
 * Página que só redireciona (porta, não tela): importa `redirect` do Next e
 * não devolve JSX.
 */
export function ehPorta(fonte) {
  return /import\s*\{[^}]*\b(redirect|permanentRedirect)\b[^}]*\}\s*from\s*['"]next\/navigation['"]/.test(fonte) && !/return\s*\(?\s*</.test(fonte)
}

/** Exige uma lista de configuração; vazia, a guarda não pode valer e diz o que falta. */
export function exigir(op, chave, dica) {
  const v = op[chave]
  if (!v || (Array.isArray(v) && v.length === 0) || (typeof v === 'object' && Object.keys(v).length === 0)) {
    throw new Error(`falta configurar "${chave}" (${dica}), ou desligue a guarda com motivo`)
  }
  return v
}
