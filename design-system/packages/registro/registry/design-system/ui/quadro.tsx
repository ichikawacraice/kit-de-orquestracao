"use client"

import * as React from "react"
import { LoaderCircleIcon } from "lucide-react"
import { Slot } from "radix-ui"

import { TEXTO_SOBRE_A_TINTA, TINTA_DO_CARIMBO_NEUTRO, TINTA_DO_TOM, type Tom } from "@/registry/design-system/lib/idioma-de-cor"
import { cn } from "@/registry/design-system/lib/utils"
import { Skeleton } from "@/registry/design-system/ui/skeleton"

/**
 * O quadro de tarefas (kanban; ANATOMIA PECA-01). A COLUNA mora no chão, sem
 * superfície; o CARTÃO é a peça, elevado (SUP-01). Cor só pelos canais da base:
 * o marcador no cabeçalho, a bandeja da vida tingida pela voz quando o item
 * pede algo (COR-03) e o alvo de soltar da marca, tracejado (FORMA-02).
 *
 * **A peça desenha; o app arrasta.** Ela não traz biblioteca de arrastar: os
 * estados vêm por props (`arrastando`, `origem`, `alvo`, `recusa`, `ativo`,
 * `gravando`) e cada subpeça espalha o resto das props e o `ref` no elemento
 * dela. Onde encaixa cada prop da biblioteca:
 *
 * - `@hello-pangea/dnd`: o `Droppable` dá `innerRef` + `droppableProps` à
 *   `PilhaDaColuna`; o `Draggable` dá `innerRef` + `draggableProps` ao
 *   `CartaoDoQuadro` e `dragHandleProps` ao `TituloDoCartao` (a alça é o que
 *   tem foco). Como a alça é um `button`, o `Draggable` leva
 *   `disableInteractiveElementBlocking`: sem ele a biblioteca recusa o arraste
 *   que começa em elemento interativo, com o mouse e com o teclado.
 * - `@dnd-kit`: `setNodeRef` do `useDroppable` na `PilhaDaColuna`;
 *   `setNodeRef` + `transform` do `useSortable` no `CartaoDoQuadro`,
 *   `attributes` + `listeners` no `TituloDoCartao`. O `KeyboardSensor` pega só
 *   com Espaço (`keyboardCodes.start: ["Space"]`): Enter abre o cartão.
 *
 * O que fica no app (CONV-08): a ordem, o efeito otimista, quem pode mover
 * para onde e a chamada ao servidor. Na RECUSA, o cartão volta à origem e o app
 * o traz à vista (`scrollIntoView({ block: "nearest", inline: "nearest" })`,
 * sem `smooth` com movimento reduzido); pelo teclado, o foco vai para *Tentar
 * de novo*. O desfecho também vai ao `anuncio` do `Quadro`.
 *
 * **A altura vem do pai.** O `Quadro` é a rolagem única nos dois eixos e o
 * cabeçalho da coluna gruda no topo dela: o pai é `flex flex-col` com a altura
 * da janela (o casco da Lista), e o `Quadro` ocupa o resto (`min-h-0 flex-1`).
 * Sem altura, quem rola é a página e o cabeçalho sobe junto.
 */
function Quadro({
  anuncio,
  carregando = false,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  /** O nome da região: "Itens por status". */
  "aria-label": string
  /** O desfecho do último gesto, para o leitor de tela: "Movido para Validação", "Não mudou: …". */
  anuncio?: string
  carregando?: boolean
}) {
  return (
    <>
      <div
        role="region"
        data-slot="quadro"
        aria-busy={carregando || undefined}
        className={cn(
          // O `-mx-2 px-2` dá lugar ao anel de foco do cartão na borda da rolagem.
          "-mx-2 flex min-h-0 flex-1 gap-1.5 overflow-auto px-2 pb-1",
          className
        )}
        {...props}
      >
        {carregando ? <EsperaDoQuadro /> : children}
      </div>
      {/* Fora da região ocupada: `aria-busy` não cala o anúncio. Montada vazia desde o primeiro desenho (ACES-05). */}
      <div role="status" data-slot="anuncio-do-quadro" className="sr-only">
        {anuncio}
      </div>
    </>
  )
}

