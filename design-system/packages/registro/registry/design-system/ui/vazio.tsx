import * as React from "react"

import { cn } from "@/registry/design-system/lib/utils"
import { MedalhaoDoIcone } from "@/registry/design-system/ui/medalhao-do-icone"

/**
 * A causa de uma região sem itens (ANATOMIA EST-02): *ainda não há nada*, *o
 * filtro escondeu tudo*, *não se aplica*, *não informado* — quatro coisas com
 * donos diferentes, e a frase diz qual. Vazio nunca vira ✓ nem cartão de voz:
 * o medalhão é neutro, sempre (COR-10).
 */
type CausaDoVazio = "nada-ainda" | "filtro" | "nao-se-aplica" | "nao-informado"

type PropsDaEscalaPadrao = {
  escala?: "padrao"
  causa: CausaDoVazio
  icone: React.ComponentProps<typeof MedalhaoDoIcone>["icone"]
  titulo: string
  /** A saída, quando a causa tem uma: a MESMA ação do lugar de onde ela vem (MSG-06), em `outline sm`. */
  acao?: React.ReactNode
  className?: string
  /** A frase que diz a causa nas palavras de quem usa. */
  children?: React.ReactNode
}

/**
 * A escala baixa, para a coluna do quadro e o painel estreito: só a frase da
 * causa, num contorno tracejado (a ausência, FORMA-02), sem medalhão nem título.
 */
type PropsDaEscalaColuna = {
  escala: "coluna"
  causa: CausaDoVazio
  className?: string
  /** A frase que diz a causa: "Nenhum item com este filtro". */
  children: React.ReactNode
}

function Vazio(props: PropsDaEscalaPadrao | PropsDaEscalaColuna) {
  if (props.escala === "coluna") {
    return (
      <p
        data-slot="vazio"
        data-causa={props.causa}
        data-escala="coluna"
        className={cn(
          "rounded-cartao border border-dashed border-border px-3 py-4 text-center t-denso text-muted-foreground",
          props.className
        )}
      >
        {props.children}
      </p>
    )
  }
  const { causa, icone, titulo, acao, className, children } = props
  return (
    <div
      data-slot="vazio"
      data-causa={causa}
      className={cn("mx-auto flex max-w-medida flex-col items-center gap-3 px-6 py-12 text-center", className)}
    >
      <MedalhaoDoIcone icone={icone} />
      <div className="flex flex-col gap-1">
        <p className="t-titulo text-foreground">{titulo}</p>
        {children ? <p className="t-denso text-foreground-2">{children}</p> : null}
      </div>
      {acao ? <div className="flex items-center gap-2">{acao}</div> : null}
    </div>
  )
}

export { Vazio, type CausaDoVazio }
