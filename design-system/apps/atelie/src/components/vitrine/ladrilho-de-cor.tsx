"use client"

import * as React from "react"

import { Comando } from "@/components/casco/comando"
import { Ficha, ParDaFicha } from "@/components/ui/ficha"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export type DadosDoLadrilho = {
  variavel: string
  papel: string
  classe: string
  /** `var:--x`, e `cores:x` quando é cor do Tailwind: o que o teste cruza com o tokens.json. */
  token: string
  claro: { valor: string; pintura: React.CSSProperties }
  escuro: { valor: string; pintura: React.CSSProperties }
  regra?: { codigo: string; href: string }
}

/**
 * Uma cor do tema: a amostra com a metade clara e a escura (a comparação é a
 * informação, MED-01), o nome e os dois valores. O clique abre o detalhe:
 * a classe para copiar, a variável e a regra que rege a cor.
 */
export function LadrilhoDeCor({ d }: { d: DadosDoLadrilho }) {
  const igual = d.claro.valor === d.escuro.valor
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-token={d.token}
          data-vitrine={d.variavel}
          className="flex min-w-0 flex-col gap-2 rounded-ctrl p-1.5 text-left transition-colors duration-cor hover:bg-accent focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span aria-hidden="true" className="flex h-12 overflow-hidden rounded-ctrl ring-1 ring-border">
            <span className="flex-1" style={d.claro.pintura} />
            <span className="flex-1" style={d.escuro.pintura} />
          </span>
          <span className="flex min-w-0 flex-col gap-0.5 px-0.5">
            <span className="t-medida truncate text-foreground">{d.variavel.slice(2)}</span>
            <span className={cn("t-medida truncate text-legenda text-muted-foreground")}>
              {igual ? d.claro.valor : `${d.claro.valor} · ${d.escuro.valor}`}
            </span>
            <span className="t-denso line-clamp-2 text-foreground-2">{d.papel}</span>
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="flex w-80 flex-col gap-3">
        <p className="t-titulo">{d.variavel.slice(2)}</p>
        <Ficha>
          <ParDaFicha rotulo="Papel">{d.papel}</ParDaFicha>
          <ParDaFicha rotulo="Variável" mono>{d.variavel}</ParDaFicha>
          <ParDaFicha rotulo="Claro" mono>{d.claro.valor}</ParDaFicha>
          <ParDaFicha rotulo="Escuro" mono>{d.escuro.valor}</ParDaFicha>
          {d.regra ? (
            <ParDaFicha rotulo="Regra" mono>
              <a href={d.regra.href} className="underline underline-offset-2">
                {d.regra.codigo}
              </a>
            </ParDaFicha>
          ) : null}
        </Ficha>
        <Comando texto={d.classe} />
      </PopoverContent>
    </Popover>
  )
}
