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
import { pessoaDaDemo } from "./_pessoas"
import { ListaGrande } from "./_lista-grande"
import { ListaPorPeriodo } from "./_lista-por-periodo"
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
          const pessoas = [...new Set(g.tarefas.map((t) => t.quem).filter(Boolean))].flatMap((nome) => pessoaDaDemo(nome) ?? [])
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
                    <Pessoa pessoa={pessoaDaDemo(t.quem)} />
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
      <Amostra titulo="Lista grande, todos os grupos fechados: o espaço entre eles é curto (instrumento)">
        <div className="w-full">
          <ListaGrande abertos="nenhum" />
        </div>
      </Amostra>
      <Amostra titulo="Fechados e abertos misturados: o vão grande só vem depois do aberto (site)">
        <div className="w-full">
          <ListaGrande densidade="site" abertos="alguns" />
        </div>
      </Amostra>
      <Amostra titulo="Com identidade em só alguns grupos: todo grupo guarda o lugar do ponto (instrumento)">
        <div className="w-full">
          <ListaGrande abertos="alguns" comIdentidade />
        </div>
      </Amostra>
      <Amostra titulo="Coluna de prazo estreita: a legenda quebra e o degrau cresce inteiro">
        <div className="w-full max-w-sm">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead>Tarefa</TableHead>
                <TableHead className="w-24">Prazo</TableHead>
              </TableRow>
            </TableHeader>
            <LinhaDoGrupo
              nome="Desenho"
              colunas={2}
              contagem={{ feitas: 1, total: 3 }}
              celulas={[<Prazo key="z" periodo={{ inicio: "2026-06-02", fim: "2026-07-24" }} tom="espera" hoje={HOJE} />]}
            >
              <TableRow>
                <TableCell>Protótipo navegável</TableCell>
                <TableCell>
                  <Prazo periodo="2026-07-14" hoje={HOJE} />
                </TableCell>
              </TableRow>
            </LinhaDoGrupo>
          </Table>
        </div>
      </Amostra>
      <Amostra titulo="Contagem: a quantidade com unidade e a fração no mesmo x; o total sem linhas e o vazio sem contagem">
        <div className="w-full">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead>Entrega</TableHead>
                <TableHead className="w-32">Prazo</TableHead>
              </TableRow>
            </TableHeader>
            <LinhaDoGrupo nome="Esta semana · 2 a 8 de nov" colunas={2} contagem={{ total: 3, unidade: { um: "entrega", varios: "entregas" } }}>
              {["Revisão do contrato", "Painel de vendas", "Página de produto"].map((n) => (
                <TableRow key={n}>
                  <TableCell>{n}</TableCell>
                  <TableCell>
                    <Prazo periodo="2026-11-06" hoje={new Date("2026-11-03T12:00:00-03:00")} />
                  </TableCell>
                </TableRow>
              ))}
            </LinhaDoGrupo>
            <LinhaDoGrupo nome="Desenho" colunas={2} contagem={{ feitas: 1, total: 2 }} progresso>
              <TableRow>
                <TableCell>Protótipo navegável</TableCell>
                <TableCell />
              </TableRow>
              <TableRow>
                <TableCell>Teste com cinco pessoas</TableCell>
                <TableCell />
              </TableRow>
            </LinhaDoGrupo>
            <LinhaDoGrupo
              nome="9 a 15 de nov"
              colunas={2}
              abertoDeInicio={false}
              contagem={{ total: 2, unidade: { um: "entrega", varios: "entregas" } }}
            />
            <LinhaDoGrupo nome="16 a 22 de nov" colunas={2} semLinhas="Nenhuma entrega" />
            <LinhaDoGrupo nome="Sem causa declarada" colunas={2} />
          </Table>
        </div>
      </Amostra>
      <Amostra titulo="Contagem no estreito: o nome fica e a quantidade cede">
        <div className="w-full max-w-[260px]">
          <Table className="table-fixed">
            <LinhaDoGrupo nome="Esta semana · 2 a 8 de nov" colunas={1} contagem={{ total: 3, unidade: { um: "entrega", varios: "entregas" } }}>
              <TableRow>
                <TableCell>Revisão do contrato</TableCell>
              </TableRow>
            </LinhaDoGrupo>
          </Table>
        </div>
      </Amostra>
      <Amostra titulo="Lista agrupada por semana, com as três vistas e a espera de cada uma">
        <div className="w-full">
          <ListaPorPeriodo />
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
