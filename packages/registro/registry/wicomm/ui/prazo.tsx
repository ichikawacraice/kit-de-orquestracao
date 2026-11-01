"use client"

import * as React from "react"

import { COR_DO_TOM_DENSO, type Tom } from "@/registry/wicomm/lib/idioma-de-cor"
import { cn } from "@/registry/wicomm/lib/utils"
import { ChipDeEstado } from "@/registry/wicomm/ui/chip-de-estado"
import { Estado } from "@/registry/wicomm/ui/estado"
import { Ajuda } from "@/registry/wicomm/ui/tooltip"

type Densidade = "instrumento" | "site"
type Data = Date | string

/** Um dia só, ou um intervalo; um lado aberto escreve *até* ou *desde*. */
type Periodo = Data | { inicio?: Data | null; fim?: Data | null }

/** O dia é o de São Paulo: a data de um prazo não vira à meia-noite de Greenwich. */
const FUSO = "America/Sao_Paulo"
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
const PARTES = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" })

type Dia = { ano: number; mes: number; dia: number }

function diaDe(d: Data): Dia | null {
  // Texto sem fuso é hora de São Paulo: lido no fuso da máquina, o servidor em UTC trocaria o dia (e a hidratação).
  const texto = typeof d === "string" ? (/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T12:00:00` : d) : null
  const data = texto === null ? (d as Date) : new Date(/T[\d:.]+$/.test(texto) ? `${texto}-03:00` : texto)
  if (Number.isNaN(data.getTime())) return null
  const p = Object.fromEntries(PARTES.formatToParts(data).map((x) => [x.type, x.value]))
  return { ano: Number(p.year), mes: Number(p.month), dia: Number(p.day) }
}

const diasEntre = (de: Dia, ate: Dia) =>
  Math.round((Date.UTC(ate.ano, ate.mes - 1, ate.dia) - Date.UTC(de.ano, de.mes - 1, de.dia)) / 86_400_000)

/** *24 jul*; o ano só quando não é o corrente: *24 jul 2027*. */
function escreverDia(d: Dia, hoje: Dia): string {
  return `${d.dia} ${MESES[d.mes - 1]}${d.ano === hoje.ano ? "" : ` ${d.ano}`}`
}

/**
 * A legenda relativa ao fim do prazo. Com voz, o verbo diz o que pede (*vence
 * em 2 dias*); sem voz, só o tempo (*em 12 dias*). O passado é sempre *venceu*.
 */
function relativo(dias: number, comVoz: boolean): string {
  if (dias < 0) return dias === -1 ? "venceu ontem" : `venceu há ${-dias} dias`
  if (dias === 0) return comVoz ? "vence hoje" : "hoje"
  if (dias === 1) return comVoz ? "vence amanhã" : "amanhã"
  return comVoz ? `vence em ${dias} dias` : `em ${dias} dias`
}

/**
 * O PRAZO numa linha de lista (ANATOMIA PECA-01): a data ou o intervalo em
 * `t-medida` (*24 jul*, *2 jun → 24 jul*, *até 24 jul*, *desde 2 jun*), e
 * embaixo a legenda relativa ao fim (*em 12 dias*).
 *
 * - **A voz é de quem chama** (`tom`, COR-05): o limiar de quando um prazo
 *   pede alguma coisa é do projeto, não da peça. **Sem `tom`, nunca pinta**: a
 *   legenda fica em texto neutro.
 * - `forma="estado"` (padrão): a legenda é o `Estado`, ponto e palavra — para
 *   o prazo de uma sub-linha. `forma="chip"`: a legenda é o `ChipDeEstado` —
 *   quando o prazo É o estado do objeto da linha.
 * - **Sem data**: *Sem data* em `muted-foreground` (EST-02), nunca um traço
 *   solto. **Só a proposta**: a legenda é *proposta*, sem voz. **Concluído**:
 *   sem legenda relativa (o prazo não pede mais nada). **Parcial**: a data
 *   abre a dica que diz de quantos é o prazo (*Prazo de 4 de 20 tarefas*).
 * - O dia é o de São Paulo, e o ano só aparece quando não é o corrente.
 */
function Prazo({
  periodo,
  tom,
  forma = "estado",
  proposta = false,
  concluido = false,
  parcial,
  semData = "Sem data",
  hoje: hojeDeFora,
  densidade = "instrumento",
  className,
}: {
  periodo: Periodo | null | undefined
  /** A voz que o projeto declarou para este prazo; sem ela, a peça não pinta. */
  tom?: Tom
  forma?: "estado" | "chip"
  /** A data ainda é proposta: legenda *proposta*, sem voz. */
  proposta?: boolean
  /** O que o prazo media acabou: sem legenda relativa. */
  concluido?: boolean
  /** O prazo é de parte do conjunto: a frase da dica (*Prazo de 4 de 20 tarefas*). */
  parcial?: string
  semData?: string
  /** O dia de referência; o padrão é agora. */
  hoje?: Date
  densidade?: Densidade
  className?: string
}) {
  const hoje = (hojeDeFora && diaDe(hojeDeFora)) || diaDe(new Date())!
  const { inicio, fim } =
    periodo && typeof periodo === "object" && !(periodo instanceof Date)
      ? { inicio: periodo.inicio ? diaDe(periodo.inicio) : null, fim: periodo.fim ? diaDe(periodo.fim) : null }
      : { inicio: null, fim: periodo ? diaDe(periodo) : null }

  const raiz = cn("flex min-w-0 flex-col gap-0.5", className)
  if (!inicio && !fim) {
    return (
      <span data-slot="prazo" data-vazio="" className={raiz}>
        <span className={cn(densidade === "site" ? "text-sm" : "t-denso", "text-muted-foreground")}>{semData}</span>
      </span>
    )
  }

  const escrito =
    inicio && fim
      ? `${escreverDia(inicio, hoje)} → ${escreverDia(fim, hoje)}`
      : fim
        ? `${periodo && typeof periodo === "object" && !(periodo instanceof Date) ? "até " : ""}${escreverDia(fim, hoje)}`
        : `desde ${escreverDia(inicio!, hoje)}`

  const data = (
    <span className={cn("t-medida text-foreground", densidade === "site" && "text-sm")}>
      {parcial ? (
        <Ajuda texto={parcial}>
          <span
            tabIndex={0}
            className="cursor-help rounded-sm underline decoration-foreground/35 decoration-dotted underline-offset-[2.5px] outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {escrito}
            <span className="sr-only">, {parcial}</span>
          </span>
        </Ajuda>
      ) : (
        escrito
      )}
    </span>
  )

  // Só o fim dá legenda relativa: *desde 2 jun* não vence.
  const legenda = proposta ? "proposta" : concluido || !fim ? null : relativo(diasEntre(hoje, fim), !!tom)
  const voz = proposta ? undefined : tom

  return (
    <span data-slot="prazo" data-tom={voz} className={raiz}>
      {data}
      {legenda === null ? null : forma === "chip" ? (
        <ChipDeEstado tom={voz ?? "neutro"} className="self-start">
          {legenda}
        </ChipDeEstado>
      ) : voz ? (
        <Estado tom={voz}>{legenda}</Estado>
      ) : (
        <span className={cn("t-denso", COR_DO_TOM_DENSO.neutro)}>{legenda}</span>
      )}
    </span>
  )
}

export { Prazo, type Periodo }
