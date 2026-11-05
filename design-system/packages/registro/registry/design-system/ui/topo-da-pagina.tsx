"use client"

import * as React from "react"

import { COR_DO_TOM_DENSO, type Tom } from "@/registry/design-system/lib/idioma-de-cor"
import { cn } from "@/registry/design-system/lib/utils"
import { CASCO_DO_CARIMBO } from "@/registry/design-system/ui/chip-de-estado"
import { BarraDeModos, type ModoDoSeletor } from "@/registry/design-system/ui/seletor-de-vista"
import { Skeleton } from "@/registry/design-system/ui/skeleton"

/**
 * A PÁGINA dentro do casco (DESIGN LAY-01, LAY-02, LAY-03): o contêiner de
 * largura (`max-w-[100rem]`, 1600px), o respiro lateral de 24px e a coluna que
 * ocupa a altura do casco. O topo fica parado; quem rola é a região do
 * arquétipo, pela peça de rolagem do kit (`RolagemDoPainel`).
 *
 * `largura="formulario"`: o formulário longo, a `max-w-3xl`, alinhado à
 * esquerda (LAY-02).
 */
function PaginaDoApp({
  largura = "pagina",
  className,
  children,
}: {
  largura?: "pagina" | "formulario"
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      data-slot="pagina-do-app"
      className={cn(
        "flex h-full min-h-0 w-full flex-col gap-6 px-6 pt-6 pb-6",
        largura === "pagina" ? "mx-auto max-w-[100rem]" : "max-w-3xl",
        className
      )}
    >
      {children}
    </div>
  )
}

/** As três esperas da linha de valores: larguras diferentes, para não ler como um valor repetido. */
const LARGURAS_DA_ESPERA = ["w-16", "w-20", "w-14"] as const

type Desfecho = {
  tom: Extract<Tom, "ok" | "ruim" | "neutro">
  texto: string
  /** A saída do desfecho (MSG-06): a mesma ação, nunca uma cópia. */
  saida?: React.ReactNode
}

/**
 * Os recortes contados da Lista (ANATOMIA ARQ-05): situações que se sobrepõem
 * (um item pode estar em várias), um recorte por vez.
 */
type ResumoDoTopo<R extends string> = {
  /** O nome da fileira: escrito à vista em `t-rotulo` e nome do grupo, da mesma string. */
  rotulo: string
  /** TODOS os recortes do papel, na ordem da fonte, com `numero` (`null` enquanto conta) e `tom`. */
  recortes: ReadonlyArray<ModoDoSeletor<R>>
  /** `null`: sem recorte — a lista mostra tudo o que os filtros mostram. */
  valor: R | null
  /** Recebe a chave do recorte clicado, ou `null` quando se clica no ativo. */
  onTrocar: (chave: R | null) => void
}

/**
 * A fileira do `resumo`: o rótulo à vista (escondido do leitor, que ouve o
 * mesmo texto como nome do grupo) e a `BarraDeModos` em `modos`. Abaixo de
 * `sm`, o rótulo sobe e só a barra rola; ao montar, o recorte ativo vem à vista.
 */
function FileiraDoResumo<R extends string>({ rotulo, recortes, valor, onTrocar }: ResumoDoTopo<R>) {
  const rolagem = React.useRef<HTMLDivElement | null>(null)
  React.useEffect(() => {
    const el = rolagem.current
    const ativo = el?.querySelector<HTMLElement>('[aria-pressed="true"]')
    // Rola só a barra, e só quando ela não cabe: `scrollIntoView` moveria a página também.
    if (!el || !ativo || el.scrollWidth <= el.clientWidth) return
    el.scrollLeft = Math.max(0, ativo.offsetLeft - 8)
    // Só ao montar: depois, quem trocou o recorte já está com ele à vista.
  }, [])
  return (
    <div
      data-slot="resumo-do-topo"
      className="mt-1.5 flex min-w-0 items-center gap-2 max-sm:flex-col max-sm:items-start max-sm:gap-1.5"
    >
      <span aria-hidden="true" className="t-rotulo shrink-0">
        {rotulo}
      </span>
      <div ref={rolagem} className="max-w-full min-w-0 overflow-x-auto">
        <BarraDeModos
          rotulo={rotulo}
          densidade="modos"
          modos={recortes}
          valor={valor}
          onTrocar={(chave) => onTrocar(chave === valor ? null : chave)}
        />
      </div>
    </div>
  )
}

