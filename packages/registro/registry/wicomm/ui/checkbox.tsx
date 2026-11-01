"use client"

import * as React from "react"
import { Checkbox as CheckboxPrimitive } from "radix-ui"
import { CheckIcon, MinusIcon } from "lucide-react"

import { cn } from "@/registry/wicomm/lib/utils"
import { Label } from "@/registry/wicomm/ui/label"

/**
 * A caixa de marcar: marcar itens de uma lista para uma ação em lote (ANATOMIA
 * EST-03: "sobre o quê") e o sim/não de um formulário que se grava com
 * *Salvar*. Parte do `checkbox` do shadcn (PECA-02).
 *
 * - **Forma:** 16px, raio de caixa de marcação (`rounded-marcacao`, FORMA-01);
 *   desmarcada, superfície de cartão com o contorno de controle, que paga 3:1
 *   (COR-11); marcada ou indeterminada, o preenchimento da marca com o glifo
 *   branco (a marca preenche, não escreve — MARCA-02).
 * - **Alvo:** 24px por um pseudo-elemento, sem mudar o desenho.
 * - **Desabilitada:** `cursor-not-allowed` e 45% (CTRL-04). À vista, diz por
 *   quê (`ComMotivo` ou a `descricao` da opção).
 * - **Movimento:** só a cor muda; o ✓ entra sem animação (MOV-03).
 *
 * Na lista, a caixa vai sozinha, com `aria-label` ("Marcar pedido 1042"); no
 * cabeçalho, "Marcar todos" com `checked="indeterminate"` quando só parte está
 * marcada. Com o texto ao lado, use `OpcaoDeMarcar`.
 *
 * Não é interruptor: caixa que grava na hora, sem *Salvar*, é outra função.
 */
function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer group/marcar relative inline-grid size-4 shrink-0 place-content-center rounded-marcacao border border-input bg-card text-primary-foreground transition-colors duration-cor after:absolute after:-inset-1 after:content-[''] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-45 aria-invalid:border-destructive data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator data-slot="checkbox-indicator" className="grid place-content-center">
        <CheckIcon aria-hidden="true" className="size-3.5 group-data-[state=indeterminate]/marcar:hidden" strokeWidth={3} />
        <MinusIcon aria-hidden="true" className="hidden size-3.5 group-data-[state=indeterminate]/marcar:block" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

/**
 * A caixa com o texto ao lado: o rótulo na voz `campo` (frase, não etiqueta —
 * TIPO-02) e, se houver, a explicação abaixo, ligada pelo `aria-describedby`.
 * O clique no texto marca. Desabilitada, a caixa e o rótulo esmaecem; o motivo
 * na descrição fica em tinta cheia, porque é o que a pessoa precisa ler.
 */
function OpcaoDeMarcar({
  rotulo,
  descricao,
  id,
  className,
  ...props
}: Omit<React.ComponentProps<typeof CheckboxPrimitive.Root>, "children"> & {
  rotulo: string
  descricao?: React.ReactNode
}) {
  const gerado = React.useId()
  const idDaCaixa = id ?? gerado
  const idDaDescricao = `${idDaCaixa}-descricao`
  return (
    <div
      data-slot="opcao-de-marcar"
      data-disabled={props.disabled ? "true" : undefined}
      className={cn("group flex items-start gap-2", className)}
    >
      <Checkbox id={idDaCaixa} aria-describedby={descricao ? idDaDescricao : undefined} className="mt-0.5" {...props} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <Label htmlFor={idDaCaixa} voz="campo">
          {rotulo}
        </Label>
        {descricao ? (
          <p id={idDaDescricao} className="t-denso text-foreground-2">
            {descricao}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export { Checkbox, OpcaoDeMarcar }
