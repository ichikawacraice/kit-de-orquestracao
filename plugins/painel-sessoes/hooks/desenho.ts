// O desenho do pane no desktop: cada bloco é um SVG, como o savvy-progress faz,
// porque o desktop desenha SVG com a fonte do sistema e o tema claro/escuro.
// Funções puras, sem `$`: recebem os dados e a largura, devolvem o markup.

import type { Citado, ItemDoIndice, LinhaItem, PerguntaAberta, PerguntaAnterior } from '../types'

const FONTE = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',sans-serif"

const CSS = `<style>
.t{fill:#1f1f1f}.s{fill:#6b6b68}.m{fill:#6f6f6b}.av{fill:#9a6210}.er{fill:#b8452c}.an{fill:#3a68c8}.ok{fill:#2e7d4a}.li{fill:#5b5cd6}.lis{stroke:#5b5cd6}.pt{fill:#ffffff}.es{stroke:#b8452c}.oks{stroke:#2e7d4a}.ms{stroke:#6f6f6b}.ln{stroke:#e8e7e3}.tile{fill:#f4f3f0}.k{fill:#ecebe8}.card{fill:#fbf6ec;stroke:#efdcb6}.et{fill:#fdf0ed}.avs{stroke:#9a6210}.ans{stroke:#3a68c8}
@media (prefers-color-scheme: dark){.t{fill:#ececec}.s{fill:#a8a8a4}.m{fill:#93938f}.av{fill:#d9962b}.er{fill:#e0846b}.an{fill:#5b8def}.ok{fill:#4caf6e}.li{fill:#8b8cf8}.lis{stroke:#8b8cf8}.pt{fill:#1f1f1f}.es{stroke:#e0846b}.oks{stroke:#4caf6e}.ms{stroke:#93938f}.ln{stroke:#2f2f2d}.tile{fill:#262625}.k{fill:#2c2c2b}.card{fill:#2a251b;stroke:#4a3d22}.et{fill:#3a2320}.avs{stroke:#d9962b}.ans{stroke:#5b8def}}
.vivo{animation:p 1.6s ease-in-out infinite}@keyframes p{50%{opacity:.35}}
@media (prefers-reduced-motion: reduce){.vivo{animation:none}}
</style>`

const NEUTRO = '#9a9a96'
// Cor por CLASSE (claro/escuro no CSS acima, cada uma a 4,5:1 ou mais sobre o fundo e o bloco do tema): um hex fixo vale para um tema só.
const AVISO = 'av'
const ERRO = 'er'
const OK = 'ok'
const ANDA = 'an'
const LILAS = 'li'

/** O rótulo que abre o cartão: "projeto · tema", ou só o tema quando o item não diz o projeto. */
export const tituloDoTema = (item: Pick<LinhaItem, 'projeto' | 'temaRotulo'>): string => (item.projeto ? `${item.projeto} · ${item.temaRotulo}` : item.temaRotulo)

/** A cor da etapa: nenhuma nasce nova (§4.2). O âmbar fica só para o que espera o operador. */
export const COR_ETAPA: Record<string, string> = {
  planejamento: LILAS,
  design: LILAS,
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

export const largura = (s: string, tam: number): number => [...s].reduce((w, ch) => w + em(ch) * tam, 0)

const caber = (s: string, tam: number, max: number): string => {
  if (largura(s, tam) <= max) return s
  let out = ''
  for (const ch of s) {
    if (largura(out + ch + '…', tam) > max) break
    out += ch
  }
  return out + '…'
}

/** Corta na última palavra inteira que cabe, com reticências; só corta letra quando uma palavra sozinha passa de `max`. */
const cabePalavras = (s: string, tam: number, max: number): string => {
  if (largura(s, tam) <= max) return s
  const ps = s.replace(/\s*…$/, '').split(/\s+/).filter(Boolean)
  while (ps.length > 1) {
    ps.pop()
    const t = `${ps.join(' ')}…`
    if (largura(t, tam) <= max) return t
  }

  return caber(ps[0] ?? '', tam, max)
}

/** Quebra em linhas que cabem em `max`, no máximo `n`; a última leva reticências, cortada em palavra inteira. */
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

  return [...linhas.slice(0, n - 1), cabePalavras(linhas.slice(n - 1).join(' ') + ' …', tam, max)]
}

