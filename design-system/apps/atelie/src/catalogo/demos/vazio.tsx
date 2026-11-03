import { FilterXIcon, InboxIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Vazio } from "@/components/ui/vazio"

export default function DemoDoVazio() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Vazio causa="nada-ainda" icone={InboxIcon} titulo="Nenhum pedido ainda">
        Os pedidos aparecem aqui assim que a loja receber o primeiro.
      </Vazio>
      <Vazio
        causa="filtro"
        icone={FilterXIcon}
        titulo="Nenhum pedido com este filtro"
        acao={
          <Button variant="outline" size="sm">
            Limpar o filtro
          </Button>
        }
      >
        O filtro escondeu todos os pedidos.
      </Vazio>
    </div>
  )
}
