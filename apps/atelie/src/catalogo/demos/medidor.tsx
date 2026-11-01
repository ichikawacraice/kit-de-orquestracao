import { Medidor } from "@/components/ui/medidor"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

import { Amostra, Amostras } from "./_amostra"

const horas = (n: number) => `${n} h`

const LINHAS = [
  { projeto: "Portal do cliente", valor: 82, teto: 200 },
  { projeto: "Aplicativo de pedidos", valor: 184, teto: 200, tom: "espera" as const },
  { projeto: "Integração de estoque", valor: 231, teto: 200, tom: "ruim" as const },
  { projeto: "Relatórios", valor: 40, teto: null },
]

export default function DemoDoMedidor() {
  return (
    <Amostras>
      <Amostra titulo="As vozes" primeira>
        <div className="grid w-full max-w-2xl grid-cols-2 gap-6 sm:grid-cols-4">
          <Medidor valor={120} teto={200} rotulo="Horas do projeto" formatar={horas} />
          <Medidor valor={184} teto={200} rotulo="Horas do projeto" formatar={horas} tom="espera" />
          <Medidor valor={231} teto={200} rotulo="Horas do projeto" formatar={horas} tom="ruim" />
          <Medidor valor={0} teto={200} rotulo="Horas do projeto" formatar={horas} tom="neutro" />
        </div>
      </Amostra>
      <Amostra titulo="Sem teto">
        <Medidor valor={120} teto={null} rotulo="Horas do projeto" formatar={horas} />
      </Amostra>
      <Amostra titulo="Não carregou">
        <Medidor valor={Number.NaN} teto={200} rotulo="Horas do projeto" formatar={horas} />
      </Amostra>
      <Amostra titulo="Compacto, numa coluna da tabela">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Projeto</TableHead>
              <TableHead className="w-40">Horas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {LINHAS.map((l) => (
              <TableRow key={l.projeto}>
                <TableCell>{l.projeto}</TableCell>
                <TableCell>
                  <Medidor valor={l.valor} teto={l.teto} rotulo={`Horas de ${l.projeto}`} formatar={horas} tom={l.tom} compacto />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Amostra>
    </Amostras>
  )
}