const svg = (W: number, H: number, corpo: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${CSS}${corpo}</svg>`

const texto = (x: number, y: number, tam: number, classe: string, conteudo: string, extra = ''): string =>
  `<text class="${classe}" x="${x}" y="${y}" font-family="${FONTE}" font-size="${tam}"${extra}>${conteudo}</text>`

/** `cor` é uma classe de cor (`av`, `er`, `an`...); `classe` a troca por outra (a `t`, do texto); o zero fica cinza de qualquer jeito. */
export type Contagem = { rotulo: string; n: number; cor: string; classe?: string }

export const ALTURA_RESUMO = 62
/** Abaixo disto o resumo fica compacto: o bloco de 36 px leva o número na linha do rótulo. */
export const LARGURA_DO_COMPACTO = 360
export const ALTURA_RESUMO_COMPACTO = 36
const GAP_RESUMO = 6
/** Abaixo disto os quatro blocos viram 2×2: lado a lado o rótulo "Esperam você" não cabe (§2.2). */
export const LARGURA_DO_2X2 = 500

/** Esperam você · Travados / Executando · Na fila: lado a lado a partir de 500 px, em 2×2 abaixo, e compacto abaixo de 360. */
export function resumoSvg(W: number, contagens: Contagem[]): { source: string; height: number } {
  const duas = W < LARGURA_DO_2X2
  const compacto = W < LARGURA_DO_COMPACTO
  const alturaBloco = compacto ? ALTURA_RESUMO_COMPACTO : ALTURA_RESUMO
  const porLinha = duas ? 2 : contagens.length
  const tw = (W - GAP_RESUMO * (porLinha - 1)) / porLinha
  const linhas = Math.ceil(contagens.length / porLinha)
  const blocos = contagens.map((c, i) => {
    const x = (i % porLinha) * (tw + GAP_RESUMO)
    const y = Math.floor(i / porLinha) * (alturaBloco + GAP_RESUMO)
    const viva = c.n > 0
    const corNumero = viva ? ` class="${c.classe ?? c.cor}"` : ' class="m"'
    if (compacto) {
      const corPonto = viva ? `class="${c.classe ?? c.cor}"` : `fill="${NEUTRO}"`
      const reservaNumero = largura(String(c.n), 17) + 8

      return `<rect class="tile" x="${x}" y="${y}" width="${tw}" height="${alturaBloco}" rx="10"/>
<circle ${corPonto} cx="${x + 13}" cy="${y + 18}" r="4"${viva ? '' : ' fill-opacity=".45"'}/>
${texto(x + 23, y + 22.5, 12.5, 's', xml(caber(c.rotulo, 12.5, tw - 23 - 12 - reservaNumero)))}
<text x="${x + tw - 12}" y="${y + 24}" text-anchor="end" font-family="${FONTE}" font-size="17" font-weight="600" font-variant-numeric="tabular-nums"${corNumero}>${c.n}</text>`
    }
    const corPonto = viva ? `class="${c.classe ?? c.cor}"` : `fill="${NEUTRO}"`

    return `<rect class="tile" x="${x}" y="${y}" width="${tw}" height="${alturaBloco}" rx="10"/>
<circle ${corPonto} cx="${x + 15}" cy="${y + 19}" r="4.5"${viva ? '' : ' fill-opacity=".45"'}/>
${texto(x + 26, y + 23.5, 13, 's', xml(caber(c.rotulo, 13, tw - 32)))}
<text x="${x + 13}" y="${y + 51}" font-family="${FONTE}" font-size="24" font-weight="600" font-variant-numeric="tabular-nums"${corNumero}>${c.n}</text>`
  })
  const height = linhas * alturaBloco + (linhas - 1) * GAP_RESUMO

  return { height, source: svg(W, height, blocos.join('')) }
}

export function perguntaSvg(W: number, q: PerguntaAberta, citados: Citado[] = [], rotuloReco = 'Recomendo'): { source: string; height: number } {
  const pilula = largura(q.id, 13) + 18
  // Sem teto de linhas: o operador responde pelo card, e frase cortada não se responde (pedido de 23/10).
  const titulo = quebrar(q.titulo, 15, W - 32, Infinity)
  const caso = q.caso ? quebrar(q.caso, 13, W - 32, Infinity) : []
  const seNao = q.seNaoDecidir ? quebrar(`Se não decidir: ${q.seNaoDecidir}`, 13, W - 32, Infinity) : []
  const reco = q.recomendacao ? quebrar(`${rotuloReco}: ${q.recomendacao}`, 13, W - 32, Infinity) : []
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
    partes.push(texto(16, y, 13, AVISO, xml(l)))
    y += 18
  }
  if (citados.length > 0) {
    const topo = y - 6
    const c = citadosSvg(16, topo, W - 32, citados)
    partes.push(...c.partes)
    y = topo + c.altura + 13
  }
  const H = y

  return {
    height: H,
    source: svg(
      W,
      H,
      `<rect class="card" x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="10"/>
<rect class="${AVISO}" x="0" y="0" width="4" height="${H}" rx="2"/>
<rect class="${AVISO}" x="16" y="14" width="${pilula}" height="24" rx="12"/>
${texto(16 + pilula / 2, 30.5, 13, 'pt', xml(q.id), ` text-anchor="middle" font-weight="700"`)}
${texto(16 + pilula + 10, 30.5, 13, 's', xml(caber(q.rotulo ?? q.sessao, 13, W - pilula - 42)))}
${partes.join('')}`,
    ),
  }
}

const COR_DESFECHO: Record<string, { texto: string; traco: string }> = { respondida: { texto: OK, traco: 'oks' }, cancelada: { texto: 'm', traco: 'ms' } }

/** Uma pergunta já fechada, inteira: ID, pergunta, o que se recomendou e a resposta (pedido de 23/10). */
export function anteriorSvg(W: number, a: PerguntaAnterior, agora: number): { source: string; height: number; alt: string } {
  const cor = COR_DESFECHO[a.estado] ?? COR_DESFECHO.cancelada!
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
  for (const l of resposta) { partes.push(texto(pilula + 10, y, 13, cor.texto, xml(l), ` font-weight="600"`)); y += 18 }
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
<rect x="0.5" y="7" width="${pilula}" height="21" rx="10.5" fill="none" class="${cor.traco}"/>
${texto(pilula / 2, 22, 13, cor.texto, xml(a.id), ` text-anchor="middle" font-weight="700"`)}
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

/** 'sem-ninguem' é o código interno do mod: lê-se "sem ninguém", como no desenho aprovado. */
export function textoDaTrava(t: { motivo: string; texto: string }): string {
  return `Trava (${t.motivo === 'sem-ninguem' ? 'sem ninguém' : t.motivo}): ${t.texto}`
}

/** O ponto do item (§4.1): anda, trava ou espera na fila; o feito leva o círculo cheio do OK. */
function pontoDoItem(item: LinhaItem, cor: string): string {
  const cy = TOPO + 11
  if (item.situacao === 'travado')
    return `<circle class="es" cx="12" cy="${cy}" r="6.5" fill="none" stroke-width="2"/><path class="es" d="M12 ${cy - 3.2}v4" stroke-width="2" stroke-linecap="round"/><circle class="${ERRO}" cx="12" cy="${cy + 3.4}" r="1"/>`
  if (item.situacao === 'fila')
    return `<circle cx="12" cy="${cy}" r="5" fill="none" stroke="${NEUTRO}" stroke-width="1.3" stroke-dasharray="2 2"/>`
  if (item.situacao === 'feito') return `<circle class="${OK}" cx="12" cy="${cy}" r="6"/>`

  return `<circle class="vivo ${cor}" cx="12" cy="${cy}" r="6"/>`
}

/** Quebra em até duas linhas: a primeira cabe em `max1` (divide a linha com o tempo), a segunda em `max2`. */
function quebrarEmDuas(s: string, tam: number, max1: number, max2: number): string[] {
  // Palavra que sozinha passa da 1ª linha (sigla, nome com hífen) quebra depois do hífen ou da barra, em vez de no meio da letra.
  const pecas = s
    .split(/\s+/)
    .filter(Boolean)
    .flatMap(w => (largura(w, tam) > max1 ? w.split(/(?<=[-/_])/).map((t, i) => ({ t, colado: i > 0 })) : [{ t: w, colado: false }]))
  let primeira = ''
  let i = 0
  for (; i < pecas.length; i++) {
    const { t, colado } = pecas[i]!
    const tenta = primeira ? `${primeira}${colado ? '' : ' '}${t}` : t
    if (largura(tenta, tam) > max1 && primeira) break
    primeira = tenta
  }
  const resto = pecas.slice(i).reduce((acc, { t, colado }) => (acc ? `${acc}${colado ? '' : ' '}${t}` : t), '')

  return resto ? [caber(primeira, tam, max1), ...quebrar(resto, tam, max2, 1)] : [caber(primeira, tam, max1)]
}

type Trecho = { t: string; classe?: string; peso?: boolean }

/** Quem aparece na linha 2: os de `com` que seguem na lista; com `com` vazio, o dono, que sem ninguém já está na trava. */
export function quemDoItem(item: LinhaItem): Trecho[] {
  // O estado de antes desta versão (que sobrevive ao reload) não tem `com`.
  const com = item.com ?? []
  const vivos = com.filter(c => c.vivo !== false)
  if (vivos.length > 0) return vivos.map(c => ({ t: c.apelido, classe: 's' }))

  return item.dono && item.trava?.motivo !== 'sem-ninguem' ? [{ t: item.dono.apelido, classe: 's' }] : []
}

/** Quem saiu da lista: vai depois do PR, sem ponto do meio (que leria "saiu" como mais um nome). */
export function quemSaiu(item: LinhaItem): Trecho[] {
  return (item.com ?? []).filter(c => c.vivo === false).map(c => ({ t: `${c.apelido} saiu`, classe: 'm' }))
}

/** O dono que a linha 2 não escreveu porque o `com` ocupou o lugar: fica no alt, onde o plano o mantém. */
function donoForaDaLinha(item: LinhaItem): string | undefined {
  if (!item.dono || item.trava?.motivo === 'sem-ninguem') return undefined

  return quemDoItem(item).some(q => q.t === item.dono?.apelido) ? undefined : `dono ${item.dono.apelido}`
}

/** O texto da espera com o rótulo que a trava também tem: só o alt o leva, porque o selo da linha 2 já diz quem espera. */
export function textoDaEspera(e: { motivo: string; texto: string }): string {
  return `${e.motivo === 'gate' ? 'Espera o gate' : 'Espera você'}: ${e.texto}`
}

/** O selo da espera: o operador já tem o "aguarda você" da pergunta, e dois selos diriam a mesma coisa. */
export function seloDaEspera(item: LinhaItem): string | undefined {
  if (!item.espera || item.situacao === 'travado') return undefined
  if (item.espera.motivo === 'operador') return item.perguntas.length > 0 ? undefined : 'espera você'

  return 'espera o gate'
}

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
export function itemSvg(W: number, item: LinhaItem, agora: number, opcoes: { noTravados?: boolean; filete?: boolean } = {}): { source: string; height: number; alt: string } {
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
  const montar = (quem: Trecho[]): Trecho[] => [
    item.situacao === 'fila'
      ? { t: item.esperando?.entregue ? textoEsperando(item.esperando, agora) : `espera ${rotulo}${item.esperando ? textoEsperando(item.esperando, agora).replace(/^esperando \S+/, '') : ''}`, classe: 's', peso: true }
      : { t: rotulo, classe: cor, peso: true },
    ...(item.esperando && item.situacao !== 'fila' ? [{ t: textoEsperando(item.esperando, agora, item.dona === true), classe: 's', peso: true }] : []),
    ...(opcoes.noTravados ? [{ t: tituloDoTema(item), classe: 's' }] : []),
    ...(item.perguntas.length > 0 ? [{ t: `aguarda você · ${item.perguntas[0]}`, classe: AVISO, peso: true }] : []),
    ...(seloDaEspera(item) ? [{ t: seloDaEspera(item) as string, classe: item.espera?.motivo === 'operador' ? AVISO : 's', peso: true }] : []),
    // O dono sem ninguém já está escrito na trava: repetir faria dois textos sobre a mesma sessão que sumiu.
    ...quem,
    // O PR não se corta: ou entra inteiro, ou as pessoas encolhem antes ("E1 +1", o nome completo no alt).
    ...(ultimoPr ? [{ t: ultimoPr, classe: ANDA, peso: true }] : []),
    ...quemSaiu(item),
  ]
  const TAM = 13
  const larguraDe = (ts: Trecho[]) => ts.reduce((w, tr, k) => w + largura((k === 0 ? '' : ' · ') + tr.t, TAM), 0)
  const pessoas = quemDoItem(item)
  const encolhidas = pessoas.length > 1 ? [{ t: `${pessoas[0]!.t} +${pessoas.length - 1}`, classe: 's' }] : pessoas
  const trechos = larguraDe(montar(pessoas)) <= tw ? montar(pessoas) : montar(encolhidas)
  const linha2: string[] = []
  let usado = 0
  const sep = ' · '
  for (const [k, tr] of trechos.entries()) {
    const antes = k === 0 ? '' : sep
    const tam = TAM
    const sobra = tw - usado
    const completo = antes + tr.t
    const atrib = tr.classe ? ` class="${tr.classe}"` : ''
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

  const alt = [item.titulo, [item.situacao === 'fila' ? `espera ${rotulo}` : rotulo, opcoes.noTravados ? tituloDoTema(item) : undefined, item.perguntas[0] && `aguarda você · ${item.perguntas[0]}`, seloDaEspera(item), ...quemDoItem(item).map(q => q.t), ultimoPr, ...quemSaiu(item).map(q => q.t), donoForaDaLinha(item)].filter(Boolean).join(' · ')]
  if (item.trava) {
    const trava = quebrar(textoDaTrava(item.trava), 13, tw, 2)
    for (const l of trava) {
      y += 19
      partes.push(texto(30, y, 13, ERRO, xml(l)))
    }
    alt.push(textoDaTrava(item.trava))
  }
  if (item.espera && item.situacao !== 'travado') {
    for (const l of quebrar(item.espera.texto, 13, tw, 2)) {
      y += 19
      partes.push(texto(30, y, 13, item.espera?.motivo === 'operador' ? AVISO : 's', xml(l)))
    }
    alt.push(textoDaEspera(item.espera))
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
    const depois = `depois: ${item.depois[0]!.texto}${mais}`
    y += 19
    partes.push(texto(30, y, 13, 'm', xml(caber(depois, 13, tw))))
    alt.push(depois)
  }
  if (tempo) alt.push(tempo)
  const altura = y + BASE
  if (opcoes.filete !== false) partes.push(`<line class="ln" x1="0" y1="${altura - 0.5}" x2="${W}" y2="${altura - 0.5}"/>`)

  return { height: altura, alt: alt.join(' — '), source: svg(W, altura, partes.join('')) }
}

/** O filete que fecha o item, para quando os botões "abrir" vêm depois do desenho e ficam dentro dele. */
export function fileteSvg(W: number): { source: string; height: number } {
  return { height: 1, source: svg(W, 1, '<line class="ln" x1="0" y1="0.5" x2="' + W + '" y2="0.5"/>') }
}

/** O papel pela 1ª letra do apelido (P1, E3, V4, D1, O…): qualquer outra letra não diz papel. */
export function papelDe(apelido: string): 'planejadora' | 'executora' | 'validadora' | 'designer' | 'orquestradora' | 'dona' | undefined {
  if (apelido.trim().toLowerCase() === 'dona') return 'dona'
  const letra = apelido.trim().charAt(0).toUpperCase()

  return ({ P: 'planejadora', E: 'executora', V: 'validadora', D: 'designer', O: 'orquestradora' } as const)[letra as 'P']
}

// ---- F34: o desenho em cartões (a moldura é o `Box` da composição; aqui só o conteúdo) ----

/** A cor do traço para cada classe de cor de texto: o filete tracejado e o contorno do chip precisam de `stroke`. */
const TRACO: Record<string, string> = { av: 'avs', an: 'ans', er: 'es', ok: 'oks', m: 'ms' }

export type FaixaDeSecao = { titulo: string; n: number; tom: string; legenda?: string; tracejado?: boolean }
export const ALTURA_SECAO = 28

/** A faixa que abre cada seção: filete na cor, título, contagem em pílula e uma legenda curta que some quando não cabe. */
export function secaoSvg(W: number, f: FaixaDeSecao): { source: string; height: number; alt: string } {
  const pilula = largura(String(f.n), 12) + 14
  const xPilula = 14 + largura(f.titulo, 15) + 8
  const fim = xPilula + pilula
  const legenda = f.legenda && fim + 12 + largura(f.legenda, 12) <= W ? f.legenda : undefined
  const filete = f.tracejado
    ? `<line class="${TRACO[f.tom] ?? 'ms'}" x1="1.5" y1="4" x2="1.5" y2="24" stroke-width="3" stroke-dasharray="3 3"/>`
    : `<rect class="${f.tom}" x="0" y="4" width="3" height="20" rx="1.5"/>`

  return {
    height: ALTURA_SECAO,
    alt: [f.titulo, String(f.n), legenda].filter(Boolean).join(' · '),
    source: svg(
      W,
      ALTURA_SECAO,
      `${filete}
${texto(14, 19.5, 15, 't', xml(f.titulo), ' font-weight="600"')}
<rect class="${f.tom}" x="${xPilula}" y="5" width="${pilula}" height="18" rx="9"/>
${texto(xPilula + pilula / 2, 18, 12, 'pt', String(f.n), ' text-anchor="middle" font-weight="700" font-variant-numeric="tabular-nums"')}
${legenda ? texto(W, 18.5, 12, 'm', xml(legenda), ' text-anchor="end"') : ''}`,
    ),
  }
}

const ALTURA_CHIP = 20
const GAP_CHIP = 6
type Chip = { t: string; texto: string; fundo?: string; traco?: string; tracejado?: boolean; peso?: boolean }

/** Os chips em linha, de `x0`; o que não cabe quebra para a linha de baixo, e um chip sozinho maior que a linha é cortado. */
function chipsSvg(x0: number, y0: number, larguraLinha: number, chips: Chip[]): { partes: string[]; altura: number } {
  const partes: string[] = []
  let x = x0
  let y = y0
  for (const c of chips) {
    const texto12 = caber(c.t, 12, larguraLinha - 16)
    const w = largura(texto12, 12) + 16
    if (x > x0 && x + w > x0 + larguraLinha) {
      x = x0
      y += ALTURA_CHIP + GAP_CHIP
    }
    const aparencia = c.fundo
      ? ` class="${c.fundo}"`
      : ` fill="none" class="${c.traco ?? 'ms'}" stroke-width="1.2"${c.tracejado ? ' stroke-dasharray="3 2"' : ''}`
    partes.push(`<rect${aparencia} x="${x + 0.6}" y="${y + 0.6}" width="${w - 1.2}" height="${ALTURA_CHIP - 1.2}" rx="${ALTURA_CHIP / 2 - 0.6}"/>`)
    partes.push(texto(x + w / 2, y + 14, 12, c.texto, xml(texto12), ` text-anchor="middle"${c.peso === false ? '' : ' font-weight="600"'}`))
    x += w + GAP_CHIP
  }

  return { partes, altura: chips.length > 0 ? y - y0 + ALTURA_CHIP : 0 }
}

const chipDoPr = (item: LinhaItem): Chip[] => {
  if (item.prs.length === 0) return []
  const ultimo = item.prs[item.prs.length - 1]

  return [{ t: `#${ultimo}${item.prs.length > 1 ? ` +${item.prs.length - 1}` : ''}`, texto: ANDA, traco: 'ans' }]
}

