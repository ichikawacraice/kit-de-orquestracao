# Adendo F76 — o topo da Na fila com o pedido aberto

- **Data:** 2026-10-26
- **Autora:** D1, designer do pool
- **Estado:** **aprovada com ressalvas** — crítica 1 em 25/30, sem ressalva alta (§Crítica)
- **Revisão de origem:** [`2026-10-26-pedir-sessao-pela-fila.md`](2026-10-26-pedir-sessao-pela-fila.md), §Regiões, "O topo da Na fila". O que este adendo não cita continua como lá.
- **Mock:** [`2026-10-26-pedir-sessao-pela-fila-adendo-f76-mock.html`](2026-10-26-pedir-sessao-pela-fila-adendo-f76-mock.html), a 300 px, claro e escuro, com a coluna "Antes" para comparar.
- **Plano que o aplica:** F76, pontos C e E (`~/.claude/orquestracao/pool/handoffs/F76-plano.md`, seção "Layout").
- **Fontes lidas:** a revisão de origem e o mock dela; `plugins/painel-sessoes/hooks/register.tsx` em `1d846ab` (`botaoOrquestradora`, `topoDaFila`, o topo do desktop ~1853 e o do terminal ~2046, `linhaDaFila` ~1755, `linhaItem` ~1908); `hooks/desenho.ts` (`secaoSvg`: título em x = 14; `X_FILA = 22`); o laudo da crítica 24/30 (ressalvas P3 e P5).

## Escopo

Duas ressalvas da crítica, só no topo da Na fila (desktop e terminal):

- **P3 (média):** com dois projetos em "Pedido", os botões "Abrir a orquestradora de X" ficam numa fileira e as frases "N cartões esperam você na conversa da orquestradora de X" vêm depois, longe do botão de cada uma. O topo junta até 5 textos em âmbar.
- **P5 (baixa):** as frases e os avisos do topo começam sem recuo; o mock pedia 13 px.

Fora: a cor da frase (fica `warning`, decisão do operador, *assumida, a confirmar*), o texto da frase e dos avisos, a linha da fila, o cartão em Executando e qualquer outra região.

## O que estava errado, medido

No mock, a 300 px (área útil de 274 px), coluna "Antes":

- a fileira de cima junta três destinos: "Pedir 2 sessões" (114 px), "Abrir a orquestradora de izanagi" (210 px) e "Abrir a orquestradora de kit-de-orquestracao", que **não cabe numa linha** (274 px, 39 px de altura: quebrou em duas);
- as duas frases vêm depois de todos os botões. A frase de izanagi fica a ~80 px do botão de izanagi, com o botão de kit no meio;
- tudo começa em x = 0, à esquerda do título da seção (x = 13) e da coluna da linha (x = 26).

## Decisão

### 1. Um grupo por projeto em "Pedido": a frase em cima, o botão logo embaixo

Cada projeto com item da Na fila em "Pedido" vira **um grupo**: `Box flexDirection="column"` sem `gap`, com:

1. a frase, `Text color="warning" wrap="wrap"`, texto de hoje: "N cartões esperam você na conversa da orquestradora de <projeto>";
2. logo embaixo, `Box flexDirection="row" alignItems="center"` com o `botaoOrquestradora` daquele projeto.

**Por que a frase em cima:** é a regra que o pane já segue nas duas outras regiões desta revisão. Na linha da fila e no cartão em Executando, o texto de estado vai numa linha própria **acima** da fileira do botão (R3 da recrítica 2). O topo passa a ler do mesmo jeito: primeiro o que espera, depois o gesto que resolve.

**Por que sem `gap` dentro do grupo:** a separação entre grupos é o `gap={1}` (~9 px) que o topo já tem entre os filhos. Dentro do grupo, frase e botão ficam colados (2 px no mock). A diferença entre 2 px e 8 px mede o agrupamento, que é o que P3 pede.

### 2. O botão do topo passa a ser sempre "Abrir a orquestradora"

Com o grupo, o nome do projeto já está na frase logo acima do botão. Repeti-lo no botão custa largura que o topo não tem:

| Rótulo | Largura medida no mock | Cabe em 266 px (292 − recuo de 26)? |
|---|---|---|
| "Abrir a orquestradora" | 147 px | sim |
| "Abrir a orquestradora de izanagi" | 210 px | sim |
| "Abrir a orquestradora de kit-de-orquestracao" | ≥ 274 px (quebra em 2 linhas a 274) | **não** |

O botão fica **sem o projeto em todo lugar**: no cartão (ponto B do plano F76) e no topo, com 1 ou com 2 projetos. Com isso, o `comProjeto` do plano deixa de ser necessário: `botaoOrquestradora(key, projeto, id)` rotula sempre "Abrir a orquestradora" (ou "Abrindo…").

