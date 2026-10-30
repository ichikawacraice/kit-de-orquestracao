// Os blocos de tela (CASCO-01, ARQ-01): o casco, a Lista, a Mesa e a Entrada,
// cada um montado com a carga de exemplo, nos estados que a revisão de
// arquitetura pede.
import * as React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, within } from "@testing-library/react"

import { BarraLateral, destinoAtivo } from "@/registry/wicomm/blocks/casco/barra-lateral"
import { CabecalhoDoApp } from "@/registry/wicomm/blocks/casco/cabecalho-do-app"
import { CascoDoApp } from "@/registry/wicomm/blocks/casco/casco-do-app"
import { MenuDoContexto } from "@/registry/wicomm/blocks/casco/menu-do-contexto"
import { DESTINOS, TELAS_DENSAS, navegacaoDoExemplo } from "@/registry/wicomm/blocks/casco/navegacao"
import { TelaDeEntrada } from "@/registry/wicomm/blocks/entrada/tela-de-entrada"
import { cargaDaLista } from "@/registry/wicomm/blocks/lista/dados-da-lista"
import { ListaDePedidos } from "@/registry/wicomm/blocks/lista/lista-de-pedidos"
import { cargaDaMesa, estacoesDoPedido } from "@/registry/wicomm/blocks/mesa/dados-da-mesa"
import { MesaDoPedido } from "@/registry/wicomm/blocks/mesa/mesa-do-pedido"
import { ToastProvider } from "@/registry/wicomm/ui/toast"

const conta = { nome: "Ana Souza", email: "ana@exemplo.com.br", onSair: () => {} }
const comAviso = (no: React.ReactNode) => <ToastProvider>{no}</ToastProvider>

beforeEach(() => localStorage.clear())
afterEach(() => {
  vi.useRealTimers()
  document.documentElement.removeAttribute("data-barra-recolhida")
})

