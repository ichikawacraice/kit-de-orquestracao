import { Popover as PopoverPrimitive } from "radix-ui"

import { ConteudoDoMenu } from "@/components/ui/menu"

export function Filtros() {
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Content className="w-72 p-4">filtros</PopoverPrimitive.Content>
      <ConteudoDoMenu avoidCollisions={false}>linhas</ConteudoDoMenu>
    </PopoverPrimitive.Root>
  )
}
