// Monta um projeto de teste numa pasta temporária: o fixture limpo, mais as
// camadas pedidas por cima (um arquivo da camada substitui o do limpo).
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

export const FIXTURES = join(import.meta.dirname, 'fixtures')

export function montar(...camadas) {
  const raiz = mkdtempSync(join(tmpdir(), 'wicomm-guardas-'))
  cpSync(join(FIXTURES, 'limpo'), raiz, { recursive: true })
  for (const c of camadas) {
    if (typeof c === 'string') cpSync(join(FIXTURES, c), raiz, { recursive: true })
    else for (const [arquivo, texto] of Object.entries(c)) escrever(raiz, arquivo, texto)
  }
  return raiz
}

export function escrever(raiz, arquivo, texto) {
  mkdirSync(dirname(join(raiz, arquivo)), { recursive: true })
  writeFileSync(join(raiz, arquivo), texto)
}

export const ler = (raiz, arquivo) => readFileSync(join(raiz, arquivo), 'utf8')
export const apagar = (raiz) => rmSync(raiz, { recursive: true, force: true })
