"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { CascoDoApp } from "@/registry/design-system/blocks/casco/casco-do-app"
import { DESTINOS, caminhoDaBarra } from "@/vitrine/navegacao"

function useNavegacao() {
  return { caminhoAtual: caminhoDaBarra(usePathname() ?? "/") }
}

/** O casco do kit (CASCO-01), sem conta: o acesso à vitrine é protegido fora do app. */
export function CascoDaVitrine({ children }: { children: React.ReactNode }) {
  return (
    <CascoDoApp grupos={DESTINOS} useNavegacao={useNavegacao} link={Link}>
      {children}
    </CascoDoApp>
  )
}
