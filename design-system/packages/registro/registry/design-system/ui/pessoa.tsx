"use client"

import * as React from "react"

import { cn } from "@/registry/design-system/lib/utils"
import { Monograma, MonogramaAusente, type CorDaPessoa } from "@/registry/design-system/ui/monograma"
import { Skeleton } from "@/registry/design-system/ui/skeleton"
import { useDensidadeDaTabela } from "@/registry/design-system/ui/table"
import { Ajuda } from "@/registry/design-system/ui/tooltip"

type Densidade = "instrumento" | "site"

/**
 * A pessoa como a lista a recebe: o nome pode faltar (o id veio, o nome não).
 * A `cor` só vem onde a COR-09 a permite (a conversa entre pessoas):
 * `corDaPessoa(id)`.
 */
type DadosDaPessoa = { nome?: string | null; cor?: CorDaPessoa }

const NOME: Record<Densidade, string> = { instrumento: "t-denso", site: "text-sm" }
const SEM_NOME = "Pessoa sem nome"

const nomeDe = (p: DadosDaPessoa) => (p.nome?.trim() ? p.nome.trim() : null)

/** O alvo focável do que só mostra o monograma: a dica abre no hover e no foco. */
const ALVO =
  "inline-flex shrink-0 items-center rounded-full outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"

/**
 * A PESSOA numa linha de lista (ANATOMIA PECA-01): o monograma de 20px e o
 * nome, com o papel opcional embaixo, na legenda. A cor por pessoa só vem
 * com `pessoa.cor`, onde a COR-09 a permite.
 *
 * - **Sem pessoa** (`pessoa={null}`): o círculo tracejado (a tracejada é
 *   ausência, FORMA-02) e o texto de quem chama (*Sem responsável*), em
 *   `muted-foreground`.
 * - **Pessoa sem nome** (o id veio e o nome não): *?* e *Pessoa sem nome* —
 *   nunca o id cru.
 * - **Carregando**: o esqueleto redondo e uma barra, na altura da linha.
 * - `soMonograma`: o nome sai da vista e vai para a dica e para o nome
 *   acessível; o alvo é focável, para a dica abrir no teclado.
 *
 * O nome se corta com reticências e segue inteiro no nome acessível.
 */
function Pessoa({
  pessoa,
  papel,
  semPessoa = "Sem responsável",
  carregando = false,
  soMonograma = false,
  densidade: densidadeDeFora,
  className,
}: {
  pessoa: DadosDaPessoa | null
  /** O papel, na legenda: *Gerente*. */
  papel?: string
  /** O texto da ausência, na frase de quem chama. */
  semPessoa?: string
  carregando?: boolean
  soMonograma?: boolean
  /** Sem ela, a da `Table` em volta (instrumento fora de tabela). */
  densidade?: Densidade
  className?: string
}) {
  const densidadeDaTabela = useDensidadeDaTabela()
  const densidade = densidadeDeFora ?? densidadeDaTabela
  if (carregando) {
    return (
      <span data-slot="pessoa" aria-busy="true" className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
        <Skeleton className="size-5 shrink-0 rounded-full" />
        {soMonograma ? null : <Skeleton className="h-3 w-20" />}
      </span>
    )
  }
  const nome = pessoa ? (nomeDe(pessoa) ?? SEM_NOME) : semPessoa
  const marca = pessoa ? <Monograma nome={nomeDe(pessoa) ?? "?"} cor={pessoa.cor} /> : <MonogramaAusente />

  if (soMonograma) {
    return (
      <Ajuda texto={papel ? `${nome}, ${papel}` : nome}>
        <span
          data-slot="pessoa"
          data-ausente={pessoa ? undefined : ""}
          role="img"
          aria-label={papel ? `${nome}, ${papel}` : nome}
          tabIndex={0}
          className={cn(ALVO, className)}
        >
          {marca}
        </span>
      </Ajuda>
    )
  }

  return (
    <span
      data-slot="pessoa"
      data-ausente={pessoa ? undefined : ""}
      className={cn("inline-flex min-w-0 items-center gap-1.5", className)}
    >
      {marca}
      <span className="flex min-w-0 flex-col">
        <span className={cn("truncate", NOME[densidade], pessoa && nomeDe(pessoa) ? "text-foreground" : "text-muted-foreground")}>
          {nome}
        </span>
        {papel ? <span className="t-denso truncate text-muted-foreground">{papel}</span> : null}
      </span>
    </span>
  )
}

