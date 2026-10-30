import * as React from "react"

import { cn } from "@/registry/wicomm/lib/utils"

/**
 * Pares rótulo/valor (ANATOMIA PECA-01) — no lugar da tabela de duas colunas.
 * É um `<dl>` em grade: o rótulo na voz `t-coluna` (nomeia um valor que se
 * repete, TIPO-02), o valor em `t-denso`.
 */
function Ficha({ className, ...props }: React.ComponentProps<"dl">) {
  return (
    <dl
      data-slot="ficha"
      className={cn("grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] items-baseline gap-x-6 gap-y-2.5", className)}
      {...props}
    />
  )
}

/**
 * Um par. `mono`: o valor se compara com outro número (TIPO-03). Valor ausente
 * (`null`/`undefined`) diz *não informado*, em neutro — vazio diz a causa
 * (EST-02); a causa diferente (*não se aplica*) quem usa escreve.
 */
function ParDaFicha({
  rotulo,
  mono = false,
  children,
}: {
  rotulo: string
  mono?: boolean
  children?: React.ReactNode
}) {
  const vazio = children === null || children === undefined || children === ""
  return (
    <>
      <dt data-slot="rotulo-da-ficha" className="t-coluna">
        {rotulo}
      </dt>
      <dd data-slot="valor-da-ficha" className={cn(vazio ? "t-denso text-muted-foreground" : mono ? "t-medida text-foreground" : "t-denso text-foreground")}>
        {vazio ? "não informado" : children}
      </dd>
    </>
  )
}

export { Ficha, ParDaFicha }
