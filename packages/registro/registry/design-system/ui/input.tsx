import * as React from "react"

import { cn } from "@/registry/design-system/lib/utils"

/**
 * O campo (DESIGN CTRL-04): a altura e o raio do botão `default`, superfície de
 * cartão, contorno `--input` — o token de CONTROLE, que paga 3:1 contra a
 * superfície nos dois temas (COR-11). Foco: o anel da marca (SUP-06).
 * Desabilitado: `cursor-not-allowed` e 45%.
 *
 * `tamanho="xl"` é o campo da tela de Entrada (CTRL-02): 40px e 14px, ao lado
 * do `Button size="xl"`. Não é `size` porque `size` é atributo nativo do
 * `<input>` (a largura em caracteres).
 *
 * Campo que grava tem `<Label>`, não placeholder: o placeholder some quando a
 * pessoa começa a digitar, e com ele o que o campo pede.
 */
const TAMANHO_DO_CAMPO = {
  default: "h-ctrl rounded-ctrl px-2.5 text-[13px] file:text-[13px]",
  xl: "h-10 rounded-[10px] px-3.5 text-[14px] file:text-[14px]",
} as const

type TamanhoDoCampo = keyof typeof TAMANHO_DO_CAMPO

const CAMPO =
  "flex w-full min-w-0 border border-input bg-card py-1 text-foreground transition-colors duration-cor file:border-0 file:bg-transparent file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-45 aria-invalid:border-destructive"

/**
 * A classe do campo, para o controle NATIVO que não pode ser o `Input` — um
 * `<select>` ou `<textarea>` de formulário que se submete de uma vez. Ele
 * deriva daqui, nunca de uma cópia da lista (CTRL-01): cópia diverge na
 * altura e no contorno, e o contorno copiado costuma sair do token de controle.
 */
function classeDoCampo(tamanho: TamanhoDoCampo = "default") {
  return cn(CAMPO, TAMANHO_DO_CAMPO[tamanho])
}

function Input({
  className,
  type,
  tamanho = "default",
  ...props
}: React.ComponentProps<"input"> & { tamanho?: TamanhoDoCampo }) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(classeDoCampo(tamanho), className)}
      {...props}
    />
  )
}

export { Input, classeDoCampo, type TamanhoDoCampo }
