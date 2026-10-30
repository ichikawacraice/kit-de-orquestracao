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

const ui = (nome) => ({ path: `registry/wicomm/ui/${nome}.tsx`, type: 'registry:ui' })
const lib = (nome) => ({ path: `registry/wicomm/lib/${nome}.ts`, type: 'registry:lib' })

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
    description: 'alert-dialog/confirm — useConfirm(), no lugar do window.confirm: título, o que não se desfaz, destrutivo em contorno, alternativa branda.',
    pecas: ['button', 'dialog'],
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
]
