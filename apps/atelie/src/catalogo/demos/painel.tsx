"use client"

import { Painel, PainelDeSecao, RolagemDoPainel } from "@/components/ui/painel"
import { TopoDoPainel } from "@/components/ui/secao"

const LINHAS = ["Pedido 1042", "Pedido 1043", "Pedido 1044", "Pedido 1045", "Pedido 1046", "Pedido 1047", "Pedido 1048"]

export default function DemoDoPainel() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Painel className="h-64">
        <TopoDoPainel titulo="Fila" />
        <RolagemDoPainel>
          <ul className="flex flex-col gap-1 text-sm">
            {LINHAS.map((l) => (
              <li key={l} className="rounded-lg px-2 py-2 hover:bg-accent">
                {l}
              </li>
            ))}
          </ul>
        </RolagemDoPainel>
      </Painel>
      <PainelDeSecao titulo="Resumo" contagem={LINHAS.length} nivel={2}>
        <p className="text-sm text-foreground-2">A seção em painel: título e conteúdo numa peça só.</p>
      </PainelDeSecao>
    </div>
  )
}
