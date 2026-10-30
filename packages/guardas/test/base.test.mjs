// Cada guarda referencia a regra da base que confere, e a base e o pacote
// concordam: toda regra citada por uma guarda existe na base, e toda guarda
// que a base cita (`guarda:<nome>`) existe no pacote — ou está na lista do que
// ficou para depois, com o motivo.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

import { GUARDAS } from '../lib/index.mjs'

const BASE = join(import.meta.dirname, '..', '..', '..', 'plugins', 'wicomm', 'base')
const texto = ['DESIGN.md', 'ANATOMIA.md', 'CONVENCOES.md'].map((f) => readFileSync(join(BASE, f), 'utf8')).join('\n')
const README = readFileSync(join(import.meta.dirname, '..', 'README.md'), 'utf8')

/** Guardas que a base cita e o pacote ainda não tem, com o motivo. */
const PARA_DEPOIS = {
  'o-raster-da-marca-sai-do-token':
    'confere pixel de favicon e de lockup contra o token; depende dos scripts de raster da marca, que ainda não existem neste repositório',
}

test('o insumo existe: a base tem regras e o pacote tem guardas', () => {
  assert.ok(texto.length > 10_000)
  assert.ok(GUARDAS.length >= 25)
})

test('todo id de guarda é único e tem título e regra', () => {
  const ids = GUARDAS.map((g) => g.id)
  assert.equal(new Set(ids).size, ids.length)
  for (const g of GUARDAS) {
    assert.ok(g.titulo?.length > 5, `${g.id} sem título`)
    assert.ok(g.regras.length > 0, `${g.id} não cita regra`)
  }
})

test('toda regra que uma guarda cita existe na base', () => {
  const existentes = new Set([...texto.matchAll(/^### ([A-Z]+-\d{2}) · /gm)].map((m) => m[1]))
  assert.ok(existentes.size > 80)
  const fora = GUARDAS.flatMap((g) => g.regras.filter((r) => !existentes.has(r)).map((r) => `${g.id}: ${r}`))
  assert.deepEqual(fora, [])
})

test('toda guarda que a base cita existe no pacote, ou está para depois com motivo', () => {
  const citadas = [...new Set([...texto.matchAll(/guarda:([a-z0-9-]+)/g)].map((m) => m[1]))]
  assert.ok(citadas.length >= 15)
  const ids = new Set(GUARDAS.map((g) => g.id))
  assert.deepEqual(citadas.filter((c) => !ids.has(c) && !(c in PARA_DEPOIS)), [])
  for (const [c, motivo] of Object.entries(PARA_DEPOIS)) {
    assert.ok(citadas.includes(c), `${c} saiu da base: tire de PARA_DEPOIS`)
    assert.ok(!ids.has(c), `${c} já existe no pacote: tire de PARA_DEPOIS`)
    assert.ok(motivo.length > 40)
  }
})

test('o README lista toda guarda, com as regras que ela confere', () => {
  for (const g of GUARDAS) assert.match(README, new RegExp(`\\| \`${g.id}\` \\| ${g.regras.join(', ')} \\|`), `${g.id} fora do README`)
})