/** O `Chip` tem a classe do texto em `texto`; a pílula da etapa leva o fundo `tile`, onde as quatro cores de etapa passam de 4,5:1. */
const chipDaEtapa = (item: LinhaItem): Chip => ({ t: ROTULO_ETAPA[item.etapa] ?? item.etapa, texto: COR_ETAPA[item.etapa] ?? 's', fundo: 'tile' })

/** `esperando E · 35 min`; quando o papel já entregou, `entregue · avance a etapa · 15 min` (F58). Os minutos saem de `desde` e da hora do desenho. */
export const textoEsperando = (e: NonNullable<LinhaItem['esperando']>, agora: number, dona = false): string => {
  const min = Math.max(0, Math.floor((agora - Date.parse(e.desde)) / 60000))
  // ADR 0011: no item da dona o que falta é a sessão dona, não o papel da etapa.
  if (dona) return `sem dona · ${min} min`

  return e.entregue ? `entregue · avance a etapa · ${min} min` : `esperando ${e.papel} · ${min} min`
}

const upper = (s: string): string => s.toLocaleUpperCase('pt-BR')

type Pessoa = { apelido: string; localId: string }
/** As sessões que trabalham no item e seguem vivas; sem `com`, o dono, que sem ninguém já está na trava. */
function pessoasDoItem(item: LinhaItem): Pessoa[] {
  const vivos = (item.com ?? []).filter(c => c.vivo !== false)
  if (vivos.length > 0) return vivos.map(c => ({ apelido: c.apelido, localId: c.localId }))

  return item.dono && item.trava?.motivo !== 'sem-ninguem' ? [{ apelido: item.dono.apelido, localId: item.dono.localId }] : []
}

