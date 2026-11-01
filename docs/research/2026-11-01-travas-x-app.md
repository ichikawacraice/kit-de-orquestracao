# Travas do kit × o que o app já recusa sozinho (F315)

Data: 2026-11-01. Medição pedida na [R5 do estudo de sessões nativas](2026-11-01-sessoes-nativas-x-kit.md#r5) (Q789): antes de encolher a trava do modo ausente, provar o que o app já recusa e o que só o kit pega. Snapshot datado: o app muda; remeça antes de confiar (ver [Como remedir](#remedir)).

<a id="resumo"></a>
## Resumo

| Trava | Disparos medidos | O app teria barrado sozinho | Recomendação |
|---|---|---|---|
| **T3** (`travas-da-sessao.mjs`, modo ausente) | 10 recusas (7 em conversa, 3 do mod) | 4 de 10 | **Encolher** — feito neste PR: a T3 passa a recusar só o aviso de fim de turno; o resto fica com o app |
| **`injecao-entre-sessoes`** (aviso) | 0 avisos em 849 mensagens de outra sessão | — (o app não examina conteúdo) | **Manter**, sem mudança |

O achado que mudou o desenho: **a T3 não cobria a exceção que justificava existir.** O app marca com origem `human` o aviso de fim de turno em que ele deixa abrir sessão; a T3 lia só a origem e deixava esse aviso abrir sessão com o modo ausente ligado (2 vezes, 27/10). As 6 recusas que só a T3 fez foram do mesmo aviso, quando ele chegou enfileirado no meio de um turno: a T3 olhava a linha que abriu o turno e não a mensagem que chegou depois. Mesma situação, desfecho oposto conforme o aviso abria o turno ou entrava na fila.

<a id="fontes"></a>
## Fontes e método

- `~/.claude/orquestracao/hooks-crewai.log`: 9.246 linhas, de 23/10 04:12 a 01/11 10:54 (SP: 01:12 a 07:54). Lido, nunca gravado.
- Transcripts em `~/.claude/projects/*/*.jsonl` modificados desde 20/10: cada `mcp__ccd_session__start_session`, a origem do turno em que ele foi chamado e o `tool_result` que voltou (abriu, o app recusou, a T3 recusou).
- `~/.claude/orquestracao/ausencias/`: 13 períodos de modo ausente, de 26/10 a 01/11.
- Scripts de leitura no scratchpad da sessão (não versionados); a lógica de cada um está descrita junto da saída.

O que o transcript registra, e que a medição usa:
- A linha `user` que abre o turno traz `origin.kind` e/ou `turnOrigin` (`human`, `peer`, `task-notification`, `plugin`, `sdk`).
- O que chega no meio de um turno vira um anexo `queued_command`, com `origin` quando o app deu uma.
- O aviso de fim de turno de uma sessão aberta antes (`<system-reminder>The session "…" you started …`, hoje fechado por `</side-sessions-event>`) vem marcado `sdk` (só `turnOrigin`) ou `human` (`origin` e `turnOrigin`).

<a id="t3"></a>
## 1. T3 — o modo ausente contra a recusa nativa de abrir sessão

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

O log subconta: as 6 recusas de 27/10 09:55 (06:55 SP) aparecem nos transcripts (texto da T3 no `tool_result`) mas não no log; o log não tem nenhuma linha da `travas-da-sessao` nesse minuto. As 3 de 29/10 são da sonda do F240 (o mod chamando `start_session` pelo temporizador), não de conversa.

### 1b. O que o app recusou sozinho

Toda chamada que não é cartão (`initiation` diferente de `own_initiative`), feita em turno que não é do operador, desde 20/10. Coluna 3 = desfecho; coluna 4 = as origens dos últimos turnos (`*` = aviso de fim de turno; `QUEUED` = mensagem enfileirada). Recorte da saída:

```
2026-10-23T02:39 6a6d90b1 APP-RECUSOU peer>peer>sdk*>sdk*>sdk*
2026-10-23T13:50 6a6d90b1 APP-RECUSOU sdk*>sdk*>sdk*>sdk*>sdk
2026-10-23T16:58 6a6d90b1 APP-RECUSOU sdk*>sdk>task-notification>human>plugin
2026-10-24T01:44 f80f81a2 APP-RECUSOU sdk>peer>sdk>task-notification
2026-10-27T13:35 0b48e9f1 APP-RECUSOU peer>sdk*>task-notification>task-notification>QUEUED   (×3)
2026-10-27T14:24 26ea46e7 APP-RECUSOU human>sdk   (×2, "The app was quit while you were working")
2026-10-30T15:08 c99c272e APP-RECUSOU human>human>task-notification
2026-10-30T18:24 71b52df7 APP-RECUSOU sdk*>sdk*>sdk*>human>peer
2026-10-30T18:32 f5d8811d SEM-CARTAO  sdk*>peer>QUEUED>QUEUED>QUEUED
```

A recusa vem no `tool_result`, com o texto *"Start sessions only on the user's own words to you here; this turn runs an automated event, another session's message, or the task another session gave you."* Os casos de `peer` que abriram sessão em 26/10 (00:08, 00:11) tinham o operador digitando no meio do turno (anexo `queued_command` com `origin: human`): o app os tratou como turno dele, corretamente.

A mesma recusa vale para o mod: na sonda do F240, o clique do operador no pane (29/10 21:23, 18:23 SP), com o modo ausente desligado, foi recusado pelo app (`"contexto":"clique","isError":true,"text":"Start sessions only on the user's own words…"`). As 3 recusas da T3 pelo temporizador do mesmo mod, 1h antes, o app também teria feito. O mod de hoje não chama mais `start_session` (manda o pedido à orquestradora, `textoDoPedidoDeVaga`).

### 1c. A exceção: o aviso de fim de turno que o app marca `human`

Avisos de fim de turno por origem dada pelo app (linha que abre o turno ou mensagem enfileirada), por dia:

```
2026-10-27 fila:- 37
2026-10-27 fila:human 7
2026-10-27 linha:human 30
2026-10-27 linha:sdk 227
…
2026-11-01 fila:- 8
2026-11-01 linha:human 5
2026-11-01 linha:sdk 75
```

Cerca de 1 em 10 avisos vem marcado `human`: é a exceção nativa (o aviso de uma sessão que o operador pediu deixa abrir a próxima). Em todos os transcripts, chamadas não-cartão por quem abriu o turno (classificação da T3 nova) × desfecho real:

```
  177 operador → ABRIU
   56 aviso → ABRIU
    8 aviso → outro
    6 operador → outro
    6 aviso → T3-RECUSOU
    5 task-notification → APP-RECUSOU
    4 plugin → outro
    3 aviso → APP-RECUSOU
    3 sdk → APP-RECUSOU
    2 operador → SEM-CARTAO
    2 peer → APP-RECUSOU
    1 plugin → APP-RECUSOU
    1 plugin → T3-RECUSOU
```

(`outro` = erro de entrada, como `background` curto, ou cartão que já não estava pendente.) O aviso abre sessão de verdade (56 vezes); `peer`, `task-notification`, `sdk` e `plugin` nunca abriram.

### 1d. O modo ausente, chamada por chamada

As 20 chamadas não-cartão dentro dos 13 períodos de modo ausente: o que a T3 antiga lia, a última origem que o app registrou e o desfecho.

```
  2026-10-27T09:55:05 b736f98b T3-le=sdk     app-ultima=human   (sem)       T3-RECUSOU
  2026-10-27T09:55:10 ac8b62c3 T3-le=sdk     app-ultima=human   user_asked  T3-RECUSOU   (×5 até 09:55:29)
  2026-10-27T17:19:19 26ea46e7 T3-le=human   app-ultima=human   user_asked  ABRIU
  2026-10-27T18:10:25 859859f4 T3-le=human   app-ultima=human   user_asked  ABRIU        (×4 até 18:10:51)
  2026-10-27T18:20:57 26ea46e7 T3-le=human   app-ultima=human   user_asked  ABRIU
  2026-10-27T18:21:49 859859f4 T3-le=human   app-ultima=human   user_asked  ABRIU   ← turno era aviso de fim de turno
  2026-10-27T19:47:53 154337e1 T3-le=human   app-ultima=human   user_asked  ABRIU   ← turno era aviso de fim de turno
  2026-10-27T21:27:05 3e69766f T3-le=human   app-ultima=human   user_asked  ABRIU
  2026-10-31T04:22:16 71b52df7 T3-le=human   app-ultima=human   user_asked  ABRIU        (×2)
  2026-11-01T01:03:59 f58fc2bb T3-le=plugin  app-ultima=plugin  user_asked  T3-RECUSOU
  2026-11-01T01:58:21 f58fc2bb T3-le=human   app-ultima=human   user_asked  ABRIU
  2026-11-01T02:02:59 c881afa0 T3-le=human   app-ultima=human   user_asked  ABRIU
```

O texto dos dois turnos marcados (`18:21:49` e `19:47:53`) começa com `<system-reminder> The session "F176 · …" you started … finished a turn` e `<system-reminder> The session "F191 · …" you started …`: avisos que o app marcou `human`. A T3 antiga os deixou abrir sessão.

Nos 6 de 09:55, o turno abriu com uma fila de mensagens marcadas `sdk` e `peer`, e às 09:53:56 / 09:54:10 entrou enfileirado um aviso marcado `human`: o app teria deixado abrir; a T3 recusou porque olhava a linha que abriu o turno.

### 1e. Conta da T3

| Recusa da T3 | Quantas | O app teria barrado? | Prova |
|---|---|---|---|
| Turno de plugin (01/11 01:03) | 1 | Sim | `plugin → APP-RECUSOU` em 23/10 16:58; nenhum turno de plugin abriu sessão |
| Temporizador do mod (29/10, sonda F240) | 3 | Sim | o clique do mesmo mod foi recusado pelo app no mesmo dia |
| Aviso `human` enfileirado (27/10 09:55) | 6 | Não | o app trata o turno pela última origem; aviso `human` abriu sessão 56 vezes |
| **Total** | **10** | **4** | |

E o que a T3 deixou passar contra a própria regra: 2 avisos `human` que abriram o turno (27/10 18:21 e 19:47).

<a id="t3-mudanca"></a>
### 1f. A mudança (neste PR)

`quemAbreSessao` (`pool-comum.mjs`) lê o turno atual inteiro — a linha que o abriu e cada `queued_command` que chegou nele — e devolve:
- `operador`: alguma entrada com origem `human` que não é aviso e tem texto (ou anexo) além dos `<system-reminder>` iniciais;
- `aviso`: sem o operador, com um aviso de fim de turno (pelo texto, qualquer que seja a marca do app);
- a origem de quem abriu o turno, no resto.

A T3, com o modo ausente ligado, recusa só `aviso`. `operador` passa. O resto passa ao app e deixa a linha `deixou-ao-app T3 <origem>` no log, para remedir sem varrer transcripts.

Reprise da T3 nova sobre o histórico do modo ausente (mesmas 20 chamadas):

```
2026-10-27T09:55:05 b736f98b quem=aviso real=T3-RECUSOU T3-nova=NEGA      (e as 5 de ac8b62c3)
2026-10-27T17:19:19 26ea46e7 quem=operador real=ABRIU T3-nova=passa
2026-10-27T18:21:49 859859f4 quem=aviso real=ABRIU T3-nova=NEGA
2026-10-27T19:47:53 154337e1 quem=aviso real=ABRIU T3-nova=NEGA
2026-11-01T01:03:59 f58fc2bb quem=plugin real=T3-RECUSOU T3-nova=passa   (o app recusa turno de plugin)
… as outras 11, todas operador → passa, como antes
```

Também corrige o caso oposto, que não apareceu nos dados mas a T3 antiga tinha: o operador digita no meio de um turno de outra sessão (mensagem enfileirada `human`) e a T3 recusava, com ele ali.

**O que se perde:** se o app voltar a abrir sessão em turno de outra sessão, de notificação ou de plugin, o modo ausente não segura mais por conta própria. A linha `deixou-ao-app` no log mostra quando isso acontecer. **O que se ganha:** a exceção nativa (aviso `human`) fica coberta nos dois caminhos, e a regra do kit para de repetir a do app.

<a id="injecao"></a>
## 2. `injecao-entre-sessoes` — o aviso de injeção contra a citação nativa

O hook (UserPromptSubmit) acrescenta uma linha de aviso quando a mensagem de outra sessão casa com um dos 7 padrões de injeção (`varredura-entre-sessoes.mjs`). O app, por sua vez, entrega a mensagem citada e atribuída (`<cross-session-message from=… name=…>`, com `origin: {kind: "peer", from, hostInjected, fromMode}`) e a sessão receptora pode recusar ou pedir aprovação (`crossSessionInbound`); o app não examina o conteúdo.

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
- A única que casa no texto cru é um `<agent-message>` (o retorno de um subagente, formato de 29/10), que o hook não olha; o app já o entrega com moldura própria dizendo que é saída de modelo, sem autoridade do usuário. Foi falso positivo (um laudo de validação citando "tokens").
- O UserPromptSubmit roda também para a mensagem enfileirada (anexo `hook_additional_context` do evento logo depois do `queued_command`, conferido em `ac8b62c3` às 09:53): não há caminho de mensagem que escape do hook.
- Formato do prompt que o hook recebe: medido em 25/10 (354 entradas `viu nao-humano <cross-session-message…` do log do `operador-ausente` antigo); não remedido hoje, porque nenhum hook atual registra o começo do prompt.

**Recomendação: manter.** Cobre uma coisa que o app não faz (olhar o conteúdo), custa um processo Node por prompt, e em 849 mensagens não deu um falso positivo. Não há o que encolher: a citação e a atribuição nativas não substituem a varredura do conteúdo.

<a id="limites"></a>
## Limites

- "O app teria barrado" vem de casos parecidos no mesmo período, não de reexecução: a recusa nativa acontece depois do PreToolUse, então a chamada que a T3 recusou nunca chegou ao app.
- A regra exata do app para marcar `human` o aviso não está documentada; os dados mostram avisos `human` depois de turnos de `peer`, `task-notification` e `plugin`, não só logo depois do operador. A T3 nova não depende dessa regra: separa o aviso pelo texto.
- O texto do aviso é do app (`The session "…" you started`, `<side-sessions-event>`). Se ele mudar de formato, a T3 nova deixa de reconhecê-lo e volta a passar (o mesmo que fazia antes com o aviso `human`); o teste usa as formas medidas.
- Janela: 20/10 a 01/11, um operador, uma máquina.

<a id="remedir"></a>
## Como remedir

- T3: `grep -P '\ttravas-da-sessao\t(recusou\tT3|deixou-ao-app)' ~/.claude/orquestracao/hooks-crewai.log`. Uma linha `deixou-ao-app` seguida de sessão aberta (no transcript, `Started session`) é o app deixando passar o que antes recusava: aí a T3 volta a cobrir aquela origem.
- `injecao-entre-sessoes`: `grep -c $'\tinjecao-entre-sessoes\tavisou' ~/.claude/orquestracao/hooks-crewai.log`.
- Remedir em 60 dias (até 31/12/2026) ou a cada versão do app que mude sessões ligadas.
