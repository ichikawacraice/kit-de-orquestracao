import * as React from "react"
import { LoaderCircleIcon } from "lucide-react"

import { BADGE_DO_TOM, PONTO_NO_CARIMBO, type Tom } from "@/registry/design-system/lib/idioma-de-cor"
import { cn } from "@/registry/design-system/lib/utils"

/**
 * O casco do carimbo (DESIGN CTRL-05): uma forma só para todo carimbo — raio de
 * carimbo, 11px, tinta chapada da voz, sem contorno, sem desfoque. Raio,
 * padding, tamanho e tinta não são escolha de quem usa.
 */
const CASCO_DO_CARIMBO =
  "inline-flex shrink-0 items-center gap-[5px] whitespace-nowrap rounded-md px-2 py-[3px] text-[11px] leading-[1.4] font-[650] [font-stretch:96%]"

/**
 * O gesto do carimbo que abre (CTRL-03): o sublinhado do link diz que ele abre,
 * o foco tem o anel de sempre (SUP-06). O desenho mede ~21px; o alvo de clique,
 * 24px, por um pseudo-elemento (ACES-03). É o mesmo no `ChipQueAbre` e na
 * `Prioridade` com `onAbrir`: quem abre um recorte não inventa outro gesto.
 */
const GESTO_DO_CARIMBO =
  "relative cursor-pointer after:absolute after:inset-x-0 after:-inset-y-[2px] after:content-[''] sublinhado-de-link transition-colors duration-cor focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"

/**
 * O marcador do estado neutro (CTRL-05): o ponto de 6px, na tinta do texto
 * (`PONTO_NO_CARIMBO`). Sem ele, o carimbo neutro e o
 * `Badge` são a mesma tinta no mesmo casco, e o estado se lê como valor. A voz
 * com matiz já se separa pela tinta; o em curso tem o giro no lugar.
 */
function PontoDoEstado() {
  return <span aria-hidden="true" data-slot="ponto-do-estado" className={cn("size-1.5 shrink-0 rounded-full", PONTO_NO_CARIMBO)} />
}

/**
 * O ESTADO em uma palavra (ANATOMIA PECA-01). Declara `tom` — a voz responde
 * *o que isto pede de você?* (COR-03) — e nunca uma classe de cor (COR-05).
 * O neutro abre com o ponto, que o `Badge` não tem (CTRL-05).
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
      {emCurso ? (
        <LoaderCircleIcon aria-hidden="true" className="size-3 animate-spin motion-reduce:animate-none" />
      ) : tom === "neutro" ? (
        <PontoDoEstado />
      ) : null}
      {children}
    </span>
  )
}

/**
 * O estado que ABRE o detalhe (PECA-01): o mesmo carimbo, como botão. O clique
 * leva ao que o estado resume (a pendência, a lista). O sublinhado do link
 * (`sublinhado-de-link`, CTRL-03) diz que ele abre; o foco tem o anel de
 * sempre (SUP-06). O neutro abre com o ponto, como o `ChipDeEstado`.
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
        GESTO_DO_CARIMBO,
        className
      )}
      {...props}
    >
      {tom === "neutro" ? <PontoDoEstado /> : null}
      {children}
    </button>
  )
}

export { ChipDeEstado, ChipQueAbre, CASCO_DO_CARIMBO, GESTO_DO_CARIMBO }
