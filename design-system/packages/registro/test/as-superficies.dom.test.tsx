// SUP-01, SUP-03, SUP-04, FORMA-01, FORMA-03, LAY-03 — cartão, painel, seção,
// bloco, bloco de tinta e esqueleto.
import { describe, expect, it } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

import { TINTA_DO_TOM, TONS } from "@/registry/design-system/lib/idioma-de-cor"
import { Bloco } from "@/registry/design-system/ui/bloco"
import { BlocoDeTinta, GrupoDeTinta } from "@/registry/design-system/ui/bloco-de-tinta"
import { Card, CardContent, CardHeader, CardTitle } from "@/registry/design-system/ui/card"
import { Painel, PainelDeSecao, RolagemDoPainel } from "@/registry/design-system/ui/painel"
import { Secao, TopoDoPainel } from "@/registry/design-system/ui/secao"
import { EsperaDaLista, Skeleton } from "@/registry/design-system/ui/skeleton"

const classes = (el: Element) => el.className.split(/\s+/)

describe("toda superfície se declara (SUP-04) e não desenha contorno (FORMA-03)", () => {
  it("cartão: peça opaca com sombra, raio de container, sem border", () => {
    const { container } = render(
      <Card>
        <CardHeader>
          <CardTitle>Nome</CardTitle>
        </CardHeader>
        <CardContent>conteúdo</CardContent>
      </Card>
    )
    const cartao = container.firstElementChild!
    expect(cartao.hasAttribute("data-superficie")).toBe(true)
    expect(classes(cartao)).toEqual(expect.arrayContaining(["superficie", "rounded-2xl"]))
    expect(classes(cartao).filter((c) => /^border/.test(c))).toEqual([])
    expect(classes(screen.getByText("Nome"))).toContain("t-titulo")
  })

  it("painel: a classe de painel, recorte relativo, e a rolagem contida", () => {
    render(
      <Painel aria-label="Fila">
        <RolagemDoPainel data-testid="rola">linhas</RolagemDoPainel>
      </Painel>
    )
    const painel = screen.getByRole("region", { name: "Fila" })
    expect(painel.tagName).toBe("SECTION")
    expect(painel.hasAttribute("data-superficie")).toBe(true)
    expect(classes(painel)).toEqual(expect.arrayContaining(["painel", "relative", "overflow-hidden"]))
    expect(classes(screen.getByTestId("rola"))).toEqual(expect.arrayContaining(["relative", "overflow-y-auto", "overscroll-contain"]))
  })

  it("painel `as` troca a tag e mantém a superfície", () => {
    const { container } = render(<Painel as="aside">x</Painel>)
    expect(container.firstElementChild!.tagName).toBe("ASIDE")
    expect(container.firstElementChild!.hasAttribute("data-superficie")).toBe(true)
  })

  it("seção em painel: um painel com a seção de dentro sempre `primeira`", () => {
    const { container } = render(<PainelDeSecao titulo="Contexto">texto</PainelDeSecao>)
    const secao = container.querySelector("[data-secao]")!
    expect(container.firstElementChild!.hasAttribute("data-superficie")).toBe(true)
    expect(classes(secao)).not.toContain("mt-[30px]")
  })
})

describe("a seção separa por ar e rótulo (SUP-03, LAY-03)", () => {
  it("30px acima e 12px abaixo do rótulo, sem filete; a primeira não tem o ar de cima", () => {
    const { container } = render(
      <>
        <Secao primeira titulo="Um">a</Secao>
        <Secao titulo="Dois" contagem="6/7" acao={<button type="button">Editar</button>}>
          b
        </Secao>
      </>
    )
    const [um, dois] = Array.from(container.querySelectorAll("section"))
    expect(classes(um!)).not.toContain("mt-[30px]")
    expect(classes(dois!)).toContain("mt-[30px]")
    expect(classes(dois!).filter((c) => c.startsWith("border"))).toEqual([])
    expect(classes(dois!.querySelector("header")!)).toContain("mb-3")
    expect(screen.getByRole("heading", { name: "Dois", level: 3 }).className).toContain("t-rotulo")
    expect(screen.getByText("6/7").className).toContain("font-mono")
  })

  it("`filete` troca o ar por um fio de tinta com 24px dos dois lados", () => {
    const { container } = render(
      <Secao titulo="Curto" filete>
        x
      </Secao>
    )
    expect(classes(container.firstElementChild!)).toEqual(expect.arrayContaining(["mt-6", "border-t", "pt-6"]))
  })

  it("`data-secao` sai sempre, vazio sem nome; com nome vira âncora", () => {
    const { container } = render(
      <>
        <Secao titulo="Sem">x</Secao>
        <Secao titulo="Com" nome="prazos">
          y
        </Secao>
      </>
    )
    const [sem, com] = Array.from(container.querySelectorAll("section"))
    expect(sem!.getAttribute("data-secao")).toBe("")
    expect(com!.id).toBe("prazos")
  })

  it("o topo do painel solto não tem o respiro de borda", () => {
    const { container } = render(<TopoDoPainel titulo="Coluna" solto />)
    expect(container.firstElementChild!.getAttribute("data-solto")).toBe("true")
    expect(classes(container.firstElementChild!)).toContain("pt-0")
  })
})

