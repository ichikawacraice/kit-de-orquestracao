// O projeto que as guardas examinam: a configuração (`design/design-system.json`,
// ou o nome antigo `design/wicomm.json`; chave `guardas`), a lista de arquivos de fonte e a leitura do disco. Toda
// guarda vê o projeto por aqui, e nunca por caminho fixo: os caminhos de cada
// app são configuráveis.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, posix, relative, resolve, sep } from 'node:path'

export const ARQUIVO_DE_CONFIG = 'design/design-system.json'
/** O nome antigo: vale no projeto que já o tem (sem `--config`, procura-se o novo e depois este). */
export const ARQUIVO_ANTIGO_DE_CONFIG = 'design/wicomm.json'

/** Os caminhos de um app Next com `src/` — o padrão do registro Wicomm. */
export const PADRAO = Object.freeze({
  fontes: ['src'],
  ignorar: [],
  kit: 'src/components/ui',
  componentes: 'src/components',
  paginas: 'src/app',
  css: ['src/app/globals.css'],
  aliases: { '@/': 'src/' },
  base: 'design/guardas.base.json',
  regras: {},
})

/**
 * Os caminhos de um app Next sem `src/` (o `create-next-app` sem `--src-dir`):
 * tudo na raiz. As `fontes` são toda pasta de código da raiz, e não uma lista
 * fixa: código em `features/` ou `providers/` que ninguém listou ficaria fora
 * da conta, verde sem ter sido examinado (CONV-14).
 */
export const PADRAO_SEM_SRC = Object.freeze({
  ...PADRAO,
  fontes: [],
  kit: 'components/ui',
  componentes: 'components',
  paginas: 'app',
  css: ['app/globals.css'],
  aliases: { '@/': '' },
})

/** Pastas da raiz que não são código do app: docs, a base, o estático, scripts e testes. */
const FORA_DO_APP = new Set(['public', 'design', 'docs', 'scripts', 'test', 'tests', 'e2e'])

