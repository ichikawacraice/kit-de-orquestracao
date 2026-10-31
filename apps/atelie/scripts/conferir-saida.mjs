// Depois do `next build`: cada item do registro tem o JSON servido, a página do
// catálogo e os dois palcos em `out/`. Um item que o build deixou de fora
// reprova aqui, e não na mão de quem abre o ateliê.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
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
// A vitrine: todo token de @wicomm/tokens aparece numa página (`data-token`), e
// toda regra da base tem âncora na página do arquivo e linha no índice.
const tokens = JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', '..', 'packages', 'tokens', 'dist', 'tokens.json'), 'utf8'))
const esperados = new Set([
  ...Object.keys({ ...tokens.variaveis.claro, ...tokens.variaveis.escuro }).map((v) => `var:${v}`),
  ...tokens.cores.map((c) => `cores:${c}`),
  // Todo grupo-objeto do tokens.json, menos o das variáveis (já acima): grupo novo no pacote entra na cobrança sozinho.
  ...Object.entries(tokens)
    .filter(([g, v]) => g !== 'variaveis' && v && typeof v === 'object' && !Array.isArray(v))
    .flatMap(([g, v]) => Object.keys(v).map((k) => `${g}:${k}`)),
])
const paginas = readdirSync(OUT, { recursive: true, encoding: 'utf8' }).filter((f) => f.endsWith('.html') && !f.startsWith('palco/'))
const html = paginas.map((f) => readFileSync(join(OUT, f), 'utf8')).join('\n')
const vistos = new Set([...html.matchAll(/data-token="([^"]+)"/g)].flatMap((m) => m[1].split(' ')))
// A lista não é vazia: sem isto, um build que perdeu as páginas passaria (CONV-14).
if (esperados.size < 100) faltam.push(`tokens.json com só ${esperados.size} tokens: a leitura quebrou`)
for (const t of esperados) if (!vistos.has(t)) faltam.push(`token sem página na vitrine: ${t}`)
for (const t of vistos) if (!esperados.has(t)) faltam.push(`a vitrine mostra um token que o pacote não tem: ${t}`)

const BASE = join(import.meta.dirname, '..', '..', '..', 'plugins', 'wicomm', 'base')
const indice = existsSync(join(OUT, 'regras/index.html')) ? readFileSync(join(OUT, 'regras/index.html'), 'utf8') : ''
let regras = 0
for (const [id, arquivo] of [['design', 'DESIGN.md'], ['anatomia', 'ANATOMIA.md'], ['convencoes', 'CONVENCOES.md']]) {
  const pagina = join(OUT, `regras/${id}/index.html`)
  const conteudo = existsSync(pagina) ? readFileSync(pagina, 'utf8') : ''
  for (const [, codigo] of readFileSync(join(BASE, arquivo), 'utf8').matchAll(/^### ([A-Z]+-\d{2}) · /gm)) {
    regras++
    if (!conteudo.includes(`id="${codigo}"`)) faltam.push(`regra sem âncora em /regras/${id}/: ${codigo}`)
    if (!indice.includes(`/regras/${id}/#${codigo}"`)) faltam.push(`regra fora do índice /regras/: ${codigo}`)
  }
}
if (regras < 100) faltam.push(`a base com só ${regras} regras: a leitura quebrou`)

if (faltam.length) {
  console.error(`faltam na saída do build:\n  ${faltam.join('\n  ')}`)
  process.exit(1)
}
console.log(`saída conferida: ${registro().items.length} itens, registro v${VERSAO} em out/r/v${VERSAO}/; vitrine com ${esperados.size} tokens e ${regras} regras`)
