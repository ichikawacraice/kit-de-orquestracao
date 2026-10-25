# Revisão de arquitetura — o pane /painel (redesenho visual, F34)

- **Data:** 2026-10-25
- **Autora:** D1, designer do pool, a pedido da orquestradora
- **Estado:** liberada. Crítica 21/30 → recrítica 24/30 sem ressalva alta; todas as ressalvas aplicadas (§11)
- **Mock:** [`2026-10-25-painel-redesenho-mock.html`](2026-10-25-painel-redesenho-mock.html), estático, nos temas claro e escuro, com 5 estados
- **Parte de:** o desenho do painel por fila e tema (F27), em `~/.claude/orquestracao/estudos/2026-10-25-painel-por-fila-layout-d1.md` (fora deste repositório). Esta revisão muda a **cara** e a **divisão** do pane, e não muda os dados nem o contrato da coleção `fila`.
- **Fontes lidas:**
  - a captura de 25/10 (`~/.claude/orquestracao/pool/handoffs/painel-2026-10-25.png`);
  - o mod em `origin/main` (26768e7): `plugins/painel-sessoes/hooks/register.tsx` (940 linhas) e `hooks/desenho.ts` (417);
  - os tipos do motor de mods, para saber o que o pane do desktop desenha (§7).
- **Pedido do operador, nas palavras dele:** *"deixe claro a divisão das tarefas, os títulos, quem tá executando, separe melhor o que está na fila e o que está executando, melhore os botões pois hoje são só textos, enfim, deixe como se fosse um painel de frontend bonito"*.

---

## Tarefa

> **Ao abrir o pane, o operador sabe em cinco segundos se alguém espera por ele, se algo travou, quem está executando o quê e o que ainda não começou, e abre a sessão certa com um clique.**

São quatro perguntas, nesta ordem, e cada uma vira **uma seção com nome e cor próprios**:

| Pergunta | Seção | Gesto |
|---|---|---|
| Alguém espera por mim? | **Esperam você**: as perguntas com Q-ID **e** os itens que esperam o operador sem pergunta | responder aqui; abrir a sessão do item que espera |
| Algo travou? | **Travados** | abrir a sessão; se não há ninguém nela, pedir à orquestradora (fora do pane) |
| Quem está executando o quê? | **Executando** | acompanhar; abrir a sessão |
| O que ainda não começou? | **Na fila** | nenhum no pane: quem inicia é a orquestradora |

## Quem e onde

- **Quem:** o operador, um só, olhando o próprio pool de sessões.
- **Onde:** o pane lateral do Claude desktop. O código calcula `W = clamp(240, bodyColumns × 8 − 8, 900)`, e na prática ele fica entre **300 e 420 px**. O caso difícil é **300 px**. O mock tem colunas de 380 px e uma de 300 px (estados 6 e 7), e todo texto de linha única foi medido contra W = 292 px com o `em()` do `desenho.ts` (§Hierarquia, "Textos que cabem a 300 px").
- **Frequência:** muitas vezes por hora, olhando de relance. A tela é lida de cima para baixo e para na primeira seção que pede gesto.
- **Terminal:** continua com o desenho em texto de hoje. Esta revisão é do **desktop**, mas a ordem das seções e os nomes valem para os dois (§6).

## Inventário

O que o pane mostra hoje, com o veredito. As linhas marcadas como **muda** e **novo** são o redesenho.

