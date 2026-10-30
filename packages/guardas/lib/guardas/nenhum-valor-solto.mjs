// CONV-04, PRIN-06 e MOV-01 — token ou não existe. Em código de tela: nada de
// cor literal, `text-[Npx]`, altura e raio arbitrários, `duration-NNN`/
// `delay-NNN` soltos nem `z-[N]`. O que falta na escala entra no token, com
// motivo; o kit (que É a escala) fica de fora.
import { literaisDoFonte, separaVariante, tokensDaLiteral } from '../fonte.mjs'
import { TSX, violacao } from './_comum.mjs'

const SOLTOS = [
  { re: /^(?:text|bg|border(?:-[trblxy])?|ring|fill|stroke|from|to|via|outline|decoration|divide|caret|accent|shadow)-\[(?:#|rgba?\(|hsla?\(|oklch\()/, msg: 'cor literal (CONV-04)' },
  { re: /^text-\[\d+(?:\.\d+)?(?:px|rem|em)\]$/, msg: 'tamanho de texto solto (CONV-04)' },
  { re: /^(?:h|min-h|max-h|size)-\[\d+(?:\.\d+)?(?:px|rem)\]$/, msg: 'altura solta (CONV-04, CTRL-01)' },
  { re: /^rounded(?:-[trblse]{1,2})?-\[/, msg: 'raio solto (CONV-04, FORMA-01)' },
  { re: /^(?:duration|delay)-\d+$/, msg: 'duração solta: use o token de movimento (MOV-01)' },
  { re: /^z-\[/, msg: 'camada solta (CONV-04)' },
]

export function valoresSoltos(fonte) {
  const achados = []
  for (const { linha, texto } of literaisDoFonte(fonte)) {
    for (const token of tokensDaLiteral(texto)) {
      const { base } = separaVariante(token)
      const s = SOLTOS.find((x) => x.re.test(base))
      if (s) achados.push({ linha, msg: s.msg, trecho: token })
    }
    // Cor literal fora de classe (estilo inline, prop de cor): a string É a cor.
    if (/^\s*(?:#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\))\s*$/.test(texto)) achados.push({ linha, msg: 'cor literal (CONV-04)', trecho: texto })
  }
  return achados
}

export default {
  id: 'nenhum-valor-solto',
  regras: ['CONV-04', 'PRIN-06', 'MOV-01'],
  titulo: 'Nenhum valor solto',
  padrao: {},
  examinar(p) {
    const fontes = p.fontes({ ext: TSX, ignorar: [p.config.kit] })
    const violacoes = fontes.flatMap(({ arquivo, texto }) => valoresSoltos(texto).map((a) => violacao(arquivo, a.linha, a.msg, a.trecho)))
    return { examinados: fontes.length, violacoes }
  },
}
