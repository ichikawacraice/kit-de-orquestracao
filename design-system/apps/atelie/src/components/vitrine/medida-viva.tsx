"use client"

import * as React from "react"

/**
 * O valor que o navegador calculou para uma propriedade do elemento irmão
 * anterior (MED-01): o raio, a altura. Antes de montar, o declarado; se o
 * medido for igual, nada pisca.
 */
export function MedidaViva({ propriedade, declarado }: { propriedade: "border-top-left-radius" | "height" | "max-width"; declarado: string }) {
  const ref = React.useRef<HTMLSpanElement>(null)
  const [medido, setMedido] = React.useState(declarado)
  React.useEffect(() => {
    const alvo = ref.current?.previousElementSibling
    if (!alvo) return
    const v = getComputedStyle(alvo).getPropertyValue(propriedade)
    if (!v) return
    // O raio de pílula é um número enorme por construção: o que importa é que é pílula.
    setMedido(Number.parseFloat(v) > 9999 ? "pílula" : v.replace(/\.\d+px$/, "px"))
  }, [propriedade])
  return (
    <span ref={ref} className="t-medida text-legenda text-muted-foreground">
      {medido}
    </span>
  )
}
