// As peças que os blocos de tela pedem: carimbo de estado, ponto, medalhão,
// trilha, vazio, tela de erro, topo da página, seletor de vista, tabela, ficha,
// trilho do percurso, logotipo, menus do tema e da conta, e o link do app.
import * as React from "react"
import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { InboxIcon } from "lucide-react"

import { LinkDoApp, ProvedorDeLink } from "@/registry/design-system/lib/link-do-app"
import { ChipDeEstado, ChipQueAbre } from "@/registry/design-system/ui/chip-de-estado"
import { Estado } from "@/registry/design-system/ui/estado"
import { Ficha, ParDaFicha } from "@/registry/design-system/ui/ficha"
import { Logotipo } from "@/registry/design-system/ui/logotipo"
import { MedalhaoDoIcone } from "@/registry/design-system/ui/medalhao-do-icone"
import { MenuDaConta, iniciais } from "@/registry/design-system/ui/menu-da-conta"
import { MenuDoTema } from "@/registry/design-system/ui/menu-do-tema"
import { CODIGO_ANTES_DO_DESENHO, ScriptsAntesDoDesenho } from "@/registry/design-system/lib/antes-do-desenho"
import { RolagemDoPainel } from "@/registry/design-system/ui/painel"
import { BarraDeModos } from "@/registry/design-system/ui/seletor-de-vista"
import { LinkDaLinha, Table, TableBody, TableCell, TableRow } from "@/registry/design-system/ui/table"
import { TelaDeErro } from "@/registry/design-system/ui/tela-de-erro"
import { Badge } from "@/registry/design-system/ui/badge"
import { PaginaDoApp, TopoDaPagina } from "@/registry/design-system/ui/topo-da-pagina"
import { Trilha } from "@/registry/design-system/ui/trilha"
import { TrilhoDoPercurso } from "@/registry/design-system/ui/trilho-do-percurso"
import { Vazio } from "@/registry/design-system/ui/vazio"

const classes = (el: Element) => el.className.split(/\s+/)

/** O Radix abre o menu no `pointerdown`; a tecla também abre. */
const abrir = (gatilho: HTMLElement) => fireEvent.keyDown(gatilho, { key: "Enter" })

describe("o carimbo de estado (CTRL-05, COR-05)", () => {
  it("tem a forma única do carimbo e declara o tom, sem contorno", () => {
    render(<ChipDeEstado tom="espera">Aguarda você</ChipDeEstado>)
    const chip = screen.getByText("Aguarda você")
    expect(chip.dataset.tom).toBe("espera")
    expect(classes(chip)).toEqual(expect.arrayContaining(["rounded-md", "px-2", "text-[11px]"]))
    expect(classes(chip).filter((c) => /^border/.test(c))).toEqual([])
  })

  it("em curso gira, e para com movimento reduzido (MOV-02)", () => {
    const { container } = render(
      <ChipDeEstado tom="neutro" emCurso>
        Processando
      </ChipDeEstado>
    )
    const giro = container.querySelector("svg")!
    expect(giro.getAttribute("class")).toContain("motion-reduce:animate-none")
    expect(giro.getAttribute("aria-hidden")).toBe("true")
  })

  it("o estado neutro abre com o ponto, na tinta do texto, e o selo de valor não (CTRL-05)", () => {
    const { container } = render(
      <>
        <ChipDeEstado tom="neutro">Em 40 dias</ChipDeEstado>
        <Badge>Alta</Badge>
      </>
    )
    const chip = container.querySelector('[data-slot="chip-de-estado"]')!
    const ponto = chip.querySelector('[data-slot="ponto-do-estado"]')!
    expect(chip.firstElementChild).toBe(ponto)
    expect(ponto.getAttribute("aria-hidden")).toBe("true")
    expect(classes(ponto)).toEqual(expect.arrayContaining(["size-1.5", "rounded-full", "bg-current"]))
    expect(chip.textContent).toBe("Em 40 dias")
    expect(container.querySelector('[data-slot="badge"] [data-slot="ponto-do-estado"]')).toBeNull()
  })

  it("só o neutro ganha o ponto: a voz com matiz já se separa pela tinta, e o em curso tem o giro", () => {
    const { container } = render(
      <>
        <ChipDeEstado tom="ok">Conferido</ChipDeEstado>
        <ChipDeEstado tom="neutro" emCurso>
          Processando
        </ChipDeEstado>
        <ChipQueAbre tom="neutro" onAbrir={() => {}}>
          Rascunho
        </ChipQueAbre>
      </>
    )
    const [ok, emCurso] = container.querySelectorAll('[data-slot="chip-de-estado"]')
    expect(ok!.querySelector('[data-slot="ponto-do-estado"]')).toBeNull()
    expect(emCurso!.querySelector('[data-slot="ponto-do-estado"]')).toBeNull()
    expect(container.querySelector('[data-slot="chip-que-abre"] [data-slot="ponto-do-estado"]')).not.toBeNull()
  })

  it("o chip que abre é botão e chama quem abre", () => {
    const onAbrir = vi.fn()
    render(
      <ChipQueAbre tom="espera" onAbrir={onAbrir} aberto={false}>
        1 pendência
      </ChipQueAbre>
    )
    const botao = screen.getByRole("button", { name: "1 pendência" })
    expect(botao.getAttribute("aria-expanded")).toBe("false")
    fireEvent.click(botao)
    expect(onAbrir).toHaveBeenCalledOnce()
  })
})

