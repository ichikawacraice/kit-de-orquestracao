import { Logotipo } from "@/components/ui/logotipo"

import { Amostra, Amostras } from "./_amostra"

export default function DemoDoLogotipo() {
  return (
    <Amostras>
      <Amostra titulo="Horizontal, na barra aberta e na Entrada" primeira>
        <Logotipo variante="horizontal" />
      </Amostra>
      <Amostra titulo="Símbolo, na barra recolhida">
        <Logotipo variante="simbolo" />
      </Amostra>
    </Amostras>
  )
}
