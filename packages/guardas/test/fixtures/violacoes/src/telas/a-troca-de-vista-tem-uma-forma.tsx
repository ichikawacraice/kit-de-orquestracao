import { Button } from '@/components/ui/button'
export const V = ({ m }: { m: string }) => (
  <div>
    <Button variant={m === 'a' ? 'secondary' : 'ghost'}>A</Button>
    <Button variant={m === 'b' ? 'secondary' : 'ghost'}>B</Button>
  </div>
)
