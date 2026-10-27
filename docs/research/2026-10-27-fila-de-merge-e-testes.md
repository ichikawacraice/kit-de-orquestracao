# Fila de merge, testes por impacto e estado por projeto: o kit diante do estado da arte

Snapshot de 2026-10-27. Fontes acessadas em 2026-10-27; pesquisa envelhece, confira a data antes de confiar. O código do kit lido é o da `origin/main` em `b86e766`.

Pedido do operador (27/10): rodar o mínimo de testes sem perder segurança, juntar na base o mais rápido possível, gate completo só quando preciso, e separar o trabalho por projeto para ninguém ler o que não precisa.

Legenda: **[não confirmado]** = não achei fonte primária que confirme; número de fornecedor sem metodologia vem marcado como tal.

## O que o kit faz hoje (medido)

- **Fila de merge** (`plugins/orquestracao/skills/orquestradora/scripts/fila-de-merge.mjs`): num worktree destacado em `origin/<base>`, aplica os PRs por squash na ordem dada; o que conflita sai. Roda o gate **uma vez** na combinação. Verde: todos entram. Vermelho: refaz do zero **um PR por vez**, com um gate depois de cada um (custo linear: lote de N vermelho custa 1 + N gates). Não há retry, nem janela de espera: a orquestradora chama `painel fila-de-merge` com o que tem quando o recado `PR N pronto` chega, e na prática cada PR acaba rodando um gate completo sozinho.
- **Gate verde por árvore** (`gate/o-verde-da-arvore.mjs`): pula a árvore que já passou, com chave pela árvore exata, runtime e env. É usado pelo gate dos projetos (`gate/a-vez-do-gate.mjs`), **não** pelo `npm test` deste repo (`node gate/com-fichas.mjs --quero 4 -- node --test`), que é o gate padrão da fila. Logo a fila não reaproveita verde.
- **Teto de núcleos** (`gate/com-fichas.mjs`): fichas por máquina, somando sessões; gate e testes dividem o teto.
- **Testes afetados** (`.../scripts/testes-afetados.mjs`): `git diff` contra o merge-base + não rastreados; teste afetado é o tocado, o que cita o **nome** de um tocado, ou o que cita um módulo que cita um tocado (**um nível**). Citação por nome pega também `readFileSync('…/protocolo.md')` e `spawnSync` de script, o que muitas ferramentas de grafo de import perdem. Não há gatilho global que force a suíte inteira.
- **Estado do painel** (`~/.claude/orquestracao/painel/`, medido agora): `perguntas/` com 437 arquivos num diretório só — 257 `izanagi`, 42 `Izanagi`, 95 `kit-de-orquestracao`, 43 sem `projeto` — e **nenhuma aberta** (376 respondidas, 47 assumidas, 14 canceladas). `sessoes/` 137 (5 sem projeto), `fila/` 21. A leitura já compara em minúsculas, mas `doProjeto` (`painel.mjs:187`) devolve verdadeiro para documento **sem** `projeto`: esses 43+5 aparecem na listagem de todo projeto.
- **Skill da orquestradora**: 202 linhas; a linha 12 declara legado tudo o que fala de pool P/D/E/V, mas esse texto (linhas 32–34, 61–65, 110 e outras) continua sendo carregado inteiro a cada ativação.

## 1. Fila de merge

