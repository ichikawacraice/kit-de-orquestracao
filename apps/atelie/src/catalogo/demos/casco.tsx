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

/** Os dois casos do casco: o app com login (conta no pé da barra) e o app sem login, de acesso protegido fora dele. */
export default function DemoDoCasco() {
  const { grupos, contagens } = navegacaoDoExemplo("/clientes", null)
  return (
    <div className="flex flex-col gap-6">
      {[
        { id: "com", legenda: "Com login: a conta no pé da barra", conta: CONTA },
        { id: "sem", legenda: "Sem login: o pé fica com recolher e tema", conta: undefined },
      ].map((caso) => (
        <figure key={caso.id} className="flex flex-col gap-2">
          <figcaption className="t-coluna">{caso.legenda}</figcaption>
          <Tela>
            <CascoDoApp
              grupos={grupos}
              caminhoAtual="/clientes"
              contagens={contagens}
              link={LinkDoPalco}
              conta={caso.conta}
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
        </figure>
      ))}
    </div>
  )
}