- **Muda o plano F76:** o teste **F76 B** passa a afirmar o texto exato `Abrir a orquestradora` **também** nos botões `orq:<projeto>` do topo, com dois projetos em "Pedido". O critério `grep "emPedido.size > 1"` continua valendo (nenhuma linha).
- **Risco aceito:** com dois projetos, há dois botões com o mesmo rótulo. Quem diz qual é qual é a frase colada acima de cada um. O apelido da sessão ("Abrir E2") não serve aqui: a orquestradora não tem apelido curto no pane.

### 3. Ordem do topo

De cima para baixo, depois da `secaoSvg`:

1. "Pedir n sessões", sozinho numa fileira (`Box row alignItems="center"`), quando há (n ≥ 2 ou o lote enviando);
2. os grupos do §1, um por projeto, **na ordem em que o projeto aparece pela primeira vez na Na fila** (a mesma ordem dos avisos de projeto);
3. os avisos de projeto (`Text dimColor wrap="wrap"`), como hoje.

O "Pedir n sessões" sai da fileira dos "Abrir": pede vários projetos de uma vez, então não pertence ao grupo de nenhum. Com `semLista`, o topo é só o aviso da lista, como hoje.

### 4. O recuo: `paddingLeft={3}` no topo inteiro

Todo o topo (o "Pedir n sessões", os grupos e os avisos) fica dentro de **um** `Box flexDirection="column" gap={1} paddingLeft={3} paddingBottom={1}`. O `paddingBottom` separa o fim do topo da primeira linha (~18 px) mais do que um grupo se separa do outro (~9 px): o topo e as linhas usam a mesma coluna e a mesma forma, e sem ele o último grupo se lê como parte do primeiro item. Sem filete. No terminal não há `paddingBottom`: o "●" de cada linha já marca o início. O valor é o mesmo da fileira da linha da fila (`paddingLeft={3}`, ≈ 26 px).

- **Por que 3 e não os 13 px do mock de origem:** 13 px alinhava o texto ao título da seção (x = 14 na `secaoSvg`). Em unidades do pane, 13 px fica entre 1 (~9 px) e 2 (~17 px), e qualquer um dos dois cria uma terceira coluna, que não é a do título nem a da linha. Com 3, a Na fila inteira tem uma coluna só abaixo da faixa: "Pedir n sessões", "Abrir a orquestradora", os avisos, o título de cada linha (x = 22) e o "Pedir planejadora" de cada linha (x = 26) começam no mesmo lugar, ±4 px. No mock, todos medem x = 26.
- **Custo:** 26 px a menos para as frases. "2 cartões esperam você na conversa da orquestradora de izanagi" quebra em 2 linhas a 300 px com o recuo **e sem ele** (35 px de altura nos dois casos, no mock), então o recuo não acrescenta linha. "Sem orquestradora ativa em loja-velha · 1 item" passa de 1 para 2 linhas a 300 px (+17 px); a 380 px cabe numa linha.

### 5. Terminal

A mesma ordem e o mesmo agrupamento em `tituloDaSecao('Na fila', …)`: o "Pedir n sessões"; por projeto, um `Box flexDirection="column"` com a frase (`warning`) e o botão "Abrir a orquestradora" embaixo; os avisos de projeto. Tudo dentro de **um** `Box flexDirection="column" paddingLeft={2}`: 2 colunas, a largura de "● " em `linhaItem`, onde começa o texto de cada item.

## Peso, medido no mock (300 px)

Altura do topo, do primeiro botão ou frase ao fim do último texto, abaixo da faixa:

