// A regra "item sem dona": cópia, SEM import, de plugins/orquestracao/hooks/sem-dona.mjs (o pane é outro plugin e não
// alcança o outro). O teste `sem-dona-concorda.test.mjs` do plugin orquestracao compara as duas sobre a mesma tabela de
// casos: mude nas duas. Só anotações de tipo, para o Node tirá-las sozinho.

export type SemDona = { desde: string; minutos: number }

export const ETAPAS_DE_TRABALHO = ['planejamento', 'design', 'execucao', 'validacao']

const ms = (v: unknown): number | null => {
  const t = Date.parse(String(v))
  return Number.isNaN(t) ? null : t
}

export function semDona(data: Record<string, unknown> | null | undefined, agoraMs: number): SemDona | null {
  if (!data || typeof data !== 'object') return null
  if (!ETAPAS_DE_TRABALHO.includes(String(data.etapa))) return null
  if (data.espera || data.trava) return null
  if (data.donoLocalId || (Array.isArray(data.com) && data.com.length > 0)) return null

  let desde: number | null = null
  const hist = Array.isArray(data.historico) ? (data.historico as Array<Record<string, unknown> | null>) : []
  for (let i = hist.length - 1; i >= 0 && hist[i]?.etapa === data.etapa; i--) {
    const t = ms(hist[i]?.em)
    if (t !== null) desde = t
  }
  if (desde === null && hist.length === 0) desde = ms(data.atualizadoEm)
  if (desde === null) return null
  return { desde: new Date(desde).toISOString(), minutos: Math.max(0, Math.floor((agoraMs - desde) / 60000)) }
}
