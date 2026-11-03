import { ChipDeEstado } from "@/components/ui/chip-de-estado"
import { cn } from "@/lib/utils"
import { formatarRazao } from "@/vitrine/tokens"

/**
 * Uma razão de contraste DESENHADA: o número escrito na própria tinta, sobre o
 * próprio fundo — a amostra é a prova. Só o que fica abaixo do piso ganha voz
 * (o teste dos tokens já garante o resto; selo de "passa" seria ruído).
 */
export function AmostraDeRazao({
  frente,
  fundo,
  razao,
  piso,
  contorno = false,
  className,
}: {
  frente: string
  fundo: string
  razao: number
  piso: number | null
  contorno?: boolean
  className?: string
}) {
  const abaixo = piso !== null && razao < piso
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <span
        className="t-medida inline-flex h-ctrl min-w-20 items-center justify-center rounded-ctrl px-2"
        style={contorno ? { backgroundColor: fundo, color: frente, boxShadow: `inset 0 0 0 1px ${frente}` } : { backgroundColor: fundo, color: frente }}
      >
        {formatarRazao(razao)}
      </span>
      {abaixo ? <ChipDeEstado tom="ruim">abaixo de {String(piso).replace(".", ",")}</ChipDeEstado> : null}
    </span>
  )
}
