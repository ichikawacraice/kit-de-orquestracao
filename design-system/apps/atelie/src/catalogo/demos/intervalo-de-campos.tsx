"use client"

import * as React from "react"

import { IntervaloDeCampos } from "@/components/ui/intervalo-de-campos"

import { Amostra, Amostras } from "./_amostra"

function Intervalo({
  inicial,
  ...props
}: Omit<React.ComponentProps<typeof IntervaloDeCampos>, "valor" | "aoMudar"> & { inicial: { de: string; ate: string } }) {
  const [valor, setValor] = React.useState(inicial)
  return <IntervaloDeCampos {...props} valor={valor} aoMudar={(lado, v) => setValor((atual) => ({ ...atual, [lado]: v }))} />
}

export default function DemoDoIntervaloDeCampos() {
  return (
    <Amostras>
      <Amostra titulo="Datas, na largura do popover (instrumento)" primeira>
        <div className="w-64">
          <Intervalo legenda="Prazo" tipo="date" inicial={{ de: "2026-11-02", ate: "" }} />
        </div>
      </Amostra>
      <Amostra titulo="Valores, com a unidade na legenda">
        <div className="w-64">
          <Intervalo legenda="Valor (R$)" tipo="number" min="0" inicial={{ de: "100", ate: "500" }} />
        </div>
      </Amostra>
      <Amostra titulo="Com erro no lado do Até">
        <div className="w-64">
          <Intervalo
            legenda="Prazo"
            tipo="date"
            inicial={{ de: "2026-11-20", ate: "2026-11-10" }}
            erro={{ lado: "ate", texto: "O Até vem depois do De." }}
          />
        </div>
      </Amostra>
      <Amostra titulo="Rótulos trocados (Início, Término)">
        <div className="w-64">
          <Intervalo legenda="Período da entrega" tipo="date" rotulos={{ de: "Início", ate: "Término" }} inicial={{ de: "", ate: "" }} />
        </div>
      </Amostra>
      <Amostra titulo="Densidade site: legenda e rótulos na voz campo">
        <div className="w-72">
          <Intervalo legenda="Prazo" tipo="date" densidade="site" inicial={{ de: "", ate: "" }} />
        </div>
      </Amostra>
    </Amostras>
  )
}
