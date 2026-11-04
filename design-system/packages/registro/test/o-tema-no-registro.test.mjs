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
import { mesmaImagem, negativoDoSimbolo } from '../lib/png.mjs'
import { LINHA_DO_DESENHO, LINHA_DO_SIMBOLO, MARCA_NO_CODIGO, PECA_DO_LOGOTIPO, arquivoComOTema, codigoComOTema, temaDoRegistro } from '../lib/tema.mjs'
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

  it('o desenho embutido é o PNG do tema, byte a byte (MARCA-04)', () => {
    const padrao = temaDoRegistro()
    const linha = ler(PECA_DO_LOGOTIPO).match(LINHA_DO_DESENHO)?.[0]
    assert.ok(linha && linha.length > 1000, 'a peça embute o desenho')
    const [claro, escuro] = [...linha.matchAll(/"data:image\/png;base64,([^"]+)"/g)].map((m) => Buffer.from(m[1], 'base64'))
    assert.ok(claro?.length > 0 && escuro?.length > 0)
    assert.ok(claro.equals(readFileSync(join(padrao.pasta, padrao.meta.logotipo.imagem.sobreClaro))), 'sobre o claro')
    assert.ok(escuro.equals(readFileSync(join(padrao.pasta, padrao.meta.logotipo.imagem.sobreEscuro))), 'sobre o escuro')
  })

  it('o símbolo embutido é o PNG oficial do tema, e o negativo sai dele por script (MARCA-04)', () => {
    const padrao = temaDoRegistro()
    const linha = ler(PECA_DO_LOGOTIPO).match(LINHA_DO_SIMBOLO)?.[0]
    assert.ok(linha && linha.length > 1000, 'a peça embute o símbolo')
    const [claro, escuro] = [...linha.matchAll(/"data:image\/png;base64,([^"]+)"/g)].map((m) => Buffer.from(m[1], 'base64'))
    assert.ok(claro?.length > 0 && escuro?.length > 0)
    const oficial = readFileSync(join(padrao.pasta, padrao.meta.logotipo.simbolo.sobreClaro))
    assert.ok(claro.equals(oficial), 'sobre o claro: o oficial')
    assert.ok(mesmaImagem(escuro, negativoDoSimbolo(oficial)), 'sobre o escuro: o negativo do oficial, pelos pixels')
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
    // O tema sem desenho não leva o da Wicomm: a peça escreve o nome dele.
    assert.match(logotipo, /DESENHO_DO_LOGOTIPO: \{ sobreClaro: string; sobreEscuro: string \} \| null = null$/m)
    assert.match(logotipo, /SIMBOLO_DO_LOGOTIPO: \{ sobreClaro: string; sobreEscuro: string \} \| null = null$/m)
    assert.doesNotMatch(logotipo, /data:image/)
    const casco = JSON.parse(readFileSync(join(pasta, 'casco.json'), 'utf8')).files.map((f) => f.content).join('\n')
    assert.match(casco, /aria-label="Outro, início"/)
    const { itens } = await oQueOAddGrava(pasta, { prefixo: '@outro', so: ['logotipo'] })
    assert.deepEqual(Object.keys(itens.logotipo), ['app/globals.css', 'components/ui/logotipo.tsx', 'lib/utils.ts'])
  })
})
