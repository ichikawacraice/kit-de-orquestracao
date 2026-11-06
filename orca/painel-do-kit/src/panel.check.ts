// Cenários do `orca plugin check` e do `orca plugin shot` da aba do kit (F436): cada seção cheia, as vazias, a falha
// de leitura e o tema claro. Conteúdo de exemplo, no tom das perguntas reais do painel.
import { defineCheck } from 'orca/testing'
import type { Entrega, GrupoDeSessoes, Leitura, Pergunta, Sessao, VistaDasSessoes } from './protocol'

const AGORA = Date.now()
const iso = (msAtras: number) => new Date(AGORA - msAtras).toISOString()
const MIN = 60_000
const H = 60 * MIN

const base: Pergunta = {
  id: 'Q1', versao: 1, estado: 'aberta', titulo: '', caso: null, seNaoDecidir: null, recomendacao: null,
  item: null, projeto: 'kit-de-orquestracao', sessaoId: null, atualizadoEm: iso(MIN), endereco: null, opcoes: null,
}

const abertas: Pergunta[] = [
  {
    ...base, id: 'Q1071', item: 'F435', titulo: 'F435 · Fila de merge: mergear o PR 171 com o gate de ontem?',
    caso: 'O gate completo passou ontem às 18:40 sobre a combinação 168+171. Hoje entrou o 172, que não toca os mesmos arquivos.',
    seNaoDecidir: 'O 171 espera o próximo gate, umas 2 h.',
    recomendacao: 'Rodar o gate de novo só sobre 171+172: 6 min, e ninguém mergeia sobre árvore não testada.',
    atualizadoEm: iso(42 * MIN), endereco: 'dispatch:ctx_8a1f',
  },
  {
    ...base, id: 'Q1074', item: 'F437', titulo: 'F437 · O resumo da manhã inclui as sessões arquivadas?',
    caso: 'Hoje o resumo lista 14 sessões; 9 estão arquivadas desde ontem.',
    seNaoDecidir: 'Sai como está, com as 14.', recomendacao: 'Só as vivas, com uma linha "9 arquivadas" no pé.',
    atualizadoEm: iso(8 * MIN),
  },
]

const assumidas: Pergunta[] = [
  { ...base, id: 'Q1062', estado: 'assumida', item: 'F436', titulo: 'Usar o trilho de ícones em vez de abas no topo', recomendacao: 'Trilho de 44 px com contagem por seção; abas no topo cortam o nome na largura da barra lateral.', atualizadoEm: iso(2 * H) },
  { ...base, id: 'Q1063', estado: 'assumida', item: 'F436', titulo: 'Limpar a entrega não apaga nada', recomendacao: 'Fica só no armazenamento do plugin, com desfazer por 10 s e a lista das limpas ao pé.', atualizadoEm: iso(2 * H) },
  { ...base, id: 'Q1066', estado: 'assumida', item: 'F436', titulo: 'Releitura a cada 30 s com a aba visível', recomendacao: 'Ler não aciona modelo: só arquivos do painel e o CLI do Orca em modo leitura, com cache de 60 s para a caixa.', atualizadoEm: iso(3 * H) },
  { ...base, id: 'Q1058', estado: 'assumida', item: 'F433', titulo: 'Contador de perguntas no status do Orca', recomendacao: 'Mostra só as abertas; as decisões a confirmar não entram, para o número significar "alguém está esperando".', atualizadoEm: iso(26 * H) },
]

