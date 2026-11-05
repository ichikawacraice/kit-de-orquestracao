"use client"

import { MoreHorizontalIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Estado } from "@/components/ui/estado"
import { LinhaDoGrupo } from "@/components/ui/linha-do-grupo"
import { Pessoa, PilhaDePessoas } from "@/components/ui/pessoa"
import { Prazo } from "@/components/ui/prazo"
import { LinkDaLinha, Table, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ProvedorDeLink } from "@/lib/link-do-app"

import { LinkDoPalco } from "./_tela"
import { pessoaDaDemo } from "./_pessoas"

const HOJE = new Date("2026-07-12T12:00:00-03:00")
const PESSOAS = ["Ana Souza", "Bruno Lima", "Carla Dias", "Diego Rocha", null]
const ETAPAS = [
  { nome: "Aberta", tom: "neutro" },
  { nome: "Em curso", tom: "espera" },
  { nome: "Em revisão", tom: "espera" },
  { nome: "Feita", tom: "ok" },
] as const

const TAREFAS = [
  "Entrevistas com a equipe",
  "Mapa do fluxo atual",
  "Inventário de conteúdo",
  "Arquitetura da informação",
  "Protótipo navegável",
  "Teste com cinco pessoas",
  "Guia de componentes",
  "Revisão de acessibilidade",
  "Página inicial",
  "Busca e filtros",
  "Carrinho",
  "Pagamento",
]

const GRUPOS = [
  { nome: "Descoberta", linhas: 5 },
  { nome: "Desenho", linhas: 7 },
  { nome: "Construção", linhas: 9 },
  { nome: "Conteúdo", linhas: 4 },
  { nome: "Testes", linhas: 6 },
  { nome: "Lançamento", linhas: 5 },
]

// A cor de identidade é declarada por quem chama, por grupo — nunca pela posição, nunca a da marca nem a de uma voz.
const IDENTIDADE: Record<string, string> = { Construção: "var(--chart-5)" }

type Tarefa = { id: string; nome: string; tipo: string; quem: string | null; prazo: string; etapa: (typeof ETAPAS)[number] }

// Determinístico: a vitrine nasce no build e não pode mudar a cada abertura.
const DADOS = GRUPOS.map((g, gi) => {
  const tarefas: Tarefa[] = Array.from({ length: g.linhas }, (_, i) => {
    const n = gi * 7 + i
    const etapa = ETAPAS[(n * 3 + gi) % ETAPAS.length]!
    return {
      id: `${gi}-${i}`,
      nome: TAREFAS[n % TAREFAS.length]!,
      tipo: ["UX/UI", "Front", "Conteúdo", "Gestão"][n % 4]!,
      quem: PESSOAS[n % PESSOAS.length]!,
      prazo: `2026-07-${String(((n * 5) % 27) + 1).padStart(2, "0")}`,
      etapa,
    }
  })
  return { ...g, tarefas }
})

/** Uma lista grande e complexa: seis grupos, 36 linhas de duas linhas cada — o caso da leitura que cansa. */
export function ListaGrande({
  densidade = "instrumento",
  abertos = "todos",
  comIdentidade = false,
}: {
  densidade?: "instrumento" | "site"
  /** Quais grupos nascem abertos: todos, nenhum ou só o primeiro e o quarto (fechados e abertos misturados). */
  abertos?: "todos" | "nenhum" | "alguns"
  /** O ponto de cor antes do nome, em só alguns grupos: o recuo das linhas conta o lugar dele em todos. */
  comIdentidade?: boolean
}) {
  return (
    <ProvedorDeLink componente={LinkDoPalco}>
      <Table className="table-fixed" densidade={densidade} data-vitrine="lista-grande">
        <TableHeader>
          <TableRow>
            <TableHead>Tarefa</TableHead>
            <TableHead className="w-36" esconderNoCelular>
              Responsável
            </TableHead>
            <TableHead className="w-36">Prazo</TableHead>
            <TableHead className="w-32" esconderNoCelular>
              Etapa
            </TableHead>
            <TableHead className="w-12" esconderNoCelular>
              <span className="sr-only">Ações</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        {DADOS.map((g, gi) => {
          const feitas = g.tarefas.filter((t) => t.etapa.tom === "ok").length
          const pessoas = [...new Set(g.tarefas.map((t) => t.quem).filter(Boolean))].map((nome) => pessoaDaDemo(nome!)!)
          const prazos = g.tarefas.map((t) => t.prazo).sort()
          return (
            <LinhaDoGrupo
              key={g.nome}
              nome={g.nome}
              colunas={5}
              contagem={{ feitas, total: g.tarefas.length }}
              progresso
              abertoDeInicio={abertos === "todos" || (abertos === "alguns" && gi % 3 === 0)}
              identidade={
                comIdentidade && g.nome in IDENTIDADE ? (
                  <span aria-hidden="true" className="size-2 rounded-full" style={{ background: IDENTIDADE[g.nome] }} />
                ) : undefined
              }
              celulas={[
                { conteudo: <PilhaDePessoas pessoas={pessoas} sobre="muted" />, esconderNoCelular: true },
                <Prazo key="z" periodo={{ inicio: prazos[0], fim: prazos.at(-1) }} hoje={HOJE} />,
                { conteudo: null, esconderNoCelular: true },
              ]}
              acao={{
                conteudo: (
                  <Button variant="ghost" size="icon" aria-label={`Ações de ${g.nome}`}>
                    <MoreHorizontalIcon />
                  </Button>
                ),
                esconderNoCelular: true,
              }}
            >
              {g.tarefas.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <div className="flex min-w-0 flex-col">
                      <LinkDaLinha href={`/tarefas/${t.id}`} className="truncate">
                        {t.nome}
                      </LinkDaLinha>
                      <span className="truncate text-muted-foreground">{t.tipo}</span>
                    </div>
                  </TableCell>
                  <TableCell esconderNoCelular>
                    <Pessoa pessoa={pessoaDaDemo(t.quem)} />
                  </TableCell>
                  <TableCell>
                    <Prazo periodo={t.prazo} concluido={t.etapa.tom === "ok"} hoje={HOJE} />
                  </TableCell>
                  <TableCell esconderNoCelular>
                    <Estado tom={t.etapa.tom}>{t.etapa.nome}</Estado>
                  </TableCell>
                  <TableCell esconderNoCelular />
                </TableRow>
              ))}
            </LinhaDoGrupo>
          )
        })}
      </Table>
    </ProvedorDeLink>
  )
}
