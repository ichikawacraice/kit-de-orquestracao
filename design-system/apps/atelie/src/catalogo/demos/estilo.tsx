"use client"

import { cn } from "@/lib/utils"

import { Amostra, Amostras } from "./_amostra"

const CORES = ["background", "card", "muted", "accent", "primary", "destructive", "border", "foreground"] as const
const FUNDO: Record<(typeof CORES)[number], string> = {
  background: "bg-background",
  card: "bg-card",
  muted: "bg-muted",
  accent: "bg-accent",
  primary: "bg-primary",
  destructive: "bg-destructive",
  border: "bg-border",
  foreground: "bg-foreground",
}
const VOZES = [
  { classe: "t-display", nome: "display" },
  { classe: "t-titulo", nome: "título" },
  { classe: "t-denso", nome: "denso" },
  { classe: "t-rotulo", nome: "rótulo" },
] as const
const SUPERFICIES = ["superficie", "superficie-alta", "superficie-flutuante"] as const

export default function DemoDoEstilo() {
  return (
    <Amostras>
      <Amostra titulo="Cores do tema" primeira>
        {CORES.map((cor) => (
          <div key={cor} className="flex w-24 flex-col gap-1.5">
            <span aria-hidden className={cn("anel-de-controle h-10 rounded-ctrl", FUNDO[cor])} />
            <span className="font-mono text-legenda text-foreground-2">{cor}</span>
          </div>
        ))}
      </Amostra>
      <Amostra titulo="Vozes de texto">
        <div className="flex flex-col gap-2">
          {VOZES.map((v) => (
            <p key={v.classe} className={v.classe}>
              {v.nome}: a mesma frase em cada voz
            </p>
          ))}
        </div>
      </Amostra>
      <Amostra titulo="Superfícies">
        {SUPERFICIES.map((s) => (
          <div key={s} className={cn(s, "flex h-20 w-36 items-end rounded-cartao p-3")}>
            <span className="font-mono text-legenda text-foreground-2">{s}</span>
          </div>
        ))}
      </Amostra>
    </Amostras>
  )
}
