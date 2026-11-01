# Mudanças do design system Wicomm

Uma entrada por versão da base (`versao` no frontmatter de `plugins/wicomm/base/*.md`), da mais nova para a mais velha. Cada entrada diz **o que muda** para quem usa o sistema e **o que migrar** num projeto que já o usa. A vitrine (`/mudancas/`) lê este arquivo no build, e o teste do ateliê reprova versão da base sem entrada aqui.

Formato de cada entrada: `## <versão> · <data, DD/MM/AAAA>`, uma linha `Camadas:` e as seções `### O que muda` e `### Migração`.

## 0.7.0 · 31/10/2026

Camadas: base, tokens, registro

### O que muda
- Seis peças novas no registro, pedidas pelo piloto WiControl: a caixa de marcar (`checkbox`, com a `OpcaoDeMarcar`), o progresso de etapa (`progress`), o número contra teto (`medidor`), o valor rotulado (`badge`), a troca de contexto (`carregando-por-cima`) e a faixa (`faixa`).
- A confirmação aceita `onConfirmar`: a ação roda com o diálogo aberto, o botão fica em curso sem perder o foco, e a falha aparece no próprio diálogo, na frase de quem usa.
- A `Faixa` deixa de ser só do Editor: vale para toda tela, uma por tela, abaixo do topo. O véu de carregamento cobre a região que mente, nunca o casco, e espera 120ms também com movimento reduzido.
- PECA-01 diz qual peça usar no lugar de `Sheet`, `Tabs`, `HoverCard`, `ScrollArea` e `Command`. O token `rounded-marcacao` (5px) entra nos tokens.
- O `link-do-app`, o casco e o Editor passam no eslint do template Vite: o `componente` do `ProvedorDeLink` é tipado (`ComponenteDeLink`), sem `any`.

### Migração
- Nenhuma tela existente muda. `OpcoesDaConfirmacao` passou de `interface` a união de tipos: código que a estende com `interface … extends` passa a usar `type … = OpcoesDaConfirmacao & {…}`. Confirmação feita à mão que roda a ação com o diálogo aberto passa a usar `useConfirm` com `onConfirmar` e `rotuloRodando`; o texto do erro sai do `descreverErro`, nunca da mensagem técnica.
- Quem passava ao `ProvedorDeLink` um link de props próprias (o `Link` do react-router, que pede `to`) o embrulha uma vez, fora de componente, com as props do `<a>`.
- Projeto com `Faixa`, `Badge`, `Medidor` ou caixa de marcar feitos à mão troca pela peça do registro.

## 0.6.0 · 31/10/2026

Camadas: base, registro, guardas

### O que muda
- Regra nova **SUP-07** (superfície): o que flutua cabe na tela — troca de lado quando falta espaço, para a 8px da borda, limita a altura ao visível e rola por dentro; a troca de lado nunca se desliga.
- O registro: menu, submenu, seletor e popover ganham a folga de 8px da borda (a dica já tinha); o popover e a dica passam a limitar a altura ao visível e a rolar por dentro; as peças flutuantes deixam de aceitar `avoidCollisions`.
- Guarda nova **`o-que-flutua-cabe-na-tela`**: reprova `avoidCollisions={false}` e o conteúdo flutuante do Radix montado direto sem limite de altura.

### Migração
- Atualizar as peças `menu`, `select`, `popover` e `tooltip` do registro (`npx shadcn add` de novo).
- Projeto com base de catraca: a guarda nova acusa como violação nova o que já existia; conserte (troque o primitivo pela peça do kit, ou acrescente `max-h-(--radix-…-available-height) overflow-y-auto`) ou registre a dívida na base num PR revisado.

## 0.5.0 · 31/10/2026

Camadas: base, plugin

### O que muda
- Regra nova **CONV-25** (seção 7, distribuição e instalação): projeto com pacote privado `@wicomm` faz o build de produção na máquina (`vercel build --prod && vercel deploy --prebuilt --prod`), e a Vercel não recebe o token dos pacotes.
- O `/wicomm:novo` passa a gerar o `docs/deploy.md` do projeto novo com esse fluxo.

### Migração
- Projeto que já usa pacote privado: tirar `NPM_RC`/`NPM_TOKEN`/`NODE_AUTH_TOKEN` da Vercel, publicar por `vercel build --prod && vercel deploy --prebuilt --prod` e ter um `docs/deploy.md` que diga isso (modelo: `plugins/wicomm/skills/novo-projeto/modelos/deploy.md`).

## 0.4.0 · 30/10/2026

Camadas: base, registro, guardas

### O que muda
- O arquétipo **Editor** ganhou bloco no registro: a barra do Editor (a volta obrigatória e o nome como título da página), as colunas do Editor (a estrutura recolhe a um trilho; a regra dos 60% é medida pela peça) e as peças `Dobra` e `Popover`.
- CASCO-01 e CASCO-03 dizem como o Editor sai do casco e volta; TIPO-02 e TIPO-04 dão ao título da barra do Editor a voz `t-titulo`.
- PECA-01 e PECA-02 listam as peças novas e de onde a peça nova parte.

### Migração
- Nenhuma tela existente muda. Tela de edição feita à mão passa a montar a `BarraDoEditor` e as `ColunasDoEditor`.

## 0.3.0 · 30/10/2026

Camadas: base, registro, guardas

### O que muda
- Os blocos de tela entram no registro: o **casco** e os arquétipos **Lista**, **Mesa** e **Entrada**, cada um com a página de exemplo.
- Catorze peças novas: carimbo de estado, ponto de estado, medalhão do ícone, trilha, vazio, tela de erro, topo da página, seletor de vista, tabela, ficha, trilho do percurso, logotipo, menus do tema e da conta, e o link do app.
- CASCO-01 separa o cabeçalho do casco do topo da página; LAY-01 fixa o topo parado; o Confere de CONV-04, CONV-10, CONV-11, CTRL-09 e MSG-05 passa a citar as guardas.

### Migração
- Tela dentro do casco passa a usar `PaginaDoApp` e `TopoDaPagina`: é o topo quem escreve o único `h1`.
- O tema e a barra recolhida são lidos antes do primeiro desenho: ponha `ScriptsAntesDoDesenho` no layout raiz.

## 0.2.0 · 30/10/2026

Camadas: base, plugin

### O que muda
- A base fala só da Wicomm: a origem de cada regra sai dos arquivos da base e vai para o rastreio do repositório.
- O sistema é **só Tailwind v4**: projeto em v3 migra antes de receber os tokens e as peças.
- O processo de design (designer, crítico com nota e a guarda que cobra a crítica) passa a morar no plugin `wicomm`.

### Migração
- Projeto em Tailwind v3: rode a migração para v4 antes de instalar `@wicomm/tokens`.

## 0.1.0 · 30/10/2026

Camadas: base, tokens

### O que muda
- A primeira versão da base: a direção de design, a anatomia e as convenções, cada regra com Regra, Por quê e Confere.
- O pacote `@wicomm/tokens`: uma fonte só, gerada para o tema do Tailwind v4 e para variáveis CSS.

### Migração
- Primeira versão: não há o que migrar.
