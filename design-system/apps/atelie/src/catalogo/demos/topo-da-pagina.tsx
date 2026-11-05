"use client"

import * as React from "react"
import { MoreHorizontalIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChipDeEstado } from "@/components/ui/chip-de-estado"
import { Input } from "@/components/ui/input"
import { BarraDeModos } from "@/components/ui/seletor-de-vista"
import { PaginaDoApp, TopoDaPagina } from "@/components/ui/topo-da-pagina"
import { Trilha } from "@/components/ui/trilha"
import { ProvedorDeLink } from "@/lib/link-do-app"

import { Amostra, Amostras } from "./_amostra"
import { LinkDoPalco } from "./_tela"

const TRILHA = <Trilha degraus={[{ rotulo: "Pedidos", href: "/pedidos" }, { rotulo: "Pedido 1042" }]} />

const VALORES = (
  <>
    <Badge>Urgente</Badge>
    <Badge>Prioridade 1</Badge>
    <Badge>Retirada na loja</Badge>
    <Badge>Cliente recorrente</Badge>
  </>
)

const MENU = (
  <Button variant="ghost" size="icon" aria-label="Mais ações do pedido">
    <MoreHorizontalIcon />
  </Button>
)

type Recorte = "atrasados" | "sem-responsavel" | "bloqueados" | "com-outra-equipe"

const RECORTES = [
  { chave: "atrasados", rotulo: "Atrasados", numero: 4, tom: "espera" as const },
  { chave: "sem-responsavel", rotulo: "Sem responsável", numero: 2, tom: "espera" as const },
  { chave: "bloqueados", rotulo: "Bloqueados", numero: 0, tom: "ruim" as const },
  { chave: "com-outra-equipe", rotulo: "Com outra equipe", numero: 3, tom: "alheio" as const },
] satisfies ReadonlyArray<{ chave: Recorte; rotulo: string; numero: number | null; tom: "espera" | "ruim" | "alheio" }>

const ZERADOS = RECORTES.map((r) => ({ ...r, numero: 0 }))
const CONTANDO = RECORTES.map((r) => ({ ...r, numero: null }))

const FILAS = [
  { chave: "abertos", rotulo: "Abertos", numero: 12 },
  { chave: "concluidos", rotulo: "Concluídos", numero: 40 },
]

/** Os filtros da Lista: a fila em `abas` e a busca. */
function FiltrosDaLista() {
  const [fila, setFila] = React.useState("abertos")
  return (
    <>
      <BarraDeModos rotulo="Fila" densidade="abas" modos={FILAS} valor={fila} onTrocar={setFila} />
      <Input aria-label="Buscar pedidos" placeholder="Buscar pedidos" className="max-w-60" />
    </>
  )
}

function TopoDaLista({
  recortes = RECORTES,
  valorInicial = null,
  semResumo = false,
}: {
  recortes?: ReadonlyArray<{ chave: Recorte; rotulo: string; numero: number | null; tom: "espera" | "ruim" | "alheio" }>
  valorInicial?: Recorte | null
  semResumo?: boolean
}) {
  const [recorte, setRecorte] = React.useState<Recorte | null>(valorInicial)
  return (
    <PaginaDoApp className="px-0 pt-0 pb-0">
      <TopoDaPagina<Recorte>
        titulo="Pedidos"
        primario={<Button size="lg">Novo pedido</Button>}
        filtros={<FiltrosDaLista />}
        resumo={semResumo ? null : { rotulo: "Pedem atenção", recortes, valor: recorte, onTrocar: setRecorte }}
      />
    </PaginaDoApp>
  )
}

export default function DemoDoTopo() {
  return (
    <ProvedorDeLink componente={LinkDoPalco}>
      <Amostras>
        <Amostra titulo="O estado na linha do título, os valores na de baixo" primeira>
          <PaginaDoApp className="px-0 pt-0 pb-0">
            <TopoDaPagina
              trilha={TRILHA}
              titulo="Pedido 1042"
              estado={<ChipDeEstado tom="espera">Aguarda você</ChipDeEstado>}
              valores={VALORES}
              secundarias={<Button variant="secondary">Imprimir</Button>}
              primario={<Button size="lg">Conferir os itens</Button>}
              menu={MENU}
              desfecho={{ tom: "ok", texto: "Etiqueta gerada." }}
            />
          </PaginaDoApp>
        </Amostra>
        <Amostra titulo="Estado neutro sobre os valores: o ponto diz que é estado">
          <PaginaDoApp className="px-0 pt-0 pb-0">
            <TopoDaPagina
              trilha={TRILHA}
              titulo="Pedido 1042"
              estado={<ChipDeEstado tom="neutro">Entrega em 40 dias</ChipDeEstado>}
              valores={VALORES}
              primario={<Button size="lg">Conferir os itens</Button>}
              menu={MENU}
            />
          </PaginaDoApp>
        </Amostra>
        <Amostra titulo="Os valores carregando: a espera já na altura final">
          <PaginaDoApp className="px-0 pt-0 pb-0">
            <TopoDaPagina
              trilha={TRILHA}
              titulo="Pedido 1042"
              estado={<ChipDeEstado tom="espera">Aguarda você</ChipDeEstado>}
              valores="carregando"
              primario={<Button size="lg">Conferir os itens</Button>}
              menu={MENU}
            />
          </PaginaDoApp>
        </Amostra>
        <Amostra titulo="Sem valores: a linha não existe">
          <PaginaDoApp className="px-0 pt-0 pb-0">
            <TopoDaPagina
              trilha={TRILHA}
              titulo="Pedido 1042"
              estado={<ChipDeEstado tom="ok">Entregue</ChipDeEstado>}
              primario={<Button size="lg">Abrir a nota</Button>}
              menu={MENU}
            />
          </PaginaDoApp>
        </Amostra>
        <Amostra titulo="Lista com recortes contados: abaixo dos filtros, um por vez, clicar de novo desliga">
          <TopoDaLista valorInicial="atrasados" />
        </Amostra>
        <Amostra titulo="Sem recorte: os números com voz, nenhum pressionado">
          <TopoDaLista />
        </Amostra>
        <Amostra titulo="O recorte ativo em zero continua ativo">
          <TopoDaLista valorInicial="bloqueados" />
        </Amostra>
        <Amostra titulo="Todos os recortes em zero: o número fica, sem voz">
          <TopoDaLista recortes={ZERADOS} />
        </Amostra>
        <Amostra titulo="Contando: o travessão numérico guarda a largura">
          <TopoDaLista recortes={CONTANDO} />
        </Amostra>
        <Amostra titulo="Sem recortes: a linha não existe">
          <TopoDaLista semResumo />
        </Amostra>
        <Amostra titulo="No estreito, a linha dos valores quebra e o título fica inteiro">
          <div className="w-full max-w-72">
            <TopoDaPagina
              titulo="Pedido 1042"
              estado={<ChipDeEstado tom="espera">Aguarda você</ChipDeEstado>}
              valores={VALORES}
              menu={MENU}
            />
          </div>
        </Amostra>
      </Amostras>
    </ProvedorDeLink>
  )
}