type ContextoDaColuna = { idDoNome: string; recusa: boolean; motivoDaRecusa?: string }

const ColunaContexto = React.createContext<ContextoDaColuna | null>(null)

/**
 * A coluna, no chão. `alvo`: o ponteiro está em cima e ela aceita — a tinta da
 * marca. `recusa`: ela não aceita o que está no ar — o cabeçalho esmaece desde o
 * começo do arrasto e, com o ponteiro em cima, o app passa o `motivoDaRecusa`
 * (um de cada vez). A opacidade fica no cabeçalho, sobre o chão: nunca por cima
 * das bandejas tingidas (COR-14).
 */
function ColunaDoQuadro({
  alvo = false,
  recusa = false,
  motivoDaRecusa,
  className,
  children,
  ...props
}: React.ComponentProps<"section"> & {
  alvo?: boolean
  recusa?: boolean
  motivoDaRecusa?: string
}) {
  const idDoNome = React.useId()
  const contexto = React.useMemo(() => ({ idDoNome, recusa, motivoDaRecusa }), [idDoNome, recusa, motivoDaRecusa])
  return (
    <ColunaContexto.Provider value={contexto}>
      <section
        data-slot="coluna-do-quadro"
        data-alvo={alvo || undefined}
        data-recusa={recusa || undefined}
        aria-labelledby={idDoNome}
        className={cn(
          // `h-max min-h-full`: a coluna cresce com os cartões (o cabeçalho `sticky` e a tinta do
          // alvo vão até o último), e a curta ainda enche a altura do quadro.
          "group/coluna flex h-max min-h-full max-w-80 min-w-0 shrink-0 grow basis-64 flex-col rounded-painel",
          alvo && "bg-marca-tinta",
          className
        )}
        {...props}
      >
        {children}
      </section>
    </ColunaContexto.Provider>
  )
}

function useColuna(peca: string) {
  const contexto = React.useContext(ColunaContexto)
  if (!contexto) throw new Error(`${peca} mora dentro de uma ColunaDoQuadro`)
  return contexto
}

/** A contagem da coluna: a pílula mono, com a tinta do carimbo neutro. O `rotulo` ("5 itens") é o que o leitor de tela ouve no lugar do número. */
function ContagemDaColuna({ valor, rotulo, className }: { valor: number; rotulo?: string; className?: string }) {
  return (
    <span
      data-slot="contagem-da-coluna"
      className={cn(
        "inline-flex min-w-5 shrink-0 items-center justify-center rounded-full px-1.75 py-px t-medida text-foreground-2",
        TINTA_DO_CARIMBO_NEUTRO,
        className
      )}
    >
      {rotulo ? (
        <>
          <span aria-hidden="true">{valor}</span>
          <span className="sr-only">{rotulo}</span>
        </>
      ) : (
        valor
      )}
    </span>
  )
}

/**
 * O cabeçalho da coluna, grudado no topo da rolagem do `Quadro`; na coluna
 * alvo, ele leva a mesma tinta da marca, para o alvo começar no nome. O `marcador`
 * (o ponto de `Estado` ou de `PontoDaEtapa`, `semNome`) vai sem leitura: o nome
 * já está escrito ao lado.
 */
