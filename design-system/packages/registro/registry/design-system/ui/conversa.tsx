import * as React from "react"

import { trechosComLinks } from "@/registry/design-system/lib/links-no-texto"
import { cn } from "@/registry/design-system/lib/utils"
import { Badge } from "@/registry/design-system/ui/badge"
import { corDaChave, NOME_DA_PESSOA } from "@/registry/design-system/ui/monograma"

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
 * A mensagem que chega com a conversa aberta (`chegou`) entra com o fade, mas
 * o anúncio é do app: uma região `role="status"` que já existe (ACES-05), porque
 * só o app sabe se a mensagem é de outra pessoa.
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
 * O cabeçalho do primeiro balão do outro lado: o nome (na cor da pessoa,
 * quando há `chave`) e o selo. Enfeite: o nome já vai na frase do balão.
 * A conversa é o único lugar onde o nome ganha a cor da pessoa (COR-09).
 */
function AutorDaConversa({
  nome,
  selo,
  chave,
}: {
  nome: string | null
  selo?: string | null
  /** O id da pessoa, o mesmo do monograma dela; `null` quando o app não o tem. */
  chave: string | null
}) {
  const cor = corDaChave(chave)
  return (
    <p aria-hidden="true" data-slot="autor-da-conversa" className="mb-0.5 flex min-w-0 items-center gap-1.5">
      {nome ? (
        <span
          data-cor={cor}
          className={cn("truncate t-denso font-medium", cor ? NOME_DA_PESSOA[cor] : "text-foreground-2")}
        >
          {nome}
        </span>
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
  /** O texto da mensagem: conteúdo de frase (mora num `<p>`), sem bloco. */
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

/**
 * O corpo da mensagem com os links clicáveis: o `http(s)` vira `<a>` em nova
 * aba, o resto segue texto (sem HTML cru: o corpo vem de quem escreveu). Mora
 * dentro do `BalaoDaConversa`. O link é tinta com sublinhado (MARCA-02): a 50%,
 * porque é o único sinal dele e abaixo disso some no tema claro; o anel fecha em
 * cada linha da URL quebrada, com o respiro na cor do balão.
 */
function TextoComLinks({ texto }: { texto: string }) {
  return (
    <>
      {trechosComLinks(texto).map((trecho, i) =>
        trecho.tipo === "link" ? (
          <a
            key={i}
            href={trecho.href}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "rounded-sm sublinhado-de-link transition-colors duration-cor",
              "box-decoration-clone focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "in-data-[lado=meu]:focus-visible:ring-offset-marca-tinta in-data-[lado=outro]:focus-visible:ring-offset-muted"
            )}
          >
            {trecho.texto}
            <span className="sr-only"> (abre em nova aba)</span>
          </a>
        ) : (
          <React.Fragment key={i}>{trecho.texto}</React.Fragment>
        )
      )}
    </>
  )
}

export { Conversa, DiaDaConversa, AutorDaConversa, BalaoDaConversa, TextoComLinks }
