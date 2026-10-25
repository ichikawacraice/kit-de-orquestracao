// O desenho do pane no desktop: cada bloco é um SVG, como o savvy-progress faz,
// porque o desktop desenha SVG com a fonte do sistema e o tema claro/escuro.
// Funções puras, sem `$`: recebem os dados e a largura, devolvem o markup.

import type { LinhaSessao, Passo, PerguntaAberta, PerguntaAnterior } from '../types'

const FONTE = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',sans-serif"

const CSS = `<style>
.t{fill:#1f1f1f}.s{fill:#6b6b68}.m{fill:#9a9a96}.ln{stroke:#e8e7e3}.tile{fill:#f4f3f0}.k{fill:#ecebe8}.card{fill:#fbf6ec;stroke:#efdcb6}
@media (prefers-color-scheme: dark){.t{fill:#ececec}.s{fill:#a8a8a4}.m{fill:#7d7d79}.ln{stroke:#2f2f2d}.tile{fill:#262625}.k{fill:#2c2c2b}.card{fill:#2a251b;stroke:#4a3d22}}
.vivo{animation:p 1.6s ease-in-out infinite}@keyframes p{50%{opacity:.35}}
@media (prefers-reduced-motion: reduce){.vivo{animation:none}}
</style>`

export const COR_ESTADO: Record<string, string> = {
  trabalhando: '#5b8def',
  'aguarda-subsessao': '#8b8cf8',
  'aguarda-voce': '#e2a94e',
  'aguarda-validacao': '#e2a94e',
  'aguarda-merge': '#4caf6e',
  'pr-aberto': '#4caf6e',
  esperando: '#e2a94e',
  bloqueada: '#e0846b',
}

const NEUTRO = '#9a9a96'
const AVISO = '#d9962b'
const ERRO = '#d9674c'
const OK = '#4caf6e'
const ANDA = '#5b8def'

export const ROTULO_ESTADO: Record<string, string> = {
  trabalhando: 'trabalhando',
  'aguarda-subsessao': 'espera subsessão',
  'aguarda-voce': 'espera você',
  'aguarda-validacao': 'espera validação',
  'aguarda-merge': 'espera merge',
  'pr-aberto': 'PR aberto',
  esperando: 'esperando',
  bloqueada: 'bloqueada',
  parada: 'parada',
  concluida: 'concluída',
}

const xml = (s: string): string =>
  s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c)

