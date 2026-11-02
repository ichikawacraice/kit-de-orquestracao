import { Suspense } from "react"

import { MesaDoPedido } from "@/registry/design-system/blocks/mesa/mesa-do-pedido"
import { cargaDaMesa } from "@/registry/design-system/blocks/mesa/dados-da-mesa"

type Rota = Promise<{ id: string }>
type Busca = Promise<{ estado?: string }>

async function MesaDoEndereco({ params, searchParams }: { params: Rota; searchParams: Busca }) {
  const [{ id }, { estado }] = await Promise.all([params, searchParams])
  return <MesaDoPedido key={estado ?? "pronto"} carga={cargaDaMesa(id, estado)} hrefDaConferencia={`/pedidos/${id}?estado=a-conferir`} />
}

/**
 * A página de EXEMPLO da Mesa, dentro do casco, abaixo da Lista. `?estado=`
 * escolhe o momento (`carregando`, `carregando-abas`, `a-conferir`, `andando`,
 * `erro`, `recusa`, `sucesso`, `leitura`, `sem-permissao`). A espera da leitura
 * é o estado de carregando da própria Mesa.
 */
export default function PaginaDoPedido({ params, searchParams }: { params: Rota; searchParams: Busca }) {
  return (
    <Suspense fallback={<MesaDoPedido carga={cargaDaMesa("", "carregando")} />}>
      <MesaDoEndereco params={params} searchParams={searchParams} />
    </Suspense>
  )
}