export const MAX_LINHAS_QUEM = 3

export type OpcoesDoCartao = {
  /** Os F<n> citados nos textos do cartão, já resolvidos (`citadosDe`); sem eles, a linha "Citados" não aparece. */
  citados?: Citado[]
  /** O que a sessão faz agora ("trabalhando agora", "parada há X", "sem leitura da sessão"); `undefined` é a sessão fora da lista. */
  situacao: (localId: string) => string | undefined
}

/** A linha "quem": o selo do apelido (com o ponto vivo se trabalha agora), o papel por extenso e a situação da sessão. */
function linhaQuem(y: number, p: Pessoa, situacao: string | undefined, W: number): { svg: string; alt: string } {
  const apelido = p.apelido
  const selo = largura(apelido, 11.5) + 18
  const encerrada = situacao === undefined
  const papel = papelDe(apelido)
  const vivo = situacao === 'trabalhando agora'
  const dito = encerrada ? 'sessão encerrada' : situacao
  const xTexto = selo + 8
  const disponivel = W - xTexto
  const cabeca = papel ? `${papel} · ${dito}` : dito
  const corte = caber(cabeca, 12.5, disponivel)
  const corpo = papel && corte === cabeca
    ? `<tspan class="t" font-weight="600">${xml(papel)}</tspan><tspan class="${encerrada ? 'm' : 's'}">${xml(` · ${dito}`)}</tspan>`
    : `<tspan class="${encerrada ? 'm' : 's'}">${xml(corte)}</tspan>`

  return {
    alt: `${apelido}${papel ? `, ${papel}` : ''}, ${dito}`,
    svg: `<rect class="k" x="0" y="${y}" width="${selo}" height="22" rx="6"/>
${texto(selo / 2, y + 15, 11.5, 't', xml(apelido), ' text-anchor="middle" font-weight="700"')}
${vivo ? `<circle class="vivo ${ANDA}" cx="${selo - 2}" cy="${y + 2}" r="3.5"/>` : ''}
<text x="${xTexto}" y="${y + 15}" font-family="${FONTE}" font-size="12.5">${corpo}</text>`,
  }
}

/**
 * O cartão do item em sessão (§1 do desenho): sobre (tema e tempo), título, chips, trava, espera, quem, agora e depois.
 * Sem fundo e sem filete: a moldura é o `Box round` da composição, com a borda na cor do tom, e os botões ficam dentro dela.
 */
