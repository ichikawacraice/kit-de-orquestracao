// O desenho do pane no desktop: cada bloco é um SVG, como o savvy-progress faz,
// porque o desktop desenha SVG com a fonte do sistema e o tema claro/escuro.
// Funções puras, sem `$`: recebem os dados e a largura, devolvem o markup.

import type { LinhaItem, PerguntaAberta, PerguntaAnterior } from '../types'

const FONTE = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',sans-serif"

const CSS = `<style>
.t{fill:#1f1f1f}.s{fill:#6b6b68}.m{fill:#9a9a96}.ln{stroke:#e8e7e3}.tile{fill:#f4f3f0}.k{fill:#ecebe8}.card{fill:#fbf6ec;stroke:#efdcb6}
@media (prefers-color-scheme: dark){.t{fill:#ececec}.s{fill:#a8a8a4}.m{fill:#7d7d79}.ln{stroke:#2f2f2d}.tile{fill:#262625}.k{fill:#2c2c2b}.card{fill:#2a251b;stroke:#4a3d22}}
.vivo{animation:p 1.6s ease-in-out infinite}@keyframes p{50%{opacity:.35}}
@media (prefers-reduced-motion: reduce){.vivo{animation:none}}
</style>`

const NEUTRO = '#9a9a96'
const AVISO = '#d9962b'
const ERRO = '#d9674c'
const OK = '#4caf6e'
const ANDA = '#5b8def'

/** A cor da etapa: nenhuma nasce nova (§4.2). O âmbar fica só para o que espera o operador. */
export const COR_ETAPA: Record<string, string> = {
  planejamento: '#8b8cf8',
  design: '#8b8cf8',
  execucao: ANDA,
  validacao: ANDA,
  merge: OK,
}

