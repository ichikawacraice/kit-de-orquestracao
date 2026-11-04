// A lista das peças do registro Wicomm — de onde sai o `registry.json`.
// Cada peça diz o que instala (arquivos), o que pede do npm e de quem depende no
// próprio registro. O estilo (os tokens) é gerado de @wicomm/tokens e entra
// como dependência de toda peça: `shadcn add @wicomm/<peça>` num projeto vazio
// já traz o tema junto.

/** As dependências do npm, com versão fixa: a peça instalada num projeto é a mesma que o teste rodou. */
export const NPM = {
  radix: 'radix-ui@1.8.1',
  lucide: 'lucide-react@1.57.0',
  cva: 'class-variance-authority@0.7.1',
  clsx: 'clsx@2.1.1',
  merge: 'tailwind-merge@3.7.0',
  animar: 'tw-animate-css@1.4.0',
}

const ui = (nome) => ({ path: `registry/design-system/ui/${nome}.tsx`, type: 'registry:ui' })
const lib = (nome, ext = 'ts') => ({ path: `registry/design-system/lib/${nome}.${ext}`, type: 'registry:lib' })

const doBloco = (bloco, nome, type, ext = 'tsx') => ({ path: `registry/design-system/blocks/${bloco}/${nome}.${ext}`, type })
const comp = (bloco, nome) => doBloco(bloco, nome, 'registry:component')
const dados = (bloco, nome) => doBloco(bloco, nome, 'registry:lib', 'ts')
/** A página de exemplo, no lugar dela no App Router (`target`). Só ela conhece o Next. */
const pagina = (bloco, nome, target) => ({ ...doBloco(bloco, nome, 'registry:page'), target })

/** Um bloco de tela: componentes, os dados de exemplo e a página que o mostra. */
const bloco = ({ name, title, description, npm = [], pecas = [], files }) => ({
  name,
  type: 'registry:block',
  title,
  description,
  ...(npm.length ? { dependencies: npm } : {}),
  registryDependencies: ['@wicomm/estilo', ...pecas.map((p) => `@wicomm/${p}`)],
  files,
})

/** Uma peça: toda peça depende do estilo, e das outras peças pelo nome no registro. */
const peca = ({ name, title, description, npm = [], pecas = [], files }) => ({
  name,
  type: files[0].type,
  title,
  description,
  ...(npm.length ? { dependencies: npm } : {}),
  registryDependencies: ['@wicomm/estilo', ...pecas.map((p) => `@wicomm/${p}`)],
  files,
})

/**
 * As peças. A descrição começa pelo nome do equivalente no shadcn (`button`,
 * `card`, `dropdown-menu`): quem procura pelo nome do shadcn acha a peça da
 * Wicomm.
 */
