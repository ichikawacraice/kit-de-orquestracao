# Revisão de arquitetura — pedir a sessão de cada item que espera, pelo pane

- **Data:** 2026-10-26
- **Autora:** D2, designer do pool
- **Estado:** **aprovada com ressalvas** — recrítica 2 em 24/30, sem ressalva alta (crítica 1: 22/30; recrítica 1: 23/30; as altas das duas aplicadas). As cinco ressalvas da recrítica 2 (duas médias, três baixas) não voltam para conserto: viram item próprio na fila (§Crítica).
- **Mock:** [`2026-10-26-pedir-sessao-pela-fila-mock.html`](2026-10-26-pedir-sessao-pela-fila-mock.html), estático, claro e escuro, a 380 e a 300 px
- **Plano de origem:** [`docs/planos/2026-10-26-abrir-sessao-pela-fila.md`](../../planos/2026-10-26-abrir-sessao-pela-fila.md), Parte A (branch `claude/f69-abrir-sessao-pela-fila`, 1f161fa). O comportamento é do plano: quem recebe o pedido (D1, D5), os dois caminhos (D2), onde há botão (D3), o agrupamento por projeto (D4), o ciclo do pedido (D6) e o texto que vai à orquestradora (D7). Esta revisão decide os rótulos, o lugar de cada botão e de cada texto na linha e no cartão, os estados visíveis e as mensagens.
- **Base:** o redesenho do pane ([`../2026-10-25-painel-redesenho.md`](../2026-10-25-painel-redesenho.md)): seções, cores, `secaoSvg`, `filaSvg`, cartão, botões `secondary`, átomos `enviando`/`abrindo` e o rótulo trocado no lugar de `disabled`. O que esta revisão não cita continua como lá.
- **Fontes lidas:** o plano (1f161fa); `plugins/painel-sessoes/hooks/register.tsx` (render do desktop e do terminal, `abrir`, `botoesAbrir`, `linhaDaFila`, `cartao`, `pedirResumo`, `rascunhoDeLimpar`, `avisar`); `hooks/desenho.ts` (`secaoSvg`, `filaSvg`, `X_FILA = 22`, `textoEsperando`, `fileteSvg`, o `filete: false` do `itemSvg`); `hooks/esperando.ts`; o mock do redesenho (as classes de cor).
- **Pedido do operador:** *"coloque um botão em cada de solicitar abertura de sessão, e um de abrir todas"*.

---

## Tarefa

> **Olhando a Na fila, o operador pede com um clique a sessão que falta a um item (ou a todos de uma vez) e vê, na própria linha, onde o pedido está: no prompt esperando o Enter dele, ou com a orquestradora, esperando ele iniciar o cartão.**

É a mesma seção de hoje, que passa a ter gesto. O redesenho dizia "Na fila: nenhum gesto no pane, quem inicia é a orquestradora". Essa linha cai: quem inicia continua sendo a orquestradora, mas o operador passa a poder chamá-la daqui.

## Quem e onde

- **Quem:** o operador, olhando o próprio pool. Vê a fila de todos os projetos (kit, Izanagi) no mesmo pane.
- **Onde:** o pane do desktop, `W` entre 300 e 420 px. O pior caso é **300 px** (W = 292 para os textos de linha única; dentro do cartão, `Wc` ≈ 257). O terminal segue as mesmas regras em texto (§Regiões, "Terminal").
- **Frequência:** quando a fila acumula. A medição do plano mostra trechos sem dona de 15 min a 7 h; o gesto se repete algumas vezes por dia, e o pedido em lote é o caso típico depois de uma pausa.

## Inventário

