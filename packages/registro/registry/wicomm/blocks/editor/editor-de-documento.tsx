"use client"

import * as React from "react"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CopyIcon,
  FileSignatureIcon,
  HistoryIcon,
  ListIcon,
  MonitorIcon,
  MoreHorizontalIcon,
  PanelTopIcon,
  PlusIcon,
  Redo2Icon,
  SmartphoneIcon,
  Trash2Icon,
  TypeIcon,
  Undo2Icon,
} from "lucide-react"

import { BarraDoEditor, GrupoDaBarra, GrupoDaPessoa } from "@/registry/wicomm/ui/barra-do-editor"
import { Button } from "@/registry/wicomm/ui/button"
import { Card } from "@/registry/wicomm/ui/card"
import { ChipDeEstado, ChipQueAbre } from "@/registry/wicomm/ui/chip-de-estado"
import { ColunasDoEditor, ItemDaEstrutura, ItemDoTrilho, type Situacao } from "@/registry/wicomm/ui/colunas-do-editor"
import { Dialog, DialogLateral } from "@/registry/wicomm/ui/dialog"
import { Dobra } from "@/registry/wicomm/ui/dobra"
import { Input } from "@/registry/wicomm/ui/input"
import { Label } from "@/registry/wicomm/ui/label"
import { ConteudoDoMenu, GatilhoDoMenu, GrupoDoMenu, ItemDoMenu, Menu } from "@/registry/wicomm/ui/menu"
import { Popover, PopoverAnchor, PopoverContent } from "@/registry/wicomm/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/registry/wicomm/ui/select"
import { BarraDeModos } from "@/registry/wicomm/ui/seletor-de-vista"
import { EsperaDaLista, Skeleton } from "@/registry/wicomm/ui/skeleton"
import { TelaDeErro } from "@/registry/wicomm/ui/tela-de-erro"
import { ToastProvider, useToast } from "@/registry/wicomm/ui/toast"
import { TooltipProvider, Ajuda } from "@/registry/wicomm/ui/tooltip"
import { Vazio } from "@/registry/wicomm/ui/vazio"
import { LinkDoApp, ProvedorDeLink } from "@/registry/wicomm/lib/link-do-app"
import { cn } from "@/registry/wicomm/lib/utils"
import {
  pendenciasDe,
  type Alinhamento,
  type CargaDoEditor,
  type Fundo,
  type SecaoDoDocumento,
  type TipoDeSecao,
} from "@/registry/wicomm/blocks/editor/dados-do-editor"

const ESPERA_DO_GESTO_MS = 900

const ICONE_DA_SECAO: Record<TipoDeSecao, React.ComponentType<{ className?: string }>> = {
  capa: PanelTopIcon,
  texto: TypeIcon,
  lista: ListIcon,
  assinatura: FileSignatureIcon,
}

type Conta = { nome: string; email: string; onSair: () => void }
type Publicacao = "parada" | "publicando" | "publicada" | "falhou"
type Campo = "titulo" | "subtitulo" | "alinhamento" | "fundo"

/**
 * A MOLDURA do Editor (ANATOMIA CASCO-01, ARQ-03): fora do casco, em tela
 * inteira. A tela não rola; a barra em cima e as colunas embaixo, a `gap-2`,
 * dentro de um respiro de `p-2`. Os provedores que as peças pedem (aviso, dica,
 * link) moram aqui, como no casco.
 */
function CascoDoEditor({ link, children }: { link?: React.ComponentType<any>; children: React.ReactNode }) {
  const conteudo = (
    <ToastProvider>
      <TooltipProvider>
        <div data-slot="casco-do-editor" className="flex h-screen flex-col gap-2 overflow-hidden bg-background p-2 text-foreground">
          {children}
        </div>
      </TooltipProvider>
    </ToastProvider>
  )
  return link ? <ProvedorDeLink componente={link}>{conteudo}</ProvedorDeLink> : conteudo
}

function plural(n: number, um: string, varios: string) {
  return `${n} ${n === 1 ? um : varios}`
}

