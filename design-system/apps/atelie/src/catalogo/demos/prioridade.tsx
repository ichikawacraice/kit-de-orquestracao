"use client"

import { ChipDeEstado, ChipQueAbre } from "@/components/ui/chip-de-estado"
import { Prioridade } from "@/components/ui/prioridade"

import { Amostra, Amostras } from "./_amostra"

export default function DemoDaPrioridade() {
  return (
    <Amostras>
      <Amostra titulo="O nível na forma e na cor; só a urgente ganha a tinta, e a Alta não se confunde com o estado ruim" primeira>
        <Prioridade nivel={0}>Sem prioridade</Prioridade>
        <Prioridade nivel={1}>Baixa</Prioridade>
        <Prioridade nivel={2}>Média</Prioridade>
        <Prioridade nivel={3}>Alta</Prioridade>
        <Prioridade nivel="urgente">Urgente</Prioridade>
        <ChipDeEstado tom="ruim">Atrasada</ChipDeEstado>
      </Amostra>
      <Amostra titulo="A contagem que recorta: cada nível aplica o filtro; o zero guarda a forma, sem a cor">
        <ChipQueAbre tom="espera" onAbrir={() => {}}>
          15 pendentes
        </ChipQueAbre>
        <div role="group" aria-label="Por prioridade" className="flex items-center gap-1.5">
          <Prioridade nivel={3} onAbrir={() => {}}>
            3 altas
          </Prioridade>
          <Prioridade nivel={2} zerada>
            0 médias
          </Prioridade>
          <Prioridade nivel={1} onAbrir={() => {}}>
            7 baixas
          </Prioridade>
        </div>
      </Amostra>
    </Amostras>
  )
}