describe("o alvo de clique do chip que abre (ACES-03)", () => {
  // O jsdom não mede: o casco tem 11px × 1.4 de linha + 2×3px de padding (~21,4px); o pseudo-elemento estende 2px em cima e embaixo.
  it("passa de 24px de altura, sem mudar o desenho", () => {
    render(
      <ChipQueAbre tom="espera" onAbrir={() => {}}>
        1 pendência
      </ChipQueAbre>
    )
    const botao = screen.getByRole("button", { name: "1 pendência" })
    expect(classes(botao)).toEqual(expect.arrayContaining(["relative", "after:absolute", "after:inset-x-0", "after:-inset-y-[2px]", "py-[3px]"]))
    expect(11 * 1.4 + 2 * 3 + 2 * 2).toBeGreaterThanOrEqual(24)
  })
})

describe("o ponto de voz (COR-08)", () => {
  it("a palavra vem sempre — à vista, ou só para o leitor de tela", () => {
    const { rerender } = render(<Estado tom="ok">Conferido</Estado>)
    expect(classes(screen.getByText("Conferido"))).not.toContain("sr-only")
    rerender(
      <Estado tom="espera" soPonto>
        com pendência
      </Estado>
    )
    expect(classes(screen.getByText("com pendência"))).toContain("sr-only")
  })
})

describe("o medalhão do ícone", () => {
  it("é enfeite (aria-hidden) e neutro por padrão", () => {
    const { container } = render(<MedalhaoDoIcone icone={InboxIcon} />)
    const disco = container.firstElementChild as HTMLElement
    expect(disco.getAttribute("aria-hidden")).toBe("true")
    expect(disco.dataset.tom).toBe("neutro")
  })
})

describe("o link do app", () => {
  it("é um <a> sem provedor, e o do framework com ele", () => {
    const { rerender } = render(<LinkDoApp href="/a">ir</LinkDoApp>)
    expect(screen.getByRole("link", { name: "ir" }).getAttribute("href")).toBe("/a")
    const Roteador = ({ href, ...p }: React.ComponentProps<"a">) => <a data-roteador="" href={href} {...p} />
    rerender(
      <ProvedorDeLink componente={Roteador}>
        <LinkDoApp href="/b">ir</LinkDoApp>
      </ProvedorDeLink>
    )
    expect(screen.getByRole("link", { name: "ir" }).hasAttribute("data-roteador")).toBe(true)
  })
})

describe("a trilha (CASCO-03)", () => {
  it("todo degrau é link, menos o último, que é a página atual", () => {
    render(<Trilha degraus={[{ rotulo: "Pedidos", href: "/pedidos" }, { rotulo: "Pedido 1042" }]} />)
    const nav = screen.getByRole("navigation", { name: "Trilha" })
    expect(within(nav).getByRole("link", { name: "Pedidos" }).getAttribute("href")).toBe("/pedidos")
    expect(within(nav).queryByRole("link", { name: "Pedido 1042" })).toBeNull()
    expect(screen.getByText("Pedido 1042").getAttribute("aria-current")).toBe("page")
    expect(nav.querySelector("svg")!.getAttribute("aria-hidden")).toBe("true")
  })
})

