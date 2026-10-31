"use client"

import { SearchXIcon, XIcon } from "lucide-react"

import { Bloco } from "@/components/ui/bloco"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { BarraDeModos } from "@/components/ui/seletor-de-vista"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Vazio } from "@/components/ui/vazio"
import { normalizar, useParametroDoEndereco } from "@/components/vitrine/endereco"

export type LinhaDaFuncao = { funcao: string; texto: string; peca: string; naoUse: string; noKit: boolean }

const MODOS = [
  { chave: "todas", rotulo: "Todas" },
  { chave: "kit", rotulo: "No kit" },
  { chave: "fora", rotulo: "Fora do kit" },
] as const

function useFiltro() {
  const q = useParametroDoEndereco("q")
  const onde = useParametroDoEndereco("onde")
  const modo = (MODOS.some((m) => m.chave === onde.valor) ? onde.valor : "todas") as (typeof MODOS)[number]["chave"]
  return { q, onde, modo }
}

/** O filtro no topo parado: texto (`?q=`) e onde está a peça (`?onde=`), com a contagem de cada modo. */
export function FiltroDasFuncoes({ total, noKit }: { total: number; noKit: number }) {
  const { q, onde, modo } = useFiltro()
  const numero = { todas: total, kit: noKit, fora: total - noKit }
  return (
    <>
      <Input
        type="search"
        aria-label="Filtrar funções"
        placeholder="Função ou peça"
        className="w-56"
        disabled={!q.pronto}
        value={q.valor}
        onChange={(e) => q.trocar(e.target.value)}
      />
      <BarraDeModos
        rotulo="Onde está a peça"
        modos={MODOS.map((m) => ({ ...m, numero: numero[m.chave] }))}
        valor={modo}
        onTrocar={(m) => onde.trocar(m === "todas" ? "" : m)}
      />
    </>
  )
}

export function PecasPorFuncao({ linhas }: { linhas: LinhaDaFuncao[] }) {
  const { q, onde, modo } = useFiltro()
  const termo = normalizar(q.valor.trim())
  const visiveis = linhas.filter(
    (l) => (modo === "todas" || (modo === "kit") === l.noKit) && (!termo || normalizar(`${l.funcao} ${l.texto}`).includes(termo))
  )
  const limpar = () => {
    q.trocar("")
    onde.trocar("")
  }
  return (
    <>
      <Bloco titulo="Uma peça por função" legenda="A coluna Não use é defeito.">
        {visiveis.length === 0 ? (
          <Vazio
            causa="filtro"
            icone={SearchXIcon}
            titulo="Nenhuma função com este filtro"
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
                <TableHead>Função</TableHead>
                <TableHead>Peça</TableHead>
                <TableHead>Não use</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visiveis.map((l) => (
                <TableRow key={l.funcao}>
                  <TableCell className="h-auto py-2.5 align-top text-foreground">{l.funcao}</TableCell>
                  <TableCell className="h-auto py-2.5 align-top text-foreground-2">
                    <span dangerouslySetInnerHTML={{ __html: l.peca }} />
                  </TableCell>
                  <TableCell className="h-auto py-2.5 align-top text-foreground-2" dangerouslySetInnerHTML={{ __html: l.naoUse }} />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Bloco>
    </>
  )
}