function CabecalhoDaColuna({
  nome,
  marcador,
  contagem,
  rotuloDaContagem,
  acao,
  ajuda,
  className,
}: {
  nome: string
  marcador?: React.ReactNode
  contagem?: number
  /** O nome acessível da contagem: "5 itens". */
  rotuloDaContagem?: string
  /** O botão da coluna (o `+`), quando há. */
  acao?: React.ReactNode
  /** A `DicaDeAjuda` do nome, quando o nome pede explicação. */
  ajuda?: React.ReactNode
  className?: string
}) {
  const { idDoNome, recusa, motivoDaRecusa } = useColuna("CabecalhoDaColuna")
  return (
    <div data-slot="cabecalho-da-coluna" className={cn("sticky top-0 z-20 rounded-t-painel bg-background group-data-alvo/coluna:bg-marca-tinta", className)}>
      <header className={cn("flex h-9 items-center gap-1.5 px-2", recusa && "opacity-45")}>
        {marcador ? (
          <span aria-hidden="true" className="flex shrink-0 items-center">
            {marcador}
          </span>
        ) : null}
        <h2 id={idDoNome} className="min-w-0 truncate text-sm font-semibold text-foreground">
          {nome}
        </h2>
        {ajuda}
        {contagem === undefined ? null : <ContagemDaColuna valor={contagem} rotulo={rotuloDaContagem} />}
        {acao ? <span className="ml-auto flex shrink-0 items-center">{acao}</span> : null}
      </header>
      {recusa && motivoDaRecusa ? (
        <p data-slot="motivo-da-recusa" className="px-1 pb-1 t-denso text-foreground-2">
          {motivoDaRecusa}
        </p>
      ) : null}
    </div>
  )
}

/**
 * A coluna recolhida: a fita de 46px, alvo inteiro durante o arrasto (ela não
 * abre no meio dele, para a fileira não andar sob o ponteiro). O nome vai na
 * vertical; o nome acessível diz a causa.
 */
function FitaDaColuna({
  nome,
  marcador,
  contagem,
  causa,
  alvo = false,
  onAbrir,
  className,
  ref,
  ...props
}: Omit<React.ComponentProps<"button">, "onClick" | "children"> & {
  nome: string
  marcador?: React.ReactNode
  contagem: number
  /** Por que está vazia: "nenhum item com este filtro". */
  causa?: string
  alvo?: boolean
  onAbrir: () => void
}) {
  return (
    <button
      ref={ref}
      type="button"
      data-slot="fita-da-coluna"
      data-alvo={alvo || undefined}
      aria-expanded={false}
      aria-label={`Abrir a coluna ${nome}${causa ? `, vazia: ${causa}` : ""}`}
      onClick={onAbrir}
      className={cn(
        "flex w-11.5 shrink-0 flex-col items-center gap-3 rounded-cartao bg-foreground/3 py-3 outline-hidden transition-colors duration-cor motion-reduce:transition-none hover:bg-foreground/7 focus-visible:ring-2 focus-visible:ring-ring",
        alvo && "bg-marca-tinta outline-2 -outline-offset-4 outline-marca-viva outline-dashed hover:bg-marca-tinta",
        className
      )}
      {...props}
    >
      {marcador ? (
        <span aria-hidden="true" className="flex h-5 items-center">
          {marcador}
        </span>
      ) : null}
      <span aria-hidden="true" className="rotate-180 text-legenda font-semibold text-foreground-2 [writing-mode:vertical-rl]">
        {nome}
      </span>
      <span aria-hidden="true" className="t-medida text-muted-foreground">
        {contagem}
      </span>
    </button>
  )
}

/** A pilha de cartões: uma lista, e cada cartão num `li`. Recebe a área de soltar da biblioteca. */
function PilhaDaColuna({ className, ...props }: React.ComponentProps<"ol">) {
  return <ol data-slot="pilha-da-coluna" className={cn("flex flex-1 flex-col gap-2 px-2 pt-0.75 pb-7", className)} {...props} />
}

/**
 * O cartão, a peça elevada. `arrastando`: a cópia no ar (por portal, LAY-05),
 * sem rotação nem escala. `origem`: o lugar de onde saiu, a 60%: ainda se lê, mas já não está ali.
 * `ativo`: aberto no painel ao lado — o filete da marca no topo diz *onde você
 * está*, não o estado do item. O anel de foco contorna o cartão quando o foco
 * está no título (a alça), porque é o cartão que vai se mover (SUP-06).
 */
