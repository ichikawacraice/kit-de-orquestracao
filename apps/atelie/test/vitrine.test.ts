import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import { CLASSE_DA_ANIMACAO, CLASSE_DA_CURVA, CLASSE_DA_DURACAO, CLASSE_DO_ATRASO } from "@/components/vitrine/movimento"
import { ARQUIVOS_DA_BASE, base, tabelaDaRegra, todasAsRegras } from "@/vitrine/base"
import { GRUPOS_DE_COR, PARES } from "@/vitrine/cores"
import { NOMES_DOS_ICONES } from "@/vitrine/icones"
import { nomesDoKit } from "@/vitrine/kit"
import { mudancas } from "@/vitrine/mudancas"
import { TOKENS } from "@/vitrine/tokens"

const RAIZ = join(process.cwd(), "..", "..")

// O critério da vitrine que se confere sem o build: a base lida inteira, as
// listas escritas à mão iguais às da fonte. O cruzamento de TODO token e de
// TODA regra com as páginas geradas mora em scripts/conferir-saida.mjs (depois do build).
describe("a vitrine lê a base inteira", () => {
  const codigosNosArquivos = ARQUIVOS_DA_BASE.flatMap((a) =>
    [...readFileSync(join(RAIZ, "plugins", "design-system", "base", a.arquivo), "utf8").matchAll(/^### ([A-Z]+-\d{2}) · /gm)].map((m) => m[1])
  )

  it("toda regra dos três arquivos vira uma regra da vitrine, com os três campos", () => {
    const regras = todasAsRegras()
    expect(codigosNosArquivos.length).toBeGreaterThan(100)
    expect(regras.map((r) => r.codigo).sort()).toEqual([...codigosNosArquivos].sort())
    const semCampo = regras.filter((r) => !r.regra || !r.porque || !r.confere).map((r) => r.codigo)
    expect(semCampo).toEqual([])
  })

  it("a âncora de cada capítulo é única no arquivo", () => {
    for (const a of base()) {
      const ancoras = a.capitulos.map((c) => c.ancora)
      expect(new Set(ancoras).size, a.id).toBe(ancoras.length)
    }
  })

  it("o código citado no texto vira link, e só para regra que existe", () => {
    const html = todasAsRegras().map((r) => r.regra + r.porque + r.confere).join("")
    const alvos = [...html.matchAll(/href="\/regras\/(\w+)\/#([A-Z]+-\d{2})"/g)].map((m) => m[2])
    expect(alvos.length).toBeGreaterThan(0)
    expect(alvos.filter((c) => !codigosNosArquivos.includes(c))).toEqual([])
  })

  it("as tabelas da matriz de mensagens e da peça por função saem inteiras", () => {
    expect(tabelaDaRegra("MSG-01").cabecalho).toEqual(["Lugar", "Para quê", "Duração", "Peça", "Exemplo"])
    expect(tabelaDaRegra("MSG-01").linhas.length).toBeGreaterThanOrEqual(10)
    expect(tabelaDaRegra("PECA-01").cabecalho).toEqual(["Função", "Peça", "Não use"])
    expect(tabelaDaRegra("PECA-01").linhas.length).toBeGreaterThanOrEqual(30)
  })
})

describe("o que a vitrine escreve à mão concorda com a fonte", () => {
  it("as classes de movimento são as dos tokens, uma por token", () => {
    expect(Object.keys(CLASSE_DA_DURACAO).sort()).toEqual(Object.keys(TOKENS.duracoes).sort())
    expect(Object.keys(CLASSE_DO_ATRASO).sort()).toEqual(Object.keys(TOKENS.atrasos).sort())
    expect(Object.keys(CLASSE_DA_CURVA).sort()).toEqual(Object.keys(TOKENS.curvas).sort())
    expect(Object.keys(CLASSE_DA_ANIMACAO).sort()).toEqual(Object.keys(TOKENS.animacoes).sort())
  })

  it("toda cor do tema está num grupo, uma vez", () => {
    const variaveis = new Set([...Object.keys(TOKENS.variaveis.claro), ...Object.keys(TOKENS.variaveis.escuro)])
    const deCor = TOKENS.cores.map((c) => `--${c}`).concat(["--primary-gradient", "--ia-gradient"])
    const nosGrupos = GRUPOS_DE_COR.flatMap((g) => g.cores.map((c) => c.variavel))
    expect(new Set(nosGrupos).size).toBe(nosGrupos.length)
    expect([...nosGrupos].sort()).toEqual(deCor.filter((v) => variaveis.has(v)).sort())
  })

  it("os pares de contraste medem, e o que a base registra está lá", () => {
    const primario = PARES.find((p) => p.id === "primario")!
    expect(primario.medir("claro").razao).toBe(4.25)
    // Indistinguíveis por cor (MARCA-02). A base anota 1,16 medido na paleta do Tailwind v3; a v4 instalada dá 1,13.
    expect(PARES.find((p) => p.id === "marca-e-erro")!.medir("claro").razao).toBeLessThan(1.2)
    for (const p of PARES)
      for (const t of ["claro", "escuro"] as const) {
        const m = p.medir(t)
        expect(Number.isFinite(m.razao) && m.razao >= 1, `${p.id} ${t}`).toBe(true)
        if (p.piso !== null) expect(m.razao, `${p.id} ${t}`).toBeGreaterThanOrEqual(p.piso)
      }
  })

  it("o mapa de ícones é o dos ícones que o registro importa, nos dois sentidos", () => {
    const pasta = join(RAIZ, "packages", "registro", "registry")
    const arquivos = readdirSync(pasta, { recursive: true, encoding: "utf8" }).filter((f) => /\.tsx?$/.test(f))
    expect(arquivos.length).toBeGreaterThan(10)
    const importados = new Set(
      arquivos.flatMap((f) =>
        [...readFileSync(join(pasta, f), "utf8").matchAll(/import \{([^}]*)\} from "lucide-react"/g)].flatMap((m) => m[1]!.match(/\w+Icon\b/g) ?? [])
      )
    )
    expect([...NOMES_DOS_ICONES].sort()).toEqual([...importados].sort())
  })

  it("o índice de Peças leva o nome que se importa (é o que o filtro acha)", async () => {
    const { exportsDoItem } = await import("@/vitrine/kit")
    expect(exportsDoItem().get("chip-de-estado")).toContain("ChipDeEstado")
    expect(exportsDoItem().get("topo-da-pagina")).toContain("TopoDaPagina")
    // O principal primeiro, e tipo ou CONSTANTE fora da linha.
    expect(exportsDoItem().get("menu")![0]).toBe("Menu")
    expect(exportsDoItem().get("table")![0]).toBe("Table")
    expect(exportsDoItem().get("vazio")).not.toContain("CausaDoVazio")
    expect(exportsDoItem().get("bloco")).not.toContain("VOZ_DO_NOME_DE_BLOCO")
  })

  it("o kit conhece as peças que a base cita", () => {
    const kit = nomesDoKit()
    for (const n of ["Card", "Bloco", "Table", "ChipDeEstado", "Vazio", "useConfirm"]) expect(kit.has(n), n).toBe(true)
  })
})

describe("as mudanças", () => {
  it("a versão atual da base tem entrada, e a lista vem da mais nova para a mais velha", () => {
    const versoes = mudancas()
    const atual = base()[0]!.versao
    expect(base().every((a) => a.versao === atual)).toBe(true)
    expect(versoes.map((v) => v.versao)).toContain(atual)
    expect(versoes[0]!.versao).toBe(atual)
    for (const v of versoes) {
      expect(v.muda, v.versao).not.toBe("")
      expect(v.migracao, v.versao).not.toBe("")
      expect(v.data, v.versao).toMatch(/^\d{2}\/\d{2}\/\d{4}$/)
    }
  })
})

describe("a paleta das vozes é a do Tailwind instalado", () => {
  it("o oklch do theme.css vira o hex que o navegador pinta", async () => {
    const { paleta } = await import("@/vitrine/paleta")
    // Valores de referência do Tailwind v4 (oklch → sRGB).
    expect(paleta()["violet-300"]).toBe("#C4B4FF")
    expect(paleta()["rose-700"]).toBe("#C70036")
  })
})

describe("os campos da regra não levam o vizinho", () => {
  it("nenhum campo carrega o filete entre capítulos nem a nota a confirmar, que mora no próprio campo", () => {
    const vazaram = todasAsRegras().filter((r) => /<hr|Assumida, a confirmar/.test(r.regra + r.porque + r.confere)).map((r) => r.codigo)
    expect(vazaram).toEqual([])
    expect(todasAsRegras().filter((r) => r.assumida).length).toBeGreaterThan(0)
  })
})
