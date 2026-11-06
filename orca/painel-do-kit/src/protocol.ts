// Contrato entre o painel e o worker da aba do kit (F436). Os tipos de `orca` não vêm nesta build do Orca
// (`orca plugin types` falha): a declaração abaixo vale quando vierem e é apagada pelo transpilador até lá.
export type Pergunta = {
  id: string
  versao: number
  estado: 'aberta' | 'assumida'
  titulo: string
  caso: string | null
  seNaoDecidir: string | null
  recomendacao: string | null
  item: string | null
  projeto: string | null
  sessaoId: string | null
  atualizadoEm: string | null
  endereco: string | null
  /** As opções da pergunta, na ordem (a recomendada primeiro); `outra` libera a resposta livre. Sem opções, null. */
  opcoes: { id: string; label: string }[] | null
}

export type Entrega = {
  chave: string
  chaves: string[]
  origem: 'painel' | 'orca'
  item: string | null
  titulo: string
  projeto: string | null
  em: string
  sessao: string | null
  prs?: number[]
  entrega?: { resultado: string; medido?: string; naoMedido?: string; proximos?: string }
  corpo?: string
  run?: string | null
  dispatchId?: string | null
  vivo?: boolean
  resultado?: string | null
  orca?: Entrega
  runDoProjeto?: string | null
  /** Para onde vai o "Responder…" desta entrega, calculado no worker; `null` quando não há rota. */
  seguimento?: { destino: string; quem: 'sessao' | 'coordenadora' } | null
}

/** Respondida por esta aba cuja entrega à sessão ainda não saiu. */
export type Pendente = Pergunta & { resposta: string; estadoAnterior: 'aberta' | 'assumida'; entregaDaResposta: EstadoDaEntrega }

export type Leitura = {
  abertas: Pergunta[]
  assumidas: Pergunta[]
  pendentes: Pendente[]
  ilegiveis: number
  entregas: Entrega[]
  erroDaCaixa: string | null
  /** Quando a caixa do Orca passa do limite lido: a data da mensagem mais velha que entrou (as entregas do Orca vão até ela). */
  caixaAte: string | null
  lidoEm: number
}

export type EstadoDaEntrega = { estado: 'entregue' | 'pendente' | 'falhou'; via: 'orca'; destino?: string; em: string; motivo?: string }
export type Resultado = { gravou: true; entrega: EstadoDaEntrega } | { gravou: false; motivo: string; codigo: string }

declare module 'orca' {
  interface PluginRequests {
    'kit.ler': { input: { forcar?: boolean }; output: Leitura }
    'kit.responder': { input: { id: string; versao: number; esperado: 'aberta' | 'assumida'; resposta: string }; output: Resultado }
    'kit.confirmar': { input: { itens: { id: string; versao: number }[] }; output: { confirmadas: string[]; recusadas: { id: string; motivo: string }[]; versoes: Record<string, number> } }
    'kit.desfazer': { input: { itens: { id: string; versao: number }[] }; output: { desfeitas: string[]; recusadas: { id: string; motivo: string }[] } }
    'kit.reentregar': { input: { id: string }; output: EstadoDaEntrega }
    'kit.seguimento': { input: { destino: string; titulo: string; texto: string }; output: { ok: boolean; motivo?: string } }
  }
}

/** Quanto o worker espera o terminal de envio confirmar a entrega. */
export const ESPERA_ENVIO_MS = 30_000
/** O prazo dos pedidos do painel que enviam: a espera do envio, mais folga para abrir o terminal e gravar (o Orca aceita até 120 s). */
export const PRAZO_DO_ENVIO_MS = 90_000
/** Quantas mensagens da caixa do Orca a aba lê por vez. */
export const LIMITE_DA_CAIXA = 1000
