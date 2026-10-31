// SUP-07 — o que flutua cabe na tela: menu, popover e dica abertos limitam a
// altura ao espaço visível e rolam por dentro. O jsdom não mede layout; a troca
// de lado e a folga da borda se conferem no código (`cabem-na-tela.test.mjs`)
// e no ateliê.
import * as React from "react"
import { describe, expect, it } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

import { Button } from "@/registry/wicomm/ui/button"
import { ConteudoDoMenu, GatilhoDoMenu, GrupoDoMenu, ItemDoMenu, Menu } from "@/registry/wicomm/ui/menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/registry/wicomm/ui/popover"
import { Ajuda } from "@/registry/wicomm/ui/tooltip"

const classes = (el: Element) => el.className.split(/\s+/)

describe("o que flutua cabe na tela (SUP-07)", () => {
  it("o menu limita a altura ao visível e rola por dentro", () => {
    render(
      <Menu>
        <GatilhoDoMenu asChild>
          <Button>Abrir menu</Button>
        </GatilhoDoMenu>
        <ConteudoDoMenu>
          <GrupoDoMenu>
            <ItemDoMenu onEscolher={() => {}}>Uma</ItemDoMenu>
          </GrupoDoMenu>
        </ConteudoDoMenu>
      </Menu>
    )
    fireEvent.keyDown(screen.getByRole("button", { name: "Abrir menu" }), { key: "Enter" })
    expect(classes(screen.getByRole("menu"))).toEqual(
      expect.arrayContaining(["max-h-(--radix-dropdown-menu-content-available-height)", "overflow-y-auto"])
    )
  })

  it("o popover limita a altura ao visível e rola por dentro", () => {
    render(
      <Popover>
        <PopoverTrigger>Detalhe</PopoverTrigger>
        <PopoverContent>O que fazer agora.</PopoverContent>
      </Popover>
    )
    fireEvent.click(screen.getByRole("button", { name: "Detalhe" }))
    expect(classes(screen.getByText("O que fazer agora."))).toEqual(
      expect.arrayContaining(["max-h-(--radix-popover-content-available-height)", "overflow-y-auto"])
    )
  })

  it("a dica limita a altura ao visível e rola por dentro", async () => {
    render(
      <Ajuda texto="Abre o histórico">
        <Button>Histórico</Button>
      </Ajuda>
    )
    fireEvent.focus(screen.getByRole("button", { name: "Histórico" }))
    await screen.findByRole("tooltip")
    expect(classes(document.querySelector('[data-slot="tooltip-content"]')!)).toEqual(
      expect.arrayContaining(["max-h-(--radix-tooltip-content-available-height)", "overflow-y-auto"])
    )
  })
})
