"use client"

import * as React from "react"
import { PanelLeftCloseIcon, PanelLeftOpenIcon, PanelRightCloseIcon } from "lucide-react"

import { Button } from "@/registry/design-system/ui/button"
import { Dialog, DialogLateral } from "@/registry/design-system/ui/dialog"
import { Estado } from "@/registry/design-system/ui/estado"
import { Painel, RolagemDoPainel } from "@/registry/design-system/ui/painel"
import { TopoDoPainel } from "@/registry/design-system/ui/secao"
import { Ajuda } from "@/registry/design-system/ui/tooltip"
import type { Tom } from "@/registry/design-system/lib/idioma-de-cor"
import { cn } from "@/registry/design-system/lib/utils"

/**
 * AS COLUNAS DO EDITOR (ANATOMIA ARQ-03) — a estrutura à esquerda (que recolhe
 * a um trilho de ícones), o canvas ao centro e a coluna da direita (o inspector,
 * e um dia a conversa, no mesmo lugar).
 *
 * **A regra é medida, não um ponto fixo:** a estrutura só fica aberta enquanto o
 * canvas ficar com pelo menos 60% das colunas (`estruturaCabe`). A 1280px, com
 * o inspector aberto, ela vira trilho: o canvas passa de 620px (48%) para 860px
 * (67%). Reabrir a estrutura quando ela não cabe faz a coluna da direita dar
 * lugar; selecionar com a estrutura aberta, ao abrir o inspector, a recolhe.
 *
 * **Abaixo de 1280px** de tela a coluna da direita abre por cima, numa gaveta
 * (`DialogLateral`), e a regra conta o que ela cobre. Sem redimensionar à mão
 * nesta versão: o `Resizable` entra quando um projeto pedir.
 *
 * As larguras são as classes (`w-72`, `w-12`, `w-85`, `gap-2`, a moldura `p-2`
 * do bloco) e as constantes daqui, as mesmas: o teste lê as duas.
 */
const LARGURA_DA_ESTRUTURA = 288
const LARGURA_DO_TRILHO = 48
const LARGURA_DA_COLUNA = 340
const VAO_DAS_COLUNAS = 8
const PISO_DO_CANVAS = 0.6
/** A tela a partir da qual a coluna da direita encaixa, e a moldura do bloco (`p-2` dos dois lados). */
const TELA_LARGA = 1280
const MOLDURA = 16
/** A gaveta: `w-[min(26rem,…)]` e o recuo `right-3` do `DialogLateral`. */
const LARGURA_DA_GAVETA = 416 + 12

/**
 * A estrutura cabe, sem deixar o canvas abaixo do piso? `direitaOcupa` é o que a
 * coluna da direita tira do que se vê. Largura 0 (o primeiro desenho, sem
 * medida) não vira divisor: a peça segue a vontade da pessoa.
 */
function estruturaCabe(largura: number, direitaOcupa: number): boolean {
  if (largura <= 0) return true
  return largura - (LARGURA_DA_ESTRUTURA + VAO_DAS_COLUNAS) - direitaOcupa >= PISO_DO_CANVAS * largura
}

type Situacao = { tom: Tom; palavra: string }

type ColunaDaDireita = {
  /** O nome do que a coluna mostra: o nome da seção selecionada, no inspector. */
  titulo: string
  /** O `⋯` do item, ao lado do título. */
  acoes?: React.ReactNode
  aberta: boolean
  conteudo: React.ReactNode
  /** Gesto da pessoa: fechar a coluna. */
  onFechar: () => void
  /** A peça pede lugar para a estrutura: não é a pessoa fechando. */
  onDarLugar: () => void
}

