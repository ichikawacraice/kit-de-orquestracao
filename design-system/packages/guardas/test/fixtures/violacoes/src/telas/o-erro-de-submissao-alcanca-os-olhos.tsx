import { useState } from 'react'
import { Input } from '@/components/ui/input'
export function V() {
  const [erros, setErros] = useState<Record<string, string>>({})
  return (
    <form onSubmit={() => setErros({ email: 'Diga o email' })}>
      <Input name="email" />
      {Object.keys(erros).length}
    </form>
  )
}
