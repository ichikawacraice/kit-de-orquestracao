export type Tom = 'ok' | 'espera' | 'ruim' | 'neutro' | 'alheio'

export const BADGE_DO_TOM: Record<Tom, string> = {
  ok: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200',
  espera: 'bg-amber-500/15 text-amber-800 dark:text-amber-200',
  ruim: 'bg-rose-500/15 text-rose-800 dark:text-rose-200',
  neutro: 'bg-foreground/[0.07] text-foreground-2',
  alheio: 'bg-violet-500/15 text-violet-800 dark:text-violet-200',
}
