"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { useConfirm } from "@/components/ui/confirm-dialog"

import { Amostra, Amostras } from "./_amostra"

export default function DemoDaConfirmacao() {
  const [confirmacao, pedir] = useConfirm()
  const [desfecho, setDesfecho] = React.useState("Nada confirmado ainda.")
  return (
    <Amostras>
      <Amostra titulo="Destrutiva" primeira>
        <Button
          variant="destructive"
          onClick={async () => {
            const sim = await pedir({
              titulo: "Excluir o relatório?",
              descricao: "O relatório sai da lista de todo mundo e não volta.",
              confirmar: "Excluir",
              destrutivo: true,
            })
            setDesfecho(sim ? "Excluído." : "Mantido.")
          }}
        >
          Excluir
        </Button>
      </Amostra>
      <Amostra titulo="Com alternativa branda">
        <Button
          variant="secondary"
          onClick={async () => {
            const sim = await pedir({
              titulo: "Encerrar o atendimento?",
              descricao: "O cliente recebe a pesquisa de satisfação.",
              confirmar: "Encerrar",
              alternativa: { rotulo: "Só pausar", onEscolher: () => setDesfecho("Pausado.") },
            })
            if (sim) setDesfecho("Encerrado.")
          }}
        >
          Encerrar
        </Button>
      </Amostra>
      <p role="status" className="pt-4 text-sm text-foreground-2">
        {desfecho}
      </p>
      {confirmacao}
    </Amostras>
  )
}
