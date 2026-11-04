// Gera o `registry.json` do registro Wicomm (o item de estilo a partir do
// `tailwind-v4.css` de @wicomm/tokens e as peças a partir de `lib/itens.mjs`)
// e o desenho do logotipo embutido na peça, a partir dos PNG do tema (MARCA-04).
//
//   node scripts/gerar.mjs             escreve os dois
//   node scripts/gerar.mjs --conferir  sai 1 se algum está velho
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { registro } from '../lib/registro.mjs'
import { LINHA_DO_DESENHO, PECA_DO_LOGOTIPO, linhaDoDesenho, temaDoRegistro } from '../lib/tema.mjs'

const RAIZ = join(import.meta.dirname, '..')
const ALVO = join(RAIZ, 'registry.json')
const novo = JSON.stringify(registro(), null, 2) + '\n'
const PECA = join(RAIZ, PECA_DO_LOGOTIPO)
const peca = readFileSync(PECA, 'utf8')
if (!LINHA_DO_DESENHO.test(peca)) throw new Error(`${PECA_DO_LOGOTIPO}: a linha do desenho (const DESENHO_DO_LOGOTIPO) sumiu`)
const pecaNova = peca.replace(LINHA_DO_DESENHO, () => linhaDoDesenho(temaDoRegistro()))

if (process.argv.includes('--conferir')) {
  let atual = ''
  try {
    atual = readFileSync(ALVO, 'utf8')
  } catch {}
  if (peca !== pecaNova) {
    console.error(`${PECA_DO_LOGOTIPO}: o desenho embutido não é o PNG do tema: rode \`npm run gerar -w @wicomm/registro\`.`)
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