export function cartaoSvg(W: number, item: LinhaItem, agora: number, opcoes: OpcoesDoCartao): { source: string; height: number; alt: string } {
  const partes: string[] = []
  const tempo = tempoDoItem(item, agora)
  const tempoW = tempo ? largura(tempo, 12) + 10 : 0
  partes.push(sobreSvg(0, 11, W - tempoW, item))
  if (tempo) partes.push(texto(W, 11.5, 12, 'm', xml(tempo), ' text-anchor="end" font-variant-numeric="tabular-nums"'))

  let y = 11
  const titulo = quebrarEmDuas(item.titulo, 15, W, W)
  for (const l of titulo) {
    y += 20
    partes.push(texto(0, y, 15, 't', xml(l), ' font-weight="600"'))
  }

  const chips: Chip[] = [chipDaEtapa(item)]
  if (item.esperando) chips.push({ t: textoEsperando(item.esperando, agora, item.dona === true), texto: 's', traco: 'ms' })
  if (item.perguntas.length > 0) chips.push({ t: `aguarda você · ${item.perguntas[0]}`, texto: 'pt', fundo: AVISO })
  const selo = seloDaEspera(item)
  if (selo && item.espera?.motivo === 'gate') chips.push({ t: selo, texto: 's', traco: 'ms' })
  chips.push(...chipDoPr(item))
  const linhaDeChips = chipsSvg(0, y + 9, W, chips)
  partes.push(...linhaDeChips.partes)
  y += 9 + linhaDeChips.altura

  const alt = [`${item.id} · ${tituloDoTema(item)}`, item.titulo, chips.map(c => c.t).join(' · ')]

  if (item.trava) {
    const sem = item.trava.motivo === 'sem-ninguem'
    const rotulo = sem ? 'Sem ninguém' : item.trava.motivo.charAt(0).toUpperCase() + item.trava.motivo.slice(1)
    const linhas = quebrar(`${rotulo}: ${item.trava.texto}`, 12.5, W - 20, 3)
    const extra = sem ? ['Peça outra sessão à orquestradora.'] : []
    const todas = [...linhas, ...extra]
    const alturaBloco = 16 + todas.length * 17 - 3
    const topo = y + 9
    partes.push(`<rect class="et" x="0" y="${topo}" width="${W}" height="${alturaBloco}" rx="8"/>`)
    todas.forEach((l, k) => {
      const base = topo + 8 + 13 + k * 17
      if (k === 0 && l.startsWith(`${rotulo}:`)) {
        partes.push(`<text x="10" y="${base}" font-family="${FONTE}" font-size="12.5"><tspan class="${ERRO}" font-weight="700">${xml(`${rotulo}:`)}</tspan><tspan class="${ERRO}">${xml(l.slice(rotulo.length + 1))}</tspan></text>`)
      } else partes.push(texto(10, base, 12.5, ERRO, xml(l)))
    })
    y = topo + alturaBloco
    alt.push(`${rotulo}: ${item.trava.texto}${extra.length > 0 ? ` ${extra[0]}` : ''}`)
  }

  if (item.espera && item.situacao !== 'travado') {
    const classe = item.espera.motivo === 'operador' ? AVISO : 's'
    y += 6
    for (const l of quebrar(item.espera.texto, 12.5, W, 2)) {
      y += 17
      partes.push(texto(0, y, 12.5, classe, xml(l)))
    }
    alt.push(textoDaEspera(item.espera))
  }

  const pessoas = pessoasDoItem(item)
  const mostradas = pessoas.slice(0, MAX_LINHAS_QUEM)
  for (const p of mostradas) {
    y += 8
    const linha = linhaQuem(y, p, opcoes.situacao(p.localId), W)
    partes.push(linha.svg)
    alt.push(linha.alt)
    y += 22
  }
  if (pessoas.length > mostradas.length) {
    y += 15
    partes.push(texto(0, y, 12, 'm', `+${pessoas.length - mostradas.length}`))
    alt.push(`+${pessoas.length - mostradas.length}`)
  }
  const saiu = quemSaiu(item).map(q => q.t)
  if (saiu.length > 0) {
    y += 16
    partes.push(texto(0, y, 12, 'm', xml(caber(saiu.join(', '), 12, W))))
    alt.push(...saiu)
  }

  if (item.agora) {
    y += 6
    for (const l of quebrar(item.agora, 12.5, W, 2)) {
      y += 17
      partes.push(texto(0, y, 12.5, 's', xml(l)))
    }
    alt.push(item.agora)
  }
  if (item.depois.length > 0) {
    const mais = item.depois.length > 1 ? ` (+${item.depois.length - 1})` : ''
    const ligado = item.depois[0]!.item
    const depois = `depois: ${item.depois[0]!.texto}${mais}`
    y += 17
    partes.push(depoisSvg(0, y, W, depois, ligado))
    alt.push(ligado ? `${depois} → ${ligado}` : depois)
  }
  if (opcoes.citados && opcoes.citados.length > 0) {
    const c = citadosSvg(0, y + 6, W, opcoes.citados)
    partes.push(...c.partes)
    y = y + 6 + c.altura - 5
    alt.push(altDosCitados(opcoes.citados))
  }
  if (tempo) alt.push(tempo)
  const altura = y + 6

  return { height: altura, alt: alt.join(' — '), source: svg(W, altura, partes.join('')) }
}

const X_FILA = 22

/** A linha da fila (§3): anel tracejado, tema e "parado há", título, resumo, chips; sem botão, porque não há sessão. */
export function filaSvg(W: number, item: LinhaItem, agora: number, opcoes: { citados?: Citado[]; filete?: boolean } = {}): { source: string; height: number; alt: string } {
  const tw = W - X_FILA
  const tempo = tempoDoItem(item, agora)
  const tempoW = tempo ? largura(tempo, 12) + 10 : 0
  const partes: string[] = [
    `<circle cx="9" cy="9" r="5" fill="none" stroke="${NEUTRO}" stroke-width="1.3" stroke-dasharray="2 2"/>`,
    sobreSvg(X_FILA, 11, tw - tempoW, item),
  ]
  if (tempo) partes.push(texto(W, 11.5, 12, 'm', xml(tempo), ' text-anchor="end" font-variant-numeric="tabular-nums"'))

  let y = 11
  const titulo = quebrarEmDuas(item.titulo, 14, tw, tw)
  for (const l of titulo) {
    y += 19
    partes.push(texto(X_FILA, y, 14, 't', xml(l), ' font-weight="600"'))
  }
  const alt = [`${item.id} · ${tituloDoTema(item)}`, item.titulo]
  if (item.resumo) {
    y += 3
    for (const l of quebrar(item.resumo, 12.5, tw, 2)) {
      y += 17
      partes.push(texto(X_FILA, y, 12.5, 's', xml(l)))
    }
    alt.push(item.resumo)
  }
  const minutosNaFila = item.esperando ? ` · ${Math.max(0, Math.floor((agora - Date.parse(item.esperando.desde)) / 60000))} min` : ''
  const chips: Chip[] = [{ t: item.esperando?.entregue ? textoEsperando(item.esperando, agora) : `espera ${ROTULO_ETAPA[item.etapa] ?? item.etapa}${minutosNaFila}`, texto: 's', traco: 'ms', tracejado: true }, ...chipDoPr(item)]
  const linhaDeChips = chipsSvg(X_FILA, y + 8, tw, chips)
  partes.push(...linhaDeChips.partes)
  y += 8 + linhaDeChips.altura
  alt.push(chips.map(c => c.t).join(' · '))
  if (opcoes.citados && opcoes.citados.length > 0) {
    const c = citadosSvg(X_FILA, y + 6, tw, opcoes.citados)
    partes.push(...c.partes)
    y = y + 6 + c.altura
    alt.push(altDosCitados(opcoes.citados))
  }
  if (tempo) alt.push(tempo)
  const altura = y + 10
  if (opcoes.filete !== false) partes.push(`<line class="ln" x1="0" y1="${altura - 0.5}" x2="${W}" y2="${altura - 0.5}"/>`)

  return { height: altura, alt: alt.join(' — '), source: svg(W, altura, partes.join('')) }
}

/** Um cartão de sessão nova como o pane o desenha: o apelido, o que a sessão vai fazer (os itens, com o título quando se sabe) e quando foi proposto. */
export type LinhaDeCartao = { apelido: string; itens: Array<{ id: string; titulo?: string }>; propostoEm: string }

