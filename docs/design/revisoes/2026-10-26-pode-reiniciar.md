# Revisão de arquitetura — quando dá para reiniciar o app (barra e topo do pane)

- **Data:** 2026-10-27 (SP); o nome do arquivo segue o plano
- **Autora:** D1, designer do pool
- **Estado:** aprovada com ressalvas (crítica 1, 25/30, sem ressalva alta; as cinco ressalvas, de texto e de mock, aplicadas nesta versão: [§Crítica](#critica)). Liberada para execução.
- **Mock:** [`2026-10-26-pode-reiniciar-mock.html`](2026-10-26-pode-reiniciar-mock.html), estático, claro e escuro: a barra em 114, 126, 140 e 40 células; o topo do pane a W = 288 nos seis estados; o pane do terminal; a notificação.
- **Plano de origem:** o plano da F152 (P5, 26/10; a E o copia para `docs/planos/2026-10-26-pode-reiniciar.md`). A parte A (o comando `painel pode-reiniciar`, o julgamento, o arquivo `batida/pode-reiniciar.json`) é do plano. Esta revisão responde às três perguntas da parte B: onde aparece e quando; como mostra o "não pode", os motivos e a idade do dado; o "me avise" e como ele se desliga. Para fechar a parte B ela precisa de três ajustes no contrato da parte A, que vão como [pendências à planejadora](#pendencias) e valem como *assumidos, a confirmar*.
- **Base:** a barra da revisão [`2026-10-27-barra-e-sessoes-para-abrir.md`](2026-10-27-barra-e-sessoes-para-abrir.md) (glifos, ordem `selo → limpar → modo → painel`, faixas 125 / 105 / 62 da orquestradora), aprovada e ainda não executada. As larguras daqui somam sobre ela. Se esta E chegar antes daquela, as regras daqui valem iguais sobre a barra de hoje (o `pedido` some, a peça nova entra no mesmo lugar) e só os números das faixas mudam.
- **Fontes lidas:** o handoff e o plano da F152; `plugins/painel-sessoes/hooks/barra.tsx` (`pecasDaBarra`, `larguraDaFaixa`, `faixaDaBarra`, `desenharBarra`); `register.tsx` (o topo do pane nas duas superfícies: `botaoModo`, `botaoAtualizar`, `linhaParou`, `faixaModo`, `desenharTopo`; `avisarCache`, que já manda `PushNotification` e cai para toast; `avisar`; o timer `LEITURA_MS`); `desenho.ts` (`CSS`, `faixaSvg`, `modoSvg`, `parouSvg`, `rotuloModoSvg`); a revisão da barra e os deltas F65 e F71.

## Tarefa

*O operador, que quer reiniciar o app, sabe se pode agora sem derrubar trabalho; e, quando não pode, pede para ser avisado e é avisado uma vez, no momento em que passa a poder.*

## Quem e onde

- **Quem:** o operador, sozinho, que alterna entre a conversa da orquestradora e as dos membros do pool. Reiniciar derruba **todas** as sessões da máquina, de todos os projetos.
- **Barra:** acima do prompt de toda sessão; terminal de 114 células como referência, 40 como pior caso; desktop numa coluna de chat. Só lê arquivos, a cada 30 s e a cada turno.
- **Pane:** a coluna do desktop (W = 288 é o pior caso, 360 a referência) e o pane do terminal. Com o pane aberto, cada leitura dele roda `painel pode-reiniciar --sessoes` com a lista fresca do app.
- **Frequência:** querer reiniciar acontece **poucas vezes por dia** (atualizar plugin, app travado). No resto do tempo a resposta é quase sempre "não pode": o pool está trabalhando. Isso decide quase tudo abaixo: o "não pode" permanente seria ruído o dia inteiro, e o "pode" só vale enquanto o dado é fresco.

## Inventário

Nada disto existe hoje; hoje o operador pergunta na conversa e a orquestradora confere à mão.

| O quê | Onde | Decisão que gera | Frequência | Veredito |
|---|---|---|---|---|
| "Pode reiniciar" / "espere · N rodando" / "não sei" | **pane**, topo, uma linha discreta (20 px) | reiniciar agora ou esperar | ao abrir o pane | **fica**, uma linha só |
| Quantos e de que tipo rodam (`4 sessões trabalhando, 1 teste`) | `alt` da linha; no bloco do aviso, pelos motivos | "quem eu espero" | idem | **sob demanda**: o número fica na linha, o detalhe no `alt` e no bloco |
| Os motivos, um por linha | pane, só com o aviso ligado | "quem eu espero" (ir ver a sessão, esperar o merge) | quando o operador já disse que quer reiniciar | **sob demanda**: aparecem quando o aviso liga |
| Botão `Me avise` | pane, à direita na mesma linha, só quando não pode ou não sei | ligar o aviso | poucas vezes por dia | **fica** |
| Botão `Não avisar mais` | pane, abaixo do bloco do aviso | desligar | idem | **fica** |
| Peça `⏻ N rodando` / `⏻ Pode reiniciar` | **barra** de toda sessão, só com o aviso ligado | "já posso?" sem abrir o pane, em qualquer conversa | enquanto o aviso dura (minutos) | **fica**, só com o aviso |
| "Pode reiniciar" permanente na barra, sem aviso | barra | — | — | **sai** (não entra): o dia todo diria "nada" ou "pode" a quem não quer reiniciar |
| Botão de ligar o aviso na barra | barra | ligar | poucas por dia | **outra tela**: mora no pane, a um clique pelo `◨ Abrir painel` (a barra não paga ~25 células todo dia por um gesto raro) |
| Notificação do app ao passar a poder | sistema (`PushNotification`), toast se recusada | ir reiniciar | uma por aviso | **fica** |
| A hora da conferência (`conferido às 21:14`) | pane, no fim da linha ou do bloco | confiar ou não no "pode" | idem | **fica**, apagada |

<a id="hierarquia"></a>
## Hierarquia e peso

**Primária:** a resposta (pode / espere / não sei). **Secundária:** o botão do aviso. **Terciária:** os motivos e a hora.

### Onde aparece (pergunta 1 do plano)

**Nos dois, com papéis diferentes.** O **pane** responde sempre (é onde a lista é fresca e há espaço para os motivos); a **barra** só fala depois que o operador liga o aviso, e então fala em toda sessão, porque ele pode estar em qualquer conversa quando o momento chega.

- **Silêncio na barra quando o aviso está desligado**, nos dois estados ("pode" e "não pode"). O "não pode" permanente seria vermelho ou cinza parado o dia inteiro, e o "pode" permanente apareceria em todo momento ocioso para quem não quer reiniciar. A pergunta só existe quando o operador a faz.
- **Com o aviso ligado, a barra mostra os dois estados** (espere e pode), em toda sessão: o "espere" diz que o aviso está vivo e quanto falta; o "pode" fica enquanto vale, porque a notificação some e o operador pode voltar à conversa depois.

### Barra

**A peça:** texto, não botão, no começo do grupo da direita (antes do selo), na mesma posição que o pedido de limpeza ocupava. Texto porque não há gesto a dar na barra: o "ir reiniciar" é fora do app, e o selo e o `◨` já abrem o pane, onde mora o `Não avisar mais`.

| Estado | Texto | Glifo (`Text color`) | Resto |
|---|---|---|---|
| esperando | `⏻ 3 rodando` · `⏻ 1 rodando` | `⏻` `subtle` | texto `dimColor` |
| pode | `⏻ Pode reiniciar` | `⏻` `success` | texto `bold` |
| acabou de ligar (até a 1ª conferência da vigia) | `⏻ conferindo` | `⏻` `subtle` | texto `dimColor`, itálico |
| sem dado fresco (vigia sumiu, arquivo velho, ausente ou ilegível) | `⏻ não sei` | `⏻` `subtle` | texto `dimColor` |

- **O número** é o de motivos (sessões + testes + merges, a própria sessão incluída: [§Estados](#estados)). Ele cai a cada volta, e isso dá o andamento.
- **Por que `⏻`:** é o símbolo de ligar e desligar; não é uma seta, e a barra e o pane já têm três setas circulares (`↻` atualizar, `↺` limpar e o `⧗` do relógio, que lê como ampulheta). Uma quarta seta confundiria. **A E mede** se o `⏻` (U+23FB) sai numa célula e com glifo nas fontes do terminal do app e do desktop, com captura na PR; se não sair, troca para `⊙` (U+2299) e registra.
- **Cor:** `success` só no "pode", a única vez que a barra usa o verde para dizer "vá". O "esperando" fica apagado: não é problema, é espera que o próprio operador pediu. Nenhuma cor é a única pista: as palavras mudam (`rodando` contra `Pode reiniciar`), e o "pode" muda também o peso (negrito).
- **Nunca cai** quando a largura aperta: com o aviso ligado, é a razão de a barra estar ali. Valem as regras de queda da revisão de base; o que muda é a soma.
- **A largura reserva a forma mais longa:** `larguraDaFaixa` conta a peça sempre como `⏻ Pode reiniciar` (16, texto, sem `[ ]`) mais 1 de vão. A barra não se rearruma quando o estado vira, como o `Limpando…` da base.

**As faixas com a peça** (+17 sobre a base):

| Sessão | Faixa 0 | Faixa 1 | Faixa 2 |
|---|---|---|---|
| Membro do pool, presente, com item, pool e selo | 114 → **131** | 94 → **111** | 37 → **54** |
| Orquestradora, presente, selo (base 125 / 105 / 62) | **142** | **122** | **79** |

- A coluna da orquestradora é a da base, **com o contexto em `· limpar`** (198 mil). Abaixo da régua (142 mil, sem palavra) a faixa 1 dela soma **113**.
- A 114 células o membro fica na faixa 1, com os quatro botões. A orquestradora **com o contexto em `· limpar`** cai da 1 (122) para a 2 enquanto o aviso dura: perde o `☾ Ficar ausente` presente e o `◨`, que o selo substitui (mock, quadro 3); abaixo da régua ela fica na faixa 1 (113). É temporário e aceito: o aviso dura minutos, e o limpar e o selo ficam. O teste de faixa da E cobre os dois casos.
- A 40, o grupo da direita quebra inteiro para a linha de baixo (o `flexWrap` de hoje).

### Pane: o bloco do reinício

**Lugar:** no topo, logo depois da faixa do modo ausente e antes do cartão do resumo. Não é seção (não tem itens nem pílula): é estado da máquina, como o modo, e mora junto dele.

**Aviso desligado** (uma linha só, ≈ 20 px em todo estado, a W = 288; o botão à direita na mesma fileira, no `Box row … justifyContent="flex-end"` da fileira do modo):

```
⏻ Reiniciar: espere · 5 rodando            [ Me avise ]     ← 12,5 px / 600, `s`; ⏻ em `m`; botão secundário
⏻ Pode reiniciar o app · conferido às 21:15                 ← ⏻ e frase em `ok`, 600; a hora em `m`, 400; sem botão
⏻ Reiniciar: não sei                       [ Me avise ]     ← `s`; a razão vai no `alt`
```

- **Uma linha porque o estado normal é "espere"**, o dia inteiro: três peças empilhadas empurrariam "Esperam você" para fora da primeira dobra, que a revisão de base garante. É o mesmo argumento que tira o "não pode" da barra.
- **A contagem por tipo vai no `alt`**: `Reiniciar o app: espere, 5 rodando — 4 sessões trabalhando, 1 teste.` (plural por tipo: `sessão/sessões trabalhando`, `teste/testes`, `merge/merges`, nesta ordem; tipo com zero não aparece). No "não sei", o `alt` diz a razão: `não consegui conferir agora` ou `a última conferência é de há N min`.
- **Por que os motivos não aparecem aqui:** com o aviso desligado, o operador não disse que quer reiniciar; a lista ficaria parada no topo do pane quase o dia todo. Ao ligar o aviso, o bloco abaixo os mostra.

**Aviso ligado** (bloco emoldurado, a mesma anatomia do `modoSvg`: retângulo `rx 8`, traço 1,5, título 13 px / 700, linhas 12 px):

```
╭──────────────────────────────────────╮
│ ⏻ Espere · 6 rodando                 │   ← moldura `ans` (azul: em curso); ⏻ em `m`; a resposta abre o título
│ · merge/rebase no meio: gh pr merge… │   ← até 4 motivos, 12 px `s`, uma linha cada, corte no fim
│ · teste de izanagi em apps/web (2 f… │
│ · esta sessão trabalhando            │
│ · E2 · tela do painel trabalhando    │
│ + 2 mais · conferido às 21:14 · aviso ligado │   ← 12 px `m`
╰──────────────────────────────────────╯
[ Não avisar mais ]
```
```
╭──────────────────────────────────────╮
│ ⏻ Pode reiniciar o app               │   ← moldura `oks`; título em `ok`
│ nada rodando · conferido às 21:31    │
│ avisei às 21:31                      │   ← `m`
╰──────────────────────────────────────╯
[ Não avisar mais ]
```

- **A ordem dos motivos:** merge, depois teste, depois sessão (do que mais dói interromper para o que menos dói); dentro do tipo, a ordem que o comando der. O texto de cada um é o da parte A, sem reescrever; a própria sessão do pane vira `esta sessão trabalhando`.
- **Até 4 motivos**, cada um numa linha com corte no fim (`caber`); o resto vira `+ N mais` na linha da hora. O `alt` do bloco lê **todos**, inteiros: `Aviso de reinício ligado: 6 rodando — merge/rebase no meio: …; teste de …; …; conferido às 21:14.`
- **Acabou de ligar** (até a 1ª conferência da vigia): moldura `ms`, título `⏻ Aviso ligado · conferindo`, linha `a primeira conferência sai em instantes` (mock, quadro 6).
- **Sem dado fresco com o aviso ligado:** moldura `ms`, título `⏻ Não sei · aviso ligado`, linha `a última conferência é de há N min` ou `não consegui conferir agora`.
- **`Não avisar mais`** é secundário, abaixo do bloco, à esquerda, como o botão do modo.

**No terminal** (o pane de `Text`), a mesma ordem sem moldura (mock, quadro 7): o `⏻` em `subtle` (espere, não sei, conferindo) ou `success` (pode), as mesmas cores da barra; título em `bold`, motivos e hora `dimColor` com `wrap="truncate-end"`; o `Me avise` na mesma linha, o `Não avisar mais` abaixo do bloco.

## Mensagens

| Mensagem | Lugar | Duração | Tom | Quem vê |
|---|---|---|---|---|
| `Reiniciar: espere · N rodando` (contagem por tipo no `alt`) | pane, topo | enquanto não pode | `neutro` | o operador |
| `Pode reiniciar o app · conferido às HH:MM` | pane, topo | enquanto pode e o dado é fresco | `ok` | idem |
| `Reiniciar: não sei` (a razão no `alt`) | pane, topo | até a próxima conferência boa | `alheio` | idem |
| `Espere · N rodando` + motivos + `aviso ligado` | pane, bloco | enquanto o aviso está ligado e não pode | `espera` | idem |
| `Aviso ligado · conferindo` + `a primeira conferência sai em instantes` | pane, bloco (`ms`) | do clique até a 1ª conferência | `espera` | idem |
| `Não sei · aviso ligado` + a razão | pane, bloco (`ms`) | aviso ligado sem dado fresco | `alheio` | idem |
| `⏻ N rodando` | barra de toda sessão | idem | `espera` | idem |
| `⏻ Pode reiniciar` | barra de toda sessão | enquanto pode, com o aviso ligado | `ok` | idem |
| `⏻ conferindo` | barra de toda sessão | do clique até a 1ª conferência | `espera` | idem |
| `⏻ não sei` | barra de toda sessão | aviso ligado sem dado fresco | `alheio` | idem |
| Notificação: título `Pode reiniciar o app`, corpo `Nenhuma sessão trabalhando, nenhum teste nem merge rodando (HH:MM).` | `PushNotification`, `status: proactive`; recusada ou com erro, o mesmo texto em toast na sessão que vigia (o padrão do `avisarCache`) | uma vez por "passou a poder" | `ok` | idem |
| `Ligando…` · `Desligando…` | no botão, onde clicou | do clique até gravar | `espera` | idem |
| `Aviso ligado. A notificação chega quando der para reiniciar o app.` | toast | some sozinho | `neutro` | idem |
| `Não consegui ligar o aviso (<motivo>).` · `Não consegui desligar o aviso (<motivo>).` | toast + faixa "Ação não concluída" do pane (`avisar`) | toast some; a faixa até limpar | `ruim` | idem |

Nenhum texto cita item, revisão ou comando: `painel pode-reiniciar` não aparece na tela.

## Regiões e componentes

| Região | Componentes | Peça nova? |
|---|---|---|
| Barra, peça do reinício | `Text` com filho `Text color` no glifo; `pecasDaBarra` ganha `{ k: 'reinicio', t }` no começo de `dir`; `larguraDaFaixa` reserva `⏻ Pode reiniciar`; `EstadoBarra` ganha `reinicio: 'esperando' \| 'pode' \| 'sem-dado' \| null` e `rodando: number` | Não. Constante `GLIFO_REINICIO` (`{ g: '⏻', esperando: 'subtle', pode: 'success', semDado: 'subtle' }`) ao lado do `GLIFO` da base, para o teste comparar desenho e constante |
| Pane desktop, bloco | **`reinicioSvg(W, r, agora)`** em `desenho.ts`: as três formas sem aviso (a linha de 20 px; o `Me avise` é `Button` ao lado, fora do SVG) e as quatro com aviso (bloco emoldurado do `modoSvg`: espere, pode, conferindo, não sei) | **Sim**, no kit do pane (`desenho.ts`), com teste próprio: altura por estado, corte dos motivos em 4 + `+ N mais`, `alt` com todos e com a contagem por tipo |
| Pane desktop, botões | `Button` secundário, como o `botaoModo` | Não |
| Pane terminal | `Text`, `Box`, `Button` | Não |
| Julgamento na tela | **`estadoDoReinicio({ arquivo, aviso, eu, trabalhandoEu, agora })`**, função pura em `barra.tsx`: aplica a [régua de idade](#idade), tira o motivo da própria sessão do arquivo e põe o dela ao vivo, e devolve `{ estado: 'pode' | 'espere' | 'conferindo' | 'sem-dado', rodando, motivos, conferidoEm }` (`conferindo` só com o aviso ligado há menos tempo que a 1ª conferência dele); barra e pane leem dela | **Sim** (função, não componente), com teste próprio |

## Estados

<a id="idade"></a>
### A idade do dado (pergunta 2 do plano)

O erro caro é dizer **"pode"** com dado velho: reiniciar derruba trabalho que começou depois da conferência. Dizer "espere" a mais só atrasa. Por isso a régua é assimétrica:

- **"Pode" exige a lista de sessões com até 2 min** (o instante da lista, `listaEm`, não o do arquivo: a lista da batida pode ter até 10 min quando o arquivo é gravado) **e o arquivo com até 2 min.**
- **"Espere" vale com o arquivo até 15 min**: a batida grava a cada 10 min, e um "não pode" de 15 min ainda é a melhor aposta.
- **Fora disso, "não sei"**, a mesma palavra na barra (`⏻ não sei`) e no pane. Nunca "pode". `⏻ conferindo` é outra coisa: só do clique em `Me avise` até a 1ª conferência da vigia.
- **A própria sessão é ao vivo:** quem desenha sabe se ela mesma está com turno (`isWorking`). O motivo dela que estiver no arquivo sai, e entra o de agora (`esta sessão trabalhando`). Assim a barra da sessão que está trabalhando nunca diz "pode", e a da sessão parada não espera por si mesma.

Sem o aviso, quem mantém o arquivo fresco é o pane aberto (cada leitura) e a batida (10 min): com o pane fechado o "pode" dificilmente é fresco, e é por isso que a barra não fala sem o aviso. Com o aviso ligado, quem mantém é a **vigia** (abaixo).

<a id="aviso"></a>
### O "me avise" (pergunta 3 do plano)

| Estado | O que acontece |
|---|---|
| desligado | pane: a linha (com o `Me avise` quando não pode ou não sei); barra: nada |
| clicou `Me avise` | no mesmo render: o bloco vira "Aviso ligado · conferindo", o botão `Ligando…` (cliques ignorados); grava `batida/aviso-de-reinicio.json` com `ligadoEm` e `vigia` = esta sessão; gravou → toast `Aviso ligado…` e a vigia confere já; falhou → volta ao estado de antes, toast e faixa do pane |
| esperando | a vigia (o mod da sessão que ligou) roda o julgamento com a lista fresca **a cada 60 s** e grava o `pode-reiniciar.json`; barras e pane mostram `N rodando` |
| passou a poder | a vigia manda a notificação **uma vez**, grava `avisadoEm`; barras e pane mostram "pode" (≤ 30 s depois, na próxima leitura de cada barra) |
| voltou a não poder depois do aviso | volta a "esperando" e **rearma**: avisa de novo na próxima vez que puder. Para não piscar, rearmar pede dois "não pode" seguidos (dois minutos) |
| clicou `Não avisar mais` | no mesmo render: o bloco volta à linha do estado sem aviso, e o botão mostra `Desligando…` com os cliques ignorados; apaga `aviso-de-reinicio.json`; apagou → nada mais (as barras voltam ao silêncio na próxima leitura); falhou → o bloco volta, toast `Não consegui desligar o aviso (<motivo>).` e a faixa "Ação não concluída" (`avisar`) |
| o app reiniciou | o mod que carrega e acha o aviso com `avisadoEm` o apaga: o reinício foi o fim natural do aviso. A barra não mostra `⏻ Pode reiniciar` logo depois de reiniciar |
| 30 min depois do aviso, ainda pode e ninguém reiniciou | o aviso desliga sozinho, sem nova notificação: o operador seguiu em frente |
| a sessão vigia sumiu (arquivada, app fechado) | o arquivo envelhece; passados 3 min sem conferência com o aviso ligado, o mod da próxima sessão que ler assume a vigia (grava `vigia` = ela). Enquanto ninguém assume, barra e pane dizem `não sei` |
| turno rodando na sessão vigia | a vigia confere igual (é o mod, não o turno); ela mesma entra como `esta sessão trabalhando` |

- **Sem teto enquanto espera:** o operador pediu e pode demorar uma hora até o pool parar. Desliga quem pediu.
- **A notificação é o canal, o destaque na barra é o reforço:** a notificação chega mesmo com o app atrás de outra janela; a barra serve a quem já está olhando a conversa e a quem voltou depois de a notificação sumir.

### O resto

| Estado | Barra | Pane |
|---|---|---|
| antes da 1ª leitura | nada (como hoje) | nada: o bloco só nasce depois de ler |
| `pode-reiniciar.json` ausente | sem aviso: nada; com aviso: `⏻ não sei` (ou `⏻ conferindo` logo depois do clique) | `não sei`, `alt` `ainda não conferi` |
| arquivo ilegível | igual ao ausente | `não sei`; o erro vai para "Não consegui ler tudo", como o das outras leituras |
| comando falhou no pane | — | `não sei`, `alt` `não consegui conferir agora`; o motivo vai para "Não consegui ler tudo" |
| `aviso-de-reinicio.json` ilegível | sem aviso (silêncio) | sem aviso; o erro vai para "Não consegui ler tudo" |

## Movimento

Nenhum. Barra e pane trocam por redesenho, sem transição (o motor não anima). Com `prefers-reduced-motion`, nada muda.

## O que sai

- **Da conversa:** a pergunta "posso reiniciar?" feita à orquestradora e a conferência à mão dela (lista de sessões, fichas, `ps`); a skill `orquestradora` passa a mandar olhar o pane (passo 4 do plano).
- **Do desenho proposto:** o "pode reiniciar" permanente na barra e o botão de ligar o aviso na barra (ver o [inventário](#hierarquia)); a lista de motivos com o aviso desligado.
- **Da barra, com o aviso ligado:** na orquestradora a 114 células, o `☾ Ficar ausente` presente e o `◨` (por queda de faixa, enquanto o aviso dura).

## Decisões ao operador

Nenhuma trava a execução; todas são *assumidas, a confirmar*, reversíveis com troca de constante.

- **A barra só fala com o aviso ligado.**
  - *O caso:* a barra de toda sessão poderia mostrar sempre "pode reiniciar" (ou "espere"). Proponho que ela só mostre alguma coisa depois que você pedir o aviso no painel; sem o pedido, a resposta fica no painel.
  - *Se não decidir:* só com o aviso.
  - *Recomendação:* só com o aviso. Quase o dia inteiro a resposta é "espere", e uma peça parada na barra de toda sessão seria ruído para quem não quer reiniciar.
- **O "pode" só com dado de até 2 min.**
  - *O caso:* o "pode" vem de uma conferência das sessões, dos testes e dos merges. Se a conferência é velha, alguma coisa pode ter começado depois. Proponho mostrar "pode" só com conferência de até 2 min; "espere" vale até 15 min; fora disso, "não sei".
  - *Se não decidir:* 2 min e 15 min.
  - *Recomendação:* esses dois números. Reiniciar com dado velho derruba trabalho; esperar um minuto a mais não custa nada.
- **O aviso avisa de novo se voltar a não poder.**
  - *O caso:* o plano fala em "aviso único". Se, depois da notificação, alguma sessão volta a trabalhar antes de você reiniciar, o aviso volta a esperar e notifica de novo quando puder (no máximo uma vez a cada "passou a poder", com dois minutos de margem para não piscar).
  - *Se não decidir:* rearma.
  - *Recomendação:* rearmar. Sem isso, uma notificação velha diria "pode" e a barra diria "espere", e você teria de lembrar de pedir de novo.
- **A linha do reinício fica sempre no topo do pane.**
  - *O caso:* uma linha discreta entre o modo ausente e o resumo, com o botão `Me avise` ao lado, mesmo sem você querer reiniciar.
  - *Se não decidir:* fica.
  - *Recomendação:* fica. É o único lugar com a resposta fresca, e o botão do aviso precisa morar em algum lugar; uma linha apagada é o preço.

<a id="pendencias"></a>
## Pendências à planejadora (o contrato da parte A)

A parte B precisa de três coisas que o plano da parte A não diz. Vão *assumidas*: a E implementa assim, salvo resposta contrária.

- **C1 · O arquivo guarda todos os motivos.** O plano exclui a própria sessão do julgamento. Na saída do comando, isso está certo (quem pergunta está, ele mesmo, com turno). No **arquivo**, não: a barra das outras sessões leria "pode" sem saber que a sessão que gravou estava trabalhando. Proposta: o comando grava em `pode-reiniciar.json` todos os motivos, a sessão que rodou incluída, cada motivo de sessão com `localId`; só a saída em texto e `--json` a exclui. Quem desenha tira o próprio `localId` e põe o próprio estado ao vivo ([§Idade](#idade)).
- **C2 · O instante da lista no arquivo.** `listaEm` (ISO) ao lado de `em`: a régua do "pode" mede a idade da lista, e `idadeMin` arredondado não basta para 2 min.
- **C3 · A vigia e o arquivo do aviso.** `batida/aviso-de-reinicio.json` (`ligadoEm`, `vigia`, `avisadoEm?`, `naoPodeSeguidos`), gravado pelo pane e pela vigia; a vigia roda o julgamento com `list_sessions` a cada 60 s **só enquanto o aviso está ligado**, no mod de uma sessão só. Isso não fere a regra "a barra não chama `list_sessions`": quem chama é o mod da sessão que pediu o aviso, como o pane aberto faz hoje, e por minutos.

## Gestos para a auditoria de clique (E)

- `Me avise`: clique → bloco otimista + `Ligando…` → grava `aviso-de-reinicio.json` → vigia confere → barra das outras sessões mostra `⏻ N rodando` em ≤ 30 s; e a falha (não grava → volta + toast + faixa).
- `Não avisar mais`: clique → o bloco volta à linha na hora + `Desligando…` → apaga o arquivo → barras em silêncio; e a falha (não apaga → o bloco volta + toast + faixa).
- A notificação: forçar "pode" com `PODE_REINICIAR_PS` vazio, lista sem `isRunning` e fichas vazias → uma notificação; segunda volta ainda "pode" → nenhuma; dois "não pode" e "pode" de novo → mais uma.

<a id="critica"></a>
## Crítica

**Rodada 1 (crítico de UI, contexto separado): 25/30, aprovada com ressalvas**, hierarquia 4 · densidade 4 · consistência 4 · ruído 4 · ação primária 5 · aderência 4. Sem ressalva alta. O crítico refez as somas das faixas (membro 114 / 94 / 37 na base, +17 com a peça) e mediu as linhas do mock (114, 140, 126 e 40 células exatas). As cinco ressalvas são de texto e de mock e foram aplicadas sem nova rodada, para a E não receber doc e mock em desacordo:

| Problema | Peso | O que mudou |
|---|---|---|
| P1 · o "espere" sem aviso ocupava ~64 px no topo do pane quase o dia todo | média | uma linha de 20 px com `Me avise` ao lado; a contagem por tipo no `alt` |
| P2 · o mesmo estado era `conferindo` na barra e `não sei` no pane, e `conferindo` aparecia com a vigia morta | média | `⏻ não sei` sem dado fresco; `⏻ conferindo` só do clique à 1ª conferência; `estadoDoReinicio` com os dois |
| P3 · o `Não avisar mais` não tinha efeito otimista nem desfecho de falha | média | o bloco volta à linha na hora; a falha desfaz com toast e faixa; dito no gesto da auditoria |
| P4 · o mock punha a orquestradora a 142 mil na faixa 2, onde ela soma 113 e cabe na 1 | média | o mock passa a 198 mil (`· limpar`); a queda para a faixa 2 fica condicionada à palavra; o teste cobre os dois casos |
| P5 · com o aviso ligado o título abria com o estado do aviso, não com a resposta; cor do `⏻` diferente entre barra e terminal; "acabou de ligar" só no mock | baixa | título `⏻ Espere · N rodando`, `aviso ligado` na linha da hora; `⏻` em `subtle` nas duas; o "acabou de ligar" e o "não sei" com aviso nas mensagens |

Ficaram de fora, por decisão do crítico (o desfecho já aparece na barra de toda sessão): o toast `Aviso ligado…` repete o bloco otimista; a notificação recusada vira toast só na sessão que vigia.
