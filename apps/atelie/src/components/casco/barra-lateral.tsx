"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { BoxIcon, HouseIcon, LayoutTemplateIcon, MoonIcon, PaletteIcon, SunIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ConteudoDoMenu, GatilhoDoMenu, GrupoDeEscolhaDoMenu, ItemDeEscolhaDoMenu, Menu } from "@/components/ui/menu"
import { SECOES, VERSAO, itensDaSecao, type IdDaSecao } from "@/catalogo/registro"
import { cn } from "@/lib/utils"

const ICONE_DA_SECAO: Record<IdDaSecao, typeof BoxIcon> = {
  fundamentos: PaletteIcon,
  pecas: BoxIcon,
  blocos: LayoutTemplateIcon,
}

const LINHA = "flex items-center gap-2 rounded-ctrl px-2 py-1 text-controle text-foreground-2 transition-colors duration-cor hover:bg-accent hover:text-foreground"
const ATIVA = "bg-accent text-foreground shadow-linha-ativa"

/** A barra lateral do casco (CASCO-01): o nome do app, os destinos e o tema ao pé. */
export function BarraLateral() {
  const caminho = usePathname()
  return (
    <aside className="sticky top-0 flex h-dvh w-64 shrink-0 flex-col gap-4 bg-sidebar px-3 py-4">
      <Link href="/" className="flex items-baseline gap-2 px-2">
        <span className="t-titulo">Ateliê</span>
        <span className="font-mono text-legenda text-muted-foreground">v{VERSAO}</span>
      </Link>
      <nav aria-label="Catálogo" className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
        <Link href="/" aria-current={caminho === "/" ? "page" : undefined} className={cn(LINHA, caminho === "/" && ATIVA)}>
          <HouseIcon className="size-4" aria-hidden />
          Início
        </Link>
        {SECOES.map((secao) => {
          const Icone = ICONE_DA_SECAO[secao.id]
          const itens = itensDaSecao(secao.id)
          return (
            <div key={secao.id} className="flex flex-col">
              <h2 className="t-rotulo flex items-center gap-1.5 px-2 pb-1">
                <Icone className="size-3.5" aria-hidden />
                {secao.titulo}
              </h2>
              {itens.length === 0 ? (
                <p className="px-2 text-xs text-muted-foreground">{secao.vazio}</p>
              ) : (
                itens.map((item) => {
                  const href = `/catalogo/${item.name}/`
                  const ativa = caminho === href || caminho === href.slice(0, -1)
                  return (
                    <Link key={item.name} href={href} aria-current={ativa ? "page" : undefined} className={cn(LINHA, ativa && ATIVA)}>
                      {item.title}
                    </Link>
                  )
                })
              )}
            </div>
          )
        })}
      </nav>
      <EscolhaDoTema />
    </aside>
  )
}

function EscolhaDoTema() {
  const [tema, setTema] = React.useState("claro")
  React.useEffect(() => {
    setTema(document.documentElement.classList.contains("dark") ? "escuro" : "claro")
  }, [])
  const trocar = (novo: string) => {
    setTema(novo)
    document.documentElement.classList.toggle("dark", novo === "escuro")
    try {
      localStorage.setItem("atelie-tema", novo)
    } catch {}
  }
  const Icone = tema === "escuro" ? MoonIcon : SunIcon
  return (
    <Menu>
      <GatilhoDoMenu asChild>
        <Button variant="ghost" className="justify-start">
          <Icone />
          Tema {tema}
        </Button>
      </GatilhoDoMenu>
      <ConteudoDoMenu>
        <GrupoDeEscolhaDoMenu valor={tema} onTrocar={trocar} rotulo="Tema do ateliê">
          <ItemDeEscolhaDoMenu valor="claro">Claro</ItemDeEscolhaDoMenu>
          <ItemDeEscolhaDoMenu valor="escuro">Escuro</ItemDeEscolhaDoMenu>
        </GrupoDeEscolhaDoMenu>
      </ConteudoDoMenu>
    </Menu>
  )
}
