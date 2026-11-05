import * as React from "react"

import { cn } from "@/registry/design-system/lib/utils"

/** As iniciais de um nome: "Ana Souza" → "AS". Sem nome, "?". */
function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  const primeira = partes[0]?.[0] ?? "?"
  const ultima = partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? "") : ""
  return (primeira + ultima).toUpperCase()
}

/**
 * A COR DA PESSOA (COR-09, a exceção declarada): 8 famílias fora das vozes
 * (emerald, amber, rose, violet), do vermelho e do laranja da prioridade e da
 * marca. As identidades se separam pela forma: o `sky` também é do nível baixo
 * da prioridade (o carimbo com o glifo) e o mapa de etapas pode usar as mesmas
 * famílias (o ponto de 6px); a pessoa é o círculo com as iniciais. Pinta o
 * monograma em todo lugar que represente a pessoa e, só na conversa, o nome de
 * quem fala; nunca o fundo da linha, do menu, do cartão ou do balão, nem o
 * carimbo, o glifo, a borda ou o foco. A chave é o id da pessoa, para a cor não
 * mudar quando o nome muda.
 */
const CORES_DA_PESSOA = ["lime", "teal", "cyan", "sky", "blue", "indigo", "purple", "fuchsia"] as const

type CorDaPessoa = (typeof CORES_DA_PESSOA)[number]

/**
 * A tinta do nome (texto de 12px): ≥ 4,5:1 sobre `muted` e `card` nos dois
 * temas. Os números ao lado são sobre `muted` no claro, a margem mais curta.
 */
const NOME_DA_PESSOA: Record<CorDaPessoa, string> = {
  lime: "text-lime-800 dark:text-lime-400", // o 700 mede 4,47: reprova
  teal: "text-teal-700 dark:text-teal-400", // 4,85: a margem mais estreita
  cyan: "text-cyan-700 dark:text-cyan-400", // 4,75
  sky: "text-sky-700 dark:text-sky-400", // 5,27
  blue: "text-blue-700 dark:text-blue-400", // 6,15
  indigo: "text-indigo-700 dark:text-indigo-400", // 7,27
  purple: "text-purple-700 dark:text-purple-400", // 6,37
  fuchsia: "text-fuchsia-700 dark:text-fuchsia-400", // 5,65
}

/**
 * O monograma na cor da pessoa: fundo OPACO (não precisa do invólucro da
 * superfície na pilha) e as iniciais a mais de 6:1 nos dois temas (claro / escuro).
 */
const MONOGRAMA_DA_PESSOA: Record<CorDaPessoa, string> = {
  lime: "bg-lime-100 text-lime-800 dark:bg-lime-900 dark:text-lime-200", // 6,50 / 7,47
  teal: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200", // 6,69 / 7,51
  cyan: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200", // 6,47 / 7,32
  sky: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200", // 6,54 / 7,13
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", // 7,25 / 7,31
  indigo: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200", // 8,18 / 7,68
  purple: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200", // 7,51 / 8,02
  fuchsia: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900 dark:text-fuchsia-200", // 7,17 / 7,35
}

/** A cor estável de uma chave (o id da pessoa), pelo hash FNV-1a de 32 bits, sobre a chave crua. */
function corDaPessoa(chave: string): CorDaPessoa {
  let h = 0x811c9dc5
  for (let i = 0; i < chave.length; i++) {
    h ^= chave.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return CORES_DA_PESSOA[(h >>> 0) % CORES_DA_PESSOA.length]!
}

const NEUTRO = "bg-foreground/[0.07] text-foreground-2"

/** A cor de uma chave que pode faltar: `null`, `""` e só espaços não têm cor. */
function corDaChave(chave: string | null | undefined): CorDaPessoa | undefined {
  return chave?.trim() ? corDaPessoa(chave) : undefined
}

/**
 * O monograma da pessoa (CTRL-05): círculo de 20px com as iniciais, na cor da
 * pessoa (COR-09) em todo lugar que a represente — nunca na cor da marca
 * (MARCA-02). Quem chama passa a `chave` (o id estável da pessoa, nunca o
 * nome), e a peça decide a cor; sem id, quem chama diz `null`, e o monograma
 * fica neutro. A chave é obrigatória para o neutro ser escolha escrita, não
 * esquecimento. É enfeite do nome que vem ao lado ou da dica: `aria-hidden`.
 */
function Monograma({ nome, chave, className }: { nome: string; chave: string | null; className?: string }) {
  const cor = corDaChave(chave)
  return (
    <span
      aria-hidden="true"
      data-slot="monograma"
      data-cor={cor}
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-[650]",
        className,
        // A tinta vem por último: o `className` de quem chama mexe no layout, nunca na cor (COR-09).
        cor ? MONOGRAMA_DA_PESSOA[cor] : NEUTRO
      )}
    >
      {iniciais(nome)}
    </span>
  )
}

/**
 * O lugar da pessoa que não há: o círculo TRACEJADO de 20px, porque a
 * tracejada é ausência (FORMA-02). O texto da ausência é de quem chama.
 */
function MonogramaAusente({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      data-slot="monograma-ausente"
      className={cn("inline-block size-5 shrink-0 rounded-full border border-dashed border-input", className)}
    />
  )
}

export {
  Monograma,
  MonogramaAusente,
  iniciais,
  corDaPessoa,
  corDaChave,
  CORES_DA_PESSOA,
  NOME_DA_PESSOA,
  MONOGRAMA_DA_PESSOA,
  type CorDaPessoa,
}
