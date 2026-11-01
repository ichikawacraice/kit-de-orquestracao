# Travas do kit × o que o app já recusa sozinho (F315)

Data: 2026-11-01. Medição pedida na [R5 do estudo de sessões nativas](2026-11-01-sessoes-nativas-x-kit.md#r5) (Q789): antes de encolher a trava do modo ausente, provar o que o app já recusa e o que só o kit pega. Snapshot datado: o app muda; remeça antes de confiar (ver [Como remedir](#remedir)).

<a id="resumo"></a>
## Resumo

| Trava | Disparos medidos | O app teria barrado sozinho | Recomendação |
|---|---|---|---|
| **T3** (`travas-da-sessao.mjs`, modo ausente) | 10 recusas (7 em conversa, 3 do mod) | 4 de 4 recusas certas; as outras 6 foram erros da T3 | **Manter, corrigida** neste PR: o operador que digita no meio do turno passa a contar |
| **`injecao-entre-sessoes`** (aviso) | 0 avisos em 849 mensagens de outra sessão | — (o app não examina conteúdo) | **Manter**, sem mudança |

- **O app já faz o trabalho da T3 em tudo o que se observou.** Nenhum turno sem o operador abriu sessão de 20/10 a 01/11: o app recusou todos (`peer`, `task-notification`, `sdk`, `plugin`), inclusive o aviso de fim de turno.
- **A exceção prevista na R5 não apareceu.** O estudo supunha que o app abre sessão no aviso de fim de turno logo depois do operador e que só a T3 o barrava. O aviso marcado `human` é outra coisa: o app cola o aviso pendente na frente da mensagem que o operador digitou (301 de 301 casos). O turno é do operador.
- **As 6 recusas que só a T3 fez foram erros.** O operador tinha voltado ("voltar aos trabalhos, confira as sessões…") e a mensagem dele chegou enfileirada no meio de um turno aberto por outra sessão. A T3 lia só a linha que abriu o turno.
- **Por que não remover:** o app documenta a exceção do aviso logo depois do operador, e não há medição para as origens `scheduled` e `system`. A T3 corrigida é barata e não recusou nenhum turno do operador na reprise.

<a id="fontes"></a>
## Fontes e método

- `~/.claude/orquestracao/hooks-crewai.log`: 9.246 linhas, de 23/10 04:12 a 01/11 10:54 (SP: 01:12 a 07:54). Lido, nunca gravado.
- Transcripts em `~/.claude/projects/*/*.jsonl` modificados desde 20/10: cada `mcp__ccd_session__start_session`, quem escreveu no turno em que ele foi chamado e o `tool_result` que voltou (abriu, o app recusou, a T3 recusou).
- `~/.claude/orquestracao/ausencias/`: 13 períodos de modo ausente, de 26/10 a 01/11.
- Scripts de leitura no scratchpad da sessão (não versionados); a lógica de cada um vem descrita junto da saída.

O que o transcript registra, e que a medição usa:
- A linha `user` que abre o turno traz `origin.kind` e/ou `turnOrigin` (`human`, `peer`, `task-notification`, `plugin`, `sdk`).
- O que chega no meio de um turno vira um anexo `queued_command`, com `origin` quando o app deu uma. **É assim que chega o que o operador digita enquanto a sessão trabalha.**
- O aviso de fim de turno de uma sessão aberta antes (`<system-reminder>The session "…" you started …`) chega sozinho marcado `sdk` (só `turnOrigin`) ou colado na frente da mensagem do operador, marcado `human`.

<a id="t3"></a>
## 1. T3: o modo ausente contra a recusa nativa de abrir sessão

### 1a. O que o log do kit registra

```
--- travas-da-sessao por desfecho/regra
 157 viu mcp__ccd_session__start_session
 153 viu mcp__ccd_session_mgmt__clear_session
  19 liberou-limpeza self
   4 recusou T3
   4 perguntou T6
--- T3
2026-10-29T14:15:12.093Z	a420a2f5-…	travas-da-sessao	recusou	T3 sessao mcp__ccd_session__start_session start_session
2026-10-29T14:16:49.851Z	a420a2f5-…	travas-da-sessao	recusou	T3 sessao mcp__ccd_session__start_session start_session
2026-10-29T14:46:37.645Z	a420a2f5-…	travas-da-sessao	recusou	T3 sessao mcp__ccd_session__start_session start_session
2026-11-01T01:03:59.143Z	f58fc2bb-…	travas-da-sessao	recusou	T3 sessao mcp__ccd_session__start_session start_session
```

O log fica abaixo do real. As 6 recusas de 27/10 09:55 (06:55 SP) aparecem nos transcripts, com o texto da T3 no `tool_result`, mas não no log, que não tem nenhuma linha da `travas-da-sessao` nesse minuto. As 3 de 29/10 vêm da sonda do F240 (o mod chamando `start_session` pelo temporizador), não de conversa.

### 1b. O aviso marcado `human` é o operador

Avisos de fim de turno por marca do app, separando o que sobra depois de tirar os `<system-reminder>` e o `<side-sessions-event>`:

```
{
  'linha:sdk TEXTO': 922,
  'linha:sdk vazio': 822,
  'fila:- vazio': 2,
  'linha:human TEXTO': 245,
  'fila:- TEXTO': 102,
  'fila:human TEXTO': 54,
  'fila:human vazio': 2
}
```

Exemplos do que sobra: `linha:human` e `fila:human` trazem a fala do operador ("Q496 - os clientes também veem esses componentes…", "a sessão do ajuste de layout acabou, faça o deploy…"). `linha:sdk` e `fila:-` trazem só outro `<cross-session-message>` ou nada. Os 2 `fila:human vazio` têm uma imagem colada pelo operador. Resultado: 301 de 301 avisos marcados `human` vêm com o operador.

### 1c. Quem escreveu no turno × o que aconteceu

Toda chamada que não é cartão (`initiation` diferente de `own_initiative`) nos transcripts. A coluna `quem` vem da função nova `operadorNoTurno`: `operador` quando há origem `human` na linha que abriu o turno ou em alguma mensagem enfileirada nele; senão, a origem de quem abriu.

```
todas as chamadas (quem → desfecho real):
  233 operador → ABRIU
   14 operador → outro
    6 sem-operador:sdk → APP-RECUSOU
    6 operador → T3-RECUSOU
    5 sem-operador:task-notification → APP-RECUSOU
    4 sem-operador:plugin → outro
    2 operador → SEM-CARTAO
    2 sem-operador:peer → APP-RECUSOU
    1 sem-operador:plugin → APP-RECUSOU
    1 sem-operador:plugin → T3-RECUSOU
```

`outro` é erro de entrada (`background` curto) ou cartão que já não estava pendente; `SEM-CARTAO` é o `offer` respondido com "No card was shown". **Nenhuma chamada sem o operador abriu sessão.** A recusa nativa vem no `tool_result`: *"Start sessions only on the user's own words to you here; this turn runs an automated event, another session's message, or the task another session gave you."*

A mesma recusa vale para o mod. Na sonda do F240, o clique do operador no pane (29/10 21:23, 18:23 SP), com o modo ausente desligado, foi recusado pelo app: `"contexto":"clique","isError":true,"text":"Start sessions only on the user's own words…"`. As 3 recusas que a T3 fez pelo temporizador do mesmo mod, uma hora antes, o app também teria feito. O mod de hoje não chama mais `start_session`: manda o pedido à orquestradora (`textoDoPedidoDeVaga`).

### 1d. O modo ausente, chamada por chamada

As 20 chamadas não-cartão feitas dentro dos 13 períodos de modo ausente, com o que a T3 corrigida faria:

```
2026-10-27T09:55:05 b736f98b quem=operador real=T3-RECUSOU T3-nova=passa
2026-10-27T09:55:10 ac8b62c3 quem=operador real=T3-RECUSOU T3-nova=passa   (×5 até 09:55:29)
2026-10-27T17:19:19 26ea46e7 quem=operador real=ABRIU T3-nova=passa
2026-10-27T18:10:25 859859f4 quem=operador real=ABRIU T3-nova=passa        (×4 até 18:10:51)
2026-10-27T18:20:57 26ea46e7 quem=operador real=ABRIU T3-nova=passa
2026-10-27T18:21:49 859859f4 quem=operador real=ABRIU T3-nova=passa
2026-10-27T19:47:53 154337e1 quem=operador real=ABRIU T3-nova=passa
2026-10-27T21:27:05 3e69766f quem=operador real=ABRIU T3-nova=passa
2026-10-31T04:22:16 71b52df7 quem=operador real=ABRIU T3-nova=passa        (×2)
2026-11-01T01:03:59 f58fc2bb quem=sem-operador:plugin real=T3-RECUSOU T3-nova=NEGA
2026-11-01T01:58:21 f58fc2bb quem=operador real=ABRIU T3-nova=passa
2026-11-01T02:02:59 c881afa0 quem=operador real=ABRIU T3-nova=passa
```

**Às 09:55** os dois turnos abriram com uma fila de mensagens de outras sessões e avisos marcados `sdk`. Às 09:53:56 e 09:54:10 entrou enfileirada a mensagem do operador, marcada `human`, com o aviso pendente na frente: "voltar aos trabalhos, confira as sessões e o painel, tinha pareado por quota". A T3 antiga olhou só a linha que abriu o turno e recusou o operador 6 vezes.

### 1e. Conta da T3

| Recusa da T3 | Quantas | Certa? | O app teria barrado? |
|---|---|---|---|
| Turno de plugin (01/11 01:03) | 1 | Sim | Sim: nenhum turno de plugin abriu sessão (`plugin → APP-RECUSOU`) |
| Temporizador do mod (29/10, sonda F240) | 3 | Sim | Sim: o clique do mesmo mod foi recusado pelo app no mesmo dia |
| Operador enfileirado (27/10 09:55) | 6 | **Não** | — (o operador estava ali) |
| **Total** | **10** | **4** | **4 de 4** |

<a id="t3-mudanca"></a>
### 1f. A correção (neste PR)

`operadorNoTurno` (`pool-comum.mjs`) lê o turno atual inteiro: a linha que o abriu e cada `queued_command` que chegou nele. Devolve `true` quando alguma delas tem origem `human`, `false` quando nenhuma tem, e `null` quando não há turno com origem. A T3, com o modo ausente ligado, recusa tudo o que não é `true`, como antes. A diferença é que o operador que digitou no meio do turno passa a contar. `origemDoTurno` e a T7 não mudam.

- **Fica igual:** o turno de outra sessão, de notificação, de plugin e de aviso sozinho continua recusado, agora pelo app e pela T3. Sem transcript, a T3 também recusa.
- **Muda:** as 6 recusas erradas de 27/10 deixam de acontecer.

<a id="t3-por-que-manter"></a>
### 1g. Por que manter, e não remover

O app recusou todos os turnos sem o operador que se observaram, então remover a T3 não teria aberto nenhuma sessão a mais na janela medida. Ela fica por três motivos:
- **A exceção é documentada, mas não foi observada.** O app documenta que um aviso de fim de turno logo depois do turno do operador pode abrir sessão. Nos dados, o aviso que abriu sessão sempre vinha com a fala do operador, e os 6 turnos `sdk` sem o operador (avisos sozinhos e o "The app was quit while you were working") foram recusados. Mas o caso em que a exceção vale de fato (o operador pede "abra as sessões" e sai, e os avisos dessas sessões chegam depois) é justamente o do modo ausente.
- **Há origens sem medição.** `scheduled` (8 linhas) e `system` (43 linhas meta) aparecem nos transcripts, mas nenhuma chamou `start_session`.
- **O custo é pequeno.** Uma leitura do transcript por chamada de `start_session`, só com o modo ausente ligado.

Para remover, é preciso uma medição que pegue a exceção do aviso logo depois do operador acontecendo: o app abrindo sessão num turno sem o operador. Enquanto ela não aparecer, a T3 repete a recusa do app sem custar nada visível.

<a id="injecao"></a>
## 2. `injecao-entre-sessoes`: o aviso de injeção contra a citação nativa

O hook (UserPromptSubmit) acrescenta uma linha de aviso quando a mensagem de outra sessão casa com um dos 7 padrões de injeção (`varredura-entre-sessoes.mjs`). O app entrega a mensagem citada e atribuída (`<cross-session-message from=… name=…>`, com `origin: {kind: "peer", from, hostInjected, fromMode}`), e a sessão que recebe pode recusar ou pedir aprovação (`crossSessionInbound`). O app não examina o conteúdo.

Disparos no log desde a instalação (25/10): nenhuma linha `injecao-entre-sessoes`. Reprise do mesmo `avisoDoPrompt` do hook sobre todas as mensagens de outra sessão desde 25/10 13:00 (10:00 SP):

```
{
  linha: 702,
  enfileirada: 147,
  avisaria: 0,
  casaNoTextoCru: 1,
  upsDepoisDaLinha: 214,
  upsDepoisDaFila: 54
}
CRU 2026-10-29T14:15 linha exfiltracao tag-em=-1 ini="Another Claude session sent a message:\n<agent-message from=\""
```

- 849 mensagens, 0 avisos: o hook nunca disparou, nem por falso positivo.
- A única mensagem que casa no texto cru é um `<agent-message>` (o retorno de um subagente, formato de 29/10), que o hook não olha. O app já o entrega com moldura própria, dizendo que é saída de modelo, sem autoridade do usuário. Era falso positivo: um laudo de validação que citava "tokens".
- O UserPromptSubmit roda também para a mensagem enfileirada. Conferido em `ac8b62c3` às 09:53: o anexo `hook_additional_context` do evento vem logo depois do `queued_command`. Nenhum caminho de mensagem escapa do hook.
- Formato do prompt que o hook recebe: medido em 25/10 (354 entradas `viu nao-humano <cross-session-message…` do log do `operador-ausente` antigo). Não foi remedido hoje, porque nenhum hook atual registra o começo do prompt.

**Recomendação: manter.** O hook cobre o que o app não faz (olhar o conteúdo), custa um processo Node por prompt e não deu nenhum falso positivo em 849 mensagens. Não há o que encolher: a citação e a atribuição nativas não substituem a varredura do conteúdo.

<a id="limites"></a>
## Limites

- "O app teria barrado" vem de casos parecidos no mesmo período, não de reexecução: a recusa nativa acontece depois do PreToolUse, então a chamada que a T3 recusou nunca chegou ao app.
- A regra exata com que o app decide abrir sessão não está nos transcripts. O que se mede é o desfecho.
- Janela: 20/10 a 01/11, um operador, uma máquina.
- Correção de rota: a primeira versão deste laudo, ainda no mesmo PR, leu o aviso marcado `human` como a exceção nativa e encolhia a T3 para recusar só ele. A revisão por subagente mostrou que esse aviso vem sempre colado à mensagem do operador, e a mudança foi trocada pela correção acima.

<a id="remedir"></a>
## Como remedir

- T3: `grep -P '\ttravas-da-sessao\trecusou\tT3' ~/.claude/orquestracao/hooks-crewai.log` e, nos transcripts, o `tool_result` de cada `start_session` cruzado com quem escreveu no turno (`operadorNoTurno`). Para remover a T3: uma chamada sem o operador que o app deixou abrir.
- `injecao-entre-sessoes`: `grep -c $'\tinjecao-entre-sessoes\tavisou' ~/.claude/orquestracao/hooks-crewai.log`.
- Remedir em 60 dias (até 31/12/2026) ou a cada versão do app que mude as sessões ligadas.
