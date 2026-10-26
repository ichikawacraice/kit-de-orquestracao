# Revisão de arquitetura — o pane diz o que é cada item citado pelo número (F43, parte A)

- **Data:** 2026-10-26
- **Autora:** D1, designer do pool
- **Estado:** em crítica (§12)
- **Mock:** [`2026-10-26-item-citado-pelo-numero-mock.html`](2026-10-26-item-citado-pelo-numero-mock.html), estático, claro e escuro, colunas de 380 e 300 px e o terminal
- **Plano de origem:** [`docs/planos/2026-10-25-item-citado-pelo-numero.md`](../planos/2026-10-25-item-citado-pelo-numero.md), decisão (a). A parte B (a regra de texto no `painel.mjs`) é de outra executora e não entra aqui.
- **Base:** [`2026-10-25-painel-redesenho.md`](2026-10-25-painel-redesenho.md) (F34). Tudo o que esta revisão não cita continua como lá: seções, cartões, cores, botões, a moldura `Box round`.
- **Fontes lidas:** `plugins/painel-sessoes/hooks/desenho.ts` (713 linhas), `hooks/register.tsx` (1045), `types/index.d.ts`; a fila real (`painel list fila --todos`, 44 itens em 26/10: F1–F45 sem o F19).
- **Pedido do operador:** *"a orquestradora lá do Izanagi fala de F13, mas eu não sei qual é a F13 … o painel não me informa quem é F13"*.

---

## Tarefa

> **Quem lê "F13" numa mensagem ou no próprio pane descobre, sem sair do pane, o que é o F13: o título, o tema e a etapa.**

Três caminhos, do mais barato ao mais caro para o operador:

| De onde vem o número | Como o pane responde | Gesto |
|---|---|---|
| De um cartão ou linha do pane | o número **ao lado do tema**, no próprio bloco | nenhum: está escrito |
| De um texto dentro do pane (`agora`, trava, espera, `depois`, resumo, pergunta) | a linha **"Citados"** sob o bloco, com o título de cada número | nenhum |
| De fora do pane (mensagem da orquestradora, relatório) | **"Todos os itens · N"** no rodapé, agrupado por tema, com um campo **Achar** | abrir a lista; digitar `13` |

## Quem e onde

- O operador, no pane lateral do desktop, entre **300 e 420 px**; o caso difícil é 300 px (W = 292; dentro do cartão, Wc = W − 32 = 260).
- O terminal ganha o mesmo número, a mesma linha "Citados" e o mesmo botão (§8).
- A lista "Todos os itens" é rara (quando aparece um número que o pane não mostra); o número no cartão é lido em toda olhada.

## Inventário

| O quê | Onde está hoje | Decisão que gera | Frequência | Veredito |
|---|---|---|---|---|
| Número do item (`item.id`) | **em lugar nenhum** — só `key` do React | ligar a mensagem ao cartão | toda olhada | **novo:** na linha "sobre" de todo cartão, linha da fila e feito, antes do tema: `F13 · EDITOR` (§1) |
| Tema | linha "sobre", `m` 11/600 caixa alta | — | toda olhada | fica, depois do número |
| Número solto em texto (`agora`, trava, espera, `depois`, resumo, título) | o texto, cru | saber o que é | quando há (23 de 223 perguntas; `sessoes.etapa`) | **novo:** linha "Citados" sob o bloco (§2) |
| `depois[].item` | **descartado na leitura** (`register.tsx:174` só guarda `texto`) | saber o que vem depois | raro (2 de 44) | **muda:** a leitura guarda o `item`, e o número entra em "Citados" em primeiro lugar (§3) |
| Rótulo da pergunta (`<tema> · <título do item>`) | linha da pílula do Q-ID | saber de que item é | quando há | **muda:** ganha o número: `F34 · Kit · o painel das sessões…` (§5) |
| Itens feitos há mais de 24 h e descartados | **não chegam ao pane** (`register.tsx:148`, `continue`) | achar um número antigo | rara | **novo:** um **índice leve** de todos os itens (§6), lido na mesma leitura |
| Rodapé: Feitos hoje, Perguntas respondidas | dois `Button secondary` | conferir | rara | fica, e ganha **"▸ Todos os itens · N" em primeiro** (§4) |

## Hierarquia e peso

- **Nada novo sobe de peso.** O número é um identificador, não um aviso: 11/700 com algarismos tabulares, classe `s` (o cinza do texto secundário que já existe), enquanto o tema segue `m` 11/600. É um grau acima do tema, para o olho achar "F13" ao varrer, e abaixo do título 15/600.
- **"Citados" é a última linha do bloco**, depois de `depois`, em 12 px: o operador só a lê quando o texto acima citou um número que ele não reconhece.
- **"Todos os itens" fica no rodapé**, fechado. Aberto, empurra o resto para baixo, como "Feitos hoje" já faz.
- **A ação primária do pane não muda:** responder a pergunta. Os botões desta revisão são `secondary`.

### Textos que cabem a 300 px (medidos com o `em()` do `desenho.ts`)

| Texto | Tamanho | Largura |
|---|---|---|
| `F13 · ` antes do tema | 11 | 34 px (`F100 · ` = 41 px) |
| `F13 · ORQUESTRAÇÃO` (o tema mais largo) | 11 | 118 px, mais o tempo à direita (~70 px) = 188 < 260 |
| rótulo `Citados` + espaço | 12 | 52 px de coluna; sobram 208 px para `F13 · título` a 260 |
| `▸ Todos os itens · 45` + `▸ Feitos hoje · 20` | 12,5 | 127 + 107 + 2 × 20 de respiro + 8 de vão = 282 < 292: os dois na mesma linha; "Perguntas respondidas" quebra para a segunda, como hoje |
| linha da lista: número 40 px + etapa (`feito` 27 px, `planejamento` 70 px) | 12,5 / 11,5 | o título leva o resto: 215 px num feito, 172 px num item em planejamento |

## 1. O número no bloco

- **Onde:** na linha "sobre" de `cartaoSvg` (Executando, Travados, Esperam você, Feitos hoje) e de `filaSvg` (Na fila): `F13` em `s` 11/700 tabular, ` · ` em `m`, depois o tema como hoje.
- **Nunca é cortado.** O corte com reticências (`caber`) passa a valer só para o tema: `caber(upper(tema), 11, W − tempoW − largura('F13 · '))`.
- **O `alt` do bloco começa pelo número:** `F13 · Editor — <título> — …`. É por ele que o teste acha o número de cada item, e é o que o leitor de tela lê primeiro.
- **Sem cor nova e sem pílula.** Uma pílula por cartão disputaria com os chips de etapa e PR, que já são pílulas; o número é texto, no lugar onde o olho já procura o tema.

## 2. A linha "Citados"

**A forma (D-a2 do plano, confirmada pelo desenho):** legenda sob o bloco, e não o título expandido no meio do texto. Motivo medido: o `agora` já é cortado em 2 linhas a 260 px; expandir "F13" para "F13 · SPEC-155 fatia 2 (o container) e fatia 5…" no meio da frase empurra a outra metade para fora do corte.

| Parte | Desenho |
|---|---|
| rótulo | `Citado` (1 número) ou `Citados` (2 ou mais), `m` 12/600, numa coluna de 52 px à esquerda (rótulo pendurado, como uma lista de definição) |
| cada número | uma linha: `F13` em `s` 12/700 tabular, ` · `, o título em `m` 12, cortado com `caber` na largura que sobra |
| número que não existe | `F19 · fora da fila`, o "fora da fila" em `m` itálico. **Não é erro**, é um número que a fila não tem (apagado, ou de outro sistema) |
| até 3 números | uma linha por número, todas com título |
| 4 ou mais | as 2 primeiras com título e uma terceira `também F7, F9, F21` (só os números, cortados com `caber`): o operador ainda os acha na lista "Todos os itens" |

**Que textos entram, em que ordem:**
1. o `depois[].item` (§3), que é uma ligação gravada e vem primeiro;
2. os números achados **nos textos que o bloco desenha**, na ordem em que aparecem: no cartão, título → trava → espera → `agora` → `depois[].texto`; na linha da fila, título → resumo. Um número citado num campo que o bloco não mostra não entra: a legenda explica o que está à vista.

**O que não entra:**
- o número do próprio item;
- número repetido (fica a primeira menção);
- número já escrito na forma da regra B, **seguido de ` · `** (`F13 · SPEC-155…`): quem escreveu já disse o que é. É a mesma expressão da parte B (`\bF\d+\b` não seguido de ` · `), e um teste compara as duas (§10).

**Onde mora no código:** uma função pura nova em `register.tsx`, ao lado de `contarSecoes`: `citadosDe(textos: string[], ligados: string[], proprio: string, indice: Map<string, ItemDoIndice>) → Citado[]`, com `Citado = { id: string; titulo?: string; ligado: boolean }` (`titulo` ausente = fora da fila). O `cartaoSvg` e o `filaSvg` recebem a lista pronta em `opcoes.citados` e só desenham. Assim a regra se testa sem SVG, e o terminal usa a mesma lista.

## 3. `depois` com item ligado

- A leitura passa a guardar `depois: Array<{ texto: string; item?: string }>` em vez de `string[]`.
- A linha `depois:` continua **como hoje**: o texto, em 1 linha, com `(+N)`.
- O `item` ligado entra em "Citados" **em primeiro**, com o título do item. *Desvio do plano, assumido:* o plano punha `F22 · <título>` na própria linha `depois`; isso apaga o texto gravado (F7: *"sobras deste item"* → F3) e dobra a linha a 300 px. Com a ligação na legenda, os dois aparecem e só existe um lugar onde o número vira título.

## 4. "Todos os itens"

### O botão
- `▸ Todos os itens · N`, `Button secondary`, **o primeiro do rodapé**: é o único que existe sempre que a fila tem item, e, primeiro, não muda de lugar quando "Feitos hoje" some.
- `N` = itens do índice (§6), todos os projetos, todas as etapas. Com o índice vazio, o botão não aparece.
- Aberto: `▾ Todos os itens · N`, como os outros dois.

### O campo Achar (quando o motor tem `Input`)
- Logo abaixo do rodapé, antes da lista: `Input` com o rótulo de envio **"Achar"** e o texto de ajuda *"número (13 ou F13) ou palavra"*. O motor só avisa no envio (`onSubmit`), então o filtro vale depois do Enter.
- **Número** (`^F?\d+$`, sem caixa): mostra só o item de número exato.
- **Palavra:** o título contém o texto, sem caixa e sem acento.
- Com filtro, uma linha `m` 12 antes da lista: `1 de 44 · “13”`, e o botão `secondary` **"Limpar"** ao lado do campo.
- Sem resultado: `Nenhum item com “99”.` em `m` 12,5, sem lista.
- Sem `Input` no motor: não há campo; a lista vem inteira.
- *Assumido, a confirmar:* o plano não pediu o campo. Ele está aqui porque a lista é agrupada por tema e quem chega com "F13" procura pelo número: sem o campo, a busca é varrer 44 linhas em 8 grupos.

### A lista (`todosSvg`, um `Svg` por tema)
- **Grupos na ordem de `temas.json`, como `porTema`**, "Sem tema" no fim.
- **Cabeçalho do grupo:** o rótulo do tema em `m` 11/600 caixa alta e, **à direita, o projeto** em `m` 11 (`izanagi`, `kit-de-orquestracao`, cortado com `caber`) sempre que a lista tem mais de um projeto. O plano previa `Tema · projeto` só quando o rótulo repete; aqui o projeto aparece sempre que há dois, porque quem chega com um número da orquestradora do Izanagi quer conferir que é do Izanagi. Quando o rótulo repete, a regra de `porTema` continua valendo.
- **Uma linha por item, 22 px:** número em `s` 12,5/700 tabular numa coluna de 40 px; título em `t` 12,5, cortado; etapa à direita em 11,5, na cor de `COR_ETAPA` para item vivo e `m` para feito e descartado.
- **Item fechado (feito, descartado):** número, título e etapa em `m`. Não se risca: riscado se lê como "cancelado", e feito não é cancelado.
- **Ordem dentro do tema:** os vivos primeiro, depois os feitos, depois os descartados; em cada bloco, do número maior para o menor (o mais recente no topo).
- Filete `ln` entre os grupos; nenhum entre as linhas.
- **`alt` de cada grupo:** `Editor · izanagi: F13 · SPEC-155… · execução; F26 · … · feito; …`.
- Linha sem clique (o `Svg` não tem clique). Para agir sobre um item vivo, o operador o acha na seção dele, que já tem o botão "Abrir".

## 5. A pergunta

- O rótulo da pílula do Q-ID passa a começar pelo número do item, quando a pergunta tem `item`: `Q238 · F34 · Kit · o painel das sessões ganha cara…` (o `rotulo` monta-se como `${item} · ${tema} · ${título}`).
- **"Citados"** entra como última linha do cartão, dentro do tingido âmbar, para números soltos no título, caso, "se não decidir" e recomendação, com o mesmo desenho do §2 (a 16 px da borda, como o texto do cartão). Com a parte B, pergunta nova não terá número solto; a linha serve às 23 antigas.
- Perguntas respondidas (`anteriorSvg`) ficam como estão: estão fora do pedido e já se fecharam.

## 6. Os dados: o índice

O pane hoje joga fora, na leitura, todo item fechado há mais de 24 h. "Citados" e "Todos os itens" precisam deles.

- A leitura monta **`indice: ItemDoIndice[]`** com **todos** os documentos da coleção `fila`, antes do `continue` dos feitos antigos: `{ id, titulo, tema, temaProjeto, temaRotulo, etapa, projeto }`. Mesma regra de tema de hoje; item fora do contrato vai para "Sem tema".
- O índice mora em `Leitura` (contrato em `types/index.d.ts`) e vem da **mesma** chamada que já lê a fila: nenhuma leitura nova.
- Os números são únicos na coleção (contador único para todos os projetos: F42 Izanagi, F43 kit). A resolução é por `id`, sem projeto.
- Peso: 44 itens × ~150 bytes. O `Svg` da lista é um por tema, e cada um fica muito abaixo do limite de 131 072 caracteres.

## Mensagens

| Mensagem | Lugar | Duração | Tom | Quem vê |
|---|---|---|---|---|
| `F13 · EDITOR` | linha "sobre" do bloco | sempre | neutro | operador |
| `Citados  F13 · SPEC-155 fatia 2…` | última linha do bloco | enquanto o texto citar | neutro | operador |
| `F19 · fora da fila` | dentro de "Citados" | idem | neutro (não é erro) | operador |
| `também F7, F9, F21` | 3ª linha de "Citados", com 4 números ou mais | idem | neutro | operador |
| `1 de 44 · “13”` | antes da lista filtrada | enquanto houver filtro | neutro | operador |
| `Nenhum item com “99”.` | no lugar da lista | idem | neutro | operador |

## Regiões e componentes

| Região | Monta com | Novo? |
|---|---|---|
| Linha "sobre" com número | `cartaoSvg` / `filaSvg` | muda |
| Linha "Citados" | uma função interna `citadosSvg(x0, y0, larguraLinha, citados)` em `desenho.ts`, usada pelo cartão, pela fila e pela pergunta, que devolve `{ partes, altura }` como `chipsSvg` | **sim** |
| Regra de quem é citado | `citadosDe` em `register.tsx` (pura) | **sim** |
| Índice | a leitura em `register.tsx` + tipo `ItemDoIndice` | **sim** |
| Botão "Todos os itens" | `Button secondary`, átomo novo `verTodos: boolean` | **sim** |
| Campo Achar | `Input` (`submitLabel="Achar"`) + `Button secondary` "Limpar"; átomo novo `filtroTodos: string` | **sim** |
| Lista | `todosSvg(W, grupo, { comProjeto })`, um `Svg` por tema, com `key` `todos:<projeto>:<tema>` | **sim** |
| Rótulo da pergunta | onde `rotulo` é montado na leitura das perguntas | muda |

## Estados

| Estado | O que se vê | Mock |
|---|---|---|
| Cartão com número | `F43 · PAINEL` na linha "sobre", em todas as seções e nos feitos | 1, 3 |
| "Citado" com 1 número | o cartão do F44 cita "a F43" no `agora` | 1 |
| "Citados" com 3 números | o F13 cita F12, F2 e F25 no `agora` | 1 |
| "Citados" com 4 ou mais | 2 com título + `também …` | 3 |
| Número fora da fila | a trava do F44 cita o F19, que não existe: `F19 · fora da fila` | 1 |
| `depois` com item | a ligação entra em "Citados" em primeiro | 3 |
| Pergunta com item e com número solto | `Q260 · F42 · Prévia VTEX · …` e "Citado" dentro do tingido | 1 |
| Todos os itens, fechado | o primeiro botão do rodapé | 1 |
| Todos os itens, aberto, 2 projetos | 8 grupos, projeto à direita do tema, vivos antes dos feitos | 2 |
| Filtro com resultado | `1 de 44 · “13”` e o grupo Editor só com o F13 | 3 |
| Filtro sem resultado | `Nenhum item com “99”.` | 3 |
| 300 px | colunas 3 | 3 |
| Claro / escuro | os botões no topo do mock | todos |
| Terminal | número no começo da linha, "Citados", lista em texto | 4 |
| Índice vazio | sem o botão "Todos os itens" | — |
| Erro de leitura | o índice da última leitura boa continua: a lista e "Citados" não piscam vazios | — |

## Movimento

Nenhum. Abrir a lista e filtrar trocam o conteúdo sem animação, como "Feitos hoje".

## 8. O terminal

- A 1ª linha do item vira `F13 · <título>` (`Text wrap="truncate-end"`): o número fica sempre visível porque o corte é no fim.
- "Citados" é uma `Text dimColor wrap="wrap"` sob o item: `Citados: F12 · login da Wake vencido…; F2 · motor: Q173…; F25 · teste instável…`.
- O rodapé ganha `▸ Todos os itens · N` em primeiro; aberto, o `Input` Achar (quando houver) e, por tema, um `Text bold` com `Editor · izanagi` e uma `Text wrap="truncate-end"` por item: `F13  SPEC-155 fatia 2 …  · execução`, os fechados com `dimColor`.

## O que sai

- A afirmação falsa de que o pane mostra o número (é da parte B: `protocolo.md:26`, `painel.mjs:235`). Depois desta parte, ela vira verdade.
- O descarte de `depois[].item` na leitura.

## Decisões

**Assumidas, a confirmar** (reversíveis, a execução segue com elas):
- **D-a2 (do plano):** legenda "Citados", e não o título no meio do texto. Mantida, com a medida do §2.
- **D1-1:** o `depois[].item` vai para "Citados" em primeiro, e a linha `depois` guarda o texto (§3). Se não decidir: fica assim. Recomendo assim: não se perde o texto gravado e a linha não dobra.
- **D1-2:** campo **Achar** na lista (§4). Se não decidir: fica, quando o motor tiver `Input`. Recomendo: fica; custa um átomo e um filtro puro, e é o caminho de quem chega com o número de fora.
- **D1-3:** o projeto à direita do cabeçalho do tema sempre que a lista tem dois projetos (§4).
- **D1-4:** o número em `s` 11/700 (um grau acima do tema em `m`), e não no mesmo tom do tema como o plano dizia. Motivo: no mesmo tom, `F13 · EDITOR` vira uma mancha só e o número não se acha de relance.

**Gotchas para a E:**
- **`\bF\d+\b` pega "F5" tecla.** Se F5 existir na fila, "aperte F5" vira `F5 · Travas por hook…`. Aceito: a parte B pede que tecla se escreva por extenso.
- **`sessoes.etapa`** também cita número solto, mas não aparece no pane (F27). Fora daqui.
- **Os testes de hoje** procuram o `alt` começando pelo tema (`${i.temaRotulo} — …`). Eles mudam junto.
- **O `Input` do motor não diz se é controlado.** Se o texto ficar no campo depois de "Limpar", troque a `key` do `Input` a cada limpeza (um contador no átomo) para ele nascer vazio.
- **`depois` muda de tipo.** Todo uso de `i.depois[0]` (cartão, terminal, testes) passa a ler `.texto`.

## 10. Para a E (parte A)

Arquivos: `plugins/painel-sessoes/hooks/desenho.ts`, `hooks/register.tsx`, `types/index.d.ts`, `tests/painel.test.tsx`, `tests/fixtura-fila.ts`.

Testes (antes do código, com a fixtura de 44 itens tirada da fila real, sem dado sensível):
1. A fixtura não está vazia; **todo** cartão, linha de fila e feito traz `F<n>` no começo do `alt`, e o número aparece no `source` do SVG.
2. `citadosDe`: 1 número; 3 números; 4 → 2 + "também"; repetido; o próprio; `F13 · …` já resolvido (não entra); número inexistente (sem `titulo`); `depois[].item` primeiro.
3. **Concordância com a parte B:** a regex de `citadosDe` e a da recusa do `painel.mjs` classificam a mesma lista de frases do mesmo jeito (quando a B estiver na branch; antes disso, o teste compara com o exemplo do protocolo).
4. A leitura guarda o índice com feito antigo e descartado; os itens visíveis continuam só com os feitos de 24 h.
5. "Todos os itens · N" com N = tamanho do índice; aberto, os grupos na ordem de `temas.json`, vivos antes dos feitos, número decrescente; projeto no cabeçalho com dois projetos e sem ele com um.
6. Filtro: `13`, `F13`, `f13` → só o F13; palavra sem acento acha título com acento; `99` → "Nenhum item com “99”."
7. Pergunta com `item`: o rótulo começa pelo número.
8. Terminal: a 1ª linha do item começa por `F<n> · `.
9. `claude plugin test plugins/painel-sessoes` verde.

**Gestos que a V audita no app** (`auditoria-de-clique`): abrir e fechar "Todos os itens"; Achar com número, com palavra e sem resultado; Limpar; a lista aberta não some na releitura de 60 s; a 300 px, o rodapé quebra em duas linhas sem cortar botão.

## 12. Crítica

*(preenchida depois da rodada)*
