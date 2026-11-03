import * as React from "react"

import { cn } from "@/registry/design-system/lib/utils"

/**
 * O CABEÇALHO do casco (ANATOMIA CASCO-01), opcional: só o que vale IGUAL em
 * todas as telas do app e muda o app inteiro — a troca de contexto, a busca
 * global, a conexão com um serviço de fora. Nunca título, primário, conta ou
 * tema: o título e o primário mudam com a tela (são do topo da página); conta e
 * tema moram no pé da barra lateral.
 *
 * Não tem fundo próprio: o chão é o do casco, e o contorno da barra lateral
 * corre inteiro ao lado dele.
 *
 * O teste para um caso novo: se a coisa continua valendo depois de trocar de
 * destino, é daqui; se não, é do topo da página. App sem nada disso não monta
 * o cabeçalho.
 */
function CabecalhoDoApp({
  contexto,
  busca,
  conexao,
  className,
}: {
  contexto?: React.ReactNode
  busca?: React.ReactNode
  conexao?: React.ReactNode
  className?: string
}) {
  return (
    <div
      data-slot="cabecalho-do-app"
      role="banner"
      className={cn("relative z-30 flex h-12 shrink-0 items-center gap-3 px-6", className)}
    >
      {contexto}
      {busca ? <div className="min-w-0 flex-1">{busca}</div> : <div className="flex-1" />}
      {conexao}
    </div>
  )
}

export { CabecalhoDoApp }
