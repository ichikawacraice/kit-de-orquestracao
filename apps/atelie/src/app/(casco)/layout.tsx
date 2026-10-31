import type { ReactNode } from "react"

import { CascoDaVitrine } from "@/components/casco/casco-da-vitrine"

export default function LayoutDoCasco({ children }: { children: ReactNode }) {
  return <CascoDaVitrine>{children}</CascoDaVitrine>
}