describe("o vazio diz a causa (EST-02)", () => {
  it("declara a causa e não tem voz", () => {
    const { container } = render(
      <Vazio causa="filtro" icone={InboxIcon} titulo="Nada aqui">
        O filtro escondeu tudo.
      </Vazio>
    )
    const vazio = container.querySelector('[data-slot="vazio"]') as HTMLElement
    expect(vazio.dataset.causa).toBe("filtro")
    expect(container.querySelector('[data-slot="medalhao-do-icone"]')!.getAttribute("data-tom")).toBe("neutro")
  })
})

describe("a tela de erro", () => {
  it("no bloco: alerta, sem título, com Tentar de novo", () => {
    const tentar = vi.fn()
    render(
      <TelaDeErro escala="bloco" onTentarDeNovo={tentar}>
        Não deu para carregar.
      </TelaDeErro>
    )
    expect(screen.getByRole("alert").textContent).toContain("Não deu para carregar.")
    expect(screen.queryByRole("heading")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }))
    expect(tentar).toHaveBeenCalledOnce()
  })

  it("na rota: o h1 da tela, na voz de título da página, nunca tracejada", () => {
    const { container } = render(
      <TelaDeErro escala="rota" tipo="sem-permissao" titulo="Pedidos">
        Sem acesso.
      </TelaDeErro>
    )
    expect(classes(screen.getByRole("heading", { level: 1, name: "Pedidos" }))).toContain("t-display")
    expect(container.innerHTML).not.toContain("border-dashed")
  })
})