| O quê | Onde | Decisão que gera | Frequência | Veredito |
|---|---|---|---|---|
| Faixa "Na fila · n · não começaram" | `secaoSvg`, tracejada | "tem coisa parada?" | toda olhada | **fica** como está |
| **"Pedir n sessões"** | **novo:** botão `secondary`, numa fileira logo abaixo da faixa da Na fila | pedir de uma vez tudo o que espera papel | depois de pausa | **fica**, só com **2 ou mais** itens que podem ser pedidos (com 1, repetiria o botão do item) |
| **Aviso de projeto** ("Sem orquestradora ativa em izanagi · 4 itens") | **novo:** `Text dimColor`, uma linha por projeto, abaixo da faixa (e do "Pedir n sessões") | abrir ou escolher a orquestradora daquele projeto | quando há | **fica**, uma vez por projeto e não em cada linha |
| Linha do item na fila (`filaSvg`) | SVG | reconhecer o item | toda olhada | **fica**; o filete de baixo sai do SVG quando a linha ganha a fileira de ação (§Regiões) |
| Chip "espera execução · 35 min" | chips da linha | qual papel falta e há quanto | toda olhada | **fica**: é ele que explica o botão logo abaixo |
| **"Pedir executora"** (ou planejadora, designer, validadora) | **novo:** botão `secondary`, numa fileira abaixo do SVG da linha, alinhada ao texto | pedir a sessão deste item | quando a fila acumula | **fica**, só no item em que o plano dá papel (D3) e cujo projeto tem uma orquestradora só |
| **"Pedindo…"** | o mesmo botão, rótulo trocado | esperar | segundos | **fica** (estado) |
| **"No prompt às 10:42 · aperte Enter"** | **novo:** texto `color="warning"` **ao lado** do botão, que continua lá | apertar Enter; ou pedir de novo, se apagou o campo | até 5 min | **fica** (estado) |
| **"Pedido às 10:42 · inicie o cartão na conversa da orquestradora"** | **novo:** texto `color="warning"` **no lugar** do botão | ir à orquestradora e iniciar o cartão; não pedir de novo | até o item ganhar o papel, ou 30 min | **fica** (estado) |
| **"Abrir a orquestradora de izanagi"** | **novo:** botão `secondary` no topo da Na fila, um por projeto, só enquanto há item dele em "Pedido" | chegar ao cartão que falta iniciar | depois de cada pedido por mensagem | **fica** |
| Cartão em Executando com o chip "esperando V · 35 min" (`entregue: false`) | `cartaoSvg` | pedir o papel que falta ao item andando | quando há | **ganha** o botão "Pedir validadora", primeiro na fileira de ações; o texto de estado vai numa linha própria acima da fileira |
| Item em `merge`, `homologacao`, com `espera` ou com `trava` | linha ou cartão | — | — | **sem botão e sem texto**: não há papel a pedir (D3); o chip de hoje já diz por quê |
| Toast do envio | toast do app | saber onde o pedido foi parar | a cada clique | **fica**, some sozinho (§Mensagens) |
| Falha do envio | faixa "Ação não concluída", com "Limpar avisos" | pedir na conversa da orquestradora | rara | **fica**, a mesma faixa de hoje |

## Hierarquia e peso

