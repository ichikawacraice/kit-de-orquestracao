# Revisão de arquitetura — a barra de status do kit, acima do prompt

- **Data:** 2026-10-26
- **Autora:** D2, designer do pool
- **Estado:** aprovada com ressalvas (crítica 1, 24/30; as cinco ressalvas aplicadas nesta versão, §Crítica). **Delta F65** (26/10, D1): o contexto passa a ser medido contra a janela de compactação, e a palavra do teto vira `· limpar` ([§Delta F65](#delta-f65)); a D1-F65-1 substitui a D2-6.
- **Mock:** [`2026-10-26-barra-de-status-mock.html`](2026-10-26-barra-de-status-mock.html), estático, claro e escuro: o terminal em 114, 94, 72 e 40 células (pior caso de largura) e o desktop numa coluna de chat, mais a faixa do pedido no pane a W = 288
- **Plano de origem:** [`docs/planos/2026-10-26-barra-de-status-do-kit.md`](../../planos/2026-10-26-barra-de-status-do-kit.md). O comportamento (o que cada clique grava, quando cada coisa aparece, as réguas) é do plano; esta revisão decide a ordem, o agrupamento, os rótulos exatos, o que cai quando a largura aperta, como o pedido de limpeza e o cache em alerta se distinguem sem depender só de cor, o terminal e a linha do pedido no pane (D10).
- **Base:** o topo do pane da F48 ([`2026-10-26-topo-do-painel.md`](https://github.com/ichikawacraice/kit-de-orquestracao/blob/claude/f48-limpeza-e-header/docs/design/2026-10-26-topo-do-painel.md), branch `claude/f48-limpeza-e-header`): rótulos do modo ausente, `key="modo"`, otimista com geração. O que esta revisão não cita do pane continua como lá.
- **Fontes lidas:** o plano (4b7b205); os tipos do motor desta build (`AbovePrompt`: `hasSurvey`, `isWorking`, `maxRows`, `bodyColumns`, `scroll`; `Button`: `variant`, `dimColor`, `plain`, `role`, `key`, filhos `Text`; `Text`: `color` com `ThemeKey`, `inverse`, `bold`, `wrap`; `Box`: `borderStyle`, `borderColor`); a faixa de hoje do `session-band` (lida, não copiada: outro autor) para saber o que o operador perde; `plugins/painel-sessoes/hooks/desenho.ts` (`CSS`, classes de cor).
- **Plano do delta:** [`docs/planos/2026-10-26-barra-contexto-janela.md`](../../planos/2026-10-26-barra-contexto-janela.md) (F65, P1). O comportamento (de onde vem a janela, a precedência, o limite pela janela do modelo) é do plano; o delta decide o texto, a palavra e o que muda nas faixas.
- **Pedido do operador (26/10):** tirar o mod de terceiros acima do prompt e ter um nosso, com o selo das perguntas abertas (o clique abre o painel), o botão de abrir e fechar o painel, o botão que dá o ok para a orquestradora se limpar quando ela pedir e a contagem regressiva do cache de 1 h; mais as ideias 1, 2, 3, 4 e 7 (Q283).

---

<a id="delta-f65"></a>
## Delta F65 — o contexto contra a janela de compactação

**O caso.** Na orquestradora a barra dizia `contexto 198/250 mil`. O operador leu os 250 como a janela da sessão, que é de 600 mil (a compactação automática), e disse: *"a janela de contexto aqui da orquestradora está errada, esta falando 198/250 mas o contexto maximo é 600"*. A D2-6 tinha posto a régua de limpeza do papel no denominador; numa fração, quem lê de fora entende o denominador como o tamanho do recipiente, não como uma regra de quando esvaziar. A D2-6 falhou na primeira leitura do operador, e a fração passa a dizer o que ela parece dizer.

**O que muda (só a peça do contexto e o que dela depende):**

| | Antes (D2-6) | Agora (D1-F65-1) |
|---|---|---|
| Denominador | a régua do papel (`teto`) | a janela de compactação, **igual para todos os papéis** (plano, D2: env, `autoCompactWindow`, janela do modelo; nenhuma → sem `/`) |
| Faixa 0 | `contexto 198/250 mil` | `contexto 198/600 mil` |
| Faixa 1 | `198/250 mil` | `198/600 mil` |
| Faixa 2 | `198 mil` | `198 mil` (igual) |
| Aviso da régua do papel | `· alto`, `warning` | igual |
| Teto da régua do papel | `· teto`, `error` + negrito | **`· limpar`**, `error` + negrito |
| Papel desconhecido (fora do pool) | sem `/`: `contexto 142 mil` | **com** a janela, sem palavra: `contexto 142/600 mil` |
| Sem janela conhecida | — | sem `/`, com a palavra se houver régua: `contexto 198 mil · limpar` |

Exemplos, com `autoCompactWindow` 600 000: orquestradora a 198 mil → `contexto 198/600 mil`; a 260 mil → `contexto 260/600 mil · limpar`; P a 362 mil → `contexto 362/600 mil · alto`; P a 510 mil → `contexto 510/600 mil · limpar`; E a 312 mil → `contexto 312/600 mil · limpar` (na E e na orquestradora o aviso e o teto coincidem: passam direto para `· limpar`).

**A palavra do teto é `· limpar`.** Com a janela no denominador, `260/600 · teto` diria "parou" com 340 mil sobrando, e o operador leria a mesma contradição que motivou o delta. O que acontece na régua é a hora de limpar: a E, a P e a D se limpam; a orquestradora pede o ok (e a linha do pedido, §3, aparece logo acima com o botão). O infinitivo diz *o que é hora de fazer* sem dizer *quem* faz, e por isso serve aos dois casos. Recusadas: `· teto` (diz "parou"), `· limpe` (imperativo ao operador, que não é quem limpa a E nem a P), `· limpeza` (substantivo, 1 célula a mais, e lê como estado, não como hora), `· limpa em 250` (alarga a peça mais apertada; plano, fora de escopo).

**A régua some como número, fica como cor e palavra.** O operador perde o "quanto falta para a régua" (na orquestradora, 198 de 250). Aceito: a régua é do papel e o papel age nela sozinho (a E, a P e a D se limpam; a orquestradora pede), e o operador só precisa agir no pedido, que tem linha própria. O `· alto` antecipa a régua nos papéis que têm faixa intermediária (P, D, V, orquestradora no ausente).

**Larguras.** `600` tem os mesmos 3 dígitos que `250`/`300`/`500`: as somas da §O que cai quando aperta não mudam. `· limpar` tem **2 células a mais** que `· teto` (9 × 7); a faixa já soma com o texto real, então a palavra derruba uma faixa sozinha quando for preciso, como já fazia com `· teto`. A janela do modelo como último recurso pode dar `/1000` (+1 célula): absorvido pelo mesmo cálculo. Os quadros 2, 3, 4, 5, 6 e o desktop do mock foram redesenhados com os números novos; o quadro 2b é novo (orquestradora no `· limpar`, 114).

**Cor e peso não mudam:** `· alto` em `warning`; `· limpar` em `error` e negrito (a peça inteira, como era o `· teto`). Abaixo do aviso, apagado.

---

## Tarefa

> **Em qualquer sessão, sem abrir nada, o operador vê se algo espera por ele e quanto tempo esta sessão ainda tem de cache; e, quando a orquestradora pede para se limpar, dá o ok com um clique, de onde estiver.**

A barra é lida **em toda olhada para o prompt** (dezenas de vezes por hora) e clicada poucas vezes por hora. Por isso ela é uma linha só no caso comum, quieta quando nada pede atenção, e cresce só quando há uma ação que é do operador.

| Pergunta | Onde a barra responde | Gesto |
|---|---|---|
| Quanto tempo de cache esta sessão tem? | o relógio `⧗ 47:12`, sempre, sempre no mesmo lugar | nenhum |
| Esta sessão está gastando contexto demais? | `contexto 142/600 mil` (contra a janela), com a palavra `alto` ou `limpar` quando passa da régua do papel | nenhum |
| Tem pergunta esperando por mim? | o selo `● 3 perguntas`; sem pergunta, ele some | o clique abre o painel |
| A orquestradora quer se limpar? | uma linha própria **acima** da barra, só enquanto o pedido estiver aberto | `Pode se limpar` |
| Estou marcado como ausente? | o botão `☾ Estou de volta` só existe no ausente | o mesmo botão desliga |
| Em que item esta sessão está, e quanto do pool trabalha? | `F52 · design` e `E 2 · V 1`, à esquerda, só com largura | nenhum |

## Quem e onde

- **O operador**, no desktop (a coluna da conversa, com ou sem o pane encaixado ao lado) e no terminal. A barra aparece em **toda sessão** do Claude Code com o plugin, não só nas do pool: fora do pool ela mostra o que não depende do título (relógio, contexto contra a janela sem palavra, selo, painel).
- **A largura se mede em células** (`bodyColumns`). As contas abaixo usam a **célula do terminal**, onde um botão é `[ rótulo ]` (rótulo + 4); no desktop o botão nativo é mais estreito que isso, então o que cabe no terminal cabe no desktop. Larguras de referência: **114** (terminal largo; desktop sem pane), **94** (terminal comum de 100 colunas; desktop com o pane encaixado), **72**, e **40** como pior caso.
- A altura disponível é `maxRows` (no terminal em tela cheia, o que sobra acima do prompt, até metade da tela). A barra usa **1 linha** no caso comum, **2** com o pedido de limpeza, e +2 de moldura quando o cache está em aviso (§Estados): no máximo **4** com 66 células ou mais. Abaixo disso o pedido e o grupo da direita quebram, e o pior caso (40 células, ausente, pedido aberto, moldura) chega a **6** linhas, ainda abaixo da metade da tela que o `maxRows` dá.

## Inventário

| O quê | Onde está hoje | Decisão que gera | Frequência | Veredito |
|---|---|---|---|---|
| Relógio do cache | **nenhum lugar** (o `session-band` saiu, Q282) | mandar o próximo turno antes de vencer, ou limpar | toda olhada | **fica:** `⧗ mm:ss`, à esquerda, nunca cai (§1) |
| Moldura do cache em aviso/alerta | idem | a mesma, com pressa | 2× por hora | **fica:** moldura na barra inteira + o relógio em negrito / invertido (§4) |
| Contexto da sessão | idem (era `%` da janela) | limpar ou fechar o item antes do teto | toda olhada | **muda:** tokens contra a janela de compactação, com a palavra da régua do papel no aviso e no limpar (§1, §Delta F65) |
| Selo das perguntas abertas | só no pane | abrir o painel e responder | várias por hora | **fica:** botão `● 3 perguntas`, primeiro da direita; some com zero (§2) |
| Abrir / fechar o painel | só o `/painel` | ler o pool | várias por dia | **fica:** botão `Abrir painel` / `Fechar painel`, último da direita (§2) |
| Pedido de limpeza da orquestradora | só na pergunta, no pane | dar o ok | 1 a 3 por dia | **novo:** linha própria acima da barra, com `Pode se limpar` (§3) |
| Limpar antes de vencer (orquestradora) | — | economizar a releitura do contexto | rara | **novo:** a mesma linha, só na barra da orquestradora (§3) |
| Modo ausente | só no pane (F48) e `/ausente` | voltar e desligar | 2× por dia | **fica, assimétrico:** `☾ Estou de volta` sempre que ausente; `Ficar ausente` só com largura (§2) |
| Item e etapa desta sessão | título da sessão, painel | saber onde está | rara | **fica, com largura:** `F52 · design`, apagado (§1) |
| Pool (`E n · V m`) | só no painel | decidir se abre mais uma sessão | rara | **fica, com largura:** o primeiro a cair (§1) |
| Apelido e papel (`P3`, `🎛`) | o título da sessão, já à vista no app | — | — | **sai:** o título diz; a barra só aparece com título quando há app, que já o mostra no topo |
| Turno, tok/s, custo (o `session-band`) | — | — | — | **sai** (ideias 9, 2ª versão) |
| `×` para esconder | o `session-band` | — | — | **sai:** o `/barra` esconde (D8 do plano); o espaço vai para o selo e o painel |

## Hierarquia e peso

**Uma linha, dois grupos, os botões à direita, sempre no mesmo lugar.**

```
[pedido, só quando há]   ◆ A orquestradora pede para se limpar · Q290  [ Pode se limpar ]
[barra, sempre]          ⧗ 47:12  contexto 142/600 mil  F52 · design  E 2 · V 1     [ ● 3 perguntas ] [ Ficar ausente ] [ Abrir painel ]
```

- **A ação primária da barra é `Pode se limpar`**, e é o **único** `variant="primary"` dela. Quando não há pedido, a barra não tem primário: ela é leitura, e o selo é a próxima ação.
- **Grupo da esquerda (leitura)**, nesta ordem, por quanto cada um muda o que o operador faz agora: **relógio**, **contexto**, item, pool. O relógio é o primeiro porque é o que muda a cada segundo e o que manda agir (mandar um turno, limpar); o operador o acha sempre na ponta esquerda, colado à borda.
- **Grupo da direita (ações)**, nesta ordem: **selo**, **modo ausente**, **painel**. O selo vem primeiro porque é a ação mais provável; o painel fica na ponta porque é o mais estável (sempre existe), e assim o fim da barra não anda quando o selo some ou aparece. *Limite aceito:* o selo, ao aparecer, empurra o botão do modo para a esquerda; nunca o do painel.
- **A linha do pedido fica acima da barra, não abaixo:** a barra fica sempre colada ao prompt, no mesmo lugar, e o pedido entra por cima sem mover nenhum botão que o operador já conhece.
- **Peso:** a barra é `Text` comum; o que é leitura vai apagado (`dimColor`), exceto o relógio (texto normal, algarismos que se leem de longe). Cor só nos três sinais de atenção: âmbar (`warning`) no que espera o operador, vermelho (`error`) no que travou ou venceu, lilás (`planMode`) no ☾ do ausente. São as mesmas famílias do pane (âmbar = espera você; lilás = anda sem você), pelas chaves de tema do motor, que já trocam no claro e no escuro: **nenhum hex na barra**.

### O que cai quando aperta (`bodyColumns`, contas na célula do terminal)

**A faixa é a mais rica cuja soma cabe**, medida com os textos reais do momento, e não um corte fixo de `bodyColumns`: `faixaDaBarra(bodyColumns, pecas)` soma, para cada faixa (0, 1, 2), a esquerda (peças + `columnGap` 2), o vão de 2, a direita (botões + `columnGap` 1), os 2 do `paddingX` e, com moldura (§4), mais 2; devolve a primeira que cabe, e a 2 quando nenhuma cabe (aí o `flexWrap` quebra). Assim a palavra `· alto` / `· limpar`, a moldura, `● 12 perguntas` e `Fechar painel` derrubam uma faixa sozinhos, em vez de quebrar a barra justo no aviso. A tabela abaixo é o estado comum de referência (≤ 9 perguntas, sem palavra, sem moldura):

| Faixa | Esquerda | Direita | Soma no pior estado comum |
|---|---|---|---|
| **≥ 114** | relógio · `contexto 142/600 mil` · `F52 · design` · `E 2 · V 1` | selo · modo (`Ficar ausente` ou `☾ Estou de volta`) · painel | esq. 7+20+12+9 + 3×2 = 54; dir. 17+20+17 + 2 = 56; + 2 de vão + 2 de margem = **114** |
| **94–113** | relógio · `142/600 mil` · `F52 · design` (o **pool cai**; o contexto perde a palavra `contexto`) | selo · modo · painel | 7+11+12 + 2×2 = 34; 56; + 4 = **94** |
| **< 94** | relógio · `142 mil` (o **item cai**; o contexto perde a janela) | selo · **`☾ Estou de volta` só no ausente** (`Ficar ausente` cai) · painel **só sem selo** | 7+7+2 = 16; ausente com selo 17+20+1 = 38; + 4 = **58**; presente com selo: **37** |

- **Nunca caem:** o relógio, o selo (enquanto houver pergunta) e a linha do pedido com o seu botão. No ausente, o `☾ Estou de volta` também não cai: esquecer o ausente ligado é o risco que a F48 combate.
- **O painel cai antes do selo, e só quando o selo está à mostra:** o selo também abre o painel, e o pane se fecha pela própria marca ou pelo `/painel`. Sem pergunta aberta, o botão do painel volta.
- **`Ficar ausente` cai antes de tudo na direita:** é clicado uma vez por dia, e quem quer sair tem o pane e o `/ausente on`.
- **A rede de segurança é o `flexWrap` do motor**, como no topo da F48: quando nem a faixa 2 cabe (abaixo de ~66 células, ou um glifo que o terminal desenha com 2 células), o grupo da direita desce inteiro para uma 2ª linha e fica no canto direito (`flexGrow={1}` + `justifyContent="flex-end"` no grupo). A 40 células, no ausente com selo, é o que acontece (mock, quadro 4). Nada é cortado com reticências, exceto o item (`wrap="truncate-end"`), que é o menos importante.

## 1. A leitura (grupo da esquerda)

| Peça | Texto | Peso e cor | Quando |
|---|---|---|---|
| **Relógio** | `⧗ 47:12` (mm:ss); `⧗ —` antes da 1ª resposta; `⧗ …` enquanto `isWorking`; `⧗ venceu` no zero | normal; aviso negrito (a moldura já é o âmbar); alerta e venceu `inverse` + negrito (§4) | sempre |
| **Contexto** | `contexto 142/600 mil` · `142/600 mil` · `142 mil`, conforme a faixa (a palavra `· alto` / `· limpar` fica em todas, e conta na soma da faixa); sem janela conhecida, sem `/`: `contexto 142 mil` · `142 mil`; com papel desconhecido, com a janela e sem palavra | apagado no normal; no aviso, `warning` e ` · alto` no fim; no teto da régua, `error`, negrito e ` · limpar` | quando `tokens` existe |
| **Item** | `F52 · design` (o `F<n>` e o rótulo da etapa do `ROTULO_ETAPA` do pane) | apagado | com item e ≥ 94 |
| **Pool** | `E 2 · V 1`; com zero dos dois, `E 0 · V 0` | apagado | com projeto e ≥ 114 |

- **O denominador é a janela de compactação, não a régua do papel** (D1-F65-1, §Delta F65): `142/600` diz "quanto cabe antes de compactar", que é o que uma fração parece dizer. A régua do papel vira só palavra e cor: `· alto` a partir do aviso, `· limpar` a partir do teto. Sem palavra, abaixo do aviso.
- **Arredondamento:** mil para baixo (`141 999` → `141 mil`), para nunca mostrar `600/600` antes de chegar.
- **O contexto não aparece sem número** (`tokens` nulo): a peça some inteira, não vira `—`.

## 2. As ações (grupo da direita)

| Botão | Rótulo | `key` | Variante | Clique |
|---|---|---|---|---|
| **Selo** | `● 3 perguntas` / `● 1 pergunta`; o `●` num `Text color="warning"` dentro do botão | `perguntas` | secundário | abre o painel; com ele aberto, não faz nada (plano) |
| **Modo**, presente | `Ficar ausente` | `modo` | secundário, `dimColor` | liga (otimista, como no pane) |
| **Modo**, ausente | `☾ Estou de volta`; o `☾` num `Text color="planMode"` | `modo` | secundário | desliga |
| **Modo**, gravando | `Ligando…` / `Desligando…`, clique ignorado | `modo` | — | — |
| **Painel** | `Abrir painel` / `Fechar painel` | `painel` | secundário, `dimColor` | abre ou fecha |

- **O rótulo é o gesto, e o estado vem junto quando importa:** `☾ Estou de volta` diz "você está ausente" e "clique para voltar" de uma vez, sem uma peça de estado a mais.
- **`key` fixa nos botões que trocam de rótulo** (`modo`, `painel`, `perguntas`): o motor reencontra o botão depois do redesenho, e o foco de teclado não pula.
- **`key` diferente para ação diferente:** `Pode se limpar` é `limpar-pedido` e `Limpar antes de vencer` é `limpar-antes`. Quando o pedido abre na barra da orquestradora, a linha troca de ação e o foco **não** deve passar de um rascunho reversível para o ok que dispara a limpeza.
- **Modo não lido** (bandeira inválida): **sem** botão do modo, como no pane (F48, D1-4). O pane diz o motivo.
- **Antes da 1ª leitura** da barra: só o relógio. Nada à direita até ler (evita o selo piscar `0` → `3`).
- **Os toasts** são os do pane: ligar diz `Modo ausente ligado. Para pré-abrir o pool, use /ausente on no chat.`; desligar, `Modo ausente desligado`. Falha: o modo volta ao anterior no mesmo render e um toast `Não consegui ligar o modo ausente (<motivo>).` (a barra não tem faixa de avisos; o aviso vai também para a do pane, pelo `avisar` de sempre).

## 3. A linha do pedido

Uma linha **acima** da barra, só quando há o que pedir. É a única coisa da barra que pede uma resposta do operador.

| Caso | Texto (largo · estreito) | Botão |
|---|---|---|
| **Pedido aberto** (`limpar · orquestradora` do projeto), em **toda sessão** do projeto | `◆ A orquestradora pede para se limpar · Q290` (o Q-ID só com ≥ 94) · `◆ Orquestradora pede limpeza` (< 61) | `Pode se limpar`, **primário**, `key="limpar-pedido"` |
| enviando | o mesmo texto | `Enviando…`, clique ignorado (o `enviando` da F48) |
| enviado | `✓ Ok enviado à orquestradora`, sem botão, até a próxima leitura não ver mais a pergunta aberta; então a linha sai | — |
| falhou | o texto volta; o botão volta a `Pode se limpar` | toast `Não consegui mandar o ok de limpar (<motivo>).` |
| **Limpar antes de vencer**, só na barra da orquestradora, sem pedido aberto (D4 do plano) | `◆ Cache vence em 8 min com 212 mil no contexto` · `◆ Cache vence em 8 min` (< 76) | `Limpar antes de vencer`, **secundário**, `key="limpar-antes"` |

- **Com pedido aberto, a orquestradora vê o pedido, não o "limpar antes":** é o mesmo gesto (D4 do plano), uma linha só.
- **Por que primário num e secundário no outro:** `Pode se limpar` manda a resposta e a orquestradora age; `Limpar antes de vencer` só põe um rascunho na caixa do prompt, logo abaixo, onde o operador o vê e decide com Enter. O efeito visível do segundo é o próprio rascunho; o toast `Rascunho na caixa do prompt: aperte Enter para mandar.` confirma.
- **A linha se distingue sem cor por quatro coisas:** é uma **linha a mais** (a barra comum tem uma); começa pelo **`◆`**; diz **em palavras** o que pede; e tem o **único botão primário** (no terminal, `[ ]` na cor de destaque; no desktop, o botão nativo cheio). A cor (`◆` em `warning`) é a quinta.
- **O botão vem logo depois do texto, não na ponta direita:** a linha é uma frase e a resposta; a 114 células, mandar o botão para a ponta deixaria 50 células entre a pergunta e a resposta.
- **Medidas:** `◆ A orquestradora pede para se limpar · Q290` 44 + 2 + botão 18 + 2 = **66**; sem o Q-ID, **59**; curta, 28 + 2 + 18 + 2 = **50**. Abaixo de 50, o botão desce para a linha de baixo, à esquerda (wrap). "Limpar antes": 46 + 2 + 26 + 2 = **76**; curta, **52**.
- **Quanto tempo:** os minutos do "limpar antes" acompanham o relógio, de minuto em minuto (`8 min`, `7 min`…), arredondados para cima; com menos de 1 min, `menos de 1 min`.

## 4. O cache em aviso e em alerta (a moldura)

Só com o turno parado (`isWorking` falso). Enquanto o turno anda, o relógio mostra `⧗ …` e nada se moldura: o cache está sendo renovado.

| Nível | Quando | Moldura | Relógio | Sem cor, o que diz |
|---|---|---|---|---|
| normal | > 20 min | nenhuma | `⧗ 47:12` normal | — |
| **aviso** | ≤ 20 min | `borderStyle="round"` `borderColor="warning"`, em volta de **tudo** (pedido e barra) | negrito, sem cor: a moldura já carrega o âmbar, e o `warning` de texto fica para o que espera o operador (`●`, `◆`, `· alto`) | a **moldura** (forma) e o negrito |
| **alerta** | ≤ 10 min | a mesma, `borderColor="error"` | **`inverse`** + negrito: ` ⧗ 08:12 ` em bloco | o **bloco invertido** no relógio |
| **venceu** | 0 | a mesma, `error` | ` ⧗ venceu ` invertido | a palavra |

- **Moldura na barra inteira, como era:** é o que o operador já lia no `session-band` e de que gostou (motivo do D7 do plano). *Custo aceito:* no terminal a moldura soma 2 linhas, e o prompt desce 2 linhas ao entrar em aviso; acontece no máximo uma vez por resposta, e o chamar atenção é o ponto.
- **Aviso × alerta não dependem só de cor:** no alerta, o relógio vira um bloco invertido (fundo e texto trocados), que se vê em terminal monocromático.
- **Os avisos por notificação** (10 e 5 min, D7 do plano) dizem `<projeto> — <título>: o cache vence em 10 min` / `5 min`. Sem título (fora do app): `<projeto>: o cache vence em 10 min`.

## 5. O terminal e o desktop

**A mesma árvore nos dois**, só com `Box`, `Text` e `Button`: **nenhum `Svg`** na barra. Motivo: o `Svg` só existe no desktop, a barra é uma linha de texto curto, e duas árvores dobrariam os testes sem ganho visível. Os ícones são glifos de texto (`⧗`, `●`, `☾`, `◆`, `✓`).

- **Estrutura:** `Box column` (sem `gap`; `gap` é uma linha inteira no motor), moldura condicional (§4), `paddingX={1}`:
  1. a linha do pedido (quando há): `Box row flexWrap="wrap" columnGap={2} alignItems="center"`: `Text` com `◆` + frase, o `Button`;
  2. a barra: `Box row flexWrap="wrap" columnGap={2} alignItems="center"`: o grupo da esquerda `Box row columnGap={2}`; o da direita `Box row columnGap={1} flexGrow={1} justifyContent="flex-end"`.
- **O desktop** desenha os botões nativos (mais estreitos que `[ ]`), e as faixas de largura valem do mesmo jeito, pelo `bodyColumns`. Com o pane encaixado ao lado, a coluna do chat estreita, e a barra cai de faixa sozinha.
- **Acessibilidade:** o rótulo visível (a constante `ROTULO_*`) vai sempre como **filho** `Text` do botão, e o nome acessível no `label`. No `Button` do motor, `label` sem filhos é o texto desenhado: pôr o nome acessível nele sem o filho troca o rótulo visível e estoura a soma da faixa. Os nomes acessíveis: selo `Abrir o painel: 3 perguntas abertas`; modo `Ligar o modo ausente` / `Desligar o modo ausente`; painel `Abrir o painel` / `Fechar o painel`; limpar `Dar o ok para a orquestradora se limpar` / `Pôr na caixa do prompt o ok para limpar antes de o cache vencer`.

Terminal, 114 células, presente, uma pergunta de limpeza aberta:

```
◆ A orquestradora pede para se limpar · Q290  [ Pode se limpar ]
⧗ 47:12  contexto 142/600 mil  F52 · design  E 2 · V 1      [ ● 3 perguntas ] [ Ficar ausente ] [ Abrir painel ]
```

94 células, ausente, uma P com contexto alto (a faixa 1 somaria 101: cai para a 2, sem item e sem o painel, porque o selo está à mostra):

```
⧗ 47:12  362 mil · alto                               [ ● 3 perguntas ] [ ☾ Estou de volta ]
```

72 células, presente, alerta do cache (com moldura):

```
╭──────────────────────────────────────────────────────────────────────╮
│  ⧗ 08:12   142 mil                                 [ ● 3 perguntas ] │
╰──────────────────────────────────────────────────────────────────────╯
```

40 células, ausente, com pedido (o botão do pedido e o grupo da direita descem; o grupo ocupa as 38 células úteis inteiras). Os blocos desta seção mostram só as células úteis (largura − 2 do `paddingX`):

```
◆ Orquestradora pede limpeza
[ Pode se limpar ]
⧗ 47:12  142 mil
[ ● 3 perguntas ] [ ☾ Estou de volta ]
```

## 6. A linha do pedido no pane (D10)

Na faixa do topo do pane (F48), **depois da linha `⚠ Parou há…` e antes da faixa do ausente**: ação do operador vem antes do estado do modo, e a fileira dos botões do pane continua a primeira, sem se mover.

- **Montagem:** `Box column borderStyle="round" borderColor="warning" paddingX={1}`, nos dois motores (o botão precisa ficar **dentro** do contorno, e um `Svg` não leva botão dentro). Linhas:
  1. `Text bold`: `◆` (`warning`) + `A orquestradora pede para se limpar`;
  2. `Text dimColor`: `Q290 · há 3 min` (o `desde()` do pane);
  3. `Box row justifyContent="flex-end"`: `Button variant="primary" key="limpar-pedido"` `Pode se limpar` → `Enviando…` → a faixa sai na leitura seguinte; antes disso, `✓ Ok enviado` no lugar do botão.
- **Distingue-se da faixa do ausente** por contorno âmbar (o ausente é lilás), `◆` (o ausente é `☾`) e por ter botão.
- **Primário no pane:** a ação primária do pane é responder pergunta, e isto é responder pergunta. A mesma pergunta continua em "Esperam você" com os botões dela (plano).
- **A W = 288** (33 células): a linha 1, 13/700, mede ~260 px com o contorno: cabe; a W = 240, quebra em duas (texto, não corte).
- **Falha:** volta o botão; a linha de aviso vai para a faixa "Ação não concluída" do pane (F48), `Não consegui mandar o ok de limpar (<motivo>).`

## Mensagens

| Mensagem | Lugar | Duração | Tom | Quem vê |
|---|---|---|---|---|
| `⧗ 47:12` / `⧗ —` / `⧗ …` / `⧗ venceu` | barra, ponta esquerda | enquanto valer | neutro; aviso `espera`; alerta e venceu `ruim` | toda sessão |
| `contexto 142/600 mil` · `· alto` / `· limpar` | barra, esquerda | enquanto valer | neutro; `espera`; `ruim` | toda sessão |
| `● 3 perguntas` | barra, 1º botão da direita | enquanto houver aberta | `espera` | toda sessão |
| `◆ A orquestradora pede para se limpar · Q290` | linha do pedido, barra e pane | enquanto aberta | `espera` | toda sessão do projeto |
| `✓ Ok enviado à orquestradora` | linha do pedido | até a próxima leitura | `ok` | quem clicou |
| `◆ Cache vence em 8 min com 212 mil no contexto` | linha do pedido | ≤ 10 min, parado, ≥ 150 mil | `espera` | só a orquestradora |
| `Rascunho na caixa do prompt: aperte Enter para mandar.` | toast | some sozinho | `ok` | quem clicou |
| `Não consegui mandar o ok de limpar (…)` | toast; faixa de avisos do pane | some / até Limpar avisos | `ruim` | quem clicou |
| `Modo ausente ligado. Para pré-abrir o pool, use /ausente on no chat.` / `Modo ausente desligado` | toast | some sozinho | `ok` | quem clicou |
| `<projeto> — <título>: o cache vence em 10 min` | notificação | do sistema | `espera` | o operador, fora da tela |
| `Barra de status escondida.` / `Barra de status à mostra.` | resposta do `/barra` | — | neutro | quem digitou |

Texto de UI sem plano, ADR nem nome de arquivo. O `F52` e o `Q290` são dados (o número do item e da pergunta), não citação de documento.

## Regiões e componentes

| Região | Monta com | Novo? |
|---|---|---|
| Barra (`AbovePrompt`) | `Box column` + moldura condicional; `Box row flexWrap`; `Text` (`dimColor`, `bold`, `inverse`, `color` por `ThemeKey`); `Button` | **sim**, em `hooks/barra.tsx` (D1 do plano) |
| Linha do pedido | `Box row flexWrap` + `Text` + `Button variant="primary"` | **sim**, a mesma função desenha a da barra; o pane usa a mesma frase e o mesmo rótulo |
| Faixa do pedido no pane | `Box column borderStyle="round" borderColor="warning"` + `Text` + `Button` | **sim**, em `register.tsx` (topo do pane) |
| Faixa de largura | uma função pura `faixaDaBarra(bodyColumns, pecas) → 0 \| 1 \| 2`: a faixa mais rica cuja soma cabe (§O que cai quando aperta) | **sim**, exportada para teste |
| Rótulos | constantes exportadas (`ROTULO_LIMPAR = 'Pode se limpar'`, …) usadas pela barra e pelo pane | **sim**: os dois lugares não podem divergir |

## Estados

| Estado | O que se vê | Mock |
|---|---|---|
| Sessão nova, antes da 1ª leitura | `⧗ —` só | 1 |
| Comum (presente, sem pedido, 3 perguntas) | uma linha: leitura à esquerda, `● 3 perguntas`, `Ficar ausente`, `Abrir painel` à direita | 2 |
| Sem perguntas | o selo some; o resto não se move à direita do painel | 2 |
| Pane aberto | `Fechar painel` | 2 |
| Ausente | `☾ Estou de volta` no lugar de `Ficar ausente`, nunca cai | 3 |
| Pedido de limpeza | a linha do pedido acima, com o primário | 4 |
| Enviando / enviado / falhou | `Enviando…`; `✓ Ok enviado à orquestradora`; volta o botão + toast | 4 |
| Limpar antes de vencer (orquestradora) | a linha do pedido com o secundário `Limpar antes de vencer` | 5 |
| Cache em aviso / alerta / venceu | moldura âmbar / vermelha; relógio em negrito / invertido | 6 |
| Contexto alto / no teto da régua | `· alto` em âmbar / `· limpar` em vermelho e negrito | 2b, 3, 6 |
| Turno rodando | `⧗ …`, sem moldura | — |
| Fora do pool (sem título) | relógio, contexto contra a janela sem palavra, selo, painel; sem item, sem pool | — |
| Sem janela conhecida | contexto sem `/` (`contexto 198 mil`), com a palavra se houver régua | — |
| `hasSurvey` ou `/barra` | a barra não desenha (`next(e)`) | — |
| Terminal 114 / 94 / 72 / 40 | §5 | 7 |
| Pane, faixa do pedido a W = 288 | §6 | 8 |

## Movimento

Nenhum. O relógio troca o texto a cada segundo e só; a moldura e a linha do pedido entram e saem sem transição (o motor redesenha a barra a cada tique, e uma animação competiria com o relógio). Nada a fazer com `prefers-reduced-motion`.

## O que sai

- Do `session-band` (já desinstalado): turno, tok/s, custo do turno e total (2ª versão, ideia 9); o contexto em `%`; os ícones em `Svg`; o `×` de esconder.
- O apelido e o papel na barra (o título da sessão já diz).

## Decisões ao operador

**Assumidas, a confirmar** (reversíveis, a execução segue com elas):
- **D2-1 · Sem `Svg` na barra, a mesma árvore no terminal e no desktop.** Se não decidir: fica. Recomendo: fica; a barra é texto curto, e uma árvore só mantém os dois iguais e os testes pela metade.
- **D2-2 · Moldura na barra inteira em aviso e alerta, como o `session-band` fazia.** Se não decidir: fica. Recomendo: fica; é o sinal que o operador já conhece. O custo (o prompt desce 2 linhas no terminal ao entrar em aviso) é uma vez por resposta.
- **D2-3 · `Ficar ausente` só com ≥ 94 células; `☾ Estou de volta` sempre.** Recomendo: fica; sair é uma vez por dia e tem o pane, esquecer ligado é o risco.
- **D2-4 · O botão do painel cai, abaixo de 94, quando o selo está à mostra.** Recomendo: fica; o selo também abre, e o pane se fecha pela própria marca.
- **D2-5 · Rótulo `Pode se limpar`** (a resposta, na voz do operador), e não "Ok para limpar". Recomendo: fica; diz o que a orquestradora vai ouvir.
- ~~**D2-6 · O denominador do contexto é o teto do papel**, com `alto` a partir do aviso.~~ **Substituída pela D1-F65-1** (pedido do operador, 26/10).
- **D1-F65-1 · O denominador do contexto é a janela de compactação, igual para todos os papéis; a régua do papel fica como palavra e cor.** Caso: o operador leu `198/250` como uma janela errada. Se não decidir: fica (é o pedido dele). Recomendo: fica; a fração passa a dizer o que parece dizer.
- **D1-F65-2 · A palavra do teto da régua é `· limpar`** (era `· teto`). Caso: com a janela embaixo, `260/600 · teto` diria "parou" com 340 mil sobrando. Se não decidir: fica `· limpar`. Recomendo: fica; diz que é hora de limpar sem dizer quem limpa, e serve à E (que se limpa) e à orquestradora (que pede).
- **D1-F65-3 · A régua não aparece como número** (nada de `198/600 · limpa em 250`). Caso: o operador perde o "quanto falta para a régua". Se não decidir: fica sem. Recomendo: fica; a régua é do papel, que age nela sozinho, e alargar a peça do contexto derruba a faixa mais cedo em toda sessão.
- **D2-7 · A revisão mora em `docs/design/revisoes/`** (padrão da skill e do `CLAUDE.md`), e não em `docs/design/` como as anteriores e o briefing citavam. Recomendo: fica; o padrão do projeto é este, e o plano diz à E só `docs/design/<revisão da D1>`.

## Crítica

- **Rodada 1** (crítico de UI em contexto separado, 26/10, sobre d5b7b5e): **24/30**, hierarquia 5 · densidade 3 · consistência 4 · ruído 4 · ação primária 4 · aderência 4. **Aprovada com ressalvas**, nenhuma alta. As cinco ressalvas foram aplicadas nesta versão, e não viraram item de fila:
  - **P1 · densidade (média):** as faixas fechavam em 114 e 94 sem folga e sem contar `· alto`, a moldura nem `● 12 perguntas`; a barra quebrava justo no aviso. → a faixa passa a ser a mais rica cuja soma cabe, com os textos reais (§O que cai quando aperta); o teto de altura foi corrigido (§Quem e onde).
  - **P2 · aderência (média):** o mock desenhava linhas mais largas que a borda que ele marca (quadros 3, 5, 6 e 7). → redesenhados no número exato de células; quadro 3b novo, com `● 12 perguntas` a 94.
  - **P3 · ação primária (média):** a mesma `key="limpar"` em `Pode se limpar` e `Limpar antes de vencer` deixava o foco atravessar de um rascunho para o ok que dispara a limpeza. → `limpar-pedido` e `limpar-antes`.
  - **P4 · ruído (baixa):** no aviso, o âmbar pintava até cinco peças. → dentro da moldura de aviso o relógio é só negrito.
  - **P5 · consistência (baixa):** a revisão não dizia que o `label` só é nome acessível com o rótulo visível como filho. → §5, gotcha e testes 2 e 8.
- **Fica como está** (a crítica pediu para não desfazer): relógio na ponta esquerda e painel na ponta direita; a linha do pedido acima da barra com o único primário e quatro sinais além da cor; `☾ Estou de volta` nunca cai e `Ficar ausente` é o primeiro a cair.
- A rodada 1 conta como a crítica desta revisão; não há recrítica pendente (sem ressalva alta).

## Gotchas para a E

- **Largura dos glifos:** `⧗`, `●`, `☾`, `◆` e `✓` são de 1 célula nos terminais comuns; o `🎛` não aparece na barra (o apelido saiu). A soma da faixa conta por ponto de código (`[...texto].length`), não por `length` (UTF-16); se um terminal desenhar algum glifo com 2, o `flexWrap` absorve.
- **O rótulo visível é filho, o nome acessível é `label`** (§5): os testes 2 e 8 conferem o filho.
- **`gap` no motor é linha:** a linha do pedido e a barra usam `gap` 0 no `Box column`; o espaço entre peças é `columnGap`.
- **A moldura só com o turno parado:** sem isso, a barra pisca a moldura a cada turno que cruza os 20 min.
- **`key` fixa** em `perguntas`, `modo` e `painel`, para o foco não se perder quando o rótulo muda; **`limpar-pedido` e `limpar-antes` separadas**, para o foco não atravessar de uma ação para a outra.
- **Antes da 1ª leitura, nada à direita:** o selo não pisca `0` → `3`.
- **O otimista do modo** é o do pane (geração, escrever o modo antes de soltar o `trocandoModo`): a barra e o pane leem o mesmo atom; um não desfaz o outro.

## Para a E

Testes visuais, além dos do plano:
1. `faixaDaBarra`, estado comum de referência: 114 → 0; 113 e 94 → 1; 93 e 40 → 2. Com `· alto` a 114 → 1, e a 94 → 2; com moldura a 114 → 1; com `● 12 perguntas`, ausente e `Fechar painel` a 114 → 1; nenhuma faixa cabe a 40 → 2.
2. Faixa 0, presente, 3 perguntas: a ordem dos filhos à esquerda é relógio, contexto, item, pool; à direita, os `Button` `perguntas`, `modo`, `painel`, nesta ordem; o rótulo de cada um é o filho (a constante), e o `label` é o nome acessível.
3. Faixa 1: sem pool; contexto `142/600 mil`. Faixa 2: sem item; contexto `142 mil`; presente com selo → não há `modo` nem `painel`; ausente com selo → há `modo` (`☾ Estou de volta`) e não há `painel`; sem selo → há `painel`.
4. A linha do pedido vem **antes** da barra no `Box column`; tem o único `Button` com `variant="primary"`; o texto tem `◆`; o Q-ID só nas faixas 0 e 1.
5. Orquestradora com pedido aberto e cache a 8 min: **uma** linha do pedido, a do pedido (primário), não a do "limpar antes"; o único `Button` dela tem `key` `limpar-pedido`.
6. Cache: 1 201 s → sem `borderStyle`; 1 200 s → `round` + `warning`, relógio `bold` e sem `color`; 600 s → `error`, relógio `inverse`; `isWorking` em qualquer valor → sem borda e `⧗ …`.
7. Contexto contra a janela (`autoCompactWindow` 600 000): orquestradora a 198 mil → `contexto 198/600 mil`, sem palavra; a 260 mil → termina em ` · limpar`, `color` `error` e `bold`; P a 362 mil → ` · alto`, `warning`; papel desconhecido → com `/600` e sem palavra; janela nula → sem `/` e com a palavra (prove no mesmo estado que, com a janela, o `/` apareceria). A palavra vem de uma constante exportada (`PALAVRA_LIMPAR = ' · limpar'`, ao lado de `' · alto'`).
9. `· limpar` conta na faixa: P a 510 mil (`contexto 510/600 mil · limpar`, 29), item `F52 · design`, pool `E 2 · V 1`, 3 perguntas, presente, painel fechado → a faixa 0 soma 63 + 2 + 52 + 2 = **119**: a 119 colunas → 0; a 118 → 1.
8. Pane: a faixa do pedido vem depois da linha `⚠ Parou` (quando há) e antes da faixa do ausente; tem `borderColor="warning"` e o `Button` `limpar-pedido` primário; os rótulos (filhos) são as mesmas constantes da barra.

**Gestos que a V audita** (`auditoria-de-clique`): o selo abre o pane e, aberto, não fecha; o painel abre e fecha do mesmo ponto; `Ficar ausente` → `☾ Estou de volta` no mesmo lugar, e de volta; `Pode se limpar` com uma pergunta de teste, olhando `Enviando…` antes do `✓`; `Limpar antes de vencer` deixa o rascunho na caixa; a barra a 94 e a 40 células sem nada sair pela direita; a moldura em claro e escuro.
