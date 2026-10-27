# Revisão de arquitetura — o botão de limpar fixo e os ícones da barra; a seção "Sessões para abrir" do pane

- **Data:** 2026-10-26 (SP), nome do arquivo pelo plano
- **Autora:** D1, designer do pool
- **Estado:** aprovada com ressalvas (crítica 2, 26/30, sem ressalva alta; [§Crítica](#critica)). Liberada para execução.
- **Plano de origem:** [`docs/planos/2026-10-27-sessoes-para-abrir-e-botao-de-limpar.md`](../../planos/2026-10-27-sessoes-para-abrir-e-botao-de-limpar.md) (PR 55). O comportamento (o que o clique grava, a T7, a coleção `cartoes`, quem grava e quem apaga) é do plano. Esta revisão decide os glifos, as cores, a ordem e o destaque dos botões da barra (D7, D1, D2), o estado `Limpando…` (D3), a seção "Sessões para abrir" (D10) e o que sai do pane e da barra.
- **Base:** a revisão da barra ([`2026-10-26-barra-de-status.md`](2026-10-26-barra-de-status.md), com os deltas F65 e F71). O que esta revisão não cita da barra continua como lá: o relógio, o contexto contra a janela, as palavras `· alto` e `· limpar`, a moldura do cache, as `key` fixas, o "antes da 1ª leitura só o relógio".
- **Fontes lidas:** o plano (PR 55); os handoffs F144 e F147; `plugins/painel-sessoes/hooks/barra.tsx` (`pecasDaBarra`, `larguraDaFaixa`, `desenharBarra`, `desenharPedidoNoPane`); `register.tsx` (o desenho do pane nas duas superfícies: o SVG do desktop e o `Text` do terminal; `topoDaFila`, `acaoDoPedido`, `botaoOrquestradora`, `resumo`); `desenho.ts` (`CSS`, `secaoSvg`, `filaSvg`, `modoSvg`, `fileteSvg`); os tipos do motor desta build (`ButtonProps`, `TextProps`, `ThemeKey`).

<a id="medido"></a>
## O que o motor deixa fazer (medido nos tipos desta build)

- **`Button` não tem cor.** Aceita `variant` (`primary` · `secondary`), `dimColor`, `plain`, `label`, `key`, `hover` e filhos `string` ou `Text`. A cor de um botão só entra por um `Text color=…` filho — exatamente como o `●` do selo e o `☾` do "Estou de volta" já fazem hoje.
- **`Text color` aceita uma `ThemeKey`** (`text`, `subtle`, `suggestion`, `success`, `error`, `warning`, `planMode`, `claude`, `permission`, `ide`, `merged`, `autoAccept`…) ou qualquer outra cor. **A revisão usa só chaves do tema**: a cor segue o tema da pessoa (claro, escuro, daltônico, o dela), e o contraste é o que o tema garante. Hex solto na barra é defeito.
- **Por isso a cor é do glifo, não do botão inteiro.** O rótulo fica na cor do botão (cheio no primário, apagado com `dimColor`); só o glifo à esquerda leva a cor própria. É o padrão que a barra já tem, e evita rótulo colorido ilegível em fundo de botão nativo do desktop.

## Tarefa

1. **Barra:** *o operador vê, em qualquer sessão, o que espera por ele e, na orquestradora, limpa-a com um clique quando o contexto pede* — sem pergunta, sem janela.
2. **Pane:** *o operador vê quais cartões de sessão nova esperam o clique dele e em qual conversa estão*, separados das decisões.

## Quem e onde

- **Quem:** o operador, sozinho, que alterna entre a conversa da orquestradora e as dos membros do pool.
- **Barra:** acima do prompt de **toda** sessão; terminal de 114 células como referência, 40 como pior caso; desktop numa coluna de chat. Lida a cada 30 s e a cada turno.
- **Pane:** a coluna lateral do desktop (W = 288 é o pior caso medido, 360 a referência) e o pane do terminal.
- **Frequência:** o botão de limpar é usado de uma a algumas vezes por dia, mas tem de estar à mão todas; os cartões aparecem em rajadas (uma vaga pede duas ou três sessões de uma vez) e somem em minutos.

## Inventário

### Barra (grupo da direita)

| O quê | Onde está hoje | Decisão que gera | Frequência | Veredito |
|---|---|---|---|---|
| Selo `● 3 perguntas` | direita, 1º | "tenho decisão esperando" → abre o painel | várias vezes por hora | **fica**, glifo e cor como hoje |
| Pedido `◆ orquestradora pede limpeza` + `Pode se limpar` | direita, antes do selo, só com a pergunta aberta | dar o ok | ~1 por dia | **sai** (D5): não há mais pedido |
| `✓ ok enviado` | no lugar do pedido | — | — | **sai** com o pedido |
| `Limpar antes de vencer` | direita, só a orquestradora, cache ≤ 10 min e ≥ 150 mil | põe um rascunho no prompt | raro | **sai** (D2): o botão fixo destacado cobre o caso |
| **Botão de limpar fixo** | — (novo) | limpar a orquestradora agora | ~1 a 3 por dia | **fica**, só na orquestradora, em toda faixa |
| Modo `Ficar ausente` / `☾ Estou de volta` | direita, depois do selo | sair ou voltar | ~2 por dia | **fica**, ganha glifo e cor nos dois estados |
| Painel `Abrir painel` / `Fechar painel` | direita, último | ver o pane | várias por hora | **fica**, ganha glifo e cor |

### Pane

| O quê | Onde está hoje | Decisão que gera | Frequência | Veredito |
|---|---|---|---|---|
| Faixa do pedido de limpeza (`◆ A orquestradora pede para se limpar` + `Pode se limpar`) | topo do pane | dar o ok | ~1 por dia | **sai** (D5) |
| Pergunta com Q-ID "clicar nos cartões E21, E22 e D3" | Esperam você | nenhuma decisão: é um clique noutra conversa | por vaga | **sai** (D11): a orquestradora não abre mais |
| **Linha de cartão** (apelido, papel, para quê, de qual orquestradora, há quanto tempo) | — (novo) | "vou à conversa da orquestradora clicar" | por vaga | **fica**, na seção nova |
| Topo da Na fila: grupo "N cartões da fila esperam você na conversa da orquestradora de X" + `Abrir a orquestradora` | topo da Na fila | o mesmo clique da linha de cartão | por vaga | **sai**: a seção nova diz o mesmo com o cartão nomeado e sobrevive ao fechar o pane (o grupo vive só na memória da tela) |
| `Pedido às HH:MM · inicie o cartão` na linha do item da Na fila | linha do item | diz que o pedido daquele item já saiu (não repetir) | por vaga | **fica** (D11) |
| O mesmo, com `Abrir a orquestradora`, no cartão de Executando | cartão do item | idem | raro | **fica** (D11) |
| Contagem no resumo do topo | — | — | — | **não entra** ([§Hierarquia](#resumo)) |

## Hierarquia e peso

<a id="barra"></a>
### Barra

**Ordem da direita, nova:** `selo → limpar → modo → painel`. O limpar fica **colado à esquerda do modo** (o pedido do operador: "antes do Ficar ausente") e os dois formam o par "controle da sessão"; selo e painel, nas pontas, são os dois caminhos para o pane.

**Os quatro botões, com glifo e cor:**

| Botão | Rótulo | Glifo (`Text color`) | Variante | `key` |
|---|---|---|---|---|
| Selo | `● 3 perguntas` · `● 1 pergunta` | `●` `warning` (como hoje) | secundário | `perguntas` |
| **Limpar**, abaixo da régua | `↺ Limpar` | `↺` `subtle` (apagado, como o rótulo) | secundário, `dimColor` | `limpar` |
| **Limpar**, na régua (destaque) | `↺ Limpar` | `↺` `error` | **primário**, sem `dimColor` | `limpar` |
| **Limpar**, enviando | `↺ Limpando…` | `↺` `error` | secundário, clique ignorado | `limpar` |
| Modo, presente | `☾ Ficar ausente` | `☾` `suggestion` | secundário, `dimColor` | `modo` |
| Modo, ausente | `☾ Estou de volta` | `☾` `suggestion` | secundário | `modo` |
| Modo, gravando | `☾ Ligando…` · `☾ Desligando…` | `☾` `suggestion` | clique ignorado | `modo` |
| Painel | `◨ Abrir painel` · `◨ Fechar painel` | `◨` `planMode` | secundário, `dimColor` | `painel` |

- **Por que estes glifos:** `↺` é "recomeçar do zero" e não é a lixeira (nada se perde: o estado vai para o handoff antes); `☾` já é o ausente no pane e na barra, e passa a abrir também o `Ficar ausente` — o mesmo gesto tem o mesmo glifo nos dois estados, e o rótulo diz qual; `◨` é um quadro com a metade direita cheia, o painel que abre ao lado; `●` continua o selo.
- **Por que estas cores** (o exemplo do operador: ausente em azul):
  - `☾` em **`suggestion`**, o azul do tema (no tema padrão, azul-lavanda no escuro e azul cheio no claro). É também o tom mais perto do lilás do ausente no pane (`.li`), então barra e pane continuam dizendo "ausente" na mesma família de cor. Sai o `planMode` que o `☾` tinha.
  - `↺` em **`error` só na régua**, e em `subtle` abaixo dela: limpar é a ação de maior consequência da barra (a orquestradora perde a conversa), e o vermelho é a cor da palavra `· limpar` do contexto, à esquerda. Os dois vermelhos aparecem e somem juntos, e a palavra e o botão se apontam. Um `↺` vermelho permanente gastaria o sinal: a barra reserva o vermelho para o que o operador tem de ler agora (revisão da barra, cores). A cor própria do limpar é, portanto, o vermelho do momento em que ele importa.
  - `◨` em **`planMode`**, o verde-azulado: neutro, longe do azul do modo e do âmbar do selo, nos dois temas.
  - `●` em **`warning`**, o âmbar de "espera você", como hoje.
- **Nenhuma cor é a única pista.** Os quatro glifos têm formas diferentes (`●` cheio, `↺` seta, `☾` crescente, `◨` quadro) e cada rótulo diz a ação em palavra. Em tema daltônico, ou com as quatro cores iguais, a barra continua legível.
- **Contraste:** as quatro chaves são cores de texto do tema, desenhadas sobre o fundo do terminal ou do botão nativo; os tipos do motor não trazem os valores do tema, então nada aqui afirma a razão de contraste. **A E mede**, para os 3:1 de elemento gráfico, nos temas claro e escuro do app, com captura, e cola na PR; se algum glifo ficar abaixo de 3:1 num tema padrão, volta para esta revisão (não troca de chave por conta própria).

**O destaque do limpar (D2) segue a palavra do contexto.** O botão está em destaque **exatamente quando** o contexto à esquerda mostra `· limpar` (`corDoContexto === 'teto'` com a régua do papel; para a orquestradora presente, 150 mil). Uma regra só para os dois sinais: a palavra vermelha, o `↺` vermelho e o botão primário aparecem e somem juntos. Com o operador presente, o caso "cache vence em ≤ 10 min com ≥ 150 mil" já está dentro dela, e por isso o `Limpar antes de vencer` sai sem perda. **Com o ausente ligado**, a palavra segue a régua da planejadora (500 mil), e o destaque iria junto: isso difere da letra da D2 (150 mil) e vai como [pendência à planejadora](#pendencias); até ela responder, a E implementa a regra "destaque = palavra `· limpar`" e o teste cobre só o presente.

- **O que distingue o destaque sem cor:** o botão passa de apagado (`dimColor`) a cheio e de secundário a **primário** (no terminal, o `[ ]` na cor de destaque; no desktop, o botão nativo cheio) — o único primário da barra; e a palavra `· limpar` aparece à esquerda.
- **O rótulo não muda com o destaque** (`↺ Limpar` nos dois): a largura não pula, e o foco de teclado não perde o botão (`key="limpar"` fixa).

**Onde o limpar aparece (D1):** só na barra da sessão cujo título começa com `🎛 orquestradora`, inclusive com o ausente ligado; em toda faixa (nunca cai quando a largura aperta). Em outra sessão não existe, nem apagado.

**As faixas, com os glifos** (orquestradora a 198 mil, sem item; `E 2 · V 1` no pool; 3 perguntas; presente):

```
faixa 0 (≥ 125):  ⧗ 47:12  contexto 198/600 mil · limpar  E 2 · V 1   [ ● 3 perguntas ] [ ↺ Limpar ] [ ☾ Ficar ausente ] [ ◨ Abrir painel ]
faixa 1 (≥ 105):  ⧗ 47:12  198/600 mil · limpar   [ ● 3 perguntas ] [ ↺ Limpar ] [ ☾ Ficar ausente ] [ ◨ Abrir painel ]
faixa 2 (≥ 62):   ⧗ 47:12  198 mil · limpar   [ ● 3 perguntas ] [ ↺ Limpar ]
abaixo de 62:     o flexWrap quebra o grupo da direita entre os botões, como hoje
```

- **As regras de queda não mudam**, só deixam de depender do pedido: item cai na faixa 2; pool, nas 1 e 2; modo **presente** cai na 2 (o ausente nunca cai); painel cai na 2 quando há selo. **O limpar nunca cai.** Sai a variável `acao` do `pecasDaBarra` (que tirava item, pool e modo quando havia pedido): sem pedido, não há o que abrir espaço.
- **A largura reserva o `Limpando…`:** `larguraDaFaixa` conta o limpar sempre como `↺ Limpando…` (11 + 4 = 15), como contava o pedido em repouso — a barra não se rearruma debaixo do clique.
- **As medidas** (regra de `larguraDaFaixa`: botão +4, 1 de vão entre botões, 2 entre os lados, 2 de margem). Faixa 0, acima: esquerda 7 + 29 + 9 + 2 × 2 = 49; direita 17 (selo) + **15** (limpar reservado) + 19 (modo) + 18 (painel) + 3 = 72; total 49 + 2 + 72 + 2 = **125**. Faixa 1: 29 + 2 + 72 + 2 = **105**. Faixa 2: 25 + 2 + (17 + 15 + 1) + 2 = **62**. Com `◨ Fechar painel` (15, contra 14), as faixas 0 e 1 somam +1 (126 e 106). A 114 células a orquestradora cai na faixa 1, que ainda mostra os quatro botões.
- **Num membro do pool** (sem o limpar), o `●` e o `☾ Estou de volta` já têm glifo hoje; os novos são o `☾` do `Ficar ausente` e o `◨` do painel: presente, as faixas 0 e 1 crescem **+4**; ausente, **+2**; na faixa 2 com selo, **0** (modo presente e painel já caem ali).
- **Glifos de uma célula:** `↺` (U+21BA), `◨` (U+25E8), `☾` e `●` são de largura "ambígua" no Unicode; a barra já assume uma célula para `☾`, `●` e `⧗`, e os dois novos seguem a mesma conta. Nenhum emoji (que ocupa duas).

<a id="pane"></a>
### Pane: a seção "Sessões para abrir"

**Lugar:** logo abaixo de "Esperam você" e acima de "Travados" (D10); só existe com ao menos uma linha visível. Na ordem do pane, o que espera o operador vem antes de tudo: primeiro as decisões, depois os cliques.

**Peso:** cada linha pesa como uma linha da Na fila (≈ 64 px a W = 360, uma linha de título), nunca como um cartão de item: é um lembrete de clique, não um objeto de trabalho. Com três cartões, a seção inteira cabe em ≈ 260 px, abaixo do que duas perguntas ocupam.

**A faixa da seção** (`secaoSvg`, como as outras): título `Sessões para abrir`, pílula com o número de linhas visíveis, legenda `na orquestradora` (cabe a partir de W ≈ 293; abaixo some, como as outras, e a frase do grupo diz o mesmo), tom **`av`** com **`tracejado: true`** (o filete âmbar tracejado, opção que o `secaoSvg` já tem). Âmbar porque é a mesma natureza de "Esperam você": o próximo passo é do operador. O que separa as duas seções vizinhas é a **forma**, que vale em toda largura: o filete tracejado da faixa ecoa o anel tracejado de cada linha ("sessão que ainda não existe"), contra o filete cheio e os cartões emoldurados de "Esperam você"; e o título. A legenda é reforço, não a pista principal.

**A linha de um cartão** (desktop, SVG; peça nova `sessaoParaAbrirSvg` em `desenho.ts`, mesma anatomia do `filaSvg`):

```
◌  E21 · EXECUTORA                                   há 4 min
   Cartão de sessão sai das perguntas e ganha seção…
   + 1 item
────────────────────────────────────────────────────────────────
◌  D3 · DESIGNER                                     há 4 min
   Manter uma designer livre
────────────────────────────────────────────────────────────────
   Os cartões estão na conversa da orquestradora de kit-de-orquestracao
                                          [ Abrir a orquestradora ]
```

- **Coluna do glifo (x 0–22):** o anel tracejado da Na fila (`circle r=5`, `stroke-dasharray 2 2`), mas no traço âmbar (`avs`): "uma sessão que ainda não existe e espera você".
- **Linha 1 (11 px, a do `sobreSvg`):** o apelido em `t` 700 e o papel por extenso em `m` 600 caixa alta (`E21 · EXECUTORA`); à direita, há quanto tempo foi proposto (`desde(propostoEm)`), em `m`, dígitos tabulares.
- **Linha 2 (14 px / 600, `t`):** para quê. Com itens: o **título** do primeiro item (lido do índice; sem título, o número dele), até duas linhas, como o título da fila. Sem itens: `Manter uma <papel> livre` (`executora`, `designer`, `planejadora`, `validadora`).
- **Linha 3 (12,5 px, `s`), só quando há o que dizer:** `+ N item`/`+ N itens` quando o cartão tem mais de um item. Sem isso, a linha não existe.
- **De qual orquestradora (D10), uma vez por grupo:** a frase `Os cartões estão na conversa da orquestradora de <projeto>` (`O cartão está…` com um só), 12,5 px `s`, logo acima do botão do grupo, até duas linhas (o projeto nunca corta). Repetir a frase em cada linha de uma vaga de três diria o mesmo três vezes acima de um botão que já diz o destino.
- **`alt`** da linha: `E21, executora, proposta há 4 min, para: <títulos de todos os itens, com os números>, na conversa da orquestradora de <projeto>`. O leitor de tela ouve a lista inteira, que o desenho corta.
- **Filete** (`ln`) entre linhas, como na fila.
- **O botão:** as linhas se agrupam por orquestradora (a ordem: grupo da orquestradora com o cartão mais antigo primeiro; dentro do grupo, o mais antigo primeiro), e **um** `Abrir a orquestradora` fecha cada grupo, alinhado à direita, logo abaixo da frase do grupo — o mesmo `botaoOrquestradora` de hoje (`key` `cartoes:<localId da orquestradora>`, estado `Abrindo…`). Um botão por linha repetiria o mesmo destino três vezes numa vaga de três.
- **Com mais de uma orquestradora** (dois projetos), cada grupo tem a sua frase e o seu botão, e um filete separa os grupos.

**No terminal** (o pane de `Text`), a mesma ordem, sem SVG:

```
Sessões para abrir · 2
◌ E21 executora · há 4 min
  Cartão de sessão sai das perguntas e ganha seção própria no painel
  + 1 item
◌ D3 designer · há 4 min
  Manter uma designer livre
Os cartões estão na conversa da orquestradora de kit-de-orquestracao
[ Abrir a orquestradora ]
```

`tituloDaSecao('Sessões para abrir', n, 'warning')`; o `◌` em `warning`; linha 1 em `bold` só no apelido; linha 2 com `wrap="wrap"`; linha 3 e a frase do grupo `dimColor`, `wrap="wrap"`.

<a id="resumo"></a>
**Conta no resumo do topo? Não** (a decisão que o plano deixou à D, em D10):
- o resumo tem quatro peças que somam os **itens** (`contarSecoes`, uma conta só para pílula, contador e lista); um cartão não é item, e somá-lo a "Esperam você" faria a pílula do resumo dizer 5 com 3 linhas na seção "Esperam você";
- uma quinta peça não cabe a W = 288 (o resumo já vira 2×2 abaixo de 500) e ficaria vazia quase o dia todo;
- a seção nova fica logo abaixo de "Esperam você", na primeira dobra: quem abre o pane a vê sem rolar. O número dela mora na pílula da própria faixa.

## Mensagens

| Mensagem | Lugar | Duração | Tom | Quem vê |
|---|---|---|---|---|
| `↺ Limpar` em destaque | barra da orquestradora, no botão | enquanto o contexto está na régua | `ruim` (o glifo) | o operador, na orquestradora |
| `↺ Limpando…` | no botão, onde clicou | do clique até o envio voltar (D3; [§Estados](#estados-barra)) | `espera` | idem |
| `Não consegui mandar a limpeza (<motivo>).` | toast + a faixa de avisos do pane (`avisar`) | some sozinho (toast); até fechar (pane) | `ruim` | idem |
| `Não consegui gravar o ok de limpar (<motivo>).` (só no ramo da D4 que grava o arquivo) | idem | idem | `ruim` | idem |
| O prompt `O operador mandou limpar pelo botão da barra: …` | a conversa da orquestradora (é o efeito do clique) | permanente, na conversa | `neutro` | o operador e a orquestradora |
| Linha de cartão | pane, seção "Sessões para abrir" | até o apelido aparecer vivo, o cartão ser retirado ou passar de 12 h | `espera` | o operador |
| `Abrindo…` | no `Abrir a orquestradora` | do clique até o app abrir a conversa | `espera` | o operador |
| `A orquestradora destes cartões não está aberta` | no lugar da frase do grupo, em `er`; o grupo fica sem botão | até a batida apagar os cartões | `ruim` | o operador |

## Regiões e componentes

| Região | Componentes | Peça nova? |
|---|---|---|
| Barra, grupo da direita | `Button` do motor com filho `Text color` no glifo; `pecasDaBarra`, `larguraDaFaixa`, `desenharBarra` em `barra.tsx` | Não. Uma constante `GLIFO` (`{ limpar: { g: '↺', repouso: 'subtle', regua: 'error' }, modo: { g: '☾', cor: 'suggestion' }, painel: { g: '◨', cor: 'planMode' }, perguntas: { g: '●', cor: 'warning' } }`, ou forma equivalente) em `barra.tsx`, para o teste comparar o glifo e a cor de cada peça com o desenho; o teste do limpar cobre os dois estados |
| Pane desktop, faixa da seção | `secaoSvg` (tom `av`, `tracejado: true`) | Não |
| Pane desktop, linha de cartão | **`sessaoParaAbrirSvg(W, cartao, agora, titulos)`** em `desenho.ts`: anatomia do `filaSvg` (coluna do glifo, linha "sobre", título em até 2 linhas, linha `+ N itens` opcional, filete) | **Sim**, para o kit do pane (`desenho.ts`), com teste próprio |
| Pane desktop, frase do grupo | `texto` em `s` 12,5 num SVG de W (até 2 linhas, `quebrar`); estado "orquestradora não aberta" em `er` | Não (parte da mesma função ou uma `grupoDeCartoesSvg` ao lado, à escolha da E) |
| Pane desktop, botão do grupo | `botaoOrquestradora` de `register.tsx` | Não |
| Pane terminal | `Text`, `Box`, `tituloDaSecao`, `botaoOrquestradora` | Não |

## Estados

<a id="estados-barra"></a>
### O botão de limpar

| Estado | O que a barra mostra |
|---|---|
| antes da 1ª leitura | nada à direita (como hoje): o limpar não aparece antes de saber o título |
| repouso, abaixo da régua | `↺ Limpar` secundário, apagado, `↺` em `subtle` |
| repouso, na régua | `↺ Limpar` primário, cheio, `↺` em `error`; `· limpar` à esquerda |
| clicou | `↺ Limpando…` no mesmo render (otimista); cliques ignorados. A ordem do gesto (D3, D4 do plano em `5e2378c`): se a medida da D4 der origem `human`, **só o prompt** (nenhum arquivo); com outra origem ou `null`, grava o arquivo do ok → manda o prompt, e se o arquivo falha **não** manda o prompt |
| envio voltou | volta a `↺ Limpar` (D3, literal). O prompt aparece na conversa da orquestradora, que é o efeito visível do clique. Segurar o `Limpando…` até a limpeza acontecer é [pendência à planejadora](#pendencias) |
| a limpeza aconteceu | a próxima leitura vê o contexto pequeno: o botão fica apagado |
| falhou (arquivo ou envio) | `↺ Limpar` no mesmo render em que a falha chega; toast com o motivo; aviso na faixa do pane |
| turno rodando no clique | o clique vale igual: o prompt entra como o app enfileira prompts durante um turno. **A E mede** se o `$.prompt.submit` com turno rodando enfileira ou falha; se falhar, o botão fica desabilitado-visível durante o turno (rótulo `↺ Limpar`, apagado, clique devolve o toast `Espere o turno acabar para limpar.`) e a E registra na PR |
| modo não lido / sem título | sem botão (como o modo) |

### A seção "Sessões para abrir"

| Estado | O que o pane mostra |
|---|---|
| carregando (1ª leitura) | nada: a seção só nasce depois de ler (não pisca vazia) |
| sem cartão, ou todos escondidos | a seção não existe (nem título) |
| com cartões | faixa + linhas agrupadas + um botão por grupo |
| apelido já vivo na lista que o pane leu | a linha some na hora, sem esperar a batida (D9); a pílula conta só as visíveis |
| cartão com mais de 12 h | a linha some no pane também (mesma régua da batida), para o pane não mostrar o que a batida vai apagar |
| sem a lista de sessões (`semLista`) | as linhas aparecem todas (não dá para saber quais abriram); o aviso "Sem a lista de sessões do app" que a Na fila já mostra cobre o motivo — não se repete aqui |
| a orquestradora do grupo não está viva | as linhas do grupo ficam; a frase do grupo vira `A orquestradora destes cartões não está aberta`, em `er`; o grupo fica sem botão |
| clicou em `Abrir a orquestradora` | `Abrindo…` no botão até o app abrir; falha = o aviso de sempre do `abrirSessao` |
| `cartoes` ilegível | a seção não aparece; o erro vai para a faixa "Não consegui ler tudo" como os das outras coleções |

## Movimento

Nenhum. A barra e o pane trocam por redesenho, sem transição (o motor não anima). Com `prefers-reduced-motion`, nada muda.

## O que sai

- Da barra: o pedido (`pedido`, `limpar-pedido`, `FRASE_DO_PEDIDO`, `FRASE_NA_BARRA`, `FRASE_CURTA_NA_BARRA`, `OK_ENVIADO`, `ROTULO_LIMPAR`, `ROTULO_ENVIANDO` do pedido), o `Limpar antes de vencer` (`limpar-antes`, `ROTULO_LIMPAR_ANTES`, `RASCUNHO`, `mostraLimparAntes`), a variável `acao` do `pecasDaBarra`, o `planMode` do `☾`.
- Do pane: a faixa do pedido de limpeza do topo (`desenharPedidoNoPane`); o grupo "N cartões da fila esperam você na conversa da orquestradora de X" com o seu botão, no topo da Na fila (a seção nova o substitui; o `Pedir n sessões` e os avisos de projeto do topo ficam).
- Do conteúdo: a pergunta com Q-ID para clicar em cartão (vem da skill, D11).

## Decisões ao operador

Nenhuma trava a execução; as três são *assumidas, a confirmar*, reversíveis com troca de constante.

- **Cor do limpar.**
  - *O caso:* cada botão ganha uma cor. Para o `↺` do limpar, ela é vermelha só quando o contexto pede a limpeza (junto da palavra `· limpar`); no resto do tempo o glifo fica apagado, como o rótulo. As alternativas eram o vermelho o tempo todo (gasta o sinal: vermelho parado que não pede nada) ou o laranja do Claude (`claude`), mais calmo, mas perto do âmbar do selo no tema claro.
  - *Se não decidir:* vermelho só na régua.
  - *Recomendação:* vermelho só na régua, porque o botão e a palavra que pede a limpeza acendem juntos e o vermelho continua querendo dizer "agora".
- **Ordem `selo → limpar → modo → painel`.**
  - *O caso:* o pedido foi "antes do Ficar ausente"; pus o limpar colado ao modo, depois do selo. A outra leitura seria o limpar como primeiro botão da direita (onde ficava o pedido).
  - *Se não decidir:* fica colado ao modo.
  - *Recomendação:* colado ao modo: é a leitura literal do pedido e junta os dois controles da sessão.
- **Sem contagem no resumo do topo** ([§Resumo](#resumo)).
  - *O caso:* os cartões não somam em "Esperam você" nem ganham peça própria no resumo.
  - *Se não decidir:* fica fora.
  - *Recomendação:* fora; a seção está na primeira dobra e tem a própria pílula.

<a id="pendencias"></a>
## Pendências à planejadora (não mudam o que a E faz agora)

- **O destaque com o ausente ligado.** A D2 fala em 150 mil; a régua de contexto da orquestradora ausente é a da planejadora (500 mil), e a palavra `· limpar` segue essa. Esta revisão amarra o destaque à palavra; se a planejadora quiser 150 mil também no ausente, a palavra e o botão se separam nesse modo e a revisão ganha um delta. Até lá, a E implementa "destaque = palavra" e testa só o presente.
- **Segurar o `Limpando…` até a limpeza.** Entre o envio e o `clear_session` a orquestradora grava o handoff (às vezes minutos), e o botão volta a `↺ Limpar` nesse meio, o que convida a um segundo clique (que só repete o pedido, sem dano). Segurar até o turno acabar tem um caso de borda: com turno rodando no clique, o prompt entra na fila e o `isWorking` que acaba é o do turno anterior. Se a planejadora quiser, a régua certa é "até a próxima leitura ver o contexto abaixo da régua, ou 10 min"; até lá vale a D3 literal.

## Fora desta revisão (vira item, se quiserem)

- **O botão do modo no topo do pane** (`Ficar ausente` / `Estou de volta`, em `register.tsx`) continua sem glifo. Para o mesmo gesto ter o mesmo glifo nas duas superfícies, ganharia o `☾` em azul. Fora do escopo do plano (o F147 é a barra): item novo, peso baixo.
- **Sinal de cartão na barra:** com o cartão fora das perguntas, o selo da barra não conta mais "clicar no cartão"; quem está noutra sessão só fica sabendo pelo pane ou pela conversa da orquestradora. Se o operador quiser o aviso na barra, é item novo (a barra passaria a ler `cartoes`).

## Gestos para a auditoria de clique (E)

- `↺ Limpar`: clique → (só no ramo da D4 sem `human`: arquivo `limpeza/<local_…>.json`) → prompt na própria sessão → `clear_session "self"` → T7 libera; e o caminho de falha (no ramo do arquivo: arquivo não grava → nada é enviado; envio falha → rótulo volta + toast).
- `Abrir a orquestradora` do grupo: clique → `abrirSessao` com o `localId` do grupo → `Abrindo…` → a conversa abre; e a linha que some quando o apelido aparece vivo.

<a id="critica"></a>
## Crítica

**Rodada 1 (crítico de UI, contexto separado): 23/30**, hierarquia 4 · densidade 3 · consistência 5 · ruído 4 · ação primária 4 · aderência 3. Sem ressalva alta.

| Problema | Peso | O que mudou nesta versão |
|---|---|---|
| P1 · as larguras das faixas não contavam a reserva do `Limpando…`, e o "cresce 6 células" do membro estava errado | média | faixas refeitas: 125 / 105 / 62 (+1 com `Fechar painel`); membro: +4 presente, +2 ausente, 0 na faixa 2 com selo |
| P2 · os estados do limpar iam além da D3 e da D2 | média | `Limpando…` volta a ser "até o envio voltar" (D3 literal); o `Limpando…` estendido e o destaque com o ausente ligado viraram [pendências à planejadora](#pendencias); o arquivo de ok só no ramo da D4 sem `human` (corrigido na rodada 2) |
| P3 · a legenda da seção não cabia em W 360 nem 288, e era uma das pistas que separavam a seção de "Esperam você" | média | a faixa passa a `tracejado: true` (a pista vira a forma, em toda largura); legenda curta |
| P4 · o `↺` vermelho em repouso gastava o vermelho da barra | média | `↺` em `subtle` abaixo da régua e em `error` na régua; a decisão "Cor do limpar" registra a alternativa; tirada a razão de contraste que nenhuma fonte media |
| P5 · "na conversa da orquestradora de…" repetido em toda linha | baixa | a frase vai uma vez por grupo, acima do botão; a linha 3 fica só com `+ N itens` |

**Rodada 2 (recrítica 1): 26/30, aprovada com ressalvas**, hierarquia 5 · densidade 5 · consistência 4 · ruído 4 · ação primária 4 · aderência 4. Sem ressalva alta; as quatro, de texto, aplicadas sem nova rodada:

| Problema | Peso | O que mudou |
|---|---|---|
| P1 · a revisão citava a D4 da 1ª versão do plano (`29fd8f4`); a de hoje (`ac2383e`, `5e2378c`) não grava arquivo com origem `human` | média | estados, mensagens e gestos: o arquivo só no ramo da D4 sem `human` |
| P2 · a constante `GLIFO` tinha uma cor só para o limpar | baixa | `repouso: subtle`, `regua: error`; o teste cobre os dois |
| P3 · a tabela de componentes não dizia `tracejado: true` | baixa | dito |
| P4 · `clique lá` sem referente no cabeçalho | baixa | `na orquestradora` |

O crítico observou que a recrítica saiu do mesmo contexto da 1ª rodada (a skill pede crítico novo). As mudanças da rodada 2 são de texto e alinham a revisão ao plano; se a orquestradora quiser a regra à letra, um crítico novo confirma a nota antes da execução.
