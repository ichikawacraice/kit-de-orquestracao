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
  /** O projeto do documento (minúsculo), que abre o título do cartão; ausente no item legado. */
  projeto?: string
  /** A etapa como veio no documento (pode estar fora da lista: aí `foraDoContrato` explica). */
  etapa: string
  situacao: Situacao
  /** `link` só quando a sessão dona está viva: o endereço que abre a sessão no app. */
  dono?: { apelido: string; localId: string; link?: string }
  /** Quem trabalha agora no item (o `com` do painel). `vivo` é null quando a lista de sessões não veio: nem botão, nem "saiu". */
  com: Array<{ apelido: string; localId: string; oQue: string; vivo: boolean | null; link?: string }>
  /** Esperando o operador ou o gate: não é trava, e o item fica no bloco do tema. */
  espera?: { motivo: 'operador' | 'gate'; texto: string }
  prs: number[]
  /** O que fica para depois; `item` é o F<n> quando o documento o liga a outro item. */
  depois: Array<{ texto: string; item?: string }>
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

/** Um item de qualquer etapa e idade, para resolver número citado e listar todos os itens. */
export type ItemDoIndice = {
  id: string
  titulo: string
  tema: string
  temaProjeto?: string
  temaRotulo: string
  etapa: string
  projeto?: string
}

/** Um F<n> citado num texto: `titulo` ausente quer dizer que a fila não tem o número; `ligado` vem de `depois[].item`. */
export type Citado = { id: string; titulo?: string; ligado: boolean }

export type PerguntaAberta = {
  id: string
  projeto: string
  sessao: string
  titulo: string
  /** O item da fila a que a pergunta se liga (F<n>), quando ela traz. */
  item?: string
  /** `F<n> · <título do item>`, quando a pergunta tem item; senão vale `sessao`. */
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
  /** Quando a pergunta foi gravada pela última vez (ISO). */
  atualizadoEm?: string
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

/** O que o `list_sessions` diz de uma sessão: o bastante para "trabalhando agora" e "parada há X". */
export type SessaoViva = { sessionId: string; isRunning?: boolean; lastActivityAt?: string }

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
  /** Todos os itens da fila, de qualquer etapa e idade (a leitura de 24 h só alcança `itens`). Ausente no estado de antes desta versão. */
  indice?: ItemDoIndice[]
  perguntas: PerguntaAberta[]
  /** As últimas respondidas e canceladas, da mais nova para a mais velha. */
  anteriores: PerguntaAnterior[]
  /** As sessões vivas da última leitura (a do próprio pane inclusive). Ausente no estado de antes desta versão. */
  sessoes?: SessaoViva[]
  /** A lista de sessões, ou a própria sessão, não veio: a situação de cada sessão é "sem leitura da sessão". */
  semLista?: boolean
  /** O modo ausente da última leitura; `null` = o arquivo não se leu (JSON inválido); ausente (undefined) antes da 1ª leitura e no estado de antes desta versão. */
  ausente?: { ligado: boolean; desde?: string; por?: string } | null
}

/** O que a barra de status lê, de leve, a cada 30 s e a cada turno: só arquivos, nunca `list_sessions`. */
export type Barra = {
  lidoEm: number | null
  /** As perguntas com `estado: "aberta"` (todas, como o selo do pane). */
  abertas: number
  /** O pedido `limpar · orquestradora` aberto da orquestradora do projeto, o mais recente. */
  limpeza: PerguntaAberta | null
  /** O Q-ID cujo ok já foi enviado por esta barra; a linha diz "Ok enviado" até a leitura não ver mais a pergunta aberta. */
  okEnviado: string | null
  /** Esta sessão é a orquestradora do projeto. */
  ehOrquestradora: boolean
  titulo: string | null
  item: { id: string; titulo: string; etapa: string } | null
  pool: { e: number; v: number }
  projeto: string | null
  /** `expiraEm` é o fim do cache de 1 h desde a última resposta; `segundos` o que falta (null sem resposta ainda). */
  cache: { expiraEm: number | null; segundos: number | null }
  /** Quantos avisos de cache já saíram nesta resposta (0, 1 aos 10 min, 2 aos 5). */
  avisado: number
  tokens: number | null
  erros: string[]
}

declare module 'claude-code' {
  interface PluginState {
    'painel-sessoes': {
      leitura: Leitura
      /** A pergunta com o campo de resposta aberto, ou nenhuma. */
      respondendoEm: string | null
      verAnteriores: boolean
      verFeitos: boolean
      /** A lista de todos os itens aberta. */
      verTodos: boolean
      /** O texto do campo Achar da lista de todos os itens. */
      filtroTodos: string
      /** Sobe a cada Limpar: o campo nasce vazio (o motor não diz se o Input é controlado). */
      limpezas: number
      /** A resposta em curso: a pergunta e a opção pressionada; null quando nenhuma. */
      enviando: { q: string; opcao: string } | null
      /** O localId da sessão que o botão "abrir" está abrindo; null quando nenhuma. */
      abrindo: string | null
      /** A hora do último tique do relógio que achou a leitura em curso: faz a tela redesenhar enquanto ela pendura. */
      tique: number
      /** O botão do modo está gravando a bandeira: o clique é ignorado até acabar. */
      trocandoModo: boolean
      /** A leitura leve da barra de status acima do prompt. */
      barra: Barra
      /** O `/barra` escondeu a barra nesta sessão. */
      barraEscondida: boolean
    }
  }
}
