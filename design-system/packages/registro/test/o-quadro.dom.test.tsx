// O quadro de tarefas (ANATOMIA PECA-01): a coluna no chão, o cartão como peça,
// a cor com função (a bandeja tinge só pela voz que pede algo), a prioridade
// em forma e o ponto da etapa do mapa do projeto.
import { describe, expect, it } from "vitest"
import { fireEvent, render, screen, within } from "@testing-library/react"

import { criarPontoDaEtapa } from "@/registry/design-system/ui/ponto-da-etapa"
import { COR_DO_NIVEL, Prioridade } from "@/registry/design-system/ui/prioridade"
import {
  CabecalhoDaColuna,
  CartaoDoQuadro,
  ColunaDoQuadro,
  FitaDaColuna,
  PedidoDoCartao,
  Quadro,
  TituloDoCartao,
  VidaDoCartao,
} from "@/registry/design-system/ui/quadro"
import { Vazio } from "@/registry/design-system/ui/vazio"
import { BADGE_DO_TOM, TINTA_DO_CARIMBO_NEUTRO, TINTA_DO_TOM } from "@/registry/design-system/lib/idioma-de-cor"

const classes = (el: Element | null | undefined) => (el?.className ?? "").split(/\s+/)

describe("o quadro", () => {
  it("é uma região nomeada, com o anúncio do arrastar numa região viva irmã", () => {
    render(
      <Quadro aria-label="Tarefas" anuncio="Cartão movido para Revisão">
        <ColunaDoQuadro>
          <CabecalhoDaColuna nome="Entrada" contagem={2} rotuloDaContagem="2 tarefas" />
        </ColunaDoQuadro>
      </Quadro>,
    )
    const regiao = screen.getByRole("region", { name: "Tarefas" })
    expect(regiao).toBeTruthy()
    const vivo = screen.getByRole("status")
    expect(vivo.textContent).toBe("Cartão movido para Revisão")
    expect(regiao.contains(vivo)).toBe(false)
  })

  it("carregando, desenha a espera no lugar das colunas e marca aria-busy", () => {
    const { container } = render(
      <Quadro aria-label="Tarefas" carregando>
        <ColunaDoQuadro>
          <CabecalhoDaColuna nome="Entrada" />
        </ColunaDoQuadro>
      </Quadro>,
    )
    expect(screen.getByRole("region").getAttribute("aria-busy")).toBe("true")
    expect(screen.queryByRole("heading", { name: "Entrada" })).toBeNull()
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0)
  })
})

describe("a coluna", () => {
  it("mora no chão e se nomeia pelo cabeçalho; a contagem tem nome acessível", () => {
    render(
      <ColunaDoQuadro>
        <CabecalhoDaColuna nome="Revisão" contagem={3} rotuloDaContagem="3 tarefas" />
      </ColunaDoQuadro>,
    )
    const coluna = screen.getByRole("region", { name: "Revisão" })
    expect(classes(coluna).some((c) => /^(bg-card|superficie)/.test(c))).toBe(false)
    // O leitor ouve o rótulo, não o número solto: o número fica escondido e o rótulo vai em sr-only.
    const contagem = coluna.querySelector('[data-slot="contagem-da-coluna"]')
    expect(contagem?.textContent).toBe("33 tarefas")
    expect(contagem?.querySelector('[aria-hidden="true"]')?.textContent).toBe("3")
    expect(classes(screen.getByText("3 tarefas"))).toContain("sr-only")
  })

  it("o alvo de soltar ganha a tinta da marca", () => {
    render(
      <ColunaDoQuadro alvo>
        <CabecalhoDaColuna nome="Revisão" />
      </ColunaDoQuadro>,
    )
    const coluna = screen.getByRole("region", { name: "Revisão" })
    expect(classes(coluna)).toContain("bg-marca-tinta")
    // O cabeçalho grudado leva a mesma tinta no alvo: o alvo começa no nome.
    expect(classes(coluna.querySelector('[data-slot="cabecalho-da-coluna"]'))).toContain("group-data-alvo/coluna:bg-marca-tinta")
  })

  it("a recusa escreve o motivo; sem recusa, o motivo não aparece", () => {
    const { rerender } = render(
      <ColunaDoQuadro recusa motivoDaRecusa="Só a revisão move para cá.">
        <CabecalhoDaColuna nome="Feito" />
      </ColunaDoQuadro>,
    )
    expect(screen.getByText("Só a revisão move para cá.")).toBeTruthy()
    rerender(
      <ColunaDoQuadro motivoDaRecusa="Só a revisão move para cá.">
        <CabecalhoDaColuna nome="Feito" />
      </ColunaDoQuadro>,
    )
    expect(screen.queryByText("Só a revisão move para cá.")).toBeNull()
  })

  it("o cabeçalho fora da coluna é erro de montagem", () => {
    expect(() => render(<CabecalhoDaColuna nome="Solta" />)).toThrow()
  })

  it("a fita da coluna vazia diz a causa no nome e abre ao clicar", () => {
    let abriu = 0
    render(<FitaDaColuna nome="Feito" contagem={0} causa="nenhuma tarefa com este filtro" onAbrir={() => abriu++} />)
    const fita = screen.getByRole("button", { name: "Abrir a coluna Feito, vazia: nenhuma tarefa com este filtro" })
    fireEvent.click(fita)
    expect(abriu).toBe(1)
  })
})

