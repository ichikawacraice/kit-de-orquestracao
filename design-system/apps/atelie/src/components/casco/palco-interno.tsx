"use client"

import * as React from "react"

/**
 * O conteúdo do palco (dentro do iframe). Avisa a página de fora da própria
 * altura sempre que ela muda — um diálogo aberto conta pela janela inteira, então
 * a altura mínima do palco (em palcos.tsx) já cabe um diálogo curto.
 */
export function Palco({ tema, children }: { tema: string; children: React.ReactNode }) {
  const ref = React.useRef<HTMLElement>(null)
  React.useEffect(() => {
    const el = ref.current
    if (!el || window.parent === window) return
    const avisar = () => window.parent.postMessage({ palco: location.pathname, altura: el.scrollHeight }, location.origin)
    const observador = new ResizeObserver(avisar)
    observador.observe(el)
    avisar()
    return () => observador.disconnect()
  }, [])
  // O tema do palco é o do endereço. Peça que aplica o tema da pessoa no
  // `<html>` ao montar (o menu do tema, no pé da barra do casco) não o troca.
  React.useEffect(() => {
    const html = document.documentElement
    const escuro = tema === "escuro"
    const manter = () => {
      if (html.classList.contains("dark") !== escuro) html.classList.toggle("dark", escuro)
    }
    const vigia = new MutationObserver(manter)
    vigia.observe(html, { attributes: true, attributeFilter: ["class"] })
    manter()
    return () => vigia.disconnect()
  }, [tema])
  return (
    <main ref={ref} data-tema={tema} className="bg-background p-6">
      {children}
    </main>
  )
}
