# Revisão de arquitetura — aba do kit no Orca: o projeto primeiro, detalhes no compacto e cor de estado (F451)

- **Data:** 2026-11-06 (SP) · **Autor:** designer (subagente), para a dona do F451.
- **Estado:** proposta v2. A crítica deu 24/30 (aprovada com ressalvas); os 5 achados estão aplicados no [§ Ajustes da crítica](#ajustes), que vale sobre o texto acima quando divergem. O juízo final vem do render, com as capturas no PR.
- **Parte de:** [`2026-11-06-aba-do-kit-no-orca.md`](2026-11-06-aba-do-kit-no-orca.md) (a "revisão de base"). Valem dela, sem repetir aqui: o [catálogo do que o Orca deixa desenhar](2026-11-06-aba-do-kit-no-orca.md#limites), a [direção "mesa de controle"](2026-11-06-aba-do-kit-no-orca.md#direcao), as [mensagens](2026-11-06-aba-do-kit-no-orca.md#mensagens), os [botões](2026-11-06-aba-do-kit-no-orca.md#botoes) e os [estados](2026-11-06-aba-do-kit-no-orca.md#estados). Esta revisão só diz o que muda.
- **Pedido (operador, 06/11):** o projeto vem primeiro e com destaque em todo cartão; a decisão confirmada continua compacta, mas abre para os detalhes; Decisões e Entregas sempre dizem de que projeto são; mais cor no painel.
- **Fontes:** o projeto não tem `design/design-system.json`. A norma é a da revisão de base e do código (`orca/painel-do-kit/src/panel.tsx`, `vista.ts`, `protocol.ts`). Os códigos da base Wicomm (`PRIN-04`, `COR-03`, `COR-08`, `COR-09`) aparecem como referência citada, não como norma.
- **Render:** não capturei. O `orca plugin shot --scenario` exige a janela do Orca escondida, e o operador estava usando a janela. O juízo final vem das capturas no PR: 320 e 360 px, tema escuro e claro, com os cenários novos do [§ Estados](#estados).

<a id="tarefa"></a>
## Tarefa
O operador olha um cartão e sabe **de que projeto ele é** antes de ler qualquer outra coisa. Depois responde, confirma ou limpa, como na revisão de base. Num compacto, ele pode reabrir o que foi decidido sem sair do lugar.

## Quem e onde
Igual à revisão de base: o operador, que despacha várias vezes por hora entre vários projetos (kit-de-orquestracao, Izanagi, WiControl…). A barra lateral do Orca tem 360 px de referência e 320 px no pior caso, o que deixa ~268 px úteis e ~236 px dentro de um cartão com `padding md`. A densidade é de instrumento. O arquétipo é a Lista (*o que pede a minha atenção?*). O que mudou foi o número de projetos na mesma lista: com dois ou mais, o cartão sem projeto não responde *de onde veio isto*.

<a id="inventario"></a>
## Inventário (só o que muda)

| O quê | Onde está hoje | Que decisão gera | Frequência | Veredito |
|---|---|---|---|---|
| Nome do projeto | no metadado, depois do título, em `xs muted` (só na pergunta aberta); some no compacto, na decisão e na entrega; na Decisões, vai ao fim da descrição do grupo quando há mais de um | *é do projeto em que estou pensando? abro a sessão de qual janela?* | todo cartão | **fica**: primeira linha de todo cartão, na peça `SeloDoProjeto`; na Decisões, título do bloco de projeto |
| Item (`F435`) | prefixo do título (`F435 · …`) e, às vezes, de novo no metadado | *qual sessão*, e é o destino da resposta | todo cartão | **fica**, na `SeloDoProjeto` ao lado do projeto. **Sai** do começo do título |
| `espera há 42 min` | no metadado `xs muted` | *qual responder primeiro* | pergunta aberta | **fica**, como selo `warning` na linha de estado |
| Q-ID | no metadado | citar a pergunta no chat | raro | **fica**, em `xs muted` na linha de estado |
| Selo de entrega (`Entregue a F435`…) | numa `Row` própria, abaixo da resposta | *chegou ou tenho de agir?* | compacto, pendente | **fica**, na linha de estado (uma linha a menos) |
| Detalhes da decisão confirmada (decidiu, caso, quem, quando, confirmação) | não existem: a linha só diz `Confirmada: <título>` + `Desfazer` | *confirmei a coisa certa? desfaço?* | raro, mas é o que o operador pediu | **sob demanda**: botão `Ver detalhes`, que abre no lugar |
| Detalhes da pergunta respondida (caso, se ninguém decidir, recomendação) | somem quando o cartão vira compacto | *respondi a coisa certa? o que a sessão vai fazer?* | raro | **sob demanda**: o mesmo botão |
| Projeto na descrição da dobra do grupo | fim da descrição, só com dois projetos ou mais | — (o bloco de projeto acima já diz) | — | **sai** |
| `Não medido:` | `Text sm` comum, no meio do cartão de entrega | *confiro antes de aceitar?* | algumas entregas | **fica**, numa caixa `warning` ([D5](#d5)) |
| Chave do grupo de decisões | só o item (`porItem`): `F12` de dois projetos vira um grupo, e o `Confirmar as N do F12` confirma decisões dos dois | — | — | **defeito, corrigir**: a chave passa a ser `projeto + item` |

<a id="hierarquia"></a>
## Hierarquia e peso
Os primários continuam os da revisão de base: `Aceitar a recomendação` (pergunta) e `Confirmar as N do F…` (grupo). O projeto não é ação. Ele é a **primeira leitura**, e o destaque dele vem da posição (sempre em cima) e do contraste (texto cheio, `semibold`, contra o metadado `muted`). Não vem de tamanho nem de tom ([D1](#d1)).

Ordem dentro de cada cartão (todos os cartões, nas três seções):

1. **SeloDoProjeto**: `kit-de-orquestracao · F435`. 1 linha, ~16 px.
2. **Título**, sem o prefixo do item. `sm semibold` e quebra.
3. **Linha de estado**: selo de tom + `xs muted` (Q-ID, hora). À direita, o gesto `Ver detalhes` quando o cartão é compacto.
4. O resto como hoje (caso, recomendação, botões, destino).

A pergunta aberta cresce ~16 px: a SeloDoProjeto entra e o metadado vira a linha de estado. O compacto fica do mesmo tamanho, porque o selo sobe para a linha de estado.

<a id="origem"></a>
### A peça `SeloDoProjeto` (reutilizável; a aba de sessões do F452 importa)
- **Arquivo:** `orca/painel-do-kit/src/selo-do-projeto.tsx`. Componente sem estado: nenhum átomo, nenhum `read`, nenhum pedido ao worker.
- **Entrada:** `{ projeto: string | null; item: string | null }`.
- **Saída:**
  - `SeloDoProjeto(props)` devolve `Row gap="xs" align="center"` com `Text size="sm" weight="semibold"` `{projeto}` (sem `muted`, sem `tone`) seguido de `Text size="xs" muted` `· F435`. Projeto `null`: só `F435`, em `xs muted`, sem o `·` inicial. Os dois `null`: devolve `null` (nada desenhado, nenhum espaço reservado).
  - `partesDoSelo(o)` (pura) devolve `{ forte: string | null; fraco: string | null } | null`. É ela que o teste afirma.
  - `semPrefixoDoItem(titulo, item)` (pura) tira um `F435 · ` (ou `F435: `, `F435 — `) do começo do título quando o item é esse. Se sobra vazio, devolve o título inteiro.
  - `chaveDoGrupo(q)` (pura): `` `${projeto ?? '—'}:${itemDe(q) ?? 'sem-item'}` ``.
- **Nome longo:** o projeto nunca quebra. Acima de 28 caracteres é cortado no código, na palavra, com `…`. O projeto nunca usa `truncate`, que cortaria o item junto.
- **Projeto `null`** acontece com a pergunta gravada sem o campo. Nesse caso a peça não inventa `Sem projeto` no cartão. Só o título do bloco na Decisões diz `Sem projeto` ([§ Decisões](#decisoes)).

<a id="decisoes"></a>
### Decisões: projeto → item → linha
```
Decisões                                   há 20 s  [↻]
Confirmar só grava; ninguém é acordado.
kit-de-orquestracao · 12                   Heading 3
▾ F435 · Modo Orca    8 decisões · há 2 h  Collapsible (só o 1º do 1º projeto aberto)
  ┌ Usei a pasta orca/ para o plugin       borda neutra (a confirmar)
  │ Decidiu: …                     
  └ Q1031 · há 2 h        [⤢] [✎] [✓]
  ┌ Confirmada: Limpar não apaga  [Desfazer] [▾]   borda success
  └
  [Confirmar as 7 do F435]
▸ F432 · Pane deduzido   4 decisões · há 5 h
Izanagi · 3                                Heading 3
▸ F12 · Checkout         3 decisões · há 1 d
[Confirmar todas (15)]
```
- Os blocos de projeto são `Box gap="sm"` com `Heading 3` `<projeto> · <n a confirmar>`, o mesmo padrão dos dias em Entregas. A ordem é pela decisão mais recente. O bloco sem projeto vem por último, `Sem projeto · n`. Com um projeto só, o título continua: é o pedido "sempre dizer de que projeto é".
- As linhas não repetem o projeto (`PRIN-04`): ele está no título do bloco, sempre à vista acima da dobra.
- `Confirmar as N do F12` confirma só as decisões do projeto do bloco, porque a chave do grupo é `chaveDoGrupo`.
- O segundo toque do `Confirmar todas`, com mais de um projeto, diz `Inclui as que você não abriu, de 2 projetos.`

### Perguntas e Entregas
- **Perguntas:** a ordem continua a de quem espera há mais tempo, misturando projetos. Agrupar por projeto quebraria a ordem de urgência. A `SeloDoProjeto` encabeça cada cartão: aberto, compacto e pendente.
- **Entregas:** os grupos continuam por dia. A `SeloDoProjeto` encabeça cada cartão. O metadado `14:05 · PR 169 · dona-f432` fica, e não ganha selo: toda entrega está entregue, então um selo `Entregue` em todas não diria nada (`PRIN-04`). A linha `Limpa: <título>` e as linhas de `Ver as limpas` também começam pela `SeloDoProjeto`.

<a id="detalhes"></a>
### Compacto que abre para detalhes
**Como abre.** Por um `IconButton ghost size="sm"` com troca no lugar: `expand`/`collapse`, rótulo `Ver detalhes` ou `Esconder detalhes`. O `Collapsible` não serve aqui por três motivos:

- A linha da decisão já mora dentro da dobra do grupo, e dobra dentro de dobra não cabe.
- O cabeçalho do `Collapsible` não aceita o `Desfazer`.
- O `Collapsible` cortaria `Confirmada: <título>` em uma linha.

O mesmo gesto já existe na decisão pendente (`Ler inteiro`).

**Regra única:** todo compacto abre por esse botão (decisão confirmada, pergunta respondida, pendente, `fora`). O cartão cheio de entrega mantém a dobra `Detalhes`.

**Convivência com o `Desfazer`.** A linha é `Row justify="between" align="center" gap="sm"`. À esquerda vai `Confirmada: <título>` (`sm`, `tone="success"`, quebra). À direita, nesta ordem: `Desfazer` (`Button ghost sm`, por 10 s, só na confirmação de uma linha) e o `Ver detalhes` **na ponta**. Quando o `Desfazer` some, o botão de detalhes não pula de lugar.

**O que abre, no lugar e abaixo, em `Box gap="xs"`**. Texto exato. Cada linha só aparece se o dado existe.

| Compacto | Conteúdo aberto |
|---|---|
| Decisão confirmada | `Decidiu: <recomendação inteira>` (`xs`). Depois `<caso>` (`xs muted`, só se diferente do decidiu) e `Se ninguém decidir: <seNaoDecidir>` (`xs muted`). Depois `Decidida pela sessão do F435 · hoje, 14:05 · Q1031` (`xs muted`; sem item: `Decidida por uma sessão · …`). Por fim `Confirmada por você às 14:32.`, ou `… às 14:32, com o grupo.` / `… às 14:32, com todas.` (`xs muted`) |
| Decisão mudada (`Você mudou: …`) | as mesmas linhas, com `Mudada por você às 14:32.` no lugar da confirmação |
| Pergunta respondida, pendente, `fora` | `<caso>` (`sm`) e `Se ninguém decidir: …` (`sm muted`). Depois a recomendação na mesma caixa da pergunta aberta (`muted`, borda `accent`, rótulo `Recomendação`). Por fim `Perguntada pela sessão do F435 · hoje, 13:50` (`xs muted`) |

- O projeto não entra na dobra: já está na `SeloDoProjeto` ou no título do bloco. A resposta também não, porque já está à vista (`Você respondeu: …`).
- O dia segue o `nomeDoDia` em minúscula (`hoje`, `ontem`, `terça, 3 de nov`), e a hora é de SP.
- O `Feito` de `confirmada` e de `feito` passa a guardar `em` (a hora do clique). Hoje a hora só se deduz do `ate`. No pendente, a hora é o `em` da `entregaDaResposta`.
- O estado aberto mora no átomo `detalhes` (`Record<id, boolean>`, sem `persist`) e sobrevive à releitura de 30 s. Se a pessoa tinha aberto `Ler inteiro` na linha pendente e então confirmou, a linha confirmada nasce aberta, porque ela estava lendo.

**Linha de estado do compacto de pergunta:** `[Entregue a F435]  14:32 · Q1071` à esquerda e `[▾ Ver detalhes]` na ponta. É uma `Row wrap`: com 236 px, o texto passa para baixo do selo, e o botão fica à direita.

<a id="cor"></a>
### Onde entra cor (só estado; projeto não tem tom)

| Estado (o que pede de você, `COR-03`) | Tom | Onde |
|---|---|---|
| Esperando você (pergunta aberta) | `warning` | borda do cartão aberto (`Box border="warning"`); selo `espera há 42 min`; selo do trilho (como hoje); faixa (como hoje) |
| Feito e deu certo (confirmada, entregue, enviado) | `success` | borda da linha confirmada; borda e selo do compacto entregue; **selo do trilho de Entregas** (era `neutral`); texto dos desfechos (como hoje) |
| Quebrou (entrega falhou, não gravou, não confirmou) | `danger` | borda do cartão ou da linha com erro; selo `A entrega falhou`; motivo (como hoje) |
| Confira antes de aceitar | `warning` | caixa `Não medido` na entrega ([D5](#d5)) |
| Andando, pendente sem endereço, limpa, fora | `neutral` | borda neutra, selo `Entrega pendente` (`COR-04`: em curso não tem matiz) |
| Foco (o único ponto de luz) | `accent` | inalterado: botão primário, borda da recomendação, seção atual do trilho |
| **Projeto** | nenhum | `SeloDoProjeto` e título do bloco em texto cheio, `semibold` ([D2](#d2)) |

- A cor nunca vem sozinha: toda borda de tom acompanha um selo ou um texto que diz o mesmo em palavras.
- **Pílula = estado.** O `Badge` só carrega estado e contagem, e o projeto nunca vira pílula. Assim a forma não diz duas coisas.
- **Caixa `Não medido`:** `Box border="warning" radius="md" padding="sm" gap="xs"` com `Text xs semibold tone="warning"` `Não medido` e o texto em `Text sm`. É a mesma forma da caixa `Recomendação`, com outro tom.
- O selo de Decisões no trilho continua `neutral`, como na [casca da revisão de base](2026-11-06-aba-do-kit-no-orca.md#casca): confirmar não destrava nenhuma sessão.

## Mensagens (novas ou mudadas)

| Mensagem | Lugar | Duração | Tom | Quem vê |
|---|---|---|---|---|
| `<projeto> · F435` | SeloDoProjeto, 1ª linha do cartão | enquanto o cartão existe | neutro (forte + fraco) | operador |
| `<projeto> · 12` / `Sem projeto · 3` | título do bloco em Decisões | enquanto há decisão | neutro | operador |
| `espera há 42 min` | selo, linha de estado | enquanto aberta | warning | operador |
| `Ver detalhes` / `Esconder detalhes` | IconButton, ponta da linha do compacto | enquanto o compacto existe | neutro | operador |
| `Decidida pela sessão do F435 · hoje, 14:05 · Q1031` | dobra no lugar | até esconder | neutro | operador |
| `Confirmada por você às 14:32.` (`, com o grupo.` / `, com todas.`) · `Mudada por você às 14:32.` | idem | idem | neutro | operador |
| `Perguntada pela sessão do F435 · hoje, 13:50` | idem, compacto de pergunta | idem | neutro | operador |
| `Não medido` | rótulo da caixa da entrega | enquanto a entrega existe | warning | operador |
| `Inclui as que você não abriu, de 2 projetos.` | segundo toque do `Confirmar todas` (só com 2 projetos ou mais) | 8 s | neutro | operador |

## Regiões e componentes
- Cartões e linhas: `Box` (borda com tom), `Text`, `Badge`, `IconButton`, `Button`. Blocos de projeto: `Heading 3`. Nenhuma peça do Orca é nova.
- Peça nova da aba: `SeloDoProjeto` ([acima](#origem)), em `src/selo-do-projeto.tsx` para o F452 importar. Aqui o "registro" é a pasta de peças da aba, não o `@wicomm`: a aba não é produto Wicomm.

<a id="estados"></a>
## Estados
O que a revisão de base já diz continua valendo. O que muda:

- **Carregando:** sem SeloDoProjeto (os `Skeleton` da revisão de base).
- **Vazio:** igual.
- **Andando** (`Gravando…`, `Confirmando…`): borda neutra. A SeloDoProjeto fica.
- **Erro:** borda `danger`.
- **Recusa** (versão mudou): o cartão volta aberto, com borda `warning`.
- **Compacto:** fechado por padrão. Aberto, mostra a tabela do [§ Detalhes](#detalhes).
- **Releitura automática:** não fecha a dobra nem tira a linha confirmada. O `Reler agora` tira a linha (revisão de base), e a dobra vai junto.

Cenários novos do `panel.check.ts`, para as capturas do PR:

- `decisoes com dois projetos`: kit-de-orquestracao e Izanagi, os dois com um `F12`.
- `decisao confirmada aberta`: `--act` em `Confirmar` e depois em `Ver detalhes`.
- `pergunta respondida aberta`.
- `entrega com não medido`.
- `pergunta sem projeto`.

Todos nos dois temas.

## Movimento
Nenhum novo. Tudo abre no lugar e sem rolar. O Orca cuida do `prefers-reduced-motion`.

<a id="sai"></a>
## O que sai
- O projeto no metadado depois do título (`kit-de-orquestracao · espera há 12 min · Q1060`).
- O prefixo `F435 · ` no começo do título de todo cartão, que a SeloDoProjeto já diz.
- O projeto no fim da descrição da dobra do grupo.
- A `Row` própria do selo de entrega no compacto e no pendente.
- O `Não medido:` como texto solto.
- O selo `neutral` do trilho de Entregas.

<a id="decisoes-ao-operador"></a>
## Decisões ao operador (assumidas, a confirmar)

<a id="d1"></a>
- **D1 · Como o projeto ganha destaque.**
  - *O caso:* você pediu o projeto primeiro e com destaque. O Orca só tem 5 tons, e nenhum serve para identificar. As opções são estas:
    - (a) texto `sm semibold` cheio na primeira linha, com o item em cinza ao lado;
    - (b) pílula cinza (`Badge neutral`) com o nome;
    - (c) tom `accent`: quase branco no escuro, quase igual ao texto normal, e gasta o único ponto de luz do cartão;
    - (d) nome em maiúsculas: chama mais a atenção, mas `KIT-DE-ORQUESTRACAO` lê pior e ocupa ~20% a mais da largura.
  - *Se ninguém decidir:* entra a (a). O projeto fica acima do título, mais forte que o metadado e mais fraco que o título.
  - *Recomendação:* (a). O título continua sendo o que você lê para decidir, e a pílula fica só para estado (entregue, falhou, espera). Se no render a (a) parecer fraca, trocar para (b) é uma linha na peça `SeloDoProjeto`, sem mexer nos cartões.
<a id="d2"></a>
- **D2 · O projeto não ganha cor.**
  - *O caso:* "mais cores" poderia virar uma cor por projeto. Mas os 5 tons já dizem estado (âmbar = espera você, verde = deu certo, vermelho = quebrou). Um projeto pintado de âmbar pareceria pergunta presa, e com 6 projetos as cores se repetem.
  - *Se ninguém decidir:* a cor entra só como estado: bordas dos cartões, selos, trilho de Entregas e `Não medido`.
  - *Recomendação:* essa (`COR-03`, `COR-08`). Cor de identidade por projeto só com cor livre no catálogo do Orca, um pedido ao Orca fora deste item.
<a id="d3"></a>
- **D3 · Detalhes por botão no lugar, não por dobra.**
  - *O caso:* a linha confirmada mora dentro da dobra do grupo, e a dobra do Orca não cabe dentro de outra, não aceita o `Desfazer` no cabeçalho e corta o título.
  - *Se ninguém decidir:* `Ver detalhes` na ponta da linha em todo compacto (decisão e pergunta). O cartão de entrega mantém a dobra `Detalhes`.
  - *Recomendação:* essa. É o gesto que a linha pendente já usa, e o botão não pula quando o `Desfazer` some.
<a id="d4"></a>
- **D4 · Decisões agrupadas por projeto, depois por item; Perguntas não.**
  - *O caso:* sem o projeto, o `F12` de dois projetos vira um grupo só (defeito de hoje), e o `Confirmar as N do F12` confirma os dois. Já em Perguntas, agrupar por projeto tiraria a pergunta mais presa do topo.
  - *Se ninguém decidir:* Decisões com blocos `Heading 3` por projeto; Perguntas na ordem de espera, com a SeloDoProjeto em cada cartão.
  - *Recomendação:* essa. A urgência manda em Perguntas, e o assunto manda em Decisões.
<a id="d5"></a>
- **D5 · `Não medido` em âmbar.**
  - *O caso:* âmbar quer dizer "decisão sua". O que a sessão não mediu pede uma conferência sua antes de você confiar na entrega, mas não prende nenhuma sessão.
  - *Se ninguém decidir:* caixa com borda âmbar.
  - *Recomendação:* âmbar, porque é a única linha da entrega que pede algo de você. Se o âmbar da caixa competir com a pergunta presa no render, ela volta a neutra, com a mesma caixa.

## Critérios verificáveis (teste de render)
1. Em todo cartão de pergunta aberta, compacto, pendente e entrega, o primeiro `Text` do cartão tem o nome do projeto, `weight="semibold"`, sem `muted` e sem `tone`.
2. `partesDoSelo({ projeto: 'kit-de-orquestracao', item: 'F435' })` devolve `{ forte: 'kit-de-orquestracao', fraco: '· F435' }`. Com `{ projeto: null, item: 'F435' }` devolve `{ forte: null, fraco: 'F435' }`, e com os dois `null` devolve `null`. Com os dois `null`, o cartão começa pelo título.
3. Com `item: 'F435'` e título `F435 · Fila de merge…`, o título desenhado é `Fila de merge…`. Com título só `F435`, fica `F435`.
4. Nenhum `Text`, `Badge` ou `Box` que mostre o nome do projeto tem `tone`.
5. O cartão de pergunta aberta tem `Box border="warning"` e um `Badge tone="warning"` com o texto `espera há 42 min`. O cartão com erro tem `border="danger"`.
6. O compacto entregue tem `border="success"` e `Badge tone="success"` `Entregue a F435` na mesma linha de `14:32 · Q1071`. O pendente tem borda e selo `neutral`, e o falhou tem `danger`.
7. A linha confirmada tem `border="success"` e `Confirmada: <título>` com `tone="success"`. Antes de 10 s, os controles à direita são `Desfazer` e, por último, `Ver detalhes`. Depois de 10 s, só `Ver detalhes`.
8. Fechada, a linha confirmada não mostra `Decidiu:`. Depois de `press` em `Ver detalhes`, mostra `Decidiu: <inteiro>`, `Decidida pela sessão do F435 · hoje, HH:MM · Q1031` e `Confirmada por você às HH:MM.`, e o rótulo vira `Esconder detalhes`. Confirmada pelo grupo, a última linha termina em `, com o grupo.`
9. Nenhum `Collapsible` é desenhado dentro de outro `Collapsible`, em nenhum cenário.
10. Com decisões de dois projetos, aparecem dois `Heading 3` (`kit-de-orquestracao · N`, `Izanagi · M`) na ordem da decisão mais recente, e nenhuma descrição de `Collapsible` contém o nome de projeto.
11. Com `F12` em dois projetos, há dois grupos. O `kit.confirmar` do botão `Confirmar as N do F12` de um bloco leva só os ids daquele projeto.
12. No trilho, o selo de Perguntas tem `tone="warning"`, o de Decisões `neutral` e o de Entregas `success`.
13. A entrega com `naoMedido` tem `Box border="warning"` com `Text tone="warning"` `Não medido`. A entrega sem `naoMedido` não tem essa caixa.
14. O segundo toque do `Confirmar todas` com decisões de 2 projetos mostra `Inclui as que você não abriu, de 2 projetos.` Com 1 projeto, mostra o texto da revisão de base.
15. Um compacto aberto continua aberto depois de uma releitura automática (`kit.mudou`).
16. O botão `Aceitar a recomendação` continua o único `solid accent` do cartão aberto, e a SeloDoProjeto não usa `accent`.

<a id="ajustes"></a>
## Ajustes da crítica (v2, valem sobre o texto acima)
1. **Projeto × título (P1).** O projeto não se funde ao título: o cartão começa por uma `Row justify="between" align="center"` com o `SeloDoProjeto` à esquerda e, à direita, o selo de estado (`espera há 42 min`, `Entregue a F435`, `Entrega pendente`, `A entrega falhou`). O título fica numa linha própria, abaixo, em `sm semibold`. A D1 passa a dizer: o projeto é a primeira linha do cartão, com o selo de estado na ponta; a diferença para o título vem da estrutura. Critério 1 ganha: projeto e título não estão no mesmo `Text` nem na mesma `Row`, e a `Row` do projeto contém o `Badge` de estado quando há estado.
2. **Borda × texto (P2).** A pergunta aberta mantém `border="warning"` em todo estado em que ainda espera (repouso, erro, recusa); o desfecho do gesto vai no `Text tone="danger"` do fim do cartão. `border="danger"` só no compacto ou na linha cuja entrega falhou ou cuja confirmação falhou.
3. **Trilho (P3).** O selo de Entregas fica `neutral`; sai a linha de § O que sai e o critério 12 vira `warning`/`neutral`/`neutral`. O verde fica dentro dos cartões.
4. **Densidade (P4).** O compacto cresce uma linha (o texto da § Hierarquia está errado nisso). Ordem do compacto: selo + estado, título, `Você respondeu: …`, linha `hora · Q-ID` com o botão de detalhes na ponta. Na linha confirmada: `Confirmada: <título>` sozinho em cima, na largura toda; embaixo `Row justify="end"` com `Desfazer` e o botão de detalhes; a altura é a mesma antes e depois dos 10 s (a linha de baixo fica, só o `Desfazer` some).
5. **Rótulo (P5).** `IconButton` só com ícone (`expand`/`collapse`), `label` `Ver detalhes: <título>` / `Esconder detalhes: <título>`.

<a id="critica-tela"></a>
## Crítica da tela implementada (2026-11-06)
Nota 24/30, aprovada com ressalvas. Sem captura de tela (o `plugin shot` não roda com a janela do Orca aberta): as larguras abaixo são estimativa.
- **Aplicado:** o bloco de projeto conta só o que falta confirmar e o bloco sem projeto vai por último; linha de decisão com confirmação recusada ganha `border="danger"`; a linha `fora` abre os detalhes; a linha `Limpa:` começa pelo selo; o selo não quebra entre projeto e item e o cabeçalho alinha ao centro; cabeçalho sem selo e sem estado não desenha linha vazia; cenários `(sem projeto)` e `(dois projetos)` nos dois temas.
- **Pendente (P1, a confirmar em captura de 320 px):** a primeira linha (projeto + item + selo de estado) pode quebrar em duas. Se quebrar, recomendação do crítico: voltar o selo de estado para a linha do título com o Q-ID e a hora. É decisão sobre o Ajuste 1, fica para o operador.
- **Fora desta entrega:** cenários com compacto aberto (precisam de `--act`) e o `Reler agora` não fecha os detalhes abertos.
