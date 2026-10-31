import {
  BoxIcon,
  HistoryIcon,
  LayersIcon,
  LayoutTemplateIcon,
  MoveHorizontalIcon,
  PaletteIcon,
  RulerIcon,
  ScaleIcon,
  ShapesIcon,
  SignpostIcon,
  TypeIcon,
} from "lucide-react"

import type { GrupoDeDestinos } from "@/registry/wicomm/blocks/casco/barra-lateral"
import { itemPeloNome, secaoDoItem } from "@/catalogo/registro"

/**
 * Os destinos da vitrine, numa fonte só: a barra do casco e as portas do início
 * leem daqui. O início não é destino: o logotipo no topo da barra leva a ele, e
 * com os onze destinos a barra cabe inteira a 800px de altura.
 */
export const DESTINOS: GrupoDeDestinos[] = [
  {
    rotulo: "Fundamentos",
    destinos: [
      { href: "/cores", rotulo: "Cores", icone: PaletteIcon },
      { href: "/tipografia", rotulo: "Tipografia", icone: TypeIcon },
      { href: "/espaco-e-forma", rotulo: "Espaço e forma", icone: RulerIcon },
      { href: "/superficie", rotulo: "Superfície", icone: LayersIcon },
      { href: "/movimento", rotulo: "Movimento", icone: MoveHorizontalIcon },
      { href: "/icones", rotulo: "Ícones", icone: ShapesIcon },
    ],
  },
  {
    rotulo: "Kit",
    destinos: [
      { href: "/pecas", rotulo: "Peças", icone: BoxIcon },
      { href: "/telas", rotulo: "Telas", icone: LayoutTemplateIcon },
      { href: "/padroes", rotulo: "Padrões", icone: SignpostIcon },
    ],
  },
  {
    rotulo: "Sistema",
    destinos: [
      { href: "/regras", rotulo: "Regras", icone: ScaleIcon },
      { href: "/mudancas", rotulo: "Mudanças", icone: HistoryIcon },
    ],
  },
]

/**
 * O caminho que a barra acende. O export estático termina a rota em `/`, e a
 * página do item (`/catalogo/{nome}/`) acende o destino da sua seção: Telas
 * para bloco, Peças para o resto.
 */
export function caminhoDaBarra(caminho: string): string {
  const semBarra = caminho.length > 1 ? caminho.replace(/\/$/, "") : caminho
  const m = semBarra.match(/^\/catalogo\/([^/]+)$/)
  if (!m) return semBarra
  const item = itemPeloNome(m[1]!)
  return item && secaoDoItem(item) === "blocos" ? "/telas" : "/pecas"
}