- **Ação primária do pane:** continua a resposta da pergunta (o único `primary`). Os botões novos são `secondary`, como "Abrir X": pedir sessão é importante, mas não passa à frente de quem já espera o operador.
- **Dentro da Na fila**, de cima para baixo: (1) "Pedir n sessões", porque é o caso típico; (2) os "Abrir a orquestradora de <projeto>" e os avisos de projeto, que dizem para onde ir e por que alguns itens não têm botão; (3) o "Pedir <papel>" de cada linha; (4) os textos de estado: em `warning` os que pedem um gesto do operador ("No prompt", "Pedido às"), em `dimColor` os outros.
- **Dentro do cartão em Executando**, "Pedir validadora" vem **primeiro** na fileira: é o que o chip "esperando V" pede. Os "Abrir X" vêm depois, na ordem de hoje. O teto de 3 de `botoesAbrir` vale para os "Abrir"; o "Pedir" não conta nele.
- **Peso, medido no mock:**

  | Região | Hoje | Com a revisão |
  |---|---|---|
  | Faixa da Na fila | 28 px | + 34 px da fileira de "Pedir n sessões" e dos "Abrir a orquestradora" (só quando há) + ~20 px por aviso de projeto (~38 px se quebrar a 300 px) |
  | Linha da fila com papel a pedir | ~95 px | ~125 px (+ a fileira de ~26 px e o respiro) |
  | Linha da fila sem papel a pedir, ou de projeto com aviso | ~95 px | igual: a linha de hoje, com o filete dentro do SVG |
  | Cartão em Executando com "esperando" | ~170 px | **com "Abrir X":** igual, o botão entra na fileira que já existe; a 300 px, "Pedir validadora" + 2 "Abrir" ou mais quebra em 2 fileiras (+ ~30 px). **Sem "Abrir":** + ~30 px, porque a fileira passa a existir. **Com texto de estado:** + ~20 px da linha própria |

  A Na fila é a última seção com itens: crescer 30 px por linha só empurra a fileira do rodapé ("Todos os itens", "Feitos hoje", "Perguntas respondidas"), que é consulta e não pede gesto urgente.

- **Textos que cabem a 300 px** (W = 292; a fileira da linha começa no recuo do texto, ~26 px, e sobra ~266 px; corpo 12,5 px, ~6,6 px por caractere):
  - "Pedir planejadora" (o maior dos quatro): 124 px renderizado no mock;
  - "Pedir 12 sessões": ~105 px;
  - "No prompt às 10:42 · aperte Enter": 33 caracteres, ~218 px. **Ao lado** do botão (124 + 8 + 218 = 350 px) não cabe a 300 px e quebra para baixo dele, pela `flexWrap` da fileira; a 380 px (sobra ~346 px) cabe com "Pedir executora" e "Pedir designer" e quebra com "Pedir planejadora" e "Pedir validadora". Aceito: a quebra só muda a linha, não o sentido;
  - "Pedido às 10:42 · inicie o cartão na conversa da orquestradora": 62 caracteres, quebra em duas linhas a 300 e a 380 px. Aceito: é a frase que diz o gesto que falta;
  - "Abrir a orquestradora de izanagi": ~230 px com o respiro, cabe;
  - "Sem orquestradora ativa em izanagi · 4 itens": 44 caracteres, ~290 px, **quebra** em duas linhas a 300 px (`wrap="wrap"`). Aceito: aparece uma vez por projeto, e o nome do projeto é o que diz o que abrir;
  - "2 orquestradoras ativas em izanagi · peça na conversa da certa": quebra em duas linhas, aceito pelo mesmo motivo.

### Os rótulos

| Papel que falta (D3) | Rótulo do botão |
|---|---|
| P (planejamento) | Pedir planejadora |
| D (design) | Pedir designer |
| E (execução) | Pedir executora |
| V (validação) | Pedir validadora |

- **Por que o papel e não "Pedir sessão"** (o rótulo sugerido no plano): o pane já usa "verbo + quem" em "Abrir E2", e com cinco itens na fila cinco botões "Pedir sessão" iguais não dizem nada. O papel por extenso é o mesmo do §2 do redesenho (P → planejadora, …).
- **Por que "Pedir" e não "Abrir":** o clique não abre sessão (D1). "Abrir" prometeria o que não acontece.
- **"Pedir n sessões"**, com o número no verbo, e não "Pedir todas · n": a faixa logo acima diz "Na fila · 6", e "todas" ao lado de um número menor se contradiz. `n` = itens da Na fila com o botão "Pedir <papel>" à vista e sem estado, de todos os projetos. Item em "Pedindo…", em "No prompt", em "Pedido às" ou de projeto com aviso não conta: o lote nunca põe de novo no campo um pedido que já está lá (o operador pode já ter mandado). Quem apagou o campo pede de novo pelo botão da própria linha.

## Mensagens

