import { AbasDeRota } from "@/components/vitrine/abas-de-rota"

const ABAS = [
  { chave: "tokens", rotulo: "Tokens", href: "/cores/" },
  { chave: "contraste", rotulo: "Contraste", href: "/cores/contraste/" },
  { chave: "vozes", rotulo: "Vozes", href: "/cores/vozes/" },
]

export function AbasDasCores({ atual }: { atual: "tokens" | "contraste" | "vozes" }) {
  return <AbasDeRota rotulo="O que ver das cores" abas={ABAS} atual={atual} />
}
