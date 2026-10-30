// CASCO-03 — toda tela de detalhe (rota com mais de um degrau) monta a trilha de
// volta; destino da barra lateral (um degrau) não monta, porque um degrau só
// não é caminho. A tela onde mais se passava tempo não tinha volta nenhuma.
import { escapar, semComentarios } from '../fonte.mjs'
import { ehPorta, especificadores, violacao } from './_comum.mjs'

export default {
  id: 'toda-tela-de-detalhe-tem-trilha',
  regras: ['CASCO-03'],
  titulo: 'Toda tela de detalhe tem trilha',
  padrao: { trilha: 'Trilha' },
  examinar(p, op) {
    const tag = new RegExp(`<${escapar(op.trilha)}[\\s/>]`)
    const paginas = p.paginas().filter((x) => !ehPorta(x.texto))
    const monta = (arquivo, texto, descer) => {
      if (tag.test(semComentarios(texto))) return true
      if (!descer) return false
      return especificadores(texto).some((s) => {
        const alvo = p.resolverImport(arquivo, s)
        return alvo ? monta(alvo, p.ler(alvo), false) : false
      })
    }
    const violacoes = []
    for (const pg of paginas) {
      if (pg.rota.length > 1 && !monta(pg.arquivo, pg.texto, true)) {
        violacoes.push(violacao(pg.arquivo, 1, `/${pg.rota.join('/')} é tela de detalhe e não monta <${op.trilha}>`))
      }
      if (pg.rota.length <= 1 && tag.test(semComentarios(pg.texto))) {
        violacoes.push(violacao(pg.arquivo, 1, `/${pg.rota.join('/')} é destino da barra lateral e não leva trilha`))
      }
    }
    return { examinados: paginas.length, violacoes }
  },
}