/** O que o carimbo do rascunho diz, do mais urgente ao mais calmo (MSG-01: no item, enquanto vale). */
function CarimboDoRascunho({
  publicacao,
  mudancas,
  pendencias,
  aoAbrirPendencia,
}: {
  publicacao: Publicacao
  mudancas: number
  pendencias: number
  aoAbrirPendencia: () => void
}) {
  if (publicacao === "publicando")
    return (
      <ChipDeEstado tom="neutro" emCurso className="shrink-0">
        Publicando
      </ChipDeEstado>
    )
  if (pendencias > 0)
    return (
      <ChipQueAbre tom="espera" onAbrir={aoAbrirPendencia} className="shrink-0">
        {plural(pendencias, "pendência", "pendências")}
      </ChipQueAbre>
    )
  if (publicacao === "falhou")
    return <NaoPublicou />
  if (publicacao === "publicada" && mudancas === 0)
    return (
      <ChipDeEstado tom="ok" className="shrink-0">
        Publicado
      </ChipDeEstado>
    )
  return (
    <ChipDeEstado tom="neutro" className="shrink-0">
      {mudancas === 0 ? "Sem mudanças" : plural(mudancas, "mudança", "mudanças")}
    </ChipDeEstado>
  )
}

/** A falha da publicação: o clique abre o que fazer (PECA-01, MSG-01); a saída é o próprio Publicar (MSG-06). */
function NaoPublicou() {
  const [aberto, setAberto] = React.useState(false)
  const chip = React.useRef<HTMLButtonElement>(null)
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverAnchor asChild>
        <ChipQueAbre ref={chip} tom="ruim" aberto={aberto} onAbrir={() => setAberto((a) => !a)} className="shrink-0">
          Não publicou
        </ChipQueAbre>
      </PopoverAnchor>
      {/* Ancorado, sem gatilho: o foco volta ao carimbo à mão quando o detalhe fecha. */}
      <PopoverContent
        onCloseAutoFocus={(e) => {
          e.preventDefault()
          chip.current?.focus()
        }}
      >
        Não deu para publicar agora. As mudanças estão guardadas; tente publicar de novo em alguns minutos.</PopoverContent>
    </Popover>
  )
}

/** A seção na página do canvas: a selecionada sobe um degrau (SUP-01); o anel é só do foco. */
function SecaoNaPagina({ secao, selecionada, aoSelecionar }: { secao: SecaoDoDocumento; selecionada: boolean; aoSelecionar: () => void }) {
  const ref = React.useRef<HTMLElement>(null)
  React.useEffect(() => {
    if (!selecionada) return
    const reduzido = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ref.current?.scrollIntoView?.({ block: "nearest", behavior: reduzido ? "auto" : "smooth" })
  }, [selecionada])
  return (
    <section
      ref={ref}
      aria-label={secao.nome}
      data-selecionada={selecionada || undefined}
      data-superficie={selecionada || undefined}
      onClick={aoSelecionar}
      className={cn("group/secao cursor-pointer rounded-cartao", selecionada && "superficie-alta")}
    >
      {/* O fundo da seção mora por dentro: selecionada, ela sobe um degrau e continua mostrando o fundo que tem. */}
      <div
        className={cn(
          "flex flex-col gap-2 rounded-cartao px-8 py-8",
          secao.alinhamento === "centro" && "items-center text-center",
          secao.fundo === "tinta" ? "bg-accent" : !selecionada && "group-hover/secao:bg-accent/60"
        )}
      >
      {secao.titulo ? (
        <h2 className="t-titulo text-foreground">{secao.titulo}</h2>
      ) : (
        <p className="t-titulo text-muted-foreground">Sem título</p>
      )}
      {secao.subtitulo ? <p className="t-denso text-foreground-2">{secao.subtitulo}</p> : null}
      {secao.tipo === "lista" ? (
        <ul className="t-denso flex list-disc flex-col gap-1 pl-5 text-foreground-2">
          <li>Revisão do catálogo, até novembro</li>
          <li>Prazo de entrega em cinco dias úteis</li>
          <li>Um contato só para cada pedido</li>
        </ul>
      ) : null}
      {secao.tipo === "assinatura" ? (
        <div className="mt-4 grid grid-cols-2 gap-8">
          <p className="t-denso border-t border-border pt-2 text-foreground-2">Pela empresa</p>
          <p className="t-denso border-t border-border pt-2 text-foreground-2">Pelo cliente</p>
        </div>
      ) : null}
      </div>
    </section>
  )
}

