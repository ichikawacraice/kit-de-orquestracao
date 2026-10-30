import { Card, CardContent } from "@/components/ui/card"
import { Ficha, ParDaFicha } from "@/components/ui/ficha"

export default function DemoDaFicha() {
  return (
    <Card className="max-w-md">
      <CardContent className="pt-6">
        <Ficha>
          <ParDaFicha rotulo="Cliente">Ana Souza</ParDaFicha>
          <ParDaFicha rotulo="Criado em">28/10/2026, 14:32</ParDaFicha>
          <ParDaFicha rotulo="Valor">R$ 312,90</ParDaFicha>
          <ParDaFicha rotulo="Entrega">{null}</ParDaFicha>
        </Ficha>
      </CardContent>
    </Card>
  )
}
