"use client"

import * as React from "react"
import { CopyIcon, MoreHorizontalIcon, PackageOpenIcon, TriangleAlertIcon, XCircleIcon } from "lucide-react"

import { Bloco } from "@/registry/design-system/ui/bloco"
import { Button } from "@/registry/design-system/ui/button"
import { ChipDeEstado } from "@/registry/design-system/ui/chip-de-estado"
import { Estado } from "@/registry/design-system/ui/estado"
import { Ficha, ParDaFicha } from "@/registry/design-system/ui/ficha"
import { ConteudoDoMenu, GatilhoDoMenu, GrupoDoMenu, ItemDoMenu, Menu } from "@/registry/design-system/ui/menu"
import { Painel, RolagemDoPainel } from "@/registry/design-system/ui/painel"
import { BarraDeModos } from "@/registry/design-system/ui/seletor-de-vista"
import { EsperaDaLista, Skeleton } from "@/registry/design-system/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/registry/design-system/ui/table"
import { TelaDeErro } from "@/registry/design-system/ui/tela-de-erro"
import { useToast } from "@/registry/design-system/ui/toast"
import { PaginaDoApp, TopoDaPagina, type Desfecho } from "@/registry/design-system/ui/topo-da-pagina"
import { Trilha } from "@/registry/design-system/ui/trilha"
import { TrilhoDoPercurso } from "@/registry/design-system/ui/trilho-do-percurso"
import { Vazio } from "@/registry/design-system/ui/vazio"
import { COR_DO_TOM_DENSO } from "@/registry/design-system/lib/idioma-de-cor"
import { LinkDoApp } from "@/registry/design-system/lib/link-do-app"
import { cn } from "@/registry/design-system/lib/utils"
import { estacoesDoPedido, type CargaDaMesa, type Etapa, type ItemDoPedido } from "@/registry/design-system/blocks/mesa/dados-da-mesa"

const ESPERA_DO_GESTO_MS = 900

function MenuDoItem({ item }: { item: ItemDoPedido }) {
  const avisar = useToast()
  return (
    <Menu>
      <GatilhoDoMenu asChild>
        <Button variant="ghost" size="icon" aria-label={`Mais ações de ${item.nome}`}>
          <MoreHorizontalIcon aria-hidden="true" />
        </Button>
      </GatilhoDoMenu>
      <ConteudoDoMenu>
        <GrupoDoMenu>
          <ItemDoMenu icone={TriangleAlertIcon} onEscolher={() => avisar({ tom: "neutro", titulo: "Registrar divergência não faz parte deste exemplo." })}>
            Registrar divergência
          </ItemDoMenu>
        </GrupoDoMenu>
      </ConteudoDoMenu>
    </Menu>
  )
}

/**
 * Os itens do pedido. `somenteLeitura`: a Mesa de leitura, em que o gesto mora
 * noutra tela — o item pendente diz que está por conferir, sem botão e sem
 * `⋯` (PESO-03: o gesto que esta tela não faz não é desenhado).
 */
