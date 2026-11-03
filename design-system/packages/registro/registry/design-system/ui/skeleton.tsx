import * as React from "react"

import { cn } from "@/registry/design-system/lib/utils"

/**
 * O esqueleto: a caixa da espera. Pulsa, e fica PARADO para quem pediu menos
 * movimento (MOV-02). A altura é de quem chama — esqueleto sem altura é caixa
 * de 0px.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-foreground/[0.06] motion-reduce:animate-none", className)}
      {...props}
    />
  )
}

/**
 * A espera de uma LISTA: N linhas na altura da linha real, e a espera
 * declarada (`role="status"`, `aria-busy`). A altura vem de quem chama porque é
 * a da linha DELE.
 */
function EsperaDaLista({
  linhas,
  alturaDaLinha,
  rotulo,
  className,
}: {
  linhas: number
  /** A classe de altura da linha real (`h-10`). */
  alturaDaLinha: string
  /** O que o leitor de tela ouve: o que está vindo, não "carregando". */
  rotulo: string
  className?: string
}) {
  return (
    <div role="status" aria-busy="true" data-slot="espera-da-lista" className={cn("flex flex-col gap-3", className)}>
      <span className="sr-only">{rotulo}</span>
      {Array.from({ length: linhas }, (_, i) => (
        <Skeleton key={i} className={cn("rounded-xl", alturaDaLinha)} />
      ))}
    </div>
  )
}

export { EsperaDaLista, Skeleton }