describe("o topo da página (CASCO-01, TIPO-04, PESO-01)", () => {
  it("escreve um h1 só, e as ações à direita na ordem secundária · primário · menu", () => {
    render(
      <PaginaDoApp>
        <TopoDaPagina
          titulo="Pedidos"
          secundarias={<button>Exportar</button>}
          primario={<button>Novo pedido</button>}
          menu={<button aria-label="Mais ações">⋯</button>}
        />
      </PaginaDoApp>
    )
    const titulos = screen.getAllByRole("heading", { level: 1 })
    expect(titulos).toHaveLength(1)
    expect(classes(titulos[0]!)).toContain("t-display")
    const nomes = screen.getAllByRole("button").map((b) => b.getAttribute("aria-label") ?? b.textContent)
    expect(nomes).toEqual(["Exportar", "Novo pedido", "Mais ações"])
  })

  it("o desfecho ruim é alerta, com a saída; o ok é status", () => {
    const { rerender } = render(<TopoDaPagina titulo="X" desfecho={{ tom: "ruim", texto: "Não deu.", saida: <button>Tentar de novo</button> }} />)
    expect(screen.getByRole("alert").textContent).toContain("Tentar de novo")
    rerender(<TopoDaPagina titulo="X" desfecho={{ tom: "ok", texto: "Feito." }} />)
    expect(screen.getByRole("status").textContent).toBe("Feito.")
  })

  it("os valores moram na linha de baixo, entre o título e o desfecho, e quebram no estreito (CASCO-04)", () => {
    const { container } = render(
      <TopoDaPagina
        titulo="Pedido 1042"
        estado={<span data-slot="chip-de-estado">Aguarda você</span>}
        valores={
          <>
            <span data-slot="badge">Crítico</span>
            <span data-slot="badge">Prioridade 1</span>
          </>
        }
        desfecho={{ tom: "ok", texto: "Feito." }}
      />
    )
    const linha = container.querySelector('[data-slot="valores-do-topo"]')!
    expect(classes(linha)).toEqual(expect.arrayContaining(["flex", "flex-wrap", "gap-2"]))
    expect(linha.querySelectorAll('[data-slot="badge"]')).toHaveLength(2)
    expect(screen.getByRole("heading", { level: 1 }).parentElement!.contains(linha)).toBe(false)
    const ordem = Array.from(container.querySelector("header")!.children).map((el) => el.getAttribute("data-slot") ?? "titulo")
    expect(ordem).toEqual(["titulo", "valores-do-topo", "desfecho-do-topo"])
  })

  it("sem valores a linha não existe; carregando, três esperas com o casco do carimbo, escondidas do leitor", () => {
    const { container, rerender } = render(<TopoDaPagina titulo="X" />)
    expect(container.querySelector('[data-slot="valores-do-topo"]')).toBeNull()
    rerender(<TopoDaPagina titulo="X" valores={null} />)
    expect(container.querySelector('[data-slot="valores-do-topo"]')).toBeNull()
    rerender(<TopoDaPagina titulo="X" valores={<Badge>{undefined}</Badge>} />)
    expect(classes(container.querySelector('[data-slot="valores-do-topo"]')!)).toContain("empty:hidden")
    expect(container.querySelector('[data-slot="valores-do-topo"]')!.childElementCount).toBe(0)
    rerender(<TopoDaPagina titulo="X" valores="carregando" />)
    const linha = container.querySelector('[data-slot="valores-do-topo"]')!
    expect(linha.getAttribute("aria-hidden")).toBe("true")
    const esperas = linha.querySelectorAll('[data-slot="skeleton"]')
    expect(esperas).toHaveLength(3)
    for (const espera of esperas) expect(classes(espera)).toEqual(expect.arrayContaining(["inline-flex", "py-[3px]", "text-[11px]", "leading-[1.4]"]))
  })

  const recortes = [
    { chave: "atrasados", rotulo: "Atrasados", numero: 2, tom: "espera" as const },
    { chave: "parados", rotulo: "Parados", numero: 0, tom: "ruim" as const },
    { chave: "sem-dono", rotulo: "Sem responsável", numero: null },
  ]

  it("os recortes contados moram abaixo dos filtros, com o rótulo à vista e o mesmo texto no nome do grupo (CASCO-01, ARQ-05)", () => {
    const { container } = render(
      <TopoDaPagina
        titulo="Pedidos"
        desfecho={{ tom: "ok", texto: "Feito." }}
        filtros={<input aria-label="Buscar" />}
        resumo={{ rotulo: "Pedem atenção", recortes, valor: null, onTrocar: () => {} }}
      />
    )
    const ordem = Array.from(container.querySelector("header")!.children).map((el) => el.getAttribute("data-slot") ?? "titulo")
    expect(ordem).toEqual(["titulo", "desfecho-do-topo", "filtros-do-topo", "resumo-do-topo"])
    const resumo = container.querySelector<HTMLElement>('[data-slot="resumo-do-topo"]')!
    expect(classes(resumo)).toEqual(expect.arrayContaining(["flex", "min-w-0", "items-center", "max-sm:flex-col"]))
    const rotulo = resumo.firstElementChild!
    expect(rotulo.textContent).toBe("Pedem atenção")
    expect(rotulo.getAttribute("aria-hidden")).toBe("true")
    expect(classes(rotulo)).toEqual(expect.arrayContaining(["t-rotulo", "shrink-0"]))
    const grupo = within(resumo).getByRole("group", { name: "Pedem atenção" })
    // Só a barra rola no estreito; o rótulo fica fora da rolagem.
    expect(classes(grupo.parentElement!)).toContain("overflow-x-auto")
    expect(grupo.parentElement!.contains(rotulo)).toBe(false)
    expect(within(resumo).getAllByRole("button").map((b) => b.getAttribute("aria-pressed"))).toEqual(["false", "false", "false"])
  })

  it("o slot dos filtros deixa os filhos encolherem na fileira estreita, sem div de contorno na tela", () => {
    const { container } = render(<TopoDaPagina titulo="Pedidos" filtros={<input aria-label="Buscar" />} />)
    const slot = container.querySelector<HTMLElement>('[data-slot="filtros-do-topo"]')
    expect(slot).not.toBeNull()
    expect(classes(slot!)).toContain("[&>*]:min-w-0")
    // A barra de abas não encolhe por cima da busca: quem cede é o resto da fileira.
    expect(classes(slot!)).toContain("[&>[data-slot=seletor-de-vista]]:shrink-0")
    expect(classes(slot!)).toContain("[&>[data-slot=button]]:shrink-0")
  })

  it("um recorte por vez: o inativo liga, o ativo desliga com null", () => {
    const onTrocar = vi.fn()
    render(<TopoDaPagina titulo="Pedidos" resumo={{ rotulo: "Pedem atenção", recortes, valor: "atrasados", onTrocar }} />)
    const [atrasados, parados] = screen.getAllByRole("button")
    expect(atrasados!.getAttribute("aria-pressed")).toBe("true")
    fireEvent.click(parados!)
    expect(onTrocar).toHaveBeenLastCalledWith("parados")
    fireEvent.click(atrasados!)
    expect(onTrocar).toHaveBeenLastCalledWith(null)
  })

  it("o zero é número sem voz, mesmo com tom; o não contado é ‒ (EST-04)", () => {
    render(<TopoDaPagina titulo="Pedidos" resumo={{ rotulo: "Pedem atenção", recortes, valor: null, onTrocar: () => {} }} />)
    const parados = screen.getByRole("button", { name: "Parados, 0" })
    expect(parados.textContent).toContain("0")
    // A voz se detecta (o 2 com tom pinta)…
    expect(screen.getByRole("button", { name: "Atrasados, 2" }).innerHTML).toMatch(/text-amber-800/)
    // …e o zero com tom não pinta.
    expect(parados.innerHTML).not.toMatch(/text-rose-700/)
    const semDono = screen.getByRole("button", { name: "Sem responsável, sem contagem" })
    expect(semDono.textContent).toContain("‒")
  })

  it("sem resumo a fileira não existe", () => {
    const { container, rerender } = render(<TopoDaPagina titulo="X" resumo={{ rotulo: "R", recortes, valor: null, onTrocar: () => {} }} />)
    expect(container.querySelector('[data-slot="resumo-do-topo"]')).not.toBeNull()
    rerender(<TopoDaPagina titulo="X" />)
    expect(container.querySelector('[data-slot="resumo-do-topo"]')).toBeNull()
    rerender(<TopoDaPagina titulo="X" resumo={null} />)
    expect(container.querySelector('[data-slot="resumo-do-topo"]')).toBeNull()
  })

  it("a página é o contêiner de largura da LAY-02", () => {
    const { container } = render(<PaginaDoApp>x</PaginaDoApp>)
    expect(classes(container.firstElementChild!)).toEqual(expect.arrayContaining(["max-w-[100rem]", "px-6"]))
  })
})

