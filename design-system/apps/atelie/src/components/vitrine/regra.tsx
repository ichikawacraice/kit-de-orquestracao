import Link from "next/link"

import { hrefDaRegra, regraPeloCodigo } from "@/vitrine/base"

/** O código de uma regra, como link para ela na página de Regras. */
export function LinkDaRegra({ codigo }: { codigo: string }) {
  const r = regraPeloCodigo(codigo)
  if (!r) throw new Error(`a regra ${codigo} não existe na base`)
  return (
    <Link href={hrefDaRegra(r)} className="t-medida text-foreground-2 underline underline-offset-2 hover:text-foreground">
      {codigo}
    </Link>
  )
}
