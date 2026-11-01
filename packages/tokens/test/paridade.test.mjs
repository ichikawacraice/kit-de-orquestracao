// Paridade 1:1 com o produto de origem nos tokens de sistema (critério de pronto da F261.2).
//
// A comparação é contra uma CÓPIA ÍNTEGRA dos dois arquivos de origem
// (test/fixtures/izanagi, de main @ 7b1267cce) — e não contra valores reescritos
// aqui, o que compararia a fonte consigo mesma. Todo token da origem ou vem para
// o pacote com o mesmo valor, ou está em EXCLUIDOS com o motivo: token novo na
// origem, ao atualizar a cópia, não passa calado.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { lerFonte, variaveis } from '../lib/ler.mjs'
import { KEYFRAMES, modelo, pecas, pilha } from '../lib/saidas.mjs'

const AQUI = import.meta.dirname
const ORIGEM = join(AQUI, 'fixtures', 'izanagi')
const semComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '')
const CSS = semComentarios(readFileSync(join(ORIGEM, 'globals.css'), 'utf8'))
const CONFIG = readFileSync(join(ORIGEM, 'tailwind.config.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const VARS = variaveis(lerFonte())
const MD = modelo()

/** Os tokens da origem que NÃO vêm para o pacote, e por quê. */
const EXCLUIDOS = {
  '--spacing': 'resto do modelo shadcn v4, inerte no v3; no v4 é a base de todo degrau de espaço e alargaria tudo em 40%',
  '--font-size': 'resto do modelo shadcn v4, inerte (nada o lê)',
  '--font-weight-medium': 'igual ao padrão do Tailwind, nada o lê',
  '--font-weight-normal': 'igual ao padrão do Tailwind, nada o lê',
  '--desenho': 'domínio: a camada do desenho de uma ferramenta do produto',
  '--origem': 'domínio: o selo de origem de uma solicitação',
  '--origem-tinta': 'domínio',
  '--pessoa-*': 'identidade de pessoa: fica para o registro decidir junto do monograma (assumido, a confirmar)',
  '--etapa-*': 'domínio: o percurso de trabalho do produto (a regra COR-09 vale; os valores, não)',
  '--plat-*': 'domínio: as plataformas que o produto atende',
  '--icone-da-ia': 'o desenho (máscara SVG) do ícone de IA: vai com a peça IconeDaIa, no registro (F261.3)',
}
/**
 * Os tokens que o pacote tem e a origem não, e por quê. Token só da Wicomm
 * entra aqui com o motivo; os outros seguem 1:1 com a origem.
 */
const PROPRIOS = {
  '--raio-marcacao': 'FORMA-01 declara 5px para a caixa de marcação; a origem a escrevia como valor solto (rounded-[5px]), e o registro ganhou a peça (F294)',
}

const excluido = (nome) => Object.keys(EXCLUIDOS).some((e) => (e.endsWith('*') ? nome.startsWith(e.slice(0, -1)) : nome === e))

/**
 * As variáveis de um tema na origem: TODOS os blocos `:root {` (claro) ou
 * `.dark {` (escuro) do arquivo, e não só o primeiro — um `:root` acrescentado
 * em outra camada também tem de vir ou estar excluído. Vale a última declaração, como na cascata.
 */
function blocoDaOrigem(tema) {
  const seletor = tema === 'claro' ? ':root {' : '.dark {'
  const saida = {}
  for (let ini = CSS.indexOf(seletor); ini >= 0; ini = CSS.indexOf(seletor, ini + 1)) {
    const corpo = CSS.slice(ini, CSS.indexOf('}', ini))
    for (const m of corpo.matchAll(/(--[\w-]+):\s*([^;]+);/g)) saida[m[1]] = m[2].trim()
  }
  return saida
}

const norma = (v) => String(v).replace(/\s+/g, ' ').replace(/#[0-9a-f]{3,8}\b/gi, (h) => h.toUpperCase()).trim()

/** As declarações de uma regra `.nome { … }` da origem. */
function regraDaOrigem(nome) {
  const m = new RegExp(`\\.${nome.replace(/[-]/g, '\\-')}\\s*\\{([^}]*)\\}`).exec(CSS)
  assert.ok(m, `a origem não tem a regra .${nome}`)
  return Object.fromEntries(
    m[1].split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
      const i = d.indexOf(':')
      return [d.slice(0, i).trim(), norma(d.slice(i + 1))]
    }),
  )
}

/** O corpo `{ … }` de uma chave do tailwind.config da origem, com as chaves casadas. */
function blocoDoConfig(chave, fonte = CONFIG) {
  const ini = fonte.search(new RegExp(`\\n\\s*${chave}:\\s*\\{`))
  assert.ok(ini >= 0, `o config da origem não tem ${chave}`)
  const abre = fonte.indexOf('{', ini)
  let nivel = 0
  for (let i = abre; i < fonte.length; i++) {
    if (fonte[i] === '{') nivel++
    else if (fonte[i] === '}' && --nivel === 0) return fonte.slice(abre + 1, i)
  }
  throw new Error(`bloco ${chave} sem fim`)
}

/** As entradas `chave: 'valor'` de um bloco do config (só valores string). */
const entradas = (corpo) =>
  Object.fromEntries([...corpo.matchAll(/(?:(['"])(.+?)\1|([\w-]+)):\s*(['"])(.*?)\4/g)].map((m) => [m[2] ?? m[3], m[5]]))

const semCampanha = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith('campanha') && k !== 'lineHeight'))

describe('paridade com o globals.css da origem', () => {
  it('a leitura enxerga: os dois blocos têm o que comparar, e diferem', () => {
    const claro = blocoDaOrigem('claro')
    const escuro = blocoDaOrigem('escuro')
    assert.ok(Object.keys(claro).length > 60, 'bloco claro curto demais')
    assert.ok(Object.keys(escuro).length > 50, 'bloco escuro curto demais')
    assert.notEqual(claro['--card'], escuro['--card'])
    assert.equal(norma('#ffffff'), '#FFFFFF')
  })

  for (const tema of ['claro', 'escuro']) {
    it(`tema ${tema}: todo token do pacote tem o MESMO valor da origem`, () => {
      const origem = blocoDaOrigem(tema)
      const diferentes = []
      for (const [nome, valor] of Object.entries(VARS[tema])) {
        if (nome in PROPRIOS) continue
        if (norma(valor) !== norma(origem[nome] ?? '(ausente)')) diferentes.push(`${nome}: pacote ${valor} · origem ${origem[nome] ?? '(ausente)'}`)
      }
      assert.deepEqual(diferentes, [])
      assert.ok(Object.keys(VARS[tema]).length > 40, 'o pacote tem o que comparar')
    })

    it(`tema ${tema}: todo token da origem vem para o pacote ou está excluído com motivo`, () => {
      const soltos = Object.keys(blocoDaOrigem(tema)).filter((n) => !(n in VARS[tema]) && !excluido(n))
      // `raio` não muda por tema: a origem o declara só no claro, e o pacote também.
      assert.deepEqual(soltos, [])
    })
  }

  it('as vozes da família (TIPO-02) têm as mesmas declarações da origem', () => {
    for (const [nome, decl] of Object.entries(MD.vozes)) {
      assert.deepEqual(Object.fromEntries(Object.entries(decl).map(([k, v]) => [k, norma(v)])), regraDaOrigem(nome), nome)
    }
    assert.equal(Object.keys(MD.vozes).length, 7)
  })

  it('as utilitárias de superfície e o painel têm as mesmas declarações da origem', () => {
    const { utilidades, componentes } = pecas(MD)
    const todas = { ...utilidades, '.painel': componentes['.painel'] }
    for (const [sel, decl] of Object.entries(todas)) {
      assert.deepEqual(Object.fromEntries(Object.entries(decl).map(([k, v]) => [k, norma(v)])), regraDaOrigem(sel.slice(1)), sel)
    }
    assert.equal(Object.keys(todas).length, 6)
  })
})

/**
 * O config da origem é v3; o pacote só gera v4 (Q640). Compara-se o VALOR de
 * cada chave do tema, que é o que a classe pinta. Ficam de fora, com motivo: a
 * chave `archivo` (no v4 colidiria com a variável da fonte; nenhum uso na
 * origem) e `animationScale` (no v4 o `zoom-in-97` não pede token).
 */
describe('paridade com o tailwind.config da origem', () => {
  it('toda cor com classe na origem tem a mesma classe e a mesma variável (fora as excluídas)', () => {
    const vars = [...CONFIG.matchAll(/comAlfa\('(--[\w-]+)'\)/g)].map((m) => m[1])
    assert.ok(vars.length > 20, 'a leitura achou as cores')
    // Na origem a classe de cada cor é o nome da variável (`primary.foreground` → `primary-foreground`).
    const faltam = vars.filter((v) => !excluido(v) && !MD.cores.includes(v.slice(2)))
    assert.deepEqual(faltam, [])
  })

  it('movimento: durações, atrasos, curvas e animações iguais (fora os do escopo de campanha)', () => {
    assert.deepEqual(MD.duracoes, semCampanha(entradas(blocoDoConfig('transitionDuration'))))
    assert.deepEqual(MD.atrasos, semCampanha(entradas(blocoDoConfig('transitionDelay'))))
    const curvas = semCampanha(entradas(blocoDoConfig('transitionTimingFunction')))
    delete curvas.mola // a mola é só da janela de campanha (domínio)
    assert.deepEqual(MD.curvas, curvas)
    assert.deepEqual(MD.animacoes, semCampanha(entradas(blocoDoConfig('animation'))))
  })

  it('raio, tamanho de letra, altura de controle e largura de leitura iguais', () => {
    const raiosProprios = Object.keys(PROPRIOS).filter((n) => n.startsWith('--raio-')).map((n) => n.slice('--raio-'.length))
    assert.deepEqual(Object.fromEntries(Object.entries(MD.raios).filter(([k]) => !raiosProprios.includes(k))), entradas(blocoDoConfig('borderRadius')))
    assert.deepEqual(MD.tamanhos, semCampanha(entradas(blocoDoConfig('fontSize'))))
    assert.deepEqual(MD.alturas, { ctrl: entradas(blocoDoConfig('height')).ctrl }) // espera-* é peça do registro
    assert.deepEqual(MD.alturas, entradas(blocoDoConfig('size')))
    assert.deepEqual(MD.larguras, entradas(blocoDoConfig('maxWidth')))
    assert.deepEqual(MD.sombras, entradas(blocoDoConfig('boxShadow')))
  })

  it('os keyframes têm os mesmos passos da origem (fora os de campanha)', () => {
    const corpo = blocoDoConfig('keyframes')
    const nomes = chaves(corpo).filter((k) => !k.startsWith('campanha'))
    assert.deepEqual(Object.keys(KEYFRAMES).sort(), nomes.sort())
    for (const nome of nomes) {
      const passos = blocoDoConfig(`'${nome}'`, corpo)
      const daOrigem = Object.fromEntries([...passos.matchAll(/([\w%]+):\s*\{([^}]*)\}/g)].map((m) => [m[1], entradas(m[2])]))
      assert.deepEqual(KEYFRAMES[nome], daOrigem, nome)
    }
  })

  it('a família do produto é a mesma pilha (TIPO-01), e `font-archivo` existe', () => {
    const familias = blocoDoConfig('fontFamily')
    const daOrigem = (chave) => [...new RegExp(`\\n\\s*${chave}:\\s*\\[([\\s\\S]*?)\\]`).exec(familias)[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
    assert.equal(pilha(MD.familias.sans), daOrigem('sans').join(', '))
    assert.equal(pilha(MD.familias.archivo), daOrigem('archivo').join(', '))
  })

  /**
   * Toda chave de `theme.extend` da origem vem para o pacote ou está em
   * EXCLUIDOS_DO_CONFIG com motivo. Sem isto, uma sombra ou largura nova da
   * origem ficaria de fora calada, e a classe dela não geraria nada no v4.
   */
  it('toda chave do tema da origem vem para o pacote ou está excluída com motivo', () => {
    const extend = blocoDoConfig('extend')
    const grupos = chaves(extend)
    assert.ok(grupos.length > 12, 'a leitura achou os grupos do tema')
    const soltas = []
    for (const g of grupos) {
      if (g === 'colors') continue // coberto pelo caso das cores, com as variáveis
      const doPacote = NO_PACOTE[g]
      for (const k of chaves(blocoDoConfig(g, extend))) {
        if (excluidoDoConfig(`${g}.${k}`)) continue
        if (!doPacote || !(k in doPacote)) soltas.push(`${g}.${k}`)
      }
    }
    assert.deepEqual(soltas, [])
  })

  it('a leitura das chaves enxerga — ignora o que está aninhado', () => {
    assert.deepEqual(chaves(" a: '1', 'b-c': { d: '2' }, e: ['x', { f: 1 }], \"g\": '3',"), ['a', 'b-c', 'e', 'g'])
    assert.deepEqual(entradas(" a: '1', \"b\": \"2\","), { a: '1', b: '2' })
  })
})

/** As chaves de primeiro nível de um corpo de objeto do config (o aninhado é ignorado). */
function chaves(corpo) {
  let nivel = 0
  let raso = ''
  for (const c of corpo) {
    if (c === '{' || c === '[') nivel++
    else if (c === '}' || c === ']') nivel--
    else if (nivel === 0) raso += c
  }
  return [...raso.matchAll(/(?:^|,)\s*(?:(['"])(.+?)\1|([\w-]+))\s*:/g)].map((m) => m[2] ?? m[3])
}

/** Onde cada grupo do tema da origem mora no pacote. */
const NO_PACOTE = {
  fontFamily: MD.familias,
  borderRadius: MD.raios,
  maxWidth: MD.larguras,
  transitionDuration: MD.duracoes,
  transitionDelay: MD.atrasos,
  fontSize: MD.tamanhos,
  height: MD.alturas,
  size: MD.alturas,
  boxShadow: MD.sombras,
  transitionTimingFunction: MD.curvas,
  keyframes: MD.animacoes,
  animation: MD.animacoes,
}

/** As chaves do tema da origem que NÃO vêm, e por quê. */
const EXCLUIDOS_DO_CONFIG = {
  '*.campanha*': 'domínio: a janela de campanha (ADR da origem, escopo próprio)',
  'transitionTimingFunction.mola': 'domínio: só a janela de campanha',
  'width.*': 'domínio: as colunas do editor e da mesa de trabalho do produto',
  'height.espera-*': 'as densidades da espera da lista: vão com a peça, no registro (F261.3)',
  'minHeight.*': 'domínio: o palco do editor',
  'aspectRatio.*': 'domínio: o print de seção',
  'animationScale.*': 'só do tailwindcss-animate (v3); no v4 o zoom-in-97 não pede token',
}
function excluidoDoConfig(caminho) {
  const [g, k] = caminho.split('.')
  return Object.keys(EXCLUIDOS_DO_CONFIG).some((e) => {
    const [eg, ek] = e.split('.')
    const casa = (padrao, valor) => padrao === '*' || (padrao.endsWith('*') ? valor.startsWith(padrao.slice(0, -1)) : padrao === valor)
    return casa(eg, g) && casa(ek, k)
  })
}

describe('a base (DESIGN.md) concorda com o pacote', () => {
  const DESIGN = readFileSync(join(AQUI, '..', '..', '..', 'plugins', 'wicomm', 'base', 'DESIGN.md'), 'utf8')
  const frontmatter = DESIGN.split('---')[1]
  /** As linhas `chave: "valor"` de um grupo do frontmatter (ex. `colors.claro`). */
  function grupo(caminho) {
    let linhas = frontmatter.split('\n')
    let recuo = -1
    for (const parte of caminho.split('.')) {
      const i = linhas.findIndex((l) => new RegExp(`^\\s{${recuo + 1},}${parte}:\\s*$`).test(l))
      assert.ok(i >= 0, `frontmatter sem ${caminho}`)
      recuo = linhas[i].search(/\S/)
      const fim = linhas.findIndex((l, j) => j > i && l.trim() && l.search(/\S/) <= recuo)
      linhas = linhas.slice(i + 1, fim < 0 ? undefined : fim)
    }
    return Object.fromEntries(linhas.map((l) => /^\s+([\w-]+):\s*"([^"]*)"/.exec(l)).filter(Boolean).map((m) => [m[1], m[2]]))
  }

  for (const tema of ['claro', 'escuro']) {
    it(`as cores do tema ${tema} no frontmatter são as do pacote`, () => {
      const fm = grupo(`colors.${tema}`)
      assert.ok(Object.keys(fm).length > 20, 'a leitura achou as cores')
      const v = VARS[tema]
      const esperado = {
        marca: v['--marca-viva'],
        gradiente: `118deg, ${v['--primary-gradient-start']} 0%, ${v['--primary-gradient-mid']} 46%, ${v['--primary-gradient-end']} 100%`,
      }
      const diferentes = Object.entries(fm)
        .map(([k, valor]) => [k, valor, esperado[k] ?? v[`--${k}`]])
        .filter(([, valor, nosso]) => norma(valor) !== norma(nosso ?? '(ausente no pacote)'))
        .map(([k, valor, nosso]) => `${k}: base ${valor} · pacote ${nosso}`)
      assert.deepEqual(diferentes, [])
    })

    it(`as sombras do tema ${tema} no frontmatter são as do pacote`, () => {
      const fm = grupo(`shadow.${tema}`)
      for (const [k, valor] of Object.entries(fm)) {
        assert.equal(norma(valor), norma(VARS[tema][`--${k.replace('superficie', 'superficie-sombra')}`]), k)
      }
    })
  }

  it('o movimento do frontmatter é o do pacote', () => {
    const fm = grupo('motion')
    const nosso = { ...MD.duracoes, ...MD.atrasos, 'ease-abre': MD.curvas.abre, 'ease-fecha': MD.curvas.fecha }
    for (const [k, valor] of Object.entries(fm)) {
      assert.ok(k in nosso, `${k} está na base e não no pacote`)
      assert.equal(valor.split(' (')[0], nosso[k], k)
    }
  })
})
