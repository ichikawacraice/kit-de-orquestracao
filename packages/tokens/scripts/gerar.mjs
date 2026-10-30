#!/usr/bin/env node
// Gera dist/ a partir de fonte/*.tokens.json.
//   node scripts/gerar.mjs                 grava dist/
//   node scripts/gerar.mjs --conferir      só confere: sai com 1 se dist/ está velho
//   node scripts/gerar.mjs --marca <arq>   usa outro arquivo de marca (o slot)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { saidas } from '../lib/saidas.mjs'

const DIST = join(import.meta.dirname, '..', 'dist')
const args = process.argv.slice(2)
const conferir = args.includes('--conferir')
const i = args.indexOf('--marca')
const marca = i >= 0 ? resolve(args[i + 1] ?? '') : undefined

try {
  const arquivos = saidas(marca ? { marca } : undefined)
  if (conferir) {
    const velhos = Object.entries(arquivos).filter(([nome, texto]) => {
      try {
        return readFileSync(join(DIST, nome), 'utf8') !== texto
      } catch {
        return true
      }
    })
    if (velhos.length) {
      console.error(`dist/ está velho: ${velhos.map(([n]) => n).join(', ')}. Rode \`npm run gerar\`.`)
      process.exit(1)
    }
    console.log(`dist/ em dia (${Object.keys(arquivos).length} arquivos).`)
  } else {
    mkdirSync(DIST, { recursive: true })
    for (const [nome, texto] of Object.entries(arquivos)) writeFileSync(join(DIST, nome), texto)
    console.log(`gerados: ${Object.keys(arquivos).join(', ')}`)
  }
} catch (erro) {
  console.error(`falha ao gerar os tokens: ${erro.message}`)
  process.exit(1)
}
