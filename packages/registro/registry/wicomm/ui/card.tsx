import * as React from "react"

import { cn } from "@/registry/wicomm/lib/utils"

/**
 * O cartão: a PEÇA (DESIGN SUP-01) — superfície opaca de cartão, levantada por
 * sombra baixa, sem contorno desenhado (FORMA-03), raio de container (FORMA-01).
 *
 * O `data-superficie` não é decoração: é por ele que as guardas de composição
 * reconhecem quem fornece superfície (SUP-04). Peça dentro de peça é o que o
 * sistema proíbe — dentro do cartão, o assunto se separa por degrau de tinta
 * (`BlocoDeTinta`) ou por ar (`Secao`).
 */
function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      data-superficie
      className={cn("superficie h-fit rounded-2xl text-card-foreground", className)}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-header" className={cn("flex flex-col gap-1.5 p-6", className)} {...props} />
}

/**
 * O nome do cartão, na voz de título (TIPO-02). É `div`, não `h*`: o nível do
 * cabeçalho depende de onde o cartão mora, então quem monta a tela põe o `h2`
 * ou `h3` dentro dele.
 */
function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-title" className={cn("t-titulo text-foreground", className)} {...props} />
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-description" className={cn("text-[13px] text-muted-foreground", className)} {...props} />
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("p-6 pt-0", className)} {...props} />
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-footer" className={cn("flex items-center gap-2 p-6 pt-0", className)} {...props} />
}

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle }
