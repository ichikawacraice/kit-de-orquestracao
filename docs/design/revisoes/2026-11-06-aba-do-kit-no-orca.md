# Revisão de design — a aba do kit no Orca (F436)

- **Data:** 2026-11-06 (SP)
- **Autora:** a dona do F436, com a skill `frontend-design`.
- **Estado:** proposta, versão 4. A 3ª crítica (2ª recrítica) deu 22/30, abaixo do corte, e esgotou as recríticas; os cinco achados dela estão aplicados aqui (trilho com borda e a seção atual em `accent`, linhas de decisão em borda sem fundo, `Aceitar` sem ícone, lote de cada lista assumido como diferente, títulos de dobra mais curtos) e o juízo final vem do render real, com as capturas no PR. Antes: v3 (2ª crítica, 23/30: gestos da decisão na linha do metadado sem dobra aninhada, `Confirmar todas` no pé da seção, peso igual de linha × lote nas duas listas, título de dobra cortado no código; 1ª crítica, 19/30: decisões compactas, cabeçalho único com a barra de lote, cartão de entrega com uma dobra só, recomendação em borda e não em tinta, contagem do trilho em selo). Substitui a primeira versão desta revisão, que o designer escreveu contra a base de design da Wicomm. A aba não é produto Wicomm (correção do operador, 06/11): a direção abaixo é própria, tirada das inspirações do operador (`~/.claude/orquestracao/recados/F436-inspiracoes/`, imagens 6 a 10), e só segue o tema claro/escuro do Orca.
- **Plano de origem:** [`docs/planos/2026-11-06-aba-do-kit-no-orca.md`](../../planos/2026-11-06-aba-do-kit-no-orca.md). O que cada gesto grava, o contrato com o painel e o transporte vêm do plano. Esta revisão decide o que a aba mostra, onde, com que peso, em que estado e com que texto.
- **Escopo deste PR (Q1064):** a casca de navegação e as seções Perguntas, Decisões e Entregas. Agora (sessões, fila, parados), PRs, Custo, Manutenção e Histórico entram depois, cada uma com PR próprio, na casca que este PR deixa pronta.

<a id="limites"></a>
## O que o Orca deixa desenhar (catálogo 4, Orca 1.4.250)

- Sem CSS, cor livre, gradiente, fonte nem sombra. A cor só entra pelo `tone` (`neutral`, `accent`, `success`, `warning`, `danger`), em texto, selo, botão, faixa (`Callout`) e na borda ou na tinta do `Box`. Superfícies: `background` `none`/`muted`/`card` ou a tinta de um tom. Tipo: `Text size` `xs`/`sm`/`md`, `weight`, `muted`; `Heading` 1 a 3. Espaço: `none`/`xs`/`sm`/`md`/`lg`.
- Sem menu, diálogo, popover nem toast dentro da aba: confirmar e desfazer acontecem no lugar do gesto.
- `Tabs` desenha a aba escolhida; o `Tab` aceita ícone, mas o rótulo de texto é obrigatório (8 rótulos não cabem em 268 px); `ListItem` não aceita botão dentro; `Collapsible` não aceita botão no cabeçalho.
- O `Collapsible` recua o conteúdo em 24 px, põe 12 px entre os filhos e corta título e descrição em uma linha: dobra dentro de dobra não cabe, e o título da dobra é cortado no código.
- `RelativeTime` sai na língua do Orca (`5m ago`); a aba escreve `há 12 min` ela mesma.
- **O tema do Orca, medido no código:** `muted` e o `solid` neutro (que vira `secondary`) são a mesma cor nos dois temas (`#262626` no escuro, `#f5f5f5` no claro); `accent` é a tinta `primary`, quase branca no escuro e quase preta no claro — contraste, não cor. Por isso nada `solid neutral` fica sobre `muted`.
- Ícones só do conjunto do Orca (`bell`, `flag`, `package`, `refresh`, `check`, `edit`…).

Consequência para a direção: das inspirações vale o que o tema pode carregar — superfícies em camadas, borda fina, raio generoso, respiro, item ativo preenchido, trilho com ícone e contagem, ação no rodapé, foco luminoso (o do próprio Orca). O gradiente azul→violeta das imagens 6 e 7 não existe no catálogo; o papel dele (um único ponto de luz na ação principal) fica com o `tone="accent"` cheio — a tinta de maior contraste do tema —, usado em um botão por cartão e, como única exceção, na seção atual do trilho (imagem 9).

<a id="direcao"></a>
## Direção visual: "mesa de controle"

O operador abre a aba para despachar: responder quem está preso, carimbar o que as sessões decidiram, saber o que saiu. A aba é um instrumento, não uma página: escura ou clara conforme o Orca, quieta, com um único ponto de luz por cartão.

- **Assinatura — o trilho.** Uma coluna estreita à esquerda (imagem 10, versão recolhida): um ícone por seção, a seção atual preenchida em `accent` (imagem 9), a contagem em selo logo abaixo do ícone. É a única peça "de produto" da aba; o resto é disciplina.
- **Camadas.** Fundo da aba sem superfície; o trilho com borda fina, sem fundo; cada cartão em `card` com borda fina e raio `lg`; dentro do cartão, a recomendação em `muted` com borda `accent` — o "foco luminoso" das inspirações traduzido em contorno, não em cor livre. A tinta não encosta no botão cheio: o `accent` cheio e a borda `accent` virariam um bloco claro só (no escuro) ou escuro só (no claro).
- **Um acento só.** `accent` cheio aparece apenas no botão que aceita a recomendação, nos botões de envio de um campo que a pessoa abriu e na seção atual do trilho. O `accent` fora do botão é só contorno e o rótulo `Recomendação`. `warning` só para o que espera o operador (pergunta aberta). Todo o resto é neutro.
- **Tipo.** Título da seção em `Heading 2`; título de cartão em `Text sm semibold`; corpo em `Text sm`; metadado em `Text xs muted`. Nada em `md` fora do título: densidade de instrumento.
- **Texto longo.** O catálogo não corta em N linhas (o `Text` só tem `truncate`, de uma linha). Título de cartão e de decisão **quebra** (nunca `truncate`: é o que a pessoa lê para decidir). Corpo longo é cortado no código, na palavra, com `…`: caso de decisão em ~120 caracteres, mensagem do Orca em ~280; o texto inteiro mora na dobra do bloco.
- **Respiro.** `gap md` entre cartões, `padding md` dentro deles, `gap sm` entre os blocos do cartão. Linhas de lista (decisões, entregas) em `padding sm`, separadas por `gap xs`.

<a id="casca"></a>
## A casca

```
┌──┬────────────────────────────────────────┐
│🔔│ Perguntas            há 20 s  [↻]       │  cabeçalho: igual em toda seção
│(1)│ <explicação xs muted>   [ação em lote] │  barra de lote (só onde há lote)
│⚑ │ ┌────────────────────────────────────┐ │
│(77)│ cartão                              │ │
│📦│ └────────────────────────────────────┘ │
│(23)│                                        │
└──┴────────────────────────────────────────┘
 44 px · gap sm · o resto      (n) = Badge
```

