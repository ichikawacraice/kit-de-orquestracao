// O critério de pronto da F261.6, metade "0 falso negativo": num projeto com
// uma violação plantada de cada guarda, cada guarda acusa a sua. E a outra
// metade sobre o fixture: o projeto limpo passa inteiro, sem erro de insumo.
import assert from 'node:assert/strict'
import { after, test } from 'node:test'

import { GUARDAS, lerConfig, verificar } from '../lib/index.mjs'
import { apagar, montar } from './_apoio.mjs'

/** Onde cada guarda tem a sua violação plantada; o padrão é `src/telas/<id>.tsx`. */
const ONDE = {
  'componente-que-ninguem-monta': ['src/components/Orfao.tsx', 'src/components/orfao-do-registro.tsx'],
  'toda-tela-de-detalhe-tem-trilha': ['src/app/sem-trilha/[id]/page.tsx'],
  'conteudo-mora-em-superficie': ['src/app/solta/page.tsx', 'src/telas/conteudo-mora-em-superficie.tsx'],
  'os-tokens-pagam-o-piso': ['src/app/extra.css'],
  'o-movimento-tem-escape': ['src/app/extra.css', 'src/telas/o-movimento-tem-escape.tsx'],
  'a-tela-de-entrada-tem-o-botao-grande': ['src/components/Entrada.tsx'],
}
const onde = (id) => ONDE[id] ?? [`src/telas/${id}.tsx`]

const limpo = montar()
const sujo = montar('violacoes')
after(() => [limpo, sujo].forEach(apagar))

test('o fixture limpo passa em todas as guardas, e cada uma examinou alguma coisa', () => {
  const r = verificar({ raiz: limpo })
  for (const g of r.resultados) {
    assert.equal(g.estado, 'ok', `${g.id}: ${g.erros.join('; ')} ${g.violacoes.map((v) => `${v.arquivo}:${v.linha} ${v.mensagem}`).join('; ')}`)
    assert.ok(g.examinados > 0, `${g.id} não examinou nada`)
  }
  assert.equal(r.ok, true)
})

test('o fixture de violações planta uma de cada guarda do pacote', () => {
  const plantadas = new Set(GUARDAS.flatMap((g) => onde(g.id)))
  assert.ok(plantadas.size >= GUARDAS.length - 1)
  assert.equal(GUARDAS.length, 27)
})

const r = verificar({ raiz: sujo })
for (const g of GUARDAS) {
  test(`${g.id} acusa a violação plantada (${g.regras.join(', ')})`, () => {
    const res = r.resultados.find((x) => x.id === g.id)
    assert.notEqual(res.estado, 'erro', res.erros.join('; '))
    for (const arquivo of onde(g.id)) {
      assert.ok(
        res.violacoes.some((v) => v.arquivo === arquivo),
        `${g.id} não acusou ${arquivo}; acusou: ${res.violacoes.map((v) => v.arquivo).join(', ') || 'nada'}`,
      )
    }
  })
}

test('com as violações plantadas e sem base, a catraca reprova', () => {
  assert.equal(r.ok, false)
  assert.ok(r.comparacao.novas.length >= GUARDAS.length)
})

test('no Editor, a barra com a volta cumpre a trilha (CASCO-03, emenda E2); sem ela, a mesma rota reprova', () => {
  const comBarra = verificar({ raiz: limpo }).resultados.find((x) => x.id === 'toda-tela-de-detalhe-tem-trilha')
  assert.equal(comBarra.estado, 'ok')
  const cfg = lerConfig(limpo)
  const config = { ...cfg, regras: { ...cfg.regras, 'toda-tela-de-detalhe-tem-trilha': { voltas: [] } } }
  const semVolta = verificar({ raiz: limpo, config }).resultados.find(
    (x) => x.id === 'toda-tela-de-detalhe-tem-trilha',
  )
  assert.deepEqual(
    semVolta.violacoes.map((v) => v.arquivo),
    ['src/app/documentos/[id]/editar/page.tsx'],
  )
})

test('a trilha não vale por tabela: a página que só importa um índice de telas continua reprovando', () => {
  const r = verificar({ raiz: sujo }).resultados.find((x) => x.id === 'toda-tela-de-detalhe-tem-trilha')
  for (const arquivo of ['src/app/por-tabela/[id]/page.tsx', 'src/app/por-tabela-tsx/[id]/page.tsx']) {
    assert.ok(r.violacoes.some((v) => v.arquivo === arquivo), `${arquivo}: ${r.violacoes.map((v) => v.arquivo).join(', ')}`)
  }
})
