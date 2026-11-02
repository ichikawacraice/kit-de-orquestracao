"use client"

import { CascoDoApp } from "@/registry/design-system/blocks/casco/casco-do-app"
import { navegacaoDoExemplo } from "@/registry/design-system/blocks/casco/navegacao"
import { cargaDaMesa } from "@/registry/design-system/blocks/mesa/dados-da-mesa"
import { MesaDoPedido } from "@/registry/design-system/blocks/mesa/mesa-do-pedido"

import { CONTA, LinkDoPalco, Tela } from "./_tela"

export default function DemoDaMesa() {
  const { grupos, contagens } = navegacaoDoExemplo("/pedidos/1042", "a-conferir")
  return (
    <Tela>
      <CascoDoApp grupos={grupos} caminhoAtual="/pedidos/1042" contagens={contagens} link={LinkDoPalco} conta={CONTA}>
        <MesaDoPedido carga={cargaDaMesa("1042", "a-conferir")} hrefDaConferencia="/pedidos/1042?estado=a-conferir" />
      </CascoDoApp>
    </Tela>
  )
}
