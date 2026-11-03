import { FiltroDePecas, IndiceDePecas, type GrupoDePecas } from "@/components/vitrine/indice-de-pecas"
import { PaginaDaVitrine } from "@/components/vitrine/pagina"
import { exportsDoItem } from "@/vitrine/kit"
import { VERSAO, descricaoDoItem, itensDaSecao, type Item } from "@/catalogo/registro"

export const metadata = { title: "Peças" }

const linha = (i: Item) => {
  const { equivalente, texto } = descricaoDoItem(i)
  return { nome: i.name, titulo: i.title, texto, equivalente, exports: exportsDoItem().get(i.name) ?? [] }
}

export default function Pecas() {
  const grupos: GrupoDePecas[] = [
    { id: "estilo", titulo: "Estilo e utilitários", legenda: "O que se instala primeiro.", linhas: itensDaSecao("fundamentos").map(linha) },
    { id: "pecas", titulo: "Peças", legenda: "Uma peça por função.", linhas: itensDaSecao("pecas").map(linha) },
  ]
  const total = grupos.reduce((n, g) => n + g.linhas.length, 0)
  return (
    <PaginaDaVitrine
      titulo="Peças"
      filtros={<FiltroDePecas />}
      abertura={`As ${total} peças do registro ${VERSAO}, cada uma viva nos dois temas na página dela, com o comando para instalar. As telas montadas estão em Telas.`}
    >
      <IndiceDePecas grupos={grupos} />
    </PaginaDaVitrine>
  )
}
