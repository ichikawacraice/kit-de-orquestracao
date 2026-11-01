import * as React from "react"

import { cn } from "@/registry/wicomm/lib/utils"

/** As iniciais de um nome: "Ana Souza" → "AS". Sem nome, "?". */
function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  const primeira = partes[0]?.[0] ?? "?"
  const ultima = partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? "") : ""
  return (primeira + ultima).toUpperCase()
}

/**
 * O monograma da pessoa (CTRL-05): círculo de 20px com as iniciais, em tinta
 * neutra — nunca na cor da marca (MARCA-02) e nunca numa cor por pessoa
 * (COR-09: seria uma régua de identidade que não responde pergunta nenhuma).
 * É enfeite do nome que vem ao lado ou da dica: `aria-hidden`.
 */
function Monograma({ nome, className }: { nome: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      data-slot="monograma"
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground/[0.07] text-[10px] font-[650] text-foreground-2",
        className
      )}
    >
      {iniciais(nome)}
    </span>
  )
}

/**
 * O lugar da pessoa que não há: o círculo TRACEJADO de 20px, porque a
 * tracejada é ausência (FORMA-02). O texto da ausência é de quem chama.
 */
function MonogramaAusente({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      data-slot="monograma-ausente"
      className={cn("inline-block size-5 shrink-0 rounded-full border border-dashed border-input", className)}
    />
  )
}

export { Monograma, MonogramaAusente, iniciais }
