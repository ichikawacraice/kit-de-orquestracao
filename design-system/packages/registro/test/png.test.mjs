// O PNG nativo do registro: lê e escreve sem perder pixel, recusa o formato que não lê, e o negativo do
// símbolo troca só a tinta neutra (MARCA-04).
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { deflateSync } from 'node:zlib'
import { LIMIAR_DO_NEUTRO, escreverPng, lerPng, negativoDoSimbolo } from '../lib/png.mjs'
import { temaDoRegistro } from '../lib/tema.mjs'

const tema = temaDoRegistro()
const oficial = readFileSync(join(tema.pasta, tema.meta.logotipo.simbolo.sobreClaro))

/** Um PNG 2×2 com a linha 1 no filtro dado (o resto em 0), para o leitor desfazer cada filtro. */
function pngComFiltro(filtro, pixels) {
  const linhas = [pixels.subarray(0, 8), pixels.subarray(8, 16)]
  const cru = Buffer.alloc(18)
  cru[0] = 0
  linhas[0].copy(cru, 1)
  cru[9] = filtro
  for (let x = 0; x < 8; x++) {
    const a = x >= 4 ? linhas[1][x - 4] : 0
    const b = linhas[0][x]
    const c = x >= 4 ? linhas[0][x - 4] : 0
    const p = a + b - c
    const paeth = Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c) ? a : Math.abs(p - b) <= Math.abs(p - c) ? b : c
    const pred = [0, a, b, (a + b) >> 1, paeth][filtro]
    cru[10 + x] = (linhas[1][x] - pred) & 0xff
  }
  const base = escreverPng({ largura: 2, altura: 2, rgba: pixels })
  // Troca o IDAT do PNG de filtro 0 pelo de filtro dado (o IHDR fica igual).
  const inicio = 8 + 25
  const idat = deflateSync(cru)
  const tam = Buffer.alloc(4)
  tam.writeUInt32BE(idat.length)
  return Buffer.concat([base.subarray(0, inicio), tam, Buffer.from('IDAT'), idat, Buffer.alloc(4), base.subarray(base.length - 12)])
}

describe('o PNG nativo', () => {
  it('lê o símbolo oficial e o escreve de volta com os mesmos pixels', () => {
    const imagem = lerPng(oficial)
    assert.ok(imagem.largura > 0 && imagem.altura > 0)
    assert.equal(imagem.rgba.length, imagem.largura * imagem.altura * 4)
    assert.ok(lerPng(escreverPng(imagem)).rgba.equals(imagem.rgba))
  })

  it('desfaz os cinco filtros de linha', () => {
    const pixels = Buffer.from([10, 200, 30, 255, 250, 5, 128, 90, 7, 77, 177, 255, 60, 3, 240, 12])
    for (const filtro of [0, 1, 2, 3, 4]) assert.ok(lerPng(pngComFiltro(filtro, pixels)).rgba.equals(pixels), `filtro ${filtro}`)
  })

  it('recusa o que não é PNG e o PNG fora do formato', () => {
    assert.throws(() => lerPng(Buffer.from('nada')), /não é um PNG/)
    const rgb = Buffer.from(escreverPng({ largura: 1, altura: 1, rgba: Buffer.from([0, 0, 0, 255]) }))
    rgb[8 + 8 + 9] = 2 // cor 2: RGB sem alfa
    assert.throws(() => lerPng(rgb), /fora do formato/)
  })
})

describe('o negativo do símbolo', () => {
  it('troca a tinta neutra por branca, com o mesmo alfa, e deixa a cor da marca como veio', () => {
    const antes = lerPng(oficial).rgba
    const depois = lerPng(negativoDoSimbolo(oficial)).rgba
    assert.equal(depois.length, antes.length)
    let neutros = 0
    let cores = 0
    for (let i = 0; i < antes.length; i += 4) {
      assert.equal(depois[i + 3], antes[i + 3], 'o alfa não muda')
      if (antes[i + 3] === 0) continue
      const [r, g, b] = antes.subarray(i, i + 3)
      if (Math.max(r, g, b) - Math.min(r, g, b) <= LIMIAR_DO_NEUTRO) {
        neutros++
        assert.deepEqual([...depois.subarray(i, i + 3)], [255, 255, 255])
      } else {
        cores++
        assert.deepEqual([...depois.subarray(i, i + 3)], [r, g, b])
      }
    }
    // O símbolo tem as duas coisas: a tinta escura e a cor da marca (sem elas o teste não mede nada).
    assert.ok(neutros > 1000 && cores > 100, `neutros ${neutros}, cores ${cores}`)
  })

  it('sai sempre nos mesmos bytes', () => {
    assert.ok(negativoDoSimbolo(oficial).equals(negativoDoSimbolo(oficial)))
  })
})
