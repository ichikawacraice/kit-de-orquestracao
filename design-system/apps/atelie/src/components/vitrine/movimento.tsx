"use client"

import * as React from "react"
import Link from "next/link"
import { PlayIcon } from "lucide-react"

import { Bloco } from "@/components/ui/bloco"
import { Button } from "@/components/ui/button"
import { BarraDeModos } from "@/components/ui/seletor-de-vista"
import { useParametroDoEndereco } from "@/components/vitrine/endereco"
import { PaginaDaVitrine } from "@/components/vitrine/pagina"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

/**
 * As classes de cada token, escritas por extenso: o Tailwind só gera a classe
 * que lê no código. O teste da vitrine cobra que as chaves são as do tokens.json.
 */
export const CLASSE_DA_DURACAO: Record<string, string> = {
  "modal-abre": "duration-modal-abre",
  "modal-fecha": "duration-modal-fecha",
  "menu-abre": "duration-menu-abre",
  "menu-fecha": "duration-menu-fecha",
  dica: "duration-dica",
  painel: "duration-painel",
  "dobra-abre": "duration-dobra-abre",
  "dobra-fecha": "duration-dobra-fecha",
  cor: "duration-cor",
  revela: "duration-revela",
}

export const CLASSE_DO_ATRASO: Record<string, string> = {
  veu: "delay-veu",
  "espiada-abre": "delay-espiada-abre",
  "espiada-fecha": "delay-espiada-fecha",
}

export const CLASSE_DA_CURVA: Record<string, string> = { abre: "ease-abre", fecha: "ease-fecha" }

export const CLASSE_DA_ANIMACAO: Record<string, string> = {
  "accordion-down": "animate-accordion-down motion-reduce:animate-none",
  "accordion-up": "animate-accordion-up motion-reduce:animate-none",
}

/** Onde a base diz que cada token vale, e quem do kit o usa. */
const USO: Record<string, { onde: string; pecas: string[] }> = {
  "modal-abre": { onde: "O diálogo entra, de 0,97 a 1", pecas: ["dialog", "confirm-dialog"] },
  "modal-fecha": { onde: "O diálogo sai", pecas: ["dialog", "confirm-dialog"] },
  "menu-abre": { onde: "Menu e popover entram, de 0,98 a 1", pecas: ["menu", "popover", "select"] },
  "menu-fecha": { onde: "Menu e popover saem", pecas: ["menu", "popover", "select"] },
  dica: { onde: "A dica aparece", pecas: ["tooltip", "dica-de-ajuda"] },
  painel: { onde: "A barra recolhe; uma etapa sai enquanto a outra entra", pecas: ["casco", "seletor-de-vista"] },
  "dobra-abre": { onde: "A dobra abre", pecas: ["dobra", "bloco"] },
  "dobra-fecha": { onde: "A dobra fecha", pecas: [] },
  cor: { onde: "Mudança de estado: só a cor troca", pecas: ["button", "card", "menu"] },
  revela: { onde: "O que aparece no hover ou no foco", pecas: [] },
  veu: { onde: "O véu de carregamento só aparece depois disto", pecas: [] },
  "espiada-abre": { onde: "Abrir ao passar o mouse espera isto", pecas: [] },
  "espiada-fecha": { onde: "Sair do alvo tolera isto antes de fechar", pecas: [] },
}

type Dados = {
  duracoes: Record<string, string>
  atrasos: Record<string, string>
  curvas: Record<string, string>
  animacoes: Record<string, string>
}

const RodadaContexto = React.createContext({ rodada: 0, reduzido: false })

