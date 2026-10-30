// Monta os JSON do registro com o `shadcn build` em `public/r/v{versao}/`.
// A versão vai no caminho: o item do shadcn não tem campo de versão, e o
// projeto que instala fixa a versão na URL do `components.json`.
//
//   node scripts/build.mjs [--saida <pasta>]
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { VERSAO } from '../lib/registro.mjs'

const RAIZ = join(import.meta.dirname, '..')
const i = process.argv.indexOf('--saida')
const saida = i >= 0 ? resolve(process.argv[i + 1]) : join(RAIZ, 'public', 'r', `v${VERSAO}`)
// O `bin` do pacote é a mesma entrada do `exports`.
const cli = createRequire(import.meta.url).resolve('shadcn')

execFileSync(process.execPath, [cli, 'build', 'registry.json', '--output', saida], {
  cwd: RAIZ,
  stdio: 'inherit',
})
console.log(`registro v${VERSAO} em ${saida}`)
