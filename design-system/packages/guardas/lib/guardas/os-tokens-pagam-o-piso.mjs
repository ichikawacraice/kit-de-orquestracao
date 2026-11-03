// COR-12, COR-11 e MARCA-01 — os tokens que o projeto DECLARA pagam o piso de
// contraste nos dois temas: a rampa de tinta e a voz `ruim` passam 4,5:1 no
// pior dos quatro fundos, o contorno de controle (`--input`) passa 3:1, e o
// preenchimento da marca é o mesmo nos dois temas. O pacote de tokens mede os
// próprios valores; esta guarda mede o que o projeto sobrescreve, lendo as
// folhas da configuração e, antes delas, o `@wicomm/tokens` que elas importam.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { razao } from '../contraste.mjs'
import { violacao } from './_comum.mjs'

const FUNDOS = ['--background', '--card', '--muted', '--accent']
const TEXTO = [
  ['--foreground', 4.5],
  ['--foreground-2', 4.5],
  ['--muted-foreground', 4.5],
  ['--destructive', 4.5],
]
const CONTORNO = [['--input', 3]]

/**
 * As declarações de variável da folha, NA ORDEM, com o tema de cada uma:
 * `claro` (no seletor claro), `escuro` (no seletor escuro, ou no claro dentro
 * de `@media (prefers-color-scheme: dark)`). A ordem importa: os dois
 * seletores têm a mesma especificidade, e no escuro vence o último.
 */
export function declaracoes(css, { claro = ':root', escuro = '.dark' } = {}) {
  const limpo = css.replace(/\/\*[\s\S]*?\*\//g, ' ')
  const saida = []
  const pilha = []
  let cabeca = ''
  const doSeletor = (h, sel) => h.split(',').map((x) => x.trim()).includes(sel)
  const fecha = () => {
    const decl = cabeca.trim()
    cabeca = ''
    const m = /^(--[\w-]+)\s*:\s*([\s\S]+)$/.exec(decl)
    if (!m || pilha.length === 0) return
    const topo = pilha[pilha.length - 1]
    const mediaEscura = pilha.some((h) => /^@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)/.test(h))
    const tema = doSeletor(topo, escuro) || (mediaEscura && doSeletor(topo, claro)) ? 'escuro' : doSeletor(topo, claro) ? 'claro' : null
    if (tema) saida.push({ tema, nome: m[1], valor: m[2].trim() })
  }
  for (const ch of limpo) {
    if (ch === '{') {
      pilha.push(cabeca.trim())
      cabeca = ''
    } else if (ch === '}') {
      fecha()
      pilha.pop()
    } else if (ch === ';') fecha()
    else cabeca += ch
  }
  return saida
}

/** As variáveis que valem num tema: o claro lê só o claro; o escuro lê os dois, e vence o último. */
export function varsDoTema(declaradas, tema) {
  const vars = {}
  for (const d of declaradas) if (d.tema === 'claro' || d.tema === tema) vars[d.nome] = d.valor
  return vars
}

/**
 * O CSS do `@wicomm/tokens` que a folha importa, procurado no `node_modules`
 * da raiz e dos diretórios acima (monorepo com dependência içada). Importado
 * e não achado é erro: sem ele a conta mediria só metade da cascata.
 */
function importados(raiz, css, erros) {
  return [...css.matchAll(/@import\s+["'](@wicomm\/tokens\/[^"']+)["']/g)].flatMap((m) => {
    const rel = m[1].replace('@wicomm/tokens/', '@wicomm/tokens/dist/')
    for (let d = raiz; ; d = dirname(d)) {
      const f = join(d, 'node_modules', rel)
      if (existsSync(f)) return [readFileSync(f, 'utf8')]
      if (dirname(d) === d) break
    }
    erros.push(`a folha importa ${m[1]} e ele não está instalado`)
    return []
  })
}

export default {
  id: 'os-tokens-pagam-o-piso',
  regras: ['COR-12', 'COR-11', 'MARCA-01'],
  titulo: 'Os tokens pagam o piso de contraste',
  padrao: { temas: { claro: ':root', escuro: '.dark' } },
  examinar(p, op) {
    const folhas = p.css()
    const violacoes = []
    const erros = []
    let examinados = 0
    const primarios = {}
    // Na ordem da cascata: o `@wicomm/tokens` importado antes da folha que o importa.
    const todas = folhas.flatMap((f) => [...importados(p.raiz, f.texto, erros).flatMap((t) => declaracoes(t, op.temas)), ...declaracoes(f.texto, op.temas)])
    for (const tema of ['claro', 'escuro']) {
      const vars = varsDoTema(todas, tema)
      const hex = (v) => (/^#[0-9a-fA-F]{6}$/.test(vars[v] ?? '') ? vars[v] : null)
      const onde = folhas[folhas.length - 1]?.arquivo ?? '(css)'
      for (const [tinta, piso] of [...TEXTO, ...CONTORNO]) {
        if (!(tinta in vars)) continue
        if (!hex(tinta)) {
          erros.push(`${tema}: ${tinta} = "${vars[tinta]}" não é hex de 6 dígitos; a conta não o lê`)
          continue
        }
        for (const fundo of FUNDOS) {
          if (!(fundo in vars)) continue
          if (!hex(fundo)) {
            erros.push(`${tema}: ${fundo} = "${vars[fundo]}" não é hex de 6 dígitos; a conta não o lê`)
            continue
          }
          examinados++
          const r = razao(hex(tinta), hex(fundo))
          if (r < piso) violacoes.push(violacao(onde, null, `${tema}: ${tinta} sobre ${fundo} mede ${r.toFixed(2)}:1, abaixo de ${piso}:1`, `${hex(tinta)} / ${hex(fundo)}`))
        }
      }
      if (hex('--primary')) primarios[tema] = hex('--primary').toUpperCase()
    }
    const valores = Object.values(primarios)
    if (valores.length > 1 && new Set(valores).size > 1) {
      violacoes.push(violacao(folhas[folhas.length - 1]?.arquivo ?? '(css)', null, 'o preenchimento da marca muda entre os temas; ele não cede a contraste (MARCA-01)', valores.join(' / ')))
    }
    return { examinados, violacoes, erros }
  },
}
