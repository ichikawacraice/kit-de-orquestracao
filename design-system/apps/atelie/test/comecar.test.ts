import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import { destinoDoLink, guia } from "@/vitrine/comecar"

const TEXTO = readFileSync(join(process.cwd(), "..", "..", "docs", "comecar.md"), "utf8")

// A página "Começar" é o docs/comecar.md lido no build: nada copiado à mão.
describe("o guia Começar vem de docs/comecar.md", () => {
  const g = guia()

  it("toda seção ## do arquivo vira um bloco, na mesma ordem", () => {
    const doArquivo = [...TEXTO.matchAll(/^## (.+)$/gm)].map((m) => m[1]!.replace(/`/g, ""))
    expect(doArquivo.length).toBeGreaterThan(4)
    expect(g.secoes.map((s) => s.titulo)).toEqual(doArquivo)
  })

  it("todo bloco de código vira um comando para copiar, sem sobrar nem faltar", () => {
    const doArquivo = [...TEXTO.matchAll(/^```\w*\n([\s\S]*?)\n```$/gm)].map((m) => m[1])
    const comandos = g.secoes.flatMap((s) => s.subsecoes.flatMap((sub) => sub.partes)).filter((p) => p.tipo === "comando").map((p) => p.texto)
    expect(comandos).toEqual(doArquivo)
  })

  it("todo link da página leva a algum lugar no site, na âncora ou fora (nenhum caminho do repositório solto)", () => {
    const html = [g.abertura, ...g.secoes.flatMap((s) => s.subsecoes.flatMap((sub) => sub.partes.map((p) => (p.tipo === "html" ? p.html : p.tipo === "tabela" ? [...p.cabecalho, ...p.linhas.flat()].join("") : ""))))].join("")
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!)
    expect(hrefs.length).toBeGreaterThan(5)
    expect(hrefs.filter((h) => !/^(https?:|\/|#)/.test(h))).toEqual([])
  })

  it("toda tabela do arquivo vira a Table do kit, com as linhas do arquivo", () => {
    const tabelas = g.secoes.flatMap((s) => s.subsecoes.flatMap((sub) => sub.partes)).filter((p) => p.tipo === "tabela")
    expect(tabelas.length).toBe([...TEXTO.matchAll(/^\|[-| ]+\|$/gm)].length)
    for (const t of tabelas) expect(t.linhas.every((l) => l.length === t.cabecalho.length)).toBe(true)
  })

  it("o comentário de quem escreve não chega à página", () => {
    const html = JSON.stringify(g)
    expect(html).not.toContain("<!--")
  })

  it("o link é resolvido a partir de docs/", () => {
    expect(destinoDoLink("instalar-pacotes.md")).toBe("https://github.com/wicomm-projects/wicomm-design-system/blob/main/docs/instalar-pacotes.md")
    expect(destinoDoLink("../plugins/design-system/README.md#x")).toBe("https://github.com/wicomm-projects/wicomm-design-system/blob/main/plugins/design-system/README.md#x")
    expect(destinoDoLink("../plugins/design-system/base/")).toBe("/regras/")
    expect(destinoDoLink("../plugins/wicomm/base/")).toBe("/regras/")
    expect(destinoDoLink("https://wicomm-atelie.vercel.app")).toBe("/")
    expect(destinoDoLink("#perguntas-comuns")).toBe("#perguntas-comuns")
  })
})
