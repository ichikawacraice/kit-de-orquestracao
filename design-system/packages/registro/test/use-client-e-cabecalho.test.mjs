// Dois defeitos que o `shadcn add` torna visíveis a cada atualização das peças (F408):
// 1. `"use client"` faltando onde a peça tem estado, efeito ou contexto PRÓPRIO: no Next (`rsc: true`) o hook roda no
//    servidor e quebra o render. Manipulador que chega por prop (`onClick={onAbrir}`) NÃO pede a diretiva, e pô-la
//    numa peça que exporta constante de estilo (`CASCO_DO_CARIMBO`) faz o servidor receber uma referência no lugar do
//    valor: a classe some em silêncio (medido num Next real). Por isso a regra olha o hook, não o manipulador.
// 2. O `shadcn add` apaga o comentário que antecede a PRIMEIRA instrução do arquivo (medido: `//`, `/* */` e `/** */`
//    somem; o da segunda instrução fica). O cabeçalho do `idioma-de-cor` mora, então, depois da primeira instrução.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

const RAIZ = join(import.meta.dirname, '..')
const PASTA = join(RAIZ, 'registry', 'design-system')
const arquivos = (pasta) =>
  readdirSync(pasta, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? arquivos(join(pasta, d.name)) : [join(pasta, d.name)]))
const PECAS = arquivos(PASTA).filter((f) => /\.tsx?$/.test(f))

/** O que só roda no cliente: qualquer hook (`useXxx(`, inclusive os da casa), contexto ou portal. */
const PRECISA_DO_CLIENTE = /\buse[A-Z]\w*\(|\bcreateContext\(|\bcreatePortal\(/

/** Só o código: tira os comentários, que citam `onClick` e `useState` sem os usar. */
const semComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

test('a detecção acha o que procura (o teste não passa por falta de insumo)', () => {
  assert.ok(PECAS.length > 40, `peças lidas: ${PECAS.length}`)
  assert.match('const r = React.useRef(null)', PRECISA_DO_CLIENTE)
  assert.match('const d = useDensidadeDaTabela()', PRECISA_DO_CLIENTE)
  assert.doesNotMatch('<button onClick={f}>', PRECISA_DO_CLIENTE)
  assert.doesNotMatch(semComentarios('/** usa useState( */\nconst a = 1'), PRECISA_DO_CLIENTE)
  const precisam = PECAS.filter((f) => PRECISA_DO_CLIENTE.test(semComentarios(readFileSync(f, 'utf8'))))
  assert.ok(precisam.length > 20, `peças que precisam do cliente: ${precisam.length}`)
})

test('toda peça que usa hook ou manipulador de evento abre com "use client"', () => {
  const faltam = PECAS.filter((f) => {
    const s = readFileSync(f, 'utf8')
    return PRECISA_DO_CLIENTE.test(semComentarios(s)) && !/^"use client"\n/.test(s)
  }).map((f) => f.slice(RAIZ.length + 1))
  assert.deepEqual(faltam, [])
})

test('o cabeçalho do idioma-de-cor não antecede a primeira instrução (o add o apagaria) e está presente', () => {
  const s = readFileSync(join(PASTA, 'lib', 'idioma-de-cor.ts'), 'utf8')
  assert.match(s, /^export type Tom\b/, 'a primeira linha é a primeira instrução, sem comentário antes')
  const cab = s.indexOf('O idioma de cor da Wicomm')
  assert.ok(cab > s.indexOf('export type Tom'), 'o cabeçalho vem depois da primeira instrução')
})

test('peça com "use client" não exporta constante de estilo: o servidor receberia uma referência e a classe sumiria', () => {
  // Só `ui/` e `blocks/`: a `lib/filtro-lembrado.ts` (hook + constante, anterior a esta regra) fica fora; ver o PR.
  const comDiretiva = PECAS.filter((f) => !f.includes('/lib/') && /^"use client"\n/.test(readFileSync(f, 'utf8')))
  assert.ok(comDiretiva.length > 20, `peças com a diretiva: ${comDiretiva.length}`)
  const constante = /^export const [A-Z][A-Z0-9_]+\b/m
  assert.match('export const CASCO_DO_CARIMBO =\n', constante)
  const erradas = comDiretiva
    .filter((f) => constante.test(semComentarios(readFileSync(f, 'utf8'))))
    .map((f) => f.slice(RAIZ.length + 1))
  assert.deepEqual(erradas, [])
})
