import { Movimento } from "@/components/vitrine/movimento"
import { TOKENS } from "@/vitrine/tokens"

export const metadata = { title: "Movimento" }

export default function PaginaDoMovimento() {
  const { duracoes, atrasos, curvas, animacoes } = TOKENS
  return <Movimento dados={{ duracoes, atrasos, curvas, animacoes }} />
}
