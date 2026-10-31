"use client"

import * as React from "react"
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react"

import { Button } from "@/registry/wicomm/ui/button"
import { cn } from "@/registry/wicomm/lib/utils"

/**
 * A DOBRA (ANATOMIA PECA-01) — um grupo dentro de uma peça que se abre sob
 * demanda: os campos de um assunto no inspector do Editor ("Conteúdo",
 * "Aparência"), ou o informativo que pouca gente lê. O gatilho é um `ghost sm`
 * em `foreground-2`, mais leve que o corpo, com o chevron e `aria-expanded`.
 *
 * Nunca esconde ação (PRIN-03): o que a pessoa precisa fazer não mora dobrado.
 * O conteúdo só é montado aberto — leitor de tela e busca não leem o que está
 * dobrado —, entra com `duration-dobra-abre` e sai seco. Não abre superfície:
 * quem dobra mora numa superfície que já existe.
 *
 * O estado é de vista: o F5 volta ao `abertaDeInicio` de quem chama. Quem
 * precisa abrir de fora (o foco que vai a um campo dobrado) passa `aberta` e
 * `aoMudar`. Sem conteúdo, não monta: dobra vazia é gatilho que abre nada.
 */
function Dobra({
  rotulo,
  abertaDeInicio = false,
  aberta: abertaDeFora,
  aoMudar,
  nome,
  className,
  children,
}: {
  rotulo: string
  abertaDeInicio?: boolean
  aberta?: boolean
  aoMudar?: (aberta: boolean) => void
  nome?: string
  className?: string
  children: React.ReactNode
}) {
  const [abertaAqui, setAbertaAqui] = React.useState(abertaDeInicio)
  const aberta = abertaDeFora ?? abertaAqui
  const id = React.useId()
  if (React.Children.toArray(children).filter((c) => c !== "").length === 0) return null
  const Chevron = aberta ? ChevronDownIcon : ChevronRightIcon
  const trocar = () => {
    setAbertaAqui(!aberta)
    aoMudar?.(!aberta)
  }
  return (
    <div data-slot="dobra" data-nome={nome} data-aberta={aberta} className={cn("flex flex-col gap-2", className)}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-expanded={aberta}
        aria-controls={id}
        onClick={trocar}
        className="-ml-2 self-start text-foreground-2"
      >
        <Chevron aria-hidden="true" />
        {rotulo}
      </Button>
      {aberta ? (
        <div
          id={id}
          className="flex flex-col gap-3 pb-2 animate-in fade-in-0 duration-dobra-abre ease-abre motion-reduce:animate-none"
        >
          {children}
        </div>
      ) : null}
    </div>
  )
}

export { Dobra }
