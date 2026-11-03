// CTRL-02 — a tela de Entrada (um passo só, feito de vez em quando: login,
// recuperar senha, colar um token) tem o botão grande: o que conclui é `xl`,
// nenhum é `sm`, e todo campo é `xl`. As telas são do projeto: a guarda exige
// a lista, ou que seja desligada com motivo.
import { semComentarios, tagsDeAbertura } from '../fonte.mjs'
import { exigir, violacao } from './_comum.mjs'

const conclui = (tag) => /\btype=["']submit["']/.test(tag) || !/\bvariant=/.test(tag)
/** `xl` direto, ou o padrão `tamanho = 'xl'` do arquivo repassado à tag. */
const ehXl = (fonte, tag) => /\b(size|tamanho)=["']xl["']/.test(tag) || (/\btamanho\s*=\s*['"]xl['"]/.test(fonte) && /[{(]\s*tamanho\s*[)}]/.test(tag))

export default {
  id: 'a-tela-de-entrada-tem-o-botao-grande',
  regras: ['CTRL-02'],
  titulo: 'A tela de Entrada tem o botão grande',
  padrao: { telas: [], campos: ['Input'] },
  examinar(p, op) {
    const telas = exigir(op, 'telas', 'os arquivos das telas de Entrada')
    const erros = []
    const violacoes = []
    let examinados = 0
    for (const arquivo of telas) {
      if (!p.existe(arquivo)) {
        erros.push(`tela de Entrada que não existe: ${arquivo}`)
        continue
      }
      const fonte = semComentarios(p.ler(arquivo))
      const linha = (i) => fonte.slice(0, i).split('\n').length
      const botoes = tagsDeAbertura(fonte, 'Button')
      const campos = op.campos.flatMap((c) => tagsDeAbertura(fonte, c))
      examinados += botoes.length + campos.length
      if (botoes.length + campos.length === 0) erros.push(`${arquivo} não tem botão nem campo para examinar`)
      for (const b of botoes) {
        if (conclui(b.tag) && !ehXl(fonte, b.tag)) violacoes.push(violacao(arquivo, linha(b.indice), 'o botão que conclui a Entrada é xl', b.tag))
        if (/\bsize=["']sm["']/.test(b.tag)) violacoes.push(violacao(arquivo, linha(b.indice), 'botão sm na tela de Entrada', b.tag))
      }
      for (const c of campos) if (!ehXl(fonte, c.tag)) violacoes.push(violacao(arquivo, linha(c.indice), 'campo da Entrada é xl', c.tag))
    }
    return { examinados, violacoes, erros }
  },
}
