// O que os pacotes publicam muda só com versão nova: o publicar-pacotes só
// publica a versão do package.json que o registro ainda não tem, então mudar o
// dist dos tokens (ou a lib das guardas) sem subir o "version" deixa o projeto
// que instala na versão velha sem aviso. A guarda compara o que o pacote publica
// (o campo "files") com o commit que trouxe a versão atual; diferença reprova.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const RAIZ = join(import.meta.dirname, '..')
const PACOTES = ['packages/tokens', 'packages/guardas']

const git = (...args) => execFileSync('git', args, { cwd: RAIZ, encoding: 'utf8' }).trim()

for (const dir of PACOTES) {
  const pkg = JSON.parse(readFileSync(join(RAIZ, dir, 'package.json'), 'utf8'))

  test(`${pkg.name}: o que o pacote publica não muda sem subir a versão (${pkg.version})`, (t) => {
    // O commit que trouxe a versão atual. Versão que a história ainda não tem
    // (subida neste PR, antes do commit) é nova, e tudo pode mudar com ela; num
    // clone raso (o CI do publicar-pacotes) o único commit compara consigo mesmo.
    let fixou
    try {
      fixou = git('log', '-1', '--format=%H', '-S', `"version": "${pkg.version}"`, '--', `${dir}/package.json`)
    } catch {
      return t.skip('sem git')
    }
    if (!fixou) return

    const publicados = pkg.files.map((f) => `${dir}/${f}`)
    const mudou = git('diff', '--name-only', fixou, '--', ...publicados)
    assert.equal(
      mudou,
      '',
      `${pkg.name} mudou desde a ${pkg.version} (${fixou.slice(0, 7)}) sem subir o "version" de ${dir}/package.json:\n${mudou}\n` +
        'Suba a versão no mesmo PR para o publicar-pacotes publicar (em 0.x o projeto instala com ^0.1.x: só o patch chega sem trocar o package.json dele).',
    )
  })
}
