// PRIN-05 — componente antes de layout, e componente escrito que ninguém monta
// não alcança quem usa. Todo `.tsx` da pasta de componentes, fora do kit, é
// importado por algum outro arquivo — com o nome em PascalCase ou em
// kebab-case, que é como o registro instala os blocos (`lista-de-pedidos.tsx`).
import { CODIGO, especificadores, violacao } from './_comum.mjs'

export default {
  id: 'componente-que-ninguem-monta',
  regras: ['PRIN-05'],
  titulo: 'Componente que ninguém monta',
  padrao: {},
  examinar(p) {
    const componentes = p.fontes({ ext: /\.[jt]sx$/, em: [p.config.componentes], ignorar: [p.config.kit] })
    const importados = new Set()
    // Quem importa vale de QUALQUER lugar, inclusive do que a guarda ignora:
    // o componente que só o ateliê monta é montado.
    for (const arquivo of p.arquivos().filter((a) => CODIGO.test(a))) {
      for (const s of especificadores(p.ler(arquivo))) {
        const alvo = p.resolverImport(arquivo, s)
        if (alvo && alvo !== arquivo) importados.add(alvo)
      }
    }
    const violacoes = componentes
      .filter((c) => !importados.has(c.arquivo))
      .map((c) => violacao(c.arquivo, 1, 'componente que ninguém importa: monte onde ele pertence, ou declare a exceção com quem espera'))
    return { examinados: componentes.length, violacoes }
  },
}