function ColunasDoEditor({
  tituloDaEstrutura,
  acaoDaEstrutura,
  estrutura,
  trilho,
  estruturaPedida,
  onPedirEstrutura,
  canvas,
  direita,
}: {
  tituloDaEstrutura: string
  /** O "Adicionar seção", no topo da estrutura aberta. */
  acaoDaEstrutura?: React.ReactNode
  /** As `ItemDaEstrutura`. */
  estrutura: React.ReactNode
  /** Os `ItemDoTrilho`, um por item da estrutura. */
  trilho: React.ReactNode
  /** A vontade da pessoa (`false` quando ela fechou a estrutura). */
  estruturaPedida: boolean
  onPedirEstrutura: (aberta: boolean) => void
  canvas: React.ReactNode
  direita: ColunaDaDireita
}) {
  const raiz = React.useRef<HTMLDivElement>(null)
  const [largura, setLargura] = React.useState(0)
  React.useLayoutEffect(() => {
    const el = raiz.current
    if (!el) return
    const ler = () => setLargura(el.clientWidth)
    ler()
    if (typeof ResizeObserver === "undefined") return
    const obs = new ResizeObserver(ler)
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // Sem medida, a coluna encaixa: é o desenho da tela larga, o pior caso da regra.
  const largo = largura === 0 || largura + MOLDURA >= TELA_LARGA
  const direitaOcupa = !direita.aberta ? 0 : largo ? LARGURA_DA_COLUNA + VAO_DAS_COLUNAS : LARGURA_DA_GAVETA
  const cabe = estruturaCabe(largura, direitaOcupa)
  const recolhida = !(estruturaPedida && cabe)
  const fechaAColuna = direita.aberta && !estruturaCabe(largura, largo ? LARGURA_DA_COLUNA + VAO_DAS_COLUNAS : LARGURA_DA_GAVETA)

  // A largura só anima depois do primeiro quadro: a do primeiro desenho não é gesto de ninguém.
  const [animar, setAnimar] = React.useState(false)
  React.useEffect(() => {
    const id = window.requestAnimationFrame(() => setAnimar(true))
    return () => window.cancelAnimationFrame(id)
  }, [])

  const abrirEstrutura = () => {
    onPedirEstrutura(true)
    if (fechaAColuna) direita.onDarLugar()
  }

  // A estrutura recolhe por uma seleção feita nela: o botão que tinha o foco some, e o foco cairia no <body>.
  // Só quando o foco estava nela: a recolhida da primeira medida não é gesto de ninguém, e não puxa o foco.
  const trilhoRef = React.useRef<HTMLDivElement>(null)
  const focoNaEstrutura = React.useRef(false)
  const estruturaRef = React.useRef<HTMLDivElement>(null)
  const eraRecolhida = React.useRef(recolhida)
  React.useLayoutEffect(() => {
    const antes = eraRecolhida.current
    eraRecolhida.current = recolhida
    // Reabrir pelo trilho: o botão que tinha o foco fica escondido, e o foco vai à linha ativa da estrutura.
    if (!recolhida && antes) {
      if (!trilhoRef.current?.contains(document.activeElement)) return
      const linha =
        estruturaRef.current?.querySelector<HTMLElement>('[data-slot="item-da-estrutura"] [aria-pressed="true"]') ??
        estruturaRef.current?.querySelector<HTMLElement>("button")
      linha?.focus()
      return
    }
    if (!recolhida || antes || !focoNaEstrutura.current) return
    focoNaEstrutura.current = false
    const alvo =
      trilhoRef.current?.querySelector<HTMLElement>('[data-slot="item-do-trilho"][aria-pressed="true"]') ??
      trilhoRef.current?.querySelector<HTMLElement>('[data-slot="abrir-a-estrutura"]')
    alvo?.focus()
  }, [recolhida])

  const cabecalhoDaDireita = (
    <TopoDoPainel titulo={direita.titulo}>
      {direita.acoes}
      <Ajuda texto="Fechar a coluna">
        <Button variant="ghost" size="icon" aria-label="Fechar a coluna" onClick={direita.onFechar}>
          <PanelRightCloseIcon aria-hidden="true" />
        </Button>
      </Ajuda>
    </TopoDoPainel>
  )

  return (
    <div ref={raiz} data-slot="colunas-do-editor" data-largo={largo} className="flex min-h-0 flex-1 gap-2">
      <Painel
        as="nav"
        aria-label={tituloDaEstrutura}
        data-recolhida={recolhida}
        className={cn(
          "shrink-0",
          animar && "transition-[width] duration-painel motion-reduce:transition-none",
          recolhida ? "w-12 ease-fecha" : "w-72 ease-abre"
        )}
      >
        <div
          ref={estruturaRef}
          hidden={recolhida}
          onFocusCapture={() => void (focoNaEstrutura.current = true)}
          onBlurCapture={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) focoNaEstrutura.current = false
          }}
          className={cn("min-h-0 w-72 flex-1 flex-col", recolhida ? "hidden" : "flex")}
        >
          <TopoDoPainel titulo={tituloDaEstrutura}>
            {acaoDaEstrutura}
            <Ajuda texto="Fechar a estrutura">
              <Button variant="ghost" size="icon" aria-label="Fechar a estrutura" onClick={() => onPedirEstrutura(false)}>
                <PanelLeftCloseIcon aria-hidden="true" />
              </Button>
            </Ajuda>
          </TopoDoPainel>
          <RolagemDoPainel densidade="compacta">
            <ol className="flex flex-col gap-0.5">{estrutura}</ol>
          </RolagemDoPainel>
        </div>
        <div ref={trilhoRef} hidden={!recolhida} className={cn("min-h-0 w-12 flex-1 flex-col items-center gap-1 py-2", recolhida ? "flex" : "hidden")}>
          <Ajuda texto={fechaAColuna ? "Abrir a estrutura (fecha a coluna)" : "Abrir a estrutura"} lado="right">
            <Button variant="ghost" size="icon" aria-label="Abrir a estrutura" data-slot="abrir-a-estrutura" onClick={abrirEstrutura}>
              <PanelLeftOpenIcon aria-hidden="true" />
            </Button>
          </Ajuda>
          <ol aria-label={tituloDaEstrutura} className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto pt-2">
            {trilho}
          </ol>
        </div>
      </Painel>

      <div data-slot="canvas-do-editor" className="relative min-w-0 flex-1 overflow-hidden rounded-painel bg-muted">
        {canvas}
      </div>

      {largo ? (
        direita.aberta ? (
          <Painel
            as="aside"
            aria-label={direita.titulo}
            data-slot="coluna-da-direita"
            className="w-85 shrink-0 animate-in fade-in-0 slide-in-from-right-2 duration-painel ease-abre motion-reduce:animate-none"
          >
            {cabecalhoDaDireita}
            <RolagemDoPainel densidade="compacta">{direita.conteudo}</RolagemDoPainel>
          </Painel>
        ) : null
      ) : (
        <Dialog open={direita.aberta} onOpenChange={(aberta) => (aberta ? null : direita.onFechar())} modal={false}>
          <DialogLateral titulo={direita.titulo} cabecalho={direita.acoes}>
            <div data-slot="coluna-da-direita" className="flex flex-col">
              {direita.conteudo}
            </div>
          </DialogLateral>
        </Dialog>
      )}
    </div>
  )
}

/** A linha da estrutura (ARQ-04): selecionar com ícone e nome, a situação em ponto, e o `⋯` no fim. */
function ItemDaEstrutura({
  icone: Icone,
  nome,
  ativo,
  situacao,
  onSelecionar,
  menu,
}: {
  icone: React.ComponentType<{ className?: string }>
  nome: string
  ativo: boolean
  situacao?: Situacao
  onSelecionar: () => void
  menu?: React.ReactNode
}) {
  return (
    <li data-slot="item-da-estrutura" className="group/item flex items-center gap-1">
      <button
        type="button"
        aria-pressed={ativo}
        onClick={onSelecionar}
        className={cn(
          "flex h-8 min-w-0 flex-1 items-center gap-2 rounded-ctrl px-2 text-sm transition-colors duration-cor focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
          ativo ? "bg-primary/10 font-semibold text-foreground" : "text-foreground-2 hover:bg-accent hover:text-foreground"
        )}
      >
        <Icone className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-left">{nome}</span>
        {situacao ? (
          <Estado tom={situacao.tom} soPonto>
            {situacao.palavra}
          </Estado>
        ) : null}
      </button>
      {menu}
    </li>
  )
}

/** Um ícone por item no trilho da estrutura recolhida; o nome e a situação vão no rótulo e na dica. */
function ItemDoTrilho({
  icone: Icone,
  nome,
  ativo,
  situacao,
  onSelecionar,
}: {
  icone: React.ComponentType<{ className?: string }>
  nome: string
  ativo: boolean
  situacao?: Situacao
  onSelecionar: () => void
}) {
  const rotulo = situacao ? `${nome}, ${situacao.palavra}` : nome
  return (
    <li className="relative">
      <Ajuda texto={rotulo} lado="right">
        <Button
          variant="ghost"
          size="icon"
          aria-label={rotulo}
          aria-pressed={ativo}
          data-slot="item-do-trilho"
          onClick={onSelecionar}
          className={ativo ? "bg-primary/10 text-foreground" : "text-foreground-2"}
        >
          <Icone />
        </Button>
      </Ajuda>
      {/* O ponto diz "aqui"; o rótulo do botão já diz o quê. */}
      {situacao ? (
        <span aria-hidden="true" className="pointer-events-none absolute -top-0.5 right-0">
          <Estado tom={situacao.tom} soPonto>
            {situacao.palavra}
          </Estado>
        </span>
      ) : null}
    </li>
  )
}

export {
  ColunasDoEditor,
  ItemDaEstrutura,
  ItemDoTrilho,
  LARGURA_DA_COLUNA,
  LARGURA_DA_ESTRUTURA,
  LARGURA_DO_TRILHO,
  PISO_DO_CANVAS,
  VAO_DAS_COLUNAS,
  estruturaCabe,
  type ColunaDaDireita,
  type Situacao,
}
