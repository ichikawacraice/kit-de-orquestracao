// PNG com os módulos nativos (o kit não traz dependência para isto): ler um PNG
// RGBA de 8 bits sem entrelaçamento, escrevê-lo de volta e tirar dele o negativo
// do símbolo da marca (MARCA-04: o negativo sai do oficial por script).
import { deflateSync, inflateSync } from 'node:zlib'

const ASSINATURA = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const TABELA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = TABELA_CRC[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function paeth(a, b, c) {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

/** `{ largura, altura, rgba }` de um PNG RGBA de 8 bits, sem entrelaçamento; outro formato é erro. */
export function lerPng(buf) {
  if (!buf.subarray(0, 8).equals(ASSINATURA)) throw new Error('não é um PNG')
  let largura = 0
  let altura = 0
  const dados = []
  for (let i = 8; i < buf.length; ) {
    const tamanho = buf.readUInt32BE(i)
    const tipo = buf.toString('latin1', i + 4, i + 8)
    const corpo = buf.subarray(i + 8, i + 8 + tamanho)
    if (tipo === 'IHDR') {
      largura = corpo.readUInt32BE(0)
      altura = corpo.readUInt32BE(4)
      const [bits, cor, , , entrelacado] = corpo.subarray(8, 13)
      if (bits !== 8 || cor !== 6 || entrelacado !== 0) {
        throw new Error(`PNG fora do formato lido aqui (8 bits, RGBA, sem entrelaçamento): bits ${bits}, cor ${cor}, entrelaçado ${entrelacado}`)
      }
    } else if (tipo === 'IDAT') dados.push(corpo)
    else if (tipo === 'IEND') break
    i += 12 + tamanho
  }
  if (!largura || !altura) throw new Error('PNG sem IHDR')
  const cru = inflateSync(Buffer.concat(dados))
  const passo = largura * 4
  if (cru.length !== altura * (passo + 1)) throw new Error('PNG com dados de tamanho inesperado')
  const rgba = Buffer.alloc(altura * passo)
  for (let y = 0; y < altura; y++) {
    const filtro = cru[y * (passo + 1)]
    const linha = cru.subarray(y * (passo + 1) + 1, (y + 1) * (passo + 1))
    const saida = y * passo
    for (let x = 0; x < passo; x++) {
      const a = x >= 4 ? rgba[saida + x - 4] : 0
      const b = y > 0 ? rgba[saida - passo + x] : 0
      const c = x >= 4 && y > 0 ? rgba[saida - passo + x - 4] : 0
      const pred = filtro === 0 ? 0 : filtro === 1 ? a : filtro === 2 ? b : filtro === 3 ? (a + b) >> 1 : filtro === 4 ? paeth(a, b, c) : NaN
      if (Number.isNaN(pred)) throw new Error(`PNG com filtro de linha desconhecido: ${filtro}`)
      rgba[saida + x] = (linha[x] + pred) & 0xff
    }
  }
  return { largura, altura, rgba }
}

function bloco(tipo, corpo) {
  const cab = Buffer.alloc(4)
  cab.writeUInt32BE(corpo.length)
  const tipoECorpo = Buffer.concat([Buffer.from(tipo, 'latin1'), corpo])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(tipoECorpo))
  return Buffer.concat([cab, tipoECorpo, crc])
}

/** O PNG RGBA de 8 bits da imagem dada (filtro 0, deflate do Node): a mesma imagem sai sempre nos mesmos bytes. */
export function escreverPng({ largura, altura, rgba }) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(largura, 0)
  ihdr.writeUInt32BE(altura, 4)
  ihdr.set([8, 6, 0, 0, 0], 8)
  const passo = largura * 4
  const cru = Buffer.alloc(altura * (passo + 1))
  for (let y = 0; y < altura; y++) rgba.copy(cru, y * (passo + 1) + 1, y * passo, (y + 1) * passo)
  return Buffer.concat([ASSINATURA, bloco('IHDR', ihdr), bloco('IDAT', deflateSync(cru, { level: 9 })), bloco('IEND', Buffer.alloc(0))])
}

/** Um pixel é neutro quando o canal mais alto e o mais baixo distam até isto (a tinta escura e a borda suavizada dela). */
export const LIMIAR_DO_NEUTRO = 24

/**
 * O negativo do símbolo para o fundo escuro, tirado do PNG oficial positivo: a tinta neutra vira branca, com o
 * mesmo alfa (a borda suavizada continua suave), e a cor da marca fica como veio. Só troca a tinta neutra; o
 * desenho, o tamanho e a cor não mudam.
 */
export function negativoDoSimbolo(png) {
  const imagem = lerPng(png)
  const rgba = Buffer.from(imagem.rgba)
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] === 0) continue
    const [r, g, b] = rgba.subarray(i, i + 3)
    if (Math.max(r, g, b) - Math.min(r, g, b) <= LIMIAR_DO_NEUTRO) rgba.fill(255, i, i + 3)
  }
  return escreverPng({ ...imagem, rgba })
}
