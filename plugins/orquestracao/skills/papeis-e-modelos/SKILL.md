---
name: papeis-e-modelos
description: Qual modelo e qual papel cada sessão e cada subagente usa — a sessão dona do item em Opus (risco ou decisão) ou Sonnet (mecânico), revisão pelo subagente `orquestracao:validador` de contexto limpo, `orquestracao:explorador` em Haiku só para ler, orquestradora em Opus. Use ANTES de abrir sessão nova (start_session) ou lançar subagente (Agent), ao escrever o briefing de uma sessão dona ou de um subagente, e quando o operador perguntar "qual modelo usar", "abre uma sessão para fazer isto", "manda um agente revisar". Vale em todo projeto; a qualidade vem antes da economia.
---

# Papéis e modelos

O modelo é função do **que a sessão ou o agente vai decidir**, não do gosto de quem abre. Quem decide usa o modelo mais forte; quem cumpre um plano que já decidiu tudo usa o intermediário; quem só lê usa o mais leve. **Qualidade vem antes de economia**: na dúvida, o modelo de cima.

<a id="modelo-da-dona"></a>
## Os papéis

| Papel | Onde roda | Modelo | Esforço | Faz | Não faz |
|---|---|---|---|---|---|
| **Orquestradora** | sessão `🎛 orquestradora — <projeto>` | Opus 5.5 | alto | abre uma sessão dona por item, é a fila de merge, faz o release, reserva números de documento (skill `orquestradora`) | escrever código de item |
| **Dona do item, com risco** | sessão `F<n> · <tema>` | Opus 5.5 | alto | o item inteiro, do plano ao PR, quando ele decide algo, mexe em contrato (spec, ADR, schema, API, migration), grava estado, toca segurança, produção ou dinheiro, ou já voltou da fila | mergear, subir versão dos plugins |
| **Dona do item, mecânico** | sessão `F<n> · <tema>` | Sonnet 5.5 | médio | o item inteiro quando o plano já está escrito ([as cinco coisas](#plano-pronto)) | decidir o que o plano não decidiu (devolve à orquestradora) |
| **Revisor** | subagente `orquestracao:validador` | Opus 5.5 (ou `model: "sonnet"` em item mecânico) | alto | revisa o diff contra o plano, tenta derrubar cada afirmação, roda o teste, abre o artefato final | editar (devolve achados) |
| **Explorador** | subagente `orquestracao:explorador` | Haiku 5.5 | baixo | busca e leitura: onde está X, quem chama Y, resumir um log ou uma página | escrever arquivo, concluir causa |
| **Design** (item com tela) | subagentes `design-system:revisao-de-arquitetura-de-ui` e `design-system:critico-de-ui` | o do agente | — | a revisão de arquitetura antes do código e a crítica depois | escrever código de tela |

- **Uma sessão dona por item, do plano ao PR.** A dona mede, decide, escreve, testa, revisa por subagente e abre o PR; o manual é `${CLAUDE_PLUGIN_ROOT}/pool/dona.md`, a regra comum `${CLAUDE_PLUGIN_ROOT}/pool/protocolo.md`. Título da sessão: `F<n> · <tema em palavras do produto>`.
- **Quem abre a dona escolhe o modelo** pela classificação do item (a sessão não troca o próprio modelo); a dona escolhe o de cada subagente pelo risco do que ele revisa. Critérios no protocolo, âncora `modelo-e-esforco`; skills de cada etapa, âncora `skills-da-etapa`.
- **Item que muda de classe no meio** (o mecânico que vira decisão): a dona Sonnet devolve à orquestradora, que abre uma dona Opus com o handoff do item.
- **Testes:** só os afetados durante o trabalho (`testes-afetados -- <comando>`); o gate completo roda uma vez, na fila de merge da orquestradora.

Ids: Opus 5.5 `claude-opus-5-5` (alias `opus`), Sonnet 5.5 `claude-sonnet-5-5` (`sonnet`), Haiku 5.5 `claude-haiku-5-5` (`haiku`).

## As duas travas da ferramenta

- **Ninguém abre sessão acima do próprio modelo.** `start_session` aceita `model` igual ou mais barato que o de quem chama; mais caro é ignorado em silêncio. Por isso **a orquestradora roda em Opus**: é dela que saem as donas, em Opus ou em Sonnet. Sessão em Sonnet que precisa de uma decisão não abre outra sessão: devolve a pergunta a quem a abriu.
- **Subagente herda o modelo de quem o lança, a menos que o agente diga outro.** Prefira `subagent_type` com o agente do plugin (`orquestracao:validador`; o modelo, o esforço e as ferramentas vêm do arquivo em `agents/` do plugin) a escrever `model` em cada chamada. Subagente nunca sobe acima do modelo da dona.

<a id="quem-escreve-e-sessao"></a>
## Quem escreve é sessão

O subagente não aparece na lista de sessões nem no painel, não pode ser conduzido no meio e, quando morre, deixa mudança no disco sem dono. Os defeitos medidos foram de **escrita**; leitura por subagente não tem caso registrado. Por isso o corte é por *o que o trabalho faz no disco*:

- **Grava arquivo, commita ou abre PR → a própria sessão** (a dona do item). Trabalho de escrita que não cabe no item vira item novo, com a sua dona, pela orquestradora.
- **Só lê, mede ou devolve achados → subagente** pode, com o resultado consumido no mesmo turno: `orquestracao:explorador`, `orquestracao:validador`, os agentes de design.
- **Briefing de subagente diz que ele não edita.** Quem lança escreve no prompt *"não grave arquivo; devolva no relatório"*. Se no meio aparecer a necessidade de gravar, ele para e devolve.
- **A trava.** O hook `PreToolUse` `${CLAUDE_PLUGIN_ROOT}/hooks/subagente-nao-edita.mjs` **recusa** (`deny`, também em bypass) `Edit`/`Write`/`MultiEdit`/`NotebookEdit` de subagente (evento com `agent_id`) fora de `~/.claude/`, do rascunho (scratchpad, `/tmp`, `/var/folders`) e das notas entre sessões. Exceção por agente em `~/.claude/orquestracao/subagente-pode-escrever.txt` (um `subagent_type` por linha, `*` no fim casa prefixo; casa o tipo com ou sem o prefixo de um plugin do kit). Sem lista, o `designer` do kit grava só na pasta de revisões do projeto (`design.revisoes` do `.claude/kit.json`, padrão `docs/design/revisoes`) e registra `liberado-por-papel`; o designer de outro plugin ganha a mesma pasta, com a mesma cerca, quando o projeto o declara pelo tipo exato em `design.designers` do `.claude/kit.json` (ex.: `"designers": ["acme:designer"]`; `*` não vale, para não liberar todo plugin instalado). A configuração das travas fica fechada para todo subagente, inclusive o tipo liberado (senão ele se libera): as listas `subagente-pode-escrever.txt` e `trava-edicao-repos.txt`, os marcadores `ativas/` e a `batida/` que os recria, o `painel/` e o `limpeza/` (respostas e clique do operador), a bandeira `operador-ausente.json`, o estado `hooks-crewai-estado.json`, o cache `pool-registro-cache.json`, o `settings.json` (e o `.local`) de qualquer `.claude/`, os transcripts (`~/.claude/projects/**/*.jsonl`) e `~/.claude/plugins/` (fora `plugins/data/`). Bash fica de fora, como no `orquestradora-nao-edita`, salvo o comando que cita um desses arquivos pelo nome e grava (cerca contra deslize: nome por variável, `claude plugin` e os transcripts passam). Cada recusa vai para `~/.claude/orquestracao/hooks-crewai.log` (`recusou`, `recusou-trava`, `recusou-symlink`, `liberado-por-tipo`, `liberado-por-papel`, `erro`).

<a id="plano-pronto"></a>
## O plano está pronto para o Sonnet?

A dona em Sonnet só recebe o item quando o plano tem **as cinco coisas**. Faltando qualquer uma, o item vai a uma dona Opus:

1. **Os arquivos**, por caminho, e o que muda em cada um.
2. **Os passos numerados**, na ordem, sem "decida o melhor jeito".
3. **O critério de pronto medível** — o teste que tem de passar, o comando, a saída esperada.
4. **O que está fora do escopo**, escrito.
5. **As regras do projeto que tocam o trabalho** (gate, migration, commit, idioma) e onde elas moram.

Sinais de que **não** está pronto: o pedido usa *"investigue"*, *"descubra por quê"*, *"escolha"*, *"melhore"*; a causa do defeito não foi medida; há mais de um jeito razoável e o plano não escolheu; o trabalho cria ou muda contrato (spec, schema, API, migration).

<a id="trava-do-criterio"></a>
## A trava do critério: a dona só termina com a saída real

O critério de pronto não depende do relato. O hook `${CLAUDE_PLUGIN_ROOT}/hooks/criterio-da-dona.mjs` (em `Stop`) **recusa o fim do turno** da dona de item em `execucao`, `validacao` ou `merge` quando o turno **editou arquivo** e o relatório não traz a saída real do comando de critério. Editar inclui o Bash que grava (`sed -i`, `perl -i`, `>`/`>>` para arquivo, `tee`, heredoc para `python`/`node`, `git apply`, `patch`; e o `cp`/`mv`/`rm`/`git checkout --`/`git restore` que alcançam um arquivo de teste — mexer em teste liga a cobrança e registra `editou-teste`; `git restore --staged` só mexe no índice e não conta). Em `planejamento` e `design` a dona escreve plano e revisão e não é cobrada.

- **O que vale como saída real** — sempre conferido contra o que as ferramentas devolveram no turno (Bash, Monitor, `TaskOutput`, ou Read de um `.output`/`.log`):
  - um status (`exit=0`, `exit code 0`, `TEST_EXIT=0`, `test=0`, `Found 0 errors`) que **aparece na saída real** — status inventado no relatório não passa. O jeito seguro é terminar o comando de critério com `; echo "exit=$?"`;
  - uma contagem (`98 passed`, *"98 testes verdes"*) cujo número sai igual de um `N passed`/`N failed` da saída;
  - uma linha (≥ 10 caracteres) num bloco de código igual a uma linha da saída — é assim que passa critério que não é teste, como um `grep`.
- **Falha escondida é cobrada:** se a ÚLTIMA saída com contagem do turno tem `N failed` e o relatório não cita um desses N junto da falha (*"2 testes falharam"*, a linha `Tests  2 failed` colada), o turno não termina. O `exit=1` do relatório não conta como um desses números.
- **Não cobra** quem devolve dúvida (linha terminando em `?` fora de bloco de código e que não é título markdown; `Bloqueado: <o motivo>` abrindo a linha; *devolvo*, *parei*, *estou bloqueado*), nem quem não editou.
- **Trabalho em background:** o turno que para esperando uma tarefa em background adia a cobrança para o turno em que a notificação chega, por no máximo 2 turnos seguidos. A notificação de Bash em background traz **só o exit**: leia o arquivo de saída ou cole o fim dele.
- **No máximo 2 cobranças por turno**; na terceira deixa passar e registra. Erro do hook nunca prende o turno. **Limite conhecido:** um `exit=0` de qualquer comando do turno vale como status; quem garante que veio do comando de critério é o validador.
- Cada desfecho vai para `~/.claude/orquestracao/hooks-crewai.log` (`cobrou-N`, `corrigiu-apos-cobranca`, `passou-com-saida`, `passou-duvida`, `adiou-esperando-fundo`, `deixou-passar-apos-2`, `passou-esgotado`, `erro`).

## Quando a dona trava

- **Ela pergunta só o irreversível** (destrutivo, produção, gasto de job, publicar para fora), com a pergunta inteira: o caso, o que acontece se ninguém decidir, a recomendação. O resto assume, marcado *assumida, a confirmar*, e segue.
- A dona Sonnet não escolhe entre dois caminhos que o plano não escolheu: devolve à orquestradora, que decide ou abre uma dona Opus.

<a id="a-revisao"></a>
## A revisão

- **Nunca é quem escreveu.** A dona lança o `orquestracao:validador` de contexto limpo: quem fez o trabalho já acredita nele.
- **A exceção medida: a via rápida.** O item pequeno cujo diff cabe no corte do `${CLAUDE_PLUGIN_ROOT}/pool/via-rapida.mjs` (até 60 linhas em até 4 arquivos, nenhum contrato, trava, hook, migration ou removido) e que não grava estado, não toca segurança nem muda regra se autorrevisa pelo roteiro fixo do protocolo (âncora `via-rapida-da-revisao`), com o laudo no PR. Item de risco nunca vai por ela, nem o que muda regra de revisão.
- **O briefing traz** o plano, o diff (`git diff origin/<base>...HEAD`), o que a dona afirma ter feito, o critério de pronto e a frase *"só achados que afetam correção; skip style; não grave arquivo"*.
- **Modelo:** Opus (o padrão do agente) para item de risco e para o delta de conserto; `model: "sonnet"` para item mecânico.
- **A revisão do conserto mede o DELTA**, não o PR de novo: o segundo validador recebe os achados anteriores e `git diff <HEAD revisado>..<HEAD novo>`, confere que cada achado foi resolvido e que o conserto não quebrou o vizinho. Contexto novo continua obrigatório.
- **Achado médio ou alto** a dona conserta; em item de risco, um segundo validador sobre o delta. **Achado leve** vai ao PR ou ao `depois` do item, nunca vira item.
- **O gate não se repete sobre a mesma árvore.** O gate completo roda uma vez, na fila de merge; onde o projeto guarda o verde pela árvore exata (o gate do kit faz isso), quem roda de novo confere que a árvore do registro é a do worktree dele.
- **Crítica de tela:** o `design-system:critico-de-ui` dá nota de 0 a 30. **De 24/30 para cima, sem ressalva alta, a tela está liberada**; ressalva alta volta para conserto mesmo com nota boa; média ou baixa vai para `depois`. **No máximo 2 recríticas**; na terceira, o que ainda estiver abaixo de 24 vai ao operador pela orquestradora. Achado fora do escopo do plano nunca entra no mesmo PR; na via rápida a crítica é uma só, sem recrítica.
- **Não confia no relato.** O validador abre o arquivo, roda o teste, olha o artefato final (a tela, o PDF, a imagem publicada) — não o mecanismo que o produziu.

**Tarefa pequena não se divide.** Uma pergunta, uma leitura, uma edição de poucas linhas ficam com quem está — abrir sessão custa ~105 mil tokens de piso (subagente, ~33 mil), e o briefing custa mais que o trabalho. Sessão dona é para item com plano de mais de um passo.

## Ao abrir

- **Sessão dona** (`start_session`): `model` e `effort` pela classificação do item — dona de risco sem `model` (herda Opus) e `effort: "high"`; dona mecânica `model: "claude-sonnet-5-5"`, `effort: "medium"`. Título `F<n> · <tema>`; o prompt diz "Você é a dona do F<n>" e aponta o manual `pool/dona.md`.
- **Subagente** (`Agent`): `subagent_type: "orquestracao:validador" | "orquestracao:explorador"` ou um agente de design, só para trabalho que não grava. Só passe `model` à mão quando o padrão do agente não servir.
- **Briefing**: o da dona traz o item, o que já se sabe e o critério de pronto; o do validador, o da [revisão](#a-revisao); o do explorador, a pergunta e o teto da resposta.

<a id="contexto"></a>
## Contexto: quando limpar, quando compactar

**Vale a pena, pelos dois lados.** Custo: cada turno relê a conversa inteira, e depois de 1 hora parada o cache expira e ela é reescrita a preço dobrado; na medição de 02/11 (semana de 26/10, a conta inteira), ~87% do custo foi leitura e escrita de cache, não resposta. Qualidade: contexto longo dilui a atenção, e o que foi lido há 200 mil tokens pode já ter mudado no disco. O que limpar custa: ~105 mil tokens de piso para recomeçar, e o que não estava escrito em lugar nenhum. Por isso a regra é **limpar no fim de uma unidade de trabalho, com o estado escrito**, e nunca no meio de um raciocínio.

**Limpar > compactar.** Limpar (`clear_session` com `"self"`, ou `/clear`) recomeça do arquivo de estado, que você controla. Compactar (`/compact`) troca a conversa por um resumo que você não controla e que perde exatamente o detalhe que fazia diferença (o erro exato, o porquê de uma escolha). Compactar só quando o trabalho está no meio, o estado não cabe num arquivo e falta pouco — e aí `/compact <o que preservar>`. A compactação automática é **rede de segurança**, não plano.

**Depois de limpar ou compactar, releia antes de editar.** O que o resumo diz de um arquivo é memória; abra o trecho antes de mexer nele.

**Por papel:**

| Papel | Regra |
|---|---|
| **Dona** e **orquestradora no modo ausente** | Lê `get_usage` (`"self"`, `context.tokensUsed`) a cada unidade concluída. **≥ 350 mil:** grava o handoff do item e limpa no próximo momento oportuno. **≥ 250 mil e o turno vai terminar esperando o operador:** limpa antes de encerrar — retomar custa ~105 mil, reescrever 250+ mil custa mais. **≥ 500 mil:** não pega trabalho novo até limpar. A dona continua dona depois da limpeza (o `local_…` não muda). |
| **Orquestradora com o operador presente** | Não limpa sozinha: a partir de 250 mil o botão `↺ Limpar` da barra fica destacado (a sessão já recomeça com ~105 mil), e a limpeza é do operador (skill `orquestradora`, "Orçamento de contexto"). Com o cache frio (1 h sem turno) o botão vira `↺ Limpar já` e limpa direto, sem turno da sessão: o arquivo de estado tem de estar em dia. Na volta de toda limpeza, o painel reabre e a skill `orquestradora` é carregada sem esperar o operador. |
| **Validador** (subagente) | **Sempre contexto novo**, inclusive para revisar o conserto do mesmo trabalho. Revisão que não cabe vira duas, por faixa de arquivo. |
| **Explorador** (subagente) | Uma pergunta, uma resposta, fim. |

**A rede de segurança por agente** (`autoCompactWindow`, onde a compactação automática dispara). O global fica em **600 mil** (`~/.claude/settings.json`) e vale para as sessões. Nos agentes, ele vai no frontmatter: validador **400 mil**, explorador **200 mil**. Esse frontmatter só compacta mais cedo, exige Claude Code 2.1.296 ou mais novo (antes disso a chave é ignorada sem erro) e perde para `CLAUDE_CODE_AUTO_COMPACT_WINDOW` exportada no shell. Nunca exporte essa variável: ela anula o frontmatter de todos os agentes de uma vez.

**A trava.** O hook `${CLAUDE_PLUGIN_ROOT}/hooks/contexto-do-papel.mjs` (em `Stop`, o último) lê o contexto da sessão no transcript (a última entrada do fio principal; subagente não conta) e **cobra** a tabela acima, para a regra não depender de a sessão lembrar do `get_usage`. Com o operador presente, a orquestradora não é bloqueada (o hook só registra `contexto-alto`), e a trava T7 de `travas-da-sessao.mjs` recusa o `clear_session "self"` dela sem o ok do operador (turno humano, modo ausente ligado ou o botão da barra ≤ 30 min). Com o modo ausente ligado ela segue a régua da dona, registrada como `orquestradora-ausente`, e o aviso diz desde quando o modo está ligado e que quem está presente o desliga (`/ausente off` ou o botão do painel). Dona e orquestradora no modo ausente: **≥ 500 mil** cobra limpar (só `clear_session` com `"self"` no turno satisfaz, e uma chamada recusada não conta); **≥ 350 mil** cobra limpar ou a linha `Contexto: sigo — <o que falta na unidade>` (com pelo menos 10 caracteres depois do travessão); **≥ 250 mil** com o turno terminando esperando o operador (`?` ou `Q<n>` no último parágrafo) cobra limpar antes. Cobra uma vez por turno (`stop_hook_active` deixa passar), erro nunca prende o turno, e a sessão sem papel não é medida. Cada desfecho vai para `~/.claude/orquestracao/hooks-crewai.log` (`cobrou-…`, `satisfeito-sigo`, `limpou`, `contexto-alto`, `deixou-passar`, `sem-usage`, `erro`). Os limites ficam em constantes no topo do hook.

**Momento oportuno** (vale para todos): nenhum subagente seu rodando (a notificação se perderia), nenhum merge, release ou gate em andamento, nenhuma pergunta do operador sem resposta, e o estado escrito — o handoff do item com o que está aberto e o **próximo passo exato** (skill `handoff-de-sessao`).

**O que não entra no contexto economiza mais que limpar:** saída de comando longo vai para arquivo e só o fim aparece; `grep -n` e `Read` com faixa em vez do arquivo inteiro; diff grande vai para o validador; varredura larga vai para o `orquestracao:explorador`.

## O que isto não muda

- Modelo que um **produto** usa em runtime (ex.: um agente que o projeto embute no produto) é decisão do produto, não desta skill.
- A sessão que o operador abre à mão segue o padrão global; esta skill vale para o que as sessões abrem a partir dela.
