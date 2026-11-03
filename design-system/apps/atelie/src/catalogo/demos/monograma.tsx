import { Monograma, MonogramaAusente } from "@/components/ui/monograma"

import { Amostra, Amostras } from "./_amostra"

export default function DemoDoMonograma() {
  return (
    <Amostras>
      <Amostra titulo="As iniciais, em tinta neutra" primeira>
        <Monograma nome="Ana Souza" />
        <Monograma nome="Bruno Lima" />
        <Monograma nome="Carla" />
      </Amostra>
      <Amostra titulo="A pessoa que não há">
        <MonogramaAusente />
      </Amostra>
    </Amostras>
  )
}
