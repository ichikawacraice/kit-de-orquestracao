// A prova do critério de pronto: num Next vazio, `shadcn init` com o estilo
// Wicomm, o registro `@wicomm` declarado no `components.json`, e
// `npx shadcn add @wicomm/<peça>` para CADA peça — e o `next build` (que
// compila e confere os tipos) passa com uma página que usa todas.
//
// Fica fora do `npm test`: baixa o Next e as dependências da rede e leva minutos.
//
//   node scripts/num-next-vazio.mjs [--pasta <onde criar o app>] [--manter]
import { execFileSync, spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { extname, join, normalize, resolve } from 'node:path'
import { VERSAO, registro } from '../lib/registro.mjs'

const NEXT = 'create-next-app@16.4.3'
const SHADCN = 'shadcn@4.21.5'

const RAIZ = join(import.meta.dirname, '..')
const args = process.argv.slice(2)
const i = args.indexOf('--pasta')
const base = i >= 0 ? resolve(args[i + 1]) : mkdtempSync(join(tmpdir(), 'wicomm-registro-'))
const app = join(base, 'app-vazio')
mkdirSync(base, { recursive: true })

// Assíncrono de propósito: o registro é servido por este mesmo processo, e uma
// chamada síncrona travaria o servidor enquanto o `shadcn add` pede a ele.
const rodar = (cmd, argv, cwd = app) =>
  new Promise((ok, falha) => {
    const filho = spawn(cmd, argv, { cwd, stdio: ['ignore', 'inherit', 'inherit'] })
    filho.on('error', falha)
    filho.on('exit', (codigo) => (codigo === 0 ? ok() : falha(new Error(`${cmd} ${argv.join(' ')} saiu ${codigo}`))))
  })

// 1. O registro, servido da pasta do build, no caminho versionado.
execFileSync(process.execPath, [join(RAIZ, 'scripts', 'build.mjs')], { stdio: 'inherit' })
const PUBLICO = join(RAIZ, 'public')
const servidor = createServer((req, res) => {
  const caminho = normalize(join(PUBLICO, decodeURIComponent(new URL(req.url, 'http://x').pathname)))
  if (!caminho.startsWith(PUBLICO) || !existsSync(caminho) || extname(caminho) !== '.json') {
    res.writeHead(404).end()
    return
  }
  res.writeHead(200, { 'content-type': 'application/json' }).end(readFileSync(caminho))
})
await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok))
const url = `http://127.0.0.1:${servidor.address().port}/r/v${VERSAO}`
console.log(`registro em ${url}`)

try {
  // 2. O Next vazio.
  await rodar('npx', ['-y', NEXT, app, '--ts', '--tailwind', '--app', '--no-eslint', '--no-src-dir', '--import-alias', '@/*', '--use-npm', '--turbopack', '--yes'], base)

  // 3. O estilo pelo `init`, e o registro no `components.json`.
  await rodar('npx', ['-y', SHADCN, 'init', `${url}/estilo.json`, '--yes'])
  const cfg = JSON.parse(readFileSync(join(app, 'components.json'), 'utf8'))
  cfg.registries = { '@wicomm': `${url}/{name}.json` }
  writeFileSync(join(app, 'components.json'), JSON.stringify(cfg, null, 2) + '\n')

  // 4. Cada peça, uma por vez: uma peça que só instala junto de outra falharia aqui.
  const pecas = registro().items.filter((p) => p.type === 'registry:ui').map((p) => p.name)
  for (const p of pecas) await rodar('npx', ['-y', SHADCN, 'add', `@wicomm/${p}`, '--yes'])

  // 5. Uma página que usa todas, e o build.
  writeFileSync(join(app, 'app', 'page.tsx'), readFileSync(join(RAIZ, 'test', 'fixtures', 'pagina-com-todas.tsx'), 'utf8'))
  await rodar('npx', ['next', 'build'])
  console.log(`\nOK: ${pecas.length} peças instaladas uma a uma e compiladas num Next vazio (${app}).`)
} finally {
  servidor.close()
  if (!args.includes('--manter') && i < 0) rmSync(base, { recursive: true, force: true })
}
