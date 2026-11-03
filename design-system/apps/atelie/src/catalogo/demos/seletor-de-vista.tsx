"use client"

import * as React from "react"

import { BarraDeModos } from "@/components/ui/seletor-de-vista"

import { Amostra, Amostras } from "./_amostra"

const FILAS = [
  { chave: "pedem-voce", rotulo: "Pedem você", numero: 3, tom: "espera" as const },
  { chave: "com-outros", rotulo: "Com outros", numero: 2 },
  { chave: "andando", rotulo: "Andando", numero: null },
  { chave: "concluidos", rotulo: "Concluídos", numero: 0 },
]

const VISTAS = [
  { chave: "lista", rotulo: "Lista" },
  { chave: "quadro", rotulo: "Quadro" },
]

export default function DemoDoSeletor() {
  const [fila, setFila] = React.useState("pedem-voce")
  const [vista, setVista] = React.useState("lista")
  return (
    <Amostras>
      <Amostra titulo="Abas: a fila da tela" primeira>
        <BarraDeModos rotulo="Fila" densidade="abas" modos={FILAS} valor={fila} onTrocar={setFila} />
      </Amostra>
      <Amostra titulo="Modos: a vista do mesmo conteúdo">
        <BarraDeModos rotulo="Vista" modos={VISTAS} valor={vista} onTrocar={setVista} />
      </Amostra>
    </Amostras>
  )
}
