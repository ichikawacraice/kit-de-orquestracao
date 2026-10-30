import { ClipboardListIcon, FileTextIcon, LayoutDashboardIcon, UsersIcon } from "lucide-react"

import type { Contagem, GrupoDeDestinos } from "@/registry/wicomm/blocks/casco/barra-lateral"

/**
 * A navegação do app, numa fonte só: os destinos da barra lateral e as telas
 * densas, que começam com a barra recolhida. É EXEMPLO — o app troca pelos
 * próprios destinos, e entrega à barra só os que a pessoa alcança (destino
 * fora de alcance não é desenhado, PESO-03).
 */
export const DESTINOS: GrupoDeDestinos[] = [
  {
    rotulo: "Operação",
    destinos: [
      { href: "/inicio", rotulo: "Início", icone: LayoutDashboardIcon },
      { href: "/pedidos", rotulo: "Pedidos", icone: ClipboardListIcon },
      { href: "/clientes", rotulo: "Clientes", icone: UsersIcon },
    ],
  },
  {
    rotulo: "Conteúdo",
    destinos: [{ href: "/documentos", rotulo: "Documentos", icone: FileTextIcon }],
  },
]

/** As telas densas: a barra começa recolhida nelas, e abrir ali não grava preferência. */
export const TELAS_DENSAS: string[] = []

/**
 * A navegação do EXEMPLO, coerente com a carga de cada estado das páginas de
 * exemplo (`?estado=`): a contagem da barra nunca discorda da tela, e quem não
 * alcança os pedidos não vê o destino. No app, as contagens vêm do servidor
 * junto da tela, e os destinos, do papel da pessoa.
 */
export function navegacaoDoExemplo(caminho: string, estado: string | null): { grupos: GrupoDeDestinos[]; contagens: Record<string, Contagem> } {
  // Na Mesa (`/pedidos/:id`) o estado é de UM pedido: a fila continua pedindo a pessoa, e o destino fica.
  if (caminho.startsWith("/pedidos/")) {
    const pedem = estado === "sucesso" ? 2 : 3
    return { grupos: DESTINOS, contagens: { "/pedidos": { numero: pedem, tom: "espera", frase: `${pedem} pedem você` } } }
  }
  if (estado === "sem-permissao") {
    return {
      grupos: DESTINOS.map((g) => ({ ...g, destinos: g.destinos.filter((d) => d.href !== "/pedidos") })),
      contagens: {},
    }
  }
  const semNada = estado === "vazio" || estado === "vazio-filtro" || estado === "carregando" || estado === "erro"
  return {
    grupos: DESTINOS,
    contagens: semNada ? {} : { "/pedidos": { numero: 3, tom: "espera", frase: "3 pedem você" } },
  }
}
