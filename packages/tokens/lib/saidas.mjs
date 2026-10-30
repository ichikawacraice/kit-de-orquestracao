// As saídas do pacote, todas de um modelo só montado a partir da fonte:
// variáveis CSS puras, o tema do Tailwind v4 e o JSON. Só Tailwind v4 (Q640):
// projeto em v3 migra antes de receber os tokens.
// O mesmo valor nunca é escrito duas vezes: cada saída lê o modelo.
import { alvo, cru, folhas, lerFonte, resolver, TEMAS, variaveis } from './ler.mjs'

const CABECALHO = (arquivo) =>
  `/* @wicomm/tokens — ${arquivo}. GERADO de fonte/*.tokens.json por \`npm run gerar\`: não edite à mão. */`

const kebab = (s) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)

/** Nome de família com espaço vai entre aspas; var() e genéricos, não. */
const familia = (nome) => (/\s/.test(nome) && !nome.startsWith('var(') ? `"${nome}"` : nome)
export const pilha = (nomes) => nomes.map(familia).join(', ')
const bezier = (v) => `cubic-bezier(${v.join(', ')})`

/**
 * As utilitárias que gastam os tokens de superfície. São código, não token —
 * cada uma só junta variáveis —, mas moram aqui para que quem as desenha e o
 * token que elas gastam não se separem (COR-11: o anel de controle usa `input`).
 */
const UTILIDADES = {
  superficie: { 'background-color': 'var(--card)', 'box-shadow': 'var(--superficie-sombra)' },
  'superficie-alta': { 'background-color': 'var(--card)', 'box-shadow': 'var(--superficie-sombra-alta)' },
  'superficie-flutuante': { 'background-color': 'var(--popover)', 'box-shadow': 'var(--superficie-sombra-flutuante)' },
  'anel-de-controle': { 'box-shadow': 'inset 0 0 0 1px var(--input)' },
  'bg-primary-gradient': { 'background-image': 'var(--primary-gradient)', 'background-color': 'var(--primary)' },
}

/** O painel é peça (camada `components`), como as vozes. */
const PAINEL = { 'background-color': 'var(--card)', 'border-radius': 'var(--raio-painel)', 'box-shadow': 'var(--sombra-painel)' }

/**
 * A base que a origem aplica a toda página: a borda padrão é o token decorativo
 * (sem isto, no v4 toda `border` sai na cor do texto — a grade de 1px em tudo)
 * e o `body` pinta o chão e a tinta do tema.
 */
const BASE = `@layer base {
  *, ::after, ::before, ::backdrop, ::file-selector-button {
    border-color: var(--border);
  }
  body {
    background-color: var(--background);
    color: var(--foreground);
  }
}`

export const KEYFRAMES = {
  'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
  'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
}

/** Uma voz (typography composta) em declarações CSS. Cor por alias vira var(): a voz segue o tema. */
function voz(arvore, valorCru) {
  const decl = {}
  for (const [prop, v] of Object.entries(valorCru)) {
    const ref = alvo(v)
    let css
    if (ref?.startsWith('cor.')) css = `var(--${ref.slice(4)})`
    else {
      const r = resolver(arvore, v, 'claro')
      css = Array.isArray(r) ? pilha(r) : String(r)
    }
    decl[kebab(prop)] = css
  }
  return decl
}

const valores = (arvore, grupo, fn = (x) => x) =>
  Object.fromEntries(folhas(grupo ?? {}).map((f) => [f.chave, fn(resolver(arvore, cru(f.no, 'claro'), 'claro'))]))

/** O modelo de onde todas as saídas saem. */
export function modelo(opcoes) {
  const a = lerFonte(opcoes)
  const vars = variaveis(a)
  const t = a.tipo
  const m = a.movimento
  const animacoes = Object.fromEntries(
    folhas(m.animacao).map((f) => {
      const v = resolver(a, f.no.$value, 'claro')
      return [f.chave, `${v.keyframes} ${v.duracao} ${bezier(v.curva)}`]
    }),
  )
  return {
    vars,
    cores: folhas(a.cor).map((f) => f.chave),
    raios: {
      lg: 'var(--radius)',
      md: 'calc(var(--radius) - 2px)',
      sm: 'calc(var(--radius) - 4px)',
      ...Object.fromEntries(folhas(a.raio).filter((f) => f.chave.startsWith('raio-')).map((f) => [f.chave.slice(5), `var(--${f.chave})`])),
    },
    familias: valores(a, t.familia),
    tamanhos: valores(a, t.tamanho),
    vozes: Object.fromEntries(folhas(t.vozes).map((f) => [f.chave, voz(a, f.no.$value)])),
    duracoes: valores(a, m.duracao),
    atrasos: valores(a, m.atraso),
    curvas: valores(a, m.curva, bezier),
    animacoes,
    sombras: valores(a, a['sombra-de-classe']),
    alturas: valores(a, a.medida.altura),
    larguras: valores(a, a.medida.largura),
  }
}

