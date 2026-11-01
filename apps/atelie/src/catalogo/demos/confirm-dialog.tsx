"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { classeDoCampo } from "@/components/ui/input"

import { Amostra, Amostras } from "./_amostra"

const esperar = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

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
      <Amostra titulo="A ação roda com o diálogo aberto">
        <Button
          variant="destructive"
          onClick={async () => {
            const sim = await pedir({
              titulo: "Excluir o projeto?",
              descricao: "O projeto e as tarefas dele saem para todo mundo e não voltam.",
              confirmar: "Excluir",
              destrutivo: true,
              rotuloRodando: "Excluindo",
              onConfirmar: () => esperar(1500),
            })
            setDesfecho(sim ? "Projeto excluído." : "Mantido.")
          }}
        >
          Excluir, e dá certo
        </Button>
        <Button
          variant="destructive"
          onClick={async () => {
            let vez = 0
            const sim = await pedir({
              titulo: "Excluir a tarefa?",
              descricao: "A tarefa sai daqui e do quadro da equipe.",
              confirmar: "Excluir",
              destrutivo: true,
              rotuloRodando: "Excluindo",
              onConfirmar: async () => {
                await esperar(1000)
                if (vez++ === 0) throw new Error("409")
              },
              descreverErro: () => "Outra pessoa mudou esta tarefa agora há pouco. Tente de novo para excluir a versão nova.",
            })
            setDesfecho(sim ? "Tarefa excluída na segunda tentativa." : "Mantida.")
          }}
        >
          Falha, e depois dá certo
        </Button>
        <Button
          variant="secondary"
          onClick={async () => {
            const sim = await pedir({
              titulo: "Publicar agora?",
              descricao: "A versão vai ao ar para todos os clientes.",
              confirmar: "Publicar",
              rotuloRodando: "Publicando",
              onConfirmar: async () => {
                await esperar(1000)
                throw new Error("ECONNRESET")
              },
            })
            setDesfecho(sim ? "Publicado." : "Não publicado.")
          }}
        >
          Falha sem frase própria
        </Button>
        <Button
          variant="secondary"
          onClick={async () => {
            const sim = await pedir({
              titulo: "Reprocessar o relatório?",
              descricao: "Os números do mês são calculados de novo.",
              confirmar: "Reprocessar",
              rotuloRodando: "Reprocessando",
              esperaMaxima: 3000,
              onConfirmar: () => esperar(6000),
            })
            setDesfecho(sim ? "Reprocessado, depois da espera." : "Não reprocessado.")
          }}
        >
          Passa da espera
        </Button>
        <Button
          variant="secondary"
          onClick={async () => {
            const sim = await pedir({
              titulo: "Recusar o pedido?",
              descricao: "O cliente recebe o motivo por e-mail.",
              corpo: <textarea aria-label="Motivo da recusa" defaultValue="Fora do prazo de troca." className={`${classeDoCampo()} h-20`} />,
              confirmar: "Recusar",
              rotuloRodando: "Recusando",
              onConfirmar: () => esperar(2000),
            })
            setDesfecho(sim ? "Pedido recusado." : "Não recusado.")
          }}
        >
          Com campo no corpo
        </Button>
      </Amostra>
      <p role="status" className="pt-4 text-sm text-foreground-2">
        {desfecho}
      </p>
      {confirmacao}
    </Amostras>
  )
}