describe("o seletor de vista (CTRL-06, EST-04)", () => {
  const modos = [
    { chave: "a", rotulo: "Pedem você", numero: 3, tom: "espera" as const },
    { chave: "b", rotulo: "Concluídos", numero: 0 },
    { chave: "c", rotulo: "Andando", numero: null },
  ]

  it("abas: tablist com o ativo selecionado; o zero é número e o não contado é —", () => {
    render(<BarraDeModos rotulo="Fila" densidade="abas" modos={modos} valor="a" onTrocar={() => {}} />)
    const abas = screen.getAllByRole("tab")
    expect(screen.getByRole("tablist", { name: "Fila" })).toBeTruthy()
    expect(abas.map((a) => a.getAttribute("aria-selected"))).toEqual(["true", "false", "false"])
    expect(abas[1]!.getAttribute("aria-label")).toBe("Concluídos, 0")
    expect(abas[2]!.textContent).toContain("‒")
    expect(abas[2]!.getAttribute("aria-label")).toBe("Andando, sem contagem")
  })

  it("as setas trocam a escolha", () => {
    const onTrocar = vi.fn()
    render(<BarraDeModos rotulo="Fila" densidade="abas" modos={modos} valor="a" onTrocar={onTrocar} />)
    fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowRight" })
    expect(onTrocar).toHaveBeenCalledWith("b")
    fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowLeft" })
    expect(onTrocar).toHaveBeenLastCalledWith("c")
  })

  it("modos: um grupo de botões pressionados, que não mente sendo aba", () => {
    render(<BarraDeModos rotulo="Vista" modos={modos.slice(0, 2)} valor="b" onTrocar={() => {}} />)
    expect(screen.queryByRole("tab")).toBeNull()
    expect(screen.getAllByRole("button").map((b) => b.getAttribute("aria-pressed"))).toEqual(["false", "true"])
  })

  it("sem escolha (busca), a primeira aba continua alcançável pelo Tab", () => {
    render(<BarraDeModos rotulo="Fila" densidade="abas" modos={modos} valor={null} onTrocar={() => {}} />)
    expect(screen.getAllByRole("tab").map((a) => a.tabIndex)).toEqual([0, -1, -1])
  })
})

