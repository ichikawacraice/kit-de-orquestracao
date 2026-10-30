import Link from "next/link"
import { notFound } from "next/navigation"

import { Bloco } from "@/components/ui/bloco"
import { Button } from "@/components/ui/button"
import { Comando } from "@/components/casco/comando"
import { Palcos } from "@/components/casco/palcos"
import { Trilha } from "@/components/casco/trilha"
import { HOST, ITENS, SECOES, VERSAO, descricaoDoItem, itemPeloNome, nomeDaDependencia, secaoDoItem } from "@/catalogo/registro"

export const dynamicParams = false

export function generateStaticParams() {
  return ITENS.map((i) => ({ nome: i.name }))
}

export async function generateMetadata({ params }: { params: Promise<{ nome: string }> }) {
  const { nome } = await params
  return { title: itemPeloNome(nome)?.title ?? nome }
}

/** A página de um item do registro: o que é, como instala, e ele vivo nos dois temas. */
export default async function PaginaDoItem({ params }: { params: Promise<{ nome: string }> }) {
  const { nome } = await params
  const item = itemPeloNome(nome)
  if (!item) notFound()
  const { equivalente, texto } = descricaoDoItem(item)
  const secao = SECOES.find((s) => s.id === secaoDoItem(item))
  const doRegistro = (item.registryDependencies ?? []).map(nomeDaDependencia).filter((d) => d !== "estilo")
  const comando =
    item.type === "registry:style"
      ? `npx shadcn@latest init ${HOST}/r/v${VERSAO}/estilo.json`
      : `npx shadcn@latest add @wicomm/${item.name}`
  return (
    <article className="flex max-w-6xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <Trilha passos={[{ rotulo: "Início", href: "/" }, { rotulo: secao?.titulo ?? "Catálogo", href: `/#secao-${secao?.id ?? "pecas"}` }]} />
        <h1 className="t-display">{item.title}</h1>
        <p className="max-w-medida text-sm text-foreground-2">{texto}</p>
      </header>

      <Palcos nome={item.name} titulo={item.title} largo={secao?.id === "blocos"} />

      <Bloco titulo="Instalar" nivel={2}>
        <Comando texto={comando} />
        {/* Provisório: vale até `Ficha`/`ParDaFicha` entrarem no registro (PECA-01). */}
        <dl className="grid items-baseline gap-x-6 gap-y-2 text-controle sm:grid-cols-[max-content_1fr]">
          {equivalente ? (
            <>
              <dt className="t-coluna">No shadcn</dt>
              <dd className="font-mono">{equivalente}</dd>
            </>
          ) : null}
          <dt className="t-coluna">Item</dt>
          <dd>
            <Button asChild variant="link" className="font-mono">
              <a href={`/r/v${VERSAO}/${item.name}.json`}>/r/v{VERSAO}/{item.name}.json</a>
            </Button>
          </dd>
          <dt className="t-coluna">Arquivos</dt>
          <dd className="font-mono">{item.files.map((f) => f.path.replace(/^registry\/wicomm\//, "")).join(", ")}</dd>
          {doRegistro.length > 0 ? (
            <>
              <dt className="t-coluna">Traz junto</dt>
              <dd className="flex flex-wrap gap-x-3">
                {doRegistro.map((d) => (
                  <Button key={d} asChild variant="link">
                    <Link href={`/catalogo/${d}/`}>{itemPeloNome(d)?.title ?? d}</Link>
                  </Button>
                ))}
              </dd>
            </>
          ) : null}
          {item.dependencies?.length ? (
            <>
              <dt className="t-coluna">Do npm</dt>
              <dd className="font-mono">{item.dependencies.join(", ")}</dd>
            </>
          ) : null}
        </dl>
      </Bloco>
    </article>
  )
}
