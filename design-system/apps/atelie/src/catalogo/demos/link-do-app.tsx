"use client"

import * as React from "react"

import { LinkDoApp, ProvedorDeLink } from "@/lib/link-do-app"

import { Amostra, Amostras } from "./_amostra"

export default function DemoDoLinkDoApp() {
  const [ultimo, setUltimo] = React.useState("Nenhum link seguido.")
  // O que o app declara uma vez, no casco: aqui, um link que só conta o destino.
  const Roteador = React.useCallback(
    ({ href, children, ...props }: React.ComponentProps<"a">) => (
      <a
        {...props}
        href={href}
        onClick={(e) => {
          e.preventDefault()
          setUltimo(`O roteador do app levaria a ${href}.`)
        }}
      >
        {children}
      </a>
    ),
    []
  )
  return (
    <Amostras>
      <Amostra titulo="Com o link do framework (no Next, o next/link)" primeira>
        <ProvedorDeLink componente={Roteador}>
          <LinkDoApp href="/pedidos" className="text-sm sublinhado-de-link">
            Ver os pedidos
          </LinkDoApp>
        </ProvedorDeLink>
        <p role="status" className="text-sm text-foreground-2">
          {ultimo}
        </p>
      </Amostra>
    </Amostras>
  )
}
