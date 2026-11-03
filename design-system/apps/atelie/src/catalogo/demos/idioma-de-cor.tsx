"use client"

import { BADGE_DO_TOM, COR_DO_TOM_DENSO, PONTO_DO_TOM, TONS } from "@/lib/idioma-de-cor"
import { cn } from "@/lib/utils"

import { Amostra, Amostras } from "./_amostra"

export default function DemoDoIdiomaDeCor() {
  return (
    <Amostras>
      <Amostra titulo="Texto de voz" primeira>
        {TONS.map((tom) => (
          <span key={tom} className={cn("text-sm font-medium", COR_DO_TOM_DENSO[tom])}>
            {tom}
          </span>
        ))}
      </Amostra>
      <Amostra titulo="Marcador e selo">
        {TONS.map((tom) => (
          <span key={tom} className={cn("inline-flex items-center gap-1.5 rounded-badge px-2 py-0.5 text-xs font-medium", BADGE_DO_TOM[tom])}>
            <span aria-hidden className={cn("size-1.5 rounded-full", PONTO_DO_TOM[tom])} />
            {tom}
          </span>
        ))}
      </Amostra>
    </Amostras>
  )
}