function BlocoDosItens({
  itens,
  conferindo = new Set(),
  falhou = null,
  aoConferir,
  somenteLeitura = false,
  titulo = "Itens",
}: {
  itens: ItemDoPedido[]
  conferindo?: ReadonlySet<string>
  falhou?: string | null
  aoConferir?: (id: string) => void
  somenteLeitura?: boolean
  titulo?: string
}) {
  const feitos = itens.filter((i) => i.conferido).length
  return (
    <Bloco titulo={titulo} legenda={itens.length ? `${feitos} de ${itens.length} conferidos` : undefined} className="px-1 py-2">
      {itens.length === 0 ? (
        <Vazio causa="nao-se-aplica" icone={PackageOpenIcon} titulo="Nada a conferir">
          Este pedido não tem itens para conferir.
        </Vazio>
      ) : (
        <Table>
          <TableHeader className="bg-transparent">
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead medida className="w-28">
                Quantidade
              </TableHead>
              <TableHead className="w-48">Situação</TableHead>
              {somenteLeitura ? null : (
                <TableHead className="w-12">
                  <span className="sr-only">Ações</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {itens.map((i) => (
              <TableRow key={i.id}>
                <TableCell>{i.nome}</TableCell>
                <TableCell medida>{i.quantidade}</TableCell>
                <TableCell>
                  {i.conferido ? (
                    <Estado tom="ok">Conferido</Estado>
                  ) : somenteLeitura ? (
                    <Estado tom="neutro">por conferir</Estado>
                  ) : conferindo.has(i.id) ? (
                    <Button size="sm" variant="secondary" disabled>
                      Conferindo
                    </Button>
                  ) : (
                    <span className="flex flex-col items-start gap-1">
                      <Button size="sm" variant="secondary" onClick={() => aoConferir?.(i.id)}>
                        Conferir
                      </Button>
                      {falhou === i.id ? (
                        <span role="alert" className={cn("t-denso", COR_DO_TOM_DENSO.ruim)}>
                          Não deu para marcar este item. Tente de novo.
                        </span>
                      ) : null}
                    </span>
                  )}
                </TableCell>
                {somenteLeitura ? null : (
                  <TableCell className="text-right">
                    <MenuDoItem item={i} />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Bloco>
  )
}

function BlocoDosDados({ ficha }: { ficha: CargaDaMesa["ficha"] }) {
  return (
    <Bloco titulo="Dados do pedido" recolhivel abertoPorPadrao={false} resumo={`${ficha.cliente} · ${ficha.valor}`}>
      <Ficha>
        <ParDaFicha rotulo="Cliente">{ficha.cliente}</ParDaFicha>
        <ParDaFicha rotulo="Criado em">{ficha.criadoEm}</ParDaFicha>
        <ParDaFicha rotulo="Valor total" mono>
          {ficha.valor}
        </ParDaFicha>
        <ParDaFicha rotulo="Entrega">{ficha.entrega}</ParDaFicha>
      </Ficha>
    </Bloco>
  )
}

function EsperaDoConteudo() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">Carregando o pedido</span>
      {[0, 1].map((n) => (
        <div key={n} className="flex flex-col gap-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      ))}
    </div>
  )
}

/**
 * O arquétipo MESA (ANATOMIA ARQ-01): *em que pé está isto, e o que eu faço
 * agora?* — topo (trilha, nome, estado, primário, `⋯`), o trilho do percurso à
 * esquerda e o conteúdo da etapa aberta. EXEMPLO com um pedido.
 *
 * - O primário só existe quando a regra o libera (PESO-03): com item por
 *   conferir, não é desenhado — o gesto está na linha do item.
 * - O desfecho do primário mora no topo, até a próxima ação, com a saída
 *   (MSG-01, MSG-06); o do gesto cujo lugar sumiu vai ao aviso.
 * - O trilho não passa de 25% da largura (PESO-04). Variante de leitura: abas no
 *   lugar do trilho, sem primário.
 */
function MesaDoPedido({
  carga,
  hrefDaLista = "/pedidos",
  hrefDaConferencia,
}: {
  carga: CargaDaMesa
  hrefDaLista?: string
  /**
   * Onde o gesto mora quando esta Mesa é de leitura: OUTRA tela, a que confere
   * e mostra o pendente. Sem ela, a leitura não desenha o caminho — o bloco não
   * inventa um destino que pode ser a própria tela.
   */
  hrefDaConferencia?: string
}) {
  const { momento } = carga
  const avisar = useToast()
  const [itens, setItens] = React.useState(carga.itens)
  // Cada item confere por conta própria: duas conferências seguidas não se atropelam.
  const [conferindo, setConferindo] = React.useState<ReadonlySet<string>>(new Set())
  const relogios = React.useRef<ReturnType<typeof setTimeout>[]>([])
  React.useEffect(() => () => relogios.current.forEach(clearTimeout), [])
  const depois = (fazer: () => void) => {
    relogios.current.push(setTimeout(fazer, ESPERA_DO_GESTO_MS))
  }
  const [concluida, setConcluida] = React.useState(momento === "sucesso")
  const [concluindo, setConcluindo] = React.useState(momento === "andando")
  const [desfecho, setDesfecho] = React.useState<Desfecho | null>(null)
  const [aberta, setAberta] = React.useState<Etapa>(momento === "sucesso" ? "pagamento" : "conferencia")
  const [aba, setAba] = React.useState<"itens" | "dados">("itens")

  const concluir = React.useCallback(() => {
    setDesfecho(null)
    setConcluindo(true)
    relogios.current.push(
      setTimeout(() => {
        setConcluindo(false)
        setConcluida(true)
        setAberta("pagamento")
        setDesfecho({ tom: "ok", texto: "Conferência concluída." })
      }, ESPERA_DO_GESTO_MS)
    )
  }, [])

  React.useEffect(() => {
    if (momento === "erro")
      setDesfecho({
        tom: "ruim",
        texto: "Não deu para concluir a conferência.",
        saida: (
          <Button variant="link" onClick={concluir}>
            Tentar de novo
          </Button>
        ),
      })
    if (momento === "recusa")
      setDesfecho({
        tom: "ruim",
        texto: "Não deu para concluir: o pedido foi cancelado por outra pessoa.",
        saida: (
          <Button variant="link" onClick={() => window.location.reload()}>
            Ver o pedido atualizado
          </Button>
        ),
      })
    if (momento === "sucesso") setDesfecho({ tom: "ok", texto: "Conferência concluída." })
  }, [momento, concluir])

  const conferir = (id: string) => {
    setConferindo((atual) => new Set(atual).add(id))
    depois(() => {
      setConferindo((atual) => {
        const resto = new Set(atual)
        resto.delete(id)
        return resto
      })
      setItens((atual) => atual.map((i) => (i.id === id ? { ...i, conferido: true } : i)))
    })
  }

  // Enquanto a rota não respondeu, o título é o nome do tipo: nunca vazio (TIPO-04).
  const titulo = carga.numero ? `Pedido ${carga.numero}` : "Pedido"
  const trilha = (
    <Trilha
      degraus={[
        { rotulo: "Pedidos", href: hrefDaLista },
        { rotulo: titulo },
      ]}
    />
  )

  if (momento === "sem-permissao") {
    return (
      <PaginaDoApp>
        <TelaDeErro
          escala="rota"
          tipo="sem-permissao"
          titulo={titulo}
          saida={
            <Button asChild variant="outline">
              <LinkDoApp href={hrefDaLista}>Voltar aos pedidos</LinkDoApp>
            </Button>
          }
        >
          Sua conta não tem acesso a este pedido. Fale com quem administra o app.
        </TelaDeErro>
      </PaginaDoApp>
    )
  }

  const carregando = momento === "carregando" || momento === "carregando-abas"
  const leitura = momento === "leitura" || momento === "carregando-abas"
  const tudoConferido = itens.length > 0 && itens.every((i) => i.conferido)
  const liberaConcluir = !carregando && !leitura && !concluida && tudoConferido

  const estado = carregando ? (
    <Skeleton className="h-5 w-20" />
  ) : concluida ? (
    <ChipDeEstado tom="neutro" emCurso>
      Em pagamento
    </ChipDeEstado>
  ) : (
    <ChipDeEstado tom="espera">Aguarda você</ChipDeEstado>
  )

  // Na leitura, nenhum gesto que grava: nem o ⋯ do pedido (PESO-03).
  const menu = carregando || leitura ? null : (
    <Menu>
      <GatilhoDoMenu asChild>
        <Button variant="ghost" size="icon" aria-label="Mais ações do pedido">
          <MoreHorizontalIcon aria-hidden="true" />
        </Button>
      </GatilhoDoMenu>
      <ConteudoDoMenu>
        <GrupoDoMenu>
          <ItemDoMenu icone={CopyIcon} onEscolher={() => avisar({ tom: "neutro", titulo: "Duplicar não faz parte deste exemplo." })}>
            Duplicar pedido
          </ItemDoMenu>
        </GrupoDoMenu>
        <GrupoDoMenu>
          <ItemDoMenu
            icone={XCircleIcon}
            destrutivo
            confirmacao={{
              titulo: `Cancelar o pedido ${carga.numero}?`,
              descricao: "O pedido sai da fila e a pessoa que pediu é avisada. Isso não se desfaz.",
              confirmar: "Cancelar pedido",
              cancelar: "Manter pedido",
            }}
            onEscolher={() => avisar({ tom: "ok", titulo: "Pedido cancelado" })}
          >
            Cancelar pedido
          </ItemDoMenu>
        </GrupoDoMenu>
      </ConteudoDoMenu>
    </Menu>
  )

  const conteudo = carregando ? (
    <EsperaDoConteudo />
  ) : aberta === "recebido" ? (
    <Bloco titulo="Recebimento">
      <Ficha>
        <ParDaFicha rotulo="Recebido em">{carga.ficha.criadoEm}</ParDaFicha>
        <ParDaFicha rotulo="Por">{carga.ficha.cliente}</ParDaFicha>
      </Ficha>
    </Bloco>
  ) : aberta === "pagamento" ? (
    <Bloco titulo="Pagamento">
      <Ficha>
        <ParDaFicha rotulo="Valor" mono>
          {carga.ficha.valor}
        </ParDaFicha>
        <ParDaFicha rotulo="Forma">Cartão de crédito</ParDaFicha>
      </Ficha>
    </Bloco>
  ) : (
    <>
      <BlocoDosItens itens={itens} conferindo={conferindo} aoConferir={conferir} />
      <BlocoDosDados ficha={carga.ficha} />
    </>
  )

  return (
    <PaginaDoApp>
      <TopoDaPagina
        trilha={trilha}
        titulo={titulo}
        estado={estado}
        primario={
          concluindo ? (
            <Button size="lg" disabled>
              Concluindo
            </Button>
          ) : liberaConcluir ? (
            <Button size="lg" onClick={concluir}>
              Concluir conferência
            </Button>
          ) : null
        }
        menu={menu}
        desfecho={desfecho}
      />
      {leitura ? (
        <>
          <p className="t-denso -mt-3 flex items-center gap-2 text-foreground-2">
            A conferência dos itens é feita noutra tela.
            {hrefDaConferencia ? (
              <LinkDoApp
                href={hrefDaConferencia}
                className="text-foreground sublinhado-de-link"
              >
                Abrir a conferência
              </LinkDoApp>
            ) : null}
          </p>
          <BarraDeModos
            rotulo="Partes do pedido"
            densidade="abas"
            valor={aba}
            onTrocar={setAba}
            modos={[
              { chave: "itens", rotulo: "Itens" },
              { chave: "dados", rotulo: "Dados do pedido" },
            ]}
          />
          <RolagemDoPainel densidade="solta" className="flex flex-col gap-6">
            {carregando ? (
              <EsperaDoConteudo />
            ) : aba === "itens" ? (
              <BlocoDosItens itens={itens} somenteLeitura titulo="Itens do pedido" />
            ) : (
              <BlocoDosDados ficha={carga.ficha} />
            )}
          </RolagemDoPainel>
        </>
      ) : (
        <div className="flex min-h-0 flex-1 gap-6">
          <Painel as="div" className="h-fit w-60 shrink-0 self-start">
            {carregando ? (
              <EsperaDaLista linhas={5} alturaDaLinha="h-10" rotulo="Carregando o percurso" className="gap-0.5 p-2" />
            ) : (
              <TrilhoDoPercurso estacoes={estacoesDoPedido(concluida)} aberta={aberta} onAbrir={setAberta} />
            )}
          </Painel>
          <RolagemDoPainel densidade="solta" className="flex min-w-0 flex-col gap-6">
            {conteudo}
          </RolagemDoPainel>
        </div>
      )}
    </PaginaDoApp>
  )
}

export { MesaDoPedido }