| Sistema | Lote e janela | Lote vermelho | Especulação | Teste instável |
|---|---|---|---|---|
| GitHub merge queue | mín./máx. por grupo (1–100) e "wait time" para completar o mínimo; defaults não publicados na doc [1] | sem bisseção: tira o PR e refaz os de trás [1][2] | sim, cada grupo sobre os da frente [1] | "Only merge non-failing PRs" desligado deixa um posterior verde absolver o anterior; HEADGREEN × ALLGREEN [1][3] |
| Bors-NG | lote = PRs com `r+` num commit de staging [4] | **bisseção**, O(E log N) contra O(N) [4] | não | [não confirmado]; projeto descontinuado em 2023 a favor da fila do GitHub [5] |
| rust-lang/bors | rollup manual (`rollup=always/maybe/iffy/never`) [6][7] | [não confirmado] | não | [não confirmado] |
| Zuul | janela dinâmica: `window` 20, `window-floor` 3, cresce +1 a cada sucesso, cai pela metade a cada falha [8] | tira o culpado, mergeia os da frente, reinicia os de trás [9] | sim, gate dependente [9] | janela por projeto: falha de um não encolhe a do outro [8] |
| Mergify | `batch_size` (faixa) e `batch_max_wait_time` [10] | bisseção; `batch_max_failure_resolution_attempts` (0 = despeja todos) [10] | `max_parallel_checks` [11] | [não confirmado]; "3–5x" é marketing [12] |
| Uber SubmitQueue | árvore de especulação com preditor de sucesso e analisador de conflito [13] | aborta builds fora do conjunto priorizado [13] | sim, priorizada por probabilidade | 40–65% dos builds eram abortados; melhorias de 2025 cortaram 53% de CI [14] |
| Chromium CQ / LUCI CV | sem lote: cada mudança isolada (leitura nossa da doc) [15] | — | não | retesta o shard, roda sem o patch, só reprova se falha com o patch duas vezes e passa sem ele; reaproveita dry run verde "fresco" (24 h) [15] |
| Google TAP | "milestones": junta commits a cada ~45 min no pico e roda só os afetados [16] | culprit finding bayesiano com busca binária ruidosa: ~97,5% de acerto, contra 96,1% da bisseção com retry, sem custo a mais [17][18] | ciclos especulativos com ML (2025): detecção de quebra 107 → 37 min (mediana) [19] | o próprio algoritmo é ciente de instabilidade [17] |
| Aviator | `batch_size` 1 e `batch_max_wait_minutes` 0 por padrão [20] | bisseção [20] | modo paralelo [21]; filas independentes por "affected targets" [22] | [não confirmado] |
| Graphite | lote em beta; stacks validadas de uma vez [23] | isolamento paralelo (padrão) ou bisseção [24] | `Concurrency` [24] | sem detecção; recomenda concorrência baixa [24] |
| Trunk | lote desligado por padrão; alvo 4, espera máx. 5 min (0 = não espera) [25] | bisseção; "skip redundant bisection" pode despejar inocente por flaky [25] | "optimistic merging" [26] | "pending failure depth" e "anti-flake": 1–3 retries [27][28]; números de marketing |

**O que é comum:** (1) testar já com os PRs da frente; (2) lote com teto em torno de 4–5 e espera curta ou zero; (3) achar o culpado em O(log n); (4) verde posterior prova os anteriores; (5) separar flaky de falha real antes de culpar alguém.

**O que serve a uma fila local** (uma máquina, 1–6 PRs, gate de 1–3 min, sem nuvem):

- **Especulação paralela não serve.** Ela troca CPU por latência, e aqui a CPU (o teto de fichas) é o gargalo; a Uber mediu 40–65% de builds jogados fora [14]. O "um gate na combinação" do kit já é o equivalente a HEADGREEN e está certo.
- **Lote pela fila ocupada, não por relógio.** A lição do TAP (agrupar porque testar cada mudança cresce quadrático [16]) e do Trunk/Aviator (espera 0 como default [20][25]) é: o lote é tudo o que chegou **enquanto o gate anterior rodava**. Sem espera artificial quando a fila está vazia; com gate rodando, o próximo PR espera e entra no lote seguinte junto com os outros. É exatamente a fraqueza medida (cada PR com gate próprio) e custa pouco.
- **Bisseção no lugar do "um por vez".** Com 6 PRs, o linear custa até 6 gates extras; a bisseção, cerca de 3 para um culpado [4][10]. Regra do Mergify: o PR que fechou uma rodada verde não se retesta [10].
- **Um retry antes de bisseccionar.** Com gate de 1–3 min, refazer a combinação uma vez é mais barato que bisseccionar por causa de flaky (Chromium [15], Trunk [28]). Se o retry passa, registra o teste como suspeito de instável.
- **Reaproveitar o verde da árvore combinada.** O Chromium reaproveita dry run fresco [15]; o kit já tem a chave por árvore, só não a usa no gate deste repo. Ganho pequeno aqui (a árvore combinada raramente se repete), maior quando o lote verde é seguido de `mergear` sobre a mesma árvore.

