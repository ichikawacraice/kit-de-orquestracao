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
  /**
   * O `Link` do Next entra como está: as props a mais dele (`prefetch`,
   * `replace`) são opcionais, e o que a peça passa é o subconjunto do `<a>`. O
   * do react-router pede `to`: embrulhe-o uma vez, FORA de componente
   * (`const LinkDoRoteador = ({ href, ...p }: PropsDoLink) => <Link to={href} {...p} />`),
   * senão cada desenho cria um componente novo e o link remonta.
   */
  componente: ComponenteDeLink
  children: React.ReactNode
}) {
  return <LinkDoContexto.Provider value={componente}>{children}</LinkDoContexto.Provider>
}

function LinkDoApp(props: PropsDoLink) {
  const Componente = React.useContext(LinkDoContexto)
  // O componente vem do contexto: o app o declara uma vez, no casco, e ele não
  // muda entre desenhos — o estado do link não reinicia. Em JSX, o
  // `react-hooks/static-components` (v7) o lê como criado no desenho; e uma
  // diretiva que o desligue quebraria o lint do projeto sem esse plugin
  // ("Definition for rule … was not found"). Por isso o `createElement`.
  if (Componente) return React.createElement(Componente, props)
  return <a {...props} />
}

export { LinkDoApp, ProvedorDeLink, type ComponenteDeLink, type PropsDoLink }
