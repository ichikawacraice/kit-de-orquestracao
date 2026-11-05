// O nome na cor da pessoa é só da conversa (COR-09): fora dela o nome segue
// neutro, e o mapa NOME_DA_PESSOA só é importado por ui/conversa.tsx.
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const RAIZ = join(import.meta.dirname, '..', 'registry', 'design-system')

function arquivos(pasta) {
  return readdirSync(pasta, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? arquivos(join(pasta, e.name)) : /\.tsx?$/.test(e.name) ? [join(pasta, e.name)] : []
  )
}

test('NOME_DA_PESSOA só sai de ui/monograma.tsx para ui/conversa.tsx', () => {
  const todos = arquivos(RAIZ)
  assert.ok(todos.length > 10, 'achou os arquivos do registro')
  const usam = todos
    .filter((f) => !f.endsWith('ui/monograma.tsx'))
    .filter((f) => /\bNOME_DA_PESSOA\b/.test(readFileSync(f, 'utf8')))
    .map((f) => relative(RAIZ, f))
  // A presença seria detectada: a conversa usa o mapa.
  assert.deepEqual(usam, ['ui/conversa.tsx'])
})
