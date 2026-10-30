"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"

import { CabecalhoDoApp } from "@/registry/wicomm/blocks/casco/cabecalho-do-app"
import { destinoAtivo } from "@/registry/wicomm/blocks/casco/barra-lateral"
import { CascoDoApp } from "@/registry/wicomm/blocks/casco/casco-do-app"
import { MenuDoContexto } from "@/registry/wicomm/blocks/casco/menu-do-contexto"
import { DESTINOS, TELAS_DENSAS, navegacaoDoExemplo } from "@/registry/wicomm/blocks/casco/navegacao"

/** No app, as contagens vêm do servidor; aqui, das fixações de exemplo, pelo `?estado=`. */
function useNavegacao() {
  const caminho = usePathname() ?? "/"
  const estado = useSearchParams().get("estado")
  return {
    caminhoAtual: caminho,
    recolherNestaTela: TELAS_DENSAS.some((t) => destinoAtivo(caminho, t)),
    ...navegacaoDoExemplo(caminho, estado),
  }
}

/**
 * A cola do casco com o Next (EXEMPLO): o caminho atual pelo `usePathname` e o
 * link pelo `next/link`. Num app Vite, a mesma cola usa o roteador dele. A
 * conta e o "Sair" vêm da autenticação do app; aqui são de mentira. A tela
 * densa (`TELAS_DENSAS`) começa com a barra recolhida.
 */
export function CascoNoNext({ children }: { children: React.ReactNode }) {
  return (
    <CascoDoApp
        grupos={DESTINOS}
        useNavegacao={useNavegacao}
        link={Link}
        conta={{ nome: "Ana Souza", email: "ana.souza@exemplo.com.br", onSair: () => {} }}
        cabecalho={<CabecalhoDoApp contexto={<MenuDoContexto />} />}
      >
        {children}
    </CascoDoApp>
  )
}
