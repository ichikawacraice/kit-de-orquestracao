import { InfoIcon } from "lucide-react"

import { Bloco } from "@/components/ui/bloco"
import { PaginaDaVitrine } from "@/components/vitrine/pagina"
import { LinkDaRegra } from "@/components/vitrine/regra"
import { GRUPOS_DE_ICONES } from "@/vitrine/icones"

export const metadata = { title: "Ícones" }

const TAMANHOS = [
  { classe: "size-3.5", px: 14, onde: "Dentro de controle pequeno, carimbo, abas" },
  { classe: "size-4", px: 16, onde: "Botão, menu, campo" },
  { classe: "size-4.5", px: 18, onde: "Item de navegação" },
]

export default function Icones() {
  return (
    <PaginaDaVitrine
      titulo="Ícones"
      abertura="Uma biblioteca, o lucide-react, com o traço padrão. A mesma função usa sempre o mesmo glifo; ícone de função tem rótulo ao lado, ou nome acessível quando é botão de ícone."
    >
      <Bloco nome="tamanhos" titulo="Tamanhos" legenda="14, 16 e 18px.">
        <div className="flex flex-wrap gap-8">
          {TAMANHOS.map((t) => (
            <div key={t.classe} className="flex items-center gap-3">
              <InfoIcon aria-hidden="true" className={`${t.classe} text-foreground`} />
              <span className="flex flex-col">
                <span className="t-medida text-foreground">
                  {t.classe} · {t.px}px
                </span>
                <span className="t-denso text-foreground-2">{t.onde}</span>
              </span>
            </div>
          ))}
        </div>
        <p className="t-denso text-foreground-2">
          <LinkDaRegra codigo="CTRL-09" /> · <LinkDaRegra codigo="CTRL-08" />
        </p>
      </Bloco>
      {GRUPOS_DE_ICONES.map((g) => (
        <Bloco key={g.titulo} titulo={g.titulo} className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {g.icones.map(({ nome, icone: Icone, funcao }) => (
            <div key={nome} className="flex items-start gap-3 p-1">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-ctrl bg-muted">
                <Icone aria-hidden="true" className="size-4.5 text-foreground" />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="t-denso text-foreground">{funcao}</span>
                <span className="t-medida truncate text-legenda text-muted-foreground">{nome}</span>
              </span>
            </div>
          ))}
        </Bloco>
      ))}
      <Bloco nome="fora" titulo="O que ainda não está no kit">
        <p className="t-denso text-foreground-2">
          O ícone de IA tem peça própria, com degradê, e ainda não está no registro: não desenhe um à mão. Para uma função nova, procure na mesma
          biblioteca, em{" "}
          <a href="https://lucide.dev/icons/" rel="noreferrer" className="underline underline-offset-2">
            lucide.dev/icons
          </a>
          , e traga o glifo para esta lista.
        </p>
      </Bloco>
    </PaginaDaVitrine>
  )
}
