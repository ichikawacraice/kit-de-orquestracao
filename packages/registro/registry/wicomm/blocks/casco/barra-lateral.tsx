"use client"

import * as React from "react"
import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react"

import { PONTO_DO_TOM, type Tom } from "@/registry/wicomm/lib/idioma-de-cor"
import { LinkDoApp } from "@/registry/wicomm/lib/link-do-app"
import { CHAVE_DA_BARRA } from "@/registry/wicomm/lib/antes-do-desenho"
import { cn } from "@/registry/wicomm/lib/utils"
import { ChipDeEstado } from "@/registry/wicomm/ui/chip-de-estado"
import { Logotipo } from "@/registry/wicomm/ui/logotipo"
import { MenuDaConta, Monograma } from "@/registry/wicomm/ui/menu-da-conta"
import { ICONE_DO_TEMA, MenuDoTema, ROTULO_DO_TEMA } from "@/registry/wicomm/ui/menu-do-tema"
import { Ajuda } from "@/registry/wicomm/ui/tooltip"

type Destino = {
  href: string
  rotulo: string
  icone: React.ComponentType<{ className?: string }>
}

/**
 * O que pede a pessoa num destino. É dado vivo, que vem do servidor junto da
 * tela, e não mora na lista de rotas. Só aparece acima de zero, e só nas vozes
 * que pedem (`espera`, `ruim`).
 */
type Contagem = { numero: number; tom: Extract<Tom, "espera" | "ruim">; frase: string }

type GrupoDeDestinos = { rotulo?: string; destinos: Destino[] }

type Conta = { nome: string; email: string; onAbrirConta?: () => void; onSair: () => void }

/** O destino ativo: a própria rota ou uma rota abaixo dela. */
function destinoAtivo(caminhoAtual: string, href: string): boolean {
  if (href === "/") return caminhoAtual === "/"
  return caminhoAtual === href || caminhoAtual.startsWith(`${href}/`)
}

function lerRecolhida(): boolean {
  try {
    return localStorage.getItem(CHAVE_DA_BARRA) === "recolhida"
  } catch {
    return false
  }
}

function gravarRecolhida(recolhida: boolean) {
  try {
    if (recolhida) localStorage.setItem(CHAVE_DA_BARRA, "recolhida")
    else localStorage.removeItem(CHAVE_DA_BARRA)
  } catch {
    // Sem armazenamento (aba privada), a preferência vale até a página fechar.
  }
  document.documentElement.toggleAttribute("data-barra-recolhida", recolhida)
}

/** Abaixo do `md` do Tailwind (768px), a barra começa recolhida e abre por cima do conteúdo (LAY-01). */
const TELA_ESTREITA = "(max-width: 767px)"

function useTelaEstreita(): boolean {
  const [estreita, setEstreita] = React.useState(false)
  React.useEffect(() => {
    if (typeof window.matchMedia !== "function") return
    const m = window.matchMedia(TELA_ESTREITA)
    setEstreita(m.matches)
    const mudou = (e: MediaQueryListEvent) => setEstreita(e.matches)
    m.addEventListener("change", mudou)
    return () => m.removeEventListener("change", mudou)
  }, [])
  return estreita
}

const LINHA =
  "flex h-10 w-full items-center gap-3 rounded-ctrl px-3 text-sm transition-colors duration-cor focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
const LINHA_RECOLHIDA = "justify-center px-0"
const LINHA_QUIETA = "text-foreground-2 hover:bg-accent hover:text-foreground"

/**
 * Antes de montar, a barra se desenha expandida, e estas classes a recolhem
 * pelo CSS quando o `<html>` tem a marca do `ScriptsAntesDoDesenho` (ou a tela é
 * estreita). Escritas por extenso: o Tailwind só gera a classe que lê inteira.
 */
const CEDO = {
  barra: "in-data-[barra-recolhida]:w-16 in-data-[barra-recolhida]:px-2 max-md:w-16 max-md:px-2",
  linha: "in-data-[barra-recolhida]:justify-center in-data-[barra-recolhida]:px-0 max-md:justify-center max-md:px-0",
  texto: "in-data-[barra-recolhida]:hidden max-md:hidden",
  soRecolhida: "hidden in-data-[barra-recolhida]:inline-flex max-md:inline-flex",
  marca: "in-data-[barra-recolhida]:justify-center in-data-[barra-recolhida]:px-0 max-md:justify-center max-md:px-0",
} as const

/**
 * Na barra recolhida, o rótulo vira dica à direita — o único lugar em que hover
 * como pista se justifica (CTRL-08). A dica está SEMPRE na árvore, e fica
 * travada fechada com a barra aberta: trocar a árvore desmontaria o botão, e o
 * foco de quem recolhe pelo teclado cairia no `<body>`.
 */
