import * as React from "react"
import { CircleAlertIcon } from "lucide-react"

import { BADGE_DO_TOM } from "@/registry/design-system/lib/idioma-de-cor"
import { CASCO_DO_CARIMBO, GESTO_DO_CARIMBO } from "@/registry/design-system/ui/chip-de-estado"
import { cn } from "@/registry/design-system/lib/utils"

/** 0 é *sem prioridade*; 1 a 3, baixa a alta; `urgente` tem glifo próprio. */
type NivelDaPrioridade = 0 | 1 | 2 | 3 | "urgente"

const ALTURA_DA_BARRA = ["h-1", "h-1.75", "h-2.5"] as const

/**
 * A cor do nível (COR-09): identidade declarada, num lugar só — esta peça —,
 * que pinta o glifo e a palavra do carimbo neutro. A urgente não entra: ela
 * fala na voz `espera`. Os degraus são contraste medido sobre a tinta do
 * carimbo neutro: no claro, sky-700 5,1, orange-800 6,3 e red-700 5,6 sobre o
 * cartão (o orange-700 cairia a 4,47); no escuro, os 400 passam de 5 (o red-400,
 * o menor, mede 5,05). Nenhuma família é de voz: o âmbar é da `espera`, e a
 * média em âmbar diria "decisão sua" (COR-09).
 */
const COR_DO_NIVEL: Record<1 | 2 | 3, string> = {
  1: "text-sky-700 dark:text-sky-400",
  2: "text-orange-800 dark:text-orange-400",
  3: "text-red-700 dark:text-red-400",
}

/** A forma do carimbo ligado: o sublinhado do gesto fecha em linha cheia e engrossa; contorno, nunca (CTRL-05). */
const SELECIONADO_DO_CARIMBO = "aria-pressed:[text-decoration-color:currentcolor] aria-pressed:decoration-2"

/**
 * A prioridade de um item (ANATOMIA PECA-01): um carimbo, no casco de todo
 * carimbo (CTRL-05), com o glifo de barras e a palavra. A cor responde uma
 * pergunta só — *o que isto pede de você?* (COR-03) —, e a prioridade só pede
 * quando é urgente: a urgente fala na voz `espera`, com o glifo próprio; as
 * outras são o carimbo neutro, e o nível se distingue pela forma do glifo e
 * pela cor declarada do nível (COR-09), na palavra e nas barras cheias, que
 * pintam com `bg-current`. A palavra vem sempre (COR-08).
 *
 * Com `onAbrir`, o carimbo aplica o recorte pelo nível, no gesto do
 * `ChipQueAbre`. Na contagem, o zero é `zerada`: a forma do nível, sem a cor
 * (a cor do nível só existe dentro do carimbo, e não num zero) e sem gesto.
 *
 * O nível que significa *normal*, quando o projeto tem um, não se mostra
 * (PRIN-04): carimbo que diz *nada de especial* é ruído em cada cartão.
 */
function Prioridade({
  nivel,
  onAbrir,
  onDesligar,
  ativo,
  zerada = false,
  className,
  children,
}: {
  nivel: NivelDaPrioridade
  /**
   * Aplica o recorte pelo nível (a contagem que filtra): o carimbo vira botão,
   * com o gesto do `ChipQueAbre` (CTRL-03). O nome acessível é a palavra
   * visível; quem chama escreve o número e a palavra ("3 altas").
   */
  onAbrir?: () => void
  /**
   * O recorte está ligado por este carimbo. Só vale com `onAbrir`: o botão ganha
   * `aria-pressed` e a forma de selecionado (o sublinhado fecha em linha cheia e
   * mais grossa, sem contorno: CTRL-05), e o clique no ativo desliga o recorte,
   * como a `FileiraDoResumo` do topo (ARQ-05). Sem `ativo`, o botão não é de alternância
   * e não leva `aria-pressed`; `ativo={false}` é o desligado de quem alterna.
   */
  ativo?: boolean
  /**
   * O que o clique no carimbo `ativo` chama. Sem ele, o clique chama o
   * `onAbrir`. Por que não `onAbrir(null)`: o carimbo não tem chave para
   * passar, e o `onAbrir` já é `() => void`.
   */
  onDesligar?: () => void
  /**
   * O zero de uma contagem: a forma do nível, sem a cor (COR-09) e sem gesto —
   * não há recorte para abrir. Ignora o `onAbrir`, salvo com `ativo`: o recorte ligado que caiu a zero
   * continua um botão apertado, para desligar (ARQ-05).
   */
  zerada?: boolean
  className?: string
  /** A palavra: "Alta", "Urgente", "3 altas". */
  children: string
}) {
  const urgente = nivel === "urgente"
  // A zerada ignora o onAbrir, salvo a que está ligada: o recorte que caiu a zero continua ativo e se desliga por ela (ARQ-05).
  const abre = onAbrir !== undefined && (!zerada || ativo === true)
  const conteudo = (
    <>
      {urgente ? (
        <CircleAlertIcon aria-hidden="true" className="size-3 shrink-0" />
      ) : (
        <span aria-hidden="true" className="flex size-2.75 shrink-0 items-end justify-center gap-px">
          {ALTURA_DA_BARRA.map((altura, i) => (
            <span
              key={altura}
              className={cn("w-0.5 rounded-full", altura, i < nivel ? "bg-current" : "bg-current opacity-25")}
            />
          ))}
        </span>
      )}
      {children}
    </>
  )
  const classe = cn(
    CASCO_DO_CARIMBO,
    BADGE_DO_TOM[urgente && !zerada ? "espera" : "neutro"],
    !urgente && !zerada && nivel > 0 && COR_DO_NIVEL[nivel as 1 | 2 | 3],
    abre && GESTO_DO_CARIMBO,
    abre && ativo !== undefined && SELECIONADO_DO_CARIMBO,
    className,
  )
  if (abre) {
    return (
      <button
        type="button"
        data-slot="prioridade"
        data-nivel={nivel}
        aria-pressed={ativo}
        onClick={ativo && onDesligar ? onDesligar : onAbrir}
        className={classe}
      >
        {conteudo}
      </button>
    )
  }
  return (
    <span data-slot="prioridade" data-nivel={nivel} data-zerada={zerada || undefined} className={classe}>
      {conteudo}
    </span>
  )
}

export { Prioridade, COR_DO_NIVEL, type NivelDaPrioridade }
