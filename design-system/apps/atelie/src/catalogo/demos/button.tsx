"use client"

import { PlusIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useConfirm } from "@/components/ui/confirm-dialog"

import { Amostra, Amostras } from "./_amostra"

export default function DemoDoBotao() {
  const [confirmacao, pedir] = useConfirm()
  return (
    <Amostras>
      <Amostra titulo="Variantes" primeira>
        <Button>Salvar</Button>
        <Button variant="secondary">Duplicar</Button>
        <Button variant="outline">Exportar</Button>
        <Button variant="ghost">Histórico</Button>
        <Button variant="destructive" onClick={() => pedir({ titulo: "Excluir o rascunho?", confirmar: "Excluir", destrutivo: true })}>
          <Trash2Icon />
          Excluir
        </Button>
        <Button variant="link">Ver detalhes</Button>
      </Amostra>
      <Amostra titulo="Escala">
        <Button size="sm">Pequeno</Button>
        <Button>Padrão</Button>
        <Button size="lg">Grande</Button>
        <Button size="xl">Entrar</Button>
        <Button size="icon" variant="outline" aria-label="Novo">
          <PlusIcon />
        </Button>
      </Amostra>
      <Amostra titulo="Desabilitado">
        <Button disabled>Publicar</Button>
        <Button variant="secondary" disabled>
          Duplicar
        </Button>
      </Amostra>
      {confirmacao}
    </Amostras>
  )
}
