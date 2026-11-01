"use client"

import * as React from "react"

import { Checkbox, OpcaoDeMarcar } from "@/components/ui/checkbox"
import { COR_DO_TOM_DENSO } from "@/lib/idioma-de-cor"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

import { Amostra, Amostras } from "./_amostra"

const LINHAS = ["1042", "1043", "1044", "1045"]

export default function DemoDaCaixaDeMarcar() {
  const [marcados, setMarcados] = React.useState<string[]>(["1043"])
  const todos = marcados.length === LINHAS.length ? true : marcados.length === 0 ? false : "indeterminate"
  return (
    <Amostras>
      <Amostra titulo="Os estados" primeira>
        <Checkbox aria-label="Desmarcada" />
        <Checkbox aria-label="Marcada" defaultChecked />
        <Checkbox aria-label="Indeterminada" checked="indeterminate" />
        <Checkbox aria-label="Desabilitada" disabled />
        <Checkbox aria-label="Desabilitada e marcada" disabled defaultChecked />
        <Checkbox aria-label="Inválida" aria-invalid />
      </Amostra>
      <Amostra titulo="Com o texto ao lado">
        <div className="flex flex-col gap-3">
          <OpcaoDeMarcar rotulo="Avisar o cliente por e-mail" defaultChecked />
          <OpcaoDeMarcar rotulo="Guardar uma cópia do relatório" descricao="A cópia fica na pasta do projeto por 90 dias." />
        </div>
      </Amostra>
      <Amostra titulo="Desabilitada, dizendo por quê">
        <OpcaoDeMarcar rotulo="Avisar o cliente por e-mail" descricao="O cliente não tem e-mail cadastrado." disabled />
      </Amostra>
      <Amostra titulo="Inválida, com a mensagem no campo">
        <div className="flex flex-col gap-1">
          <OpcaoDeMarcar rotulo="Li e aceito as condições" aria-invalid aria-errormessage="erro-das-condicoes" />
          <p id="erro-das-condicoes" className={`t-denso pl-6 ${COR_DO_TOM_DENSO.ruim}`}>
            Marque para continuar.
          </p>
        </div>
      </Amostra>
      <Amostra titulo="Na tabela, para a ação em lote">
        <div className="flex w-full flex-col gap-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox aria-label="Marcar todos" checked={todos} onCheckedChange={(v) => setMarcados(v === true ? LINHAS : [])} />
                </TableHead>
                <TableHead>Pedido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {LINHAS.map((n) => (
                <TableRow key={n}>
                  <TableCell>
                    <Checkbox
                      aria-label={`Marcar pedido ${n}`}
                      checked={marcados.includes(n)}
                      onCheckedChange={(v) => setMarcados((m) => (v === true ? [...m, n] : m.filter((x) => x !== n)))}
                    />
                  </TableCell>
                  <TableCell>Pedido {n}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p role="status" className="t-denso text-foreground-2">
            {marcados.length === 0 ? "Nenhum pedido marcado." : `${marcados.length} de ${LINHAS.length} marcados.`}
          </p>
        </div>
      </Amostra>
      <Amostra titulo="Sobre os fundos">
        {["bg-card", "bg-background", "bg-muted", "bg-accent"].map((fundo) => (
          <span key={fundo} className={`grid size-10 place-items-center rounded-lg ${fundo}`}>
            <Checkbox aria-label={`Caixa sobre ${fundo}`} />
          </span>
        ))}
      </Amostra>
    </Amostras>
  )
}
