// As cores do tema por PAPEL, como a vitrine as agrupa, e os pares de contraste
// que ela mede. A conta é a do pacote de tokens; a lista de pares espelha o
// teste `os-tokens-pagam-o-piso` (exportar os pares do pacote é item próprio).
import { paleta } from "@/vitrine/paleta"
import { TOKENS, opaco, razao, sobre, valor, type Tema } from "@/vitrine/tokens"

export type Uso = "bg" | "text" | "border" | "ring" | "imagem"

export type CorDoGrupo = { variavel: string; papel: string; uso: Uso }

export type GrupoDeCor = { id: string; titulo: string; legenda: string; regra?: string; cores: CorDoGrupo[] }

export const GRUPOS_DE_COR: GrupoDeCor[] = [
  {
    id: "fundos",
    titulo: "Fundos",
    legenda: "Neutros frios: o chão não é branco puro; a superfície é.",
    regra: "COR-02",
    cores: [
      { variavel: "--background", papel: "O chão da página", uso: "bg" },
      { variavel: "--card", papel: "A superfície das peças", uso: "bg" },
      { variavel: "--popover", papel: "A superfície do que flutua", uso: "bg" },
      { variavel: "--muted", papel: "O degrau afundado, dentro da peça", uso: "bg" },
      { variavel: "--accent", papel: "O realce do hover e do item ativo", uso: "bg" },
      { variavel: "--secondary", papel: "O fundo do botão secundário", uso: "bg" },
    ],
  },
  {
    id: "tinta",
    titulo: "Tinta",
    legenda: "Dois degraus de texto, e um terceiro para carimbo.",
    regra: "COR-06",
    cores: [
      { variavel: "--foreground", papel: "O texto principal", uso: "text" },
      { variavel: "--foreground-2", papel: "O segundo degrau: metadado, legenda", uso: "text" },
      { variavel: "--muted-foreground", papel: "O terceiro degrau e a voz neutra", uso: "text" },
      { variavel: "--card-foreground", papel: "O texto sobre a superfície", uso: "text" },
      { variavel: "--popover-foreground", papel: "O texto do que flutua", uso: "text" },
      { variavel: "--secondary-foreground", papel: "O texto do botão secundário", uso: "text" },
      { variavel: "--accent-foreground", papel: "O texto sobre o realce", uso: "text" },
    ],
  },
  {
    id: "marca",
    titulo: "Marca",
    legenda: "A marca preenche, tinge e desenha; ela nunca é letra.",
    regra: "MARCA-01",
    cores: [
      { variavel: "--primary", papel: "O preenchimento do primário", uso: "bg" },
      { variavel: "--primary-hover", papel: "O primário sob o mouse: só a luz muda", uso: "bg" },
      { variavel: "--primary-foreground", papel: "O texto sobre o primário", uso: "text" },
      { variavel: "--marca-viva", papel: "A marca que desenha: filete, símbolo", uso: "bg" },
      { variavel: "--marca-tinta", papel: "A tinta da marca, atrás do item ativo", uso: "bg" },
      { variavel: "--primary-gradient-start", papel: "A ponta escura do gradiente", uso: "bg" },
      { variavel: "--primary-gradient-mid", papel: "O meio do gradiente", uso: "bg" },
      { variavel: "--primary-gradient-end", papel: "A ponta clara do gradiente", uso: "bg" },
      { variavel: "--primary-gradient", papel: "O gradiente da marca, só em desenho", uso: "imagem" },
    ],
  },
  {
    id: "linhas",
    titulo: "Linhas e foco",
    legenda: "O contorno de controle paga 3:1; a separação decorativa não deve nada.",
    regra: "COR-11",
    cores: [
      { variavel: "--border", papel: "A linha decorativa", uso: "border" },
      { variavel: "--input", papel: "O contorno do campo", uso: "border" },
      { variavel: "--ring", papel: "O anel de foco", uso: "ring" },
      { variavel: "--anel", papel: "O anel decorativo da peça", uso: "ring" },
    ],
  },
  {
    id: "destrutivo",
    titulo: "Destrutivo",
    legenda: "Destrutivo é contorno; preenchido é sempre o primário.",
    regra: "MARCA-05",
    cores: [
      { variavel: "--destructive", papel: "O contorno e a frase de erro", uso: "text" },
      { variavel: "--destructive-foreground", papel: "O texto sobre o destrutivo", uso: "text" },
    ],
  },
  {
    id: "terminal",
    titulo: "Terminal",
    legenda: "O terminal não segue o tema: é igual no claro e no escuro.",
    regra: "COR-15",
    cores: [
      { variavel: "--terminal", papel: "O fundo do terminal", uso: "bg" },
      { variavel: "--terminal-foreground", papel: "O texto do terminal", uso: "text" },
    ],
  },
  {
    id: "ia",
    titulo: "IA",
    legenda: "A escrita de IA paga 4,5:1 em todo ponto do ciclo violeta → azul → violeta.",
    cores: [
      { variavel: "--ia-violeta", papel: "A ponta violeta da IA", uso: "text" },
      { variavel: "--ia-azul", papel: "A ponta azul da IA", uso: "text" },
      { variavel: "--ia-gradient", papel: "O degradê da escrita de IA", uso: "imagem" },
    ],
  },
  {
    id: "herdados",
    titulo: "Herdados sem regra",
    legenda: "Vêm do shadcn e nenhuma regra da base os pede: use só se a base passar a pedir.",
    cores: [
      { variavel: "--chart-1", papel: "Série 1 de gráfico", uso: "bg" },
      { variavel: "--chart-2", papel: "Série 2 de gráfico", uso: "bg" },
      { variavel: "--chart-3", papel: "Série 3 de gráfico", uso: "bg" },
      { variavel: "--chart-4", papel: "Série 4 de gráfico", uso: "bg" },
      { variavel: "--chart-5", papel: "Série 5 de gráfico", uso: "bg" },
      { variavel: "--sidebar", papel: "Fundo de barra lateral do shadcn", uso: "bg" },
      { variavel: "--sidebar-foreground", papel: "Texto da barra lateral do shadcn", uso: "text" },
      { variavel: "--sidebar-primary", papel: "Primário da barra lateral do shadcn", uso: "bg" },
      { variavel: "--sidebar-primary-foreground", papel: "Texto do primário da barra do shadcn", uso: "text" },
      { variavel: "--sidebar-accent", papel: "Realce da barra lateral do shadcn", uso: "bg" },
      { variavel: "--sidebar-accent-foreground", papel: "Texto do realce da barra do shadcn", uso: "text" },
      { variavel: "--sidebar-border", papel: "Linha da barra lateral do shadcn", uso: "border" },
      { variavel: "--sidebar-ring", papel: "Foco da barra lateral do shadcn", uso: "ring" },
      { variavel: "--switch-background", papel: "Trilho do interruptor do shadcn", uso: "bg" },
      { variavel: "--input-background", papel: "Fundo de campo do shadcn", uso: "bg" },
    ],
  },
]