| Mensagem | Lugar | Duração | Tom | Quem vê |
|---|---|---|---|---|
| "Pedindo…" | no botão pressionado | até o `fill` ou o `send_message` voltar | neutro | operador |
| "No prompt às 10:42 · aperte Enter" (pane na orquestradora do projeto: o texto foi para o campo e ainda não saiu) | ao lado do botão, que continua clicável | 5 min, ou até o item ganhar o papel | espera (`warning`) | operador |
| "Pedido às 10:42 · inicie o cartão na conversa da orquestradora" (pane em outra sessão: o `send_message` voltou bem, e a orquestradora responde com um cartão que só o operador inicia) | no lugar do botão | até o item ganhar o papel, ou 30 min | espera (`warning`) | operador |
| "Sem orquestradora ativa em <projeto> · <n> itens" | abaixo da faixa da Na fila, uma por projeto | enquanto valer | neutro | operador |
| "<k> orquestradoras ativas em <projeto> · peça na conversa da certa" | abaixo da faixa, uma por projeto | enquanto valer | neutro | operador |
| "Sem a lista de sessões do app · os botões de pedir voltam na próxima leitura" | abaixo da faixa, no lugar do "Pedir n sessões" | até a próxima leitura com lista | neutro | operador |
| Toast, um item, prompt: "Pedido na caixa do prompt: aperte Enter para abrir a sessão." | toast | some sozinho | ok | operador |
| Toast, um item, outra sessão: "Pedido enviado à orquestradora de izanagi: o cartão aparece na conversa dela." | toast | some sozinho | ok | operador |
| Toast, lote: um trecho por orquestradora, sem ponto final, emendados com "; " e um ponto só no fim. Trechos: "5 pedidos na caixa do prompt, aperte Enter" · "3 pedidos enviados à orquestradora de izanagi, os cartões aparecem na conversa dela". Ex.: "5 pedidos na caixa do prompt, aperte Enter; 3 pedidos enviados à orquestradora de izanagi, os cartões aparecem na conversa dela." | toast | some sozinho | ok | operador |
| Foco recusado depois do envio | o toast de `abrirSessao` de hoje ("não deu para abrir daqui…: endereço copiado") | some sozinho | neutro | operador |
| Falha do envio: "Não pedi a sessão do F68 · <título curto> à orquestradora de izanagi (<motivo>): peça na conversa dela." | faixa "Ação não concluída" | até "Limpar avisos" | ruim | operador |
| Falha do `fill`: "Não pus o pedido na caixa do prompt (<motivo>): escreva à orquestradora." | faixa "Ação não concluída" | até "Limpar avisos" | ruim | operador |

- **Os dois estados depois do clique são diferentes porque o pedido está em lugares diferentes.** No caminho do prompt, nada saiu até o operador apertar Enter, e o pane não vê esse Enter: por isso o texto pede o Enter, o tom é de espera, o botão continua (se ele apagou o campo, pede de novo) e o estado dura só 5 min. No caminho da mensagem, o pedido saiu, mas a sessão ainda não abre: a orquestradora responde com um cartão, e só o clique do operador nele abre a sessão (D2 do plano). Por isso o texto diz o gesto que falta, o tom também é de espera, o botão do item some (para não virar reenvio) e o topo da Na fila ganha "Abrir a orquestradora de <projeto>", que leva até o cartão sem depender do toast.
- **Foco depois do envio** (D2 do plano): com **uma** orquestradora de destino, o pane tenta pôr a conversa dela em foco, como o "Abrir P2" de hoje. Com **duas ou mais** (lote de vários projetos), **nenhum foco automático**: o toast diz onde estão os cartões, e o operador abre a que quiser.
- **Nenhum texto de UI cita F58, protocolo, skill nem âncora.** O texto que vai **à orquestradora** (D7) não é texto de UI: é dela, e cita a skill.
- **Cada `F<n>` seguido de ` · `** (a regra de texto do pane), inclusive no aviso de falha.
- **Os avisos de projeto não vão para a faixa de avisos:** não são falha de ação, são estado, e moram onde se lê a seção.
- **O "várias orquestradoras" deixa de ser aviso depois do clique** (D5 do plano) e passa a estado antes dele: o pane já sabe na hora de desenhar, e um botão que só pode falhar não deve aparecer. *Assumido, a confirmar* (§Decisões).

