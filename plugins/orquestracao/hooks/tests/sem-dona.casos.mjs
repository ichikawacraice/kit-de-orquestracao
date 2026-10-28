// Tabela de casos da regra "item sem dona", compartilhada pelo teste da função `.mjs` e pelo de concordância com a cópia
// `.ts` do pane. `agora` fixo; `esperado` é o retorno inteiro.
export const AGORA = Date.parse('2026-10-26T06:00:00.000Z');
const min = (n) => new Date(AGORA - n * 60_000).toISOString();
const hist = (...e) => e.map(([em, etapa, dono]) => ({ em, etapa, dono }));

export const CASOS = [
  { nome: 'planejamento sem dona e com vazio: sem dona desde a entrada na etapa',
    data: { etapa: 'planejamento', donoLocalId: null, com: [], historico: hist([min(15), 'planejamento', null]) },
    esperado: { desde: min(15), minutos: 15 } },
  { nome: 'execucao sem dona: sem dona desde a entrada na etapa, não desde a última gravação',
    data: { etapa: 'execucao', com: [], historico: hist([min(60), 'planejamento', 'dona'], [min(35), 'execucao', null]), atualizadoEm: min(1) },
    esperado: { desde: min(35), minutos: 35 } },
  { nome: 'com a dona: não está sem dona',
    data: { etapa: 'execucao', donoLocalId: 'local_x', donoApelido: 'dona', com: [{ localId: 'local_x', apelido: 'dona' }], historico: hist([min(35), 'execucao', 'dona']) },
    esperado: null },
  { nome: 'sem dono mas com alguém no com: não está sem dona',
    data: { etapa: 'validacao', com: [{ localId: 'local_y', apelido: 'dona' }], historico: hist([min(35), 'validacao', null]) },
    esperado: null },
  { nome: 'com espera: parado de propósito',
    data: { etapa: 'execucao', espera: { motivo: 'operador' }, com: [], historico: hist([min(35), 'execucao', null]) },
    esperado: null },
  { nome: 'com trava: parado de propósito',
    data: { etapa: 'design', trava: { motivo: 'conflito' }, com: [], historico: hist([min(35), 'design', null]) },
    esperado: null },
  { nome: 'merge: a dona só espera a fila',
    data: { etapa: 'merge', com: [], historico: hist([min(35), 'merge', null]) },
    esperado: null },
  { nome: 'feito: final',
    data: { etapa: 'feito', com: [], historico: hist([min(35), 'feito', null]) },
    esperado: null },
  { nome: 'sem etapa: fora da regra',
    data: { com: [], atualizadoEm: min(35) },
    esperado: null },
  { nome: 'etapa repetida: vale a primeira da sequência final',
    data: { etapa: 'execucao', com: [], historico: hist([min(90), 'execucao', 'dona'], [min(70), 'validacao', 'dona'], [min(50), 'execucao', 'dona'], [min(40), 'execucao', null]) },
    esperado: { desde: min(50), minutos: 50 } },
  { nome: 'sem historico: usa atualizadoEm',
    data: { etapa: 'design', com: [], atualizadoEm: min(7) },
    esperado: { desde: min(7), minutos: 7 } },
  { nome: 'historico sem data legível: não dá para saber',
    data: { etapa: 'execucao', com: [], historico: [{ em: 'ontem', etapa: 'execucao' }] },
    esperado: null },
];

// Tabela da regra "dona a caminho" (F218): cartão de sessão dona esperando o clique ou sessão viva `F<n> · …` do item.
const cartao = (itens, minAtras) => ({ itens, propostoEm: min(minAtras) });
const viva = (title, isArchived = false, criada = 1) => ({ title, isArchived, createdAt: min(criada) });
export const CASOS_A_CAMINHO = [
  { nome: 'nada: não está a caminho', F: 'F7', cartoes: [], sessoes: [], esperado: false },
  { nome: 'cartão do item proposto há 10 min', F: 'F7', cartoes: [cartao(['F7'], 10)], sessoes: [], esperado: true },
  { nome: 'cartão de outro item não conta', F: 'F7', cartoes: [cartao(['F8'], 10)], sessoes: [], esperado: false },
  { nome: 'cartão de mais de 12 h venceu', F: 'F7', cartoes: [cartao(['F7'], 13 * 60)], sessoes: [], esperado: false },
  { nome: 'cartão sem data legível não conta', F: 'F7', cartoes: [{ itens: ['F7'], propostoEm: 'ontem' }], sessoes: [], esperado: false },
  { nome: 'sessão viva do item, ainda sem se gravar', F: 'F7', cartoes: [], sessoes: [viva('F7 · editor da loja')], esperado: true },
  { nome: 'sessão arquivada do item não conta', F: 'F7', cartoes: [], sessoes: [viva('F7 · editor da loja', true)], esperado: false },
  { nome: 'F70 não é F7', F: 'F7', cartoes: [cartao(['F70'], 10)], sessoes: [viva('F70 · outro')], esperado: false },
  { nome: 'sessão da dona que soltou o item (criada antes de ele ficar sem dona) não conta', F: 'F7', desde: min(30), cartoes: [], sessoes: [viva('F7 · editor da loja', false, 90)], esperado: false },
  { nome: 'sessão aberta depois de o item ficar sem dona conta', F: 'F7', desde: min(30), cartoes: [], sessoes: [viva('F7 · editor da loja', false, 5)], esperado: true },
  { nome: 'sem createdAt, vale lastActivityAt: parada desde antes de o item ficar sem dona não conta', F: 'F7', desde: min(30), cartoes: [], sessoes: [{ title: 'F7 · x', isArchived: false, lastActivityAt: min(45) }], esperado: false },
  { nome: 'sessão sem data nenhuma não conta', F: 'F7', cartoes: [], sessoes: [{ title: 'F7 · x', isArchived: false }], esperado: false },
  { nome: 'cartão proposto antes de o item ficar sem dona não conta', F: 'F7', desde: min(30), cartoes: [cartao(['F7'], 60)], sessoes: [], esperado: false },
  { nome: 'cartão proposto depois de o item ficar sem dona conta', F: 'F7', desde: min(30), cartoes: [cartao(['F7'], 10)], sessoes: [], esperado: true },
  { nome: 'entradas ruins não derrubam', F: 'F7', cartoes: [null, { itens: 'F7' }], sessoes: [null, { title: 7 }], esperado: false },
];
