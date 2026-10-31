import { AbasDeRota } from "@/components/vitrine/abas-de-rota"
import { ARQUIVOS_DA_BASE } from "@/vitrine/base"

const ABAS = [
  { chave: "indice", rotulo: "Índice", href: "/regras/" },
  ...ARQUIVOS_DA_BASE.map((a) => ({ chave: a.id, rotulo: a.titulo, href: `/regras/${a.id}/` })),
]

export function AbasDasRegras({ atual }: { atual: string }) {
  return <AbasDeRota rotulo="Arquivo da base" abas={ABAS} atual={atual} />
}
