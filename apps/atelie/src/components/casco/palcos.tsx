"use client"

import * as React from "react"

import { PISO_DO_PALCO, TEMAS } from "@/catalogo/registro"
import { cn } from "@/lib/utils"

/**
 * Os dois temas lado a lado. Cada tema é um iframe: assim o que a peça abre por
 * portal (diálogo, menu, dica, aviso) também nasce no tema certo, e o claro não
 * herda nada do escuro. O bloco de tela pede a largura toda: `largo` empilha os
 * dois temas em vez de pô-los lado a lado.
 */
export function Palcos({ nome, titulo, largo = false }: { nome: string; titulo: string; largo?: boolean }) {
  return (
    <div className={cn("grid gap-4", !largo && "xl:grid-cols-2")}>
      {TEMAS.map((t) => (
        <UmPalco
          key={t.id}
          src={`/palco/${t.id}/${nome}/`}
          rotulo={`${titulo} no tema ${t.titulo.toLowerCase()}`}
          tema={t.titulo}
          piso={PISO_DO_PALCO[nome] ?? 0}
        />
      ))}
    </div>
  )
}

function UmPalco({ src, rotulo, tema, piso }: { src: string; rotulo: string; tema: string; piso: number }) {
  // Antes do primeiro aviso do palco, uma altura de espera; depois, a do conteúdo.
  const [altura, setAltura] = React.useState(Math.max(piso, 160))
  React.useEffect(() => {
    const aoReceber = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.data?.palco !== src) return
      setAltura(Math.max(piso, Number(e.data.altura) || 0))
    }
    window.addEventListener("message", aoReceber)
    return () => window.removeEventListener("message", aoReceber)
  }, [src, piso])
  return (
    <figure className="flex min-w-0 flex-col gap-2">
      <figcaption className="t-coluna">{tema}</figcaption>
      {/* A janela é diagrama, não peça: linha de 1px, sem sombra — a peça de dentro é que se levanta. */}
      <iframe src={src} title={rotulo} style={{ height: altura }} className="w-full rounded-cartao bg-background ring-1 ring-border" />
    </figure>
  )
}
