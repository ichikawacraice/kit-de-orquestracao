import { Card } from '@/components/ui/card'
import { ChipDeEstado } from '@/components/ui/chip-de-estado'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { Tabs } from '@/components/ui/tabs'
import { Check } from 'lucide-react'

export function Painel({ aba, trocar }: { aba: string; trocar: (v: string) => void }) {
  const [dialogo, confirmar] = useConfirm()
  async function apagar() {
    if (await confirmar({ titulo: 'Apagar o pedido', confirmar: 'Apagar' })) trocar('lista')
  }
  return (
    <Card>
      <Tabs value={aba} onValueChange={trocar}>
        <ChipDeEstado tom="ok">
          <Check aria-hidden /> Pronto
        </ChipDeEstado>
        <p className="t-rotulo">Pedidos abertos</p>
        <Button variant="destructive" onClick={() => void apagar()}>
          Apagar
        </Button>
        <Button variant="outline" onClick={() => trocar('lista')}>
          Ver a lista
        </Button>
      </Tabs>
      {dialogo}
    </Card>
  )
}
