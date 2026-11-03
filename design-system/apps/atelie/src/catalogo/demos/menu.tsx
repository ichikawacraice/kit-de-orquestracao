"use client"

import * as React from "react"
import { CopyIcon, MoreHorizontalIcon, PencilIcon, PlusIcon, SendIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  AncoraDoMenu,
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

/** Uma lista longa: mais linhas do que cabem na metade de baixo de uma tela de notebook. */
const SECOES = [
  "Capa",
  "Faixa de destaque",
  "Texto",
  "Texto com imagem",
  "Galeria",
  "Vídeo",
  "Depoimentos",
  "Perguntas frequentes",
  "Tabela de preços",
  "Contagem regressiva",
  "Lista de produtos",
  "Mapa",
  "Formulário de contato",
  "Chamada para ação",
  "Logotipos de parceiros",
  "Linha do tempo",
  "Equipe",
  "Rodapé",
]

/**
 * SUP-07 — o menu longo perto da borda de baixo: em vez de abrir para baixo e
 * cortar, ele sobe, para a 8px da borda e rola por dentro. O segundo gatilho
 * abre o menu ancorado no fim da janela, para o caso valer em qualquer rolagem.
 */
function MenuLongoNaBorda({ aoEscolher }: { aoEscolher: (s: string) => void }) {
  const [aberto, setAberto] = React.useState(false)
  const [ancora, setAncora] = React.useState({ x: 0, y: 0, width: 0, height: 0 })
  const botao = React.useRef<HTMLButtonElement>(null)
  const linhas = (
    <GrupoDoMenu>
      {SECOES.map((s) => (
        <ItemDoMenu key={s} onEscolher={() => aoEscolher(`Seção acrescentada: ${s}.`)}>
          {s}
        </ItemDoMenu>
      ))}
    </GrupoDoMenu>
  )
  return (
    <>
      <Menu>
        <GatilhoDoMenu asChild>
          <Button variant="secondary">
            <PlusIcon />
            Adicionar seção
          </Button>
        </GatilhoDoMenu>
        <ConteudoDoMenu align="start" aria-label="Seções">
          {linhas}
        </ConteudoDoMenu>
      </Menu>
      <Menu open={aberto} onOpenChange={setAberto}>
        <AncoraDoMenu retangulo={ancora} />
        <Button
          ref={botao}
          variant="outline"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            setAncora({ x: r.left, y: window.innerHeight - 40, width: r.width, height: 32 })
            setAberto(true)
          }}
        >
          Abrir no fim da tela
        </Button>
        <ConteudoDoMenu
          align="start"
          aria-label="Seções no fim da tela"
          onCloseAutoFocus={(e) => {
            // Sem gatilho, a volta do foco é da tela: ao botão que abriu.
            e.preventDefault()
            botao.current?.focus()
          }}
        >
          {linhas}
        </ConteudoDoMenu>
      </Menu>
    </>
  )
}

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
      <Amostra titulo="Lista longa perto da borda">
        <MenuLongoNaBorda aoEscolher={setDesfecho} />
      </Amostra>
      <p role="status" className="pt-4 text-sm text-foreground-2">
        {desfecho}
      </p>
    </Amostras>
  )
}
