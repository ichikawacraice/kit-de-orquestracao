"use client"

import * as React from "react"

import { LinkDoApp, type PropsDoLink } from "@/registry/design-system/lib/link-do-app"
import { cn } from "@/registry/design-system/lib/utils"

type Densidade = "instrumento" | "site"

const DensidadeDaTabela = React.createContext<Densidade>("instrumento")

/** A densidade da tabela em volta: as células e a `LinhaDoGrupo` medem por ela. */
function useDensidadeDaTabela() {
  return React.useContext(DensidadeDaTabela)
}

/**
 * A tabela (table do shadcn). A `densidade` é da tabela inteira: instrumento
 * (corpo `t-denso`, linha de 40px no mínimo) ou site (`text-sm`, 48px no
 * mínimo); `Pessoa`, `Prazo` e `EscolhaNaCelula` dentro dela medem por ela. O
 * cabeçalho de coluna fala na voz `t-coluna` (TIPO-02), tem 40px e fecha numa
 * régua de 1px `border` de ponta a ponta, sem fundo; gruda no topo da rolagem
 * com ela.
 *
 * **A linha se separa da vizinha pelo ar** (SUP-03): a célula guarda 6px em
 * cima e embaixo (8px no site) e cresce com o conteúdo — duas linhas de texto
 * dão 48px, nunca espremidas em 40. **O filete-guia** leva o olho do nome ao
 * valor do outro lado: 1px `border` no meio desse ar, do x do texto até 12px
 * antes do fim, nunca depois da última linha. É da peça: a tela não escreve
 * `divide-y` nem `border-b` na linha. Sem zebra: linha demais vira grade, e
 * grade é planilha. O hover acende as células com o raio do anel de foco, para
 * a linha acesa ter a forma do que o teclado marca, e apaga o filete dela e o
 * da de cima.
 *
 * Mora dentro de uma superfície (um `Painel` com `RolagemDoPainel`), que é quem
 * rola; por isso não traz o invólucro de rolagem do shadcn.
 *
 * A linha que abre um objeto tem um `LinkDaLinha` na primeira célula: o link se
 * estica sobre a linha inteira (o alvo é a linha), e o nome acessível é o dele.
 */
function Table({
  className,
  densidade = "instrumento",
  ...props
}: React.ComponentProps<"table"> & { densidade?: Densidade }) {
  // `border-separate`: com `collapse`, o raio da célula acesa não se desenha (a tabela não tem borda). Com coluna que
  // some no celular, o layout é fixo abaixo de 640px: no automático a coluna escondida não chega a largura zero e a
  // tabela transborda o painel.
  return (
    <DensidadeDaTabela.Provider value={densidade}>
      <table
        data-slot="table"
        data-densidade={densidade}
        // Com grupos, a primeira coluna do cabeçalho recua junto com as linhas (até o nome do grupo).
        className={cn(
          "w-full caption-bottom border-separate border-spacing-0 max-sm:[&:has([data-some-no-celular])]:table-fixed [&:has(>[data-slot=linha-do-grupo])>thead>tr>th:first-child]:pl-8 [&:has(>tbody[data-com-identidade])>thead>tr>th:first-child]:pl-[46px]",
          className
        )}
        {...props}
      />
    </DensidadeDaTabela.Provider>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={cn("sticky top-0 z-10 bg-card", className)} {...props} />
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" className={className} {...props} />
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      // `relative`: âncora do link esticado (`LinkDaLinha`). O hover marca a linha que vai abrir, pintando as células; ele
      // apaga o filete dela e o da de cima, para o fundo arredondado não sair cortado. A última do corpo não tem filete.
      className={cn(
        "relative [tbody_&]:hover:[&>td]:bg-accent",
        className
      )}
      {...props}
    />
  )
}

/**
 * A coluna que some abaixo de 640px (`esconderNoCelular`, no `TableHead` e em
 * cada `TableCell` dela): fica com largura zero, não com `hidden` — assim as
 * outras células não trocam de coluna. Na `LinhaDoGrupo`, a célula sob ela vai
 * com `{ conteudo, esconderNoCelular: true }`. A `Table` com coluna assim passa
 * a layout fixo no celular sozinha: a tela não escreve `table-fixed` por isso.
 * No fixo, as colunas sem largura dividem por igual o que sobra: a que tem
 * conteúdo que não quebra (`Estado`, `Pessoa`, `Prazo`) leva `max-sm:w-*` no
 * `TableHead`.
 */
const SOME_NO_CELULAR = "max-sm:invisible max-sm:w-0 max-sm:overflow-hidden max-sm:p-0"