- **Trilho:** (ao lado da barra de ícones do próprio Orca, que fica na borda direita da janela; conferir no render se dois trilhos lado a lado confundem — se sim, o trilho da aba ganha mais respiro do lado de fora) `Box` coluna, `width` 44, `border`, `radius="lg"`, `paddingY="sm"`, `gap="xs"`, `align="center"`, sem fundo. Para cada seção: `IconButton` (`solid accent` na seção atual, `ghost neutral` nas outras: o `solid neutral` some sobre o `muted` e é mais fraco que o hover do `ghost`) com `label` que diz a seção e a contagem por extenso (`Perguntas · 1 aberta`, vira a dica). Abaixo, um `Badge` com o número (como nas imagens 8 e 10): `tone="warning"` para perguntas abertas, `neutral` para os outros, nada quando é zero. O pé do trilho fica vazio: o reler mora ao lado do "há X", que é o que ele atualiza.
- **Seções desta entrega:** Perguntas (`bell`), Decisões (`flag`), Entregas (`package`). As próximas fatias acrescentam a sua linha numa lista única (`SECOES`): Agora (`activity`), PRs (`branch`), Custo (`gauge`), Manutenção (`wrench`), Histórico (`calendar`). Nenhuma aparece antes de existir — nada de ícone desabilitado com "em breve".
- **Conteúdo:** `Box` coluna, `grow`, `gap="md"`.
- **Cabeçalho, igual em toda seção:** `Row justify="between"`: à esquerda o `Heading 2` com o nome curto da seção; à direita `há 20 s` (`Text xs muted`; vira o aviso âmbar quando a releitura falha) e o `IconButton ghost refresh` `Reler agora`. Nada de ação em lote no cabeçalho.
- **Barra de lote, logo abaixo, só em Entregas:** `Row justify="between" align="center"`: à esquerda a explicação em `Text xs muted`; à direita a ação em lote. Entregas: `Últimos 7 dias. Limpar não apaga.` + `Limpar todas (23)`.
- **A seção escolhida fica guardada** (átomo `persist:'plugin'`). Na primeira abertura, e sempre que houver pergunta aberta ao abrir a aba, a aba começa em Perguntas.
- **Faixa da pergunta aberta:** fora da seção Perguntas, com pergunta aberta, logo abaixo do cabeçalho e acima da barra de lote, uma linha `Box border="warning" radius="md" padding="sm"`: `1 pergunta esperando você` + `Button ghost` `Ver`. É o que impede a pergunta de ficar escondida atrás da seção em que a pessoa parou ([D1](#d1)).
- **Largura:** referência 360 px, pior caso 320 px (sobram ~268 px de conteúdo). Botões de um cartão em `Row wrap`.

<a id="perguntas"></a>
## Perguntas

```
Perguntas                         há 20 s  [↻]
┌──────────────────────────────────────────────┐  card · borda · raio lg
│ F435 · Modo Orca: quem entrega a resposta    │  sm semibold
│ kit-de-orquestracao · espera há 12 min · Q1060│  xs muted
│ <caso>                                        │  sm
│ Se ninguém decidir: <seNaoDecidir>            │  sm muted
│ ┌──────────────────────────────────────────┐  │  muted · borda accent · raio md
│ │ RECOMENDAÇÃO                              │  │  xs semibold accent
│ │ <recomendação>                            │  │  sm
│ └──────────────────────────────────────────┘  │
│ [Aceitar a recomendação] [Responder outra…]   │  solid accent (sem ícone) · ghost
│ Vai para F435 · acorda a sessão               │  xs muted
└──────────────────────────────────────────────┘
```

- Um cartão por pergunta aberta, a que espera há mais tempo primeiro (a mais presa).
- O caso, o "se ninguém decidir" e a recomendação ficam sempre à vista: são as três partes que o operador pede em toda pergunta.
- `Responder outra coisa…` abre, no próprio cartão, um `Textarea` (`Sua resposta`, 4 linhas) com `Enviar resposta` (ou `Gravar resposta`, sem endereço) e `Cancelar`. O rascunho mora num átomo por id da pergunta e sobrevive à releitura.
- Abaixo das abertas, as respondidas por esta aba cuja entrega **falhou** ficam à vista com `Tentar entregar de novo`; as com entrega **pendente** (sem endereço) vão para um `Collapsible` fechado `Respondidas, entrega pendente · N`.
- Vazio: `EmptyState` `Nenhuma pergunta esperando você` (ícone `check`), sem ação.

<a id="decisoes"></a>
## Decisões

```
Decisões                          há 20 s  [↻]
Confirmar só grava; ninguém é acordado.                   Text xs muted, sob o cabeçalho
▾ F435 · Modo Orca             12 decisões · há 2 h · projeto  Collapsible (o 1º aberto)
  ┌──────────────────────────────────────┐       Box gap xs envolve as linhas do grupo
  │ Usei a pasta orca/ para o plugin      │       borda · sem fundo · raio md · padding sm · sm semibold (quebra)
  │ Decidiu: <recomendação, até ~120>…    │       xs
  │ Q1031 · há 2 h           [⤢] [✎] [✓] │       xs muted · IconButton ghost; ⤢ só se cortou
  └──────────────────────────────────────┘
  [Confirmar as 12 do F435]                      solid · neutral (o primário do grupo)
▸ F432 · Pane deduzido          6 · última há 5 h

[Confirmar todas (77)]                           ghost · pé da seção, depois do último grupo
```

- Agrupadas por item, cada grupo num `Collapsible`; o primeiro grupo começa aberto (assim o botão do grupo, o primário da seção, está à vista ao entrar). Descrição do grupo: `12 decisões · há 2 h` (o render real mostrou que o número sozinho não se lê), e o projeto no fim só quando a lista tem mais de um (o corte da dobra cai no que menos importa).
- Cada decisão é uma linha compacta, `Box border radius="md" padding="sm"`, sem fundo (o botão do grupo, `solid neutral`, teria a mesma cor de uma linha `muted`): título (quebra, com a largura toda), `Decidiu:` cortado em ~120 e o metadado. As linhas de um grupo ficam num `Box gap="xs"` dentro do `Collapsible`.
- Os gestos moram na linha do metadado, `Row justify="between"`: `Q1031 · há 2 h` à esquerda e, à direita, `IconButton ghost` `expand` (`Ler inteiro`, só quando houve corte; troca o texto cortado pelo inteiro, com o caso, no lugar, e vira `collapse` `Encolher`), `edit` (`Discordar…`) e `check` (`Confirmar: <título>`), o `check` sempre na ponta. Sem dobra dentro da dobra.
- O primário da seção é `Confirmar as N do F…`, no pé de cada grupo (`solid neutral`): é o gesto que a [D2](#d2) recomenda — ler o grupo e carimbá-lo. `Confirmar todas (77)` fica no pé da seção, `ghost`, depois do último grupo. Decisões não tem barra de lote: a explicação é uma linha `Text xs muted` sob o cabeçalho. Nenhum `accent` cheio em repouso: confirmar é barato e reversível.
- Título do grupo cortado no código em `F<n> · <tema até ~20 caracteres>…` (a dobra corta em uma linha; é a exceção à regra de quebra).
- `Discordar…` abre `Textarea` (`O que deve mudar`, 3 linhas) com `Enviar mudança`/`Gravar mudança` e `Cancelar`; a linha de destino aparece abaixo.
- `Confirmar todas` em dois toques ([D3](#d3)). Vazio: `EmptyState` `Nenhuma decisão para confirmar`, descrição `Quando uma sessão decidir algo sozinha e seguir, aparece aqui.`

<a id="entregas"></a>
## Entregas

```
Entregas                          há 20 s  [↻]
Últimos 7 dias. Limpar não apaga.   [Limpar todas (23)]   outline
Hoje · 4                                               Heading 3
┌────────────────────────────────────────────┐        card · raio lg
│ F432 · Pane deduzido                         │      sm semibold (quebra)
│ 14:05 · PR 168 · dona-f432                   │      xs muted
│ <resultado>                                  │      sm
│ Não medido: <naoMedido>                      │      sm (só quando há)
│ ▸ Detalhes                                   │      Collapsible: medido, próximos, mensagem do Orca
│ [Limpar]  [Responder…]                       │      ghost · ghost
└────────────────────────────────────────────┘
Ontem · 7
…
[Ver as limpas (12)]                                   ghost
```

- Agrupadas por dia (o título do grupo traz o dia; a linha, só a hora). Entrega do app e `worker_done` do Orca do mesmo item viram um cartão ([D8](#d8)).
- No máximo cinco blocos por cartão: título, metadado (hora · PR · sessão numa linha), resultado, `Não medido` (só quando não está vazio) e **uma** dobra `Detalhes` com o medido, os próximos e a mensagem inteira do Orca. Sem resultado (entrega só do Orca), o resultado é a mensagem do Orca cortada em ~280.
- `Limpar` some a linha na hora (vira `Limpa: <título>` + `Desfazer` por 10 s, sem mudar a altura); nada é apagado — `Ver as limpas` mostra.
- `Responder…` só aparece onde há rota ([D6](#d6)); abre `Textarea` (`O que você quer saber ou pedir`) com `Enviar a F432` / `Enviar à orquestradora` e `Cancelar`.
- Vazio: `Nenhuma entrega nos últimos 7 dias`; tudo limpo: `Nada novo para ver` + `Ver as limpas (23)`.

<a id="mensagens"></a>
## Mensagens (texto exato)

Lugar: *no bloco* é um `Text` com tom no fim do cartão ou da linha; *faixa* é um `Callout`, no máximo um por seção. O que está em curso fica neutro; o desfecho tem cor; o âmbar fica só para o que espera o operador. Erro cru (`input: Invalid input`, `no_active_sender_terminal`) nunca chega à tela: vai ao log do plugin; a tela diz o `<motivo>` curto em português que o worker devolve.

| Mensagem | Lugar | Tom |
|---|---|---|
| `há 20 s` / `Lendo…` | cabeçalho, ao lado do reler | neutro |
| `Não consegui reler há 4 min: <motivo>.` | no lugar do `há 20 s` | warning |
| `Não li o painel do kit: <motivo>.` + `Tentar de novo` | `Callout danger`, no lugar da seção | danger |
| `Vai para F435 · acorda a sessão` | abaixo dos botões que mandam algo | neutro |
| `Sem endereço no Orca: a resposta fica gravada e a sessão a vê no próximo turno dela.` | idem | neutro |
| `Gravando…` / `Entregando a F435…` + `Spinner` | no botão apertado / no lugar da linha de botões | neutro |
| Cartão compacto `Você respondeu: <resposta>` + `Badge success` `Entregue a F435` | no lugar do cartão | success |
| `Badge neutral` `Entrega pendente` | idem | neutro |
| `Badge danger` `A entrega falhou` + `Gravada, mas não chegou a F435: <motivo>.` + `Tentar entregar de novo` | idem | danger |
| `Não gravou: <motivo>. O que você escreveu continua no campo.` | fim do cartão | danger |
| `Não gravou: a pergunta mudou depois que a aba a leu. Ela foi relida acima; confira antes de responder de novo.` | fim do cartão (a aba relê sozinha) | danger |
| `Já foi respondida fora desta aba.` | cartão compacto | neutro |
| `Inclui as que você não abriu.` | ao lado do segundo toque do `Confirmar todas` | neutro |
| `77 decisões confirmadas.` + `Desfazer` | no lugar do botão | success |
| `70 confirmadas. 7 mudaram depois da leitura e continuam na lista.` | idem | warning |
| `Confirmada: <título>` + `Desfazer` | no lugar da linha | success |
| `Limpa: <título>` + `Desfazer` | no lugar da linha | neutro |
| `A sessão do F432 já fechou: vai para a orquestradora · acorda a orquestradora` | abaixo do campo | neutro |
| `Enviado a F432.` / `Não chegou: <motivo>. O que você escreveu continua no campo.` | fim da linha | success / danger |
| `Faltam as entregas do Orca: <motivo>. As do app estão abaixo.` + `Tentar de novo` | `Callout warning`, topo de Entregas | warning |

<a id="botoes"></a>
## Botões

| Onde | Rótulo | Variante · tom · ícone |
|---|---|---|
| Trilho | `Perguntas · N abertas` / `Decisões · N a confirmar` / `Entregas · N novas` (IconButton) | `solid accent` na atual, `ghost neutral` nas outras |
| Cabeçalho | `Reler agora` (IconButton) | `ghost` · `refresh` |
| Faixa | `Ver` | `ghost` |
| Pergunta | `Aceitar a recomendação` | `solid` · `accent` · sem ícone |
| Pergunta | `Responder outra coisa…` | `ghost` · `edit` |
| Campo aberto | `Enviar resposta` / `Gravar resposta` · `Cancelar` | `solid accent` · `ghost` |
| Pergunta, entrega falhou | `Tentar entregar de novo` | `outline` |
| Decisões, pé da seção | `Confirmar todas (77)` (dica `Só grava. Nenhuma sessão é acordada.`) | `ghost` |
| Armado | `Cancelar` · `Confirmar as 77 agora` (com uma: `Confirmar agora`) | `ghost` · `solid accent` |
| Decisão (linha do metadado) | `Ler inteiro`/`Encolher` · `Discordar…` · `Confirmar: <título>` (IconButton) | `ghost` `expand`/`collapse` · `ghost` `edit` · `ghost` `check` |
| Grupo | `Confirmar as 12 do F435` (com uma: `Confirmar a decisão do F435`) | `solid` · `neutral` |
| Entregas, barra de lote | `Limpar todas (23)` (dica `Somem desta lista. Nada é apagado.`) | `outline` |
| Entrega | `Limpar` · `Responder…` | `ghost` (sem ícone) · `ghost` |
| Campo da entrega | `Enviar a F432` / `Enviar à orquestradora` · `Cancelar` | `solid accent` · `ghost` |
| Depois de confirmar ou limpar | `Desfazer` | `ghost` |
| Entregas, pé | `Ver as limpas (12)` / `Esconder as limpas` | `ghost` |

O gesto da linha é `ghost` nas duas listas. O lote é diferente de propósito: `Limpar todas` é barato (só esconde, tem `Desfazer`) e fica `outline` na barra do topo; `Confirmar todas` grava no painel que todos leem, então desce ao pé, `ghost`, em dois toques, e o primário de Decisões é o botão de cada grupo. O ícone `check` só significa confirmar no painel; o `Aceitar a recomendação` não leva ícone. O verbo diz o que acontece: `Enviar` quando a mensagem sai para alguém, `Gravar` quando só fica no painel. Reticências só nos botões que abrem um campo sem mandar nada ([D7](#d7)).

<a id="estados"></a>
## Estados

"Feito nesta visita" fica no lugar, compacto, até a pessoa reler ou sair da aba; a releitura automática (30 s com a aba visível) não tira essas linhas nem as move.

| Seção | Carregando | Vazio | Andando | Sucesso | Erro | Recusa |
|---|---|---|---|---|---|---|
| Casca | trilho sem números, `Lendo…` | — | — | `há X` + reler | 1ª leitura: `Callout danger` no lugar da seção; releitura: aviso âmbar no topo, com o último dado bom | — |
| Perguntas | `Skeleton block` da altura de um cartão | `EmptyState` | `Gravando…`, depois `Entregando…`; o número do trilho desconta no clique | compacto `Entregue a …` | o cartão volta com o rascunho e o motivo; o número volta | versão mudou: relê e mantém o rascunho; respondida fora: compacto |
| Decisões | 5 linhas de `Skeleton` | `EmptyState` | `Gravando…` / `Confirmando 77…`; linha vira compacta na hora | `Confirmada` + `Desfazer` 10 s | linhas voltam com o motivo | parcial: as que mudaram voltam relidas |
| Entregas | 3 blocos de `Skeleton` | dois vazios (nada / tudo limpo) | `Limpar` vira `Limpa:` na hora; `Enviando…` | `Desfazer` / `Enviado a …` | linha volta / campo fica aberto | destino mudou (sessão fechou): recalcula, mostra o novo destino e **não envia sozinho** |

Sem permissão (o Orca negou uma capacidade): `Callout danger` `Falta uma permissão` na seção afetada, dizendo qual (gravar no painel, entregar mensagens, guardar o que você limpou); os botões que dependem dela não são desenhados.

<a id="d3-detalhe"></a>
### `Confirmar todas` em dois toques
1. Repouso: `Confirmar todas (77)`, `ghost`, no pé da seção.
2. Primeiro toque: no mesmo lugar, `Cancelar` (`ghost`, debaixo do ponteiro) e à direita `Confirmar as 77 agora` (`solid accent`), com `Inclui as que você não abriu.` abaixo. A confirmação ignora toque nos primeiros 500 ms.
3. Desarma em 8 s, com qualquer outro gesto, ou se a releitura mudar a lista.
4. Segundo toque: `Confirmando 77…`, depois o desfecho com `Desfazer` por 10 s.

## Movimento
Nenhum que o plugin controle: o catálogo não tem duração nem curva; o Orca anima a dobra e respeita `prefers-reduced-motion`. A regra da aba é **nada se move sozinho**: não troca de seção com a aba aberta, não rola até a pergunta nova (a faixa e o número do trilho avisam), a linha em que se agiu fica no lugar, o botão armado aparece onde estava o primeiro.

## O que sai (da prova F434)
O campo `Run da orquestradora`, o `KeyValue` de diagnóstico, a pergunta dentro de dobra, o `orca_session_id` como descrição, o `Textarea` sempre aberto, a frase `No chat: "Qn …"`, o desfecho técnico (`painel: x · orquestradora: y`), o ícone `activity` no reler, o id da Run nas entregas.

<a id="decisoes-ao-operador"></a>
## Decisões (todas *assumidas, a confirmar*)

<a id="d1"></a>
- **D1 · Trilho de seções, com faixa da pergunta aberta.**
  - *O caso:* o operador pediu abas e elegância; são 3 seções agora e 8 depois. Abas de texto (`Tabs`) não cabem 8 em 360 px, e uma pergunta nova ficaria escondida atrás da seção em que a pessoa parou.
  - *Se não decidir:* trilho de ícones à esquerda com a contagem sob cada ícone, mais a faixa `1 pergunta esperando você · Ver` no topo de qualquer outra seção; a aba abre em Perguntas quando há pergunta aberta.
  - *Recomendação:* essa. O trilho cresce até as 8 seções sem quebrar a largura, é a imagem 10 recolhida que o operador mandou, e a faixa resolve o único risco das abas (a pergunta presa ficar fora da vista). Alternativa: `Tabs` com 3 rótulos agora — mais simples, mas teria de virar outra coisa na fatia seguinte.
<a id="d2"></a>
- **D2 · Decisões agrupadas por item**, com `Confirmar as N do F…` no pé do grupo. Recomendação: por item, que é o assunto; confirmar o grupo depois de lê-lo torna o `Confirmar todas` quase desnecessário.
<a id="d3"></a>
- **D3 · `Confirmar todas` em dois toques no lugar** (sem diálogo no catálogo); `Limpar todas` é um toque com `Desfazer`, porque só grava no armazenamento da aba, enquanto confirmar grava no painel que todos leem.
<a id="d4"></a>
- **D4 · Linha de destino** abaixo de todo formulário que manda algo (`Vai para F435 · acorda a sessão`); o `Confirmar` só ganha a dica `Só grava. Nenhuma sessão é acordada.` Separa o gesto caro do barato sem número de custo na tela.
<a id="d5"></a>
- **D5 · Barra de status:** `Kit: 1 pergunta` em âmbar quando há pergunta aberta; senão `Kit: 77 a confirmar` neutro; tudo zerado, `Kit: em dia`. A dica traz os dois números. O âmbar fica só com o que prende uma sessão.
<a id="d6"></a>
- **D6 · `Responder…` só onde há rota.** Entrega do app do Claude sem Run do mesmo projeto no Orca não tem para onde ir; o botão não aparece. A rota que falta (gravar uma pergunta para a orquestradora do app) fica para a fatia 9 da F435.
<a id="d7"></a>
- **D7 · Reticências** só em `Responder outra coisa…`, `Discordar…` e `Responder…` (abrem campo, não mandam nada) e nos andamentos. Sem elas, o botão parece mandar na hora — e acordar uma sessão por engano é o gesto caro.
<a id="d8"></a>
- **D8 · Entrega do app e `worker_done` do mesmo item viram um cartão**, casados pelo número do item no início do assunto; sem casar, cada um tem a sua linha.

## Peças do catálogo por região
- Casca: `Box` (row; trilho em coluna com borda), `IconButton`, `Badge`, `Text`, `Heading`, `Callout`.
- Perguntas: `Box` (cartão `card`, recomendação `muted` com borda `accent`), `Text`, `Button`, `Textarea`, `Badge`, `Spinner`, `Collapsible`, `EmptyState`, `Skeleton`.
- Decisões: `Collapsible`, `Box border`, `IconButton`, `Button`, `Textarea`, `Text`, `EmptyState`, `Skeleton`.
- Entregas: `Heading 3`, `Box card`, `Collapsible`, `Link` (PR), `Button`, `Textarea`, `EmptyState`, `Skeleton`, `Callout`.
