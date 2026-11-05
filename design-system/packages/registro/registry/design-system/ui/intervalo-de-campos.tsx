"use client"

import * as React from "react"

import { COR_DO_TOM_DENSO } from "@/registry/design-system/lib/idioma-de-cor"
import { cn } from "@/registry/design-system/lib/utils"
import { Input } from "@/registry/design-system/ui/input"
import { Label } from "@/registry/design-system/ui/label"
import { useDensidadeDaTabela } from "@/registry/design-system/ui/table"

type Densidade = "instrumento" | "site"
type Lado = "de" | "ate"
type AtributosDoCampo = Omit<
  React.ComponentProps<typeof Input>,
  "id" | "type" | "value" | "onChange" | "min" | "max" | "disabled" | "aria-invalid"
>

/** A legenda nomeia o conjunto; os rótulos, o valor que se repete (TIPO-02). */
const VOZ: Record<Densidade, { legenda: string; rotulo: "coluna" | "campo" }> = {
  instrumento: { legenda: "t-rotulo", rotulo: "coluna" },
  site: { legenda: "t-campo", rotulo: "campo" },
}

/**
 * O INTERVALO DE DOIS VALORES (ANATOMIA PECA-01) — *de* e *até* da mesma
 * grandeza, num `fieldset` com a legenda e um campo por linha, o rótulo à
 * esquerda e o campo à direita. Um campo por linha porque dois campos de data
 * lado a lado não cabem no popover (256px úteis): o segundo seria cortado. A
 * legenda diz a grandeza e a unidade; *De* e *Até* são rótulos visíveis
 * (CTRL-04), e cada campo se chama pelo seu. As pontas se amarram (o *De* não
 * passa do *Até* no seletor), mas a peça não valida: o erro é de quem chama
 * (`erro`), e aparece abaixo do campo do lado. No instrumento, a legenda é
 * `t-rotulo` e os rótulos `t-coluna`; no site, as duas `t-campo`. O `fieldset`
 * tem `min-w-0`: sem ele, o mínimo do conteúdo empurra o popover. Não tem
 * desabilitado, nem arranjo em linha.
 */
function IntervaloDeCampos({
  legenda,
  tipo,
  valor,
  aoMudar,
  rotulos = { de: "De", ate: "Até" },
  min,
  max,
  erro,
  densidade: densidadeDeFora,
  campoDe,
  campoAte,
  id: idDeFora,
  className,
}: {
  /** O que se recorta, com a unidade quando há: "Prazo", "Valor (R$)". Visível, sempre. */
  legenda: string
  tipo: "date" | "number"
  valor: { de: string; ate: string }
  aoMudar: (lado: Lado, valor: string) => void
  /** Padrão: { de: "De", ate: "Até" }. */
  rotulos?: { de: string; ate: string }
  /** Os limites de fora (o primeiro e o último valor possíveis). */
  min?: string
  max?: string
  /** O lado errado, e a frase quando há. Quem decide o erro é quem chama. */
  erro?: { lado: Lado; texto?: string }
  /** Sem ela: a da Table em volta, senão instrumento. */
  densidade?: Densidade
  /** Os atributos que sobram para cada campo (name, autoComplete, onBlur, ref). */
  campoDe?: AtributosDoCampo
  campoAte?: AtributosDoCampo
  /** Base dos ids (`${id}-de`, `${id}-ate`, `${id}-erro`); sem ele, useId. */
  id?: string
  className?: string
}) {
  const densidadeDaTabela = useDensidadeDaTabela()
  const voz = VOZ[densidadeDeFora ?? densidadeDaTabela]
  const idGerado = React.useId()
  const base = idDeFora ?? idGerado
  const idDoErro = `${base}-erro`

  const lados: { lado: Lado; atributos?: AtributosDoCampo; min?: string; max?: string }[] = [
    // As pontas se amarram no seletor: o De não passa do Até, nem o Até fica antes do De.
    { lado: "de", atributos: campoDe, min, max: valor.ate || max },
    { lado: "ate", atributos: campoAte, min: valor.de || min, max },
  ]

  return (
    <fieldset data-slot="intervalo-de-campos" className={cn("flex min-w-0 flex-col", className)}>
      <legend className={cn("mb-1.5", voz.legenda)}>{legenda}</legend>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1.5">
        {lados.map(({ lado, atributos, min: minimo, max: maximo }) => {
          const errado = erro?.lado === lado
          const comFrase = errado && Boolean(erro?.texto)
          return (
            <React.Fragment key={lado}>
              <Label voz={voz.rotulo} htmlFor={`${base}-${lado}`}>
                {rotulos[lado]}
              </Label>
              <Input
                {...atributos}
                id={`${base}-${lado}`}
                type={tipo}
                value={valor[lado]}
                min={minimo}
                max={maximo}
                onChange={(e) => aoMudar(lado, e.target.value)}
                aria-invalid={errado || undefined}
                aria-describedby={comFrase ? idDoErro : atributos?.["aria-describedby"]}
                className={cn("w-full min-w-0", atributos?.className)}
              />
              {comFrase ? (
                <p id={idDoErro} className={cn("col-start-2 t-denso", COR_DO_TOM_DENSO.ruim)}>
                  {erro?.texto}
                </p>
              ) : null}
            </React.Fragment>
          )
        })}
      </div>
    </fieldset>
  )
}

export { IntervaloDeCampos }
