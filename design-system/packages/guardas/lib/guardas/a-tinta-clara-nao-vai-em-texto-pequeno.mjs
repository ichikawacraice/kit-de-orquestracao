// COR-05 e COR-12 — a tinta de voz tem dois degraus: `COR_DO_TOM` só para
// número de 24px para cima, `COR_DO_TOM_DENSO` para texto menor (o claro em
// texto pequeno mede abaixo do piso no tema claro). E a metade clara de uma
// voz escrita à mão não vem sem a escura (`text-rose-700` mede 2,77 sobre o
// cartão escuro).
import { escapar, semComentarios } from '../fonte.mjs'
import { CODIGO, violacao } from './_comum.mjs'

const PEQUENOS = /\b(text-xs|text-sm|text-base|text-lg|text-xl|text-\[(1[0-9]|2[0-3])px\])\b/
const GRANDE = /\btext-(xl|2xl|3xl|4xl|5xl)\b/
const NEGRITO = /\b(font-bold|font-extrabold|font-black|font-\[(7|8|9)00\])\b/
const TINTA_DE_VOZ = /\btext-(rose|emerald|amber|violet)-\d{3}\b/
const METADE_ESCURA = /\bdark:text-(rose|emerald|amber|violet)-\d{3}\b/

export function claroEmTextoPequeno(texto, claro) {
  if (!new RegExp(`\\b${escapar(claro)}\\b`).test(texto)) return []
  const nomes = [claro, ...[...texto.matchAll(new RegExp(`const\\s+(\\w+)\\s*=\\s*${escapar(claro)}\\b(?!_)`, 'g'))].map((m) => m[1])]
  return texto.split('\n').flatMap((linha, i) => {
    if (!PEQUENOS.test(linha)) return []
    if (GRANDE.test(linha) && NEGRITO.test(linha)) return []
    const usa = nomes.some((n) => new RegExp(`\\$\\{${escapar(n)}[.[]`).test(linha) || new RegExp(`\\b${escapar(n)}\\[`).test(linha))
    return usa ? [{ linha: i + 1, trecho: linha }] : []
  })
}

export function tintaSemPar(texto) {
  const linhas = texto.split('\n')
  return linhas.flatMap((linha, i) => {
    if (!TINTA_DE_VOZ.test(linha)) return []
    const vizinhanca = [linhas[i - 1] ?? '', linha, linhas[i + 1] ?? ''].join('\n')
    return METADE_ESCURA.test(vizinhanca) ? [] : [{ linha: i + 1, trecho: linha }]
  })
}

export default {
  id: 'a-tinta-clara-nao-vai-em-texto-pequeno',
  regras: ['COR-05', 'COR-12'],
  titulo: 'A tinta clara não vai em texto pequeno, e a voz tem a metade escura',
  padrao: { claro: 'COR_DO_TOM', denso: 'COR_DO_TOM_DENSO' },
  examinar(p, op) {
    const fontes = p.fontes({ ext: CODIGO })
    const violacoes = fontes.flatMap(({ arquivo, texto }) => {
      const codigo = semComentarios(texto)
      return [
        ...claroEmTextoPequeno(codigo, op.claro).map((a) => violacao(arquivo, a.linha, `${op.claro} em texto menor que 24px: use ${op.denso}`, a.trecho)),
        ...tintaSemPar(codigo).map((a) => violacao(arquivo, a.linha, 'tinta de voz sem o par dark:', a.trecho)),
      ]
    })
    return { examinados: fontes.length, violacoes }
  },
}
