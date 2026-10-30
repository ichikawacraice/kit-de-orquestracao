"use client"

import { DicaDeAjuda, rotuloSobre } from "@/components/ui/dica-de-ajuda"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { Amostra, Amostras } from "./_amostra"

export default function DemoDaDicaDeAjuda() {
  return (
    <Amostras>
      <Amostra titulo="Ao lado do rótulo" primeira>
        <div className="flex w-64 flex-col gap-1.5">
          <div className="flex items-center gap-1">
            <Label htmlFor="demo-dica-prazo">Prazo</Label>
            <DicaDeAjuda texto="O prazo conta em dias úteis, a partir do aceite." rotulo={rotuloSobre("Prazo")} />
          </div>
          <Input id="demo-dica-prazo" placeholder="em dias úteis" />
        </div>
      </Amostra>
    </Amostras>
  )
}
