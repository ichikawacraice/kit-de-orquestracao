// Gera o `registry.json` do registro Wicomm: o item de estilo a partir do
// `tailwind-v4.css` de @wicomm/tokens e as peças a partir de `lib/itens.mjs`.
//
//   node scripts/gerar.mjs             escreve o registry.json
//   node scripts/gerar.mjs --conferir  sai 1 se o registry.json está velho
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { registro } from '../lib/registro.mjs'

const RAIZ = join(import.meta.dirname, '..')
const ALVO = join(RAIZ, 'registry.json')
const novo = JSON.stringify(registro(), null, 2) + '\n'

if (process.argv.includes('--conferir')) {
  let atual = ''
  try {
    atual = readFileSync(ALVO, 'utf8')
  } catch {}
  if (atual !== novo) {
    console.error('registry.json velho: rode `npm run gerar -w @wicomm/registro`.')
    process.exit(1)
  }
  console.log('registry.json em dia.')
} else {
  writeFileSync(ALVO, novo)
  console.log('registry.json gerado.')
}
