"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui"
import { CheckIcon, ChevronRightIcon, RotateCwIcon } from "lucide-react"

import { PONTO_DO_TOM } from "@/registry/wicomm/lib/idioma-de-cor"
import { cn } from "@/registry/wicomm/lib/utils"
import { useConfirm, type OpcoesDaConfirmacao } from "@/registry/wicomm/ui/confirm-dialog"
import { EsperaDaLista } from "@/registry/wicomm/ui/skeleton"

/**
 * O menu (dropdown-menu do shadcn) e a linha dele. É o `DropdownMenu` do Radix:
 * o papel `menu`, as setas, a busca por letra, o Esc e a volta do foco ao
 * gatilho vêm dele.
 *
 * Regras de composição:
 * - toda linha mora num grupo, e os grupos se separam pelo AR — nunca por
 *   filete (SUP-03);
 * - o destrutivo mora no último grupo, sozinho ou com outros destrutivos;
 * - destrutivo e bloqueado juntos: o bloqueado vence (não executa, não confirma);
 * - nenhuma linha leva reticências (CTRL-07), e nenhum menu esconde ação
 *   frequente.
 */
type Pedir = (opcoes: OpcoesDaConfirmacao) => Promise<boolean>
const PedirDoMenu = React.createContext<Pedir | null>(null)

/** A forma da linha, exportada para o teste e para quem precisar medir. Ninguém a copia. */
const LINHA_DO_MENU =
  "relative flex min-h-[30px] w-full cursor-default items-center gap-2 rounded-md px-2 py-1 text-left text-[13px] leading-[18px] text-foreground outline-hidden select-none transition-colors duration-cor motion-reduce:transition-none data-[highlighted]:bg-accent aria-disabled:cursor-not-allowed"

const CAIXA_DO_MENU =
  "superficie-flutuante z-50 flex max-h-(--radix-dropdown-menu-content-available-height) min-w-56 max-w-sm origin-(--radix-dropdown-menu-content-transform-origin) flex-col gap-2 overflow-x-hidden overflow-y-auto rounded-xl p-1.5 text-popover-foreground outline-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-98 data-[state=open]:zoom-in-98 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=open]:duration-menu-abre data-[state=closed]:duration-menu-fecha data-[state=open]:ease-abre data-[state=closed]:ease-fecha motion-reduce:!animate-none"

type IconeDeLinha = React.ComponentType<{ className?: string }>

/** A raiz. Ela também é dona da confirmação dos itens que pedem confirmação (um `useConfirm` por menu). */
function Menu({
  children,
  open,
  onOpenChange,
  modal,
}: {
  children: React.ReactNode
  open?: boolean
  onOpenChange?: (aberto: boolean) => void
  /** Padrão `true`, o do Radix. */
  modal?: boolean
}) {
  // O diálogo mora aqui, e não no item: o conteúdo do menu desmonta ao fechar e levaria o diálogo junto.
  const [dialogo, pedir] = useConfirm()
  return (
    <PedirDoMenu.Provider value={pedir}>
      <DropdownMenuPrimitive.Root open={open} onOpenChange={onOpenChange} modal={modal}>
        {children}
      </DropdownMenuPrimitive.Root>
      {dialogo}
    </PedirDoMenu.Provider>
  )
}

/** O gatilho. Sempre `asChild`, sobre um `Button` do kit. */
const GatilhoDoMenu = DropdownMenuPrimitive.Trigger

/**
 * A caixa flutuante. `align` padrão `"end"`, `sideOffset` padrão 4.
 *
 * Cabe na tela (SUP-07): troca de lado quando falta espaço, para a 8px da
 * borda (`collisionPadding`) e limita a altura ao que sobra, rolando por
 * dentro. A troca de lado não se desliga: o `avoidCollisions` não é aceito.
 *
 * Com `aria-label`, o menu leva esse nome, e não o do gatilho. Se o foco foi
 * movido para outro lugar depois do fechamento (um diálogo, um campo), ele fica
 * onde está; senão volta ao gatilho.
 */
function ConteudoDoMenu({
  className,
  align = "end",
  sideOffset = 4,
  collisionPadding = 8,
  onCloseAutoFocus,
  ...props
}: Omit<React.ComponentProps<typeof DropdownMenuPrimitive.Content>, "avoidCollisions">) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="conteudo-do-menu"
        data-superficie
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(CAIXA_DO_MENU, className)}
        {...(props["aria-label"] ? { "aria-labelledby": undefined } : {})}
        onCloseAutoFocus={(e) => {
          onCloseAutoFocus?.(e)
          if (e.defaultPrevented) return
          const ativo = document.activeElement
          if (ativo instanceof HTMLElement && ativo.isConnected && ativo !== document.body) e.preventDefault()
        }}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