const bloco = (seletor, decl, recuo = '') =>
  `${recuo}${seletor} {\n${Object.entries(decl).map(([p, v]) => `${recuo}  ${p}: ${v};`).join('\n')}\n${recuo}}`

function blocosDeTema(md) {
  return [
    bloco(':root', { 'color-scheme': 'light', ...md.vars.claro }),
    bloco('.dark', { 'color-scheme': 'dark', ...md.vars.escuro }),
  ].join('\n\n')
}

/** As variáveis CSS puras: `:root` (claro) e `.dark` (escuro). Serve a qualquer projeto. */
export function css(md) {
  return `${CABECALHO('tokens.css')}\n\n${blocosDeTema(md)}\n`
}

function keyframesCss(recuo) {
  return Object.entries(KEYFRAMES)
    .map(([nome, passos]) => `${recuo}@keyframes ${nome} {\n${Object.entries(passos).map(([p, d]) => bloco(p, d, recuo + '  ')).join('\n')}\n${recuo}}`)
    .join('\n')
}

/**
 * O tema do Tailwind v4: as variáveis, o `@theme inline` que dá classe a elas,
 * as utilitárias e as vozes. Uso: `@import "tailwindcss"; @import "@wicomm/tokens/tailwind-v4.css";`
 *
 * O que NÃO entra, e por quê: `--spacing` e `--font-size` da origem. No v4,
 * `--spacing` é a base de TODO degrau de espaço (`p-4` = 4 × `--spacing`), e o
 * `.35rem` da origem — inerte no v3 da origem — alargaria o espaçamento inteiro em 40%.
 */
export function tailwindV4(md) {
  const tema = [
    ...md.cores.map((c) => `--color-${c}: var(--${c});`),
    ...Object.entries(md.raios).map(([k, v]) => `--radius-${k}: ${v};`),
    `--font-sans: ${pilha(md.familias.sans)};`,
    ...Object.entries(md.tamanhos).map(([k, v]) => `--text-${k}: ${v};`),
    ...Object.entries(md.larguras).map(([k, v]) => `--container-${k}: ${v};`),
    ...Object.entries(md.curvas).map(([k, v]) => `--ease-${k}: ${v};`),
    ...Object.entries(md.sombras).map(([k, v]) => `--shadow-${k}: ${v};`),
    ...Object.entries(md.animacoes).map(([k, v]) => `--animate-${k}: ${v};`),
  ]
  const util = (nome, decl) => bloco(`@utility ${nome}`, decl)
  const utilidades = [
    // A forma da `duration-*` do próprio v4: `--tw-duration` é o que a animação de entrada também lê.
    ...Object.entries(md.duracoes).map(([k, v]) => util(`duration-${k}`, { '--tw-duration': v, 'transition-duration': v })),
    // Como o `delay-*` da origem (v3 com `tailwindcss-animate`): escreve as duas propriedades, e a
    // variável que o `tw-animate-css` lê — sem ela, `data-[state=open]:animate-in` zera o atraso.
    ...Object.entries(md.atrasos).map(([k, v]) => util(`delay-${k}`, { 'transition-delay': v, '--tw-animation-delay': v, 'animation-delay': v })),
    util('font-archivo', { 'font-family': pilha(md.familias.archivo) }),
    ...Object.entries(md.alturas).flatMap(([k, v]) => [util(`h-${k}`, { height: v }), util(`size-${k}`, { width: v, height: v })]),
    ...Object.entries(UTILIDADES).map(([k, d]) => util(k, d)),
  ]
  const componentes = [...Object.entries(md.vozes).map(([k, d]) => bloco(`.${k}`, d, '  ')), bloco('.painel', PAINEL, '  ')]
  return [
    CABECALHO('tailwind-v4.css'),
    '@custom-variant dark (&:is(.dark *));',
    blocosDeTema(md),
    `@theme inline {\n${tema.map((l) => `  ${l}`).join('\n')}\n${keyframesCss('  ')}\n}`,
    BASE,
    utilidades.join('\n'),
    `@layer components {\n${componentes.join('\n')}\n}`,
  ].join('\n\n') + '\n'
}

/** As peças que gastam os tokens (utilitárias e camada components), por seletor. */
export function pecas(md) {
  return {
    utilidades: Object.fromEntries(Object.entries(UTILIDADES).map(([k, d]) => [`.${k}`, d])),
    componentes: { ...Object.fromEntries(Object.entries(md.vozes).map(([k, d]) => [`.${k}`, d])), '.painel': PAINEL },
  }
}

/** O JSON resolvido: as variáveis por tema e o tema do Tailwind. Para o ateliê, o Figma e os testes. */
export function json(md) {
  const { vars, ...resto } = md
  return JSON.stringify({ temas: TEMAS, variaveis: vars, ...resto }, null, 2) + '\n'
}

/** Todas as saídas, por nome de arquivo em `dist/`. */
export function saidas(opcoes) {
  const md = modelo(opcoes)
  return {
    'tokens.css': css(md),
    'tailwind-v4.css': tailwindV4(md),
    'tokens.json': json(md),
  }
}
