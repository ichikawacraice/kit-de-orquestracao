// CASCO-03 — toda tela de detalhe (rota com mais de um degrau) monta a trilha de
// volta; destino da barra lateral (um degrau) não monta, porque um degrau só
// não é caminho. A tela onde mais se passava tempo não tinha volta nenhuma.
// No Editor, fora do casco, a volta e o nome da barra cumprem a trilha: a
// `BarraDoEditor` leva o `voltar` obrigatório (as `voltas`).
import { escapar, semComentarios } from '../fonte.mjs'
import { ehPorta, especificadores, violacao } from './_comum.mjs'

export default {
  id: 'toda-tela-de-detalhe-tem-trilha',
  regras: ['CASCO-03'],
  titulo: 'Toda tela de detalhe tem trilha',
  // `voltas`: as peças que cumprem a trilha; `niveis`: até onde se segue o import a partir da página.
  padrao: { trilha: 'Trilha', voltas: ['BarraDoEditor'], niveis: 2 },
  examinar(p, op) {
    // A `Trilha` vale na página ou no componente que ela monta (1 nível); a barra do Editor, também abaixo da
    // cola do framework (até `niveis`). Uma tela com trilha dois imports abaixo não é a página montando a trilha.
    const voltas = op.voltas.length ? new RegExp(`<(?:${op.voltas.map(escapar).join('|')})[\\s/>]`) : null
    const soTrilha = new RegExp(`<${escapar(op.trilha)}[\\s/>]`)
    const paginas = p.paginas().filter((x) => !ehPorta(x.texto))
    const monta = (arquivo, texto, nivel, visto) => {
      if (visto.has(arquivo)) return false
      visto.add(arquivo)
      const codigo = semComentarios(texto)
      if (nivel <= 1 && soTrilha.test(codigo)) return true
      if (voltas?.test(codigo)) return true
      if (nivel >= op.niveis) return false
      // Segue componente (`.tsx`), não índice (`.ts`): o mapa que importa muitas telas não é a página montando uma.
      return especificadores(texto).some((s) => {
        const alvo = p.resolverImport(arquivo, s)
        return alvo && /\.[jt]sx$/.test(alvo) ? monta(alvo, p.ler(alvo), nivel + 1, visto) : false
      })
    }
    const violacoes = []
    for (const pg of paginas) {
      if (pg.rota.length > 1 && !monta(pg.arquivo, pg.texto, 0, new Set())) {
        violacoes.push(violacao(pg.arquivo, 1, `/${pg.rota.join('/')} é tela de detalhe e não monta <${op.trilha}>`))
      }
      if (pg.rota.length <= 1 && soTrilha.test(semComentarios(pg.texto))) {
        violacoes.push(violacao(pg.arquivo, 1, `/${pg.rota.join('/')} é destino da barra lateral e não leva trilha`))
      }
    }
    return { examinados: paginas.length, violacoes }
  },
}
