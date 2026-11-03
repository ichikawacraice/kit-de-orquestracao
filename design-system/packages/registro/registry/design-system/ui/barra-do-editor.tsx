"use client"

import * as React from "react"
import { ArrowLeftIcon } from "lucide-react"

import { Button } from "@/registry/design-system/ui/button"
import { Card } from "@/registry/design-system/ui/card"
import { MenuDaConta, Monograma } from "@/registry/design-system/ui/menu-da-conta"
import { ICONE_DO_TEMA, MenuDoTema, ROTULO_DO_TEMA } from "@/registry/design-system/ui/menu-do-tema"
import { Ajuda } from "@/registry/design-system/ui/tooltip"
import { LinkDoApp } from "@/registry/design-system/lib/link-do-app"
import { cn } from "@/registry/design-system/lib/utils"

/**
 * A BARRA DO EDITOR (ANATOMIA ARQ-03, CASCO-01) — a linha única do topo do
 * Editor, que fica fora do casco e faz o papel dele: a volta, o onde estou, o
 * estado do rascunho e a conta. Só o encaixe: não conhece publicação nem
 * documento — quem preenche é a tela.
 *
 * - **A volta e o nome cumprem a trilha** (CASCO-03): o `voltar` é obrigatório,
 *   e o nome do objeto é o `h1` da tela, na voz `t-titulo` (TIPO-04: no Editor,
 *   23px numa barra de 44px disputariam o canvas).
 * - **Três encaixes de verdade:** a grade `1fr | auto | 1fr` centra a vista
 *   seja qual for a largura dos lados; `minmax(0, …)` deixa os lados
 *   encolherem, e quem cede é o nome (`truncate`, com o nome inteiro na dica).
 * - **Altura fixa** (`h-11`) e nenhum `flex-wrap`: nenhum estado muda a altura.
 */
function BarraDoEditor({
  voltar,
  nome,
  ondeEstou,
  vista,
  acoes,
  rotulo = "Barra do editor",
  className,
}: {
  /** Para onde a volta leva, e o rótulo dela ("Voltar aos documentos"). */
  voltar: { href: string; rotulo: string }
  /** O nome do objeto editado: o `h1` da tela. */
  nome: string
  /** O estado do rascunho e o desfazer/refazer, depois do nome. */
  ondeEstou?: React.ReactNode
  /** A vista (`BarraDeModos densidade="modos"`), ao centro. */
  vista?: React.ReactNode
  /** O primário, o `⋯` e o `GrupoDaPessoa`, à direita. */
  acoes: React.ReactNode
  rotulo?: string
  className?: string
}) {
  return (
    <Card
      data-slot="barra-do-editor"
      role="group"
      aria-label={rotulo}
      className={cn("grid h-11 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-6 px-2", className)}
    >
      <div data-encaixe="onde-estou" className="flex min-w-0 items-center gap-3">
        <Ajuda texto={voltar.rotulo}>
          <Button asChild variant="ghost" size="icon" className="shrink-0">
            <LinkDoApp href={voltar.href} aria-label={voltar.rotulo}>
              <ArrowLeftIcon aria-hidden="true" />
            </LinkDoApp>
          </Button>
        </Ajuda>
        <Ajuda texto={nome}>
          <h1 tabIndex={-1} className="t-titulo min-w-0 truncate text-foreground outline-none">
            {nome}
          </h1>
        </Ajuda>
        {ondeEstou}
      </div>
      <div data-encaixe="vista" className="flex items-center gap-3">
        {vista}
      </div>
      <div data-encaixe="acoes" className="flex min-w-0 items-center justify-end gap-3">
        {acoes}
      </div>
    </Card>
  )
}

/** Controles que andam juntos dentro de um encaixe (desfazer · refazer). */
function GrupoDaBarra({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="grupo-da-barra" className={cn("flex shrink-0 items-center gap-1", className)} {...props} />
}

/**
 * O par da pessoa, ao fim da barra: o tema e a conta — os mesmos do pé da
 * barra lateral, porque aqui a barra substitui o casco (CASCO-01).
 */
function GrupoDaPessoa({ conta }: { conta: { nome: string; email: string; onSair: () => void } }) {
  return (
    <GrupoDaBarra data-slot="grupo-da-pessoa">
      <MenuDoTema>
        {(tema) => {
          const Icone = ICONE_DO_TEMA[tema]
          const rotulo = `Tema: ${ROTULO_DO_TEMA[tema].toLowerCase()}`
          return (
            <Button variant="ghost" size="icon" aria-label={rotulo}>
              <Icone />
            </Button>
          )
        }}
      </MenuDoTema>
      <MenuDaConta nome={conta.nome} email={conta.email} onSair={conta.onSair}>
        <Button variant="ghost" size="icon" aria-label={`Conta: ${conta.nome}`}>
          <Monograma nome={conta.nome} />
        </Button>
      </MenuDaConta>
    </GrupoDaBarra>
  )
}

export { BarraDoEditor, GrupoDaBarra, GrupoDaPessoa }
