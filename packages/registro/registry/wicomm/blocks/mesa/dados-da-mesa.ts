import type { Estacao } from "@/registry/wicomm/ui/trilho-do-percurso"

/**
 * Os dados do EXEMPLO da Mesa — o projeto apaga este arquivo e liga a própria
 * consulta. `?estado=` na página de exemplo escolhe o momento da tela.
 */
export type Etapa = "recebido" | "conferencia" | "pagamento" | "envio" | "entregue"

export type ItemDoPedido = { id: string; nome: string; quantidade: number; conferido: boolean }

export type MomentoDaMesa =
  | "carregando"
  | "carregando-abas"
  | "a-conferir"
  | "pronto"
  | "andando"
  | "erro"
  | "recusa"
  | "sucesso"
  | "leitura"
  | "sem-permissao"

export type CargaDaMesa = {
  momento: MomentoDaMesa
  numero: string
  itens: ItemDoPedido[]
  ficha: { cliente: string; criadoEm: string; valor: string; entrega: string | null }
}

export const MOMENTOS: MomentoDaMesa[] = ["carregando", "carregando-abas", "a-conferir", "pronto", "andando", "erro", "recusa", "sucesso", "leitura", "sem-permissao"]

const ITENS: ItemDoPedido[] = [
  { id: "a", nome: "Cadeira de escritório", quantidade: 2, conferido: true },
  { id: "b", nome: "Mesa regulável", quantidade: 1, conferido: true },
  { id: "c", nome: "Luminária de mesa", quantidade: 3, conferido: true },
]

export function cargaDaMesa(numero: string, estado: string | undefined): CargaDaMesa {
  const momento = MOMENTOS.includes(estado as MomentoDaMesa) ? (estado as MomentoDaMesa) : "pronto"
  // A Mesa de leitura existe para o caso em que o gesto mora noutra tela: o normal é ter item pendente.
  const itens =
    momento === "a-conferir" || momento === "leitura" ? ITENS.map((i, n) => ({ ...i, conferido: n !== 2 }))
    : ITENS
  return {
    momento,
    numero,
    itens,
    ficha: { cliente: "Ana Souza", criadoEm: "28/10/2026, 14:20", valor: "R$ 1.240,00", entrega: null },
  }
}

/** O percurso do pedido, com a etapa atual dita pelo momento. */
export function estacoesDoPedido(concluida: boolean): Estacao<Etapa>[] {
  return [
    { chave: "recebido", nome: "Recebido", situacao: "feita" },
    concluida
      ? { chave: "conferencia", nome: "Conferência", situacao: "feita" }
      : { chave: "conferencia", nome: "Conferência", situacao: "atual", palavra: "aguarda você", tom: "espera" },
    concluida
      ? { chave: "pagamento", nome: "Pagamento", situacao: "atual", palavra: "em curso", tom: "neutro" }
      : { chave: "pagamento", nome: "Pagamento", situacao: "a-frente" },
    { chave: "envio", nome: "Envio", situacao: "a-frente" },
    { chave: "entregue", nome: "Entregue", situacao: "a-frente" },
  ]
}
