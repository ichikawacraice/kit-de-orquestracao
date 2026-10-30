// CONV-12 — o glossário da tela pode não ser o do código, e o descasamento é
// declarado. Cada par vira uma cobrança: a palavra do código não aparece em
// texto que a pessoa lê. Sem glossário declarado não há o que cobrar, e a
// guarda pede a lista ou o desligamento com motivo.
import { CODIGO, exigir, violacao } from './_comum.mjs'
import { textoVisivel } from './o-texto-da-tela-nao-cita-documento.mjs'

export default {
  id: 'o-vocabulario-da-tela',
  regras: ['CONV-12'],
  titulo: 'O vocabulário da tela',
  // `glossario`: [{ codigo: 'regex da palavra do código', tela: 'a palavra da tela', motivo }]
  padrao: { glossario: [] },
  examinar(p, op) {
    const glossario = exigir(op, 'glossario', 'os pares palavra do código → palavra da tela')
    const erros = glossario.filter((g) => !g.codigo || !g.tela).map((g) => `par do glossário incompleto: ${JSON.stringify(g)}`)
    const fontes = p.fontes({ ext: CODIGO })
    let textos = 0
    const violacoes = fontes.flatMap(({ arquivo, texto }) => {
      const visiveis = textoVisivel(texto)
      textos += visiveis.length
      return visiveis.flatMap((t) =>
        glossario.filter((g) => g.codigo && new RegExp(g.codigo, 'u').test(t.texto)).map((g) => violacao(arquivo, t.linha, `na tela a palavra é "${g.tela}"`, t.texto)),
      )
    })
    return { examinados: textos, violacoes, erros }
  },
}
