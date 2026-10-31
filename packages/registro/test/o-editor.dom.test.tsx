// O Editor (ARQ-03, CASCO-01 fora do casco, CASCO-03 e TIPO-04 na barra): as
// peças que ele pede — a dobra, o popover, a barra e as colunas — e o bloco,
// montado com a carga de exemplo nos estados que a revisão de arquitetura pede.
import * as React from "react"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { FileTextIcon } from "lucide-react"

import { BarraDoEditor, GrupoDaPessoa } from "@/registry/wicomm/ui/barra-do-editor"
import {
  ColunasDoEditor,
  ItemDaEstrutura,
  ItemDoTrilho,
  LARGURA_DA_COLUNA,
  LARGURA_DA_ESTRUTURA,
  LARGURA_DO_TRILHO,
  PISO_DO_CANVAS,
  VAO_DAS_COLUNAS,
  estruturaCabe,
} from "@/registry/wicomm/ui/colunas-do-editor"
import { Dobra } from "@/registry/wicomm/ui/dobra"
import { Popover, PopoverContent, PopoverTrigger } from "@/registry/wicomm/ui/popover"
import { CascoDoEditor, EditorDeDocumento } from "@/registry/wicomm/blocks/editor/editor-de-documento"
import { cargaDoEditor, pendenciasDe } from "@/registry/wicomm/blocks/editor/dados-do-editor"

const conta = { nome: "Ana Souza", email: "ana@exemplo.com.br", onSair: () => {} }
const editor = (estado?: string) => (
  <CascoDoEditor>
    <EditorDeDocumento carga={cargaDoEditor("7", estado)} conta={conta} />
  </CascoDoEditor>
)
const abrir = (gatilho: HTMLElement) => fireEvent.keyDown(gatilho, { key: "Enter" })

/** As colunas leem a própria largura: o jsdom não mede, então a medida entra aqui. */
function comLargura(px: number) {
  const antes = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth")
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => px })
  return () => (antes ? Object.defineProperty(HTMLElement.prototype, "clientWidth", antes) : undefined)
}

afterEach(() => {
  vi.useRealTimers()
  localStorage.clear()
})

describe("a dobra (PECA-01)", () => {
  it("fechada não monta o conteúdo; o gatilho diz se abre", () => {
    render(
      <Dobra rotulo="Aparência">
        <p>o campo</p>
      </Dobra>
    )
    const gatilho = screen.getByRole("button", { name: "Aparência" })
    expect(gatilho.getAttribute("aria-expanded")).toBe("false")
    expect(screen.queryByText("o campo")).toBeNull()
    fireEvent.click(gatilho)
    expect(gatilho.getAttribute("aria-expanded")).toBe("true")
    expect(screen.getByText("o campo").parentElement!.id).toBe(gatilho.getAttribute("aria-controls"))
  })

  it("entra com o tempo da dobra e para com movimento reduzido (MOV-02); sem conteúdo, não monta", () => {
    render(
      <Dobra rotulo="Conteúdo" abertaDeInicio>
        <p>x</p>
      </Dobra>
    )
    expect(screen.getByText("x").parentElement!.className).toEqual(expect.stringContaining("duration-dobra-abre"))
    expect(screen.getByText("x").parentElement!.className).toEqual(expect.stringContaining("motion-reduce:animate-none"))
    const { container } = render(<Dobra rotulo="Vazia">{""}</Dobra>)
    expect(container.innerHTML).toBe("")
  })
})

describe("o popover", () => {
  it("abre no clique, na superfície flutuante", () => {
    render(
      <Popover>
        <PopoverTrigger>Detalhe</PopoverTrigger>
        <PopoverContent>O que fazer agora.</PopoverContent>
      </Popover>
    )
    fireEvent.click(screen.getByRole("button", { name: "Detalhe" }))
    const conteudo = screen.getByText("O que fazer agora.")
    expect(conteudo.className).toContain("superficie-flutuante")
    expect(conteudo.hasAttribute("data-superficie")).toBe(true)
  })
})

describe("a barra do editor (ARQ-03, CASCO-03, TIPO-04)", () => {
  it("uma linha de altura fixa, a volta como link, e o nome é o h1 na voz de título", () => {
    render(<BarraDoEditor voltar={{ href: "/documentos", rotulo: "Voltar aos documentos" }} nome="Proposta" acoes={<button>Publicar</button>} />)
    const barra = screen.getByRole("group", { name: "Barra do editor" })
    expect(barra.className).toEqual(expect.stringContaining("h-11"))
    expect(barra.className).not.toContain("flex-wrap")
    expect(screen.getByRole("link", { name: "Voltar aos documentos" }).getAttribute("href")).toBe("/documentos")
    const h1 = screen.getByRole("heading", { level: 1, name: "Proposta" })
    expect(h1.className).toContain("t-titulo")
    expect(h1.className).not.toContain("t-display")
  })

  it("a pessoa ao fim: tema e conta, os do pé da barra lateral", () => {
    render(<GrupoDaPessoa conta={conta} />)
    expect(screen.getByRole("button", { name: /^Tema:/ })).toBeTruthy()
    abrir(screen.getByRole("button", { name: "Conta: Ana Souza" }))
    expect(screen.getByRole("menuitem", { name: "Sair" })).toBeTruthy()
  })
})

