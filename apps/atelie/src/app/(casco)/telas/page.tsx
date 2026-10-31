import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"

import { Secao } from "@/components/ui/secao"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PaginaDaVitrine } from "@/components/vitrine/pagina"
import { LinkDaRegra } from "@/components/vitrine/regra"
import { itemPeloNome } from "@/catalogo/registro"
import { celula, ligarCodigos, tabelaDaRegra } from "@/vitrine/base"

export const metadata = { title: "Telas" }

/** O arquétipo e o bloco do registro que o monta. */
const BLOCO: Record<string, string | undefined> = { Lista: "lista", Mesa: "mesa", Editor: "editor", Entrada: "entrada", "Formulário": undefined }

function Porta({ titulo, pergunta, regioes, bloco }: { titulo: string; pergunta: string; regioes: string; bloco?: string }) {
  const item = bloco ? itemPeloNome(bloco) : undefined
  const corpo = (
    <Card className={item ? "h-full transition-shadow duration-cor hover:superficie-alta motion-reduce:transition-none" : "h-full"}>
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
        <CardDescription dangerouslySetInnerHTML={{ __html: pergunta }} />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="t-denso text-foreground-2" dangerouslySetInnerHTML={{ __html: regioes }} />
        {item ? (
          <span className="flex items-center gap-1.5 text-controle text-foreground">
            Ver montada <ArrowRightIcon aria-hidden="true" className="size-4" />
          </span>
        ) : (
          <span className="t-denso text-muted-foreground">Ainda não tem bloco no registro.</span>
        )}
      </CardContent>
    </Card>
  )
  return item ? (
    <Link href={`/catalogo/${item.name}/`} className="block h-full rounded-cartao focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
      {corpo}
    </Link>
  ) : (
    corpo
  )
}

export default function Telas() {
  const { cabecalho, linhas } = tabelaDaRegra("ARQ-01")
  const col = (n: string) => cabecalho.indexOf(n)
  return (
    <PaginaDaVitrine
      titulo="Telas"
      abertura="Toda tela é um de cinco arquétipos, dentro do casco. Saber qual é a sua tela diz onde está o primário antes de ler; cada bloco abre montado, nos dois temas."
    >
      <Secao nome="arquetipos" titulo="O casco e os arquétipos" nivel={2} primeira>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Porta
          titulo="Casco"
          pergunta="<em>Onde estou, e para onde vou?</em>"
          regioes="A barra lateral com os destinos, o cabeçalho opcional e a região do conteúdo. O casco não rola; o conteúdo rola."
          bloco="casco"
        />
        {linhas.map((l) => {
          const nome = (l[col("Arquétipo")] ?? "").replace(/\*\*/g, "")
          return (
            <Porta
              key={nome}
              titulo={nome}
              pergunta={ligarCodigos(celula(l[col("Pergunta")] ?? ""))}
              regioes={ligarCodigos(celula(l[col("Regiões")] ?? ""))}
              bloco={BLOCO[nome]}
            />
          )
        })}
        </div>
      </Secao>
      <p className="t-denso text-foreground-2">
        A tela que não cabe em nenhum vira arquétipo novo na base, antes do código: <LinkDaRegra codigo="ARQ-01" /> · <LinkDaRegra codigo="CASCO-01" />
      </p>
    </PaginaDaVitrine>
  )
}
