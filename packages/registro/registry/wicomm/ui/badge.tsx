import * as React from "react"

import { BADGE_DO_TOM } from "@/registry/wicomm/lib/idioma-de-cor"
import { cn } from "@/registry/wicomm/lib/utils"
import { CASCO_DO_CARIMBO } from "@/registry/wicomm/ui/chip-de-estado"

/**
 * Um VALOR rotulado — o que classifica um objeto (o plano, a origem), não um
 * estado (DESIGN CTRL-05; ANATOMIA PECA-01). O estado é o `ChipDeEstado`, que
 * declara `tom`; o `Badge` não tem voz.
 *
 * O casco é o do carimbo, um só (raio, padding, tamanho e tinta não são escolha
 * de quem usa):
 * - `neutro` (o padrão): a tinta neutra do carimbo, com o alfa medido (COR-07);
 * - `marca`, explícito e raro — o valor que a Wicomm assina, no máximo um por
 *   vista: a tinta opaca da marca com texto em tinta (MARCA-02: sobre tinta da
 *   marca, escreve-se tinta).
 *
 * Sem hover nem foco: não é botão. Sem valor, não desenha.
 */
function Badge({
  variant = "neutro",
  className,
  children,
  ...props
}: React.ComponentProps<"span"> & { variant?: "neutro" | "marca" }) {
  if (children === null || children === undefined || children === "") return null
  return (
    <span
      data-slot="badge"
      data-variant={variant}
      className={cn(CASCO_DO_CARIMBO, variant === "marca" ? "bg-marca-tinta text-foreground" : BADGE_DO_TOM.neutro, className)}
      {...props}
    >
      {children}
    </span>
  )
}

export { Badge }
