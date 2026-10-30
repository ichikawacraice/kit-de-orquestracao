"use client"

import * as React from "react"
import { CopyIcon, MoreHorizontalIcon, PencilIcon, SendIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  ConteudoDoMenu,
  GatilhoDoMenu,
  GrupoDeEscolhaDoMenu,
  GrupoDoMenu,
  ItemDeEscolhaDoMenu,
  ItemDoMenu,
  Menu,
  SubmenuDoMenu,
} from "@/components/ui/menu"

import { Amostra, Amostras } from "./_amostra"

export default function DemoDoMenu() {
  const [ordem, setOrdem] = React.useState("recentes")
  const [desfecho, setDesfecho] = React.useState("Nenhuma ação escolhida.")
  return (
    <Amostras>
      <Amostra titulo="Menu de ações" primeira>
        <Menu>
          <GatilhoDoMenu asChild>
            <Button variant="outline" size="icon" aria-label="Mais ações do relatório">
              <MoreHorizontalIcon />
            </Button>
          </GatilhoDoMenu>
          <ConteudoDoMenu>
            <GrupoDoMenu>
              <ItemDoMenu icone={PencilIcon} onEscolher={() => setDesfecho("Renomear.")}>
                Renomear
              </ItemDoMenu>
              <ItemDoMenu icone={CopyIcon} onEscolher={() => setDesfecho("Duplicado.")}>
                Duplicar
              </ItemDoMenu>
              <ItemDoMenu icone={SendIcon} bloqueado="Falta a aprovação" onEscolher={() => {}}>
                Enviar ao cliente
              </ItemDoMenu>
            </GrupoDoMenu>
            <GrupoDoMenu>
              <SubmenuDoMenu rotuloDaEspera="As pastas" vazio="Nenhuma pasta criada.">
                Mover para
              </SubmenuDoMenu>
            </GrupoDoMenu>
            <GrupoDoMenu>
              <ItemDoMenu
                icone={Trash2Icon}
                destrutivo
                confirmacao={{ titulo: "Excluir o relatório?", descricao: "Ele sai da lista e não volta.", confirmar: "Excluir" }}
                onEscolher={() => setDesfecho("Excluído.")}
              >
                Excluir
              </ItemDoMenu>
            </GrupoDoMenu>
          </ConteudoDoMenu>
        </Menu>
      </Amostra>
      <Amostra titulo="Escolha">
        <Menu>
          <GatilhoDoMenu asChild>
            <Button variant="secondary">Ordenar</Button>
          </GatilhoDoMenu>
          <ConteudoDoMenu>
            <GrupoDeEscolhaDoMenu valor={ordem} onTrocar={setOrdem} rotulo="Ordem">
              <ItemDeEscolhaDoMenu valor="recentes">Mais recentes</ItemDeEscolhaDoMenu>
              <ItemDeEscolhaDoMenu valor="antigos">Mais antigos</ItemDeEscolhaDoMenu>
              <ItemDeEscolhaDoMenu valor="nome" bloqueado="Só com 2 ou mais itens">
                Por nome
              </ItemDeEscolhaDoMenu>
            </GrupoDeEscolhaDoMenu>
          </ConteudoDoMenu>
        </Menu>
      </Amostra>
      <p role="status" className="pt-4 text-sm text-foreground-2">
        {desfecho}
      </p>
    </Amostras>
  )
}
