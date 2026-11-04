import { Prioridade } from "@/components/ui/prioridade"

import { Amostra, Amostras } from "./_amostra"

export default function DemoDaPrioridade() {
  return (
    <Amostras>
      <Amostra titulo="Os níveis em forma; só a urgente ganha peso" primeira>
        <Prioridade nivel={0}>Sem prioridade</Prioridade>
        <Prioridade nivel={1}>Baixa</Prioridade>
        <Prioridade nivel={2}>Média</Prioridade>
        <Prioridade nivel={3}>Alta</Prioridade>
        <Prioridade nivel="urgente">Urgente</Prioridade>
      </Amostra>
    </Amostras>
  )
}
