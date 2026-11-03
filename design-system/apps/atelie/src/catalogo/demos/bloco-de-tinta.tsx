"use client"

import { BlocoDeTinta, GrupoDeTinta, NotaDoBloco, TextoDoBloco } from "@/components/ui/bloco-de-tinta"
import { TONS } from "@/lib/idioma-de-cor"

import { Amostra, Amostras } from "./_amostra"

export default function DemoDoBlocoDeTinta() {
  return (
    <Amostras>
      <Amostra titulo="As cinco vozes" primeira>
        <div className="grid w-full gap-2 sm:grid-cols-2">
          {TONS.map((tom) => (
            <BlocoDeTinta key={tom} tom={tom}>
              <TextoDoBloco>Voz {tom}</TextoDoBloco>
              <NotaDoBloco>há 2 h</NotaDoBloco>
            </BlocoDeTinta>
          ))}
        </div>
      </Amostra>
      <Amostra titulo="Grupo de tinta">
        <GrupoDeTinta tom="ruim" titulo="Falhas" contagem={2} className="w-full">
          <ul className="flex flex-col gap-1 text-sm">
            <li>A integração recusou o arquivo.</li>
            <li>O prazo venceu sem resposta.</li>
          </ul>
        </GrupoDeTinta>
      </Amostra>
    </Amostras>
  )
}
