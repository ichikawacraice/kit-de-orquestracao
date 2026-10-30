import type { Metadata } from "next"
import { Archivo } from "next/font/google"
import "./globals.css"

import { ScriptsAntesDoDesenho } from "@/lib/antes-do-desenho"

// A família da Wicomm (TIPO-01), com o eixo de largura: é o app que a carrega e declara `--font-archivo`.
const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo" })

export const metadata: Metadata = { title: "Blocos Wicomm" }

// `suppressHydrationWarning`: o tema e a barra recolhida entram como marca no `<html>` antes da
// hidratação, pelo script no `<head>` — o layout raiz não se redesenha na navegação.
export default function LayoutRaiz({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={archivo.variable} suppressHydrationWarning>
      <head>
        <ScriptsAntesDoDesenho />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  )
}
