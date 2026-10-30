"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { TelaDeErro } from "@/components/ui/tela-de-erro"

import { Amostra, Amostras } from "./_amostra"

export default function DemoDaTelaDeErro() {
  const [tentativas, setTentativas] = React.useState(0)
  return (
    <div className="flex flex-col gap-4">
      <Amostras>
        <Amostra titulo="No bloco" primeira>
          <TelaDeErro escala="bloco" onTentarDeNovo={() => setTentativas((t) => t + 1)}>
            Não deu para carregar os itens.{tentativas ? ` Tentativas: ${tentativas}.` : ""}
          </TelaDeErro>
        </Amostra>
      </Amostras>
      <TelaDeErro
        escala="rota"
        tipo="sem-permissao"
        titulo="Pedidos"
        saida={
          <Button variant="outline" size="sm">
            Voltar ao início
          </Button>
        }
      >
        Esta conta não vê os pedidos. Fale com quem administra.
      </TelaDeErro>
    </div>
  )
}
