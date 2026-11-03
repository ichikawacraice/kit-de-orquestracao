// Guardas da base (plugins/design-system/base): o critério de pronto da F261.1
// e a forma de toda regra (Regra · Por quê · Confere), para que o designer, o
// crítico e as guardas possam citar cada regra pelo código. A base não fala de
// marca nenhuma (Q846) nem do produto de origem (Q639): o que é da marca mora no
// tema (temas/<id>/), e a origem de cada regra, fora do plugin, em
// docs/rastreio/origens-da-base.md (o teste cobra que as duas concordam).
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GUARDAS } from '../packages/guardas/lib/index.mjs'

const PASTA = join(import.meta.dirname, '..', 'plugins', 'design-system', 'base')
const ARQUIVOS = ['DESIGN.md', 'ANATOMIA.md', 'CONVENCOES.md']
const MARCADOR = 'exemplo-izanagi'
const RASTREIO = join(import.meta.dirname, '..', 'docs', 'rastreio', 'origens-da-base.md')
const DOMINIO = /(?<![\p{L}\p{N}_])(job|jobs|loja|lojas|wake|vtex|ensō|enso|builder|izanagi)(?![\p{L}\p{N}_])/iu
const CAMPOS = ['Regra.', 'Por quê.', 'Confere.']
const ORIGEM_VALIDA = /\b(ADR \d{4}|SPEC-\d{3}|Q\d+)\b|[Cc]onvenção|[Dd]ireção de design de origem|Do's and Don'ts|[Dd]ecisão do dono do produto|estudo F261|\bWCAG 2\.[12] AA, critérios? \d\.\d\.\d+|\bknowledge-work-plugins@[0-9a-f]{7}\b/

const CONHECIDAS = JSON.parse(readFileSync(join(import.meta.dirname, 'origens-conhecidas.json'), 'utf8'))
const texto = Object.fromEntries(ARQUIVOS.map((f) => [f, readFileSync(join(PASTA, f), 'utf8')]))
const rastreio = readFileSync(RASTREIO, 'utf8')
/** As linhas do rastreio: código → { arquivo, origem }. */
const origens = new Map([...rastreio.matchAll(/^\| ([A-Z]+-\d{2}) \| (\w+\.md) \| (.+) \|$/gm)].map((m) => [m[1], { arquivo: m[2], origem: m[3] }]))

