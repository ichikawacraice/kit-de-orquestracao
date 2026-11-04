import * as React from "react"
import { CircleAlertIcon } from "lucide-react"

import { BADGE_DO_TOM } from "@/registry/design-system/lib/idioma-de-cor"
import { CASCO_DO_CARIMBO } from "@/registry/design-system/ui/chip-de-estado"
import { cn } from "@/registry/design-system/lib/utils"

/** 0 é *sem prioridade*; 1 a 3, baixa a alta; `urgente` tem glifo próprio. */
type NivelDaPrioridade = 0 | 1 | 2 | 3 | "urgente"

const ALTURA_DA_BARRA = ["h-1", "h-1.75", "h-2.5"] as const

/**
 * A prioridade de um item (ANATOMIA PECA-01): um carimbo, no casco de todo
 * carimbo (CTRL-05), com o glifo de barras e a palavra. A cor responde uma
 * pergunta só — *o que isto pede de você?* (COR-03) —, e a prioridade só pede
 * quando é urgente: a urgente fala na voz `espera`, com o glifo próprio; as
 * outras são o carimbo neutro, e o glifo distingue pela forma. A palavra vem
 * sempre (COR-08).
 *
 * O nível que significa *normal*, quando o projeto tem um, não se mostra
 * (PRIN-04): carimbo que diz *nada de especial* é ruído em cada cartão.
 */
function Prioridade({
  nivel,
  className,
  children,
}: {
  nivel: NivelDaPrioridade
  className?: string
  /** A palavra: "Alta", "Urgente". */
  children: string
}) {
  const urgente = nivel === "urgente"
  return (
    <span
      data-slot="prioridade"
      data-nivel={nivel}
      className={cn(CASCO_DO_CARIMBO, BADGE_DO_TOM[urgente ? "espera" : "neutro"], className)}
    >
      {urgente ? (
        <CircleAlertIcon aria-hidden="true" className="size-3 shrink-0" />
      ) : (
        <span aria-hidden="true" className="flex size-2.75 shrink-0 items-end justify-center gap-px">
          {ALTURA_DA_BARRA.map((altura, i) => (
            <span
              key={altura}
              className={cn("w-0.5 rounded-full", altura, i < nivel ? "bg-current" : "bg-current opacity-25")}
            />
          ))}
        </span>
      )}
      {children}
    </span>
  )
}

export { Prioridade, type NivelDaPrioridade }
