import * as React from "react"

import { Card, CardContent } from "@/components/ui/card"
import { Secao } from "@/components/ui/secao"

/**
 * A moldura de uma demonstração: as variações de uma peça, cada uma numa seção
 * com o nome dela, dentro de um cartão (o conteúdo mora em superfície). Peça
 * que já É superfície (cartão, painel, bloco) se mostra sem esta moldura.
 */
export function Amostras({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex flex-col pt-6">{children}</CardContent>
    </Card>
  )
}

export function Amostra({
  titulo,
  primeira = false,
  children,
}: {
  titulo: string
  primeira?: boolean
  children: React.ReactNode
}) {
  return (
    <Secao titulo={titulo} primeira={primeira} nivel={2}>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </Secao>
  )
}
