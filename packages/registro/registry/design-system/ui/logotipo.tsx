import * as React from "react"

import { cn } from "@/registry/design-system/lib/utils"

/**
 * A marca Wicomm no casco e na tela de Entrada.
 *
 * **Provisória:** o desenho oficial da marca ainda não está no registro, e
 * logotipo não se desenha à mão (MARCA-04). Até o arquivo oficial chegar, a
 * peça escreve o nome em tinta e marca o ponto na cor da marca — a marca
 * desenha, não escreve (MARCA-02). A API não muda quando o desenho chegar: quem
 * usa continua passando só a `variante`.
 */
function Logotipo({
  variante = "horizontal",
  className,
}: {
  /** `simbolo`: a barra recolhida. `horizontal`: o nome inteiro. */
  variante?: "simbolo" | "horizontal"
  className?: string
}) {
  return (
    <span
      role="img"
      aria-label="Wicomm"
      data-slot="logotipo"
      data-variante={variante}
      className={cn("inline-flex items-baseline font-bold tracking-tight text-foreground text-[19px] leading-none", className)}
    >
      <span aria-hidden="true">{variante === "horizontal" ? "wicomm" : "w"}</span>
      <span aria-hidden="true" className="ml-0.5 inline-block size-1.5 rounded-full bg-marca-viva" />
    </span>
  )
}

export { Logotipo }
