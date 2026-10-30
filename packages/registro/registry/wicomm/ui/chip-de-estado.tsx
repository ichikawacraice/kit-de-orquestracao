import * as React from "react"
import { LoaderCircleIcon } from "lucide-react"

import { BADGE_DO_TOM, type Tom } from "@/registry/wicomm/lib/idioma-de-cor"
import { cn } from "@/registry/wicomm/lib/utils"

/**
 * O casco do carimbo (DESIGN CTRL-05): uma forma só para todo carimbo — raio de
 * carimbo, 11px, tinta chapada da voz, sem contorno, sem desfoque. Raio,
 * padding, tamanho e tinta não são escolha de quem usa.
 */
const CASCO_DO_CARIMBO =
  "inline-flex shrink-0 items-center gap-[5px] whitespace-nowrap rounded-md px-2 py-[3px] text-[11px] leading-[1.4] font-[650] [font-stretch:96%]"

/**
 * O ESTADO em uma palavra (ANATOMIA PECA-01). Declara `tom` — a voz responde
 * *o que isto pede de você?* (COR-03) — e nunca uma classe de cor (COR-05).
 *
 * `emCurso`: o estado está andando (COR-04: em curso é `neutro`). Ganha o
 * círculo que gira, parado para quem pediu menos movimento; a palavra no
 * gerúndio segura o sentido.
 */
function ChipDeEstado({
  tom,
  emCurso = false,
  className,
  children,
  ...props
}: React.ComponentProps<"span"> & { tom: Tom; emCurso?: boolean }) {
  return (
    <span data-slot="chip-de-estado" data-tom={tom} className={cn(CASCO_DO_CARIMBO, BADGE_DO_TOM[tom], className)} {...props}>
      {emCurso ? <LoaderCircleIcon aria-hidden="true" className="size-3 animate-spin motion-reduce:animate-none" /> : null}
      {children}
    </span>
  )
}

/**
 * O estado que ABRE o detalhe (PECA-01): o mesmo carimbo, como botão. O clique
 * leva ao que o estado resume (a pendência, a lista). O sublinhado pontilhado
 * diz que ele abre; o foco tem o anel de sempre (SUP-06).
 */
function ChipQueAbre({
  tom,
  onAbrir,
  aberto,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"button">, "onClick"> & { tom: Tom; onAbrir: () => void; aberto?: boolean }) {
  return (
    <button
      type="button"
      data-slot="chip-que-abre"
      data-tom={tom}
      aria-expanded={aberto}
      onClick={onAbrir}
      className={cn(
        CASCO_DO_CARIMBO,
        BADGE_DO_TOM[tom],
        "cursor-pointer underline decoration-current/40 decoration-dotted underline-offset-2 transition-colors duration-cor hover:decoration-current focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export { ChipDeEstado, ChipQueAbre, CASCO_DO_CARIMBO }
