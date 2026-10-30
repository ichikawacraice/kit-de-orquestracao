import Link from "next/link"
import { ChevronRightIcon } from "lucide-react"

/**
 * A trilha da tela de detalhe (CASCO-03), até o bloco do casco entrar no
 * registro: os passos até a lista de onde se veio, todos com link. O nome da
 * tela aberta não se repete aqui: o `h1` logo abaixo já o diz.
 */
export function Trilha({ passos }: { passos: { rotulo: string; href: string }[] }) {
  return (
    <nav aria-label="Trilha" className="text-controle text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-1">
        {passos.map((p, i) => (
          <li key={p.href} className="flex items-center gap-1">
            {i > 0 ? <ChevronRightIcon className="size-3.5" aria-hidden /> : null}
            <Link href={p.href} className="hover:text-foreground">
              {p.rotulo}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  )
}