## Regiões e componentes

Só peças que o pane do desktop já desenha: `Svg`, `Text`, `Button` (`secondary`), `Box`. Nenhuma peça nova no motor; a única mudança de desenho é o filete da linha da fila, que reusa o padrão `filete: false` + `fileteSvg` que o `itemSvg` já tem.

### O topo da Na fila
De cima para baixo, no `gap` de hoje da seção:
1. `secaoSvg` de hoje, sem mudança.
2. Uma fileira `Box row alignItems="center" flexWrap="wrap" columnGap={1}` com:
   - com `n` ≥ 2: `Button secondary key="pedir:lote"` → "Pedir n sessões". Enquanto envia: "Pedindo…" e o clique é ignorado (o truque do `abrindo`). Depois: some se `n` ficou abaixo de 2, ou volta com o `n` recontado;
   - um `abrir()` de hoje (`register.tsx`, o mesmo do "Abrir P2") por projeto com item em "Pedido", rotulado "Abrir a orquestradora de <projeto>" (o "Abrindo…" e a cópia do endereço na recusa são os de hoje). Some quando nenhum item do projeto está mais em "Pedido".
3. Os avisos de projeto, um `Text dimColor wrap="wrap"` por projeto, na ordem dos projetos. Com `semLista`, só o aviso da lista, no lugar do botão do passo 2 e dos avisos de projeto.

### A linha da fila
Item com papel a pedir, de projeto com uma orquestradora só:
1. `filaSvg` de hoje **sem o filete de baixo** (opção nova `{ filete: false }`, como a do `itemSvg`).
2. A **fileira de ação**: `Box row alignItems="center" flexWrap="wrap" columnGap={1} paddingLeft={3}` (≈ 26 px, o recuo do texto a `X_FILA = 22`; a E confere no app que o botão começa na coluna do título, ±4 px), com:
   - `Button secondary key="pedir:<id>"` → "Pedir <papel>" ou "Pedindo…"; e, no estado "No prompt", o `Text color="warning"` ao lado (sem `dimColor`: no pane, os dois se excluem, como no `espera.motivo === 'operador'` de hoje);
   - ou, no estado "Pedido às", só o `Text color="warning" wrap="wrap"`.
3. O "⚠ fora do contrato" de hoje, quando há.
4. O filete, com o `fileteSvg(W)` de hoje.

Item sem papel a pedir, de projeto com aviso, ou com `semLista`: a linha é exatamente a de hoje.

### O cartão em Executando
- Quando o item tem `esperando` e `entregue: false` (D3 b), a fileira de ações do `cartao` recebe o "Pedir <papel>" **antes** dos "Abrir X". Com `entregue: true` ("entregue · avance a etapa") não há botão: falta avançar, não falta sessão.
- A fileira do cartão ganha `alignItems="center"`, como a do topo do pane.
- O **texto de estado** vai numa **linha própria** (`Text wrap="wrap"`, `color="warning"` para "No prompt" e "Pedido às", `dimColor` para os estados de projeto) **acima** da fileira dos botões, e não dentro dela: a 300 px ele não cabe ao lado de um "Abrir" (`Wc` ≈ 257).
- Os estados de projeto (sem orquestradora, várias, `semLista`) aparecem **no cartão** como essa mesma linha própria, sem botão: o cartão não está na Na fila e não vê os avisos de lá.

### Terminal
- A mesma regra e a mesma ordem do cartão do desktop: em `linhaItem`, o `Text` de estado, depois o `Button` "Pedir <papel>", depois `botoesAbrir(i)`. "Pedir n sessões", os "Abrir a orquestradora de <projeto>" e os avisos de projeto logo abaixo de `tituloDaSecao('Na fila', …)`.

