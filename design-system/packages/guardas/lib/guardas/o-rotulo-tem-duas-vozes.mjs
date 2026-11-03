// TIPO-02 — o rótulo tem duas vozes (`t-rotulo` nomeia um conjunto, `t-coluna`
// nomeia um valor), e nenhuma se escreve à mão. Caixa alta escrita à mão
// divergiu em 11 formas no produto de origem, e a tinta à mão fica abaixo do
// piso sobre as tintas das vozes no escuro.
import { semComentarios } from '../fonte.mjs'
import { CODIGO, violacao } from './_comum.mjs'

const A_MAO = /(?<![\w-])uppercase\b/
/** Capitalizar a primeira letra de uma frase não é rótulo. */
const PRIMEIRA_LETRA = /first-letter:uppercase/g

export default {
  id: 'o-rotulo-tem-duas-vozes',
  regras: ['TIPO-02'],
  titulo: 'O rótulo tem duas vozes, e nenhuma se escreve à mão',
  padrao: {},
  examinar(p) {
    const fontes = p.fontes({ ext: CODIGO })
    const violacoes = fontes.flatMap(({ arquivo, texto }) =>
      semComentarios(texto)
        .split('\n')
        .flatMap((l, i) => (A_MAO.test(l.replace(PRIMEIRA_LETRA, '')) ? [violacao(arquivo, i + 1, 'caixa alta à mão: use t-rotulo ou t-coluna', l)] : [])),
    )
    return { examinados: fontes.length, violacoes }
  },
}