// Avanço aproximado da fonte do sistema, em em: basta para cortar com reticências.
const LARGO = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿＀-｠\u{1F300}-\u{1FAFF}]/u
const em = (ch: string): number =>
  LARGO.test(ch) ? 1 : ch === ' ' ? 0.28 : /[ilj.,:;'|!]/.test(ch) ? 0.28 : /[A-Z0-9#mwMW@%]/.test(ch) ? 0.66 : 0.54

const largura = (s: string, tam: number): number => [...s].reduce((w, ch) => w + em(ch) * tam, 0)

const caber = (s: string, tam: number, max: number): string => {
  if (largura(s, tam) <= max) return s
  let out = ''
  for (const ch of s) {
    if (largura(out + ch + '…', tam) > max) break
    out += ch
  }
  return out + '…'
}

/** Quebra em linhas que cabem em `max`, no máximo `n`; a última leva reticências. */
const quebrar = (s: string, tam: number, max: number, n: number): string[] => {
  const linhas: string[] = []
  let atual = ''
  for (const palavra of s.split(/\s+/).filter(Boolean)) {
    const tenta = atual ? `${atual} ${palavra}` : palavra
    if (largura(tenta, tam) <= max || !atual) atual = tenta
    else {
      linhas.push(atual)
      atual = palavra
    }
  }
  if (atual) linhas.push(atual)
  if (linhas.length <= n) return linhas.map(l => caber(l, tam, max))

  return [...linhas.slice(0, n - 1), caber(linhas.slice(n - 1).join(' ') + ' …', tam, max)]
}

const svg = (W: number, H: number, corpo: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${CSS}${corpo}</svg>`

const texto = (x: number, y: number, tam: number, classe: string, conteudo: string, extra = ''): string =>
  `<text class="${classe}" x="${x}" y="${y}" font-family="${FONTE}" font-size="${tam}"${extra}>${conteudo}</text>`

export type Contagem = { rotulo: string; n: number; cor: string }

export const ALTURA_RESUMO = 62

/** Quatro blocos lado a lado: quanto espera você, quanto trava, quanto anda, quanto vai a merge. */
export function resumoSvg(W: number, contagens: Contagem[]): string {
  const gap = 6
  const tw = (W - gap * (contagens.length - 1)) / contagens.length
  const blocos = contagens.map((c, i) => {
    const x = i * (tw + gap)
    const cor = c.n > 0 ? c.cor : NEUTRO

    return `<rect class="tile" x="${x}" y="0" width="${tw}" height="${ALTURA_RESUMO}" rx="10"/>
<circle cx="${x + 15}" cy="19" r="4.5" fill="${cor}"${c.n > 0 ? '' : ' fill-opacity=".45"'}/>
${texto(x + 26, 23.5, 13, 's', xml(caber(c.rotulo, 13, tw - 32)))}
${texto(x + 13, 51, 24, c.n > 0 ? '' : 'm', String(c.n), ` font-weight="600" font-variant-numeric="tabular-nums"${c.n > 0 ? ` fill="${cor}"` : ''}`)}`
  })

  return svg(W, ALTURA_RESUMO, blocos.join(''))
}

export function perguntaSvg(W: number, q: PerguntaAberta): { source: string; height: number } {
  const pilula = largura(q.id, 13) + 18
  // Sem teto de linhas: o operador responde pelo card, e frase cortada não se responde (pedido de 23/10).
  const titulo = quebrar(q.titulo, 15, W - 32, Infinity)
  const caso = q.caso ? quebrar(q.caso, 13, W - 32, Infinity) : []
  const seNao = q.seNaoDecidir ? quebrar(`Se não decidir: ${q.seNaoDecidir}`, 13, W - 32, Infinity) : []
  const reco = q.recomendacao ? quebrar(`Recomendo: ${q.recomendacao}`, 13, W - 32, Infinity) : []
  let y = 60
  const partes: string[] = []
  for (const l of titulo) {
    partes.push(texto(16, y, 15, 't', xml(l), ' font-weight="600"'))
    y += 21
  }
  if (caso.length > 0) y += 2
  for (const l of caso) {
    partes.push(texto(16, y, 13, 's', xml(l)))
    y += 18
  }
  if (seNao.length > 0) y += 6
  for (const l of seNao) {
    partes.push(texto(16, y, 13, 's', xml(l)))
    y += 18
  }
  if (reco.length > 0) y += 6
  for (const l of reco) {
    partes.push(texto(16, y, 13, 't', xml(l), ` fill="${AVISO}"`))
    y += 18
  }
  const H = y

  return {
    height: H,
    source: svg(
      W,
      H,
      `<rect class="card" x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="10"/>
<rect x="0" y="0" width="4" height="${H}" rx="2" fill="${AVISO}"/>
<rect x="16" y="14" width="${pilula}" height="24" rx="12" fill="${AVISO}"/>
${texto(16 + pilula / 2, 30.5, 13, '', xml(q.id), ` fill="#fff" text-anchor="middle" font-weight="700"`)}
${texto(16 + pilula + 10, 30.5, 13, 's', xml(caber(q.sessao, 13, W - pilula - 42)))}
${partes.join('')}`,
    ),
  }
}

const COR_DESFECHO: Record<string, string> = { respondida: OK, cancelada: NEUTRO }

/** Uma pergunta já fechada, inteira: ID, pergunta, o que se recomendou e a resposta (pedido de 23/10). */
export function anteriorSvg(W: number, a: PerguntaAnterior, agora: number): { source: string; height: number; alt: string } {
  const cor = COR_DESFECHO[a.estado] ?? NEUTRO
  const quando = desde(a.quando, agora)
  const pilula = largura(a.id, 13) + 16
  const direita = quando ? largura(quando, 13) + 10 : 0
  const titulo = quebrar(a.titulo, 14, W - pilula - 10 - direita, Infinity)
  const reco = a.recomendacao ? quebrar(`Recomendado: ${a.recomendacao}`, 13, W - pilula - 10, Infinity) : []
  const resposta = quebrar(`Resposta: ${a.resposta ?? a.estado}`, 13, W - pilula - 10, Infinity)
  const partes: string[] = []
  let y = 22
  for (const l of titulo) { partes.push(texto(pilula + 10, y, 14, 't', xml(l))); y += 19 }
  y += 3
  for (const l of reco) { partes.push(texto(pilula + 10, y, 13, 's', xml(l))); y += 18 }
  for (const l of resposta) { partes.push(texto(pilula + 10, y, 13, 't', xml(l), ` fill="${cor}" font-weight="600"`)); y += 18 }
  partes.push(texto(pilula + 10, y, 13, 'm', xml(a.sessao)))
  const H = y + 14

  return {
    height: H,
    alt: [`${a.id} · ${a.estado}`, a.titulo, a.recomendacao && `Recomendado: ${a.recomendacao}`, `Resposta: ${a.resposta ?? a.estado}`, a.sessao, quando]
      .filter(Boolean)
      .join(' — '),
    source: svg(
      W,
      H,
      `<line x1="0" y1="${H - .5}" x2="${W}" y2="${H - .5}" class="ln"/>
<rect x="0.5" y="7" width="${pilula}" height="21" rx="10.5" fill="none" stroke="${cor}"/>
${texto(pilula / 2, 22, 13, '', xml(a.id), ` fill="${cor}" text-anchor="middle" font-weight="700"`)}
${quando ? texto(W, 22, 13, 'm', xml(quando), ' text-anchor="end"') : ''}
${partes.join('')}`,
    ),
  }
}

/** Tempo desde `iso`, curto; nada quando falta ou está no futuro (relógio de quem gravou). */
export function desde(iso: string | undefined, agora: number): string | undefined {
  const t = iso ? Date.parse(iso) : NaN
  if (Number.isNaN(t) || t > agora + 60_000) return undefined
  const min = Math.floor((agora - t) / 60_000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)

  return h < 24 ? `há ${h} h` : `há ${Math.floor(h / 24)} d`
}

/** Até `max` passos em volta do que anda: o último feito, o atual e os próximos. */
function janela(passos: Passo[], max: number): { antes: number; itens: Passo[]; depois: number } {
  if (passos.length <= max) return { antes: 0, itens: passos, depois: 0 }
  const atual = passos.findIndex(p => p.estado !== 'feito')
  const foco = atual < 0 ? passos.length - 1 : atual
  const ini = Math.max(0, Math.min(foco - 1, passos.length - max))

  return { antes: ini, itens: passos.slice(ini, ini + max), depois: passos.length - ini - max }
}

const LINHA_PASSO = 22
// O respiro de cima e de baixo de cada sessão, dentro do desenho.
const TOPO = 16
const BASE = 22

function iconePasso(x: number, y: number, estado: string): string {
  if (estado === 'feito')
    return `<circle cx="${x}" cy="${y}" r="5.5" fill="${OK}"/><path d="M${x - 2.6} ${y}l1.8 1.9 3.4-3.6" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`
  if (estado === 'andamento')
    return `<circle cx="${x}" cy="${y}" r="5" fill="none" stroke="${ANDA}" stroke-width="1.8"/><circle class="vivo" cx="${x}" cy="${y}" r="2.2" fill="${ANDA}"/>`

  return `<circle cx="${x}" cy="${y}" r="5" fill="none" stroke="${NEUTRO}" stroke-width="1.3" stroke-dasharray="2 2"/>`
}

/** A lista de passos a partir de (x, y), a coluna da direita do cartão. */
function listaPassos(x: number, y: number, w: number, passos: Passo[], max: number): { svg: string; altura: number } {
  const { antes, itens, depois } = janela(passos, max)
  const partes: string[] = []
  let cy = y
  const nota = (t: string) => {
    partes.push(texto(x + 18, cy + 4.5, 12, 'm', t))
    cy += 18
  }
  if (antes > 0) nota(`+ ${antes} ${antes === 1 ? 'feito' : 'feitos'} antes`)
  for (const p of itens) {
    const classe = p.estado === 'feito' ? 'm' : p.estado === 'andamento' ? 't' : 's'
    const peso = p.estado === 'andamento' ? ' font-weight="600"' : ''
    partes.push(iconePasso(x + 6, cy, p.estado) + texto(x + 18, cy + 4.5, 13, classe, xml(caber(p.texto, 13, w - 32)), peso))
    cy += LINHA_PASSO
  }
  if (depois > 0) nota(`+ ${depois} ${depois === 1 ? 'pendente' : 'pendentes'}`)

  return { svg: partes.join(''), altura: cy - y }
}

/**
 * Uma sessão: ponto do estado, título e há quanto tempo agiu, estado e etapa,
 * trava e divergência, a barra dos passos e a lista deles — à direita quando
 * cabe, embaixo quando o pane é estreito.
 */
export function sessaoSvg(W: number, s: LinhaSessao, agora: number): { source: string; height: number; alt: string } {
  const cor = COR_ESTADO[s.estado] ?? NEUTRO
  const rotulo = ROTULO_ESTADO[s.estado] ?? s.estado
  const passos = s.passos ?? []
  const largo = passos.length > 0 && W >= 640
  const colW = largo ? Math.min(320, Math.round(W * 0.4)) : 0
  const tw = W - 30 - (largo ? colW + 24 : 8)
  const tempo = desde(s.ativaEm ?? s.atualizadoEm, agora)
  const feitos = passos.filter(p => p.estado === 'feito').length
  const trava =
    s.bloqueio || s.motivo
      ? `${s.estado === 'bloqueada' ? 'Trava' : 'Esperando'}${s.motivo ? ` (${s.motivo})` : ''}: ${s.bloqueio ?? ''}`
      : ''
  const extras = [
    trava && { t: trava, cor: s.estado === 'bloqueada' ? ERRO : '', classe: s.estado === 'bloqueada' ? '' : 's' },
    s.divergencia && { t: `≠ ${s.divergencia}`, cor: AVISO, classe: '' },
  ].filter(Boolean) as Array<{ t: string; cor: string; classe: string }>

  const partes: string[] = []
  const ponto =
    s.estado === 'bloqueada'
      ? `<circle cx="12" cy="${TOPO + 11}" r="6.5" fill="none" stroke="${cor}" stroke-width="2"/><path d="M12 ${TOPO + 7.8}v4" stroke="${cor}" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="${TOPO + 14.4}" r="1" fill="${cor}"/>`
      : `<circle${s.estado === 'trabalhando' || s.vivo?.isRunning ? ' class="vivo"' : ''} cx="12" cy="${TOPO + 11}" r="6" fill="${cor}"/>`
  partes.push(ponto)

  // O PR mora à direita do título, antes do tempo: "#1060 · há 2 h".
  const pr = s.pr ? `#${s.pr}` : ''
  const direita = [pr, tempo].filter(Boolean).join(' · ')
  const tempoW = direita ? largura(direita, 13) + 12 : 0
  partes.push(texto(30, TOPO + 16, 16, 't', xml(caber(s.titulo, 16, tw - tempoW)), ' font-weight="600"'))
  if (direita)
    partes.push(
      `<text x="${30 + tw}" y="${TOPO + 16}" font-family="${FONTE}" font-size="13" text-anchor="end" font-variant-numeric="tabular-nums">${pr ? `<tspan fill="${ANDA}" font-weight="600">${xml(pr)}</tspan>` : ''}<tspan class="m">${xml(pr && tempo ? ` · ${tempo}` : tempo ?? "")}</tspan></text>`,
    )
  const resto = s.etapa ? caber(` · ${s.etapa}`, 13, tw - largura(rotulo, 13)) : ''
  let y = TOPO + 37
  partes.push(
    `<text x="30" y="${y}" font-family="${FONTE}" font-size="13"><tspan fill="${cor}" font-weight="600">${xml(rotulo)}</tspan><tspan class="s">${xml(resto)}</tspan></text>`,
  )
  for (const e of extras) {
    y += 20
    partes.push(texto(30, y, 13, e.classe, xml(caber(e.t, 13, tw)), e.cor ? ` fill="${e.cor}"` : ''))
  }

  if (passos.length > 0) {
    y += 16
    const contagem = `${feitos}/${passos.length}`
    const barW = tw - largura(contagem, 13) - 12
    const cheio = Math.max(passos.length === feitos ? barW : 5, Math.round((barW * feitos) / passos.length))
    partes.push(
      `<rect class="k" x="30" y="${y}" width="${barW}" height="5" rx="2.5"/><rect x="30" y="${y}" width="${cheio}" height="5" rx="2.5" fill="${feitos === passos.length ? OK : cor}"/>`,
      texto(30 + tw, y + 6, 13, 's', contagem, ' text-anchor="end" font-variant-numeric="tabular-nums"'),
    )
    y += 5
  }

  let altura = y + BASE
  if (passos.length > 0 && largo) {
    const x = W - colW
    const lista = listaPassos(x, TOPO + 11, colW, passos, 6)
    altura = Math.max(altura, TOPO + lista.altura + BASE)
    partes.push(`<line class="ln" x1="${x - 12}" y1="${TOPO}" x2="${x - 12}" y2="${altura - BASE + 4}"/>`, lista.svg)
  } else if (passos.length > 0 && feitos < passos.length) {
    const lista = listaPassos(30, y + 22, W - 38, passos, 4)
    partes.push(lista.svg)
    altura = y + 22 + lista.altura - 6 + BASE
  }
  partes.push(`<line class="ln" x1="0" y1="${altura - 0.5}" x2="${W}" y2="${altura - 0.5}"/>`)

  const atual = passos.find(p => p.estado === 'andamento')

  return {
    height: altura,
    alt: [
      s.titulo + (s.pr ? ` · PR #${s.pr}` : ''),
      rotulo + (s.etapa ? ` · ${s.etapa}` : ''),
      ...extras.map(e => e.t),
      ...(passos.length > 0 ? [`${feitos}/${passos.length} passos${atual ? `, agora: ${atual.texto}` : ''}`] : []),
      ...(tempo ? [tempo] : []),
    ].join(' — '),
    source: svg(W, altura, partes.join('')),
  }
}
