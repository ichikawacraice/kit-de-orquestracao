"use client"

import { ListIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ConteudoDoMenu, GatilhoDoMenu, ItemDoMenu, Menu } from "@/components/ui/menu"

/** Pula para uma seção da página: a rolagem até a âncora é instantânea. */
export function IrParaASecao({ secoes }: { secoes: { ancora: string; titulo: string }[] }) {
  return (
    <Menu>
      <GatilhoDoMenu asChild>
        <Button variant="outline">
          <ListIcon />
          Ir para a seção
        </Button>
      </GatilhoDoMenu>
      <ConteudoDoMenu aria-label="Seções">
        {secoes.map((s) => (
          <ItemDoMenu key={s.ancora} onEscolher={() => (location.hash = s.ancora)}>
            {s.titulo}
          </ItemDoMenu>
        ))}
      </ConteudoDoMenu>
    </Menu>
  )
}
