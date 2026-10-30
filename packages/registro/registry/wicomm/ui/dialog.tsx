"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { XIcon } from "lucide-react"

import { cn } from "@/registry/wicomm/lib/utils"

/**
 * O diálogo: superfície FLUTUANTE (DESIGN SUP-01), raio de container
 * (FORMA-01), entrada em 220ms com escala inicial 0,97 e saída mais curta
 * (MOV-01), com escape para quem pediu menos movimento (MOV-02).
 *
 * Três formas:
 * - `DialogContent` — o diálogo curto de sempre;
 * - `DialogLongo` — conteúdo que não cabe na janela: cabeçalho e rodapé fixos,
 *   só o miolo rola; com `bloqueia`, sai só por uma condição de fora;
 * - `DialogLateral` — painel flutuante preso à direita, NÃO modal, para
 *   consultar ao lado do trabalho.
 */
function Dialog(props: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger(props: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal(props: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose(props: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

/** O véu. `data-overlay` é a âncora que o `DialogLongo bloqueia` conta para não escurecer duas vezes. */
function DialogOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      data-overlay=""
      className={cn(
        "fixed inset-0 z-50 bg-zinc-950/45 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:duration-modal-abre data-[state=closed]:duration-modal-fecha data-[state=open]:ease-abre data-[state=closed]:ease-fecha motion-reduce:!animate-none",
        className
      )}
      {...props}
    />
  )
}

const BOTAO_DE_FECHAR =
  "absolute rounded-md p-1 text-muted-foreground transition-colors duration-cor hover:bg-accent hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4"

function DialogContent({
  className,
  children,
  comFechar = true,
  semOverlay = false,
  fecharDesligado = false,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  /** Desenha o X. Só o diálogo que bloqueia o dispensa. */
  comFechar?: boolean
  /** Não desenha o próprio véu: quem monta cuida dele. */
  semOverlay?: boolean
  /** O X fica visível e desligado: fechar agora não é possível, e o controle não finge que é. */
  fecharDesligado?: boolean
}) {
  return (
    <DialogPortal>
      {semOverlay ? null : <DialogOverlay />}
      <DialogPrimitive.Content
        data-slot="dialog-content"
        data-superficie
        className={cn(
          // Sem `slide-in-from-*`: no v4 o centro vem da propriedade `translate`,
          // e a animação de entrada mexe em `transform` — somar os dois tira o
          // diálogo do centro durante a entrada.
          "superficie-flutuante fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-2xl p-6 text-popover-foreground sm:max-w-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-97 data-[state=open]:zoom-in-97 data-[state=open]:duration-modal-abre data-[state=closed]:duration-modal-fecha data-[state=open]:ease-abre data-[state=closed]:ease-fecha motion-reduce:!animate-none",
          className
        )}
        {...props}
      >
        {children}
        {comFechar ? (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            disabled={fecharDesligado}
            aria-disabled={fecharDesligado || undefined}
            className={cn(BOTAO_DE_FECHAR, "top-4 right-4")}
          >
            <XIcon />
            <span className="sr-only">Fechar</span>
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="dialog-header" className={cn("flex flex-col gap-1.5 text-center sm:text-left", className)} {...props} />
  )
}

/** A linha de botões do rodapé: empilhada (o primário em cima) no celular, lado a lado e à direita a partir de `sm`. */
function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title data-slot="dialog-title" className={cn("t-titulo text-foreground", className)} {...props} />
}

function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-[13px] leading-normal text-muted-foreground", className)}
      {...props}
    />
  )
}

const SELETOR_DE_OUTRO_OVERLAY = '[data-overlay]:not([data-overlay="bloqueia"])[data-state="open"]'

/**
 * O véu do diálogo que bloqueia. **Conta véus, não diálogos:** com outro
 * diálogo já escurecendo a tela, dois véus de 45% somariam uns 70%, e quem
 * monta não sabe de todos os diálogos da página. Reavalia enquanto está aberto:
 * se o de baixo fecha, o próprio aparece.
 */
function OverlayDoBloqueio() {
  const haOutro = () => document.querySelector(SELETOR_DE_OUTRO_OVERLAY) !== null
  const [outro, setOutro] = React.useState(haOutro)
  React.useEffect(() => {
    const reavalia = () => setOutro(haOutro())
    reavalia()
    const obs = new MutationObserver(reavalia)
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-state"] })
    return () => obs.disconnect()
  }, [])
  return outro ? null : <DialogOverlay data-overlay="bloqueia" />
}

type PropsDoDialogoLongo = Omit<React.ComponentProps<typeof DialogContent>, "comFechar" | "semOverlay" | "title"> & {
  titulo: React.ReactNode
  descricao?: React.ReactNode
  /** A largura máxima. O padrão serve a formulário; registro largo pede `sm:max-w-5xl`. */
  largura?: string
  /**
   * O título nomeia o diálogo para o leitor de tela mas não é desenhado: quem
   * o desenha é o conteúdo, portando um cabeçalho para o slot
   * `[data-slot="cabecalho-do-dialogo"]` (quando o cabeçalho tem estado vivo).
   */
  tituloSoParaLeitor?: boolean
}

/**
 * Sem `bloqueia`, o diálogo de sempre. Com `bloqueia`, ele **só sai por uma
 * condição de fora**: sem X, sem Esc, sem clique fora, `role="alertdialog"`. Por
 * isso o `rodape` é obrigatório — a saída declarada —, e o tipo recusa compilar
 * um diálogo preso sem ela.
 */
type DialogoLongoProps = PropsDoDialogoLongo &
  ({ bloqueia: true; rodape: React.ReactNode } | { bloqueia?: false; rodape?: React.ReactNode })

/**
 * **O diálogo LONGO** — conteúdo que não cabe na janela.
 *
 * 1. **Não ocupa a janela inteira** (`max-h-[85vh]`): sem folga, o diálogo deixa
 *    de parecer uma coisa SOBRE a tela e passa a parecer outra tela.
 * 2. **O cabeçalho não rola**: rolar não leva embora o título do que se lê.
 * 3. **O rodapé também não rola**: ação que só aparece no fim do rolo é gesto
 *    enterrado.
 *
 * Cabeçalho e rodapé não têm filete: o rodapé é um degrau de tinta (SUP-03),
 * que já diz onde o rolo termina. Os dois slots (`cabecalho-do-dialogo` e
 * `rodape-do-dialogo`) existem sempre, vazios quando ninguém os preenche, para
 * o conteúdo portar para eles o que depende do estado dele.
 */
function DialogLongo({
  titulo,
  descricao,
  rodape,
  bloqueia = false,
  largura = "sm:max-w-4xl",
  tituloSoParaLeitor = false,
  className,
  children,
  ...props
}: DialogoLongoProps) {
  return (
    <>
      {bloqueia ? (
        <DialogPortal>
          <OverlayDoBloqueio />
        </DialogPortal>
      ) : null}
      <DialogContent
        comFechar={!bloqueia}
        semOverlay={bloqueia}
        className={cn("flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0", largura, className)}
        {...props}
        {...(bloqueia
          ? {
              role: "alertdialog" as const,
              "aria-modal": true as const,
              onEscapeKeyDown: (e: KeyboardEvent) => e.preventDefault(),
              onPointerDownOutside: (e: Event) => e.preventDefault(),
              onInteractOutside: (e: Event) => e.preventDefault(),
            }
          : {})}
      >
        {/* `pr-14`: o X mora no canto e o título largo passaria por baixo dele. */}
        <DialogHeader className={cn("shrink-0 gap-[10px] px-6 pt-6 pb-3", bloqueia ? "pr-6" : "pr-14")}>
          <DialogTitle className={cn(tituloSoParaLeitor && "sr-only")}>{titulo}</DialogTitle>
          {descricao ? <DialogDescription>{descricao}</DialogDescription> : null}
          <div data-slot="cabecalho-do-dialogo" className="empty:hidden" />
        </DialogHeader>
        <div data-slot="corpo-do-dialogo" className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 empty:hidden">
          {children}
        </div>
        <div data-slot="rodape-do-dialogo" className="shrink-0 bg-muted px-6 py-3 empty:hidden">
          {rodape}
        </div>
      </DialogContent>
    </>
  )
}

/**
 * O painel lateral: uma peça flutuante presa à direita, na altura da janela,
 * que se abre POR CIMA do conteúdo sem empurrá-lo nem escurecê-lo — para o que
 * se consulta ao lado do trabalho (histórico, atividade), com a tela de trás à
 * vista e clicável.
 *
 * Por isso não é modal: sem véu, sem prender o foco, e clicar fora NÃO o fecha
 * (quem fecha é o X, o Esc ou o botão que o abriu). Monte o `Dialog` com
 * `modal={false}`.
 */
function DialogLateral({
  titulo,
  cabecalho,
  tituloSoParaLeitor = false,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof DialogPrimitive.Content>, "title"> & {
  titulo: React.ReactNode
  /** Um seletor de modos, por exemplo. Com `tituloSoParaLeitor`, ocupa a linha do título. */
  cabecalho?: React.ReactNode
  tituloSoParaLeitor?: boolean
}) {
  return (
    <DialogPortal>
      <DialogPrimitive.Content
        data-slot="dialog-lateral"
        data-superficie
        aria-describedby={undefined}
        onInteractOutside={(e) => e.preventDefault()}
        className={cn(
          "superficie-flutuante fixed top-3 right-3 bottom-3 z-50 flex w-[min(26rem,calc(100vw-1.5rem))] flex-col gap-3 overflow-hidden rounded-2xl p-4 text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-right-4 data-[state=closed]:slide-out-to-right-4 data-[state=open]:duration-painel data-[state=closed]:duration-painel data-[state=open]:ease-abre data-[state=closed]:ease-fecha motion-reduce:!animate-none",
          className
        )}
        {...props}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 pr-8">
          <DialogPrimitive.Title className={cn("t-titulo text-foreground", tituloSoParaLeitor && "sr-only")}>
            {titulo}
          </DialogPrimitive.Title>
          {tituloSoParaLeitor && cabecalho ? <div className="min-w-0 flex-1">{cabecalho}</div> : null}
        </div>
        {!tituloSoParaLeitor && cabecalho ? <div className="shrink-0">{cabecalho}</div> : null}
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        <DialogPrimitive.Close data-slot="dialog-close" className={cn(BOTAO_DE_FECHAR, "top-3 right-3")}>
          <XIcon />
          <span className="sr-only">Fechar</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogLateral,
  DialogLongo,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  type DialogoLongoProps,
}
