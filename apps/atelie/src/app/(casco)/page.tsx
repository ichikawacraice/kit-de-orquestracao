import Link from "next/link"

import { Bloco } from "@/components/ui/bloco"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Secao } from "@/components/ui/secao"
import { Comando } from "@/components/casco/comando"
import { PaginaDaVitrine } from "@/components/vitrine/pagina"
import { HOST, VERSAO, itensDaSecao } from "@/catalogo/registro"
import { todasAsRegras, tabelaDaRegra } from "@/vitrine/base"
import { GRUPOS_DE_COR } from "@/vitrine/cores"
import { NOMES_DOS_ICONES } from "@/vitrine/icones"
import { mudancas } from "@/vitrine/mudancas"
import { DESTINOS } from "@/vitrine/navegacao"
import { TOKENS } from "@/vitrine/tokens"

const COMPONENTS_JSON = `"registries": {
  "@wicomm": "${HOST}/r/v${VERSAO}/{name}.json"
}`

/** A pergunta que cada destino responde, e quanto há lá. */
function portas(): Record<string, { pergunta: string; contagem: string }> {
  const n = (x: number, um: string, varios: string) => `${x} ${x === 1 ? um : varios}`
  const movimento = [TOKENS.duracoes, TOKENS.atrasos, TOKENS.curvas, TOKENS.animacoes].reduce((s, o) => s + Object.keys(o).length, 0)
  return {
    "/cores": { pergunta: "Que cor uso, e ela passa sobre este fundo?", contagem: n(GRUPOS_DE_COR.flatMap((g) => g.cores).length, "cor", "cores") },
    "/tipografia": { pergunta: "Que voz tem este texto?", contagem: n(Object.keys(TOKENS.vozes).length, "voz", "vozes") },
    "/espaco-e-forma": { pergunta: "Que espaço, raio e altura?", contagem: n(Object.keys(TOKENS.raios).length, "raio", "raios") },
    "/superficie": { pergunta: "Em que altura isto mora?", contagem: "3 alturas" },
    "/movimento": { pergunta: "Quanto dura, e com que curva?", contagem: n(movimento, "token", "tokens") },
    "/icones": { pergunta: "Que glifo tem esta função?", contagem: n(NOMES_DOS_ICONES.length, "ícone", "ícones") },
    "/pecas": { pergunta: "Que peça cumpre esta função, e como instalo?", contagem: n(itensDaSecao("pecas").length + itensDaSecao("fundamentos").length, "peça", "peças") },
    "/telas": { pergunta: "Que tipo de tela é a minha?", contagem: n(itensDaSecao("blocos").length, "bloco", "blocos") },
    "/padroes": { pergunta: "Onde ponho esta mensagem?", contagem: n(tabelaDaRegra("MSG-01").linhas.length, "lugar", "lugares") },
    "/regras": { pergunta: "O que a base exige, e por quê?", contagem: n(todasAsRegras().length, "regra", "regras") },
    "/mudancas": { pergunta: "O que mudou desde a minha versão?", contagem: n(mudancas().length, "versão", "versões") },
  }
}

export default function Inicio() {
  const doDestino = portas()
  const [atual] = mudancas()
  const destaques = atual ? [...atual.muda.matchAll(/<li>([\s\S]*?)<\/li>/g)].slice(0, 1).map((m) => m[1]!) : []
  return (
    <PaginaDaVitrine
      titulo="Ateliê Wicomm"
      abertura="O design system da Wicomm: os valores, as peças, as telas e as regras, vivos nos dois temas."
    >
      <div className="grid gap-6 xl:grid-cols-[1fr_16rem]">
        <div className="flex min-w-0 flex-col">
          {DESTINOS.filter((g) => g.rotulo).map((g, i) => (
            <Secao key={g.rotulo} titulo={g.rotulo!} nivel={2} primeira={i === 0}>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {g.destinos.map((d) => {
                  const p = doDestino[d.href]
                  const Icone = d.icone
                  return (
                    <li key={d.href}>
                      <Link href={`${d.href}/`} className="block h-full rounded-cartao focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
                        <Card className="h-full transition-shadow duration-cor hover:superficie-alta motion-reduce:transition-none">
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <Icone aria-hidden="true" className="size-4.5 text-foreground-2" />
                              {d.rotulo}
                            </CardTitle>
                            <CardDescription>{p?.pergunta}</CardDescription>
                            <span className="t-medida text-legenda text-muted-foreground">{p?.contagem}</span>
                          </CardHeader>
                        </Card>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </Secao>
          ))}
        </div>
        <Bloco titulo="O que mudou" legenda={atual ? `v${atual.versao} · ${atual.data}` : undefined}>
          {atual ? (
            <>
              <ul className="flex flex-col gap-2 text-sm text-foreground-2">
                {destaques.map((h, i) => (
                  <li key={i} dangerouslySetInnerHTML={{ __html: h }} />
                ))}
              </ul>
              <Button asChild variant="link" className="self-start px-0">
                <Link href="/mudancas/">Todas as mudanças</Link>
              </Button>
            </>
          ) : (
            <p className="t-denso text-muted-foreground">Ainda não há versão registrada.</p>
          )}
        </Bloco>
      </div>

      <Bloco titulo="Num projeto novo" recolhivel resumo="3 passos: o estilo, o registro, as peças" abertoPorPadrao={false}>
        <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm text-foreground-2">
          <li>
            O estilo:
            <Comando texto={`npx shadcn@latest init ${HOST}/r/v${VERSAO}/estilo.json`} className="mt-2" />
          </li>
          <li>
            O registro no <code className="font-mono text-controle">components.json</code>, com a versão no caminho:
            <Comando texto={COMPONENTS_JSON} className="mt-2" />
          </li>
          <li>
            As peças:
            <Comando texto="npx shadcn@latest add @wicomm/button" className="mt-2" />
          </li>
        </ol>
      </Bloco>
    </PaginaDaVitrine>
  )
}