### O estado em memória (para a E)
- Um átomo novo, declarado no contrato como os outros: `pedindo: Record<string, { estado: 'enviando' } | { estado: 'prompt'; em: number } | { estado: 'pedido'; em: number }>`, com o id do item como chave, mais `'lote'` para o botão da seção enquanto envia.
- O render lê o átomo; a releitura (60 s) apaga as chaves cujo item ganhou o papel (D6), as `prompt` com mais de 5 min e as `pedido` com mais de 30 min.
- O lote no caminho do prompt segue a regra de preenchimento de D2 do plano (`append` com rascunho, `replace` com o campo vazio).

## Estados

| Estado | Topo da Na fila | Linha da fila | Cartão em Executando |
|---|---|---|---|
| Ainda não lido | o de hoje ("ainda não lido") | — | — |
| Vazio | "Nada na fila." (hoje); sem botão nem aviso | — | — |
| Um item que pode ser pedido | sem "Pedir n sessões" | "Pedir executora" | — |
| 2 ou mais | "Pedir n sessões" | um botão por linha | — |
| Enviando (um item) | `n` conta um a menos | "Pedindo…" | "Pedindo…" |
| Enviando (lote) | "Pedindo…" | "Pedindo…" em cada linha incluída | — |
| No prompt (pane na orquestradora) | `n` não conta o item | botão + "No prompt às 10:42 · aperte Enter" | a linha "No prompt…" acima do botão |
| Pedido (mensagem enviada) | `n` cai; o botão some com menos de 2; aparece "Abrir a orquestradora de <projeto>" | "Pedido às 10:42 · inicie o cartão na conversa da orquestradora", sem botão | a linha "Pedido às…" acima dos "Abrir", sem "Pedir" |
| Item ganhou o papel | — | o item sai da Na fila na releitura (D9: `com` vivo vai a Executando) | o chip "esperando" some e o texto também |
| Prazo vencido (5 min no prompt, 30 min pedido) | `n` volta a contar o item | só o botão | só o botão |
| Falha do envio | o botão volta com o `n` recontado | o botão volta; o motivo vai para a faixa "Ação não concluída" | igual |
| Projeto sem orquestradora ativa | "Sem orquestradora ativa em <projeto> · <n> itens"; os itens não contam | a linha de hoje | a linha "Sem orquestradora ativa em <projeto>", sem "Pedir" |
| Projeto com 2 orquestradoras ou mais | "<k> orquestradoras ativas em <projeto> · peça na conversa da certa"; os itens não contam | a linha de hoje | a mesma linha, sem "Pedir" |
| Lista do app falhou (`semLista`) | só "Sem a lista de sessões do app · os botões de pedir voltam na próxima leitura" | a linha de hoje | a mesma linha, sem "Pedir" |
| Modo ausente ligado | igual ao presente: o pedido sai, e a orquestradora responde que está no ausente (Parte C do plano) | igual | igual |
| Recarregou o pane | o átomo começa vazio: os botões voltam | idem | idem |

- **Desfecho sempre:** toda saída do "Pedindo…" vai para "No prompt", para "Pedido às", ou para o botão de volta com o motivo na faixa. Não há saída muda.
- **Sobreviver ao recarregar:** não sobrevive, por decisão do plano (D6: nada se grava na fila). O risco é um pedido em dobro, que a orquestradora absorve (um cartão por vaga, e ela retira o repetido). *Assumido, a confirmar.*
- **Sem lista do app:** é o mesmo filtro do `pedirResumo` (a orquestradora precisa estar viva no app). Sem a lista o pane não sabe se a do documento está arquivada; não pedir é mais seguro do que mandar para uma sessão morta.

## Movimento

- Nenhum. Rótulo trocado e texto de estado entram de uma vez, como "Abrindo…" hoje. A releitura que tira o item da Na fila também é instantânea. Nada a fazer para `prefers-reduced-motion`.

## O que sai

