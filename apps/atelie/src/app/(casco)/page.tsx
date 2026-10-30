import Link from "next/link"

import { Bloco, VOZ_DO_NOME_DE_BLOCO } from "@/components/ui/bloco"
import { Comando } from "@/components/casco/comando"
import { cn } from "@/lib/utils"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { HOST, ITENS, SECOES, VERSAO, descricaoDoItem, itensDaSecao } from "@/catalogo/registro"

const COMPONENTS_JSON = `"registries": {
  "@wicomm": "${HOST}/r/v${VERSAO}/{name}.json"
}`

export default function Inicio() {
  return (
    <div className="flex max-w-6xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="t-display">Ateliê Wicomm</h1>
        <p className="max-w-medida text-sm text-foreground-2">
          Todas as peças do registro, vivas, nos dois temas. O ateliê monta a si mesmo com elas, e serve o registro que os
          projetos instalam: {ITENS.length} itens na versão {VERSAO}.
        </p>
      </header>

      <Bloco titulo="Num projeto novo" nivel={2} recolhivel resumo="3 passos: o estilo, o registro, as peças" abertoPorPadrao={false}>
        {/* Provisório: vale até `Passos`/`Passo` entrarem no registro (PECA-01). */}
        <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm text-foreground-2">
          <li>
            O estilo:
            <Comando texto={`npx shadcn@latest init ${HOST}/r/v${VERSAO}/estilo.json`} className="mt-2" />
          </li>
          <li>
            O registro no <code className="font-mono text-controle">components.json</code>, com a versão no caminho:
            <Comando texto={COMPONENTS_JSON} className="mt-2" />
          </li>
          <li>
            As peças:
            <Comando texto="npx shadcn@latest add @wicomm/button" className="mt-2" />
          </li>
        </ol>
      </Bloco>

      {SECOES.map((secao) => {
        const itens = itensDaSecao(secao.id)
        return (
          <section key={secao.id} id={`secao-${secao.id}`} aria-labelledby={`titulo-${secao.id}`} className="flex scroll-mt-8 flex-col gap-2">
            <h2 id={`titulo-${secao.id}`} className={cn(VOZ_DO_NOME_DE_BLOCO, "px-1")}>
              {secao.titulo}
              <span className="ml-2 text-xs font-normal text-muted-foreground">{itens.length}</span>
            </h2>
            {itens.length === 0 ? (
              <p className="text-sm text-muted-foreground">{secao.vazio}</p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {itens.map((item) => (
                  <li key={item.name}>
                    <Link href={`/catalogo/${item.name}/`} className="block h-full rounded-cartao focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
                      <Card className="h-full transition-shadow duration-cor hover:superficie-alta">
                        <CardHeader>
                          <CardTitle>{item.title}</CardTitle>
                          <CardDescription className="line-clamp-2">{descricaoDoItem(item).texto}</CardDescription>
                        </CardHeader>
                      </Card>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}
