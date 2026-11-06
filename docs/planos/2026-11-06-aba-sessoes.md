# Plano — aba "Sessões" na aba do kit no Orca (F452)

Pedido do operador (06/11): uma seção nova na aba do kit no Orca que mostra, por projeto, o que cada sessão está fazendo (trabalhando, validando, na fila de merge, mergeando, esperando o operador, parada/travada, entregue), com o nome da sessão além do `F<n>`, cartão compacto que abre e as etapas em bolinhas (feito / agora / falta).

## O que medi (06/11, ~10:15 SP)

| Dado | Fonte | Existe? | Observação |
|---|---|---|---|
| Item, título, projeto, tema | `painel/fila/F<n>.json` (`titulo`, `projeto`, `tema`) | sim | O título não cita o `F<n>` (o `painel` recusa): o nome da sessão é `F<n> · <titulo>`, como o pane mostra. |
| Etapa | `batida/deduzido.json` → `itens[F<n>].etapa` (deduzida do gh/git; cai no declarado do item) | sim | `planejamento` · `design` · `execucao` · `validacao` · `merge` · `feito` · `descartado`. A batida reescreve o arquivo a cada ~1 min; só itens vivos. |
| O que faz agora | item `agora` (uma linha) e `com[].oQue` | sim, opcional | Texto livre da dona; nem sempre em dia (a regra é gravar só a etapa). |
| PRs abertos / mergeados | `deduzido.json` → `prsAbertos`, `prsMergeados` | sim | Deduzidos do gh pela batida: a aba não chama o gh. |
| Fatia | item `maisFatias` (booleano) + `deduzido.fatiaMergeada` | **parcial** | Dá "fatia k" (k = PRs mergeados + 1) mas não o total nem o nome das próximas. |
| Dona viva | `deduzido.donaViva` (Orca: pela lista de workers; app: lista de sessões) | sim | `null` = sem dona ou fora da vista. Dona do Orca não tem `rodando` (o turno não é visível): `rodando` só vale para sessão do app. |
| Parado | `deduzido.parado` + `minParado` | sim | Conta a partir da última marca (item, git, PR). Para dona do Orca a marca é quase só o `atualizadoEm`: "parado" nela é fraco. |
| Travado | item `trava` `{motivo, texto}` (`conflito` · `gate-vermelho` · `acesso` · `operador` · `outra`) | sim | |
| Esperando | item `espera` `{motivo, texto}` (`operador` · `gate`) | sim | |
| Esperando o operador com Q-ID | item `perguntas` (lista de `Q<n>`) × `painel/perguntas/Q<n>.json` com `estado: aberta` | sim | O worker já lê as perguntas abertas (`lerPerguntas`); basta cruzar pelo `item`. |
| Na fila de merge / mergeando | `fila-de-merge/<projeto>.json`: `pendentes` (anotados, esperando a rodada), `emVoo` (`{pr, sha}` no gate agora), `ocupada` (`{pid, desde, gate}`) | sim | PR em `emVoo` com `ocupada` = mergeando (gate rodando); em `pendentes` = na fila; etapa `merge` com PR aberto fora dos dois = PR aberto, ainda não anotado. |
| Estado do worker no Orca | `orca orchestration worker-list --json` (o worker já chama, cache 60 s): `state` `ready`/`succeeded`/`failed`, `liveness`, `terminal` | sim | Liga ao item por `orca-sessoes/<id>.json` (`orcaId` → `terminal`) ou pelo `workspace` (pasta) × `cwd`. `succeeded` = a dona mandou `worker_done` (PR pronto). |
| Entregue | item em `feito` com `entrega.resultado` | sim | A seção Entregas já lista; aqui só o item fechado recente (hoje) aparece, compacto. |
| Orquestradora do projeto | `batida/<projeto>.json` → `orquestradora` (id ou `null`) | sim | Opcional no cabeçalho do grupo. |

**Não há** API do host do plugin que dê o título da sessão nem a atividade do agente do Orca (`terminal list` só traz os terminais de shell; `worker-show` dá `stage`, `waitingOnHuman: unknown`). Nada disso é necessário: o nome vem do item.

## O que falta gravar

Só o plano das fatias. Proposta mínima (ADR a reservar): campo opcional `fatias` no item — lista de nomes curtos (até 12, cada um até 60 caracteres, sem citar item nem PR), gravada pela dona ao planejar um item em várias fatias. As feitas **se deduzem** (PRs mergeados do item, como a batida já conta), não se declaram: `feitas = min(prsMergeados, fatias.length)`, a atual é a seguinte. Sem o campo, a aba mostra "fatia k" (sem total) quando `maisFatias` está ligado, e as bolinhas seguem as etapas do item.

## Corte

- **Fatia única** (um PR): núcleo `.mjs` que monta a vista das sessões (puro, testado em `node --test`), leitura no worker (`kit.ler` ganha `sessoes`), a seção no `panel.tsx`, testes do painel e do worker, o campo `fatias` validado no `painel.mjs` + ADR + linha no `dona.md`/`referencia.md`.
