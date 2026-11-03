"use client"

import * as React from "react"
import { CheckIcon, CopyIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { COR_DO_TOM_DENSO } from "@/lib/idioma-de-cor"
import { cn } from "@/lib/utils"

const ORIGEM = "{origem}"

/**
 * Um comando para copiar: o texto e o botão de copiar colado à direita. O
 * desfecho fica no bloco, logo abaixo do comando (copiou ou falhou), até a
 * próxima cópia — sem aviso e sem sumir sozinho.
 *
 * `{origem}` no texto vira o endereço de onde a página está servida — o
 * registro mora no mesmo host. Até montar, o comando mostra só o caminho e o
 * botão fica bloqueado: copiado sem o host, ele não rodaria.
 */
export function Comando({ texto, className }: { texto: string; className?: string }) {
  const [origem, setOrigem] = React.useState<string | null>(null)
  const [desfecho, setDesfecho] = React.useState<"copiado" | "falhou" | null>(null)
  React.useEffect(() => setOrigem(window.location.origin), [])
  const precisaDeOrigem = texto.includes(ORIGEM)
  const final = texto.replaceAll(ORIGEM, origem ?? "")
  const pronto = !precisaDeOrigem || origem !== null
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(final)
      setDesfecho("copiado")
    } catch {
      setDesfecho("falhou")
    }
  }
  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex items-start gap-1 rounded-ctrl bg-muted py-1 pr-1 pl-3">
        <pre className="min-w-0 flex-1 overflow-x-auto py-1 font-mono text-controle text-foreground">{final}</pre>
        <Button variant="ghost" size="icon" onClick={copiar} disabled={!pronto} aria-label="Copiar o comando">
          {desfecho === "copiado" ? <CheckIcon /> : <CopyIcon />}
        </Button>
      </div>
      {/* O status existe sempre (o leitor de tela o acompanha) e só ocupa altura com texto. */}
      <p role="status" className={cn("text-legenda empty:hidden", desfecho && "pt-1", desfecho === "falhou" ? COR_DO_TOM_DENSO.ruim : COR_DO_TOM_DENSO.ok)}>
        {desfecho === "copiado" ? "Copiado" : desfecho === "falhou" ? "O navegador não deixou copiar: selecione o texto do comando." : null}
      </p>
    </div>
  )
}
