"use client"

import { ChipDeEstado } from "@/components/ui/chip-de-estado"
import { LinkDaLinha, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ProvedorDeLink } from "@/lib/link-do-app"

import { LinkDoPalco } from "./_tela"

const PEDIDOS = [
  { numero: "1042", cliente: "Ana Souza", etapa: "Conferência", valor: "R$ 312,90", falhou: false },
  { numero: "1043", cliente: "Bruno Lima", etapa: "Pagamento", valor: "R$ 89,00", falhou: true },
  { numero: "1044", cliente: "Carla Dias", etapa: "Envio", valor: "R$ 1.204,50", falhou: false },
]

export default function DemoDaTabela() {
  return (
    <ProvedorDeLink componente={LinkDoPalco}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Pedido</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Etapa</TableHead>
            <TableHead className="text-right">Valor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {PEDIDOS.map((p) => (
            <TableRow key={p.numero}>
              <TableCell>
                <LinkDaLinha href={`/pedidos/${p.numero}`}>{p.numero}</LinkDaLinha>
              </TableCell>
              <TableCell>{p.cliente}</TableCell>
              <TableCell>
                <span className="flex items-center gap-2">
                  {p.etapa}
                  {p.falhou ? <ChipDeEstado tom="ruim">Falhou</ChipDeEstado> : null}
                </span>
              </TableCell>
              <TableCell medida className="text-right">
                {p.valor}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ProvedorDeLink>
  )
}
