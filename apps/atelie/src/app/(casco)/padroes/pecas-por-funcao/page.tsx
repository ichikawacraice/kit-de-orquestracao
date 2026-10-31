import { AbasDosPadroes } from "@/components/vitrine/abas-dos-padroes"
import { PaginaDaVitrine } from "@/components/vitrine/pagina"
import { FiltroDasFuncoes, PecasPorFuncao, type LinhaDaFuncao } from "@/components/vitrine/pecas-por-funcao"
import { celula, ligarCodigos, tabelaDaRegra } from "@/vitrine/base"
import { ligarPecas } from "@/vitrine/kit"

export const metadata = { title: "A peça de cada função" }

export default function PecaDeCadaFuncao() {
  const { linhas } = tabelaDaRegra("PECA-01")
  const dados: LinhaDaFuncao[] = linhas.map(([funcao = "", peca = "", naoUse = ""]) => {
    const ligado = ligarPecas(celula(peca))
    return {
      funcao: funcao.replace(/\*\*/g, ""),
      texto: peca.replace(/`/g, ""),
      peca: ligarCodigos(ligado.html),
      naoUse: ligarCodigos(celula(naoUse)),
      // No kit quando toda peça citada já se instala; uma que falte põe a linha em "Fora do kit".
      noKit: ligado.citadas > 0 && ligado.fora === 0,
    }
  })
  return (
    <PaginaDaVitrine
      titulo="Padrões"
      filtros={
        <>
          <AbasDosPadroes atual="pecas" />
          <FiltroDasFuncoes total={dados.length} noKit={dados.filter((d) => d.noKit).length} />
        </>
      }
      abertura="Cada função tem uma peça só. A peça que já está no kit leva à página dela; a que está fora (marcada) ainda não se instala, e a tela que precisar dela pede a peça ao kit antes de escrever uma à mão."
    >
      <PecasPorFuncao linhas={dados} />
    </PaginaDaVitrine>
  )
}