| O quê | Onde está hoje | Decisão que gera | Frequência | Veredito |
|---|---|---|---|---|
| Quatro contadores | topo, 2×2 em `resumoSvg` | "preciso olhar?" | toda olhada | **fica**, com o rótulo "Andando" trocado por **"Executando"**: cada contador tem o nome de uma seção, e **o contador e a pílula da seção saem da mesma função de contagem** (`contarSecoes`), para nunca dizerem números diferentes |
| Item que espera o operador sem pergunta (`espera.motivo = 'operador'`) | selo "espera você" e texto âmbar na linha do item, que fica no meio de "Em sessão" | ir à sessão e responder lá | quando há | **muda:** sobe para a seção **Esperam você**, num cartão compacto (§1b). Hoje o contador já o conta e a lista não o mostra junto das perguntas |
| "lido às 18:22:15 · a cada 60 s" | sob os contadores | confiar no que vê | rara | **muda:** sobe para a barra do topo, curto: "Atualizado 18:22". O "relê a cada 60 s" vai para o `alt` |
| "↻ Atualizar" | botão `plain dimColor`, que se lê como texto | reler agora | rara | **muda:** vira botão nativo `secondary`, que mostra "Lendo…" enquanto lê |
| "Em sessão · 3" | `Text bold` | — | — | **sai:** dá lugar a duas seções, Travados e Executando |
| Subgrupo "TRAVADOS" | dentro de "Em sessão" | destravar | quando há | **muda:** vira a **seção** Travados, que só aparece quando há travado |
| Cabeçalho de tema ("SESSÕES E PAINEL") | `Text dimColor`, caixa alta, entre os itens | — (o tema não gera gesto) | toda olhada | **muda:** vira **etiqueta no topo do cartão** (Q238, decidida: sim). A ordem dos temas de `temas.json` continua sendo a ordem dos cartões |
| Item andando: ponto, título, etapa, dono, PR, `agora`, `depois` | `itemSvg` solto, separado por filete | acompanhar | toda olhada | **muda:** vira **cartão** (§Regiões) |
| **Quem executa** | só o apelido ("E2") no meio da linha 2 | abrir a sessão certa; ver se ela trabalha | toda olhada | **novo:** linha própria com o **selo** do apelido, o **papel** por extenso e a **situação da sessão**, que pode ser "trabalhando agora" ou "parada há 40 min" (§2) |
| "abrir E2" | botão `plain dimColor`, que se lê como texto | abrir a sessão | frequente | **muda:** vira botão nativo **"Abrir E2"** (`secondary`), dentro do cartão e com estado (§4) |
| Item na fila | mesmo `itemSvg`, com o ponto tracejado | reconhecer, ou cobrar o início | toda olhada | **muda:** vira **linha compacta**, sem cartão e sem botão, na seção Na fila com o filete tracejado |
| "parado há 51 min" | à direita, na fila | cobrar o início | toda olhada | fica |
| Selo "aguarda você · Q229" | na linha 2 do item | ir à pergunta | quando há | **fica**, como chip âmbar |
| Trava | linha vermelha solta | destravar | quando há | **muda:** vira **bloco tingido** dentro do cartão, com o motivo em negrito |
| PR | "#1129" azul no meio da linha | olhar o PR | às vezes | **fica**, como chip de contorno |
| Cartão de pergunta | `perguntaSvg` no topo | responder | quando há | **fica** como está, que já é o melhor bloco do pane: o tingido âmbar em SVG e os botões **logo abaixo dele**, fora do tingido, como hoje (§7). Só o "abrir" vira botão |
| ⚠ erros de leitura | lista vermelha solta | confiar ou reler | rara | **muda:** vira **faixa** tingida em SVG, com "Tentar de novo" logo abaixo dela |
| "✕ limpar avisos" | botão `plain` | limpar | rara | **muda:** botão `secondary` "Limpar avisos", logo abaixo da faixa |
| "▸ Feitos (24 h) · 20" e "▸ Perguntas anteriores · 15" | botões `plain`, que se leem como texto | conferir | rara | **muda:** dois botões `secondary` num rodapé separado por filete, como "▸ Feitos hoje · 20" e "▸ Perguntas respondidas · 15" |
| ⚠ fora do contrato | `Text dimColor` sob o item | corrigir quem gravou | rara | fica |

## Hierarquia e peso

**Ação primária:** responder a pergunta, com o botão `primary` do cartão de pergunta. **É o único `primary` do pane.** Os botões "Abrir X" são secundários, e a tela não tem outra ação.

De cima para baixo, com a altura medida no mock a 380 px:

| Região | Peso | Mostra primeiro |
|---|---|---|
| Barra do topo | 28 px | a hora da leitura e o botão Atualizar |
| Contadores 2×2 | 130 px | os números |
| **Esperam você** (só quando há) | ~230 px por pergunta; ~110 px por item que espera sem pergunta | o Q-ID e a pergunta; o texto da espera |
| **Travados** (só quando há) | ~180 px por item | o bloco da trava |
| **Executando** (sempre) | ~150–190 px por cartão | o título e quem executa |
| **Na fila** (sempre) | ~95 px por linha | o título e "parado há" |
| Rodapé (feitos, respondidas) | 40 px | os dois botões |

