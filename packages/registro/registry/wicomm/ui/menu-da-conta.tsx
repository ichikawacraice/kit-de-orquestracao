"use client"

import * as React from "react"
import { LogOutIcon, UserCogIcon } from "lucide-react"

import { cn } from "@/registry/wicomm/lib/utils"
import { ConteudoDoMenu, GatilhoDoMenu, GrupoDoMenu, ItemDoMenu, Menu } from "@/registry/wicomm/ui/menu"

/** As iniciais de um nome: "Ana Souza" → "AS". */
function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  const primeira = partes[0]?.[0] ?? "?"
  const ultima = partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? "") : ""
  return (primeira + ultima).toUpperCase()
}

/**
 * O monograma da pessoa (CTRL-05): círculo de 20px com as iniciais, em tinta
 * neutra — nunca na cor da marca (MARCA-02). É enfeite do nome que vem ao lado
 * ou da dica: `aria-hidden`.
 */
function Monograma({ nome, className }: { nome: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      data-slot="monograma"
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground/[0.07] text-[10px] font-[650] text-foreground-2",
        className
      )}
    >
      {iniciais(nome)}
    </span>
  )
}

/**
 * O menu da conta (ANATOMIA CASCO-01: a conta mora no pé da barra lateral). O
 * e-mail vem sob demanda, no topo do menu; "Minha conta" e "Sair" são as
 * linhas. Sair não pede confirmação: não perde nada. `children` é o gatilho.
 */
function MenuDaConta({
  nome,
  email,
  onAbrirConta,
  onSair,
  children,
  lado = "bottom",
}: {
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
          <Monograma nome={nome} />
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

export { MenuDaConta, Monograma, iniciais }
