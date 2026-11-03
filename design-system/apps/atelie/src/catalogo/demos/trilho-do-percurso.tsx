"use client"

import * as React from "react"

import { TrilhoDoPercurso } from "@/components/ui/trilho-do-percurso"

import { Amostra, Amostras } from "./_amostra"

export default function DemoDoTrilho() {
  const [aberta, setAberta] = React.useState("conferencia")
  return (
    <Amostras>
      <Amostra titulo="O percurso do pedido" primeira>
        <TrilhoDoPercurso
          estacoes={[
            { chave: "recebido", nome: "Recebido", situacao: "feita" },
            { chave: "conferencia", nome: "Conferência", situacao: "atual", palavra: "aguarda você", tom: "espera" },
            { chave: "pagamento", nome: "Pagamento", situacao: "a-frente" },
            { chave: "envio", nome: "Envio", situacao: "a-frente" },
          ]}
          aberta={aberta}
          onAbrir={setAberta}
        />
      </Amostra>
      <Amostra titulo="Uma estação que falhou">
        <TrilhoDoPercurso
          estacoes={[
            { chave: "recebido", nome: "Recebido", situacao: "feita" },
            { chave: "pagamento", nome: "Pagamento", situacao: "falhou", palavra: "recusado", tom: "ruim" },
            { chave: "envio", nome: "Envio", situacao: "a-frente" },
          ]}
          aberta="pagamento"
          onAbrir={() => {}}
        />
      </Amostra>
    </Amostras>
  )
}
