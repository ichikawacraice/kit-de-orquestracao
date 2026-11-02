"use client"

import * as React from "react"
import { Tooltip as TooltipPrimitive } from "radix-ui"

import { cn } from "@/registry/design-system/lib/utils"

/**
 * A dica do produto, no lugar do atributo `title` nativo.
 *
 * O `title` é do navegador: demora ~1s, não tem a tipografia nem a cor do
 * produto, some ao mover o mouse, não abre no teclado e não existe no toque.
 * Quando o `title` carrega o que um botão vai fazer ou por que está
 * desabilitado, deixar isso com o navegador é perder a explicação.
 *
 * Superfície flutuante (SUP-01), raio de dica (10px, FORMA-01), movimento de
 * dica (MOV-01). Cabe na tela como todo flutuante (SUP-07). `Ajuda` é o atalho do caso comum — um gatilho, um texto.
 */
function TooltipProvider({ delayDuration = 200, ...props }: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return <TooltipPrimitive.Provider data-slot="tooltip-provider" delayDuration={delayDuration} {...props} />
}

function Tooltip(props: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

function TooltipTrigger(props: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  sideOffset = 6,
  collisionPadding = 8,
  ...props
}: Omit<React.ComponentProps<typeof TooltipPrimitive.Content>, "avoidCollisions">) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        data-superficie
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          "superficie-flutuante z-50 max-h-(--radix-tooltip-content-available-height) max-w-xs overflow-x-hidden overflow-y-auto rounded-lg px-2.5 py-1.5 text-xs text-popover-foreground",
          "data-[state=delayed-open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:duration-dica data-[state=closed]:duration-dica data-[state=delayed-open]:ease-abre data-[state=closed]:ease-fecha motion-reduce:!animate-none",
          className
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  )
}

/**
 * Um gatilho, um texto. O gatilho é `asChild`: o filho (um `Button`) é o
 * gatilho, sem um botão dentro de outro.
 *
 * O provider mora AQUI dentro, e não só no layout: componente que quebra porque
 * alguém esqueceu um provider lá em cima é armadilha. Provider aninhado é
 * suportado; o preço é perder o atraso compartilhado entre dicas vizinhas.
 */
function Ajuda({
  texto,
  children,
  lado = "top",
  aberto,
  aoMudarAberto,
}: {
  texto: string
  children: React.ReactNode
  lado?: "top" | "right" | "bottom" | "left"
  /** Controlado, para quem abre também por toque (o hover não existe lá). */
  aberto?: boolean
  aoMudarAberto?: (aberto: boolean) => void
}) {
  return (
    <TooltipProvider>
      <Tooltip open={aberto} onOpenChange={aoMudarAberto}>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={lado}>{texto}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export { Ajuda, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger }
