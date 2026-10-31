import * as React from "react"
import { CheckIcon } from "lucide-react"

import type { Tom } from "@/registry/wicomm/lib/idioma-de-cor"
import { cn } from "@/registry/wicomm/lib/utils"
import { Estado } from "@/registry/wicomm/ui/estado"
import { TopoDoPainel } from "@/registry/wicomm/ui/secao"

type SituacaoDaEstacao = "feita" | "atual" | "a-frente" | "falhou"

type Estacao<T extends string> = {
  chave: T
  nome: string
  situacao: SituacaoDaEstacao
  /** A palavra do estado da estação ATUAL: "aguarda você", "em curso". As outras não levam palavra. */
  palavra?: string
  /** A voz da estação atual: `espera` (pede você), `alheio` (parada com outra pessoa), `neutro` (andando), `ruim` (falhou). */
  tom?: Extract<Tom, "espera" | "alheio" | "neutro" | "ruim">
}

/**
 * O percurso de um objeto, no arquétipo Mesa (ANATOMIA ARQ-01, PECA-01): as
 * etapas em ordem, e a ABERTA marcada como o item ativo da navegação
 * (`bg-primary/10`, `aria-current`).
 *
 * **Uma voz só no trilho** (COR-08): só a estação ATUAL leva o `Estado` com
 * tom — é ela que pede alguma coisa. A feita leva o ícone de feito (forma, sem
 * matiz) em `foreground-2`; a que vem pela frente fica em `muted-foreground`,
 * sem ponto. Um ponto de voz em cada etapa leria como cor de etapa, que é
 * outra régua (`PontoDaEtapa`, declarada por projeto).
 *
 * A etapa que já foi ou está em curso abre (ler o que se fez); a que vem pela
 * frente não abre e não é desenhada como botão.
 */
function TrilhoDoPercurso<T extends string>({
  rotulo = "Percurso",
  estacoes,
  aberta,
  onAbrir,
  className,
}: {
  rotulo?: string
  estacoes: ReadonlyArray<Estacao<T>>
  aberta: T
  onAbrir: (chave: T) => void
  className?: string
}) {
  return (
    <nav aria-label={rotulo} data-slot="trilho-do-percurso" className={cn("flex flex-col", className)}>
      <TopoDoPainel titulo={rotulo} />
      <ol className="flex flex-col gap-0.5 px-2 pb-2">
        {estacoes.map((e) => {
          const ehAberta = e.chave === aberta
          const conteudo = (
            <>
              <span className="min-w-0 flex-1 truncate">{e.nome}</span>
              {e.situacao === "feita" ? <CheckIcon aria-label="feita" className="size-3.5 shrink-0 text-foreground-2" /> : null}
              {(e.situacao === "atual" || e.situacao === "falhou") && e.palavra ? (
                <Estado tom={e.situacao === "falhou" ? "ruim" : (e.tom ?? "espera")}>{e.palavra}</Estado>
              ) : null}
            </>
          )
          return (
            <li key={e.chave} data-situacao={e.situacao}>
              {e.situacao === "a-frente" ? (
                <div className="flex h-10 items-center gap-3 px-3 text-[13px] text-muted-foreground">{conteudo}</div>
              ) : (
                <button
                  type="button"
                  aria-current={ehAberta ? "step" : undefined}
                  onClick={() => onAbrir(e.chave)}
                  className={cn(
                    "flex h-10 w-full items-center gap-3 rounded-ctrl px-3 text-left text-[13px] transition-colors duration-cor focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    ehAberta ? "bg-primary/10 font-semibold text-foreground" : "text-foreground-2 hover:bg-accent hover:text-foreground"
                  )}
                >
                  {conteudo}
                </button>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export { TrilhoDoPercurso, type Estacao, type SituacaoDaEstacao }
