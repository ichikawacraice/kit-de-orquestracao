"use client"

import * as React from "react"

import { OpcaoDeMarcar } from "@/components/ui/checkbox"
import { LinhaDoGrupo, EsperaDosGrupos } from "@/components/ui/linha-do-grupo"
import { Prazo } from "@/components/ui/prazo"
import {
  CabecalhoDaColuna,
  CartaoDoQuadro,
  ColunaDoQuadro,
  PedidoDoCartao,
  PilhaDaColuna,
  Quadro,
  TituloDoCartao,
} from "@/components/ui/quadro"
import { BarraDeModos } from "@/components/ui/seletor-de-vista"
import { EsperaDaLista } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const HOJE = new Date("2026-11-03T12:00:00-03:00")
const UNIDADE = { um: "entrega", varios: "entregas" }

type Situacao = "A fazer" | "Em andamento" | "Feita"
type Entrega = { id: string; nome: string; prazo: string; situacao: Situacao }

/** Oito semanas a partir da atual; as três vazias em sequência viram um grupo só, e a vazia sozinha fica no lugar. */
const SEMANAS: { nome: string; aberta?: boolean; vazias?: number; entregas: Entrega[] }[] = [
  {
    nome: "Esta semana · 2 a 8 de nov",
    aberta: true,
    entregas: [
      { id: "1", nome: "Revisão do contrato", prazo: "2026-11-04", situacao: "Em andamento" },
      { id: "2", nome: "Painel de vendas", prazo: "2026-11-06", situacao: "A fazer" },
      { id: "3", nome: "Página de produto", prazo: "2026-11-06", situacao: "Feita" },
    ],
  },
  {
    nome: "9 a 15 de nov",
    entregas: [
      { id: "4", nome: "Fluxo de devolução", prazo: "2026-11-10", situacao: "A fazer" },
      { id: "5", nome: "Busca e filtros", prazo: "2026-11-13", situacao: "Em andamento" },
    ],
  },
  { nome: "16 a 22 de nov", vazias: 1, entregas: [] },
  { nome: "23 a 29 de nov", entregas: [{ id: "6", nome: "Carrinho", prazo: "2026-11-27", situacao: "A fazer" }] },
  { nome: "30 de nov a 20 de dez", vazias: 3, entregas: [] },
  { nome: "21 a 27 de dez", entregas: [{ id: "7", nome: "Pagamento", prazo: "2026-12-22", situacao: "A fazer" }] },
]

const TODAS = SEMANAS.flatMap((s) => s.entregas)
/** A espera desenha os grupos como a lista chega: o aberto com as linhas dele, os fechados com 0 (o espaço curto, sem ar). */
const GRUPOS_DA_ESPERA = SEMANAS.map((s) => (s.aberta ? s.entregas.length : 0))

function Cabecalho() {
  return (
    <TableHeader>
      <TableRow>
        <TableHead>Entrega</TableHead>
        <TableHead className="w-32">Prazo</TableHead>
      </TableRow>
    </TableHeader>
  )
}

function Linha({ e }: { e: Entrega }) {
  // Toda linha na altura da de duas linhas: o prazo concluído (uma linha só) não encolhe a linha, e a espera em h-12 é verdade.
  return (
    <TableRow className="h-12">
      <TableCell className="truncate">{e.nome}</TableCell>
      <TableCell>
        <Prazo periodo={e.prazo} concluido={e.situacao === "Feita"} hoje={HOJE} />
      </TableCell>
    </TableRow>
  )
}

function PorSemana() {
  return (
    <Table className="table-fixed">
      <Cabecalho />
      {SEMANAS.map((s) => (
        <LinhaDoGrupo
          key={s.nome}
          nome={s.nome}
          colunas={2}
          abertoDeInicio={Boolean(s.aberta)}
          contagem={s.entregas.length ? { total: s.entregas.length, unidade: UNIDADE } : undefined}
          semLinhas={s.vazias && s.vazias > 1 ? `Nenhuma entrega em ${s.vazias} semanas` : "Nenhuma entrega"}
        >
          {s.entregas.map((e) => (
            <Linha key={e.id} e={e} />
          ))}
        </LinhaDoGrupo>
      ))}
    </Table>
  )
}

