import { Bloco } from "@/components/ui/bloco"
import { Secao } from "@/components/ui/secao"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Comando } from "@/components/casco/comando"
import { IrParaASecao } from "@/components/vitrine/ir-para-a-secao"
import { PaginaDaVitrine } from "@/components/vitrine/pagina"
import { guia, type Parte } from "@/vitrine/comecar"

export const metadata = { title: "Começar" }

const PROSA =
  "flex flex-col gap-3 text-sm text-foreground-2 [&_li]:ml-5 [&_ol]:flex [&_ol]:list-decimal [&_ol]:flex-col [&_ol]:gap-1.5 [&_strong]:text-foreground [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-1.5"

function Partes({ partes }: { partes: Parte[] }) {
  return partes.map((p, i) => {
    if (p.tipo === "comando") return <Comando key={i} texto={p.texto} />
    if (p.tipo === "html") return <div key={i} className={PROSA} dangerouslySetInnerHTML={{ __html: p.html }} />
    return (
      <div key={i} className="-mx-3 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {p.cabecalho.map((c, j) => (
                <TableHead key={j} dangerouslySetInnerHTML={{ __html: c }} />
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {p.linhas.map((linha, j) => (
              <TableRow key={j}>
                {linha.map((c, k) => (
                  <TableCell key={k} className="align-top" dangerouslySetInnerHTML={{ __html: c }} />
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  })
}

export default function Comecar() {
  const { abertura, secoes } = guia()
  return (
    <PaginaDaVitrine
      titulo="Começar"
      filtros={<IrParaASecao secoes={secoes.map((s) => ({ ancora: s.ancora, titulo: s.titulo }))} />}
      abertura={<span dangerouslySetInnerHTML={{ __html: abertura.replace(/^<p>|<\/p>\s*$/g, "") }} />}>
      {secoes.map((s) => (
        <Bloco key={s.ancora} nome={s.ancora} titulo={s.titulo} className="flex max-w-medida flex-col gap-3">
          {s.subsecoes.map((sub, i) =>
            sub.titulo ? (
              <Secao key={sub.ancora} nome={sub.ancora} titulo={sub.titulo} primeira={i === 0}>
                <Partes partes={sub.partes} />
              </Secao>
            ) : (
              <Partes key={i} partes={sub.partes} />
            ),
          )}
        </Bloco>
      ))}
    </PaginaDaVitrine>
  )
}
