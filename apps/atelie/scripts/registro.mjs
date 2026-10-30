// Monta o registro (`shadcn build` de packages/registro) em `public/r/v{versao}/`,
// de onde o Next o serve no dev e o copia para `out/` no build. A pasta `r/` é
// limpa antes: o que o ateliê serve é só a versão do pacote de hoje.
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { VERSAO } from '@wicomm/registro/lib/registro.mjs'

const require = createRequire(import.meta.url)
const R = join(import.meta.dirname, '..', 'public', 'r')
rmSync(R, { recursive: true, force: true })
execFileSync(process.execPath, [require.resolve('@wicomm/registro/scripts/build.mjs'), '--saida', join(R, `v${VERSAO}`)], {
  stdio: 'inherit',
})
