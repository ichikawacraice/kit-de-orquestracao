"use client"

import * as React from "react"

import { COR_DO_TOM_DENSO, type Tom } from "@/registry/wicomm/lib/idioma-de-cor"
import { cn } from "@/registry/wicomm/lib/utils"

/**
 * A troca de vista (DESIGN CTRL-06): aba de tela e barra de modos são o MESMO
 * controle em duas densidades — a trilha de tinta e a pílula levantada que
 * desliza até o ativo.
 *
 * - A trilha é degrau de TINTA (`bg-foreground/[0.08]`, uma classe para os dois
 *   temas), e a pílula é a peça (`bg-card` + a sombra de superfície).
 * - **Quem carrega o estado é o TEXTO** (`foreground-2` → `foreground` + 650):
 *   a pílula contra a trilha mede ~1,2:1, e nenhuma superfície sutil pagaria os
 *   3:1 de objeto gráfico. O texto já diz o ativo antes de a pílula ser medida.
 * - `abas` (30px) troca o PAINEL: `role="tablist"`, item `tab` com
 *   `aria-selected`. `modos` (24px) troca o DESENHO do mesmo conteúdo:
 *   `role="group"`, item com `aria-pressed` — chamar de aba mentiria.
 * - A pílula anima posição e largura, nunca cor, e não anda para quem pediu
 *   menos movimento.
 */
const DENSIDADE = {
  abas: { item: "h-ctrl gap-1.5 px-3 text-[13px]" },
  modos: { item: "h-6 gap-1 px-2.5 text-[12px]" },
} as const

type DensidadeDoSeletor = keyof typeof DENSIDADE

const ITEM =
  "relative z-10 inline-flex select-none items-center justify-center whitespace-nowrap rounded-md font-medium text-foreground-2 transition-colors duration-cor hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"

const ITEM_ATIVO = "font-[650] text-foreground"

type Caixa = { left: number; top: number; width: number; height: number }

function usePilula(seletorDoAtivo: string, valor: string) {
  const trilha = React.useRef<HTMLDivElement | null>(null)
  const [caixa, setCaixa] = React.useState<Caixa | null>(null)
  React.useLayoutEffect(() => {
    const el = trilha.current
    if (!el) return
    const medir = () => {
      const ativo = el.querySelector<HTMLElement>(seletorDoAtivo)
      setCaixa(ativo ? { left: ativo.offsetLeft, top: ativo.offsetTop, width: ativo.offsetWidth, height: ativo.offsetHeight } : null)
    }
    medir()
    // Sem `ResizeObserver` (jsdom), a pílula ainda é medida na montagem e a cada troca de ativo.
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(medir)
    if (ro) {
      ro.observe(el)
      for (const filho of Array.from(el.children)) ro.observe(filho)
    }
    return () => ro?.disconnect()
  }, [seletorDoAtivo, valor])
  return { trilha, caixa }
}

type ModoDoSeletor<T extends string> = {
  chave: T
  rotulo: string
  icone?: React.ComponentType<{ className?: string }>
  /**
   * A contagem do modo, no mesmo botão do rótulo. `0` desenha `0` (EST-04);
   * `null` desenha `—`, o não contado (ainda carregando); ausente não desenha nada.
   */
  numero?: number | null
  /** A voz do número, só quando ele passa de zero: zero não pede nada. */
  tom?: Tom
}

function BarraDeModos<T extends string>({
  rotulo,
  modos,
  valor,
  onTrocar,
  densidade = "modos",
  className,
}: {
  /** O nome do grupo: o que se está escolhendo. */
  rotulo: string
  modos: ReadonlyArray<ModoDoSeletor<T>>
  /** `null`: nenhum modo escolhido (a busca que cruza os modos). */
  valor: T | null
  onTrocar: (chave: T) => void
  densidade?: DensidadeDoSeletor
  className?: string
}) {
  const abas = densidade === "abas"
  const seletorDoAtivo = abas ? '[aria-selected="true"]' : '[aria-pressed="true"]'
  const { trilha, caixa } = usePilula(seletorDoAtivo, String(valor))

  // Setas movem a escolha entre os itens (o padrão de `tablist`); Home e End vão às pontas.
  const aoTeclar = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!abas) return
    const i = Math.max(0, modos.findIndex((m) => m.chave === valor))
    const alvo =
      e.key === "ArrowRight" ? (i + 1) % modos.length
      : e.key === "ArrowLeft" ? (i - 1 + modos.length) % modos.length
      : e.key === "Home" ? 0
      : e.key === "End" ? modos.length - 1
      : -1
    const modo = modos[alvo]
    if (!modo) return
    e.preventDefault()
    onTrocar(modo.chave)
    trilha.current?.querySelectorAll<HTMLElement>("button")[alvo]?.focus()
  }

  return (
    <div
      ref={trilha}
      role={abas ? "tablist" : "group"}
      aria-label={rotulo}
      data-slot="seletor-de-vista"
      data-densidade={densidade}
      onKeyDown={aoTeclar}
      className={cn("relative inline-flex w-fit items-center rounded-[9px] bg-foreground/[0.08] p-[3px]", className)}
    >
      {caixa ? (
        <span
          aria-hidden="true"
          data-slot="pilula-do-seletor"
          className="absolute top-0 left-0 rounded-md bg-card [box-shadow:var(--superficie-sombra)] transition-[transform,width] duration-painel ease-abre motion-reduce:transition-none"
          style={{ width: caixa.width, height: caixa.height, transform: `translate(${caixa.left}px, ${caixa.top}px)` }}
        />
      ) : null}
      {modos.map((m, indice) => {
        const ativo = m.chave === valor
        const Icone = m.icone
        // O não contado é o travessão numérico (U+2012), da largura de um algarismo: a barra não muda de largura quando a contagem chega.
        const numero = m.numero === undefined ? undefined : m.numero === null ? "‒" : String(m.numero)
        return (
          <button
            key={m.chave}
            type="button"
            {...(abas ? { role: "tab", "aria-selected": ativo, tabIndex: ativo || (valor === null && indice === 0) ? 0 : -1 } : { "aria-pressed": ativo })}
            // Sem a vírgula o leitor ouviria "Pedem você3": o nome acessível junta os dois spans sem espaço.
            aria-label={numero === undefined ? undefined : `${m.rotulo}, ${m.numero === null ? "sem contagem" : numero}`}
            onClick={() => onTrocar(m.chave)}
            className={cn(ITEM, DENSIDADE[densidade].item, ativo && ITEM_ATIVO)}
          >
            {Icone ? <Icone className="size-3.5 shrink-0" /> : null}
            <span>{m.rotulo}</span>
            {numero === undefined ? null : (
              <span
                data-slot="numero-do-modo"
                className={cn(
                  "inline-block min-w-[1ch] text-center font-mono tabular-nums",
                  m.tom && typeof m.numero === "number" && m.numero > 0 ? COR_DO_TOM_DENSO[m.tom] : "text-muted-foreground"
                )}
              >
                {numero}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export { BarraDeModos, type DensidadeDoSeletor, type ModoDoSeletor }
