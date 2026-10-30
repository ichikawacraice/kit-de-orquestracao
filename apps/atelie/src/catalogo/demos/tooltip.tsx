"use client"

import { HistoryIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Ajuda } from "@/components/ui/tooltip"

import { Amostra, Amostras } from "./_amostra"

export default function DemoDaDica() {
  return (
    <Amostras>
      <Amostra titulo="Ajuda no controle" primeira>
        <Ajuda texto="Abre o histórico de mudanças">
          <Button variant="outline" size="icon" aria-label="Histórico">
            <HistoryIcon />
          </Button>
        </Ajuda>
        <Ajuda texto="Envia para aprovação" lado="right">
          <Button variant="secondary">Enviar</Button>
        </Ajuda>
      </Amostra>
    </Amostras>
  )
}