- **A dobra, medida no mock no Chromium** (em px a partir do topo do pane; a primeira tela tem cerca de 800 px). O cenário é o mais cheio do mock: uma pergunta, um item que espera, um travado e três executando.

  | Largura | Esperam você | Travados | Executando |
  |---|---|---|---|
  | 380 | 198–669 | 683–947 | 961–1675 |
  | 300 (resumo compacto) | 146–683 | 697–961 | 975–1745 |

  - Nas duas larguras, **o travado começa acima da dobra e termina abaixo dela**. O título e o motivo aparecem, mas o "Abrir V1" pede rolagem.
  - Sem o item que espera, o travado cabe inteiro. Sem pergunta, Executando entra na primeira tela.
  - **Isto fica aceito:** o que está acima é o que pede gesto, na ordem de urgência, e os contadores dizem antes de rolar quantos travados e quantos executando existem.
- **Resumo compacto abaixo de 360 px** (`resumoSvg`, *assumido, a confirmar*): o 2×2 mantém a grade, mas cada bloco fica com 36 px de altura e o número fica na mesma linha do rótulo, à direita, em 17/600. O resumo passa de 130 px para 78 px, como na coluna de 300 do mock.
- **Textos que cabem a 300 px** (medidos contra W = 292 com o `em()` do `desenho.ts`):
  - barra normal: "Atualizado 18:22" + "↻ Atualizar", ~190 px;
  - barra parada: "⚠ Parou há 7 min" + o botão, ~200 px;
  - a legenda das faixas de seção é **curta e opcional**: o `secaoSvg` a corta com `caber` e a **esconde** quando título + pílula + legenda passam de W. As legendas são "responda aqui", "pedem alguém agir", "2 trabalhando" e "não começaram";
  - os botões da pergunta (Sim, Não, Adiar, Responder…, Abrir D1) quebram em duas linhas a 300 px. É aceito: `Box row wrap` com `gap`, e o `primary` fica sempre primeiro.
- **Cada seção começa com a mesma faixa**, um `secaoSvg` novo:
  - filete à esquerda na cor da seção;
  - título 15/600;
  - contagem em pílula;
  - legenda curta à direita.
  - Em Na fila, o filete é **tracejado**, como o anel do item, e isso marca "ainda não começou" sem precisar de outra cor.
- **Executando e Na fila se separam por três diferenças, e não por uma:**
  1. o cartão com fundo contra a linha sem fundo;
  2. o filete cheio contra o tracejado;
  3. o selo com o ponto vivo contra o anel tracejado.
- **As cores** são as de hoje, porque nenhuma cor nasce nova:
  - âmbar: Esperam você;
  - vermelho: Travados;
  - azul: Executando;
  - neutro: Na fila.

### 1. O cartão do item executando

| Linha | Conteúdo | Tipo |
|---|---|---|
| sobre | o **tema** (11/600, caixa alta, `m`) e, à direita, o tempo desde a última ação (12, `m`) | sempre |
| título | 15/600, em até 2 linhas, cortado com reticências (`quebrarEmDuas` de hoje, com a 1ª linha agora inteira, porque o tempo subiu para a linha "sobre") | sempre |
| chips | a **etapa** (pílula `k` com o texto na cor da etapa), "aguarda você · Qnn" (âmbar cheio) e o último PR (contorno, azul), sempre nesta ordem: o que gera decisão vem antes | sempre a etapa; os outros quando há |
| trava | bloco tingido de vermelho, "**Motivo:** texto", em até 3 linhas. Em "sem ninguém", a última linha diz onde se resolve: "Peça outra sessão à orquestradora." | só no travado |
| espera | o texto da espera em até 2 linhas: `av` quando espera o operador (esse item mora em Esperam você, §1b), `s` quando espera o gate. O chip "espera o gate" ocupa o lugar de "aguarda você" | quando `espera` existe e o item não está travado |
| quem | uma linha por sessão viva: o **selo** do apelido, o **papel** em 600 e a situação da sessão (§2) | uma por sessão de `com`, ou o dono |
| agora | 12,5, `s`, em até 2 linhas | quando há |
| depois | "depois: …", em 1 linha, `m` | quando há |
| ações | um botão "Abrir X" por sessão viva, até 3 | quando há sessão viva |

