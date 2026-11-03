"use client"

import * as React from "react"

import { ChipQueAbre } from "@/components/ui/chip-de-estado"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"

import { Amostra, Amostras } from "./_amostra"

export default function DemoDoPopover() {
  const [aberto, setAberto] = React.useState(false)
  return (
    <Amostras>
      <Amostra titulo="O detalhe que o carimbo abre" primeira>
        <Popover open={aberto} onOpenChange={setAberto}>
          <PopoverAnchor asChild>
            <ChipQueAbre tom="ruim" aberto={aberto} onAbrir={() => setAberto((a) => !a)}>
              Não publicou
            </ChipQueAbre>
          </PopoverAnchor>
          <PopoverContent>Não deu para publicar agora. As mudanças estão guardadas; tente publicar de novo em alguns minutos.</PopoverContent>
        </Popover>
      </Amostra>
    </Amostras>
  )
}
