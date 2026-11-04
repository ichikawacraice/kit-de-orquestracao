/**
 * Os links `http(s)://` de um texto livre (o corpo de uma mensagem, que vem de
 * quem escreveu): devolve trechos para a tela montar com `<a>`, nunca HTML cru.
 * Só o que o `URL` aceita e é http(s) vira link; `javascript:`, `www.` sem
 * esquema e afins seguem texto.
 */

export type Trecho = { tipo: "texto"; texto: string } | { tipo: "link"; texto: string; href: string }

/**
 * O link começa num `http(s)://` que não está grudado numa palavra e vai até o
 * espaço, as aspas (retas ou curvas) ou a barra invertida — esta, porque o
 * navegador a lê como `/` e o link iria a outro host que o escrito na tela.
 */
const URL_NO_TEXTO = /(?<![\p{L}\p{N}_/])https?:\/\/[^\s<>"“”‘’«»\\]+/giu

/** A pontuação colada ao fim é da frase, não do link: *veja https://a.example.* */
const PONTUACAO_FINAL = ".,;:!?'*…"

/** Quem fecha e quem abre: o que fecha no fim só sai quando não fecha um que o próprio link abriu. */
const PARES: Record<string, string> = { ")": "(", "]": "[", "}": "{" }

/** Tira do fim o que é da frase, numa passada só (a mensagem vem de quem escreveu, de qualquer tamanho). */
function aparaFim(bruto: string): string {
  const sobra: Record<string, number> = { ")": 0, "]": 0, "}": 0 }
  for (const letra of bruto) {
    if (letra in sobra) sobra[letra]! += 1
    else if (letra === "(" || letra === "[" || letra === "{") {
      const fecha = letra === "(" ? ")" : letra === "[" ? "]" : "}"
      sobra[fecha]! -= 1
    }
  }
  let fim = bruto.length
  while (fim > 0) {
    const letra = bruto[fim - 1]!
    if (PONTUACAO_FINAL.includes(letra)) fim -= 1
    else if (letra in PARES && sobra[letra]! > 0) {
      sobra[letra]! -= 1
      fim -= 1
    } else break
  }
  return bruto.slice(0, fim)
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
