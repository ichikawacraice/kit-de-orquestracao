import * as React from "react"

import { cn } from "@/registry/design-system/lib/utils"
import { Badge } from "@/registry/design-system/ui/badge"
import { NOME_DA_PESSOA, type CorDaPessoa } from "@/registry/design-system/ui/monograma"

/**
 * A CONVERSA ENTRE PESSOAS (ANATOMIA PECA-01): os meus balões à direita, na
 * tinta da marca; os dos outros à esquerda, no `muted`. O agrupamento é só
 * visual — cada balão leva, escondida, a frase inteira para o leitor de tela
 * (*"Ana Souza, cliente, hoje às 14:32:"*); nome, selo e hora visíveis são
 * `aria-hidden`. O `rotulo` é o nome acessível da lista, na frase da tela.
 *
 * Duas travas: nenhum balão ganha tinta de voz (o erro de envio é texto abaixo
 * do campo, nunca balão rosa), e o que separa o meu balão de um carimbo é a
 * forma e o lugar (MARCA-02). A cor da pessoa (COR-09) só pinta o nome do autor
 * e o monograma — nunca o balão.
 *
 * Não é a conversa com a IA: lá não há "o outro", há a resposta.
 */
function Conversa({ rotulo, className, ...props }: Omit<React.ComponentProps<"ol">, "aria-label"> & { rotulo: string }) {
  return <ol data-slot="conversa" aria-label={rotulo} className={cn("flex flex-col gap-1", className)} {...props} />
}

/** O separador de dia: *Hoje*, *Ontem*, *31/10/2026*. Enfeite: o dia já vai na frase de cada balão. */
function DiaDaConversa({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <li
      aria-hidden="true"
      data-slot="dia-da-conversa"
      className={cn("pt-3 text-center t-denso text-muted-foreground first:pt-0", className)}
    >
      {children}
    </li>
  )
}

/**
 * O cabeçalho do primeiro balão do outro lado: o nome (na cor da pessoa, se
 * vier) e o selo. Enfeite: o nome já vai na frase do balão.
 */
function AutorDaConversa({
  nome,
  selo,
  cor,
}: {
  nome: string | null
  selo?: string | null
  /** `corDaPessoa(id)`: a mesma do monograma dela. */
  cor?: CorDaPessoa
}) {
  return (
    <p aria-hidden="true" data-slot="autor-da-conversa" className="mb-0.5 flex min-w-0 items-center gap-1.5">
      {nome ? (
        <span className={cn("truncate t-denso font-medium", cor ? NOME_DA_PESSOA[cor] : "text-foreground-2")}>{nome}</span>
      ) : null}
      {selo ? <Badge>{selo}</Badge> : null}
    </p>
  )
}

/**
 * O balão: `rounded-xl`, e no primeiro do grupo o canto de quem fala menos
 * redondo (`rounded-tr-md` no meu, `rounded-tl-md` no do outro) — a ponta que
 * aponta o lado sem desenhar rabicho. A hora mora no canto, com o lugar
 * reservado na última linha: cabe, fica ao lado; não cabe, desce.
 */
function BalaoDaConversa({
  lado,
  primeira,
  autor,
  paraLeitor,
  hora,
  instante,
  chegou = false,
  className,
  children,
}: {
  lado: "meu" | "outro"
  /** Abre o grupo: mais respiro acima e o canto de quem fala menos redondo. */
  primeira: boolean
  /** O `AutorDaConversa`, só no primeiro do grupo e do outro lado. */
  autor?: React.ReactNode
  /** A frase inteira para o leitor de tela: quem, de onde e quando. */
  paraLeitor: string
  /** A hora visível: *14:32*. */
  hora: string
  /** O ISO, para o `<time>`. */
  instante: string
  /** Chegou com a conversa já aberta: entra com o fade. */
  chegou?: boolean
  className?: string
  children: React.ReactNode
}) {
  const meu = lado === "meu"
  return (
    <li
      data-slot="balao-da-conversa"
      data-lado={lado}
      data-primeira={primeira ? "" : undefined}
      className={cn("flex", meu ? "justify-end" : "justify-start", primeira && "mt-2 [[data-slot=dia-da-conversa]+&]:mt-0 first:mt-0")}
    >
      <span className="sr-only">{paraLeitor} </span>
      <div
        className={cn(
          "relative max-w-4/5 min-w-0 rounded-xl px-3 py-2 text-foreground",
          meu ? "bg-marca-tinta" : "bg-muted",
          primeira && (meu ? "rounded-tr-md" : "rounded-tl-md"),
          chegou && "animate-in fade-in-0 duration-revela motion-reduce:animate-none",
          className
        )}
      >
        {autor}
        <p className="text-sm whitespace-pre-wrap wrap-break-word">
          {children}
          <span aria-hidden="true" className="inline-block w-11" />
        </p>
        <time
          dateTime={instante}
          aria-hidden="true"
          className="absolute right-3 bottom-2 text-legenda t-medida text-foreground-2"
        >
          {hora}
        </time>
      </div>
    </li>
  )
}

export { Conversa, DiaDaConversa, AutorDaConversa, BalaoDaConversa }
