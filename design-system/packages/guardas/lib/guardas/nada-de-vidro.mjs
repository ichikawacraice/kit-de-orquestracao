// SUP-02 — nada de vidro. A profundidade é superfície opaca; translucidez,
// desfoque de fundo e bisel branco saíram do sistema e não voltam. A varredura
// é por VALOR, e não por import: o que une os arquivos é a string da classe.
import { semComentarios } from '../fonte.mjs'
import { CODIGO, ocorrencias, violacao } from './_comum.mjs'

const MARCAS = [
  { nome: 'grau de vidro', re: /\bglass-surface(?:-subtle|-strong)?\b/g },
  { nome: 'desfoque de fundo', re: /\bbackdrop-(?:blur|filter)\b/g },
  { nome: 'bisel branco', re: /inset_0_1px_0_rgba\(255,\s*255,\s*255/g },
  // `bg-white/<alfa>` com QUALQUER variante na frente e o valor entre colchetes
  // ou não: `\b` basta, porque `:` não é caractere de palavra.
  { nome: 'vidro à mão', re: /\bbg-white\/(?:\d|\[)/g },
]

export function marcasDeVidro(fonte) {
  const codigo = semComentarios(fonte)
  return MARCAS.flatMap(({ nome, re }) => ocorrencias(codigo, re).map(({ m, linha }) => ({ nome, linha, trecho: m[0] })))
}

export default {
  id: 'nada-de-vidro',
  regras: ['SUP-02'],
  titulo: 'Nada de vidro',
  padrao: {},
  examinar(p) {
    const fontes = [...p.fontes({ ext: CODIGO }), ...p.css()]
    const violacoes = fontes.flatMap(({ arquivo, texto }) =>
      marcasDeVidro(texto).map((a) => violacao(arquivo, a.linha, `${a.nome}: a profundidade é superfície opaca`, a.trecho)),
    )
    return { examinados: fontes.length, violacoes }
  },
}
