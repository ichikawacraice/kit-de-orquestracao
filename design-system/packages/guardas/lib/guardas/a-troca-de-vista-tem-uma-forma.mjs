// CTRL-06 — a troca de vista tem UMA forma (`BarraDeModos`), e ninguém escreve
// a próxima à mão. Foram medidos 17 menus de troca de vista, 11 do mesmo padrão
// escritos à mão em quatro cascas: um botão dizendo com a própria tinta que é o
// escolhido de um grupo.
import { semComentarios } from '../fonte.mjs'
import { TSX, ocorrencias, violacao } from './_comum.mjs'

const VARIANTE_QUE_DIZ_ESCOLHIDO = /variant=\{[^}]*\?\s*['"](?:secondary|default)['"]\s*:\s*['"]ghost['"]\s*\}/g

/**
 * Um GRUPO, e não um botão que por acaso muda de tinta: duas ou mais
 * ocorrências no arquivo, ou uma dentro de um `.map(`.
 */
export function barraDeModosAMao(fonte) {
  const codigo = semComentarios(fonte)
  const achados = ocorrencias(codigo, VARIANTE_QUE_DIZ_ESCOLHIDO)
  if (achados.length === 0) return []
  const dentroDeMap = achados.some(({ m }) => codigo.slice(Math.max(0, m.index - 400), m.index).includes('.map('))
  return achados.length >= 2 || dentroDeMap ? achados : []
}

export default {
  id: 'a-troca-de-vista-tem-uma-forma',
  regras: ['CTRL-06'],
  titulo: 'A troca de vista tem uma forma',
  padrao: {},
  examinar(p) {
    const fontes = p.fontes({ ext: TSX, ignorar: [p.config.kit] })
    const violacoes = fontes.flatMap(({ arquivo, texto }) =>
      barraDeModosAMao(texto).map(({ linha, m }) => violacao(arquivo, linha, 'barra de modos à mão: use BarraDeModos', m[0])),
    )
    return { examinados: fontes.length, violacoes }
  },
}