describe("a tabela (SUP-03, TIPO-03)", () => {
  it("a linha abre pelo link esticado, a medida é mono, e não há filete", () => {
    const { container } = render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>
              <LinkDaLinha href="/pedidos/1">1</LinkDaLinha>
            </TableCell>
            <TableCell medida>R$ 1,00</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    )
    expect(classes(screen.getByRole("link", { name: "1" }))).toContain("after:absolute")
    expect(classes(screen.getByText("R$ 1,00"))).toContain("t-medida")
    expect(container.innerHTML).not.toMatch(/\bborder-b\b/)
  })
})

describe("a ficha (EST-02)", () => {
  it("o valor ausente diz não informado", () => {
    render(
      <Ficha>
        <ParDaFicha rotulo="Cliente">Ana</ParDaFicha>
        <ParDaFicha rotulo="Entrega">{null}</ParDaFicha>
      </Ficha>
    )
    expect(screen.getByText("não informado").previousElementSibling!.textContent).toBe("Entrega")
  })
})

describe("o trilho do percurso", () => {
  it("só a estação atual tem voz; a que vem não abre; a aberta é o passo atual", () => {
    const onAbrir = vi.fn()
    const { container } = render(
      <TrilhoDoPercurso
        estacoes={[
          { chave: "a", nome: "Recebido", situacao: "feita" },
          { chave: "b", nome: "Conferência", situacao: "atual", palavra: "aguarda você", tom: "espera" },
          { chave: "c", nome: "Envio", situacao: "a-frente" },
        ]}
        aberta="b"
        onAbrir={onAbrir}
      />
    )
    expect(container.querySelectorAll('[data-slot="estado"]')).toHaveLength(1)
    expect(screen.getByRole("button", { name: /Conferência/ }).getAttribute("aria-current")).toBe("step")
    expect(screen.queryByRole("button", { name: /Envio/ })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: /Recebido/ }))
    expect(onAbrir).toHaveBeenCalledWith("a")
  })

  it("a estação atual que está com outra pessoa fala na voz alheio (COR-03)", () => {
    const { container } = render(
      <TrilhoDoPercurso
        estacoes={[{ chave: "a", nome: "Aprovação", situacao: "atual", palavra: "com o financeiro", tom: "alheio" }]}
        aberta="a"
        onAbrir={() => {}}
      />
    )
    expect(container.querySelector('[data-slot="estado"]')!.getAttribute("data-tom")).toBe("alheio")
  })
})

describe("o logotipo", () => {
  it("é uma imagem chamada Wicomm, e a marca não escreve (MARCA-02)", () => {
    const { container } = render(<Logotipo />)
    expect(screen.getByRole("img", { name: "Wicomm" })).toBeTruthy()
    expect(container.innerHTML).not.toMatch(/text-primary\b|text-marca/)
  })

  it("a horizontal desenha o arquivo do tema, um por fundo, e não escreve o nome", () => {
    const { container } = render(<Logotipo variante="horizontal" />)
    const desenhos = [...container.querySelectorAll("img")]
    expect(desenhos).toHaveLength(2)
    for (const d of desenhos) {
      expect(d.getAttribute("src")).toMatch(/^data:image\/png;base64,iVBORw0KGgo/)
      expect(d.getAttribute("alt")).toBe("")
    }
    const [claro, escuro] = desenhos.map(classes)
    expect(claro).toContain("dark:hidden")
    expect(escuro).toEqual(expect.arrayContaining(["hidden", "dark:block"]))
    expect(container.textContent).toBe("")
  })

  it("o símbolo desenha o arquivo do tema, um por fundo, e não escreve o monograma", () => {
    const { container } = render(<Logotipo variante="simbolo" />)
    expect(screen.getByRole("img", { name: "Wicomm" })).toBeTruthy()
    const desenhos = [...container.querySelectorAll("img")]
    expect(desenhos).toHaveLength(2)
    for (const d of desenhos) {
      expect(d.getAttribute("src")).toMatch(/^data:image\/png;base64,iVBORw0KGgo/)
      expect(d.getAttribute("alt")).toBe("")
    }
    const [claro, escuro] = desenhos.map(classes)
    expect(claro).toContain("dark:hidden")
    expect(escuro).toEqual(expect.arrayContaining(["hidden", "dark:block"]))
    expect(desenhos[0]?.getAttribute("src")).not.toBe(desenhos[1]?.getAttribute("src"))
    expect(container.textContent).toBe("")
  })
})

