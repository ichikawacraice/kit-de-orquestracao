import { PontoDaEtapa } from "../etapas-de-exemplo"

import { Amostra, Amostras } from "./_amostra"

export default function DemoDoPontoDaEtapa() {
  return (
    <Amostras>
      <Amostra titulo="O ponto e o nome" primeira>
        <PontoDaEtapa etapa="entrada">Entrada</PontoDaEtapa>
        <PontoDaEtapa etapa="andamento">Em andamento</PontoDaEtapa>
        <PontoDaEtapa etapa="revisao">Revisão</PontoDaEtapa>
      </Amostra>
      <Amostra titulo="Etapa que o mapa não conhece: o ponto fica neutro">
        <PontoDaEtapa etapa="arquivo">Arquivo</PontoDaEtapa>
      </Amostra>
    </Amostras>
  )
}
