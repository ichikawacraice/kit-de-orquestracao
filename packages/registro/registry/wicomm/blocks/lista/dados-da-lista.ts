import type { Tom } from "@/registry/wicomm/lib/idioma-de-cor"

/**
 * Os dados do EXEMPLO da Lista — o projeto apaga este arquivo e liga a própria
 * consulta à mesma carga (`CargaDaLista`). Os estados da tela vêm daqui, por
 * `?estado=` na página de exemplo: nada na tela alterna estado.
 */
export type Situacao = "aguarda-voce" | "com-outros" | "andando" | "falhou" | "concluido"

export type Pedido = {
  numero: string
  cliente: string
  situacao: Situacao
  etapa: string
  valor: string
  atualizado: string
}

export type CargaDaLista =
  | { tipo: "carregando" }
  | { tipo: "erro" }
  | { tipo: "sem-permissao" }
  | { tipo: "pronto"; pedidos: Pedido[] }

/** O modo é a fila que a pessoa olha; cada um junta situações com a mesma pergunta. */
export type Modo = "pedem-voce" | "com-outros" | "andando" | "concluidos"

export const MODOS: { chave: Modo; rotulo: string; situacoes: Situacao[]; tom: Tom }[] = [
  { chave: "pedem-voce", rotulo: "Pedem você", situacoes: ["aguarda-voce"], tom: "espera" },
  { chave: "com-outros", rotulo: "Com outros", situacoes: ["com-outros"], tom: "alheio" },
  { chave: "andando", rotulo: "Andando", situacoes: ["andando", "falhou"], tom: "neutro" },
  { chave: "concluidos", rotulo: "Concluídos", situacoes: ["concluido"], tom: "ok" },
]

/** A voz e a palavra de cada situação (COR-03: o que isto pede de você?). */
export const DA_SITUACAO: Record<Situacao, { tom: Tom; palavra: string; emCurso?: boolean }> = {
  "aguarda-voce": { tom: "espera", palavra: "Aguarda você" },
  "com-outros": { tom: "alheio", palavra: "Com outra pessoa" },
  andando: { tom: "neutro", palavra: "Processando", emCurso: true },
  falhou: { tom: "ruim", palavra: "Falhou" },
  concluido: { tom: "ok", palavra: "Concluído" },
}

const P = (numero: string, cliente: string, situacao: Situacao, etapa: string, valor: string, atualizado: string): Pedido => ({
  numero,
  cliente,
  situacao,
  etapa,
  valor,
  atualizado,
})

const PEDIDOS: Pedido[] = [
  P("1042", "Ana Souza", "aguarda-voce", "Conferência", "R$ 1.240,00", "há 2 h"),
  P("1047", "Bruno Lima", "aguarda-voce", "Pagamento", "R$ 389,90", "há 3 h"),
  P("1051", "Carla Dias", "aguarda-voce", "Conferência", "R$ 2.015,50", "ontem"),
  P("1039", "Diego Rocha", "com-outros", "Envio", "R$ 640,00", "há 1 h"),
  P("1044", "Elisa Prado", "com-outros", "Conferência", "R$ 99,00", "há 5 h"),
  P("1053", "Fábio Nunes", "andando", "Pagamento", "R$ 1.780,00", "agora"),
  P("1054", "Gabriela Melo", "andando", "Envio", "R$ 452,30", "há 4 min"),
  P("1055", "Heitor Alves", "falhou", "Pagamento", "R$ 230,00", "há 12 min"),
]

export function cargaDaLista(estado: string | undefined): CargaDaLista {
  switch (estado) {
    case "carregando":
      return { tipo: "carregando" }
    case "erro":
      return { tipo: "erro" }
    case "sem-permissao":
      return { tipo: "sem-permissao" }
    case "vazio":
      return { tipo: "pronto", pedidos: [] }
    case "vazio-filtro":
      return { tipo: "pronto", pedidos: PEDIDOS.filter((p) => p.situacao !== "aguarda-voce") }
    default:
      return { tipo: "pronto", pedidos: PEDIDOS }
  }
}