/** `Manter uma executora livre` quando o cartão não tem item (o piso de E); senão o título do primeiro item, ou o número dele. */
export function paraQueDoCartao(c: LinhaDeCartao): string {
  const primeiro = c.itens[0]
  if (primeiro) return primeiro.titulo ?? primeiro.id

  return `Manter uma ${papelDe(c.apelido) ?? 'sessão'} livre`
}

/**
 * A linha de "Sessões para abrir": anel tracejado âmbar (sessão que ainda não existe e espera você), `E21 · EXECUTORA` e há quanto
 * tempo, para quê em até duas linhas e `+ N itens` quando o cartão tem mais de um. Um lembrete de clique, mais leve que o cartão de item.
 */
export function sessaoParaAbrirSvg(W: number, c: LinhaDeCartao, agora: number, opcoes: { filete?: boolean } = {}): { source: string; height: number; alt: string } {
  const tw = W - X_FILA
  const tempo = desde(c.propostoEm, agora)
  const tempoW = tempo ? largura(tempo, 12) + 10 : 0
  const papel = papelDe(c.apelido)
  const prefixo = papel ? ` · ${upper(papel)}` : ''
  // cartão de dona: o rótulo é o item (`F140 · DONA`), porque a sessão aberta se chama `F<n> · <tema>`
  const rotulo = papel === 'dona' && c.itens[0] ? c.itens[0].id : c.apelido
  const reserva = largura(rotulo, 11) * 1.1
  const resto = caber(prefixo, 11, Math.max(0, tw - tempoW - reserva))
  const partes: string[] = [
    `<circle cx="9" cy="9" r="5" fill="none" class="avs" stroke-width="1.3" stroke-dasharray="2 2"/>`,
    `<text x="${X_FILA}" y="11" font-family="${FONTE}" font-size="11" font-variant-numeric="tabular-nums"><tspan class="t" font-weight="700">${xml(rotulo)}</tspan><tspan class="m" font-weight="600">${xml(resto)}</tspan></text>`,
  ]
  if (tempo) partes.push(texto(W, 11.5, 12, 'm', xml(tempo), ' text-anchor="end" font-variant-numeric="tabular-nums"'))
  let y = 11
  const paraQue = paraQueDoCartao(c)
  for (const l of quebrarEmDuas(paraQue, 14, tw, tw)) {
    y += 19
    partes.push(texto(X_FILA, y, 14, 't', xml(l), ' font-weight="600"'))
  }
  const alt = [`${rotulo}, ${papel ?? 'sessão'}, proposta ${tempo ?? 'agora há pouco'}`, c.itens.length > 0 ? `para: ${c.itens.map(i => (i.titulo ? `${i.id} · ${i.titulo}` : i.id)).join('; ')}` : paraQue]
  if (c.itens.length > 1) {
    y += 17
    partes.push(texto(X_FILA, y, 12.5, 's', `+ ${c.itens.length - 1} ${c.itens.length === 2 ? 'item' : 'itens'}`))
  }
  const altura = y + 10
  if (opcoes.filete !== false) partes.push(`<line class="ln" x1="0" y1="${altura - 0.5}" x2="${W}" y2="${altura - 0.5}"/>`)

  return { height: altura, alt: alt.join(' — '), source: svg(W, altura, partes.join('')) }
}

/** A frase do grupo de cartões (uma por orquestradora), em até duas linhas; `erro` pinta de `er` (a orquestradora não está aberta). */
export function fraseDoGrupoSvg(W: number, frase: string, erro = false): { source: string; height: number; alt: string } {
  const linhas = quebrar(frase, 12.5, W - X_FILA, 2)
  const partes = linhas.map((l, i) => texto(X_FILA, 14 + i * 17, 12.5, erro ? 'er' : 's', xml(l)))
  const altura = 14 + (linhas.length - 1) * 17 + 6

  return { height: altura, alt: frase, source: svg(W, altura, partes.join('')) }
}

/** `F13 · TEMA`: o número em `t` 11/700, nunca cortado (o corte vale só para o tema); o tempo à direita já está fora de `max`. */
function sobreSvg(x: number, y: number, max: number, item: { id: string; temaRotulo: string; projeto?: string }): string {
  const prefixo = ' · '
  const reserva = largura(item.id, 11) * 1.1 + largura(prefixo, 11)
  const tema = caber(upper(tituloDoTema(item)), 11, Math.max(0, max - reserva))

  return `<text x="${x}" y="${y}" font-family="${FONTE}" font-size="11" font-variant-numeric="tabular-nums"><tspan class="t" font-weight="700">${xml(item.id)}</tspan><tspan class="m" font-weight="600">${xml(prefixo + tema)}</tspan></text>`
}

/** A linha `depois:`; quando o primeiro `depois` liga um item, termina em ` → F3` e o corte come o texto, nunca o número. */
function depoisSvg(x: number, y: number, max: number, depois: string, ligado: string | undefined): string {
  if (!ligado) return texto(x, y, 12, 'm', xml(caber(depois, 12, max)))
  const seta = ` → ${ligado}`
  const corte = caber(depois, 12, Math.max(0, max - largura(seta, 12) * 1.1))

  return `<text x="${x}" y="${y}" font-family="${FONTE}" font-size="12"><tspan class="m">${xml(corte)}</tspan><tspan class="s" font-weight="700" font-variant-numeric="tabular-nums">${xml(seta)}</tspan></text>`
}

const COLUNA_CITADOS = 52
const LINHA_CITADOS = 17

/** As linhas do que se desenha: até 3 com título; com 4 ou mais, as 2 primeiras e uma linha "também F7, F9". */
function linhasDosCitados(citados: Citado[]): Array<Citado | string> {
  return citados.length >= 4 ? [citados[0]!, citados[1]!, `também ${citados.slice(2).map(c => c.id).join(', ')}`] : citados
}

/** O que o leitor de tela lê da legenda: tudo, inclusive os números que o desenho resume em "também". */
export function altDosCitados(citados: Citado[]): string {
  return `${citados.length === 1 ? 'Citado' : 'Citados'}: ${citados.map(c => (c.titulo === undefined ? `${c.id} · fora da fila` : `${c.id} · ${c.titulo}`)).join('; ')}`
}

/** A legenda "Citados" sob o bloco: rótulo pendurado numa coluna de 52 px e uma linha por número (§2 do desenho). */
export function citadosSvg(x0: number, yTopo: number, larguraLinha: number, citados: Citado[]): { partes: string[]; altura: number } {
  if (citados.length === 0) return { partes: [], altura: 0 }
  const linhas = linhasDosCitados(citados)
  const tw = Math.max(0, larguraLinha - COLUNA_CITADOS)
  const partes: string[] = [texto(x0, yTopo + 12, 12, 'm', citados.length === 1 ? 'Citado' : 'Citados', ' font-weight="600"')]
  linhas.forEach((l, k) => {
    const y = yTopo + 12 + k * LINHA_CITADOS
    const x = x0 + COLUNA_CITADOS
    if (typeof l === 'string') {
      partes.push(texto(x, y, 12, 'm', xml(caber(l, 12, tw))))

      return
    }
    const cabeca = `${l.id} · `
    const resto = l.titulo === undefined ? 'fora da fila' : caber(l.titulo, 12, Math.max(0, tw - largura(cabeca, 12) * 1.1))
    partes.push(
      `<text x="${x}" y="${y}" font-family="${FONTE}" font-size="12"><tspan class="s" font-weight="700" font-variant-numeric="tabular-nums">${xml(l.id)}</tspan><tspan class="m"${l.titulo === undefined ? ' font-style="italic"' : ''}>${xml(` · ${resto}`)}</tspan></text>`,
    )
  })

  return { partes, altura: linhas.length * LINHA_CITADOS }
}

