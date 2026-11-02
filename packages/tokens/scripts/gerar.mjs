#!/usr/bin/env node
// Gera dist/ a partir de fonte/*.tokens.json.
//   node scripts/gerar.mjs                  grava dist/
//   node scripts/gerar.mjs --conferir       só confere: sai com 1 se dist/ está velho
//   node scripts/gerar.mjs --tema <pasta>   usa outro tema (temas/<id>/: cores e fonte); o tema é conferido antes
//   node scripts/gerar.mjs --marca <arq>    usa outro arquivo de marca (só o slot das cores)
//   node scripts/gerar.mjs --saida <pasta>  grava (ou confere) nessa pasta em vez de dist/
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { saidas } from '../lib/saidas.mjs'
import { avisosDoTema, lerTema } from '../lib/tema.mjs'

const args = process.argv.slice(2)
const conferir = args.includes('--conferir')
const opcao = (nome) => {
  const i = args.indexOf(nome)
  // Relativo a quem chamou: o `npm run -w` roda o script dentro do pacote, e o INIT_CWD guarda a pasta de origem.
  return i >= 0 ? resolve(process.env.INIT_CWD ?? process.cwd(), args[i + 1] ?? '') : undefined
}
const marca = opcao('--marca')
const tema = opcao('--tema')
const DIST = opcao('--saida') ?? join(import.meta.dirname, '..', 'dist')

try {
  if (marca && tema) throw new Error('use `--tema` ou `--marca`, não os dois: o tema já traz as cores')
  const arquivos = saidas(tema ? { tema } : marca ? { marca } : undefined)
  if (tema) for (const aviso of avisosDoTema(lerTema(tema))) console.error(`aviso: ${aviso}`)
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