describe("as colunas do editor (ARQ-03: o canvas nunca abaixo de 60%)", () => {
  it("as medidas a 1280: 968px sem inspector, 620px proibido, 860px com o trilho", () => {
    const colunas = 1280 - 16
    expect(estruturaCabe(colunas, 0)).toBe(true)
    expect(colunas - LARGURA_DA_ESTRUTURA - VAO_DAS_COLUNAS).toBe(968)
    const coluna = LARGURA_DA_COLUNA + VAO_DAS_COLUNAS
    expect(colunas - LARGURA_DA_ESTRUTURA - VAO_DAS_COLUNAS - coluna).toBe(620)
    expect(estruturaCabe(colunas, coluna)).toBe(false)
    expect(colunas - LARGURA_DO_TRILHO - VAO_DAS_COLUNAS - coluna).toBe(860)
    expect(860 / colunas).toBeGreaterThan(PISO_DO_CANVAS)
    // A estrutura aberta só cabe com o inspector a partir de 1610px de colunas (1626px de tela).
    expect(estruturaCabe(1609, coluna)).toBe(false)
    expect(estruturaCabe(1610, coluna)).toBe(true)
    expect(estruturaCabe(0, coluna)).toBe(true)
  })

  it("as constantes são as classes da peça", () => {
    const fonte = readFileSync(resolve(process.cwd(), "registry/wicomm/ui/colunas-do-editor.tsx"), "utf8")
    expect(LARGURA_DA_ESTRUTURA).toBe(72 * 4)
    expect(LARGURA_DO_TRILHO).toBe(12 * 4)
    expect(LARGURA_DA_COLUNA).toBe(85 * 4)
    expect(VAO_DAS_COLUNAS).toBe(2 * 4)
    for (const classe of ["w-72", "w-12", "w-85", "gap-2"]) expect(fonte).toContain(classe)
  })

  function Colunas({ inspector, onDarLugar = () => {} }: { inspector: boolean; onDarLugar?: () => void }) {
    const [pedida, setPedida] = React.useState(true)
    const [aberta, setAberta] = React.useState(inspector)
    return (
      <ColunasDoEditor
        tituloDaEstrutura="Estrutura"
        estrutura={<ItemDaEstrutura icone={FileTextIcon} nome="Capa" ativo onSelecionar={() => {}} />}
        trilho={<ItemDoTrilho icone={FileTextIcon} nome="Capa" ativo onSelecionar={() => {}} situacao={{ tom: "espera", palavra: "com pendência" }} />}
        estruturaPedida={pedida}
        onPedirEstrutura={setPedida}
        canvas={<p>a página</p>}
        direita={{
          titulo: "Capa",
          aberta,
          conteudo: <p>os campos</p>,
          onFechar: () => setAberta(false),
          onDarLugar: () => {
            setAberta(false)
            onDarLugar()
          },
        }}
      />
    )
  }

  it("a 1280, com o inspector aberto, a estrutura vira trilho; abrir a estrutura pede lugar ao inspector", () => {
    const voltar = comLargura(1264)
    const onDarLugar = vi.fn()
    try {
      const { container } = render(<Colunas inspector onDarLugar={onDarLugar} />)
      const estrutura = container.querySelector('nav[aria-label="Estrutura"]')!
      expect(estrutura.getAttribute("data-recolhida")).toBe("true")
      expect(screen.getByRole("complementary", { name: "Capa" })).toBeTruthy()
      // No trilho, o nome e a situação no rótulo do botão; o ponto é só enfeite.
      expect(screen.getByRole("button", { name: "Capa, com pendência" }).getAttribute("aria-pressed")).toBe("true")
      fireEvent.click(screen.getByRole("button", { name: "Abrir a estrutura" }))
      expect(onDarLugar).toHaveBeenCalledOnce()
    } finally {
      voltar()
    }
  })

  it("sem inspector, a estrutura fica aberta; fechá-la é gesto da pessoa", () => {
    const voltar = comLargura(1264)
    try {
      const { container } = render(<Colunas inspector={false} />)
      const estrutura = container.querySelector('nav[aria-label="Estrutura"]')!
      expect(estrutura.getAttribute("data-recolhida")).toBe("false")
      fireEvent.click(screen.getByRole("button", { name: "Fechar a estrutura" }))
      expect(estrutura.getAttribute("data-recolhida")).toBe("true")
    } finally {
      voltar()
    }
  })

  it("reabrir a estrutura pelo trilho leva o foco à linha ativa (validador, A5)", () => {
    const voltar = comLargura(1264)
    try {
      render(<Colunas inspector onDarLugar={() => {}} />)
      const abrir = screen.getByRole("button", { name: "Abrir a estrutura" })
      abrir.focus()
      fireEvent.click(abrir)
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Capa", pressed: true }))
    } finally {
      voltar()
    }
  })

  it("abaixo de 1280 de tela, a coluna da direita vira gaveta", () => {
    const voltar = comLargura(1000)
    try {
      render(<Colunas inspector />)
      expect(screen.queryByRole("complementary", { name: "Capa" })).toBeNull()
      expect(screen.getByRole("dialog", { name: "Capa" })).toBeTruthy()
      expect(screen.getByText("os campos")).toBeTruthy()
    } finally {
      voltar()
    }
  })
})

