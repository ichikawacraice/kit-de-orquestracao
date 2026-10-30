// A aritmética de contraste da WCAG 2.1 — luminância e razão.
// A mesma de `@wicomm/tokens/lib/contraste.mjs` (só as duas funções que a guarda
// usa): funções puras sobre hex de 6 dígitos.

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