/** Um grupo de linhas. Toda linha mora num grupo, e os grupos se separam pelo ar. */
function GrupoDoMenu({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <DropdownMenuPrimitive.Group data-slot="grupo-do-menu" className={cn("flex flex-col gap-0.5", className)}>
      {children}
    </DropdownMenuPrimitive.Group>
  )
}

/** O nome do grupo, quando ele precisa de um. Primeiro filho do grupo. */
function RotuloDoMenu({ children, className }: { children: string; className?: string }) {
  return (
    <DropdownMenuPrimitive.Label data-slot="rotulo-do-menu" className={cn("t-rotulo px-2 pt-1 pb-0.5", className)}>
      {children}
    </DropdownMenuPrimitive.Label>
  )
}

type ItemDoMenuProps = {
  /** O rótulo. Texto puro, sem reticências. */
  children: string
  /** Um glifo por tipo de trabalho; a linha que faz o mesmo trabalho de um botão da barra repete o ícone dele. */
  icone?: IconeDeLinha
  onEscolher: () => void
  /**
   * O motivo, quando a ação existe e não pode ser feita agora. Com motivo, a
   * linha fica visível, alcançável pelo teclado, não executa, e diz o motivo
   * escrito na própria linha.
   */
  bloqueado?: string | null
  /** O valor à direita da linha: *vale por mais 10 h*, *a padrão*. */
  detalhe?: string
  /** A voz destrutiva: rótulo e ícone em `text-destructive`. Mora no último grupo. */
  destrutivo?: boolean
  /**
   * Quem confirma é a peça: escolher abre o `useConfirm` do `Menu`, e
   * `onEscolher` só roda com o "sim". Com `destrutivo`, o diálogo também é
   * destrutivo. Depois do diálogo, nos dois desfechos, o foco volta ao gatilho
   * do menu se ninguém o moveu. Sem `confirmacao`, `onEscolher` roda direto.
   */
  confirmacao?: Omit<OpcoesDaConfirmacao, "destrutivo" | "devolverFoco">
}

function IconeDaLinha({ icone: Icone, destrutivo, trancado }: { icone?: IconeDeLinha; destrutivo?: boolean; trancado: boolean }) {
  if (!Icone) return null
  return <Icone className={cn("size-3.5 shrink-0", destrutivo ? "text-current" : "text-foreground-2", trancado && "opacity-45")} />
}

function MotivoDaLinha({ id, children }: { id: string; children: string }) {
  return (
    <span id={id} className="min-w-0 pl-1.5 text-left text-xs leading-4 text-foreground-2">
      {children}
    </span>
  )
}

function DetalheDaLinha({ detalhe }: { detalhe?: string }) {
  if (!detalhe) return null
  return (
    <span className="ml-auto flex min-w-0 shrink items-center pl-3 text-xs leading-4 text-foreground-2 tabular-nums">
      <span className="shrink-0">{detalhe}</span>
    </span>
  )
}

function ItemDoMenu({ children, icone, onEscolher, bloqueado, detalhe, destrutivo, confirmacao }: ItemDoMenuProps) {
  const pedir = React.useContext(PedirDoMenu)
  const idDoMotivo = React.useId()
  if (confirmacao && !pedir) throw new Error("ItemDoMenu com confirmação precisa estar dentro de um Menu")
  const trancado = !!bloqueado

  const aoEscolher = (e: Event) => {
    // Bloqueado não usa o `disabled` do Radix (ele tira a linha do teclado): o menu fica aberto e nada roda.
    if (trancado) {
      e.preventDefault()
      return
    }
    if (confirmacao && pedir) {
      // O gatilho se acha antes de o menu desmontar: o `Trigger` do Radix leva o id do conteúdo em `aria-controls`.
      const menu = (e.currentTarget as HTMLElement | null)?.closest('[role="menu"]')
      const achado = menu?.id ? document.querySelector<HTMLElement>(`[aria-controls="${CSS.escape(menu.id)}"]`) : null
      // A âncora invisível do `AncoraDoMenu` também é um `Trigger`, mas não é gatilho de ninguém: lá a volta do foco é da tela.
      const gatilho = achado?.dataset.slot === "ancora-do-menu" ? null : achado
      void (async () => {
        // O menu fecha antes do diálogo abrir: os dois prendem o foco, e juntos disputam.
        await new Promise<void>((resolve) => setTimeout(resolve, 0))
        if (await pedir({ ...confirmacao, destrutivo: !!destrutivo, devolverFoco: gatilho })) onEscolher()
      })()
      return
    }
    onEscolher()
  }

  return (
    <DropdownMenuPrimitive.Item
      data-slot="item-do-menu"
      aria-disabled={trancado || undefined}
      data-bloqueado={trancado ? "" : undefined}
      aria-describedby={trancado ? idDoMotivo : undefined}
      onSelect={aoEscolher}
      className={cn(LINHA_DO_MENU, destrutivo && "text-destructive")}
    >
      <IconeDaLinha icone={icone} destrutivo={destrutivo} trancado={trancado} />
      <span className={cn("min-w-0 truncate", trancado && "shrink-0 opacity-45")}>{children}</span>
      {trancado ? <MotivoDaLinha id={idDoMotivo}>{bloqueado}</MotivoDaLinha> : <DetalheDaLinha detalhe={detalhe} />}
    </DropdownMenuPrimitive.Item>
  )
}