function MenuDaSecao({
  secao,
  posicao,
  total,
  aoMover,
  aoDuplicar,
  aoExcluir,
}: {
  secao: SecaoDoDocumento
  posicao?: number
  total?: number
  aoMover?: (passo: -1 | 1) => void
  aoDuplicar: () => void
  aoExcluir: () => void
}) {
  return (
    <Menu>
      <GatilhoDoMenu asChild>
        <Button variant="ghost" size="icon" aria-label={`Mais ações da seção ${secao.nome}`}>
          <MoreHorizontalIcon aria-hidden="true" />
        </Button>
      </GatilhoDoMenu>
      <ConteudoDoMenu>
        {aoMover && posicao !== undefined && total !== undefined ? (
          <GrupoDoMenu>
            <ItemDoMenu icone={ArrowUpIcon} bloqueado={posicao === 0 ? "Já é a primeira" : undefined} onEscolher={() => aoMover(-1)}>
              Mover para cima
            </ItemDoMenu>
            <ItemDoMenu icone={ArrowDownIcon} bloqueado={posicao === total - 1 ? "Já é a última" : undefined} onEscolher={() => aoMover(1)}>
              Mover para baixo
            </ItemDoMenu>
          </GrupoDoMenu>
        ) : null}
        <GrupoDoMenu>
          <ItemDoMenu icone={CopyIcon} onEscolher={aoDuplicar}>
            Duplicar seção
          </ItemDoMenu>
        </GrupoDoMenu>
        <GrupoDoMenu>
          <ItemDoMenu
            icone={Trash2Icon}
            destrutivo
            confirmacao={{ titulo: `Excluir a seção ${secao.nome}?`, descricao: "Ela sai do documento. Dá para desfazer enquanto o editor estiver aberto.", confirmar: "Excluir" }}
            onEscolher={aoExcluir}
          >
            Excluir seção
          </ItemDoMenu>
        </GrupoDoMenu>
      </ConteudoDoMenu>
    </Menu>
  )
}

/** Os campos da seção, em duas dobras: o conteúdo aberto, a aparência fechada. */
function Inspector({
  secao,
  conteudoAberto,
  aoAbrirConteudo,
  tituloRef,
  aoMudar,
}: {
  secao: SecaoDoDocumento
  conteudoAberto: boolean
  aoAbrirConteudo: (aberta: boolean) => void
  tituloRef: React.RefObject<HTMLInputElement | null>
  aoMudar: (campo: Campo, valor: string) => void
}) {
  const id = React.useId()
  const semTitulo = secao.titulo.trim() === ""
  return (
    <div className="flex flex-col gap-1">
      <Dobra rotulo="Conteúdo" aberta={conteudoAberto} aoMudar={aoAbrirConteudo}>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-titulo`}>Título</Label>
          <Input
            ref={tituloRef}
            id={`${id}-titulo`}
            value={secao.titulo}
            aria-invalid={semTitulo || undefined}
            aria-describedby={semTitulo ? `${id}-titulo-erro` : undefined}
            onChange={(e) => aoMudar("titulo", e.target.value)}
          />
          {semTitulo ? (
            <p id={`${id}-titulo-erro`} className="t-denso text-destructive">
              Escreva o título da seção {secao.nome}.
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-subtitulo`}>Subtítulo</Label>
          <Input id={`${id}-subtitulo`} value={secao.subtitulo} onChange={(e) => aoMudar("subtitulo", e.target.value)} />
        </div>
      </Dobra>
      <Dobra rotulo="Aparência">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-alinhamento`}>Alinhamento</Label>
          <Select value={secao.alinhamento} onValueChange={(v) => aoMudar("alinhamento", v as Alinhamento)}>
            <SelectTrigger id={`${id}-alinhamento`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="esquerda">À esquerda</SelectItem>
              <SelectItem value="centro">Ao centro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-fundo`}>Fundo</Label>
          <Select value={secao.fundo} onValueChange={(v) => aoMudar("fundo", v as Fundo)}>
            <SelectTrigger id={`${id}-fundo`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="liso">Liso</SelectItem>
              <SelectItem value="tinta">Com tinta</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Dobra>
    </div>
  )
}

