import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function FormDoPedido() {
  const [erros, setErros] = useState<Record<string, string>>({})
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setErros({ nome: 'Diga o nome do pedido' })
      }}
    >
      <Input name="nome" aria-invalid={Boolean(erros.nome)} />
      {erros.nome ? <p role="alert">{erros.nome}</p> : null}
      <Button type="submit">Gravar o pedido</Button>
    </form>
  )
}
