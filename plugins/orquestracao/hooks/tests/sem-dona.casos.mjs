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

// Tabela da regra "dona a caminho" (F218): cartão de sessão dona esperando o clique, proposto depois de o item ficar sem dono.
const cartao = (itens, minAtras) => ({ itens, propostoEm: min(minAtras) });
const semDono = (minAtras) => ({ etapa: 'planejamento', com: [], historico: hist([min(minAtras), 'planejamento', null]) });
// a dona pegou o item há 120 min e o soltou há 30, sem mudar a etapa (o `painel soltar`)
const soltou = { etapa: 'planejamento', com: [], historico: hist([min(200), 'planejamento', null], [min(120), 'planejamento', 'dona'], [min(30), 'planejamento', null]) };
export const CASOS_A_CAMINHO = [
  { nome: 'sem cartão: não está a caminho', F: 'F7', data: semDono(30), cartoes: [], esperado: false },
  { nome: 'cartão do item proposto há 10 min', F: 'F7', data: semDono(30), cartoes: [cartao(['F7'], 10)], esperado: true },
  { nome: 'cartão de outro item não conta', F: 'F7', data: semDono(30), cartoes: [cartao(['F8'], 10)], esperado: false },
  { nome: 'F70 não é F7', F: 'F7', data: semDono(30), cartoes: [cartao(['F70'], 10)], esperado: false },
  { nome: 'cartão de mais de 12 h venceu', F: 'F7', data: semDono(14 * 60), cartoes: [cartao(['F7'], 13 * 60)], esperado: false },
  { nome: 'cartão sem data legível não conta', F: 'F7', data: semDono(30), cartoes: [{ itens: ['F7'], propostoEm: 'ontem' }], esperado: false },
  { nome: 'cartão de antes de a dona soltar o item é de outra rodada', F: 'F7', data: soltou, cartoes: [cartao(['F7'], 150)], esperado: false },
  { nome: 'cartão de depois de a dona soltar o item conta', F: 'F7', data: soltou, cartoes: [cartao(['F7'], 20)], esperado: true },
  { nome: 'mudar de etapa sem dono não muda o piso', F: 'F7', data: { etapa: 'execucao', com: [], historico: hist([min(60), 'planejamento', null], [min(5), 'execucao', null]) }, cartoes: [cartao(['F7'], 30)], esperado: true },
  { nome: 'sem historico: sem piso, vale o prazo', F: 'F7', data: { etapa: 'design', com: [] }, cartoes: [cartao(['F7'], 10)], esperado: true },
  { nome: 'entradas ruins não derrubam', F: 'F7', data: null, cartoes: [null, { itens: 'F7' }], esperado: false },
];
