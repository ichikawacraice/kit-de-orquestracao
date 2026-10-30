import * as React from "react"
import { CircleAlertIcon, LockIcon, SearchXIcon } from "lucide-react"

import type { Tom } from "@/registry/wicomm/lib/idioma-de-cor"
import { cn } from "@/registry/wicomm/lib/utils"
import { Button } from "@/registry/wicomm/ui/button"
import { MedalhaoDoIcone } from "@/registry/wicomm/ui/medalhao-do-icone"

type TipoDeErro = "erro" | "nao-encontrado" | "sem-permissao"

const DO_TIPO: Record<TipoDeErro, { icone: React.ComponentProps<typeof MedalhaoDoIcone>["icone"]; tom: Tom }> = {
  erro: { icone: CircleAlertIcon, tom: "ruim" },
  "nao-encontrado": { icone: SearchXIcon, tom: "neutro" },
  "sem-permissao": { icone: LockIcon, tom: "alheio" },
}

/**
 * O que não deu para mostrar (ANATOMIA PECA-01), em duas escalas:
 *
 * - `rota` — a rota inteira não tem o que mostrar (erro, não encontrado, sem
 *   permissão): medalhão `md`, título `h1` (é o título da tela), a frase e a
 *   saída de quem chama;
 * - `bloco` — uma região falhou e a tela continua de pé: sem título nem saída,
 *   a frase e *Tentar de novo* em `outline sm`, anunciada (`role="alert"`).
 *
 * Nunca tracejada: tracejado é ausência (FORMA-02), e erro não é ausência. O
 * texto é o que a pessoa pode fazer, nunca o erro cru (MSG-03).
 */
function TelaDeErro({
  escala,
  tipo = "erro",
  titulo,
  saida,
  onTentarDeNovo,
  className,
  children,
}: {
  escala: "rota" | "bloco"
  tipo?: TipoDeErro
  /** Só na escala `rota`. */
  titulo?: string
  /** Só na escala `rota`: o caminho de volta (um `Button asChild` com link). */
  saida?: React.ReactNode
  onTentarDeNovo?: () => void
  className?: string
  children: React.ReactNode
}) {
  const { icone, tom } = DO_TIPO[tipo]
  if (escala === "bloco") {
    return (
      <div
        role="alert"
        data-slot="tela-de-erro"
        data-escala="bloco"
        data-tipo={tipo}
        className={cn("mx-auto flex max-w-medida flex-col items-center gap-3 px-6 py-10 text-center", className)}
      >
        <MedalhaoDoIcone icone={icone} tom={tom} />
        <p className="t-denso text-foreground-2">{children}</p>
        {onTentarDeNovo ? (
          <Button variant="outline" size="sm" onClick={onTentarDeNovo}>
            Tentar de novo
          </Button>
        ) : null}
      </div>
    )
  }
  return (
    <div
      data-slot="tela-de-erro"
      data-escala="rota"
      data-tipo={tipo}
      className={cn("mx-auto flex max-w-medida flex-col items-center gap-6 px-6 py-16 text-center", className)}
    >
      <MedalhaoDoIcone icone={icone} tom={tom} tamanho="md" />
      <div className="flex flex-col gap-2">
        <h1 className="t-display text-foreground">{titulo ?? "Não deu para abrir esta tela"}</h1>
        <p className="text-sm text-foreground-2">{children}</p>
      </div>
      {saida || onTentarDeNovo ? (
        <div className="flex items-center gap-2">
          {onTentarDeNovo ? (
            <Button variant={saida ? "outline" : "default"} onClick={onTentarDeNovo}>
              Tentar de novo
            </Button>
          ) : null}
          {saida}
        </div>
      ) : null}
    </div>
  )
}

export { TelaDeErro, type TipoDeErro }