function regras(conteudo) {
  const blocos = conteudo.split(/^(?=### )/m).slice(1)
  return blocos
    .map((b) => ({ titulo: b.split('\n')[0], corpo: b, codigo: b.match(/^### ([A-Z]+-\d{2}) · /)?.[1] }))
}

function indice(conteudo) {
  const parte = conteudo.split('## Índice das regras')[1] ?? ''
  return [...parte.matchAll(/^\| ([A-Z]+-\d{2}) \|/gm)].map((m) => m[1])
}

test('os três arquivos existem e a pasta não tem outro documento de regra', () => {
  const md = readdirSync(PASTA).filter((f) => f.endsWith('.md')).sort()
  assert.deepEqual(md, [...ARQUIVOS].sort())
})

test('nenhuma linha cita o domínio de origem, e não há mais exemplo marcado (Q639)', () => {
  const achados = []
  for (const [f, c] of Object.entries(texto)) {
    c.split('\n').forEach((linha, i) => {
      if (linha.includes(MARCADOR) || DOMINIO.test(linha)) achados.push(`${f}:${i + 1}: ${linha.trim().slice(0, 100)}`)
    })
  }
  assert.deepEqual(achados, [])
})

/**
 * A marca de cada tema do repositório, como a base não pode citá-la (Q846: "saem os valores"): o `nome` (e o plural)
 * em lugar nenhum; o `id` só como escopo de pacote ou de registro, em minúscula (`@wicomm/tokens`, `@wicomm/<peça>`),
 * que fica enquanto o pacote tiver esse nome; a família da fonte em lugar nenhum (TIPO-01 diz "a família do tema");
 * e os valores que só o tema tem: as cores dele que o sistema não usa e a razão aceita sobre a marca.
 */
const TEMAS = join(import.meta.dirname, '..', 'temas')
const hexes = (texto) => new Set([...texto.matchAll(/#[0-9a-f]{6}\b/gi)].map((m) => m[0].toUpperCase()))
const DO_SISTEMA = hexes(readFileSync(join(import.meta.dirname, '..', 'packages', 'tokens', 'fonte', 'sistema.tokens.json'), 'utf8'))
const MARCAS = readdirSync(TEMAS, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => {
    const meta = JSON.parse(readFileSync(join(TEMAS, d.name, 'tema.json'), 'utf8'))
    const cores = [...hexes(readFileSync(join(TEMAS, d.name, 'tema.tokens.json'), 'utf8'))].filter((h) => !DO_SISTEMA.has(h))
    return { ...meta, valores: [...cores, String(meta.contrasteAceitoSobreAMarca).replace('.', ',')] }
  })
const escapar = (p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const palavra = (p, plural = true) => new RegExp(`(?<![\\p{L}\\p{N}_])${escapar(p)}${plural ? 's?' : ''}(?![\\p{L}\\p{N}_])`, 'iu')
export function marcaNaLinha(linha, tema) {
  // Só o escopo do pacote, em minúscula e seguido de `/` ou do fim do nome: `@Wicomm` é a marca.
  const semEscopo = linha.replace(new RegExp(`@${escapar(tema.id)}(?=/|\`|\\s|$)`, 'g'), '')
  return [
    ...[tema.nome, tema.id, tema.fonte.familia].filter((p) => palavra(p).test(semEscopo)),
    ...(tema.valores ?? []).filter((v) => palavra(v, false).test(linha)),
  ]
}

test('a base não cita marca nenhuma: nem o nome, nem o id fora do escopo do pacote, nem a família do tema (Q846)', () => {
  assert.ok(MARCAS.length >= 1, 'achou os temas')
  const achados = []
  for (const [f, c] of Object.entries(texto)) {
    c.split('\n').forEach((linha, i) => {
      for (const tema of MARCAS) for (const p of marcaNaLinha(linha, tema)) achados.push(`${f}:${i + 1}: "${p}" em ${linha.trim().slice(0, 100)}`)
    })
  }
  assert.deepEqual(achados, [])
})

test('a busca de marca morde (prova nos dois sentidos)', () => {
  const tema = MARCAS.find((t) => t.id === 'wicomm')
  assert.ok(tema.valores.includes('#F30B42') && tema.valores.includes('4,25') && !tema.valores.includes('#FFFFFF'), `os valores da marca: ${tema.valores}`)
  for (const ruim of ['a marca Wicomm', 'os apps Wicomms', 'a marca @Wicomm', 'design/wicomm.json', '/wicomm:estado', 'fonte Archivo', 'a cor `#F30B42`', 'mede 4,25:1', 'WICOMM'])
    assert.notDeepEqual(marcaNaLinha(ruim, tema), [], ruim)
  for (const bom of ['`@wicomm/tokens`', 'shadcn add @wicomm/<peça>', 'pacote privado `@wicomm`', 'arquivo', 'card `#FFFFFF`', 'mede 4,5:1'])
    assert.deepEqual(marcaNaLinha(bom, tema), [], bom)
})

test('a base não carrega a origem: nem o campo, nem o commit de origem no frontmatter', () => {
  for (const [f, c] of Object.entries(texto)) {
    assert.doesNotMatch(c, /\*\*Origem\.?\*\*/, `${f}: campo Origem na base`)
    assert.doesNotMatch(c.split('\n---')[0], /^origem:/m, `${f}: origem no frontmatter`)
  }
})

test('a busca de domínio morde (prova nos dois sentidos)', () => {
  for (const ruim of ['o Job terminou', 'na loja', 'Izanagi', 'o builder', 'ensō']) assert.ok(DOMINIO.test(ruim), ruim)
  for (const bom of ['denso', 'instrumento', 'ensombrar', 'lojista', 'jobless']) assert.ok(!DOMINIO.test(bom), bom)
})

for (const f of ARQUIVOS) {
  test(`${f}: toda regra tem os três campos e uma origem rastreável no rastreio`, () => {
    const rs = regras(texto[f])
    const semCodigo = rs.filter((r) => !r.codigo).map((r) => r.titulo)
    assert.deepEqual(semCodigo, [], 'todo ### é uma regra com código `XXX-NN · `')
    assert.ok(indice(texto[f]).length >= 20, `${f}: índice com menos de 20 regras`)
    assert.equal(rs.length, indice(texto[f]).length, 'piso = total do índice')
    for (const r of rs) {
      for (const campo of CAMPOS) {
        const valor = r.corpo.match(new RegExp(`\\*\\*${campo.replace('.', '\\.')}\\*\\*([\\s\\S]*?)(?=\\n- \\*\\*|$)`))?.[1]?.trim()
        assert.ok(valor, `${r.codigo} sem ${campo} ou com ${campo} vazio`)
      }
      const linha = origens.get(r.codigo)
      assert.ok(linha, `${r.codigo} sem linha no rastreio`)
      assert.equal(linha.arquivo, f, `${r.codigo}: o rastreio diz outro arquivo`)
      assert.match(linha.origem, ORIGEM_VALIDA, `${r.codigo}: origem sem ADR, SPEC, Q ou convenção`)
    }
  })

  test(`${f}: o índice lista exatamente as regras do arquivo`, () => {
    assert.deepEqual(indice(texto[f]), regras(texto[f]).map((r) => r.codigo))
  })
}

test('nenhum código de regra se repete entre os arquivos', () => {
  const todos = ARQUIVOS.flatMap((f) => regras(texto[f]).map((r) => r.codigo))
  const repetidos = todos.filter((c, i) => todos.indexOf(c) !== i)
  assert.deepEqual(repetidos, [])
})

test('toda referência DESIGN/ANATOMIA, XXX-NN aponta para regra que existe', () => {
  const existentes = new Set(ARQUIVOS.flatMap((f) => regras(texto[f]).map((r) => r.codigo)))
  const citados = Object.values(texto).flatMap((c) => [...c.matchAll(/\b([A-Z]{3,6}-\d{2})\b/g)].map((m) => m[1]))
  assert.deepEqual([...new Set(citados.filter((c) => !existentes.has(c) && !/^SPEC-/.test(c)))], [])
})

test('o rastreio não tem regra que a base não tem', () => {
  const existentes = new Set(ARQUIVOS.flatMap((f) => regras(texto[f]).map((r) => r.codigo)))
  assert.ok(origens.size > 0, 'rastreio vazio: a leitura não achou linha nenhuma')
  assert.deepEqual([...origens.keys()].filter((c) => !existentes.has(c)), [])
})

// A guarda citada vem do repositório de origem (conferida lá) ou nasceu no pacote @wicomm/guardas.
const GUARDAS_DO_PACOTE = GUARDAS.map((g) => g.id)

test('toda origem e toda guarda citada foi conferida no repositório de origem ou existe no pacote de guardas', () => {
  const tudo = [...Object.values(texto), rastreio].join('\n')
  const fora = (re, lista) => [...new Set([...tudo.matchAll(re)].map((m) => m[1]))].filter((x) => !lista.includes(x))
  assert.deepEqual(fora(/ADR (\d{4})/g, CONHECIDAS.adr), [], 'ADR citado e não conferido')
  assert.deepEqual(fora(/SPEC-(\d{3})/g, CONHECIDAS.spec), [], 'SPEC citada e não conferida')
  assert.deepEqual(fora(/guarda:([a-z0-9-]+)/g, [...CONHECIDAS.guardas, ...GUARDAS_DO_PACOTE]), [], 'guarda citada e não conferida')
  assert.deepEqual(fora(/knowledge-work-plugins@([0-9a-f]{7})/g, CONHECIDAS.terceiros['knowledge-work-plugins']), [], 'terceiro citado e não conferido')
})

test('a origem válida morde (prova nos dois sentidos)', () => {
  for (const boa of ['ADR 0124.', 'WCAG 2.1 AA, critério 4.1.3', 'WCAG 2.2 AA, critérios 2.5.8 e 2.5.5', 'plugin (knowledge-work-plugins@2574e29, Apache-2.0)']) assert.match(boa, ORIGEM_VALIDA, boa)
  for (const ruim of ['knowledge-work-plugins', 'WCAG 2.9 palpite', 'xWCAG 2.1 AA, critério 1.1.1', 'WCAG 2.1 AA', 'achei melhor assim']) assert.doesNotMatch(ruim, ORIGEM_VALIDA, ruim)
})
