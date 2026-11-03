// SUP-04 — toda superfície se declara (`data-superficie`), e o conteúdo de toda
// página mora numa superfície. Duas metades: (1) a página alcança uma peça de
// superfície do kit em até dois níveis de import; (2) quem aplica a classe de
// superfície à mão emite `data-superficie`. A lista de peças de superfície é
// DERIVADA do kit (quem emite `data-superficie`), e lista vazia é erro: sem ela
// a expressão casaria qualquer tag.
import { semComentarios, valoresDeClassName, linhaDe } from '../fonte.mjs'
import { TSX, ehPorta, especificadores, exportadosComMaiuscula, violacao } from './_comum.mjs'

const CLASSE_DE_SUPERFICIE = /(?:^|[\s"'`])superficie(?:-alta|-flutuante)?(?=[\s"'`]|$)/

export function superficieAMao(fonte) {
  const codigo = semComentarios(fonte)
  if (codigo.includes('data-superficie')) return []
  return valoresDeClassName(codigo)
    .filter(({ valor }) => CLASSE_DE_SUPERFICIE.test(valor))
    .map(({ indice, valor }) => ({ linha: linhaDe(codigo, indice), trecho: valor }))
}

export default {
  id: 'conteudo-mora-em-superficie',
  regras: ['SUP-04'],
  titulo: 'O conteúdo mora em superfície, e a superfície se declara',
  // `superficies`: as peças, quando o kit não as deriva; `niveis`: até onde se segue o import.
  padrao: { superficies: null, niveis: 2 },
  examinar(p, op) {
    const kit = p.fontes({ ext: TSX, em: [p.config.kit] })
    const pecas = op.superficies ?? kit.filter((f) => f.texto.includes('data-superficie')).flatMap((f) => exportadosComMaiuscula(f.texto))
    if (pecas.length === 0) throw new Error(`nenhuma peça de superfície: nenhum arquivo de ${p.config.kit} emite data-superficie (configure "superficies")`)
    const tag = new RegExp(`<(${pecas.join('|')})[\\s/>]`)
    const alcanca = (arquivo, nivel, visto) => {
      if (nivel > op.niveis || visto.has(arquivo)) return false
      visto.add(arquivo)
      const texto = p.ler(arquivo)
      if (tag.test(semComentarios(texto))) return true
      return especificadores(texto).some((s) => {
        const alvo = p.resolverImport(arquivo, s)
        return alvo ? alcanca(alvo, nivel + 1, visto) : false
      })
    }
    const paginas = p.paginas().filter((x) => !ehPorta(x.texto))
    const telas = p.fontes({ ext: TSX, ignorar: [p.config.kit] })
    const violacoes = [
      ...paginas
        .filter((pg) => !alcanca(pg.arquivo, 0, new Set()))
        .map((pg) => violacao(pg.arquivo, 1, `/${pg.rota.join('/')} não alcança peça de superfície em até ${op.niveis} níveis`)),
      ...telas.flatMap(({ arquivo, texto }) =>
        superficieAMao(texto).map((a) => violacao(arquivo, a.linha, 'superfície à mão sem data-superficie', a.trecho)),
      ),
    ]
    return { examinados: paginas.length + telas.length, violacoes }
  },
}
