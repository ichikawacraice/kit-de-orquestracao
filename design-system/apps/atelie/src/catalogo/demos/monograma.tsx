import { Monograma, MonogramaAusente } from "@/components/ui/monograma"

import { Amostra, Amostras } from "./_amostra"
import { PESSOAS } from "./_pessoas"

/** Uma pessoa de cada família, pelo id (COR-09). */
const UMA_DE_CADA = [
  "Carla Dias",
  "Davi Melo",
  "Helena Prado",
  "Eva Reis",
  "Júlia Campos",
  "Bruno Lima",
  "Igor Matos",
  "Ana Souza",
] as const

export default function DemoDoMonograma() {
  return (
    <Amostras>
      <Amostra titulo="As iniciais na cor da pessoa: as 8 famílias" primeira>
        {UMA_DE_CADA.map((nome) => (
          <Monograma key={nome} nome={nome} chave={PESSOAS[nome]} />
        ))}
      </Amostra>
      <Amostra titulo="Sem id: a tinta neutra">
        <Monograma nome="Ana Souza" chave={null} />
        <Monograma nome="Carla" chave={null} />
      </Amostra>
      <Amostra titulo="A pessoa que não há">
        <MonogramaAusente />
      </Amostra>
    </Amostras>
  )
}
