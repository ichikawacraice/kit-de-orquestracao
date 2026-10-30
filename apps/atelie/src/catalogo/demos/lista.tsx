"use client"

import { CascoDoApp } from "@/registry/wicomm/blocks/casco/casco-do-app"
import { navegacaoDoExemplo } from "@/registry/wicomm/blocks/casco/navegacao"
import { cargaDaLista } from "@/registry/wicomm/blocks/lista/dados-da-lista"
import { ListaDePedidos } from "@/registry/wicomm/blocks/lista/lista-de-pedidos"

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
