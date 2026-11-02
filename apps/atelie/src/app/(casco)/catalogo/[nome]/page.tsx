import Link from "next/link"
import { notFound } from "next/navigation"

import { Bloco } from "@/components/ui/bloco"
import { Comando } from "@/components/casco/comando"
import { Palcos } from "@/components/casco/palcos"
import { Ficha, ParDaFicha } from "@/components/ui/ficha"
import { Trilha } from "@/components/ui/trilha"
import { PaginaDaVitrine } from "@/components/vitrine/pagina"
import { exportsDoItem } from "@/vitrine/kit"
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
  const bloco = secao?.id === "blocos"
  const destino = bloco ? { rotulo: "Telas", href: "/telas/" } : { rotulo: "Peças", href: "/pecas/" }
  return (
    <PaginaDaVitrine titulo={item.title} trilha={<Trilha degraus={[destino, { rotulo: item.title }]} />} abertura={texto}>
      <Palcos nome={item.name} titulo={item.title} largo={bloco} />

      <Bloco titulo="Instalar">
        <Comando texto={comando} />
        <Ficha>
          {equivalente ? (
            <ParDaFicha rotulo="No shadcn" mono>
              {equivalente}
            </ParDaFicha>
          ) : null}
          {exportsDoItem().get(item.name)?.length ? (
            <ParDaFicha rotulo="Importa" mono>
              {exportsDoItem().get(item.name)!.join(", ")}
            </ParDaFicha>
          ) : null}
          <ParDaFicha rotulo="Item" mono>
            <a href={`/r/v${VERSAO}/${item.name}.json`} className="underline underline-offset-2">
              /r/v{VERSAO}/{item.name}.json
            </a>
          </ParDaFicha>
          <ParDaFicha rotulo="Arquivos" mono>
            {item.files.map((f) => f.path.replace(/^registry\/design-system\//, "")).join(", ")}
          </ParDaFicha>
          {doRegistro.length > 0 ? (
            <ParDaFicha rotulo="Traz junto">
              <span className="flex flex-wrap gap-x-3">
                {doRegistro.map((d) => (
                  <Link key={d} href={`/catalogo/${d}/`} className="underline underline-offset-2">
                    {itemPeloNome(d)?.title ?? d}
                  </Link>
                ))}
              </span>
            </ParDaFicha>
          ) : null}
          {item.dependencies?.length ? (
            <ParDaFicha rotulo="Do npm" mono>
              {item.dependencies.join(", ")}
            </ParDaFicha>
          ) : null}
        </Ficha>
      </Bloco>
    </PaginaDaVitrine>
  )
}
