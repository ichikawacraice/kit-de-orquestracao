"use client"

import { CascoDoApp } from "@/registry/design-system/blocks/casco/casco-do-app"
import { navegacaoDoExemplo } from "@/registry/design-system/blocks/casco/navegacao"
import { cargaDaLista } from "@/registry/design-system/blocks/lista/dados-da-lista"
import { ListaDePedidos } from "@/registry/design-system/blocks/lista/lista-de-pedidos"

import { CONTA, LinkDoPalco, Tela } from "./_tela"

export default function DemoDaLista() {
  const { grupos, contagens } = navegacaoDoExemplo("/pedidos", null)
  return (
    <Tela>
      <CascoDoApp grupos={grupos} caminhoAtual="/pedidos" contagens={contagens} link={LinkDoPalco} conta={CONTA}>
        <ListaDePedidos carga={cargaDaLista(undefined)} />
      </CascoDoApp>
    </Tela>
  )
}
