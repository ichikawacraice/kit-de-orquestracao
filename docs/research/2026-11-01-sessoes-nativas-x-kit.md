# Sessões nativas do Claude (threads, sessão coordenadora) × o kit de orquestração

Snapshot de 2026-11-01. Fontes acessadas em 2026-11-01; pesquisa envelhece, confira a data antes de confiar. O código do kit lido é o da `origin/main` em `7be168e` (orquestracao 0.1.78, painel-sessoes 0.9.16). Claude Code medido: CLI 2.1.316, app desktop (aba Code) nesta data.

Pedido do operador (01/11): o Claude ganhou "threads" e uma "sessão mestra" que parecem fazer, de forma nativa, o que o kit faz; levantar o que esses recursos fazem e como usá-los para melhorar a orquestração.

Legenda: **[doc]** = está na documentação oficial (fonte numerada); **[obs]** = observado nas ferramentas e instruções que o app desktop entrega a uma sessão nesta data, sem página pública que o descreva; **[inf]** = inferência nossa; **[não confirmado]** = só fonte de terceiros.

<a id="resposta-curta"></a>
## A resposta curta

- **"Threads" e "sessão mestra" são o Claude Projects reformulado** [doc 1][2]: uma conversa longa em que o Claude é o **coordenador** e abre uma **thread** (uma sessão inteira, com contexto próprio) por tarefa; cada thread trabalha na própria branch, abre PR, vigia o PR com auto-fix e reporta à conversa. Um painel **Overview** agrupa as threads por estado (*Waiting on you*, *Working*, *Ready for review*, *Landing*, *Idle*, *Resolved*). Beta público desde 17/09/2026, nos planos Pro, Max e Ultra, só no claude.ai/code, no app desktop e no celular — não no CLI.
- **É o desenho do kit**, quase peça por peça: a conversa do projeto é a orquestradora, a thread é a dona, as instruções do projeto são o protocolo, a memória do projeto é o handoff, o Overview é o pane do painel.
- **Mas o Projects não roda o kit:** a thread na nuvem não vê a máquina local, onde mora o estado do kit (`~/.claude/orquestracao/`: painel, contadores, fichas de núcleo, fila de merge); não carrega `.claude/settings.json`, skills nem `.mcp.json` do repositório, e os hooks do `settings.json` do repositório "Not run" [doc 1, "What threads pick up"]. Se os hooks de um **plugin** adicionado em *Project settings > Plugins* rodam na thread **[não confirmado]**: nenhuma fonte diz. Teto de núcleos, gate local, fila de merge sobre a combinação e pane ficam de fora de qualquer jeito. A thread local (por Remote Control) usa a configuração da máquina, hooks incluídos, mas é exceção, sem memória do projeto carregada e em "auto mode" [doc 1, "Run a thread on your own computer"].
- **O que o kit já usa, e é nativo, é outra família:** as **sessões ligadas do app desktop** (`start_session`, avisos de fim de turno da sessão filha, `list_sessions {linked:true}`, mensagens entre sessões). Aí está o que dá para aproveitar já, com ganhos modestos: o kit chegou antes do nativo e cobre quase tudo o que ele oferece.
- **Recomendação:** não migrar para o Projects agora; **adotar** `sync_with_base_branch` na devolução por conflito e o aviso de fim de turno como segundo sinal (antes da batida); **medir** antes de mexer no arquivamento automático e na trava do modo ausente, que o app cobre só em parte; **não adotar** o Auto-fix no fluxo da fila; **manter** fila de merge, teto de núcleos, testes afetados, Q-IDs e as travas de critério; **pilotar** o Projects com um projeto pequeno quando a thread local estiver madura. Detalhe em [Recomendações](#recomendacoes).

<a id="o-que-existe"></a>
## O que existe hoje (01/11/2026)

A doc oficial agrupa em cinco maneiras de rodar trabalho em paralelo [doc 3]: subagentes, agent view, agent teams, dynamic workflows e projects; mais três apoios: worktrees, mensagens entre sessões e `/batch`.

| Recurso | O que faz | Estado | Onde roda | Fonte |
|---|---|---|---|---|
| **Projects** (coordenador + threads) | Conversa coordenadora abre e acompanha threads; instruções e memória do projeto chegam a toda thread; Overview por estado | Beta público (Pro, Max, Ultra), liberação gradual | claude.ai/code, app desktop, celular; threads na nuvem, ou locais por Remote Control | [doc 1][2] |
| **Sessões ligadas do app desktop** | Uma sessão abre outras (`start_session`), recebe o relatório delas ao fim de cada turno, lista a família, troca mensagens | Disponível | App desktop, aba Code (locais, SSH, WSL) | [doc 4 "Start a task that Claude suggests"; obs] |
| **Mensagens entre sessões** (`SendMessage`, `ListAgents`) | Texto de uma sessão para outra, na mesma máquina, em outra ou na nuvem; aviso único quando a outra fica ociosa | Disponível (CLI ≥ 2.1.224) | CLI e app | [doc 5] |
| **Agent view** (`claude agents`) | Uma tela para despachar e acompanhar sessões em segundo plano; cada uma vai para um worktree antes de editar; rótulo do PR colorido pelo estado | Prévia de pesquisa | Só CLI, local | [doc 6] |
| **Agent teams** | Uma sessão líder cria colegas (sessões inteiras), lista de tarefas compartilhada, mensagens diretas; hooks `TeammateIdle`, `TaskCreated`, `TaskCompleted` | Experimental, desligado por padrão (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`) | Local ou dentro de uma sessão na nuvem | [doc 7] |
| **Dynamic workflows** (`Workflow`) | Script que orquestra dezenas de subagentes; o plano fica no código, retomável | Disponível | Dentro de uma sessão | [doc 8] |
| **Monitor de PR no desktop** | **Auto-fix** (conserta CI vermelho e responde a comentário de revisão de outra pessoa; no Projects o cartão também oferece *Resolve conflicts*), **Merge when ready** (auto-merge do GitHub, squash, respeita merge queue), **auto-archive** depois do merge ou do fechamento | Disponível | Sessões locais (SSH/WSL sem Merge when ready) | [doc 4 "Monitor pull request status", "Archive a session"] |
| **Remote Control** | Liga uma sessão local ao claude.ai e ao celular; é por ele que o Projects roda thread na máquina | Disponível | Local | [doc 1][9] |
| **Scheduled tasks** (ex-routines) | Sessão na nuvem por agenda, chamada de API ou evento do GitHub | Disponível | Nuvem | [doc 10] |
| **Channels** | Servidor MCP empurra mensagem (CI, alerta, webhook) para uma sessão em execução | Prévia de pesquisa | CLI (a página não cita o app) | [doc 11] |

Versão em que cada um apareceu, pelo `CHANGELOG.md` do Claude Code [14] (sem datas no arquivo): agent teams 2.1.32 (hooks `TeammateIdle`/`TaskCompleted` 2.1.33; `TeamCreate` removido na 2.1.178, o time agora é implícito por sessão); `--worktree` 2.1.49 e worktree de subagente 2.1.50; Remote Control 2.1.51; agent view 2.1.139; `Workflow` 2.1.154 (gatilho renomeado para `ultracode` na 2.1.160); mensagens entre sessões 2.1.224 (macOS/Linux); thread local do Projects exige 2.1.280. A sessão medida aqui roda 2.1.316 (31/10/2026).

Uma ressalva de método: o subagente de documentação (`claude-code-guide`) consultado nesta pesquisa respondeu que "não há recurso de thread no Claude Code"; a página oficial do Projects [doc 1] desmente. Quem repetir a pesquisa deve começar por `https://code.claude.com/docs/llms.txt`, que lista a página.

<a id="projects"></a>
### Projects: o que a doc afirma [doc 1]

- **Partes:** a conversa do projeto (o coordenador: decide o que vira thread, acompanha as que abriu e "vê o que as threads reportam, não cada passo") e as threads (cada uma com contexto próprio, uma tarefa, reporta ao terminar). Mensagens com várias tarefas viram várias threads; pergunta rápida é respondida na conversa; trabalho novo vai a uma thread nova **ou à que já trabalha naquela área**.
- **O que toda thread na nuvem recebe:** os repositórios e arquivos do projeto, as instruções do projeto (até 16.000 caracteres), a memória do projeto (`MEMORY.md` e arquivos que o próprio Claude grava), o `CLAUDE.md` de cada repositório, os conectores da conta e o ambiente de nuvem.
- **O que a thread na nuvem não recebe:** skills de `.claude/skills/`, servidores de `.mcp.json`, plugins de `.claude/settings.json` (entram por *Project settings > Plugins*) e **hooks** ("Not run. To use your hooks, run the thread on your own computer").
- **PR:** branch nova a partir da padrão; abre PR quando pedido (ou sozinha para correção concreta); vigia o PR com auto-fix ligado, empurra conserto quando o CI falha, responde a comentário de revisão e avisa quando está pronto. O cartão da thread oferece *Resolve conflicts*, *Fix CI*, *Address comments*, *Merge it*, *Create PR*.
- **Overview:** *Ready for review* (PR aberto esperando revisão), *Waiting on you* (precisa de resposta, aprovação ou falhou), *Working*, *Landing* (PR aprovado ou na fila de merge), *Idle*, *Resolved* (marcada feita por você, pelo Claude depois do último passo — como o merge — ou sozinha depois de uma semana sem atividade). Notificação no desktop quando a conversa posta, uma thread erra ou precisa de você.
- **Modelos:** por padrão Opus em tudo, esforço alto nas threads e baixo no coordenador; dá para trocar por projeto e por tarefa.
- **Contexto:** "você não gerencia janelas de contexto num projeto": threads compactam sozinhas; o coordenador trabalha de mensagens recentes, threads recentes e memória, não do histórico inteiro.
- **Limites ditos pelo próprio usuário** ("no máximo duas threads ao mesmo tempo", "proponha antes de abrir") viram memória, **não teto**: "a thread limit you give this way isn't a hard cap". O único limite imposto: **500 threads novas por dia** somando os projetos.
- **Permissão:** threads em *auto mode*; aprovação pedida fica dentro da thread; a conversa não aprova por ela.
- **Thread local:** pede *Work locally*; roda numa pasta da máquina por Remote Control (CLI ≥ 2.1.280), **com os hooks, permissões e MCP da máquina**, as instruções do projeto **mas não a memória**; para quando a máquina dorme; duas threads na mesma pasta podem se sobrescrever (há opção de worktree).
- **Limitações:** não existe no CLI nem nas IDEs; um projeto é de um usuário só, sem compartilhar; a sandbox da thread pausa entre turnos e, se não retoma, a thread recomeça de um clone novo — "uncommitted changes can be lost"; thread não sai do projeto; sem controle de organização no beta.
- **Custo:** cada thread é uma sessão inteira; thread que vigia PR acorda e gasta quando o CI falha ou chega comentário; cache de 1 h — thread ociosa mais que isso relê a conversa inteira ao receber mensagem.
- **Anúncio** [doc 2] (17/09/2026): coordenador, threads com memória compartilhada e biblioteca de arquivos; modelo e esforço separados para coordenador e threads; "projects can reach usage limits faster". Cobertura de terceiros no mesmo dia [12][13]; o número "200 threads por dia" que circulou em terceiros **[não confirmado]** e a doc atual diz 500.

<a id="sessoes-ligadas"></a>
### Sessões ligadas do app desktop (o que o kit já usa)

A doc pública cobre a superfície do usuário [doc 4]: cartão de tarefa sugerida (*Start*, *Do it here*, *Start all*), a sessão iniciada aparece na barra lateral **aninhada sob a que a abriu**, e o Claude lista, lê e manda mensagem às outras sessões do app ("Work across sessions"; vê as 20 mais recentes, não vê sessões da nuvem nem do CLI). O resto vem das ferramentas que o app entrega à sessão **[obs]**:

- `start_session` com `initiation`: `user_asked` (o operador pediu: abre já), `offer` (cartão "New session / Do it here" que espera a resposta), `own_initiative` (cartão que o operador inicia; expira em uma semana). `context` `fresh` ou `fork`, `model`, `effort`, `permission_mode`, `use_worktree`, `target` local, nuvem ou SSH.
- **Relatório automático ao fim de cada turno da filha:** a sessão que abriu recebe um aviso com os primeiros 400 caracteres do relatório da filha (o resumo do `wrap_up` e a última mensagem) e, se estiver ociosa, é continuada pelo app (`<side-sessions-event>`). `wake_when_done: true` também a acorda se a filha nunca recebeu a tarefa. Depois de muitos avisos seguidos sem mensagem do operador, os avisos esperam o próximo turno.
- **O app recusa abrir sessão** num turno que outra sessão ou um evento automático começou; nesse turno só se propõe o cartão (`own_initiative`). Exceção: o aviso de fim de turno que vem logo depois de um turno do operador.
- `list_sessions {"linked": true}` lista só a família (quem abriu, as filhas, as netas), com `name` e `startedBy`; `get_session "self"` dá o próprio `local_…`, o modelo, o esforço, a branch.
- `hand_off_to_session` move a tarefa em andamento para uma sessão nova (para responder outra coisa); `dismiss_task` retira um cartão.
- `SendMessage` com `notify_when_idle: true`: **um** aviso quando a outra sessão da máquina fica ociosa ou sai; a assinatura expira em 12 h e só a conversa principal a pede [doc 5].
- `start_session`, `hand_off_to_session`, `list_sessions` e o aviso de fim de turno **não têm página pública**: o que está acima vem das descrições das ferramentas. Desenho que dependa deles deve ser testado antes, e pode mudar sem aviso.
- Mensagem recebida chega citada e atribuída (`<cross-session-message from=…>`); a sessão receptora pode recusar ou exigir aprovação (`crossSessionInbound`) [doc 5].
- Barra lateral: seções e grupos (`ccd_sidebar`: criar, mover sessões, fixar, marcar lida), divisão de tela (`open_session_in`), capítulos do transcript (`mark_chapter`), lista de tarefas sob a mensagem (`update_plan`) e caixa de próximo passo com pergunta e botões (`wrap_up`).
- PR: `ccd_pr` (`get_status`, `bind_pr`, `set_monitor` com `auto_fix` e `auto_archive_on_close`, `set_auto_merge`); `sync_with_base_branch` traz a base para o worktree pelo app, e devolve os conflitos para resolver.
- Pasta de notas compartilhada por família de sessões (fora do repositório).

<a id="agent-teams"></a>
### Agent teams [doc 7]

Uma sessão líder abre colegas (sessões inteiras, contexto próprio), com lista de tarefas compartilhada e mensagens diretas entre colegas; o operador fala com qualquer um. Hooks próprios: `TeammateIdle` (sair com 2 mantém o colega trabalhando), `TaskCreated` e `TaskCompleted` (sair com 2 recusa). Limitações declaradas: **experimental**; `/resume` não restaura colegas; status de tarefa atrasa; **um time por sessão, sem times aninhados, líder fixo**; colegas **não ficam em worktree próprio** ("partition the work so each teammate owns a different set of files"); custo de tokens bem maior; com a flag ligada, subagente com nome vira colega sem pedirem.

<a id="agent-view"></a>
### Agent view [doc 6]

`claude agents` no terminal: cada prompt despacha uma sessão em segundo plano; a linha mostra estado (precisa de você, trabalhando, pronta) e o PR com cor (amarelo esperando checks ou revisão, verde passou, roxo mergeado). A sessão vai para um worktree antes de editar, commita e empurra sozinha, abre PR rascunho quando a tarefa pede, nunca empurra na `main`, nunca força, **nunca mergeia**; as instruções de git do `CLAUDE.md` têm precedência. Prévia de pesquisa, só local, só terminal.

<a id="o-kit"></a>
## O que o kit faz hoje (medido em `7be168e`)

- **Modelo** (ADR 0011, 0012): um item, uma sessão dona do plano ao PR; a orquestradora abre a dona (`start_session`), é a fila de merge e faz o release; revisão por subagente `orquestracao:validador` de contexto limpo; no máximo 4 donas (3 com a máquina cheia).
- **Estado** fora do repositório, em `~/.claude/orquestracao/`: painel (coleções `fila`, `sessoes`, `perguntas`, `cartoes`; o `com` é campo da `fila`), contadores únicos de item (`F<n>`) e de pergunta (`Q<n>`), handoff por item, fichas de núcleo, fila de merge pendente, relatório da batida.
- **Travas por hook:** `Stop` — `orquestradora-ritual` (item sem dona, batida parada), `painel-das-sessoes`, `criterio-da-dona` (saída real do teste), `fila-do-item` (gravar o item no turno), `contexto-do-papel` (régua de contexto); `PreToolUse` — `orquestradora-nao-edita`, `subagente-nao-edita`, `travas-da-sessao` (T3 modo ausente, T5 painel só pelo CLI, T6 merge só da orquestradora, T7 limpeza da orquestradora), `segredo-sai`, `titulo-da-dona`; `UserPromptSubmit` — `operador-ausente`, `injecao-entre-sessoes`; `SessionStart` — `sessao-inicio`; `PostToolUse` e `PostToolUseFailure` — `laco-de-comandos`.
- **Fila de merge local:** combinação dos PRs num worktree temporário, gate **uma vez**, repetição única antes de bisseção, lote pela fila ocupada, retomada de fila órfã, `subir-versao` depois do lote.
- **Testes:** `testes-afetados` durante o trabalho (com gatilhos globais e medição de acerto) e teto de núcleos da máquina somando todas as sessões e projetos (`gate/com-fichas.mjs`).
- **Painel (mod `painel-sessoes`):** pane com "Esperam você", "Travados", "Executando", "Na fila", cartões de sessão a abrir, perguntas com Q-ID cuja resposta volta à sessão por `send_message` ao `sessaoId`; a **batida** de 10 min roda no mod (cutuca item parado há 30 min, solta depois de mais 20, relata `merge` parado, vaga de dona e fila de merge parada).
- **Como a orquestradora sabe que a dona terminou:** pela mensagem `PR N pronto, HEAD <sha>`, pelo painel que a dona grava e pela batida. O kit não usa o aviso nativo de fim de turno como sinal (só o reconhece em `operador-ausente.mjs` para não confundir com o operador). `wake_when_done`, `ccd_pr`, `auto_archive_on_close`, `sync_with_base_branch`, seções da barra lateral e Remote Control não aparecem em nenhum arquivo do kit (`grep` em `plugins/`, `docs/`, `cli/`).

<a id="cruzamento"></a>
## Peça por peça: o nativo substitui, complementa ou não cobre

| Peça do kit | Nativo que encosta | Veredito | O que fazer |
|---|---|---|---|
| Abrir a dona (`start_session` + `titulo-da-dona`) | É nativo; Projects faz o mesmo sozinho | Já nativo | Manter; o kit só põe a convenção do título |
| Saber que a dona terminou (mensagem `PR N pronto` + painel + batida) | Aviso de fim de turno da filha com 400 caracteres do relatório; `notify_when_idle`; Overview do Projects | Complementa | A mensagem continua o caminho principal; o aviso entra como segundo sinal ([R1](#r1)) |
| Batida: item parado, dona sumida | Aviso de fim de turno; estado da sessão em `list_sessions`; Projects marca *Resolved* depois de uma semana | Complementa | Manter, com prazo maior depois de medir ([R6](#r6)) |
| Pane do painel (filas, cartões, Esperam você) | Overview do Projects (só nuvem); seções da barra lateral; aninhamento da família | **Não substitui hoje** | Manter; copiar a taxonomia de estados do Overview ([R7](#r7)) |
| Q-IDs e respostas pelo painel | *Waiting on you*, `wrap_up` com botões, `AskUserQuestion` | Não cobre (nada nativo dá ID único entre sessões nem guarda a pergunta) | Manter |
| Fila de merge local, gate na combinação, bisseção | *Merge when ready* (auto-merge do GitHub, respeita merge queue); *Landing* no Projects | **Não cobre** (não há gate local na combinação) | Manter |
| Teto de núcleos e `com-fichas` | Nada | Não cobre | Manter |
| `testes-afetados` | Nada | Não cobre | Manter |
| Arquivar a dona do item fechado | *Auto-archive after PR merge or close*; `set_monitor auto_archive_on_close` por sessão | Cobre em parte, e arquiva também o PR fechado sem merge, que o kit devolve à dona | Medir antes ([R2](#r2)) |
| Devolução por conflito na fila (a dona rebaseia) | `sync_with_base_branch` (o app faz fetch e merge no host) | Complementa | Adotar no passo 7 da dona ([R3](#r3)) |
| PR de release e PR na fila | **Auto-fix** (CI vermelho, comentário de revisão) | Conflita com a fila e com a regra de release vermelho | Não adotar no fluxo ([R4](#r4)) |
| T3 (modo ausente: só o turno do operador abre sessão) | O app já recusa `start_session` em turno começado por outra sessão ou evento automático | Cobre em parte (o app abre sessão no aviso de fim de turno logo depois do operador; a T3 não) | Medir e encolher ([R5](#r5)) |
| `subagente-nao-edita` | `tools:` do agente (validador e explorador já vêm sem Edit/Write) | Não cobre: o hook só dispara em quem chama Edit/Write, então já não pesa nos agentes sem essas ferramentas | Manter |
| `injecao-entre-sessoes` (aviso) | Mensagem chega citada e atribuída; `crossSessionInbound` recusa ou pede aprovação | Complementa; talvez redundante | Medir ([R5](#r5)) |
| `segredo-sai` | Nada equivalente | Não cobre | Manter |
| `criterio-da-dona`, `fila-do-item` (travas de fim de turno) | `TaskCompleted`/`TeammateIdle` em agent teams (mesmo padrão, outro evento) | Não cobre fora de teams | Manter |
| Régua de contexto (`contexto-do-papel`, limpar a 350–500 mil) e handoff do item | Compactação automática; no Projects "você não gerencia contexto"; memória do projeto | Complementa | Manter o handoff (é o estado do item); rever a régua num item à parte, sem pressa |
| Protocolo e `dona.md` como briefing | Instruções do projeto (16.000 caracteres) e memória do projeto | Equivalente no Projects | Se pilotar o Projects, o protocolo vira as instruções ([R8](#r8)) |
| Revisão por subagente, `Workflow` de revisão | Subagentes e dynamic workflows | Já nativo | Manter |
| Agent teams | — | **Não adotar** | Experimental, sem worktree por colega, líder fixo, sem retomar: contraria o ADR 0011 (enxame rejeitado) |
| Agent view | — | Não adotar | Só terminal; o kit vive no app desktop |

<a id="recomendacoes"></a>
## Recomendações (custo, risco, ordem)

Ordem sugerida: R3 e R1 juntos num item pequeno; R5 (medição) em seguida; R2 e R6 depois de medidos; R7 e R8 quando houver folga. R4 fica registrada como não adotar.

<a id="r1"></a>
### R1 — O aviso nativo de fim de turno como segundo sinal, antes da batida (adotar)
- **Hoje** a dona manda `PR N pronto, HEAD <sha>` por mensagem, e a mensagem já abre um turno na orquestradora ociosa [doc 5 "Message delivery"]: no caminho feliz não há espera da batida. O aviso nativo de fim de turno também já chega à orquestradora que abriu a dona, com ou sem o kit **[obs]**.
- **O quê:** a skill `orquestradora` passa a ler o aviso de fim de turno da dona como sinal: se o relatório diz PR aberto e não chegou `PR N pronto`, ela confere o painel e põe na fila; se diz que a dona parou com pergunta, leva ao operador. A mensagem `PR N pronto` **continua** sendo o caminho principal: ela chega a qualquer orquestradora (inclusive a que substituiu a que abriu a dona), e o aviso só chega a quem abriu. A dona escreve `PR N pronto, HEAD <sha>` no começo da mensagem final (o aviso traz os primeiros 400 caracteres do resumo do `wrap_up` e da mensagem final; com o resumo antes, a frase pode sair cortada — por isso ela é reforço, não contrato).
- **Ganho:** pega a dona que abriu o PR e esqueceu a mensagem sem esperar os 30 min da batida. **Custo:** baixo (texto da skill). **Risco:** baixo; avisos ficam represados depois de muitos seguidos sem turno do operador **[obs]**.

<a id="r2"></a>
### R2 — Arquivamento automático pelo app (medir antes; não adotar como está)
- **O nativo arquiva quando o PR mergeia ou fecha** ("merges or closes" [doc 4]; a chave chama `auto_archive_on_close`). O kit devolve à dona o PR fechado sem merge, e sessão arquivada não recebe mensagem [doc 4 "Work across sessions"]: a devolução falharia e a batida soltaria o item (dona arquivada). Item com mais de um PR em `prs` e sem `maisFatias` também só fecha quando todos mergeiam.
- **O que daria para adotar:** ligar só em item de **um PR só**, sem `maisFatias`, e a orquestradora desarquivar (`unarchive_session`) a dona antes de devolver um PR fechado sem merge. Antes, medir se o merge por `gh pr merge` da fila dispara o arquivamento **[inf]**. **Custo:** médio (regra nova na devolução). **Risco:** médio. O ganho é pequeno: a orquestradora já arquiva sozinha, sem perguntar.

<a id="r3"></a>
### R3 — `sync_with_base_branch` na devolução por conflito (adotar, com a regra de rebase revista)
- **O quê:** passo 7 do `dona.md`: quando a fila devolve por conflito, a dona chama `sync_with_base_branch` (o app faz fetch e merge da base no host e lista os conflitos), resolve, roda os afetados e reenvia. Hoje é rebase à mão.
- **Conflito com regra:** a ferramenta faz **merge**, e o kit pede rebase ("Rebase em vez de merge commit quando rebasear") na seção `kit:` do `CLAUDE.md`, que também vai para todo projeto por `modelos/CLAUDE.md` e `kit atualizar`. O squash da fila (`merge --squash` na combinação, `gh pr merge --squash` no merge) apaga o merge commit da branch da dona, então a regra pode ganhar a exceção "ou `sync_with_base_branch`" sem efeito na base — *assumida, a confirmar*.
- **A medir:** qual base o app traz (a padrão do repositório ou a base do PR, que pode ser a integração) **[obs a confirmar]**. **Custo:** baixo-médio (regra no `CLAUDE.md` modelo, `dona.md`, teste que compara os dois). **Risco:** baixo.

<a id="r4"></a>
### R4 — Auto-fix no fluxo da fila (não adotar)
- No PR de trabalho, o conserto do Auto-fix muda a ponta depois do `PR N pronto`, e a fila devolve a ponta que mudou. No PR de release, quem o abre é a orquestradora, que não edita código (`orquestradora-nao-edita.mjs`) e cuja regra para release vermelho é reverter por PR de revert e devolver à dona — o Auto-fix faria o contrário, com o conserto entrando na integração sem fila nem gate.
- Serve fora do fluxo: numa sessão avulsa (hotfix, PR fora da fila) com CI no GitHub, para responder a comentário de revisão humana.

<a id="r5"></a>
### R5 — Medir as travas que o app cobre em parte (item próprio)
- **T3** (`travas-da-sessao.mjs`): o app já recusa abrir sessão em turno que não foi do operador **[obs]**, com uma exceção: o aviso de fim de turno que chega logo depois de um turno do operador **pode** abrir sessão. A T3 recusa também esse caso com o modo ausente ligado. Medir os três turnos (batida, `send_message`, aviso de fim de turno logo depois do operador); se o app recusar os dois primeiros, a T3 encolhe para só o terceiro, em vez de sair. Já há medição parecida no repositório (`docs/planos/2026-10-26-abrir-sessao-pela-fila.md`).
- **`injecao-entre-sessoes`:** comparar com a citação nativa e o `crossSessionInbound`; manter se ainda pegar algo que o app não pega.
- `subagente-nao-edita` **fica como está:** o hook só dispara quando o subagente chama Edit/Write, então já não custa nada para os agentes sem essas ferramentas.
- **Custo:** um item mecânico (Sonnet) com o plano acima. **Risco:** baixo, desde que a medição venha antes de apagar.

<a id="r6"></a>
### R6 — Batida mais lenta (ajustar, depois de medir)
- Com a mensagem `PR N pronto` e o aviso de fim de turno chegando na hora (com ou sem R1), a cutucada de item parado pode ir de 30 para 60 min e a batida de 10 para 20 min. **Custo:** variável de ambiente. **Risco:** baixo; medir uma semana quantas vezes a batida achou algo que nenhum dos dois sinais trouxe.

<a id="r7"></a>
### R7 — Taxonomia de estados do Overview no pane (opcional)
- O pane já tem "Esperam você", "Travados", "Executando", "Na fila". O Overview separa ainda *Ready for review* e *Landing* (na fila de merge) de *Idle* e *Resolved*. Trazer "Na fila de merge" como seção própria deixa claro que a dona ociosa em `merge` não está parada (hoje é uma frase no cartão). **Custo:** médio (tela: passa pelo designer). **Risco:** baixo.

<a id="r8"></a>
### R8 — Piloto do Projects (estudar depois)
- **Por que não migrar agora:** a thread na nuvem não vê `~/.claude/orquestracao/` (painel, contadores, fichas, fila), não carrega o plugin do kit pelo repositório (só por *Project settings > Plugins*, e se os hooks e o pane de um plugin rodam lá é **[não confirmado]**), não tem o teto de núcleos nem a máquina para o gate; limite de threads é preferência, não teto; beta; um usuário só; não existe no CLI.
- **O que daria para testar:** um projeto do Projects para um repositório pequeno, com o protocolo do kit como instruções do projeto e as threads **locais** (Remote Control, que usam a configuração da máquina), medindo: o coordenador respeita "no máximo 4 threads"? a thread local carrega o plugin `orquestracao` e os hooks dele? o Overview substitui o pane para o operador? **Custo:** alto (setup, uma semana de uso, plano consumido mais rápido). **Risco:** médio (auto mode nas threads, memória não carrega na thread local). Vale quando a thread local sair do beta ou quando o operador quiser trabalho rodando com o computador desligado.

<a id="nao-adotar"></a>
### Não adotar
- **Agent teams:** experimental, sem worktree por colega, líder fixo, colegas não sobrevivem a `/resume`; é o "enxame" que o ADR 0011 rejeitou.
- **Agent view:** só terminal; o kit vive no app desktop, que já tem a barra lateral e a família de sessões.

<a id="o-que-o-nativo-nao-faz"></a>
## O que nenhum recurso nativo faz (e é o núcleo do kit)

1. Gate completo **uma vez sobre a combinação** dos PRs, local, com bisseção e repetição contra teste instável.
2. **Teto de núcleos** somando todas as sessões e projetos da máquina.
3. **Testes afetados** com gatilhos globais e acerto medido.
4. **Q-ID único** entre sessões, com a pergunta inteira guardada e a resposta voltando à sessão certa.
5. **Travas** que impõem regra (o limite do Projects é "instructions Claude keeps to, not enforced settings").
6. Estado do item que sobrevive à limpeza de contexto da orquestradora, num formato que o operador lê no pane.

<a id="fontes"></a>
## Fontes

Acessadas em 2026-11-01.

1. Anthropic, *Let Claude coordinate ongoing work with Projects* — https://code.claude.com/docs/en/claude-projects.md
2. Anthropic, *Projects redesigned: from folder to conversation* (17/09/2026) — https://claude.com/resources/articles/projects-redesigned
3. Anthropic, *Run agents in parallel* — https://code.claude.com/docs/en/agents.md
4. Anthropic, *Desktop application* (seções "Monitor pull request status", "Manage sessions", "Work across sessions", "Start a task that Claude suggests") — https://code.claude.com/docs/en/desktop.md
5. Anthropic, *Message your other Claude Code sessions* — https://code.claude.com/docs/en/cross-session-messaging.md
6. Anthropic, *Manage multiple agents with agent view* — https://code.claude.com/docs/en/agent-view.md
7. Anthropic, *Orchestrate teams of Claude Code sessions* — https://code.claude.com/docs/en/agent-teams.md
8. Anthropic, *Orchestrate subagents at scale with dynamic workflows* — https://code.claude.com/docs/en/workflows.md
9. Anthropic, *Continue local sessions from any device with Remote Control* — https://code.claude.com/docs/en/remote-control.md
10. Anthropic, *Automate work with scheduled tasks* — https://code.claude.com/docs/en/routines.md
11. Anthropic, *Push events into a running session with channels* — https://code.claude.com/docs/en/channels.md
12. MarkTechPost, *Anthropic Launches Claude Code Projects in Beta* (17/09/2026) — https://www.marktechpost.com/2026/09/17/anthropic-launches-claude-code-projects-in-beta-parallel-cloud-sessions-that-keep-running-after-you-close-your-laptop/ (terceiro; página recusou leitura, citada pelo resumo da busca)
13. Unite.AI, *Anthropic Redesigns Claude Code Projects to Coordinate Agent Threads* — https://www.unite.ai/anthropic-redesigns-claude-code-projects-to-coordinate-agent-threads/ (terceiro)
14. Anthropic, `CHANGELOG.md` do Claude Code — https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md (lido pelo subagente de documentação)
15. Observação direta **[obs]**: descrições das ferramentas `mcp__ccd_session__*`, `mcp__ccd_session_mgmt__*`, `mcp__ccd_pr__*`, `mcp__ccd_sidebar__*`, `SendMessage`, `ListAgents` e instruções de sistema do app desktop entregues a uma sessão local em 2026-11-01 (CLI 2.1.316).
