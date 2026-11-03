import type { ReactNode } from 'react'

export function Tabs({ children }: { value: string; onValueChange: (v: string) => void; children: ReactNode }) {
  return <div className="animate-in fade-in-0 motion-reduce:animate-none">{children}</div>
}
