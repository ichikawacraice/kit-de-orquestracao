import type { ReactNode } from 'react'
import type { Tom } from '@/lib/idioma-de-cor'
import { BADGE_DO_TOM } from '@/lib/idioma-de-cor'

export const CASCO_DO_CHIP = 'inline-flex items-center gap-[5px] rounded-md px-2 py-[3px] text-[11px]'

export function ChipDeEstado({ tom, children }: { tom: Tom; children: ReactNode }) {
  return <span className={`${CASCO_DO_CHIP} ${BADGE_DO_TOM[tom]}`}>{children}</span>
}
