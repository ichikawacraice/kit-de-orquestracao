"use client"

import * as React from "react"

import { Ajuda } from "@/registry/wicomm/ui/tooltip"
import { cn } from "@/registry/wicomm/lib/utils"

/**
 * O gesto que a tela MOSTRA e não deixa fazer diz por quê, na dica.
 *
 * Botão desabilitado não recebe o ponteiro nem o foco, então a dica mora num
 * envoltório focável. Sem `motivo`, o filho passa como está. Habilitado, o
 * próprio filho é o gatilho: um envoltório focável daria duas paradas de Tab.
 *
 * `className` vai ao envoltório (só existe com motivo e desabilitado): quem o
 * encaixa numa linha de texto alinha por ele.
 */
function ComMotivo({
  motivo,
  desabilitado = true,
  className,
  children,
}: {
  motivo: string | null | undefined
  desabilitado?: boolean
  className?: string
  children: React.ReactNode
}) {
  if (!motivo) return <>{children}</>
  if (!desabilitado) {
    return (
      <Ajuda texto={motivo} lado="bottom">
        {children}
      </Ajuda>
    )
  }
  return (
    <Ajuda texto={motivo} lado="bottom">
      <span
        data-slot="com-motivo"
        tabIndex={0}
        className={cn(
          "inline-flex rounded-md focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          className
        )}
      >
        {children}
      </span>
    </Ajuda>
  )
}

export { ComMotivo }