function CartaoDoQuadro({
  arrastando = false,
  origem = false,
  ativo = false,
  className,
  children,
  ...props
}: React.ComponentProps<"article"> & {
  arrastando?: boolean
  origem?: boolean
  ativo?: boolean
}) {
  return (
    <article
      data-slot="cartao-do-quadro"
      data-arrastando={arrastando || undefined}
      data-origem={origem || undefined}
      data-ativo={ativo || undefined}
      aria-current={ativo || undefined}
      className={cn(
        "group/cartao relative flex flex-col overflow-hidden rounded-cartao bg-card superficie",
        "transition-[translate,box-shadow] duration-revela ease-abre motion-reduce:transition-none",
        "has-[[data-slot=titulo-do-cartao]:focus-visible]:ring-2 has-[[data-slot=titulo-do-cartao]:focus-visible]:ring-ring has-[[data-slot=titulo-do-cartao]:focus-visible]:ring-offset-2 has-[[data-slot=titulo-do-cartao]:focus-visible]:ring-offset-background",
        !arrastando && !origem && "hover:-translate-y-px hover:superficie-alta motion-reduce:hover:translate-y-0",
        ativo && "superficie-alta",
        arrastando && "cursor-grabbing superficie-flutuante",
        origem && "opacity-60",
        className
      )}
      {...props}
    >
      {ativo ? (
        <span aria-hidden="true" data-slot="filete-do-ativo" className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-primary-gradient" />
      ) : null}
      {children}
    </article>
  )
}