const entregas: Entrega[] = [
  {
    chave: 'e1', chaves: ['e1', 'painel:F432'], origem: 'painel', item: 'F432', titulo: 'F432 · Comandos recusam opção desconhecida', projeto: 'kit-de-orquestracao',
    em: iso(35 * MIN), sessao: 'dona-f432', prs: [169], corpo: null, seguimento: { destino: 'run:run_7f75', quem: 'coordenadora' },
    entrega: { resultado: 'Os 23 comandos do kit agora recusam opção que não conhecem, com a lista das válidas na mensagem.', medido: '23 comandos testados com uma opção inventada; 23 recusas.', naoMedido: 'o comando antigo `painel-sync`, que sai na próxima versão.', proximos: null },
  },
  {
    chave: 'e2', chaves: ['e2'], origem: 'orca', item: 'F431', titulo: 'F431 · subir-versao empurra o commit já feito', projeto: 'kit-de-orquestracao',
    em: iso(3 * H), sessao: 'dona-f431', prs: [168], seguimento: { destino: 'dispatch:ctx_51c2', quem: 'sessao' },
    corpo: 'PR 168 pronto. O --empurrar agora detecta o commit de versão feito e não empurrado e o empurra sem criar outro. Teste novo cobre o caso; o resto do subir-versao não mudou.',
  },
  {
    chave: 'e3', chaves: ['e3'], origem: 'orca', item: null, titulo: 'README reescrito com instalação em 3 passos', projeto: 'kit-de-orquestracao',
    em: iso(27 * H), sessao: null, prs: [], seguimento: null, corpo: 'README novo: instalação, os dois plugins, configuração e o uso do dia a dia.',
  },
]

const doOutroProjeto: Pergunta[] = [
  { ...base, id: 'Q2010', estado: 'assumida', item: 'F12', projeto: 'Izanagi', titulo: 'F12 · Carrinho guarda o CEP entre as visitas', recomendacao: 'Guardar o CEP por 30 dias no armazenamento local, sem cookie.', atualizadoEm: iso(5 * H) },
  { ...base, id: 'Q2011', estado: 'assumida', item: 'F12', projeto: 'Izanagi', titulo: 'F12 · Frete grátis acima de R$ 299', recomendacao: 'Mostrar a barra de progresso no carrinho e na página do produto.', atualizadoEm: iso(5 * H) },
  { ...base, id: 'Q2013', estado: 'assumida', item: 'F12', projeto: 'kit-de-orquestracao', titulo: 'F12 · Rodapé do painel com a versão', recomendacao: 'Mostrar só a versão do plugin, sem o hash.', atualizadoEm: iso(4 * H) },
  { ...base, id: 'Q2012', estado: 'assumida', item: null, projeto: null, titulo: 'Troca do nome da tabela de logs', recomendacao: 'Manter o nome antigo até a próxima janela.', atualizadoEm: iso(30 * H) },
]
const semProjeto: Pergunta = { ...abertas[1], id: 'Q1075', projeto: null, item: null, titulo: 'Qual fuso mostrar nos horários do relatório?', caso: 'Hoje sai em UTC e a equipe lê em São Paulo.', recomendacao: 'São Paulo.' }
const sessao = (item: string, titulo: string, extra: Partial<Sessao> = {}): Sessao => ({
  item, titulo, nome: `${item} · ${titulo}`, projeto: 'kit-de-orquestracao', etapa: 'execucao', estado: 'trabalhando', subEtapa: 'execucao',
  tipoDeParada: null, motivo: null, prNaFila: null, posicaoNaFila: null, foraDaFila: false, desdeEm: iso(12 * MIN), agora: null, notaEm: null,
  rodando: false, perguntas: [], prs: { abertos: [], mergeados: [] }, fatia: null, todasFeitas: false, etapas: [], feitasJuntas: 0, maisBolinhas: 0,
  dependeDe: [], ...extra,
})
const esteira = (agora: number) => ['planejamento', 'execução', 'validação', 'merge', 'entregue']
  .map((nome, i) => ({ nome, estado: i < agora ? 'feito' as const : i === agora ? 'agora' as const : 'falta' as const }))

