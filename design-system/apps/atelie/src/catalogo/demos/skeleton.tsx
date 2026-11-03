"use client"

import { EsperaDaLista, Skeleton } from "@/components/ui/skeleton"

import { Amostra, Amostras } from "./_amostra"

export default function DemoDoEsqueleto() {
  return (
    <Amostras>
      <Amostra titulo="A caixa da espera" primeira>
        <div className="flex w-full max-w-sm flex-col gap-2">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-4" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      </Amostra>
      <Amostra titulo="A espera de uma lista">
        <EsperaDaLista linhas={3} alturaDaLinha="h-10" rotulo="Os pedidos da semana" className="w-full max-w-sm" />
      </Amostra>
    </Amostras>
  )
}
