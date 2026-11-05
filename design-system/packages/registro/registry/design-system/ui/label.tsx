"use client"

import * as React from "react"
import { Label as LabelPrimitive } from "radix-ui"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/registry/design-system/lib/utils"

/**
 * O rótulo de campo, em três vozes — e quem escolhe é o papel (TIPO-02).
 *
 * - `rotulo` (o padrão): a voz `t-rotulo` — 10,5px, negrito, maiúsculas
 *   espaçadas, tinta-2. É a voz que também nomeia as seções: o rótulo
 *   apresenta o campo em vez de disputar com ele.
 * - `coluna`: a voz `t-coluna` — a que nomeia um valor que se repete, mais
 *   leve que o rótulo: o *De* e o *Até* sob a legenda de um intervalo.
 * - `campo`: a voz `t-campo` — 13px, 500, sem maiúsculas. Para formulário cujo
 *   rótulo é texto que outra pessoa vai ler (o rótulo é conteúdo, não etiqueta).
 *
 * A voz TROCA a classe em vez de empilhar duas: com as duas, quem ganharia
 * é a ordem do CSS, não quem chamou.
 */
const labelVariants = cva(
  "peer-disabled:cursor-not-allowed peer-disabled:opacity-70 group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-70",
  {
    variants: {
      voz: {
        rotulo: "t-rotulo leading-none",
        coluna: "t-coluna leading-none",
        campo: "t-campo",
      },
    },
    defaultVariants: { voz: "rotulo" },
  }
)

function Label({
  className,
  voz,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root> & VariantProps<typeof labelVariants>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(labelVariants({ voz }), className)}
      {...props}
    />
  )
}

export { Label, labelVariants }
