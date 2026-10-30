"use client"

import * as React from "react"

/**
 * O link das peças: um `<a>` por padrão, e o do framework quando o app o
 * declara. As peças do registro servem a Next e a Vite; quem amarra a peça ao
 * roteador é o app, uma vez, no casco — no Next, com o `Link` do `next/link`:
 *
 *     <ProvedorDeLink componente={Link}>…</ProvedorDeLink>
 *
 * Peça que importa `next/link` ou `usePathname` quebra o app Vite; por isso o
 * caminho atual entra por prop e o link entra por aqui.
 */
type PropsDoLink = Omit<React.ComponentProps<"a">, "href"> & { href: string }
type ComponenteDeLink = React.ComponentType<PropsDoLink>

const LinkDoContexto = React.createContext<ComponenteDeLink | null>(null)

function ProvedorDeLink({
  componente,
  children,
}: {
  // O `Link` do Next tem props a mais (`prefetch`, `replace`); o que a peça passa é o subconjunto do `<a>`.
  componente: React.ComponentType<any>
  children: React.ReactNode
}) {
  return <LinkDoContexto.Provider value={componente as ComponenteDeLink}>{children}</LinkDoContexto.Provider>
}

function LinkDoApp(props: PropsDoLink) {
  const Componente = React.useContext(LinkDoContexto)
  if (Componente) return <Componente {...props} />
  return <a {...props} />
}

export { LinkDoApp, ProvedorDeLink, type PropsDoLink }
