import * as React from "react"
import { CircleAlertIcon } from "lucide-react"

import { BADGE_DO_TOM } from "@/registry/design-system/lib/idioma-de-cor"
import { CASCO_DO_CARIMBO } from "@/registry/design-system/ui/chip-de-estado"
import { cn } from "@/registry/design-system/lib/utils"

/** 0 é *sem prioridade*; 1 a 3, baixa a alta; `urgente` tem glifo próprio. */
type NivelDaPrioridade = 0 | 1 | 2 | 3 | "urgente"

const ALTURA_DA_BARRA = ["h-1", "h-1.75", "h-2.5"] as const

/**
 * A cor do nível (COR-09): identidade declarada, num lugar só — esta peça —,
 * que pinta o glifo e a palavra do carimbo neutro. A urgente não entra: ela
 * fala na voz `espera`. Os degraus são contraste medido sobre a tinta do
 * carimbo neutro: no claro, sky-700 5,15, amber-800 6,15 e red-700 5,61 sobre
 * o cartão (o amber-700 cairia a 4,36); no escuro, os 400 passam de 5,2.
 */
const COR_DO_NIVEL: Record<1 | 2 | 3, string> = {
  1: "text-sky-700 dark:text-sky-400",
  2: "text-amber-800 dark:text-amber-400",
  3: "text-red-700 dark:text-red-400",
}

/**
 * A prioridade de um item (ANATOMIA PECA-01): um carimbo, no casco de todo
 * carimbo (CTRL-05), com o glifo de barras e a palavra. A cor responde uma
 * pergunta só — *o que isto pede de você?* (COR-03) —, e a prioridade só pede
 * quando é urgente: a urgente fala na voz `espera`, com o glifo próprio; as
 * outras são o carimbo neutro, e o nível se distingue pela forma do glifo e
 * pela cor declarada do nível (COR-09), na palavra e nas barras cheias, que
 * pintam com `bg-current`. A palavra vem sempre (COR-08).
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
      className={cn(
        CASCO_DO_CARIMBO,
        BADGE_DO_TOM[urgente ? "espera" : "neutro"],
        !urgente && nivel > 0 && COR_DO_NIVEL[nivel as 1 | 2 | 3],
        className,
      )}
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

export { Prioridade, COR_DO_NIVEL, type NivelDaPrioridade }
