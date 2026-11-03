# Revisão de arquitetura — a separação das listas (F307)

Escopo: como a `Table` do registro (`packages/registro/registry/wicomm/ui/table.tsx`) e a `LinhaDoGrupo` (`linha-do-grupo.tsx`) separam uma linha da outra e um grupo do outro. O resto das peças de lista (F306) fica como está.

Pedido do operador (01/11/2026): a lista grande e complexa fica confusa; a leitura humana precisa ver com evidência as linhas e os grupos, sempre bonito e agradável.

**O que foi medido no ateliê**, a 1280px, nos dois temas, na lista grande de 6 grupos e 36 linhas (`apps/atelie/src/catalogo/demos/_lista-grande.tsx`):

- **Entrelinha.** O `t-denso` herda entrelinha 1,5: cada linha de texto mede **18px**. As duas linhas somam 36px numa célula de `h-10` (40px): entre o texto de uma linha e o da vizinha há 4px.
- **Ar em volta do grupo.** O vão antes do grupo é de 6px. Entre o topo do grupo e a primeira linha não há ar nenhum.
- **Contraste do degrau.** O degrau (`bg-muted`) contra o cartão mede **1,110:1 no claro e 1,057:1 no escuro**.
- **A spec da F306 já previa linha mais alta.** A gramática da linha (regra 1) dizia ≈48px com duas linhas no instrumento e ≈56px no site; 40px só para lista de uma linha. A execução manteve `h-10`. O defeito vem daí, não da falta de uma linha divisória.
- **O caso real (226 tarefas, 6 grupos).** No app que usa as peças, as linhas de duas linhas estão a 50px uma da outra, sem filete, e cada linha se lê separada.

## Tarefa

Quem opera percorre uma lista longa e **acha de relance onde começa cada grupo e onde termina cada linha**, sem traçar a linha com o dedo.

## Quem e onde

- **Instrumento:** quem opera o dia todo, em notebook, a 1280px (o pior caso). Listas de 36 a 226 linhas, 6 grupos ou mais, muitas vezes com grupos fechados.
- **Site:** o cliente, de vez em quando, em listas curtas de grupos.

## Inventário

| o quê | onde | decisão que gera | frequência | veredito |
|---|---|---|---|---|
| A linha de objeto (nome + legenda) | `TableRow`/`TableCell` | qual linha abrir | toda leitura | **fica**; a altura cresce com o conteúdo e guarda 6px de ar em cima e embaixo |
| Filete entre linhas | (pedido) | nenhuma: separa o que o ar já separa e transforma a lista em grade | — | **não entra** (SUP-03 e PECA-01 mantidas) |
| Zebra | (pedido) | nenhuma: segunda tinta disputando com o degrau "onde começa outro assunto"; com filtro ou grupo fechado a alternância se desloca | — | **não entra** |
| O topo do grupo (degrau) | `LinhaDoGrupo` | onde começa outro assunto; abrir e fechar | toda leitura | **fica**; 48/56px, degrau mais forte no escuro |
| Nome do grupo | topo | achar o grupo ao rolar | toda leitura | **fica**, um degrau de tipo acima do corpo |
| Contagem e trilha | fim do topo | quanto falta no grupo | por grupo | **fica** |
| Pilha e prazo do grupo | células do topo | quem e até quando, no grupo | por grupo | **fica** |
| `⋯` do grupo | última coluna | ação do grupo | rara | **fica** |
| Vão antes do grupo | célula do topo (`pt`) | separar um grupo do anterior | toda leitura | **fica**: 6 → 16px (instrumento) e 24px (site) |
| Ar depois do topo | célula do topo (`pb`) | o topo pertence às linhas de baixo | toda leitura | **novo**: 4px (instrumento) e 6px (site) |
| Recuo das linhas | primeira célula, dentro do grupo | a que grupo a linha pertence | toda leitura | **novo**: o texto da linha alinha com o nome do grupo |
| Hover | `TableRow` | qual linha vai abrir | cada passada do mouse | **fica**, `bg-accent`, com a forma do foco |
| Foco | `LinkDaLinha` | navegar pelo teclado | contínua | **fica** |
| Cabeçalho grudado | `TableHeader` | a que coluna o valor pertence | ao rolar | **fica**; a primeira coluna recua junto quando a tabela tem grupos |