export const ROTULO_ETAPA: Record<string, string> = {
  planejamento: 'planejamento',
  design: 'design',
  execucao: 'execução',
  validacao: 'validação',
  merge: 'merge',
  feito: 'feito',
  descartado: 'descartado',
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

/** `classe` pinta ponto e número com a cor do texto (`t`) no lugar de `cor`; o zero fica cinza de qualquer jeito. */
export type Contagem = { rotulo: string; n: number; cor: string; classe?: string }

export const ALTURA_RESUMO = 62
const GAP_RESUMO = 6
/** Abaixo disto os quatro blocos viram 2×2: lado a lado o rótulo "Esperam você" não cabe (§2.2). */
export const LARGURA_DO_2X2 = 500

/** Esperam você · Travados / Andando · Na fila: lado a lado a partir de 500 px, em duas linhas de dois abaixo. */
export function resumoSvg(W: number, contagens: Contagem[]): { source: string; height: number } {
  const duas = W < LARGURA_DO_2X2
  const porLinha = duas ? 2 : contagens.length
  const tw = (W - GAP_RESUMO * (porLinha - 1)) / porLinha
  const linhas = Math.ceil(contagens.length / porLinha)
  const blocos = contagens.map((c, i) => {
    const x = (i % porLinha) * (tw + GAP_RESUMO)
    const y = Math.floor(i / porLinha) * (ALTURA_RESUMO + GAP_RESUMO)
    const viva = c.n > 0
    const corPonto = viva && c.classe ? `class="${c.classe}"` : `fill="${viva ? c.cor : NEUTRO}"`
    const corNumero = viva ? (c.classe ? ` class="${c.classe}"` : ` fill="${c.cor}"`) : ' class="m"'

    return `<rect class="tile" x="${x}" y="${y}" width="${tw}" height="${ALTURA_RESUMO}" rx="10"/>
<circle ${corPonto} cx="${x + 15}" cy="${y + 19}" r="4.5"${viva ? '' : ' fill-opacity=".45"'}/>
${texto(x + 26, y + 23.5, 13, 's', xml(caber(c.rotulo, 13, tw - 32)))}
<text x="${x + 13}" y="${y + 51}" font-family="${FONTE}" font-size="24" font-weight="600" font-variant-numeric="tabular-nums"${corNumero}>${c.n}</text>`
  })
  const height = linhas * ALTURA_RESUMO + (linhas - 1) * GAP_RESUMO

  return { height, source: svg(W, height, blocos.join('')) }
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
${texto(16 + pilula + 10, 30.5, 13, 's', xml(caber(q.rotulo ?? q.sessao, 13, W - pilula - 42)))}
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

const TOPO = 16
const BASE = 16

/** O ponto do item (§4.1): anda, trava ou espera na fila; o feito leva o círculo cheio do OK. */
function pontoDoItem(item: LinhaItem, cor: string): string {
  const cy = TOPO + 11
  if (item.situacao === 'travado')
    return `<circle cx="12" cy="${cy}" r="6.5" fill="none" stroke="${ERRO}" stroke-width="2"/><path d="M12 ${cy - 3.2}v4" stroke="${ERRO}" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="${cy + 3.4}" r="1" fill="${ERRO}"/>`
  if (item.situacao === 'fila')
    return `<circle cx="12" cy="${cy}" r="5" fill="none" stroke="${NEUTRO}" stroke-width="1.3" stroke-dasharray="2 2"/>`
  if (item.situacao === 'feito') return `<circle cx="12" cy="${cy}" r="6" fill="${OK}"/>`

  return `<circle class="vivo" cx="12" cy="${cy}" r="6" fill="${cor}"/>`
}

/** Quebra em até duas linhas: a primeira cabe em `max1` (divide a linha com o tempo), a segunda em `max2`. */
function quebrarEmDuas(s: string, tam: number, max1: number, max2: number): string[] {
  const palavras = s.split(/\s+/).filter(Boolean)
  let primeira = ''
  let i = 0
  for (; i < palavras.length; i++) {
    const tenta = primeira ? `${primeira} ${palavras[i]}` : (palavras[i] ?? '')
    if (largura(tenta, tam) > max1 && primeira) break
    primeira = tenta
  }
  const resto = palavras.slice(i).join(' ')

  return resto ? [caber(primeira, tam, max1), ...quebrar(resto, tam, max2, 1)] : [caber(primeira, tam, max1)]
}

type Trecho = { t: string; cor?: string; classe?: string; peso?: boolean }

/** O TEMPO: em sessão, há quanto o dono agiu; na fila, há quanto está parado (§4.3). */
function tempoDoItem(item: LinhaItem, agora: number): string | undefined {
  if (item.situacao === 'feito') return desde(item.feitoEm, agora)
  if (item.situacao === 'fila') {
    const d = desde(item.paradoDesde ?? item.atualizadoEm, agora)

    return d && `parado ${d}`
  }

  return desde(item.atualizadoEm, agora)
}

/**
 * Um item da fila (§4): ponto, título (até 2 linhas) e tempo; etapa, selo, dono e último PR; a trava;
 * `agora` em sessão ou `resumo` na fila; e o que vem depois. `noTravados` põe o tema na linha 2.
 */
export function itemSvg(W: number, item: LinhaItem, agora: number, opcoes: { noTravados?: boolean } = {}): { source: string; height: number; alt: string } {
  const cor = COR_ETAPA[item.etapa] ?? NEUTRO
  const rotulo = ROTULO_ETAPA[item.etapa] ?? item.etapa
  const tw = W - 30 - 8
  const tempo = tempoDoItem(item, agora)
  const tempoW = tempo ? largura(tempo, 13) + 12 : 0
  const partes: string[] = [pontoDoItem(item, cor)]

  let y = TOPO + 16
  const titulo = quebrarEmDuas(item.titulo, 16, tw - tempoW, tw)
  titulo.forEach((l, k) => {
    partes.push(texto(30, y + k * 20, 16, 't', xml(l), ' font-weight="600"'))
  })
  if (tempo) partes.push(texto(30 + tw, TOPO + 16, 13, 'm', xml(tempo), ' text-anchor="end" font-variant-numeric="tabular-nums"'))
  y += (titulo.length - 1) * 20

  // O que gera decisão (etapa, selo) vem antes do que só informa (dono, PR): o corte com reticências come o fim da linha.
  const ultimoPr = item.prs.length > 0 ? `#${item.prs[item.prs.length - 1]}${item.prs.length > 1 ? ` +${item.prs.length - 1}` : ''}` : ''
  const trechos: Trecho[] = [
    item.situacao === 'fila' ? { t: `espera ${rotulo}`, classe: 's', peso: true } : { t: rotulo, cor, peso: true },
    ...(opcoes.noTravados ? [{ t: item.temaRotulo, classe: 's' }] : []),
    ...(item.perguntas.length > 0 ? [{ t: `aguarda você · ${item.perguntas[0]}`, cor: AVISO, peso: true }] : []),
    ...(item.dono ? [{ t: item.dono.apelido, classe: 's' }] : []),
    ...(ultimoPr ? [{ t: ultimoPr, cor: ANDA, peso: true }] : []),
  ]
  const linha2: string[] = []
  let usado = 0
  const sep = ' · '
  for (const [k, tr] of trechos.entries()) {
    const antes = k === 0 ? '' : sep
    const tam = 13.6
    const sobra = tw - usado
    const completo = antes + tr.t
    const atrib = tr.cor ? ` fill="${tr.cor}"` : tr.classe ? ` class="${tr.classe}"` : ''
    const peso = tr.peso ? ' font-weight="600"' : ''
    if (largura(completo, tam) <= sobra) {
      linha2.push(`<tspan${atrib}${peso}>${xml(completo)}</tspan>`)
      usado += largura(completo, tam)
      continue
    }
    linha2.push(`<tspan${atrib}${peso}>${xml(caber(completo, tam, sobra))}</tspan>`)
    break
  }
  y += 21
  partes.push(`<text x="30" y="${y}" font-family="${FONTE}" font-size="13">${linha2.join('')}</text>`)

  const alt = [item.titulo, [item.situacao === 'fila' ? `espera ${rotulo}` : rotulo, opcoes.noTravados ? item.temaRotulo : undefined, item.perguntas[0] && `aguarda você · ${item.perguntas[0]}`, item.dono?.apelido, ultimoPr].filter(Boolean).join(' · ')]
  if (item.trava) {
    const trava = quebrar(`Trava (${item.trava.motivo}): ${item.trava.texto}`, 13, tw, 2)
    for (const l of trava) {
      y += 19
      partes.push(texto(30, y, 13, '', xml(l), ` fill="${ERRO}"`))
    }
    alt.push(`Trava (${item.trava.motivo}): ${item.trava.texto}`)
  }
  if (item.situacao === 'fila' && item.resumo) {
    for (const l of quebrar(item.resumo, 13, tw, 2)) {
      y += 19
      partes.push(texto(30, y, 13, 's', xml(l)))
    }
    alt.push(item.resumo)
  } else if (item.situacao !== 'fila' && item.agora) {
    y += 19
    partes.push(texto(30, y, 13, 's', xml(caber(item.agora, 13, tw))))
    alt.push(item.agora)
  }
  if (item.depois.length > 0) {
    const mais = item.depois.length > 1 ? ` (+${item.depois.length - 1})` : ''
    const depois = `depois: ${item.depois[0]}${mais}`
    y += 19
    partes.push(texto(30, y, 13, 'm', xml(caber(depois, 13, tw))))
    alt.push(depois)
  }
  if (tempo) alt.push(tempo)
  const altura = y + BASE
  partes.push(`<line class="ln" x1="0" y1="${altura - 0.5}" x2="${W}" y2="${altura - 0.5}"/>`)

  return { height: altura, alt: alt.join(' — '), source: svg(W, altura, partes.join('')) }
}
