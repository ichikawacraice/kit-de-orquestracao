import * as React from "react"

import { Secao } from "@/registry/design-system/ui/secao"
import { cn } from "@/registry/design-system/lib/utils"

/**
 * O PAINEL — a peça grande de uma tela de trabalho (DESIGN SUP-01): superfície
 * opaca, raio 16, a sombra de painel, e dentro uma coluna flex que **rola por
 * conta própria** (LAY-01: o casco não rola; o conteúdo rola). Colunas lado a
 * lado são painéis separados por VÃO (12px), nunca por filete (SUP-03).
 *
 * O filho que rola é `RolagemDoPainel` — `flex-1 overflow-y-auto` com
 * `overscroll-behavior: contain`, para a roda do mouse não vazar para a página
 * quando a lista acaba.
 *
 * **Os dois declaram `relative`, e isso não é enfeite.** `overflow: hidden` só
 * recorta o descendente cujo bloco continente está dentro dele; um descendente
 * `position: absolute` sem ancestral posicionado escapa até o primeiro que
 * houver — o `sr-only` do Tailwind é `absolute`, e sem o `relative` os rótulos
 * invisíveis de dentro do painel esticam a rolagem da página com vazio.
 */
function Painel({
  as = "section",
  className,
  ...props
}: React.ComponentProps<"section"> & { as?: "section" | "div" | "nav" | "main" | "aside" }) {
  const Tag = as as React.ElementType
  return (
    <Tag
      data-slot="painel"
      data-superficie
      className={cn("painel relative flex min-h-0 min-w-0 flex-col overflow-hidden", className)}
      {...props}
    />
  )
}

/**
 * O respiro da coluna que rola, em uma de três densidades (LAY-06), nunca
 * padding à mão: `padrao` (`px-5 pb-6`), `compacta` (`px-4 pb-5`, a coluna
 * estreita) e `solta` (só `pb-6`, quando quem está dentro já tem a própria
 * superfície). Sem `densidade`, nenhum respiro — o de antes.
 */
const RESPIRO_DA_ROLAGEM = {
  padrao: "px-5 pb-6",
  compacta: "px-4 pb-5",
  solta: "pb-6",
} as const

function RolagemDoPainel({
  className,
  densidade,
  ...props
}: React.ComponentProps<"div"> & { densidade?: keyof typeof RESPIRO_DA_ROLAGEM }) {
  return (
    <div
      data-slot="rolagem-do-painel"
      data-densidade={densidade}
      className={cn("relative min-h-0 flex-1 overflow-y-auto overscroll-contain", densidade && RESPIRO_DA_ROLAGEM[densidade], className)}
      {...props}
    />
  )
}

/**
 * A SEÇÃO EM PAINEL — o assunto que ganhou superfície própria, em vez de dividir
 * uma superfície grande com os vizinhos.
 *
 * **Quando usar, e quando não.** Seção de conteúdo MISTO (texto, formulário,
 * imagem) vira painel: com muitos assuntos assim numa peça só, o ar entre eles
 * deixa de bastar, e a correção é FRONTEIRA, não mais ar. Seção cujo conteúdo
 * inteiro fala numa VOZ só (uma falha, uma decisão que espera você) vira
 * `GrupoDeTinta`: um painel com um único bloco colorido dentro é moldura dupla,
 * e a tinta já é a fronteira.
 *
 * O respiro é `15px 18px`, mais apertado que o de um painel único, porque agora
 * quem separa é a borda de cada peça. A seção de dentro vem sempre `primeira`.
 */
function PainelDeSecao({
  titulo,
  contagem,
  acao,
  nome,
  nivel = 3,
  medida = false,
  className,
  children,
}: {
  titulo: string
  contagem?: React.ReactNode
  acao?: React.ReactNode
  nome?: string
  nivel?: 2 | 3 | 4
  medida?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <Painel className={cn("shrink-0 px-[18px] py-[15px]", className)}>
      <Secao primeira titulo={titulo} nivel={nivel} medida={medida} contagem={contagem} acao={acao} nome={nome}>
        {children}
      </Secao>
    </Painel>
  )
}

export { Painel, PainelDeSecao, RolagemDoPainel }
