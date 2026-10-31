import { Bloco } from "@/components/ui/bloco"
import { AbasDasCores } from "@/components/vitrine/abas-das-cores"
import { LadrilhoDeCor, type DadosDoLadrilho } from "@/components/vitrine/ladrilho-de-cor"
import { PaginaDaVitrine } from "@/components/vitrine/pagina"
import { hrefDaRegra, regraPeloCodigo } from "@/vitrine/base"
import { GRUPOS_DE_COR, classeDaCor, eCorDoTailwind, type CorDoGrupo } from "@/vitrine/cores"
import { pintura, valor } from "@/vitrine/tokens"

export const metadata = { title: "Cores" }

function dados(c: CorDoGrupo, codigo?: string): DadosDoLadrilho {
  const regra = codigo ? regraPeloCodigo(codigo) : undefined
  const nome = c.variavel.slice(2)
  return {
    variavel: c.variavel,
    papel: c.papel,
    classe: classeDaCor(c),
    token: [`var:${c.variavel}`, eCorDoTailwind(c.variavel) ? `cores:${nome}` : null].filter(Boolean).join(" "),
    claro: { valor: valor(c.variavel, "claro"), pintura: pintura(c.variavel, "claro") },
    escuro: { valor: valor(c.variavel, "escuro"), pintura: pintura(c.variavel, "escuro") },
    regra: regra ? { codigo: regra.codigo, href: hrefDaRegra(regra) } : undefined,
  }
}

export default function Cores() {
  return (
    <PaginaDaVitrine
      titulo="Cores"
      filtros={<AbasDasCores atual="tokens" />}
      abertura="As cores do tema, pelo papel. Cada amostra mostra o claro à esquerda e o escuro à direita; o clique abre a classe para copiar e a regra que rege a cor."
    >
      {GRUPOS_DE_COR.map((g) => (
        <Bloco key={g.id} nome={g.id} titulo={g.titulo} legenda={g.legenda} className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {g.cores.map((c) => (
            <LadrilhoDeCor key={c.variavel} d={dados(c, g.regra)} />
          ))}
        </Bloco>
      ))}
    </PaginaDaVitrine>
  )
}
