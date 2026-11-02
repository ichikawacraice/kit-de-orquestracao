"use client"

import * as React from "react"
import { ClipboardListIcon, PlusIcon, SearchXIcon } from "lucide-react"

import { Button } from "@/registry/design-system/ui/button"
import { ChipDeEstado } from "@/registry/design-system/ui/chip-de-estado"
import { Input } from "@/registry/design-system/ui/input"
import { Painel, RolagemDoPainel } from "@/registry/design-system/ui/painel"
import { BarraDeModos } from "@/registry/design-system/ui/seletor-de-vista"
import { EsperaDaLista } from "@/registry/design-system/ui/skeleton"
import { LinkDaLinha, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/registry/design-system/ui/table"
import { TelaDeErro } from "@/registry/design-system/ui/tela-de-erro"
import { useToast } from "@/registry/design-system/ui/toast"
import { LinkDoApp } from "@/registry/design-system/lib/link-do-app"
import { PaginaDoApp, TopoDaPagina } from "@/registry/design-system/ui/topo-da-pagina"
import { Vazio } from "@/registry/design-system/ui/vazio"
import { DA_SITUACAO, MODOS, type CargaDaLista, type Modo, type Pedido } from "@/registry/design-system/blocks/lista/dados-da-lista"

/** O modo aberto mora no endereço (CONV-06): o F5 e o link copiado abrem a mesma fila. */
function gravarModoNoEndereco(modo: Modo) {
  const url = new URL(window.location.href)
  url.searchParams.set("modo", modo)
  window.history.replaceState(window.history.state, "", url)
}

/**
 * As colunas têm largura fixa, e a soma é 100% nos dois desenhos — com e sem a
 * coluna Situação: quem alterna entre filas não perde o lugar do olho.
 */
const LARGURAS = {
  comSituacao: { pedido: "w-[32%]", situacao: "w-[18%]", etapa: "w-[20%]", valor: "w-[15%]", atualizado: "w-[15%]" },
  semSituacao: { pedido: "w-[40%]", situacao: "", etapa: "w-[30%]", valor: "w-[15%]", atualizado: "w-[15%]" },
} as const

function CabecaDaTabela({ comSituacao }: { comSituacao: boolean }) {
  const l = LARGURAS[comSituacao ? "comSituacao" : "semSituacao"]
  return (
    <TableHeader>
      <TableRow>
        <TableHead className={l.pedido}>Pedido</TableHead>
        {comSituacao ? <TableHead className={l.situacao}>Situação</TableHead> : null}
        <TableHead className={l.etapa}>Etapa</TableHead>
        <TableHead medida className={l.valor}>
          Valor
        </TableHead>
        <TableHead className={l.atualizado}>Atualizado</TableHead>
      </TableRow>
    </TableHeader>
  )
}

/**
 * Na fila de um modo, a coluna Situação não existe: 14 chips iguais ao modo não
 * geram decisão (PRIN-04). O que a situação diz e o modo não diz — a falha
 * dentro de Andando — vai como chip ao lado da etapa. Na busca, que cruza os
 * modos, a coluna volta.
 */
function LinhaDoPedido({ pedido, comSituacao, vozDoModo }: { pedido: Pedido; comSituacao: boolean; vozDoModo: string | null }) {
  const s = DA_SITUACAO[pedido.situacao]
  const excecao = !comSituacao && vozDoModo !== null && s.tom !== vozDoModo
  return (
    <TableRow>
      <TableCell>
        <LinkDaLinha href={`/pedidos/${pedido.numero}`} className="flex items-baseline gap-2">
          <span className="t-medida text-foreground">{pedido.numero}</span>
          <span className="truncate text-foreground-2">{pedido.cliente}</span>
        </LinkDaLinha>
      </TableCell>
      {comSituacao ? (
        <TableCell>
          <ChipDeEstado tom={s.tom} emCurso={s.emCurso}>
            {s.palavra}
          </ChipDeEstado>
        </TableCell>
      ) : null}
      <TableCell className="text-foreground-2">
        <span className="flex items-center gap-2">
          {s.emCurso && !comSituacao ? `${pedido.etapa} · ${s.palavra.toLowerCase()}` : pedido.etapa}
          {excecao ? <ChipDeEstado tom={s.tom}>{s.palavra}</ChipDeEstado> : null}
        </span>
      </TableCell>
      <TableCell medida>{pedido.valor}</TableCell>
      <TableCell className="text-foreground-2">{pedido.atualizado}</TableCell>
    </TableRow>
  )
}

/**
 * O arquétipo LISTA (ANATOMIA ARQ-01): *o que pede a minha atenção?* — topo
 * (título, filtro global, primário), a lista numa superfície, e o vazio que diz
 * a causa. EXEMPLO com pedidos: o projeto troca os dados e as colunas, e mantém
 * as regiões.
 *
 * - Os modos mostram TODOS os contadores, o zero inclusive (EST-04); enquanto
 *   carrega, `—` (não contado).
 * - A linha inteira abre o pedido; o número vem em mono (TIPO-03).
 * - O topo fica parado e quem rola é o painel (LAY-01).
 * - A carga entra por prop: o bloco não busca nada.
 */
function ListaDePedidos({ carga, modoInicial = "pedem-voce" }: { carga: CargaDaLista; modoInicial?: Modo }) {
  const [modo, setModo] = React.useState<Modo>(modoInicial)
  const [busca, setBusca] = React.useState("")
  const avisar = useToast()

  const pedidos = carga.tipo === "pronto" ? carga.pedidos : []
  const termo = busca.trim().toLowerCase()
  const doModo = MODOS.find((m) => m.chave === modo) ?? MODOS[0]!
  const visiveis = termo
    ? pedidos.filter((p) => p.numero.includes(termo) || p.cliente.toLowerCase().includes(termo))
    : pedidos.filter((p) => doModo.situacoes.includes(p.situacao))

  const trocarModo = (m: Modo) => {
    setModo(m)
    setBusca("")
    gravarModoNoEndereco(m)
  }

  if (carga.tipo === "sem-permissao") {
    return (
      <PaginaDoApp>
        <TelaDeErro
          escala="rota"
          tipo="sem-permissao"
          titulo="Pedidos"
          saida={
            <Button asChild variant="outline">
              <LinkDoApp href="/">Voltar ao início</LinkDoApp>
            </Button>
          }
        >
          Sua conta não tem acesso aos pedidos. Fale com quem administra o app.
        </TelaDeErro>
      </PaginaDoApp>
    )
  }

  const contado = carga.tipo === "pronto"
  const outroModo = MODOS.find((m) => m.chave !== modo && pedidos.some((p) => m.situacoes.includes(p.situacao)))

  let corpo: React.ReactNode
  if (carga.tipo === "carregando") {
    // A espera tem a forma do pronto: a cabeça da tabela já aparece, e as linhas vêm na altura delas.
    corpo = (
      <>
        <Table className="table-fixed">
          <CabecaDaTabela comSituacao={false} />
        </Table>
        <EsperaDaLista linhas={8} alturaDaLinha="h-8" rotulo="Carregando os pedidos" className="gap-2 px-3 pt-1" />
      </>
    )
  } else if (carga.tipo === "erro") {
    corpo = (
      <TelaDeErro escala="bloco" onTentarDeNovo={() => window.location.reload()}>
        Não deu para carregar os pedidos.
      </TelaDeErro>
    )
  } else if (pedidos.length === 0) {
    corpo = (
      <Vazio causa="nada-ainda" icone={ClipboardListIcon} titulo="Nenhum pedido ainda">
        Os pedidos aparecem aqui assim que chegarem.
      </Vazio>
    )
  } else if (visiveis.length === 0 && termo) {
    corpo = (
      <Vazio
        causa="filtro"
        icone={SearchXIcon}
        titulo={`Nenhum pedido com “${busca.trim()}”`}
        acao={
          <Button variant="outline" size="sm" onClick={() => setBusca("")}>
            Limpar a busca
          </Button>
        }
      />
    )
  } else if (visiveis.length === 0) {
    corpo = (
      <Vazio
        causa="filtro"
        icone={ClipboardListIcon}
        titulo={`Nada em “${doModo.rotulo}” agora`}
        acao={
          outroModo ? (
            <Button variant="outline" size="sm" onClick={() => trocarModo(outroModo.chave)}>
              Ver {outroModo.rotulo.toLowerCase()}
            </Button>
          ) : undefined
        }
      >
        {outroModo ? `Há pedidos em “${outroModo.rotulo}”.` : null}
      </Vazio>
    )
  } else {
    const vozDoModo = termo ? null : doModo.tom
    const comSituacao = vozDoModo === null
    corpo = (
      <Table className="table-fixed">
        <CabecaDaTabela comSituacao={comSituacao} />
        <TableBody>
          {visiveis.map((p) => (
            <LinhaDoPedido key={p.numero} pedido={p} vozDoModo={vozDoModo} comSituacao={comSituacao} />
          ))}
        </TableBody>
      </Table>
    )
  }

  return (
    <PaginaDoApp>
      <TopoDaPagina
        titulo="Pedidos"
        primario={
          <Button
            size="lg"
            onClick={() => avisar({ tom: "neutro", titulo: "O formulário de pedido não faz parte deste exemplo." })}
          >
            <PlusIcon aria-hidden="true" />
            Novo pedido
          </Button>
        }
        filtros={
          <>
            <BarraDeModos
              rotulo="Fila"
              densidade="abas"
              valor={termo ? null : modo}
              onTrocar={trocarModo}
              modos={MODOS.map((m) => ({
                chave: m.chave,
                rotulo: m.rotulo,
                tom: m.tom,
                numero: contado ? pedidos.filter((p) => m.situacoes.includes(p.situacao)).length : null,
              }))}
            />
            <Input
              type="search"
              aria-label="Buscar por número ou cliente"
              placeholder="Buscar por número ou cliente"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              disabled={!contado}
              className="ml-auto w-64"
            />
          </>
        }
      />
      <Painel aria-label="Pedidos" className="flex-1">
        <RolagemDoPainel densidade="solta" className="px-1">
          {corpo}
        </RolagemDoPainel>
      </Painel>
    </PaginaDoApp>
  )
}

export { ListaDePedidos }
