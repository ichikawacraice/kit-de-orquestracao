import type { ReactNode } from "react"

import { BarraLateral } from "@/components/casco/barra-lateral"

export default function LayoutDoCasco({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <BarraLateral />
      <main className="min-w-0 flex-1 px-10 py-8">{children}</main>
    </div>
  )
}
