// PESO-02 e CONV-10 — o irreversível pede confirmação, e a confirmação é a do
// kit (`useConfirm`), nunca `window.confirm`. Todo arquivo de tela com a
// variante destrutiva CHAMA a confirmação — o hook declarado e nunca chamado
// não confirma nada —, ou declara nas exceções por que não.
import { semComentarios } from '../fonte.mjs'
import { TSX, violacao } from './_comum.mjs'

const VARIANTE_DESTRUTIVA = /variant=["']destructive["']|variant:\s*['"]destructive['"]/

/** Os nomes que confirmam: os do hook (`const [d, confirmar] = useConfirm()`) e as funções recebidas. */
export function chamaConfirmacao(fonte, { hooks, funcoes }) {
  const codigo = semComentarios(fonte)
  const nomes = new Set(funcoes)
  for (const h of hooks) {
    for (const m of codigo.matchAll(new RegExp(`const\\s*\\[\\s*\\w*\\s*,\\s*(\\w+)\\s*(?:,[^\\]]*)?\\]\\s*=\\s*${h}\\s*\\(`, 'g'))) nomes.add(m[1])
    for (const m of codigo.matchAll(new RegExp(`const\\s+(\\w+)\\s*=\\s*${h}\\s*\\(`, 'g'))) nomes.add(m[1])
  }
  for (const n of nomes) {
    // Chamada, e não declaração (`function n(`), tipo (`n: (x) =>`) nem membro (`a.n(`).
    if (new RegExp(`(?<![\\w.]|function\\s)${n}\\s*\\(`).test(codigo)) return true
  }
  return false
}

export default {
  id: 'o-irreversivel-pede-confirmacao',
  regras: ['PESO-02', 'CONV-10'],
  titulo: 'O irreversível pede confirmação',
  padrao: { hooks: ['useConfirm'], funcoes: ['onConfirmar'] },
  examinar(p, op) {
    const fontes = p.fontes({ ext: TSX, ignorar: [p.config.kit] })
    const destrutivos = fontes.filter((f) => VARIANTE_DESTRUTIVA.test(semComentarios(f.texto)))
    const violacoes = destrutivos
      .filter((f) => !chamaConfirmacao(f.texto, op))
      .map((f) => {
        const i = f.texto.split('\n').findIndex((l) => VARIANTE_DESTRUTIVA.test(l))
        return violacao(f.arquivo, i + 1, 'variante destrutiva sem chamada de confirmação (useConfirm)', f.texto.split('\n')[i] ?? '')
      })
    return { examinados: fontes.length, violacoes }
  },
}
