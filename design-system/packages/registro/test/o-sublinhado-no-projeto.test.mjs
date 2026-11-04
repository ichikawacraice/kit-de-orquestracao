// O sublinhado do link e o da ajuda (F382) chegam ao projeto pelo `globals.css` que o `shadcn add @wicomm/estilo`
// completa. O shadcn reescreve o CSS do item: um `@media` com `&:hover` aninhado saía estragado
// (`@media (hover:hover: hover)` e um `@media` vazio), e a fixture do add, que guarda só hashes, não via.
// A prova: o bloco `@utility` que o add grava é o mesmo do `@wicomm/tokens/tailwind-v4.css` (que o teste dos
// tokens compila com o Tailwind).
//
// Lento (o `shadcn build` e um `add`), e sem rede: o registro é servido aqui mesmo.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, it } from 'node:test'
import { oQueOAddGrava } from '../scripts/o-que-o-add-grava.mjs'

const RAIZ = join(import.meta.dirname, '..')
const TOKENS = readFileSync(join(RAIZ, '..', 'tokens', 'dist', 'tailwind-v4.css'), 'utf8')
const pasta = mkdtempSync(join(tmpdir(), 'registro-build-'))
after(() => rmSync(pasta, { recursive: true, force: true }))

/** O bloco `@utility <nome> { … }` inteiro, com as chaves aninhadas, e o espaço normalizado. */
function utilitario(css, nome) {
  const inicio = css.indexOf(`@utility ${nome} {`)
  if (inicio < 0) return undefined
  let nivel = 0
  for (let i = css.indexOf('{', inicio); i < css.length; i++) {
    if (css[i] === '{') nivel++
    else if (css[i] === '}' && --nivel === 0) return css.slice(inicio, i + 1).replace(/\s+/g, ' ')
  }
  return undefined
}

it('o shadcn add do estilo grava os utilitários do sublinhado iguais aos do pacote', async () => {
  execFileSync(process.execPath, [join(RAIZ, 'scripts', 'build.mjs'), '--saida', pasta], { stdio: 'ignore', timeout: 300_000, killSignal: 'SIGKILL' })
  let globals = ''
  await oQueOAddGrava(pasta, {
    so: ['estilo'],
    aoGravar: (_nome, projeto) => {
      globals = readFileSync(join(projeto, 'app', 'globals.css'), 'utf8')
    },
  })
  assert.ok(globals.length > 0, 'o add gravou o globals.css')
  for (const nome of ['sublinhado-de-link', 'sublinhado-de-ajuda']) {
    const doPacote = utilitario(TOKENS, nome)
    assert.ok(doPacote, `${nome} existe no pacote`)
    assert.equal(utilitario(globals, nome), doPacote, `${nome} chega ao projeto como no pacote`)
  }
  // O hover do link chega como variante: é o que o shadcn não estraga.
  assert.match(utilitario(globals, 'sublinhado-de-link'), /@variant hover \{ text-decoration-color: currentColor; \}/)
})
