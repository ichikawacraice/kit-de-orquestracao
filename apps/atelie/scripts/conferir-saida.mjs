// Depois do `next build`: cada item do registro tem o JSON servido, a página do
// catálogo e os dois palcos em `out/`. Um item que o build deixou de fora
// reprova aqui, e não na mão de quem abre o ateliê.
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { VERSAO, registro } from '@wicomm/registro/lib/registro.mjs'

const OUT = join(import.meta.dirname, '..', 'out')
const faltam = []
for (const { name } of registro().items) {
  for (const arquivo of [
    `r/v${VERSAO}/${name}.json`,
    `catalogo/${name}/index.html`,
    `palco/claro/${name}/index.html`,
    `palco/escuro/${name}/index.html`,
  ]) {
    if (!existsSync(join(OUT, arquivo))) faltam.push(arquivo)
  }
}
if (!existsSync(join(OUT, `r/v${VERSAO}/registry.json`))) faltam.push(`r/v${VERSAO}/registry.json`)
if (faltam.length) {
  console.error(`faltam na saída do build:\n  ${faltam.join('\n  ')}`)
  process.exit(1)
}
console.log(`saída conferida: ${registro().items.length} itens, registro v${VERSAO} em out/r/v${VERSAO}/`)
