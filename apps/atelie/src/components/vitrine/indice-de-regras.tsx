"use client"

import * as React from "react"
import { SearchXIcon, XIcon } from "lucide-react"

import { Bloco } from "@/components/ui/bloco"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { BarraDeModos } from "@/components/ui/seletor-de-vista"
import { LinkDaLinha, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Vazio } from "@/components/ui/vazio"
import { normalizar, useParametroDoEndereco } from "@/components/vitrine/endereco"

export type LinhaDoIndice = { codigo: string; titulo: string; confere: string; arquivo: string; href: string; capitulo: string }

const QUEM = [
  { chave: "todas", rotulo: "Todas" },
  { chave: "guarda", rotulo: "Guarda" },
  { chave: "tokens", rotulo: "Tokens" },
  { chave: "navegador", rotulo: "Navegador" },
  { chave: "critica", rotulo: "Crítica" },
] as const

function useFiltro() {
  const q = useParametroDoEndereco("q")
  const cobra = useParametroDoEndereco("cobra")
  const quem = (QUEM.some((m) => m.chave === cobra.valor) ? cobra.valor : "todas") as (typeof QUEM)[number]["chave"]
  return { q, cobra, quem }
}

/** O filtro do índice, no topo parado: texto (`?q=`) e quem cobra (`?cobra=`). */
export function FiltroDeRegras() {
  const { q, cobra, quem } = useFiltro()
  return (
    <>
      <Input
        type="search"
        aria-label="Filtrar regras"
        placeholder="Código ou palavra"
        className="w-56"
        disabled={!q.pronto}
        value={q.valor}
        onChange={(e) => q.trocar(e.target.value)}
      />
      <BarraDeModos rotulo="Quem cobra" modos={QUEM} valor={quem} onTrocar={(m) => cobra.trocar(m === "todas" ? "" : m)} />
    </>
  )
}

/** O índice das regras, filtrado pelo endereço. */
export function IndiceDeRegras({ linhas }: { linhas: LinhaDoIndice[] }) {
  const { q, cobra, quem } = useFiltro()
  const termo = normalizar(q.valor.trim())
  const visiveis = linhas.filter(
    (l) =>
      (quem === "todas" || normalizar(l.confere).includes(quem)) &&
      (!termo || normalizar(`${l.codigo} ${l.titulo} ${l.capitulo}`).includes(termo))
  )
  const limpar = () => {
    q.trocar("")
    cobra.trocar("")
  }
  return (
    <>
      <Bloco titulo="Todas as regras" legenda={`${visiveis.length} de ${linhas.length}`}>
        {visiveis.length === 0 ? (
          <Vazio
            causa="filtro"
            icone={SearchXIcon}
            titulo="Nenhuma regra com este filtro"
            acao={
              <Button variant="outline" size="sm" onClick={limpar}>
                <XIcon />
                Limpar o filtro
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Regra</TableHead>
                <TableHead>Quem cobra</TableHead>
                <TableHead>Onde</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visiveis.map((l) => (
                <TableRow key={l.codigo}>
                  <TableCell className="t-medida">
                    <LinkDaLinha href={l.href}>{l.codigo}</LinkDaLinha>
                  </TableCell>
                  <TableCell>{l.titulo}</TableCell>
                  <TableCell className="text-foreground-2">{l.confere}</TableCell>
                  <TableCell className="text-foreground-2">
                    {l.arquivo} · {l.capitulo}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Bloco>
    </>
  )
}
