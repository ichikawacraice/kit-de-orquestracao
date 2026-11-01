import * as React from "react"

import { COR_DO_TOM_DENSO, type Tom } from "@/registry/wicomm/lib/idioma-de-cor"
import { cn } from "@/registry/wicomm/lib/utils"
import { TrilhaDoProgresso } from "@/registry/wicomm/ui/progress"

/**
 * Um número contra um teto (ANATOMIA PECA-01, ARQ-02): *120 h de 200 h*. O
 * número primeiro, em `t-medida` (TIPO-03), e a barra embaixo — sempre nessa
 * ordem, para as barras de uma coluna começarem no mesmo x.
 *
 * - **A voz é de quem chama** (`tom`, COR-05) e pinta SÓ o número, no degrau
 *   denso (COR-06). Sem `tom`, o número fica na tinta do texto: é conteúdo e
 *   não pede nada. `tom="neutro"` é para o zero que não informa (EST-04).
 * - **A barra é neutra** e não muda de cor: numa lista de medidores, barras na
 *   cor da marca diriam "alarme" sem que nada peça nada (COR-08). O teto
 *   ultrapassado enche a barra; o número diz o real.
 * - **Valor que não carregou** (não é número) escreve só *—*, neutro, sem barra.
 * - **Sem teto**, escreve *de —*, não desenha barra (não há fração) e guarda a
 *   altura dela, para a linha não pular.
 * - É `meter`, não `progressbar`: cota não é progresso.
 *
 * O rótulo à vista é de quem monta (o título do bloco, o par da `Ficha`, o
 * cabeçalho da coluna); `rotulo` vai só ao leitor de tela.
 */
function Medidor({
  valor,
  teto,
  rotulo,
  formatar = String,
  tom,
  compacto = false,
  className,
}: {
  valor: number
  teto: number | null
  /** O nome do que se mede, para o leitor de tela ("Horas do projeto"). */
  rotulo: string
  /** Como o número se escreve (`12 h`, `1 h 30 min`). */
  formatar?: (n: number) => string
  tom?: Tom
  /** Na linha de lista: barra de 4px e menos ar. */
  compacto?: boolean
  className?: string
}) {
  // Número que decide é finito e positivo (CONV-17). Valor que não é número é
  // "não carregou": `—` neutro, sem barra; a causa é do bloco (EST-02).
  const carregou = Number.isFinite(valor)
  const comTeto = carregou && teto !== null && Number.isFinite(teto) && teto > 0
  const escrito = `${formatar(valor)} de ${comTeto ? formatar(teto) : "—"}`
  if (!carregou) {
    return (
      <div data-slot="medidor" className={cn("flex min-w-0 flex-col", compacto ? "gap-1" : "gap-1.5", className)}>
        <span className="t-medida text-muted-foreground">
          —<span className="sr-only">, {rotulo} não carregou</span>
        </span>
        <div aria-hidden="true" className={compacto ? "h-1" : "h-1.5"} />
      </div>
    )
  }
  return (
    <div
      data-slot="medidor"
      data-tom={tom}
      className={cn("flex min-w-0 flex-col", compacto ? "gap-1" : "gap-1.5", className)}
      {...(comTeto
        ? {
            role: "meter",
            "aria-label": rotulo,
            "aria-valuemin": 0,
            "aria-valuemax": teto,
            "aria-valuenow": Math.min(teto, Math.max(0, valor)),
            "aria-valuetext": escrito,
          }
        : {})}
    >
      <span className="t-medida" aria-hidden={comTeto || undefined}>
        <span className={tom ? COR_DO_TOM_DENSO[tom] : "text-foreground"}>{formatar(valor)}</span>
        <span className="text-muted-foreground"> de {comTeto ? formatar(teto) : "—"}</span>
        {comTeto ? null : <span className="sr-only">, sem teto ({rotulo})</span>}
      </span>
      {comTeto ? (
        <TrilhaDoProgresso fracao={valor / teto} preenchimento="neutro" compacta={compacto} />
      ) : (
        <div aria-hidden="true" className={compacto ? "h-1" : "h-1.5"} />
      )}
    </div>
  )
}

export { Medidor }
