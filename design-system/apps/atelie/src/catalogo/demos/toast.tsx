"use client"

import { Button } from "@/components/ui/button"
import { ToastProvider, useToast } from "@/components/ui/toast"

import { Amostra, Amostras } from "./_amostra"

function Gatilhos() {
  const avisar = useToast()
  return (
    <Amostras>
      <Amostra titulo="As três vozes do desfecho" primeira>
        <Button variant="secondary" onClick={() => avisar({ titulo: "Relatório enviado", tom: "ok" })}>
          Aviso ok
        </Button>
        <Button variant="secondary" onClick={() => avisar({ titulo: "Exportação na fila", descricao: "Chega por e-mail." })}>
          Aviso neutro
        </Button>
        <Button
          variant="secondary"
          onClick={() => avisar({ titulo: "O envio falhou", descricao: "Fica aqui até ser fechado.", tom: "ruim" })}
        >
          Aviso de erro
        </Button>
      </Amostra>
    </Amostras>
  )
}

export default function DemoDoAviso() {
  return (
    <ToastProvider>
      <Gatilhos />
    </ToastProvider>
  )
}
