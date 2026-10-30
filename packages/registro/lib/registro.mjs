import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { estiloDoShadcn } from './css.mjs'
import { BLOCOS, NPM, PECAS } from './itens.mjs'

const RAIZ = join(import.meta.dirname, '..')
const require = createRequire(import.meta.url)

/** A versão do registro é a do pacote — e vai no caminho da URL (`/r/v{versao}/`). */
export const VERSAO = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8')).version

export function tokensCss() {
  return readFileSync(require.resolve('@wicomm/tokens/tailwind-v4.css'), 'utf8')
}

/**
 * O que o CLI do shadcn acrescenta ao `@theme` quando vê `--radius`, e o tema
 * da Wicomm não quer: `rounded-xl` como `--radius × 1,4` (14px) e `rounded-2xl`
 * como `× 1,8` (18px). A escala da base (FORMA-01) usa o `xl` de 12px (agrupador)
 * e o `2xl` de 16px (container), que são os do próprio Tailwind — declarados aqui
 * para o CLI não os trocar.
 */
const RAIOS_DO_TAILWIND = {
  'radius-xl': '0.75rem',
  'radius-2xl': '1rem',
  'radius-3xl': '1.5rem',
  'radius-4xl': '2rem',
}

/**
 * O item de estilo: os tokens no `globals.css` do projeto, o `cn` e a animação
 * de entrada das peças. `extends: "none"`: o `init` com ele não traz o estilo
 * base do shadcn (outro `cn`, outra escala de raio, outra base de página).
 */
export function estilo() {
  const { cssVars, css } = estiloDoShadcn(tokensCss())
  return {
    name: 'estilo',
    type: 'registry:style',
    extends: 'none',
    title: 'Estilo Wicomm',
    description:
      'style/theme — os tokens da Wicomm (@wicomm/tokens) no globals.css: cores dos dois temas, raios, movimento, superfícies e as vozes de texto, mais o cn. Toda peça depende dele.',
    dependencies: [NPM.animar, NPM.clsx, NPM.merge],
    files: [{ path: 'registry/wicomm/lib/utils.ts', type: 'registry:lib' }],
    cssVars: { ...cssVars, theme: { ...cssVars.theme, ...RAIOS_DO_TAILWIND } },
    css: { '@import "tw-animate-css"': {}, ...css },
  }
}

export function registro() {
  return {
    $schema: 'https://ui.shadcn.com/schema/registry.json',
    name: 'wicomm',
    homepage: 'https://github.com/wicomm-projects/wicomm-design-system',
    items: [estilo(), ...PECAS, ...BLOCOS],
  }
}
