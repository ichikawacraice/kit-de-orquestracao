// SUP-01, MOV-01, MOV-02 — diálogo, dica, com-motivo e aviso.
import * as React from "react"
import { describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"

import { Button } from "@/registry/design-system/ui/button"
import { ComMotivo } from "@/registry/design-system/ui/com-motivo"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogLateral,
  DialogTitle,
  DialogTrigger,
} from "@/registry/design-system/ui/dialog"
import { ToastProvider, useToast, useToastSeHouver, type ToastInput } from "@/registry/design-system/ui/toast"
import { Ajuda } from "@/registry/design-system/ui/tooltip"

const classes = (el: Element) => el.className.split(/\s+/)

describe("o diálogo", () => {
  function Curto(props: Partial<React.ComponentProps<typeof DialogContent>>) {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button>Abrir</Button>
        </DialogTrigger>
        <DialogContent {...props}>
          <DialogTitle>Renomear</DialogTitle>
          <DialogDescription>O nome aparece na lista.</DialogDescription>
        </DialogContent>
      </Dialog>
    )
  }

  it("é superfície flutuante, raio de container, movimento de modal com escape", async () => {
    render(<Curto />)
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }))
    const dialogo = await screen.findByRole("dialog", { name: "Renomear" })
    const c = classes(dialogo)
    expect(dialogo.hasAttribute("data-superficie")).toBe(true)
    expect(c).toEqual(
      expect.arrayContaining([
        "superficie-flutuante",
        "rounded-2xl",
        "data-[state=open]:duration-modal-abre",
        "data-[state=closed]:duration-modal-fecha",
        "data-[state=open]:zoom-in-97",
        "motion-reduce:!animate-none",
      ])
    )
    // No v4 o centro é a propriedade `translate`; a animação que desliza somaria e tiraria o diálogo do centro.
    expect(c.filter((x) => x.includes("slide-in"))).toEqual([])
  })

  it("o X fecha; `fecharDesligado` o mostra desligado", async () => {
    const { unmount } = render(<Curto />)
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }))
    await screen.findByRole("dialog")
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    unmount()
    render(<Curto fecharDesligado />)
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }))
    await screen.findByRole("dialog")
    const fechar = screen.getByRole("button", { name: "Fechar" }) as HTMLButtonElement
    expect(fechar.disabled).toBe(true)
    expect(fechar.getAttribute("aria-disabled")).toBe("true")
  })

  // O `DialogLongo bloqueia` tem a sua bateria em `dialog-que-bloqueia.dom.test.tsx`.

  it("o lateral não é modal: sem véu, e clicar fora não o fecha", async () => {
    const aoMudar = vi.fn()
    render(
      <>
        <button type="button">fora</button>
        <Dialog open modal={false} onOpenChange={aoMudar}>
          <DialogLateral titulo="Histórico">linhas</DialogLateral>
        </Dialog>
      </>
    )
    await screen.findByRole("dialog", { name: "Histórico" })
    expect(document.querySelector("[data-overlay]")).toBeNull()
    // O Radix só ouve o clique de fora depois de um `setTimeout(0)`.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })
    const fora = screen.getByText("fora")
    fireEvent.pointerDown(fora, { button: 0 })
    fireEvent.mouseDown(fora, { button: 0 })
    fireEvent.mouseUp(fora, { button: 0 })
    fireEvent.click(fora, { button: 0 })
    fireEvent.focus(fora)
    expect(aoMudar).not.toHaveBeenCalled()
    // E o Esc fecha (a guarda não é vazia: só o clique fora é recusado).
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
    expect(aoMudar).toHaveBeenCalledWith(false)
  })

  describe("o lateral com fechaAoClicarFora", () => {
    async function abrir(corpo: React.ReactNode = "linhas", fora: React.ReactNode = null) {
      const aoMudar = vi.fn()
      render(
        <>
          <button type="button">fora</button>
          <div data-mantem-o-painel>
            <button type="button">outro item</button>
          </div>
          <div role="menu">
            <button type="button">opção</button>
          </div>
          {fora}
          <Dialog open modal={false} onOpenChange={aoMudar}>
            <DialogLateral titulo="Item" fechaAoClicarFora>
              {corpo}
            </DialogLateral>
          </Dialog>
        </>
      )
      await screen.findByRole("dialog", { name: "Item" })
      // O Radix só ouve o clique de fora depois de um `setTimeout(0)`.
      await act(async () => {
        await new Promise((r) => setTimeout(r, 20))
      })
      return aoMudar
    }
    const clicar = (el: Element) => {
      fireEvent.pointerDown(el, { button: 0 })
      fireEvent.mouseDown(el, { button: 0 })
      fireEvent.mouseUp(el, { button: 0 })
      fireEvent.click(el, { button: 0 })
    }

    it("clicar fora fecha", async () => {
      const aoMudar = await abrir()
      clicar(screen.getByText("fora"))
      expect(aoMudar).toHaveBeenCalledWith(false)
    })

    it("o foco que sai não fecha", async () => {
      const aoMudar = await abrir()
      fireEvent.focusIn(screen.getByText("fora"))
      expect(aoMudar).not.toHaveBeenCalled()
    })

    it("o que flutua por cima e o gatilho marcado não fecham", async () => {
      const aoMudar = await abrir()
      clicar(screen.getByText("opção"))
      clicar(screen.getByText("outro item"))
      expect(aoMudar).not.toHaveBeenCalled()
      // A guarda não é vazia: fora de tudo isso, fecha.
      clicar(screen.getByText("fora"))
      expect(aoMudar).toHaveBeenCalledWith(false)
    })

    it("o rascunho escrito segura o painel", async () => {
      const aoMudar = await abrir(<textarea aria-label="Comentário" />)
      const campo = screen.getByRole("textbox", { name: "Comentário" })
      fireEvent.change(campo, { target: { value: "meio comentário" } })
      clicar(screen.getByText("fora"))
      expect(aoMudar).not.toHaveBeenCalled()
      fireEvent.change(campo, { target: { value: "  " } })
      clicar(screen.getByText("fora"))
      expect(aoMudar).toHaveBeenCalledWith(false)
    })
  })
})