function ComDica({ recolhida, texto, children }: { recolhida: boolean; texto: string; children: React.ReactElement }) {
  return (
    <Ajuda texto={texto} lado="right" aberto={recolhida ? undefined : false}>
      {children}
    </Ajuda>
  )
}

function ItemDaNavegacao({
  destino,
  contagem,
  ativo,
  recolhida,
  cedo,
  aoNavegar,
}: {
  destino: Destino
  contagem?: Contagem
  ativo: boolean
  recolhida: boolean
  cedo: boolean
  aoNavegar?: () => void
}) {
  const Icone = destino.icone
  const conta = contagem && contagem.numero > 0 ? contagem : null
  return (
    <ComDica recolhida={recolhida} texto={conta ? `${destino.rotulo}: ${conta.frase}` : destino.rotulo}>
      <LinkDoApp
        href={destino.href}
        aria-current={ativo ? "page" : undefined}
        aria-label={recolhida ? destino.rotulo : undefined}
        onClick={aoNavegar}
        data-slot="item-da-navegacao"
        className={cn(LINHA, recolhida && LINHA_RECOLHIDA, cedo && CEDO.linha, ativo ? "bg-primary/10 font-semibold text-foreground" : LINHA_QUIETA)}
      >
        <span className="relative flex shrink-0 items-center">
          <Icone aria-hidden="true" className="size-4.5" />
          {/* Recolhida, a contagem vira ponto: o número não cabe, mas "há algo esperando" não pode sumir. */}
          {conta && recolhida ? <span aria-hidden="true" className={cn("absolute -top-1 -right-1.5 size-2 rounded-full", PONTO_DO_TOM[conta.tom])} /> : null}
        </span>
        {recolhida ? null : <span className={cn("min-w-0 flex-1 truncate", cedo && CEDO.texto)}>{destino.rotulo}</span>}
        {conta && !recolhida ? (
          <ChipDeEstado tom={conta.tom} aria-label={conta.frase} className={cn("tabular-nums", cedo && CEDO.texto)}>
            {conta.numero > 99 ? "99+" : conta.numero}
          </ChipDeEstado>
        ) : null}
      </LinkDoApp>
    </ComDica>
  )
}

/**
 * A BARRA LATERAL do casco (ANATOMIA CASCO-01, DESIGN LAY-01, CTRL-08): a marca
 * no topo, os destinos do app (ícone E rótulo), e ao pé recolher, tema e conta.
 * Nunca ação de tela, aviso ou filtro — esses são do topo da página.
 *
 * **Como recolhe:** 224px → 64px.
 * - pelo gesto do botão — só ele anima a largura; troca de tela e F5 mudam de uma vez;
 * - a preferência fica no navegador, e o `ScriptsAntesDoDesenho` (no layout
 *   raiz) faz a barra nascer na largura certa, antes de o React montar;
 * - `recolherNestaTela`: a tela declarada densa começa recolhida; abrir ali vale
 *   enquanto se está nela e não grava preferência;
 * - abaixo de 768px começa recolhida, e aberta passa POR CIMA do conteúdo, na
 *   camada de gaveta; fecha ao escolher destino, com Esc ou com o clique fora.
 *
 * O caminho atual entra por prop (`caminhoAtual`): a peça não conhece o roteador.
 */