function TableHead({
  className,
  medida = false,
  esconderNoCelular = false,
  ...props
}: React.ComponentProps<"th"> & { medida?: boolean; esconderNoCelular?: boolean }) {
  return (
    <th
      data-slot="table-head"
      data-some-no-celular={esconderNoCelular || undefined}
      scope="col"
      className={cn(
        // A régua de ponta a ponta: com `border-separate`, a borda é da célula e gruda junto com o cabeçalho.
        "t-coluna h-10 border-b border-border px-3 text-left align-middle whitespace-nowrap",
        medida && "text-right",
        esconderNoCelular && SOME_NO_CELULAR,
        className
      )}
      {...props}
    />
  )
}

const CELULA: Record<Densidade, string> = {
  instrumento: "h-10 py-1.5",
  site: "h-12 py-2",
}
const CORPO: Record<Densidade, string> = { instrumento: "t-denso", site: "text-sm" }

/**
 * O filete entre as linhas do corpo: 1px `border` no pé de cada célula, como
 * fundo (não borda, que somaria à altura e se emendaria com a borda
 * transparente do recuo do grupo; não `tr::after`, que a tabela fixa conta como
 * coluna). Começa no x do texto (12px dentro da primeira célula, depois do
 * recuo do grupo) e acaba 12px antes do fim.
 */
const FILETE = cn(
  "[tbody_&]:bg-[linear-gradient(var(--border),var(--border))] [tbody_&]:bg-no-repeat [tbody_&]:bg-[length:100%_1px] [tbody_&]:bg-[position:left_bottom]",
  "[tbody_&]:first:bg-[length:calc(100%-12px)_1px] [tbody_&]:first:bg-[position:right_bottom]",
  "[tbody_&]:last:bg-[length:calc(100%-12px)_1px] [tbody_&]:only:bg-[length:calc(100%-24px)_1px] [tbody_&]:only:bg-[position:center_bottom]",
  // Sem filete na última linha do corpo, na linha acesa (hover ou foco do link) e na de cima dela (o seletor pesa
  // mais que o de cima).
  // O hover só conta onde há ponteiro, como o fundo `accent` dele: no toque, o hover preso não apaga o filete à toa.
  "[tbody_tr:last-child>&]:bg-none [@media(hover:hover)]:[tbody_tr:hover>&]:bg-none [@media(hover:hover)]:[tbody_tr:has(+tr:hover)>&]:bg-none",
  "[tbody_tr:has([data-slot=link-da-linha]:focus-visible)>&]:bg-none [tbody_tr:has(+tr_[data-slot=link-da-linha]:focus-visible)>&]:bg-none"
)

/**
 * A célula. A altura é mínimo, não teto: o ar de cima e de baixo fica, e a
 * linha cresce com o conteúdo. `medida`: número que se compara com o de outra
 * linha — mono, algarismos tabulares, alinhado à direita (TIPO-03).
 */
function TableCell({
  className,
  medida = false,
  esconderNoCelular = false,
  ...props
}: React.ComponentProps<"td"> & { medida?: boolean; esconderNoCelular?: boolean }) {
  const densidade = useDensidadeDaTabela()
  return (
    <td
      data-slot="table-cell"
      data-some-no-celular={esconderNoCelular || undefined}
      className={cn(
        "px-3 align-middle text-foreground transition-colors duration-cor first:rounded-l-md last:rounded-r-md",
        CELULA[densidade],
        FILETE,
        // O número não quebra: "R$ 1.256,11" em duas linhas deixa de se comparar com o de cima.
        medida ? "t-medida text-right whitespace-nowrap" : CORPO[densidade],
        // No celular, a última célula que fica (as de depois somem) leva o raio do hover e o fim do filete.
        esconderNoCelular
          ? SOME_NO_CELULAR
          : cn(
              "max-sm:[&:not(:has(~td:not([data-some-no-celular])))]:rounded-r-md max-sm:[tbody_&:not(:first-child):not(:has(~td:not([data-some-no-celular])))]:bg-[length:calc(100%-12px)_1px]",
              // A primeira que fica sozinha no celular recua dos dois lados.
              "max-sm:[tbody_&:first-child:not(:has(~td:not([data-some-no-celular])))]:bg-[length:calc(100%-24px)_1px] max-sm:[tbody_&:first-child:not(:has(~td:not([data-some-no-celular])))]:bg-[position:center_bottom]"
            ),
        className
      )}
      {...props}
    />
  )
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return <caption data-slot="table-caption" className={cn("mt-3 t-denso text-muted-foreground", className)} {...props} />
}

/**
 * O link que abre o objeto da linha. Fica na primeira célula e se estica sobre
 * a linha inteira por um `::after`; o foco desenha o anel em volta da linha.
 */
function LinkDaLinha({ className, ...props }: PropsDoLink) {
  return (
    <LinkDoApp
      data-slot="link-da-linha"
      className={cn(
        "outline-hidden after:absolute after:inset-0 after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset",
        className
      )}
      {...props}
    />
  )
}

export { useDensidadeDaTabela, type Densidade as DensidadeDaTabela }
export { LinkDaLinha, Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow }
