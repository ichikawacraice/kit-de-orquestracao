import { AbasDeRota } from "@/components/vitrine/abas-de-rota"

const ABAS = [
  { chave: "mensagens", rotulo: "Onde mora cada mensagem", href: "/padroes/" },
  { chave: "pecas", rotulo: "A peça de cada função", href: "/padroes/pecas-por-funcao/" },
]

export function AbasDosPadroes({ atual }: { atual: "mensagens" | "pecas" }) {
  return <AbasDeRota rotulo="Padrão" abas={ABAS} atual={atual} />
}