function BarraLateral({
  grupos,
  caminhoAtual,
  contagens = {},
  conta,
  recolherNestaTela = false,
}: {
  grupos: GrupoDeDestinos[]
  caminhoAtual: string
  /** A contagem de cada destino, pelo `href`. */
  contagens?: Record<string, Contagem>
  conta: Conta
  recolherNestaTela?: boolean
}) {
  const estreita = useTelaEstreita()
  const [montada, setMontada] = React.useState(false)
  const [preferida, setPreferida] = React.useState(false)
  React.useEffect(() => {
    setPreferida(lerRecolhida())
    setMontada(true)
  }, [])
  // A abertura feita numa tela que começa recolhida vale até o motivo passar, e não grava.
  const [abertaAgora, setAbertaAgora] = React.useState(false)
  const motivo = estreita || recolherNestaTela
  React.useEffect(() => setAbertaAgora(false), [motivo, caminhoAtual])
  // Antes de montar, a tela densa (que quem monta já sabe) nasce recolhida; a preferência guardada, pelo CSS (`CEDO`).
  const recolhida = montada ? (motivo ? !abertaAgora : preferida) : recolherNestaTela
  const cedo = !montada && !recolhida
  const porCima = estreita && !recolhida && montada

  // A largura só anima no gesto; desliga no fim da transição, ou por prazo (sem transição, com movimento reduzido).
  const [animando, setAnimando] = React.useState(false)
  React.useEffect(() => {
    if (!animando) return
    const t = setTimeout(() => setAnimando(false), 400)
    return () => clearTimeout(t)
  }, [animando])

  function alternar() {
    setAnimando(true)
    if (motivo) {
      setAbertaAgora((v) => !v)
      return
    }
    const nova = !preferida
    setPreferida(nova)
    gravarRecolhida(nova)
  }

  React.useEffect(() => {
    if (!porCima) return
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbertaAgora(false)
    }
    window.addEventListener("keydown", aoTeclar)
    return () => window.removeEventListener("keydown", aoTeclar)
  }, [porCima])

  const mostrarRotulos = !recolhida && grupos.length > 1
  const rotuloDoTema = (tema: keyof typeof ICONE_DO_TEMA) => `Tema: ${ROTULO_DO_TEMA[tema].toLowerCase()}`
  const linha = cn(LINHA, recolhida && LINHA_RECOLHIDA, cedo && CEDO.linha, LINHA_QUIETA)
  const texto = cn("min-w-0 truncate", cedo && CEDO.texto)
  const lado = recolhida ? "right" : "top"

  return (
    <>
      {/* Na tela estreita, a barra aberta sai do fluxo; o encaixe de 64px fica, e o conteúdo não pula. */}
      {porCima ? <div aria-hidden="true" className="w-16 shrink-0" /> : null}
      {porCima ? <div aria-hidden="true" className="fixed inset-0 z-40" onClick={() => setAbertaAgora(false)} /> : null}
      <aside
        data-slot="barra-lateral"
        data-superficie
        data-recolhida={recolhida ? "" : undefined}
        aria-label="Navegação do app"
        onTransitionEnd={(e) => {
          if (e.target === e.currentTarget && e.propertyName === "width") setAnimando(false)
        }}
        className={cn(
          "flex shrink-0 flex-col gap-6 bg-card px-3 py-6",
          porCima ? "superficie-flutuante fixed inset-y-0 left-0 z-40" : "superficie relative z-20",
          animando && "transition-[width] duration-painel ease-abre motion-reduce:transition-none",
          recolhida ? "w-16 px-2" : "w-56",
          cedo && CEDO.barra
        )}
      >
        <LinkDoApp
          href="/"
          aria-label="Wicomm, início"
          className={cn(
            "flex h-8 items-center rounded-ctrl focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
            recolhida ? "justify-center" : "px-3",
            cedo && CEDO.marca
          )}
        >
          {recolhida ? (
            <Logotipo variante="simbolo" />
          ) : (
            <>
              <Logotipo variante="horizontal" className={cn(cedo && CEDO.texto)} />
              {cedo ? <Logotipo variante="simbolo" className={CEDO.soRecolhida} /> : null}
            </>
          )}
        </LinkDoApp>

        <nav aria-label="Destinos" className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
          {grupos.map((g, i) => (
            <div key={g.rotulo ?? i} className="flex flex-col gap-0.5">
              {mostrarRotulos && g.rotulo && g.destinos.length > 1 ? (
                <span className={cn("t-rotulo px-3 pb-1", cedo && CEDO.texto)}>{g.rotulo}</span>
              ) : null}
              {g.destinos.map((d) => (
                <ItemDaNavegacao
                  key={d.href}
                  destino={d}
                  contagem={contagens[d.href]}
                  ativo={destinoAtivo(caminhoAtual, d.href)}
                  recolhida={recolhida}
                  cedo={cedo}
                  aoNavegar={porCima ? () => setAbertaAgora(false) : undefined}
                />
              ))}
            </div>
          ))}
        </nav>

        <div className="flex flex-col gap-0.5">
          <ComDica recolhida={recolhida} texto="Expandir menu">
            <button type="button" onClick={alternar} aria-label={recolhida ? "Expandir menu" : undefined} aria-expanded={!recolhida} className={linha}>
              {recolhida ? <PanelLeftOpenIcon aria-hidden="true" className="size-4.5 shrink-0" /> : <PanelLeftCloseIcon aria-hidden="true" className="size-4.5 shrink-0" />}
              {recolhida ? null : <span className={texto}>Recolher menu</span>}
            </button>
          </ComDica>
          <MenuDoTema lado={lado}>
            {(tema) => {
              const Icone = ICONE_DO_TEMA[tema]
              return (
                <button type="button" aria-label={rotuloDoTema(tema)} className={linha}>
                  <Icone aria-hidden="true" className="size-4.5 shrink-0" />
                  {recolhida ? null : <span className={texto}>{rotuloDoTema(tema)}</span>}
                </button>
              )
            }}
          </MenuDoTema>
          <MenuDaConta nome={conta.nome} email={conta.email} onAbrirConta={conta.onAbrirConta} onSair={conta.onSair} lado={lado}>
            <button type="button" aria-label={`Conta de ${conta.nome}`} className={linha}>
              <Monograma nome={conta.nome} />
              {recolhida ? null : <span className={cn(texto, "text-foreground")}>{conta.nome}</span>}
            </button>
          </MenuDaConta>
        </div>
      </aside>
    </>
  )
}

export { BarraLateral, destinoAtivo, type Contagem, type Conta, type Destino, type GrupoDeDestinos }
