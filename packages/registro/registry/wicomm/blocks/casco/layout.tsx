import { CascoNoNext } from "@/registry/wicomm/blocks/casco/casco-no-next"

/**
 * O layout das telas dentro do casco — EXEMPLO para o App Router do Next. O
 * `<html>` do app leva `suppressHydrationWarning`: o tema e a barra recolhida
 * entram como marca no `<html>` antes da hidratação (os scripts do casco).
 */
export default function LayoutDoCasco({ children }: { children: React.ReactNode }) {
  return <CascoNoNext>{children}</CascoNoNext>
}
