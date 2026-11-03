// CONV-06 — a aba aberta mora no URL. `<Tabs defaultValue>` é o modo
// não-controlado do kit: compila, funciona, e não sobrevive ao F5 nem gera link
// para o que se está vendo.
import { linhaDe, semComentarios, tagsDeAbertura } from '../fonte.mjs'
import { TSX, violacao } from './_comum.mjs'

export function abasNaoControladas(fonte) {
  const codigo = semComentarios(fonte)
  return tagsDeAbertura(codigo, 'Tabs')
    .filter(({ tag }) => /\sdefaultValue=/.test(tag))
    .map(({ indice, tag }) => ({ linha: linhaDe(codigo, indice), trecho: tag }))
}

export default {
  id: 'a-aba-aberta-mora-na-url',
  regras: ['CONV-06'],
  titulo: 'A aba aberta mora no URL',
  padrao: {},
  examinar(p) {
    const fontes = p.fontes({ ext: TSX })
    const violacoes = fontes.flatMap(({ arquivo, texto }) =>
      abasNaoControladas(texto).map((a) => violacao(arquivo, a.linha, 'Tabs com defaultValue guarda a aba só na memória: controle pelo URL', a.trecho)),
    )
    return { examinados: fontes.length, violacoes }
  },
}