### 1b. O cartão compacto de Esperam você (item sem pergunta)

O item com `espera.motivo = 'operador'` e nenhuma pergunta aberta **sai de Executando** e vai para Esperam você, depois dos cartões de pergunta. Item **na fila** com essa espera também sobe para cá, sem a linha "quem" e sem botão, porque não tem sessão. Assim a `contarSecoes` não tem exceção. Item com pergunta aberta fica onde está e leva o chip "aguarda você · Qnn". A pergunta dele **já é um cartão** em Esperam você e já conta lá uma vez, pela pergunta:

- **sobre:** o tema e o tempo;
- **título:** 15/600, em até 2 linhas;
- **espera:** o texto em `av`, em até 2 linhas;
- **quem:** a linha de §2;
- **ação:** "Abrir X" (`secondary`), porque a resposta se dá na sessão.

Com moldura: o mesmo cartão de §1, com a borda em `warning`. A **regra de contagem** é uma só, `contarSecoes(itens, perguntas)`, e devolve o número de cada seção. O contador e a pílula leem dela. Esperam você = perguntas abertas + itens com espera do operador sem pergunta, que é a soma de hoje (`register.tsx:609`), agora com os dois desenhados.

### 2. Quem executa

- **O selo** é um retângulo arredondado de 22 px de altura com o apelido em 11,5/700, com o fundo `k` e o texto `t`.
  - Quando a sessão está **trabalhando agora**, o selo leva um ponto azul pulsante no canto, com a classe `vivo` de hoje, que já respeita `prefers-reduced-motion`.
  - Quando a sessão está parada, ele vai sem ponto.
- **O papel sai da 1ª letra do apelido:**
  - P → planejadora;
  - E → executora;
  - V → validadora;
  - D → designer;
  - O → orquestradora.
  - Letra fora dessa lista mostra só o apelido.
  - *Assumido, a confirmar:* o ideal é o documento trazer `papel` (veja "Gotchas", na §Decisões).
- **A situação vem do `list_sessions` que o mod já lê a cada 60 s**, pelos campos `isRunning` e `lastActivityAt`:
  - "trabalhando agora" quando `isRunning`;
  - "parada há X" a partir de `lastActivityAt`;
  - "sem leitura da sessão" quando o `list_sessions` falhou.
  - Esse é o dado que responde de verdade **"quem tá executando"**. Hoje o item diz "execução" mesmo com a sessão parada há uma hora.
  - Item executando com a sessão parada há mais de 30 min continua cinza: não é trava nem espera, e a cor ficaria gritando sem gesto que a resolva.
- **O título da sessão não entra.** O apelido já identifica a sessão no pool, e o botão "Abrir E2" leva até ela. O título repetiria o do item.

### 3. A linha da fila

- anel tracejado;
- tema e "parado há X" (à direita);
- título 14/600, em até 2 linhas;
- `resumo` em até 2 linhas;
- chips "espera <etapa>" (pílula de contorno tracejado) e PR;
- filete entre as linhas.

**Sem botão:** item na fila não tem sessão para abrir.

### 4. Os botões

| Botão | Variante | Estado durante | Desfecho |
|---|---|---|---|
| Sim / opção 1 da pergunta | `primary` | **só o botão pressionado** vira "Enviando…"; os irmãos ficam com o rótulo e ignoram o clique enquanto `enviando` aponta para aquela pergunta | toast "Qnn respondida e enviada"; o cartão some na releitura; a falha limpa `enviando` e vai para a faixa de avisos, como hoje |
| Não, Adiar, opções | `secondary` | igual | igual |
| Responder… | `secondary` | abre ou fecha o campo (`respondendoEm`, como hoje); o "Enviar" do campo segue a regra do `enviando` | igual |
| **Abrir X** | `secondary` | "Abrindo…" até o `open_session_in` voltar | sucesso: a sessão em foco, e o rótulo volta. Recusa: o endereço copiado e o toast, como hoje |
| ↻ Atualizar | `secondary` | "Lendo…" | a hora nova na barra; o erro vai para a faixa |
| Tentar de novo (na faixa de erro) | `secondary` | "Lendo…" | igual ao Atualizar |
| Limpar avisos | `secondary` | — | a faixa some |
| ▸ Feitos hoje · n / ▸ Perguntas respondidas · n | `secondary` | — | a seta vira ▾ e a lista abre logo abaixo do rodapé |

