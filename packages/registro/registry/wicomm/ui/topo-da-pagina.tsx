import * as React from "react"

import { COR_DO_TOM_DENSO, type Tom } from "@/registry/wicomm/lib/idioma-de-cor"
import { cn } from "@/registry/wicomm/lib/utils"

/**
 * A PÁGINA dentro do casco (DESIGN LAY-01, LAY-02, LAY-03): o contêiner de
 * largura (`max-w-[100rem]`, 1600px), o respiro lateral de 24px e a coluna que
 * ocupa a altura do casco. O topo fica parado; quem rola é a região do
 * arquétipo, pela peça de rolagem do kit (`RolagemDoPainel`).
 *
 * `largura="formulario"`: o formulário longo, a `max-w-3xl`, alinhado à
 * esquerda (LAY-02).
 */
function PaginaDoApp({
  largura = "pagina",
  className,
  children,
}: {
  largura?: "pagina" | "formulario"
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      data-slot="pagina-do-app"
      className={cn(
        "flex h-full min-h-0 w-full flex-col gap-6 px-6 pt-6 pb-6",
        largura === "pagina" ? "mx-auto max-w-[100rem]" : "max-w-3xl",
        className
      )}
    >
      {children}
    </div>
  )
}

type Desfecho = {
  tom: Extract<Tom, "ok" | "ruim" | "neutro">
  texto: string
  /** A saída do desfecho (MSG-06): a mesma ação, nunca uma cópia. */
  saida?: React.ReactNode
}

/**
 * O TOPO da página (ANATOMIA CASCO-01): o que muda quando a tela muda. De cima
 * para baixo — a trilha (só em tela de detalhe, CASCO-03), a linha do título
 * (o `h1`, um só, na voz `t-display` — TIPO-04; o estado do objeto; à direita
 * as secundárias, o primário e o `⋯`), o desfecho do último gesto do topo, e os
 * filtros que valem para a tela inteira (a Lista).
 *
 * É a ÚNICA peça que escreve o `h1` da página. O primário é um só (PESO-01) e
 * vem em `lg`; a ação rara mora no `menu` (PRIN-03). O que vale igual em todas
 * as telas não mora aqui: é do cabeçalho do casco.
 */
function TopoDaPagina({
  trilha,
  titulo,
  estado,
  secundarias,
  primario,
  menu,
  desfecho,
  filtros,
  className,
}: {
  trilha?: React.ReactNode
  titulo: string
  estado?: React.ReactNode
  secundarias?: React.ReactNode
  primario?: React.ReactNode
  menu?: React.ReactNode
  desfecho?: Desfecho | null
  filtros?: React.ReactNode
  className?: string
}) {
  const acoes = secundarias || primario || menu
  return (
    <header data-slot="topo-da-pagina" className={cn("flex shrink-0 flex-col gap-1.5", className)}>
      {trilha}
      <div className="flex min-h-9 items-center gap-3">
        <h1 className="t-display min-w-0 truncate text-foreground">{titulo}</h1>
        {estado}
        {acoes ? (
          <div data-slot="acoes-do-topo" className="ml-auto flex shrink-0 items-center gap-2">
            {secundarias}
            {primario}
            {menu}
          </div>
        ) : null}
      </div>
      {desfecho ? (
        <p
          role={desfecho.tom === "ruim" ? "alert" : "status"}
          data-slot="desfecho-do-topo"
          data-tom={desfecho.tom}
          className={cn("t-denso flex items-center gap-2", COR_DO_TOM_DENSO[desfecho.tom])}
        >
          {desfecho.texto}
          {desfecho.saida}
        </p>
      ) : null}
      {filtros ? (
        <div data-slot="filtros-do-topo" className="mt-1.5 flex items-center gap-3">
          {filtros}
        </div>
      ) : null}
    </header>
  )
}

export { PaginaDoApp, TopoDaPagina, type Desfecho }
