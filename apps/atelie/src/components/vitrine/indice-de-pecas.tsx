"use client"

import { SearchXIcon, XIcon } from "lucide-react"

import { Bloco } from "@/components/ui/bloco"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LinkDaLinha, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Vazio } from "@/components/ui/vazio"
import { normalizar, useParametroDoEndereco } from "@/components/vitrine/endereco"

/** Sem hífen nem espaço: `ChipDeEstado`, `chip-de-estado` e "chip de estado" casam. */
const compacto = (s: string) => normalizar(s).replace(/[\s-]+/g, "")

export type LinhaDaPeca = { nome: string; titulo: string; texto: string; equivalente: string | null; exports: string[] }

export type GrupoDePecas = { id: string; titulo: string; legenda: string; linhas: LinhaDaPeca[] }

/** O filtro no topo parado: nome, função ou o nome no shadcn (`?q=`). */
export function FiltroDePecas() {
  const q = useParametroDoEndereco("q")
  return (
    <Input
      type="search"
      aria-label="Filtrar peças"
      placeholder="Nome no código, função ou nome no shadcn"
      className="w-80"
      disabled={!q.pronto}
      value={q.valor}
      onChange={(e) => q.trocar(e.target.value)}
    />
  )
}

/** O índice das peças, filtrado pelo endereço. */
export function IndiceDePecas({ grupos }: { grupos: GrupoDePecas[] }) {
  const q = useParametroDoEndereco("q")
  const termo = compacto(q.valor.trim())
  const filtrados = grupos.map((g) => ({
    ...g,
    linhas: g.linhas.filter((l) => !termo || compacto(`${l.nome} ${l.titulo} ${l.texto} ${l.equivalente ?? ""} ${l.exports.join(" ")}`).includes(termo)),
  }))
  const nada = filtrados.every((g) => g.linhas.length === 0)
  return (
    <>
      {nada ? (
        <Bloco titulo="Peças">
          <Vazio
            causa="filtro"
            icone={SearchXIcon}
            titulo={`Nenhuma peça com «${q.valor.trim()}»`}
            acao={
              <Button variant="outline" size="sm" onClick={() => q.trocar("")}>
                <XIcon />
                Limpar o filtro
              </Button>
            }
          />
        </Bloco>
      ) : (
        filtrados
          .filter((g) => g.linhas.length > 0)
          .map((g) => (
            <Bloco key={g.id} nome={g.id} titulo={g.titulo} legenda={g.legenda}>
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-60">Peça</TableHead>
                    <TableHead>O que é</TableHead>
                    <TableHead className="w-40">No shadcn</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {g.linhas.map((l) => (
                    <TableRow key={l.nome}>
                      <TableCell className="h-auto py-2">
                        <span className="flex flex-col">
                          <LinkDaLinha href={`/catalogo/${l.nome}/`}>{l.titulo}</LinkDaLinha>
                          {l.exports.length ? <span className="t-medida truncate text-legenda text-muted-foreground">{l.exports.slice(0, 2).join(", ")}</span> : null}
                        </span>
                      </TableCell>
                      <TableCell className="h-auto py-2 whitespace-normal text-foreground-2">{l.texto}</TableCell>
                      <TableCell className="t-medida text-foreground-2">{l.equivalente ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Bloco>
          ))
      )}
    </>
  )
}