- O `Button` do motor **não tem `disabled`**. O "ocupado" é feito com um **rótulo trocado e um clique ignorado**, por **dois átomos novos, lidos no render** e declarados no contrato (`types/index.d.ts`):
  - `enviando: { q: string; opcao: string } | null`, preenchido ao pressionar e limpo no fim do `responder` (sucesso ou falha);
  - `abrindo: string | null`, com o `localId`, preenchido ao pressionar "Abrir X" e limpo quando o `open_session_in` volta.
- O `respondendo` de hoje é um `Set` de módulo que o render não lê: ele continua servindo de trava, mas não muda nenhum rótulo. O `respondendoEm` continua **só** abrindo e fechando o campo. Os três estados não se misturam.
- **Nenhum botão fica `plain`.** No desktop, o `plain dimColor` é o que faz o botão parecer texto.

## Mensagens

| Mensagem | Lugar | Duração | Tom | Quem vê |
|---|---|---|---|---|
| Pergunta com Q-ID | cartão na seção Esperam você | enquanto aberta | espera (âmbar) | operador |
| "aguarda você · Qnn" | chip no cartão do item | enquanto aberta | espera | operador |
| Trava ("Gate vermelho: …") | bloco dentro do cartão | enquanto valer | ruim | operador |
| "Sem ninguém: a E5 não está mais ativa. Peça outra sessão à orquestradora." | bloco de trava, sem botão | enquanto valer | ruim | operador |
| Item que espera o operador sem pergunta | cartão compacto em Esperam você, com o texto em `av` | enquanto valer | espera | operador |
| "espera o gate" | chip e texto `s` no cartão em Executando | enquanto valer | neutro | operador |
| "trabalhando agora" / "parada há X" | linha "quem" | a cada leitura | neutro | operador |
| Erro de leitura | faixa no topo, abaixo da barra, com "Tentar de novo" | até a próxima leitura boa | ruim | operador |
| Aviso de resposta não entregue | a mesma faixa, com "Limpar avisos" | até ser limpo | ruim | operador |
| A leitura parou (a última tem mais de 3 min) | a legenda da barra fica vermelha: "⚠ Parou há 7 min" (o `alt` diz "a releitura automática parou; a última leitura foi há 7 min") | até ler de novo | ruim | operador |
| Seção vazia | uma linha `m` sob a faixa: "Nenhuma sessão executando agora." / "Fila vazia." | enquanto vazia | neutro | operador |
| Resposta enviada, sessão aberta, endereço copiado | toast (`$.ui.toast`), como hoje | some sozinho | ok | operador |
| ⚠ fora do contrato | `Text dimColor` sob o item | enquanto valer | neutro | operador |

## Regiões e componentes

O "kit" aqui são as funções de `desenho.ts` e os elementos que o pane do desktop desenha.

| Região | Monta com | Novo? |
|---|---|---|
| Barra do topo | `Box row` + `Text` (`size="caption"`, `dimColor`) + `Button secondary` | não |
| Contadores | `resumoSvg` com o rótulo "Executando" | só o rótulo |
| Faixa de seção | **`secaoSvg(W, { titulo, n, tom, legenda, tracejado })`**, com altura de 28 | **sim** |
| Pergunta | `perguntaSvg` (o tingido) e, **logo abaixo**, `acoes(q)` num `Box row wrap paddingLeft` alinhado ao texto do cartão. O "Abrir X" vai **numa linha própria**, abaixo das respostas, com o mesmo `paddingLeft`: ele navega, e as respostas gravam | só o botão |
| Item que espera você | o mesmo do cartão executando, com o tom âmbar | derivado |
| Cartão executando ou travado | `Box` com borda (§7) contendo `Svg` (**`cartaoSvg`**, que substitui o `itemSvg` em sessão) + `Box row` de `Button secondary` | **sim**, o `cartaoSvg` |
| Linha da fila | **`filaSvg`**, o `itemSvg` de hoje enxugado: sem ponto vivo e com o tema em cima | **sim** (derivado) |
| Faixa de erro | **`faixaSvg(W, { titulo, detalhe, tom })`** e, logo abaixo, `Button secondary` | **sim** |
| Rodapé | `fileteSvg` + `Box row wrap` de `Button secondary` | não |

