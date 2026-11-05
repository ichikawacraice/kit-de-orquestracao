// As pessoas das demos: o id estável é a chave da cor do monograma (COR-09),
// nunca o nome. Os ids foram escolhidos para cobrir as 8 famílias; Ana e Caio
// colidem (as duas fuchsia) para a pilha mostrar vizinhas da mesma família.
export const PESSOAS = {
  "Ana Souza": "pessoa-ana", // fuchsia
  "Bruno Lima": "pessoa-bruno", // indigo
  "Carla Dias": "pessoa-carla", // lime
  "Davi Melo": "pessoa-davi", // teal
  "Eva Reis": "pessoa-eva", // sky
  "Helena Prado": "pessoa-helena", // cyan
  "Igor Matos": "pessoa-igor", // purple
  "Júlia Campos": "pessoa-julia", // blue
  "Caio Nunes": "pessoa-caio", // fuchsia, como a Ana
  "Diego Rocha": "pessoa-diego",
  "Carla Nogueira": "pessoa-carla-nogueira",
  "Elisa Fonseca": "pessoa-elisa",
  "Ana Ribeiro": "pessoa-ana-ribeiro",
  "Bruno Tavares": "pessoa-bruno-tavares",
} as const

/** A pessoa da demo pelo nome; quem não está na tabela fica sem id (o monograma neutro). */
export function pessoaDaDemo(nome: string | null): { id: string | null; nome: string } | null {
  if (!nome) return null
  return { id: (PESSOAS as Record<string, string>)[nome] ?? null, nome }
}