/**
 * O EDITOR de um documento (ANATOMIA ARQ-01, ARQ-03): *como fica se eu mudar
 * isto?* A barra com a volta, o nome, o rascunho e o Publicar; a estrutura das
 * seções, o canvas com a página, e o inspector da seção selecionada.
 *
 * Recebe a carga por props; os gestos (editar, desfazer, mover, publicar)
 * mudam o rascunho aqui. O projeto liga `aoPublicar` à própria publicação.
 */
function EditorDeDocumento({
  carga,
  conta,
  hrefDosDocumentos = "/documentos",
  aoPublicar,
}: {
  carga: CargaDoEditor
  conta: Conta
  hrefDosDocumentos?: string
  /** Publica o rascunho; `false` quando não deu. Sem ela, o exemplo publica sozinho. */
  aoPublicar?: () => Promise<boolean>
}) {
  const { momento, documento } = carga
  const avisar = useToast()
  const voltar = { href: hrefDosDocumentos, rotulo: "Voltar aos documentos" }

  // O rascunho e o caminho de volta dele: cada mudança de campo é um passo; digitar no mesmo campo continua o passo.
  const [passos, setPassos] = React.useState<SecaoDoDocumento[][]>([carga.secoes])
  const [atual, setAtual] = React.useState(0)
  const ultimoCampo = React.useRef<string | null>(null)
  const secoes = passos[atual] ?? []
  // As mudanças sobre o que está no ar: as da carga mais os passos dados aqui. Publicar zera a base.
  const [base, setBase] = React.useState(carga.mudancas)
  const mudancas = base + atual

  const [selecionada, setSelecionada] = React.useState<string | null>(carga.selecionada)
  const [direitaAberta, setDireitaAberta] = React.useState(carga.selecionada !== null)
  const [estruturaPedida, setEstruturaPedida] = React.useState(true)
  const [vista, setVista] = React.useState<"computador" | "celular">("computador")
  const [conteudoAberto, setConteudoAberto] = React.useState(true)
  const [historico, setHistorico] = React.useState(false)
  const tituloRef = React.useRef<HTMLInputElement>(null)

  const inicial: Publicacao = momento === "andando" ? "publicando" : momento === "erro" ? "falhou" : momento === "sucesso" ? "publicada" : "parada"
  const [publicacao, setPublicacao] = React.useState<Publicacao>(inicial)
  const relogio = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  React.useEffect(() => () => void (relogio.current && clearTimeout(relogio.current)), [])
  // Chegar "publicando" quer dizer que a publicação já anda: ela termina sozinha (sobrevive ao F5).
  React.useEffect(() => {
    if (inicial !== "publicando") return
    relogio.current = setTimeout(() => {
      setBase(0)
      setPublicacao("publicada")
    }, ESPERA_DO_GESTO_MS * 2)
  }, [inicial])

  const pendencias = pendenciasDe(secoes)

  const registrar = (proximas: SecaoDoDocumento[], campo: string | null) => {
    const continua = campo !== null && campo === ultimoCampo.current
    ultimoCampo.current = campo
    setPassos((p) => (continua ? [...p.slice(0, atual), proximas] : [...p.slice(0, atual + 1), proximas]))
    if (!continua) setAtual((a) => a + 1)
    if (publicacao !== "publicando") setPublicacao("parada")
  }
  const mudarCampo = (id: string, campo: Campo, valor: string) =>
    registrar(
      secoes.map((s) => (s.id === id ? { ...s, [campo]: valor } : s)),
      `${id}:${campo}`
    )
  const desfazer = () => {
    ultimoCampo.current = null
    setAtual((a) => Math.max(0, a - 1))
  }
  const refazer = () => {
    ultimoCampo.current = null
    setAtual((a) => Math.min(passos.length - 1, a + 1))
  }

  const selecionar = (id: string) => {
    setSelecionada(id)
    setDireitaAberta(true)
  }
  const abrirPendencia = () => {
    const primeira = pendencias[0]
    if (!primeira) return
    selecionar(primeira.id)
    setConteudoAberto(true)
    // O campo monta depois da seleção: o foco vai a ele no quadro seguinte.
    requestAnimationFrame(() => tituloRef.current?.focus())
  }
  const mover = (id: string, passo: -1 | 1) => {
    const i = secoes.findIndex((s) => s.id === id)
    const j = i + passo
    if (i < 0 || j < 0 || j >= secoes.length) return
    const proximas = [...secoes]
    const [s] = proximas.splice(i, 1)
    proximas.splice(j, 0, s!)
    registrar(proximas, null)
  }
  const duplicar = (id: string) => {
    const i = secoes.findIndex((s) => s.id === id)
    const original = secoes[i]
    if (!original) return
    const copia = { ...original, id: `${original.id}-${Date.now()}`, nome: `${original.nome} (cópia)` }
    registrar([...secoes.slice(0, i + 1), copia, ...secoes.slice(i + 1)], null)
    selecionar(copia.id)
  }
  const excluir = (id: string) => {
    registrar(
      secoes.filter((s) => s.id !== id),
      null
    )
    if (selecionada === id) {
      setSelecionada(null)
      setDireitaAberta(false)
    }
  }
  const adicionar = () => {
    const nova: SecaoDoDocumento = { id: `secao-${Date.now()}`, tipo: "texto", nome: "Nova seção", titulo: "Nova seção", subtitulo: "", alinhamento: "esquerda", fundo: "liso" }
    registrar([...secoes, nova], null)
    selecionar(nova.id)
  }

  const publicar = async () => {
    if (pendencias.length > 0) {
      abrirPendencia()
      return
    }
    // O que vai ao ar é o passo de agora; o que se editar enquanto publica continua como mudança.
    const publicado = atual
    ultimoCampo.current = null
    setPublicacao("publicando")
    let deu = false
    try {
      deu = aoPublicar ? await aoPublicar() : await new Promise<boolean>((ok) => (relogio.current = setTimeout(() => ok(true), ESPERA_DO_GESTO_MS)))
    } catch {
      // A rede que cai é "não publicou", não um Editor travado em "Publicando".
      deu = false
    }
    if (!deu) {
      setPublicacao("falhou")
      return
    }
    // O que está no ar passa a ser este rascunho: as mudanças zeram, e desfazer não volta para antes dele.
    setPassos((p) => p.slice(publicado))
    setAtual((a) => a - publicado)
    setBase(0)
    setPublicacao("publicada")
  }

  if (momento === "sem-permissao")
    return (
      <div className="grid h-full place-items-center">
        <TelaDeErro
          escala="rota"
          tipo="sem-permissao"
          titulo={documento.nome}
          saida={
            <Button asChild variant="outline">
              <LinkDoApp href={hrefDosDocumentos}>Voltar aos documentos</LinkDoApp>
            </Button>
          }
        >
          Esta conta pode ler o documento, mas não editar. Peça acesso a quem administra.
        </TelaDeErro>
      </div>
    )

  const carregando = momento === "carregando"
  const naoCarregou = momento === "erro-de-carga"
  const tentarDeNovo = () => window.location.reload()
  const secaoAberta = secoes.find((s) => s.id === selecionada) ?? null
  const situacaoDe = (s: SecaoDoDocumento): Situacao | undefined => (s.titulo.trim() === "" ? { tom: "espera", palavra: "com pendência" } : undefined)
  const temMudancas = mudancas > 0 || publicacao === "falhou" || publicacao === "publicando"

  const barra = (
    <BarraDoEditor
      voltar={voltar}
      // Enquanto o documento não chegou, o título é o nome do tipo: nunca vazio (TIPO-04).
      nome={carregando || naoCarregou ? "Documento" : documento.nome.trim() || "Documento sem nome"}
      ondeEstou={
        naoCarregou ? null : <>
          {carregando ? (
            <Skeleton className="h-5 w-24 shrink-0 rounded-md" />
          ) : (
            <CarimboDoRascunho publicacao={publicacao} mudancas={mudancas} pendencias={pendencias.length} aoAbrirPendencia={abrirPendencia} />
          )}
          <GrupoDaBarra>
            <Ajuda texto="Desfazer">
              <Button variant="ghost" size="icon" aria-label="Desfazer" disabled={atual === 0 || publicacao === "publicando"} onClick={desfazer}>
                <Undo2Icon aria-hidden="true" />
              </Button>
            </Ajuda>
            <Ajuda texto="Refazer">
              <Button variant="ghost" size="icon" aria-label="Refazer" disabled={atual >= passos.length - 1 || publicacao === "publicando"} onClick={refazer}>
                <Redo2Icon aria-hidden="true" />
              </Button>
            </Ajuda>
          </GrupoDaBarra>
        </>
      }
      vista={
        <BarraDeModos
          rotulo="Vista"
          densidade="modos"
          modos={[
            { chave: "computador", rotulo: "Computador", icone: MonitorIcon },
            { chave: "celular", rotulo: "Celular", icone: SmartphoneIcon },
          ]}
          valor={vista}
          onTrocar={(v) => setVista(v as "computador" | "celular")}
        />
      }
      acoes={
        <>
          {/* Sem mudanças, não há o que publicar: o botão não é desenhado (PESO-03). */}
          {!carregando && !naoCarregou && temMudancas ? (
            <Button onClick={publicar} disabled={publicacao === "publicando"}>
              {publicacao === "publicando" ? "Publicando" : "Publicar"}
            </Button>
          ) : null}
          <GrupoDaBarra>
            <Menu>
              <GatilhoDoMenu asChild>
                <Button variant="ghost" size="icon" aria-label="Mais ações do documento">
                  <MoreHorizontalIcon aria-hidden="true" />
                </Button>
              </GatilhoDoMenu>
              <ConteudoDoMenu>
                <GrupoDoMenu>
                  <ItemDoMenu icone={CopyIcon} onEscolher={() => avisar({ tom: "neutro", titulo: "Duplicar o documento não faz parte deste exemplo." })}>
                    Duplicar documento
                  </ItemDoMenu>
                  <ItemDoMenu icone={HistoryIcon} onEscolher={() => setHistorico(true)}>
                    Ver histórico
                  </ItemDoMenu>
                </GrupoDoMenu>
                <GrupoDoMenu>
                  <ItemDoMenu
                    icone={Trash2Icon}
                    destrutivo
                    confirmacao={{ titulo: "Excluir o documento?", descricao: "Ele sai da lista de documentos e não volta.", confirmar: "Excluir" }}
                    onEscolher={() => avisar({ tom: "neutro", titulo: "Excluir o documento não faz parte deste exemplo." })}
                  >
                    Excluir documento
                  </ItemDoMenu>
                </GrupoDoMenu>
              </ConteudoDoMenu>
            </Menu>
            <GrupoDaPessoa conta={conta} />
          </GrupoDaBarra>
        </>
      }
    />
  )

  const adicionarSecao = (
    <Button variant="ghost" size="sm" onClick={adicionar} disabled={carregando}>
      <PlusIcon aria-hidden="true" />
      Adicionar seção
    </Button>
  )

  const estrutura = naoCarregou ? (
    <li>
      <TelaDeErro escala="bloco" onTentarDeNovo={tentarDeNovo}>
        Não deu para carregar as seções.
      </TelaDeErro>
    </li>
  ) : carregando ? (
    <li>
      <EsperaDaLista linhas={4} alturaDaLinha="h-8" rotulo="As seções do documento" />
    </li>
  ) : secoes.length === 0 ? (
    <li>
      <Vazio causa="nada-ainda" icone={PanelTopIcon} titulo="Nenhuma seção ainda" className="px-2 py-8" acao={adicionarSecao}>
        Comece pela primeira seção do documento.
      </Vazio>
    </li>
  ) : (
    secoes.map((s, i) => (
      <ItemDaEstrutura
        key={s.id}
        icone={ICONE_DA_SECAO[s.tipo]}
        nome={s.nome}
        ativo={s.id === selecionada}
        situacao={situacaoDe(s)}
        onSelecionar={() => selecionar(s.id)}
        menu={
          <MenuDaSecao
            secao={s}
            posicao={i}
            total={secoes.length}
            aoMover={(passo) => mover(s.id, passo)}
            aoDuplicar={() => duplicar(s.id)}
            aoExcluir={() => excluir(s.id)}
          />
        }
      />
    ))
  )

  // Na espera, o trilho já tem a forma do pronto: a página não anda quando a carga chega.
  const trilho = naoCarregou
    ? null
    : carregando
      ? Array.from({ length: 4 }, (_, i) => (
          <li key={i}>
            <Skeleton className="size-ctrl rounded-ctrl" />
          </li>
        ))
      : secoes.map((s) => (
        <ItemDoTrilho
          key={s.id}
          icone={ICONE_DA_SECAO[s.tipo]}
          nome={s.nome}
          ativo={s.id === selecionada}
          situacao={situacaoDe(s)}
          onSelecionar={() => selecionar(s.id)}
        />
      ))

  const canvas = (
    <div className="h-full overflow-y-auto p-6">
      {naoCarregou ? (
        <div className="mx-auto max-w-3xl pt-16">
          <TelaDeErro escala="bloco" onTentarDeNovo={tentarDeNovo}>
            Não deu para carregar o documento.
          </TelaDeErro>
        </div>
      ) : carregando ? (
        <div role="status" aria-busy="true" className="mx-auto flex max-w-3xl flex-col gap-4">
          <span className="sr-only">A página do documento</span>
          <Skeleton className="h-40 rounded-cartao" />
          <Skeleton className="h-28 rounded-cartao" />
          <Skeleton className="h-28 rounded-cartao" />
        </div>
      ) : secoes.length === 0 ? (
        <div className="mx-auto flex h-64 max-w-3xl items-center justify-center rounded-cartao border border-dashed border-border px-6 text-center">
          <p className="t-denso text-foreground-2">A página aparece aqui quando houver uma seção.</p>
        </div>
      ) : (
        <Card className={cn("mx-auto flex flex-col gap-1 p-3", vista === "celular" ? "max-w-sm" : "max-w-3xl")}>
          {secoes.map((s) => (
            <SecaoNaPagina key={s.id} secao={s} selecionada={s.id === selecionada} aoSelecionar={() => selecionar(s.id)} />
          ))}
        </Card>
      )}
    </div>
  )

  return (
    <>
      {barra}
      <ColunasDoEditor
        tituloDaEstrutura="Estrutura"
        acaoDaEstrutura={secoes.length > 0 ? adicionarSecao : null}
        estrutura={estrutura}
        trilho={trilho}
        estruturaPedida={estruturaPedida}
        onPedirEstrutura={setEstruturaPedida}
        canvas={canvas}
        direita={{
          titulo: carregando ? "Seção" : (secaoAberta?.nome ?? "Seção"),
          acoes: !carregando && secaoAberta ? (
            <MenuDaSecao secao={secaoAberta} aoDuplicar={() => duplicar(secaoAberta.id)} aoExcluir={() => excluir(secaoAberta.id)} />
          ) : null,
          aberta: !naoCarregou && direitaAberta && (carregando || secaoAberta !== null),
          conteudo: carregando ? (
            <div role="status" aria-busy="true" className="flex flex-col gap-4 pt-2">
              <span className="sr-only">Os campos da seção</span>
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-ctrl rounded-ctrl" />
              ))}
            </div>
          ) : secaoAberta ? (
            <Inspector
              key={secaoAberta.id}
              secao={secaoAberta}
              conteudoAberto={conteudoAberto}
              aoAbrirConteudo={setConteudoAberto}
              tituloRef={tituloRef}
              aoMudar={(campo, valor) => mudarCampo(secaoAberta.id, campo, valor)}
            />
          ) : null,
          onFechar: () => setDireitaAberta(false),
          onDarLugar: () => setDireitaAberta(false),
        }}
      />
      <Dialog open={historico} onOpenChange={setHistorico}>
        <DialogLateral titulo="Histórico">
          <ol className="t-denso flex flex-col gap-3 text-foreground-2">
            <li>Publicado por Ana Souza, 28/10/2026, 14:20</li>
            <li>Publicado por Bruno Lima, 21/10/2026, 09:05</li>
            <li>Criado por Ana Souza, 14/10/2026, 16:48</li>
          </ol>
        </DialogLateral>
      </Dialog>
    </>
  )
}

export { CascoDoEditor, EditorDeDocumento }
