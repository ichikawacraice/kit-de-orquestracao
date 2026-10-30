import * as React from "react"

import { cn } from "@/registry/wicomm/lib/utils"

/**
 * A SEÇÃO — o assunto dentro de um painel ou cartão, separado do vizinho por AR
 * e RÓTULO, nunca por linha (DESIGN SUP-03).
 *
 * A régua: **30px acima do rótulo contra 12px abaixo** — dois e meio para um
 * (LAY-03). É essa razão que faz o olho ler "aqui começa outro assunto" sem um
 * filete; com 16 acima e 12 abaixo as seções se confundem.
 *
 * O cabeçalho é UMA linha: o rótulo na voz `t-rotulo`, a contagem em mono ao
 * lado quando houver (`6/7`, `1 guardado`), e a ação de canto empurrada para a
 * direita. O rótulo é `h3` por padrão, porque a seção mora numa peça que já tem
 * o seu `h2`; quem a usa solta passa `nivel={2}`.
 *
 * `primeira`: a primeira seção de uma peça não recebe os 30px de cima — a borda
 * da peça já a separa.
 *
 * `filete`: um fio acima no lugar do ar, só para pilha LONGA de temas CURTOS
 * numa coluna estreita, onde 30px de ar entre coisas de 40px deixam de ler
 * como fronteira. O fio é tinta a 14% (compõe sobre qualquer superfície em que
 * cai) e fica a 24px do texto dos dois lados.
 *
 * `data-secao` sai sempre, vazio sem `nome`: âncora de medição que depende de
 * prop opcional mede um subconjunto e afirma o todo.
 */
function Secao({
  titulo,
  contagem,
  acao,
  nome,
  nivel = 3,
  primeira = false,
  filete = false,
  medida = false,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"section">, "title"> & {
  titulo: string
  /** O que qualifica o assunto — `6/7`, `1 guardado`. Medida vem em mono. */
  contagem?: React.ReactNode
  /** O que pertence ao cabeçalho e não ao conteúdo: um botão `size="sm"`, um link. */
  acao?: React.ReactNode
  /** Vira o `id` (âncora de navegação) e o `data-secao`. */
  nome?: string
  nivel?: 2 | 3 | 4
  primeira?: boolean
  filete?: boolean
  /** A largura de leitura do corpo (`max-w-medida`, 78ch — LAY-06). */
  medida?: boolean
}) {
  const H = `h${nivel}` as "h2" | "h3" | "h4"
  return (
    <section
      data-slot="secao"
      id={nome}
      data-secao={nome ?? ""}
      data-filete={filete ? "true" : undefined}
      className={cn(!primeira && (filete ? "mt-6 border-t border-foreground/[0.14] pt-6" : "mt-[30px]"), className)}
      {...props}
    >
      <header className="mb-3 flex items-center gap-[9px]">
        <H className="t-rotulo">{titulo}</H>
        {contagem !== undefined && contagem !== null ? (
          <span data-slot="contagem-da-secao" className="font-mono text-[11px] text-muted-foreground">
            {contagem}
          </span>
        ) : null}
        {acao ? <span className="ml-auto flex items-center gap-1.5">{acao}</span> : null}
      </header>
      {/* O ritmo DENTRO da seção é 12px — um quarto dos 30px que separam duas seções. */}
      <div className={cn("flex flex-col gap-3", medida && "max-w-medida")}>{children}</div>
    </section>
  )
}

/**
 * O TOPO de um painel: o rótulo do painel inteiro e, à direita, o que governa o
 * painel (botões, um estado).
 *
 * `solto`: o mesmo topo SEM painel embaixo — o rótulo de uma coluna que é uma
 * pilha de peças, não uma peça só. A coluna nomeia; os cartões abaixo é que são
 * superfície.
 */
function TopoDoPainel({
  titulo,
  solto = false,
  className,
  children,
}: {
  titulo: string
  solto?: boolean
  className?: string
  children?: React.ReactNode
}) {
  return (
    <div
      data-slot="topo-do-painel"
      data-solto={solto ? "true" : undefined}
      className={cn("flex shrink-0 items-center gap-2", solto ? "px-2 pt-0 pb-2" : "px-[15px] pt-[13px] pb-[9px]", className)}
    >
      <span className="t-rotulo">{titulo}</span>
      {children ? <span className="ml-auto flex items-center gap-[7px]">{children}</span> : null}
    </div>
  )
}

export { Secao, TopoDoPainel }