describe("o bloco: o nome fora, o conteúdo no cartão", () => {
  it("o título é h2 na voz de título, fora do cartão; o cartão é a superfície", () => {
    render(
      <Bloco titulo="Entrega" acao={<button type="button">Editar</button>}>
        <p>conteúdo</p>
      </Bloco>
    )
    const titulo = screen.getByRole("heading", { name: "Entrega", level: 2 })
    expect(titulo.className).toContain("t-titulo")
    const miolo = screen.getByText("conteúdo").parentElement!
    expect(miolo.hasAttribute("data-superficie")).toBe(true)
    expect(miolo.contains(titulo)).toBe(false)
    expect(miolo.contains(screen.getByRole("button", { name: "Editar" }))).toBe(false)
  })

  it("recolhível: o cabeçalho abre e fecha, e aponta o miolo", () => {
    render(
      <Bloco titulo="Detalhes" recolhivel resumo="3 itens" abertoPorPadrao={false}>
        <p>miolo</p>
      </Bloco>
    )
    const cabecalho = screen.getByRole("button", { name: /Detalhes/ })
    expect(cabecalho.getAttribute("aria-expanded")).toBe("false")
    const miolo = document.getElementById(cabecalho.getAttribute("aria-controls")!)!
    expect(miolo.hidden).toBe(true)
    expect(screen.getByText("3 itens")).not.toBeNull()
    fireEvent.click(cabecalho)
    expect(cabecalho.getAttribute("aria-expanded")).toBe("true")
    expect(miolo.hidden).toBe(false)
  })

  it("`abrirQuando` abre o bloco fechado quando o valor deixa de ser nulo", () => {
    const { rerender } = render(
      <Bloco titulo="Campos" recolhivel resumo="r" abertoPorPadrao={false} abrirQuando={null}>
        <p>miolo</p>
      </Bloco>
    )
    const cabecalho = screen.getByRole("button", { name: /Campos/ })
    expect(cabecalho.getAttribute("aria-expanded")).toBe("false")
    rerender(
      <Bloco titulo="Campos" recolhivel resumo="r" abertoPorPadrao={false} abrirQuando="prazo">
        <p>miolo</p>
      </Bloco>
    )
    expect(cabecalho.getAttribute("aria-expanded")).toBe("true")
  })

  it("só a entrada anima, com escape (MOV-02, MOV-03)", () => {
    render(
      <Bloco titulo="X" recolhivel resumo="r">
        <p>miolo</p>
      </Bloco>
    )
    const envoltorio = screen.getByText("miolo").parentElement!.parentElement!
    expect(classes(envoltorio)).toEqual(expect.arrayContaining(["animate-in", "motion-reduce:animate-none"]))
    expect(classes(envoltorio).filter((c) => c.includes("animate-out"))).toEqual([])
  })
})

describe("o bloco de tinta: degrau sem contorno, a cor sai da voz (COR-03, COR-05)", () => {
  it.each(TONS)("tom %s usa a tinta do idioma de cor", (tom) => {
    const { container } = render(<BlocoDeTinta tom={tom}>x</BlocoDeTinta>)
    const bloco = container.firstElementChild!
    expect(bloco.getAttribute("data-tom")).toBe(tom)
    for (const c of TINTA_DO_TOM[tom].split(" ")) expect(classes(bloco)).toContain(c)
    expect(classes(bloco)).toContain("rounded-xl")
    expect(bloco.hasAttribute("data-superficie")).toBe(false)
    expect(classes(bloco).filter((c) => /^border/.test(c))).toEqual([])
  })

  it("o grupo de tinta põe o rótulo dentro da tinta", () => {
    const { container } = render(
      <GrupoDeTinta tom="espera" titulo="Esperam você" contagem={2}>
        <p>a</p>
      </GrupoDeTinta>
    )
    const grupo = container.firstElementChild!
    expect(grupo.contains(screen.getByRole("heading", { name: "Esperam você" }))).toBe(true)
    expect(classes(grupo)).toContain("bg-amber-500/15")
    expect(screen.getByText("2").className).toContain("text-foreground-2")
  })
})

describe("o esqueleto", () => {
  // Asserção de classe: o jsdom não computa CSS; a caixa parada sob movimento reduzido é medição de navegador.
  it("pulsa, e para sob motion-reduce (MOV-02)", () => {
    const { container } = render(<Skeleton className="h-4" />)
    const caixa = container.firstElementChild as HTMLElement
    expect(caixa.className).toMatch(/\banimate-pulse\b/)
    expect(caixa.className).toMatch(/motion-reduce:animate-none/)
    expect(caixa.className).toMatch(/bg-foreground\/\[0\.06\]/)
  })

  it("a espera da lista se declara e diz o que vem", () => {
    render(<EsperaDaLista linhas={3} alturaDaLinha="h-10" rotulo="Os pedidos" />)
    const espera = screen.getByRole("status")
    expect(espera.getAttribute("aria-busy")).toBe("true")
    expect(espera.textContent).toBe("Os pedidos")
    expect(espera.querySelectorAll('[data-slot="skeleton"]').length).toBe(3)
  })
})
