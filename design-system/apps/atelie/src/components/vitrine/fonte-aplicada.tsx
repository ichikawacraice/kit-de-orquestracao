"use client"

import * as React from "react"

import { COR_DO_TOM_DENSO } from "@/lib/idioma-de-cor"

/**
 * A fonte se confere no navegador (MED-01): se a Archivo não carregou, a página
 * inteira está na reserva, e quem lê precisa saber antes de julgar o tipo.
 * Carregada, nada aparece.
 */
export function FonteAplicada() {
  const [carregou, setCarregou] = React.useState<boolean | null>(null)
  React.useEffect(() => {
    let vivo = true
    document.fonts.ready
      .then(() => vivo && setCarregou(document.fonts.check('16px "Archivo Variable"')))
      .catch(() => vivo && setCarregou(false))
    return () => {
      vivo = false
    }
  }, [])
  if (carregou !== false) return null
  return (
    <p role="status" className={`t-denso ${COR_DO_TOM_DENSO.ruim}`}>
      Esta página caiu na fonte de reserva: a Archivo não carregou.
    </p>
  )
}