// Os valores bloqueados do grupo de escolha: o `RadioItem` do Radix troca o
// valor mesmo com o `onSelect` impedido, então o grupo recusa a troca.
const BloqueadosDaEscolha = React.createContext<React.RefObject<Set<string>> | null>(null)

/** A escolha de um entre vários. Radix `RadioGroup`. */
function GrupoDeEscolhaDoMenu({
  valor,
  onTrocar,
  rotulo,
  children,
}: {
  valor: string
  onTrocar: (valor: string) => void
  /** Vira um `RotuloDoMenu` no topo do grupo. */
  rotulo?: string
  children: React.ReactNode
}) {
  const bloqueados = React.useRef(new Set<string>())
  return (
    <BloqueadosDaEscolha.Provider value={bloqueados}>
      <DropdownMenuPrimitive.RadioGroup
        data-slot="grupo-de-escolha-do-menu"
        value={valor}
        onValueChange={(v) => {
          if (!bloqueados.current.has(v)) onTrocar(v)
        }}
        className="flex flex-col gap-0.5"
      >
        {rotulo ? <RotuloDoMenu className="pl-8">{rotulo}</RotuloDoMenu> : null}
        {children}
      </DropdownMenuPrimitive.RadioGroup>
    </BloqueadosDaEscolha.Provider>
  )
}

function ItemDeEscolhaDoMenu({
  valor,
  children,
  detalhe,
  bloqueado,
}: {
  valor: string
  children: string
  detalhe?: string
  bloqueado?: string | null
}) {
  const idDoMotivo = React.useId()
  const bloqueados = React.useContext(BloqueadosDaEscolha)
  const trancado = !!bloqueado
  React.useEffect(() => {
    if (!bloqueados || !trancado) return
    bloqueados.current.add(valor)
    return () => {
      bloqueados.current.delete(valor)
    }
  }, [bloqueados, trancado, valor])

  return (
    <DropdownMenuPrimitive.RadioItem
      data-slot="item-de-escolha-do-menu"
      value={valor}
      aria-disabled={trancado || undefined}
      data-bloqueado={trancado ? "" : undefined}
      aria-describedby={trancado ? idDoMotivo : undefined}
      onSelect={(e) => {
        if (trancado) e.preventDefault()
      }}
      className={cn(LINHA_DO_MENU, "pl-8")}
    >
      {/* A marca vai à esquerda, como no `SelectItem`; o encaixe existe sempre, e o texto não anda. */}
      <span className="absolute left-2 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <CheckIcon className="size-3.5" aria-hidden />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      <span className={cn("min-w-0 truncate", trancado && "shrink-0 opacity-45")}>{children}</span>
      {trancado ? <MotivoDaLinha id={idDoMotivo}>{bloqueado}</MotivoDaLinha> : <DetalheDaLinha detalhe={detalhe} />}
    </DropdownMenuPrimitive.RadioItem>
  )
}

const FRASE_DO_SUBMENU = "min-h-[30px] px-2 py-1 text-[13px] leading-[18px]"

/**
 * Uma linha que abre um submenu. Os estados da lista moram aqui, não na tela:
 * precedência `carregando` > `erro` > `lista` > `vazio`.
 */
