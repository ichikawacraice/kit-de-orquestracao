"use client"

import * as React from "react"
import { Popover as PopoverPrimitive } from "radix-ui"

import { cn } from "@/registry/design-system/lib/utils"

/**
 * O POPOVER (ANATOMIA PECA-01: o detalhe sob demanda) — o que o clique num
 * carimbo ou num controle abre, colado a ele, na superfície flutuante: a frase
 * do que fazer depois de uma falha, o detalhe de uma pendência. Não é dica de
 * hover (CTRL-08): abre no clique e no teclado, e fecha no Esc.
 *
 * Cabe na tela (SUP-07): troca de lado quando falta espaço, para a 8px da
 * borda e, quando o conteúdo passa da altura que sobra, rola por dentro.
 *
 * Abre com `duration-menu-abre`, fecha com `duration-menu-fecha`, e para com
 * movimento reduzido (MOV-02).
 */
const Popover = PopoverPrimitive.Root

const PopoverTrigger = PopoverPrimitive.Trigger

const PopoverAnchor = PopoverPrimitive.Anchor

function PopoverContent({
  className,
  align = "start",
  sideOffset = 6,
  collisionPadding = 8,
  ...props
}: Omit<React.ComponentProps<typeof PopoverPrimitive.Content>, "avoidCollisions">) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        data-superficie
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          "superficie-flutuante z-50 max-h-(--radix-popover-content-available-height) w-72 overflow-x-hidden overflow-y-auto rounded-xl p-4 text-sm text-popover-foreground outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:duration-menu-abre data-[state=closed]:duration-menu-fecha data-[state=open]:ease-abre data-[state=closed]:ease-fecha motion-reduce:!animate-none",
          className
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}

export { Popover, PopoverAnchor, PopoverContent, PopoverTrigger }
