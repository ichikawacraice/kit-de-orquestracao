"use client"

import * as React from "react"
import { ChevronDownIcon } from "lucide-react"

import { cn } from "@/registry/wicomm/lib/utils"

/**
 * A voz do NOME de um bloco — o degrau de título (TIPO-02), escrita uma vez.
 * Quem usa `<legend>` (o nome de um `fieldset`) compõe esta voz em vez de
 * reescrevê-la. A tinta fica aqui e não na classe da voz: a voz é tamanho,
 * peso e entrelinha; a cor é outro canal (COR-08).
 */
const VOZ_DO_NOME_DE_BLOCO = "t-titulo text-foreground"

/**
 * Um ASSUNTO de tela: o NOME solto sobre o fundo da página e um cartão com o
 * conteúdo (DESIGN SUP-01, SUP-03).
 *
 * A pergunta que decide o que vai onde é sempre a mesma — *isto é conteúdo, ou
 * é o nome do conteúdo?* Nome, e o que CONTROLA o conteúdo (`acao`), ficam
 * fora; o cartão é só o conteúdo. Quem separa um bloco do outro é o fundo, não
 * outra moldura.
 *
 * O título é o degrau de título, não o de rótulo: título mais fraco do que o
 * que ele nomeia não organiza nada.
 *
 * `nivel` é o do cabeçalho (`h2` por padrão): bloco que vive dentro de outro
 * assunto desce um nível, para quem navega por cabeçalhos ler a hierarquia
 * certa.
 *
 * `recolhivel` faz o cabeçalho abrir e fechar o bloco — e só vale a pena com
 * `resumo`: fechado sem resumo, o bloco obriga a abrir para saber se valia
 * abrir. `abrirQuando` abre o bloco quando o valor muda para algo não nulo (o
 * campo com erro dentro de um bloco fechado); fechar continua sendo do gesto.
 *
 * `data-bloco` sai sempre, vazio sem `nome`: âncora de medição que depende de
 * prop opcional mede um subconjunto e afirma o todo.
 */
function Bloco({
  titulo,
  legenda,
  acao,
  nome,
  children,
  className,
  semSuperficie = false,
  nivel = 2,
  recolhivel = false,
  resumo,
  abertoPorPadrao = true,
  miniatura,
  abrirQuando = null,
  ref,
}: {
  titulo: string
  /** Uma nota curta ao lado do título. */
  legenda?: string
  acao?: React.ReactNode
  nome?: string
  children: React.ReactNode
  /** Vai ao miolo (o cartão), não à seção. Sem ela, o miolo é `flex flex-col gap-3`. */
  className?: string
  /** O miolo vira degrau de tinta (`bg-muted`) em vez de cartão: para o bloco que já mora dentro de uma peça. */
  semSuperficie?: boolean
  nivel?: 2 | 3 | 4
  recolhivel?: boolean
  /** A linha que o cabeçalho diz — fechado e aberto: é o resumo do que está ali. */
  resumo?: React.ReactNode
  /** Só olhado quando `recolhivel`. */
  abertoPorPadrao?: boolean
  /** Desenhada antes do título (56 × 40). Com ela, título e resumo empilham. Só o recolhível a desenha. */
  miniatura?: React.ReactNode
  abrirQuando?: string | number | null
  ref?: React.Ref<HTMLElement>
}) {
  const [aberto, setAberto] = React.useState(abertoPorPadrao || abrirQuando !== null)
  // Na renderização, e não num efeito: o campo de dentro, que rola e foca no
  // efeito dele, já encontra o miolo visível.
  const [abrirVisto, setAbrirVisto] = React.useState(abrirQuando)
  if (abrirVisto !== abrirQuando) {
    setAbrirVisto(abrirQuando)
    if (abrirQuando !== null) setAberto(true)
  }
  const idDoMiolo = React.useId()
  const H = `h${nivel}` as "h2" | "h3" | "h4"

  const miolo = (
    <div
      data-slot="miolo-do-bloco"
      data-superficie={semSuperficie ? undefined : true}
      className={cn(
        semSuperficie ? "rounded-2xl bg-muted p-4" : "superficie rounded-2xl p-4",
        className ?? "flex flex-col gap-3"
      )}
    >
      {children}
    </div>
  )
  const tituloENota = (
    <H className={VOZ_DO_NOME_DE_BLOCO}>
      {titulo}
      {legenda ? <span className="ml-2 text-xs font-normal text-muted-foreground">{legenda}</span> : null}
    </H>
  )
  const resumoDoBloco = resumo ? (
    <span data-slot="resumo-do-bloco" className="min-w-0 truncate text-xs text-muted-foreground">
      {resumo}
    </span>
  ) : null

  return (
    <section
      ref={ref}
      data-slot="bloco"
      id={nome}
      data-bloco={nome ?? ""}
      data-recolhivel={recolhivel ? "true" : undefined}
      className="flex flex-col gap-2"
    >
      {/* `flex-wrap`: em coluna estreita a AÇÃO desce de linha em vez de
          comprimir o nome — o título é o que menos pode ceder. */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        {recolhivel ? (
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            aria-expanded={aberto}
            aria-controls={idDoMiolo}
            data-slot="recolher-bloco"
            // Sem contorno: o cabeçalho recolhível é um TÍTULO que também abre,
            // não um controle emoldurado. Quem diz que ele abre é o chevron; o
            // foco continua tendo o anel (SUP-06).
            className="-mx-1 flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-0.5 text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {miniatura ? (
              <span
                data-slot="miniatura-do-bloco"
                className="flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-foreground/[0.06]"
              >
                {miniatura}
              </span>
            ) : null}
            <ChevronDownIcon
              aria-hidden="true"
              className={cn("size-3.5 shrink-0 text-muted-foreground", !aberto && "-rotate-90")}
            />
            {miniatura ? (
              <span className="flex min-w-0 flex-col">
                {tituloENota}
                {resumoDoBloco}
              </span>
            ) : (
              <>
                {tituloENota}
                {resumoDoBloco}
              </>
            )}
          </button>
        ) : (
          tituloENota
        )}
        {acao}
      </div>
      {recolhivel ? (
        // Só a ENTRADA anima (MOV-03): o miolo some por `hidden`, e a saída seca
        // não atrasa o gesto que a pessoa já fez.
        <div
          id={idDoMiolo}
          hidden={!aberto}
          className="animate-in fade-in-0 duration-dobra-abre ease-abre motion-reduce:animate-none"
        >
          {miolo}
        </div>
      ) : (
        miolo
      )}
    </section>
  )
}

export { Bloco, VOZ_DO_NOME_DE_BLOCO }
