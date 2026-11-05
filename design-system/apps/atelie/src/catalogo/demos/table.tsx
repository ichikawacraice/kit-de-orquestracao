"use client"

import { ChipDeEstado } from "@/components/ui/chip-de-estado"
import { Estado } from "@/components/ui/estado"
import { Painel, RolagemDoPainel } from "@/components/ui/painel"
import { Pessoa } from "@/components/ui/pessoa"
import { Secao } from "@/components/ui/secao"
import { LinkDaLinha, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ProvedorDeLink } from "@/lib/link-do-app"

import { LinkDoPalco } from "./_tela"
import { pessoaDaDemo } from "./_pessoas"

type Etapa = { nome: string; tom: "ok" | "espera" | "ruim" | "neutro" }

const ETAPAS: Etapa[] = [
  { nome: "Conferência", tom: "neutro" },
  { nome: "Pagamento", tom: "espera" },
  { nome: "Envio", tom: "ok" },
  { nome: "Devolução", tom: "ruim" },
]
const CLIENTES = ["Ana Souza", "Bruno Lima", "Carla Dias", "Diego Prado", "Elisa Fonseca", "Fábio Lima", "Gabriela Reis"]
const QUEM = ["Carla Nogueira", "Elisa Fonseca", null, "Ana Ribeiro", "Bruno Tavares"]

// 14 pedidos, metade com uma linha e metade com duas (a observação embaixo do número).
const PEDIDOS = Array.from({ length: 14 }, (_, i) => ({
  numero: String(1042 + i),
  observacao: i % 2 === 1 ? (i % 4 === 1 ? "Entrega agendada" : "Troca de tamanho") : null,
  cliente: CLIENTES[i % CLIENTES.length]!,
  quem: QUEM[i % QUEM.length] ?? null,
  etapa: ETAPAS[i % ETAPAS.length]!,
  falhou: i === 5,
  itens: ((i * 7) % 11) + 1,
  valor: `R$ ${(((i * 389) % 1900) + 89).toLocaleString("pt-BR")},${String((i * 37) % 100).padStart(2, "0")}`,
}))

type Pedido = (typeof PEDIDOS)[number]

function Cabecalho() {
  return (
    <TableHeader>
      <TableRow>
        <TableHead>Pedido</TableHead>
        <TableHead esconderNoCelular>Cliente</TableHead>
        <TableHead esconderNoCelular>Responsável</TableHead>
        <TableHead className="max-sm:w-28">Etapa</TableHead>
        <TableHead medida esconderNoCelular>
          Itens
        </TableHead>
        <TableHead medida className="w-32 max-sm:w-28">
          Valor
        </TableHead>
      </TableRow>
    </TableHeader>
  )
}

function Linha({ p }: { p: Pedido }) {
  return (
    <TableRow>
      <TableCell>
        <LinkDaLinha href={`/pedidos/${p.numero}`}>{p.numero}</LinkDaLinha>
        {p.observacao ? <span className="block text-muted-foreground">{p.observacao}</span> : null}
      </TableCell>
      <TableCell esconderNoCelular>{p.cliente}</TableCell>
      <TableCell esconderNoCelular>
        <Pessoa pessoa={pessoaDaDemo(p.quem)} />
      </TableCell>
      <TableCell>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Estado tom={p.etapa.tom}>{p.etapa.nome}</Estado>
          {p.falhou ? <ChipDeEstado tom="ruim">Falhou</ChipDeEstado> : null}
        </span>
      </TableCell>
      <TableCell medida esconderNoCelular>
        {p.itens}
      </TableCell>
      <TableCell medida>{p.valor}</TableCell>
    </TableRow>
  )
}

export default function DemoDaTabela() {
  return (
    <ProvedorDeLink componente={LinkDoPalco}>
      <div className="flex flex-col gap-6">
        <Secao titulo="Lista larga, instrumento — rola por baixo da régua" primeira nivel={2}>
          <Painel className="h-96" data-vitrine="table">
            <RolagemDoPainel densidade="padrao">
              <Table>
                <Cabecalho />
                <TableBody>
                  {PEDIDOS.map((p) => (
                    <Linha key={p.numero} p={p} />
                  ))}
                </TableBody>
              </Table>
            </RolagemDoPainel>
          </Painel>
        </Secao>
        <Secao titulo="Site" nivel={2}>
          <Painel>
            <RolagemDoPainel densidade="padrao">
              <Table densidade="site">
                <Cabecalho />
                <TableBody>
                  {PEDIDOS.slice(0, 5).map((p) => (
                    <Linha key={p.numero} p={p} />
                  ))}
                </TableBody>
              </Table>
            </RolagemDoPainel>
          </Painel>
        </Secao>
        <Secao titulo="Uma linha só — nenhum filete" nivel={2}>
          <Painel>
            <RolagemDoPainel densidade="padrao">
              <Table>
                <Cabecalho />
                <TableBody>
                  <Linha p={PEDIDOS[0]!} />
                </TableBody>
              </Table>
            </RolagemDoPainel>
          </Painel>
        </Secao>
      </div>
    </ProvedorDeLink>
  )
}
