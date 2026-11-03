"use client"

import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { ChipDeEstado, ChipQueAbre } from "@/components/ui/chip-de-estado"

import { Amostra, Amostras } from "./_amostra"

export default function DemoDoCarimbo() {
  const [aberto, setAberto] = React.useState(false)
  return (
    <Amostras>
      <Amostra titulo="As cinco vozes" primeira>
        <ChipDeEstado tom="ok">Conferido</ChipDeEstado>
        <ChipDeEstado tom="espera">Aguarda você</ChipDeEstado>
        <ChipDeEstado tom="ruim">Falhou</ChipDeEstado>
        <ChipDeEstado tom="neutro">Rascunho</ChipDeEstado>
        <ChipDeEstado tom="alheio">Com outra equipe</ChipDeEstado>
      </Amostra>
      <Amostra titulo="O neutro abre com o ponto: o valor ao lado não tem">
        <ChipDeEstado tom="neutro">Rascunho</ChipDeEstado>
        <Badge>Plano anual</Badge>
      </Amostra>
      <Amostra titulo="Numa coluna: o casco alinha, a palavra do neutro e do em curso anda">
        <span className="flex flex-col items-start gap-2">
          <ChipDeEstado tom="neutro">Rascunho</ChipDeEstado>
          <ChipDeEstado tom="espera">Aguarda você</ChipDeEstado>
          <ChipDeEstado tom="ruim">Falhou</ChipDeEstado>
          <ChipDeEstado tom="neutro" emCurso>
            Processando
          </ChipDeEstado>
        </span>
      </Amostra>
      <Amostra titulo="Em curso">
        <ChipDeEstado tom="neutro" emCurso>
          Processando
        </ChipDeEstado>
      </Amostra>
      <Amostra titulo="O carimbo que abre">
        <ChipQueAbre tom="espera" aberto={aberto} onAbrir={() => setAberto((a) => !a)}>
          1 pendência
        </ChipQueAbre>
        <ChipQueAbre tom="neutro" onAbrir={() => {}}>
          2 rascunhos
        </ChipQueAbre>
        <span role="status" className="text-sm text-foreground-2">
          {aberto ? "Pendência aberta." : "Fechado."}
        </span>
      </Amostra>
    </Amostras>
  )
}
