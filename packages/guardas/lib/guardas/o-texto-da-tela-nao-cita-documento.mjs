// MSG-05 e CONV-11 — texto de interface não cita documento nem identificador
// interno: rastreabilidade vive em código, commit e docs; na tela é ruído que
// ninguém pode abrir. A guarda prova que o texto não cita documento; não prova
// que ele é legível.
import { semComentarios, linhaDe } from '../fonte.mjs'
import { CODIGO, violacao } from './_comum.mjs'

const CITA_DOCUMENTO = /\bADR[ -]?\d{2,4}\b|\bSPEC-\d{2,3}\b|§\s?\d/

/**
 * O texto que a pessoa lê: literal de string com espaço e letra (frase, não
 * classe nem rota) e texto entre tags JSX. Classe de CSS tem `-`/`:` sem
 * espaço de frase; rota começa por `/`; chave de banco tem `_`.
 */
export function textoVisivel(fonte) {
  const limpo = semComentarios(fonte)
  const achados = []
  for (const m of limpo.matchAll(/(['"])((?:(?!\1)[^\\\n]|\\.){4,200})\1/g)) {
    const t = m[2]
    if (t.startsWith('/') || t.startsWith('@') || t.includes('_')) continue
    achados.push({ texto: t, linha: linhaDe(limpo, m.index) })
  }
  for (const m of limpo.matchAll(/>([^<>{}\n]{4,200})</g)) {
    const t = m[1].trim()
    if (t.length > 3) achados.push({ texto: t, linha: linhaDe(limpo, m.index) })
  }
  return achados
}

export default {
  id: 'o-texto-da-tela-nao-cita-documento',
  regras: ['MSG-05', 'CONV-11'],
  titulo: 'O texto da tela não cita documento',
  padrao: {},
  examinar(p) {
    const fontes = p.fontes({ ext: CODIGO })
    const violacoes = fontes.flatMap(({ arquivo, texto }) =>
      textoVisivel(texto)
        .filter((t) => CITA_DOCUMENTO.test(t.texto))
        .map((t) => violacao(arquivo, t.linha, 'texto de interface cita documento', t.texto)),
    )
    return { examinados: fontes.length, violacoes }
  },
}