| Caso | Antes (#33) | Com o adendo |
|---|---|---|
| 2 projetos em "Pedido", com o lote e um aviso | 216 px (a fileira de 3 botões quebra em 3 linhas) | 216 px |
| 1 projeto em "Pedido", com o lote e um aviso | — | 143 px |
| 2 projetos, sem o lote | — | 137 px |

A altura não cresce no pior caso: os 17 px que o aviso ganha ao quebrar com o recuo são pagos pela fileira que deixa de quebrar. Âmbar no topo: uma frase por projeto em "Pedido", como antes. O que cai é a fileira que juntava três destinos e o botão que quebrava em duas linhas.

## Estados

Os da revisão de origem (§Estados, coluna "Topo da Na fila") continuam. O que muda é só o lugar:

| Estado | O grupo do projeto |
|---|---|
| Nenhum item do projeto em "Pedido" | não existe |
| 1 ou mais itens do projeto em "Pedido" | frase + "Abrir a orquestradora" |
| Clique no botão | "Abrindo…" no próprio botão, a frase continua; na recusa, o endereço copiado e o toast de hoje |
| Último item do projeto sai de "Pedido" (ganhou o papel, ou 30 min) | o grupo some inteiro na releitura; os de outros projetos não se movem de ordem |

## Para a E: o teste que prova o agrupamento

Teste **F76 C/E** (`plugins/painel-sessoes/tests/painel.test.tsx`, prefixo `F76`), sobre a árvore do desktop com o pane em outra sessão, um item da Na fila de izanagi e um de kit em "Pedido" e 2 itens que ainda podem ser pedidos:

1. **Presença antes da ordem:** os nós `pedir:lote`, `orq:izanagi`, `orq:kit-de-orquestracao`, o `Text` "1 cartão espera você na conversa da orquestradora de izanagi" e o de kit existem, cada um uma vez.
2. **Ordem dos nós no topo** (a sequência de `Button` e `Text` entre a faixa da Na fila e a primeira linha da fila): `pedir:lote` → frase de izanagi → `orq:izanagi` → frase de kit → `orq:kit-de-orquestracao` → aviso de projeto, se houver. Em particular, o índice de `orq:izanagi` é o da frase de izanagi + 1, e o da frase de kit é o de `orq:izanagi` + 1.
3. **Agrupamento:** o ancestral comum mais próximo da frase de izanagi e de `orq:izanagi` é o `Box` column do grupo; esse `Box` não contém nenhum nó de kit; e o pai direto de `orq:izanagi` é um `Box` row (a forma de todo botão do pane).
4. **Recuo:** o ancestral comum dos nós do topo tem `paddingLeft` 3 e `paddingBottom` 1 (desktop) e `paddingLeft` 2 (terminal), e nenhum nó do topo fica fora dele.
5. **Rótulo:** os dois `orq:<projeto>` têm o texto exato `Abrir a orquestradora` (ajuste do F76 B, §2).
6. Com **1** projeto: a mesma ordem sem o segundo grupo, e o botão com o texto exato `Abrir a orquestradora`.

O teste falha antes do conserto pela ordem (hoje `orq:izanagi` e `orq:kit-de-orquestracao` são vizinhos, e as frases vêm depois) e pelo recuo (hoje o topo não tem `paddingLeft`), não por erro de montagem.

A E confere no app, a 300 px, que o "Abrir a orquestradora" começa na coluna do "Pedir <papel>" das linhas, ±4 px.

## Decisões

1. **O botão do topo perde o nome do projeto, também com dois projetos.**
   - O caso: com o grupo, a frase colada acima de cada botão já diz o projeto. Com o nome, "Abrir a orquestradora de kit-de-orquestracao" não cabe numa linha a 300 px com o recuo.
   - Se não decidir: fica sem o nome, e o F76 B muda como no §2.
   - Recomendação: sem o nome, porque o projeto continua escrito a 2 px do botão e o botão cabe numa linha em qualquer projeto. *Assumida, a confirmar.* A alternativa do crítico (P2 da §Crítica) é "Abrir <projeto>" com 2 projetos ou mais: tira a ambiguidade entre os dois botões, mas põe no pane um "Abrir X" em que X é um projeto, e não uma sessão como em "Abrir E2".
2. **O recuo é o da linha (26 px), não o do título da seção (13 px do mock).**
   - O caso: o mock de origem alinhava os textos do topo ao título da seção; as unidades do pane não chegam a 13 px.
   - Se não decidir: 26 px.
   - Recomendação: 26 px, porque a Na fila fica com uma coluna só abaixo da faixa, e o recuo não acrescenta linha às frases. *Assumida, a confirmar.*

## Crítica

- **Rodada 1 (`design:critico-de-ui`, 25/30, aprovada com ressalvas):** hierarquia 4 · densidade 4 · consistência 4 · ruído 4 · ação primária 4 · aderência 5. Conferiu no mock a 300 px: topo de 215,5 px com dois projetos e o lote (216 antes), tudo em x = 26, frase a 2 px do botão e a 9 px do grupo seguinte.
  - **P1 (média), aplicada:** o teste 3 pedia o mesmo `Box` pai para frase e botão, o que obrigaria a tirar o `Box` row do botão → o teste 3 afirma o ancestral comum (o `Box` column do grupo) e o `Box` row como pai direto do botão.
  - **P3 (baixa), aplicada:** o fim do topo ficava a ~9 px da primeira linha, o mesmo respiro entre grupos → `paddingBottom={1}` no `Box` do topo (desktop).
  - **P2 (média), não aplicada:** com dois projetos, dois botões "Abrir a orquestradora" idênticos; quem os distingue é a última palavra da frase acima. O crítico recomenda "Abrir <projeto>" com 2 projetos ou mais ("Abrir kit-de-orquestracao" mede 172 px e cabe). Fica com a Decisão 1, *assumida, a confirmar*: se o operador escolher "Abrir <projeto>", o F76 B volta a ter dois casos e o critério `grep "emPedido.size > 1"` passa a valer só para o cartão.
  - Medidas da E no app, não no mock: a área útil do mock a 300 px é 248 px (274 − 26); a do pane, 266 px.
