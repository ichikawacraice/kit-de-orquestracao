# Pesquisa — o quadro de tarefas moderno (F378)

Snapshot de 04/11/2026. Não se edita; pesquisa envelhece.

Pedido do operador: o quadro (kanban) do QA do WiControl "sem cor, sem formatação adequada, os cards feios"; o do Izanagi "bem melhor". A anatomia e o lugar de cada coisa ficaram bons; o defeito é o acabamento de cada peça.

## O que foi medido no código

### WiControl — `frontend/src/components/qa/QaBoard.tsx`

- **Coluna é uma peça:** cada coluna é um `Painel` (`w-72`), com a superfície, o raio 16 e a sombra de peça. O chão some: o quadro vira uma fileira de cartões cinzas grandes.
- **Cartão é degrau de tinta dentro da peça:** `BlocoDeTinta densidade="compacta"` (fundo `muted`, sem sombra, hover `bg-accent`). Fica cinza sobre branco, com contraste de ~1,11:1 e sem elevação. Mesmo sem o nome, é a regra "peça dentro de peça" (SUP-01) virada do avesso: o cartão perde a altura que o faria parecer pegável.
- **Cabeçalho da coluna:** `Estado soPonto` + `h2 t-titulo` + contagem `t-medida` solta. A etapa já tem ponto, mas o nome em `t-titulo` pesa como título de seção e a contagem não tem casco.
- **Linha de metadados:** `prioridade · há 2 h · 3 mensagens` em texto corrido. A prioridade, que é decisão de ordem, vira texto cinza.
- **Soltar:** a coluna que recebe vira `bg-accent`, quase igual ao hover.
- **Vazio:** `Vazio causa="filtro"` com ícone e título, alto, em toda coluna vazia.
- O arrastar (`@hello-pangea/dnd`, `renderClone` em portal, autoscroll, movimento reduzido) está bom e fica.

### Izanagi — `apps/web/src/components/solicitacoes/{Quadro,CartaoDaSolicitacao}.tsx`

- Colunas **no chão**, sem superfície própria (`min-w-[258px] flex-[1_0_258px]`); coluna vazia recolhe para 46px.
- Cabeçalho `h-9`: `PontoDaEtapa` + nome em `text-controle font-[650]` + contagem em pílula mono (`rounded-full bg-muted px-[7px] font-mono text-legenda tabular-nums`).
- Cartão é **a peça**: `superficie rounded-cartao`, hover sobe 1px e ganha `--superficie-sombra-alta`; arrastando, a origem fica a 60% e o fantasma tem sombra alta.
- Duas zonas: **o pedido** (selo de origem, `ChipDeEstado`, título 13px/550 em até 3 linhas, linha de identidade com projeto, prazo com ícone de calendário e iniciais à direita) e **a vida** (bandeja no pé, tingida pela voz — `TINTA_DO_TOM` + `COR_DO_TOM_DENSO` — quando o cartão pede algo; `muted` quando não).
- Soltar: `bg-marca-tinta` + contorno tracejado da marca (`outline-dashed`): o tracejado marca a ausência do cartão que vai chegar (FORMA-02).

### Os tokens

Os tokens não são o problema. `@wicomm/tokens` já publica tudo o que o quadro do Izanagi usa: `--superficie-sombra` e `--superficie-sombra-alta`, `rounded-cartao`/`rounded-painel`, `marca-tinta`/`marca-viva`, `text-controle` (13px) e `text-legenda` (11px), e o `idioma-de-cor` com as cinco vozes. O defeito do WiControl é de **composição**: o cartão está no degrau errado da escala de superfície e a cor que a base permite (ponto da etapa, bandeja da voz, alvo de soltar da marca) não foi usada.

## Referências de fora

