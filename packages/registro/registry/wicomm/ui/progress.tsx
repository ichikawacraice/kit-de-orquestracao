"use client"

import * as React from "react"
import { Progress as ProgressPrimitive } from "radix-ui"

import { cn } from "@/registry/wicomm/lib/utils"

/**
 * A barra sozinha: a trilha de tinta (a mesma da troca de vista, CTRL-06) em
 * pílula (FORMA-01) e o preenchimento até a fração. Só desenho (`aria-hidden`):
 * quem a usa diz o valor por escrito e dá o papel — `Progress` é
 * `progressbar`, `Medidor` é `meter`.
 *
 * - `marca`: o gradiente da marca (MARCA-03), REVELADO da esquerda — ele ocupa
 *   a trilha inteira e o preenchimento mostra a parte até o valor; em 1 de 8 a
 *   ponta é o vermelho escuro, não o rosa claro.
 * - `neutro`: o cinza de legenda, para a cota (a marca não responde estado,
 *   COR-08).
 *
 * O valor salta, sem animação: a etapa é discreta (MOV-03).
 */
function TrilhaDoProgresso({
  fracao,
  preenchimento = "marca",
  compacta = false,
  className,
}: {
  /** De 0 a 1; fora disso é preso ao intervalo. */
  fracao: number
  preenchimento?: "marca" | "neutro"
  /** 4px, para a linha de lista; o padrão é 6px. */
  compacta?: boolean
  className?: string
}) {
  const parte = Number.isFinite(fracao) ? Math.min(1, Math.max(0, fracao)) : 0
  return (
    <div
      aria-hidden="true"
      data-slot="trilha-do-progresso"
      className={cn("relative w-full overflow-hidden rounded-full bg-foreground/[0.08]", compacta ? "h-1" : "h-1.5", className)}
    >
      <div
        data-slot="preenchimento-do-progresso"
        className={cn(
          "h-full",
          preenchimento === "marca" ? "bg-primary-gradient bg-left bg-no-repeat" : "bg-muted-foreground"
        )}
        // A largura do preenchimento é a fração; o gradiente mede a trilha inteira (100/fração %), então só se revela.
        style={{
          width: `${parte * 100}%`,
          ...(preenchimento === "marca" && parte > 0 ? { backgroundSize: `${100 / parte}% 100%` } : {}),
        }}
      />
    </div>
  )
}

/**
 * O progresso de uma etapa CONHECIDA (ANATOMIA PECA-01): quanto falta de um
 * total que se sabe. O rótulo à esquerda, o valor escrito à direita em
 * `t-medida` (padrão: `3 de 8`) e a barra embaixo — a barra reforça, não
 * informa sozinha (COR-08).
 *
 * `max` é obrigatório: sem total, não é `Progress` (a espera sem etapas é a
 * `LinhaDeAndamento`). Não é para o percurso de um objeto (`TrilhoDoPercurso`)
 * nem para cota (`Medidor`). Não fica em 100% como desfecho: quando a etapa
 * acaba, a barra sai e o desfecho é do bloco.
 */
function Progress({
  value,
  max,
  rotulo,
  valorEscrito,
  rotuloSoParaLeitor = false,
  className,
}: {
  value: number
  max: number
  rotulo: string
  /** O valor como se lê ("12 de 40 arquivos"); o padrão é `value de max`. */
  valorEscrito?: string
  /** Quem monta já escreve rótulo e valor ao lado: a peça os diz só ao leitor. */
  rotuloSoParaLeitor?: boolean
  className?: string
}) {
  const idDoRotulo = React.useId()
  // Número que decide é finito e positivo (CONV-17): fora disso, a barra não se desenha.
  const valido = Number.isFinite(value) && Number.isFinite(max) && max > 0
  const atual = valido ? Math.min(max, Math.max(0, value)) : 0
  // Valor que não vale não vira "0 de 8" (nada andou): é "—", não carregou.
  const escrito = valido ? (valorEscrito ?? `${atual} de ${max}`) : "—"
  return (
    <div data-slot="progress" className={cn("flex w-full min-w-0 flex-col gap-1.5", className)}>
      <div className={cn("flex items-baseline justify-between gap-3", rotuloSoParaLeitor && "sr-only")}>
        <span id={idDoRotulo} className="t-denso text-foreground-2">
          {rotulo}
        </span>
        <span className={cn("t-medida", valido ? "text-foreground" : "text-muted-foreground")}>{escrito}</span>
      </div>
      <ProgressPrimitive.Root
        value={valido ? atual : null}
        max={valido ? max : undefined}
        aria-labelledby={idDoRotulo}
        aria-valuetext={escrito}
        getValueLabel={() => escrito}
      >
        {valido ? <TrilhaDoProgresso fracao={atual / max} /> : <div aria-hidden="true" className="h-1.5" />}
      </ProgressPrimitive.Root>
    </div>
  )
}

export { Progress, TrilhaDoProgresso }
