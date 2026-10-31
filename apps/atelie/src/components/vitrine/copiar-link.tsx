"use client"

import * as React from "react"
import { CheckIcon, LinkIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { COR_DO_TOM_DENSO } from "@/lib/idioma-de-cor"
import { cn } from "@/lib/utils"

/** Copia o endereço da regra (com a âncora) para citá-la num PR; o desfecho fica ao lado. */
export function CopiarLink({ ancora }: { ancora: string }) {
  const [desfecho, setDesfecho] = React.useState<"copiado" | "falhou" | null>(null)
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(`${location.origin}${location.pathname}#${ancora}`)
      setDesfecho("copiado")
    } catch {
      setDesfecho("falhou")
    }
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <Button variant="ghost" size="icon" aria-label={`Copiar o link de ${ancora}`} onClick={copiar}>
        {desfecho === "copiado" ? <CheckIcon /> : <LinkIcon />}
      </Button>
      <span role="status" className={cn("text-legenda", desfecho === "falhou" ? COR_DO_TOM_DENSO.ruim : COR_DO_TOM_DENSO.ok)}>
        {desfecho === "copiado" ? "Link copiado" : desfecho === "falhou" ? "O navegador não deixou copiar" : null}
      </span>
    </span>
  )
}