/** `--card` → `bg-card` (a classe que o papel pede). */
export function classeDaCor(c: CorDoGrupo): string {
  const nome = c.variavel.slice(2)
  if (c.uso === "imagem") return nome === "primary-gradient" ? "bg-primary-gradient" : `bg-(image:--${nome})`
  return `${c.uso}-${nome}`
}

/** O nome Tailwind da cor, quando ela é uma (`cores` no tokens.json). */
export const eCorDoTailwind = (variavel: string) => TOKENS.cores.includes(variavel.slice(2))

// --- Contraste ----------------------------------------------------------------

export const PISO_TEXTO = 4.5
export const PISO_GRAFICO = 3

/** Os quatro fundos em que qualquer texto pode cair. */
export const FUNDOS = ["--card", "--background", "--muted", "--accent"] as const

/** A paleta fixa das vozes (COR-01), do Tailwind instalado. Não é token de tema. */
export const PALETA = paleta()

/** O texto do carimbo (`BADGE_DO_TOM`): o 800 no claro, o 300 no escuro, nas quatro famílias. */
export const CARIMBO: Record<Tema, string> = { claro: "800", escuro: "300" }

/** COR-06: o degrau de texto pequeno de cada voz (`COR_DO_TOM_DENSO`), por tema. */
export const DENSO: Record<Tema, Record<string, string>> = {
  claro: { ok: "emerald-700", espera: "amber-800", ruim: "rose-700", alheio: "violet-700" },
  escuro: { ok: "emerald-400", espera: "amber-400", ruim: "rose-400", alheio: "violet-400" },
}

export type LinhaDaMatriz = { id: string; rotulo: string; piso: number; regra: string; cor: (tema: Tema) => string; contorno?: boolean }

/** As tintas da matriz, cada uma com o piso que a base cobra dela. */
export const LINHAS_DA_MATRIZ: LinhaDaMatriz[] = [
  { id: "foreground", rotulo: "foreground", piso: 14, regra: "COR-12", cor: (t) => valor("--foreground", t) },
  { id: "foreground-2", rotulo: "foreground-2", piso: 5.9, regra: "COR-12", cor: (t) => valor("--foreground-2", t) },
  { id: "muted-foreground", rotulo: "muted-foreground", piso: 4.6, regra: "COR-12", cor: (t) => valor("--muted-foreground", t) },
  { id: "destructive", rotulo: "destructive", piso: PISO_TEXTO, regra: "MARCA-05", cor: (t) => valor("--destructive", t) },
  ...(["ok", "espera", "ruim", "alheio"] as const).map((voz) => ({
    id: `voz-${voz}`,
    rotulo: `voz ${voz}`,
    piso: PISO_TEXTO,
    regra: "COR-06",
    cor: (t: Tema) => PALETA[DENSO[t][voz]!]!,
  })),
  { id: "input", rotulo: "input (contorno)", piso: PISO_GRAFICO, regra: "COR-11", cor: (t) => valor("--input", t), contorno: true },
]

