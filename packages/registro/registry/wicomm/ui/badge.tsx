import * as React from "react"

import { BADGE_DO_TOM, TINTA_DO_CARIMBO_NEUTRO } from "@/registry/wicomm/lib/idioma-de-cor"
import { cn } from "@/registry/wicomm/lib/utils"
import { CASCO_DO_CARIMBO } from "@/registry/wicomm/ui/chip-de-estado"

/**
 * O filete da marca (CTRL-05): 2×10px no gradiente da marca, antes da palavra —
 * a 2px, o olho lê um traço vermelho; o que separa é a forma e o lugar.
 * O vermelho da marca e o de erro só se separam pela forma (MARCA-02): o selo
 * de marca fica na tinta neutra, e o gradiente é a assinatura que nenhuma voz
 * tem (MARCA-03).
 */
function FileteDaMarca() {
  return <span aria-hidden="true" data-slot="filete-da-marca" className="h-2.5 w-0.5 shrink-0 rounded-full bg-primary-gradient" />
}

/**
 * Um VALOR rotulado — o que classifica um objeto (o plano, a origem), não um
 * estado (DESIGN CTRL-05; ANATOMIA PECA-01). O estado é o `ChipDeEstado`, que
 * declara `tom`; o `Badge` não tem voz.
 *
 * O casco é o do carimbo, um só (raio, padding, tamanho e tinta não são escolha
 * de quem usa):
 * - `neutro` (o padrão): a tinta neutra do carimbo, com o alfa medido (COR-07);
 * - `marca`, explícito e raro — o valor que a Wicomm assina, no máximo um por
 *   vista: a tinta neutra com texto em tinta, aberta pelo filete da marca
 *   (`FileteDaMarca`). A tinta rosa da marca era a do carimbo `ruim`, e a tinta
 *   do carimbo responde *o que isto pede de você?* (COR-08).
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
      className={cn(CASCO_DO_CARIMBO, variant === "marca" ? cn(TINTA_DO_CARIMBO_NEUTRO, "text-foreground") : BADGE_DO_TOM.neutro, className)}
      {...props}
    >
      {variant === "marca" ? <FileteDaMarca /> : null}
      {children}
    </span>
  )
}

export { Badge }
