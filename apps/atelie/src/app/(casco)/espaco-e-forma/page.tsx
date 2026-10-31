import { Bloco } from "@/components/ui/bloco"
import { Button } from "@/components/ui/button"
import { ChipDeEstado } from "@/components/ui/chip-de-estado"
import { Input } from "@/components/ui/input"
import { MedidaViva } from "@/components/vitrine/medida-viva"
import { PaginaDaVitrine } from "@/components/vitrine/pagina"
import { LinkDaRegra } from "@/components/vitrine/regra"
import { cn } from "@/lib/utils"
import { TOKENS, valor } from "@/vitrine/tokens"

export const metadata = { title: "Espaço e forma" }

/** A escala de espaço da base (frontmatter `spacing`), nas classes do Tailwind. */
const ESPACOS = [
  { nome: "hairline", px: 2, classe: "gap-0.5", largura: "w-0.5", onde: "o fio entre ícone e número" },
  { nome: "xs", px: 4, classe: "gap-1", largura: "w-1", onde: "dentro de um controle" },
  { nome: "sm", px: 6, classe: "gap-1.5", largura: "w-1.5", onde: "dentro de linha" },
  { nome: "md", px: 8, classe: "gap-2", largura: "w-2", onde: "dentro de linha" },
  { nome: "lg", px: 12, classe: "gap-3", largura: "w-3", onde: "dentro do bloco" },
  { nome: "xl", px: 16, classe: "gap-4", largura: "w-4", onde: "entre grupos do mesmo bloco" },
  { nome: "2xl", px: 24, classe: "gap-6", largura: "w-6", onde: "entre blocos, e o respiro lateral do casco" },
]

/** Cada raio com a classe de peça que a FORMA-01 lhe dá. As do Tailwind entram porque a regra as usa. */
const RAIOS: { classe: string; token?: string; variavel?: string; peca: string; aviso?: string }[] = [
  { classe: "rounded-painel", token: "painel", variavel: "--raio-painel", peca: "Painel" },
  { classe: "rounded-2xl", peca: "Container: cartão, tabela, diálogo (16px)" },
  {
    classe: "rounded-cartao",
    token: "cartao",
    variavel: "--raio-cartao",
    peca: "Cartão",
    aviso: "A base pede 16px para container; este token vale 14px.",
  },
  { classe: "rounded-xl", peca: "Agrupador: popover, menu, degrau de tinta" },
  { classe: "rounded-lg", token: "lg", variavel: "--radius", peca: "Dica" },
  { classe: "rounded-md", token: "md", peca: "Carimbo, botão sm", aviso: "A base anota 6px; o cálculo dá 8px: confira o medido." },
  { classe: "rounded-sm", token: "sm", peca: "Sem classe de peça na base" },
  { classe: "rounded-ctrl", token: "ctrl", variavel: "--raio-ctrl", peca: "Controle: botão default e lg, campo, select" },
  { classe: "rounded-badge", token: "badge", variavel: "--raio-badge", peca: "Sem classe de peça na base" },
  { classe: "rounded-full", peca: "Pílula: botão de ícone, contador, alça" },
]