## Hierarquia e peso

- **Primária:** abrir a linha (`LinkDaLinha`, a linha inteira). **Secundária:** abrir e fechar o grupo. **Terciárias:** o `⋯` do grupo e a `EscolhaNaCelula`.
- **Ordem de peso:** o topo do grupo (tinta, 48px, nome em 14px/600) · a linha (48px com duas linhas, 12px/400) · a legenda (`muted-foreground`).
- **A proximidade decide a pertença** (instrumento, de texto a texto): entre linhas do mesmo grupo **12px**; da borda do topo ao texto da primeira linha **10px**; do texto da última linha à borda do próximo topo **22px**; entre grupos **36px**, 3× o ar de dentro (LAY-03 pede ≥ 2×). No site: 16px entre linhas, 50px entre grupos.
- **Custo de rolagem.** As 36 linhas crescem de ~1480px para ~1890px (+28%): num painel de ~560px a 1280, ~10 linhas em vez de ~13. O custo já tinha sido aceito na F306; os 40px eram o defeito, não uma economia.

## Mensagens

Nenhuma nova. *Sem linhas* no topo do grupo vazio e *Sem data*, *Sem responsável* na célula seguem neutros, enquanto valem.

## Regiões e componentes

Não há peça nova. Mudam a `Table`, a `LinhaDoGrupo`, o `Prazo` e o token `muted` escuro.

### (a) Linha divisória: não entra

O problema medido é a falta de ar (4px entre linhas vizinhas), não a falta de traço. Com 12px de ar, a proximidade separa sozinha. Filete e zebra disputariam com o degrau: três ou quatro tintas na mesma lista (cartão, faixa alternada, degrau, hover); no claro, `accent` × `muted` mede 1,046 — a zebra não se distinguiria do degrau. SUP-03 e a linha "Lista de objetos" da PECA-01 ficam, com o texto que explica por que a linha não leva traço.

### (b) A altura da linha cresce com o conteúdo, sem prop

| | instrumento | site |
|---|---|---|
| `TableCell` | `h-10` (mínimo) + `py-1.5` (6px) | `h-12` + `py-2` (8px) + `text-sm` |
| uma linha | 40px | 48px |
| duas linhas | 36 + 12 = **48px** | **54px** |
| `TableHead` | `h-8` | `h-8` |

- Automática, e não a prop `duasLinhas`: o ar fica garantido sempre, sem API nova.
- **A densidade mora na `Table`.** `Table densidade="instrumento" | "site"` publica um contexto; `TableCell`, `TableHead` e `LinhaDoGrupo` o leem, e a `densidade` da `LinhaDoGrupo` fica como sobreposição.
- **`Prazo`:** sai o `gap-0.5` da forma empilhada; com ele o prazo mede 38px e as linhas oscilam entre 48 e 50px.

### (c) O peso do grupo

| | instrumento | site |
|---|---|---|
| altura do degrau (fixa, o `div` de cada célula) | `h-12` (48px) | `h-14` (56px) |
| vão antes do grupo (menos no primeiro) | `pt-4` (16px) | `pt-6` (24px) |
| ar depois do topo | `pb-1` (4px) | `pb-1.5` (6px) |
| nome | `text-sm font-[600]` (14px) | `t-titulo` (15px/600) |
| chevron → nome | `gap-1.5` | `gap-1.5` |
| recuo das linhas do grupo (primeira célula) | `pl-8` (32px = 12 + 14 + 6: o texto alinha com o nome) | igual |
| primeira coluna do cabeçalho, com grupos | `pl-8` (por `:has([data-slot=linha-do-grupo])`) | igual |

O recuo é da peça: a `LinhaDoGrupo` o aplica no próprio `tbody`; a tela não escreve recuo.

### (d) Hover com a forma do foco

- `Table`: `border-collapse` → `border-separate border-spacing-0` (com `collapse` o raio de célula não se desenha; a tabela não tem borda).
- `TableRow`: o fundo do hover passa às células (`hover:[&>td]:bg-accent`).
- `TableCell`: `first:rounded-l-md last:rounded-r-md` (8px, o raio do anel de foco do `LinkDaLinha`) e `transition-colors duration-cor`.
- A cor continua `accent`; o topo do grupo segue sem hover. O raio do hover (8px) é menor que o do degrau (12px), para a linha acesa não parecer grupo.

