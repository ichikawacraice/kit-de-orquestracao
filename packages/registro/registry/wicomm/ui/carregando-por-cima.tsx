"use client"

import * as React from "react"
import { LoaderCircleIcon } from "lucide-react"

import { cn } from "@/registry/wicomm/lib/utils"

/** A espera que não se mostra (DESIGN MOV-03): troca mais rápida que isso não pisca. */
const ESPERA_DO_VEU = 120

/**
 * A troca de contexto (ANATOMIA PECA-01, MSG-01): o que está na região deixou
 * de valer até o novo chegar ("Abrindo a versão"). Não é a espera do primeiro
 * carregamento — essa é o `Skeleton`.
 *
 * É um invólucro: desenha a região (`relative`), os filhos e o véu por cima,
 * na camada da própria região (LAY-05) — diálogo e menu, que saem por portal,
 * passam por cima. Envolve a região que mente (o conteúdo da página, as
 * colunas do Editor) POR FORA da rolagem, **nunca o casco**. A cadeia de flex
 * passa pela peça (`flex min-h-0 flex-col`): o `flex-1` dos filhos segue valendo: destinos, conta e tema valem em
 * qualquer contexto, e a pessoa precisa de uma saída.
 *
 * - Desde o primeiro instante de `ativo`, os filhos ficam `inert` e
 *   `aria-busy`: o Tab não chega a um botão do contexto velho.
 * - O véu e a frase só aparecem passados 120ms, por um relógio da peça — o
 *   atraso do CSS sumiria junto com a animação para quem pede menos movimento.
 *   Volta a `false` antes disso, e nada aparece nem é anunciado.
 * - O véu é opaco a 80%, sem desfoque (SUP-02); a frase mora num cartão
 *   flutuante, com o círculo de em curso (COR-04). Sai seco (MOV-03).
 *
 * A peça não mostra erro: ela sai, e a falha vai ao bloco do gatilho (MSG-04).
 */
function CarregandoPorCima({
  ativo,
  frase,
  className,
  children,
}: {
  ativo: boolean
  /** O que está acontecendo, sem reticências: "Abrindo a versão". */
  frase: string
  className?: string
  children: React.ReactNode
}) {
  const [visivel, setVisivel] = React.useState(false)
  const cartao = React.useRef<HTMLDivElement>(null)
  const regiao = React.useRef<HTMLDivElement>(null)
  const focoEstavaDentro = React.useRef(false)

  React.useEffect(() => {
    if (!ativo) return
    focoEstavaDentro.current = !!regiao.current?.contains(document.activeElement)
    const relogio = setTimeout(() => setVisivel(true), ESPERA_DO_VEU)
    // Ao desligar, o véu sai seco: a limpeza o esconde (e o relógio que não venceu não o mostra).
    return () => {
      clearTimeout(relogio)
      setVisivel(false)
    }
  }, [ativo])

  // O foco que estava dentro vai ao cartão enquanto a região está inerte, e volta à região quando ela vale de novo.
  React.useEffect(() => {
    if (!focoEstavaDentro.current) return
    if (visivel) cartao.current?.focus()
    else if (!ativo) {
      focoEstavaDentro.current = false
      regiao.current?.focus()
    }
  }, [visivel, ativo])

  return (
    <div data-slot="carregando-por-cima" className={cn("relative flex min-h-0 flex-col", className)}>
      <div ref={regiao} tabIndex={-1} inert={ativo || undefined} aria-busy={ativo || undefined} className="flex min-h-0 flex-1 flex-col outline-hidden">
        {children}
      </div>
      {visivel ? (
        <div data-slot="veu-de-carregamento" className="absolute inset-0 z-10 grid place-items-center bg-background/80 animate-in fade-in-0 duration-revela ease-abre motion-reduce:animate-none">
          <div
            ref={cartao}
            tabIndex={-1}
            data-superficie
            className="superficie-flutuante flex items-center gap-2 rounded-xl px-4 py-3 outline-hidden"
          >
            <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin text-muted-foreground motion-reduce:animate-none" />
            <span className="t-denso text-foreground-2">{frase}</span>
          </div>
        </div>
      ) : null}
      {/* A região viva existe desde a montagem e recebe a frase aos 120ms: assim ela é anunciada. */}
      <span role="status" aria-live="polite" className="sr-only">
        {visivel ? frase : ""}
      </span>
    </div>
  )
}

export { CarregandoPorCima }
