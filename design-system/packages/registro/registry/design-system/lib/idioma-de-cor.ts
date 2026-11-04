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

/** A tinta do carimbo neutro, com o alfa fixado (COR-07): a do estado neutro e a do `Badge`, neutro ou de marca (CTRL-05). */
export const TINTA_DO_CARIMBO_NEUTRO = "bg-foreground/[0.07]"

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
 * O texto SOBRE a tinta da voz (`*-500/15`): o carimbo, a bandeja do cartão do
 * quadro. Sobre a tinta, o degrau que paga 4,5:1 é o 800 no claro e o 300 no
 * escuro — o `COR_DO_TOM_DENSO` derruba o âmbar a 4,48 ali (COR-06).
 */
export const TEXTO_SOBRE_A_TINTA: Record<Tom, string> = {
  ok: "text-emerald-800 dark:text-emerald-300",
  espera: "text-amber-800 dark:text-amber-300",
  ruim: "text-rose-800 dark:text-rose-300",
  neutro: "text-muted-foreground dark:text-foreground-2",
  alheio: "text-violet-800 dark:text-violet-300",
}

/** O carimbo: tinta chapada e o texto sobre ela (CTRL-05). O neutro tem tinta, com alfa fixado (COR-07). */
export const BADGE_DO_TOM: Record<Tom, string> = {
  ok: `${TINTA_DO_TOM.ok} ${TEXTO_SOBRE_A_TINTA.ok}`,
  espera: `${TINTA_DO_TOM.espera} ${TEXTO_SOBRE_A_TINTA.espera}`,
  ruim: `${TINTA_DO_TOM.ruim} ${TEXTO_SOBRE_A_TINTA.ruim}`,
  neutro: `${TINTA_DO_CARIMBO_NEUTRO} ${TEXTO_SOBRE_A_TINTA.neutro}`,
  alheio: `${TINTA_DO_TOM.alheio} ${TEXTO_SOBRE_A_TINTA.alheio}`,
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

/**
 * O ponto de 6px DENTRO do carimbo (o estado neutro, CTRL-05): a tinta do
 * próprio texto, não a do `PONTO_DO_TOM`. Sobre a tinta do carimbo, o texto já
 * paga 4,5:1, então o ponto paga os 3:1 de objeto gráfico nos dois temas; e
 * a forma não ganha matiz próprio (COR-08).
 */
export const PONTO_NO_CARIMBO = "bg-current"

/** A barra vertical de 2px. */
export const FILETE_DO_TOM: Record<Tom, string> = {
  ok: "border-emerald-500/70",
  espera: "border-amber-500/70",
  ruim: "border-rose-500/70",
  neutro: "border-border",
  alheio: "border-violet-500/70",
}
