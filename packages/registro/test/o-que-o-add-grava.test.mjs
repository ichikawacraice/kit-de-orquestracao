// O critério da fatia 3 do F345: mexer no registro por dentro (a pasta das peças virou `registry/design-system/`,
// o tema virou dado) não muda nada do que o `shadcn add @wicomm/<item>` grava num projeto. A fixture é o que o
// add gravava antes da mudança (gerada da `main` em 2a6e5cd); só muda com decisão, como um conserto de peça.
//
// Lento (o `shadcn build` e um `add` por item, uns 40 s), e sem rede: o registro é servido aqui mesmo.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, it } from 'node:test'
import { oQueOAddGrava } from '../scripts/o-que-o-add-grava.mjs'

const RAIZ = join(import.meta.dirname, '..')
const pasta = mkdtempSync(join(tmpdir(), 'registro-build-'))
after(() => rmSync(pasta, { recursive: true, force: true }))

it('o shadcn add de cada item grava os mesmos arquivos, com o mesmo conteúdo, que antes', async () => {
  execFileSync(process.execPath, [join(RAIZ, 'scripts', 'build.mjs'), '--saida', pasta], { stdio: 'ignore' })
  const antes = JSON.parse(readFileSync(join(RAIZ, 'test', 'fixtures', 'o-que-o-add-grava.json'), 'utf8'))
  const depois = await oQueOAddGrava(pasta)
  assert.deepEqual(Object.keys(depois.itens), Object.keys(antes.itens), 'os mesmos itens')
  for (const nome of Object.keys(antes.itens)) assert.deepEqual(depois.itens[nome], antes.itens[nome], `o add de ${nome}`)
})
