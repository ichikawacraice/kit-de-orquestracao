// O tema no registro (F345, fatia 3): o build com outro tema troca o que é da marca (o prefixo, o título e os
// tokens do estilo, o logotipo e o rótulo no código) e nada mais; com o tema padrão, nada muda (o critério está em
// `o-que-o-add-grava.test.mjs`). O tema de teste é o do pacote de tokens: outra cor, outra fonte, outro nome.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, describe, it } from 'node:test'
import { registro } from '../lib/registro.mjs'
import { MARCA_NO_CODIGO, arquivoComOTema, codigoComOTema, temaDoRegistro } from '../lib/tema.mjs'
import { oQueOAddGrava } from '../scripts/o-que-o-add-grava.mjs'

const RAIZ = join(import.meta.dirname, '..')
const OUTRO = join(RAIZ, '..', 'tokens', 'test', 'fixtures', 'temas', 'outro')
const ler = (caminho) => readFileSync(join(RAIZ, caminho), 'utf8')

describe('o tema no registro', () => {
  it('com o tema padrão, o código das peças volta igual, e cada trecho da marca está no código', () => {
    const padrao = temaDoRegistro()
    for (const caminho of Object.keys(MARCA_NO_CODIGO)) assert.equal(arquivoComOTema(caminho, padrao), ler(caminho), caminho)
  })

  it('nome com aspas não quebra o atributo: vai como expressão JSX', () => {
    const tema = { meta: { nome: 'A "B" \\ C', logotipo: { horizontal: 'ab', monograma: 'a' } } }
    const saida = codigoComOTema('registry/design-system/ui/logotipo.tsx', ler('registry/design-system/ui/logotipo.tsx'), tema)
    assert.ok(saida.includes('aria-label={"A \\"B\\" \\\\ C"}'), saida.match(/aria-label=[^\n]*/)[0])
  })

  it('o trecho da marca que some do código é erro, não troca calada', () => {
    assert.throws(() => codigoComOTema('registry/design-system/ui/logotipo.tsx', 'sem marca nenhuma', temaDoRegistro(OUTRO)), /sumiu do código/)
  })

  it('o registry.json com outro tema: o prefixo, o nome e o título do estilo são os dele; o resto é igual', () => {
    const padrao = registro()
    const outro = registro(temaDoRegistro(OUTRO))
    assert.equal(outro.name, 'outro')
    assert.equal(outro.items[0].title, 'Estilo Outro')
    assert.ok(outro.items.every((i) => (i.registryDependencies ?? []).every((d) => d.startsWith('@outro/'))))
    assert.deepEqual(outro.items.map((i) => i.files), padrao.items.map((i) => i.files), 'os mesmos arquivos')
    assert.equal(outro.items[0].cssVars.light.primary, '#0057D9', 'os tokens são os do tema')
  })
})

describe('o build com --tema', () => {
  const pasta = mkdtempSync(join(tmpdir(), 'registro-outro-'))
  after(() => rmSync(pasta, { recursive: true, force: true }))

  it('o add pelo registro do outro tema grava o logotipo e o rótulo dele', async () => {
    execFileSync(process.execPath, [join(RAIZ, 'scripts', 'build.mjs'), '--saida', pasta, '--tema', OUTRO], { stdio: 'ignore' })
    const logotipo = JSON.parse(readFileSync(join(pasta, 'logotipo.json'), 'utf8')).files[0].content
    assert.match(logotipo, /aria-label="Outro"/)
    assert.match(logotipo, /"horizontal" \? "outro" : "o"/)
    assert.doesNotMatch(logotipo, /"wicomm"|aria-label="Wicomm"/)
    const casco = JSON.parse(readFileSync(join(pasta, 'casco.json'), 'utf8')).files.map((f) => f.content).join('\n')
    assert.match(casco, /aria-label="Outro, início"/)
    const { itens } = await oQueOAddGrava(pasta, { prefixo: '@outro', so: ['logotipo'] })
    assert.deepEqual(Object.keys(itens.logotipo), ['app/globals.css', 'components/ui/logotipo.tsx', 'lib/utils.ts'])
  })
})