- **Linear (board layout / display options):** o cartão mostra só propriedades escolhidas (status, prioridade, responsável, rótulos, estimativa); a descrição não aparece no cartão; detalhe pelo "peek" (hover + espaço). Prioridade é **glifo** de barras (sem prioridade, baixa, média, alta) e urgente é o único em cor; status é círculo que enche com o progresso. Lição: prioridade é forma, não texto, e só o urgente ganha voz. Fontes: [Board layout](https://linear.app/docs/board-layout), [Display options](https://linear.app/docs/display-options).
- **ReUI / Dice UI (shadcn kanban):** peça de apresentação composta (`Kanban`, `KanbanColumn`, `KanbanItem`, `KanbanItemHandle`, `KanbanColumnHandle`), estado como `Record<colunaId, T[]>` com `onValueChange`/`onValueCommit` e rollback; alça da coluna só aparece no hover ou no foco; overlay duplica o cartão e a origem deixa a vaga. Lição: o arrastar é do app; a peça dá a forma e os estados. Fonte: [reui.io/patterns/kanban](https://reui.io/patterns/kanban), [21st.dev kanban](https://21st.dev/s/kanban).
- **Superthread (guia de cartões):** o cartão responde "o que é, de quem, até quando, quanto importa" sem abrir; o resto vai para o detalhe. Fonte: [superthread.com/docs/guides/kanban-cards](https://superthread.com/docs/guides/kanban-cards).
- **Padrões de UX de kanban:** arrastar por teclado (espaço pega, setas movem, espaço solta, Esc cancela) com anúncio ao leitor de tela; foco visível no cartão; limite de WIP como aviso na contagem, não bloqueio. Fonte: [skillselion — kanban board](https://skillselion.com/skills/thedaviddias/ux-patterns-for-developers/kanban-board) (só o resumo da busca; a página não abriu).
- **Kanbantool / Businessmap:** prioridade por ícone e cor é o padrão do mercado; cor demais no cartão inteiro (fundo da cor da prioridade) é o anti-padrão citado.

Pesquisa curta: GitHub Projects, Plane, Height e Jira não renderam página útil na busca padrão; o que falta deles não muda a direção (todos seguem o desenho do Linear: coluna no chão, cartão elevado, prioridade em glifo).

## Conclusão para a revisão de design

1. **O cartão é a peça; a coluna mora no chão.** Inverter o WiControl: coluna sem superfície, cartão `superficie rounded-cartao` com hover elevando.
2. **Cor com função, pelos canais da base:** ponto da etapa no cabeçalho (COR-08), bandeja da vida tingida pela voz quando o item pede algo de você (COR-03/05), alvo de soltar da marca com tracejado (FORMA-02). Nada de fundo colorido no cartão inteiro.
3. **Prioridade em glifo de forma** (barras), sem matiz própria; só a urgente leva voz (`ruim`) — *a decidir na revisão*.
4. **Contagem em pílula mono**; coluna vazia recolhe ou mostra um vazio baixo, não o `Vazio` alto.
5. **A peça é de apresentação** (coluna, cabeçalho, cartão, estados de arrastar por props); o arrastar fica no app — o registro não traz biblioteca de DnD e os dois apps usam bibliotecas diferentes (`@hello-pangea/dnd` × `@dnd-kit`). *Assumida, a confirmar.*
6. `PontoDaEtapa` (local do WiControl e do Izanagi) é candidato ao registro com o mapa de etapas declarado pelo projeto (COR-09, ANATOMIA).

## Izanagi como base (pedido do operador, 04/11/2026)

Acréscimo do mesmo dia: o operador pediu que o quadro do Izanagi seja a **base** do padrão. A pesquisa externa vale só para o que ele não cobre (glifo de barras da prioridade, arrastar por teclado). Medido em `apps/web/src/components/solicitacoes/` (só leitura):

- **Coluna vazia recolhida:** `recolhida = daColuna.length === 0 && !abertaPorClique`; durante o arrasto continua fita. Fita `flex-[0_0_46px]`, `rounded-cartao bg-foreground/[0.03]`, hover `/[0.07]`, `py-3 gap-3`: ponto, nome vertical (`rotate-180 text-legenda font-[650] text-foreground-2`) e contagem mono solta. Fita que aceita: `bg-marca-tinta outline-dashed outline-2 -outline-offset-4 outline-marca-viva`.
- **Cores das colunas e etapas:** colunas `gap-1.5`, pilha `px-2 pb-7 pt-[3px] gap-2`; ponto `size-1.5`; mapa `COR_DA_ETAPA` por variáveis CSS, par claro/escuro — triagem cyan-600/400, fila blue-600/400, execução indigo-600/400, revisão #9C430A/#FBBF24, homolog #9333EA/#C084FC, validada teal-600/400, deploy #4D7C0F/#A3E635, concluída #036A4D/#34D399. Três paradas (revisão, homolog, concluída) colidem com vozes; o exemplo do registro usa só as que não colidem (cyan, indigo, teal).
- **Formato do cartão:** pedido `px-3.5 py-[13px] gap-2`; título `text-controle font-[550] line-clamp-3`; identidade `text-legenda` com o projeto em 600 `text-foreground-2`, prazo e pessoa à direita; bandeja `px-3.5 pb-3 pt-[11px]`, tingida `TINTA_DO_TOM + COR_DO_TOM_DENSO` quando pede algo, senão `bg-muted`; origem a 60%.
- **Badges:** casco do `ChipDeEstado` igual ao carimbo do registro; prioridade em chip de texto, `normal` não aparece, `urgente` no tom `espera`; risco `alto` em `ruim`, o resto neutro.
