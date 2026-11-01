"use client"

import * as React from "react"

import { ProvedorDeLink, type ComponenteDeLink } from "@/registry/wicomm/lib/link-do-app"
import { ToastProvider } from "@/registry/wicomm/ui/toast"
import { TooltipProvider } from "@/registry/wicomm/ui/tooltip"
import { BarraLateral, type Contagem, type Conta, type GrupoDeDestinos } from "@/registry/wicomm/blocks/casco/barra-lateral"

/**
 * O CASCO de todo app autenticado da Wicomm (ANATOMIA CASCO-01, DESIGN LAY-01):
 * a barra lateral à esquerda, o cabeçalho opcional e a região do conteúdo.
 *
 * O casco não rola: a raiz tem a altura da janela e esconde o que passa. Dentro
 * da página, o topo fica parado e quem rola é a região do arquétipo, pela peça
 * de rolagem do kit; o `<main>` rola só como reserva, quando a janela fica
 * mais baixa que o mínimo da página.
 *
 * Camadas (LAY-05): `main` 10 · barra lateral 20 · cabeçalho 30 · gaveta 40.
 * O que precisa passar por cima da barra (menu, diálogo, aviso) sai por portal.
 *
 * Os provedores que as peças pedem (aviso, dica, link) moram aqui: quem monta
 * uma tela dentro do casco não precisa lembrar deles.
 */
type PropsDaBarra = Omit<React.ComponentProps<typeof BarraLateral>, "caminhoAtual">

/** O que a barra lê do roteador: o caminho atual e, quando o app as tem ali, as contagens e os destinos. */
type Navegacao = { caminhoAtual: string; contagens?: Record<string, Contagem>; grupos?: GrupoDeDestinos[]; recolherNestaTela?: boolean }

/** A barra que lê a navegação pelo gancho do roteador, isolada na própria espera. */
function BarraDoRoteador({ useNavegacao, ...props }: PropsDaBarra & { useNavegacao: () => Navegacao }) {
  const { caminhoAtual, contagens, grupos, recolherNestaTela } = useNavegacao()
  return (
    <BarraLateral
      {...props}
      caminhoAtual={caminhoAtual}
      contagens={contagens ?? props.contagens}
      grupos={grupos ?? props.grupos}
      recolherNestaTela={recolherNestaTela ?? props.recolherNestaTela}
    />
  )
}

function CascoDoApp({
  grupos,
  caminhoAtual,
  contagens,
  useNavegacao,
  conta,
  cabecalho,
  link,
  recolherNestaTela,
  children,
}: {
  grupos: GrupoDeDestinos[]
  /** O caminho atual, quando quem monta já o tem. */
  caminhoAtual?: string
  /** A contagem de cada destino (pelo `href`): dado vivo do servidor, fora da lista de rotas. */
  contagens?: Record<string, Contagem>
  /**
   * Ou o gancho que lê a navegação do roteador (`usePathname`). A barra que o
   * chama mora numa espera própria: no Next, ler o caminho numa rota dinâmica
   * não segura a tela inteira, e enquanto isso a barra se desenha sem destino ativo.
   */
  useNavegacao?: () => Navegacao
  /** A pessoa logada; o app sem login não passa. */
  conta?: Conta
  /** O `CabecalhoDoApp`, quando o app tem algo que vale para todas as telas. */
  cabecalho?: React.ReactNode
  /** O link do framework (`next/link`); sem ele, `<a>`. */
  link?: ComponenteDeLink
  /** A tela declarada densa: a barra começa recolhida nela. */
  recolherNestaTela?: boolean
  children: React.ReactNode
}) {
  const barra: PropsDaBarra = { grupos, contagens, conta, recolherNestaTela }
  const conteudo = (
    <ToastProvider>
      <TooltipProvider>
        <div data-slot="casco-do-app" className="flex h-screen overflow-hidden bg-background text-foreground">
          {useNavegacao ? (
            <React.Suspense fallback={<BarraLateral caminhoAtual="" {...barra} />}>
              <BarraDoRoteador useNavegacao={useNavegacao} {...barra} />
            </React.Suspense>
          ) : (
            <BarraLateral caminhoAtual={caminhoAtual ?? ""} {...barra} />
          )}
          <div className="flex min-w-0 flex-1 flex-col">
            {cabecalho}
            <main className="relative z-10 min-h-0 flex-1 overflow-y-auto">{children}</main>
          </div>
        </div>
      </TooltipProvider>
    </ToastProvider>
  )
  return link ? <ProvedorDeLink componente={link}>{conteudo}</ProvedorDeLink> : conteudo
}

export { CascoDoApp, type Navegacao }
