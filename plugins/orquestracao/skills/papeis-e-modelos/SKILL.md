---
name: papeis-e-modelos
description: Qual modelo e qual papel cada sessão e cada subagente usa — a sessão dona do item em Opus (risco ou decisão) ou Sonnet (mecânico), revisão pelo subagente `orquestracao:validador` de contexto limpo, `orquestracao:explorador` em Haiku só para ler, orquestradora em Opus. Use ANTES de abrir sessão nova (start_session, spawn_task) ou lançar subagente (Agent), ao escrever o briefing de quem vai executar, quando um executor voltar com dúvida, e quando o operador perguntar "qual modelo usar", "abre uma sessão para executar", "manda um agente validar", "planeja e depois executa". Vale em todo projeto; a qualidade vem antes da economia.
---

# Papéis e modelos

O modelo é função do **papel**, não do gosto de quem abre a sessão. A pergunta é sempre: *o que esta sessão ou este agente vai decidir?* Quem decide usa o modelo mais forte; quem cumpre um plano que já decidiu tudo usa o intermediário; quem só lê usa o mais leve. **Qualidade vem antes de economia**: na dúvida entre dois papéis, use o de cima.

<a id="modelo-da-dona"></a>
## O modelo da dona (ADR 0011, 27/10) — vale acima do resto desta skill
- **Uma sessão dona por item, do plano ao PR.** Quem abre a sessão escolhe o modelo pelo risco do item: **Opus 5.5, esforço alto** quando o item decide algo, mexe em contrato (spec, ADR, schema, API, migration), grava estado, toca segurança ou produção; **Sonnet 5.5, esforço médio** quando o item é mecânico e o plano já está escrito (as cinco coisas abaixo). Na dúvida, Opus. A dona planeja, escreve, testa e abre o PR; o manual é `${CLAUDE_PLUGIN_ROOT}/pool/dona.md`. Título da sessão: `F<n> · <tema em palavras do produto>`. A trava de critério (abaixo) também cobra a dona em `execucao`, `validacao` e `merge`.
- **A dona escreve; subagente só lê ou revisa.** `orquestracao:validador` revisa o diff contra o plano antes do PR (só achados que afetam correção, *skip style*; o leve vai ao PR ou ao `depois`, nunca vira item); `orquestracao:explorador` faz varredura larga; item com tela usa `design:revisao-de-arquitetura-de-ui` e `design:critico-de-ui` como subagentes. Nenhuma trava recusa a dona lançar o validador.
- **Sem executora nem validadora em sessão.** A tabela de papéis abaixo, a regra "cada papel na sua sessão" e os níveis Leve/Padrão/Robusta descrevem o pool antigo (só com `KIT_MODELO=papeis`). No modelo da dona, a validação é sempre o subagente `orquestracao:validador` em Opus; item de risco ganha um segundo validador sobre o delta do conserto.
- **Modelo e esforço por item e por subagente:** quem abre a dona escolhe o modelo dela pela classificação do item (a sessão não troca o próprio modelo); a dona escolhe o de cada subagente pelo risco do que ele revisa — tabela e critérios no protocolo, âncora `modelo-e-esforco`. Skills por etapa: âncora `skills-da-etapa` (`skills-da-etapa.mjs <etapa>`).
- **Testes:** só os afetados durante o trabalho (`testes-afetados -- <comando>`); o gate completo roda uma vez, na fila de merge da orquestradora.
- **Contexto:** a dona segue a régua do planejador (tabela em [Contexto](#contexto)).

## Os papéis

| Papel | Modelo | Esforço | Agente (`subagent_type` é `orquestracao:<nome>`) | Faz | Não faz |
|---|---|---|---|---|---|
| **Planejador / orquestrador** | Opus 5.5 | alto | `orquestracao:planejador` | spec, ADR, decisão, investigação de causa, plano com arquivos, passos e critério de pronto; distribui trabalho, mergeia, faz release | executar plano grande sozinho quando dá para delegar |
| **Executor** | Sonnet 5.5 | médio | `orquestracao:executor` (em sessão `exec · …`) | cumpre um plano pronto: edita, testa, commita, abre PR | decidir o que o plano não decidiu; rodar como subagente |
| **Validador** | Opus 5.5 | alto | `orquestracao:validador` | revisa o diff contra o plano, tenta derrubar cada afirmação, roda o teste, abre o artefato final | editar código (ele devolve achados) |
| **Explorador** | Haiku 5.5 | baixo | `orquestracao:explorador` | busca e leitura: onde está X, quem chama Y, resumir um log ou uma página | escrever arquivo, concluir causa |
| **Conferência mecânica** | Sonnet 5.5 | baixo | `orquestracao:executor` | rodar o gate, aplicar lista fechada de ajustes, preencher template (o que grava vai em sessão) | julgar se o resultado está bom |

Ids: Opus 5.5 `claude-opus-5-5` (alias `opus`), Sonnet 5.5 `claude-sonnet-5-5` (`sonnet`), Haiku 5.5 `claude-haiku-5-5` (`haiku`).

## As duas travas da ferramenta

- **Ninguém abre sessão acima do próprio modelo.** `start_session` aceita `model` igual ou mais barato que o de quem chama; mais caro é ignorado em silêncio. Por isso **a sessão principal e a orquestradora rodam em Opus**: é delas que saem as executoras em Sonnet. Sessão em Sonnet que precisa de um planejador não o abre: devolve a pergunta a quem a abriu.
- **Subagente herda o modelo de quem o lança, a menos que o papel diga outro.** Prefira `subagent_type` com o papel do plugin, que chega com o prefixo (`orquestracao:validador`; o modelo, o esforço e as ferramentas vêm do arquivo em `agents/` do plugin) a escrever `model` em cada chamada: o papel não se esquece.

<a id="quem-escreve-e-sessao"></a>
## Quem escreve é sessão (Q154, 23/10)

> **No pool de sessões (operador, 24/10) vale mais forte:** cada papel na sua sessão — a planejadora não lança subagente `orquestracao:executor` nem `orquestracao:validador`; execução vai a uma sessão E, validação a uma sessão V (`${CLAUDE_PLUGIN_ROOT}/pool/protocolo.md`, "Cada papel na sua sessão"). Subagente só dentro da função de quem o lança. Trava: `${CLAUDE_PLUGIN_ROOT}/hooks/papel-do-pool.mjs` recusa (`deny`) subagente `orquestracao:executor`/`validador` lançado por planejadora, design ou orquestradora, e a executora lançar `validador`.

> A exceção do executor (Q196) caiu em 2026-10-24 (F5): subagente `orquestracao:executor` não escreve mais — trava em papel-do-pool.mjs e subagente-nao-edita.mjs.

**Membros do pool** (E1, E2, V1, P1–P3, D1) seguem o protocolo da fila em `${CLAUDE_PLUGIN_ROOT}/pool/protocolo.md#fila-do-pool`: pegam o item `F<n>` da coleção `fila` do painel, gravam nele todo turno e o soltam com handoff. No pool, execução e validação são sempre de sessões E e V, nunca de subagente lançado pela planejadora.


Decisão do operador em 2026-10-23: *"para ter mais controle e a orquestradora poder ver melhor"*. O subagente não aparece na lista de sessões nem no painel, não pode ser conduzido no meio e, quando morre, deixa mudança no disco sem dono (o caso do agente morto e o da orquestradora editando por subagente, 11–13/10). Os dois defeitos medidos eram de **escrita**; leitura por subagente não tem caso registrado. Por isso o corte é por *o que o trabalho faz no disco*, não por tamanho:

- **Grava arquivo, commita ou abre PR → sessão** (`start_session`, título `exec · <tarefa>`, worktree próprio). Isso inclui a conferência mecânica que **aplica** ajustes e o conserto que a validação devolveu: ele vai à executora daquela frente por `SendMessage`, nunca a um subagente novo.
- **Só lê, mede ou devolve achados → subagente** pode, com o resultado consumido no mesmo turno: `orquestracao:explorador`, a [pré-checagem do critério](#pre-checagem-do-criterio), a validação Leve e Padrão, o `orquestracao:planejador` que devolve o plano no relatório sem gravar arquivo, a conferência mecânica que só roda o gate.
- **A exceção é quem já está na conversa:** a edição de poucas linhas que a própria sessão faz (ver "Tarefa pequena não se divide") continua com ela. A regra proíbe delegar escrita a subagente, não proíbe a sessão de escrever.
- **Briefing de subagente diz que ele não edita.** Quem lança escreve no prompt *"não grave arquivo; devolva no relatório"*. Se no meio aparecer a necessidade de gravar, ele para e devolve.
- **A trava.** O hook `PreToolUse` `${CLAUDE_PLUGIN_ROOT}/hooks/subagente-nao-edita.mjs` **recusa** (`deny`, também em bypass) `Edit`/`Write`/`MultiEdit`/`NotebookEdit` de subagente (evento com `agent_id`) fora de `~/.claude/`, do rascunho (scratchpad, `/tmp`, `/var/folders`) e das notas entre sessões. Sessão aberta com `--agent orquestracao:executor` não tem `agent_id` e passa. Exceção por papel em `~/.claude/orquestracao/subagente-pode-escrever.txt` (um `subagent_type` por linha, `*` no fim casa prefixo); a lista casa o tipo com ou sem o prefixo de um plugin do kit. Sem lista, o `designer` do kit grava só na pasta de revisões do projeto (`design.revisoes` do `.claude/kit.json`, padrão `docs/design/revisoes`) e registra `liberado-por-papel`. Bash fica de fora, como no `orquestradora-nao-edita`. Cada recusa vai para `~/.claude/orquestracao/hooks-crewai.log` (`recusou`, `recusou-symlink`, `liberado-por-tipo`, `liberado-por-papel`, `erro`). Testes: casos 4.x de `node ~/.claude/hooks/tests/hooks-crewai.test.mjs`.

## O plano está pronto para o Sonnet?

O executor só recebe trabalho quando o briefing tem **as cinco coisas**. Faltando qualquer uma, o trabalho fica com o Opus (ou volta ao planejador para completar):

1. **Os arquivos**, por caminho, e o que muda em cada um.
2. **Os passos numerados**, na ordem, sem "decida o melhor jeito".
3. **O critério de pronto medível** — o teste que tem de passar, o comando, a saída esperada.
4. **O que está fora do escopo**, escrito.
5. **As regras do projeto que tocam o trabalho** (gate, migration, commit, idioma) e onde elas moram.

Sinais de que **não** está pronto: o pedido usa *"investigue"*, *"descubra por quê"*, *"escolha"*, *"melhore"*; a causa do defeito não foi medida; há mais de um jeito razoável e o plano não escolheu; o trabalho cria ou muda contrato (spec, schema, API, migration).

<a id="pre-checagem-do-criterio"></a>
**Pré-checagem do critério, antes de abrir a executora (Q65, 23/10).** Vale para a frente que vai cair no nível **Robusta** da validação (tabela em "A validação"). Antes de abrir a executora, o planejador lança um subagente `orquestracao:validador` com `model: "sonnet"` e esforço baixo, que lê **só o critério de pronto** do plano, sem o resto e sem o código. Ele responde a três perguntas, uma linha cada:

- **Dá para rodar?** É um comando ou teste que existe, ou um que o plano manda criar, com o caminho.
- **A saída esperada está escrita?** Por exemplo: `exit=0`, ou "o teste X passa e o Y falha antes da mudança".
- **Ele reprovaria a entrega errada?** Critério que passa com o trabalho pela metade, como "o gate fica verde" numa mudança que nenhum teste cobre, não serve.

Qualquer "não" volta ao planejador, que completa o critério antes de abrir a executora. Custa uma chamada curta em Sonnet. O que ela evita custa caro: o critério frouxo só aparece na validação Robusta, em Opus com esforço alto, e aí ainda leva a executora a uma segunda rodada (estudo CrewAI, o `expected_output` checado antes da execução). Nos níveis Leve e Padrão a pré-checagem não se faz, porque o validador de depois já cobre isso a preço menor.

<a id="trava-do-executor"></a>
## A trava do executor: só termina com a saída real

O critério de pronto não depende do relato (Q62, 23/10, ideia `Task.guardrail` da CrewAI). O hook `${CLAUDE_PLUGIN_ROOT}/hooks/executor-criterio.mjs` (em `Stop` e `SubagentStop`) **recusa o fim do turno** do executor — subagente `orquestracao:executor`, sessão aberta com `--agent orquestracao:executor` ou de título `exec · …` — quando o turno **editou arquivo** e o relatório não traz a saída real do comando de critério. Editar inclui o Bash que grava (`sed -i`, `perl -i`, `>`/`>>` para arquivo, `tee`, heredoc para `python`/`node`, `git apply`, `patch`; e o `cp`/`mv`/`rm`/`git checkout --`/`git restore` que alcançam um arquivo de teste — mexer em teste liga a cobrança e registra `editou teste`; `git restore --staged` só mexe no índice e não conta): medido em 63 executores reais, 57% editavam só assim.

- **O que vale como saída real** — sempre conferido contra o que as ferramentas devolveram no turno (Bash, Monitor, `TaskOutput`, ou Read de um `.output`/`.log`):
  - um status (`exit=0`, `exit code 0`, `TEST_EXIT=0`, `test=0`, `Found 0 errors`) que **aparece na saída real** — status inventado no relatório não passa. O jeito seguro é terminar o comando de critério com `; echo "exit=$?"`;
  - uma contagem (`98 passed`, *"98 testes verdes"*) cujo número sai igual de um `N passed`/`N failed` da saída;
  - uma linha (≥ 10 caracteres) num bloco de código igual a uma linha da saída — é assim que passa critério que não é teste, como um `grep`.
- **Falha escondida é cobrada:** se a ÚLTIMA saída com contagem do turno tem `N failed` e o relatório não cita um desses N junto da falha, antes ou depois (*"2 testes falharam"*, *"falharam 2"*, a linha `Tests  2 failed` colada), o turno não termina — *"nenhuma falha nova"* não admite nada. O vitest tem dois N (`Test Files  1 failed` e `Tests  2 failed`), e qualquer um serve. O `exit=1` do relatório não conta como um desses números. Gate vermelho antes do conserto não conta, só o último.
- **Não cobra** quem devolve dúvida (linha terminando em `?` fora de bloco de código e que não é título markdown; `Bloqueado: <o motivo>` abrindo a linha (*"Bloqueado: nada"* não vale); *devolvo*, *parei*, *travei*, *estou/fiquei bloqueado*; um `Q62` solto ou um `$?` dentro de bloco não valem), nem quem não editou (conferência mecânica).
- **Trabalho em background:** só no fio principal (sessão `exec · …`) o turno que para esperando uma tarefa em background adia a cobrança para o turno em que a notificação chega, por no máximo 2 turnos seguidos (dev server ou Monitor que nunca termina não desliga a trava). Subagente não adia. A notificação de Bash em background traz **só o exit**, não a saída: leia o arquivo de saída (Read do `.output`) ou cole o fim dele.
- **A compactação não zera o turno:** o resumo de compactação não conta como mensagem do operador.
- **No máximo 2 cobranças por turno**, como o `guardrail_max_retries`; na terceira deixa passar e registra. Erro do hook nunca prende o turno.
- **Limite conhecido:** um `exit=0` de qualquer comando do turno (até `git status`) vale como status; a trava confere que o número existe, não que veio do comando de critério. Quem garante isso é o validador.
- Cada desfecho vai para `~/.claude/orquestracao/hooks-crewai.log` (`cobrou-N`, `corrigiu-apos-cobranca`, `passou-com-saida`, `passou-duvida`, `adiou-esperando-fundo`, `deixou-passar-apos-2`, `erro`). Testes: `node ~/.claude/hooks/tests/hooks-crewai.test.mjs`.
- **Quem abre o validador** confere o log antes: `deixou-passar-apos-2` no executor é sinal de que o critério não foi medido, e o validador recebe isso no briefing.

A executora também não termina o turno **anunciando** o próximo passo (F28, 25/10: E3 "Volto à B2" e E2 "Falta retomar a fatia 3" ficaram 2 h 50 min paradas). O hook `${CLAUDE_PLUGIN_ROOT}/hooks/executor-anuncia.mjs` (só `Stop`, fio principal) **recusa o fim do turno** quando o último parágrafo traz "volto à…", "retomo", "sigo com…", "falta retomar" ou "agora começo…" sem condição na mesma frase — no máximo 2 cobranças por turno. Não cobra: pergunta (`?` no parágrafo), "Bloqueado: <motivo>"/"devolvo"/"parei", sessão que se declara livre, anúncio com condição ("quando…", "aguardo…", "se ninguém decidir…"), nem turno com tarefa em background viva (a notificação reabre o turno; no 3º turno seguido adiado cobra). Regra e testes: `tests/executor-anuncia.test.mjs`; replay em transcripts reais: `tests/executor-anuncia.replay.mjs`. Quem espera algo escreve o quê ("aguardo …" em qualquer frase do último parágrafo, ou "Bloqueado: <motivo numa frase inteira>" em linha própria) em vez de anunciar. O limite de 2 cobranças vale pelo turno inteiro, nos dois hooks de Stop: depois da 2ª, as paradas seguintes do mesmo turno passam (`passou-esgotado`).

## Quando o executor trava

- **Ele para e devolve**, com a pergunta inteira (o caso, o que acontece se ninguém decidir, a recomendação dele). Não escolhe sozinho entre dois caminhos que o plano não escolheu.
- Quem planejou responde, ou completa o plano e reabre a execução. Decisão nova sobe para o Opus; ela nunca é tomada pelo executor para não parar.
- Duas devoluções na mesma tarefa = o plano não estava pronto. O resto da tarefa vai para o Opus.

## A validação

- **Nunca é quem executou.** Nem a mesma sessão, nem o mesmo subagente: quem fez o trabalho já acredita nele.
- **Em Opus, para mudança de código ou de doc que decide algo.** Conferência mecânica (o gate rodou? o formato bate?) pode ser Sonnet.
- **O nível da validação sai do que o diff toca** (decisão do operador em 2026-10-22, Q44: *"coisa simples, teste mais simples; coisa complexa, validadora mais robusta"*). Quem abre a validação (o planejador) classifica pelo `git diff --stat` e pelos caminhos, nunca pela impressão de "é pequeno", e escreve o nível no briefing. **Na dúvida, o nível de cima.**

  | Nível | Quando (basta UM critério do nível de cima para subir) | Quem valida | O que faz |
  |---|---|---|---|
  | **Leve** | Só texto, doc que não decide, CSS/estilo, teste novo sem mudar código, ou ≤ ~40 linhas em 1–2 arquivos de um pacote, sem gravar estado | subagente `orquestracao:validador` com `model: "sonnet"`, esforço médio | gate (ou o teste do pacote), lê o diff inteiro, abre o artefato se for visual |
  | **Padrão** | Código de produto num pacote, gesto de tela, rota que lê | subagente `orquestracao:validador` (Opus), esforço médio | o de cima + tenta derrubar cada afirmação do relatório, caso de borda, a regra do projeto |
  | **Robusta** | Contrato (spec que decide, ADR, schema, migration, API entre pacotes), o que grava estado ou dispara trabalho, auth/segurança/segredo, produção ou deploy, mais de um pacote, ou trabalho que **já reprovou uma vez** | sessão `valida · <tarefa>` em Opus, esforço alto, contexto novo | o de cima + a prova no artefato real (tela clicada, banco lido) e a varredura do que precisava mudar junto |

- **A revalidação mede o DELTA, não o PR de novo.** Depois de um conserto, a validação seguinte recebe os achados anteriores, o HEAD validado da vez anterior e `git diff <HEAD anterior>..<HEAD novo>`: confere que cada achado foi resolvido e que o conserto não quebrou o vizinho. Volta ao PR inteiro só se o conserto mudou o desenho (outro arquivo de contrato, outra abordagem). Contexto novo continua obrigatório: quem viu a rodada anterior já acredita na correção.
- **O gate não se repete sobre a mesma árvore** (Q150, 24/10). Onde o projeto guarda o verde pela árvore exata (o gate do kit faz isso: `npm test` pula a árvore que já passou e diz qual, quando e onde), o executor, enquanto conserta, roda **só o pacote que mexeu** (o teste do pacote, pela mesma fila) e o gate completo **uma vez, antes do push**. O validador e quem mergeia rodam o gate normalmente — o pulo é do próprio gate — e conferem que a árvore do registro é a do worktree deles (o comando que o projeto tiver para isso); *"o gate passou"* dito por outra sessão, sem a árvore, não vale.
- **Teto da crítica de tela (Q207, operador, 24/10).** A crítica do `critico-de-ui` dá nota de 0 a 30. **De 24/30 para cima, aprovada com ressalvas e sem ressalva alta, a revisão ou a tela está liberada** (para execução ou para merge); ressalva alta volta para conserto mesmo com nota boa (B1, assumida 24/10); ressalva média ou baixa não volta para conserto: vira item próprio na fila (`F<n>`); todo problema da crítica declara o **Peso** (alta · média · baixa). **No máximo 2 recríticas por PR ou revisão**; na terceira, o que ainda estiver abaixo de 24 sobe à planejadora, que decide ou leva ao operador. Motivo: o redesenho do editor ficou um dia parado em 11 e 15 rodadas de crítica polindo ressalva baixa. Achado fora do escopo do plano vira item novo e nunca entra no mesmo PR, qualquer que seja o peso; na via rápida a crítica é uma só, sem recrítica (ADR 0004).
- **Achado só baixo não reabre a rodada.** Se a validação devolve apenas achados baixos (nome, comentário, texto), o executor conserta e o gate basta; nova validação só para achado médio ou alto.
- **Não confia no relato.** Abre o arquivo, roda o teste, olha o artefato final (a tela, o PDF, a imagem publicada) — não o mecanismo que o produziu.
- Devolve achados ordenados por gravidade, cada um com o caso concreto que falha. Quem conserta é o executor (ou o planejador, se o achado mostra que o plano estava errado).

## Fluxo padrão de uma frente

1. **Planejar (Opus).** Medir antes de decidir; escrever o plano com as cinco coisas; decisões em aberto vão ao operador ou à orquestradora no formato de três partes.
2. **Executar (Sonnet)**, uma sessão por bloco independente, cada uma na sua faixa de arquivos ([quem escreve é sessão](#quem-escreve-e-sessao)).
3. **Validar (Opus)**, separado, sobre o diff e o artefato.
4. **Consertar** o que a validação achou (volta ao 2, ou ao 1 se o plano errou).
5. **Entregar** (o planejador/orquestrador): PR, merge, release conforme o projeto.

**Tarefa pequena não se divide.** Uma pergunta, uma leitura, uma edição de poucas linhas ficam com quem está — abrir sessão custa ~90 mil tokens de piso, e o briefing custa mais que o trabalho. A divisão em papéis é para frente com plano de mais de um passo.

## Ao abrir

- **Sessão** (`start_session`): passe `model` e `effort` do papel. Ex.: executora `model: "claude-sonnet-5-5"`, `effort: "medium"`; validadora sem `model` (herda Opus), `effort: "high"`. No título, o papel na frente: `exec · <tarefa>`, `valida · <tarefa>`, `plano · <tarefa>`.
- **Subagente** (`Agent`): `subagent_type: "orquestracao:validador" | "orquestracao:explorador" | "orquestracao:planejador"`, só para trabalho que não grava ([quem escreve é sessão](#quem-escreve-e-sessao)); `orquestracao:executor` como subagente só para a conferência mecânica que roda o gate sem editar. Só passe `model` à mão quando nenhum papel servir.
- **Briefing**: o do executor segue as cinco coisas; o do validador traz o plano original, a branch/commit, o que foi afirmado como feito e o critério de pronto; o do explorador traz a pergunta e o teto da resposta.

<a id="contexto"></a>
## Contexto: quando limpar, quando compactar

**Vale a pena, pelos dois lados.** Custo: cada turno relê a conversa inteira, e depois de 1 hora parada o cache expira e ela é reescrita a preço dobrado. No Battlewand (20/10), ~90% do custo foi leitura e escrita de cache, não resposta. Qualidade: contexto longo dilui a atenção, e o que foi lido há 200 mil tokens pode já ter mudado no disco. O que limpar custa: ~90 mil tokens de piso para recomeçar, e o que não estava escrito em lugar nenhum. Por isso a regra é **limpar no fim de uma unidade de trabalho, com o estado escrito**, e nunca no meio de um raciocínio.

**Limpar > compactar.** Limpar (`clear_session` com `"self"`, ou `/clear`) recomeça do arquivo de estado, que você controla. Compactar (`/compact`) troca a conversa por um resumo que você não controla, que fica relido em todo turno e perde exatamente o detalhe que fazia diferença (o erro exato, o porquê de uma escolha). Compactar só quando: o trabalho está no meio, o estado não cabe num arquivo e falta pouco — e aí `/compact <o que preservar>`, dizendo o que o resumo tem de manter. A compactação automática é **rede de segurança**, não plano: chegar nela quer dizer que o gatilho de limpeza passou batido.

**Depois de limpar ou compactar, releia antes de editar.** O que o resumo diz de um arquivo é memória; abra o trecho antes de mexer nele.

**Por papel:**

| Papel | Regra |
|---|---|
| **Planejador / orquestrador** (Opus) | Lê `get_usage` (`"self"`, `context.tokensUsed`) a cada unidade concluída (merge, plano entregue, lote de notificações). **≥ 350 mil:** limpa no próximo momento oportuno. **≥ 250 mil e o turno vai terminar esperando o operador:** limpa antes de encerrar — retomar custa ~90 mil, reescrever 250+ mil custa mais. **≥ 500 mil:** não pega trabalho novo até limpar. A orquestradora com o operador presente não limpa sozinha: a partir de 150 mil pede o ok (skill `orquestradora`, "Orçamento de contexto"); com o modo ausente ligado vale a régua acima. |
| **Executor** (Sonnet) | **Um plano, um contexto.** Terminou o bloco → entrega e acaba; o próximo bloco é sessão nova, nunca a mesma conversa "aproveitando o contexto". O planejador corta os blocos para caberem em ~300 mil tokens. Passou de 300 mil: devolve a quem despachou (relatório com o passo exato em que parou, se foi no meio) e se limpa (`clear_session "self"`) — não compacta, porque o resumo perde o plano. |
| **Validador** (Opus) | **Sempre contexto novo**, inclusive para validar a segunda rodada do mesmo trabalho: o validador que viu a primeira já acredita na correção. Nunca limpa no meio — validação que não cabe vira duas, por faixa de arquivo. |
| **Explorador** (Haiku) | Uma pergunta, uma resposta, fim. Não continua com outra pergunta. |

**A rede de segurança por papel** (`autoCompactWindow`, onde a compactação automática dispara). O global fica em **600 mil** (`~/.claude/settings.json`) e vale para o planejador e o orquestrador. O teto de 500 mil é o deles, e todos os modelos têm 1 milhão de janela, então o número é escolha nossa, não limite do modelo. Nos papéis, ele vai no frontmatter: executor e validador **400 mil**, explorador **200 mil**. Esse frontmatter só compacta mais cedo, exige Claude Code 2.1.296 ou mais novo (antes disso a chave é ignorada sem erro) e perde para `CLAUDE_CODE_AUTO_COMPACT_WINDOW` exportada no shell. Nunca exporte essa variável: ela anula os quatro papéis de uma vez.

**A trava.** O hook `${CLAUDE_PLUGIN_ROOT}/hooks/contexto-do-papel.mjs` (em `Stop`, o último) lê o contexto da sessão no transcript (a última entrada do fio principal; subagente não conta) e **cobra** a tabela acima, para a regra não depender de a sessão lembrar do `get_usage`. **Exceção da orquestradora (F147):** com o operador presente o hook não a bloqueia (só registra `contexto-alto`): a limpeza é do operador, pelo botão `↺ Limpar` da barra, destacado a partir de 150 mil. A trava T7 do `papel-do-pool.mjs` recusa o `clear_session "self"` dela sem o ok do operador (turno humano, modo ausente ligado, o botão da barra ≤ 30 min ou o sim antigo do painel). Com o modo ausente ligado ela segue a régua abaixo. Planejadora, design e (com o modo ausente) orquestradora: **≥ 500 mil** cobra limpar (só `clear_session` com `"self"` no turno satisfaz, e uma chamada recusada não conta); **≥ 350 mil** cobra limpar ou a linha `Contexto: sigo — <o que falta na unidade>` (com pelo menos 10 caracteres depois do travessão); **≥ 250 mil** com o turno terminando esperando o operador (`?` ou `Q<n>` no último parágrafo) cobra limpar antes. Executora: **≥ 300 mil** cobra limpar (só `clear_session` com `"self"` satisfaz; a linha `Parei em:` sozinha não). Validadora: não é cobrada; a partir de 350 mil o log só anota `validadora-<mil>`, para a orquestradora ver que a validação não coube. Cobra uma vez por turno (`stop_hook_active` deixa passar), erro nunca prende o turno, e a sessão sem papel não é medida. Cada desfecho vai para `~/.claude/orquestracao/hooks-crewai.log` (`cobrou-200`, `cobrou-300`, `cobrou-150-espera`, `cobrou-exec-150`, `cobrou-pedir`, `satisfeito-pediu`, `satisfeito-sigo`, `limpou`, `deixou-passar`, `validadora-<mil>`, `sem-usage`, `erro`). Os limites ficam em constantes no topo do hook. Testes: `node --test hooks/tests/contexto-do-papel.test.mjs`.

**Momento oportuno** (vale para todos): nenhum subagente seu rodando (a notificação se perderia), nenhum merge, release ou gate em andamento, nenhuma pergunta do operador sem resposta, e o estado escrito — o arquivo de estado ou registro de pedidos com o que está aberto e o **próximo passo exato**. Sem arquivo de estado, use a skill `handoff-de-sessao` antes.

**O que não entra no contexto economiza mais que limpar:** saída de comando longo vai para arquivo e só o fim aparece; `grep -n` e `Read` com faixa em vez do arquivo inteiro; diff grande vai para o validador, não para a principal; varredura larga vai para o `orquestracao:explorador`.

## O que isto não muda

- Modelo que um **produto** usa em runtime (ex.: um agente que o projeto embute no produto) é decisão do produto, não desta skill.
- A sessão que o operador abre à mão segue o padrão global (`opus[1m]`); esta skill vale para o que as sessões abrem a partir dela.
