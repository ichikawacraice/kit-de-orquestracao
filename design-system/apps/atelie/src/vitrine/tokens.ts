import type * as React from "react"

// Os tokens que a vitrine mostra saem do `tokens.json` resolvido do pacote — o
// mesmo que os projetos instalam. A conta de contraste é a do próprio pacote
// (packages/tokens/lib/contraste.mjs), a mesma que o teste de piso usa.
import tokensJson from "@wicomm/tokens/tokens.json"
// O `exports` do pacote não expõe o package.json: a versão vem do arquivo.
import pacote from "../../../../packages/tokens/package.json"
import { razao as razaoBruta, sobre as sobreBruto } from "../../../../packages/tokens/lib/contraste.mjs"

export type Tema = "claro" | "escuro"

export type Tokens = {
  temas: Tema[]
  variaveis: Record<Tema, Record<string, string>>
  cores: string[]
  raios: Record<string, string>
  familias: Record<string, string[]>
  tamanhos: Record<string, string>
  vozes: Record<string, Record<string, string>>
  duracoes: Record<string, string>
  atrasos: Record<string, string>
  curvas: Record<string, string>
  animacoes: Record<string, string>
  sombras: Record<string, string>
  alturas: Record<string, string>
  larguras: Record<string, string>
}

export const TOKENS = tokensJson as unknown as Tokens
export const VERSAO_DOS_TOKENS: string = pacote.version

export const razao = razaoBruta as (a: string, b: string) => number
export const sobre = sobreBruto as (cor: string, alfa: number, fundo: string) => string

/** O valor de uma variável num tema (`--card`), ou erro: token que some não pode virar `undefined` calado. */
export function valor(nome: string, tema: Tema): string {
  const v = TOKENS.variaveis[tema][nome]
  if (v === undefined) throw new Error(`token ${nome} não existe no tema ${tema}`)
  return v
}

export const eHex = (v: string) => /^#[0-9a-f]{6}$/i.test(v)

/** `rgba(19, 23, 34, .10)` composto sobre um fundo opaco, para medir o que a tela pinta. */
export function opaco(v: string, fundo: string): string {
  if (eHex(v)) return v.toUpperCase()
  const m = v.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/)
  if (!m) throw new Error(`cor que a vitrine não sabe medir: ${v}`)
  const hex = "#" + [m[1], m[2], m[3]].map((c) => Number(c).toString(16).padStart(2, "0")).join("")
  return sobre(hex, m[4] === undefined ? 1 : Number(m[4]), fundo).toUpperCase()
}

/** `4.25` → `4,25:1`. */
export function formatarRazao(r: number): string {
  return `${r.toFixed(2).replace(".", ",")}:1`
}

/** O valor com as `var(--x)` trocadas pelo valor do tema: a amostra do outro tema não herda as variáveis da página. */
export function resolvido(nome: string, tema: Tema): string {
  return valor(nome, tema).replace(/var\((--[\w-]+)\)/g, (_, v: string) => resolvido(v, tema))
}

/** O fundo que pinta a amostra de uma cor num tema: a cor com alfa vai composta sobre o `card` do tema. */
export function pintura(nome: string, tema: Tema): React.CSSProperties {
  const v = resolvido(nome, tema)
  if (v.includes("gradient")) return { backgroundImage: v }
  return { backgroundColor: eHex(v) ? v : opaco(v, valor("--card", tema)) }
}
