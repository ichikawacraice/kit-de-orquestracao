// O mínimo do Next que a cola de exemplo do casco usa, para o `tsc` do pacote
// conferir a cola sem instalar o Next (quem prova com o Next de verdade é o
// `next build` do num-next-vazio).
declare module "next/link" {
  import type * as React from "react"
  const Link: React.ComponentType<Omit<React.ComponentProps<"a">, "href"> & { href: string; prefetch?: boolean; replace?: boolean }>
  export default Link
}

declare module "next/navigation" {
  export function usePathname(): string | null
  export function useSearchParams(): { get(nome: string): string | null }
}
