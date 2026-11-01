"use client"

import * as React from "react"
import { ChevronRightIcon } from "lucide-react"

import { cn } from "@/registry/wicomm/lib/utils"
import { ChipDeEstado } from "@/registry/wicomm/ui/chip-de-estado"
import { TrilhaDoProgresso } from "@/registry/wicomm/ui/progress"
import { useDensidadeDaTabela } from "@/registry/wicomm/ui/table"

type Densidade = "instrumento" | "site"

/** O degrau tem, no mínimo, a altura da linha de duas linhas em toda célula do topo (o peso vem da tinta, do nome e do vão); cresce só quando o prazo estreito quebra a legenda. */
const ALTURA: Record<Densidade, string> = { instrumento: "min-h-12", site: "min-h-14" }
/**
 * O vão grande só vem depois de grupo aberto, e o ar curto depois do topo só com o grupo aberto: o topo
 * pertence às linhas de baixo (SUP-03). Entre grupos fechados fica o espaço curto, para a lista toda fechada
 * continuar um índice compacto.
 */
const AR: Record<Densidade, string> = {
  instrumento: "[tbody:not(:first-of-type)_&]:pt-1.5 [tbody[data-aberto=true]+tbody_&]:pt-4 [tbody[data-aberto=true]_&]:pb-1",
  site: "[tbody:not(:first-of-type)_&]:pt-2 [tbody[data-aberto=true]+tbody_&]:pt-6 [tbody[data-aberto=true]_&]:pb-1.5",
}
/** Uma célula sob uma coluna; `esconderNoCelular` quando a coluna some abaixo de 640px. */
type CelulaDoGrupo = { conteudo: React.ReactNode; esconderNoCelular?: boolean }

const ehCelula = (c: React.ReactNode | CelulaDoGrupo): c is CelulaDoGrupo =>
  typeof c === "object" && c !== null && !React.isValidElement(c) && "conteudo" in c

/** O nome um degrau de tipo acima do corpo da linha (TIPO-02): achar o grupo ao rolar. */
const NOME: Record<Densidade, string> = { instrumento: "text-sm font-[600]", site: "t-titulo" }

