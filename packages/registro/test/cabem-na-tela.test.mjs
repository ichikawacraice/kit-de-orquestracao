// SUP-07 — o que flutua cabe na tela, conferido no código das peças: todo
// conteúdo flutuante do Radix no registro tem a folga de 8px da borda. A troca
// de lado ligada e a altura limitada são da guarda `o-que-flutua-cabe-na-tela`,
// que `guardas-nos-blocos.test.mjs` roda sobre o kit instalado.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GUARDAS } from '@wicomm/guardas'

const UI = join(import.meta.dirname, '..', 'registry', 'wicomm', 'ui')
const PECAS = readdirSync(UI)
  .filter((f) => f.endsWith('.tsx'))
  .map((f) => ({ arquivo: f, texto: readFileSync(join(UI, f), 'utf8') }))

/** As tags `<XPrimitive.Content …>` e `<XPrimitive.SubContent …>` das peças, inteiras (o `>` dentro de chaves não fecha). */
function flutuantesDe(arquivo, texto) {
  const achados = []
  for (const m of texto.matchAll(/<(\w+Primitive\.(?:Sub)?Content)(?=[\s>])/g)) {
    let chaves = 0
    let i = m.index + m[0].length
    for (; i < texto.length; i++) {
      if (texto[i] === '{') chaves++
      else if (texto[i] === '}') chaves--
      else if (texto[i] === '>' && chaves === 0) break
    }
    if (/^(DropdownMenu|ContextMenu|Menubar|Popover|HoverCard|Select|Tooltip)Primitive/.test(m[1])) {
      achados.push({ arquivo, nome: m[1], tag: texto.slice(m.index, i + 1) })
    }
  }
  return achados
}
const flutuantes = PECAS.flatMap(({ arquivo, texto }) => flutuantesDe(arquivo, texto))

test('o registro tem os flutuantes que a regra cobre', () => {
  const nomes = flutuantes.map((f) => `${f.arquivo}:${f.nome}`).sort()
  for (const esperado of [
    'menu.tsx:DropdownMenuPrimitive.Content',
    'menu.tsx:DropdownMenuPrimitive.SubContent',
    'popover.tsx:PopoverPrimitive.Content',
    'select.tsx:SelectPrimitive.Content',
    'tooltip.tsx:TooltipPrimitive.Content',
  ]) {
    assert.ok(nomes.includes(esperado), `${esperado} não achado; achados: ${nomes.join(', ')}`)
  }
})

test('todo flutuante do registro para a 8px da borda', () => {
  const sem = flutuantes.filter((f) => !/\bcollisionPadding=\{(8|collisionPadding)\}/.test(f.tag)).map((f) => `${f.arquivo}:${f.nome}`)
  assert.deepEqual(sem, [])
  const padroes = PECAS.filter(({ texto }) => /collisionPadding=\{collisionPadding\}/.test(texto)).filter(
    ({ texto }) => !/collisionPadding = 8,/.test(texto),
  )
  assert.deepEqual(padroes.map((p) => p.arquivo), [], 'a folga que vem da prop tem o padrão 8')
})

test('a guarda que confere o resto existe e cita a regra', () => {
  assert.deepEqual(GUARDAS.find((g) => g.id === 'o-que-flutua-cabe-na-tela')?.regras, ['SUP-07'])
})
