"use client"

import { ProvedorDeLink } from "@/lib/link-do-app"
import { Trilha } from "@/components/ui/trilha"

import { Amostra, Amostras } from "./_amostra"
import { LinkDoPalco } from "./_tela"

export default function DemoDaTrilha() {
  return (
    <ProvedorDeLink componente={LinkDoPalco}>
      <Amostras>
        <Amostra titulo="Tela de detalhe" primeira>
          <Trilha degraus={[{ rotulo: "Pedidos", href: "/pedidos" }, { rotulo: "Pedido 1042" }]} />
        </Amostra>
        <Amostra titulo="Dois níveis abaixo">
          <Trilha
            degraus={[
              { rotulo: "Pedidos", href: "/pedidos" },
              { rotulo: "Pedido 1042", href: "/pedidos/1042" },
              { rotulo: "Conferência" },
            ]}
          />
        </Amostra>
      </Amostras>
    </ProvedorDeLink>
  )
}
