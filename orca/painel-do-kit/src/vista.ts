// Contas da tela da aba do kit (F436), sem estado e sem Orca: tempo em português, agrupamentos e rótulos.
import type { Entrega, Pergunta, Sessao } from './protocol'

const FUSO = 'America/Sao_Paulo'

/** `há 20 s`, `há 12 min`, `há 2 h`, `há 3 d` (o `RelativeTime` do Orca sai na língua do app). */
export function haQuanto(emMs: number, agoraMs: number): string {
  const s = Math.max(0, Math.round((agoraMs - emMs) / 1000))
  if (s < 60) return `há ${s} s`
  const min = Math.floor(s / 60)
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h} h`
  return `há ${Math.floor(h / 24)} d`
}

export const ms = (iso: string | null | undefined): number => {
  const n = Date.parse(String(iso ?? ''))
  return Number.isFinite(n) ? n : 0
}

const diaSP = (msEpoch: number) => new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(msEpoch)

/** Hora de São Paulo, `14:05`. */
export const horaSP = (msEpoch: number) => new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' }).format(msEpoch)

/** `Hoje`, `Ontem` ou `terça, 3 de nov`, pelo dia de São Paulo. */
export function nomeDoDia(msEpoch: number, agoraMs: number): string {
  const d = diaSP(msEpoch)
  if (d === diaSP(agoraMs)) return 'Hoje'
  if (d === diaSP(agoraMs - 86_400_000)) return 'Ontem'
  return new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, weekday: 'long', day: 'numeric', month: 'short' }).format(msEpoch).replace('.', '')
}

const ITEM = /^(F\d+)\b/

/** O item de uma pergunta: o campo `item`, senão o `F…` do início do título. */
export const itemDe = (q: Pick<Pergunta, 'item' | 'titulo'>): string | null => q.item ?? q.titulo.match(ITEM)?.[1] ?? null

export type Grupo<T> = { chave: string; titulo: string; itens: T[]; ultimaMs: number; projeto?: string | null; item?: string | null }

/** O grupo de uma decisão: projeto + item (o `F12` de dois projetos são dois grupos). */
export const chaveDoGrupo = (q: Pick<Pergunta, 'item' | 'titulo' | 'projeto'>): string => `${q.projeto ?? '—'}:${itemDe(q) ?? 'sem-item'}`

const PROJETO_MAX = 28

/** As duas metades do selo do projeto: o nome (forte) e o item (fraco). Nada a mostrar: `null`. */
export function partesDoSelo(projeto: string | null | undefined, item: string | null | undefined): { forte: string | null; fraco: string | null } | null {
  const forte = projeto ? cortar(projeto, PROJETO_MAX).curto : null
  if (!forte && !item) return null
  return { forte, fraco: item ? (forte ? `· ${item}` : item) : null }
}

/** O título sem o `F435 · ` (ou `F435: `, `F435 — `) do começo, quando o item é esse; se sobra vazio, o título inteiro. */
export function semPrefixoDoItem(titulo: string, item: string | null | undefined): string {
  if (!item) return titulo
  const m = titulo.match(/^(F\d+)\s*(?:·|:|—|-)\s*(.+)$/s)
  return m && m[1] === item && m[2].trim() ? m[2].trim() : titulo
}

/** Decisões assumidas por item, o grupo com a decisão mais recente primeiro. */
export function porItem(assumidas: Pergunta[]): Grupo<Pergunta>[] {
  const mapa = new Map<string, Grupo<Pergunta>>()
  for (const q of assumidas) {
    const item = itemDe(q)
    const chave = chaveDoGrupo(q)
    const g = mapa.get(chave) ?? { chave, titulo: item ?? 'Sem item', itens: [], ultimaMs: 0, projeto: q.projeto ?? null, item }
    g.itens.push(q)
    g.ultimaMs = Math.max(g.ultimaMs, ms(q.atualizadoEm))
    mapa.set(chave, g)
  }
  return [...mapa.values()].sort((a, b) => b.ultimaMs - a.ultimaMs)
}

/** Entregas por dia de São Paulo, o dia mais recente primeiro (a lista já vem do mais recente). */
export function porDia(entregas: Entrega[], agoraMs: number): Grupo<Entrega>[] {
  const grupos: Grupo<Entrega>[] = []
  for (const e of entregas) {
    const em = ms(e.em)
    const titulo = nomeDoDia(em, agoraMs)
    const g = grupos.at(-1)
    if (g && g.titulo === titulo) g.itens.push(e)
    else grupos.push({ chave: titulo, titulo, itens: [e], ultimaMs: em })
  }
  return grupos
}

/** O título começa pelo item? Então o item não se repete no metadado. */
export const tituloTrazItem = (q: Pick<Pergunta, 'item' | 'titulo'>) => Boolean(q.item && q.titulo.startsWith(q.item))

/** Para quem vai uma resposta, em palavras: `F435`, senão `a sessão`. */
export const nomeDoDestino = (q: Pick<Pergunta, 'item' | 'titulo'>) => itemDe(q) ?? 'a sessão'

export const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

/** Corta um texto longo na última palavra antes do limite. */
export function cortar(texto: string, limite: number): { curto: string; cortou: boolean } {
  if (texto.length <= limite) return { curto: texto, cortou: false }
  const corte = texto.slice(0, limite)
  const espaco = corte.lastIndexOf(' ')
  return { curto: `${(espaco > limite * 0.6 ? corte.slice(0, espaco) : corte).trimEnd()}…`, cortou: true }
}

/** `hoje, 14:05`, `ontem, 09:30` ou `terça, 3 de nov, 14:05`, em São Paulo. */
export const quando = (msEpoch: number, agoraMs: number) => `${nomeDoDia(msEpoch, agoraMs).toLowerCase()}, ${horaSP(msEpoch)}`

/** Meia-noite de hoje em São Paulo (UTC−3, sem horário de verão desde 2019): de onde contam as entregues de hoje. */
export const inicioDoDiaSP = (agoraMs: number) => Date.parse(`${diaSP(agoraMs)}T03:00:00Z`)

/** O tempo da 2ª linha do cartão: `agora` com a sessão do app rodando, senão `há X` (na parada, o selo já diz Parada). */
export function tempoDaSessao(s: Pick<Sessao, 'estado' | 'desdeEm' | 'rodando'>, agoraMs: number): string {
  if (s.rodando && (s.estado === 'trabalhando' || s.estado === 'validando')) return 'agora'
  if (!s.desdeEm || !ms(s.desdeEm)) return ''
  return haQuanto(ms(s.desdeEm), agoraMs)
}

/** `168`, `168 e 165`, `168, 165 e 160`, `168, 165, 160 e mais 11`. */
export function listaDePRs(prs: number[]): string {
  if (prs.length <= 1) return prs.map(String).join('')
  if (prs.length <= 3) return `${prs.slice(0, -1).join(', ')} e ${prs.at(-1)}`
  return `${prs.slice(0, 3).join(', ')} e mais ${prs.length - 3}`
}
