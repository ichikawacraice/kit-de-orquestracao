"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { Amostra, Amostras } from "./_amostra"

export default function DemoDoRotulo() {
  return (
    <Amostras>
      <Amostra titulo="Voz rótulo (padrão)" primeira>
        <div className="flex w-64 flex-col gap-1.5">
          <Label htmlFor="demo-rotulo-prazo">Prazo</Label>
          <Input id="demo-rotulo-prazo" placeholder="dd/mm/aaaa" />
        </div>
      </Amostra>
      <Amostra titulo="Voz campo">
        <div className="flex w-64 flex-col gap-1.5">
          <Label voz="campo" htmlFor="demo-rotulo-pergunta">
            Qual o nome do responsável?
          </Label>
          <Input id="demo-rotulo-pergunta" />
        </div>
      </Amostra>
    </Amostras>
  )
}
