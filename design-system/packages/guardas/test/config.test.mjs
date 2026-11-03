// O arquivo de configuração nos dois nomes (F345): sem `--config`, o novo
// (`design/design-system.json`) e depois o antigo (`design/wicomm.json`); com
// `--config`, só o caminho dado — e ele tem de existir.
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'

import { lerConfig } from '../lib/index.mjs'

const pastas = []
after(() => pastas.forEach((p) => rmSync(p, { recursive: true, force: true })))
function projeto(arquivos) {
  const raiz = mkdtempSync(join(tmpdir(), 'guardas-config-'))
  pastas.push(raiz)
  mkdirSync(join(raiz, 'design'))
  for (const [nome, kit] of Object.entries(arquivos)) writeFileSync(join(raiz, 'design', nome), JSON.stringify({ guardas: { kit } }))
  return raiz
}

test('sem --config, o projeto com só o nome antigo é lido por ele', () => {
  const cfg = lerConfig(projeto({ 'wicomm.json': 'ui/antigo' }))
  assert.equal(cfg.kit, 'ui/antigo')
  assert.equal(cfg.origem, 'design/wicomm.json')
})

test('sem --config, com os dois nomes vale o novo', () => {
  const cfg = lerConfig(projeto({ 'wicomm.json': 'ui/antigo', 'design-system.json': 'ui/novo' }))
  assert.equal(cfg.kit, 'ui/novo')
  assert.equal(cfg.origem, 'design/design-system.json')
})

test('sem arquivo nenhum vale o padrão, sem origem', () => {
  assert.equal(lerConfig(projeto({})).origem, null)
})

test('com --config, vale o caminho dado, e o que não existe é erro', () => {
  const raiz = projeto({ 'wicomm.json': 'ui/antigo', 'design-system.json': 'ui/novo' })
  assert.equal(lerConfig(raiz, 'design/wicomm.json').kit, 'ui/antigo')
  assert.throws(() => lerConfig(raiz, 'design/outro.json'), /não existe/)
})