- A linha "Na fila: nenhum gesto no pane, quem inicia é a orquestradora" do redesenho (§Tarefa e §3 "Sem botão" de lá): agora há gesto. A regra de que o pane não abre sessão continua (D1).
- O rótulo genérico "Pedir sessão" e o "Pedir para todos (5)" do plano: ficam "Pedir <papel>" e "Pedir n sessões".
- Um "pedido" só para os dois caminhos: viram "No prompt · aperte Enter" e "Pedido às · inicie o cartão", cada um dizendo o gesto que falta.
- O "Pedido às" como **botão**: ele é texto, não clicável, para não virar um reenvio disfarçado.
- O aviso de "várias orquestradoras" depois do clique: vira estado antes dele, e uma vez por projeto, não por linha.
- O foco automático no lote de vários projetos.
- O filete de baixo **dentro** do `filaSvg`, na linha que tem fileira de ação: ele passa para depois da fileira, senão o botão parece da linha de baixo.

## Decisões ao operador

Todas *assumidas, a confirmar*, de baixo risco e reversíveis. Ficam com a planejadora (P3), que as leva ao operador se quiser.

1. **Rótulo com o papel ("Pedir executora") e não "Pedir sessão".**
   - O caso: com cinco itens na fila, cinco botões iguais não dizem o que cada um pede.
   - Se não decidir: fica "Pedir <papel>".
   - Recomendação: "Pedir <papel>", porque segue o "Abrir E2" do pane e o operador sabe qual sessão vai aparecer.
2. **"Várias orquestradoras" aparece antes do clique, uma vez por projeto.**
   - O caso: o plano manda avisar depois do clique; o pane já sabe disso ao desenhar.
   - Se não decidir: aviso de projeto no topo da Na fila, sem botão nos itens dele.
   - Recomendação: antes do clique, porque um botão que só pode falhar é ruído.
3. **"Pedir n sessões" só com 2 ou mais itens que podem ser pedidos.**
   - O caso: com um item só, os dois botões fariam a mesma coisa um embaixo do outro.
   - Se não decidir: aparece a partir de 2.
   - Recomendação: a partir de 2.
4. **O pedido não sobrevive ao recarregar o pane.**
   - O caso: o estado mora em memória (D6 do plano). Recarregar traz o botão de volta antes do item ganhar o papel.
   - Se não decidir: fica em memória.
   - Recomendação: em memória, porque o pedido em dobro sai barato (a orquestradora junta os cartões) e gravar na fila disputaria versão com a dona.
5. **O estado "No prompt" dura 5 min e deixa o botão à vista.**
   - O caso: o pane não vê o Enter do operador. Se ele apagou o campo, precisa poder pedir de novo.
   - Se não decidir: 5 min, com o botão.
   - Recomendação: 5 min, porque o Enter costuma vir em segundos, e o botão à vista custa pouco (um pedido em dobro no campo, que o operador vê antes de mandar).

## Para a E: gestos a auditar (`processos:auditoria-de-clique`)
- "Pedir <papel>" na linha, nos dois caminhos: clique → `fill` (ou `send_message` + foco) → átomo `pedindo` (`prompt` ou `pedido`) → texto → releitura que apaga.
- "Abrir a orquestradora de <projeto>": aparece com o primeiro item do projeto em "Pedido", leva a conversa dela ao foco (ou copia o endereço) e some quando o último item do projeto sai de "Pedido".
- "Pedir n sessões": clique → um pedido por orquestradora → cada linha no estado do seu caminho → `n` recontado; com dois projetos, nenhum `open_session_in`.
- "Pedir <papel>" no cartão em Executando: o mesmo ciclo, com o chip "esperando" sumindo na releitura.

