import type { ReactNode } from 'react'

function Card({ children }: { children: ReactNode }) {
  return <div data-superficie className="superficie rounded-2xl p-4">{children}</div>
}

export { Card }
