// Itens de painel/fila/ lidos em 25/10 (F27, F13, F1, F23, F8, F17, F28, F4, F18), sem os campos que o pane não lê
// (handoff, branch, plano…). Nada foi anonimizado: o conteúdo é o de produção, sem segredo.
export const FILA_REAL: Record<string, Record<string, unknown>> = {
  "F27": {
    "titulo": "painel mostra a fila por tema, não as sessões",
    "atualizadoEm": "2026-10-25T14:04:42.684Z",
    "etapa": "execucao",
    "tema": "orquestracao",
    "donoApelido": "P7",
    "donoLocalId": "local_00000000-0000-4000-8000-0000000000f7",
    "agora": "travas (E4) e desenho do painel (E1) em execução no kit",
    "resumo": "O painel passa a mostrar a fila de pedidos por tema, com o que está em sessão e onde, em vez da lista de sessões.",
    "depois": [
      {
        "texto": "validação das duas fatias"
      },
      {
        "texto": "docs do contrato novo"
      },
      {
        "texto": "limpeza das linhas de sessão"
      }
    ]
  },
  "F13": {
    "titulo": "SPEC-155 fatia 2 (o container) e fatia 5 (o caminho do navegador e o canal)",
    "tema": "editor",
    "etapa": "execucao",
    "prs": [
      1129
    ],
    "donoApelido": "P2",
    "donoLocalId": "local_00000000-0000-4000-8000-0000000000f2",
    "resumo": "O container do editor e o caminho do navegador até a prévia da loja (SPEC-155, fatias 2 e 5).",
    "atualizadoEm": "2026-10-25T13:34:28.409Z"
  },
  "F1": {
    "titulo": "builder: fatias 1 a 8 do editor da loja, até os PRs validados",
    "tema": "editor",
    "etapa": "execucao",
    "prs": [
      1128
    ],
    "donoApelido": "P1",
    "donoLocalId": "local_00000000-0000-4000-8000-0000000000f1",
    "resumo": "As 8 melhorias de tela do editor da loja, fatia por fatia, cada uma até o PR validado.",
    "atualizadoEm": "2026-10-25T13:34:28.409Z"
  },
  "F23": {
    "titulo": "kit de orquestração: fase 1 (generalizar em ~/.claude) — fase 2 (pacote) em estudo na P6",
    "atualizadoEm": "2026-10-25T14:03:47.713Z",
    "etapa": "execucao",
    "tema": "kit",
    "donoLocalId": "local_00000000-0000-4000-8000-0000000000e8",
    "donoApelido": "E8",
    "agora": "K8 migrada; c14 com E8 (nomes orquestracao:<agente> nas travas e prompts + baixos c13); SessionStart/painel conferidos no proximo turno do operador",
    "resumo": "O jeito de orquestrar sessões vira um kit que serve a qualquer projeto, não só ao Alfa."
  },
  "F8": {
    "titulo": "painel do componente da loja: mesmo padrão do DS, menos texto, IA com um ícone",
    "atualizadoEm": "2026-10-25T13:50:15.651Z",
    "etapa": "execucao",
    "tema": "editor",
    "agora": "plano pronto: A e B1 em paralelo; B2 e C depois de #1105/#1099; espera o número do ADR e duas executoras livres",
    "resumo": "O painel do componente da loja passa a seguir o design system: menos texto e a IA reduzida a um ícone."
  },
  "F17": {
    "titulo": "aviso de leitura falha fala de \"descarte\" que ninguém pediu",
    "tema": "editor",
    "etapa": "planejamento",
    "resumo": "O aviso de leitura que falha fala em descartar alterações que ninguém pediu para descartar.",
    "atualizadoEm": "2026-10-25T13:34:28.409Z"
  },
  "F28": {
    "titulo": "executora que termina o turno dizendo \"volto a X\" sem fazer é cobrada",
    "atualizadoEm": "2026-10-25T13:30:16.885Z",
    "feitoEm": "2026-10-25T13:30:16.886Z",
    "etapa": "feito",
    "tema": "orquestracao",
    "agora": "plano aprovado (387 fins de turno, 4 casos reais, 0 falsos positivos); E1 executa; piloto conferido em 01/11",
    "resumo": "A executora que encerra o turno prometendo voltar a algo sem fazer passa a ser cobrada.",
    "depois": [
      {
        "texto": "conferência do piloto em 01/11"
      }
    ]
  },
  "F4": {
    "titulo": "builder fatia 1 (peças do kit): aplicar a crítica ao detalhe do designer",
    "tema": "editor",
    "etapa": "feito",
    "feitoEm": "2026-10-24T16:41:32.109Z",
    "atualizadoEm": "2026-10-25T13:34:28.410Z"
  },
  "F18": {
    "titulo": "comCodigo sem teste de ligação",
    "tema": "editor",
    "etapa": "planejamento",
    "resumo": "Falta um teste que prove que o código do componente chega ligado ao editor; conferir antes se ainda falta.",
    "atualizadoEm": "2026-10-25T13:34:28.409Z"
  }
}

export const TEMAS_REAIS = [
  { id: 'editor', rotulo: 'Editor da loja', projeto: 'alfa' },
  { id: 'motor', rotulo: 'Motor dos jobs', projeto: 'alfa' },
  { id: 'gate', rotulo: 'Gate e testes', projeto: 'alfa' },
  { id: 'orquestracao', rotulo: 'Sessões e painel', projeto: 'alfa' },
  { id: 'kit', rotulo: 'Kit de orquestração', projeto: 'alfa' },
]

const TEMAS_DOS_SINTETICOS = ['editor', 'motor', 'gate', 'orquestracao', 'kit']

/**
 * A fila de 44 itens (F1 a F44): os 9 reais acima e 35 sintéticos, quase todos feitos há dias (só o F13 e o F42 vivem
 * e o F43 e o F44 são do kit). Serve ao pane que lista todos os itens, inclusive os que a leitura de 24 h descarta.
 */
export function filaCompleta(): Record<string, Record<string, unknown>> {
  const fila: Record<string, Record<string, unknown>> = {}
  for (let n = 1; n <= 44; n++) {
    const id = `F${n}`
    if (FILA_REAL[id]) {
      fila[id] = { ...FILA_REAL[id] }
      continue
    }
    const kit = n >= 43
    fila[id] = {
      titulo: `item sintético ${n}`,
      tema: kit ? 'orquestracao' : TEMAS_DOS_SINTETICOS[n % TEMAS_DOS_SINTETICOS.length],
      etapa: n === 42 ? 'planejamento' : n === 44 ? 'design' : n === 43 ? 'execucao' : n % 7 === 0 ? 'descartado' : 'feito',
      feitoEm: n >= 42 ? undefined : '2026-10-20T10:00:00.000Z',
      atualizadoEm: '2026-10-25T13:34:28.409Z',
      projeto: kit ? 'kit-de-orquestracao' : 'alfa',
      ...(n === 43 ? { donoApelido: 'E1', donoLocalId: 'local_00000000-0000-4000-8000-0000000000e1' } : {}),
    }
  }
  fila.F43!.titulo = 'o painel diz o que é cada item citado pelo número'
  fila.F13!.depois = [{ texto: 'fatia 7: produção', item: 'F22' }]

  return fila
}

/** Dois projetos com o mesmo tema de orquestração: o rótulo repete e o projeto desempata. */
export const TEMAS_DOIS_PROJETOS = [
  ...TEMAS_REAIS,
  { id: 'orquestracao', rotulo: 'Sessões e painel', projeto: 'kit-de-orquestracao' },
]
