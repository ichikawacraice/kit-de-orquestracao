import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { DEMOS } from "@/catalogo/demos"
import { ITENS, SECOES, itensDaSecao } from "@/catalogo/registro"
import { registro } from "@wicomm/registro/lib/registro.mjs"

// O critério do ateliê: toda peça do registry.json aparece aqui, viva.
describe("o catálogo e o registro", () => {
  const doRegistro = registro().items.map((i: { name: string }) => i.name).sort()

  it("o ateliê lê o registry.json gravado, igual ao que o registro gera", () => {
    expect(ITENS.map((i) => i.name).sort()).toEqual(doRegistro)
  })

  it("todo item do registro tem demonstração viva", () => {
    const semDemo = doRegistro.filter((n: string) => !DEMOS[n])
    expect(semDemo, "itens do registro sem demonstração em src/catalogo/demos").toEqual([])
  })

  it("toda demonstração é de um item do registro", () => {
    const orfas = Object.keys(DEMOS).filter((n) => !doRegistro.includes(n))
    expect(orfas, "demonstrações sem item no registro").toEqual([])
  })

  it("todo item cai numa seção da navegação", () => {
    const listados = SECOES.flatMap((s) => itensDaSecao(s.id).map((i) => i.name)).sort()
    expect(listados).toEqual(doRegistro)
  })

  it.each(doRegistro)("a demonstração de %s monta sem erro", (nome: string) => {
    const Demo = DEMOS[nome]!
    const { container } = render(<Demo />)
    expect(container.textContent?.trim().length ?? 0).toBeGreaterThan(0)
  })
})