export default function EspacoEForma() {
  return (
    <PaginaDaVitrine
      titulo="Espaço e forma"
      abertura="O ritmo por gap, o raio que sobe com o tamanho da superfície, a altura de controle e as larguras de leitura e de página."
    >
      <Bloco nome="espaco" titulo="Espaço" legenda="O de fora é o dobro do de dentro.">
        <div className="flex flex-col gap-2">
          {ESPACOS.map((e) => (
            <div key={e.nome} className="grid grid-cols-[6rem_3rem_4rem_1fr] items-center gap-3">
              <span className="t-medida text-foreground">{e.classe}</span>
              <span className="t-medida text-muted-foreground">{e.px}px</span>
              <span aria-hidden="true" className={cn("h-4 rounded-full bg-primary", e.largura)} />
              <span className="t-denso text-foreground-2">{e.onde}</span>
            </div>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { fora: "gap-6", dentro: "gap-3", razao: "2:1", certo: true },
            { fora: "gap-4", dentro: "gap-3", razao: "1,33:1", certo: false },
          ].map((r) => (
            <figure key={r.razao} className="flex flex-col gap-2">
              <div className={cn("flex flex-col rounded-ctrl bg-muted p-3", r.fora)}>
                {[0, 1].map((i) => (
                  <div key={i} className={cn("flex flex-col", r.dentro)}>
                    <span className="h-3 w-24 rounded-full bg-foreground/40" />
                    <span className="h-3 w-40 rounded-full bg-foreground/20" />
                    <span className="h-3 w-32 rounded-full bg-foreground/20" />
                  </div>
                ))}
              </div>
              <figcaption className="t-denso flex items-center gap-2 text-foreground-2">
                <span className="t-medida">{r.fora}</span> fora, <span className="t-medida">{r.dentro}</span> dentro: {r.razao}
                {r.certo ? null : <ChipDeEstado tom="ruim">as seções se confundem</ChipDeEstado>}
              </figcaption>
            </figure>
          ))}
        </div>
        <p className="t-denso text-foreground-2">
          <LinkDaRegra codigo="LAY-03" />
        </p>
      </Bloco>

      <Bloco nome="raios" titulo="Raios" legenda="Um raio por classe de peça." className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {RAIOS.map((r) => (
          <div
            key={r.classe}
            data-token={[r.token ? `raios:${r.token}` : null, r.variavel ? `var:${r.variavel}` : null].filter(Boolean).join(" ") || undefined}
            className="flex flex-col gap-1.5"
          >
            <span aria-hidden="true" className={cn("h-16 w-full bg-muted ring-1 ring-border", r.classe)} />
            <MedidaViva propriedade="border-top-left-radius" declarado={r.variavel ? valor(r.variavel, "claro") : ""} />
            <span className="t-medida text-foreground">{r.classe}</span>
            <span className="t-denso text-foreground-2">{r.peca}</span>
            {r.aviso ? <ChipDeEstado tom="espera">{r.aviso}</ChipDeEstado> : null}
          </div>
        ))}
      </Bloco>

      <Bloco nome="controles" titulo="Altura de controle" legenda="O botão default tem a altura do campo.">
        <div data-token="alturas:ctrl" className="flex flex-wrap items-end gap-3">
          <Button size="sm" variant="outline">
            sm · 26px
          </Button>
          <Button variant="outline">default · {TOKENS.alturas.ctrl}</Button>
          <Input aria-label="Campo de exemplo" placeholder={`campo · ${TOKENS.alturas.ctrl}`} className="w-48" />
          <Button size="lg" variant="outline">
            lg · 36px
          </Button>
        </div>
        <p className="t-denso text-foreground-2">
          Altura não se escreve à mão: a variante, ou <span className="t-medida">h-ctrl</span> e <span className="t-medida">size-ctrl</span>{" "}
          (<LinkDaRegra codigo="CTRL-01" />).
        </p>
      </Bloco>

      <Bloco nome="larguras" titulo="Larguras" legenda="Leitura e página.">
        <div data-token="larguras:medida" className="flex flex-col gap-1.5">
          <p className="max-w-medida rounded-ctrl bg-muted px-3 py-2 text-sm text-foreground-2">
            Texto corrido vai a max-w-medida: a linha de leitura longa demais cansa, e esta caixa para onde o texto deve parar.
          </p>
          <MedidaViva propriedade="max-width" declarado={TOKENS.larguras.medida!} />
        </div>
        <ul className="t-denso flex flex-col gap-1 text-foreground-2">
          <li>
            <span className="t-medida text-foreground">max-w-medida</span> · {TOKENS.larguras.medida}: texto corrido
          </li>
          <li>
            <span className="t-medida text-foreground">max-w-[100rem]</span> · 1600px: a página, pelo <span className="t-medida">PaginaDoApp</span>
          </li>
          <li>
            <span className="t-medida text-foreground">max-w-3xl</span> · 768px: o formulário longo
          </li>
          <li>
            <span className="t-medida text-foreground">max-w-5xl</span> · 1024px: a página de leitura pública
          </li>
        </ul>
        <p className="t-denso text-foreground-2">
          <LinkDaRegra codigo="LAY-02" /> · <LinkDaRegra codigo="LAY-06" />
        </p>
      </Bloco>
    </PaginaDaVitrine>
  )
}
