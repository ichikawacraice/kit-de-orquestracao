import * as React from "react"

import { RolagemDoPainel } from "@/components/ui/painel"
import { PaginaDoApp, TopoDaPagina } from "@/components/ui/topo-da-pagina"

/**
 * A moldura de toda página da vitrine (LAY-01): o topo parado com o `h1`, e o
 * conteúdo que rola, com 24px entre blocos (LAY-03: o dobro dos 12px de dentro).
 * `abertura` é a frase que diz o que a página responde, na largura de leitura.
 */
export function PaginaDaVitrine({
  titulo,
  abertura,
  trilha,
  filtros,
  secundarias,
  children,
}: {
  titulo: string
  abertura?: React.ReactNode
  trilha?: React.ReactNode
  filtros?: React.ReactNode
  secundarias?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <PaginaDoApp>
      <TopoDaPagina titulo={titulo} trilha={trilha} filtros={filtros} secundarias={secundarias} />
      <RolagemDoPainel densidade="solta" className="-mx-6 flex flex-col gap-6 px-6">
        {abertura ? <p className="max-w-medida text-sm text-foreground-2">{abertura}</p> : null}
        {children}
      </RolagemDoPainel>
    </PaginaDoApp>
  )
}
