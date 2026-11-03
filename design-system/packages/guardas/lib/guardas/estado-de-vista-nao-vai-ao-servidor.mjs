// CONV-06 — estado de vista vive no URL e não pede nada ao servidor. Escrever o
// URL com `router.replace` re-renderiza a página no servidor: um clique de
// destaque custava 1,6 s e 954 KB. Estado de vista usa a função única do
// projeto (`history.replaceState(null, '', url)`); navegação é `router.push`.
import { semComentarios } from '../fonte.mjs'
import { CODIGO, ocorrencias, violacao } from './_comum.mjs'

export const REPLACE_DO_ROUTER = /\brouter\.replace\s*\(/g

export default {
  id: 'estado-de-vista-nao-vai-ao-servidor',
  regras: ['CONV-06'],
  titulo: 'Estado de vista não vai ao servidor',
  padrao: {},
  examinar(p) {
    const fontes = p.fontes({ ext: CODIGO })
    const violacoes = fontes.flatMap(({ arquivo, texto }) =>
      ocorrencias(semComentarios(texto), REPLACE_DO_ROUTER).map(({ linha, m }) =>
        violacao(arquivo, linha, 'router.replace re-renderiza no servidor: estado de vista vai por history.replaceState', m[0]),
      ),
    )
    return { examinados: fontes.length, violacoes }
  },
}
