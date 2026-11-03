"use client"

import { MonitorIcon, MoreHorizontalIcon, Redo2Icon, SmartphoneIcon, Undo2Icon } from "lucide-react"
import * as React from "react"

import { BarraDoEditor, GrupoDaBarra, GrupoDaPessoa } from "@/components/ui/barra-do-editor"
import { Button } from "@/components/ui/button"
import { ChipDeEstado } from "@/components/ui/chip-de-estado"
import { BarraDeModos } from "@/components/ui/seletor-de-vista"
import { ProvedorDeLink } from "@/lib/link-do-app"

import { CONTA, LinkDoPalco } from "./_tela"

export default function DemoDaBarraDoEditor() {
  const [vista, setVista] = React.useState("computador")
  return (
    <ProvedorDeLink componente={LinkDoPalco}>
      <BarraDoEditor
        voltar={{ href: "/documentos", rotulo: "Voltar aos documentos" }}
        nome="Proposta comercial"
        ondeEstou={
          <>
            <ChipDeEstado tom="neutro" className="shrink-0">
              2 mudanças
            </ChipDeEstado>
            <GrupoDaBarra>
              <Button variant="ghost" size="icon" aria-label="Desfazer">
                <Undo2Icon aria-hidden="true" />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Refazer" disabled>
                <Redo2Icon aria-hidden="true" />
              </Button>
            </GrupoDaBarra>
          </>
        }
        vista={
          <BarraDeModos
            rotulo="Vista"
            densidade="modos"
            modos={[
              { chave: "computador", rotulo: "Computador", icone: MonitorIcon },
              { chave: "celular", rotulo: "Celular", icone: SmartphoneIcon },
            ]}
            valor={vista}
            onTrocar={setVista}
          />
        }
        acoes={
          <>
            <Button>Publicar</Button>
            <GrupoDaBarra>
              <Button variant="ghost" size="icon" aria-label="Mais ações do documento">
                <MoreHorizontalIcon aria-hidden="true" />
              </Button>
              <GrupoDaPessoa conta={CONTA} />
            </GrupoDaBarra>
          </>
        }
      />
    </ProvedorDeLink>
  )
}
