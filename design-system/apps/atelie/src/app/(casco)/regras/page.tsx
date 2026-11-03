import { AbasDasRegras } from "@/components/vitrine/abas-das-regras"
import { FiltroDeRegras, IndiceDeRegras } from "@/components/vitrine/indice-de-regras"
import { PaginaDaVitrine } from "@/components/vitrine/pagina"
import { base, hrefDaRegra } from "@/vitrine/base"

export const metadata = { title: "Regras" }

export default function Regras() {
  const linhas = base().flatMap((a) =>
    a.capitulos.flatMap((c) =>
      c.regras.map((r) => ({ codigo: r.codigo, titulo: r.titulo, confere: r.confereCurto, arquivo: a.titulo, capitulo: c.titulo, href: hrefDaRegra(r) }))
    )
  )
  return (
    <PaginaDaVitrine
      titulo="Regras"
      filtros={
        <>
          <AbasDasRegras atual="indice" />
          <FiltroDeRegras />
        </>
      }
      abertura={`As ${linhas.length} regras da base, com o porquê e quem as cobra. Cada regra tem um código; é por ele que o designer, o crítico, as guardas e os PRs a citam.`}
    >
      <IndiceDeRegras linhas={linhas} />
    </PaginaDaVitrine>
  )
}
