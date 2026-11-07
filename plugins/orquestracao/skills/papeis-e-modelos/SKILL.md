---
name: papeis-e-modelos
description: Qual modelo e qual papel cada sessão e cada subagente usa — a sessão dona do item em Opus (esforço médio; alto por gatilho nomeado: decisão, contrato, estado, segurança, produção, devolvido), que planeja e documenta, a execução do plano pelo subagente `orquestracao:executor` em Sonnet, revisão pelo subagente `orquestracao:validador` de contexto limpo, `orquestracao:explorador` em Haiku só para ler, orquestradora em Opus. Use ANTES de abrir sessão nova (start_session) ou lançar subagente (Agent), ao escrever o briefing de uma sessão dona ou de um subagente, ao delegar o código e os testes, e quando o operador perguntar "qual modelo usar", "abre uma sessão para fazer isto", "manda um agente revisar". Vale em todo projeto; a qualidade vem antes da economia.
---

# Papéis e modelos

O modelo é função do **que a sessão ou o agente vai decidir**, não do gosto de quem abre. Quem decide usa o modelo mais forte; quem cumpre um plano que já decidiu tudo usa o intermediário; quem só lê usa o mais leve. Por isso **a dona planeja e documenta em Opus**, e o código e os testes do plano que ela fechou vão ao **executor em Sonnet** ([ADR 0036](../../../../docs/adr/0036-a-dona-planeja-em-opus-e-a-execucao-vai-ao-sonnet.md)). **Qualidade vem antes de economia**: na dúvida sobre um [gatilho](#gatilhos-do-opus), esforço alto.

<a id="modelo-da-dona"></a>
## Os papéis

| Papel | Onde roda | Modelo | Esforço | Faz | Não faz |
|---|---|---|---|---|---|
| **Orquestradora** | sessão `🎛 orquestradora — <projeto>` | Opus 5.5 | alto | abre uma sessão dona por item, é a fila de merge, faz o release, reserva números de documento (skill `orquestradora`) | escrever código de item |
| **Dona do item** | sessão `F<n> · <tema>` | Opus 5.5 | médio; alto com [gatilho](#gatilhos-do-opus) | o item inteiro, do plano ao PR: mede, decide, escreve o plano e os documentos (ADR, SPEC, diário, roteiro), delega a execução, confere o diff, commita e abre o PR | mergear, subir versão dos plugins |
| **Executor** | subagente `orquestracao:executor` | Sonnet 5.5 | médio | o código e os testes do plano que a dona fechou ([as cinco coisas](#plano-pronto)), rodando só os testes afetados | planejar, decidir o que o plano não decidiu (devolve à dona), gravar documentação, commitar |
| **Revisor** | subagente `orquestracao:validador` | Sonnet 5.5 ou Opus 5.5, pelo risco declarado do item e pelo diff (hook `modelo-do-validador.mjs`) | alto | revisa o diff contra o plano, tenta derrubar cada afirmação, roda o teste, abre o artefato final | editar (devolve achados) |
| **Explorador** | subagente `orquestracao:explorador` | Haiku 5.5 | baixo | busca e leitura: onde está X, quem chama Y, resumir um log ou uma página | escrever arquivo, concluir causa |
| **Design** (item com tela) | subagentes `design-system:revisao-de-arquitetura-de-ui` e `design-system:critico-de-ui` | o do agente | — | a revisão de arquitetura antes do código e a crítica depois | escrever código de tela |

- **Uma sessão dona por item, do plano ao PR.** A dona mede, decide, escreve, testa, revisa por subagente e abre o PR; o manual é `${CLAUDE_PLUGIN_ROOT}/pool/dona.md`, a regra comum `${CLAUDE_PLUGIN_ROOT}/pool/protocolo.md`. Título da sessão: `F<n> · <tema em palavras do produto>`.
- **Quem abre a dona escolhe o esforço** pela classificação do item (a sessão não troca o próprio modelo nem o esforço); a dona escolhe o de cada subagente pelo risco do que ele revisa. Critérios no protocolo, âncora `modelo-e-esforco`; skills de cada etapa, âncora `skills-da-etapa`.
- **Planeja em Opus, executa em Sonnet, sem trocar de sessão.** A sessão não troca o próprio modelo (perderia o cache): o "depois muda pra Sonnet" é o executor, um subagente que a dona lança com o plano fechado. A decisão que aparece na execução volta à dona no relatório do executor; nenhum item muda de dona por isso.
- **Item pequeno a dona escreve sozinha** (poucas edições, dentro do corte da [via rápida](#a-revisao)): o piso do executor (~33 mil tokens) custaria mais que o trabalho.
- **Testes:** só os afetados durante o trabalho (`testes-afetados -- <comando>`); o gate completo roda uma vez, na fila de merge da orquestradora.

Ids: Opus 5.5 `claude-opus-5-5` (alias `opus`), Sonnet 5.5 `claude-sonnet-5-5` (`sonnet`), Haiku 5.5 `claude-haiku-5-5` (`haiku`).

## As duas travas da ferramenta

- **Ninguém abre sessão acima do próprio modelo.** `start_session` aceita `model` igual ou mais barato que o de quem chama; mais caro é ignorado em silêncio. Por isso **a orquestradora roda em Opus**: é dela que saem as donas, em Opus. Com a orquestradora em Sonnet, o app não abre a dona em Opus (no Orca o `worker-start` abre). Sessão em Sonnet que precisa de uma decisão não abre outra sessão: devolve a pergunta a quem a abriu.
- **Subagente herda o modelo de quem o lança, a menos que o agente diga outro.** Prefira `subagent_type` com o agente do plugin (`orquestracao:validador`, `orquestracao:executor`; o modelo, o esforço e as ferramentas vêm do arquivo em `agents/` do plugin) a escrever `model` em cada chamada. Subagente nunca sobe acima do modelo da dona.

<a id="quem-escreve-e-sessao"></a>
## Quem escreve é sessão

O subagente não aparece na lista de sessões nem no painel, não pode ser conduzido no meio e, quando morre, deixa mudança no disco sem dono. Os defeitos medidos foram de **escrita**; leitura por subagente não tem caso registrado. Por isso o corte é por *o que o trabalho faz no disco*:

- **Commita, abre PR ou grava documento → a própria sessão** (a dona do item). Trabalho de escrita que não cabe no item vira item novo, com a sua dona, pela orquestradora.
- **Grava o código e os testes do plano fechado → o `orquestracao:executor`**, a única exceção: dentro do repositório da dona, fora de `docs/`, `.claude/`, `.git/` e de `.md`/`.mdx`. A dona confere o diff dele antes de commitar.
- **Só lê, mede ou devolve achados → subagente** pode, com o resultado consumido no mesmo turno: `orquestracao:explorador`, `orquestracao:validador`, os agentes de design.
- **Briefing de subagente que não é o executor diz que ele não edita.** Quem lança escreve no prompt *"não grave arquivo; devolva no relatório"*. Se no meio aparecer a necessidade de gravar, ele para e devolve.
- **A trava.** O hook `PreToolUse` `${CLAUDE_PLUGIN_ROOT}/hooks/subagente-nao-edita.mjs` **recusa** (`deny`, também em bypass) `Edit`/`Write`/`MultiEdit`/`NotebookEdit` de subagente (evento com `agent_id`) fora de `~/.claude/`, do rascunho (scratchpad, `/tmp`, `/var/folders`) e das notas entre sessões. O `executor` do kit (o tipo `orquestracao:executor` ou `executor`) grava Edit/Write só dentro da raiz do repositório da sessão (a pasta com `.git` mais próxima do `cwd`, pelo caminho real; symlink para fora não vale), fora de `docs/`, `.claude/` e `.git/` dessa raiz e nunca em `.md`/`.mdx`; o resto é recusado com motivo próprio. Exceção por agente em `~/.claude/orquestracao/subagente-pode-escrever.txt` (um `subagent_type` por linha, `*` no fim casa prefixo; casa o tipo com ou sem o prefixo de um plugin do kit). Sem lista, o `designer` do kit grava só na pasta de revisões do projeto (`design.revisoes` do `.claude/kit.json`, padrão `docs/design/revisoes`) e registra `liberado-por-papel`; o designer de outro plugin ganha a mesma pasta, com a mesma cerca, quando o projeto o declara pelo tipo exato em `design.designers` do `.claude/kit.json` (ex.: `"designers": ["acme:designer"]`; `*` não vale, para não liberar todo plugin instalado). A configuração das travas fica fechada para todo subagente, inclusive o tipo liberado (senão ele se libera): as listas `subagente-pode-escrever.txt` e `trava-edicao-repos.txt`, os marcadores `ativas/` e a `batida/` que os recria, o `painel/` e o `limpeza/` (respostas e clique do operador), a bandeira `operador-ausente.json`, o estado `hooks-crewai-estado.json`, o cache `pool-registro-cache.json`, o `settings.json` (e o `.local`) de qualquer `.claude/`, os transcripts (`~/.claude/projects/**/*.jsonl`) e `~/.claude/plugins/` (fora `plugins/data/`). Bash fica de fora, como no `orquestradora-nao-edita`, salvo o comando que cita um desses arquivos pelo nome e grava (cerca contra deslize: nome por variável, `claude plugin` e os transcripts passam). Cada recusa vai para `~/.claude/orquestracao/hooks-crewai.log` (`recusou`, `recusou-trava`, `recusou-symlink`, `recusou-executor`, `liberado-executor`, `liberado-por-tipo`, `liberado-por-papel`, `erro`).

<a id="gatilhos-do-opus"></a>
## Os gatilhos do esforço alto
A dona nasce em **Opus 5.5, esforço médio**, salvo quando um destes vale; aí, **esforço alto**, e o prompt da dona leva a linha `Esforço alto: <gatilho> — <motivo em uma frase>` (a antiga `Gatilho do Opus: <gatilho>` vale como sinônimo; [ADR 0036](../../../../docs/adr/0036-a-dona-planeja-em-opus-e-a-execucao-vai-ao-sonnet.md), lista do [ADR 0025](../../../../docs/adr/0025-a-dona-nasce-em-sonnet-e-o-opus-pede-gatilho.md)). Cada um se confere antes de abrir a dona, no pedido:

| Gatilho | Vale quando |
|---|---|
| `decisao` | o plano não tem [as cinco coisas](#plano-pronto): o item pede investigar, escolher, medir a causa |
| `contrato` | o item cria ou muda spec, ADR, schema, API, migration ou o formato de um arquivo que outro programa lê |
| `estado` | o item grava estado: banco, arquivo de estado vivo (`~/.claude/orquestracao/`), dados de usuário |
| `seguranca` | o item toca segredo, permissão ou autenticação |
| `producao` | o item toca deploy, release, dados de produção ou dinheiro |
| `devolvido` | o item voltou da fila de merge ou de outra dona |

**A trava** (`titulo-da-dona.mjs` no app, `trava-do-orca.mjs` no Orca) recusa a dona sem `model` ou sem `effort`, aberta por `fork`, em Sonnet, em Haiku ou em modelo desconhecido, em Opus com esforço que não é médio nem alto, ou em Opus alto sem a linha do gatilho (ou com gatilho fora da lista). No Orca, a sessão que não é dona passa em Sonnet, Haiku ou Opus médio; Opus em outro esforço pede a linha. Cada dona que passa vai ao `hooks-crewai.log` (`abriu-opus` com o gatilho e o esforço), a contagem que a medida lê.

<a id="plano-pronto"></a>
## O plano está pronto para o executor?

A dona só passa a execução ao `orquestracao:executor` quando o plano tem **as cinco coisas**. Faltando qualquer uma, a dona termina o plano antes (ou escreve ela mesma):

1. **Os arquivos**, por caminho, e o que muda em cada um.
2. **Os passos numerados**, na ordem, sem "decida o melhor jeito".
3. **O critério de pronto medível** — o teste que tem de passar, o comando, a saída esperada.
4. **O que está fora do escopo**, escrito.
5. **As regras do projeto que tocam o trabalho** (gate, migration, commit, idioma) e onde elas moram.

Sinais de que **não** está pronto: o pedido usa *"investigue"*, *"descubra por quê"*, *"escolha"*, *"melhore"*; a causa do defeito não foi medida; há mais de um jeito razoável e o plano não escolheu; o trabalho cria ou muda contrato (spec, schema, API, migration).

<a id="trava-do-criterio"></a>
## A trava do critério: o relatório não contradiz a saída real

O critério de pronto não depende do relato. O hook `${CLAUDE_PLUGIN_ROOT}/hooks/criterio-da-dona.mjs` (em `Stop`) confere o fim do turno da dona de item em `execucao`, `validacao` ou `merge` quando o turno **editou arquivo**. Trava (turno extra) só para correção (ADR 0026): **recusa** o relatório que a saída real contradiz (falha escondida, status ou contagem que não aparece na saída) ou que afirma sucesso (*"testes passaram"*, *"gate verde"*, `exit=0`) sem nenhum teste rodado no turno. O relatório que só não traz a saída real ganha um **aviso** ao operador, uma vez por turno, sem turno extra. Editar inclui lançar o `orquestracao:executor` (o relato dele, inclusive o `<result>` da notificação em segundo plano, não conta como saída real) e o Bash que grava (`sed -i`, `perl -i`, `>`/`>>` para arquivo, `tee`, heredoc para `python`/`node`, `git apply`, `patch`; e o `cp`/`mv`/`rm`/`git checkout --`/`git restore` que alcançam um arquivo de teste — mexer em teste liga a cobrança e registra `editou-teste`; `git restore --staged` só mexe no índice e não conta). Em `planejamento` e `design` a dona escreve plano e revisão e não é cobrada.

- **O que vale como saída real** — sempre conferido contra o que as ferramentas devolveram no turno (Bash, Monitor, `TaskOutput`, ou Read de um `.output`/`.log`):
  - um status (`exit=0`, `exit code 0`, `TEST_EXIT=0`, `test=0`, `Found 0 errors`) que **aparece na saída real** — status inventado no relatório não passa. O jeito seguro é terminar o comando de critério com `; echo "exit=$?"`;
  - uma contagem (`98 passed`, *"98 testes verdes"*) cujo número sai igual de um `N passed`/`N failed` (ou `ℹ pass N`/`# fail N`, do node:test e do TAP) da saída;
  - uma linha (≥ 10 caracteres) num bloco de código igual a uma linha da saída — é assim que passa critério que não é teste, como um `grep`.
- **Teste rodado no turno:** um trecho do Bash que começa pelo executor (`npm test`, `pnpm … typecheck`, `npx vitest`, `node --test`, `com-fichas`, `testes-afetados`, `tsc`, `pytest`, `cargo test`…; citar teste num `git add`, `ls` ou `cat` não conta), Monitor, `TaskOutput`, Read de um `.output`/`.log` que o turno lançou ou citou, saída com resultado de teste (`N passed`, `ℹ pass N`, `# pass N`, `Found N errors`) de qualquer executor, ou a notificação de tarefa em background.
- **Falha escondida:** a última saída com resultado tem `N failed`, `ℹ fail N` (node:test), `# fail N` (TAP) ou `Found N errors` e o relatório não cita o N junto da falha; sem contagem, o diagnóstico `error TS…` do tsc ou a linha de status com `exit` diferente de zero (não o nome de um teste que cita `exit=1`) contra relatório que afirma sucesso sem citar falha ou erro.
- **Falha escondida é cobrada:** se a ÚLTIMA saída com contagem do turno tem `N failed` e o relatório não cita um desses N junto da falha (*"2 testes falharam"*, a linha `Tests  2 failed` colada), o turno não termina. O `exit=1` do relatório não conta como um desses números.
- **Não cobra** quem devolve dúvida (linha terminando em `?` fora de bloco de código e que não é título markdown; `Bloqueado: <o motivo>` abrindo a linha; *devolvo*, *parei*, *estou bloqueado*), nem quem não editou.
- **Trabalho em background:** o turno que para esperando uma tarefa em background adia a cobrança para o turno em que a notificação chega, por no máximo 2 turnos seguidos. A notificação de Bash em background traz **só o exit**: leia o arquivo de saída ou cole o fim dele.
- **No máximo 2 cobranças por turno**; na terceira deixa passar e registra. Erro do hook nunca prende o turno. **Limite conhecido:** um `exit=0` de qualquer comando do turno vale como status; quem garante que veio do comando de critério é o validador.
- Cada desfecho vai para `~/.claude/orquestracao/hooks-crewai.log` (`cobrou-N`, `avisou-sem-saida`, `corrigiu-apos-cobranca`, `passou-com-saida`, `passou-duvida`, `adiou-esperando-fundo`, `deixou-passar-apos-2`, `passou-esgotado`, `erro`).

## Quando a dona trava

- **Ela pergunta só o irreversível** (destrutivo, produção, gasto de job, publicar para fora), com a pergunta inteira: o caso, o que acontece se ninguém decidir, a recomendação. O resto assume, marcado *assumida, a confirmar*, e segue.
- O executor não escolhe entre dois caminhos que o plano não escolheu: para e devolve à dona no relatório, e ela decide.

<a id="a-revisao"></a>
## A revisão

- **Nunca é quem escreveu.** A dona lança o `orquestracao:validador` de contexto limpo: quem fez o trabalho já acredita nele.
- **A exceção medida: a via rápida.** O item pequeno cujo diff cabe no corte do `${CLAUDE_PLUGIN_ROOT}/pool/via-rapida.mjs` (até 60 linhas em até 4 arquivos, nenhum contrato, trava, hook, migration ou removido) e que não grava estado, não toca segurança nem muda regra se autorrevisa pelo roteiro fixo do protocolo (âncora `via-rapida-da-revisao`), com o laudo no PR. Item de risco nunca vai por ela, nem o que muda regra de revisão.
- **O briefing traz** o plano, o diff (`git diff origin/<base>...HEAD`), o que a dona afirma ter feito, o critério de pronto e a frase *"só achados que afetam correção; skip style; não grave arquivo"*.
- **Modelo, pelo item e pelo diff:** declare o risco do item uma vez (`painel update fila F<n> '{"risco":true|false}'`: `true` se grava estado, toca segurança, dinheiro ou produção, ou voltou da fila) e lance o validador sem `model`. O hook `modelo-do-validador.mjs` põe Sonnet só com `risco: false` e diff sem contrato nem trava (o corte do `via-rapida.mjs`); no resto fica o Opus do agente; sem a declaração, ele recusa e a pede. Medido de 02 a 04/11: 128 de 131 rodadas em Opus quando a escolha era da memória da dona; o mesmo uso em Sonnet custa ~33% menos.
- **Espere no turno:** o validador roda em segundo plano; com mais nada a fazer, chame `esperar-fundo` em vez de terminar o turno (protocolo, âncora `espera-no-turno`).
- **A revisão do conserto mede o DELTA**, não o PR de novo: o segundo validador recebe os achados anteriores e `git diff <HEAD revisado>..<HEAD novo>`, confere que cada achado foi resolvido e que o conserto não quebrou o vizinho. Contexto novo continua obrigatório.
- **Achado médio ou alto** a dona conserta; em item de risco, um segundo validador sobre o delta. **Achado leve** vai ao PR ou ao `depois` do item, nunca vira item.
- **O gate não se repete sobre a mesma árvore.** O gate completo roda uma vez, na fila de merge; onde o projeto guarda o verde pela árvore exata (o gate do kit faz isso), quem roda de novo confere que a árvore do registro é a do worktree dele.
- **Crítica de tela:** o `design-system:critico-de-ui` dá nota de 0 a 30. **De 24/30 para cima, sem ressalva alta, a tela está liberada**; ressalva alta volta para conserto mesmo com nota boa; média ou baixa vai para `depois`. **No máximo 2 recríticas**; na terceira, o que ainda estiver abaixo de 24 vai ao operador pela orquestradora. Achado fora do escopo do plano nunca entra no mesmo PR; na via rápida a crítica é uma só, sem recrítica.
- **Não confia no relato.** O validador abre o arquivo, roda o teste, olha o artefato final (a tela, o PDF, a imagem publicada) — não o mecanismo que o produziu.

**Tarefa pequena não se divide.** Uma pergunta, uma leitura, uma edição de poucas linhas ficam com quem está — abrir sessão custa ~105 mil tokens de piso (subagente, ~33 mil), e o briefing custa mais que o trabalho. Sessão dona é para item com plano de mais de um passo.

## Ao abrir

- **Sessão dona** (`start_session`, `context: "fresh"`): **sempre** `model` e `effort` explícitos. Padrão `model: "claude-opus-5-5"`, `effort: "medium"`; com [gatilho](#gatilhos-do-opus), `effort: "high"` e a linha `Esforço alto: <gatilho> — <motivo>` no prompt. Título `F<n> · <tema>`; o prompt diz "Você é a dona do F<n>" e aponta o manual `pool/dona.md`.
- **No Orca:** `orca orchestration worker-start --agent claude --model claude-opus-5-5 --effort medium --setup skip --worktree new-child --spec-file …` ([tabela](../../pool/anfitriao-orca.md)); `--model` e `--effort` sempre explícitos, e o `--effort high` pede a linha `Esforço alto: <gatilho>` no spec. `--setup`, `--name` e `--display-name` só valem com `--worktree new-child`/`new-top-level`; com `--worktree path:` o `orca` os recusa. A trava é a `hooks/trava-do-orca.mjs`. A orquestradora no Orca é a coordenadora, em Opus com esforço alto, e se declara por `painel orquestradora assumir`, não pelo título ([no Orca](../orquestradora/SKILL.md#no-orca)).
- **Subagente** (`Agent`): `subagent_type: "orquestracao:validador" | "orquestracao:explorador"` ou um agente de design para o que não grava; `"orquestracao:executor"` para o código e os testes do plano fechado. Só passe `model` à mão quando o padrão do agente não servir; no validador, o risco se declara no item (`"risco":true`), não a cada chamada.
- **Briefing**: o da dona (escrito pela orquestradora) traz **só o pedido, as imagens e os fatos medidos** — o plano, o desenho e o critério de pronto são da dona; o do executor, o plano (ou o caminho dele), os arquivos e os passos, o comando de teste e o que não fazer; o do validador, o da [revisão](#a-revisao); o do explorador, a pergunta e o teto da resposta.

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

**A rede de segurança por agente** (`autoCompactWindow`, onde a compactação automática dispara). O global fica em **600 mil** (`~/.claude/settings.json`) e vale para as sessões. Nos agentes, ele vai no frontmatter: validador e executor **400 mil**, explorador **200 mil**. Esse frontmatter só compacta mais cedo, exige Claude Code 2.1.296 ou mais novo (antes disso a chave é ignorada sem erro) e perde para `CLAUDE_CODE_AUTO_COMPACT_WINDOW` exportada no shell. Nunca exporte essa variável: ela anula o frontmatter de todos os agentes de uma vez.

**A trava.** O hook `${CLAUDE_PLUGIN_ROOT}/hooks/contexto-do-papel.mjs` (em `Stop`, o último) lê o contexto da sessão no transcript (a última entrada do fio principal; subagente não conta) e **cobra** a tabela acima, para a regra não depender de a sessão lembrar do `get_usage`. Com o operador presente, a orquestradora não é bloqueada (o hook só registra `contexto-alto`), e a trava T7 de `travas-da-sessao.mjs` recusa o `clear_session "self"` dela sem o ok do operador (turno humano, modo ausente ligado ou o botão da barra ≤ 30 min). Com o modo ausente ligado ela segue a régua da dona, registrada como `orquestradora-ausente`, e o aviso diz desde quando o modo está ligado e que quem está presente o desliga (`/ausente off` ou o botão do painel). Dona e orquestradora no modo ausente: **≥ 500 mil** cobra limpar (só `clear_session` com `"self"` no turno satisfaz, e uma chamada recusada não conta; como cada limiar cobra uma vez, depois dessa cobrança a rede é a compactação automática); **≥ 350 mil** cobra limpar ou a linha `Contexto: sigo — <o que falta na unidade>` (com pelo menos 10 caracteres depois do travessão); **≥ 250 mil** com o turno terminando esperando o operador (`?` ou `Q<n>` no último parágrafo) cobra limpar antes. Cobra uma vez por limiar cruzado (ADR 0026): o turno seguinte no mesmo limiar passa (`ja-avisado`), só um limiar acima cobra de novo, e o contexto que cai abaixo do nível cobrado (limpeza, compactação) rearma; a linha `Contexto: sigo` também responde ao limiar (`stop_hook_active` deixa passar sem contar como avisado), erro nunca prende o turno, e a sessão sem papel não é medida. Cada desfecho vai para `~/.claude/orquestracao/hooks-crewai.log` (`cobrou-…`, `satisfeito-sigo`, `ja-avisado`, `limpou`, `contexto-alto`, `deixou-passar`, `sem-usage`, `erro`). Os limites ficam em constantes no topo do hook.

**No Orca:** não há `get_usage` nem `clear_session`; o hook lê o contexto do transcript, e a cobrança pede o handoff e o `worker_done --outcome failed` (troca de sessão). No terminal, o handoff e o `/clear` pelo operador.

**Momento oportuno** (vale para todos): nenhum subagente seu rodando (a notificação se perderia), nenhum merge, release ou gate em andamento, nenhuma pergunta do operador sem resposta, e o estado escrito — o handoff do item com o que está aberto e o **próximo passo exato** (skill `handoff-de-sessao`).

**O que não entra no contexto economiza mais que limpar:** saída de comando longo vai para arquivo e só o fim aparece; `grep -n` e `Read` com faixa em vez do arquivo inteiro; diff grande vai para o validador; varredura larga vai para o `orquestracao:explorador`.

## O que isto não muda

- Modelo que um **produto** usa em runtime (ex.: um agente que o projeto embute no produto) é decisão do produto, não desta skill.
- A sessão que o operador abre à mão segue o padrão global; esta skill vale para o que as sessões abrem a partir dela.