Os blocos de SVG carregam o mesmo `CSS` de hoje (as classes `t s m av er an ok li pt tile k ln card`; o texto das pílulas de contagem das seções usa `pt`, que é branco no claro e `#1f1f1f` no escuro, e nunca um `#fff` fixo) e ganham **uma** classe nova, `.et` (o tingido de erro, `#fbefeb` no claro e `#2d201c` no escuro), cada uma com contraste de 4,5:1 contra o texto `er`. *O contraste ainda precisa ser medido na execução.*

## Estados

| Estado | O que se vê |
|---|---|
| Ainda não lido | a barra mostra "Ainda não lido"; os contadores em zero, cinza; nenhuma seção |
| Lendo | "Lendo…" no botão; as seções da leitura anterior continuam na tela, sem piscar vazias |
| Vazio | os contadores em zero; Executando com "Nenhuma sessão executando agora."; Na fila com "Fila vazia."; o rodapé quando há feitos (mock 2) |
| Com pergunta | a seção Esperam você no topo; o chip no cartão do item (mock 1) |
| Item espera você sem pergunta | o cartão compacto em Esperam você, depois das perguntas; o contador e a pílula com o mesmo número (mock 1) |
| Travado | a seção Travados com o cartão de borda e o filete vermelhos e o bloco de trava (mock 1) |
| Sem ninguém | o cartão travado **sem a linha "quem" e sem botão** (mock 5) |
| Erro de leitura | a faixa com "Tentar de novo"; os cartões da última leitura boa; a linha "quem" diz "sem leitura da sessão"; nenhum item vira "sem ninguém" (é a regra de hoje) (mock 3) |
| Leitura parada | a legenda em vermelho; a faixa de Executando diz "dados de 7 min atrás" (mock 4) |
| Botão em curso | "Abrindo…" / "Enviando…" / "Lendo…" (mock 1, último cartão) |

## Movimento

- **Só o ponto vivo do selo pulsa**, com a classe `vivo`, a 1,6 s, e sem animação em `prefers-reduced-motion`.
- **O ponto que pulsava no item sai.** Hoje todo item andando pulsa, e três pontos pulsando dizem "três vivos" mesmo com sessão parada. O pulso passa a dizer o que é verdade: a sessão está com o turno rodando.
- **Nada entra nem sai animado.** O pane redesenha a cada 60 s, e animação de entrada a cada releitura seria ruído.

## O que sai

- o título "Em sessão · n", que vira as seções Travados e Executando;
- o rótulo "Andando", que vira "Executando";
- os cabeçalhos de tema entre os itens, que viram etiqueta no cartão (Q-ID na §Decisões);
- o ponto colorido pulsante à esquerda de cada item em sessão, cujo pulso passa para o selo de quem executa;
- os segundos em "lido às 18:22:15";
- todo `Button plain dimColor`;
- o `fileteSvg` entre o item e os botões: o cartão já fecha o item.

## 7. O que o pane consegue desenhar, e o que medir antes de executar

Lido nos tipos do motor (`plugin-authoring`, build 2.1.308). A tabela do desktop tem `Box`, `Text`, `Button`, `Input`, `Select`, `Svg`, `Link`, `Code`, `Markdown` e `Client`.

- **`Button`:**
  - nativo no desktop, com `variant: 'primary' | 'secondary'`;
  - `plain` desenha sem cromo;
  - **não existe `disabled`**.
- **`Text`:** tem `size` (`caption` … `title`), `weight` e `tabular`.
- **`Svg`:**
  - estático, sem clique;
  - `source` de até 131 072 caracteres;
  - é ele que dá a cara de "frontend" que o pane já tem nos contadores e na pergunta.
- **`Box`:**
  - tem `borderStyle`, `borderColor`, `backgroundColor`, `padding` e `gap`;
  - **a documentação não diz o que o desktop faz com borda e fundo.** Ela só garante que um estilo de borda fora da lista do terminal é desenhado sem borda;
  - o código de hoje desenha tudo em SVG, talvez por isso.