export type GrupoDoIndice = { id: string; rotulo: string; projeto?: string; itens: ItemDoIndice[] }
const LINHA_TODOS = 22
const COLUNA_NUMERO = 40

/** Um tema da lista de todos os itens: cabeçalho (com o projeto à direita quando há mais de um) e uma linha de 22 px por item. */
export function todosSvg(W: number, grupo: GrupoDoIndice, opcoes: { comProjeto: boolean }): { source: string; height: number; alt: string } {
  const projeto = opcoes.comProjeto ? (grupo.projeto ?? grupo.itens[0]?.projeto) : undefined
  const partes: string[] = [texto(0, 14, 11, 'm', xml(caber(upper(grupo.rotulo), 11, W - (projeto ? largura(projeto, 11) + 16 : 0))), ' font-weight="600"')]
  if (projeto) partes.push(texto(W, 14, 11, 'm', xml(caber(projeto, 11, W / 2)), ' text-anchor="end"'))
  grupo.itens.forEach((i, k) => {
    const y = 14 + LINHA_TODOS * (k + 1)
    const vivo = i.etapa !== 'feito' && i.etapa !== 'descartado'
    const etapa = ROTULO_ETAPA[i.etapa] ?? i.etapa
    const etapaW = largura(etapa, 11.5)
    partes.push(texto(0, y, 12.5, vivo ? 's' : 'm', xml(i.id), ' font-weight="700" font-variant-numeric="tabular-nums"'))
    partes.push(texto(COLUNA_NUMERO, y, 12.5, vivo ? 't' : 'm', xml(caber(i.titulo, 12.5, W - COLUNA_NUMERO - etapaW - 10))))
    partes.push(texto(W, y, 11.5, vivo ? (COR_ETAPA[i.etapa] ?? 'm') : 'm', xml(etapa), ' text-anchor="end"'))
  })
  const altura = 14 + LINHA_TODOS * grupo.itens.length + 10
  partes.push(`<line class="ln" x1="0" y1="${altura - 0.5}" x2="${W}" y2="${altura - 0.5}"/>`)

  return {
    height: altura,
    alt: `${grupo.rotulo}${projeto ? ` · ${projeto}` : ''}: ${grupo.itens.map(i => `${i.id} · ${i.titulo} · ${ROTULO_ETAPA[i.etapa] ?? i.etapa}`).join('; ')}`,
    source: svg(W, altura, partes.join('')),
  }
}

export type Faixa = { titulo: string; detalhe?: string; tom: 'er' | 'av' }

/** A faixa tingida (erro de leitura, aviso de resposta não entregue): o texto inteiro, porque o botão vem logo abaixo, fora dela. */
export function faixaSvg(W: number, f: Faixa): { source: string; height: number; alt: string } {
  const erro = f.tom === 'er'
  const cor = erro ? ERRO : AVISO
  const linhas = f.detalhe ? quebrar(f.detalhe, 12.5, W - 24, Infinity) : []
  const partes: string[] = [texto(12, 24, 13, cor, xml(caber(f.titulo, 13, W - 24)), ' font-weight="700"')]
  let y = 24
  for (const l of linhas) {
    y += 17
    partes.push(texto(12, y, 12.5, cor, xml(l)))
  }
  const altura = y + 12

  return {
    height: altura,
    alt: [f.titulo, f.detalhe].filter(Boolean).join(' — '),
    source: svg(W, altura, `<rect class="${erro ? 'et' : 'card'}" x=".5" y=".5" width="${W - 1}" height="${altura - 1}" rx="8"/>${partes.join('')}`),
  }
}

const dois_ = (n: number) => String(n).padStart(2, '0')

/** "desde": a hora local `HH:MM` quando é hoje, `ontem HH:MM`, ou `DD/MM HH:MM` antes disso. */
function desdeEscrito(iso: string, agora: number): string {
  const d = new Date(iso)
  const hm = `${dois_(d.getHours())}:${dois_(d.getMinutes())}`
  const dia = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const dias = Math.round((dia(new Date(agora)) - dia(d)) / 86_400_000)
  if (dias <= 0) return hm

  return dias === 1 ? `ontem ${hm}` : `${dois_(d.getDate())}/${dois_(d.getMonth() + 1)} ${hm}`
}

/**
 * Há quanto tempo e desde quando o modo está ligado. `desde` no futuro (relógio torto) ou menos de 1 min: `agora`; o `desde()` dos
 * cartões não muda, a troca fica aqui.
 */
export function modoDescrito(iso: string | undefined, agora: number): { ha: string; quando?: string } {
  const t = iso ? Date.parse(iso) : NaN

  return {
    ha: Number.isNaN(t) || t > agora + 60_000 ? 'agora' : (desde(iso, agora) ?? 'agora'),
    quando: Number.isNaN(t) ? undefined : desdeEscrito(iso as string, agora),
  }
}

/**
 * A faixa do modo ausente: contorno lilás de 1,5 px, sem fundo, três linhas (o que o modo é, desde quando e o que libera,
 * o que trava). A frase do meio quebra no " · " quando não cabe, nunca no meio nem cortada. O `Svg` leva 4 px de respiro em cima.
 */
export function modoSvg(W: number, o: { modo: 'ausente'; desde?: string; agora: number }): { source: string; height: number; alt: string } {
  const { ha, quando } = modoDescrito(o.desde, o.agora)
  const titulo = `Ausente ${ha}`
  const util = W - 24
  const frase = 'a orquestradora pode se limpar'
  const linhaDesde = quando ? `desde ${quando} · ${frase}` : frase
  const meio = largura(linhaDesde, 12) <= util || !quando ? [linhaDesde] : [`desde ${quando} ·`, frase]
  const linhas = [...meio, 'sessões novas só abrem com você']
  const altura = 24 + 16 * linhas.length + 10
  const partes = [`<text x="12" y="24" font-family="${FONTE}" font-size="13" font-weight="700"><tspan class="${LILAS}">☾</tspan><tspan class="t"> ${xml(titulo)}</tspan></text>`]
  linhas.forEach((l, k) => partes.push(texto(12, 40 + 16 * k, 12, 's', xml(l))))

  return {
    height: altura,
    alt: `Modo ausente ${ha}${quando ? `, desde ${quando}` : ''}: a orquestradora pode se limpar sozinha, e sessão nova só abre num turno seu.`,
    source: svg(W, altura, `<rect class="lis" fill="none" stroke-width="1.5" x=".75" y="4.75" width="${W - 1.5}" height="${altura - 5.5}" rx="8"/>${partes.join('')}`),
  }
}

/** A palavra estreita da fileira: `Presente`, ou `Modo não lido (vale presente)` (em itálico) quando o arquivo não se leu. */
export function rotuloModoSvg(modo: 'presente' | 'desconhecido'): { source: string; alt: string; width: number } {
  const dito = modo === 'presente' ? 'Presente' : 'Modo não lido (vale presente)'
  const width = Math.ceil(largura(dito, 12.5) * 1.1) + 4
  const extra = ` font-weight="600"${modo === 'desconhecido' ? ' font-style="italic"' : ''}`

  return {
    width,
    alt: modo === 'presente' ? 'Modo presente.' : 'Não consegui ler o modo ausente; para as travas, vale presente.',
    source: svg(width, 20, texto(0, 14, 12.5, modo === 'presente' ? 's' : 'm', xml(dito), extra)),
  }
}

