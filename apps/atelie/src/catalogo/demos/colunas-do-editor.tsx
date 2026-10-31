"use client"

import { FileSignatureIcon, ListIcon, PanelTopIcon, TypeIcon } from "lucide-react"
import * as React from "react"

import { ColunasDoEditor, ItemDaEstrutura, ItemDoTrilho } from "@/components/ui/colunas-do-editor"
import { Card } from "@/components/ui/card"

import { Tela } from "./_tela"

const SECOES = [
  { id: "capa", nome: "Capa", icone: PanelTopIcon },
  { id: "introducao", nome: "Introdução", icone: TypeIcon },
  { id: "itens", nome: "Itens", icone: ListIcon },
  { id: "assinatura", nome: "Assinatura", icone: FileSignatureIcon },
]

export default function DemoDasColunas() {
  const [selecionada, setSelecionada] = React.useState<string | null>("capa")
  const [aberta, setAberta] = React.useState(true)
  const [pedida, setPedida] = React.useState(true)
  const nome = SECOES.find((s) => s.id === selecionada)?.nome ?? "Seção"
  const selecionar = (id: string) => {
    setSelecionada(id)
    setAberta(true)
  }
  return (
    <Tela>
      <div className="flex h-full flex-col bg-background p-2">
        <ColunasDoEditor
          tituloDaEstrutura="Estrutura"
          estrutura={SECOES.map((s) => (
            <ItemDaEstrutura key={s.id} icone={s.icone} nome={s.nome} ativo={s.id === selecionada} onSelecionar={() => selecionar(s.id)} />
          ))}
          trilho={SECOES.map((s) => (
            <ItemDoTrilho key={s.id} icone={s.icone} nome={s.nome} ativo={s.id === selecionada} onSelecionar={() => selecionar(s.id)} />
          ))}
          estruturaPedida={pedida}
          onPedirEstrutura={setPedida}
          canvas={
            <div className="h-full overflow-y-auto p-6">
              <Card className="mx-auto max-w-3xl p-8">
                <p className="t-titulo">A página</p>
                <p className="t-denso text-foreground-2">O canvas fica com pelo menos 60% das colunas: com o inspector aberto, a estrutura vira trilho.</p>
              </Card>
            </div>
          }
          direita={{
            titulo: nome,
            aberta: aberta && selecionada !== null,
            conteudo: <p className="t-denso text-foreground-2">Os campos da seção {nome}.</p>,
            onFechar: () => setAberta(false),
            onDarLugar: () => setAberta(false),
          }}
        />
      </div>
    </Tela>
  )
}
