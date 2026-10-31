"use client"

import * as React from "react"
import { MoonIcon, SunIcon, SunMoonIcon } from "lucide-react"

import { CHAVE_DO_TEMA, ESCURO } from "@/registry/wicomm/lib/antes-do-desenho"
import { ConteudoDoMenu, GatilhoDoMenu, GrupoDeEscolhaDoMenu, ItemDeEscolhaDoMenu, Menu } from "@/registry/wicomm/ui/menu"

type Tema = "claro" | "escuro" | "sistema"

const ICONE_DO_TEMA: Record<Tema, React.ComponentType<{ className?: string }>> = {
  claro: SunIcon,
  escuro: MoonIcon,
  sistema: SunMoonIcon,
}

const ROTULO_DO_TEMA: Record<Tema, string> = {
  claro: "Claro",
  escuro: "Escuro",
  sistema: "Do sistema",
}

function lerTema(): Tema {
  try {
    const t = localStorage.getItem(CHAVE_DO_TEMA)
    return t === "claro" || t === "escuro" ? t : "sistema"
  } catch {
    return "sistema"
  }
}

function aplicarTema(tema: Tema) {
  const escuro = tema === "escuro" || (tema === "sistema" && window.matchMedia?.(ESCURO).matches)
  document.documentElement.classList.toggle("dark", !!escuro)
}

/**
 * O tema da pessoa: claro, escuro ou o do sistema, guardado no navegador e
 * aplicado como a classe `.dark` no `<html>` (o tema dos tokens).
 *
 * O valor guardado é lido DEPOIS da hidratação (LAY-01), e só então aplicado:
 * aplicar antes de ler trocaria o tema por um instante. Quem evita o clarão
 * antes disso é o `ScriptsAntesDoDesenho`, no layout raiz.
 */
function useTema(): [Tema, (tema: Tema) => void] {
  const [tema, setTema] = React.useState<Tema | null>(null)
  React.useEffect(() => setTema(lerTema()), [])
  React.useEffect(() => {
    if (tema === null) return
    aplicarTema(tema)
    if (tema !== "sistema" || typeof window.matchMedia !== "function") return
    const m = window.matchMedia(ESCURO)
    const mudou = () => aplicarTema("sistema")
    m.addEventListener("change", mudou)
    return () => m.removeEventListener("change", mudou)
  }, [tema])
  const trocar = React.useCallback((novo: Tema) => {
    try {
      if (novo === "sistema") localStorage.removeItem(CHAVE_DO_TEMA)
      else localStorage.setItem(CHAVE_DO_TEMA, novo)
    } catch {
      // Sem armazenamento (aba privada), o tema vale até a página fechar.
    }
    setTema(novo)
  }, [])
  return [tema ?? "sistema", trocar]
}

/**
 * O menu do tema (ANATOMIA PECA-01: trocar de contexto num gesto — a escolha
 * JÁ é a ação). `children` é o gatilho, um botão do kit; quem o desenha é o
 * lugar onde o menu mora (o pé da barra lateral, a barra do Editor).
 */
function MenuDoTema({
  children,
  lado = "bottom",
}: {
  children: (tema: Tema) => React.ReactElement
  lado?: "top" | "right" | "bottom" | "left"
}) {
  const [tema, trocar] = useTema()
  return (
    <Menu>
      <GatilhoDoMenu asChild>{children(tema)}</GatilhoDoMenu>
      <ConteudoDoMenu side={lado} align="start" aria-label="Tema">
        <GrupoDeEscolhaDoMenu valor={tema} onTrocar={(v) => trocar(v as Tema)} rotulo="Tema">
          {(["claro", "escuro", "sistema"] as const).map((t) => (
            <ItemDeEscolhaDoMenu key={t} valor={t}>
              {ROTULO_DO_TEMA[t]}
            </ItemDeEscolhaDoMenu>
          ))}
        </GrupoDeEscolhaDoMenu>
      </ConteudoDoMenu>
    </Menu>
  )
}

export { ICONE_DO_TEMA, MenuDoTema, ROTULO_DO_TEMA, useTema, type Tema }
