import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function Entrada() {
  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <Input tamanho="xl" name="email" />
      <Button type="submit" size="sm">
        Entrar
      </Button>
    </form>
  )
}
