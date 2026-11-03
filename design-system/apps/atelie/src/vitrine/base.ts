// A base (plugins/design-system/base) lida no build: cada regra com o código, o título,
// o capítulo e os três campos. A vitrine mostra a norma como ela está escrita —
// nada é copiado à mão, então regra nova aparece sozinha (test/vitrine.test.ts
// cobra que toda regra tem página e âncora).
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { Marked } from "marked"

export type IdDoArquivo = "design" | "anatomia" | "convencoes"

export type Regra = {
  codigo: string
  titulo: string
  arquivo: IdDoArquivo
  capitulo: string
  /** Os campos em HTML, já renderizados do markdown da base. */
  regra: string
  porque: string
  confere: string
  /** A coluna "Confere" do índice, curta: `guarda, tokens`. */
  confereCurto: string
  revogada: boolean
  /** O título em HTML inline (a base escreve `*ênfase*` e código no título). */
  tituloHtml: string
  /** A nota *Assumida, a confirmar* da regra, em HTML, quando ela tem. */
  assumida: string
}

export type Capitulo = { titulo: string; ancora: string; intro: string; regras: Regra[] }

export type ArquivoDaBase = {
  id: IdDoArquivo
  arquivo: string
  titulo: string
  resumo: string
  versao: string
  capitulos: Capitulo[]
}

export const ARQUIVOS_DA_BASE: { id: IdDoArquivo; arquivo: string; titulo: string }[] = [
  { id: "design", arquivo: "DESIGN.md", titulo: "Direção de design" },
  { id: "anatomia", arquivo: "ANATOMIA.md", titulo: "Anatomia" },
  { id: "convencoes", arquivo: "CONVENCOES.md", titulo: "Convenções" },
]

/** A pasta da base, a partir do app (o build e o teste rodam em apps/atelie). */
const PASTA = join(process.cwd(), "..", "..", "plugins", "design-system", "base")

const CODIGO = /^### ([A-Z]+-\d{2}) · (.+)$/m

