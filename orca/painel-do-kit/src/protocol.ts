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

/** O estado gravado de uma pergunta que a aba mandou responder (F450): a verdade quando a resposta do worker se perde. */
export type Acompanhada = {
  estado: string
  versao: number
  resposta: string | null
  respondidaPor: string | null
  respondidaEm: string | null
  entregaDaResposta: EstadoDaEntrega | null
}
/** Uma sessão dona e o seu item, como a seção Sessões a mostra (F452). */
export type EstadoDaSessao = 'esperando' | 'parada' | 'mergeando' | 'na-fila' | 'validando' | 'trabalhando' | 'entregue'
export type Bolinha = { nome: string; estado: 'feito' | 'agora' | 'falta' }
export type Sessao = {
  item: string
  titulo: string
  nome: string
  projeto: string | null
  /** A etapa que vale: a deduzida, ou a declarada quando o estado deduzido falta ou passou de 25 min. */
  etapa: string | null
  estado: EstadoDaSessao
  /** No trabalhando: planejamento, design ou execucao. */
  subEtapa: string | null
  /** Na parada: o motivo da trava (conflito, gate-vermelho, outra), falhou (a sessão do Orca), sem-dona ou sem-movimento. */
  tipoDeParada: string | null
  /** No esperando: `item` quando a sessão espera outro item ou PR (nada a decidir pela pessoa); null quando quem espera é a pessoa. */
  tipoDeEspera: 'item' | null
  /** O texto da trava ou da espera. */
  motivo: string | null
  /** O PR do item que está na fila (ou fora dela, no merge). */
  prNaFila: number | null
  /** 1 é o próximo do gate: conta os em voo antes dos pendentes. */
  posicaoNaFila: number | null
  /** Na etapa merge, com PR aberto que ninguém anotou na fila. */
  foraDaFila: boolean
  /** Desde quando vale o estado: a pergunta, a trava, a última atividade ou o início do gate. O painel conta o tempo. */
  desdeEm: string | null
  agora: string | null
  /** A idade da nota (`agora`). */
  notaEm: string | null
  /** A sessão está rodando agora: o app diz `isRunning`; no Orca a batida deduz pelo estado do agente em `worktree ps` (F470). */
  rodando: boolean
  perguntas: { id: string; titulo: string }[]
  prs: { abertos: number[]; mergeados: number[] }
  fatia: { atual: number; total: number | null } | null
  /** Todas as fatias têm PR mergeado e o item segue aberto. */
  todasFeitas: boolean
  etapas: Bolinha[]
  /** Com mais de 7 fatias: quantas feitas se juntam numa linha e quantas das que faltam não aparecem. */
  feitasJuntas: number
  maisBolinhas: number
  /** Os itens de que este depende e que ainda não fecharam. */
  dependeDe: string[]
}
export type GrupoDeSessoes = { projeto: string | null; filaIlegivel: boolean; sessoes: Sessao[] }
export type VistaDasSessoes = {
  projetos: GrupoDeSessoes[]
  /** O número do trilho: paradas e esperas sem pergunta aberta (Perguntas já conta as outras). */
  paradas: number
  ilegiveis: number
  /** Quando o estado deduzido foi gravado; null sem ele ou com a data no futuro. */
  batidaEm: string | null
  /** A leitura das sessões falhou, sem derrubar a aba. */
  erro: string | null
  lidoEm: number
}

/** Um plugin do kit com versão publicada mais nova que a instalada (F463). */
export type AtualizacaoDoKit = { nome: string; instalada: string; publicada: string }

export type Leitura = {
  abertas: Pergunta[]
  assumidas: Pergunta[]
  pendentes: Pendente[]
  ilegiveis: number
  entregas: Entrega[]
  erroDaCaixa: string | null
  /** Quando a caixa do Orca passa do limite lido: a data da mensagem mais velha que entrou (as entregas do Orca vão até ela). */
  caixaAte: string | null
  sessoes: VistaDasSessoes
  /** O que o kit publicou de mais novo que o instalado; vazio quando está em dia (ou sem como conferir). */
  atualizacao: AtualizacaoDoKit[]
  lidoEm: number
  /** Só quando a aba pediu `acompanhar`: o estado gravado de cada id; `null` para a que sumiu. */
  acompanhadas?: Record<string, Acompanhada | null>
}

/** Uma sessão dona concluída que passa nas condições do arquivar (F469). */
export type Concluida = { item: string; titulo: string }
/** As concluídas que o `painel orquestradora arquivar --concluidas --seco` diz que dá para arquivar; `erro` quando não deu para conferir. */
export type ConcluidasLidas = { aptas: Concluida[]; erro: string | null; lidoEm: number }
/** O desfecho de arquivar: o que saiu, o que o script recusou (com o motivo) e o erro de quem não conseguiu nem tentar. */
export type DesfechoDoArquivar = { arquivadas: Concluida[]; recusadas: (Concluida & { motivo: string })[]; erro: string | null }

export type EstadoDaEntrega = { estado: 'entregue' | 'pendente' | 'falhou'; via: 'orca'; destino?: string; em: string; motivo?: string }
export type Resultado = { gravou: true; entrega: EstadoDaEntrega } | { gravou: false; motivo: string; codigo: string }

declare module 'orca' {
  interface PluginRequests {
    'kit.ler': { input: { forcar?: boolean; acompanhar?: string[] }; output: Leitura }
    'kit.responder': { input: { id: string; versao: number; esperado: 'aberta' | 'assumida'; resposta: string }; output: Resultado }
    'kit.confirmar': { input: { itens: { id: string; versao: number }[] }; output: { confirmadas: string[]; recusadas: { id: string; motivo: string }[]; versoes: Record<string, number> } }
    'kit.desfazer': { input: { itens: { id: string; versao: number }[] }; output: { desfeitas: string[]; recusadas: { id: string; motivo: string }[] } }
    'kit.reentregar': { input: { id: string }; output: EstadoDaEntrega }
    'kit.concluidas': { input: { forcar?: boolean }; output: ConcluidasLidas }
    'kit.arquivar': { input: { itens: string[] }; output: DesfechoDoArquivar }
    'kit.seguimento': { input: { destino: string; titulo: string; texto: string }; output: { ok: boolean; motivo?: string } }
  }
}

/** Quanto o worker junta as respostas ao mesmo destino numa mensagem só, contado da primeira (F448). */
export const JANELA_DA_ENTREGA_MS = 5_000
/** Quanto o worker espera o terminal de envio confirmar a entrega. */
export const ESPERA_ENVIO_MS = 30_000
/** O prazo dos pedidos do painel que enviam: a janela do lote e a espera do envio, mais folga para abrir o terminal e gravar (o Orca aceita até 120 s). */
export const PRAZO_DO_ENVIO_MS = 90_000
/** O prazo dos pedidos de arquivar: o teto que o Orca aceita (120 s); cada concluída confere git e gh e chama o Orca. */
export const PRAZO_DO_ARQUIVAR_MS = 120_000
/** Quantas mensagens da caixa do Orca a aba lê por vez. */
export const LIMITE_DA_CAIXA = 1000