export const PECAS = [
  peca({
    name: 'idioma-de-cor',
    title: 'Idioma de cor',
    description: 'tone/status colors — as cinco vozes (ok, espera, ruim, neutro, alheio) e as classes de cada uma, num arquivo só (COR-03, COR-05).',
    files: [lib('idioma-de-cor')],
  }),
  peca({
    name: 'button',
    title: 'Botão',
    description: 'button — o botão: escala sm/default/lg/xl/icon e as variantes de forma (primário, secundário, contorno, quieto, destrutivo em contorno, link).',
    npm: [NPM.radix, NPM.cva],
    files: [ui('button')],
  }),
  peca({
    name: 'input',
    title: 'Campo',
    description: 'input — o campo: altura e raio do botão, contorno de controle que paga 3:1, tamanho xl da tela de Entrada; classeDoCampo() para o controle nativo.',
    files: [ui('input')],
  }),
  peca({
    name: 'label',
    title: 'Rótulo',
    description: 'label — o rótulo de campo nas duas vozes: rotulo (maiúsculas espaçadas) e campo (13px, para rótulo que é conteúdo).',
    npm: [NPM.radix, NPM.cva],
    files: [ui('label')],
  }),
  peca({
    name: 'select',
    title: 'Seletor',
    description: 'select — o seletor: gatilho com a forma do campo e a lista numa superfície flutuante.',
    npm: [NPM.radix, NPM.lucide],
    files: [ui('select')],
  }),
  peca({
    name: 'card',
    title: 'Cartão',
    description: 'card — o cartão: a peça opaca levantada por sombra, sem contorno.',
    files: [ui('card')],
  }),
  peca({
    name: 'secao',
    title: 'Seção',
    description: 'section — o assunto dentro de uma peça, separado por ar e rótulo (30px acima, 12px abaixo), e o topo de painel.',
    files: [ui('secao')],
  }),
  peca({
    name: 'painel',
    title: 'Painel',
    description: 'card/panel — o painel de tela de trabalho que rola por conta própria, e a seção em painel.',
    pecas: ['secao'],
    files: [ui('painel')],
  }),
  peca({
    name: 'bloco',
    title: 'Bloco',
    description: 'card with heading — um assunto de tela: o nome solto sobre o fundo e um cartão com o conteúdo; recolhível com resumo.',
    npm: [NPM.lucide],
    files: [ui('bloco')],
  }),
  peca({
    name: 'bloco-de-tinta',
    title: 'Bloco de tinta',
    description: 'callout/alert — o degrau de tinta da voz, sem contorno, no lugar de um cartão dentro de cartão; e o grupo de tinta.',
    pecas: ['idioma-de-cor'],
    files: [ui('bloco-de-tinta')],
  }),
  peca({
    name: 'dialog',
    title: 'Diálogo',
    description: 'dialog — o diálogo curto, o longo (cabeçalho e rodapé fixos, com modo que bloqueia) e o lateral não modal.',
    npm: [NPM.radix, NPM.lucide],
    files: [ui('dialog')],
  }),
  peca({
    name: 'confirm-dialog',
    title: 'Confirmação',
    description: 'alert-dialog/confirm — useConfirm(), no lugar do window.confirm: título, o que não se desfaz, destrutivo em contorno, alternativa branda; com onConfirmar, a ação roda com o diálogo aberto e a falha aparece nele (MSG-04).',
    npm: [NPM.lucide],
    pecas: ['button', 'dialog', 'idioma-de-cor'],
    files: [ui('confirm-dialog')],
  }),
  peca({
    name: 'tooltip',
    title: 'Dica',
    description: 'tooltip — a dica no lugar do title nativo, e o atalho Ajuda (um gatilho, um texto).',
    npm: [NPM.radix],
    files: [ui('tooltip')],
  }),
  peca({
    name: 'dica-de-ajuda',
    title: 'Dica de ajuda',
    description: 'tooltip/info — o ⓘ ao lado do controle: abre no hover, no foco e no toque.',
    npm: [NPM.lucide],
    pecas: ['button', 'tooltip'],
    files: [ui('dica-de-ajuda')],
  }),
  peca({
    name: 'com-motivo',
    title: 'Com motivo',
    description: 'disabled tooltip — o gesto desabilitado diz por quê, numa dica alcançável pelo teclado.',
    pecas: ['tooltip'],
    files: [ui('com-motivo')],
  }),
  peca({
    name: 'toast',
    title: 'Aviso',
    description: 'toast/sonner — o aviso efêmero do desfecho de uma ação, nas vozes ok, ruim e neutro; o de erro fica até ser fechado.',
    npm: [NPM.lucide],
    pecas: ['idioma-de-cor'],
    files: [ui('toast')],
  }),
  peca({
    name: 'skeleton',
    title: 'Esqueleto',
    description: 'skeleton — a caixa da espera, parada sob movimento reduzido, e a espera de uma lista.',
    files: [ui('skeleton')],
  }),
  peca({
    name: 'menu',
    title: 'Menu',
    description: 'dropdown-menu — o menu: grupos separados por ar, linha bloqueada que diz o motivo, confirmação pela peça, escolha, submenu com espera e erro.',
    npm: [NPM.radix, NPM.lucide],
    pecas: ['idioma-de-cor', 'confirm-dialog', 'skeleton'],
    files: [ui('menu')],
  }),
  peca({
    name: 'antes-do-desenho',
    title: 'Antes do desenho',
    description: 'theme script — o script que aplica o tema guardado e a barra recolhida no <html> antes do primeiro desenho; vai uma vez, no layout raiz (ou no index.html).',
    files: [lib('antes-do-desenho', 'tsx')],
  }),
  peca({
    name: 'link-do-app',
    title: 'Link do app',
    description: 'link — o link das peças: um <a> por padrão e o do framework (next/link, react-router) quando o app o declara no ProvedorDeLink. É o que mantém as peças valendo em Next e Vite.',
    files: [lib('link-do-app', 'tsx')],
  }),
  peca({
    name: 'chip-de-estado',
    title: 'Chip de estado',
    description: 'badge/status — o estado em uma palavra, com a forma única do carimbo e a voz declarada em tom; o neutro abre com o ponto que o Badge não tem (CTRL-05); o ChipQueAbre abre o detalhe.',
    npm: [NPM.lucide],
    pecas: ['idioma-de-cor'],
    files: [ui('chip-de-estado')],
  }),
  peca({
    name: 'estado',
    title: 'Estado',
    description: 'status dot — o marcador mínimo de voz: o ponto de 6px e a palavra, à vista ou só para o leitor de tela.',
    pecas: ['idioma-de-cor'],
    files: [ui('estado')],
  }),
  peca({
    name: 'medalhao-do-icone',
    title: 'Medalhão do ícone',
    description: 'icon badge — o disco com o ícone que diz o assunto antes da leitura; neutro por padrão, tom só para erro, ausência ou recusa.',
    pecas: ['idioma-de-cor'],
    files: [ui('medalhao-do-icone')],
  }),
  peca({
    name: 'trilha',
    title: 'Trilha',
    description: 'breadcrumb — a trilha de volta da tela de detalhe até a lista de onde veio (CASCO-03); o último degrau é a página atual.',
    npm: [NPM.lucide],
    pecas: ['link-do-app'],
    files: [ui('trilha')],
  }),
  peca({
    name: 'vazio',
    title: 'Vazio',
    description: 'empty state — a região sem itens diz a causa (nada ainda, filtro, não se aplica, não informado) e a saída, nunca um ✓ (EST-02).',
    pecas: ['medalhao-do-icone'],
    files: [ui('vazio')],
  }),
  peca({
    name: 'prioridade',
    title: 'Prioridade',
    description: 'priority badge — a prioridade de um item: o carimbo com o glifo de barras e a palavra na cor do nível; só a urgente fala, na voz de espera.',
    npm: [NPM.lucide],
    pecas: ['chip-de-estado', 'idioma-de-cor'],
    files: [ui('prioridade')],
  }),
  peca({
    name: 'ponto-da-etapa',
    title: 'Ponto da etapa',
    description: 'stage dot — o marcador de etapa de um fluxo do projeto, por fábrica: o mapa de matizes mora no projeto, e a chave fora dele cai no ponto neutro.',
    files: [ui('ponto-da-etapa')],
  }),
  peca({
    name: 'quadro',
    title: 'Quadro',
    description: 'kanban board — o quadro de tarefas: a coluna no chão, o cartão elevado, a bandeja da vida tingida pela voz e o alvo de soltar da marca; a peça desenha, o app arrasta.',
    npm: [NPM.radix, NPM.lucide],
    pecas: ['idioma-de-cor', 'skeleton'],
    files: [ui('quadro')],
  }),
  peca({
    name: 'tela-de-erro',
    title: 'Tela de erro',
    description: 'error state — o que não deu para mostrar: a rota inteira (erro, não encontrado, sem permissão) ou um bloco que falhou com a tela de pé.',
    npm: [NPM.lucide],
    pecas: ['button', 'medalhao-do-icone', 'idioma-de-cor'],
    files: [ui('tela-de-erro')],
  }),
  peca({
    name: 'topo-da-pagina',
    title: 'Topo da página',
    description: 'page header — a página dentro do casco (largura e respiro) e o topo dela: trilha, o h1 único, o estado, o primário, o ⋯, a linha dos valores, o desfecho e os filtros (CASCO-01, CASCO-04).',
    pecas: ['idioma-de-cor', 'chip-de-estado', 'skeleton'],
    files: [ui('topo-da-pagina')],
  }),
  peca({
    name: 'seletor-de-vista',
    title: 'Seletor de vista',
    description: 'tabs/toggle-group — a troca de vista em duas densidades (abas e modos): trilha de tinta, pílula que desliza, o estado no texto (CTRL-06).',
    pecas: ['idioma-de-cor'],
    files: [ui('seletor-de-vista')],
  }),
  peca({
    name: 'table',
    title: 'Tabela',
    description: 'table — a tabela em densidade instrumento: linha de 40px, cabeçalho grudado na voz de coluna com a régua embaixo, o filete-guia recuado entre linhas, e a linha inteira que abre o objeto.',
    pecas: ['link-do-app'],
    files: [ui('table')],
  }),
  peca({
    name: 'ficha',
    title: 'Ficha',
    description: 'description list — pares rótulo/valor numa grade, com o ausente dito como "não informado".',
    files: [ui('ficha')],
  }),
  peca({
    name: 'trilho-do-percurso',
    title: 'Trilho do percurso',
    description: 'stepper — o percurso de um objeto no arquétipo Mesa: as etapas em ordem, cada uma com o estado, e a aberta marcada.',
    npm: [NPM.lucide],
    pecas: ['estado', 'secao', 'idioma-de-cor'],
    files: [ui('trilho-do-percurso')],
  }),
  peca({
    name: 'logotipo',
    title: 'Logotipo',
    description: 'logo — a marca Wicomm no casco e na Entrada: o desenho oficial do tema na horizontal e o símbolo oficial na barra recolhida.',
    files: [ui('logotipo')],
  }),
  peca({
    name: 'menu-do-tema',
    title: 'Menu do tema',
    description: 'theme switcher — claro, escuro ou do sistema, numa escolha de menu que já é a ação, e o useTema.',
    npm: [NPM.lucide],
    pecas: ['menu', 'antes-do-desenho'],
    files: [ui('menu-do-tema')],
  }),
  peca({
    name: 'menu-da-conta',
    title: 'Menu da conta',
    description: 'user menu — o monograma, o nome e o e-mail da pessoa, e as linhas Minha conta e Sair.',
    npm: [NPM.lucide],
    pecas: ['menu', 'monograma'],
    files: [ui('menu-da-conta')],
  }),
  peca({
    name: 'checkbox',
    title: 'Caixa de marcar',
    description: 'checkbox — marcar itens de uma lista para uma ação em lote, ou o sim/não de um formulário que se grava com Salvar; a OpcaoDeMarcar com o texto ao lado.',
    npm: [NPM.radix, NPM.lucide],
    pecas: ['label'],
    files: [ui('checkbox')],
  }),
  peca({
    name: 'progress',
    title: 'Progresso',
    description: 'progress — o progresso de uma etapa conhecida: o rótulo, o valor escrito (3 de 8) e a barra no gradiente da marca, que reforça sem informar sozinha.',
    npm: [NPM.radix],
    files: [ui('progress')],
  }),
  peca({
    name: 'medidor',
    title: 'Medidor',
    description: 'meter — um número contra um teto (120 h de 200 h): o número em medida, a voz só nele, a barra neutra; sem teto, "de —" (ARQ-02).',
    pecas: ['progress', 'idioma-de-cor'],
    files: [ui('medidor')],
  }),
  peca({
    name: 'badge',
    title: 'Valor rotulado',
    description: 'badge — o valor que classifica um objeto (não um estado), no casco do carimbo: neutro, ou de marca quando explícito, aberto pelo filete da marca (CTRL-05).',
    pecas: ['chip-de-estado', 'idioma-de-cor'],
    files: [ui('badge')],
  }),
  peca({
    name: 'carregando-por-cima',
    title: 'Carregando por cima',
    description: 'loading overlay — a troca de contexto: o véu sobre a região que mente (nunca o casco), a partir de 120ms, com a frase do que acontece.',
    npm: [NPM.lucide],
    files: [ui('carregando-por-cima')],
  }),
  peca({
    name: 'faixa',
    title: 'Faixa',
    description: 'alert/banner — o aviso de quando a tela inteira mente: uma faixa por tela, uma linha por assunto, cada uma com a voz e a saída (MSG-02, MSG-06).',
    npm: [NPM.lucide],
    pecas: ['idioma-de-cor'],
    files: [ui('faixa')],
  }),
  peca({
    name: 'dobra',
    title: 'Dobra',
    description: 'collapsible — um grupo dentro de uma peça que se abre sob demanda: os campos de um assunto no inspector, ou o informativo que pouca gente lê; nunca esconde ação.',
    npm: [NPM.lucide],
    pecas: ['button'],
    files: [ui('dobra')],
  }),
  peca({
    name: 'popover',
    title: 'Popover',
    description: 'popover — o detalhe sob demanda, colado ao carimbo ou ao controle que o abre no clique, na superfície flutuante.',
    npm: [NPM.radix],
    files: [ui('popover')],
  }),
  peca({
    name: 'monograma',
    title: 'Monograma',
    description: 'avatar — o círculo de 20px com as iniciais, em tinta neutra, e o círculo tracejado da pessoa que não há; a cor da pessoa (`corDaPessoa(id)`) só na conversa entre pessoas.',
    files: [ui('monograma')],
  }),
  peca({
    name: 'pessoa',
    title: 'Pessoa',
    description: 'avatar group — a pessoa numa linha de lista (monograma, nome, papel; ausente, sem nome, carregando) e a pilha de pessoas com +N e a frase inteira na dica, ou decorativa quando a frase ao lado já diz os nomes.',
    pecas: ['monograma', 'skeleton', 'tooltip', 'table'],
    files: [ui('pessoa')],
  }),
  peca({
    name: 'conversa',
    title: 'Conversa',
    description: 'chat bubbles — a conversa entre pessoas: o meu balão à direita na tinta da marca, o do outro à esquerda no muted, o canto de quem fala no primeiro do grupo, a frase inteira para o leitor de tela e a hora num time; a cor da pessoa só no nome do autor; e o texto com os links http(s) clicáveis, em nova aba, sem HTML cru.',
    pecas: ['badge', 'monograma'],
    files: [ui('conversa'), lib('links-no-texto')],
  }),
  peca({
    name: 'linha-do-grupo',
    title: 'Linha do grupo',
    description: 'table/collapsible — o grupo de linhas de uma tabela: o próprio tbody, a linha do grupo no degrau de tinta que abre e fecha, a contagem e a trilha encostadas no fim (as barras no mesmo x), e as células alinhadas às colunas, que esvaziam no celular quando a coluna some.',
    npm: [NPM.lucide],
    pecas: ['table', 'progress', 'chip-de-estado'],
    files: [ui('linha-do-grupo')],
  }),
  peca({
    name: 'prazo',
    title: 'Prazo',
    description: 'date cell — o prazo numa linha: a data ou o intervalo em medida e a legenda relativa (em 12 dias), com a voz só quando quem chama a declara; o intervalo de um dia só, só a data (sem a legenda), numa linha; sem data, proposta, concluído e parcial.',
    pecas: ['estado', 'chip-de-estado', 'tooltip', 'table', 'idioma-de-cor'],
    files: [ui('prazo')],
  }),
  peca({
    name: 'escolha-na-celula',
    title: 'Escolha na célula',
    description: 'dropdown-menu/popover — trocar um valor na própria célula: a leitura no peso dela com o chevron de 14px, o menu ou o popover com o formulário (Salvar, Cancelar e Enter, e o motivo de não salvar escrito nele), gravando, recusado e sem permissão.',
    npm: [NPM.lucide],
    pecas: ['menu', 'popover', 'button', 'table', 'idioma-de-cor'],
    files: [ui('escolha-na-celula')],
  }),
  peca({
    name: 'barra-do-editor',
    title: 'Barra do editor',
    description: 'editor toolbar — a linha única do topo do Editor: a volta e o nome (o h1), o rascunho, a vista ao centro, o primário, o ⋯ e a pessoa; altura fixa, sem quebra.',
    npm: [NPM.lucide],
    pecas: ['button', 'card', 'menu-da-conta', 'menu-do-tema', 'tooltip', 'link-do-app'],
    files: [ui('barra-do-editor')],
  }),
  peca({
    name: 'colunas-do-editor',
    title: 'Colunas do editor',
    description: 'resizable/editor layout — a estrutura que recolhe a um trilho, o canvas que nunca fica abaixo de 60% e a coluna da direita que vira gaveta abaixo de 1280px; com a linha da estrutura e o item do trilho.',
    npm: [NPM.lucide],
    pecas: ['button', 'dialog', 'estado', 'painel', 'secao', 'tooltip', 'idioma-de-cor'],
    files: [ui('colunas-do-editor')],
  }),
]

