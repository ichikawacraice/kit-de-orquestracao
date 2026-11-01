"use client"

import * as React from "react"
import { ChevronRightIcon } from "lucide-react"

import { cn } from "@/registry/wicomm/lib/utils"
import { ChipDeEstado } from "@/registry/wicomm/ui/chip-de-estado"
import { TrilhaDoProgresso } from "@/registry/wicomm/ui/progress"

type Densidade = "instrumento" | "site"

const ALTURA: Record<Densidade, string> = { instrumento: "h-10", site: "h-12" }
const NOME: Record<Densidade, string> = { instrumento: "t-denso font-[600]", site: "text-sm font-[600]" }

/**
 * O GRUPO DE LINHAS de uma `Table` (ANATOMIA PECA-01): as linhas de uma etapa,
 * de uma semana, de um assunto, com a linha do grupo no topo — que abre e
 * fecha as linhas e diz quanto delas acabou.
 *
 * - **Semântica.** O grupo é o próprio `<tbody>`, e a linha do grupo é a
 *   primeira linha dele, com `th scope="rowgroup"`: o leitor de tela anuncia o
 *   grupo ao entrar nas linhas. Vai direto dentro da `Table`, um por grupo, no
 *   lugar do `TableBody`.
 * - **Forma.** O degrau de tinta (`bg-muted`, SUP-03) com raio de agrupador
 *   nas pontas (FORMA-01), e o vão de 6px antes de cada grupo, menos o
 *   primeiro. O vão é da peça: a tela não o escreve.
 * - **Partes.** O alternador (o botão com o chevron de 14px, `aria-expanded`),
 *   a identidade opcional (o ponto de quem chama), o nome, a contagem (*7 de
 *   10*, `t-medida`), o progresso opcional (a trilha compacta da marca), a
 *   medida opcional (um `Medidor compacto`), as células alinhadas sob as
 *   colunas da tabela (o prazo sob Prazo, a pilha sob Responsável) e o `⋯`.
 * - **Estados.** Fechado e aberto (as linhas só montam aberto); vazio (sem
 *   linhas: o alternador fica inerte, o chevron não aparece e o espaço dele
 *   fica guardado — sem opacidade, que sobre tinta não dá hierarquia, COR-14);
 *   concluído (a barra sai e entra o carimbo `ok`); foco no anel de sempre
 *   (SUP-06). A linha do grupo não acende no hover: não abre objeto.
 *
 * O estado aberto é de vista: o F5 volta ao `abertoDeInicio`. Quem precisa
 * abrir de fora passa `aberto` e `aoMudar`.
 */
