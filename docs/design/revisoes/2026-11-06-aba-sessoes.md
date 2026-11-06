# Revisão de arquitetura — a seção Sessões da aba do kit no Orca (F452)

- **Data:** 2026-11-06 (SP)
- **Autor:** designer do F452
- **Estado:** proposta, antes da crítica.
- **Plano de origem:** [`docs/planos/2026-11-06-aba-sessoes.md`](../../planos/2026-11-06-aba-sessoes.md), que mede as fontes. Esta revisão decide o que a seção mostra, onde, com que peso, em que estado e com que texto. A leitura e a dedução são do plano.
- **Fontes lidas:** a revisão anterior desta aba (v4, [`2026-11-06-aba-do-kit-no-orca.md`](2026-11-06-aba-do-kit-no-orca.md)), com os limites do catálogo do Orca 1.4.250 ([§ limites](2026-11-06-aba-do-kit-no-orca.md#limites)); o plano; `panel.tsx` (`SECOES`, `Trilho`, `Cabecalho`, `Carregando`, `Painel`, as três seções); `vista.ts` (`haQuanto`, `horaSP`, `nomeDoDia`, `cortar`, `plural`); `protocol.ts`; `worker.ts` (`kit.ler`, o cache de 60 s do `worker-list`); `estado-deduzido.mjs#deduzir` e `batida.mjs` (`PRAZO_MIN = 30`); a revisão do pane deduzido ([`2026-11-05-pane-estado-deduzido.md`](2026-11-05-pane-estado-deduzido.md), regras D1, D6 e D7). O repositório não tem `design/design-system.json`: a direção é a própria da aba (v4), e a base do plugin entra só como referência citada (ARQ-01, PRIN-01 a 06, PESO-01 e 02, COR-03 e 04, MSG-01, 02 e 06, EST-01 a 04, CONV-11).
- **Premissa corrigida pela coordenação (06/11):** o `SeloDoProjeto({ projeto, item })` do F451 (`orca/painel-do-kit/src/selo-do-projeto.tsx`) escreve o projeto em `Text xs semibold`, sem tom, seguido de ` · F<n>` em `xs muted`. O projeto não ganha cor, porque os cinco tons já significam estado (D2 da revisão `2026-11-06-cartoes-projeto-e-cor.md`, ainda fora da main). Nesta seção o projeto aparece no cabeçalho do grupo, e o cartão não o repete.

### O que medi (06/11, 10:15–10:20 SP)

- **11 itens vivos:** 6 no izanagi e 5 no kit-de-orquestracao. O `deduzido.json` foi gravado às 10:17:36 e lido às 10:19:16, o que confirma a cadência de cerca de 1 min do plano. A revisão do pane, que fala em 10 min, está velha nesse ponto.
- **Tamanho dos títulos dos 290 itens:** mediana de 68 caracteres, p90 de 101, máximo de 131. Com o `F<n> · ` na frente, o nome passa de duas linhas `sm` em 308 px.
- **Tamanho do `agora`:** mediana de 23 caracteres, p90 de 78, máximo de 198. O campo nem sempre está em dia. Exemplo do F439: "dona é o worker do Orca (…); sem sessão do app". Isso é uma nota, não o que a sessão faz agora.
- **Fila do izanagi:** o gate rodava o PR 1716 desde 10:12, com `ocupada` e `emVoo` preenchidos. A fila do kit estava vazia, mas o F436 e o F439 estavam na etapa `merge` com PR aberto. **PR aberto fora da fila é um caso real e frequente neste repositório.**
- **PRs mergeados:** um item vivo tem 14 PRs mergeados e `fatiaMergeada: true`. Pela regra do plano, ele mostraria "fatia 15" ([D11](#d11)).

## Tarefa
O operador olha a seção e responde, para cada projeto: **qual sessão precisa de mim, qual parou, e em que pé está cada uma**. É leitura. O único gesto que a seção gera é ir responder a pergunta que prende uma sessão, e esse gesto mora em Perguntas.

## Quem e onde
- **Quem:** o operador, sozinho. Olha a seção várias vezes por hora, entre uma conversa e outra, e às vezes a deixa aberta como monitor.
- **Largura:** a da aba. A referência é 360 px e o pior caso, 320 px. Sobram cerca de 308 px de conteúdo na referência e cerca de 268 px no pior caso, ao lado do trilho de 44 px.
- **Densidade:** instrumento (DENS-01). `Text sm` no corpo e `xs` no metadado; nada em `md` fora do título da seção.
- **Arquétipo:** Lista (ARQ-01, "o que pede a minha atenção?"), agrupada por projeto. O cartão aberto é uma Mesa de leitura em miniatura ("em que pé está isto"), sem primário próprio, porque o gesto mora em Perguntas (ARQ-01, a Mesa sem primário).
- **Ritmo do dado:** a aba relê a cada 30 s com a aba visível e quando o worker avisa (`kit.mudou`). O `deduzido.json` muda a cada ~1 min, a fila e as perguntas a cada leitura, e o `worker-list` a cada 60 s.

## Inventário

| O quê | Onde | Decisão que gera | Frequência | Veredito |
|---|---|---|---|---|
| Nome `F<n> · <título>` | 1ª linha do cartão | identificar de que item se trata | toda leitura | **fica**: cortado numa linha no fechado e inteiro no aberto ([D2](#d2)) |
| Projeto | cabeçalho do grupo | "em que repositório isto acontece" | toda leitura | **fica**, uma vez por grupo, e o cartão não o repete |
| Estado (selo com tom) | 2ª linha do cartão | "preciso agir, espero ou cobro?" | toda leitura | **fica** |
| Frase curta do agora | 2ª linha, depois do selo | "o que exatamente prende ou anda" | toda leitura | **fica**, numa linha cortada; o texto muda conforme o estado ([tabela](#estados-da-sessao)) |
| Tempo desde a última mudança | ponta da 2ª linha | "isto está andando?" | toda leitura | **fica**; vira `agora` quando a sessão do app está rodando |
| Q-ID da pergunta que prende | frase curta do Espera você | responder | várias por hora | **fica** |
| Título da pergunta e caminho para responder | cartão aberto | responder | várias por hora | **sob demanda** (cartão aberto): a pergunta inteira já mora em Perguntas, e a faixa do topo já avisa |
| Motivo da trava ou da espera | frase curta (cortada) e cartão aberto (inteiro) | intervir ou deixar com a dona | raro | **fica** cortado e **sob demanda** inteiro |
| `fatia k de m` (com todas mergeadas, `as m fatias mergeadas`; sem a dedução, nada) | frase curta do Trabalhando | "quanto falta" | toda leitura | **fica** |
| Etapas em bolinhas | cartão aberto | "o que já saiu e o que vem" | algumas vezes por dia | **sob demanda** (cartão aberto) |
| PRs abertos e mergeados | cartão aberto | abrir o PR (pelo número) | raro | **sob demanda** |
| Posição na fila e PR em gate | frase curta | "quando sai" | toda leitura | **fica** |
| Nota da sessão (`agora` inteiro), com a idade | cartão aberto | entender o contexto e ver se a nota está velha | raro | **sob demanda** |
| `Depende de F<n>` | frase da Parada e cartão aberto | por que o item não anda | raro | **fica** só quando o item é dependente e o outro não fechou |
| Entregues hoje | dobra fechada no pé de cada grupo | nenhuma aqui: ler a entrega é em Entregas | algumas vezes por dia | **sob demanda** (dobra). O motivo de ficar é o pedido explícito do operador; a dobra leva a Entregas ([D9](#d9)) |
| Número no trilho | sob o ícone da seção | abrir a seção | toda olhada | **fica**: conta as paradas que Perguntas não conta ([D7](#d7)) |
| Idade da leitura (`há 20 s`) | cabeçalho | confiar no que vê | toda leitura | **fica**, no cabeçalho que já existe |
| Idade do estado deduzido | faixa no topo da seção | confiar em etapa, PRs e paradas | raro | **fica** só quando passa de 5 min |
| `SeloDoProjeto` no cartão | — | nenhuma: o grupo já diz o projeto, e o nome já diz o `F<n>` | — | **sai** |
| Orquestradora do projeto | — | nenhuma: a fila sem turno roda sem ela | — | **sai** |
| Atividade em tempo real da dona do Orca | — | — | — | **sai**: a API não a expõe; o parado dela se mede pela última atividade |
| "Na fila para validar" | — | — | — | **sai**: não existe fila; o validador é um subagente dentro da sessão, e "validando" já cobre |
| Link do PR | — | abrir o PR | raro | **sai** por ora: o dado traz só o número, e a aba não chama o `gh` |
| Resumo, origem, tema, risco, custo, branch, worktree, dispatch, ids de sessão, ajudantes (`com[]`), histórico, origem do dado (`fontes`), PRs descartados, itens descartados | — | nenhuma no dia a dia | — | **sai** (PRIN-04) |

## Hierarquia e peso
- **Primário:** nenhum na seção (PESO-01; a Lista de leitura não tem primário). O único botão com efeito é `Responder em Perguntas`, `ghost`, dentro do cartão aberto do Espera você. Ele só navega.
- **Secundários:** o `IconButton` de abrir e fechar cada cartão, `ghost`, e o reler do cabeçalho, que já existe.
- **Ordem de leitura:** a faixa da pergunta aberta (que já existe), depois a faixa do dado velho, quando houver, depois os grupos.
- **Peso dos estados, pela gravidade (PESO-02, COR-03):** a borda `warning` do cartão Espera você é o único sinal forte em repouso. Depois vêm os selos `warning` e `danger`. O resto é neutro, e o estado em curso é palavra, não cor (COR-04).

```
Sessões                                   há 20 s  [↻]
izanagi · 6                                           Heading 3
┌──────────────────────────────────────────────┐      borda warning · raio md · padding sm
│ F442 · Izanagi 2.0 · S7: checkout e VT…  [⤢] │      sm semibold, truncate · IconButton ghost
│ [Espera você] pausado pelo operador…  há 5 h │      Badge warning · xs (truncate) · xs muted
└──────────────────────────────────────────────┘
┌──────────────────────────────────────────────┐      borda · raio md · padding sm
│ F441 · Izanagi 2.0 · S6: migração do s…  [⤢] │
│ [Executando] fatia 3 · medindo a S6…  há 2 min│     Badge neutral
└──────────────────────────────────────────────┘
│ F411 · Izanagi 2.0: estudo e plano…      [⤢] │
│ [Mergeando] ◌ PR 1716 · gate rodando  há 6 min│    Badge neutral + Spinner
▸ Entregues hoje · 2                                  Collapsible, fechado

kit-de-orquestracao · 5
│ F439 · Modo Orca: a sessão do Orca no…   [⤢] │
│ [PR aberto] PR 173 · fora da fila     há 5 h │
…
```

- **Cartão fechado:** duas linhas. Na referência, ~60 px de altura (padding `sm`, linha do nome, `gap xs`, linha do estado). Onze cartões, dois cabeçalhos e duas dobras ocupam ~820 px e cabem quase sem rolar no painel lateral.
  - **Linha 1:** `Row justify="between" align="center" gap="sm"`. O nome vai num `Box grow minWidth={0}` com `Text size="sm" weight="semibold" truncate`. O `IconButton` `expand`/`collapse` fica na ponta.
  - **Linha 2:** `Row align="center" gap="xs"`: o selo do estado (`Badge`, sem encolher); o `Spinner labelHidden` só em Mergeando; a frase em `Text size="xs" truncate`, dentro de um `Box grow minWidth={0}`; e o tempo em `Text size="xs" muted`, sem encolher.
  - **Espaço da frase:** o selo mais largo, `Gate vermelho` (~95 px), e o tempo `há 45 min` (~55 px) deixam ~150 px para a frase na referência, uns 25 caracteres de `xs`. A mediana do `agora` (23) cabe.
- **Cartão aberto:** acrescenta, nesta ordem e com `gap="sm"`:
  1. o nome inteiro, que troca o cortado no mesmo lugar;
  2. o bloco do motivo (a pergunta, a trava ou a espera);
  3. as etapas em bolinhas;
  4. os PRs;
  5. a nota da sessão;
  6. o `Depende de`.

  Cada bloco só aparece quando tem dado. Abrir é escolha da pessoa, então o cartão aberto pode passar de 200 px.
- **Grupos:** `gap="lg"` entre grupos e `gap="xs"` entre os cartões de um grupo, como as linhas de Decisões, para os cartões se lerem como lista e o grupo como unidade.
- **Ordem dos grupos:** pelo cartão mais urgente de cada um, na mesma escala dos estados, e pelo nome do projeto no empate ([D8](#d8)).
- **Ordem dos cartões no grupo:** Espera você → Travada (inclui `Gate vermelho`) → Parada (inclui `Sessão falhou` e `Sem sessão`) → Mergeando → Na fila → PR aberto → Validando → Trabalhando (Executando, No design, Planejando). No empate, o número do item, crescente. A ordem é estável: o cartão só muda de lugar quando o estado muda.

<a id="estados-da-sessao"></a>
### O estado de cada sessão: a fonte, o selo, a frase e o tempo

Um estado por cartão, pela primeira linha da tabela que casa (a causa vence o sintoma, como na D1 do pane). "Deduzido" é `batida/deduzido.json → itens[F]`; "fila" é `fila-de-merge/<projeto>.json`.

| # | Estado | Casa quando | Selo · tom | Frase curta | Tempo |
|---|---|---|---|---|---|
| 1 | Espera você | há pergunta `aberta` com `item = F`; ou `espera.motivo = operador`; ou `trava.motivo ∈ {operador, acesso}` ([D4](#d4)) | `Espera você` · `warning` | `Q1060 · <título da pergunta>`; sem pergunta, o `texto` da espera ou da trava | `há X` desde a pergunta (ou desde o `atualizadoEm` do item) |
| 2a | Travada | `trava.motivo ∈ {conflito, outra}` | `Travada` · `neutral` | `trava.texto` | `há X` desde o `atualizadoEm` do item |
| 2b | Travada por gate | `trava.motivo = gate-vermelho` | `Gate vermelho` · `danger` | `trava.texto` | idem |
| 3a | Parada | `deduzido.parado` (fora da etapa `merge`, como na D7 do pane) | `Parada` · `neutral` | `sem atividade`; com `dependeDe` aberto, `depende de F441` | `há X` desde `ultimaAtividade` (o selo já diz Parada) |
| 3b | Sessão falhou | o worker do Orca ligado ao item tem `state = failed` | `Sessão falhou` · `danger` | `a sessão no Orca terminou com falha` | `há X` desde `ultimaAtividade` |
| 3c | Sem sessão | `donaViva` é `false`, ou `null` num item sem dona registrada (o `null` da sessão do Orca registrada é "fora da vista", não sumida) | `Sem sessão` · `neutral` | `esperando a orquestradora abrir uma`; com `dependeDe` aberto, `depende de F441` | `há X` desde o `atualizadoEm` |
| 4 | Mergeando | um PR do item está em `emVoo` e a fila tem `ocupada` | `Mergeando` · `neutral` + `Spinner` | `PR 1716 · gate rodando` | `há X` desde `ocupada.desde` |
| 5 | Na fila | um PR do item está em `pendentes`, ou em `emVoo` sem `ocupada` | `Na fila` · `neutral` | `PR 173 · 2º da fila` (posição em `emVoo` + `pendentes`) | `há X` desde `ultimaAtividade` |
| 6 | PR aberto | etapa deduzida `merge`, com PR aberto fora da fila ([D5](#d5)) | `PR aberto` · `neutral` | `PR 173 · fora da fila de merge`; sem a dedução (estado velho), a etapa `merge` declarada dá só `fora da fila de merge`, porque a lista de PRs do item guarda também os já mergeados | idem |
| 7 | Validando | etapa `validacao` | `Validando` · `neutral` | o `agora`, cortado | idem |
| 8 | Trabalhando | etapa `planejamento`, `design` ou `execucao` | `Planejando` / `No design` / `Executando` · `neutral` | `fatia 2 de 4 · <agora>`, ou `fatia 3 · <agora>` sem total, ou só o `agora` | idem; `agora` quando a sessão do app está `rodando` |
| 9 | Entregue hoje | etapa `feito` com `feitoEm` no dia de hoje em SP | sem selo, porque fica na dobra Entregues hoje | — | a hora, `14:05` |

- **Sem nota:** sem `agora`, a frase de 7 e 8 fica vazia (ou só `fatia k de m`), porque o selo já diz a etapa; o tempo continua. Travada e Espera você sem motivo também ficam sem frase. *(Ajuste da crítica de UI, 06/11: a frase repetia o selo.)*
- **Dedução ausente ou com mais de 25 min:** as linhas 3a, 6, 7 e 8 usam a etapa que a dona declarou, como na D6 do pane.
- **Itens fora da seção:** `descartado` nunca aparece. Item `feito` de outro dia também não.

## Mensagens

Lugares pela matriz da ANATOMIA (MSG-01):
- **No item:** o selo e a frase de cada cartão.
- **Faixa:** um `Callout` no topo da seção, no máximo um (MSG-02).
- **No bloco:** o texto no fim do cartão aberto.

Nenhum texto cita spec, ADR, arquivo nem "batida" (MSG-05, CONV-11). As horas saem por `horaSP` e os intervalos por `haQuanto`.

| Mensagem (texto exato) | Lugar | Duração | Tom | Quem vê |
|---|---|---|---|---|
| Selos: `Espera você`, `Travada`, `Gate vermelho`, `Parada`, `Sessão falhou`, `Sem sessão`, `Mergeando`, `Na fila`, `PR aberto`, `Validando`, `Planejando`, `No design`, `Executando` | no item, 2ª linha | enquanto vale | pela [tabela](#estados-da-sessao) | operador |
| `há 12 min` / `agora` | no item, ponta da 2ª linha | enquanto vale | neutro (`muted`) | operador |
| `1 pergunta esperando você` + `Ver` | faixa que já existe na casca | enquanto há pergunta aberta | warning (borda) | operador |
| `O estado das sessões não se atualiza há 12 min. Etapa, PRs e paradas podem estar atrasados; a fila e as perguntas estão em dia.` | faixa, `Callout warning`, topo da seção | enquanto o estado deduzido passar de 5 min | warning | operador |
| `O estado das sessões não se atualiza há 40 min. As etapas abaixo são as que as sessões gravaram.` | idem, quando passa de 25 min | idem | warning | operador |
| `Não li as sessões: <motivo>.` + `Tentar de novo` | faixa, `Callout danger`, no lugar da lista | até reler com sucesso | danger | operador |
| `Não li a fila de merge deste projeto.` | no bloco, `Text xs muted` sob o cabeçalho do grupo; os cartões em `merge` ficam como `PR aberto` | até reler | neutro | operador |
| `Nenhuma sessão trabalhando agora` + `Quando a orquestradora abrir uma sessão para um item, ela aparece aqui.` | `EmptyState` | enquanto vale | neutro | operador |
| `Q1060 · <título da pergunta>` + `Responder em Perguntas` | no bloco, cartão aberto | enquanto a pergunta está aberta | warning (o selo) | operador |
| `Motivo: <texto inteiro>` | no bloco, cartão aberto | enquanto vale | neutro | operador |
| `Retome na sessão do F442.` | sob o motivo, cartão aberto, só em Espera você sem pergunta | enquanto vale | neutro (`muted`) | operador |
| `PR 173 aberto · PRs 168 e 165 mergeados` (com mais de três: `e mais 11 mergeados`) | no bloco, cartão aberto, `Text xs` | enquanto vale | neutro | operador |
| `Nota da sessão · há 2 h` + o `agora` inteiro | no bloco, cartão aberto | enquanto vale | neutro (rótulo `muted`) | operador |
| `Depende de F441, ainda aberto.` | no bloco, cartão aberto | enquanto vale | neutro | operador |
| `Todas as fatias têm PR mergeado; o item segue aberto.` | no bloco, sob as bolinhas | enquanto vale | neutro | operador |
| Rótulos do trilho: `Sessões · 2 paradas` / `Sessões · nenhuma parada` / `Sessões · não li as sessões` (no erro, o número fica o da última leitura boa) | dica do `IconButton` do trilho | enquanto vale | neutro | operador |
| `Entregues hoje · 2` | título do `Collapsible` | enquanto vale | neutro | operador |
| `Ver em Entregas` | botão no fim da dobra | — | neutro (`ghost`) | operador |

A faixa do dado velho não traz saída na própria faixa (MSG-06): a aba não reinicia o que deduz o estado, e quem o reinicia é a orquestradora. O texto diz o que continua confiável (fila e perguntas), e assim a faixa não pede um gesto que a pessoa não tem.

## Regiões e componentes

Só as peças do catálogo do Orca (a aba não é produto Wicomm, e o registro `@wicomm` não se aplica). Nenhuma peça nova.

- **Trilho:**
  - **O que muda:** uma linha nova em `SECOES`: `{ id: 'sessoes', nome: 'Sessões', icone: 'activity', tom: 'neutral', numero, rotulo }`. O ícone `activity` era o reservado para a seção "Agora" na v4, e esta seção ocupa esse lugar ([D12](#d12)).
  - **O que não muda:** `Trilho`, `IconButton` e `Badge`.
- **Cabeçalho:** sem mudança (`Cabecalho`, nome `Sessões`). A faixa da pergunta aberta aparece aqui como em toda seção que não é Perguntas.
- **Faixa da seção:** `Callout` (`warning` para o dado velho, `danger` para o erro), com `Text sm` e, no erro, `Button outline sm` `Tentar de novo`.
- **Grupo:**
  - **Cabeçalho:** `Heading level={3}` com `<projeto> · <n>`, em que `n` conta as sessões vivas do grupo, sem as entregues. É o mesmo desenho do `Hoje · 4` de Entregas.
  - **Corpo:** os cartões num `Box gap="xs"`; no pé, a dobra das entregues.
  - **Sem o `SeloDoProjeto`:** o cabeçalho já diz o projeto, e o `· F<n>` do selo repetiria o nome do cartão. O selo só entraria no cartão se ele saísse do grupo, por exemplo numa lista misturada de projetos, e esta seção não tem essa lista.
- **Cartão:**
  - **Fechado:** `Box border radius="md" padding="sm" gap="xs"`, sem fundo, como a linha de Decisões. Com Espera você, a borda é `border="warning"`, o mesmo contorno da faixa da casca. Dentro: `Row`, `Text`, `Badge`, `Spinner` (só em Mergeando) e `IconButton` `expand`/`collapse`, com `label` `Abrir F441` / `Fechar F441`.
  - **Aberto:** os blocos são `Box gap="xs"` com `Text`. A pergunta leva um `Button variant="ghost" size="sm"` `Responder em Perguntas`, que faz `set(secao, 'perguntas')`.
  - **Por que não `Collapsible`:** o título dele corta numa linha e a descrição é texto sem tom, e o selo do estado precisa do tom ([D1](#d1)).
- **Bolinhas:** `Row align="center" gap="xs"` por etapa, com `Box width={8} height={8} radius="full"` e `Text size="xs"`.

  | Bolinha | O `Box` | O rótulo |
  |---|---|---|
  | Feita | `background="success"` | `muted`, porque já passou |
  | Agora | `background="accent"` | `weight="semibold"`, com o estado no fim (`execução · travada`, `Fatia 2 · Lista de sessões — validando`); no merge, o que falta (`merge · 2º da fila`, `merge · gate rodando`, `merge · fora da fila`) |
  | Falta | `border="neutral"`, sem fundo | normal, porque é o que o operador quer ler ("as próximas etapas") |

  - **A diferença não depende só da cor:** feita × falta muda o preenchimento; feita × agora muda a cor e o peso do rótulo.
  - **8 px:** é metade da linha `xs` e a medida usual de ponto de estado. Abaixo disso, o anel da que falta vira um pingo. Acima, a bolinha compete com o selo.
  - **Não pude conferir no render.** A dona confere nos dois temas, a 360 px. Se o anel `border="neutral"` sumir sobre o fundo do Orca no tema escuro, sobe para 10 px. Se ainda sumir, a que falta vira `background="muted"` com o rótulo normal.
- **Quais bolinhas aparecem:**
  - **Com `fatias`:** uma bolinha por fatia.
    - **Quais estão feitas:** feitas = `min(prsMergeados, fatias.length)`, e a atual é a seguinte.
    - **Com mais de 7 fatias:** as feitas se juntam numa linha (`● Fatias 1 a 5 feitas`); depois vêm a atual e até 5 das que faltam, e o resto vira `e mais N`.
  - **Sem `fatias`:** a esteira `planejamento → execução → validação → merge → entregue`.
    - **Design:** conta em planejamento ([D6](#d6)).
    - **Merge:** cobre `PR aberto`, `Na fila` e `Mergeando`.
    - **Fatia sem total:** com `maisFatias`, a bolinha de execução diz `execução · fatia 3`.
- **Entregues hoje:**
  - **A dobra:** `Collapsible` fechado, título `Entregues hoje · N`.
  - **Uma linha por item:** `Text sm` `F432 · <título>` (quebra) e `Text xs muted` `14:05 · PR 168`.
  - **O fim:** `Button ghost sm` `Ver em Entregas`, que faz `set(secao, 'entregas')`.
  - **Recuo:** os 24 px da dobra cabem, porque as linhas não têm controles.
- **Vazio:** `EmptyState` (`icon="activity"`).
- **Carregando:** `Skeleton` na forma da lista agrupada (ARQ-01): um `Skeleton shape="text" lines={1}` (o cabeçalho do grupo) e três `Skeleton shape="block"` (os cartões).

Nomes sugeridos estão no [fim](#pecas-nomes-testes).

## Estados

| Região | Carregando | Vazio | Andando | Erro | Recusa | Sucesso | Sem permissão |
|---|---|---|---|---|---|---|---|
| Trilho | sem número (como as outras) | sem selo; rótulo `nenhuma parada` | — | número da última leitura boa | — | número das paradas | — |
| Seção | `Skeleton` agrupado | `EmptyState`; com entregues hoje, o `EmptyState` e, abaixo, os grupos só com a dobra | releitura: o `Spinner` do cabeçalho, com a lista no lugar | 1ª leitura da aba toda: o `Callout danger` da casca; só as sessões falharam: `Callout danger` `Não li as sessões` no lugar da lista, e as outras seções seguem | — (sem gesto que grave) | a lista | não se aplica: a seção lê arquivos e o `worker-list`, que a aba já pede |
| Grupo | — | grupo sem viva e sem entregue não aparece | — | fila ilegível: linha `Não li a fila de merge deste projeto.` e cartões em `merge` como `PR aberto` | — | — | — |
| Cartão | — | — | `Mergeando` com `Spinner` (o único em curso medido de fato) | dado do item ilegível: o item não aparece; o worker registra no log | — | — | — |
| Dado velho | — | — | — | estado deduzido com mais de 5 min: `Callout warning` com a idade, e a lista com a última dedução; com mais de 25 min, a lista usa o declarado e o texto diz isso | — | — | — |

- **Sobre a ação assíncrona (EST-03):** a seção não dispara trabalho. O reler já tem estado no cabeçalho, e `Responder em Perguntas` só navega.
- **Cartões abertos:** um átomo por item guarda quais estão abertos (`sessoesAbertas`, em memória). Eles sobrevivem à releitura e à troca de lugar na ordem, e fecham ao sair da aba.
- **Item que sai da lista com o cartão aberto** (fechou ou foi descartado): some na releitura seguinte, sem aviso. Se fechou hoje, aparece na dobra Entregues hoje.

## Movimento
Nenhum que a aba controle: o catálogo não tem duração nem curva. O Orca anima a dobra e o `Spinner` e respeita o `prefers-reduced-motion`.

A regra da aba continua sendo "nada se move sozinho", com uma exceção declarada. O cartão troca de lugar na releitura quando o estado dele muda de faixa. É o sinal que o monitor deve dar, e o cartão aberto continua aberto no lugar novo.

A seção não rola sozinha até o cartão que mudou, e os grupos só trocam de ordem quando muda o cartão mais urgente de algum deles.

## O que sai
- A atividade em tempo real da dona do Orca: a API não expõe o turno do agente. O "parado" dela se mede pela última atividade (`atualizadoEm`, commit, PR), e a 2ª linha nunca diz `trabalhando agora` para sessão do Orca.
- "Na fila para validar": não existe essa fila. O validador roda dentro da sessão, e o estado é `Validando`.
- O projeto dentro do cartão e o `SeloDoProjeto` nesta seção.
- A orquestradora do projeto no cabeçalho do grupo.
- O link do PR, porque o dado só tem o número.
- Os PRs descartados, os itens descartados e as entregas de outros dias (moram em Entregas).
- Resumo, origem, tema, risco, custo, branch, worktree, dispatch, ids de sessão, ajudantes (`com[]`), histórico e a origem do dado (`fontes`).
- O `minParado` gravado: o tempo sai de `ultimaAtividade` na hora do desenho, como na D1 do pane.
- `Badge` em `success` ou `accent` no cartão vivo: nada em curso ganha cor (COR-04), e o `accent` fica só com a bolinha de agora e a seção atual do trilho.

<a id="decisoes-ao-operador"></a>
## Decisões ao operador
Todas *assumidas, a confirmar*. Cada uma se desfaz trocando uma regra do desenho.

<a id="d1"></a>
- **D1 · O cartão abre por botão, não por dobra.**
  - *O caso:* o pedido é "card compacto que pode abrir". A dobra do Orca (`Collapsible`) corta o título numa linha, só aceita texto sem cor na descrição e recua o conteúdo 24 px. O estado colorido não caberia nela.
  - *Se não decidir:* o cartão é uma caixa com borda, e um botão de ícone na ponta da primeira linha abre e fecha.
  - *Recomendação:* essa. É o mesmo gesto do `Ler inteiro` de Decisões, que o operador já usa, e mantém o selo com o tom na linha que se lê.
<a id="d2"></a>
- **D2 · O nome corta numa linha no cartão fechado.**
  - *O caso:* a v4 manda o título de cartão quebrar, nunca cortar. Aqui o título mediano tem 68 caracteres e passaria de duas linhas a 308 px, e o cartão deixaria de ser compacto.
  - *Se não decidir:* o nome corta pela largura real no fechado e aparece inteiro no aberto.
  - *Recomendação:* essa, como exceção desta seção. Aqui a decisão se toma pelo estado, não pelo título; o `F<n>` e as primeiras palavras identificam o item, e o nome inteiro está a um toque.
<a id="d3"></a>
- **D3 · O tom de cada estado.**
  - *O caso:* "travada" e "parada" podem pedir vermelho, mas um conflito de rebase ou uma sessão ociosa não são defeito, e quem resolve é a dona ou a orquestradora.
  - *Se não decidir:*
    - âmbar só em `Espera você` (a decisão é sua, COR-03);
    - vermelho só em `Gate vermelho` e `Sessão falhou` (algo quebrou);
    - neutro em todo o resto, inclusive `Travada` por conflito e `Parada`, com a palavra e a ordem fazendo o trabalho.
  - *Recomendação:* essa. Um vermelho em cada trava passaria a ser mais forte que o âmbar, que é o único que pede você, e inverteria a prioridade.
<a id="d4"></a>
- **D4 · A trava por operador ou por acesso, e a espera pelo operador, viram `Espera você`.**
  - *O caso:* o item pode esperar você sem pergunta aberta. O F442, por exemplo, está "pausado pelo operador para trocar de conta". Sem esta regra, ele seria só uma "trava" neutra.
  - *Se não decidir:* esses itens ganham o selo âmbar e a borda âmbar, com o texto da espera na frase.
  - *Recomendação:* essa. É a única forma de este caso aparecer, porque Perguntas não o mostra. A trava por `gate`, ao contrário, fica com a fila.
<a id="d5"></a>
- **D5 · PR aberto fora da fila é um estado próprio.**
  - *O caso:* medido hoje, o F436 e o F439 estão na etapa merge com PR aberto, e a fila do kit está vazia. Não estão nem "na fila" nem "mergeando".
  - *Se não decidir:* o selo `PR aberto`, com `PR 173 · fora da fila de merge`.
  - *Recomendação:* essa. Chamar de "na fila" mentiria, e é justamente o caso em que alguém precisa anotar o PR.
<a id="d6"></a>
- **D6 · Design conta como planejamento nas bolinhas.**
  - *O caso:* a esteira tem cinco bolinhas, e "design" não é uma delas.
  - *Se não decidir:* design ocupa a bolinha de planejamento, com o rótulo `planejamento · design`, e o selo diz `No design`.
  - *Recomendação:* essa. No fluxo do kit, o design é uma revisão escrita antes de qualquer tela, sem código. A execução começa quando o código começa, e a dedução também mantém `design` antes de `execucao`.
<a id="d7"></a>
- **D7 · O número do trilho conta as paradas que Perguntas não conta.**
  - *O caso:* contar as sessões vivas dá um número que nunca zera (hoje, 11) e não diz se vale abrir a seção. Contar as que esperam você repetiria o número de Perguntas.
  - *Se não decidir:* o número soma Travada, Gate vermelho, Parada, Sessão falhou, Sem sessão e Espera você **sem** pergunta aberta. O tom é neutro, e no zero não há selo (o rótulo diz `nenhuma parada`), como nas outras seções.
  - *Recomendação:* essa. O número diz "há algo fora do ritmo que nenhuma outra seção mostra". O zero sem selo segue a v4, embora a EST-04 peça o `0`, e mudar isso vale para o trilho inteiro, não só para esta seção.
<a id="d8"></a>
- **D8 · Os grupos se ordenam pela urgência.**
  - *O caso:* com dois ou três projetos, o grupo de baixo pode ter a única sessão travada.
  - *Se não decidir:* vem primeiro o grupo com o cartão mais urgente, e o nome do projeto desempata.
  - *Recomendação:* essa. Os grupos só trocam de lugar quando muda a urgência, que é quando o operador deve olhar. A ordem alfabética seria mais quieta, mas esconderia a trava.
<a id="d9"></a>
- **D9 · As entregues de hoje ficam numa dobra fechada no pé de cada grupo.**
  - *O caso:* o pedido inclui "entregue", mas o item entregue não pede nada a você, e a entrega inteira já mora em Entregas.
  - *Se não decidir:* a dobra `Entregues hoje · N` por projeto, com uma linha por item e `Ver em Entregas`.
  - *Recomendação:* essa. Fica à mão para conferir o dia sem disputar espaço com quem está vivo.
<a id="d10"></a>
- **D10 · O item vivo sem sessão aparece como `Sem sessão`.**
  - *O caso:* a seção se chama Sessões, mas um item na fila de abertura não tem sessão.
  - *Se não decidir:* ele aparece com o selo `Sem sessão` e a frase `esperando a orquestradora abrir uma`, e entra na conta do trilho.
  - *Recomendação:* essa. Escondê-lo deixaria sem lugar o caso "nada anda e ninguém está nele". Se a fila de abertura crescer, a alternativa é juntá-los numa dobra `Sem sessão · N` no pé do grupo.
<a id="d11"></a>
- **D11 · Fatias feitas contadas por PR mergeado erram quando há PR de conserto.**
  - *O caso:* um item vivo hoje tem 14 PRs mergeados. Sem a lista de fatias, a regra aprovada mostraria `fatia 15`; com a lista, um PR de conserto adiantaria uma bolinha.
  - *Se não decidir:* a regra fica como aprovada, com um teto: com mais PRs mergeados que fatias, todas aparecem feitas e o cartão diz `Todas as fatias têm PR mergeado; o item segue aberto.`
  - *Recomendação:* manter a dedução e o teto, e acrescentar uma linha ao manual da dona: quem abre um PR de conserto no meio das fatias reescreve `fatias` incluindo-o. Sem a lista, mostrar `fatia k` só até k = 6; acima disso, `<n> PRs mergeados`, porque `fatia 15` é um número que ninguém planejou. Isto mexe numa decisão já tomada e precisa do seu ok.
<a id="d12"></a>
- **D12 · Sessões ocupa o lugar da seção "Agora" prevista na v4.**
  - *O caso:* a v4 reservou `Agora` (ícone `activity`, "sessões, fila, parados") para uma fatia futura. Sessões cobre o mesmo assunto.
  - *Se não decidir:* Sessões usa o `activity`, e "Agora" sai da lista de seções futuras.
  - *Recomendação:* essa. Duas seções sobre o mesmo assunto dividiriam o trilho.

<a id="pecas-nomes-testes"></a>
## Peças, nomes e testes

**Peças do catálogo:** `Box`, `Row`, `Text`, `Heading` (3), `Badge`, `IconButton`, `Button`, `Spinner`, `Collapsible`, `Callout`, `EmptyState`, `Skeleton`. Nenhuma peça nova. O `SeloDoProjeto` do F451 não entra nesta seção (o motivo está em *Regiões e componentes*, item Grupo).

**A conta sai do painel.** A tabela de estados, a ordem e as bolinhas ficam num núcleo puro (`orca/painel-do-kit/src/nucleo/sessoes.mjs`, testado em `node --test`), chamado pelo worker no `kit.ler`. O painel recebe a vista pronta e só desenha.

**O contrato que a dona já escreveu** (`protocol.ts`, `VistaDasSessoes`, sem commit em 06/11) tem 7 estados (`esperando · parada · mergeando · na-fila · validando · trabalhando · entregue`) e o `tipoDeParada`. A revisão cabe nele com quatro ajustes:

1. **Os 11 selos da tabela saem do estado com uma sub-classificação.**

   | Estado do contrato | Selos |
   |---|---|
   | `parada` | `Travada`, `Gate vermelho`, `Parada`, `Sessão falhou` e `Sem sessão`, pelo `tipoDeParada` (`conflito`, `outra`, `gate-vermelho`, `sem-movimento`, `falhou` (novo), `sem-dona`) |
   | `na-fila` | `Na fila` ou `PR aberto`, por um campo novo `foraDaFila: boolean` e `posicaoNaFila: number \| null` |
   | `trabalhando` | `Planejando`, `No design` ou `Executando`, pela `subEtapa` |

   Assim, o selo e o tom podem ser calculados no painel, numa tabela única (`SELOS`), ou vir prontos do núcleo. Recomendo a tabela no painel, para o tom ficar perto do desenho.
2. **`acesso` e `operador` vão para `esperando`, não para `parada`.** O comentário de `tipoDeParada` hoje os põe em `parada` ([D4](#d4)).
3. **O tempo é calculado na hora do desenho.** O `minParado` gravado congela no momento da leitura; o painel calcula a partir de `desdeEm` (a última atividade, ou `ocupada.desde` em Mergeando), como na D1 do pane.
4. **Campos que a revisão pede e o contrato não tem:**
   - na `Sessao`: `dependeDe`, `rodando`, `notaEm` (a idade do `agora`), `maisBolinhas`, `todasFeitas`;
   - no grupo: `filaIlegivel`;
   - na `VistaDasSessoes`: `paradas` (o número do trilho, [D7](#d7)) e `erro` (a leitura das sessões falhou sem derrubar a aba).

   Saem do contrato `tema` e `dona` (a revisão não os mostra), e `resultado` só serve à dobra Entregues hoje. Hoje o `entregue` vem como `Sessao`; ele pode continuar assim, desde que o painel o separe na dobra.

**Nomes no `panel.tsx`:**

| Componente | O que é |
|---|---|
| `Sessoes({ l })` | a seção |
| `AvisoDasSessoes({ l })` | a faixa do dado velho ou do erro |
| `GrupoDoProjeto({ g })` | o cabeçalho e os cartões de um projeto |
| `CartaoDaSessao({ s })` | o cartão fechado e aberto |
| `LinhaDoEstado({ s })` | a 2ª linha do cartão |
| `SeloDoEstado({ s })` | o `Badge` do estado |
| `DetalheDaSessao({ s })` | os blocos do cartão aberto |
| `Etapas({ s })` | a lista das bolinhas |
| `Bolinha({ como })` | uma bolinha |
| `EntreguesHoje({ g })` | a dobra do pé do grupo |

Também mudam o `Secao`, que ganha `'sessoes'`, a linha nova em `SECOES`, o caso novo em `Carregando` e o átomo `sessoesAbertas`. As contas de tempo continuam em `vista.ts` (`haQuanto`, `horaSP`), e `tempoDaSessao(s, agora)` entra lá.

**Casos do teste do painel (`panel.test.tsx`):**

- **Trilho:**
  1. Mostra a 4ª seção com `activity`, e o rótulo e o selo seguem `paradas`. Com 0: sem selo, rótulo `Sessões · nenhuma parada`. Antes, o teste prova que o selo aparece com 2.
  2. Abrir a aba com pergunta aberta ainda começa em Perguntas, e a faixa `1 pergunta esperando você` aparece em Sessões.
- **Grupos e ordem:**
  3. Os grupos vêm na ordem da urgência, com empate pelo nome; o cabeçalho diz `izanagi · 6` e não conta as entregues.
  4. Dentro do grupo, a ordem da tabela, com empate pelo número do item.
- **Cartão fechado:**
  5. Duas linhas: nome com `truncate`, e o selo com o texto e o tom de cada um dos 11 estados (um caso por linha da tabela), a frase e o tempo. O projeto não aparece no cartão.
  6. `Espera você` tem `border="warning"` e o Q-ID na frase.
  7. `Gate vermelho` sai em `danger`, e `Travada` por conflito em `neutral`.
  8. `Mergeando` tem `Spinner`, e o tempo é contado de `ocupada.desde`.
  9. Sessão do app `rodando` mostra `agora`. A do Orca nunca o mostra.
- **Cartão aberto:**
  10. `Abrir F441` troca o nome cortado pelo inteiro e mostra os blocos. O cartão continua aberto depois de uma releitura que muda o estado e a posição dele.
  11. `Responder em Perguntas` troca a seção para Perguntas.
- **Bolinhas:**
  12. Com `fatias` de 4 e 1 PR mergeado: feita, agora, falta, falta.
  13. Com 5 mergeados e 4 fatias: as 4 feitas, mais a linha `Todas as fatias têm PR mergeado`. Com mais de 7 fatias todas mergeadas, `Fatias 1 a 8 feitas`, a última como bolinha e a mesma linha.
  14. Com 9 fatias: a linha das feitas juntas e o `e mais N`.
  15. Sem `fatias`: a esteira de 5. Com etapa `design`, a agora é a de planejamento, com `planejamento · design`.
  16. Cada tipo de bolinha tem o `Box` certo: a feita com `background="success"`, a de agora com `"accent"` e a que falta só com `border`.
- **Entregues hoje:**
  17. Entram só os de hoje em SP: `feitoEm` às 22:30 de ontem em SP (01:30 UTC de hoje) não entra; 00:10 de hoje em SP entra.
  18. `Ver em Entregas` troca a seção.
- **Estados da seção:**
  19. Vazio: o `EmptyState`. Vazio com entregues hoje: o `EmptyState` e a dobra.
  20. Estado deduzido de 4 min: sem faixa. De 6 min: `Callout warning` com `há 6 min`. De 30 min: o texto do declarado. O teste prova antes que a faixa aparece com 6 min, para que a ausência com 4 min valha.
  21. `erroDasSessoes`: `Callout danger` `Não li as sessões` com `Tentar de novo`, e as outras seções seguem normais.
  22. Fila ilegível num projeto: a linha sob o cabeçalho, e o cartão em `merge` como `PR aberto`.
  23. Carregando: os `Skeleton` na forma agrupada.
- **Texto:**
  24. Nenhum texto da seção contém `SPEC`, `ADR`, `.md` nem `batida`, e as horas são as de SP. O teste afirma antes que a lista de textos não está vazia.

**Casos do núcleo (`test/sessoes.test.mjs`), um por regra da tabela, com os nomes do contrato:**
- **Precedência:** pergunta aberta e trava ao mesmo tempo dão `esperando`.
- **Trava por pessoa:** trava `acesso` e trava `operador` dão `esperando`.
- **Fila:** `emVoo` sem `ocupada` dá `na-fila`; `merge` fora da fila dá `na-fila` com `foraDaFila`; a posição na fila conta `emVoo` antes de `pendentes`.
- **Sessão:** worker `failed` dá `parada` com `falhou`; `donaViva: null` dá `parada` com `sem-dona`; `dependeDe` aberto entra na frase.
- **Parado:** o parado em `merge` não vale.
- **Dedução:** com mais de 25 min, cai no declarado; `em` no futuro conta como ilegível.
- **Fatias:** o teto das feitas; `fatia k` sem total.
