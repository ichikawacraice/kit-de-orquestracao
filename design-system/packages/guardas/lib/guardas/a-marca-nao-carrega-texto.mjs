// MARCA-02 e MARCA-05 — a marca preenche, tinge e desenha; ela não escreve. E o
// destrutivo é contorno: preenchimento vermelho é sempre o primário. Medido como
// texto, a marca e o vermelho de erro ficam a 1,17:1 — só a forma os separa.
import { semComentarios } from '../fonte.mjs'
import { CODIGO, ocorrencias, violacao } from './_comum.mjs'

/**
 * `text-primary` nu, com qualquer cadeia de variantes. `-foreground` é o branco
 * que senta NA marca. `text-marca-viva` fica de fora: num ícone, a cor de texto
 * é o traço, e a marca desenha.
 */
const MARCA_COMO_TEXTO = /(?:^|[\s"'`{(])((?:[\w\-[\]=&>*.]+:)*!?text-primary)(?![\w-])/g
/** `bg-destructive` sem alfa: a tinta (`/12`) é fundo de carimbo e pode. */
const DESTRUTIVO_PREENCHIDO = /\bbg-destructive(?![\w/-])/g

export function marcaComoTexto(fonte) {
  return ocorrencias(semComentarios(fonte), MARCA_COMO_TEXTO).map(({ m, linha }) => ({ linha, trecho: m[1] }))
}
export function destrutivoPreenchido(fonte) {
  return ocorrencias(semComentarios(fonte), DESTRUTIVO_PREENCHIDO).map(({ m, linha }) => ({ linha, trecho: m[0] }))
}

export default {
  id: 'a-marca-nao-carrega-texto',
  regras: ['MARCA-02', 'MARCA-05'],
  titulo: 'A marca não carrega texto, e o destrutivo não é preenchido',
  padrao: {},
  examinar(p) {
    const fontes = p.fontes({ ext: CODIGO })
    const violacoes = fontes.flatMap(({ arquivo, texto }) => [
      ...marcaComoTexto(texto).map((a) => violacao(arquivo, a.linha, 'a marca como cor de texto (MARCA-02)', a.trecho)),
      ...destrutivoPreenchido(texto).map((a) => violacao(arquivo, a.linha, 'destrutivo preenchido; é contorno (MARCA-05)', a.trecho)),
    ])
    return { examinados: fontes.length, violacoes }
  },
}
