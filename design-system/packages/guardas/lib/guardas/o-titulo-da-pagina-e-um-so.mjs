// TIPO-04 — o título da página é um só, e é `h1` com a voz `t-display`. Dois
// títulos disputam a resposta a "onde estou"; voz escrita à mão não acompanha o
// sistema. A voz de título também só mora em `h1`.
import { linhaDe, semComentarios, tagsDeAbertura } from '../fonte.mjs'
import { TSX, ocorrencias, violacao } from './_comum.mjs'

export function titulos(fonte, voz) {
  const codigo = semComentarios(fonte)
  const achados = []
  const h1 = tagsDeAbertura(codigo, 'h1')
  for (const { indice, tag } of h1) {
    if (!new RegExp(`(?<![\\w-])${voz}(?![\\w-])`).test(tag)) achados.push({ linha: linhaDe(codigo, indice), msg: `h1 sem a voz ${voz}`, trecho: tag })
  }
  for (const { m, linha } of ocorrencias(codigo, new RegExp(`<(h[2-6])\\b[^>]*(?<![\\w-])${voz}(?![\\w-])`, 'g'))) {
    achados.push({ linha, msg: `a voz ${voz} é do título da tela, e o título é h1 (achada em ${m[1]})`, trecho: m[0] })
  }
  return { achados, h1: h1.length, codigo }
}

export default {
  id: 'o-titulo-da-pagina-e-um-so',
  regras: ['TIPO-04'],
  titulo: 'O título da página é um só, e é h1',
  padrao: { voz: 't-display' },
  examinar(p, op) {
    const fontes = p.fontes({ ext: TSX, ignorar: [p.config.kit] })
    const paginas = new Set(p.paginas().map((x) => x.arquivo))
    const violacoes = fontes.flatMap(({ arquivo, texto }) => {
      const { achados, h1, codigo } = titulos(texto, op.voz)
      const v = achados.map((a) => violacao(arquivo, a.linha, a.msg, a.trecho))
      if (paginas.has(arquivo) && h1 > 1) {
        const segundo = tagsDeAbertura(codigo, 'h1')[1]
        v.push(violacao(arquivo, linhaDe(codigo, segundo.indice), `a página declara ${h1} h1: o título é um só`, segundo.tag))
      }
      return v
    })
    return { examinados: fontes.length, violacoes }
  },
}
