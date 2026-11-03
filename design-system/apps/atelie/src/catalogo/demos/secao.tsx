"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Secao, TopoDoPainel } from "@/components/ui/secao"

export default function DemoDaSecao() {
  return (
    <Card className="max-w-lg">
      <TopoDoPainel titulo="Configurações" />
      <CardContent className="flex flex-col">
        <Secao titulo="Notificações" primeira contagem="3/5" nivel={2}>
          <p className="text-sm text-foreground-2">Cada assunto se separa do outro pelo ar e pelo rótulo.</p>
        </Secao>
        <Secao titulo="Acesso" nivel={2} acao={<Button size="sm" variant="ghost">Convidar</Button>}>
          <p className="text-sm text-foreground-2">A ação da seção mora na linha do rótulo.</p>
        </Secao>
      </CardContent>
    </Card>
  )
}
