import { Suspense } from "react"

import { TelaDeEntrada, type MomentoDaEntrada } from "@/registry/design-system/blocks/entrada/tela-de-entrada"

const MOMENTOS: MomentoDaEntrada[] = ["pronto", "andando", "erro-campo", "erro", "recusa"]

async function EntradaDoEndereco({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const { estado } = await searchParams
  const momento = MOMENTOS.includes(estado as MomentoDaEntrada) ? (estado as MomentoDaEntrada) : "pronto"
  return <TelaDeEntrada key={momento} momento={momento} />
}

/**
 * A página de EXEMPLO da Entrada, fora do casco. `?estado=` escolhe o momento
 * (`andando`, `erro-campo`, `erro`, `recusa`). O app liga `aoEntrar` à própria
 * autenticação.
 */
export default function PaginaDeEntrada({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  return (
    <Suspense fallback={<TelaDeEntrada />}>
      <EntradaDoEndereco searchParams={searchParams} />
    </Suspense>
  )
}
