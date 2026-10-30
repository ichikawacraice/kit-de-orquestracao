"use client"

import * as React from "react"

/**
 * A moldura de um bloco de tela: uma janela de altura fixa no lugar da janela
 * do navegador. O bloco mede a tela inteira (`h-screen`), e o palco mede o
 * conteúdo para dar altura ao iframe — sem a moldura, um empurraria o outro.
 * O `transform` faz da moldura o chão do que o bloco põe em `fixed`.
 */
export function Tela({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-160 transform-gpu overflow-hidden rounded-cartao ring-1 ring-border [&_[data-slot=casco-do-app]]:h-full [&_[data-slot=tela-de-entrada]]:min-h-full">
      {children}
    </div>
  )
}

/** O link do palco: não sai da demonstração (a rota de exemplo não existe no ateliê). */
export function LinkDoPalco(props: React.ComponentProps<"a">) {
  return (
    <a
      {...props}
      onClick={(e) => {
        e.preventDefault()
        props.onClick?.(e)
      }}
    />
  )
}

export const CONTA = { nome: "Ana Souza", email: "ana.souza@exemplo.com.br", onSair: () => {} }
