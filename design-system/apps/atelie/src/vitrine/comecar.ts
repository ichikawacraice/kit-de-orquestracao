// O guia "Começar", lido de docs/comecar.md no build. Uma fonte só: o mesmo
// arquivo que se lê no GitHub vira a página do ateliê, com cada seção num
// bloco e cada comando com o botão de copiar.
import { readFileSync } from "node:fs"
import { join, posix } from "node:path"
import { Marked, type Token, type Tokens } from "marked"

import { ligarCodigos, slug } from "@/vitrine/base"

export type Parte =
  | { tipo: "html"; html: string }
  | { tipo: "comando"; texto: string }
  /** A tabela sai em células (HTML inline de cada uma) para a página montar a `Table` do kit. */
  | { tipo: "tabela"; cabecalho: string[]; linhas: string[][] }
export type Subsecao = { titulo?: string; ancora?: string; partes: Parte[] }
export type SecaoDoGuia = { titulo: string; ancora: string; subsecoes: Subsecao[] }
export type Guia = { titulo: string; abertura: string; secoes: SecaoDoGuia[] }

const RAIZ = join(process.cwd(), "..", "..")
const ARQUIVO = "docs/comecar.md"
const REPOSITORIO = "https://github.com/wicomm-projects/wicomm-design-system"
const ATELIE = "https://wicomm-atelie.vercel.app"

const escapar = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

/**
 * O link do guia no site: âncora fica, o próprio ateliê vira rota, a base vira
 * a página das regras, e o resto do repositório vai ao GitHub (o arquivo não
 * existe no site).
 */
export function destinoDoLink(href: string): string {
  if (href.startsWith("#")) return href
  if (href.startsWith(ATELIE)) return href.slice(ATELIE.length) || "/"
  if (/^https?:/.test(href)) return href
  const [caminho = "", ancora] = href.split("#")
  const doRepo = posix.normalize(posix.join(posix.dirname(ARQUIVO), caminho))
  if (doRepo.startsWith("plugins/design-system/base") || doRepo.startsWith("plugins/wicomm/base")) return "/regras/"
  const tipo = doRepo.endsWith("/") ? "tree" : "blob"
  return `${REPOSITORIO}/${tipo}/main/${doRepo.replace(/\/$/, "")}${ancora ? `#${ancora}` : ""}`
}

/** O título vai a um `string` (o nome do bloco): sem a crase do código. */
const semMarcas = (t: string) => t.replace(/`/g, "")

function marked(): Marked {
  const m = new Marked({ gfm: true })
  m.use({
    renderer: {
      link({ href, tokens }) {
        const destino = destinoDoLink(href)
        const fora = /^https?:/.test(destino)
        return `<a href="${destino}" class="underline underline-offset-2 hover:text-foreground"${fora ? ' rel="noreferrer"' : ""}>${this.parser.parseInline(tokens)}</a>`
      },
      codespan({ text }) {
        return `<code class="t-medida text-foreground">${escapar(text)}</code>`
      },
      blockquote({ tokens }) {
        return `<div class="rounded-ctrl bg-muted px-3 py-2.5">${this.parser.parse(tokens)}</div>`
      },
    },
  })
  return m
}

export function guia(texto = readFileSync(join(RAIZ, ARQUIVO), "utf8")): Guia {
  const m = marked()
  const html = (tokens: Token[]) => ligarCodigos(m.parser(tokens))
  const tokens = m.lexer(texto)
  let titulo = ""
  const antes: Token[] = []
  const secoes: SecaoDoGuia[] = []
  for (const t of tokens) {
    // O comentário no markdown é nota para quem escreve, não para quem lê.
    if (t.type === "html" && /^\s*<!--/.test(t.raw)) continue
    if (t.type === "heading" && t.depth === 1) {
      titulo = semMarcas((t as Tokens.Heading).text)
      continue
    }
    if (t.type === "heading" && t.depth === 2) {
      const h = t as Tokens.Heading
      secoes.push({ titulo: semMarcas(h.text), ancora: slug(semMarcas(h.text)), subsecoes: [{ partes: [] }] })
      continue
    }
    const secao = secoes.at(-1)
    if (!secao) {
      if (t.type !== "space") antes.push(t)
      continue
    }
    if (t.type === "heading" && t.depth === 3) {
      const h = t as Tokens.Heading
      secao.subsecoes.push({ titulo: semMarcas(h.text), ancora: slug(semMarcas(h.text)), partes: [] })
      continue
    }
    const partes = secao.subsecoes.at(-1)!.partes
    if (t.type === "code") {
      partes.push({ tipo: "comando", texto: (t as Tokens.Code).text })
      continue
    }
    if (t.type === "table") {
      const tab = t as Tokens.Table
      const celula = (c: Tokens.TableCell) => ligarCodigos(m.parseInline(c.text, { async: false }) as string)
      partes.push({ tipo: "tabela", cabecalho: tab.header.map(celula), linhas: tab.rows.map((r) => r.map(celula)) })
      continue
    }
    if (t.type === "space") continue
    const ultima = partes.at(-1)
    const pedaco = html([t])
    if (ultima?.tipo === "html") ultima.html += pedaco
    else partes.push({ tipo: "html", html: pedaco })
  }
  for (const s of secoes) s.subsecoes = s.subsecoes.filter((sub) => sub.titulo || sub.partes.length)
  return { titulo, abertura: html(antes), secoes }
}
