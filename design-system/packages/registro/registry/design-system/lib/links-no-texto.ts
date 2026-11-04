/**
 * Os links `http(s)://` de um texto livre (o corpo de uma mensagem, que vem de
 * quem escreveu): devolve trechos para a tela montar com `<a>`, nunca HTML cru.
 * Só o que o `URL` aceita e é http(s) vira link; `javascript:`, `www.` sem
 * esquema e afins seguem texto.
 */

export type Trecho = { tipo: "texto"; texto: string } | { tipo: "link"; texto: string; href: string }

const URL_NO_TEXTO = /https?:\/\/[^\s<>"]+/gi

/** A pontuação colada ao fim é da frase, não do link: *veja https://a.example.* */
const PONTUACAO_FINAL = /[.,;:!?'*]+$/

function conta(texto: string, letra: string): number {
  return texto.split(letra).length - 1
}

/** Tira do fim o que é da frase; o `)` só sai quando não fecha um `(` do próprio link. */
function aparaFim(bruto: string): string {
  let url = bruto
  for (;;) {
    const antes = url
    url = url.replace(PONTUACAO_FINAL, "")
    if (url.endsWith(")") && conta(url, "(") < conta(url, ")")) url = url.slice(0, -1)
    if (url === antes) return url
  }
}

function hrefSeguro(url: string): string | null {
  try {
    const u = new URL(url)
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null
  } catch {
    return null
  }
}

function trechosComLinks(texto: string): Trecho[] {
  const trechos: Trecho[] = []
  let desde = 0
  const empurraTexto = (fim: number) => {
    if (fim > desde) trechos.push({ tipo: "texto", texto: texto.slice(desde, fim) })
  }
  for (const achado of texto.matchAll(URL_NO_TEXTO)) {
    const inicio = achado.index ?? 0
    const url = aparaFim(achado[0])
    const href = hrefSeguro(url)
    if (!href || url.length <= "https://".length) continue
    empurraTexto(inicio)
    trechos.push({ tipo: "link", texto: url, href })
    desde = inicio + url.length
  }
  empurraTexto(texto.length)
  return trechos
}

export { trechosComLinks }
