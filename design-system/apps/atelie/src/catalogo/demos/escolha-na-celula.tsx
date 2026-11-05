"use client"

import * as React from "react"

import { EscolhaNaCelula } from "@/components/ui/escolha-na-celula"
import { Estado } from "@/components/ui/estado"
import { Input } from "@/components/ui/input"
import { GrupoDeEscolhaDoMenu, ItemDeEscolhaDoMenu } from "@/components/ui/menu"
import { Pessoa } from "@/components/ui/pessoa"
import { Prazo } from "@/components/ui/prazo"
import { LinkDaLinha, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ProvedorDeLink } from "@/lib/link-do-app"

import { Amostra, Amostras } from "./_amostra"
import { pessoaDaDemo } from "./_pessoas"
import { LinkDoPalco } from "./_tela"

const HOJE = new Date("2026-07-12T12:00:00-03:00")
const ETAPAS = { aberta: "Aberta", curso: "Em curso", feita: "Feita" } as const
type Etapa = keyof typeof ETAPAS
const PESSOAS = ["Ana Souza", "Bruno Lima", "Carla Dias"]

/** A troca na hora, a gravação que demora e, na segunda vez, a recusa que desfaz. */
function useGravacao<T>(inicial: T) {
  const [valor, setValor] = React.useState(inicial)
  const [gravando, setGravando] = React.useState(false)
  const [recusado, setRecusado] = React.useState(false)
  const vezes = React.useRef(0)
  const tentado = React.useRef(inicial)
  const trocar = (novo: T) => {
    const antigo = valor
    tentado.current = novo
    setValor(novo)
    setRecusado(false)
    setGravando(true)
    vezes.current += 1
    const falha = vezes.current % 2 === 0
    window.setTimeout(() => {
      setGravando(false)
      if (falha) {
        setValor(antigo)
        setRecusado(true)
      }
    }, 900)
  }
  return { valor, trocar, gravando, recusado, tentarDeNovo: () => trocar(tentado.current) }
}

/** O período que não pode inverter: o Salvar diz por quê, e o Enter não grava. */
function PeriodoNaCelula() {
  const [periodo, setPeriodo] = React.useState({ inicio: "2026-07-20", fim: "2026-07-24" })
  const [rascunho, setRascunho] = React.useState(periodo)
  const invertido = rascunho.fim < rascunho.inicio
  return (
    <EscolhaNaCelula
      rotulo="Período"
      variante="popover"
      valor={<Prazo periodo={periodo} hoje={HOJE} />}
      aoSalvar={() => setPeriodo(rascunho)}
      motivoParaNaoSalvar={invertido ? "O término vem antes do início." : null}
    >
      <div className="flex gap-2">
        <Input
          type="date"
          aria-label="Início"
          value={rascunho.inicio}
          onChange={(e) => setRascunho((r) => ({ ...r, inicio: e.target.value }))}
        />
        <Input
          type="date"
          aria-label="Término"
          value={rascunho.fim}
          aria-invalid={invertido || undefined}
          onChange={(e) => setRascunho((r) => ({ ...r, fim: e.target.value }))}
        />
      </div>
    </EscolhaNaCelula>
  )
}

export default function DemoDaEscolhaNaCelula() {
  const etapa = useGravacao<Etapa>("curso")
  const quem = useGravacao<string | null>("Ana Souza")
  const prazo = useGravacao("2026-07-24")
  const [rascunho, setRascunho] = React.useState(prazo.valor)

  return (
    <Amostras>
      <Amostra titulo="Na linha que abre o objeto (a segunda troca é recusada)" primeira>
        <ProvedorDeLink componente={LinkDoPalco}>
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead>Tarefa</TableHead>
                <TableHead className="w-40">Etapa</TableHead>
                <TableHead className="w-44">Responsável</TableHead>
                <TableHead className="w-36">Prazo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="truncate">
                  <LinkDaLinha href="/tarefas/4">Protótipo navegável</LinkDaLinha>
                </TableCell>
                <TableCell>
                  <EscolhaNaCelula
                    rotulo="Etapa"
                    valor={<Estado tom="neutro">{ETAPAS[etapa.valor]}</Estado>}
                    gravando={etapa.gravando}
                    recusado={etapa.recusado}
                    aoTentarDeNovo={etapa.tentarDeNovo}
                  >
                    <GrupoDeEscolhaDoMenu valor={etapa.valor} onTrocar={(v) => etapa.trocar(v as Etapa)}>
                      {Object.entries(ETAPAS).map(([v, r]) => (
                        <ItemDeEscolhaDoMenu key={v} valor={v}>
                          {r}
                        </ItemDeEscolhaDoMenu>
                      ))}
                    </GrupoDeEscolhaDoMenu>
                  </EscolhaNaCelula>
                </TableCell>
                <TableCell>
                  <EscolhaNaCelula
                    rotulo="Responsável"
                    valor={<Pessoa pessoa={pessoaDaDemo(quem.valor)} />}
                    gravando={quem.gravando}
                    recusado={quem.recusado}
                    aoTentarDeNovo={quem.tentarDeNovo}
                  >
                    <GrupoDeEscolhaDoMenu valor={quem.valor ?? ""} onTrocar={(v) => quem.trocar(v || null)}>
                      {PESSOAS.map((p) => (
                        <ItemDeEscolhaDoMenu key={p} valor={p}>
                          {p}
                        </ItemDeEscolhaDoMenu>
                      ))}
                      <ItemDeEscolhaDoMenu valor="">Sem responsável</ItemDeEscolhaDoMenu>
                    </GrupoDeEscolhaDoMenu>
                  </EscolhaNaCelula>
                </TableCell>
                <TableCell>
                  <EscolhaNaCelula
                    rotulo="Prazo"
                    variante="popover"
                    valor={<Prazo periodo={prazo.valor} hoje={HOJE} />}
                    aoSalvar={() => prazo.trocar(rascunho)}
                    gravando={prazo.gravando}
                    recusado={prazo.recusado}
                    aoTentarDeNovo={prazo.tentarDeNovo}
                  >
                    <Input type="date" aria-label="Novo prazo" value={rascunho} onChange={(e) => setRascunho(e.target.value)} />
                  </EscolhaNaCelula>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </ProvedorDeLink>
      </Amostra>
      <Amostra titulo="Popover com formulário: Enter grava, Cancelar fecha, o Salvar diz por que não">
        <PeriodoNaCelula />
      </Amostra>
      <Amostra titulo="Sem valor: a leitura vazia da peça, com o chevron">
        <EscolhaNaCelula rotulo="Prazo" variante="popover" valor={<Prazo periodo={null} />} aoSalvar={() => {}}>
          <Input type="date" aria-label="Prazo" />
        </EscolhaNaCelula>
      </Amostra>
      <Amostra titulo="Sem permissão: só a leitura">
        <EscolhaNaCelula rotulo="Responsável" editavel={false} valor={<Pessoa pessoa={pessoaDaDemo("Ana Souza")} />}>
          {null}
        </EscolhaNaCelula>
        <EscolhaNaCelula rotulo="Prazo" editavel={false} valor={<Prazo periodo="2026-07-24" hoje={HOJE} />}>
          {null}
        </EscolhaNaCelula>
      </Amostra>
    </Amostras>
  )
}
