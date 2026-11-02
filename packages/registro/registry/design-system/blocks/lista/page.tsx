import { Suspense } from "react"

import { ListaDePedidos } from "@/registry/design-system/blocks/lista/lista-de-pedidos"
import { cargaDaLista, MODOS, type Modo } from "@/registry/design-system/blocks/lista/dados-da-lista"

type Busca = Promise<{ estado?: string; modo?: string }>

async function ListaDoEndereco({ searchParams }: { searchParams: Busca }) {
  const { estado, modo } = await searchParams
  const modoInicial = MODOS.some((m) => m.chave === modo) ? (modo as Modo) : estado === "andando" ? "andando" : undefined
  // A chave refaz a Lista quando o endereço muda o modo (o clique na barra volta a `/pedidos`): a fila aberta é a do endereço (CONV-06).
  return <ListaDePedidos key={`${estado ?? ""}:${modo ?? ""}`} carga={cargaDaLista(estado)} modoInicial={modoInicial} />
}

/**
 * A página de EXEMPLO da Lista, dentro do casco. `?estado=` escolhe a carga
 * (`carregando`, `erro`, `sem-permissao`, `vazio`, `vazio-filtro`, `andando`);
 * `?modo=`, a fila aberta. O projeto troca `cargaDaLista` pela própria consulta.
 * A espera da leitura é o estado de carregando da própria Lista.
 */
export default function PaginaDePedidos({ searchParams }: { searchParams: Busca }) {
  return (
    <Suspense fallback={<ListaDePedidos carga={{ tipo: "carregando" }} />}>
      <ListaDoEndereco searchParams={searchParams} />
    </Suspense>
  )
}