## 2. Testes por impacto e quando o gate completo é obrigatório

- **Bazel**: com `--cache_test_results=auto`, o teste só roda de novo se ele ou uma dependência (transitiva) mudou [29]. `bazel-diff` [30] e `target-determinator` [31] calculam alvos afetados por hash; alertam que lista de alterados incompleta gera falso negativo.
- **Nx** (v24): `affected` por **entradas de tarefa** + consumidores; lockfile alterado afeta tudo por padrão; `implicitDependencies` declara o que a análise estática não vê [32][33][34].
- **Turborepo**: `globalDependencies`/`globalEnv` invalidam tudo; checkout raso marca tudo como alterado [35][36].
- **Jest** `--onlyChanged`/`--changedSince`/`--findRelatedTests` exigem grafo estático (sem require dinâmico) [37]; **Vitest** `--changed`, e `recordDependencies` grava dependências em tempo de execução [38]. **`node --test` não tem equivalente** [39] — o kit tem de manter o próprio seletor.
- **Meta, Predictive Test Selection** (ICSE-SEIP 2019): seleciona menos de 1/3 dos testes da linha de base transitiva, pega >95% das falhas individuais e >99,9% das mudanças com defeito, corta o custo de infra pela metade; a rede de segurança é **rodar tudo na master a cada poucas horas** e, em parte das mudanças, rodar tudo para medir o recall real [40][41].
- **Google TAP**: presubmit com os relevantes; postsubmit periódico perto do HEAD com tudo o que pode ter sido afetado [16][42].
- **Launchable** e **Develocity**: seleção por meta de confiança, com simulador para medir antes de ligar [43][44]. "35–70% de economia" é do fornecedor.
- **Riscos registrados**: dependência não estática (require dinâmico, reflexão, arquivo de recurso lido em execução — o Testar do Google não os detecta), teste novo fora do mapa, seleção de um nível perde efeito indireto e a transitiva seleciona demais em código compartilhado [37][40][45].

**Quando a suíte inteira é obrigatória, pelas fontes:** (a) depois do merge na base, periodicamente ou por lote (Meta, Google) — no kit, é o gate da fila; (b) quando muda arquivo global (config, lockfile, infraestrutura de teste) — Turborepo, Nx; (c) quando a lista de alterados é vazia ou suspeita (base errada, checkout raso) — bazel-diff, Turborepo; (d) para medir o recall do seletor, de tempos em tempos. Rodar só à noite "atrasa a má notícia" [45]. Não achei fonte primária pedindo suíte inteira "antes do release" [não confirmado]; no kit, o release já sai de HEAD com gate do lote verde.

**Comparação com o kit:** a divisão "afetados durante o trabalho, completo uma vez na fila" é o desenho da Meta e do Google em miniatura. O que falta: gatilhos globais, fecho transitivo e medir o recall. Seleção preditiva por ML não compensa num repo com 77 arquivos de teste e gate de minutos.

## 3. Estado e contexto separados por projeto

- **Claude Code**: memória por projeto em `~/.claude/projects/<projeto>/memory/`, chave derivada da raiz do git (worktrees do mesmo repo compartilham); `MEMORY.md` lido até 200 linhas/25 KB e o resto sob demanda; CLAUDE.md de subpasta só carrega quando a sessão mexe nela; `.claude/rules/` com `paths:` [46]. Subagente tem janela própria [47].
- **Codex** (`AGENTS.md` por pasta, teto de 32 KiB) [48] e **Cursor** (regras por glob, < 500 linhas) [49]: contexto escopado pela pasta.
- **Devin** e **OpenHands**: workspace/sandbox por sessão [50][51].
- **LangGraph**: memória curta por `thread_id`, longa por namespace em tupla `("memories", user_id)` [52]. **CrewAI**: escopos hierárquicos, sem promessa de fronteira de segurança [53]. **Ruflo**: `--namespace`, mas algumas ferramentas o ignoram [54].
- **Identificador canônico**: não achei fonte de agentes sobre normalizar nome de projeto [não confirmado]; o análogo é o rótulo DNS do Kubernetes (minúsculo, `[a-z0-9-]`, até 63) [55].
- **Context engineering** (Anthropic): o menor conjunto de tokens de alto sinal; recuperação na hora (guardar o caminho, ler sob demanda); subagente devolve resumo [56]. **Agent Skills**: só nome e descrição pré-carregados, SKILL.md com menos de 500 linhas, referências a um nível, script executado em vez de lido [57].

**Comparação com o kit:** a chave de projeto já vem da raiz do git (`projetoDoCwd`), como no Claude Code, mas a **escrita** aceita o texto que vier (daí `Izanagi`) e a **leitura** deixa passar o que não tem projeto. O diretório único de perguntas não pesa em disco (2,3 MB o painel inteiro); pesa em quem lista, e todas as 437 estão fechadas. A skill da orquestradora está abaixo do teto de 500 linhas, mas carrega o legado do pool a cada ativação; é o caso de manual de referência em arquivo à parte.

## Recomendações, por ganho/custo

1. **Lote pela fila ocupada.** Enquanto um gate da fila roda, o `PR N pronto` que chega entra numa lista pendente; ao terminar, o próximo lote é a lista inteira. Sem espera quando a fila está vazia (nada de janela por relógio). Ganho: acaba o gate completo por PR quando chegam juntos; custo: um arquivo de pendentes e uma regra na skill. **Vira F**: sim.
2. **Retry único + bisseção no vermelho.** Na `fila-de-merge.mjs`, combinação vermelha roda de novo uma vez; se ainda vermelha, divide ao meio (o lado verde entra, o vermelho divide de novo); o PR que fechou rodada verde não se retesta. Verde no retry registra suspeita de flaky no log. Ganho: de 1+N para ~1+log₂N gates e menos devolução por flaky; custo: ~40 linhas e testes da fila. **Vira F**: sim.
3. **Projeto canônico na escrita e sem vazamento na leitura.** `painel` grava `projeto` em minúsculas (slug `[a-z0-9-]`, derivado da raiz do git) e recusa outro; `doProjeto` deixa de aceitar documento sem projeto; migração única dos 42 `Izanagi` e dos 43+5 sem projeto (atribuir pelo `sessaoId`/data, ou mover para `sem-projeto`). Ganho: cada projeto lê só o seu; custo: pequeno, mas mexe em estado gravado (Opus). **Vira F**: sim.
4. **Perguntas fechadas fora do diretório quente.** Fechada (respondida/assumida/cancelada) vai para `perguntas/arquivo/<projeto>/AAAA-MM/` (ou equivalente); o pane e `list` leem só as abertas, e o rodapé "respondidas" lê as do dia. Hoje seriam 0 de 437 na pasta quente. Pode entrar no mesmo item do 3. **Vira F**: sim (ou junto do 3).
5. **Gatilhos globais e fecho transitivo no `testes-afetados`.** Lista no `kit.json` (ex.: `package.json`, `.claude/kit.json`, `gate/**`, helpers e fixtures de teste, manifestos dos plugins) que, tocada, devolve "todos"; lista vazia com diff não vazio, ou base não achada, também devolve "todos"; o nível único de dependentes vira fecho transitivo (mantendo a citação por nome, que já cobre leitura de arquivo). Ganho: fecha o furo do efeito indireto que hoje só a fila pega; custo: médio. **Vira F**: sim.
6. **Medir o recall dos afetados.** Quando o gate da fila fica vermelho num PR, conferir se os testes que falharam estavam na seleção da dona (`testes-afetados --json` no SHA do PR) e registrar acerto/erro num log. É a "learning run" da Meta, de graça. Ganho: diz se o 5 é necessário ou suficiente; custo: pequeno. **Vira F**: sim, pequeno; vale fazer antes ou junto do 5.
7. **Legado do pool fora da skill da orquestradora.** O texto marcado como legado (pool P/D/E/V, `painel pegar`, afinidade, vagas) vai para um arquivo de referência citado por uma linha, carregado só com `KIT_MODELO=papeis`. Ganho: contexto da orquestradora a cada ativação; custo: só doc, mas exige cuidado com âncoras citadas. **Vira F**: sim.
8. **Verde da árvore no gate da fila.** Passar o gate da fila pelo `o-verde-da-arvore` para não repetir a mesma árvore combinada (ex.: refazer o lote depois de um conflito resolvido sem mudança de conteúdo). Ganho pequeno neste repo. **Vira F**: não por ora; reavaliar depois do 1 e do 2.

