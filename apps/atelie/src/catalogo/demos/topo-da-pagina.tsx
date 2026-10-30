"use client"

import { MoreHorizontalIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ChipDeEstado } from "@/components/ui/chip-de-estado"
import { PaginaDoApp, TopoDaPagina } from "@/components/ui/topo-da-pagina"
import { Trilha } from "@/components/ui/trilha"
import { ProvedorDeLink } from "@/lib/link-do-app"

import { LinkDoPalco } from "./_tela"

export default function DemoDoTopo() {
  return (
    <ProvedorDeLink componente={LinkDoPalco}>
      <PaginaDoApp className="px-0">
        <TopoDaPagina
          trilha={<Trilha degraus={[{ rotulo: "Pedidos", href: "/pedidos" }, { rotulo: "Pedido 1042" }]} />}
          titulo="Pedido 1042"
          estado={<ChipDeEstado tom="espera">Aguarda você</ChipDeEstado>}
          secundarias={<Button variant="secondary">Imprimir</Button>}
          primario={<Button size="lg">Conferir os itens</Button>}
          menu={
            <Button variant="ghost" size="icon" aria-label="Mais ações do pedido">
              <MoreHorizontalIcon />
            </Button>
          }
          desfecho={{ tom: "ok", texto: "Etiqueta gerada." }}
        />
      </PaginaDoApp>
    </ProvedorDeLink>
  )
}