describe("a dica e o com-motivo", () => {
  it("Ajuda abre no foco, na superfície flutuante, com o movimento de dica", async () => {
    render(
      <Ajuda texto="Abre o histórico">
        <Button>Histórico</Button>
      </Ajuda>
    )
    fireEvent.focus(screen.getByRole("button", { name: "Histórico" }))
    const dica = await screen.findByRole("tooltip")
    expect(dica.textContent).toBe("Abre o histórico")
    const conteudo = document.querySelector('[data-slot="tooltip-content"]')!
    expect(classes(conteudo)).toEqual(expect.arrayContaining(["superficie-flutuante", "rounded-lg", "motion-reduce:!animate-none"]))
  })

  it("sem motivo, o filho passa como está", () => {
    const { container } = render(
      <ComMotivo motivo={null}>
        <Button disabled>Publicar</Button>
      </ComMotivo>
    )
    expect(container.firstElementChild!.tagName).toBe("BUTTON")
  })

  it("com motivo e desabilitado, um envoltório focável abre a dica do porquê", async () => {
    render(
      <ComMotivo motivo="Falta o nome">
        <Button disabled>Publicar</Button>
      </ComMotivo>
    )
    const envoltorio = document.querySelector('[data-slot="com-motivo"]') as HTMLElement
    expect(envoltorio.tabIndex).toBe(0)
    fireEvent.focus(envoltorio)
    expect((await screen.findByRole("tooltip")).textContent).toBe("Falta o nome")
  })

  it("com motivo e habilitado, o próprio botão é o gatilho: uma parada de Tab só", async () => {
    render(
      <ComMotivo motivo="Vai ao ar agora" desabilitado={false}>
        <Button>Publicar</Button>
      </ComMotivo>
    )
    expect(document.querySelector('[data-slot="com-motivo"]')).toBeNull()
    fireEvent.focus(screen.getByRole("button", { name: "Publicar" }))
    expect((await screen.findByRole("tooltip")).textContent).toBe("Vai ao ar agora")
  })
})

