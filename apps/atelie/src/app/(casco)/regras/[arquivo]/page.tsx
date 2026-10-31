import { notFound } from "next/navigation"

import { Bloco } from "@/components/ui/bloco"
import { ChipDeEstado } from "@/components/ui/chip-de-estado"
import { AbasDasRegras } from "@/components/vitrine/abas-das-regras"
import { CopiarLink } from "@/components/vitrine/copiar-link"
import { IrParaASecao } from "@/components/vitrine/ir-para-a-secao"
import { PaginaDaVitrine } from "@/components/vitrine/pagina"
import { cn } from "@/lib/utils"
import { ARQUIVOS_DA_BASE, arquivoDaBase, type Regra } from "@/vitrine/base"

export const dynamicParams = false

export function generateStaticParams() {
  return ARQUIVOS_DA_BASE.map((a) => ({ arquivo: a.id }))
}

export async function generateMetadata({ params }: { params: Promise<{ arquivo: string }> }) {
  const { arquivo } = await params
  return { title: arquivoDaBase(arquivo)?.titulo ?? "Regras" }
}

/** O texto da base, já em HTML com as classes do kit (lido no build, vitrine/base.ts). */
function Texto({ html, className }: { html: string; className?: string }) {
  return (
    <div
      className={cn("flex max-w-medida flex-col gap-2 text-sm text-foreground-2 has-[table]:max-w-none", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function UmaRegra({ r }: { r: Regra }) {
  return (
    <article id={r.codigo} aria-labelledby={`titulo-${r.codigo}`} className="flex scroll-mt-4 flex-col gap-3">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 id={`titulo-${r.codigo}`} className="flex items-baseline gap-2">
          <span className="t-medida text-foreground-2">{r.codigo}</span>
          <span className={cn("t-titulo", r.revogada ? "text-muted-foreground" : "text-foreground")} dangerouslySetInnerHTML={{ __html: r.tituloHtml }} />
        </h3>
        {r.revogada ? <ChipDeEstado tom="neutro">revogada</ChipDeEstado> : null}
        {r.assumida ? <ChipDeEstado tom="alheio">a confirmar</ChipDeEstado> : null}
        <CopiarLink ancora={r.codigo} />
      </header>
      {(
        [
          ["Regra", r.regra],
          ["Por quê", r.porque],
          ["Confere", r.confere],
        ] as const
      ).map(([rotulo, html]) => (
        <div key={rotulo} className="flex flex-col gap-1">
          <span className="t-coluna">{rotulo}</span>
          <Texto html={html} />
        </div>
      ))}
      {r.assumida ? (
        <div className="flex flex-col gap-1">
          <span className="t-coluna">A confirmar</span>
          <Texto html={r.assumida} />
        </div>
      ) : null}
    </article>
  )
}

export default async function ArquivoDeRegras({ params }: { params: Promise<{ arquivo: string }> }) {
  const { arquivo: id } = await params
  const arquivo = arquivoDaBase(id)
  if (!arquivo) notFound()
  const total = arquivo.capitulos.reduce((n, c) => n + c.regras.length, 0)
  return (
    <PaginaDaVitrine
      titulo="Regras"
      filtros={
        <>
          <AbasDasRegras atual={arquivo.id} />
          <IrParaASecao secoes={arquivo.capitulos.map((c) => ({ ancora: c.ancora, titulo: c.titulo }))} />
        </>
      }
      abertura={`${arquivo.resumo.replace(/\.$/, "")}. ${total} regras, versão ${arquivo.versao}.`}
    >
      <Bloco nome="como-ler-uma-regra" titulo="Como ler uma regra" recolhivel abertoPorPadrao={false} resumo="Regra, Por quê e Confere">
        <ul className="flex max-w-medida list-disc flex-col gap-1 pl-5 text-sm text-foreground-2">
          <li>
            <strong className="text-foreground">Regra</strong>: o que a tela tem de fazer. “Deve” e “nunca” são literais.
          </li>
          <li>
            <strong className="text-foreground">Por quê</strong>: o fato medido que originou a regra. Mudar a regra pede medir de novo.
          </li>
          <li>
            <strong className="text-foreground">Confere</strong>: onde a regra é cobrada. <span className="t-medida">guarda:</span> é um teste que lê
            o projeto; <span className="t-medida">tokens</span>, um teste sobre os valores; <span className="t-medida">navegador</span>, só se mede no
            ateliê; <span className="t-medida">crítica:</span>, o crítico de UI cobra na nota.
          </li>
        </ul>
      </Bloco>
      {arquivo.capitulos.map((c) => (
        <Bloco key={c.ancora} nome={c.ancora} titulo={c.titulo} legenda={`${c.regras.length} ${c.regras.length === 1 ? "regra" : "regras"}`} className="flex flex-col gap-8">
          {c.intro ? <Texto html={c.intro} /> : null}
          {c.regras.map((r) => (
            <UmaRegra key={r.codigo} r={r} />
          ))}
        </Bloco>
      ))}
    </PaginaDaVitrine>
  )
}
