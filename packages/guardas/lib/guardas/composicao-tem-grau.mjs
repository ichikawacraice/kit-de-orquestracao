// PESO-02, FORMA-01, LAY-03 e SUP-03 — a composição tem grau. Ação destrutiva
// usa a variante destrutiva; superfície de conteúdo não usa raio de controle;
// o vão entre blocos é o dobro do de dentro (16 fora com 12 dentro mediu 1,33 e
// foi a causa de "as seções se confundem"); e o vão estrutural sai de uma
// paleta escrita.
import { escapar, semComentarios } from '../fonte.mjs'
import { TSX, violacao } from './_comum.mjs'
import { chamaConfirmacao } from './o-irreversivel-pede-confirmacao.mjs'

const CONFIRMACAO = { hooks: ['useConfirm'], funcoes: ['onConfirmar'] }

const VERBO_DESTRUTIVO = /\b(Despublicar|Revogar|Excluir|Apagar|Abortar|Remover|Deletar)\b/

export function botoesDoArquivo(fonte) {
  const saida = []
  let pos = 0
  for (const pedaco of fonte.split('<Button').slice(1)) {
    pos = fonte.indexOf('<Button', pos) + 1
    if (!/^[\s/>]/.test(pedaco)) continue
    const fim = pedaco.indexOf('</Button>')
    if (fim !== -1) saida.push({ indice: pos - 1, el: `<Button${pedaco.slice(0, fim)}` })
  }
  return saida
}

export function superficiesComRaioDeControle(fonte) {
  return [...fonte.matchAll(/"[^"\n]*"|'[^'\n]*'|`[^`\n]*`/g)].filter(({ 0: t }) => /\brounded-lg\b/.test(t) && /\bp-[0-9]/.test(t) && (/\bborder\b/.test(t) || /\bbg-[a-z]/.test(t)))
}

const VAO_PEQUENO = /\bgap(-[xy])?-([1-5])\b/
const GAP_QUALQUER = /\bgap(?:-[xy])?-(\[[^\]]+\]|\d+(?:\.\d+)?)\b/

export function vaoApertado(texto, abreBloco) {
  const linhas = texto.split('\n')
  return linhas.flatMap((linha, i) => {
    if (!VAO_PEQUENO.test(linha) || !/className=/.test(linha)) return []
    const seguintes = linhas.slice(i + 1, i + 4).join('\n')
    return abreBloco.test(seguintes) ? [{ linha: i + 1, trecho: linha }] : []
  })
}

/** O container que, um nível de recuo abaixo, abre dois ou mais assuntos. */
export function containersDeAssunto(texto, abreAssunto) {
  const linhas = texto.split('\n')
  const recuo = (l) => l.match(/^\s*/)[0].length
  return linhas.flatMap((linha, i) => {
    if (!/className=/.test(linha)) return []
    const m = GAP_QUALQUER.exec(linha)
    if (!m) return []
    const k = recuo(linha)
    let assuntos = 0
    for (let j = i + 1; j < linhas.length; j++) {
      const l = linhas[j]
      if (!l.trim()) continue
      const r = recuo(l)
      if (r <= k) break
      if (r === k + 2 && abreAssunto.test(l)) assuntos++
    }
    return assuntos >= 2 ? [{ linha: i + 1, valor: m[1], trecho: linha }] : []
  })
}

export default {
  id: 'composicao-tem-grau',
  regras: ['PESO-02', 'FORMA-01', 'LAY-03', 'SUP-03'],
  titulo: 'A composição tem grau',
  // `blocos`: as peças de bloco de página; `assuntos`: o que conta como um
  // assunto num container; `paleta`: o sufixo de `gap-` permitido entre
  // assuntos, cada um com o motivo ({ valor, motivo }).
  padrao: {
    blocos: ['Bloco', 'BlocoRecolhivel'],
    assuntos: ['Bloco', 'BlocoRecolhivel', 'Painel', 'Secao', 'Card'],
    paleta: [{ valor: '6', motivo: 'o vão da casa entre blocos de página, o dobro do de dentro (LAY-03)' }],
  },
  examinar(p, op) {
    const erros = op.paleta.filter((x) => (x.motivo ?? '').trim().length < 20).map((x) => `valor da paleta sem motivo: gap-${x.valor}`)
    const permitidos = new Set(op.paleta.map((x) => x.valor))
    const abreBloco = new RegExp(`<(?:${op.blocos.map(escapar).join('|')})\\b`)
    const abreAssunto = new RegExp(`<(?:${op.assuntos.map(escapar).join('|')})\\b`)
    const fontes = p.fontes({ ext: TSX, ignorar: [p.config.kit] })
    const violacoes = fontes.flatMap(({ arquivo, texto }) => {
      const codigo = semComentarios(texto)
      const linha = (i) => codigo.slice(0, i).split('\n').length
      return [
        ...botoesDoArquivo(codigo)
          // PESO-02: o gesto que só ABRE a confirmação destrutiva pode ser ghost.
          .filter(({ el }) => VERBO_DESTRUTIVO.test(el) && !/variant=["']destructive["']/.test(el) && !chamaConfirmacao(codigo, CONFIRMACAO))
          .map(({ indice, el }) => violacao(arquivo, linha(indice), 'ação destrutiva sem a variante destrutiva (PESO-02)', el)),
        ...superficiesComRaioDeControle(codigo).map((m) => violacao(arquivo, linha(m.index), 'superfície de conteúdo com raio de controle (FORMA-01)', m[0])),
        ...vaoApertado(codigo, abreBloco).map((a) => violacao(arquivo, a.linha, 'vão entre blocos menor que 24px (LAY-03)', a.trecho)),
        ...containersDeAssunto(codigo, abreAssunto)
          .filter((c) => !permitidos.has(c.valor))
          .map((c) => violacao(arquivo, c.linha, `vão estrutural gap-${c.valor} fora da paleta escrita (LAY-03, SUP-03)`, c.trecho)),
      ]
    })
    return { examinados: fontes.length, violacoes, erros }
  },
}
