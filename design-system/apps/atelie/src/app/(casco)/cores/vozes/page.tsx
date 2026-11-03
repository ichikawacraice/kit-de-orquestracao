import type * as React from "react"

import { Bloco } from "@/components/ui/bloco"
import { CASCO_DO_CARIMBO, ChipDeEstado } from "@/components/ui/chip-de-estado"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AbasDasCores } from "@/components/vitrine/abas-das-cores"
import { PaginaDaVitrine } from "@/components/vitrine/pagina"
import { BADGE_DO_TOM, COR_DO_TOM, COR_DO_TOM_DENSO, FILETE_DO_TOM, PONTO_DO_TOM, TINTA_DO_TOM, TONS, type Tom } from "@/lib/idioma-de-cor"
import { cn } from "@/lib/utils"
import { TOKENS, type Tema } from "@/vitrine/tokens"

export const metadata = { title: "Vozes" }

/** COR-03: a pergunta que cada voz responde — *o que isto pede de você?* */
const RESPONDE: Record<Tom, { familia: string; responde: string; exemplo: string }> = {
  ok: { familia: "emerald", responde: "nada: acabou e deu certo", exemplo: "entregue" },
  espera: { familia: "amber", responde: "decisão sua: é você quem está bloqueando", exemplo: "pede você" },
  ruim: { familia: "rose", responde: "conserto: quebrou", exemplo: "falhou" },
  alheio: { familia: "violet", responde: "nada, porque está com outra pessoa", exemplo: "com o financeiro" },
  neutro: { familia: "token muted-foreground", responde: "nada ainda: está andando, ou não foi feito de propósito", exemplo: "em separação" },
}

/**
 * As classes de um mapa como o tema as pinta: no claro, sem os termos `dark:`;
 * no escuro, os termos `dark:` sem o prefixo, por cima dos de base. Assim a
 * amostra de cada tema não depende do tema da página (a variante `dark:` não
 * deixa existir uma ilha clara dentro de `.dark`).
 */
function doTema(classes: string, tema: Tema): string {
  const termos = classes.split(/\s+/)
  const base = termos.filter((t) => !t.startsWith("dark:"))
  return tema === "claro" ? base.join(" ") : cn(base.join(" "), termos.filter((t) => t.startsWith("dark:")).map((t) => t.slice(5)).join(" "))
}

function Mapas({ tema }: { tema: Tema }) {
  const c = (classes: string) => doTema(classes, tema)
  return (
    <figure className="flex min-w-0 flex-col gap-2">
      <figcaption className="t-coluna">{tema === "claro" ? "Claro" : "Escuro"}</figcaption>
      {/* As variáveis do tema da amostra, no próprio contêiner: o fundo e a tinta são os dele, qualquer que seja o da página. */}
      <div className="rounded-cartao bg-background p-3 text-foreground ring-1 ring-border" style={TOKENS.variaveis[tema] as React.CSSProperties}>
        <Table>
          <TableHeader className="bg-background">
            <TableRow>
              <TableHead>Voz</TableHead>
              <TableHead>Carimbo</TableHead>
              <TableHead>Ponto</TableHead>
              <TableHead>Texto pequeno</TableHead>
              <TableHead>Número grande</TableHead>
              <TableHead>Tinta</TableHead>
              <TableHead>Filete</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {TONS.map((tom) => (
              <TableRow key={tom} className="hover:bg-transparent">
                <TableCell className="t-medida text-foreground">{tom}</TableCell>
                <TableCell>
                  <span className={c(cn(CASCO_DO_CARIMBO, BADGE_DO_TOM[tom]))}>{RESPONDE[tom].exemplo}</span>
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden="true" className={c(cn("size-1.5 shrink-0 rounded-full", PONTO_DO_TOM[tom]))} />
                    <span className={c(cn("t-denso", COR_DO_TOM_DENSO[tom]))}>{RESPONDE[tom].exemplo}</span>
                  </span>
                </TableCell>
                <TableCell className={c(COR_DO_TOM_DENSO[tom])}>{RESPONDE[tom].exemplo}</TableCell>
                <TableCell className={c(cn("t-display tabular-nums", COR_DO_TOM[tom]))}>12</TableCell>
                <TableCell>
                  <span className={c(cn("block rounded-xl px-3 py-2 text-foreground-2", TINTA_DO_TOM[tom]))}>detalhe</span>
                </TableCell>
                <TableCell>
                  <span className={c(cn("block h-6 border-l-2 pl-2 text-foreground-2", FILETE_DO_TOM[tom]))}>linha</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </figure>
  )
}

export default function Vozes() {
  return (
    <PaginaDaVitrine
      titulo="Cores"
      filtros={<AbasDasCores atual="vozes" />}
      abertura="A cor de estado responde uma pergunta só, em toda tela: o que isto pede de você? O componente declara o tom; a cor vem do mapa."
    >
      <Bloco nome="perguntas" titulo="O que cada voz responde">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Voz</TableHead>
              <TableHead>Família</TableHead>
              <TableHead>Responde</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {TONS.map((tom) => (
              <TableRow key={tom}>
                <TableCell>
                  <ChipDeEstado tom={tom}>{tom}</ChipDeEstado>
                </TableCell>
                <TableCell className="t-medida">{RESPONDE[tom].familia}</TableCell>
                <TableCell>{RESPONDE[tom].responde}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Bloco>
      <Bloco nome="mapas" titulo="Os mapas, nos dois temas" legenda="Cada coluna é um mapa da lib idioma-de-cor." className="flex flex-col gap-6">
        <Mapas tema="claro" />
        <Mapas tema="escuro" />
      </Bloco>
    </PaginaDaVitrine>
  )
}
