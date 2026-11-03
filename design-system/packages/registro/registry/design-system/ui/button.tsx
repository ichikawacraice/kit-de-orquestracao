import * as React from "react"
import { Slot } from "radix-ui"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/registry/design-system/lib/utils"

/**
 * O botão da Wicomm (DESIGN CTRL-01, CTRL-02, CTRL-03).
 *
 * **A escala — e onde cada altura mora:**
 *
 * | `size` | altura | texto | onde |
 * |---|---|---|---|
 * | `sm` | 26px | 12px | cabeçalho de seção, ação de canto |
 * | `default` | 30px | 13px | barra de ferramentas, formulário — a altura do campo |
 * | `lg` | 36px | 14px | o primário da tela |
 * | `xl` | 44px | 14px | só a tela de Entrada (CTRL-02), ao lado do `Input tamanho="xl"` |
 * | `icon` | 30px | — | botão de ícone, redondo; leva `aria-label` |
 *
 * O `default` tem a altura do campo: botão e campo em linha alinham sem classe
 * à mão. Largura total não é prop — numa coluna `flex-col` o botão já estica.
 *
 * **As variantes são forma, não matiz** (CTRL-03):
 * - `default` é o PRIMÁRIO — preenchido com a marca, sem anel;
 * - `secondary` — superfície de cartão com o anel de controle;
 * - `outline` — transparente, tinta-2, anel de controle;
 * - `ghost` — transparente até o hover;
 * - `destructive` NUNCA é preenchido: contorno na tinta destrutiva (MARCA-05);
 * - `link` — tinta com sublinhado que fecha no hover, sem cor de marca.
 *
 * O anel é `--input` (`anel-de-controle`), que paga 3:1 contra a superfície
 * (COR-11). Nenhuma sombra: controle pequeno com sombra faz a barra levitar
 * (SUP-05). Foco: anel de 2px na marca com 2px de deslocamento (SUP-06).
 * Rótulo sem reticências (CTRL-07).
 *
 * `aria-disabled` tem a cara do `disabled`: é o botão em curso que guarda o
 * foco do teclado (o `disabled` o joga no `body`). Quem usa ignora o clique.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-[550] transition-colors duration-cor focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-[.42] aria-disabled:pointer-events-none aria-disabled:opacity-[.42] [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        secondary: "anel-de-controle bg-card text-foreground hover:bg-accent",
        outline:
          "anel-de-controle bg-transparent text-foreground-2 hover:bg-accent hover:text-foreground",
        ghost: "bg-transparent text-foreground-2 hover:bg-accent hover:text-foreground",
        destructive:
          "bg-transparent text-destructive shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--destructive)_38%,transparent)] hover:bg-destructive/10 hover:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--destructive)_60%,transparent)]",
        link: "text-foreground underline decoration-foreground/35 underline-offset-[2.5px] hover:decoration-current",
      },
      size: {
        default: "h-ctrl rounded-ctrl px-2.5 text-[13px]",
        sm: "h-[26px] rounded-md px-2 text-[12px]",
        lg: "h-9 rounded-ctrl px-3.5 text-[14px]",
        // A tela de Entrada (CTRL-02): 44px é também o alvo de toque de referência.
        xl: "h-11 rounded-xl px-5 text-[14px] [&_svg]:size-4",
        icon: "size-ctrl rounded-full p-0",
      },
    },
    compoundVariants: [
      // O link é texto, não controle: sem altura e sem recuo em qualquer tamanho.
      // Sem isto o `h-*`/`px-*` do tamanho vence no `cn`, e o link sai desalinhado.
      { variant: "link", class: "h-auto px-0" },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
