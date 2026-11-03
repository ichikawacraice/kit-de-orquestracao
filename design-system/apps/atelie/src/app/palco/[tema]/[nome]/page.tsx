import { notFound } from "next/navigation"

import { Palco } from "@/components/casco/palco-interno"
import { DEMOS } from "@/catalogo/demos"
import { ITENS, TEMAS, itemPeloNome } from "@/catalogo/registro"

export const dynamicParams = false

export function generateStaticParams() {
  return TEMAS.flatMap((t) => ITENS.map((i) => ({ tema: t.id, nome: i.name })))
}

export async function generateMetadata({ params }: { params: Promise<{ nome: string }> }) {
  const { nome } = await params
  return { title: itemPeloNome(nome)?.title ?? nome, robots: { index: false } }
}

/** A página que vai dentro do iframe: só a demonstração, num tema. */
export default async function PaginaDoPalco({ params }: { params: Promise<{ tema: string; nome: string }> }) {
  const { tema, nome } = await params
  const item = itemPeloNome(nome)
  const Demo = DEMOS[nome]
  if (!item || !Demo) notFound()
  return (
    <Palco tema={tema}>
      <h1 className="t-display sr-only">{item.title}</h1>
      <Demo />
    </Palco>
  )
}