/** O padrão que serve ao projeto: sem `src/` e com `app/` na raiz, o da raiz. */
function padraoDe(raiz) {
  if (existsSync(join(raiz, 'src')) || !existsSync(join(raiz, 'app'))) return PADRAO
  const fontes = readdirSync(raiz, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.') && !PASTAS_FORA.has(e.name) && !FORA_DO_APP.has(e.name))
    .map((e) => e.name)
    .sort()
  return { ...PADRAO_SEM_SRC, fontes }
}

const PASTAS_FORA = new Set(['node_modules', '.next', 'dist', 'build', 'coverage', '.git', '.turbo'])
const EH_TESTE = /\.(test|spec)\.[cm]?[jt]sx?$|(^|\/)__tests__\//

const paraPosix = (p) => p.split(sep).join('/')

/**
 * Lê a configuração do projeto. Sem arquivo, vale o padrão; com arquivo e sem
 * a chave `guardas`, também. Caminho de config explícito que não existe é
 * erro, nunca padrão calado.
 */
export function lerConfig(raiz, caminhoDaConfig) {
  const arquivo = caminhoDaConfig
    ? resolve(raiz, caminhoDaConfig)
    : [ARQUIVO_DE_CONFIG, ARQUIVO_ANTIGO_DE_CONFIG].map((a) => join(raiz, a)).find((a) => existsSync(a)) ?? join(raiz, ARQUIVO_DE_CONFIG)
  if (!existsSync(arquivo)) {
    if (caminhoDaConfig) throw new Error(`a configuração ${caminhoDaConfig} não existe`)
    return { ...padraoDe(raiz), origem: null }
  }
  const lido = JSON.parse(readFileSync(arquivo, 'utf8'))
  const g = lido.guardas ?? {}
  const padrao = padraoDe(raiz)
  return { ...padrao, ...g, aliases: { ...padrao.aliases, ...(g.aliases ?? {}) }, regras: g.regras ?? {}, origem: paraPosix(relative(raiz, arquivo)) }
}

export function criarProjeto({ raiz = process.cwd(), config } = {}) {
  const r = resolve(raiz)
  const cfg = config ?? lerConfig(r)
  const textos = new Map()
  let todos = null

  const abs = (rel) => join(r, rel)
  const ler = (rel) => {
    if (!textos.has(rel)) textos.set(rel, readFileSync(abs(rel), 'utf8'))
    return textos.get(rel)
  }
  const existe = (rel) => existsSync(abs(rel))
  const dentro = (arquivo, prefixos) => prefixos.some((p) => arquivo === p || arquivo.startsWith(p.endsWith('/') ? p : `${p}/`))

  function varrer(dirRel, saida) {
    const dirAbs = abs(dirRel)
    if (!existsSync(dirAbs) || !statSync(dirAbs).isDirectory()) return
    for (const e of readdirSync(dirAbs, { withFileTypes: true })) {
      const rel = dirRel ? posix.join(dirRel, e.name) : e.name
      if (e.isDirectory()) {
        if (!PASTAS_FORA.has(e.name)) varrer(rel, saida)
      } else if (/\.(tsx?|jsx?|mjs|cjs|css)$/.test(e.name) && !e.name.endsWith('.d.ts') && !EH_TESTE.test(rel)) {
        saida.push(rel)
      }
    }
  }

  /** Todo arquivo de fonte das pastas `fontes`, sem teste e sem o `ignorar` global. */
  function arquivos() {
    if (!todos) {
      const saida = []
      for (const f of cfg.fontes) varrer(f, saida)
      todos = [...new Set(saida)].filter((a) => !dentro(a, cfg.ignorar)).sort()
    }
    return todos
  }

  return {
    raiz: r,
    config: cfg,
    ler,
    existe,
    dentro,
    arquivos,
    /**
     * Os arquivos de fonte que uma guarda examina. `ext` filtra a extensão;
     * `em` restringe a pastas; `ignorar` tira prefixos (o da guarda soma ao
     * global).
     */
    fontes({ ext = /\.(tsx?|jsx?)$/, em, ignorar = [] } = {}) {
      return arquivos()
        .filter((a) => ext.test(a))
        .filter((a) => !em || dentro(a, em))
        .filter((a) => !dentro(a, ignorar))
        .map((arquivo) => ({ arquivo, texto: ler(arquivo) }))
    },
    /** As folhas de estilo da configuração que existem. */
    css() {
      return cfg.css.filter(existe).map((arquivo) => ({ arquivo, texto: ler(arquivo) }))
    },
    /**
     * As páginas do roteador (`page.tsx`/`page.jsx`) abaixo de `paginas`, com
     * os segmentos da rota. Grupo de rota `(x)` e rota paralela `@x` não
     * contam como degrau.
     */
    paginas({ ignorar = [] } = {}) {
      const base = cfg.paginas
      return arquivos()
        .filter((a) => dentro(a, [base]) && /(^|\/)page\.[jt]sx$/.test(a))
        .filter((a) => !dentro(a, ignorar))
        .map((arquivo) => {
          const segs = posix.relative(base, posix.dirname(arquivo)).split('/').filter(Boolean)
          return { arquivo, rota: segs.filter((s) => !/^\(.*\)$/.test(s) && !s.startsWith('@')), texto: ler(arquivo) }
        })
    },
    /** O arquivo que um `import` aponta, pelo alias ou pelo caminho relativo; `null` se for pacote. */
    resolverImport(deArquivo, especificador) {
      let base = null
      for (const [alias, alvo] of Object.entries(cfg.aliases)) {
        if (especificador.startsWith(alias)) base = posix.join(alvo, especificador.slice(alias.length))
      }
      if (base === null && especificador.startsWith('.')) base = posix.join(posix.dirname(deArquivo), especificador)
      if (base === null) return null
      for (const c of [base, `${base}.tsx`, `${base}.ts`, `${base}.jsx`, `${base}.js`, `${base}/index.tsx`, `${base}/index.ts`]) {
        if (/\.[jt]sx?$/.test(c) && existe(c) && statSync(abs(c)).isFile()) return c
      }
      return null
    },
  }
}
