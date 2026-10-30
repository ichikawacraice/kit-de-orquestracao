import * as React from "react"

import { TINTA_DO_TOM, type Tom } from "@/registry/wicomm/lib/idioma-de-cor"
import { cn } from "@/registry/wicomm/lib/utils"

/**
 * O BLOCO DE TINTA — o que seria um cartão dentro de um cartão, e é um DEGRAU de
 * tinta sem contorno nenhum (DESIGN SUP-03): uma pergunta, uma pendência, um
 * achado.
 *
 * `14px 16px` de respiro, raio de agrupador (12px, FORMA-01), e a cor sai da
 * VOZ (COR-03): `neutro` é o degrau afundado do tema; `espera` a decisão que
 * espera você; `alheio` a pendência que está com outra pessoa. A cor da voz já
 * diz onde o bloco começa e termina — por isso não há borda, e por isso ele não
 * é superfície: peça dentro de peça é o que o sistema proíbe (SUP-01).
 *
 * Dois blocos seguidos se separam por 12px (`gap-3` no pai). `medida` limita à
 * largura de leitura (78ch). `densidade="compacta"` é o respiro de coluna
 * estreita (`12px 8px`).
 */
function BlocoDeTinta({
  tom = "neutro",
  medida = false,
  densidade = "normal",
  className,
  ...props
}: React.ComponentProps<"div"> & {
  tom?: Tom
  medida?: boolean
  densidade?: "normal" | "compacta"
}) {
  return (
    <div
      data-slot="bloco-de-tinta"
      data-tom={tom}
      className={cn(
        "rounded-xl",
        densidade === "compacta" ? "px-3 py-2" : "px-4 py-3.5",
        TINTA_DO_TOM[tom],
        medida && "max-w-medida",
        className
      )}
      {...props}
    />
  )
}

/** O texto principal do bloco: 13,5px, entrelinha 1,55. */
function TextoDoBloco({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="texto-do-bloco" className={cn("text-[13.5px] leading-[1.55] text-foreground", className)} {...props} />
}

/** A linha secundária do bloco: quem escreveu e quando, a decisão provisória. 12px, tinta-2, 7px abaixo do texto. */
function NotaDoBloco({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="nota-do-bloco" className={cn("mt-[7px] text-xs text-foreground-2", className)} {...props} />
}

/**
 * O GRUPO DE TINTA — vários itens sob um rótulo, todos dentro da MESMA tinta de
 * voz.
 *
 * Um grupo de itens que compartilham um desfecho é uma coisa só, e tingir item
 * por item diz isso pior: com a tinta em cada um o olho lê *N coisas amarelas*;
 * com a tinta em volta lê *este grupo espera você*. O rótulo mora DENTRO da
 * tinta; os itens de dentro ficam em tinta neutra (`bg-muted`), que sobre a
 * tinta da voz lê como degrau, não como segunda cor.
 */
function GrupoDeTinta({
  tom,
  titulo,
  nivel = 4,
  contagem,
  acao,
  nome,
  className,
  children,
}: {
  tom: Tom
  titulo: string
  nivel?: 3 | 4 | 5
  /** O que qualifica o grupo — a contagem, em mono. */
  contagem?: React.ReactNode
  /** O que pertence ao cabeçalho do grupo: um carimbo, um botão `sm`. */
  acao?: React.ReactNode
  nome?: string
  className?: string
  children: React.ReactNode
}) {
  const H = `h${nivel}` as "h3" | "h4" | "h5"
  return (
    <section
      data-slot="grupo-de-tinta"
      data-secao={nome ?? ""}
      data-tom={tom}
      className={cn("rounded-xl px-4 py-3.5", TINTA_DO_TOM[tom], className)}
    >
      <header className="mb-3 flex items-center gap-[9px]">
        <H className="t-rotulo">{titulo}</H>
        {/* A contagem usa o degrau do MEIO da rampa (`foreground-2`), não o
            terceiro: aqui o fundo é sempre tinta de voz, e sobre ela o terceiro
            fica abaixo do piso de contraste (COR-14). */}
        {contagem !== undefined && contagem !== null ? (
          <span data-slot="contagem-do-grupo" className="font-mono text-[11px] text-foreground-2">
            {contagem}
          </span>
        ) : null}
        {acao ? <span className="ml-auto flex items-center gap-1.5">{acao}</span> : null}
      </header>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  )
}

export { BlocoDeTinta, GrupoDeTinta, NotaDoBloco, TextoDoBloco }