/**
 * O GRUPO DE LINHAS de uma `Table` (ANATOMIA PECA-01): as linhas de uma etapa,
 * de uma semana, de um assunto, com a linha do grupo no topo — que abre e
 * fecha as linhas e diz quanto delas acabou.
 *
 * - **Semântica.** O grupo é o próprio `<tbody>`, e a linha do grupo é a
 *   primeira linha dele, com `th scope="rowgroup"`: o leitor de tela anuncia o
 *   grupo ao entrar nas linhas. Vai direto dentro da `Table`, um por grupo, no
 *   lugar do `TableBody`.
 * - **Forma e ar** (SUP-03). O degrau de tinta (`bg-muted`) com raio de
 *   agrupador nas pontas (FORMA-01), na altura da linha de duas linhas (48px
 *   no instrumento, 56 no site) e o nome um degrau de tipo acima do corpo
 *   (TIPO-02). O vão antes de um grupo, menos o primeiro, é maior que o ar
 *   depois do topo (4px; 6) só quando o grupo de cima está aberto (16px; 24 no
 *   site); entre grupos fechados fica o espaço curto (6px; 8) e o ar depois do
 *   topo não existe: o topo pertence às linhas de baixo, que só há aberto. As linhas recuam até o nome do grupo (com a identidade, até depois do ponto: quando algum grupo da tabela a
 *   tem, todo grupo reserva o lugar dela, 14px), e a linha acesa (o hover e o
 *   anel de foco) começa no recuo: mais estreita que o degrau, ela não se lê
 *   como outro grupo. Vão, ar e recuo são da peça: a tela não os escreve. A
 *   densidade vem da `Table`.
 * - **Partes.** O alternador (o botão com o chevron de 14px, `aria-expanded`),
 *   a identidade opcional (o ponto de quem chama), o nome, a contagem (*7 de
 *   10*, `t-medida`), o progresso opcional (a trilha compacta da marca), a
 *   medida opcional (um `Medidor compacto`), as células alinhadas sob as
 *   colunas da tabela (o prazo sob Prazo, a pilha sob Responsável) e o `⋯`.
 * - **Alinhamento.** A contagem, a trilha e a medida encostam no fim do `th`,
 *   cada uma num lugar de largura fixa: entre grupos da mesma tabela, as barras começam no mesmo x. O carimbo do
 *   concluído mora no lugar da trilha. A `medida` vai em todos os grupos da
 *   tabela ou em nenhum: num só, ela empurra a trilha dele.
 * - **Estreito.** O nome tem piso de 5rem, e quem cede é o fim, pela largura
 *   que sobra no `th` (container query): sai a trilha e o carimbo quando há
 *   contagem (ela diz o mesmo), depois a medida, por último a contagem.
 * - **Celular.** A célula sob uma coluna que some abaixo de 640px
 *   (`{ conteudo, esconderNoCelular: true }`) esvazia sem transbordar, e o
 *   raio passa à última que fica; a coluna some pelo `esconderNoCelular` do
 *   `TableHead` e da `TableCell`.
 * - **O prazo do grupo** de duas linhas cabe no degrau; quando a coluna
 *   comporta, `Prazo emLinha` o deixa numa linha só.
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
  densidade: densidadeDeFora,
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
  celulas?: (React.ReactNode | CelulaDoGrupo)[]
  /** O `⋯` do grupo, na última coluna. */
  acao?: React.ReactNode | CelulaDoGrupo
  densidade?: Densidade
  abertoDeInicio?: boolean
  aberto?: boolean
  aoMudar?: (aberto: boolean) => void
  className?: string
  /** As linhas do grupo (`TableRow`). */
  children?: React.ReactNode
}) {
  const densidadeDaTabela = useDensidadeDaTabela()
  const densidade = densidadeDeFora ?? densidadeDaTabela
  const [abertoAqui, setAbertoAqui] = React.useState(abertoDeInicio)
  const vazio = React.Children.toArray(children).length === 0
  const aberto = !vazio && (abertoDeFora ?? abertoAqui)
  const trocar = () => {
    setAbertoAqui(!aberto)
    aoMudar?.(!aberto)
  }
  const ocupadas = celulas.length + (acao ? 1 : 0)
  const largura = Math.max(1, colunas - ocupadas)
  const finais: CelulaDoGrupo[] = [...celulas, ...(acao ? [acao] : [])].map((c) => (ehCelula(c) ? c : { conteudo: c }))
  // No celular, o raio da direita vai à última célula que fica (ou ao `th`, se todas somem).
  const ultimaNoCelular = finais.map((c) => !c.esconderNoCelular).lastIndexOf(true)
  const fracao = contagem && contagem.total > 0 ? contagem.feitas / contagem.total : null
  // O fim cede pela largura que sobra no th, nesta ordem: a trilha (a contagem diz o mesmo), a medida, a contagem.
  const semTrilha = medida ? "@max-[17.5rem]:hidden" : "@max-[10rem]:hidden"

  // O degrau mora num `div` dentro de cada célula: raio em célula de tabela não
  // se desenha com `border-collapse`, e o vão antes do grupo é o `pt` da célula.
  // `h-px` na célula e `h-full` no degrau: o topo cresce inteiro (th e td com a mesma altura) quando o prazo quebra a legenda.
  const celula = cn("h-px p-0 align-middle font-normal", AR[densidade])
  const degrau = (primeira: boolean, ultima: boolean, ultimaNoCelular = ultima) =>
    cn(
      "flex h-full items-center gap-1.5 bg-muted px-3",
      ALTURA[densidade],
      primeira && "rounded-l-xl",
      ultima && "rounded-r-xl",
      !ultima && ultimaNoCelular && "max-sm:rounded-r-xl"
    )

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
      {identidade ? (
        <span data-slot="lugar-da-identidade" className="flex w-2 shrink-0 items-center">
          {identidade}
        </span>
      ) : (
        // O grupo sem ponto guarda o lugar enquanto algum grupo da tabela tem: os nomes começam no mesmo x.
        <span
          aria-hidden="true"
          data-slot="lugar-da-identidade"
          className="hidden w-2 shrink-0 [table:has(>tbody[data-com-identidade])_&]:block"
        />
      )}
      <span className={cn("min-w-20 truncate text-left text-foreground", NOME[densidade])}>{nome}</span>
    </>
  )

  return (
    <tbody
      data-slot="linha-do-grupo"
      data-aberto={aberto}
      data-vazio={vazio || undefined}
      data-com-identidade={identidade ? true : undefined}
      // O recuo é da peça: o texto da linha alinha com o nome do grupo (32px = 12 + 14 do chevron + 6). Os 20px de
      // fora são borda transparente com o fundo recortado nela: a linha acesa (e o anel de foco) começa no recuo,
      // mais estreita que o degrau, e se lê filha do grupo, não um segundo topo. O raio de 28px na borda dá 8 por dentro.
      className={cn(
        "[&>tr[data-slot=table-row]>td:first-child]:border-l-[20px] [&>tr[data-slot=table-row]>td:first-child]:border-l-transparent [&>tr[data-slot=table-row]>td:first-child]:bg-clip-padding [&>tr[data-slot=table-row]>td:first-child]:rounded-l-[28px_8px] [&_[data-slot=link-da-linha]]:after:left-5",
        // Alguma tabela com grupo de identidade: o recuo soma o lugar do ponto (8px + 6 de vão = 14).
        "[table:has(>tbody[data-com-identidade])_&>tr[data-slot=table-row]>td:first-child]:border-l-[34px]",
        "[table:has(>tbody[data-com-identidade])_&>tr[data-slot=table-row]>td:first-child]:rounded-l-[42px_8px]",
        "[table:has(>tbody[data-com-identidade])_&_[data-slot=link-da-linha]]:after:left-[34px]",
        className
      )}
    >
      <tr data-slot="linha-do-grupo-topo">
        <th scope="rowgroup" colSpan={largura} className={cn(celula, "text-left")}>
          <div className={degrau(true, finais.length === 0, ultimaNoCelular === -1)}>
            {vazio ? (
              <span className="-ml-1 flex items-center gap-1.5 px-1">{rotulo}</span>
            ) : (
              <button
                type="button"
                aria-expanded={aberto}
                onClick={trocar}
                className="-ml-1 flex items-center gap-1.5 rounded-md px-1 py-0.5 outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-muted"
              >
                {rotulo}
              </button>
            )}
            {/* Daqui em diante, tudo encosta no fim do th, em lugares de largura fixa. */}
            <span data-slot="fim-da-linha-do-grupo" className="@container flex min-w-0 flex-1 items-center justify-end gap-2">
              {contagem ? (
                contagem.total > 0 ? (
                  <span className="t-medida shrink-0 text-foreground-2 @max-[3.5rem]:hidden">
                    {contagem.feitas} de {contagem.total}
                  </span>
                ) : (
                  // Zero de zero não é progresso parado: é grupo sem linhas, e a frase diz isso (EST-02, EST-04).
                  <span className="t-denso shrink-0 text-muted-foreground @max-[5rem]:hidden">{semLinhas}</span>
                )
              ) : null}
              {concluido ? (
                // O carimbo cede como a trilha só quando a contagem diz o mesmo (*2 de 2*).
                <span className={cn("flex w-24 shrink-0", contagem && semTrilha)}>
                  <ChipDeEstado tom="ok">{rotuloDoConcluido}</ChipDeEstado>
                </span>
              ) : progresso ? (
                // O lugar fica guardado no grupo sem linhas: a contagem dos grupos encosta no mesmo x.
                <span data-slot="lugar-da-trilha" className={cn("flex w-24 shrink-0", semTrilha)}>
                  {fracao !== null ? <TrilhaDoProgresso fracao={fracao} compacta className="w-full" /> : null}
                </span>
              ) : null}
              {medida ? <span className="w-28 shrink-0 @max-[11rem]:hidden">{medida}</span> : null}
            </span>
          </div>
        </th>
        {finais.map((c, i) => (
          <td key={i} className={cn(celula, c.esconderNoCelular && "max-sm:[&>div]:hidden")}>
            <div className={degrau(false, i === finais.length - 1, i === ultimaNoCelular)}>{c.conteudo}</div>
          </td>
        ))}
      </tr>
      {aberto ? children : null}
    </tbody>
  )
}

export { LinhaDoGrupo, type CelulaDoGrupo }
