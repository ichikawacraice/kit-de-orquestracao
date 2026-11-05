"use client"

import * as React from "react"
import { LogOutIcon, UserCogIcon } from "lucide-react"

import { ConteudoDoMenu, GatilhoDoMenu, GrupoDoMenu, ItemDoMenu, Menu } from "@/registry/design-system/ui/menu"
import { Monograma, iniciais } from "@/registry/design-system/ui/monograma"

/**
 * O menu da conta (ANATOMIA CASCO-01: a conta mora no pé da barra lateral). O
 * e-mail vem sob demanda, no topo do menu; "Minha conta" e "Sair" são as
 * linhas. Sair não pede confirmação: não perde nada. `children` é o gatilho.
 */
function MenuDaConta({
  id,
  nome,
  email,
  onAbrirConta,
  onSair,
  children,
  lado = "bottom",
}: {
  /** O id da pessoa: dele sai a cor do monograma (COR-09); `null` quando o app não o tem. */
  id: string | null
  nome: string
  email: string
  onAbrirConta?: () => void
  onSair: () => void
  children: React.ReactElement
  lado?: "top" | "right" | "bottom" | "left"
}) {
  return (
    <Menu>
      <GatilhoDoMenu asChild>{children}</GatilhoDoMenu>
      <ConteudoDoMenu side={lado} align="start" aria-label="Conta">
        <div data-slot="topo-do-menu-da-conta" className="flex items-center gap-2 px-2 pt-1">
          <Monograma nome={nome} chave={id} />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[13px] font-[550] text-foreground">{nome}</span>
            <span className="truncate text-legenda text-muted-foreground">{email}</span>
          </span>
        </div>
        <GrupoDoMenu>
          {onAbrirConta ? (
            <ItemDoMenu icone={UserCogIcon} onEscolher={onAbrirConta}>
              Minha conta
            </ItemDoMenu>
          ) : null}
          <ItemDoMenu icone={LogOutIcon} onEscolher={onSair}>
            Sair
          </ItemDoMenu>
        </GrupoDoMenu>
      </ConteudoDoMenu>
    </Menu>
  )
}

// O monograma mora em `monograma`; segue exportado daqui para quem já o importava do menu.
export { MenuDaConta, Monograma, iniciais }
