// Cenários do `orca plugin check` e do `orca plugin shot` da aba do kit (F436): cada seção cheia, as vazias, a falha
// de leitura e o tema claro. Conteúdo de exemplo, no tom das perguntas reais do painel.
import { defineCheck } from 'orca/testing'
import type { Entrega, Leitura, Pergunta } from './protocol'

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

const leitura = (l: Partial<Leitura> = {}): Leitura =>
  ({ abertas: [], assumidas: [], pendentes: [], ilegiveis: 0, entregas: [], erroDaCaixa: null, caixaAte: null, lidoEm: AGORA - 20_000, ...l })
const cheia = leitura({ abertas, assumidas, entregas })

export default defineCheck({
  vazio: { requests: { 'kit.ler': leitura() } },
  perguntas: { requests: { 'kit.ler': cheia } },
  'perguntas (claro)': { requests: { 'kit.ler': cheia }, theme: 'light' },
  decisoes: { requests: { 'kit.ler': leitura({ assumidas, entregas }) }, persisted: { plugin: { secao: 'decisoes' } } },
  'decisoes (claro)': { requests: { 'kit.ler': leitura({ assumidas, entregas }) }, persisted: { plugin: { secao: 'decisoes' } }, theme: 'light' },
  'perguntas (sem projeto)': { requests: { 'kit.ler': leitura({ abertas: [semProjeto, ...abertas] }) } },
  'decisoes (dois projetos)': { requests: { 'kit.ler': leitura({ assumidas: [...assumidas, ...doOutroProjeto] }) }, persisted: { plugin: { secao: 'decisoes' } } },
  'decisoes (dois projetos, claro)': { requests: { 'kit.ler': leitura({ assumidas: [...assumidas, ...doOutroProjeto] }) }, persisted: { plugin: { secao: 'decisoes' } }, theme: 'light' },
  'perguntas (sem projeto, claro)': { requests: { 'kit.ler': leitura({ abertas: [semProjeto, ...abertas] }) }, theme: 'light' },
  entregas: { requests: { 'kit.ler': leitura({ assumidas, entregas }) }, persisted: { plugin: { secao: 'entregas' } } },
  'entregas com a caixa fora': { requests: { 'kit.ler': leitura({ entregas: entregas.filter((e) => e.origem === 'painel'), erroDaCaixa: 'o Orca não respondeu à leitura da caixa' }) }, persisted: { plugin: { secao: 'entregas' } } },
  'falha ao ler': { requests: { 'kit.ler': () => { throw new Error('worker parado') } } },
})
