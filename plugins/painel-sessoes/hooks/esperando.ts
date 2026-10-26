// A regra "item esperando o papel X" (F58): cópia, SEM import, de plugins/orquestracao/hooks/esperando-papel.mjs
// (o pane é outro plugin e não alcança o outro). O teste `esperando-concorda.test.mjs` do plugin orquestracao compara as duas
// sobre a mesma tabela de casos: mude nas duas. Só anotações de tipo, para o Node tirá-las sozinho.

export type Esperando = { papel: 'D' | 'E' | 'V'; desde: string; minutos: number; entregue: boolean }

export const PAPEL_DA_ETAPA: Record<string, 'D' | 'E' | 'V'> = { design: 'D', execucao: 'E', validacao: 'V' }

const ms = (v: unknown): number | null => {
  const t = Date.parse(String(v))
  return Number.isNaN(t) ? null : t
}
const doPapel = (apelido: unknown, papel: string): boolean => typeof apelido === 'string' && apelido.toUpperCase().startsWith(papel)

export function esperandoPapel(data: Record<string, unknown> | null | undefined, agoraMs: number): Esperando | null {
  if (!data || typeof data !== 'object') return null
  const papel = PAPEL_DA_ETAPA[String(data.etapa)]
  if (!papel) return null
  if (data.espera || data.trava) return null
  const com = Array.isArray(data.com) ? (data.com as Array<Record<string, unknown> | null>) : []
  const ocupado = (p: string): boolean => doPapel(data.donoApelido, p) || com.some(c => doPapel(c?.apelido, p))
  if (ocupado(papel)) return null
  if (papel === 'V' && ocupado('E')) return null

  let desde: number | null = null
  const hist = Array.isArray(data.historico) ? (data.historico as Array<Record<string, unknown> | null>) : []
  for (let i = hist.length - 1; i >= 0 && hist[i]?.etapa === data.etapa; i--) {
    const t = ms(hist[i]?.em)
    if (t !== null) desde = t
  }
  if (desde === null && hist.length === 0) desde = ms(data.atualizadoEm)
  if (desde === null) return null
  const entrada = desde
  let entregue = false
  for (const f of Array.isArray(data.fez) ? (data.fez as Array<Record<string, unknown> | null>) : []) {
    const t = ms(f?.em)
    if (!doPapel(f?.apelido, papel) || t === null || t < entrada) continue
    entregue = true
    if (t > desde) desde = t
  }

  return { papel, desde: new Date(desde).toISOString(), minutos: Math.max(0, Math.floor((agoraMs - desde) / 60000)), entregue }
}
