// O desenho do pane no desktop: cada bloco é um SVG, como o savvy-progress faz,
// porque o desktop desenha SVG com a fonte do sistema e o tema claro/escuro.
// Funções puras, sem `$`: recebem os dados e a largura, devolvem o markup.

import type { LinhaItem, PerguntaAberta, PerguntaAnterior } from '../types'

const FONTE = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',sans-serif"

const CSS = `<style>
.t{fill:#1f1f1f}.s{fill:#6b6b68}.m{fill:#6f6f6b}.av{fill:#9a6210}.er{fill:#b8452c}.an{fill:#3a68c8}.ok{fill:#2e7d4a}.li{fill:#5b5cd6}.pt{fill:#ffffff}.es{stroke:#b8452c}.oks{stroke:#2e7d4a}.ms{stroke:#6f6f6b}.ln{stroke:#e8e7e3}.tile{fill:#f4f3f0}.k{fill:#ecebe8}.card{fill:#fbf6ec;stroke:#efdcb6}
@media (prefers-color-scheme: dark){.t{fill:#ececec}.s{fill:#a8a8a4}.m{fill:#93938f}.av{fill:#d9962b}.er{fill:#e0846b}.an{fill:#5b8def}.ok{fill:#4caf6e}.li{fill:#8b8cf8}.pt{fill:#1f1f1f}.es{stroke:#e0846b}.oks{stroke:#4caf6e}.ms{stroke:#93938f}.ln{stroke:#2f2f2d}.tile{fill:#262625}.k{fill:#2c2c2b}.card{fill:#2a251b;stroke:#4a3d22}}
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
    const corPonto = viva ? `class="${c.classe ?? c.cor}"` : `fill="${NEUTRO}"`
    const corNumero = viva ? ` class="${c.classe ?? c.cor}"` : ' class="m"'

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
    partes.push(texto(16, y, 13, AVISO, xml(l)))
    y += 18
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
    item.situacao === 'fila' ? { t: `espera ${rotulo}`, classe: 's', peso: true } : { t: rotulo, classe: cor, peso: true },
    ...(opcoes.noTravados ? [{ t: item.temaRotulo, classe: 's' }] : []),
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

  const alt = [item.titulo, [item.situacao === 'fila' ? `espera ${rotulo}` : rotulo, opcoes.noTravados ? item.temaRotulo : undefined, item.perguntas[0] && `aguarda você · ${item.perguntas[0]}`, seloDaEspera(item), ...quemDoItem(item).map(q => q.t), ultimoPr, ...quemSaiu(item).map(q => q.t), donoForaDaLinha(item)].filter(Boolean).join(' · ')]
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
    const depois = `depois: ${item.depois[0]}${mais}`
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
