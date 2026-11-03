"use client"

import * as React from "react"
import { CheckIcon, InfoIcon, TriangleAlertIcon, XIcon } from "lucide-react"

import { COR_DO_TOM_DENSO, type Tom } from "@/registry/design-system/lib/idioma-de-cor"
import { cn } from "@/registry/design-system/lib/utils"

/**
 * O aviso — um cartão efêmero que confirma o DESFECHO de uma ação e some
 * sozinho, esteja a pessoa na tela que for.
 *
 * Não substitui o estado na própria tela: o aviso some, e desfecho que alguém
 * precisa reler continua visível onde a ação mora.
 *
 * Escrito à mão, sem biblioteca: é uma lista com relógio, sem nada do que
 * justifica uma (posicionamento com colisão, ancoragem). A dica é o contrário,
 * e lá o Radix se paga.
 *
 * As vozes são um RECORTE do idioma de cor (COR-05): `ok`, `ruim` e `neutro`.
 * Aviso de erro fica até ser fechado: sumir sozinho com uma falha é o mesmo que
 * engoli-la.
 */
type TomDoToast = Extract<Tom, "ok" | "ruim" | "neutro">

interface ToastInput {
  titulo: string
  descricao?: string
  tom?: TomDoToast
  /** ms até sumir; 0 mantém até fecharem. Padrão: 6000, e 0 no `ruim`. */
  duracao?: number
}

interface Aviso extends ToastInput {
  id: number
}

const ToastContext = React.createContext<((t: ToastInput) => void) | null>(null)

/** Dispara um aviso de qualquer lugar sob o `ToastProvider`. Fora dele, falha alto. */
function useToast(): (t: ToastInput) => void {
  const ctx = React.useContext(ToastContext)
  if (!ctx) throw new Error("useToast precisa estar dentro de <ToastProvider>")
  return ctx
}

/** O mesmo, ou `null` fora do provider — para o componente que também monta sem ele e só avisa num desfecho raro. */
function useToastSeHouver(): ((t: ToastInput) => void) | null {
  return React.useContext(ToastContext)
}

const ICONE: Record<TomDoToast, React.ComponentType<{ className?: string }>> = {
  ok: CheckIcon,
  ruim: TriangleAlertIcon,
  neutro: InfoIcon,
}

/**
 * `neutro` não ganha tinta de voz: o aviso que só informa é prosa, e fica na
 * tinta cheia do texto. Com a tinta do `neutro` o título cairia para o cinza de
 * legenda, que é o degrau de quem não é o assunto.
 */
const TINTA: Record<TomDoToast, string> = {
  ok: COR_DO_TOM_DENSO.ok,
  ruim: COR_DO_TOM_DENSO.ruim,
  neutro: "text-foreground",
}

function ToastProvider({ children }: { children: React.ReactNode }) {
  const [avisos, setAvisos] = React.useState<Aviso[]>([])
  const proximoId = React.useRef(1)

  const remover = React.useCallback((id: number) => setAvisos((t) => t.filter((x) => x.id !== id)), [])
  const avisar = React.useCallback((input: ToastInput) => {
    const id = proximoId.current++
    setAvisos((t) => [...t, { ...input, id }])
  }, [])

  return (
    <ToastContext.Provider value={avisar}>
      {children}
      {/* `pointer-events-none` na pilha e `auto` no cartão: a pilha não rouba
          clique da tela atrás dela — o aviso é aviso, não bloqueio. */}
      {/* A região `status` mora aqui desde o primeiro desenho, vazia (ACES-05):
          os leitores só anunciam o que entra numa região que já existia.
          `aria-atomic="false"` anuncia só o cartão novo, não a pilha toda. */}
      <div
        data-slot="toast-viewport"
        role="status"
        aria-atomic="false"
        className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-full max-w-sm flex-col gap-2"
      >
        {avisos.map((t) => (
          <CartaoDoAviso key={t.id} aviso={t} aoFechar={remover} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function CartaoDoAviso({ aviso, aoFechar }: { aviso: Aviso; aoFechar: (id: number) => void }) {
  const tom = aviso.tom ?? "neutro"
  const Icone = ICONE[tom]
  const duracao = aviso.duracao ?? (tom === "ruim" ? 0 : 6000)
  const { id } = aviso

  React.useEffect(() => {
    if (duracao <= 0) return
    const t = setTimeout(() => aoFechar(id), duracao)
    return () => clearTimeout(t)
  }, [duracao, aoFechar, id])

  return (
    <div
      data-slot="toast"
      data-superficie
      data-tom={tom}
      // O erro interrompe (`alert`); o resto é notícia que espera a vez e entra
      // na região `status` da pilha, que já existia (ACES-05).
      role={tom === "ruim" ? "alert" : undefined}
      className={cn(
        "superficie-flutuante pointer-events-auto flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm animate-in fade-in-0 slide-in-from-bottom-2 duration-menu-abre ease-abre motion-reduce:animate-none",
        TINTA[tom]
      )}
    >
      <Icone className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{aviso.titulo}</p>
        {aviso.descricao ? <p className="mt-0.5 text-xs text-muted-foreground">{aviso.descricao}</p> : null}
      </div>
      <button
        type="button"
        onClick={() => aoFechar(id)}
        aria-label="Fechar aviso"
        // O desenho fica de 14px; o alvo de clique é de 24px, por um pseudo-elemento (ACES-03).
        className="relative shrink-0 rounded-md text-muted-foreground after:absolute after:-inset-[5px] after:content-[''] transition-colors duration-cor hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <XIcon className="size-3.5" />
      </button>
    </div>
  )
}

export { ToastProvider, useToast, useToastSeHouver, type TomDoToast, type ToastInput }
