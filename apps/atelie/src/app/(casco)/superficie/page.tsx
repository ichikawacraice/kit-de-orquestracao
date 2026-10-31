import { Bloco } from "@/components/ui/bloco"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PaginaDaVitrine } from "@/components/vitrine/pagina"
import { LinkDaRegra } from "@/components/vitrine/regra"
import { TOKENS, resolvido, type Tema } from "@/vitrine/tokens"

export const metadata = { title: "Superfície" }

const ALTURAS = [
  { variavel: "--superficie-sombra", classe: "superficie", nome: "Peça", onde: "Cartão, painel, tabela, bloco" },
  { variavel: "--superficie-sombra-alta", classe: "superficie-alta", nome: "Peça no hover", onde: "Só hover e seleção de peça" },
  { variavel: "--superficie-sombra-flutuante", classe: "superficie-flutuante", nome: "Flutuante", onde: "Diálogo, menu, dica, aviso" },
]

/** Pintada com os valores do tema, e não com as variáveis da página: o outro tema mora ao lado. */
function Alturas({ tema }: { tema: Tema }) {
  const v = (n: string) => resolvido(n, tema)
  return (
    <figure className="flex min-w-0 flex-col gap-2">
      <figcaption className="t-coluna">{tema === "claro" ? "Claro" : "Escuro"}</figcaption>
      <div className="flex flex-col gap-6 rounded-cartao p-6" style={{ backgroundColor: v("--background"), color: v("--foreground") }}>
        <p className="t-denso" style={{ color: v("--foreground-2") }}>
          Chão · <span className="t-medida">bg-background</span>
        </p>
        {ALTURAS.map((a) => (
          <div
            key={a.variavel}
            data-token={`var:${a.variavel}`}
            className="flex flex-col gap-1 rounded-2xl p-4"
            style={{ backgroundColor: v("--card"), boxShadow: v(a.variavel) }}
          >
            <span className="t-titulo">{a.nome}</span>
            <span className="t-denso" style={{ color: v("--foreground-2") }}>
              <span className="t-medida">{a.classe}</span> · {a.onde}
            </span>
          </div>
        ))}
      </div>
    </figure>
  )
}

export default function Superficie() {
  return (
    <PaginaDaVitrine
      titulo="Superfície"
      abertura="Três alturas, e só três: o chão, a peça e o que flutua. A profundidade é superfície opaca com sombra baixa; a separação entre assuntos é o ar, não a linha."
    >
      <Bloco nome="alturas" titulo="As três alturas" legenda="Nos dois temas." className="grid gap-6 xl:grid-cols-2">
        <Alturas tema="claro" />
        <Alturas tema="escuro" />
      </Bloco>
      <Bloco nome="foco" titulo="Foco" legenda="Anel de 2px na marca, com 2px de deslocamento.">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline">Foque com Tab</Button>
          <Input aria-label="Campo para focar" placeholder="ou clique aqui" className="w-56" />
        </div>
        <p className="t-denso text-foreground-2">
          O anel é foco, nunca elevação, e o elemento não muda de tamanho ao focar (<LinkDaRegra codigo="SUP-06" />).
        </p>
      </Bloco>
      <Bloco nome="herdados" titulo="Herdados sem regra" legenda="Existem no pacote; a base não os pede.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div data-token="var:--sombra-painel" className="flex flex-col gap-1.5">
            <span className="h-16 rounded-2xl bg-card painel" aria-hidden="true" />
            <span className="t-medida text-foreground">--sombra-painel</span>
            <span className="t-denso text-foreground-2">A sombra da classe painel; nenhuma regra a distingue de superficie.</span>
          </div>
          <div data-token="sombras:linha-ativa" className="flex flex-col gap-1.5">
            <span className="flex h-10 items-center rounded-ctrl bg-accent px-3 text-controle shadow-linha-ativa">Item ativo</span>
            <span className="t-medida text-foreground">shadow-linha-ativa · {TOKENS.sombras["linha-ativa"]}</span>
            <span className="t-denso text-foreground-2">O filete de item ativo; o item de navegação do kit usa o fundo (<LinkDaRegra codigo="CTRL-08" />).</span>
          </div>
        </div>
      </Bloco>
    </PaginaDaVitrine>
  )
}
