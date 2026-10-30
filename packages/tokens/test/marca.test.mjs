// O slot `marca`: a marca troca por UM arquivo (critério de pronto da F261.2).
//
// A prova é gerar com outro arquivo de marca e conferir que (1) mudam todos os
// tokens que apontam para a marca, com os valores do arquivo novo, (2) nada mais
// muda, e (3) a cor da marca não está escrita em nenhum outro lugar da fonte.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { apontamParaMarca, FONTE, lerFonte, MARCA_PADRAO, variaveis } from '../lib/ler.mjs'
import { saidas } from '../lib/saidas.mjs'

const OUTRA = join(import.meta.dirname, 'fixtures', 'marca-outra.tokens.json')
const padrao = variaveis(lerFonte())
const trocada = variaveis(lerFonte({ marca: OUTRA }))
const hexes = (caminho) => [...readFileSync(caminho, 'utf8').matchAll(/#[0-9A-Fa-f]{6}\b/g)].map((m) => m[0].toUpperCase())

describe('o slot da marca', () => {
  const daMarca = apontamParaMarca(lerFonte())

  it('os tokens que apontam para a marca são os papéis da marca, e não outros', () => {
    for (const papel of ['--primary', '--primary-hover', '--primary-foreground', '--marca-viva', '--marca-tinta', '--ring', '--primary-gradient-start', '--primary-gradient-mid', '--primary-gradient-end', '--chart-1', '--sidebar-primary', '--sidebar-ring']) {
      assert.ok(daMarca.includes(papel), `${papel} não aponta para a marca`)
    }
    for (const neutro of ['--background', '--card', '--foreground', '--input', '--destructive']) assert.ok(!daMarca.includes(neutro), neutro)
  })

  for (const tema of ['claro', 'escuro']) {
    it(`tema ${tema}: trocar o arquivo de marca muda os tokens da marca, e só eles`, () => {
      const mudaram = Object.keys(padrao[tema]).filter((n) => padrao[tema][n] !== trocada[tema][n])
      assert.deepEqual(mudaram.sort(), daMarca.filter((n) => n in padrao[tema]).sort())
      assert.equal(trocada[tema]['--primary'], '#0057D9')
      assert.equal(trocada[tema]['--primary-foreground'], '#FEFEFE')
      assert.equal(trocada[tema]['--primary-hover'], tema === 'claro' ? '#004BBD' : '#2A74E8')
    })
  }

  it('a troca chega a todas as saídas, não só às variáveis', () => {
    const a = saidas()
    const b = saidas({ marca: OUTRA })
    for (const nome of Object.keys(a)) {
      assert.ok(b[nome].includes('#0057D9'), `${nome} não recebeu a marca nova`)
      assert.ok(!b[nome].includes('#F30B42'), `${nome} ainda tem a marca antiga`)
    }
  })

  it('nenhuma cor da marca está escrita fora do arquivo de marca', () => {
    // Se o sistema repetisse um valor da marca em vez de apontar para ela, trocar
    // o arquivo deixaria uma metade da marca velha para trás.
    // O branco que escreve sobre a marca (`marca.sobre`) é também a superfície: fica de fora.
    const daMarcaPadrao = new Set(hexes(MARCA_PADRAO).filter((h) => h !== '#FFFFFF'))
    assert.ok(daMarcaPadrao.has('#F30B42'), 'a leitura achou a marca')
    const repetidas = hexes(join(FONTE, 'sistema.tokens.json')).filter((h) => daMarcaPadrao.has(h))
    assert.deepEqual(repetidas, [])
  })

  it('o arquivo de marca declara só o grupo `marca`', () => {
    assert.throws(() => lerFonte({ marca: join(FONTE, 'sistema.tokens.json') }), /só o grupo `marca`/)
  })
})
