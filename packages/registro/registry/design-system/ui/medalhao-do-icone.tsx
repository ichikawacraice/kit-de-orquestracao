import * as React from "react"

import { COR_DO_TOM_DENSO, TINTA_DO_TOM, type Tom } from "@/registry/design-system/lib/idioma-de-cor"
import { cn } from "@/registry/design-system/lib/utils"

type IconeDoMedalhao = React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>

const TAMANHO = {
  sm: { disco: "size-7", icone: "size-3.5" },
  md: { disco: "size-10", icone: "size-[18px]" },
} as const

/**
 * O assunto de uma janela ou de um item, antes da leitura (ANATOMIA PECA-01):
 * o disco com o ícone. `md` no cabeçalho (tela de erro, diálogo), `sm` no item
 * (o vazio). Neutro por padrão; `tom` só quando a tela diz erro, ausência ou
 * recusa. É enfeite do título que vem ao lado: `aria-hidden`.
 */
function MedalhaoDoIcone({
  icone: Icone,
  tamanho = "sm",
  tom = "neutro",
  className,
}: {
  icone: IconeDoMedalhao
  tamanho?: keyof typeof TAMANHO
  tom?: Tom
  className?: string
}) {
  const t = TAMANHO[tamanho]
  return (
    <span
      data-slot="medalhao-do-icone"
      data-tom={tom}
      aria-hidden="true"
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full", t.disco, TINTA_DO_TOM[tom], className)}
    >
      <Icone aria-hidden="true" className={cn(t.icone, tom === "neutro" ? "text-foreground-2" : COR_DO_TOM_DENSO[tom])} />
    </span>
  )
}

export { MedalhaoDoIcone }