export type ParMedido = { frente: string; fundo: string; razao: number }

export type Par = {
  id: string
  descricao: string
  /** A regra da base que cobra o par; o par que o teste dos tokens cobra sem regra na base não tem. */
  regra?: string
  /** O piso, ou `null` quando o número é registro e não piso (a marca, a razão que obriga a forma). */
  piso: number | null
  nota?: string
  medir: (tema: Tema) => ParMedido
}

const pior = (medidas: ParMedido[]) => medidas.reduce((a, b) => (b.razao < a.razao ? b : a))
const medir = (frente: string, fundo: string): ParMedido => ({ frente, fundo, razao: razao(frente, fundo) })

/** Mistura em sRGB, para amostrar o ciclo da escrita de IA. */
function mistura(de: string, para: string, t: number): string {
  const canais = (h: string) => h.replace("#", "").match(/../g)!.map((c) => parseInt(c, 16) / 255)
  const [a, b] = [canais(de), canais(para)]
  return "#" + a.map((x, i) => Math.round((x + (b[i]! - x) * t) * 255).toString(16).padStart(2, "0")).join("").toUpperCase()
}

const tintaDaVoz = (voz: string, t: Tema) => sobre(PALETA[`${voz}-500`]!, 0.15, valor("--card", t)).toUpperCase()

export const PARES: Par[] = [
  {
    id: "primario",
    descricao: "Texto do primário sobre a marca",
    regra: "MARCA-01",
    piso: null,
    nota: "4,25:1, aceito: a marca não cede a contraste",
    medir: (t) => medir(valor("--primary-foreground", t), valor("--primary", t)),
  },
  {
    id: "marca-desenha",
    descricao: "A marca que desenha, no pior de card, accent e marca-tinta",
    regra: "MARCA-02",
    piso: PISO_GRAFICO,
    medir: (t) => pior(["--card", "--accent", "--marca-tinta"].map((f) => medir(valor("--marca-viva", t), valor(f, t)))),
  },
  {
    id: "marca-e-erro",
    descricao: "O vermelho da falha contra a marca",
    regra: "MARCA-02",
    piso: null,
    nota: "Indistinguíveis por cor: é a forma que separa (link sublinhado, destrutivo em contorno)",
    medir: () => medir(PALETA["rose-500"]!, valor("--marca-viva", "claro")),
  },
  {
    id: "gradiente",
    descricao: "As pontas do gradiente da marca, uma contra a outra",
    regra: "MARCA-03",
    piso: 2,
    medir: (t) => medir(valor("--primary-gradient-start", t), valor("--primary-gradient-end", t)),
  },
  ...(["emerald", "amber", "rose", "violet"] as const).map(
    (voz): Par => ({
      id: `carimbo-${voz}`,
      descricao: `Texto do carimbo sobre a tinta de ${voz} a 15%`,
      regra: "COR-06",
      piso: PISO_TEXTO,
      medir: (t) => medir(PALETA[`${voz}-${CARIMBO[t]}`]!, tintaDaVoz(voz, t)),
    }),
  ),
  {
    id: "carimbo-neutro",
    descricao: "Texto do carimbo neutro sobre a tinta a 7%",
    regra: "COR-07",
    piso: PISO_TEXTO,
    medir: (t) =>
      medir(
        t === "claro" ? valor("--muted-foreground", t) : valor("--foreground-2", t),
        sobre(valor("--foreground", t), 0.07, valor("--card", t)).toUpperCase(),
      ),
  },
  {
    id: "numero-denso",
    descricao: "O número denso de cada voz sobre o degrau muted, o pior",
    regra: "COR-06",
    piso: PISO_GRAFICO,
    medir: (t) => pior(Object.values(DENSO[t]).map((c) => medir(PALETA[c]!, valor("--muted", t)))),
  },
  {
    id: "terminal",
    descricao: "Texto do terminal sobre o terminal a 95%, no pior dos quatro fundos",
    regra: "COR-15",
    piso: PISO_TEXTO,
    medir: (t) => pior(FUNDOS.map((f) => medir(valor("--terminal-foreground", t), sobre(valor("--terminal", t), 0.95, valor(f, t)).toUpperCase()))),
  },
  {
    id: "ia",
    descricao: "A escrita de IA no pior ponto do ciclo, sobre card e accent",
    piso: PISO_TEXTO,
    medir: (t) => {
      const [violeta, azul] = [valor("--ia-violeta", t), valor("--ia-azul", t)]
      const medidas: ParMedido[] = []
      for (const [de, para] of [[violeta, azul], [azul, violeta]] as const)
        for (let i = 0; i <= 100; i++) for (const f of ["--card", "--accent"]) medidas.push(medir(mistura(de, para, i / 100), valor(f, t)))
      return pior(medidas)
    },
  },
]

export { opaco }