function LinhaDoGrupo({
  nome,
  colunas,
  contagem,
  progresso = false,
  concluido = false,
  rotuloDoConcluido = "Concluído",
  semLinhas = "Sem linhas",
  identidade,
  medida,
  celulas = [],
  acao,
  densidade = "instrumento",
  abertoDeInicio = true,
  aberto: abertoDeFora,
  aoMudar,
  className,
  children,
}: {
  /** O nome do grupo: a etapa, a semana. */
  nome: string
  /** Quantas colunas a tabela tem: a linha do grupo ocupa todas. */
  colunas: number
  /** *7 de 10*: quantas linhas acabaram, de quantas. */
  contagem?: { feitas: number; total: number }
  /** A trilha compacta da marca, a partir da contagem (a medida da marca da linha). */
  progresso?: boolean
  /** O grupo acabou: a barra sai e entra o carimbo `ok`. */
  concluido?: boolean
  rotuloDoConcluido?: string
  /** A frase da contagem quando o grupo não tem linhas, na palavra de quem chama (*Sem tarefas*). */
  semLinhas?: string
  /** O ponto antes do nome (a cor de dado do grupo, quando o projeto a declara). Enfeite: `aria-hidden` de quem passa. */
  identidade?: React.ReactNode
  /** Um `Medidor compacto` ao lado da contagem. */
  medida?: React.ReactNode
  /** O que mora sob as últimas colunas da tabela, uma célula por coluna (`null` deixa a célula vazia). */
  celulas?: React.ReactNode[]
  /** O `⋯` do grupo, na última coluna. */
  acao?: React.ReactNode
  densidade?: Densidade
  abertoDeInicio?: boolean
  aberto?: boolean
  aoMudar?: (aberto: boolean) => void
  className?: string
  /** As linhas do grupo (`TableRow`). */
  children?: React.ReactNode
}) {
  const [abertoAqui, setAbertoAqui] = React.useState(abertoDeInicio)
  const vazio = React.Children.toArray(children).length === 0
  const aberto = !vazio && (abertoDeFora ?? abertoAqui)
  const trocar = () => {
    setAbertoAqui(!aberto)
    aoMudar?.(!aberto)
  }
  const ocupadas = celulas.length + (acao ? 1 : 0)
  const largura = Math.max(1, colunas - ocupadas)
  const finais = acao ? [...celulas, acao] : celulas
  const fracao = contagem && contagem.total > 0 ? contagem.feitas / contagem.total : null

  // O degrau mora num `div` dentro de cada célula: raio em célula de tabela não
  // se desenha com `border-collapse`, e o vão antes do grupo é o `pt` da célula.
  const celula = "p-0 align-middle font-normal [tbody:not(:first-of-type)_&]:pt-1.5"
  const degrau = (primeira: boolean, ultima: boolean) =>
    cn("flex items-center gap-2 bg-muted px-3", ALTURA[densidade], primeira && "rounded-l-xl", ultima && "rounded-r-xl")

  const chevron = (
    <ChevronRightIcon
      aria-hidden="true"
      className={cn(
        "size-3.5 shrink-0 text-muted-foreground transition-transform duration-dobra-abre ease-abre motion-reduce:transition-none",
        aberto && "rotate-90",
        vazio && "invisible"
      )}
    />
  )
  const rotulo = (
    <>
      {chevron}
      {identidade}
      <span className={cn("min-w-0 truncate text-foreground", NOME[densidade])}>{nome}</span>
    </>
  )

  return (
    <tbody data-slot="linha-do-grupo" data-aberto={aberto} data-vazio={vazio || undefined} className={className}>
      <tr data-slot="linha-do-grupo-topo">
        <th scope="rowgroup" colSpan={largura} className={cn(celula, "text-left")}>
          <div className={degrau(true, finais.length === 0)}>
            {vazio ? (
              <span className="-ml-1 flex min-w-0 items-center gap-2 px-1">{rotulo}</span>
            ) : (
              <button
                type="button"
                aria-expanded={aberto}
                onClick={trocar}
                className="-ml-1 flex min-w-0 items-center gap-2 rounded-md px-1 py-0.5 outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-muted"
              >
                {rotulo}
              </button>
            )}
            {contagem ? (
              contagem.total > 0 ? (
                <span className="t-medida shrink-0 text-foreground-2">
                  {contagem.feitas} de {contagem.total}
                </span>
              ) : (
                // Zero de zero não é progresso parado: é grupo sem linhas, e a frase diz isso (EST-02, EST-04).
                <span className="t-denso shrink-0 text-muted-foreground">{semLinhas}</span>
              )
            ) : null}
            {concluido ? (
              <ChipDeEstado tom="ok">{rotuloDoConcluido}</ChipDeEstado>
            ) : progresso && fracao !== null ? (
              <TrilhaDoProgresso fracao={fracao} compacta className="w-24 shrink-0" />
            ) : null}
            {medida ? <span className="w-28 shrink-0">{medida}</span> : null}
          </div>
        </th>
        {finais.map((c, i) => (
          <td key={i} className={celula}>
            <div className={degrau(false, i === finais.length - 1)}>{c}</div>
          </td>
        ))}
      </tr>
      {aberto ? children : null}
    </tbody>
  )
}

export { LinhaDoGrupo }
