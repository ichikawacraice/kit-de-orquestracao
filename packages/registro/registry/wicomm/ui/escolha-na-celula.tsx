"use client"

import * as React from "react"
import { ChevronDownIcon } from "lucide-react"

import { COR_DO_TOM_DENSO } from "@/registry/wicomm/lib/idioma-de-cor"
import { cn } from "@/registry/wicomm/lib/utils"
import { Button } from "@/registry/wicomm/ui/button"
import { ConteudoDoMenu, GatilhoDoMenu, Menu } from "@/registry/wicomm/ui/menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/registry/wicomm/ui/popover"

type Densidade = "instrumento" | "site"

/**
 * O gatilho quieto: sem contorno nem fundo em repouso; o fundo só no hover e aberto. A tinta se SOMA ao fundo
 * (não é `bg-accent`): a linha da tabela já acende em `accent` no hover, e o gatilho tem de se ver sobre ela.
 */
const GATILHO =
  "inline-flex max-w-full min-w-0 items-center gap-1 rounded-md px-1.5 text-left outline-hidden transition-colors duration-cor hover:bg-foreground/[0.07] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=open]:bg-foreground/[0.07] aria-busy:pointer-events-none motion-reduce:transition-none"

const ALTURA: Record<Densidade, string> = { instrumento: "min-h-7", site: "min-h-8" }

/**
 * A ESCOLHA NA CÉLULA (ANATOMIA PECA-01): o valor da célula como se lê — a
 * `Pessoa`, o `Estado`, o `Prazo`, o texto, **no peso da leitura** — com o
 * chevron de 14px ao lado, que é o único sinal de que abre (por isso sempre à
 * vista, em `muted-foreground`, que paga 3:1, COR-13). O formulário mora no
 * que ele abre, nunca na célula.
 *
 * - `variante="menu"` (padrão): `children` é o conteúdo do menu — um
 *   `GrupoDeEscolhaDoMenu`, em que a escolha já é a ação.
 * - `variante="popover"`: `children` é o formulário (a data), e o popover traz
 *   o **Salvar** (`aoSalvar`), que fecha ao gravar.
 * - **Estados.** Repouso sem contorno nem fundo; hover em `bg-accent`; foco no
 *   anel (SUP-06); aberto. O hover é uma tinta que se soma ao fundo, para
 *   aparecer sobre a linha que acende. **Gravando** (`gravando`): o valor novo já na
 *   célula (quem chama troca na hora, CONV-08), o gatilho inerte e
 *   `aria-busy`. **Recusado** (`recusado`): quem chama volta o valor antigo, e
 *   a célula diz *Não mudou.* com o *Tentar de novo*.
 * - **Sem permissão, ou recusado pelo estado do objeto** (`editavel={false}`):
 *   não desenha o gatilho, só a leitura (PESO-03).
 *
 * A célula pinta por cima do `LinkDaLinha` (`relative`, um degrau acima): o
 * clique no gatilho escolhe, e o clique no resto da linha abre o objeto.
 */
function EscolhaNaCelula({
  valor,
  rotulo,
  editavel = true,
  variante = "menu",
  aoSalvar,
  rotuloDoSalvar = "Salvar",
  gravando = false,
  recusado = false,
  aoTentarDeNovo,
  densidade = "instrumento",
  className,
  children,
}: {
  /** A leitura do valor: a mesma peça que a célula mostraria sem a escolha. */
  valor: React.ReactNode
  /** O que se escolhe, para o leitor de tela: *Responsável*, *Etapa*. */
  rotulo: string
  /** Sem permissão, ou o estado do objeto recusa a troca: só a leitura. */
  editavel?: boolean
  variante?: "menu" | "popover"
  /** Na variante `popover`: grava o formulário. O popover fecha ao chamar. */
  aoSalvar?: () => void
  rotuloDoSalvar?: string
  gravando?: boolean
  recusado?: boolean
  aoTentarDeNovo?: () => void
  densidade?: Densidade
  className?: string
  /** O conteúdo do menu, ou o formulário do popover. */
  children: React.ReactNode
}) {
  const [aberto, setAberto] = React.useState(false)
  if (!editavel) {
    return (
      <span data-slot="escolha-na-celula" data-editavel="false" className={cn("inline-flex min-w-0", className)}>
        {valor}
      </span>
    )
  }

  const gatilho = (
    <button
      type="button"
      data-slot="gatilho-da-escolha"
      aria-busy={gravando || undefined}
      aria-disabled={gravando || undefined}
      className={cn(GATILHO, ALTURA[densidade])}
      onClick={(e) => {
        if (gravando) e.preventDefault()
      }}
      onPointerDown={(e) => {
        // Gravando, o gatilho é inerte: o Radix abre no `pointerdown`, antes do clique.
        if (gravando) e.preventDefault()
      }}
      onKeyDown={(e) => {
        if (gravando && (e.key === "Enter" || e.key === " " || e.key === "ArrowDown")) e.preventDefault()
      }}
    >
      <span className="sr-only">{rotulo}: </span>
      <span className="flex min-w-0 items-center">{valor}</span>
      <ChevronDownIcon aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
    </button>
  )

  // A margem negativa mora na raiz, não no botão: no botão ela encolhe a medida da raiz e corta o valor.
  return (
    <span
      data-slot="escolha-na-celula"
      className={cn("relative z-[1] -mx-1.5 inline-flex max-w-[calc(100%+0.75rem)] min-w-0 flex-col items-start", className)}
    >
      {variante === "menu" ? (
        <Menu open={aberto} onOpenChange={(a) => setAberto(gravando ? false : a)}>
          <GatilhoDoMenu asChild>{gatilho}</GatilhoDoMenu>
          <ConteudoDoMenu align="start" aria-label={rotulo}>
            {children}
          </ConteudoDoMenu>
        </Menu>
      ) : (
        <Popover open={aberto} onOpenChange={(a) => setAberto(gravando ? false : a)}>
          <PopoverTrigger asChild>{gatilho}</PopoverTrigger>
          <PopoverContent aria-label={rotulo} className="flex w-auto flex-col gap-3">
            {children}
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => {
                  aoSalvar?.()
                  setAberto(false)
                }}
              >
                {rotuloDoSalvar}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      )}
      {recusado ? (
        // Quebra só entre as duas frases: em coluna estreita vira duas linhas, nunca transborda para a vizinha.
        <span role="alert" className="t-denso flex flex-wrap items-center gap-x-1 px-1.5">
          <span className={cn("whitespace-nowrap", COR_DO_TOM_DENSO.ruim)}>Não mudou.</span>
          {aoTentarDeNovo ? (
            <Button variant="link" size="sm" onClick={aoTentarDeNovo} className="whitespace-nowrap">
              Tentar de novo
            </Button>
          ) : null}
        </span>
      ) : null}
    </span>
  )
}

export { EscolhaNaCelula }