/** Link entre arquivos da base (`ANATOMIA.md#pecas`, `#densidade`) vira rota da vitrine. */
function linkDaVitrine(href: string, arquivoAtual: IdDoArquivo): string {
  const m = href.match(/^(?:(DESIGN|ANATOMIA|CONVENCOES)\.md)?(?:#(.*))?$/)
  if (!m || (!m[1] && m[2] === undefined)) return href
  const alvo = m[1] ? (m[1].toLowerCase() as IdDoArquivo) : arquivoAtual
  return `/regras/${alvo}/${m[2] ? `#${m[2]}` : ""}`
}

const escapar = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

/**
 * O markdown da base em HTML com as classes do kit: a tabela sai com a voz da
 * `Table` (cabeçalho `t-coluna`, linha de 40px), o código em `t-medida`. As
 * classes moram aqui, no código do app, para o Tailwind gerá-las.
 */
function md(arquivo: IdDoArquivo) {
  const m = new Marked({ gfm: true })
  m.use({
    renderer: {
      link({ href, tokens }) {
        const texto = this.parser.parseInline(tokens)
        const destino = linkDaVitrine(href, arquivo)
        const fora = /^https?:/.test(destino)
        // Link para arquivo do repositório fora da base não existe no site: fica o texto.
        if (!fora && !destino.startsWith("/")) return texto
        return `<a href="${destino}" class="underline underline-offset-2 hover:text-foreground"${fora ? ' rel="noreferrer"' : ""}>${texto}</a>`
      },
      codespan({ text }) {
        return `<code class="t-medida text-foreground">${escapar(text)}</code>`
      },
      paragraph({ tokens }) {
        return `<p>${this.parser.parseInline(tokens)}</p>`
      },
      table(token) {
        const th = token.header.map((c) => `<th class="t-coluna h-8 px-3 text-left align-middle">${this.parser.parseInline(c.tokens)}</th>`).join("")
        const linhas = token.rows
          .map((r) => `<tr>${r.map((c) => `<td class="t-denso px-3 py-2.5 align-top text-foreground">${this.parser.parseInline(c.tokens)}</td>`).join("")}</tr>`)
          .join("")
        return `<div class="-mx-3 overflow-x-auto"><table class="w-full border-collapse"><thead><tr>${th}</tr></thead><tbody>${linhas}</tbody></table></div>`
      },
    },
  })
  return m
}

/**
 * O código de outra regra no texto (`COR-10`, `ver MARCA-05`) vira link para
 * ela. Só no texto, fora de tag e fora de link que já existe.
 */
export function ligarCodigos(html: string, existe: (codigo: string) => IdDoArquivo | undefined = (c) => regraPeloCodigo(c)?.arquivo): string {
  let dentroDeLink = 0
  return html
    .split(/(<[^>]+>)/)
    .map((parte) => {
      if (parte.startsWith("<")) {
        if (/^<a[\s>]/.test(parte)) dentroDeLink++
        else if (parte === "</a>") dentroDeLink--
        return parte
      }
      if (dentroDeLink) return parte
      return parte.replace(/\b([A-Z]+-\d{2})\b/g, (cod) => {
        const arquivo = existe(cod)
        return arquivo ? `<a href="/regras/${arquivo}/#${cod}" class="underline underline-offset-2 hover:text-foreground">${cod}</a>` : cod
      })
    })
    .join("")
}

function campo(corpo: string, nome: string): string {
  // O campo acaba no próximo campo, na nota em itálico (`- *Assumida…*`), no filete entre capítulos ou no fim do bloco.
  const re = new RegExp(`^- \\*\\*${nome.replace(".", "\\.")}\\*\\*([\\s\\S]*?)(?=^- \\*\\*(?:Regra|Por quê|Confere)\\.\\*\\*|^- \\*(?!\\*)|^---\\s*$|^<a id=|(?![\\s\\S]))`, "m")
  const bruto = corpo.match(re)?.[1] ?? ""
  // O campo continua em linhas indentadas (tabela, lista): tira o recuo de dois espaços.
  return bruto
    .split("\n")
    .map((l) => l.replace(/^ {2}/, ""))
    .join("\n")
    .trim()
}

function lerArquivo(id: IdDoArquivo, arquivo: string, titulo: string): ArquivoDaBase {
  const texto = readFileSync(join(PASTA, arquivo), "utf8")
  const [, frontmatter = "", corpo = ""] = texto.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/) ?? []
  const versao = frontmatter.match(/^versao: (.+)$/m)?.[1]?.trim() ?? "?"
  const resumo = frontmatter.match(/^description: (.+)$/m)?.[1]?.trim() ?? ""
  const marked = md(id)
  const indice = new Map(
    [...(corpo.split("## Índice das regras")[1] ?? "").matchAll(/^\| ([A-Z]+-\d{2}) \| (.+?) \| (.+?) \|$/gm)].map((m) => [m[1]!, m[3]!.trim()]),
  )
  const capitulos: Capitulo[] = []
  // A âncora que a base declara antes do capítulo (`<a id="pecas">`) é a que os
  // links da própria base usam: ela vence o título transformado em slug.
  const marcado = corpo.replace(/<a id="([^"]+)"><\/a>\s*\n## /g, "## {#$1} ")
  // Capítulo é `## N. Título` (o índice e o "Como ler" não são capítulos de regra).
  for (const parte of marcado.split(/^(?=## )/m).slice(1)) {
    const [, declarada, cabeca = ""] = parte.split("\n")[0]!.match(/^## (?:\{#([^}]+)\} )?(.*)$/) ?? []
    if (!CODIGO.test(parte)) continue
    const ancora = declarada ?? slug(cabeca.replace(/^\d+\.\s*/, ""))
    const [introBruta = "", ...blocos] = parte.split(/^(?=### )/m)
    const intro = introBruta.split("\n").slice(1).join("\n").replace(/<a id="[^"]*"><\/a>/g, "").replace(/^---\s*$/gm, "").trim()
    const regras = blocos.map((b): Regra => {
      const [, codigo = "", tituloDaRegra = ""] = b.match(CODIGO) ?? []
      const html = (s: string) => (s ? (marked.parse(s, { async: false }) as string) : "")
      return {
        codigo,
        titulo: tituloDaRegra.trim().replace(/[*`]/g, ""),
        tituloHtml: marked.parseInline(tituloDaRegra.trim(), { async: false }) as string,
        assumida: (() => {
          const nota = b.match(/^- \*Assumida, a confirmar:\* (.+)$/m)?.[1]
          return nota ? (marked.parseInline(nota, { async: false }) as string) : ""
        })(),
        arquivo: id,
        capitulo: cabeca.replace(/^\d+\.\s*/, ""),
        regra: html(campo(b, "Regra.")),
        porque: html(campo(b, "Por quê.")),
        confere: html(campo(b, "Confere.")),
        confereCurto: indice.get(codigo) ?? "",
        revogada: /revogad/i.test(tituloDaRegra),
      }
    })
    capitulos.push({
      titulo: cabeca.replace(/^\d+\.\s*/, ""),
      ancora,
      intro: intro ? (marked.parse(intro.replace(/^---\s*$/gm, ""), { async: false }) as string) : "",
      regras,
    })
  }
  return { id, arquivo, titulo, resumo, versao, capitulos }
}

export function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

let cache: ArquivoDaBase[] | null = null

/** Os três arquivos da base, lidos uma vez por processo. */
export function base(): ArquivoDaBase[] {
  if (cache) return cache
  const lidos = ARQUIVOS_DA_BASE.map((a) => lerArquivo(a.id, a.arquivo, a.titulo))
  const onde = new Map(lidos.flatMap((a) => a.capitulos.flatMap((c) => c.regras.map((r) => [r.codigo, a.id] as const))))
  const ligar = (html: string) => ligarCodigos(html, (c) => onde.get(c))
  for (const a of lidos)
    for (const c of a.capitulos) {
      c.intro = ligar(c.intro)
      for (const r of c.regras) {
        r.regra = ligar(r.regra)
        r.porque = ligar(r.porque)
        r.confere = ligar(r.confere)
        r.assumida = ligar(r.assumida)
      }
    }
  cache = lidos
  return cache
}

export function arquivoDaBase(id: string): ArquivoDaBase | undefined {
  return base().find((a) => a.id === id)
}

export function todasAsRegras(): Regra[] {
  return base().flatMap((a) => a.capitulos.flatMap((c) => c.regras))
}

export function regraPeloCodigo(codigo: string): Regra | undefined {
  return todasAsRegras().find((r) => r.codigo === codigo)
}

/** Onde a regra mora na vitrine: a página do arquivo com a âncora do código. */
export function hrefDaRegra(r: Pick<Regra, "arquivo" | "codigo">): string {
  return `/regras/${r.arquivo}/#${r.codigo}`
}

/** As linhas da tabela markdown dentro do campo Regra de uma regra (MSG-01, PECA-01), célula a célula, cruas. */
export function tabelaDaRegra(codigo: string): { cabecalho: string[]; linhas: string[][] } {
  const r = regraPeloCodigo(codigo)
  if (!r) throw new Error(`a regra ${codigo} não existe na base`)
  const texto = readFileSync(join(PASTA, ARQUIVOS_DA_BASE.find((a) => a.id === r.arquivo)!.arquivo), "utf8")
  const bloco = texto.split(/^(?=### )/m).find((b) => b.startsWith(`### ${codigo} · `)) ?? ""
  const linhas = campo(bloco, "Regra.")
    .split("\n")
    .filter((l) => l.startsWith("|") && !/^\|[\s|:-]+\|$/.test(l))
    .map((l) =>
      l
        .slice(1, -1)
        .split(/(?<!\\)\|/)
        .map((c) => c.trim())
    )
  const [cabecalho = [], ...resto] = linhas
  return { cabecalho, linhas: resto }
}

/** Uma célula de tabela da base em HTML inline, com as classes do kit. */
export function celula(markdown: string): string {
  return md("anatomia").parseInline(markdown, { async: false }) as string
}
