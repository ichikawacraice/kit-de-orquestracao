export type Passo = { texto: string; estado: string; detalhe?: string }

export type LinhaSessao = {
  id: string
  projeto: string
  titulo: string
  estado: string
  etapa?: string
  pr?: string
  prUrl?: string
  bloqueio?: string
  /** Por que trava (conflito, gate-vermelho, acesso, operador, outra), quando a linha traz. */
  motivo?: string
  perguntas: string[]
  atualizadoEm?: string
  /** As etapas que a sessão declarou no painel (a terceira coluna do artefato). */
  passos?: Passo[]
  /** A última atividade que o app registra para a sessão (ISO), do list_sessions. */
  ativaEm?: string
  /** O que o list_sessions diz agora; ausente quando a sessão não veio nele. */
  vivo?: { isRunning: boolean; isArchived: boolean; prNumber?: number; prState?: string }
  /** Linha do painel que contradiz o estado vivo, ou sessão viva sem linha. */
  divergencia?: string
  semLinha?: boolean
}

export type PerguntaAberta = {
  id: string
  projeto: string
  sessao: string
  titulo: string
  /** A versão lida, que a resposta usa como `if_version`. */
  versao?: number
  /** As escolhas da pergunta (Q67); a de id `outra` abre um campo de texto. */
  opcoes: Array<{ id: string; label: string }>
  /** A sessão que perguntou: para onde a resposta é enviada. */
  sessaoId?: string
  /** O endereço que abre a sessão no app. */
  link?: string
  /** A pergunta é desta mesma sessão: a resposta entra como prompt dela, não por send_message. */
  propria?: boolean
  caso?: string
  recomendacao?: string
  seNaoDecidir?: string
}

export type PerguntaAnterior = {
  id: string
  titulo: string
  sessao: string
  estado: string
  resposta?: string
  recomendacao?: string
  quando?: string
}

export type Leitura = {
  lidoEm: number | null
  lendo: boolean
  erros: string[]
  /** Falhas de responder (gravar ou entregar à sessão): sobrevivem à releitura, até o botão de limpar. */
  avisos: string[]
  sessoes: LinhaSessao[]
  perguntas: PerguntaAberta[]
  /** As últimas respondidas e canceladas, da mais nova para a mais velha. */
  anteriores: PerguntaAnterior[]
}

declare module 'claude-code' {
  interface PluginState {
    'painel-sessoes': {
      leitura: Leitura
      /** A pergunta com o campo de resposta aberto, ou nenhuma. */
      respondendoEm: string | null
      verAnteriores: boolean
    }
  }
}
