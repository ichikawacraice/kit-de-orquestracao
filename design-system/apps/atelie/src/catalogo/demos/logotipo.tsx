import { Logotipo } from "@/components/ui/logotipo"

import { Amostra, Amostras } from "./_amostra"

export default function DemoDoLogotipo() {
  return (
    <Amostras>
      <Amostra titulo="Provisório, até o desenho oficial" primeira>
        <Logotipo />
      </Amostra>
    </Amostras>
  )
}
