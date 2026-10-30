// O registro shadcn da Wicomm: o critério de pronto da F261.3 que não pede
// navegador — o estilo é o pacote de tokens, as listas concordam, o build sai
// no caminho versionado, e nada do produto de origem vai para o projeto do cliente.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { estiloDoShadcn, lerCss } from '../lib/css.mjs'
import { NPM } from '../lib/itens.mjs'
import { VERSAO, registro, tokensCss } from '../lib/registro.mjs'

const RAIZ = join(import.meta.dirname, '..')
const REG = registro()
const ITENS = Object.fromEntries(REG.items.map((i) => [i.name, i]))
const PECAS = REG.items.filter((i) => i.type !== 'registry:style')
const ler = (p) => readFileSync(join(RAIZ, p), 'utf8')
const arquivosDoRegistro = (pasta = 'registry/wicomm') =>
  readdirSync(join(RAIZ, pasta), { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? arquivosDoRegistro(`${pasta}/${d.name}`) : [`${pasta}/${d.name}`],
  )

test('o registry.json gravado é o que o gerador escreve', () => {
  assert.deepEqual(JSON.parse(ler('registry.json')), REG)
})

test('o estilo carrega TODO token do tailwind-v4.css, com o mesmo valor', () => {
  const { cssVars, css } = ITENS.estilo
  const nos = lerCss(tokensCss())
  const bloco = (sel) => nos.find((n) => n.seletor === sel).filhos
  for (const [sel, tema] of [[':root', 'light'], ['.dark', 'dark']]) {
    for (const { prop, valor } of bloco(sel)) {
      const viaVars = prop.startsWith('--') ? cssVars[tema][prop.slice(2)] : undefined
      assert.equal(viaVars ?? css[sel]?.[prop], valor, `${sel} ${prop}`)
    }
  }
  for (const f of bloco('@theme inline')) {
    if (f.prop) assert.equal(cssVars.theme[f.prop.slice(2)], f.valor, `@theme ${f.prop}`)
    else assert.ok(css[f.seletor], f.seletor)
  }
  for (const n of nos) if (n.seletor?.startsWith('@utility ') || n.seletor?.startsWith('@layer ')) assert.ok(css[n.seletor], n.seletor)
})

test('o estilo só acrescenta ao tema os raios padrão do Tailwind (contra a escala que o CLI injeta)', () => {
  const doTokens = estiloDoShadcn(tokensCss()).cssVars.theme
  const extras = Object.keys(ITENS.estilo.cssVars.theme).filter((k) => !(k in doTokens))
  assert.deepEqual(extras.sort(), ['radius-2xl', 'radius-3xl', 'radius-4xl', 'radius-xl'])
  assert.equal(ITENS.estilo.cssVars.theme['radius-xl'], '0.75rem', 'FORMA-01: agrupador 12px')
  assert.equal(ITENS.estilo.cssVars.theme['radius-2xl'], '1rem', 'FORMA-01: container 16px')
})

test('o leitor de CSS recusa o que não conhece (prova que ele morde)', () => {
  assert.throws(() => estiloDoShadcn('@media (x) { a { b: c; } }'), /não suportado/)
  assert.throws(() => estiloDoShadcn('@import "x";'), /não suportada/)
  assert.throws(() => estiloDoShadcn(':root { --a: b }'), /ponto e vírgula/)
})

test('cada arquivo do registro está em exatamente uma peça, e cada peça aponta arquivo que existe', () => {
  const usados = PECAS.flatMap((p) => p.files.map((f) => f.path)).concat(ITENS.estilo.files.map((f) => f.path))
  assert.deepEqual([...usados].sort(), arquivosDoRegistro().sort())
  assert.equal(new Set(usados).size, usados.length, 'arquivo em duas peças')
})

/** A cola de exemplo do Next: as páginas (`registry:page`) e o componente que o layout do casco usa — lista fechada. */
const COLA_DO_NEXT = ['registry/wicomm/blocks/casco/casco-no-next.tsx']
const ehDoNext = (item, caminho) =>
  item.files.some((f) => f.path === caminho && f.type === 'registry:page') || COLA_DO_NEXT.includes(caminho)

test('toda importação de uma peça está declarada: npm em dependencies, peça em registryDependencies', () => {
  const pacote = (dep) => dep.replace(/@[^@/]+$/, '')
  const porArquivo = Object.fromEntries(REG.items.flatMap((i) => (i.files ?? []).map((f) => [f.path, i])))
  for (const [caminho, item] of Object.entries(porArquivo)) {
    const fonte = ler(caminho)
    const npm = new Set((item.dependencies ?? []).map(pacote))
    const regs = new Set((item.registryDependencies ?? []).map((r) => r.replace('@wicomm/', '')))
    for (const [, , de] of fonte.matchAll(/from (["'])([^"']+)\1/g)) {
      if (de === 'react' || de === 'react-dom') continue
      // O Next só entra na cola de exemplo do App Router: a página, e o arquivo `*-no-next` que ela usa.
      if (de.startsWith('next/')) {
        assert.ok(ehDoNext(item, caminho), `${caminho}: importa "${de}" fora da cola do Next`)
        continue
      }
      const interna = de.match(/^@\/registry\/wicomm\/(ui|lib|blocks)\/(.+)$/)
      if (interna) {
        const alvo = PECAS.find((p) => p.files.some((f) => f.path.startsWith(`registry/wicomm/${interna[1]}/${interna[2]}.`)))
        if (de === '@/registry/wicomm/lib/utils') assert.ok(regs.has('estilo'), `${caminho}: o cn vem do estilo`)
        else assert.ok(alvo && (alvo === item || regs.has(alvo.name)), `${caminho}: importa ${de} sem a dependência de registro`)
      } else assert.ok(npm.has(de), `${caminho}: importa "${de}" sem declarar no item ${item.name}`)
    }
  }
})

test('as versões do npm nas peças são fixas e são as que os testes rodaram', () => {
  const dev = JSON.parse(ler('package.json')).devDependencies
  for (const dep of Object.values(NPM)) {
    const [, nome, versao] = dep.match(/^(@?[^@]+)@(.+)$/)
    assert.match(versao, /^\d+\.\d+\.\d+$/, dep)
    assert.equal(dev[nome], versao, `${nome}: o registro pede ${versao}, os testes rodaram ${dev[nome]}`)
  }
})

// A página de exemplo e a cola do Next ficam fora: são do App Router (componente
// de servidor, `next/*`), e quem as prova é o `next build` do num-next-vazio.
test('toda peça tem teste dom que a importa', () => {
  const testes = readdirSync(join(RAIZ, 'test')).filter((f) => /\.test\.tsx?$/.test(f)).map((f) => ler(`test/${f}`)).join('\n')
  const semTeste = PECAS.flatMap((p) => p.files.filter((f) => !ehDoNext(p, f.path)).map((f) => f.path.replace(/\.tsx?$/, '')))
    .filter((p) => !testes.includes(`@/${p}"`) && !testes.includes(`@/${p}'`))
  assert.deepEqual(semTeste, [])
})

test('a descrição de cada peça começa pelo nome do equivalente no shadcn', () => {
  for (const p of REG.items) assert.match(p.description, /^[a-z][a-z/ -]+ — /, p.name)
})

// O que vai para o projeto do cliente não cita o produto de origem (nomes, ADRs, domínio).
const DOMINIO = /(?<![\p{L}\p{N}_])(job|jobs|loja|lojas|lojista|wake|vtex|ensō|enso|builder|izanagi|operador)(?![\p{L}\p{N}_])|\b(ADR|SPEC)[ -]?\d/iu

test('nada do produto de origem no que o registro instala', () => {
  const achados = []
  for (const caminho of arquivosDoRegistro()) {
    ler(caminho).split('\n').forEach((linha, i) => {
      if (DOMINIO.test(linha)) achados.push(`${caminho}:${i + 1}: ${linha.trim().slice(0, 100)}`)
    })
  }
  for (const item of REG.items) if (DOMINIO.test(`${item.title} ${item.description}`)) achados.push(`item ${item.name}`)
  assert.deepEqual(achados, [])
})

test('a busca de domínio morde (prova nos dois sentidos)', () => {
  for (const ruim of ['o Job terminou', 'na loja', 'Izanagi', 'o builder', 'ADR 0124', 'SPEC-065', 'o operador']) assert.ok(DOMINIO.test(ruim), ruim)
  for (const bom of ['denso', 'instrumento', 'operadores', 'jobless', 'CTRL-01']) assert.ok(!DOMINIO.test(bom), bom)
})

test('o shadcn build sai sem erro, na pasta da versão (o caminho padrão do build), com o código de cada peça', () => {
  const saida = join(RAIZ, 'public', 'r', `v${VERSAO}`)
  rmSync(join(RAIZ, 'public'), { recursive: true, force: true })
  execFileSync(process.execPath, [join(RAIZ, 'scripts', 'build.mjs')], { stdio: 'pipe' })
  for (const item of REG.items) {
    const caminho = join(saida, `${item.name}.json`)
    assert.ok(existsSync(caminho), `${item.name}.json em public/r/v${VERSAO}/`)
    const json = JSON.parse(readFileSync(caminho, 'utf8'))
    for (const f of json.files ?? []) assert.ok(f.content?.length > 0, `${item.name}: ${f.path} sem conteúdo`)
  }
})
