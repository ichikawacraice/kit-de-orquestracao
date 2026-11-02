// Monta os JSON do registro com o `shadcn build` em `public/r/v{versao}/`.
// A versão vai no caminho: o item do shadcn não tem campo de versão, e o
// projeto que instala fixa a versão na URL do `components.json`.
//
//   node scripts/build.mjs [--saida <pasta>] [--tema <pasta do tema>]
//
// Com `--tema` (outro que não o padrão, `temas/wicomm/`), o build monta o
// registro numa pasta temporária: o `registry.json` com o prefixo e os tokens do
// tema, e o código das peças com o logotipo e o rótulo dele (`lib/tema.mjs`).
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { VERSAO, registro } from '../lib/registro.mjs'
import { arquivoComOTema, ePadrao, temaDoRegistro } from '../lib/tema.mjs'

const RAIZ = join(import.meta.dirname, '..')
const args = process.argv.slice(2)
// Relativo a quem chamou: o `npm run -w` roda o script dentro do pacote, e o INIT_CWD guarda a pasta de origem.
const opcao = (nome) => (args.indexOf(nome) >= 0 ? resolve(process.env.INIT_CWD ?? process.cwd(), args[args.indexOf(nome) + 1] ?? '') : undefined)
const saida = opcao('--saida') ?? join(RAIZ, 'public', 'r', `v${VERSAO}`)
const tema = temaDoRegistro(opcao('--tema'))
// O `bin` do pacote é a mesma entrada do `exports`.
const cli = createRequire(import.meta.url).resolve('shadcn')

let cwd = RAIZ
if (!ePadrao(tema)) {
  cwd = mkdtempSync(join(tmpdir(), `registro-${tema.meta.id}-`))
  writeFileSync(join(cwd, 'registry.json'), JSON.stringify(registro(tema), null, 2) + '\n')
  const fonte = join(RAIZ, 'registry')
  for (const r of readdirSync(fonte, { recursive: true })) {
    if (statSync(join(fonte, r)).isDirectory()) continue
    const caminho = ['registry', ...relative(RAIZ, join(fonte, r)).split(sep).slice(1)].join('/')
    mkdirSync(dirname(join(cwd, caminho)), { recursive: true })
    writeFileSync(join(cwd, caminho), arquivoComOTema(caminho, tema))
  }
}

try {
  execFileSync(process.execPath, [cli, 'build', 'registry.json', '--output', saida], { cwd, stdio: 'inherit' })
} finally {
  if (cwd !== RAIZ) rmSync(cwd, { recursive: true, force: true })
}
console.log(`registro v${VERSAO} (tema ${tema.meta.id}) em ${saida}`)