describe("o casco (CASCO-01, LAY-01, CTRL-08)", () => {
  it("monta a barra, o cabeçalho e o main que rola; a raiz não rola", () => {
    const { container } = render(
      <CascoDoApp
        grupos={DESTINOS}
        caminhoAtual="/pedidos/1042"
        contagens={{ "/pedidos": { numero: 3, tom: "espera", frase: "3 pedem você" } }}
        conta={conta}
        cabecalho={<CabecalhoDoApp contexto={<MenuDoContexto />} />}
      >
        <p>conteúdo</p>
      </CascoDoApp>
    )
    const raiz = container.querySelector('[data-slot="casco-do-app"]')!
    expect(raiz.className).toContain("h-screen")
    expect(raiz.className).toContain("overflow-hidden")
    expect(screen.getByRole("main").className).toContain("overflow-y-auto")
    expect(screen.getByRole("banner")).toBeTruthy()
    expect(screen.getByRole("button", { name: /Organização: Organização Exemplo/ })).toBeTruthy()
    // O destino ativo é o da rota e o de baixo dela; ícone E rótulo; a contagem só acima de zero.
    const ativo = screen.getByRole("link", { name: /Pedidos/ })
    expect(ativo.getAttribute("aria-current")).toBe("page")
    expect(within(ativo).getByText("3")).toBeTruthy()
    expect(screen.getByRole("link", { name: "Clientes" }).getAttribute("aria-current")).toBeNull()
  })

  it("o destino ativo não casa prefixo de outra palavra", () => {
    expect(destinoAtivo("/pedidos-antigos", "/pedidos")).toBe(false)
    expect(destinoAtivo("/pedidos", "/pedidos")).toBe(true)
    expect(destinoAtivo("/", "/")).toBe(true)
  })

  it("recolher grava a preferência e marca o <html>; recolhida, o rótulo vira nome acessível", () => {
    render(<BarraLateral grupos={DESTINOS} caminhoAtual="/pedidos" conta={conta} />)
    fireEvent.click(screen.getByRole("button", { name: "Recolher menu" }))
    expect(localStorage.getItem("wicomm-barra")).toBe("recolhida")
    expect(document.documentElement.hasAttribute("data-barra-recolhida")).toBe(true)
    expect(screen.queryByText("Recolher menu")).toBeNull()
    expect(screen.getByRole("link", { name: "Clientes" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Expandir menu" }).getAttribute("aria-expanded")).toBe("false")
  })

  it("lê a preferência guardada depois de montar", () => {
    localStorage.setItem("wicomm-barra", "recolhida")
    const { container } = render(<BarraLateral grupos={DESTINOS} caminhoAtual="/" conta={conta} />)
    expect(container.querySelector("aside")!.hasAttribute("data-recolhida")).toBe(true)
  })

  it("recolher pelo teclado não perde o foco: o botão é o mesmo", () => {
    render(<BarraLateral grupos={DESTINOS} caminhoAtual="/" conta={conta} />)
    const botao = screen.getByRole("button", { name: "Recolher menu" })
    botao.focus()
    fireEvent.click(botao)
    expect(botao.isConnected).toBe(true)
    expect(document.activeElement).toBe(botao)
  })

  it("a tela densa nasce recolhida já no primeiro desenho (o do servidor)", async () => {
    const { renderToString } = await import("react-dom/server")
    const html = renderToString(<BarraLateral grupos={DESTINOS} caminhoAtual="/" conta={conta} recolherNestaTela />)
    expect(html).toContain("data-recolhida")
  })

  it("na tela densa começa recolhida, e abrir ali não grava preferência", () => {
    const { container } = render(<BarraLateral grupos={DESTINOS} caminhoAtual="/" conta={conta} recolherNestaTela />)
    expect(container.querySelector("aside")!.hasAttribute("data-recolhida")).toBe(true)
    fireEvent.click(screen.getByRole("button", { name: "Expandir menu" }))
    expect(container.querySelector("aside")!.hasAttribute("data-recolhida")).toBe(false)
    expect(localStorage.getItem("wicomm-barra")).toBeNull()
  })

  it("a contagem do exemplo não discorda da tela, e sem permissão o destino some", () => {
    expect(navegacaoDoExemplo("/pedidos", null).contagens["/pedidos"]!.numero).toBe(3)
    expect(navegacaoDoExemplo("/pedidos", "vazio").contagens).toEqual({})
    // Na Mesa, o estado é de um pedido: a fila continua pedindo, e o destino fica.
    expect(navegacaoDoExemplo("/pedidos/1042", "erro").contagens["/pedidos"]!.numero).toBe(3)
    expect(navegacaoDoExemplo("/pedidos/1042", "sem-permissao").grupos.flatMap((g) => g.destinos.map((d) => d.href))).toContain("/pedidos")
    const semAcesso = navegacaoDoExemplo("/pedidos", "sem-permissao").grupos.flatMap((g) => g.destinos.map((d) => d.href))
    expect(semAcesso).not.toContain("/pedidos")
  })

  it("a navegação de exemplo é uma fonte só, com ícone e rótulo em todo destino", () => {
    expect(Array.isArray(TELAS_DENSAS)).toBe(true)
    for (const d of DESTINOS.flatMap((g) => g.destinos)) {
      expect(d.rotulo.length).toBeGreaterThan(2)
      expect(d.icone).toBeTruthy()
    }
  })
})

describe("a Lista (ARQ-01, EST-02, EST-04, PRIN-04)", () => {
  it("abre na fila que pede você, com todos os contadores, o zero inclusive", () => {
    render(comAviso(<ListaDePedidos carga={cargaDaLista(undefined)} />))
    expect(screen.getAllByRole("heading", { level: 1 }).map((h) => h.textContent)).toEqual(["Pedidos"])
    const abas = screen.getAllByRole("tab").map((a) => a.getAttribute("aria-label"))
    expect(abas).toEqual(["Pedem você, 3", "Com outros, 2", "Andando, 3", "Concluídos, 0"])
    expect(screen.getAllByRole("link", { name: /^10/ })).toHaveLength(3)
    // Todas as linhas dizem o mesmo que o modo: a coluna Situação não existe.
    expect(screen.queryByRole("columnheader", { name: "Situação" })).toBeNull()
  })

  it("na fila Andando, só a falha leva o chip, ao lado da etapa; o modo vai ao endereço", () => {
    render(comAviso(<ListaDePedidos carga={cargaDaLista(undefined)} />))
    fireEvent.click(screen.getByRole("tab", { name: /Andando/ }))
    expect(window.location.search).toContain("modo=andando")
    expect(screen.queryByRole("columnheader", { name: "Situação" })).toBeNull()
    expect(document.querySelectorAll('[data-slot="chip-de-estado"]')).toHaveLength(1)
    expect(screen.getByText("Falhou").closest("td")!.textContent).toContain("Pagamento")
  })

  it("carregando: a cabeça de pé, a espera declarada, e os contadores não contados", () => {
    render(comAviso(<ListaDePedidos carga={{ tipo: "carregando" }} />))
    expect(screen.getByRole("status").getAttribute("aria-busy")).toBe("true")
    expect(screen.getAllByRole("tab")[0]!.getAttribute("aria-label")).toBe("Pedem você, sem contagem")
  })

  it("o vazio diz a causa: nada ainda, ou o filtro, com a saída", () => {
    const { unmount } = render(comAviso(<ListaDePedidos carga={cargaDaLista("vazio")} />))
    expect(document.querySelector('[data-causa="nada-ainda"]')).toBeTruthy()
    unmount()
    render(comAviso(<ListaDePedidos carga={cargaDaLista("vazio-filtro")} />))
    expect(document.querySelector('[data-causa="filtro"]')).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Ver com outros" }))
    expect(screen.getByRole("tab", { name: /Com outros/ }).getAttribute("aria-selected")).toBe("true")
  })

  it("a busca cruza os modos, e a sem resultado oferece limpar", () => {
    render(comAviso(<ListaDePedidos carga={cargaDaLista(undefined)} />))
    const busca = screen.getByRole("searchbox", { name: "Buscar por número ou cliente" })
    fireEvent.change(busca, { target: { value: "Heitor" } })
    expect(screen.getByRole("columnheader", { name: "Situação" })).toBeTruthy()
    expect(screen.getByText("Falhou")).toBeTruthy()
    fireEvent.change(busca, { target: { value: "9999" } })
    fireEvent.click(screen.getByRole("button", { name: "Limpar a busca" }))
    expect((busca as HTMLInputElement).value).toBe("")
  })

  it("erro e sem permissão", () => {
    const { unmount } = render(comAviso(<ListaDePedidos carga={{ tipo: "erro" }} />))
    expect(screen.getByRole("alert").textContent).toContain("Não deu para carregar os pedidos.")
    unmount()
    render(comAviso(<ListaDePedidos carga={{ tipo: "sem-permissao" }} />))
    expect(screen.getByRole("heading", { level: 1, name: "Pedidos" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Voltar ao início" }).getAttribute("href")).toBe("/")
    expect(screen.queryByRole("button", { name: /Novo pedido/ })).toBeNull()
  })
})

describe("a Mesa (ARQ-01, CASCO-03, PESO-03, PESO-04)", () => {
  it("abre com a trilha até a lista, o nome, o estado e o primário que a regra libera", () => {
    render(comAviso(<MesaDoPedido carga={cargaDaMesa("1042", undefined)} />))
    const trilha = screen.getByRole("navigation", { name: "Trilha" })
    expect(within(trilha).getByRole("link", { name: "Pedidos" }).getAttribute("href")).toBe("/pedidos")
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Pedido 1042")
    expect(screen.getByText("Aguarda você")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Concluir conferência" })).toBeTruthy()
    expect(screen.getByRole("navigation", { name: "Percurso" }).closest('[data-slot="painel"]')!.className).toContain("w-60")
  })

  it("com item por conferir o primário não é desenhado; conferir tudo o libera", () => {
    vi.useFakeTimers()
    render(comAviso(<MesaDoPedido carga={cargaDaMesa("1042", "a-conferir")} />))
    expect(screen.queryByRole("button", { name: "Concluir conferência" })).toBeNull()
    for (const b of screen.getAllByRole("button", { name: "Conferir" })) {
      fireEvent.click(b)
      act(() => vi.advanceTimersByTime(1000))
    }
    expect(screen.getByRole("button", { name: "Concluir conferência" })).toBeTruthy()
  })

  it("duas conferências seguidas não se atropelam", () => {
    vi.useFakeTimers()
    render(comAviso(<MesaDoPedido carga={{ ...cargaDaMesa("1042", "a-conferir"), itens: cargaDaMesa("1042", "a-conferir").itens.map((i) => ({ ...i, conferido: false })) }} />))
    const [a, b] = screen.getAllByRole("button", { name: "Conferir" })
    fireEvent.click(a!)
    act(() => vi.advanceTimersByTime(500))
    fireEvent.click(b!)
    act(() => vi.advanceTimersByTime(500))
    expect(screen.getAllByRole("button", { name: "Conferindo" })).toHaveLength(1)
    expect(screen.getAllByText("Conferido")).toHaveLength(1)
  })

  it("concluir mostra o andamento no botão e o desfecho no topo; o trilho avança", () => {
    vi.useFakeTimers()
    render(comAviso(<MesaDoPedido carga={cargaDaMesa("1042", undefined)} />))
    fireEvent.click(screen.getByRole("button", { name: "Concluir conferência" }))
    expect((screen.getByRole("button", { name: "Concluindo" }) as HTMLButtonElement).disabled).toBe(true)
    act(() => vi.advanceTimersByTime(1000))
    expect(screen.getByRole("status").textContent).toContain("Conferência concluída.")
    expect(screen.getByRole("button", { name: /Pagamento/ }).getAttribute("aria-current")).toBe("step")
  })

  it("a recusa diz o motivo e traz a saída", () => {
    render(comAviso(<MesaDoPedido carga={cargaDaMesa("1042", "recusa")} />))
    const alerta = screen.getByRole("alert")
    expect(alerta.textContent).toContain("cancelado por outra pessoa")
    expect(within(alerta).getByRole("button", { name: "Ver o pedido atualizado" })).toBeTruthy()
  })

  it("leitura sem destino da conferência não inventa o caminho", () => {
    render(comAviso(<MesaDoPedido carga={cargaDaMesa("1042", "leitura")} />))
    expect(screen.queryByRole("link", { name: "Abrir a conferência" })).toBeNull()
  })

  it("leitura: abas no lugar do trilho, nenhum primário, nenhum gesto, e o caminho para a conferência", () => {
    render(comAviso(<MesaDoPedido carga={cargaDaMesa("1042", "leitura")} hrefDaConferencia="/pedidos/1042/conferencia" />))
    expect(screen.getByRole("tablist", { name: "Partes do pedido" })).toBeTruthy()
    expect(screen.queryByRole("navigation", { name: "Percurso" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Concluir conferência" })).toBeNull()
    expect(screen.getByText("por conferir")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Conferir" })).toBeNull()
    expect(screen.queryByRole("button", { name: /Mais ações/ })).toBeNull()
    expect(screen.getByRole("link", { name: "Abrir a conferência" }).getAttribute("href")).toBe("/pedidos/1042/conferencia")
  })

  it("carregando desenha o lugar da coluna, e a de abas desenha abas", () => {
    const { unmount } = render(comAviso(<MesaDoPedido carga={cargaDaMesa("1042", "carregando")} />))
    expect(screen.getAllByRole("status").length).toBeGreaterThan(0)
    unmount()
    render(comAviso(<MesaDoPedido carga={cargaDaMesa("1042", "carregando-abas")} />))
    expect(screen.getByRole("tablist")).toBeTruthy()
  })

  it("o percurso: uma estação atual por vez", () => {
    for (const concluida of [false, true]) expect(estacoesDoPedido(concluida).filter((e) => e.situacao === "atual")).toHaveLength(1)
  })
})

describe("a Entrada (ARQ-01, CTRL-02, MSG-04)", () => {
  it("um passo só: um h1, campos e botão xl, nada sm", () => {
    const { container } = render(<TelaDeEntrada />)
    expect(screen.getAllByRole("heading", { level: 1 }).map((h) => h.textContent)).toEqual(["Entrar"])
    expect(screen.getByRole("button", { name: "Entrar" }).className).toContain("h-11")
    expect(screen.getByLabelText("E-mail").className).toContain("h-10")
    expect(container.innerHTML).not.toMatch(/h-\[26px\]/)
  })

  it("o erro de um campo mora no campo; a recusa do passo, no cartão", async () => {
    render(<TelaDeEntrada aoEntrar={async () => ({ tom: "ruim", texto: "E-mail ou senha não conferem." })} />)
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }))
    const email = screen.getByLabelText("E-mail")
    expect(email.getAttribute("aria-invalid")).toBe("true")
    expect(document.getElementById(email.getAttribute("aria-describedby")!)!.textContent).toBe("Escreva um e-mail completo.")
    fireEvent.change(email, { target: { value: "ana@exemplo.com.br" } })
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Entrar" }))
    })
    expect(screen.getByRole("alert").textContent).toBe("E-mail ou senha não conferem.")
    expect(document.activeElement).toBe(email)
  })

  it("andando: o gerúndio no botão, sem clique duplo", () => {
    render(<TelaDeEntrada momento="andando" />)
    expect((screen.getByRole("button", { name: "Entrando" }) as HTMLButtonElement).disabled).toBe(true)
  })
})
