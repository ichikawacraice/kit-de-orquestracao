// O que o `shadcn add` grava num projeto, item a item do registro: o caminho de
// cada arquivo e o sha256 do conteúdo, mais o `globals.css` que o estilo
// completa. É a prova de que mexer no registro por dentro (a pasta, o tema) não
// muda o que chega ao projeto que já o usa (F345).
//
// Roda sem rede: o registro é servido por este processo, e o `npm` que o `add`
// chama para instalar as dependências é um que não faz nada (a dependência não
// entra no que se compara; o `package.json` do registro já a fixa).
//
//   node scripts/o-que-o-add-grava.mjs [--registro <pasta do build>] [--tema <pasta>]
//
// Sem `--registro`, monta o build numa pasta temporária. Imprime o JSON.
import { execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { basename, join, relative, resolve, sep } from 'node:path'

const RAIZ = join(import.meta.dirname, '..')
const CLI = createRequire(import.meta.url).resolve('shadcn')

/** O projeto descartável: um Next com Tailwind v4 e `src/` nenhum, como o do `create-next-app`. */
function projetoVazio(pasta) {
  mkdirSync(join(pasta, 'app'), { recursive: true })
  writeFileSync(join(pasta, 'package.json'), JSON.stringify({ name: 'descartavel', private: true, dependencies: { next: '16.0.0', react: '19.0.0', 'react-dom': '19.0.0', tailwindcss: '4.1.0' } }))
  writeFileSync(join(pasta, 'tsconfig.json'), JSON.stringify({ compilerOptions: { paths: { '@/*': ['./*'] } } }))
  writeFileSync(join(pasta, 'app', 'globals.css'), '@import "tailwindcss";\n')
  writeFileSync(
    join(pasta, 'components.json'),
    JSON.stringify({
      $schema: 'https://ui.shadcn.com/schema.json',
      style: 'new-york',
      rsc: true,
      tsx: true,
      tailwind: { config: '', css: 'app/globals.css', baseColor: 'neutral', cssVariables: true },
      aliases: { components: '@/components', utils: '@/lib/utils', ui: '@/components/ui', lib: '@/lib', hooks: '@/hooks' },
      iconLibrary: 'lucide',
    }),
  )
}

const arquivos = (pasta) =>
  readdirSync(pasta, { recursive: true })
    .map((r) => join(pasta, r))
    .filter((p) => statSync(p).isFile())

/**
 * `{ itens: { <item>: { <arquivo>: sha256 } } }`: cada item instalado sozinho num projeto vazio (um item que só
 * instala junto de outro apareceria aqui), com o que ele gravou. `pasta`: o build do registro (os `<item>.json`);
 * `prefixo`: o do registro no `components.json`; `so`: só esses itens.
 */
export async function oQueOAddGrava(pasta, { prefixo = '@wicomm', so } = {}) {
  const tmp = mkdtempSync(join(tmpdir(), 'registro-add-'))
  const bin = join(tmp, 'bin')
  mkdirSync(bin)
  writeFileSync(join(bin, 'npm'), '#!/bin/sh\nexit 0\n')
  chmodSync(join(bin, 'npm'), 0o755)
  const servidor = createServer((req, res) => {
    const nome = basename(decodeURIComponent(new URL(req.url, 'http://x').pathname))
    let corpo
    try {
      corpo = readFileSync(join(pasta, nome))
    } catch {
      res.writeHead(404).end()
      return
    }
    res.writeHead(200, { 'content-type': 'application/json' }).end(corpo)
  })
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok))
  const url = `http://127.0.0.1:${servidor.address().port}`
  try {
    const nomes = readdirSync(pasta)
      .filter((f) => f.endsWith('.json') && f !== 'registry.json')
      .map((f) => f.slice(0, -5))
      .filter((n) => !so || so.includes(n))
      .sort()
    const itens = {}
    for (const nome of nomes) {
      const proj = join(tmp, nome)
      projetoVazio(proj)
      const cfg = JSON.parse(readFileSync(join(proj, 'components.json'), 'utf8'))
      cfg.registries = { [prefixo]: `${url}/{name}.json` }
      writeFileSync(join(proj, 'components.json'), JSON.stringify(cfg))
      await new Promise((ok, falha) => {
        let saida = ''
        const f = spawn(process.execPath, [CLI, 'add', `${prefixo}/${nome}`, '--yes', '--overwrite'], {
          cwd: proj,
          env: { ...process.env, PATH: `${bin}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH}` },
        })
        f.stdout.on('data', (d) => (saida += d))
        f.stderr.on('data', (d) => (saida += d))
        f.on('error', falha)
        f.on('exit', (c) => (c === 0 ? ok() : falha(new Error(`shadcn add ${prefixo}/${nome} saiu ${c}:\n${saida}`))))
      })
      itens[nome] = Object.fromEntries(
        arquivos(proj)
          .map((p) => [relative(proj, p).split(sep).join('/'), p])
          .filter(([r]) => !['components.json', 'package.json', 'tsconfig.json'].includes(r))
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([r, p]) => [r, createHash('sha256').update(readFileSync(p)).digest('hex')]),
      )
    }
    return { itens }
  } finally {
    servidor.close()
    rmSync(tmp, { recursive: true, force: true })
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const args = process.argv.slice(2)
  const opcao = (n) => (args.indexOf(n) >= 0 ? resolve(args[args.indexOf(n) + 1]) : undefined)
  let pasta = opcao('--registro')
  let temporaria
  if (!pasta) {
    temporaria = mkdtempSync(join(tmpdir(), 'registro-build-'))
    pasta = temporaria
    const tema = opcao('--tema')
    execFileSync(process.execPath, [join(RAIZ, 'scripts', 'build.mjs'), '--saida', pasta, ...(tema ? ['--tema', tema] : [])], { stdio: ['ignore', 'ignore', 'inherit'] })
  }
  try {
    process.stdout.write(JSON.stringify(await oQueOAddGrava(pasta), null, 2) + '\n')
  } finally {
    if (temporaria) rmSync(temporaria, { recursive: true, force: true })
  }
}