const izanagi: GrupoDeSessoes = {
  projeto: 'izanagi', filaIlegivel: false, sessoes: [
    sessao('F442', 'Izanagi 2.0 · S7: checkout e vale-troca na loja nova', {
      projeto: 'izanagi', estado: 'esperando', motivo: 'pausado pelo operador para trocar de conta do gateway', desdeEm: iso(5 * H), etapas: esteira(1),
    }),
    sessao('F411', 'Izanagi 2.0: estudo e plano da troca de checkout', {
      projeto: 'izanagi', estado: 'mergeando', etapa: 'merge', prNaFila: 1716, desdeEm: iso(6 * MIN), prs: { abertos: [1716], mergeados: [] }, etapas: esteira(3),
    }),
    sessao('F441', 'Izanagi 2.0 · S6: migração do status do pedido', {
      projeto: 'izanagi', fatia: { atual: 3, total: 4 }, agora: 'medindo a S6 contra a base de ontem', notaEm: iso(2 * MIN), desdeEm: iso(2 * MIN),
      prs: { abertos: [], mergeados: [1702, 1709] }, dependeDe: ['F440'],
      etapas: [{ nome: 'Contrato do status', estado: 'feito' }, { nome: 'Leitura antiga', estado: 'feito' }, { nome: 'Migração', estado: 'agora' }, { nome: 'Limpeza', estado: 'falta' }],
    }),
    sessao('F430', 'Izanagi: frete por região no carrinho', { projeto: 'izanagi', estado: 'entregue', etapa: 'feito', desdeEm: iso(3 * H), prs: { abertos: [], mergeados: [1698] } }),
  ],
}
const kit: GrupoDeSessoes = {
  projeto: 'kit-de-orquestracao', filaIlegivel: false, sessoes: [
    sessao('F445', 'Fila de merge: gate sobre a combinação', { estado: 'parada', tipoDeParada: 'gate-vermelho', motivo: '2 testes vermelhos em painel-mergear', desdeEm: iso(20 * MIN), etapas: esteira(3) }),
    sessao('F453', 'Resumo da manhã com as sessões arquivadas', { estado: 'parada', tipoDeParada: 'sem-dona', etapa: 'planejamento', desdeEm: iso(40 * MIN), etapas: esteira(0) }),
    sessao('F439', 'Modo Orca: a sessão do Orca no painel', { estado: 'na-fila', etapa: 'merge', prNaFila: 173, foraDaFila: true, desdeEm: iso(5 * H), prs: { abertos: [173], mergeados: [168, 165] }, etapas: esteira(3) }),
    sessao('F452', 'Aba nova "Sessões" no Orca', { estado: 'validando', etapa: 'validacao', agora: 'rodando o validador', notaEm: iso(4 * MIN), desdeEm: iso(4 * MIN), etapas: esteira(2) }),
  ],
}
const sessoes = (v: Partial<VistaDasSessoes> = {}): VistaDasSessoes =>
  ({ projetos: [izanagi, kit], paradas: 3, ilegiveis: 0, batidaEm: iso(MIN), erro: null, lidoEm: AGORA - 20_000, ...v })
const semSessoes = sessoes({ projetos: [], paradas: 0 })

const leitura = (l: Partial<Leitura> = {}): Leitura =>
  ({ abertas: [], assumidas: [], pendentes: [], ilegiveis: 0, entregas: [], erroDaCaixa: null, caixaAte: null, sessoes: semSessoes, lidoEm: AGORA - 20_000, ...l })
const cheia = leitura({ abertas, assumidas, entregas })

// O cenário não aperta botão e a aba não grava a seção: só Sessões (a de abertura) e o vazio se desenham aqui; as
// outras seções, com o trilho apertado, são montadas e checadas por `orca plugin test` (panel.test.tsx).
export default defineCheck({
  vazio: { requests: { 'kit.ler': leitura() } },
  'entregas com a caixa fora': { requests: { 'kit.ler': leitura({ entregas: entregas.filter((e) => e.origem === 'painel'), erroDaCaixa: 'o Orca não respondeu à leitura da caixa' }) }, persisted: { plugin: { secao: 'entregas' } } },
  sessoes: { requests: { 'kit.ler': leitura({ entregas, sessoes: sessoes() }) } },
  'sessoes (claro)': { requests: { 'kit.ler': leitura({ entregas, sessoes: sessoes() }) }, theme: 'light' },
  'sessoes com o estado velho': { requests: { 'kit.ler': leitura({ sessoes: sessoes({ batidaEm: iso(40 * MIN), projetos: [{ ...kit, filaIlegivel: true }] }) }) } },
  'sessoes vazias': { requests: { 'kit.ler': leitura() } },
  'sessoes nao lidas': { requests: { 'kit.ler': leitura({ sessoes: sessoes({ projetos: [], erro: 'o worker não leu a pasta do painel' }) }) } },
  'falha ao ler': { requests: { 'kit.ler': () => { throw new Error('worker parado') } } },
})
