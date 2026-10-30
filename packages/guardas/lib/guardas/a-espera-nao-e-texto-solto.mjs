// EST-01 — a espera tem forma (esqueleto na forma da tela, com altura), e não é
// um "Carregando…" solto. O texto compila, funciona e só fica feio — por isso
// só uma varredura o denuncia.
import { semComentarios } from '../fonte.mjs'
import { CODIGO, ocorrencias, violacao } from './_comum.mjs'

/**
 * A FRASE de espera: "carregando", em qualquer caixa, até reticências. A
 * reticência separa a frase de tela do que só tem a palavra dentro (a classe
 * `data-[carregando=true]:h-24`, o estado `tipo: 'carregando'`).
 */
export const TEXTO_DE_ESPERA = /carregando[^'"`\n<>{}]*?(?:…|\.\.\.)/gi

export default {
  id: 'a-espera-nao-e-texto-solto',
  regras: ['EST-01'],
  titulo: 'A espera não é texto solto',
  // `frases`: o estado de trabalho do PRÓPRIO controle, ao lado dele (o rótulo
  // do campo enquanto carrega as opções), não é espera de tela. Cada entrada é
  // { arquivo, frase, motivo } e tem de continuar existindo.
  padrao: { frases: [] },
  examinar(p, op) {
    const fontes = p.fontes({ ext: CODIGO })
    const erros = []
    for (const f of op.frases) {
      const alvo = fontes.find((x) => x.arquivo === f.arquivo)
      if (!alvo || !alvo.texto.includes(f.frase)) erros.push(`frase isenta velha: ${f.arquivo} já não tem "${f.frase}"`)
      if ((f.motivo ?? '').trim().length < 20) erros.push(`frase isenta sem motivo: ${f.arquivo}`)
    }
    const violacoes = fontes.flatMap(({ arquivo, texto }) => {
      let t = semComentarios(texto)
      for (const f of op.frases) if (f.arquivo === arquivo) t = t.replace(f.frase, ' '.repeat(f.frase.length))
      return ocorrencias(t, TEXTO_DE_ESPERA).map(({ m, linha }) => violacao(arquivo, linha, 'espera em texto solto: use o esqueleto na forma da tela', m[0]))
    })
    return { examinados: fontes.length, violacoes, erros }
  },
}
