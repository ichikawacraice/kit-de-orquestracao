"use client"

import { InboxIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PaginaDoApp, TopoDaPagina } from "@/components/ui/topo-da-pagina"
import { Vazio } from "@/components/ui/vazio"
import { CabecalhoDoApp } from "@/registry/wicomm/blocks/casco/cabecalho-do-app"
import { CascoDoApp } from "@/registry/wicomm/blocks/casco/casco-do-app"
import { MenuDoContexto } from "@/registry/wicomm/blocks/casco/menu-do-contexto"
import { navegacaoDoExemplo } from "@/registry/wicomm/blocks/casco/navegacao"

import { CONTA, LinkDoPalco, Tela } from "./_tela"

export default function DemoDoCasco() {
  const { grupos, contagens } = navegacaoDoExemplo("/clientes", null)
  return (
    <Tela>
      <CascoDoApp
        grupos={grupos}
        caminhoAtual="/clientes"
        contagens={contagens}
        link={LinkDoPalco}
        conta={CONTA}
        cabecalho={<CabecalhoDoApp contexto={<MenuDoContexto />} />}
      >
        <PaginaDoApp>
          <TopoDaPagina titulo="Clientes" primario={<Button size="lg">Novo cliente</Button>} />
          <Vazio causa="nada-ainda" icone={InboxIcon} titulo="A tela mora aqui">
            O casco dá a barra, o cabeçalho e a região que rola; a tela entra no lugar deste vazio.
          </Vazio>
        </PaginaDoApp>
      </CascoDoApp>
    </Tela>
  )
}