describe("a rolagem do painel (LAY-06)", () => {
  it("o respiro sai de uma de três densidades", () => {
    const { container } = render(<RolagemDoPainel densidade="compacta">x</RolagemDoPainel>)
    expect(classes(container.firstElementChild!)).toEqual(expect.arrayContaining(["px-4", "pb-5"]))
  })
})

describe("o menu do tema", () => {
  it("a escolha já é a ação: grava e põe a classe no <html>", () => {
    localStorage.clear()
    render(<MenuDoTema>{(tema) => <button>Tema: {tema}</button>}</MenuDoTema>)
    abrir(screen.getByRole("button", { name: "Tema: sistema" }))
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Escuro" }))
    expect(localStorage.getItem("wicomm-tema")).toBe("escuro")
    expect(document.documentElement.classList.contains("dark")).toBe(true)
    document.documentElement.classList.remove("dark")
  })

  it("lê o guardado antes de aplicar: o tema não troca por um instante ao montar", () => {
    localStorage.setItem("wicomm-tema", "escuro")
    document.documentElement.classList.add("dark")
    const trocas: boolean[] = []
    const vigia = new MutationObserver(() => trocas.push(document.documentElement.classList.contains("dark")))
    vigia.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    render(<MenuDoTema>{(tema) => <button>Tema: {tema}</button>}</MenuDoTema>)
    vigia.disconnect()
    expect(trocas.every(Boolean)).toBe(true)
    expect(screen.getByRole("button", { name: "Tema: escuro" })).toBeTruthy()
    document.documentElement.classList.remove("dark")
    localStorage.clear()
  })
})

describe("antes do desenho", () => {
  it("o código, executado, aplica o tema e a barra guardados no <html>", () => {
    const html = document.documentElement
    localStorage.setItem("wicomm-tema", "escuro")
    localStorage.setItem("wicomm-barra", "recolhida")
    new Function(CODIGO_ANTES_DO_DESENHO)()
    expect(html.classList.contains("dark")).toBe(true)
    expect(html.hasAttribute("data-barra-recolhida")).toBe(true)
    localStorage.setItem("wicomm-tema", "claro")
    localStorage.removeItem("wicomm-barra")
    new Function(CODIGO_ANTES_DO_DESENHO)()
    expect(html.classList.contains("dark")).toBe(false)
    expect(html.hasAttribute("data-barra-recolhida")).toBe(false)
    localStorage.clear()
  })

  it("o componente é um <script> com esse código, para o layout raiz", () => {
    const { container } = render(<ScriptsAntesDoDesenho />)
    expect(container.querySelector("script")!.innerHTML).toBe(CODIGO_ANTES_DO_DESENHO)
  })
})

describe("o menu da conta", () => {
  it("as iniciais, o e-mail sob demanda e Sair", () => {
    expect(iniciais("Ana Maria Souza")).toBe("AS")
    expect(iniciais("Ana")).toBe("A")
    const onSair = vi.fn()
    render(
      <MenuDaConta id="pessoa-ana" nome="Ana Souza" email="ana@exemplo.com.br" onSair={onSair}>
        <button>Conta</button>
      </MenuDaConta>
    )
    expect(screen.queryByText("ana@exemplo.com.br")).toBeNull()
    abrir(screen.getByRole("button", { name: "Conta" }))
    expect(screen.getByText("ana@exemplo.com.br")).toBeTruthy()
    fireEvent.click(screen.getByRole("menuitem", { name: "Sair" }))
    expect(onSair).toHaveBeenCalledOnce()
  })
})