describe("o cartão", () => {
  it("é a peça (superfície e raio de cartão) e o título é o botão que abre", () => {
    render(
      <CartaoDoQuadro>
        <PedidoDoCartao>
          <TituloDoCartao>Trocar a capa</TituloDoCartao>
        </PedidoDoCartao>
      </CartaoDoQuadro>,
    )
    const titulo = screen.getByRole("button", { name: "Trocar a capa" })
    const cartao = titulo.closest('[data-slot="cartao-do-quadro"]')
    expect(cartao).not.toBeNull()
    expect(classes(cartao)).toEqual(expect.arrayContaining(["bg-card", "superficie", "rounded-cartao"]))
  })

  it("o ativo marca aria-current e desenha o filete; o repouso não", () => {
    const { container, rerender } = render(<CartaoDoQuadro ativo>x</CartaoDoQuadro>)
    const cartao = () => container.querySelector('[data-slot="cartao-do-quadro"]')
    expect(cartao()?.getAttribute("aria-current")).toBe("true")
    expect(container.querySelector('[data-slot="filete-do-ativo"]')).not.toBeNull()
    rerender(<CartaoDoQuadro>x</CartaoDoQuadro>)
    expect(cartao()?.hasAttribute("aria-current")).toBe(false)
    expect(container.querySelector('[data-slot="filete-do-ativo"]')).toBeNull()
  })

  it("a bandeja tinge só pela voz que pede algo; ok e neutro ficam no cinza", () => {
    const { container } = render(
      <>
        <VidaDoCartao tom="espera">Aguarda você</VidaDoCartao>
        <VidaDoCartao tom="ruim">Falhou</VidaDoCartao>
        <VidaDoCartao tom="ok">Conferido</VidaDoCartao>
        <VidaDoCartao tom="neutro">Há 2 h</VidaDoCartao>
      </>,
    )
    const bandejas = [...container.querySelectorAll('[data-slot="vida-do-cartao"]')]
    expect(bandejas).toHaveLength(4)
    const [espera, ruim, ok, neutro] = bandejas.map(classes)
    expect(espera).not.toContain("bg-muted")
    expect(ruim).not.toContain("bg-muted")
    expect(ok).toContain("bg-muted")
    expect(neutro).toContain("bg-muted")
  })
})