describe("o aviso", () => {
  let avisar: (t: ToastInput) => void = () => {}
  function Pega() {
    avisar = useToast()
    return null
  }

  it("useToast fora do provider falha alto; useToastSeHouver devolve null", () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(() => render(<Pega />)).toThrow(/ToastProvider/)
    erro.mockRestore()
    let fora: unknown = "x"
    function Talvez() {
      fora = useToastSeHouver()
      return null
    }
    render(<Talvez />)
    expect(fora).toBeNull()
  })

  it("o ok some sozinho; o ruim fica até ser fechado, como alerta", async () => {
    vi.useFakeTimers()
    try {
      render(
        <ToastProvider>
          <Pega />
        </ToastProvider>
      )
      act(() => {
        avisar({ titulo: "Salvo", tom: "ok" })
        avisar({ titulo: "Não salvou", tom: "ruim" })
      })
      expect(screen.getByRole("status").textContent).toContain("Salvo")
      const alerta = screen.getByRole("alert")
      expect(alerta.textContent).toContain("Não salvou")
      expect(classes(alerta)).toContain("text-rose-700")
      act(() => {
        vi.advanceTimersByTime(6000)
      })
      expect(screen.queryByText("Salvo")).toBeNull()
      expect(screen.getByText("Não salvou")).not.toBeNull()
      act(() => {
        fireEvent.click(screen.getByRole("button", { name: "Fechar aviso" }))
      })
      expect(screen.queryByText("Não salvou")).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it("o neutro fica na tinta do texto, não no cinza de legenda", () => {
    render(
      <ToastProvider>
        <Pega />
      </ToastProvider>
    )
    act(() => avisar({ titulo: "Exportação começou" }))
    const aviso = document.querySelector('[data-slot="toast"]') as HTMLElement
    expect(aviso.getAttribute("data-tom")).toBe("neutro")
    expect(classes(aviso)).toContain("text-foreground")
    expect(aviso.hasAttribute("data-superficie")).toBe(true)
  })

  // ACES-05: a região `status` existe vazia antes do texto; o leitor só anuncia o que entra numa região que já estava lá.
  it("a região de status da pilha está montada, vazia, antes do primeiro aviso", () => {
    render(
      <ToastProvider>
        <Pega />
      </ToastProvider>
    )
    const regiao = screen.getByRole("status")
    expect(regiao.getAttribute("data-slot")).toBe("toast-viewport")
    expect(regiao.textContent).toBe("")
    expect(regiao.getAttribute("aria-atomic")).toBe("false")
    act(() => avisar({ titulo: "Salvo", tom: "ok" }))
    expect(screen.getByRole("status")).toBe(regiao)
    expect(regiao.textContent).toContain("Salvo")
    // o cartão não cria uma segunda região de status; só o erro é `alert`
    expect(document.querySelector('[data-slot="toast"]')!.hasAttribute("role")).toBe(false)
  })

  // ACES-03: o jsdom não mede; a caixa de clique sai das classes — o ícone de 14px (size-3.5) mais o pseudo-elemento que o estende.
  it("o fechar mede 24px de alvo: ícone de 14px estendido em 5px por lado", () => {
    render(
      <ToastProvider>
        <Pega />
      </ToastProvider>
    )
    act(() => avisar({ titulo: "Salvo", tom: "ok" }))
    const fechar = screen.getByRole("button", { name: "Fechar aviso" })
    expect(classes(fechar)).toEqual(expect.arrayContaining(["relative", "after:absolute", "after:-inset-[5px]"]))
    expect(fechar.querySelector("svg")!.getAttribute("class")).toContain("size-3.5")
    expect(14 + 2 * 5).toBeGreaterThanOrEqual(24)
  })
})