function SubmenuDoMenu({
  children,
  icone,
  bloqueado,
  carregando,
  rotuloDaEspera,
  vazio,
  erro,
  onAbrir,
  lista,
}: {
  /** O rótulo da linha. Texto puro, sem reticências. */
  children: string
  icone?: IconeDeLinha
  /** Mesma regra do `ItemDoMenu`: não abre, diz o motivo. */
  bloqueado?: string | null
  /** Enquanto a lista não chegou: a `EsperaDaLista`, com duas linhas. */
  carregando?: boolean
  /** O que está vindo, para o leitor de tela. */
  rotuloDaEspera: string
  /** A frase quando a lista veio vazia. Só vale sem `lista`. */
  vazio?: string
  /** A falha ao buscar: a frase e o *Tentar de novo* como linha. */
  erro?: { texto: string; onTentarDeNovo: () => void } | null
  /** Abriu o submenu (por seta, clique ou ponteiro): a tela busca a lista aqui. */
  onAbrir?: () => void
  /** O conteúdo do submenu: um `GrupoDeEscolhaDoMenu`, normalmente. */
  lista?: React.ReactNode
}) {
  // Bloqueado é um item bloqueado no lugar do `Sub` inteiro: assim o submenu nunca abre.
  if (bloqueado) {
    return (
      <ItemDoMenu icone={icone} bloqueado={bloqueado} onEscolher={() => {}}>
        {children}
      </ItemDoMenu>
    )
  }
  return (
    <DropdownMenuPrimitive.Sub onOpenChange={(aberto) => aberto && onAbrir?.()}>
      <DropdownMenuPrimitive.SubTrigger data-slot="submenu-do-menu" className={cn(LINHA_DO_MENU, "data-[state=open]:bg-accent")}>
        <IconeDaLinha icone={icone} trancado={false} />
        <span className="min-w-0 truncate">{children}</span>
        <ChevronRightIcon className="ml-auto size-3.5 text-foreground-2" aria-hidden />
      </DropdownMenuPrimitive.SubTrigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.SubContent data-superficie sideOffset={4} alignOffset={-6} collisionPadding={8} className={CAIXA_DO_MENU}>
          {carregando ? (
            <EsperaDaLista linhas={2} alturaDaLinha="h-[30px] rounded-md" rotulo={rotuloDaEspera} className="gap-0.5" />
          ) : erro ? (
            <>
              <GrupoDoMenu>
                <p className={cn(FRASE_DO_SUBMENU, "flex items-center gap-1.5 text-foreground")}>
                  <span data-slot="ponto" data-tom="ruim" aria-hidden className={cn("size-1.5 shrink-0 rounded-full", PONTO_DO_TOM.ruim)} />
                  {erro.texto}
                </p>
              </GrupoDoMenu>
              <GrupoDoMenu>
                <ItemDoMenu icone={RotateCwIcon} onEscolher={erro.onTentarDeNovo}>
                  Tentar de novo
                </ItemDoMenu>
              </GrupoDoMenu>
            </>
          ) : lista ? (
            lista
          ) : vazio ? (
            <p className={cn(FRASE_DO_SUBMENU, "text-foreground-2")}>{vazio}</p>
          ) : null}
        </DropdownMenuPrimitive.SubContent>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Sub>
  )
}

/**
 * O menu sem botão: ancorado num retângulo da tela (o ponto clicado numa área de desenho).
 * Vai DENTRO de um `Menu` controlado (`open` + `onOpenChange`), no lugar do
 * `GatilhoDoMenu`.
 *
 * O `DropdownMenu` do Radix não exporta `Anchor`; quem posiciona o conteúdo é o
 * `Trigger`, então a âncora é um gatilho invisível. Ele sai por portal no
 * `document.body`: o `fixed` só é relativo à janela quando nenhum ancestral tem
 * `transform`. Ninguém clica, tabula ou ouve a âncora; ao fechar, a volta do
 * foco é da tela.
 */
function AncoraDoMenu({ retangulo }: { retangulo: { x: number; y: number; width: number; height: number } }) {
  const [montado, setMontado] = React.useState(false)
  React.useEffect(() => setMontado(true), [])
  if (!montado) return null
  return createPortal(
    <DropdownMenuPrimitive.Trigger asChild>
      <span
        data-slot="ancora-do-menu"
        aria-hidden="true"
        tabIndex={-1}
        className="pointer-events-none fixed"
        style={{ left: retangulo.x, top: retangulo.y, width: retangulo.width, height: retangulo.height }}
      />
    </DropdownMenuPrimitive.Trigger>,
    document.body
  )
}

export {
  AncoraDoMenu,
  ConteudoDoMenu,
  GatilhoDoMenu,
  GrupoDeEscolhaDoMenu,
  GrupoDoMenu,
  ItemDeEscolhaDoMenu,
  ItemDoMenu,
  LINHA_DO_MENU,
  Menu,
  RotuloDoMenu,
  SubmenuDoMenu,
  type ItemDoMenuProps,
}
