import * as React from "react"

import { cn } from "@/registry/design-system/lib/utils"

/** O ponto da chave fora do mapa: neutro, e a etapa nunca some (o nome continua ao lado). */
const PONTO_FORA_DO_MAPA = "bg-muted-foreground"

/**
 * O marcador de etapa de um fluxo do projeto (ANATOMIA PECA-01): o ponto de
 * 6px e o nome. As matizes são do PROJETO, num mapa declarado num arquivo
 * dele — a exceção declarada de COR-05 —, e nenhuma pode ser a de uma voz nem
 * a da marca (COR-09): a etapa diz *onde o item está*, não *o que ele pede*.
 *
 * ```tsx
 * // lib/etapas.ts, do projeto
 * const COR_DA_ETAPA = { triagem: "bg-cyan-600 dark:bg-cyan-400", execucao: "bg-indigo-600 dark:bg-indigo-400" } satisfies Record<Etapa, string>
 * export const PontoDaEtapa = criarPontoDaEtapa(COR_DA_ETAPA)
 * ```
 */
function criarPontoDaEtapa<Etapa extends string>(mapa: Record<Etapa, string>) {
  function PontoDaEtapa({
    etapa,
    semNome = false,
    className,
    children,
  }: {
    etapa: Etapa | (string & {})
    /** Só o ponto, quando o nome já está escrito ao lado (o cabeçalho da coluna): o leitor de tela não o ouve duas vezes. */
    semNome?: boolean
    className?: string
    /** O nome da etapa, nas palavras de quem usa. */
    children?: React.ReactNode
  }) {
    const cor = Object.hasOwn(mapa, etapa) ? mapa[etapa as Etapa] : PONTO_FORA_DO_MAPA
    return (
      <span
        data-slot="ponto-da-etapa"
        data-etapa={etapa}
        aria-hidden={semNome || undefined}
        className={cn("inline-flex items-center gap-1.5", className)}
      >
        <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", cor)} />
        {semNome ? null : <span className="t-denso text-foreground-2">{children}</span>}
      </span>
    )
  }
  return PontoDaEtapa
}

export { criarPontoDaEtapa }
