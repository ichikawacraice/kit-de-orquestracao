"use client"

import { Button } from "@/components/ui/button"
import { ComMotivo } from "@/components/ui/com-motivo"

import { Amostra, Amostras } from "./_amostra"

export default function DemoDoComMotivo() {
  return (
    <Amostras>
      <Amostra titulo="O desabilitado diz por quê" primeira>
        <ComMotivo motivo="Falta escolher o responsável">
          <Button disabled>Publicar</Button>
        </ComMotivo>
        <ComMotivo motivo={null}>
          <Button variant="secondary">Salvar rascunho</Button>
        </ComMotivo>
      </Amostra>
    </Amostras>
  )
}
