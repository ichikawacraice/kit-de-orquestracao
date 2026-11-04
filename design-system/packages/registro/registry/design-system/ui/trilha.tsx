import * as React from "react"
import { ChevronRightIcon } from "lucide-react"

import { LinkDoApp } from "@/registry/design-system/lib/link-do-app"
import { cn } from "@/registry/design-system/lib/utils"

type Degrau = {
  rotulo: string
  /** Sem `href`, o degrau não leva a lugar nenhum. O último nunca leva: é a página atual. */
  href?: string
}

/**
 * A trilha de volta da tela de detalhe (ANATOMIA CASCO-03): da lista de onde
 * veio até a tela atual. Mora no topo da página, acima do título.
 *
 * Todo degrau é link, menos o último — link para a própria página é botão que
 * não faz nada e ainda rouba o Tab de quem navega por teclado. O último leva
 * `aria-current="page"`.
 *
 * **O separador é isento de contraste (COR-13), e a isenção tem condição:** é
 * `aria-hidden` e não carrega informação — quem usa leitor de tela ouve uma
 * lista ordenada. Se o separador passar a dizer alguma coisa (virar botão,
 * ganhar rótulo), a isenção morre junto.
 */
function Trilha({ degraus, className }: { degraus: Degrau[]; className?: string }) {
  return (
    <nav aria-label="Trilha" data-slot="trilha" className={cn("text-legenda text-muted-foreground", className)}>
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {degraus.map((d, i) => {
          const ultimo = i === degraus.length - 1
          return (
            <li key={`${d.rotulo}-${i}`} className="flex items-center gap-x-1.5">
              {i > 0 ? <ChevronRightIcon aria-hidden="true" className="size-3 shrink-0 opacity-55" /> : null}
              {ultimo || !d.href ? (
                <span aria-current={ultimo ? "page" : undefined} className="text-foreground">
                  {d.rotulo}
                </span>
              ) : (
                <LinkDoApp
                  href={d.href}
                  className="rounded-sm transition-colors duration-cor hover:text-foreground hover:sublinhado-de-link focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  {d.rotulo}
                </LinkDoApp>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export { Trilha, type Degrau }