/**
 * Os blocos de tela (ANATOMIA CASCO-01, ARQ-01): o casco e os arquétipos, cada
 * um com uma página de exemplo no App Router. O componente do bloco recebe a
 * carga por props; a página de exemplo escolhe o estado por `?estado=`.
 */
export const BLOCOS = [
  bloco({
    name: 'casco',
    title: 'Casco',
    description:
      'sidebar/app shell — o casco de todo app autenticado: a barra lateral (marca, destinos com ícone e rótulo, recolher, tema e conta), o cabeçalho opcional e a região que rola; com o layout de exemplo do App Router.',
    npm: [NPM.lucide],
    pecas: ['link-do-app', 'antes-do-desenho', 'idioma-de-cor', 'toast', 'tooltip', 'button', 'menu', 'chip-de-estado', 'logotipo', 'menu-do-tema', 'menu-da-conta'],
    files: [
      comp('casco', 'barra-lateral'),
      comp('casco', 'cabecalho-do-app'),
      comp('casco', 'casco-do-app'),
      comp('casco', 'menu-do-contexto'),
      comp('casco', 'casco-no-next'),
      dados('casco', 'navegacao'),
      pagina('casco', 'layout', 'app/(casco)/layout.tsx'),
    ],
  }),
  bloco({
    name: 'lista',
    title: 'Tela de Lista',
    description:
      'list page — o arquétipo Lista (o que pede a minha atenção?): topo com título, modos com contagem, busca e primário; a tabela numa superfície; o vazio que diz a causa. Exemplo com pedidos, dentro do casco.',
    npm: [NPM.lucide],
    pecas: ['casco', 'idioma-de-cor', 'link-do-app', 'button', 'chip-de-estado', 'input', 'painel', 'seletor-de-vista', 'skeleton', 'table', 'tela-de-erro', 'toast', 'topo-da-pagina', 'vazio'],
    files: [comp('lista', 'lista-de-pedidos'), dados('lista', 'dados-da-lista'), pagina('lista', 'page', 'app/(casco)/pedidos/page.tsx')],
  }),
  bloco({
    name: 'mesa',
    title: 'Tela de Mesa',
    description:
      'detail page — o arquétipo Mesa (em que pé está isto, e o que eu faço agora?): trilha, nome, estado e primário no topo; o trilho do percurso; o conteúdo da etapa; a variante de leitura com abas. Exemplo com um pedido, dentro do casco.',
    npm: [NPM.lucide],
    pecas: ['casco', 'lista', 'bloco', 'button', 'chip-de-estado', 'estado', 'ficha', 'menu', 'painel', 'seletor-de-vista', 'skeleton', 'table', 'tela-de-erro', 'toast', 'topo-da-pagina', 'trilha', 'trilho-do-percurso', 'vazio', 'link-do-app', 'idioma-de-cor'],
    files: [comp('mesa', 'mesa-do-pedido'), dados('mesa', 'dados-da-mesa'), pagina('mesa', 'page', 'app/(casco)/pedidos/[id]/page.tsx')],
  }),
  bloco({
    name: 'entrada',
    title: 'Tela de Entrada',
    description:
      'login page — o arquétipo Entrada (qual é o único passo?): o cartão sozinho no fundo, fora do casco, campos e botão xl, a recusa no próprio cartão.',
    pecas: ['button', 'card', 'input', 'label', 'logotipo', 'menu-do-tema', 'idioma-de-cor'],
    files: [comp('entrada', 'tela-de-entrada'), pagina('entrada', 'page', 'app/(tela-inteira)/entrar/page.tsx')],
  }),
  bloco({
    name: 'editor',
    title: 'Tela de Editor',
    description:
      'editor page — o arquétipo Editor (como fica se eu mudar isto?): fora do casco, a barra com a volta, o rascunho e o Publicar; a estrutura que recolhe, o canvas com a página e o inspector em dobras. Exemplo com um documento.',
    npm: [NPM.lucide],
    pecas: ['barra-do-editor', 'colunas-do-editor', 'dobra', 'popover', 'button', 'card', 'chip-de-estado', 'dialog', 'input', 'label', 'menu', 'select', 'seletor-de-vista', 'skeleton', 'tela-de-erro', 'toast', 'tooltip', 'vazio', 'link-do-app'],
    files: [
      comp('editor', 'editor-de-documento'),
      comp('editor', 'editor-no-next'),
      dados('editor', 'dados-do-editor'),
      pagina('editor', 'page', 'app/(tela-inteira)/documentos/[id]/editar/page.tsx'),
    ],
  }),
]

