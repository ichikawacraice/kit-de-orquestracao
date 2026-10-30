import * as React from "react"

import { LinkDoApp, type PropsDoLink } from "@/registry/wicomm/lib/link-do-app"
import { cn } from "@/registry/wicomm/lib/utils"

/**
 * A tabela (table do shadcn) em densidade instrumento: linha de 40px, corpo
 * `t-denso`, cabeçalho de coluna na voz `t-coluna` (TIPO-02), grudado no topo
 * da rolagem. **Sem filete entre linhas** (SUP-03: linha demais vira grade, e
 * grade é planilha): a linha se separa pelo ar e se marca pelo hover.
 *
 * Mora dentro de uma superfície (um `Painel` com `RolagemDoPainel`), que é quem
 * rola; por isso não traz o invólucro de rolagem do shadcn.
 *
 * A linha que abre um objeto tem um `LinkDaLinha` na primeira célula: o link se
 * estica sobre a linha inteira (o alvo é a linha), e o nome acessível é o dele.
 */
function Table({ className, ...props }: React.ComponentProps<"table">) {
  return <table data-slot="table" className={cn("w-full caption-bottom border-collapse", className)} {...props} />
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={cn("sticky top-0 z-10 bg-card", className)} {...props} />
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" className={className} {...props} />
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      // `relative`: âncora do link esticado (`LinkDaLinha`). O hover marca a linha que vai abrir.
      className={cn("relative transition-colors duration-cor [tbody_&]:hover:bg-accent", className)}
      {...props}
    />
  )
}

function TableHead({
  className,
  medida = false,
  ...props
}: React.ComponentProps<"th"> & { medida?: boolean }) {
  return (
    <th
      data-slot="table-head"
      scope="col"
      className={cn("t-coluna h-8 px-3 text-left align-middle whitespace-nowrap", medida && "text-right", className)}
      {...props}
    />
  )
}

/**
 * A célula. `medida`: número que se compara com o de outra linha — mono,
 * algarismos tabulares, alinhado à direita (TIPO-03).
 */
function TableCell({
  className,
  medida = false,
  ...props
}: React.ComponentProps<"td"> & { medida?: boolean }) {
  return (
    <td
      data-slot="table-cell"
      className={cn("h-10 px-3 align-middle text-foreground", medida ? "t-medida text-right" : "t-denso", className)}
      {...props}
    />
  )
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return <caption data-slot="table-caption" className={cn("mt-3 t-denso text-muted-foreground", className)} {...props} />
}

/**
 * O link que abre o objeto da linha. Fica na primeira célula e se estica sobre
 * a linha inteira por um `::after`; o foco desenha o anel em volta da linha.
 */
function LinkDaLinha({ className, ...props }: PropsDoLink) {
  return (
    <LinkDoApp
      data-slot="link-da-linha"
      className={cn(
        "outline-hidden after:absolute after:inset-0 after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset",
        className
      )}
      {...props}
    />
  )
}

export { LinkDaLinha, Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow }
