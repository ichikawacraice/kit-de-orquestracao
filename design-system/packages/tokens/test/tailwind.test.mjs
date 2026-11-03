// A saída compila no Tailwind v4 de verdade, e cada token vira a classe esperada.
//
// Classe que não existe não dá erro em Tailwind nenhum: ela simplesmente não
// gera regra, e o elemento fica sem o estilo. Por isso o teste pede a regra de
// cada classe, e prova com uma classe inventada que a ausência é medível.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { compile } from '@tailwindcss/node'

const RAIZ = join(import.meta.dirname, '..')
const DIST = join(RAIZ, 'dist')
const INVENTADA = 'bg-cor-que-nao-existe'

/** O corpo da primeira regra de um seletor (o texto entre as chaves), ou null. */
function regra(css, seletor) {
  const i = css.indexOf(`${seletor} {`)
  if (i < 0) return null
  return css.slice(i + seletor.length + 2, css.indexOf('}', i)).replace(/\s+/g, ' ').trim()
}

const CLASSES = {
  'bg-primary': /var\(--primary\)/,
  'text-foreground-2': /var\(--foreground-2\)/,
  'bg-terminal': /var\(--terminal\)/,
  'border-input': /var\(--input\)/,
  'rounded-ctrl': /var\(--raio-ctrl\)/,
  'rounded-painel': /var\(--raio-painel\)/,
  'rounded-md': /calc\(var\(--radius\) - 2px\)/,
  'rounded-lg': /var\(--radius\)/,
  'duration-modal-abre': /220ms/,
  'duration-cor': /150ms/,
  'delay-veu': /120ms/,
  'delay-espiada-abre': /250ms/,
  'shadow-linha-ativa': /inset 2px 0 0 var\(--tw-shadow-color, var\(--primary\)\)/,
  'font-archivo': /font-family: var\(--font-archivo\), sans-serif/,
  'ease-abre': /cubic-bezier\(0\.16, 1, 0\.3, 1\)/,
  'ease-fecha': /cubic-bezier\(0\.4, 0, 1, 1\)/,
  'h-ctrl': /height: 30px/,
  'size-ctrl': /width: 30px/,
  'max-w-medida': /78ch/,
  'text-legenda': /font-size: 11px/,
  'text-controle': /font-size: 13px/,
  'font-sans': /var\(--font-archivo\)/,
  'animate-accordion-down': /accordion-down 200ms/,
  superficie: /var\(--superficie-sombra\)/,
  'superficie-flutuante': /var\(--superficie-sombra-flutuante\)/,
  'anel-de-controle': /inset 0 0 0 1px var\(--input\)/,
  'bg-primary-gradient': /var\(--primary-gradient\)/,
  't-display': /font-size: 23px/,
  't-medida': /tabular-nums/,
  painel: /var\(--raio-painel\)/,
}
const esc = (c) => '.' + c.replace(/\//g, '\\/').replace(/:/g, '\\:')

describe('Tailwind v4: `@import "@wicomm/tokens/tailwind-v4.css"`', async () => {
  const compilador = await compile('@import "tailwindcss";\n@import "./dist/tailwind-v4.css";', { base: RAIZ, onDependency() {} })
  const css = compilador.build([...Object.keys(CLASSES), 'bg-primary/10', 'bg-terminal/95', 'dark:bg-card', 'p-4', INVENTADA])

  it('a classe inventada não gera nada — a ausência é medível', () => {
    assert.ok(!css.includes('cor-que-nao-existe'))
  })

  it('cada token gera a sua classe, com o valor do token', () => {
    const faltas = Object.entries(CLASSES).filter(([c, re]) => !re.test(regra(css, esc(c)) ?? '')).map(([c]) => `${c}: ${regra(css, esc(c))}`)
    assert.deepEqual(faltas, [])
  })

  it('o alfa sai por `color-mix` sobre a variável — a regra de `bg-primary/10` existe', () => {
    assert.match(css, /\.bg-primary\\\/10 \{[^}]*color-mix\([^)]*var\(--primary\) 10%/)
    assert.match(css, /\.bg-terminal\\\/95 \{[^}]*color-mix\([^)]*var\(--terminal\) 95%/)
  })

  it('MOV-03 · o atraso também vai na variável que a animação de entrada lê (vale com variante)', () => {
    assert.match(regra(css, '.delay-veu') ?? '', /--tw-animation-delay: 120ms/)
  })

  it('a base pinta a borda padrão com o token decorativo e o body com o chão e a tinta', () => {
    // Sem isto, no v4 toda `border` sai na cor do texto: a grade de 1px em tudo.
    const base = css.slice(css.indexOf('@layer base'))
    assert.match(base, /::file-selector-button \{\s*border-color: var\(--border\)/)
    assert.match(base, /body \{\s*background-color: var\(--background\);\s*color: var\(--foreground\)/)
    // E ela VENCE o preflight: vem depois do `border: 0 solid` dele (com o import na ordem do README).
    assert.ok(css.lastIndexOf('border-color: var(--border)') > css.indexOf('border: 0 solid'), 'o preflight vence a borda do pacote')
  })

  it('o escuro é pela classe `.dark`, como na origem', () => {
    assert.match(css, /\.dark\\:bg-card:is\(\.dark \*\)/)
  })

  it('o espaçamento do Tailwind fica intacto: o pacote não declara `--spacing`', () => {
    for (const arq of ['tailwind-v4.css', 'tokens.css']) assert.ok(!/--spacing\s*:/.test(readFileSync(join(DIST, arq), 'utf8')), arq)
    assert.match(css, /--spacing: 0\.25rem/)
  })

  it('as vozes ficam na camada `components`: a utilitária ao lado ainda ajusta', () => {
    const componentes = css.slice(css.indexOf('@layer components'))
    assert.ok(componentes.includes('.t-display {'))
  })
})
