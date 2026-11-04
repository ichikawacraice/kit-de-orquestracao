"use client"

import * as React from "react"
import { ArrowRightIcon, CalendarIcon, MessageSquareIcon, MoreHorizontalIcon, PencilIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ConteudoDoMenu, GatilhoDoMenu, GrupoDoMenu, ItemDoMenu, Menu, SubmenuDoMenu } from "@/components/ui/menu"
import { Pessoa } from "@/components/ui/pessoa"
import { Prioridade, type NivelDaPrioridade } from "@/components/ui/prioridade"
import {
  CabecaDoCartao,
  CabecalhoDaColuna,
  CartaoDoQuadro,
  ColunaDoQuadro,
  FitaDaColuna,
  IdentidadeDoCartao,
  InformativoDoCartao,
  PedidoDoCartao,
  PilhaDaColuna,
  Quadro,
  TituloDoCartao,
  VagaDoCartao,
  VidaDoCartao,
} from "@/components/ui/quadro"
import { Vazio } from "@/components/ui/vazio"

import { PontoDaEtapa } from "../etapas-de-exemplo"

import { Amostra, Amostras } from "./_amostra"

const COLUNAS = ["Entrada", "Em andamento", "Revisão", "Feito"]

function MenuDoCartao({ titulo }: { titulo: string }) {
  return (
    <Menu>
      <GatilhoDoMenu asChild>
        <Button variant="ghost" size="icon" aria-label={`Mais ações de ${titulo}`}>
          <MoreHorizontalIcon />
        </Button>
      </GatilhoDoMenu>
      <ConteudoDoMenu align="end">
        <GrupoDoMenu>
          <SubmenuDoMenu
            icone={ArrowRightIcon}
            rotuloDaEspera="As colunas"
            lista={
              <GrupoDoMenu>
                {COLUNAS.map((c) => (
                  <ItemDoMenu key={c} onEscolher={() => {}}>
                    {c}
                  </ItemDoMenu>
                ))}
              </GrupoDoMenu>
            }
          >
            Mover para
          </SubmenuDoMenu>
          <ItemDoMenu icone={PencilIcon} onEscolher={() => {}}>
            Renomear
          </ItemDoMenu>
        </GrupoDoMenu>
      </ConteudoDoMenu>
    </Menu>
  )
}

const NOME_DA_PRIORIDADE = { 0: "Sem prioridade", 1: "Baixa", 2: "Média", 3: "Alta", urgente: "Urgente" } as const

/**
 * O cartão de exemplo: a prioridade na cabeça; o onde, o prazo e a pessoa na
 * identidade; a bandeja sempre, com o informativo — tingida, a frase da voz
 * vem primeiro e o informativo segue na mesma bandeja.
 */
function Cartao({
  titulo,
  prioridade = 2,
  local = "Loja centro",
  ativo,
  origem,
  arrastando,
  tom = "neutro",
  frase,
  girando,
  acao,
}: {
  titulo: string
  prioridade?: NivelDaPrioridade
  local?: string
  ativo?: boolean
  origem?: boolean
  arrastando?: boolean
  tom?: "neutro" | "espera" | "ruim"
  frase?: string
  girando?: boolean
  acao?: React.ReactNode
}) {
  return (
    <li>
      <CartaoDoQuadro ativo={ativo} origem={origem} arrastando={arrastando}>
        <PedidoDoCartao>
          <CabecaDoCartao menu={<MenuDoCartao titulo={titulo} />}>
            {prioridade === 2 ? null : <Prioridade nivel={prioridade}>{NOME_DA_PRIORIDADE[prioridade]}</Prioridade>}
          </CabecaDoCartao>
          <TituloDoCartao>{titulo}</TituloDoCartao>
          <IdentidadeDoCartao
            inicio={local}
            fim={
              <>
                <span className="inline-flex items-center gap-1">
                  <CalendarIcon className="size-3.5" aria-hidden="true" />
                  até <span className="t-medida">12/11</span>
                </span>
                <Pessoa pessoa={{ nome: "Ana Souza" }} soMonograma />
              </>
            }
          />
        </PedidoDoCartao>
        <VidaDoCartao tom={tom} girando={girando}>
          {frase ? <span>{frase}</span> : null}
          {acao}
          {frase ? null : (
            <InformativoDoCartao>
              <span>há 2 h</span>
              <span className="inline-flex items-center gap-1">
                <MessageSquareIcon className="size-3.5" aria-hidden="true" />
                <span className="t-medida">3</span> mensagens
              </span>
            </InformativoDoCartao>
          )}
        </VidaDoCartao>
      </CartaoDoQuadro>
    </li>
  )
}

