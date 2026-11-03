// O histórico de versões, lido do CHANGELOG.md da raiz no build. Um arquivo só
// para a vitrine e para quem atualiza um projeto; o teste cobra que a versão
// atual da base tem entrada.
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { Marked } from "marked"

import { ligarCodigos } from "@/vitrine/base"

export type Versao = { versao: string; data: string; camadas: string[]; muda: string; migracao: string }

const ARQUIVO = join(process.cwd(), "..", "..", "CHANGELOG.md")

const marked = new Marked({ gfm: true })
marked.use({
  renderer: {
    codespan({ text }) {
      return `<code class="t-medida text-foreground">${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code>`
    },
  },
})

function secao(corpo: string, titulo: string): string {
  const m = corpo.match(new RegExp(`^### ${titulo}\\n([\\s\\S]*?)(?=^### |(?![\\s\\S]))`, "m"))
  // O código de regra no texto vira link para ela, como nas páginas da base.
  return m ? ligarCodigos(marked.parse(m[1]!.trim(), { async: false }) as string) : ""
}

export function mudancas(): Versao[] {
  const texto = readFileSync(ARQUIVO, "utf8")
  return texto
    .split(/^(?=## )/m)
    .slice(1)
    .map((parte) => {
      const [, versao = "", data = ""] = parte.match(/^## (\S+) · (.+)$/m) ?? []
      const camadas = (parte.match(/^Camadas: (.+)$/m)?.[1] ?? "").split(",").map((c) => c.trim()).filter(Boolean)
      return { versao, data: data.trim(), camadas, muda: secao(parte, "O que muda"), migracao: secao(parte, "Migração") }
    })
}
