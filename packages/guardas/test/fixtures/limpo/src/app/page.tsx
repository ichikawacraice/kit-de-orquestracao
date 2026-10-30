import { Painel } from '@/components/Painel'
import { Entrada } from '@/components/Entrada'
import { FormDoPedido } from '@/components/FormDoPedido'

export default function Inicio() {
  return (
    <main>
      <h1 className="t-display">Pedidos</h1>
      <Painel aba="lista" trocar={() => {}} />
      <Entrada />
      <FormDoPedido />
    </main>
  )
}
