"use client"

import { MoreHorizontalIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChipDeEstado } from "@/components/ui/chip-de-estado"
import { PaginaDoApp, TopoDaPagina } from "@/components/ui/topo-da-pagina"
import { Trilha } from "@/components/ui/trilha"
import { ProvedorDeLink } from "@/lib/link-do-app"

import { Amostra, Amostras } from "./_amostra"
import { LinkDoPalco } from "./_tela"

const TRILHA = <Trilha degraus={[{ rotulo: "Pedidos", href: "/pedidos" }, { rotulo: "Pedido 1042" }]} />

const VALORES = (
  <>
    <Badge>Urgente</Badge>
    <Badge>Prioridade 1</Badge>
    <Badge>Retirada na loja</Badge>
    <Badge>Cliente recorrente</Badge>
  </>
)

const MENU = (
  <Button variant="ghost" size="icon" aria-label="Mais ações do pedido">
    <MoreHorizontalIcon />
  </Button>
)

export default function DemoDoTopo() {
  return (
    <ProvedorDeLink componente={LinkDoPalco}>
      <Amostras>
        <Amostra titulo="O estado na linha do título, os valores na de baixo" primeira>
          <PaginaDoApp className="px-0 pt-0 pb-0">
            <TopoDaPagina
              trilha={TRILHA}
              titulo="Pedido 1042"
              estado={<ChipDeEstado tom="espera">Aguarda você</ChipDeEstado>}
              valores={VALORES}
              secundarias={<Button variant="secondary">Imprimir</Button>}
              primario={<Button size="lg">Conferir os itens</Button>}
              menu={MENU}
              desfecho={{ tom: "ok", texto: "Etiqueta gerada." }}
            />
          </PaginaDoApp>
        </Amostra>
        <Amostra titulo="Estado neutro sobre os valores: o ponto diz que é estado">
          <PaginaDoApp className="px-0 pt-0 pb-0">
            <TopoDaPagina
              trilha={TRILHA}
              titulo="Pedido 1042"
              estado={<ChipDeEstado tom="neutro">Entrega em 40 dias</ChipDeEstado>}
              valores={VALORES}
              primario={<Button size="lg">Conferir os itens</Button>}
              menu={MENU}
            />
          </PaginaDoApp>
        </Amostra>
        <Amostra titulo="Os valores carregando: a espera já na altura final">
          <PaginaDoApp className="px-0 pt-0 pb-0">
            <TopoDaPagina
              trilha={TRILHA}
              titulo="Pedido 1042"
              estado={<ChipDeEstado tom="espera">Aguarda você</ChipDeEstado>}
              valores="carregando"
              primario={<Button size="lg">Conferir os itens</Button>}
              menu={MENU}
            />
          </PaginaDoApp>
        </Amostra>
        <Amostra titulo="Sem valores: a linha não existe">
          <PaginaDoApp className="px-0 pt-0 pb-0">
            <TopoDaPagina
              trilha={TRILHA}
              titulo="Pedido 1042"
              estado={<ChipDeEstado tom="ok">Entregue</ChipDeEstado>}
              primario={<Button size="lg">Abrir a nota</Button>}
              menu={MENU}
            />
          </PaginaDoApp>
        </Amostra>
        <Amostra titulo="No estreito, a linha dos valores quebra e o título fica inteiro">
          <div className="w-full max-w-72">
            <TopoDaPagina
              titulo="Pedido 1042"
              estado={<ChipDeEstado tom="espera">Aguarda você</ChipDeEstado>}
              valores={VALORES}
              menu={MENU}
            />
          </div>
        </Amostra>
      </Amostras>
    </ProvedorDeLink>
  )
}