describe("o bloco Editor (ARQ-01, ARQ-03, PESO-03, MSG-01, MSG-06)", () => {
  it("pronto: a seção selecionada no inspector, em duas dobras; o rascunho diz as mudanças, e Publicar existe", () => {
    render(editor())
    expect(screen.getAllByRole("heading", { level: 1 }).map((h) => h.textContent)).toEqual(["Proposta comercial"])
    expect(screen.getByText("2 mudanças")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Publicar" })).toBeTruthy()
    const inspector = screen.getByRole("complementary", { name: "Capa" })
    expect(within(inspector).getByRole("button", { name: "Conteúdo" }).getAttribute("aria-expanded")).toBe("true")
    expect(within(inspector).getByRole("button", { name: "Aparência" }).getAttribute("aria-expanded")).toBe("false")
    expect((within(inspector).getByLabelText("Título") as HTMLInputElement).value).toBe("Proposta de parceria")
    // A seção selecionada sobe um degrau no canvas, e se declara superfície.
    const naPagina = document.querySelector('section[data-selecionada]')!
    expect(naPagina.getAttribute("aria-label")).toBe("Capa")
    expect(naPagina.className).toContain("superficie-alta")
    expect(naPagina.hasAttribute("data-superficie")).toBe(true)
  })

  it("mudar um campo é um passo: o canvas muda, a contagem sobe, e desfazer volta", () => {
    render(editor())
    const titulo = screen.getByLabelText("Título")
    fireEvent.change(titulo, { target: { value: "Proposta nova" } })
    fireEvent.change(titulo, { target: { value: "Proposta nova, revista" } })
    expect(screen.getByRole("heading", { level: 2, name: "Proposta nova, revista" })).toBeTruthy()
    expect(screen.getByText("3 mudanças")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Desfazer" }))
    expect(screen.getByRole("heading", { level: 2, name: "Proposta de parceria" })).toBeTruthy()
    expect(screen.getByText("2 mudanças")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Refazer" }))
    expect(screen.getByText("3 mudanças")).toBeTruthy()
  })

  it("publicar: o botão e o carimbo dizem que anda, e depois Publicado; sem mudanças, o botão some (PESO-03)", async () => {
    vi.useFakeTimers()
    render(editor())
    fireEvent.click(screen.getByRole("button", { name: "Publicar" }))
    expect(screen.getByRole("button", { name: "Publicando" }).hasAttribute("disabled")).toBe(true)
    expect(document.querySelector('[data-slot="chip-de-estado"]')!.textContent).toBe("Publicando")
    await act(async () => void vi.advanceTimersByTime(1000))
    expect(screen.getByText("Publicado")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Publicar" })).toBeNull()
  })

  it("o que se edita enquanto publica continua, como mudança, depois de Publicado (P2 da crítica 4)", async () => {
    vi.useFakeTimers()
    render(editor())
    fireEvent.click(screen.getByRole("button", { name: "Publicar" }))
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Escrito durante a publicação" } })
    await act(async () => void vi.advanceTimersByTime(1000))
    expect((screen.getByLabelText("Título") as HTMLInputElement).value).toBe("Escrito durante a publicação")
    expect(screen.getByText("1 mudança")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Publicar" })).toBeTruthy()
  })

  it("a seção selecionada sobe um degrau e continua mostrando o próprio fundo (P1 da crítica 4)", () => {
    render(editor())
    const capa = document.querySelector('section[data-selecionada]')!
    expect(capa.className).toContain("superficie-alta")
    expect((capa.firstElementChild as HTMLElement).className).toContain("bg-accent")
  })

  it("não carregou: a barra de pé sem rascunho nem Publicar, e a falha com Tentar de novo (P4 da crítica 4)", () => {
    render(editor("erro-de-carga"))
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Documento")
    expect(screen.getAllByRole("alert").map((a) => a.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining("Não deu para carregar as seções."), expect.stringContaining("Não deu para carregar o documento.")])
    )
    expect(screen.getAllByRole("button", { name: "Tentar de novo" }).length).toBe(2)
    expect(screen.queryByRole("button", { name: "Publicar" })).toBeNull()
    expect(screen.queryByRole("complementary")).toBeNull()
  })

  it("a publicação que falha por exceção vira Não publicou, sem travar o Editor (validador, A3)", async () => {
    render(
      <CascoDoEditor>
        <EditorDeDocumento carga={cargaDoEditor("7", undefined)} conta={conta} aoPublicar={() => Promise.reject(new Error("rede caiu"))} />
      </CascoDoEditor>
    )
    await act(async () => void fireEvent.click(screen.getByRole("button", { name: "Publicar" })))
    expect(screen.getByRole("button", { name: "Não publicou" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Publicar" }).hasAttribute("disabled")).toBe(false)
  })

  it("fechar o detalhe de Não publicou devolve o foco ao carimbo (validador, A5)", async () => {
    render(editor("erro"))
    const chip = screen.getByRole("button", { name: "Não publicou" })
    fireEvent.click(chip)
    fireEvent.keyDown(screen.getByText(/tente publicar de novo/), { key: "Escape" })
    await act(async () => {})
    expect(document.activeElement).toBe(chip)
  })

  it("não publicou: o carimbo abre o que fazer, e a saída é o próprio Publicar (P5 da crítica 1)", () => {
    render(editor("erro"))
    const chip = screen.getByRole("button", { name: "Não publicou" })
    expect(chip.getAttribute("aria-expanded")).toBe("false")
    fireEvent.click(chip)
    expect(screen.getByText(/tente publicar de novo em alguns minutos/)).toBeTruthy()
    expect(screen.getByRole("button", { name: "Publicar" })).toBeTruthy()
  })

  it("recusa: a pendência leva à seção e ao campo, com o erro no campo", async () => {
    render(editor("recusa"))
    expect(pendenciasDe(cargaDoEditor("7", "recusa").secoes).map((s) => s.id)).toEqual(["capa"])
    fireEvent.click(screen.getByRole("button", { name: "1 pendência" }))
    const inspector = screen.getByRole("complementary", { name: "Capa" })
    const titulo = within(inspector).getByLabelText("Título")
    expect(titulo.getAttribute("aria-invalid")).toBe("true")
    expect(document.getElementById(titulo.getAttribute("aria-describedby")!)!.textContent).toBe("Escreva o título da seção Capa.")
    await act(() => new Promise((ok) => requestAnimationFrame(() => ok(null))))
    expect(document.activeElement).toBe(titulo)
  })

  it("vazio: a estrutura diz a causa com a saída, o canvas diz onde a página aparece, e não há Publicar", () => {
    render(editor("vazio"))
    expect(screen.getByText("Nenhuma seção ainda")).toBeTruthy()
    expect(screen.getByText("A página aparece aqui quando houver uma seção.")).toBeTruthy()
    expect(screen.getByText("Sem mudanças")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Publicar" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Adicionar seção" }))
    expect(screen.getByRole("complementary", { name: "Nova seção" })).toBeTruthy()
  })

  it("carregando: o título é o nome do tipo, a espera é declarada, e não há Publicar", () => {
    render(editor("carregando"))
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Documento")
    expect(screen.getAllByRole("status").length).toBeGreaterThan(0)
    expect(screen.queryByRole("button", { name: "Publicar" })).toBeNull()
    // A forma do pronto já na espera: o inspector aberto, em espera (P3 da crítica 4).
    expect(within(screen.getByRole("complementary", { name: "Seção" })).getByRole("status")).toBeTruthy()
  })

  it("sem permissão: a tela de erro de rota, com a volta", () => {
    render(editor("sem-permissao"))
    expect(screen.getByRole("heading", { level: 1, name: "Proposta comercial" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Voltar aos documentos" }).getAttribute("href")).toBe("/documentos")
    expect(screen.queryByRole("group", { name: "Barra do editor" })).toBeNull()
  })

  it("a seção sai pelo ⋯, com confirmação, e o inspector fecha", async () => {
    render(editor())
    abrir(screen.getByRole("button", { name: "Mais ações da seção Capa", hidden: false }))
    fireEvent.click(screen.getByRole("menuitem", { name: "Excluir seção" }))
    fireEvent.click(await screen.findByRole("button", { name: "Excluir" }))
    await act(async () => {})
    expect(screen.queryByRole("complementary", { name: "Capa" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Capa" })).toBeNull()
  })
})