/** A linha `⚠ Parou há 7 min`, em vermelho, de 20 px. */
export function parouSvg(W: number, dito: string): { source: string; height: number; alt: string } {
  return { height: 20, alt: dito, source: svg(W, 20, texto(0, 14, 12, ERRO, xml(caber(dito, 12, W)))) }
}

// ---- o reinício do app (F152): a linha do topo do pane sem aviso e o bloco emoldurado com o aviso ligado ----

export type ReinicioDesenhado = {
  estado: 'pode' | 'espere' | 'conferindo' | 'sem-dado'
  rodando: number
  motivos: Array<{ tipo: 'sessao' | 'teste' | 'merge'; texto: string }>
  conferidoEm: number | null
  razao?: string
  /** O aviso ligado (`avisadoEm` = quando a notificação saiu); `null` = a linha discreta, sem moldura. */
  aviso: { avisadoEm?: string } | null
}

/** Quantos motivos o bloco lista antes do `+ N mais`. */
export const MOTIVOS_NO_BLOCO = 4

const hhmm_ = (ms: number): string => {
  const d = new Date(ms)

  return `${dois_(d.getHours())}:${dois_(d.getMinutes())}`
}

/** A contagem por tipo, na ordem sessão, teste, merge; tipo com zero não aparece: `4 sessões trabalhando, 1 teste`. */
export function contagemDoReinicio(motivos: Array<{ tipo: string }>): string {
  const n = (t: string) => motivos.filter(m => m.tipo === t).length
  const nome = (k: number, um: string, varios: string) => `${k} ${k === 1 ? um : varios}`

  return [
    n('sessao') > 0 ? nome(n('sessao'), 'sessão trabalhando', 'sessões trabalhando') : '',
    n('teste') > 0 ? nome(n('teste'), 'teste', 'testes') : '',
    n('merge') > 0 ? nome(n('merge'), 'merge', 'merges') : '',
  ]
    .filter(Boolean)
    .join(', ')
}

const conferido = (ms: number | null): string => (ms === null ? 'sem conferência' : `conferido às ${hhmm_(ms)}`)

/**
 * O reinício no topo do pane. Sem aviso: UMA linha de 20 px (a frase da resposta; o botão `Me avise` é um `Button` ao lado, fora do
 * SVG, e `W` já desconta o botão). Com aviso: o bloco emoldurado do modo ausente (`rx 8`, traço 1,5, título 13 px, linhas 12 px):
 * `ans` (azul, em curso) esperando, `oks` (verde) podendo, `ms` (cinza) conferindo ou sem dado. O `alt` lê todos os motivos, inteiros.
 */
export function reinicioSvg(W: number, r: ReinicioDesenhado): { source: string; height: number; alt: string } {
  const util = W - 24
  const porTipo = contagemDoReinicio(r.motivos)
  if (r.aviso === null) {
    const glifo = (c: string) => `<tspan class="${c}">⏻</tspan>`
    if (r.estado === 'pode') {
      const resto = r.conferidoEm === null ? '' : ` · conferido às ${hhmm_(r.conferidoEm)}`
      const frase = caber('Pode reiniciar o app', 12.5, Math.max(40, W - largura(resto, 12.5) - 18))

      return {
        height: 20,
        alt: `Pode reiniciar o app, ${conferido(r.conferidoEm)}.`,
        source: svg(W, 20, `<text x="0" y="14" font-family="${FONTE}" font-size="12.5">${glifo(OK)}<tspan class="${OK}" font-weight="600"> ${xml(frase)}</tspan><tspan class="m">${xml(resto)}</tspan></text>`),
      }
    }
    const espere = r.estado === 'espere'
    const dito = espere ? `Reiniciar: espere · ${r.rodando} rodando` : 'Reiniciar: não sei'

    return {
      height: 20,
      alt: espere ? `Reiniciar o app: espere, ${r.rodando} rodando — ${porTipo}.` : `Reiniciar o app: não sei — ${r.razao ?? 'ainda não conferi'}.`,
      source: svg(W, 20, `<text x="0" y="14" font-family="${FONTE}" font-size="12.5">${glifo('m')}<tspan class="s" font-weight="600"> ${xml(caber(dito, 12.5, W - 18))}</tspan></text>`),
    }
  }

  const ligado = 'aviso ligado'
  let titulo: string
  let classe: string
  let moldura: string
  let linhas: string[]
  let alt: string
  if (r.estado === 'espere') {
    const visiveis = r.motivos.slice(0, MOTIVOS_NO_BLOCO)
    const mais = r.motivos.length - visiveis.length
    titulo = `Espere · ${r.rodando} rodando`
    classe = 't'
    moldura = 'ans'
    linhas = [...visiveis.map(m => `· ${m.texto}`), `${mais > 0 ? `+ ${mais} mais · ` : ''}${conferido(r.conferidoEm)} · ${ligado}`]
    alt = `Aviso de reinício ligado: ${r.rodando} rodando — ${r.motivos.map(m => m.texto).join('; ')}; ${conferido(r.conferidoEm)}.`
  } else if (r.estado === 'pode') {
    titulo = 'Pode reiniciar o app'
    classe = OK
    moldura = 'oks'
    linhas = [`nada rodando · ${conferido(r.conferidoEm)}`, ...(r.aviso.avisadoEm ? [`avisei às ${hhmm_(Date.parse(r.aviso.avisadoEm))}`] : [])]
    alt = `Aviso de reinício ligado: pode reiniciar o app — nada rodando, ${conferido(r.conferidoEm)}${r.aviso.avisadoEm ? `; avisei às ${hhmm_(Date.parse(r.aviso.avisadoEm))}` : ''}.`
  } else if (r.estado === 'conferindo') {
    titulo = 'Aviso ligado · conferindo'
    classe = 't'
    moldura = 'ms'
    linhas = ['a primeira conferência sai em instantes']
    alt = 'Aviso de reinício ligado: conferindo, a primeira conferência sai em instantes.'
  } else {
    titulo = `Não sei · ${ligado}`
    classe = 't'
    moldura = 'ms'
    linhas = [r.razao ?? 'ainda não conferi']
    alt = `Aviso de reinício ligado: não sei — ${r.razao ?? 'ainda não conferi'}.`
  }
  const altura = 24 + 16 * linhas.length + 10
  const glifoDoTitulo = r.estado === 'pode' ? OK : 'm'
  const partes = [`<text x="12" y="24" font-family="${FONTE}" font-size="13" font-weight="700"><tspan class="${glifoDoTitulo}">⏻</tspan><tspan class="${classe}"> ${xml(caber(titulo, 13, util - 20))}</tspan></text>`]
  linhas.forEach((l, k) => partes.push(texto(12, 40 + 16 * k, 12, k === linhas.length - 1 && (r.estado === 'espere' || (r.estado === 'pode' && k > 0)) ? 'm' : 's', xml(caber(l, 12, util)))))

  return {
    height: altura,
    alt,
    source: svg(W, altura, `<rect class="${moldura}" fill="none" stroke-width="1.5" x=".75" y=".75" width="${W - 1.5}" height="${altura - 1.5}" rx="8"/>${partes.join('')}`),
  }
}
