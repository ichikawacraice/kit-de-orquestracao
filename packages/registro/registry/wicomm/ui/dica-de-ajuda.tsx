"use client"

import * as React from "react"
import { InfoIcon } from "lucide-react"

import { Button } from "@/registry/wicomm/ui/button"
import { Ajuda } from "@/registry/wicomm/ui/tooltip"
import { cn } from "@/registry/wicomm/lib/utils"

/**
 * O nome do ⓘ de um campo: "Sobre <rótulo>". Só a primeira letra desce, e só
 * quando a segunda também é minúscula — "URL" e "SKU" ficam como estão.
 */
function rotuloSobre(curto: string): string {
  const baixa = /^[A-ZÀ-Ý][a-zà-ÿ]/.test(curto) ? curto.charAt(0).toLowerCase() + curto.slice(1) : curto
  return `Sobre ${baixa}`
}

/**
 * O ⓘ: a ajuda que NÃO gera decisão mora aqui, ao lado do controle que ela
 * explica, e aparece no hover, no foco e no toque. O que gera decisão (trava,
 * erro) fica à vista, não neste ícone.
 *
 * Com `id`, o texto também mora num `sr-only` com esse id, para o controle
 * apontá-lo no `aria-describedby` (a dica só existe aberta).
 */
function DicaDeAjuda({
  texto,
  rotulo,
  id,
  lado = "bottom",
  className,
}: {
  texto: string
  /** O nome acessível do botão: o que o ícone abre (`rotuloSobre("Prazo")`). */
  rotulo: string
  id?: string
  lado?: "top" | "right" | "bottom" | "left"
  className?: string
}) {
  // Abre por hover e foco (o Radix) e também por toque, onde o clique alterna.
  // Dentro de um gesto (do pointerdown ao fim do click) quem decide é só o click:
  // no toque o navegador manda pointerup, mousedown, focus, click — o focus
  // abriria a dica e o click, alternando, a fecharia no primeiro toque. Fora do
  // gesto o Radix segue valendo: hover e Tab abrem, Esc e blur fecham.
  const [aberto, setAberto] = React.useState(false)
  const noGesto = React.useRef(false)
  const encerrar = (ms: number) => {
    setTimeout(() => {
      noGesto.current = false
    }, ms)
  }
  const mudou = (o: boolean) => {
    if (noGesto.current) return
    setAberto(o)
  }
  return (
    <>
      <Ajuda texto={texto} lado={lado} aberto={aberto} aoMudarAberto={mudou}>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          data-slot="dica-de-ajuda"
          className={cn("text-muted-foreground hover:text-foreground focus-visible:text-foreground", className)}
          onPointerDown={() => {
            noGesto.current = true
          }}
          // O focus e o click ainda vêm depois do pointerup; sem click (o dedo saiu do botão) o gesto acaba logo depois.
          onPointerUp={() => encerrar(300)}
          onPointerCancel={() => encerrar(0)}
          onClick={() => {
            setAberto((a) => !a)
            encerrar(0)
          }}
          aria-label={rotulo}
          {...(id ? { "aria-describedby": id } : {})}
        >
          <InfoIcon aria-hidden />
        </Button>
      </Ajuda>
      {id ? (
        <span id={id} className="sr-only">
          {texto}
        </span>
      ) : null}
    </>
  )
}

export { DicaDeAjuda, rotuloSobre }