**A forma prometida é a que o pane desenha hoje:** todo tingido (o âmbar da pergunta, o vermelho da faixa de erro e o bloco de trava) é **SVG**, e todo botão fica **logo abaixo** do SVG, num `Box row wrap` com `paddingLeft` alinhado ao texto. O `Svg` não tem clique, e um `Box backgroundColor` só aceita chave do tema ou hex fixo (que vale para um tema só, como o `desenho.ts:17` já registra). O mock segue essa forma.

**Medir antes de executar (passo 0 do plano, num mod de rascunho), no desktop, nos temas claro e escuro:**
1. um `Box borderStyle="round" borderColor="subtle" padding={1}` com um `Svg` e dois `Button` dentro;
2. um `Box backgroundColor="warning"` e outro `backgroundColor="error"`, cada um com um `Text` e um `Button`, para saber se a chave do tema vira um tingido legível nos dois temas.

O passo 2 só muda o desenho se der certo nos dois temas. Nesse caso, a pergunta e a faixa de erro podem pôr os botões dentro do tingido, e o plano registra isso. O passo 1 decide a moldura dos cartões, com dois desfechos:

- **A borda aparece:** o cartão é esse `Box`, com a **borda inteira na cor do tom** e **sem fundo**: `subtle` quando executa, `error` quando está travado, `warning` quando espera você. Os botões ficam dentro dele. É o que o mock desenha. O `Box` não tem borda por lado, então não há filete só à esquerda. Fundo `tile` só entra se um `Box backgroundColor` com chave do tema passar no passo 0, nos dois temas.
- **A borda não aparece:** fica a alternativa sem moldura.
  - O `cartaoSvg` desenha o fundo `tile` e o filete da seção à esquerda, e os botões vão logo abaixo, num `Box paddingLeft` alinhado ao texto.
  - Os cartões se separam por `gap` maior, de 12 px, em vez de filete.
  - A separação entre Executando e Na fila se mantém, pelas três diferenças da §Hierarquia.

O `Client` não resolve isso: ele também desenha com `Box` e `Text`, e não com DOM.

## Decisões ao operador

**Q238 — O tema vira etiqueta no cartão, no lugar do cabeçalho de grupo?**
- **Decidida em 25/10:** sim, segue a recomendação (resposta do operador pelo painel).
- **O caso:** hoje, dentro de "Em sessão" e de "Na fila", cada tema abre um grupo com um título em caixa alta ("SESSÕES E PAINEL", "KIT DE ORQUESTRAÇÃO"). Com as seções novas, o pane teria três níveis de título: a seção, o tema e o item. Na captura de hoje, são dois cabeçalhos de tema para três itens. Isso muda o que o desenho do F27 decidiu.
- **Se não decidir:** ficam os cabeçalhos de tema dentro de cada seção, e o pane fica com três níveis de título.
- **Recomendo:** a etiqueta no topo do cartão, mantendo a ordem dos temas de `temas.json`. O tema não gera gesto, e a seção é a divisão que você pediu para ficar clara.

**Q239 — Item na fila ganha um botão "Pedir início" (uma mensagem à orquestradora)?**
- **O caso:** a fila hoje não tem gesto nenhum no pane. Quem inicia uma sessão para o item é a orquestradora. Um botão mandaria a ela "iniciar <item>". É um gesto novo: manda mensagem entre sessões, e precisa de um destino conhecido.
- **Se não decidir:** a fila fica só de leitura, como hoje, e você pede o início no chat da orquestradora.
- **Recomendo:** **não agora.** Primeiro o redesenho; o botão entra depois, como item próprio, se a fila parada virar dor. Pela regra de não mostrar ação que a tela não tem, ele exige o fluxo de destino pronto antes.

**Assumidas, a confirmar** (reversíveis, a execução segue com elas):
- "Andando" vira "Executando" no contador e na seção.
- Travados vira **seção** própria, entre Esperam você e Executando, e só aparece quando há item travado. Antes, era subgrupo de "Em sessão", e o contador apontava para um subtítulo.
- O papel sai da 1ª letra do apelido, com o mapa P/E/V/D/O.
- A situação da sessão ("trabalhando agora" / "parada há X") sai do `list_sessions` que o mod já lê.
- A leitura é dada como parada quando a última tem mais de 3 min (3 vezes o intervalo).

