// O `cn` do estilo: o tailwind-merge sabe os nomes do tema Wicomm.
import { describe, expect, it } from "vitest"

import { cn } from "@/registry/wicomm/lib/utils"

describe("cn", () => {
  it("text-legenda é TAMANHO: uma cor depois não o apaga", () => {
    expect(cn("text-legenda", "text-muted-foreground")).toBe("text-legenda text-muted-foreground")
  })

  it("text-controle troca com outro tamanho", () => {
    expect(cn("text-sm", "text-controle")).toBe("text-controle")
  })

  it("os raios nomeados disputam o mesmo canto, e ganha o último", () => {
    expect(cn("rounded-md", "rounded-ctrl")).toBe("rounded-ctrl")
    expect(cn("rounded-ctrl", "rounded-full")).toBe("rounded-full")
    expect(cn("rounded-2xl", "rounded-painel")).toBe("rounded-painel")
  })

  it("h-ctrl e size-ctrl são altura e tamanho", () => {
    expect(cn("h-ctrl", "h-auto")).toBe("h-auto")
    expect(cn("h-9", "h-ctrl")).toBe("h-ctrl")
    expect(cn("size-ctrl", "size-6")).toBe("size-6")
  })

  it("as durações e curvas de token trocam entre si e com as do Tailwind", () => {
    expect(cn("duration-cor", "duration-200")).toBe("duration-200")
    expect(cn("duration-menu-abre", "duration-menu-fecha")).toBe("duration-menu-fecha")
    expect(cn("ease-out", "ease-abre")).toBe("ease-abre")
    expect(cn("delay-veu", "delay-espiada-abre")).toBe("delay-espiada-abre")
  })

  it("superfícies e vozes: a última passada ganha", () => {
    expect(cn("superficie", "superficie-flutuante")).toBe("superficie-flutuante")
    expect(cn("t-rotulo", "t-campo")).toBe("t-campo")
  })

  it("a cor de texto continua sendo cor", () => {
    expect(cn("text-foreground-2", "text-foreground")).toBe("text-foreground")
    expect(cn("max-w-lg", "max-w-medida")).toBe("max-w-medida")
  })
})
