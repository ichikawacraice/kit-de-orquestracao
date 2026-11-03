// A catraca: a linha de base versionada que deixa a guarda ligar no dia 1 de
// um projeto que já existe sem quebrar o CI, e faz a padronização só andar
// para a frente (estudo F261, seção 2.4; modelo do betterer).
//
// A base guarda, por guarda e por arquivo, quantas violações ele tinha. A
// conferência reprova três coisas: violação NOVA (arquivo ou guarda fora da
// base), contagem que SOBE e contagem que DESCE sem a base regravada. A
// conferência nunca escreve a base: no CI o arquivo reescrito se perderia com
// a máquina, e o PR seguinte poderia voltar a violar até o número antigo.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export const VERSAO_DA_BASE = 1

/** `{ guarda: { arquivo: n } }` a partir dos resultados, só com contagem > 0. */
export function contagem(resultados) {
  const c = {}
  for (const r of resultados) {
    for (const v of r.violacoes) {
      c[r.id] ??= {}
      c[r.id][v.arquivo] = (c[r.id][v.arquivo] ?? 0) + 1
    }
  }
  return ordenar(c)
}

function ordenar(c) {
  return Object.fromEntries(
    Object.keys(c)
      .sort()
      .filter((g) => Object.keys(c[g]).length > 0)
      .map((g) => [g, Object.fromEntries(Object.keys(c[g]).sort().map((a) => [a, c[g][a]]))]),
  )
}

/** Lê a base; sem arquivo, a base é zero (projeto novo). */
export function lerBase(caminho) {
  if (!existsSync(caminho)) return { existe: false, guardas: {} }
  const lido = JSON.parse(readFileSync(caminho, 'utf8'))
  if (lido.versao !== VERSAO_DA_BASE) throw new Error(`a base ${caminho} tem versão ${lido.versao}; esta catraca lê a ${VERSAO_DA_BASE}`)
  return { existe: true, guardas: lido.guardas ?? {} }
}

export function gravarBase(caminho, guardas) {
  mkdirSync(dirname(caminho), { recursive: true })
  writeFileSync(caminho, `${JSON.stringify({ versao: VERSAO_DA_BASE, guardas: ordenar(guardas) }, null, 2)}\n`)
}

/**
 * Compara a contagem atual com a base. Devolve as três listas que reprovam:
 * `novas` (base 0), `subiram` e `desceram` (a base ficou para trás).
 */
export function comparar(atual, base) {
  const novas = []
  const subiram = []
  const desceram = []
  const guardas = new Set([...Object.keys(atual), ...Object.keys(base)])
  for (const g of [...guardas].sort()) {
    const a = atual[g] ?? {}
    const b = base[g] ?? {}
    for (const arquivo of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
      const agora = a[arquivo] ?? 0
      const antes = b[arquivo] ?? 0
      const item = { guarda: g, arquivo, antes, agora }
      if (agora > antes) (antes === 0 ? novas : subiram).push(item)
      else if (agora < antes) desceram.push(item)
    }
  }
  return { novas, subiram, desceram }
}

/**
 * A base que `--atualizar` grava: só a DESCIDA entra. Cada entrada fica com o
 * menor entre a base e o atual; o que subiu ou é novo não entra, e continua
 * reprovando. A catraca não tem marcha a ré pela linha de comando: piorar a
 * base é editar o arquivo à mão, num PR que alguém revisa.
 */
export function baseAtualizada(atual, base) {
  const nova = {}
  for (const [g, arquivos] of Object.entries(base)) {
    for (const [arquivo, antes] of Object.entries(arquivos)) {
      const agora = atual[g]?.[arquivo] ?? 0
      const fica = Math.min(antes, agora)
      if (fica > 0) {
        nova[g] ??= {}
        nova[g][arquivo] = fica
      }
    }
  }
  return ordenar(nova)
}