**Gotchas para quem planeja:**
- **Papel pela 1ª letra é frágil.** Um apelido fora do padrão (por exemplo, "c20") cai em "só o apelido". O certo é o `painel.mjs` gravar `donoPapel`, ou `papel` em cada `com`. Isso vale como seguimento, e não como bloqueio.
- **`isRunning` da sessão dona é do momento da leitura, que acontece a cada 60 s.** Um turno curto entre duas leituras não aparece.
- **O `list_sessions` não devolve a própria sessão.** O mod já completa com `get_session('self')`. A linha "quem" da sessão que tem o pane aberto sai desse documento.
- **O terminal:** a ordem e os nomes das seções valem também para ele, em texto. O terminal tem `Box borderStyle`, e o cartão pode ser uma borda `round` lá, com certeza.
- **Testes do mod** (`tests/painel.test.tsx`) afirmam os rótulos "Andando" e "Em sessão". Eles mudam junto.

## 11. Crítica

### Rodada 1: 21/30, volta

O crítico rodou em contexto separado. Ele deu hierarquia 3, densidade 3, consistência 3, ruído 4, ação primária 4 e aderência 4. Foram cinco achados, e todos foram incorporados:

| # | Peso | Achado | Onde ficou o conserto |
|---|---|---|---|
| P1 | alta | o contador "Esperam você" somava itens com espera do operador sem pergunta, e a seção não os mostrava | Tarefa; Inventário; §1 (linha espera); §1b; `contarSecoes` única; Mensagens; Estados; mock 1 |
| P2 | média | o mock punha botões dentro de tingidos que o pane não monta | §7 (forma prometida + passo 0 mede `backgroundColor`); Inventário; Regiões; mock (botões abaixo do tingido) |
| P3 | média | os 300 px não estavam desenhados, e o aviso "parou" não cabia | Quem e onde; §Hierarquia ("Textos que cabem a 300 px"); barra encurtada; legenda que se esconde; mock com coluna de 300 |
| P4 | média | "Enviando…" se apoiava num `Set` que o render não lê | §4: os átomos `enviando` e `abrindo`; só o botão pressionado troca o rótulo |
| P5 | média | Travados prometia "destravar" sem botão | Tarefa; legenda "pedem alguém agir"; a trava "sem ninguém" diz onde se resolve |

Achado baixo, deixado como está: com Esperam você e Travados à vista, os contadores repetem as pílulas das seções. Eles ficam, porque respondem "preciso olhar?" sem rolar, e é deles que se lê a quantidade de Executando quando ela está abaixo da dobra a 300 px.

O crítico manteve a Q238 e a Q239 como estão.

### Rodada 2: 24/30, aprovada com ressalvas

A recrítica foi feita por um crítico novo, em contexto limpo. Ele deu 4 em cada eixo. Os achados P3, P4 e P5 da rodada 1 ficaram resolvidos. O P1 e o P2 ficaram resolvidos em parte, e voltaram como as ressalvas abaixo. Nenhuma ressalva é alta. Ainda assim, as cinco foram aplicadas nesta mesma revisão, porque eram baratas:

| # | Peso | Ressalva | Conserto |
|---|---|---|---|
| R1 | média | o mock mostrava o chip "aguarda você · Q902" sem o cartão da Q902, e o item na fila com espera não tinha lugar | o mock troca o chip por "espera o gate"; a §1b põe o item na fila com espera em Esperam você e explica que a pergunta conta uma vez |
| R2 | média | o cartão do mock tinha fundo e filete lateral, que o `Box` não desenha | o mock passa a ter borda inteira na cor do tom e sem fundo; a §7 diz isso |
| R3 | média | as frases sobre a dobra não batiam com o mock | os números medidos no Chromium estão na tabela da §Hierarquia; o resumo fica compacto abaixo de 360 px; o travado que fica pela metade abaixo da dobra é aceito, com o motivo |
| R4 | baixa | o branco fixo na pílula azul dava 3,2:1 no escuro | as pílulas usam a classe `pt` |
| R5 | baixa | o "Abrir D1" ficava na fileira das respostas | ele vai numa linha própria |

**Teto da crítica:** a nota chegou a 24/30, sem ressalva alta, e a revisão está **liberada para a P6 planejar**. As ressalvas da rodada 2 foram aplicadas sem uma rodada 3, que a skill não pede.
