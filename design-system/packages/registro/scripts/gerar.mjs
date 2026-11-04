// Gera o `registry.json` do registro Wicomm (o item de estilo a partir do
// `tailwind-v4.css` de @wicomm/tokens e as peças a partir de `lib/itens.mjs`)
// e o desenho e o símbolo do logotipo embutidos na peça, a partir dos PNG do tema (MARCA-04).
//
//   node scripts/gerar.mjs             escreve os dois
//   node scripts/gerar.mjs --conferir  sai 1 se algum está velho
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { registro } from '../lib/registro.mjs'
import { pngsPelosPixels } from '../lib/png.mjs'
import { LINHAS_GERADAS, PECA_DO_LOGOTIPO, temaDoRegistro } from '../lib/tema.mjs'

const RAIZ = join(import.meta.dirname, '..')
const ALVO = join(RAIZ, 'registry.json')
const novo = JSON.stringify(registro(), null, 2) + '\n'
const PECA = join(RAIZ, PECA_DO_LOGOTIPO)
const peca = readFileSync(PECA, 'utf8')
let pecaNova = peca
for (const [linha, gerar] of LINHAS_GERADAS) {
  if (!linha.test(pecaNova)) throw new Error(`${PECA_DO_LOGOTIPO}: a linha gerada ${linha} sumiu`)
  pecaNova = pecaNova.replace(linha, () => gerar(temaDoRegistro()))
}

if (process.argv.includes('--conferir')) {
  let atual = ''
  try {
    atual = readFileSync(ALVO, 'utf8')
  } catch {}
  // Os PNG comparam pelos pixels: o negativo é deflate do Node, e os bytes mudam com o zlib de cada Node.
  if (pngsPelosPixels(peca) !== pngsPelosPixels(pecaNova)) {
    console.error(`${PECA_DO_LOGOTIPO}: o desenho ou o símbolo embutido não é o PNG do tema: rode \`npm run gerar -w @wicomm/registro\`.`)
    process.exitCode = 1
  }
  if (atual !== novo) {
    console.error('registry.json velho: rode `npm run gerar -w @wicomm/registro`.')
    process.exitCode = 1
  }
  if (!process.exitCode) console.log('registry.json e logotipo em dia.')
} else {
  writeFileSync(PECA, pecaNova)
  writeFileSync(ALVO, novo)
  console.log('registry.json e logotipo gerados.')
}