/** "Ana, Bruno e Carla". */
function juntar(nomes: string[]): string {
  if (nomes.length <= 1) return nomes[0] ?? ""
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`
}

/**
 * A PILHA DE PESSOAS (ANATOMIA PECA-01): até `max` monogramas sobrepostos (2px:
 * mais que isso, com o anel, corta a segunda inicial de quem fica embaixo), com
 * o anel da superfície onde moram (`sobre`: o cartão, ou o degrau de tinta da
 * linha do grupo), e *+N* em `t-medida` para o excedente. A frase inteira
 * (*Ana Souza, Bruno Lima e Carla Dias*) é a dica e o nome acessível; o alvo é
 * focável, para a dica abrir no teclado.
 *
 * `decorativa`: a frase ao lado já diz os nomes, e a pilha é só enfeite —
 * `aria-hidden`, sem alvo e sem dica (o leitor de tela não ouve os nomes duas
 * vezes, e o Tab não para num foco que não diz nada novo).
 *
 * Vazia, não desenha: quem chama decide se a ausência se diz (com uma `Pessoa`
 * sem pessoa). A cor por pessoa só vem com `pessoa.cor` (COR-09).
 */
function PilhaDePessoas({
  pessoas,
  max = 3,
  sobre = "card",
  frase,
  decorativa = false,
  className,
}: {
  pessoas: DadosDaPessoa[]
  max?: number
  /** A superfície onde a pilha mora, para o anel que separa um monograma do outro. */
  sobre?: "card" | "muted"
  /** A frase da dica e do nome acessível; o padrão junta os nomes. */
  frase?: string
  /** A frase ao lado já diz os nomes: a pilha sai do leitor de tela e do Tab. */
  decorativa?: boolean
  className?: string
}) {
  if (pessoas.length === 0) return null
  const limite = Math.max(1, max)
  // Com um a mais que o limite, o "+1" ocupa o mesmo lugar que o monograma: mostra a pessoa.
  const visiveis = pessoas.length === limite + 1 ? pessoas : pessoas.slice(0, limite)
  const excedente = pessoas.length - visiveis.length
  const texto = frase ?? juntar(pessoas.map((p) => nomeDe(p) ?? SEM_NOME))
  const monogramas = (
    <>
      <span className="flex -space-x-0.5">
        {visiveis.map((p, i) => (
          // A tinta neutra do monograma é translúcida: o fundo opaco da superfície embaixo dele esconde o vizinho sobreposto.
          <span
            key={i}
            className={cn("rounded-full ring-2", sobre === "muted" ? "bg-muted ring-muted" : "bg-card ring-card")}
          >
            <Monograma nome={nomeDe(p) ?? "?"} cor={p.cor} className="flex" />
          </span>
        ))}
      </span>
      {excedente > 0 ? <span className="t-medida text-muted-foreground">+{excedente}</span> : null}
    </>
  )
  if (decorativa) {
    return (
      <span aria-hidden="true" data-slot="pilha-de-pessoas" className={cn("inline-flex shrink-0 items-center gap-1", className)}>
        {monogramas}
      </span>
    )
  }
  return (
    <Ajuda texto={texto}>
      <span
        data-slot="pilha-de-pessoas"
        role="img"
        aria-label={texto}
        tabIndex={0}
        className={cn(ALVO, "gap-1", className)}
      >
        {monogramas}
      </span>
    </Ajuda>
  )
}

export { Pessoa, PilhaDePessoas, type DadosDaPessoa }
