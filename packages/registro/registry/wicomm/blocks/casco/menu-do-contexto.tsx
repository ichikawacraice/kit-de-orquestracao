"use client"

import * as React from "react"
import { ChevronsUpDownIcon } from "lucide-react"

import { Button } from "@/registry/wicomm/ui/button"
import { ConteudoDoMenu, GatilhoDoMenu, GrupoDeEscolhaDoMenu, ItemDeEscolhaDoMenu, Menu } from "@/registry/wicomm/ui/menu"

const ORGANIZACOES = ["Organização Exemplo", "Filial Centro", "Filial Norte"] as const

/**
 * A troca de contexto no cabeçalho — EXEMPLO. A escolha JÁ é a ação (PECA-01:
 * `GrupoDeEscolhaDoMenu`, nunca `Select` com *Salvar*). No app, trocar navega
 * para o contexto novo, e a tela nova mostra o próprio carregando.
 */
function MenuDoContexto() {
  const [atual, setAtual] = React.useState<string>(ORGANIZACOES[0])
  return (
    <Menu>
      <GatilhoDoMenu asChild>
        <Button variant="ghost" aria-label={`Organização: ${atual}`}>
          {atual}
          <ChevronsUpDownIcon aria-hidden="true" />
        </Button>
      </GatilhoDoMenu>
      <ConteudoDoMenu align="start" aria-label="Organização">
        <GrupoDeEscolhaDoMenu valor={atual} onTrocar={setAtual} rotulo="Organização">
          {ORGANIZACOES.map((o) => (
            <ItemDeEscolhaDoMenu key={o} valor={o}>
              {o}
            </ItemDeEscolhaDoMenu>
          ))}
        </GrupoDeEscolhaDoMenu>
      </ConteudoDoMenu>
    </Menu>
  )
}

export { MenuDoContexto }
