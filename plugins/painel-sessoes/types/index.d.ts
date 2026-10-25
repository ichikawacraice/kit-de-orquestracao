export type Tema = { id: string; rotulo: string; projeto?: string }

/** Em que pé está o item: dono vivo sem trava, dono vivo com trava (ou sem ninguém), sem dono, ou feito nas últimas 24 h. */
export type Situacao = 'andando' | 'travado' | 'fila' | 'feito'

export type LinhaItem = {
  id: string
  titulo: string
  resumo?: string
  /** O id do tema, ou 'sem-tema' quando o item não cabe em `temas.json`. */
  tema: string
  /** O projeto do tema que casou (ausente em tema global e em 'sem-tema'): o grupo é (projeto, id). */
  temaProjeto?: string
  temaRotulo: string
  /** A etapa como veio no documento (pode estar fora da lista: aí `foraDoContrato` explica). */
  etapa: string
  situacao: Situacao
  /** `link` só quando a sessão dona está viva: o endereço que abre a sessão no app. */
  dono?: { apelido: string; localId: string; link?: string }
  prs: number[]
  depois: string[]
  agora?: string
  /** `sem-ninguem` só o mod produz, ao desenhar. */
  trava?: { motivo: string; texto: string }
  /** As perguntas ABERTAS ligadas ao item (pelo item ou pela pergunta). */
  perguntas: string[]
  atualizadoEm?: string
  /** Desde quando está sem dono: a última entrada do histórico, ou a última gravação. */
  paradoDesde?: string
  feitoEm?: string
  foraDoContrato?: string
}

export type PerguntaAberta = {
  id: string
  projeto: string
  sessao: string
  titulo: string
  /** O item da fila a que a pergunta se liga (F<n>), quando ela traz. */
  item?: string
  /** `<tema> · <título do item>`, quando a pergunta tem item; senão vale `sessao`. */
  rotulo?: string
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
  /** Todos os itens lidos: em sessão (andando e travado), na fila e feitos nas últimas 24 h. */
  itens: LinhaItem[]
  /** A lista fechada de temas, na ordem de `temas.json`. */
  temas: Tema[]
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
      verFeitos: boolean
    }
  }
}
