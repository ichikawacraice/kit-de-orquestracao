// CASCO-02 — um menu só, o do kit. Nenhum arquivo de tela escreve a própria
// linha de menu (`function ItemDoMenu`) nem separa grupos por filete (`<hr`).
import { semComentarios } from '../fonte.mjs'
import { TSX, ocorrencias, violacao } from './_comum.mjs'

const A_MAO = [
  { re: /\bfunction\s+ItemDoMenu\b|\bconst\s+ItemDoMenu\s*=/g, msg: 'linha de menu escrita à mão: use ItemDoMenu do kit' },
  { re: /<hr\b/g, msg: 'filete separando grupo: o menu do kit separa sem linha' },
]

export default {
  id: 'um-menu-so',
  regras: ['CASCO-02'],
  titulo: 'Um menu só, o do kit',
  padrao: {},
  examinar(p) {
    const fontes = p.fontes({ ext: TSX, ignorar: [p.config.kit] })
    const violacoes = fontes.flatMap(({ arquivo, texto }) => {
      const codigo = semComentarios(texto)
      return A_MAO.flatMap(({ re, msg }) => ocorrencias(codigo, re).map(({ linha, m }) => violacao(arquivo, linha, msg, m[0])))
    })
    return { examinados: fontes.length, violacoes }
  },
}
