// O que o kit tem: cada nome exportado pelos arquivos do registro, com o item
// que o instala. A vitrine usa para dizer se a peça que a base cita já está no
// kit (e levar a ela) ou ainda está fora.
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { ITENS } from "@/catalogo/registro"

const REGISTRO = join(process.cwd(), "..", "..", "packages", "registro")

let cache: Map<string, string> | null = null
/** Os nomes exportados que são tipo (`type Tom`): o filtro os acha, a linha não os mostra. */
const TIPOS = new Set<string>()

/** `Card` → `card`, `useConfirm` → `confirm-dialog`. */
export function nomesDoKit(): Map<string, string> {
  if (cache) return cache
  cache = new Map()
  for (const item of ITENS) {
    for (const f of item.files) {
      const texto = readFileSync(join(REGISTRO, f.path), "utf8")
      const nomes = [
        ...[...texto.matchAll(/^export \{([^}]*)\}/gm)].flatMap((m) => m[1]!.split(",")),
        ...[...texto.matchAll(/^export (?:async )?(?:function|const) (\w+)/gm)].map((m) => m[1]!),
      ]
        .map((n) => {
          const nome = n.replace(/^\s*type\s+/, "").split(/\s+as\s+/).pop()!.trim()
          if (/^\s*type\s+/.test(n)) TIPOS.add(nome)
          return nome
        })
        .filter((n) => /^[A-Za-z]\w*$/.test(n))
      for (const n of nomes) if (!cache.has(n)) cache.set(n, item.name)
    }
  }
  return cache
}

/** Os nomes que cada item exporta (`chip-de-estado` → `ChipDeEstado`, `ChipQueAbre`…), o principal primeiro. */
export function exportsDoItem(): Map<string, string[]> {
  const porItem = new Map<string, string[]>()
  for (const [nome, item] of nomesDoKit()) {
    // Componente ou gancho; tipo e CONSTANTE ficam fora da linha.
    if (!/^[A-Z][a-z]|^use[A-Z]/.test(nome) || TIPOS.has(nome)) continue
    porItem.set(item, [...(porItem.get(item) ?? []), nome])
  }
  // O principal é o que tem o nome do item (`menu` → `Menu`) ou o do shadcn (`table` → `Table`).
  const pascal = (s: string) => s.replace(/(^|-)(\w)/g, (_, __, c: string) => c.toUpperCase())
  for (const [item, nomes] of porItem) {
    const desc = ITENS.find((i) => i.name === item)?.description.split(" — ")[0] ?? ""
    const alvos = [pascal(item), pascal(desc.trim())]
    porItem.set(item, [...nomes].sort((a, b) => Number(alvos.includes(b)) - Number(alvos.includes(a))))
  }
  return porItem
}

/**
 * A célula em HTML com cada `<code>Peça</code>` do kit virando link para a
 * página dela. Devolve também se a célula cita alguma peça, e se alguma está fora do kit.
 */
export function ligarPecas(html: string): { html: string; citadas: number; fora: number } {
  const kit = nomesDoKit()
  let citadas = 0
  let fora = 0
  const ligado = html.replace(/<code class="([^"]*)">([^<]+)<\/code>/g, (inteiro, classe: string, texto: string) => {
    const nome = texto.replace(/\(.*$/, "").trim()
    if (!/^[A-Z]\w*$|^use[A-Z]\w*$/.test(nome)) return inteiro
    citadas++
    const item = kit.get(nome)
    if (!item) {
      fora++
      // A marca vai na peça, não na linha: a linha que mistura peça do kit com peça de fora diz qual falta.
      return `${inteiro} <span class="text-legenda text-muted-foreground">fora do kit</span>`
    }
    return `<a href="/catalogo/${item}/" class="underline underline-offset-2 hover:text-foreground"><code class="${classe}">${texto}</code></a>`
  })
  return { html: ligado, citadas, fora }
}