/** Para a coluna passar da altura do quadro e o cabeçalho grudado se ver. */
const MAIS_DA_ENTRADA = [
  "Atualizar o banner da semana",
  "Conferir o estoque das lojas do interior",
  "Corrigir o preço do kit de presente",
  "Responder a avaliação do cliente de ontem",
  "Trocar o texto do aviso de frete",
  "Revisar o cupom de primeira compra",
]

export default function DemoDoQuadro() {
  const [aberta, setAberta] = React.useState(false)
  return (
    <div className="flex flex-col gap-6">
      {/* O pai dá a altura; o quadro rola e o cabeçalho gruda. */}
      <div className="flex h-160 flex-col">
        <Quadro aria-label="Quadro de tarefas" anuncio="">
          <ColunaDoQuadro>
            <CabecalhoDaColuna
              nome="Entrada"
              marcador={<PontoDaEtapa etapa="entrada" semNome />}
              contagem={2 + MAIS_DA_ENTRADA.length}
              rotuloDaContagem={`${2 + MAIS_DA_ENTRADA.length} tarefas`}
            />
            <PilhaDaColuna>
              <Cartao
                titulo="Conferir o fechamento do mês antes do envio ao financeiro"
                prioridade="urgente"
                tom="espera"
                frase="Aguarda você: aprovar o valor"
              />
              <Cartao titulo="Trocar a foto de capa da vitrine" prioridade={1} ativo />
              {MAIS_DA_ENTRADA.map((titulo, i) => (
                <Cartao key={titulo} titulo={titulo} prioridade={i % 3 === 0 ? 3 : 2} local={i % 2 ? "Loja norte" : "Loja centro"} />
              ))}
            </PilhaDaColuna>
          </ColunaDoQuadro>
          <ColunaDoQuadro alvo>
            <CabecalhoDaColuna
              nome="Em andamento"
              marcador={<PontoDaEtapa etapa="andamento" semNome />}
              contagem={2}
              rotuloDaContagem="2 tarefas"
            />
            <PilhaDaColuna>
              <Cartao
                titulo="Revisar os textos da página de entrega"
                prioridade={3}
                girando
                frase="Movendo para Em andamento"
              />
              <li>
                <VagaDoCartao altura={120} />
              </li>
              <Cartao titulo="Ajustar o frete da região sul" origem />
            </PilhaDaColuna>
          </ColunaDoQuadro>
          <ColunaDoQuadro recusa motivoDaRecusa="Só a revisão move para Revisão">
            <CabecalhoDaColuna
              nome="Revisão"
              marcador={<PontoDaEtapa etapa="revisao" semNome />}
              contagem={1}
              rotuloDaContagem="1 tarefa"
            />
            <PilhaDaColuna>
              <Cartao
                titulo="Publicar a campanha de fim de ano"
                prioridade={2}
                tom="ruim"
                frase="Não mudou: a tarefa precisa de um responsável"
                acao={
                  <Button variant="outline" size="sm">
                    Tentar de novo
                  </Button>
                }
              />
            </PilhaDaColuna>
          </ColunaDoQuadro>
          {aberta ? (
            <ColunaDoQuadro>
              <CabecalhoDaColuna nome="Feito" contagem={0} rotuloDaContagem="nenhuma tarefa" />
              <PilhaDaColuna>
                <li>
                  <Vazio escala="coluna" causa="filtro">
                    Nenhuma tarefa com este filtro
                  </Vazio>
                </li>
              </PilhaDaColuna>
            </ColunaDoQuadro>
          ) : (
            <FitaDaColuna nome="Feito" contagem={0} causa="nenhuma tarefa com este filtro" onAbrir={() => setAberta(true)} />
          )}
        </Quadro>
      </div>
      <Amostras>
        <Amostra titulo="Enquanto o quadro carrega" primeira>
          <Quadro aria-label="Quadro carregando" carregando />
        </Amostra>
      </Amostras>
    </div>
  )
}
