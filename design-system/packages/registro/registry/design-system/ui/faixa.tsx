import * as React from "react"
import { CircleAlertIcon, EyeIcon, FilterIcon, HistoryIcon, MousePointerClickIcon, UnplugIcon } from "lucide-react"

import { BADGE_DO_TOM, type Tom } from "@/registry/design-system/lib/idioma-de-cor"
import { cn } from "@/registry/design-system/lib/utils"

/** Os assuntos de uma faixa, na ordem em que aparecem (ANATOMIA MSG-06). */
const ORDEM_DOS_ASSUNTOS = ["erro", "desfecho", "conexao", "previa", "versao", "escopo"] as const
type AssuntoDaFaixa = (typeof ORDEM_DOS_ASSUNTOS)[number]

/** Da menos à mais grave: no assunto repetido, a última vence. */
const GRAVIDADE: Record<LinhaDaFaixa["tom"], number> = { neutro: 0, alheio: 1, espera: 2, ruim: 3 }

/** O ícone diz o assunto, não a voz: a forma responde "que tipo de coisa é", a tinta "o que pede" (COR-08). */
const ICONE_DO_ASSUNTO: Record<AssuntoDaFaixa, React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>> = {
  erro: CircleAlertIcon,
  desfecho: MousePointerClickIcon,
  conexao: UnplugIcon,
  previa: EyeIcon,
  versao: HistoryIcon,
  escopo: FilterIcon,
}

/**
 * Uma linha da faixa: o assunto, a voz, a frase e a saída. Sem `ok` — o que deu
 * certo não faz a tela mentir. Onde a voz pede decisão ou conserto (`espera`,
 * `ruim`), a saída é obrigatória (MSG-06): um `Button variant="outline"
 * size="sm"` que chama A MESMA ação do menu, com o andamento nele.
 */
type LinhaDaFaixa = { assunto: AssuntoDaFaixa; frase: string } & (
  | { tom: Extract<Tom, "espera" | "ruim">; saida: React.ReactNode }
  | { tom: Extract<Tom, "neutro" | "alheio">; saida?: React.ReactNode }
)

/**
 * A faixa (ANATOMIA MSG-01, MSG-02, MSG-06): SÓ quando a tela inteira mente se
 * a pessoa não souber — está vendo uma versão que não está no ar, num escopo
 * diferente do normal, sem conexão com um serviço. Parte do `Alert` do shadcn
 * (PECA-02).
 *
 * - **Uma por tela.** A segunda condição é linha da mesma faixa; a peça põe as
 *   linhas na ordem da MSG-06 (erro, desfecho, conexão, prévia, versão,
 *   escopo), seja qual for a ordem da entrada.
 * - **Onde mora:** no casco, entre o `TopoDaPagina` e a região que rola, fora
 *   dela (a faixa que rola embora deixa a tela mentir de novo — LAY-01); no
 *   Editor, entre a `BarraDoEditor` e as colunas, nunca sobre o canvas.
 * - **Sem X:** a linha sai quando a condição acaba.
 * - **Forma:** cada linha na tinta do carimbo da voz, já medida no chão e no
 *   cartão (COR-06, COR-07), em degrau de tinta (`rounded-xl`, FORMA-01), sem
 *   contorno e sem vidro; linhas separadas por 2px de ar (SUP-03).
 * - `role="alert"` na linha `ruim`; as outras entram na região `status` da
 *   faixa, que existe desde o primeiro desenho, vazia, para o leitor de tela
 *   anunciar a linha que chega (ACES-05). Por isso o app monta a `Faixa` sempre,
 *   com `linhas={[]}` quando não há o que dizer — `{mente && <Faixa/>}` recria o
 *   defeito. Sem linhas, a região fica montada, fora do fluxo (`sr-only`).
 */
function Faixa({ linhas, className }: { linhas: LinhaDaFaixa[]; className?: string }) {
  // Um assunto, uma linha (MSG-06): do repetido fica a voz mais grave, que traz a saída obrigatória.
  const unicas = [...new Map([...linhas].sort((a, b) => GRAVIDADE[a.tom] - GRAVIDADE[b.tom]).map((l) => [l.assunto, l])).values()]
  const ordenadas = [...unicas].sort((a, b) => ORDEM_DOS_ASSUNTOS.indexOf(a.assunto) - ORDEM_DOS_ASSUNTOS.indexOf(b.assunto))
  return (
    <div
      data-slot="faixa"
      role="status"
      aria-atomic="false"
      className={cn(
        "flex shrink-0 flex-col gap-0.5 overflow-hidden rounded-xl animate-in fade-in-0 duration-revela ease-abre motion-reduce:animate-none",
        // Vazia, sai do fluxo (o `gap` do pai não a conta) mas segue na árvore de acessibilidade.
        linhas.length === 0 && "sr-only",
        className
      )}
    >
      {ordenadas.map((linha) => {
        const Icone = ICONE_DO_ASSUNTO[linha.assunto]
        return (
          <div
            key={linha.assunto}
            role={linha.tom === "ruim" ? "alert" : undefined}
            data-slot="linha-da-faixa"
            data-assunto={linha.assunto}
            data-tom={linha.tom}
            className={cn("flex items-center gap-3 px-4 py-1.5", BADGE_DO_TOM[linha.tom])}
          >
            <Icone aria-hidden="true" className="size-4 shrink-0" />
            <p className="t-denso min-w-0 flex-1 text-current">{linha.frase}</p>
            {linha.saida ? <div className="flex shrink-0 items-center gap-2">{linha.saida}</div> : null}
          </div>
        )
      })}
    </div>
  )
}

export { Faixa, type AssuntoDaFaixa, type LinhaDaFaixa }
