import { type ClassValue, clsx } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/**
 * O `cn` da Wicomm: o do shadcn, ensinado a ler os nomes do tema Wicomm.
 *
 * Sem isto, o `tailwind-merge` erra calado em dois sentidos. Lê `text-legenda`
 * como COR e o apaga quando uma cor vem depois (`cn("text-legenda",
 * "text-muted-foreground")`), e não sabe que `rounded-ctrl` e `rounded-md`
 * disputam o mesmo canto — os dois ficam, e ganha o que o CSS declarar por
 * último, não o que quem chama passou por último.
 */
// `superficie` e `voz` são grupos novos: cada um desenha a mesma coisa de um
// jeito, então o último passado ganha, como numa classe do próprio Tailwind.
const twMerge = extendTailwindMerge<"superficie" | "voz">({
  extend: {
    theme: {
      text: ["legenda", "controle"],
      radius: ["ctrl", "painel", "cartao", "badge"],
      ease: ["abre", "fecha"],
      shadow: ["linha-ativa"],
      container: ["medida"],
    },
    classGroups: {
      h: ["h-ctrl"],
      size: ["size-ctrl"],
      duration: [
        {
          duration: [
            "modal-abre",
            "modal-fecha",
            "menu-abre",
            "menu-fecha",
            "dica",
            "painel",
            "dobra-abre",
            "dobra-fecha",
            "cor",
            "revela",
          ],
        },
      ],
      delay: [{ delay: ["veu", "espiada-abre", "espiada-fecha"] }],
      superficie: ["superficie", "superficie-alta", "superficie-flutuante"],
      voz: ["t-display", "t-titulo", "t-denso", "t-rotulo", "t-coluna", "t-campo", "t-medida"],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
