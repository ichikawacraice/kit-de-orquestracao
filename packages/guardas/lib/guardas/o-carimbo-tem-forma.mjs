// CTRL-05, COR-03 e COR-05 — o carimbo tem uma forma só (o casco do chip), o
// matiz sai das cinco vozes e de nenhuma outra, a cor de voz se escreve num
// arquivo só (o idioma de cor) e a voz se declara em `Tom`, nunca num
// vocabulário paralelo. Foram medidos oito vocabulários de cor e 40 pílulas em
// 22 construções antes do mapa único.
import { escapar, semComentarios } from '../fonte.mjs'
import { CODIGO, ocorrencias, violacao } from './_comum.mjs'

export const VOZES = { ok: 'emerald', espera: 'amber', ruim: 'rose', alheio: 'violet' }
export const TONS = new Set(['ok', 'espera', 'ruim', 'neutro', 'alheio'])
const FAMILIAS = ['slate', 'gray', 'zinc', 'neutral', 'stone', 'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose']
const UTIL = '(?:text|bg|border|ring|from|to|via|fill|stroke|outline|decoration|divide|shadow|accent|caret)'
const DE_FORA = FAMILIAS.filter((f) => !Object.values(VOZES).includes(f))
const MATIZ_DE_FORA = new RegExp(`\\b${UTIL}-(?:${DE_FORA.join('|')})-\\d{2,3}\\b`, 'g')
const PALETA = new RegExp(`\\b${UTIL}-(?:${FAMILIAS.join('|')})-\\d{2,3}\\b`, 'g')

/** A forma de pílula: raio de carimbo, padding horizontal curto, sem a altura nem o corpo de botão ou de caixa. */
export function ehPilula(classe) {
  if (!/rounded-(full|lg|md)/.test(classe)) return false
  if (!/\bpx-(1|1\.5|2|2\.5)\b/.test(classe)) return false
  if (/\bpy-(1\.5|2|2\.5|3|4)\b/.test(classe)) return false
  if (/\btext-sm\b/.test(classe)) return false
  if (/\bh-(8|9|10|11|12)\b/.test(classe)) return false
  return true
}

