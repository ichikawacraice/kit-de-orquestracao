// A aritmética de contraste da WCAG 2.1 — luminância, razão e composição por alfa.
// Portada sem mudança de `lib/contraste.ts` do produto de origem: funções puras
// sobre hex de 6 dígitos, sem conhecer token, tema nem CSS.

/** Luminância relativa (WCAG 2.1) de um hex de 6 dígitos. */
export function luminancia(hex) {
  const canais = hex.replace('#', '').match(/../g).map((c) => parseInt(c, 16) / 255)
  const lin = canais.map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)))
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
}

/**
 * A razão entre duas tintas, arredondada a duas casas: `4,50` e `4,4999` são a
 * mesma frase para quem lê, e o piso conferido sobre o número cru transformaria
 * ruído de ponto flutuante em veredito.
 */
export function razao(a, b) {
  const [x, y] = [luminancia(a), luminancia(b)]
  return Number(((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2))
}

/** Compõe `cor` a `alfa` sobre `fundo` — a tinta de carimbo e de terminal é isto. */
export function sobre(cor, alfa, fundo) {
  const p = (h) => h.replace('#', '').match(/../g).map((c) => parseInt(c, 16))
  const [f, b] = [p(cor), p(fundo)]
  return '#' + f.map((v, i) => Math.round(v * alfa + b[i] * (1 - alfa)).toString(16).padStart(2, '0')).join('')
}

/** Matiz, saturação e luz de um hex — para separar *estado* de *outra cor*. */
export function hsl(hex) {
  const [r, g, b] = hex.replace('#', '').match(/../g).map((c) => parseInt(c, 16) / 255)
  const mx = Math.max(r, g, b)
  const mn = Math.min(r, g, b)
  const d = mx - mn
  const l = (mx + mn) / 2
  if (d === 0) return [0, 0, l]
  const h = mx === r ? 60 * (((g - b) / d + 6) % 6) : mx === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4)
  return [h, d / (1 - Math.abs(2 * l - 1)), l]
}