/** A zona do pedido: o que é, de quem, até quando. Fica acima da bandeja. */
function PedidoDoCartao({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="pedido-do-cartao" className={cn("flex flex-col gap-2 px-3.5 py-3.25", className)} {...props} />
}

/**
 * A cabeça: prioridade e carimbos à esquerda, o `⋯` no fim. O `⋯` aparece no
 * hover, no foco e sempre no toque; o primeiro item do menu é *Mover para*, a
 * alternativa de um clique ao arrastar (WCAG 2.5.7).
 */
function CabecaDoCartao({
  menu,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { menu?: React.ReactNode }) {
  return (
    <div data-slot="cabeca-do-cartao" className={cn("flex min-h-6 items-start gap-1.5", className)} {...props}>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">{children}</div>
      {menu ? (
        <div
          data-slot="menu-do-cartao"
          className="relative z-10 -my-1.5 -mr-1.5 shrink-0 opacity-0 transition-opacity duration-cor motion-reduce:transition-none group-hover/cartao:opacity-100 group-focus-within/cartao:opacity-100 has-[[data-state=open]]:opacity-100 pointer-coarse:opacity-100"
        >
          {menu}
        </div>
      ) : null}
    </div>
  )
}

/**
 * O título: o que identifica o item, e a alça do arrastar. O link esticado
 * cobre o cartão: o clique em qualquer ponto abre e o arrasto começa de
 * qualquer ponto. Controles dentro do cartão ficam acima dele (`relative
 * z-10`, nos encaixes da peça). Enter abre; Espaço pega.
 */
function TituloDoCartao({
  asChild = false,
  className,
  ...props
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button"
  return (
    <Comp
      data-slot="titulo-do-cartao"
      {...(asChild ? {} : { type: "button" as const })}
      className={cn(
        "line-clamp-3 text-left text-controle leading-snug font-medium text-foreground outline-hidden",
        "after:absolute after:inset-0 after:content-['']",
        className
      )}
      {...props}
    />
  )
}

/** A identidade: onde (o encaixe do início, que trunca) e de quem (o fim, à direita). */
function IdentidadeDoCartao({
  inicio,
  fim,
  className,
}: {
  inicio?: React.ReactNode
  fim?: React.ReactNode
  className?: string
}) {
  return (
    <div data-slot="identidade-do-cartao" className={cn("flex min-h-6 items-center gap-2 text-legenda text-muted-foreground", className)}>
      <span className="min-w-0 truncate font-semibold text-foreground-2">{inicio}</span>
      {fim ? <span className="relative z-10 ml-auto flex shrink-0 items-center gap-1.5">{fim}</span> : null}
    </div>
  )
}

/** A tela capturada, para reconhecer o item. `alt=""` quando ela repete o título. */
function MiniaturaDoCartao({ className, alt, ...props }: React.ComponentProps<"img"> & { alt: string }) {
  return (
    <img
      data-slot="miniatura-do-cartao"
      alt={alt}
      className={cn("h-24 w-full rounded-md bg-muted object-cover", className)}
      {...props}
    />
  )
}

/** Os fatos de apoio (`há 2 h`, `3 mensagens`), cada um num `span`, sem ponto médio entre eles. */
function InformativoDoCartao({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="informativo-do-cartao"
      className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-legenda text-muted-foreground", className)}
      {...props}
    />
  )
}

const TOM_QUE_TINGE: ReadonlySet<Tom> = new Set(["espera", "ruim", "alheio"])

/**
 * A bandeja da vida, no pé do cartão: aparece SEMPRE. Em repouso é o degrau
 * afundado e leva o informativo; tinge com a voz quando o item pede algo
 * (`espera`, `ruim`, `alheio`) e acrescenta a frase. A tinta se declara aqui,
 * uma vez, e os filhos herdam (COR-14). `girando`: o app está gravando — a
 * bandeja neutra com o giro, que quem chama só mostra depois de `delay-veu`.
 * Botões dentro dela (*Tentar de novo*, em `outline sm`) ficam acima do link
 * esticado.
 */
function VidaDoCartao({
  tom,
  girando = false,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { tom: Tom; girando?: boolean }) {
  const tinge = TOM_QUE_TINGE.has(tom)
  return (
    <div
      data-slot="vida-do-cartao"
      data-tom={tom}
      className={cn(
        "flex min-h-8 flex-wrap items-center gap-x-3 gap-y-2 px-3.5 pt-2.75 pb-3 text-legenda font-medium",
        "[&_a]:relative [&_a]:z-10 [&_button]:relative [&_button]:z-10",
        tinge ? cn(TINTA_DO_TOM[tom], TEXTO_SOBRE_A_TINTA[tom]) : "bg-muted text-foreground-2",
        className
      )}
      {...props}
    >
      {girando ? (
        <LoaderCircleIcon aria-hidden="true" className="size-3.5 shrink-0 animate-spin motion-reduce:animate-none" />
      ) : null}
      {children}
    </div>
  )
}

/** A vaga onde o cartão vai entrar: tracejada, porque é a ausência dele (FORMA-02). */
function VagaDoCartao({ altura, className }: { altura?: number; className?: string }) {
  return (
    <div
      aria-hidden="true"
      data-slot="vaga-do-cartao"
      style={altura ? { height: altura } : undefined}
      className={cn("min-h-16 rounded-cartao border-2 border-dashed border-marca-viva bg-marca-tinta", className)}
    />
  )
}

const ALTURAS_DA_ESPERA = [["h-22", "h-30"], ["h-30", "h-22", "h-22"], ["h-22"]] as const

/** A espera do quadro: cabeçalhos e cartões em esqueleto, com alturas diferentes. Aparece depois de `delay-veu`. */
function EsperaDoQuadro({ colunas = 3 }: { colunas?: number }) {
  return (
    <div data-slot="espera-do-quadro" className="flex gap-3 animate-in fade-in-0 fill-mode-backwards duration-revela delay-veu motion-reduce:animate-none">
      {Array.from({ length: colunas }, (_, c) => (
        <div key={c} className="flex w-64 shrink-0 flex-col gap-2">
          <div className="flex h-9 items-center gap-2 px-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-6 rounded-full" />
          </div>
          {(ALTURAS_DA_ESPERA[c % ALTURAS_DA_ESPERA.length] ?? []).map((altura, i) => (
            <Skeleton key={i} className={cn("rounded-cartao", altura)} />
          ))}
        </div>
      ))}
    </div>
  )
}

export {
  CabecaDoCartao,
  CabecalhoDaColuna,
  CartaoDoQuadro,
  ColunaDoQuadro,
  ContagemDaColuna,
  EsperaDoQuadro,
  FitaDaColuna,
  IdentidadeDoCartao,
  InformativoDoCartao,
  MiniaturaDoCartao,
  PedidoDoCartao,
  PilhaDaColuna,
  Quadro,
  TituloDoCartao,
  VagaDoCartao,
  VidaDoCartao,
}
