import { Bloco } from "@/components/ui/bloco"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AbasDosPadroes } from "@/components/vitrine/abas-dos-padroes"
import { PaginaDaVitrine } from "@/components/vitrine/pagina"
import { LinkDaRegra } from "@/components/vitrine/regra"
import { celula, ligarCodigos, tabelaDaRegra } from "@/vitrine/base"
import { ligarPecas } from "@/vitrine/kit"

export const metadata = { title: "Onde mora cada mensagem" }

export default function Mensagens() {
  const { cabecalho, linhas } = tabelaDaRegra("MSG-01")
  const iPeca = cabecalho.indexOf("Peça")
  return (
    <PaginaDaVitrine
      titulo="Padrões"
      filtros={<AbasDosPadroes atual="mensagens" />}
      abertura="A pergunta que decide o lugar: a quem a mensagem diz respeito, e por quanto tempo ela vale? Ela mora o mais perto possível da coisa de que fala, e dura o tempo que vale."
    >
      <Bloco nome="matriz" titulo="A matriz das mensagens" legenda={`${linhas.length} lugares`}>
        <Table>
          <TableHeader>
            <TableRow>
              {cabecalho.map((c) => (
                <TableHead key={c}>{c}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map((l) => (
              <TableRow key={l[0]}>
                {l.map((c, i) => {
                  const html = ligarCodigos(celula(c))
                  const ligado = i === iPeca ? ligarPecas(html).html : html
                  return (
                    <TableCell key={i} className="h-auto py-2.5 align-top whitespace-normal">
                      <span className={i === 0 ? "text-foreground" : "text-foreground-2"} dangerouslySetInnerHTML={{ __html: ligado }} />
                    </TableCell>
                  )
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="t-denso text-foreground-2">
          As outras regras das mensagens: <LinkDaRegra codigo="MSG-02" /> · <LinkDaRegra codigo="MSG-03" /> · <LinkDaRegra codigo="MSG-04" /> ·{" "}
          <LinkDaRegra codigo="MSG-05" /> · <LinkDaRegra codigo="MSG-06" />
        </p>
      </Bloco>
    </PaginaDaVitrine>
  )
}
