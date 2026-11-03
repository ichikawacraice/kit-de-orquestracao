import { Card } from '@/components/ui/card'
import { Trilha } from '@/components/ui/trilha'

export default function Projeto() {
  return (
    <main>
      <Trilha volta="/" />
      <h1 className="t-display">O pedido</h1>
      <Card>Detalhe do pedido</Card>
    </main>
  )
}
