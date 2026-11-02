import * as React from "react"

import { COR_DO_TOM_DENSO, PONTO_DO_TOM, type Tom } from "@/registry/design-system/lib/idioma-de-cor"
import { cn } from "@/registry/design-system/lib/utils"

/**
 * O marcador mínimo de voz (ANATOMIA PECA-01): o ponto de 6px e a palavra.
 * Cor não informa sozinha (COR-08): a palavra vem sempre — à vista, ou só para
 * o leitor de tela com `soPonto`, quando o lugar não cabe texto (a barra
 * recolhida, a linha da estrutura). Com `soPonto`, quem usa precisa de outra
 * pista visível ao lado (a dica, o rótulo da linha).
 */
function Estado({
  tom,
  soPonto = false,
  className,
  children,
}: {
  tom: Tom
  soPonto?: boolean
  className?: string
  /** A palavra: "Conferido", "em curso". */
  children: string
}) {
  return (
    <span data-slot="estado" data-tom={tom} className={cn("inline-flex items-center gap-1.5", className)}>
      <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", PONTO_DO_TOM[tom])} />
      <span className={soPonto ? "sr-only" : cn("t-denso", COR_DO_TOM_DENSO[tom])}>{children}</span>
    </span>
  )
}

export { Estado }