/** Uma vez por clique, sem laço: o que entra no `tocar` volta ao começo sem animar e anda. */
function useTocar(fimDoTempo: number) {
  const { rodada } = React.useContext(RodadaContexto)
  const [fase, setFase] = React.useState<"parado" | "voltando" | "fim">("parado")
  const [tocando, setTocando] = React.useState(false)
  const tocar = React.useCallback(() => {
    setFase("voltando")
    setTocando(true)
    // O começo é pintado sem transição; um instante depois, anda. Prazo, e não
    // quadro de animação: o quadro não roda com a aba em segundo plano.
    window.setTimeout(() => setFase("fim"), 30)
    window.setTimeout(() => setTocando(false), fimDoTempo + 60)
  }, [fimDoTempo])
  React.useEffect(() => {
    if (rodada > 0) tocar()
  }, [rodada, tocar])
  return { fase, tocando, tocar }
}

function BotaoDeTocar({ nome, tocando, tocar }: { nome: string; tocando: boolean; tocar: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Tocar ${nome}`} disabled={tocando} onClick={tocar}>
          <PlayIcon />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Tocar {nome}</TooltipContent>
    </Tooltip>
  )
}

const ms = (v: string) => Number.parseInt(v, 10) || 0

/** A pista: um ponto da marca (que desenha, MARCA-03) que vai de uma ponta à outra. */
function Pista({ classes, fase, cor = false }: { classes: string; fase: "parado" | "voltando" | "fim"; cor?: boolean }) {
  const { reduzido } = React.useContext(RodadaContexto)
  if (cor)
    return (
      <span
        aria-hidden="true"
        className={cn("block h-3 w-full rounded-full transition-colors", classes, fase === "fim" ? "bg-primary" : "bg-muted")}
      />
    )
  return (
    <span aria-hidden="true" className="relative block h-3 w-full rounded-full bg-muted">
      <span
        className={cn(
          "absolute top-0 size-3 rounded-full bg-primary transition-[left] motion-reduce:transition-none",
          classes,
          (fase === "voltando" || reduzido) && "transition-none"
        )}
        style={{ left: fase === "fim" ? "calc(100% - 0.75rem)" : "0" }}
      />
    </span>
  )
}

function LinhaDeDuracao({ nome, valor }: { nome: string; valor: string }) {
  const curva = nome.endsWith("fecha") ? "fecha" : "abre"
  const { fase, tocando, tocar } = useTocar(ms(valor))
  return (
    <TableRow data-token={`duracoes:${nome}`}>
      <TableCell className="t-medida whitespace-nowrap text-foreground">{CLASSE_DA_DURACAO[nome]}</TableCell>
      <TableCell className="w-80">
        <UsoDoToken nome={nome} />
      </TableCell>
      <TableCell className="t-medida">{valor}</TableCell>
      <TableCell className="t-medida whitespace-nowrap text-foreground-2">{nome === "cor" ? "—" : CLASSE_DA_CURVA[curva]}</TableCell>
      <TableCell className="w-1/4">
        <Pista classes={cn(CLASSE_DA_DURACAO[nome], nome !== "cor" && CLASSE_DA_CURVA[curva])} fase={fase} cor={nome === "cor"} />
      </TableCell>
      <TableCell>
        <BotaoDeTocar nome={nome} tocando={tocando} tocar={tocar} />
      </TableCell>
    </TableRow>
  )
}

function UsoDoToken({ nome }: { nome: string }) {
  const uso = USO[nome]
  return (
    <span className="flex flex-col gap-0.5">
      <span className="t-denso text-foreground-2">{uso?.onde}</span>
      {uso && uso.pecas.length > 0 ? (
        <span className="flex flex-wrap gap-x-2 text-legenda">
          {uso.pecas.map((p) => (
            <Link key={p} href={`/catalogo/${p}/`} className="underline underline-offset-2">
              {p}
            </Link>
          ))}
        </span>
      ) : (
        <span className="text-legenda text-muted-foreground">Nenhuma peça do kit usa.</span>
      )}
    </span>
  )
}

function LinhaDeAtraso({ nome, valor }: { nome: string; valor: string }) {
  const { reduzido } = React.useContext(RodadaContexto)
  const { fase, tocando, tocar } = useTocar(ms(valor) + 150)
  return (
    <TableRow data-token={`atrasos:${nome}`}>
      <TableCell className="t-medida whitespace-nowrap text-foreground">{CLASSE_DO_ATRASO[nome]}</TableCell>
      <TableCell className="w-80">
        <UsoDoToken nome={nome} />
      </TableCell>
      <TableCell className="t-medida">{valor}</TableCell>
      <TableCell className="w-1/4">
        <span aria-hidden="true" className="relative block h-3 w-full rounded-full bg-muted">
          <span
            className={cn(
              "absolute inset-y-0 left-0 w-1/3 rounded-full bg-primary transition-opacity duration-revela motion-reduce:transition-none",
              CLASSE_DO_ATRASO[nome],
              (fase === "voltando" || reduzido) && "transition-none",
              fase === "fim" ? "opacity-100" : "opacity-0"
            )}
          />
        </span>
      </TableCell>
      <TableCell>
        <BotaoDeTocar nome={nome} tocando={tocando} tocar={tocar} />
      </TableCell>
    </TableRow>
  )
}

/** `cubic-bezier(0.16, 1, 0.3, 1)` → o gráfico da curva (diagrama, sem superfície). */
function Curva({ nome, valor }: { nome: string; valor: string }) {
  const [x1 = 0, y1 = 0, x2 = 1, y2 = 1] = (valor.match(/[\d.]+/g) ?? []).map(Number)
  const { fase, tocando, tocar } = useTocar(220)
  return (
    <div data-token={`curvas:${nome}`} className="flex flex-col gap-3">
      <svg viewBox="-4 -4 108 108" className="size-32" role="img" aria-label={`A curva ${nome}`}>
        <path d="M0 100 L100 0" className="fill-none stroke-border" strokeWidth="1" strokeDasharray="3 3" />
        <path d={`M0 100 C${x1 * 100} ${100 - y1 * 100} ${x2 * 100} ${100 - y2 * 100} 100 0`} className="fill-none stroke-foreground" strokeWidth="2.5" />
      </svg>
      <div className="flex items-center gap-2">
        <span className="t-medida text-foreground">{CLASSE_DA_CURVA[nome]}</span>
        <BotaoDeTocar nome={nome} tocando={tocando} tocar={tocar} />
      </div>
      <Pista classes={cn("duration-modal-abre", CLASSE_DA_CURVA[nome])} fase={fase} />
      <span className="t-medida text-legenda text-muted-foreground">{valor}</span>
      <span className="t-denso text-foreground-2">{nome === "abre" ? "O que entra desacelera." : "O que sai acelera, e sai mais rápido."}</span>
    </div>
  )
}

function Animacao({ nome, valor }: { nome: string; valor: string }) {
  const [vez, setVez] = React.useState(0)
  const { rodada, reduzido } = React.useContext(RodadaContexto)
  const [tocando, setTocando] = React.useState(false)
  const tocar = React.useCallback(() => {
    setVez((v) => v + 1)
    setTocando(true)
    // Sem animação (movimento reduzido) não há `animationend`: o prazo devolve o botão.
    window.setTimeout(() => setTocando(false), 400)
  }, [])
  React.useEffect(() => {
    if (rodada > 0) tocar()
  }, [rodada, tocar])
  return (
    <div data-token={`animacoes:${nome}`} className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="t-medida text-foreground">animate-{nome}</span>
        <BotaoDeTocar nome={nome} tocando={tocando} tocar={tocar} />
      </div>
      <div className="h-16 overflow-hidden rounded-ctrl bg-muted" style={{ ["--radix-accordion-content-height" as string]: "4rem" }}>
        {vez > 0 ? (
          <div key={vez} className={cn("h-16 rounded-ctrl bg-primary/20", CLASSE_DA_ANIMACAO[nome], reduzido && "animate-none")} onAnimationEnd={() => setTocando(false)} />
        ) : null}
      </div>
      <span className="t-medida text-legenda text-muted-foreground">{valor}</span>
      <span className="text-legenda text-muted-foreground">Nenhuma peça do kit usa: a dobra anima pelas durações dobra-*.</span>
    </div>
  )
}

const MODOS = [
  { chave: "com", rotulo: "Com movimento" },
  { chave: "reduzido", rotulo: "Reduzido" },
] as const

function useSistemaPedeMenos() {
  const [pede, setPede] = React.useState(false)
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setPede(mq.matches)
    const aoMudar = () => setPede(mq.matches)
    mq.addEventListener("change", aoMudar)
    return () => mq.removeEventListener("change", aoMudar)
  }, [])
  return pede
}

export function Movimento({ dados }: { dados: Dados }) {
  // O modo simulado mora no `?movimento=` (CONV-06).
  const modo = useParametroDoEndereco("movimento")
  const reduzido = modo.valor === "reduzido"
  const sistema = useSistemaPedeMenos()
  const [rodada, setRodada] = React.useState(0)
  const [tocandoTodos, setTocandoTodos] = React.useState(false)
  const maior = Math.max(...Object.values(dados.duracoes).map(ms), ...Object.values(dados.atrasos).map((v) => ms(v) + 150))
  const tocarTodos = () => {
    setRodada((r) => r + 1)
    setTocandoTodos(true)
    window.setTimeout(() => setTocandoTodos(false), maior + 60)
  }
  const controles = (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <BarraDeModos
          rotulo="Movimento"
          modos={MODOS}
          valor={reduzido ? "reduzido" : "com"}
          onTrocar={(m) => modo.trocar(m === "reduzido" ? "reduzido" : "")}
        />
        <Button variant="outline" onClick={tocarTodos} disabled={tocandoTodos}>
          <PlayIcon />
          Tocar todos
        </Button>
      </div>
      {sistema ? (
        <p role="status" className="t-denso text-foreground-2">
          O seu sistema pede movimento reduzido: as pistas ficam paradas nas duas opções, e só a troca de cor anda. É a regra funcionando.
        </p>
      ) : null}
    </div>
  )
  return (
    <RodadaContexto.Provider value={{ rodada, reduzido }}>
      <PaginaDaVitrine
        titulo="Movimento"
        filtros={controles}
        abertura="Cada token tocando, uma vez por clique. O modo Reduzido aplica a classe de escape, que é o que acontece para quem pediu menos movimento: a pista salta ao fim, e só a troca de cor anda."
      >
      <Bloco nome="duracoes" titulo="Durações" legenda="Quem entra desacelera; quem sai acelera, e é mais curto.">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Classe</TableHead>
              <TableHead>Onde vale</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Curva</TableHead>
              <TableHead>Pista</TableHead>
              <TableHead>
                <span className="sr-only">Tocar</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(dados.duracoes).map(([nome, valor]) => (
              <LinhaDeDuracao key={nome} nome={nome} valor={valor} />
            ))}
          </TableBody>
        </Table>
      </Bloco>
      <Bloco nome="atrasos" titulo="Atrasos" legenda="Nada acontece até o atraso passar.">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Classe</TableHead>
              <TableHead>Onde vale</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Pista</TableHead>
              <TableHead>
                <span className="sr-only">Tocar</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(dados.atrasos).map(([nome, valor]) => (
              <LinhaDeAtraso key={nome} nome={nome} valor={valor} />
            ))}
          </TableBody>
        </Table>
      </Bloco>
      <Bloco nome="curvas" titulo="Curvas" legenda="As duas, na duração do diálogo." className="grid gap-6 sm:grid-cols-2">
        {Object.entries(dados.curvas).map(([nome, valor]) => (
          <Curva key={nome} nome={nome} valor={valor} />
        ))}
      </Bloco>
      <Bloco nome="animacoes" titulo="Animações" legenda="As do pacote." className="grid gap-6 sm:grid-cols-2">
        {Object.entries(dados.animacoes).map(([nome, valor]) => (
          <Animacao key={nome} nome={nome} valor={valor} />
        ))}
      </Bloco>
      </PaginaDaVitrine>
    </RodadaContexto.Provider>
  )
}
