// As guardas de design (@wicomm/guardas) rodadas sobre o que o registro
// instala, no lugar em que o `shadcn add` o põe num app Next: as peças em
// `components/ui` (o kit), os componentes dos blocos em `components`, as
// bibliotecas em `lib` e as páginas de exemplo em `app`. A base é zero: bloco
// do registro não entra com dívida.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, posix } from 'node:path'
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { verificar } from '@wicomm/guardas'
import { registro } from '../lib/registro.mjs'

const RAIZ = join(import.meta.dirname, '..')
const require = createRequire(import.meta.url)

/** Onde o `shadcn add` põe cada arquivo, num app Next sem `src/` (o do num-next-vazio). */
function destino(arquivo) {
  if (arquivo.target) return arquivo.target
  const nome = posix.basename(arquivo.path)
  if (arquivo.type === 'registry:ui') return `components/ui/${nome}`
  if (arquivo.type === 'registry:lib') return `lib/${nome}`
  return `components/${nome}`
}

const ARQUIVOS = registro().items.flatMap((i) => i.files ?? [])
const DESTINOS = new Map(ARQUIVOS.map((f) => [f.path.replace(/\.tsx?$/, ''), destino(f).replace(/\.tsx?$/, '')]))

const app = mkdtempSync(join(tmpdir(), 'wicomm-guardas-'))
after(() => rmSync(app, { recursive: true, force: true }))

for (const f of ARQUIVOS) {
  // A mesma reescrita do `add`: `@/registry/wicomm/<caminho>` vira o alias do lugar instalado.
  const fonte = readFileSync(join(RAIZ, f.path), 'utf8').replace(/"@\/(registry\/wicomm\/[^"]+)"/g, (m, de) =>
    DESTINOS.has(de) ? `"@/${DESTINOS.get(de)}"` : m
  )
  const alvo = join(app, destino(f))
  mkdirSync(dirname(alvo), { recursive: true })
  writeFileSync(alvo, fonte)
}
mkdirSync(join(app, 'app'), { recursive: true })
writeFileSync(join(app, 'app', 'globals.css'), readFileSync(require.resolve('@wicomm/tokens/tailwind-v4.css'), 'utf8'))

const CONFIG = {
  fontes: ['app', 'components', 'lib'],
  ignorar: [],
  kit: 'components/ui',
  componentes: 'components',
  paginas: 'app',
  css: ['app/globals.css'],
  aliases: { '@/': '' },
  base: 'design/guardas.base.json',
  regras: {
    'a-tela-de-entrada-tem-o-botao-grande': { telas: ['components/tela-de-entrada.tsx'] },
    'o-carimbo-tem-forma': { idioma: 'lib/idioma-de-cor.ts' },
    'o-vocabulario-da-tela': { desligada: 'o registro não tem produto: não há palavra de código diferente da palavra da tela' },
    // Achado para o pacote de guardas: a guarda só examina arquivo com inicial
    // maiúscula, e o shadcn nomeia em kebab-case. Aqui, quem prova que todo
    // arquivo é montado é o teste do registro (cada arquivo numa peça, cada peça importada).
    'componente-que-ninguem-monta': { desligada: 'só examina nome de arquivo com inicial maiúscula, e o registro shadcn nomeia em kebab-case' },
  },
}

test('os blocos instalados passam em todas as guardas de design, com base zero', () => {
  const r = verificar({ raiz: app, config: CONFIG })
  const emErro = r.resultados.filter((x) => x.estado === 'erro').map((x) => `${x.id}: ${(x.erros ?? []).join("; ")}`)
  const violacoes = r.resultados.flatMap((x) => (x.violacoes ?? []).map((v) => `${x.id} · ${v.arquivo}:${v.linha} · ${v.msg} · ${v.trecho ?? ''}`))
  assert.deepEqual({ emErro, violacoes }, { emErro: [], violacoes: [] })
})

test('a cópia instalada tem o que as guardas precisam examinar (páginas, kit, componentes)', () => {
  const paginas = ARQUIVOS.filter((f) => f.type === 'registry:page').map((f) => f.target)
  assert.ok(paginas.includes('app/(casco)/pedidos/[id]/page.tsx'), 'a Mesa é tela de detalhe')
  assert.ok(paginas.includes('app/(tela-inteira)/entrar/page.tsx'), 'a Entrada fica fora do casco')
})

test('a varredura morde: a Mesa sem trilha e um valor solto reprovam', () => {
  const mesa = join(app, 'components', 'mesa-do-pedido.tsx')
  const original = readFileSync(mesa, 'utf8')
  try {
    writeFileSync(mesa, original.replaceAll('<Trilha', '<TrilhaDeMentira').replace('className="flex min-h-0 flex-1 gap-6"', 'className="flex min-h-0 flex-1 gap-6 h-[34px]"'))
    const r = verificar({ raiz: app, config: CONFIG, so: ['toda-tela-de-detalhe-tem-trilha', 'nenhum-valor-solto'] })
    const acusadas = r.resultados.filter((x) => (x.violacoes ?? []).length > 0).map((x) => x.id)
    assert.deepEqual(acusadas.sort(), ['nenhum-valor-solto', 'toda-tela-de-detalhe-tem-trilha'])
  } finally {
    writeFileSync(mesa, original)
  }
})