export function pilulas(codigo) {
  return ocorrencias(codigo, /(?:className|CASCO[A-Z_]*)\s*=\s*[`"']([^`"']{10,400})[`"']/g).filter(({ m }) => ehPilula(m[1]))
}

/** Os literais de um alias de tipo (`type X = 'a' | 'b'`), linha a linha. */
function ladoDireito(texto, depois) {
  const resto = texto.slice(depois).split('\n')
  const linhas = [resto[0]]
  for (const l of resto.slice(1)) {
    if (/^\s*\|/.test(l)) linhas.push(l)
    else break
  }
  return linhas.join(' ')
}

export function literaisDoAlias(fonte, alias) {
  const texto = semComentarios(fonte)
  const m = new RegExp(`\\btype\\s+${escapar(alias)}\\s*=\\s*`).exec(texto)
  if (!m) return null
  return [...ladoDireito(texto, m.index + m[0].length).matchAll(/'([^']*)'/g)].map((x) => x[1])
}

export function vocabularioDeFora(fonte, { aceitos = new Set(), aliasesIsentos = new Set() } = {}) {
  const texto = semComentarios(fonte)
  const voz = (lit) => TONS.has(lit) || aceitos.has(lit)
  const achados = []
  for (const m of texto.matchAll(/\btype\s+(\w*(?:Tom|Tone)\w*)\s*(?:<[^>]*>)?\s*=\s*/g)) {
    if (m[1] === 'Tom' || aliasesIsentos.has(m[1])) continue
    const rhs = ladoDireito(texto, m.index + m[0].length)
    if (/^\s*string\b|\|\s*string\b/.test(rhs)) achados.push({ indice: m.index, msg: `type ${m[1]} = string` })
    const literais = [...rhs.matchAll(/'([^']*)'/g)].map((x) => x[1])
    for (const lit of literais) if (!voz(lit)) achados.push({ indice: m.index, msg: `type ${m[1]}: '${lit}'` })
    if (literais.length > 0 && !/\bTom\b/.test(rhs)) achados.push({ indice: m.index, msg: `type ${m[1]} copia as vozes à mão (use Extract<Tom, …>)` })
  }
  for (const m of texto.matchAll(/\b(tom|tone)\??\s*:\s*([^\n;,]*)/g)) {
    const rhs = m[2].replace(/[!=]==?\s*'[^']*'/g, '').replace(/'[^']*'\s*[!=]==?/g, '')
    if (/^string\b/.test(rhs.trim())) achados.push({ indice: m.index, msg: `${m[1]}: string` })
    for (const [, lit] of rhs.matchAll(/'([^']*)'/g)) if (!voz(lit)) achados.push({ indice: m.index, msg: `${m[1]}: '${lit}'` })
  }
  for (const m of texto.matchAll(/\b(tom|tone)\s*[!=]==\s*'([^']*)'/g)) if (!voz(m[2])) achados.push({ indice: m.index, msg: `${m[1]} === '${m[2]}'` })
  for (const m of texto.matchAll(/\b(tom|tone)=(?:"([^"]*)"|\{'([^']*)'\})/g)) {
    const v = m[2] ?? m[3]
    if (!voz(v)) achados.push({ indice: m.index, msg: `${m[1]}="${v}"` })
  }
  return achados
}

export default {
  id: 'o-carimbo-tem-forma',
  regras: ['CTRL-05', 'COR-03', 'COR-05'],
  titulo: 'O carimbo tem forma, e a voz sai do idioma de cor',
  // `casco`: os nomes que provam que a pílula vem do kit. `idioma`: o arquivo
  // único onde a voz se escreve com a paleta. `naoSaoVoz`: aliases de tipo que
  // têm `Tom` no nome e não são voz ({ arquivo, alias, motivo }).
  padrao: { casco: ['CASCO_DO_CHIP', 'ChipDeEstado'], idioma: 'src/lib/idioma-de-cor.ts', naoSaoVoz: [] },
  examinar(p, op) {
    const fontes = p.fontes({ ext: CODIGO, ignorar: [p.config.kit] })
    const erros = []
    const aceitos = new Set()
    for (const n of op.naoSaoVoz) {
      const lit = p.existe(n.arquivo) ? literaisDoAlias(p.ler(n.arquivo), n.alias) : null
      if (!lit || lit.length === 0) erros.push(`isenção velha: ${n.alias} não existe mais em ${n.arquivo}`)
      else lit.forEach((l) => aceitos.add(l))
      if ((n.motivo ?? '').trim().length < 20) erros.push(`isenção sem motivo: ${n.alias}`)
    }
    const aliasesIsentos = new Set(op.naoSaoVoz.map((n) => n.alias))
    const doCasco = new RegExp(`\\b(?:${op.casco.map(escapar).join('|')})\\b|<(?:${op.casco.map(escapar).join('|')})\\b`)
    const violacoes = fontes.flatMap(({ arquivo, texto }) => {
      const codigo = semComentarios(texto)
      const v = []
      if (!doCasco.test(codigo)) {
        for (const { linha, m } of pilulas(codigo)) v.push(violacao(arquivo, linha, 'carimbo montado fora do casco: use ChipDeEstado (CTRL-05)', m[1]))
      }
      for (const { linha, m } of ocorrencias(codigo, MATIZ_DE_FORA)) v.push(violacao(arquivo, linha, 'matiz fora das cinco vozes (COR-03)', m[0]))
      if (arquivo !== op.idioma) {
        const deFora = new Set(ocorrencias(codigo, MATIZ_DE_FORA).map(({ m }) => m.index))
        for (const { linha, m } of ocorrencias(codigo, PALETA)) {
          if (!deFora.has(m.index)) v.push(violacao(arquivo, linha, 'cor de voz escrita à mão: componha o idioma de cor (COR-05)', m[0]))
        }
      }
      for (const a of vocabularioDeFora(texto, { aceitos, aliasesIsentos })) {
        v.push(violacao(arquivo, codigo.slice(0, a.indice).split('\n').length, `vocabulário de voz fora de Tom (COR-05): ${a.msg}`))
      }
      return v
    })
    return { examinados: fontes.length, violacoes, erros }
  },
}
