import type { Metadata } from "next"
import type { ReactNode } from "react"

import { CODIGO_ANTES_DO_DESENHO } from "@/lib/antes-do-desenho"

import "./globals.css"

export const metadata: Metadata = {
  title: { default: "Ateliê Wicomm", template: "%s · Ateliê Wicomm" },
  description: "O catálogo vivo do design system da Wicomm.",
}

/**
 * O tema e a barra recolhida escolhem-se antes da pintura (o script do kit). O
 * palco (`/palco/{tema}/…`) é a exceção: o tema dele é o do endereço.
 */
const TEMA_ANTES_DA_PINTURA = `(() => {
  const p = location.pathname
  if (p.startsWith("/palco/")) document.documentElement.classList.toggle("dark", p.startsWith("/palco/escuro/"))
  else { ${CODIGO_ANTES_DO_DESENHO} }
})()`

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: TEMA_ANTES_DA_PINTURA }} />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
