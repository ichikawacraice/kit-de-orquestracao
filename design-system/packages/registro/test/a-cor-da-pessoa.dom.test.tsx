// A cor da pessoa em todo monograma (COR-09): a mesma pessoa, pelo id, dá a
// mesma cor em toda peça que a represente — a lista, a pilha, o menu da conta,
// o pé da barra (aberta e recolhida), o par da barra do editor e o nome de quem
// fala na conversa.
import * as React from "react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { fireEvent, render } from "@testing-library/react"

import { BarraLateral } from "@/registry/design-system/blocks/casco/barra-lateral"
import { DESTINOS } from "@/registry/design-system/blocks/casco/navegacao"
import { GrupoDaPessoa } from "@/registry/design-system/ui/barra-do-editor"
import { AutorDaConversa } from "@/registry/design-system/ui/conversa"
import { MenuDaConta } from "@/registry/design-system/ui/menu-da-conta"
import { corDaPessoa } from "@/registry/design-system/ui/monograma"
import { Pessoa, PilhaDePessoas } from "@/registry/design-system/ui/pessoa"

const ID = "pessoa-ana"
const conta = { id: ID, nome: "Ana Souza", email: "ana@exemplo.com.br", onSair: () => {} }
const abrir = (gatilho: HTMLElement) => fireEvent.keyDown(gatilho, { key: "Enter" })
const cores = (raiz: ParentNode = document) =>
  Array.from(raiz.querySelectorAll<HTMLElement>("[data-slot=monograma]")).map((m) => m.dataset.cor)

beforeEach(() => localStorage.clear())
afterEach(() => document.documentElement.removeAttribute("data-barra-recolhida"))

describe("a mesma pessoa, a mesma cor em toda peça", () => {
  it("lista, pilha, menu da conta, pé da barra aberta e recolhida, barra do editor e conversa", () => {
    const esperada = corDaPessoa(ID)
    const vistas: (string | undefined)[] = []

    const lista = render(
      <>
        <Pessoa pessoa={{ id: ID, nome: "Ana Souza" }} />
        <Pessoa pessoa={{ id: ID, nome: "Ana Souza" }} soMonograma />
        <PilhaDePessoas pessoas={[{ id: ID, nome: "Ana Souza" }]} />
      </>
    )
    vistas.push(...cores(lista.container))
    lista.unmount()

    const menu = render(
      <MenuDaConta {...conta}>
        <button>Conta</button>
      </MenuDaConta>
    )
    abrir(menu.getByRole("button", { name: "Conta" }))
    const topo = document.querySelector("[data-slot=topo-do-menu-da-conta]") as HTMLElement
    expect(topo).toBeTruthy()
    vistas.push(...cores(topo))
    menu.unmount()

    const aberta = render(<BarraLateral grupos={DESTINOS} caminhoAtual="/pedidos" conta={conta} />)
    vistas.push(...cores(aberta.getByRole("button", { name: "Conta de Ana Souza" })))
    aberta.unmount()

    localStorage.setItem("wicomm-barra", "recolhida")
    const recolhida = render(<BarraLateral grupos={DESTINOS} caminhoAtual="/pedidos" conta={conta} />)
    expect(document.documentElement.hasAttribute("data-barra-recolhida")).toBe(true)
    vistas.push(...cores(recolhida.getByRole("button", { name: "Conta de Ana Souza" })))
    recolhida.unmount()

    const editor = render(<GrupoDaPessoa conta={conta} />)
    vistas.push(...cores(editor.container))
    editor.unmount()

    const conversa = render(<AutorDaConversa nome="Ana Souza" chave={ID} />)
    vistas.push(conversa.getByText("Ana Souza").dataset.cor)

    // Insumo não vazio: as 8 vistas (3 da lista, menu, barra aberta, recolhida, editor, conversa).
    expect(vistas).toHaveLength(8)
    expect(vistas).toEqual(Array(8).fill(esperada))
  })

  it("sem id, toda peça fica neutra — depois de provar que com id a cor aparece", () => {
    const com = render(<GrupoDaPessoa conta={conta} />)
    expect(cores(com.container)).toEqual([corDaPessoa(ID)])
    com.unmount()
    for (const id of [null, "", "  "]) {
      const sem = render(
        <>
          <GrupoDaPessoa conta={{ ...conta, id }} />
          <Pessoa pessoa={{ id, nome: "Ana Souza" }} />
          <AutorDaConversa nome="Ana Souza" chave={id} />
        </>
      )
      expect(cores(sem.container)).toEqual([undefined, undefined])
      expect(sem.getAllByText("Ana Souza").at(-1)!.hasAttribute("data-cor")).toBe(false)
      sem.unmount()
    }
  })
})
