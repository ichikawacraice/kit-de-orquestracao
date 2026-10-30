import type { Metadata } from "next"
import type { ReactNode } from "react"

import "./globals.css"

export const metadata: Metadata = {
  title: { default: "Ateliê Wicomm", template: "%s · Ateliê Wicomm" },
  description: "O catálogo vivo do design system da Wicomm.",
}

/**
 * O tema escolhe-se antes da pintura: o palco escuro (`/palco/escuro/…`) é
 * sempre escuro; o resto segue o que a pessoa escolheu no casco, guardado no
 * navegador.
 */
const TEMA_ANTES_DA_PINTURA = `(() => {
  try {
    const p = location.pathname
    const escuro = p.startsWith("/palco/") ? p.startsWith("/palco/escuro/") : localStorage.getItem("atelie-tema") === "escuro"
    document.documentElement.classList.toggle("dark", escuro)
  } catch {}
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
