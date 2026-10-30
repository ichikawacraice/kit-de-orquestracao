/**
 * O idioma de cor da Wicomm: as cinco VOZES e as classes de cada uma, num
 * arquivo só (DESIGN COR-03, COR-05).
 *
 * A cor de estado responde uma pergunta só, em toda tela: **o que isto pede de
 * você?**
 * - `ok` — nada: acabou e deu certo;
 * - `espera` — decisão sua: alguém está bloqueando, e é você;
 * - `ruim` — conserto: quebrou;
 * - `alheio` — nada, porque está com outra pessoa;
 * - `neutro` — nada ainda: está andando, ou foi deliberadamente não feito.
 *
 * Estado EM CURSO é `neutro`; DESFECHO tem voz (COR-04).
 *
 * Componente que mostra voz recebe `tom: Tom` e compõe a classe daqui. Literal
 * de paleta (`text-emerald-700`) fora deste arquivo é defeito, e vocabulário
 * próprio (`atencao`, `erro`, `sucesso`) também (COR-05).
 *
 * As vozes `ok`/`espera`/`ruim`/`alheio` são da paleta FIXA, com o par `dark:`
 * escrito aqui; `neutro` é token de tema, porque cinza precisa clarear no
 * escuro (COR-01). Os degraus de cada mapa são contraste medido (COR-06): mudar
 * um degrau pede medir de novo no navegador (MED-01).
 */
export type Tom = "ok" | "espera" | "ruim" | "neutro" | "alheio"

export const TONS = ["ok", "espera", "ruim", "neutro", "alheio"] as const satisfies readonly Tom[]

/** Número de voz com 24px ou mais. No claro, o 600 só passa como texto grande (COR-06). */
export const COR_DO_TOM: Record<Tom, string> = {
  ok: "text-emerald-600 dark:text-emerald-400",
  espera: "text-amber-600 dark:text-amber-400",
  ruim: "text-rose-600 dark:text-rose-400",
  neutro: "text-muted-foreground",
  alheio: "text-violet-600 dark:text-violet-400",
}

/** Qualquer texto de voz menor que 24px. `espera` é 800 no claro: o 700 cai a 4,32 sobre `accent` (COR-06). */
export const COR_DO_TOM_DENSO: Record<Tom, string> = {
  ok: "text-emerald-700 dark:text-emerald-400",
  espera: "text-amber-800 dark:text-amber-400",
  ruim: "text-rose-700 dark:text-rose-400",
  neutro: "text-muted-foreground",
  alheio: "text-violet-700 dark:text-violet-400",
}

/** O carimbo: tinta chapada e o texto sobre ela (CTRL-05). O neutro tem tinta, com alfa fixado (COR-07). */
export const BADGE_DO_TOM: Record<Tom, string> = {
  ok: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
  espera: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  ruim: "bg-rose-500/15 text-rose-800 dark:text-rose-300",
  neutro: "bg-foreground/[0.07] text-muted-foreground dark:text-foreground-2",
  alheio: "bg-violet-500/15 text-violet-800 dark:text-violet-300",
}

/**
 * Só o fundo: o bloco de tinta. `neutro` é o degrau afundado do tema
 * (`--muted`), não uma tinta de voz — bloco que não pede nada se separa do
 * cartão por degrau, não por matiz (SUP-03).
 */
export const TINTA_DO_TOM: Record<Tom, string> = {
  ok: "bg-emerald-500/15",
  espera: "bg-amber-500/15",
  ruim: "bg-rose-500/15",
  neutro: "bg-muted",
  alheio: "bg-violet-500/15",
}

/**
 * O marcador de 6px. É objeto gráfico (3:1), por isso no claro desce um degrau
 * onde o 500 não paga; e nunca aparece sem a palavra ao lado — cor não informa
 * sozinha (COR-08).
 */
export const PONTO_DO_TOM: Record<Tom, string> = {
  ok: "bg-emerald-600 dark:bg-emerald-500",
  espera: "bg-amber-600 dark:bg-amber-500",
  ruim: "bg-rose-500",
  neutro: "bg-muted-foreground/80",
  alheio: "bg-violet-500",
}

/** A barra vertical de 2px. */
export const FILETE_DO_TOM: Record<Tom, string> = {
  ok: "border-emerald-500/70",
  espera: "border-amber-500/70",
  ruim: "border-rose-500/70",
  neutro: "border-border",
  alheio: "border-violet-500/70",
}
