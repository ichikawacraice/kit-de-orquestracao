// MOV-02 — toda animação tem escape para quem pediu movimento reduzido. Na
// classe: `animate-*` e `transition` de transformação levam
// `motion-reduce:animate-none`/`transition-none` NA MESMA STRING; com variante
// (`data-[state=open]:animate-in`), o escape leva `!`, porque a variante tem
// especificidade 0,2,0 e o escape simples 0,1,0. No CSS: toda regra que anima
// tem o par `animation: none` sob `prefers-reduced-motion: reduce`.
import { literaisDoFonte, separaVariante, tokensDaLiteral, resumo } from '../fonte.mjs'
import { CODIGO, violacao } from './_comum.mjs'

const ANIMA = /^animate-(?!none$)/
const TRANSICAO = /^transition(?:-all|-transform|-opacity|-\[.+\])?$/

function movimentosDe(texto) {
  const achados = new Map()
  for (const token of tokensDaLiteral(texto)) {
    const { variantes, base } = separaVariante(token)
    if (variantes.includes('motion-reduce')) continue
    const tipo = ANIMA.test(base) ? 'animate' : TRANSICAO.test(base) ? 'transition' : null
    if (!tipo) continue
    achados.set(tipo, (achados.get(tipo) ?? false) || variantes.length > 0)
  }
  return [...achados].map(([tipo, comVariante]) => ({ tipo, comVariante }))
}

export function literaisSemEscape(fonte) {
  const falhas = []
  for (const { linha, texto } of literaisDoFonte(fonte)) {
    const tokens = tokensDaLiteral(texto)
    for (const { tipo, comVariante } of movimentosDe(texto)) {
      const simples = `motion-reduce:${tipo}-none`
      const forte = `motion-reduce:!${tipo}-none`
      if (comVariante && !tokens.includes(forte)) falhas.push({ linha, literal: texto, falta: `${forte} (a animação tem variante e vence o escape sem !)` })
      else if (!comVariante && !tokens.includes(simples) && !tokens.includes(forte)) falhas.push({ linha, literal: texto, falta: simples })
    }
  }
  return falhas
}

/** As regras de CSS que declaram animação, com o seletor e se moram sob `prefers-reduced-motion: reduce`. */
export function regrasDeAnimacao(css) {
  const limpo = css.replace(/\/\*[\s\S]*?\*\//g, ' ')
  const achadas = []
  const pilha = []
  let cabeca = ''
  const fecha = () => {
    const decl = cabeca.trim()
    cabeca = ''
    if (pilha.length === 0 || !decl) return
    let valor = null
    const m = /^animation(?:-name)?\s*:\s*(.+?)\s*$/.exec(decl)
    if (m) valor = m[1]
    const ap = /^@apply\s+(.+)$/.exec(decl)
    if (ap) {
      const animados = ap[1].split(/\s+/).filter((t) => /^animate-/.test(t))
      if (animados.length > 0) valor = animados.includes('animate-none') ? 'none' : animados[0]
    }
    if (valor === null) return
    const noEscape = pilha.some((h) => /^@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)$/.test(h))
    for (const seletor of pilha[pilha.length - 1].split(',').map((x) => x.trim()).filter(Boolean)) achadas.push({ seletor, valor, noEscape })
  }
  for (const ch of limpo) {
    if (ch === '{') {
      pilha.push(cabeca.trim())
      cabeca = ''
    } else if (ch === '}') {
      fecha()
      pilha.pop()
    } else if (ch === ';') fecha()
    else cabeca += ch
  }
  return achadas
}

export function animacoesSemEscape(css) {
  const regras = regrasDeAnimacao(css)
  const desligadas = new Set(regras.filter((r) => r.valor === 'none' && r.noEscape).map((r) => r.seletor))
  // `@keyframes` também abre bloco, mas o passo (`0%`, `to`) não é seletor de quem anima.
  return [...new Set(regras.filter((r) => r.valor !== 'none' && !r.noEscape && !desligadas.has(r.seletor)).map((r) => r.seletor))]
}

export default {
  id: 'o-movimento-tem-escape',
  regras: ['MOV-02'],
  titulo: 'O movimento tem escape',
  padrao: {},
  examinar(p) {
    const fontes = p.fontes({ ext: CODIGO })
    const css = p.css()
    const violacoes = [
      ...fontes.flatMap(({ arquivo, texto }) =>
        literaisSemEscape(texto).map((f) => violacao(arquivo, f.linha, `falta ${f.falta}`, resumo(f.literal, 70))),
      ),
      ...css.flatMap(({ arquivo, texto }) =>
        animacoesSemEscape(texto).map((s) => violacao(arquivo, null, 'anima sem o par animation: none sob prefers-reduced-motion', s)),
      ),
    ]
    return { examinados: fontes.length + css.length, violacoes }
  },
}