/**
 * O TOPO da página (ANATOMIA CASCO-01): o que muda quando a tela muda. De cima
 * para baixo — a trilha (só em tela de detalhe, CASCO-03), a linha do título
 * (o `h1`, um só, na voz `t-display` — TIPO-04; o estado do objeto; à direita
 * as secundárias, o primário e o `⋯`), a linha dos valores que classificam o
 * objeto (CASCO-04), o desfecho do último gesto do topo, os filtros que valem
 * para a tela inteira (a Lista) e, abaixo deles, os recortes contados.
 *
 * É a ÚNICA peça que escreve o `h1` da página. O primário é um só (PESO-01) e
 * vem em `lg`; a ação rara mora no `menu` (PRIN-03). O que vale igual em todas
 * as telas não mora aqui: é do cabeçalho do casco.
 *
 * `valores`: os `Badge` que classificam o objeto, na linha própria abaixo do
 * título (CASCO-04) — o estado tem voz e fica na linha do título; o valor não
 * tem, e não espreme o título. A linha quebra no estreito. Sem `valores`, a
 * linha não existe (nem quando todos os `Badge` saem vazios); `valores=
 * "carregando"` desenha três esqueletos com o casco do carimbo, na altura final
 * de uma linha de valores que cabe numa linha.
 *
 * `resumo`: os recortes contados da Lista (ARQ-05), abaixo dos filtros — cada
 * número conta o que os filtros mostram. A peça monta a fileira: o rótulo e o
 * nome do grupo saem da mesma string, um recorte por vez, e clicar no ativo
 * chama `onTrocar(null)`. Sem `resumo`, a linha não existe.
 */
function TopoDaPagina<R extends string = string>({
  trilha,
  titulo,
  estado,
  valores,
  secundarias,
  primario,
  menu,
  desfecho,
  filtros,
  resumo,
  className,
}: {
  trilha?: React.ReactNode
  titulo: string
  estado?: React.ReactNode
  valores?: React.ReactNode | "carregando"
  secundarias?: React.ReactNode
  primario?: React.ReactNode
  menu?: React.ReactNode
  desfecho?: Desfecho | null
  filtros?: React.ReactNode
  resumo?: ResumoDoTopo<R> | null
  className?: string
}) {
  const acoes = secundarias || primario || menu
  return (
    <header data-slot="topo-da-pagina" className={cn("flex shrink-0 flex-col gap-1.5", className)}>
      {trilha}
      <div className="flex min-h-9 items-center gap-3">
        <h1 className="t-display min-w-0 truncate text-foreground">{titulo}</h1>
        {estado}
        {acoes ? (
          <div data-slot="acoes-do-topo" className="ml-auto flex shrink-0 items-center gap-2">
            {secundarias}
            {primario}
            {menu}
          </div>
        ) : null}
      </div>
      {valores === "carregando" ? (
        <div data-slot="valores-do-topo" aria-hidden="true" className="flex flex-wrap items-center gap-2">
          {LARGURAS_DA_ESPERA.map((largura) => (
            <Skeleton key={largura} className={cn(CASCO_DO_CARIMBO, largura)}>
              {"\u00a0"}
            </Skeleton>
          ))}
        </div>
      ) : valores ? (
        <div data-slot="valores-do-topo" className="flex flex-wrap items-center gap-2 empty:hidden">
          {valores}
        </div>
      ) : null}
      {desfecho ? (
        <p
          role={desfecho.tom === "ruim" ? "alert" : "status"}
          data-slot="desfecho-do-topo"
          data-tom={desfecho.tom}
          className={cn("t-denso flex items-center gap-2", COR_DO_TOM_DENSO[desfecho.tom])}
        >
          {desfecho.texto}
          {desfecho.saida}
        </p>
      ) : null}
      {filtros ? (
        <div data-slot="filtros-do-topo" className="mt-1.5 flex items-center gap-3 [&>*]:min-w-0 [&>[data-slot=seletor-de-vista]]:shrink-0 [&>[data-slot=button]]:shrink-0">
          {filtros}
        </div>
      ) : null}
      {resumo ? <FileiraDoResumo {...resumo} /> : null}
    </header>
  )
}

export { PaginaDoApp, TopoDaPagina, type Desfecho, type ResumoDoTopo }
