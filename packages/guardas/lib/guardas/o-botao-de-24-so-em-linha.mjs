// CTRL-01 — a escala do kit. O botão de ícone de 24px (`size="icon-xs"`) existe
// só para ação DENTRO de linha de lista; fora dela, o menor botão de ícone é o
// `icon` de 30. Quem pode usar fica nas exceções, dizendo qual linha desenha.
import { semComentarios } from '../fonte.mjs'
import { TSX, ocorrencias, violacao } from './_comum.mjs'

const USO = /\bsize=["']icon-xs["']/g

export default {
  id: 'o-botao-de-24-so-em-linha',
  regras: ['CTRL-01'],
  titulo: 'O botão de 24px só mora em linha de lista',
  padrao: {},
  examinar(p) {
    const fontes = p.fontes({ ext: TSX, ignorar: [p.config.kit] })
    const violacoes = fontes.flatMap(({ arquivo, texto }) =>
      ocorrencias(semComentarios(texto), USO).map(({ linha, m }) =>
        violacao(arquivo, linha, 'icon-xs fora de linha de lista: o menor botão de ícone é o icon de 30 (ou declare a linha nas exceções)', m[0]),
      ),
    )
    return { examinados: fontes.length, violacoes }
  },
}
