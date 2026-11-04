import { criarPontoDaEtapa } from "@/components/ui/ponto-da-etapa"

/**
 * O mapa de etapas das demonstrações, num arquivo só, como o projeto faz:
 * matizes que não são de voz nem da marca, porque a etapa diz onde o item
 * está, não o que ele pede. As três paradas são as do quadro de referência
 * (triagem, execução, validada), com o par do escuro.
 */
export type EtapaDeExemplo = "entrada" | "andamento" | "revisao"

/**
 * O ponto não escreve texto (COR-09): mede-se o contraste dele com o chão, ≥ 3:1
 * (ACES-02), no claro (#F9FAFC) e no escuro (#0D1017), pelo sRGB aproximado do
 * Tailwind 4. Nenhuma parada empresta o matiz de uma voz (o violeta é `alheio`).
 */
export const COR_DA_ETAPA = {
  entrada: "bg-cyan-600 dark:bg-cyan-400", // 3,53:1 · 10,53:1
  andamento: "bg-indigo-600 dark:bg-indigo-400", // 6,02:1 · 6,38:1
  revisao: "bg-teal-600 dark:bg-teal-400", // 3,59:1 · 10,22:1
} as const satisfies Record<EtapaDeExemplo, string>

export const PontoDaEtapa = criarPontoDaEtapa(COR_DA_ETAPA)