function Corrida() {
  return (
    <Table className="table-fixed">
      <Cabecalho />
      <TableBody>
        {TODAS.map((e) => (
          <Linha key={e.id} e={e} />
        ))}
      </TableBody>
    </Table>
  )
}

function PorSituacao({ esperando }: { esperando: boolean }) {
  const colunas: Situacao[] = ["A fazer", "Em andamento", "Feita"]
  return (
    <Quadro aria-label="Entregas por situação" carregando={esperando}>
      {colunas.map((c) => {
        const entregas = TODAS.filter((e) => e.situacao === c)
        return (
          <ColunaDoQuadro key={c}>
            <CabecalhoDaColuna nome={c} contagem={entregas.length} rotuloDaContagem={`${entregas.length} ${entregas.length === 1 ? "entrega" : "entregas"}`} />
            <PilhaDaColuna>
              {entregas.map((e) => (
                <li key={e.id}>
                  <CartaoDoQuadro>
                    <PedidoDoCartao>
                      <TituloDoCartao>{e.nome}</TituloDoCartao>
                    </PedidoDoCartao>
                  </CartaoDoQuadro>
                </li>
              ))}
            </PilhaDaColuna>
          </ColunaDoQuadro>
        )
      })}
    </Quadro>
  )
}

const VISTAS = [
  { chave: "lista", rotulo: "Lista" },
  { chave: "semana", rotulo: "Por semana" },
  { chave: "quadro", rotulo: "Quadro" },
] as const

/** A lista por período com as três vistas: cada uma espera na forma dela (ARQ-01), e a troca de vista troca a espera. */
export function ListaPorPeriodo() {
  const [vista, setVista] = React.useState<(typeof VISTAS)[number]["chave"]>("semana")
  const [esperando, setEsperando] = React.useState(false)
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BarraDeModos rotulo="Vista" modos={VISTAS} valor={vista} onTrocar={setVista} />
        <OpcaoDeMarcar rotulo="Simular a espera" checked={esperando} onCheckedChange={(v) => setEsperando(v === true)} />
      </div>
      {vista === "lista" ? (
        esperando ? (
          <EsperaDaLista linhas={TODAS.length} alturaDaLinha="h-12" rotulo="As entregas" />
        ) : (
          <Corrida />
        )
      ) : vista === "semana" ? (
        esperando ? (
          <EsperaDosGrupos grupos={GRUPOS_DA_ESPERA} alturaDaLinha="h-12" rotulo="As entregas por semana" />
        ) : (
          <PorSemana />
        )
      ) : (
        <div className="flex h-96 flex-col">
          <PorSituacao esperando={esperando} />
        </div>
      )}
    </div>
  )
}

/** A espera a 50% sobre a lista que chega: o degrau, o recuo e o vão caem no mesmo lugar. */
export function EsperaSobreALista() {
  return (
    <div className="relative w-full max-w-lg">
      <Table className="table-fixed">
        <Cabecalho />
        {SEMANAS.slice(0, 2).map((s) => (
          <LinhaDoGrupo key={s.nome} nome={s.nome} colunas={2} contagem={{ total: s.entregas.length, unidade: UNIDADE }}>
            {s.entregas.map((e) => (
              <Linha key={e.id} e={e} />
            ))}
          </LinhaDoGrupo>
        ))}
      </Table>
      <EsperaDosGrupos grupos={[3, 2]} alturaDaLinha="h-12" rotulo="As entregas por semana" className="pointer-events-none absolute inset-x-0 top-0 opacity-50" />
    </div>
  )
}
