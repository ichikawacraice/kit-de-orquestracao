import { Estado } from "@/components/ui/estado"

import { Amostra, Amostras } from "./_amostra"

export default function DemoDoPonto() {
  return (
    <Amostras>
      <Amostra titulo="O ponto com a palavra" primeira>
        <Estado tom="ok">Conferido</Estado>
        <Estado tom="espera">Aguarda você</Estado>
        <Estado tom="ruim">Falhou</Estado>
        <Estado tom="neutro">Rascunho</Estado>
        <Estado tom="alheio">Com outra equipe</Estado>
      </Amostra>
      <Amostra titulo="Só o ponto (a palavra fica para o leitor de tela)">
        <Estado tom="espera" soPonto>
          com pendência
        </Estado>
        <Estado tom="ok" soPonto>
          em dia
        </Estado>
      </Amostra>
    </Amostras>
  )
}
