// CTRL-01, CTRL-02, CTRL-03, CTRL-04 — a escala do botão, do campo e do seletor,
// e as variantes de forma do botão.
import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"

import { Button } from "@/registry/design-system/ui/button"
import { Input, classeDoCampo } from "@/registry/design-system/ui/input"
import { Label } from "@/registry/design-system/ui/label"
import { Select, SelectTrigger } from "@/registry/design-system/ui/select"

/**
 * O jsdom não calcula CSS: a altura se confere pela classe que a produz
 * (`h-ctrl` é 30px no tema). A altura EM PIXELS se mede no navegador; aqui se
 * prova que cada tamanho escreve a classe da sua medida e que o `cn` não deixa
 * uma segunda altura na lista.
 */
const ESCALA = [
  { size: "sm", altura: "h-[26px]", texto: "text-[12px]" },
  { size: "default", altura: "h-ctrl", texto: "text-[13px]" },
  { size: "lg", altura: "h-9", texto: "text-[14px]" },
  { size: "xl", altura: "h-11", texto: "text-[14px]" },
] as const

const classes = (el: Element) => el.className.split(/\s+/)
const alturas = (el: Element) => classes(el).filter((c) => /^h-/.test(c))
const textos = (el: Element) => classes(el).filter((c) => /^text-\[/.test(c))

describe("a escala do botão", () => {
  it.each(ESCALA)("$size escreve $altura e $texto, e nenhuma outra altura", ({ size, altura, texto }) => {
    render(<Button size={size}>Entrar</Button>)
    const botao = screen.getByRole("button", { name: "Entrar" })
    expect(alturas(botao)).toEqual([altura])
    expect(textos(botao)).toEqual([texto])
  })

  it("o xl troca o ícone de 14px pelo de 16px, e não soma os dois", () => {
    render(<Button size="xl">Entrar</Button>)
    expect(classes(screen.getByRole("button")).filter((c) => c.startsWith("[&_svg]:size-"))).toEqual(["[&_svg]:size-4"])
  })

  it("o de ícone é redondo, com a altura do default", () => {
    render(<Button size="icon" aria-label="Mais ações" />)
    const botao = screen.getByRole("button", { name: "Mais ações" })
    expect(classes(botao)).toContain("size-ctrl")
    expect(classes(botao)).toContain("rounded-full")
    expect(alturas(botao)).toEqual([])
  })

  // Sem o `compoundVariants`, o `h-*`/`px-*` do tamanho vencia o `h-auto px-0` do link no `cn`.
  it.each(ESCALA)("o link em $size é texto: sem altura e sem recuo", ({ size }) => {
    render(
      <Button variant="link" size={size}>
        Esqueci a senha
      </Button>
    )
    const link = screen.getByRole("button", { name: "Esqueci a senha" })
    expect(alturas(link)).toEqual(["h-auto"])
    expect(classes(link).filter((c) => /^px-/.test(c))).toEqual(["px-0"])
  })

  it("asChild entrega a forma ao filho, sem botão dentro de link", () => {
    render(
      <Button asChild variant="secondary">
        <a href="/x">Ir</a>
      </Button>
    )
    const link = screen.getByRole("link", { name: "Ir" })
    expect(link.getAttribute("data-slot")).toBe("button")
    expect(classes(link)).toContain("anel-de-controle")
    expect(screen.queryByRole("button")).toBeNull()
  })
})

describe("as variantes do botão são forma, não matiz", () => {
  const variante = (v: "default" | "secondary" | "outline" | "ghost" | "destructive" | "link") => {
    render(<Button variant={v}>{v}</Button>)
    return classes(screen.getByRole("button", { name: v }))
  }

  it("o primário é preenchido com a marca e passa ao primary-hover", () => {
    const c = variante("default")
    expect(c).toContain("bg-primary")
    expect(c).toContain("hover:bg-primary-hover")
  })

  it("secundário e contorno levam o anel de controle (COR-11), sem sombra", () => {
    for (const v of ["secondary", "outline"] as const) {
      const c = variante(v)
      expect(c).toContain("anel-de-controle")
      expect(c.filter((x) => /^shadow-(?!\[inset)/.test(x))).toEqual([])
    }
  })

  it("o destrutivo NUNCA é preenchido (MARCA-05)", () => {
    const c = variante("destructive")
    expect(c).toContain("text-destructive")
    expect(c).toContain("bg-transparent")
    expect(c).not.toContain("bg-destructive")
  })

  it("todo botão tem o foco da marca com deslocamento (SUP-06)", () => {
    const c = variante("ghost")
    for (const f of ["focus-visible:ring-2", "focus-visible:ring-ring", "focus-visible:ring-offset-2"]) expect(c).toContain(f)
  })
})

describe("o campo acompanha o botão", () => {
  it("sem tamanho, é o campo de painel: 30px e 13px, a altura do botão default", () => {
    render(
      <>
        <Input aria-label="Busca" />
        <Button>Buscar</Button>
      </>
    )
    const campo = screen.getByRole("textbox", { name: "Busca" })
    expect(alturas(campo)).toEqual(["h-ctrl"])
    expect(textos(campo)).toEqual(["text-[13px]"])
    expect(alturas(campo)).toEqual(alturas(screen.getByRole("button")))
  })

  it('tamanho="xl" é o campo da tela de Entrada: 40px e 14px, e não vaza para o DOM', () => {
    render(<Input aria-label="E-mail" tamanho="xl" />)
    const campo = screen.getByRole("textbox", { name: "E-mail" })
    expect(alturas(campo)).toEqual(["h-10"])
    expect(textos(campo)).toEqual(["text-[14px]"])
    expect(campo.getAttribute("tamanho")).toBeNull()
  })

  it("o contorno é o token de controle, e classeDoCampo() é a mesma lista do Input", () => {
    render(<Input aria-label="Nome" />)
    const campo = screen.getByRole("textbox", { name: "Nome" })
    expect(classes(campo)).toContain("border-input")
    expect(campo.className).toBe(classeDoCampo())
  })

  it("o gatilho do Select tem a altura e o contorno do campo", () => {
    render(
      <>
        <Select>
          <SelectTrigger aria-label="Ordem" />
        </Select>
        <Input aria-label="Busca" />
      </>
    )
    const gatilho = screen.getByRole("combobox", { name: "Ordem" })
    expect(alturas(gatilho)).toEqual(alturas(screen.getByRole("textbox", { name: "Busca" })))
    expect(classes(gatilho)).toContain("border-input")
    expect(classes(gatilho)).toContain("rounded-ctrl")
  })
})

describe("as vozes do rótulo (TIPO-02)", () => {
  it("o padrão é a voz de rótulo, e a voz de campo TROCA a classe em vez de somar", () => {
    render(
      <>
        <Label htmlFor="a">Prazo</Label>
        <Label htmlFor="b" voz="campo">
          Seu nome
        </Label>
      </>
    )
    const rotulo = classes(screen.getByText("Prazo"))
    const campo = classes(screen.getByText("Seu nome"))
    expect(rotulo).toContain("t-rotulo")
    expect(rotulo).not.toContain("t-campo")
    expect(campo).toContain("t-campo")
    expect(campo).not.toContain("t-rotulo")
  })

  it("o rótulo nomeia o campo", () => {
    render(
      <>
        <Label htmlFor="prazo">Prazo</Label>
        <Input id="prazo" />
      </>
    )
    expect(screen.getByRole("textbox", { name: "Prazo" })).not.toBeNull()
  })
})