describe("a prioridade", () => {
  it("é o carimbo com o glifo e a palavra; só a urgente fala, na voz de espera", () => {
    const { container } = render(
      <>
        <Prioridade nivel={2}>Média</Prioridade>
        <Prioridade nivel="urgente">Urgente</Prioridade>
      </>,
    )
    const [media, urgente] = [...container.querySelectorAll('[data-slot="prioridade"]')]
    expect(media?.textContent).toBe("Média")
    expect(urgente?.textContent).toBe("Urgente")
    expect(classes(media)).toContain("rounded-md")
    expect(classes(media)).toContain(TINTA_DO_CARIMBO_NEUTRO)
    expect(classes(urgente)).toContain(TINTA_DO_TOM.espera)
    expect(classes(media)).not.toContain(TINTA_DO_TOM.espera)
  })

  it("pinta o nível com a cor declarada dele; sem prioridade e urgente ficam sem ela", () => {
    const { container } = render(
      <>
        <Prioridade nivel={0}>Sem prioridade</Prioridade>
        <Prioridade nivel={1}>Baixa</Prioridade>
        <Prioridade nivel={2}>Média</Prioridade>
        <Prioridade nivel={3}>Alta</Prioridade>
        <Prioridade nivel="urgente">Urgente</Prioridade>
      </>,
    )
    const [nenhuma, baixa, media, alta, urgente] = [...container.querySelectorAll('[data-slot="prioridade"]')]
    expect(baixa).toBeDefined()
    for (const [el, nivel] of [[baixa, 1], [media, 2], [alta, 3]] as const) {
      for (const classe of COR_DO_NIVEL[nivel].split(" ")) expect(classes(el)).toContain(classe)
    }
    const todas = Object.values(COR_DO_NIVEL).flatMap((c) => c.split(" "))
    expect(todas.length).toBeGreaterThan(0)
    for (const classe of todas) expect(classes(nenhuma)).not.toContain(classe)
    for (const classe of todas) expect(classes(urgente)).not.toContain(classe)
    // Nunca uma voz emprestada (COR-09): nenhuma família do nível é família de voz.
    const familia = (c: string) => c.replace(/^dark:/, "").split("-")[1]
    const dasVozes = new Set(Object.values(BADGE_DO_TOM).flatMap((c) => c.split(" ")).map(familia))
    expect(dasVozes.has("amber")).toBe(true)
    for (const classe of todas) expect(dasVozes.has(familia(classe))).toBe(false)
  })
})

describe("o ponto da etapa", () => {
  const PontoDaEtapa = criarPontoDaEtapa({ entrada: "bg-sky-500" })

  it("pinta pela chave do mapa e cai no neutro fora dele, sem sumir o nome", () => {
    const { container } = render(
      <>
        <PontoDaEtapa etapa="entrada">Entrada</PontoDaEtapa>
        <PontoDaEtapa etapa="arquivo">Arquivo</PontoDaEtapa>
        <PontoDaEtapa etapa="constructor">Construtor</PontoDaEtapa>
      </>,
    )
    const pontos = [...container.querySelectorAll('[data-slot="ponto-da-etapa"] > span:first-child')]
    expect(pontos).toHaveLength(3)
    expect(classes(pontos[0]!)).toContain("bg-sky-500")
    expect(classes(pontos[1]!)).toContain("bg-muted-foreground")
    expect(classes(pontos[2]!)).toContain("bg-muted-foreground")
    expect(screen.getByText("Arquivo")).toBeTruthy()
  })

  it("semNome esconde do leitor de tela, que já ouve o nome ao lado", () => {
    const { container } = render(<PontoDaEtapa etapa="entrada" semNome />)
    expect(container.querySelector('[data-slot="ponto-da-etapa"]')?.getAttribute("aria-hidden")).toBe("true")
  })
})

describe("o vazio na escala da coluna", () => {
  it("é baixo e tracejado, só com a causa", () => {
    render(
      <Vazio escala="coluna" causa="filtro">
        Nenhuma tarefa com este filtro
      </Vazio>,
    )
    const vazio = screen.getByText("Nenhuma tarefa com este filtro")
    expect(vazio.getAttribute("data-escala")).toBe("coluna")
    expect(classes(vazio)).toContain("border-dashed")
    expect(within(vazio).queryByRole("heading")).toBeNull()
  })
})