### (e) O degrau no escuro

Token `muted` escuro: `#11141B` → `#0B0E14`.

| par | claro | escuro hoje | escuro proposto |
|---|---|---|---|
| `muted` × `card` (o degrau) | 1,110 | **1,057** | **1,108** |
| `accent` × `card` (hover) | 1,161 | 1,107 | 1,107 |
| `accent` × `muted` | 1,046 | 1,170 | 1,227 |
| `muted-foreground` × `muted` | 5,920 | 5,457 | 5,721 |
| `muted` × `background` | 1,063 | 1,033 | 1,015 |

Mais escuro, nunca mais claro que o cartão: um degrau claro de 1,10 derruba o `muted-foreground` a 4,55:1, abaixo do piso da COR-12, e coincide com o `accent`. Catraca nova: o degrau mede ≥ 1,10:1 contra o cartão nos dois temas.

### Vitrine

A lista grande entra no ateliê nas duas densidades e nos dois temas, como caso de regressão desta regra.

### As regras que mudam

- **SUP-03 · A separação é o ar:** numa lista, a linha se separa da vizinha só por ar (a célula guarda o ar de cima e de baixo e cresce com o conteúdo); o grupo se separa pelo degrau, com o vão antes maior que o ar depois; nunca filete entre linhas, nunca zebra; o degrau mede ≥ 1,10:1 contra o cartão nos dois temas. Confere ganha `tokens` e `navegador`.
- **TIPO-02 · As vozes da família:** o nome do grupo de linhas é `text-sm` 600 em instrumento e `t-titulo` em site.
- **PECA-01:** "Lista de objetos" e "Grupo de linhas" sem valores em px, com a linha que cresce, o hover com a forma do foco, o vão, o ar e o recuo; "não use" ganha zebra, altura fixa que espreme a segunda linha e recuo à mão.
- **DESIGN, frontmatter:** `colors.escuro.muted` e o bloco `lista`.

## Estados

Repouso como acima · hover nas células em `accent`, raio de 8px · foco no anel do `LinkDaLinha` · grupo fechado: só os topos, a 16px de vão (24 no site) · grupo vazio inerte, sem opacidade (COR-14) · concluído com o carimbo `ok` · carregando com `Skeleton` na mesma altura · lista vazia com `Vazio` · celular: o recuo fica.

## Movimento

Hover em `transition-colors duration-cor` (isento do escape, MOV-02). O chevron segue igual. Altura, vão e recuo não animam.

## O que sai

`h-10` fixo na `TableCell` (vira mínimo) · o hover pintado no `tr` · `border-collapse` · o vão de 6px · `t-denso font-[600]` no nome do grupo em instrumento · `gap-2` entre o chevron e o nome · `gap-0.5` no `Prazo` empilhado · `muted` escuro `#11141B` · "linha de 40px" e "vão de 6px" no texto da ANATOMIA. Filete e zebra: considerados e recusados.

## Decisões (assumidas, a confirmar)

- **D1 · O degrau mais escuro vale para o sistema inteiro.** O token `muted` também pinta o `BlocoDeTinta`, o rodapé do diálogo, o `Bloco` sem superfície, o carimbo neutro e o canvas do Editor, que passam a ter o contraste do claro. Recomendação seguida: global (um segundo "degrau" só para o grupo abriria duas tintas para a mesma ideia). Reversível: um valor.
- **D2 · Versão 0.9.0.** A entrega acrescenta uma catraca de tokens à SUP-03, a `densidade` na `Table` e muda um token visível no escuro: pelo estudo (§2.5) é MINOR. Recomendação seguida: 0.9.0.

## Pontos a observar

- A `table.tsx` passa a `"use client"` (o contexto). O `LinkDoApp` já é cliente; vale um teste com componente de servidor.
- Com `border-separate`, sombra de linha ativa pintada no `tr` continua reta enquanto o hover arredonda — fora do escopo.
