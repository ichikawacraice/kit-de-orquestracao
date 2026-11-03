"use client"

import { Dobra } from "@/components/ui/dobra"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { Amostra, Amostras } from "./_amostra"

export default function DemoDaDobra() {
  return (
    <Amostras>
      <Amostra titulo="Os campos de um assunto, abertos de início" primeira>
        <div className="w-full max-w-sm">
          <Dobra rotulo="Conteúdo" abertaDeInicio>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dobra-titulo">Título</Label>
              <Input id="dobra-titulo" defaultValue="Proposta de parceria" />
            </div>
          </Dobra>
        </div>
      </Amostra>
      <Amostra titulo="O informativo que pouca gente lê, fechado">
        <div className="w-full max-w-sm">
          <Dobra rotulo="Detalhes">
            <p className="t-denso text-foreground-2">Criado em 14/10/2026 por Ana Souza; última publicação em 28/10/2026.</p>
          </Dobra>
        </div>
      </Amostra>
    </Amostras>
  )
}
