"use client"

import * as React from "react"
import { ChevronDownIcon } from "lucide-react"

import { COR_DO_TOM_DENSO } from "@/registry/wicomm/lib/idioma-de-cor"
import { cn } from "@/registry/wicomm/lib/utils"
import { Button } from "@/registry/wicomm/ui/button"
import { ConteudoDoMenu, GatilhoDoMenu, Menu } from "@/registry/wicomm/ui/menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/registry/wicomm/ui/popover"
import { useDensidadeDaTabela } from "@/registry/wicomm/ui/table"

type Densidade = "instrumento" | "site"

/**
 * O gatilho quieto: sem contorno nem fundo em repouso; o fundo só no hover e aberto. A tinta se SOMA ao fundo
 * (não é `bg-accent`): a linha da tabela já acende em `accent` no hover, e o gatilho tem de se ver sobre ela.
 * O aberto se lê no `aria-expanded`, que o menu e o popover escrevem igual (o `data-state` é de quem embrulhar o gatilho).
 */
const GATILHO =
  "inline-flex max-w-full min-w-0 items-center gap-1 rounded-md px-1.5 text-left outline-hidden transition-colors duration-cor hover:bg-foreground/[0.07] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-expanded:bg-foreground/[0.07] aria-busy:pointer-events-none motion-reduce:transition-none"

const ALTURA: Record<Densidade, string> = { instrumento: "min-h-7", site: "min-h-8" }

type Props = {
  /**
   * A leitura do valor: a mesma peça que a célula mostraria sem a escolha. Nunca
   * vazia: sem valor, a leitura vazia da peça (*Sem data*, a pessoa tracejada).
   */
  valor: Exclude<NonNullable<React.ReactNode>, boolean>
  /** O que se escolhe, para o leitor de tela: *Responsável*, *Etapa*. */
  rotulo: string
  /** Sem permissão, ou o estado do objeto recusa a troca: só a leitura. */
  editavel?: boolean
  variante?: "menu" | "popover"
  /**
   * Na variante `popover`: grava o formulário (o *Salvar* e o Enter). Fecha ao
   * gravar; devolver `false` deixa aberto (o formulário recusou e já diz por quê).
   * Botão dos campos sem `type="button"` também grava: é um `<form>`.
   */
  aoSalvar?: () => boolean | void | Promise<void>
  /** Na variante `popover`: por que ainda não dá para salvar. Com ele, o *Salvar* fica desabilitado e a frase aparece no formulário. */
  motivoParaNaoSalvar?: string | null
  rotuloDoSalvar?: string
  rotuloDoCancelar?: string
  gravando?: boolean
  recusado?: boolean
  /** A frase da recusa, quando o *onde* importa (*Não mudou no sistema de origem.*). */
  rotuloDaRecusa?: string
  aoTentarDeNovo?: () => void
  /** Sem ela, a da `Table` em volta. */
  densidade?: Densidade
  className?: string
  /** O gatilho, para quem precisa medir ou focar a célula. */
  ref?: React.Ref<HTMLButtonElement>
  /** O conteúdo do menu, ou o formulário do popover. */
  children: React.ReactNode
}

/**
 * A ESCOLHA NA CÉLULA (ANATOMIA PECA-01): o valor da célula como se lê — a
 * `Pessoa`, o `Estado`, o `Prazo`, o texto, **no peso da leitura** — com o
 * chevron de 14px ao lado, que é o único sinal de que abre (por isso sempre à
 * vista, em `muted-foreground`, que paga 3:1, COR-13). O formulário mora no
 * que ele abre, nunca na célula.
 *
 * - `variante="menu"` (padrão): `children` é o conteúdo do menu — um
 *   `GrupoDeEscolhaDoMenu`, em que a escolha já é a ação.
 * - `variante="popover"`: `children` são os campos, dentro de um `<form>`: o
 *   Enter grava, o *Salvar* grava (`aoSalvar`) e fecha, o *Cancelar* e o Esc
 *   fecham sem gravar. O `aoSalvar` que devolve `false` deixa aberto, e o
 *   `motivoParaNaoSalvar` desabilita o *Salvar* e escreve a frase no fim do
 *   formulário, ligada ao botão (MSG-01: o erro mora onde se corrige).
 * - **Sem valor**: a célula mostra a leitura vazia da peça (*Sem data*, a
 *   pessoa tracejada, EST-02) com o chevron — nunca o chevron sozinho (o tipo
 *   recusa `valor` nulo).
 * - **Estados.** Repouso sem contorno nem fundo; hover em tinta; foco no
 *   anel (SUP-06); aberto. O hover é uma tinta que se soma ao fundo, para
 *   aparecer sobre a linha que acende. **Gravando** (`gravando`): o valor novo já na
 *   célula (quem chama troca na hora, CONV-08), o gatilho inerte e
 *   `aria-busy`. **Recusado** (`recusado`): quem chama volta o valor antigo, e
 *   a célula diz *Não mudou.* (`rotuloDaRecusa`) com o *Tentar de novo*.
 * - **Sem permissão, ou recusado pelo estado do objeto** (`editavel={false}`):
 *   não desenha o gatilho, só a leitura (PESO-03).
 *
 * A célula pinta por cima do `LinkDaLinha` (`relative z-[1]`, um degrau acima):
 * o clique no gatilho escolhe, e o clique no resto da linha abre o objeto. Por
 * isso, superfície fixa que passa por cima da tabela (rodapé `sticky`, barra de
 * ações) declara `z-10` ou mais, como o `TableHeader`.
 */
