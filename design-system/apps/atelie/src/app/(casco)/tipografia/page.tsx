import { Bloco } from "@/components/ui/bloco"
import { Ficha, ParDaFicha } from "@/components/ui/ficha"
import { PaginaDaVitrine } from "@/components/vitrine/pagina"
import { LinkDaRegra } from "@/components/vitrine/regra"
import { FonteAplicada } from "@/components/vitrine/fonte-aplicada"
import { TOKENS } from "@/vitrine/tokens"

export const metadata = { title: "Tipografia" }

/** O papel de cada voz (TIPO-02) e uma frase de exemplo nela. */
const VOZES: Record<string, { papel: string; exemplo: string }> = {
  "t-display": { papel: "O título da página: um por tela", exemplo: "Pedidos da semana" },
  "t-titulo": { papel: "O nome de bloco, de cartão e de diálogo", exemplo: "Itens do pedido" },
  "t-denso": { papel: "O corpo em densidade instrumento: célula, metadado, linha de lista", exemplo: "Separado às 14:32 por Ana" },
  "t-rotulo": { papel: "Nomeia um conjunto; aparece uma vez, sozinho", exemplo: "Entrega" },
  "t-coluna": { papel: "Nomeia um valor que se repete: cabeçalho de coluna, unidade", exemplo: "Quantidade" },
  "t-campo": { papel: "O rótulo de campo em densidade site, na frase de quem usa", exemplo: "Para onde enviamos?" },
  "t-medida": { papel: "Número que se compara, em mono", exemplo: "1.284,50" },
}

const FAMILIAS: Record<string, { papel: string; classe: string }> = {
  sans: { papel: "A fonte do produto: Archivo, com o eixo de largura", classe: "font-sans" },
  archivo: { papel: "A Archivo pelo nome, para quem precisa dela fora do sans", classe: "font-archivo" },
  mono: { papel: "A fonte de medida: a mono do sistema", classe: "font-mono" },
}

const TAMANHOS: { classe: string; token?: string; px: string; onde: string }[] = [
  { classe: "text-sm", px: "14px", onde: "O corpo em densidade site" },
  { classe: "text-controle", token: "controle", px: TOKENS.tamanhos.controle!, onde: "O texto do botão e do campo default" },
  { classe: "text-legenda", token: "legenda", px: TOKENS.tamanhos.legenda!, onde: "Etiqueta, legenda, carimbo" },
]

/** `{"font-size":"23px"}` → as medidas na ordem de quem lê. */
function medidas(v: Record<string, string>) {
  const rotulos: Record<string, string> = {
    "font-size": "Tamanho",
    "font-weight": "Peso",
    "font-stretch": "Largura",
    "letter-spacing": "Espaço entre letras",
    "line-height": "Entrelinha",
    "text-transform": "Caixa",
    "font-variant-numeric": "Algarismos",
    "font-family": "Família",
    color: "Tinta",
  }
  return Object.entries(v).map(([k, val]) => ({ rotulo: rotulos[k] ?? k, valor: k === "font-family" ? "mono do sistema" : val.replace("var(--", "").replace(")", "") }))
}

export default function Tipografia() {
  return (
    <PaginaDaVitrine
      titulo="Tipografia"
      abertura="Uma família, e a voz escolhida pelo papel do texto, nunca pelo tamanho que parece bom. Fora das vozes, só os três tamanhos utilitários."
    >
      <Bloco nome="vozes" titulo="As vozes" legenda="As classes t-*, na camada components." className="flex flex-col gap-6">
        {Object.entries(TOKENS.vozes).map(([classe, v]) => (
          <div key={classe} data-token={`vozes:${classe}`} className="grid gap-3 lg:grid-cols-[3fr_2fr]">
            <div className="flex min-w-0 flex-col gap-1.5">
              <p className={classe}>{VOZES[classe]?.exemplo ?? classe}</p>
              <p className="t-denso text-foreground-2">
                <span className="t-medida text-foreground">{classe}</span> · {VOZES[classe]?.papel}
              </p>
            </div>
            <Ficha>
              {medidas(v).map((m) => (
                <ParDaFicha key={m.rotulo} rotulo={m.rotulo} mono>
                  {m.valor}
                </ParDaFicha>
              ))}
            </Ficha>
          </div>
        ))}
      </Bloco>
      <Bloco nome="familias" titulo="As famílias" legenda="Nenhuma segunda família.">
        <FonteAplicada />
        <div className="flex flex-col gap-4">
          {Object.entries(TOKENS.familias).map(([nome, pilha]) => (
            <div key={nome} data-token={`familias:${nome}`} className="flex flex-col gap-1">
              <p className={`${FAMILIAS[nome]?.classe} text-2xl text-foreground`}>Aa Bb Cc 0123456789</p>
              <p className="t-denso text-foreground-2">
                <span className="t-medida text-foreground">{FAMILIAS[nome]?.classe}</span> · {FAMILIAS[nome]?.papel}
              </p>
              <p className="t-medida text-legenda text-muted-foreground">{pilha.join(", ").replace("var(--font-archivo)", "Archivo")}</p>
            </div>
          ))}
          <div className="flex flex-col gap-1">
            <p className="flex flex-wrap items-baseline gap-x-6 text-2xl text-foreground">
              <span className="font-stretch-[80%]">80%</span>
              <span className="font-stretch-[96%]">96%</span>
              <span className="font-stretch-100%">100%</span>
              <span className="font-stretch-[106%]">106%</span>
            </p>
            <p className="t-denso text-foreground-2">
              As larguras do eixo <span className="t-medida">wdth</span> que as vozes usam: o rótulo condensado e o título largo saem da mesma fonte (<LinkDaRegra codigo="TIPO-01" />).
            </p>
          </div>
        </div>
      </Bloco>
      <Bloco nome="tamanhos" titulo="Os tamanhos utilitários" legenda="Só estes, fora das vozes.">
        <div className="flex flex-col gap-3">
          {TAMANHOS.map((t) => (
            <div key={t.classe} data-token={t.token ? `tamanhos:${t.token}` : undefined} className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className={`${t.classe} min-w-48 text-foreground`}>Separado às 14:32</span>
              <span className="t-medida text-foreground">{t.classe}</span>
              <span className="t-medida text-muted-foreground">{t.px}</span>
              <span className="t-denso text-foreground-2">{t.onde}</span>
            </div>
          ))}
        </div>
      </Bloco>
    </PaginaDaVitrine>
  )
}
