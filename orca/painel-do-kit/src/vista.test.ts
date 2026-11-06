// Contas da tela (F436): tempo em português, dia de São Paulo e agrupamentos.
import { assert, test } from 'orca/testing'
import { chaveDoGrupo, cortar, haQuanto, horaSP, nomeDoDia, partesDoSelo, porDia, porItem, semPrefixoDoItem } from './vista'
import type { Entrega, Pergunta } from './protocol'

const AGORA = Date.parse('2026-11-06T15:00:00Z') // 12:00 em SP

test('há quanto tempo, em português', () => {
  assert.equal(haQuanto(AGORA - 20_000, AGORA), 'há 20 s')
  assert.equal(haQuanto(AGORA - 12 * 60_000, AGORA), 'há 12 min')
  assert.equal(haQuanto(AGORA - 2 * 3_600_000, AGORA), 'há 2 h')
  assert.equal(haQuanto(AGORA - 3 * 86_400_000, AGORA), 'há 3 d')
  assert.equal(haQuanto(AGORA + 5_000, AGORA), 'há 0 s', 'relógio adiantado não vira tempo negativo')
})

test('o dia e a hora são os de São Paulo, não os de UTC', () => {
  const noiteSP = Date.parse('2026-11-06T02:30:00Z') // 23:30 de 05/11 em SP
  assert.equal(horaSP(noiteSP), '23:30')
  assert.equal(nomeDoDia(noiteSP, AGORA), 'Ontem')
  assert.equal(nomeDoDia(Date.parse('2026-11-06T10:00:00Z'), AGORA), 'Hoje')
  assert.match(nomeDoDia(Date.parse('2026-11-03T15:00:00Z'), AGORA), /^terça-feira, 3 de nov$/)
})

const q = (id: string, titulo: string, atualizadoEm: string, item: string | null = null) =>
  ({ id, versao: 1, estado: 'assumida', titulo, caso: null, seNaoDecidir: null, recomendacao: null, item, projeto: 'kit', sessaoId: null, atualizadoEm, endereco: null }) as Pergunta

test('decisões por item (campo ou início do título), o grupo mais recente primeiro', () => {
  const g = porItem([q('Q1', 'F1 · a', '2026-11-06T10:00:00Z'), q('Q2', 'b', '2026-11-06T12:00:00Z', 'F2'), q('Q3', 'F1 · c', '2026-11-06T11:00:00Z'), q('Q4', 'solta', '2026-11-01T00:00:00Z')])
  assert.ok(g.length > 0)
  assert.deepEqual(g.map((x) => x.titulo), ['F2', 'F1', 'Sem item'])
  assert.deepEqual(g[1].itens.map((x) => x.id), ['Q1', 'Q3'])
})

test('entregas por dia de São Paulo, na ordem em que vêm', () => {
  const e = (chave: string, em: string) => ({ chave, chaves: [chave], origem: 'painel', item: null, titulo: chave, projeto: null, em, sessao: null }) as Entrega
  const g = porDia([e('a', '2026-11-06T14:00:00Z'), e('b', '2026-11-06T04:00:00Z'), e('c', '2026-11-06T02:00:00Z')], AGORA)
  assert.deepEqual(g.map((x) => [x.titulo, x.itens.map((i) => i.chave)]), [['Hoje', ['a', 'b']], ['Ontem', ['c']]])
})

test('cortar respeita a palavra e marca quando cortou', () => {
  assert.deepEqual(cortar('curto', 10), { curto: 'curto', cortou: false })
  const r = cortar('uma frase bem comprida para cortar', 20)
  assert.equal(r.cortou, true)
  assert.equal(r.curto, 'uma frase bem…')
})

test('selo do projeto: o forte e o fraco, sem inventar o que falta', () => {
  assert.deepEqual(partesDoSelo('kit-de-orquestracao', 'F435'), { forte: 'kit-de-orquestracao', fraco: '· F435' })
  assert.deepEqual(partesDoSelo(null, 'F435'), { forte: null, fraco: 'F435' })
  assert.deepEqual(partesDoSelo('Izanagi', null), { forte: 'Izanagi', fraco: null })
  assert.equal(partesDoSelo(null, null), null)
  const longo = partesDoSelo('um-nome-de-projeto-muito-mais-comprido-que-o-limite', 'F1')
  assert.ok(longo?.forte && longo.forte.length <= 29 && longo.forte.endsWith('…'))
})

test('título sem o prefixo do item, só quando é esse item', () => {
  assert.equal(semPrefixoDoItem('F435 · Fila de merge', 'F435'), 'Fila de merge')
  assert.equal(semPrefixoDoItem('F435: Fila', 'F435'), 'Fila')
  assert.equal(semPrefixoDoItem('F435 — Fila', 'F435'), 'Fila')
  assert.equal(semPrefixoDoItem('F435', 'F435'), 'F435')
  assert.equal(semPrefixoDoItem('F4350 · outra', 'F435'), 'F4350 · outra')
  assert.equal(semPrefixoDoItem('F12 · x', 'F435'), 'F12 · x')
  assert.equal(semPrefixoDoItem('Sem item', null), 'Sem item')
})

test('o grupo de decisões é projeto + item: o F12 de dois projetos são dois grupos', () => {
  const q = (id: string, projeto: string | null): Pergunta => ({ id, versao: 1, estado: 'assumida', titulo: `F12 · ${id}`, caso: null, seNaoDecidir: null, recomendacao: null, item: 'F12', projeto, sessaoId: null, atualizadoEm: '2026-11-06T12:00:00Z', endereco: null, opcoes: null })
  assert.notEqual(chaveDoGrupo(q('a', 'kit')), chaveDoGrupo(q('b', 'Izanagi')))
  const gs = porItem([q('a', 'kit'), q('b', 'Izanagi'), q('c', 'kit')])
  assert.equal(gs.length, 2)
  assert.deepEqual(gs.map((g) => g.itens.length).sort(), [1, 2])
  assert.ok(gs.every((g) => g.projeto !== undefined))
})
