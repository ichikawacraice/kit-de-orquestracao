"use client"

import { MoreHorizontalIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { LinhaDoGrupo } from "@/components/ui/linha-do-grupo"
import { Medidor } from "@/components/ui/medidor"
import { Pessoa, PilhaDePessoas } from "@/components/ui/pessoa"
import { Prazo } from "@/components/ui/prazo"
import { LinkDaLinha, Table, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ProvedorDeLink } from "@/lib/link-do-app"

import { Amostra, Amostras } from "./_amostra"
import { ListaGrande } from "./_lista-grande"
import { LinkDoPalco } from "./_tela"

const HOJE = new Date("2026-07-12T12:00:00-03:00")

type Tarefa = { id: string; nome: string; quem: string | null; prazo: string; feita: boolean }

const GRUPOS: { nome: string; prazo: string; tom?: "espera"; tarefas: Tarefa[] }[] = [
  {
    nome: "Descoberta",
    prazo: "2026-07-03",
    tarefas: [
      { id: "1", nome: "Entrevistas com a equipe", quem: "Ana Souza", prazo: "2026-06-26", feita: true },
      { id: "2", nome: "Mapa do fluxo atual", quem: "Bruno Lima", prazo: "2026-07-03", feita: true },
    ],
  },
  {
    nome: "Desenho",
    prazo: "2026-07-14",
    tom: "espera",
    tarefas: [
      { id: "3", nome: "Arquitetura da informação", quem: "Carla Dias", prazo: "2026-07-08", feita: true },
      { id: "4", nome: "Protótipo navegável", quem: "Ana Souza", prazo: "2026-07-14", feita: false },
      { id: "5", nome: "Teste com cinco pessoas", quem: null, prazo: "2026-07-14", feita: false },
    ],
  },
  { nome: "Entrega", prazo: "2026-08-20", tarefas: [] },
]

function Tabela({ densidade }: { densidade: "instrumento" | "site" }) {
  return (
    <ProvedorDeLink componente={LinkDoPalco}>
      <Table className="table-fixed" densidade={densidade}>
        <TableHeader>
          <TableRow>
            <TableHead>Tarefa</TableHead>
            <TableHead className="w-36" esconderNoCelular>
              Responsável
            </TableHead>
            <TableHead className="w-32">Prazo</TableHead>
            <TableHead className="w-12" esconderNoCelular>
              <span className="sr-only">Ações</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        {GRUPOS.map((g) => {
          const feitas = g.tarefas.filter((t) => t.feita).length
          const concluido = g.tarefas.length > 0 && feitas === g.tarefas.length
          const pessoas = [...new Set(g.tarefas.map((t) => t.quem).filter(Boolean))].map((nome) => ({ nome }))
          return (
            <LinhaDoGrupo
              key={g.nome}
              nome={g.nome}
              colunas={4}
              contagem={{ feitas, total: g.tarefas.length }}
              semLinhas="Sem tarefas"
              progresso
              concluido={concluido}
              celulas={[
                { conteudo: <PilhaDePessoas pessoas={pessoas} sobre="muted" />, esconderNoCelular: true },
                <Prazo key="z" periodo={g.prazo} tom={concluido ? undefined : g.tom} concluido={concluido} hoje={HOJE} />,
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
                  <TableCell className="truncate">
                    <LinkDaLinha href={`/tarefas/${t.id}`}>{t.nome}</LinkDaLinha>
                  </TableCell>
                  <TableCell esconderNoCelular>
                    <Pessoa pessoa={t.quem ? { nome: t.quem } : null} />
                  </TableCell>
                  <TableCell>
                    <Prazo periodo={t.prazo} concluido={t.feita} hoje={HOJE} />
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

export default function DemoDaLinhaDoGrupo() {
  return (
    <Amostras>
      <Amostra titulo="Densidade instrumento (40px)" primeira>
        <div className="w-full">
          <Tabela densidade="instrumento" />
        </div>
      </Amostra>
      <Amostra titulo="Densidade site (48px)">
        <div className="w-full">
          <Tabela densidade="site" />
        </div>
      </Amostra>
      <Amostra titulo="Lista grande: seis grupos, 36 linhas (instrumento)">
        <div className="w-full">
          <ListaGrande />
        </div>
      </Amostra>
      <Amostra titulo="Lista grande (site)">
        <div className="w-full">
          <ListaGrande densidade="site" />
        </div>
      </Amostra>
      <Amostra titulo="Com medida e fechado">
        <div className="w-full">
          <Table>
            <LinhaDoGrupo
              nome="Semana de 13 jul"
              colunas={2}
              contagem={{ feitas: 3, total: 5 }}
              abertoDeInicio={false}
              medida={<Medidor valor={120} teto={200} rotulo="Horas da semana" formatar={(n) => `${n} h`} compacto />}
            >
              <TableRow>
                <TableCell>Revisão do contrato</TableCell>
                <TableCell />
              </TableRow>
            </LinhaDoGrupo>
          </Table>
        </div>
      </Amostra>
    </Amostras>
  )
}