## Crítica
- **Rodada 1 (`design:critico-de-ui`, 22/30, volta):** hierarquia 4 · densidade 4 · consistência 4 · ruído 3 · ação primária 3 · aderência 4. Aplicado nesta versão:
  - **P1 (alta):** "Pedido às" no caminho do prompt dizia que o pedido saiu antes do Enter → dois estados, "No prompt às … · aperte Enter" (botão à vista, 5 min, conta no lote) e "Pedido às … · na orquestradora".
  - **P2 (média):** estado de projeto repetido em cada linha → um aviso por projeto no topo da Na fila; as linhas ficam como hoje.
  - **P3 (média):** o cartão crescia e o texto ficava partido na fileira → texto em linha própria acima da fileira, `alignItems="center"`, tabela de peso corrigida, mock com o cartão a 300 px.
  - **P4 (baixa):** "todas · 2" abaixo de "Na fila · 6" → "Pedir n sessões".
  - **P5 (baixa):** toast emendado com ".;" e foco sem dono no lote → trechos sem ponto, ponto só no fim; nenhum foco automático com duas orquestradoras ou mais.
- **Recrítica 1 (crítico novo, 23/30, volta):** hierarquia 4 · densidade 4 · consistência 4 · ruído 4 · ação primária 3 · aderência 4. P1–P5 da rodada 1 dados como resolvidos. Aplicado nesta versão:
  - **P1 (alta):** "Pedido às · na orquestradora" não dizia que falta o clique do operador no cartão → "Pedido às … · inicie o cartão na conversa da orquestradora", em `warning`, e "Abrir a orquestradora de <projeto>" no topo da Na fila, um por projeto.
  - **P2 (média):** o lote contava o item em "No prompt" e o punha em dobro no campo → `n` não conta item com estado.
  - **P3 (baixa):** a cor do "No prompt" vinha em três versões → `color="warning"`, sem `dimColor`, em todo lugar.
  - **P4 (baixa):** o terminal punha o "Pedir" depois dos "Abrir" → a ordem do cartão do desktop (estado, "Pedir", "Abrir").
  - **P5 (baixa):** "os pedidos voltam" lia-se como reenvio → "os botões de pedir voltam".
  - Fora dos cinco: a largura de "Pedir planejadora" (124 px medidos) e a frase de que a Na fila é a última seção (o rodapé vem depois), corrigidas em §Hierarquia.
- **Recrítica 2 (crítico novo, 24/30, aprovada com ressalvas):** hierarquia 4 · densidade 4 · consistência 4 · ruído 4 · ação primária 4 · aderência 4. P1–P5 da recrítica 1 dados como resolvidos. Ressalvas **não aplicadas** (pelo teto, viram item próprio na fila):
  - **R1 (média):** o cartão em Executando em "Pedido" não tem botão até a orquestradora; o "Abrir a orquestradora" do topo só conta itens da Na fila. Correção: `abrir()` da orquestradora na fileira do cartão, antes dos "Abrir X", fora do teto de 3.
  - **R2 (média):** depois de um lote, a frase de 62 caracteres em `warning` se repete em cada linha (Na fila mais âmbar que "Esperam você"). Correção: na linha, "Pedido às 10:42 · inicie o cartão"; a frase inteira uma vez por projeto, sob o "Abrir a orquestradora" ("3 cartões esperam você na conversa da orquestradora de izanagi"); o cartão mantém a frase inteira.
  - **R3 (baixa):** na linha da fila o "No prompt" vai ao lado do botão (e quebra para baixo); no cartão e no terminal, acima. Correção: linha própria acima da fileira também na linha da fila.
  - **R4 (baixa):** falta a mensagem de falha do lote (inteira ou em parte). Correção: um trecho por orquestradora na faixa "Ação não concluída" ("Não pedi 3 sessões à orquestradora de izanagi (<motivo>): F17 · …, F63 · …; peça na conversa dela"), e o toast leva só os trechos que saíram.
  - **R5 (baixa):** "Abrir a orquestradora de kit-de-orquestracao" (44 caracteres) fica no limite ou passa a 300 px. Correção: medir; se não couber, "Abrir a orquestradora" com um só projeto em "Pedido" e o nome só com 2 ou mais.