**O que não vale trazer:** especulação em paralelo (Zuul, SubmitQueue, Aviator paralelo) — gasta o teto de núcleos que é o gargalo; seleção preditiva por ML (Meta, Launchable, Develocity) — o repo é pequeno demais para treinar e o gate é curto; filas independentes por alvo afetado (Aviator) — com 1–6 PRs por lote o ganho não paga a complexidade; janela por relógio (Mergify, Trunk) — com gate de minutos, esperar custa mais do que testar.

## Fontes

1. GitHub Docs, Managing a merge queue — https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue
2. GitHub Docs, webhook `merge_group` — https://docs.github.com/en/webhooks/webhook-events-and-payloads#merge_group
3. Schema GraphQL `MergeQueueGroupingStrategy` (réplica no JSR) — https://jsr.io/@luxass/github-schema/doc/~/MergeQueueGroupingStrategy
4. Bors-NG README — https://github.com/bors-ng/bors-ng/blob/master/README.md
5. This Month in Bors #76 — https://bors.tech/newsletter/2023/04/30/tmib-76/
6. rust-lang/bors — https://github.com/rust-lang/bors
7. Rust Forge, Rollups — https://forge.rust-lang.org/release/rollups.html
8. Zuul, Pipeline config — https://zuul-ci.org/docs/zuul/latest/config/pipeline.html
9. Zuul, Gating — https://zuul-ci.org/docs/zuul/latest/gating.html
10. Mergify, Batches — https://docs.mergify.com/merge-queue/batches/
11. Mergify, Parallel checks — https://docs.mergify.com/merge-queue/parallel-checks/
12. Mergify, Merge queue — https://docs.mergify.com/merge-queue/
13. Uber, paper sucessor do SubmitQueue (arXiv 2501.03440) — https://arxiv.org/html/2501.03440v2
14. Uber Engineering, Slashing CI costs at Uber — https://www.uber.com/us/en/blog/slashing-ci-costs-at-uber/
15. Chromium, CQ — https://chromium.googlesource.com/chromium/src/+/HEAD/docs/infra/cq.md
16. Memon et al., Taming Google-scale continuous testing (ICSE-SEIP 2017) — https://huang.isis.vanderbilt.edu/cs8395-f23/paper/google-testing-icse-seip-17.pdf e https://research.google/pubs/taming-google-scale-continuous-testing/
17. Flake Aware Culprit Finding (ICST 2023) — https://hackthology.com/flake-aware-culprit-finding.html
18. Google Research, Flake Aware Culprit Finding — https://research.google/pubs/flake-aware-culprit-finding/
19. Google Research, Speculative testing at Google with transition prediction — https://research.google/pubs/speculative-testing-at-google-with-transition-prediction/
20. Aviator, Batching — https://docs.aviator.co/mergequeue/concepts/batching
21. Aviator, Parallel mode — https://docs.aviator.co/mergequeue/concepts/parallel-mode
22. Aviator, Affected targets — https://docs.aviator.co/mergequeue/concepts/affected-targets
23. Graphite, Merge queue — https://graphite.com/docs/graphite-merge-queue
24. Graphite, Merge queue optimizations — https://graphite.com/docs/merge-queue-optimizations
25. Trunk, Batching — https://docs.trunk.io/merge-queue/optimizations/batching
26. Trunk, Optimistic merging — https://docs.trunk.io/merge-queue/optimizations/optimistic-merging
27. Trunk, Pending failure depth — https://docs.trunk.io/merge-queue/optimizations/pending-failure-depth
28. Trunk, Anti-flake protection — https://docs.trunk.io/merge-queue/optimizations/anti-flake-protection
29. Bazel, User manual (`--cache_test_results`) — https://bazel.build/docs/user-manual
30. bazel-diff — https://github.com/Tinder/bazel-diff
31. target-determinator — https://github.com/bazel-contrib/target-determinator
32. Nx, Affected — https://nx.dev/docs/features/ci-features/affected
33. Nx, Inputs — https://nx.dev/docs/reference/inputs
34. Nx, Project configuration — https://nx.dev/docs/reference/project-configuration
35. Turborepo, Configuration — https://turborepo.dev/docs/reference/configuration
36. Turborepo, `run` — https://turborepo.dev/docs/reference/run
37. Jest CLI — https://jestjs.io/docs/cli
38. Vitest CLI — https://vitest.dev/guide/cli
39. Node.js, Test runner — https://nodejs.org/api/test.html
40. Machalica et al., Predictive Test Selection (ICSE-SEIP 2019) — https://ar5iv.arxiv.org/html/1810.05286
41. Engineering at Meta, Predictive test selection — https://engineering.fb.com/developer-tools/predictive-test-selection/
42. What Breaks Google? (CCIW 2023) — https://conf.researchr.org/details/icst-2023/cciw-2023-papers/5/What-Breaks-Google-
43. Launchable, Choosing a subset optimization target — https://help.launchableinc.com/features/predictive-test-selection/requesting-and-running-a-subset-of-tests/choosing-a-subset-optimization-target/
44. Develocity, Predictive Test Selection — https://docs.gradle.com/develocity/2026.2/administration/build-acceleration/predictive-test-selection/
45. Martin Fowler, The Rise of Test Impact Analysis — https://martinfowler.com/articles/rise-test-impact-analysis.html
46. Claude Code, Memory — https://code.claude.com/docs/en/memory
47. Claude Code, Subagents — https://code.claude.com/docs/en/sub-agents
48. OpenAI Codex, AGENTS.md — https://learn.chatgpt.com/docs/agent-configuration/agents-md
49. Cursor, Rules — https://cursor.com/docs/context/rules
50. Devin, Environment — https://docs.devin.ai/onboard-devin/environment
51. OpenHands, Runtimes — https://docs.openhands.dev/usage/runtimes/overview
52. LangGraph, Add memory — https://docs.langchain.com/oss/python/langgraph/add-memory
53. CrewAI, Memory — https://docs.crewai.com/en/concepts/memory
54. Ruflo/claude-flow, agentdb README — https://raw.githubusercontent.com/ruvnet/claude-flow/HEAD/plugins/ruflo-agentdb/README.md
55. Kubernetes, Object names — https://kubernetes.io/docs/concepts/overview/working-with-objects/names/
56. Anthropic, Effective context engineering for AI agents — https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
57. Claude Docs, Agent Skills best practices — https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