function EscolhaNaCelula({
  valor,
  rotulo,
  editavel = true,
  variante = "menu",
  aoSalvar,
  motivoParaNaoSalvar,
  rotuloDoSalvar = "Salvar",
  rotuloDoCancelar = "Cancelar",
  gravando = false,
  recusado = false,
  rotuloDaRecusa = "Não mudou.",
  aoTentarDeNovo,
  densidade: densidadeDeFora,
  className,
  ref,
  children,
}: Props) {
  const densidadeDaTabela = useDensidadeDaTabela()
  const densidade = densidadeDeFora ?? densidadeDaTabela
  const [aberto, setAberto] = React.useState(false)
  const idDoMotivo = React.useId()
  if (!editavel) {
    return (
      <span data-slot="escolha-na-celula" data-editavel="false" className={cn("inline-flex min-w-0", className)}>
        {valor}
      </span>
    )
  }

  const gatilho = (
    <button
      ref={ref}
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
  const mudar = (a: boolean) => setAberto(gravando ? false : a)

  // A margem negativa mora na raiz, não no botão: no botão ela encolhe a medida da raiz e corta o valor.
  return (
    <span
      data-slot="escolha-na-celula"
      className={cn("relative z-[1] -mx-1.5 inline-flex max-w-[calc(100%+0.75rem)] min-w-0 flex-col items-start", className)}
    >
      {variante === "menu" ? (
        <Menu open={aberto} onOpenChange={mudar}>
          <GatilhoDoMenu asChild>{gatilho}</GatilhoDoMenu>
          <ConteudoDoMenu align="start" aria-label={rotulo}>
            {children}
          </ConteudoDoMenu>
        </Menu>
      ) : (
        <Popover open={aberto} onOpenChange={mudar}>
          <PopoverTrigger asChild>{gatilho}</PopoverTrigger>
          <PopoverContent aria-label={rotulo} className="w-auto">
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                // O popover mora num portal, mas o evento do React sobe pela árvore: não chega ao form da tela.
                e.stopPropagation()
                if (motivoParaNaoSalvar) return
                if (aoSalvar?.() === false) return
                setAberto(false)
              }}
            >
              {children}
              {motivoParaNaoSalvar ? (
                <p id={idDoMotivo} aria-live="polite" className={cn("t-denso max-w-64", COR_DO_TOM_DENSO.ruim)}>
                  {motivoParaNaoSalvar}
                </p>
              ) : null}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setAberto(false)}>
                  {rotuloDoCancelar}
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!!motivoParaNaoSalvar}
                  aria-describedby={motivoParaNaoSalvar ? idDoMotivo : undefined}
                >
                  {rotuloDoSalvar}
                </Button>
              </div>
            </form>
          </PopoverContent>
        </Popover>
      )}
      {recusado ? (
        // Quebra só entre as duas frases: em coluna estreita vira duas linhas, nunca transborda para a vizinha.
        <span role="alert" className="t-denso flex flex-wrap items-center gap-x-1 px-1.5">
          <span className={cn("whitespace-nowrap", COR_DO_TOM_DENSO.ruim)}>{rotuloDaRecusa}</span>
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
